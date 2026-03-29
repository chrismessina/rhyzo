import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { db, schema } from '@/db';
import { eq } from 'drizzle-orm';

interface Params {
  params: Promise<{ did: string }>;
}

export async function POST(_req: NextRequest, { params }: Params) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { did } = await params;
  const user = db.select().from(schema.users).where(eq(schema.users.did, did)).get();
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  db.update(schema.users)
    .set({ bannedAt: null, banReason: null, updatedAt: new Date() })
    .where(eq(schema.users.id, user.id))
    .run();

  console.log(`[admin] User unbanned: ${user.primaryHandle} (${did}) by ${auth.user.primaryHandle}`);

  return NextResponse.json({ ok: true });
}
