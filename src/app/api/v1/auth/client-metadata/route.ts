import { NextResponse } from 'next/server';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3002';

/**
 * GET /api/v1/auth/client-metadata
 * Serves the OAuth client metadata document.
 * In production, this URL becomes the client_id.
 */
export async function GET() {
  const metadata = {
    client_id: `${BASE_URL}/api/v1/auth/client-metadata`,
    client_name: 'Rhyzo',
    client_uri: BASE_URL,
    logo_uri: `${BASE_URL}/logo.png`,
    tos_uri: `${BASE_URL}/tos`,
    policy_uri: `${BASE_URL}/privacy`,
    redirect_uris: [`${BASE_URL}/api/v1/auth/atproto/callback`],
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    scope: 'atproto',
    token_endpoint_auth_method: 'none',
    application_type: 'web',
    dpop_bound_access_tokens: true,
  };

  return NextResponse.json(metadata, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
