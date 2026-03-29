import { NextResponse } from 'next/server';
import { destroySession } from '@/lib/session';

export async function GET() {
  await destroySession();
  return NextResponse.redirect(new URL('/', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3002'));
}
