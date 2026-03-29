import { NextResponse } from 'next/server';
import { getSession } from './session';
import { db, schema } from '@/db';
import { eq } from 'drizzle-orm';

export interface AdminContext {
  user: typeof schema.users.$inferSelect;
}

/**
 * Verify that the current request is from an authenticated admin user.
 * Returns the admin user or a 401/403 response.
 */
export async function requireAdmin(): Promise<AdminContext | NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, session.userId))
    .get();

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 401 });
  }

  if (user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (user.bannedAt) {
    return NextResponse.json({ error: 'Account banned' }, { status: 403 });
  }

  return { user };
}

/**
 * Check if a DID is in the ADMIN_DIDS env var list.
 */
export function isBootstrapAdmin(did: string): boolean {
  const adminDids = process.env.ADMIN_DIDS;
  if (!adminDids) return false;
  return adminDids.split(',').map(d => d.trim()).includes(did);
}
