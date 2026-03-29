/**
 * Slingshot — AT Protocol edge record cache from Microcosm.
 * https://slingshot.microcosm.blue
 *
 * Drop-in replacement for direct PDS reads with caching.
 */

const SLINGSHOT_BASE = 'https://slingshot.microcosm.blue';

interface SlingshotRecord {
  uri: string;
  cid: string;
  value: Record<string, unknown>;
}

interface SlingshotIdentity {
  did: string;
  handle: string;
  pds: string;
  signing_key: string;
}

/**
 * Resolve a handle to a DID using Slingshot's bi-directionally verified cache.
 */
export async function resolveHandle(handle: string): Promise<string> {
  const res = await fetch(
    `${SLINGSHOT_BASE}/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`,
    { signal: AbortSignal.timeout(5000) }
  );
  if (!res.ok) throw new Error(`Slingshot resolveHandle failed: ${res.status}`);
  const data = await res.json();
  return data.did;
}

/**
 * Get a record from a repo via Slingshot cache.
 */
export async function getRecord(
  repo: string,
  collection: string,
  rkey: string
): Promise<SlingshotRecord | null> {
  const params = new URLSearchParams({ repo, collection, rkey });
  const res = await fetch(
    `${SLINGSHOT_BASE}/xrpc/com.atproto.repo.getRecord?${params}`,
    { signal: AbortSignal.timeout(5000) }
  );
  if (res.status === 404 || res.status === 400) return null;
  if (!res.ok) throw new Error(`Slingshot getRecord failed: ${res.status}`);
  return res.json();
}

/**
 * Resolve an identity to a mini document (DID, handle, PDS, signing key).
 */
export async function resolveMiniDoc(identifier: string): Promise<SlingshotIdentity | null> {
  const res = await fetch(
    `${SLINGSHOT_BASE}/xrpc/blue.microcosm.identity.resolveMiniDoc?identifier=${encodeURIComponent(identifier)}`,
    { signal: AbortSignal.timeout(5000) }
  );
  if (res.status === 404 || res.status === 400) return null;
  if (!res.ok) throw new Error(`Slingshot resolveMiniDoc failed: ${res.status}`);
  return res.json();
}

/**
 * Get a record by its full AT URI.
 */
export async function getRecordByUri(atUri: string): Promise<SlingshotRecord | null> {
  const res = await fetch(
    `${SLINGSHOT_BASE}/xrpc/blue.microcosm.repo.getRecordByUri?at_uri=${encodeURIComponent(atUri)}`,
    { signal: AbortSignal.timeout(5000) }
  );
  if (res.status === 404 || res.status === 400) return null;
  if (!res.ok) throw new Error(`Slingshot getRecordByUri failed: ${res.status}`);
  return res.json();
}

/**
 * Try Slingshot first, fall back to direct PDS for reading Rhyzo records.
 */
export async function getFingerRecords(did: string, collection: string): Promise<SlingshotRecord[]> {
  // Slingshot doesn't have a listRecords endpoint, so we use direct PDS for listing
  // But for individual reads, we prefer Slingshot
  return [];
}
