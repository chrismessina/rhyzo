import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/db';
import { sql, isNull } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const page = Math.max(1, parseInt(params.get('page') || '1'));
  const limit = Math.min(100, Math.max(1, parseInt(params.get('limit') || '50')));
  const search = params.get('search') || '';
  const sort = params.get('sort') || 'newest'; // 'newest' | 'alpha'
  const offset = (page - 1) * limit;

  // Only non-banned users
  let whereClause = isNull(schema.users.bannedAt);
  if (search) {
    const like = `%${search}%`;
    whereClause = sql`${isNull(schema.users.bannedAt)} AND (${schema.users.primaryHandle} LIKE ${like} OR ${schema.users.displayName} LIKE ${like})`;
  }

  const total = db
    .select({ count: sql<number>`count(*)` })
    .from(schema.users)
    .where(whereClause)
    .get()!.count;

  const orderBy = sort === 'alpha'
    ? sql`COALESCE(${schema.users.displayName}, ${schema.users.primaryHandle}) ASC`
    : sql`${schema.users.createdAt} DESC`;

  const users = db
    .select()
    .from(schema.users)
    .where(whereClause)
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset)
    .all();

  // Get account counts for each user
  const usersWithCounts = users.map(u => {
    const accountCount = db
      .select({ count: sql<number>`count(*)` })
      .from(schema.accounts)
      .where(sql`${schema.accounts.userId} = ${u.id}`)
      .get()!.count;

    return {
      slug: u.slug,
      primaryHandle: u.primaryHandle,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl,
      oauthVerified: u.oauthVerified,
      accountCount,
      createdAt: u.createdAt,
    };
  });

  return NextResponse.json({
    users: usersWithCounts,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}
