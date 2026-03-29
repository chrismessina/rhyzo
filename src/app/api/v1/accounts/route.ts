import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/db';
import { eq, and } from 'drizzle-orm';
import { getSession } from '@/lib/session';
import { v4 as uuid } from 'uuid';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { platform, handle, profileUrl } = await req.json();

  if (!platform || !handle) {
    return NextResponse.json({ error: 'Platform and handle are required' }, { status: 400 });
  }

  const id = uuid();
  db.insert(schema.accounts).values({
    id,
    userId: session.userId,
    platform,
    handle,
    profileUrl: profileUrl || null,
    verificationStatus: 'unverified',
  }).run();

  const account = db.select().from(schema.accounts).where(eq(schema.accounts.id, id)).get();
  return NextResponse.json({ account }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const id = req.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Account ID required' }, { status: 400 });
  }

  // Verify ownership
  const account = db.select().from(schema.accounts).where(
    and(eq(schema.accounts.id, id), eq(schema.accounts.userId, session.userId))
  ).get();

  if (!account) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }

  db.delete(schema.accounts).where(eq(schema.accounts.id, id)).run();
  return NextResponse.json({ ok: true });
}
