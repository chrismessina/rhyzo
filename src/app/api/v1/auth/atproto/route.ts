import { NextRequest, NextResponse } from 'next/server';
import { getOAuthClient } from '@/lib/oauth';

/**
 * POST /api/v1/auth/atproto
 * Start the AT Protocol OAuth flow.
 * Accepts { handle } and returns { authUrl } for the client to redirect to.
 */
export async function POST(req: NextRequest) {
  try {
    const { handle } = await req.json();
    if (!handle || typeof handle !== 'string') {
      return NextResponse.json({ error: 'Handle is required' }, { status: 400 });
    }

    const cleanHandle = handle.replace(/^@/, '').trim();
    const client = getOAuthClient();

    // authorize() resolves the handle, discovers the auth server,
    // performs PAR with PKCE + DPoP, and returns the authorization URL
    const authUrl = await client.authorize(cleanHandle, {
      scope: 'atproto',
    });

    return NextResponse.json({ authUrl: authUrl.toString() });
  } catch (error) {
    console.error('OAuth start error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
