import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/db';
import { eq } from 'drizzle-orm';
import { resolveIdentity, handleToSlug } from '@/lib/atproto';
import * as slingshot from '@/lib/slingshot';
import { PROFILE_NSID } from '@/lib/lexicon';
import type { FingerProfile } from '@/lib/lexicon';

export async function GET(req: NextRequest) {
  const handle = req.nextUrl.searchParams.get('handle');
  if (!handle) {
    return NextResponse.json({ error: 'Handle parameter is required' }, { status: 400 });
  }

  const cleanHandle = handle.replace(/^@/, '').trim();

  // Step 1: Resolve the handle to a DID (the authoritative identifier)
  let identity;
  try {
    identity = await resolveIdentity(cleanHandle);
  } catch {
    return NextResponse.json({
      error: `Could not resolve handle "${cleanHandle}". Check the handle and try again.`,
      handle: cleanHandle,
    }, { status: 404 });
  }

  // Step 2: Look up user by DID (handles change, DIDs don't)
  let user = db
    .select()
    .from(schema.users)
    .where(eq(schema.users.did, identity.did))
    .get();

  // If found by DID, update handle/slug if they've changed (handle migration)
  if (user && user.primaryHandle !== identity.handle) {
    const newSlug = handleToSlug(identity.handle);
    // Check slug isn't taken by a different user
    const slugOwner = db.select().from(schema.users).where(eq(schema.users.slug, newSlug)).get();
    if (!slugOwner || slugOwner.id === user.id) {
      db.update(schema.users)
        .set({
          primaryHandle: identity.handle,
          slug: newSlug,
          displayName: identity.displayName || user.displayName,
          avatarUrl: identity.avatarUrl || user.avatarUrl,
          pdsHost: identity.pdsHost,
          updatedAt: new Date(),
        })
        .where(eq(schema.users.id, user.id))
        .run();
      user = db.select().from(schema.users).where(eq(schema.users.id, user.id)).get()!;
    }
  }

  // Step 3: Return claimed profile or stub
  if (user) {
    const accounts = db
      .select()
      .from(schema.accounts)
      .where(eq(schema.accounts.userId, user.id))
      .all();

    return NextResponse.json({
      slug: user.slug,
      handle: user.primaryHandle,
      did: identity.did,
      displayName: user.displayName,
      claimed: true,
      oauthVerified: user.oauthVerified,
      accounts: accounts.map((a) => ({
        platform: a.platform,
        handle: a.handle,
        profileUrl: a.profileUrl,
        verified: a.verificationStatus === 'verified',
        method: a.verificationMethod,
      })),
    });
  }

  // Not in DB — return resolved stub
  const slug = handleToSlug(cleanHandle);

  // Try Slingshot for cached Rhyzo profile records
  let pdsProfile: FingerProfile | null = null;
  try {
    const profileRecord = await slingshot.getRecord(identity.did, PROFILE_NSID, 'self');
    if (profileRecord) {
      pdsProfile = profileRecord.value as unknown as FingerProfile;
    }
  } catch {
    // Slingshot read is best-effort
  }

  return NextResponse.json({
    slug,
    handle: cleanHandle,
    did: identity.did,
    displayName: identity.displayName || null,
    claimed: false,
    oauthVerified: false,
    resolved: {
      did: identity.did,
      pdsHost: identity.pdsHost,
      avatarUrl: identity.avatarUrl || null,
      description: identity.description || null,
      pdsProfile,
    },
  });
}
