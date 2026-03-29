import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { db, schema } from '@/db';
import { eq } from 'drizzle-orm';

interface Params {
  params: Promise<{ did: string }>;
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { did } = await params;

  // Cannot remove yourself
  if (did === auth.user.did) {
    return NextResponse.json({ error: 'Cannot remove yourself as admin' }, { status: 400 });
  }

  const user = db.select().from(schema.users).where(eq(schema.users.did, did)).get();
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'User is not an admin' }, { status: 400 });
  }

  db.update(schema.users)
    .set({ role: 'user', updatedAt: new Date() })
    .where(eq(schema.users.id, user.id))
    .run();

  console.log(`[admin] Admin removed: ${user.primaryHandle} by ${auth.user.primaryHandle}`);

  return NextResponse.json({ ok: true });
}
