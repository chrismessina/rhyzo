import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { db, schema } from '@/db';
import { eq } from 'drizzle-orm';

interface Params {
  params: Promise<{ did: string }>;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { did } = await params;
  const user = db.select().from(schema.users).where(eq(schema.users.did, did)).get();
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const accounts = db.select().from(schema.accounts).where(eq(schema.accounts.userId, user.id)).all();

  return NextResponse.json({ user, accounts });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { did } = await params;
  const user = db.select().from(schema.users).where(eq(schema.users.did, did)).get();
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Cascading delete — accounts are deleted automatically via foreign key
  db.delete(schema.users).where(eq(schema.users.id, user.id)).run();
  console.log(`[admin] User deleted: ${user.primaryHandle} (${did}) by ${auth.user.primaryHandle}`);

  return NextResponse.json({ ok: true });
}
