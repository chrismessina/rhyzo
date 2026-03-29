import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { db, schema } from '@/db';
import { eq, isNotNull, sql } from 'drizzle-orm';

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const totalUsers = db.select({ count: sql<number>`count(*)` }).from(schema.users).get()!.count;
  const verifiedUsers = db.select({ count: sql<number>`count(*)` }).from(schema.users).where(eq(schema.users.oauthVerified, true)).get()!.count;
  const bannedUsers = db.select({ count: sql<number>`count(*)` }).from(schema.users).where(isNotNull(schema.users.bannedAt)).get()!.count;
  const adminUsers = db.select({ count: sql<number>`count(*)` }).from(schema.users).where(eq(schema.users.role, 'admin')).get()!.count;

  // Recent signups (last 7 days)
  const sevenDaysAgoSec = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);
  const recentSignups = db
    .select()
    .from(schema.users)
    .where(sql`${schema.users.createdAt} > ${sevenDaysAgoSec}`)
    .orderBy(sql`${schema.users.createdAt} DESC`)
    .limit(10)
    .all()
    .map(u => ({
      id: u.id,
      handle: u.primaryHandle,
      slug: u.slug,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl,
      createdAt: u.createdAt,
    }));

  return NextResponse.json({
    totalUsers,
    verifiedUsers,
    bannedUsers,
    adminUsers,
    recentSignups,
  });
}
