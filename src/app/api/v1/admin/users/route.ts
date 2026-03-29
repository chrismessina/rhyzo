import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { db, schema } from '@/db';
import { sql } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const params = req.nextUrl.searchParams;
  const page = Math.max(1, parseInt(params.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(params.get('limit') || '50')));
  const search = params.get('search') || '';
  const offset = (page - 1) * limit;

  let whereClause = sql`1=1`;
  if (search) {
    const like = `%${search}%`;
    whereClause = sql`(${schema.users.primaryHandle} LIKE ${like} OR ${schema.users.did} LIKE ${like} OR ${schema.users.slug} LIKE ${like} OR ${schema.users.displayName} LIKE ${like})`;
  }

  const total = db
    .select({ count: sql<number>`count(*)` })
    .from(schema.users)
    .where(whereClause)
    .get()!.count;

  const users = db
    .select()
    .from(schema.users)
    .where(whereClause)
    .orderBy(sql`${schema.users.createdAt} DESC`)
    .limit(limit)
    .offset(offset)
    .all()
    .map(u => ({
      id: u.id,
      primaryHandle: u.primaryHandle,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl,
      slug: u.slug,
      did: u.did,
      role: u.role,
      oauthVerified: u.oauthVerified,
      bannedAt: u.bannedAt,
      banReason: u.banReason,
      createdAt: u.createdAt,
    }));

  return NextResponse.json({
    users,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}
