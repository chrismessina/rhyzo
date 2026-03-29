import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/db';
import { eq } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const resource = req.nextUrl.searchParams.get('resource');
  if (!resource) {
    return NextResponse.json(
      { error: 'Missing resource parameter' },
      { status: 400, headers: { 'Content-Type': 'application/jrd+json' } }
    );
  }

  // Parse acct: URI → extract handle
  let handle = resource;
  if (handle.startsWith('acct:')) {
    handle = handle.slice(5);
  }
  // Remove @rhyzo.com suffix if present
  handle = handle.replace(/@rhyzo\.com$/, '');

  // Look up by slug, primary handle, or domain
  const user = db
    .select()
    .from(schema.users)
    .where(eq(schema.users.slug, handle))
    .get()
    || db.select().from(schema.users).where(eq(schema.users.primaryHandle, handle)).get()
    || db.select().from(schema.users).where(eq(schema.users.domain, handle)).get();

  if (!user) {
    return NextResponse.json(
      { error: 'Resource not found' },
      { status: 404, headers: { 'Content-Type': 'application/jrd+json' } }
    );
  }

  const accounts = db
    .select()
    .from(schema.accounts)
    .where(eq(schema.accounts.userId, user.id))
    .all();

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

  // Build JRD (JSON Resource Descriptor) per RFC 7033
  const jrd = {
    subject: `acct:${user.slug}@rhyzo.com`,
    aliases: [
      `${baseUrl}/${user.slug}`,
      ...(user.did ? [user.did] : []),
    ],
    properties: {
      'http://schema.org/name': user.displayName || user.primaryHandle,
      ...(user.bio ? { 'http://schema.org/description': user.bio } : {}),
    },
    links: [
      // Profile page
      {
        rel: 'http://webfinger.net/rel/profile-page',
        type: 'text/html',
        href: `${baseUrl}/${user.slug}`,
      },
      // JSON profile
      {
        rel: 'self',
        type: 'application/json',
        href: `${baseUrl}/${user.slug}.json`,
      },
      // Avatar
      ...(user.avatarUrl
        ? [{
            rel: 'http://webfinger.net/rel/avatar',
            type: 'image/*',
            href: user.avatarUrl,
          }]
        : []),
      // Linked accounts
      ...accounts
        .filter((a) => a.profileUrl)
        .map((a) => ({
          rel: 'me',
          type: 'text/html',
          href: a.profileUrl!,
          properties: {
            'http://rhyzo.com/ns/platform': a.platform,
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
