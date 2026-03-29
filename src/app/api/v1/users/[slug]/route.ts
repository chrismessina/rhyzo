import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/db';
import { eq } from 'drizzle-orm';
import { getSession } from '@/lib/session';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function GET(req: NextRequest, { params }: Props) {
  const { slug: rawSlug } = await params;
  // Strip leading @ or %40 (Next.js encodes @ in dynamic params)
  let slug = rawSlug;
  try { slug = decodeURIComponent(rawSlug); } catch { /* use raw */ }
  if (slug.startsWith('@')) slug = slug.slice(1);

  const user = db.select().from(schema.users).where(eq(schema.users.slug, slug)).get();

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const accounts = db
    .select()
    .from(schema.accounts)
    .where(eq(schema.accounts.userId, user.id))
    .all();

  // Return JRD (JSON Resource Descriptor) format for .json requests
  const format = req.nextUrl.searchParams.get('format');
  if (format === 'json') {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const jrd = {
      subject: `acct:${user.slug}@rhyzo.com`,
      aliases: [
        `${baseUrl}/@${user.slug}`,
        ...(user.did ? [user.did] : []),
      ],
      properties: {
        'http://schema.org/name': user.displayName || user.primaryHandle,
        ...(user.tagline ? { 'http://schema.org/description': user.tagline } : {}),
        ...(user.bio ? { 'http://schema.org/about': user.bio } : {}),
      },
      links: [
        {
          rel: 'http://webfinger.net/rel/profile-page',
          type: 'text/html',
          href: `${baseUrl}/@${user.slug}`,
        },
        {
          rel: 'self',
          type: 'application/jrd+json',
          href: `${baseUrl}/@${user.slug}.json`,
        },
        ...(user.avatarUrl
          ? [{
              rel: 'http://webfinger.net/rel/avatar',
              type: 'image/*',
              href: user.avatarUrl,
            }]
          : []),
        ...accounts
          .filter((a) => a.profileUrl)
          .map((a) => ({
            rel: 'me',
            type: 'text/html',
            href: a.profileUrl!,
            properties: {
              'http://rhyzo.com/ns/platform': a.platform,
              'http://rhyzo.com/ns/handle': a.handle,
              'http://rhyzo.com/ns/verified': String(a.verificationStatus === 'verified'),
            },
          })),
      ],
    };

    return NextResponse.json(jrd, {
      headers: {
        'Content-Type': 'application/jrd+json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  // Strip internal/admin fields before returning
  const publicUser = {
    slug: user.slug,
    primaryHandle: user.primaryHandle,
    displayName: user.displayName,
    tagline: user.tagline,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    domain: user.domain,
    did: user.did,
    pdsHost: user.pdsHost,
    oauthVerified: user.oauthVerified,
    createdAt: user.createdAt,
  };

  const publicAccounts = accounts.map((a) => ({
    platform: a.platform,
    handle: a.handle,
    profileUrl: a.profileUrl,
    verificationStatus: a.verificationStatus,
    verificationMethod: a.verificationMethod,
    verifiedAt: a.verifiedAt,
  }));

  return NextResponse.json({ user: publicUser, accounts: publicAccounts });
}

export async function PATCH(req: NextRequest, { params }: Props) {
  const { slug } = await params;
  const session = await getSession();
  if (!session || session.slug !== slug) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (body.displayName !== undefined) updates.displayName = body.displayName;
  if (body.bio !== undefined) updates.bio = body.bio;
  if (body.tagline !== undefined) updates.tagline = body.tagline;
  if (body.avatarUrl !== undefined) updates.avatarUrl = body.avatarUrl;
  if (body.domain !== undefined) updates.domain = body.domain;

  db.update(schema.users).set(updates).where(eq(schema.users.slug, slug)).run();

  const user = db.select().from(schema.users).where(eq(schema.users.slug, slug)).get();
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  return NextResponse.json({
    user: {
      slug: user.slug,
      primaryHandle: user.primaryHandle,
      displayName: user.displayName,
      tagline: user.tagline,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      domain: user.domain,
      did: user.did,
      pdsHost: user.pdsHost,
      oauthVerified: user.oauthVerified,
    },
  });
}
