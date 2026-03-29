/**
 * AT Protocol OAuth client setup.
 * Uses @atproto/oauth-client-node with SQLite-backed state/session stores.
 */
import { NodeOAuthClient } from '@atproto/oauth-client-node';
import type { NodeSavedState, NodeSavedSession } from '@atproto/oauth-client-node';
import { db, schema } from '@/db';
import { eq } from 'drizzle-orm';

// SQLite-backed state store (for in-flight OAuth requests)
const stateStore = {
  async get(key: string): Promise<NodeSavedState | undefined> {
    const row = db.select().from(schema.oauthStates).where(eq(schema.oauthStates.key, key)).get();
    if (!row) return undefined;
    return JSON.parse(row.state) as NodeSavedState;
  },
  async set(key: string, value: NodeSavedState): Promise<void> {
    const json = JSON.stringify(value);
    db.insert(schema.oauthStates)
      .values({ key, state: json })
      .onConflictDoUpdate({ target: schema.oauthStates.key, set: { state: json } })
      .run();
  },
  async del(key: string): Promise<void> {
    db.delete(schema.oauthStates).where(eq(schema.oauthStates.key, key)).run();
  },
};

// SQLite-backed session store (for active OAuth sessions)
const sessionStore = {
  async get(key: string): Promise<NodeSavedSession | undefined> {
    const row = db.select().from(schema.oauthSessions).where(eq(schema.oauthSessions.key, key)).get();
    if (!row) return undefined;
    return JSON.parse(row.session) as NodeSavedSession;
  },
  async set(key: string, value: NodeSavedSession): Promise<void> {
    const json = JSON.stringify(value);
    db.insert(schema.oauthSessions)
      .values({ key, session: json })
      .onConflictDoUpdate({
        target: schema.oauthSessions.key,
        set: { session: json, updatedAt: new Date() },
      })
      .run();
  },
  async del(key: string): Promise<void> {
    db.delete(schema.oauthSessions).where(eq(schema.oauthSessions.key, key)).run();
  },
};

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3002';
const isLocalhost = BASE_URL.includes('localhost') || BASE_URL.includes('127.0.0.1');

function getClientMetadata() {
  const redirectUri = `${BASE_URL}/api/v1/auth/atproto/callback` as const;
  const scope = 'atproto';

  const base = {
    client_name: 'Rhyzo',
    client_uri: BASE_URL,
    redirect_uris: [redirectUri] as [typeof redirectUri],
    grant_types: ['authorization_code', 'refresh_token'] as ['authorization_code', 'refresh_token'],
    response_types: ['code'] as ['code'],
    scope,
    token_endpoint_auth_method: 'none' as const,
    application_type: 'web' as const,
    dpop_bound_access_tokens: true,
  };

  if (isLocalhost) {
    // Loopback client: client_id uses http://localhost, redirect_uri uses 127.0.0.1
    const loopbackRedirect = redirectUri.replace('localhost', '127.0.0.1');
    const clientId = `http://localhost?redirect_uri=${encodeURIComponent(loopbackRedirect)}&scope=${encodeURIComponent(scope)}`;
    return { ...base, client_id: clientId, redirect_uris: [loopbackRedirect] as [string] };
  }

  // Production: client_id is the URL where metadata is hosted
  return { ...base, client_id: `${BASE_URL}/api/v1/auth/client-metadata` };
}

let _client: NodeOAuthClient | null = null;

export function getOAuthClient(): NodeOAuthClient {
  if (_client) return _client;

  _client = new NodeOAuthClient({
    clientMetadata: getClientMetadata(),
    stateStore,
    sessionStore,
    allowHttp: isLocalhost,
    fallbackNameservers: ['8.8.8.8', '1.1.1.1'],
  });

  return _client;
}

export { stateStore, sessionStore };
