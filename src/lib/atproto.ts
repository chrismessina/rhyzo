/**
 * AT Protocol handle resolution and DID verification.
 * Works with any PDS — Bluesky, selfhosted.social, Periwinkle, self-hosted.
 */

interface DidDocument {
  id: string;
  alsoKnownAs?: string[];
  verificationMethod?: Array<{
    id: string;
    type: string;
    controller: string;
    publicKeyMultibase?: string;
  }>;
  service?: Array<{
    id: string;
    type: string;
    serviceEndpoint: string;
  }>;
}

interface ResolvedIdentity {
  handle: string;
  did: string;
  pdsHost: string;
  didDocument: DidDocument;
  displayName?: string;
  avatarUrl?: string;
  description?: string;
}

/**
 * Resolve an AT Protocol handle to its DID.
 * Tries DNS TXT first (_atproto.handle), then HTTPS well-known.
 */
export async function resolveHandleToDid(handle: string): Promise<string> {
  // Clean the handle
  handle = handle.replace(/^@/, '');

  // Try HTTPS well-known method (works for all PDS types)
  try {
    const res = await fetch(`https://${handle}/.well-known/atproto-did`, {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const did = (await res.text()).trim();
      if (did.startsWith('did:')) return did;
    }
  } catch {
    // Fall through to DNS
  }

  // Try DNS TXT method
  try {
    const dnsRes = await fetch(
      `https://dns.google/resolve?name=_atproto.${handle}&type=TXT`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (dnsRes.ok) {
      const data = await dnsRes.json();
      const txtRecords = data.Answer || [];
      for (const record of txtRecords) {
        const value = record.data?.replace(/"/g, '') || '';
        if (value.startsWith('did=')) {
          return value.slice(4);
        }
      }
    }
  } catch {
    // Both methods failed
  }

  throw new Error(`Could not resolve handle: ${handle}`);
}

/**
 * Resolve a DID to its DID document.
 * Supports did:plc and did:web methods.
 */
export async function resolveDidDocument(did: string): Promise<DidDocument> {
  if (did.startsWith('did:plc:')) {
    const res = await fetch(`https://plc.directory/${did}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`Failed to resolve DID: ${did}`);
    return res.json();
  }

  if (did.startsWith('did:web:')) {
    const domain = did.slice(8).replace(/:/g, '/');
    const res = await fetch(`https://${domain}/.well-known/did.json`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`Failed to resolve did:web: ${did}`);
    return res.json();
  }

  throw new Error(`Unsupported DID method: ${did}`);
}

/**
 * Extract the PDS endpoint from a DID document.
 */
export function getPdsEndpoint(didDoc: DidDocument): string {
  const pdsService = didDoc.service?.find(
    (s) => s.id === '#atproto_pds' || s.type === 'AtprotoPersonalDataServer'
  );
  if (!pdsService) throw new Error('No PDS service found in DID document');
  return pdsService.serviceEndpoint;
}

/**
 * Get the hostname of the PDS from a DID document.
 */
export function getPdsHost(didDoc: DidDocument): string {
  const endpoint = getPdsEndpoint(didDoc);
  return new URL(endpoint).hostname;
}

/**
 * Fetch a profile from a PDS using the AT Protocol API.
 * Falls back to the public Bluesky API if the direct PDS call fails.
 */
export async function fetchProfile(did: string, pdsEndpoint: string) {
  // Try direct PDS endpoint first
  try {
    const res = await fetch(
      `${pdsEndpoint}/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(did)}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (res.ok) return res.json();
  } catch {
    // Fall through to public API
  }

  // Fallback to public Bluesky API
  try {
    const res = await fetch(
      `https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(did)}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (res.ok) return res.json();
  } catch {
    // Profile fetch is best-effort
  }

  return null;
}

/**
 * Full identity resolution: handle → DID → DID doc → PDS → profile.
 */
export async function resolveIdentity(handle: string): Promise<ResolvedIdentity> {
  handle = handle.replace(/^@/, '');

  const did = await resolveHandleToDid(handle);
  const didDocument = await resolveDidDocument(did);
  const pdsEndpoint = getPdsEndpoint(didDocument);
  const pdsHost = getPdsHost(didDocument);

  // Try to fetch profile data from PDS
  let displayName: string | undefined;
  let avatarUrl: string | undefined;
  let description: string | undefined;

  try {
    const profile = await fetchProfile(did, pdsEndpoint);
    if (profile) {
      displayName = profile.displayName;
      avatarUrl = profile.avatar;
      description = profile.description;
    }
  } catch {
    // Profile fetch is optional
  }

  return {
    handle,
    did,
    pdsHost,
    didDocument,
    displayName,
    avatarUrl,
    description,
  };
}

/**
 * Generate a slug from a handle.
 * chrismessina.me → chrismessina
 * user.bsky.social → user
 * @user@mastodon.social → user
 */
export function handleToSlug(handle: string): string {
  handle = handle.replace(/^@/, '').toLowerCase();

  // Use the full handle as the slug — preserves domain identity
  // chrismessina.me → chrismessina.me
  // snarfed.org → snarfed.org
  // user.bsky.social → user.bsky.social
  // @user@mastodon.social → user@mastodon.social
  return handle;
}
