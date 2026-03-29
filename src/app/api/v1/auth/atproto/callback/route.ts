import { NextRequest, NextResponse } from 'next/server';
import { getOAuthClient } from '@/lib/oauth';
import { db, schema } from '@/db';
import { eq } from 'drizzle-orm';
import { handleToSlug, resolveDidDocument, getPdsHost, fetchProfile } from '@/lib/atproto';
import { createSessionToken, SESSION_COOKIE_NAME } from '@/lib/session';
import { PROFILE_NSID } from '@/lib/lexicon';
import { v4 as uuid } from 'uuid';
import { isBootstrapAdmin } from '@/lib/admin';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3002';

// In localhost mode the AT Protocol OAuth loopback spec requires redirect_uri to use
// 127.0.0.1, so Bluesky's PDS sends the browser to 127.0.0.1:PORT/callback.
// Cookies set on a 127.0.0.1 response are NOT sent to localhost (different origins).
// To keep the cookie domain consistent we must also redirect onwards to 127.0.0.1.
const isLocalhost = BASE_URL.includes('localhost') || BASE_URL.includes('127.0.0.1');
const COOKIE_ORIGIN = isLocalhost ? BASE_URL.replace('localhost', '127.0.0.1') : BASE_URL;

/**
 * GET /api/v1/auth/atproto/callback
 * OAuth callback — the user's PDS auth server redirects here after approval.
 */
export async function GET(req: NextRequest) {
  try {
    const client = getOAuthClient();
    const params = req.nextUrl.searchParams;

    // callback() verifies state, exchanges code for tokens (with DPoP), validates sub
    const { session: oauthSession } = await client.callback(params);

    const did = oauthSession.did;
    const didString = did as string;

    // Resolve identity details
    let handle: string = didString;
    let pdsHost = '';
    let pdsEndpoint = '';
    try {
      const didDoc = await resolveDidDocument(did);
      const aka = didDoc.alsoKnownAs?.find((a) => a.startsWith('at://'));
      if (aka) handle = aka.replace('at://', '');
      pdsHost = getPdsHost(didDoc);
      const pdsService = didDoc.service?.find(
        (s) => s.id === '#atproto_pds' || s.type === 'AtprotoPersonalDataServer'
      );
      if (pdsService) pdsEndpoint = pdsService.serviceEndpoint;
    } catch {
      // Use DID as handle fallback
    }

    // Check if user already exists
    let user = db
      .select()
      .from(schema.users)
      .where(eq(schema.users.did, didString))
      .get();

    // Ban check: block banned users from signing in
    if (user?.bannedAt) {
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent('Your account has been banned.')}`, COOKIE_ORIGIN)
      );
    }

    if (!user) {
      // Generate unique slug
      let slug = handleToSlug(handle);
      const existingSlug = db
        .select()
        .from(schema.users)
        .where(eq(schema.users.slug, slug))
        .get();
      if (existingSlug) {
        slug = `${slug}-${Date.now().toString(36)}`;
      }

      // Determine domain
      const isDomainHandle = !handle.includes('.bsky.social') &&
        !handle.includes('.selfhosted.social') &&
        handle.includes('.');
      const domain = isDomainHandle ? handle : undefined;

      // Fetch profile from PDS
      let displayName: string | undefined;
      let avatarUrl: string | undefined;
      let description: string | undefined;

      if (pdsEndpoint) {
        try {
          const profile = await fetchProfile(didString, pdsEndpoint);
          if (profile) {
            displayName = profile.displayName;
            avatarUrl = profile.avatar;
            description = profile.description;
          }
        } catch {
          // Profile fetch is best-effort
        }
      }

      const id = uuid();
      const role = isBootstrapAdmin(didString) ? 'admin' : 'user';
      db.insert(schema.users).values({
        id,
        primaryHandle: handle,
        displayName: displayName || null,
        bio: description || null,
        avatarUrl: avatarUrl || null,
        domain: domain || null,
        did: didString,
        pdsHost,
        slug,
        oauthVerified: true,
        role,
      }).run();

      user = db.select().from(schema.users).where(eq(schema.users.id, id)).get()!;

      // Create the AT Protocol account entry as OAuth-verified
      db.insert(schema.accounts).values({
        id: uuid(),
        userId: id,
        platform: 'atproto',
        handle,
        profileUrl: `https://bsky.app/profile/${handle}`,
        verificationMethod: 'oauth',
        verificationStatus: 'verified',
        verifiedAt: new Date(),
        metadata: JSON.stringify({ did: didString, pdsHost }),
      }).run();

      // Write Rhyzo profile record to user's PDS
      try {
        await writeProfileToPds(oauthSession, didString, {
          displayName,
          bio: description,
          tagline: undefined,
          domain,
        });
      } catch (err) {
        console.error('Failed to write profile to PDS:', err);
        // Non-fatal — profile is still created locally
      }
    } else {
      // Update existing user as OAuth verified + auto-promote if bootstrap admin
      const updateData: Record<string, unknown> = { oauthVerified: true, updatedAt: new Date() };
      if (isBootstrapAdmin(didString) && user.role !== 'admin') {
        updateData.role = 'admin';
      }
      db.update(schema.users)
        .set(updateData)
        .where(eq(schema.users.id, user.id))
        .run();
      // Refresh user after update
      user = db.select().from(schema.users).where(eq(schema.users.id, user.id)).get()!;

      // Update the AT Proto account verification
      const atAccount = db
        .select()
        .from(schema.accounts)
        .where(eq(schema.accounts.userId, user.id))
        .all()
        .find(a => a.platform === 'atproto');

      if (atAccount) {
        db.update(schema.accounts)
          .set({
            verificationMethod: 'oauth',
            verificationStatus: 'verified',
            verifiedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(schema.accounts.id, atAccount.id))
          .run();
      }
    }

    // Create session token and set cookie on the redirect response
    const token = await createSessionToken({
      userId: user.id,
      handle: user.primaryHandle,
      slug: user.slug,
    });

    const response = NextResponse.redirect(new URL(`/@${user.slug}`, COOKIE_ORIGIN));
    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60,
      path: '/',
    });
    return response;
  } catch (error) {
    console.error('OAuth callback error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(message)}`, COOKIE_ORIGIN)
    );
  }
}

/**
 * Write the Rhyzo profile record to the user's PDS
 * using the OAuth session's authenticated fetchHandler.
 */
async function writeProfileToPds(
  oauthSession: { fetchHandler: (pathname: string, init?: RequestInit) => Promise<Response> },
  did: string,
  profile: { displayName?: string; bio?: string; tagline?: string; domain?: string }
) {
  const record = {
    $type: PROFILE_NSID,
    displayName: profile.displayName || undefined,
    bio: profile.bio || undefined,
    tagline: profile.tagline || undefined,
    domain: profile.domain || undefined,
    createdAt: new Date().toISOString(),
  };

  // fetchHandler is an authenticated fetch that adds DPoP headers
  // It takes XRPC method paths, not full URLs
  const res = await oauthSession.fetchHandler(
    '/xrpc/com.atproto.repo.putRecord',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        repo: did,
        collection: PROFILE_NSID,
        rkey: 'self',
        record,
      }),
    }
  );

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`PDS putRecord failed: ${res.status} ${body}`);
  }
}
