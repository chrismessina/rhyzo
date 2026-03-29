import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { db, schema } from '@/db';
import { eq } from 'drizzle-orm';
import { resolveIdentity } from '@/lib/atproto';

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const admins = db
    .select()
    .from(schema.users)
    .where(eq(schema.users.role, 'admin'))
    .all()
    .map(u => ({
      id: u.id,
      primaryHandle: u.primaryHandle,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl,
      did: u.did,
      slug: u.slug,
      createdAt: u.createdAt,
    }));

  return NextResponse.json({ admins });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const { identifier } = body; // handle or DID

  if (!identifier) {
    return NextResponse.json({ error: 'identifier is required (handle or DID)' }, { status: 400 });
  }

  // Try to find by DID first, then by handle/slug
  let user = db.select().from(schema.users).where(eq(schema.users.did, identifier)).get();
  if (!user) {
    user = db.select().from(schema.users).where(eq(schema.users.primaryHandle, identifier)).get();
  }
  if (!user) {
    user = db.select().from(schema.users).where(eq(schema.users.slug, identifier)).get();
  }

  // If not found locally, try to resolve the handle
  if (!user) {
    try {
      const identity = await resolveIdentity(identifier);
      user = db.select().from(schema.users).where(eq(schema.users.did, identity.did)).get();
    } catch {
      // Resolution failed
    }
  }

  if (!user) {
    return NextResponse.json({ error: 'User not found. They must have an account on Rhyzo first.' }, { status: 404 });
  }

  if (user.role === 'admin') {
    return NextResponse.json({ error: 'User is already an admin' }, { status: 400 });
  }

  db.update(schema.users)
    .set({ role: 'admin', updatedAt: new Date() })
    .where(eq(schema.users.id, user.id))
    .run();

  console.log(`[admin] Admin added: ${user.primaryHandle} by ${auth.user.primaryHandle}`);

  return NextResponse.json({ ok: true, user: { handle: user.primaryHandle, did: user.did } });
}
