'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import CopyLink from '@/app/copy-link';

interface UserProfile {
  id: string;
  slug: string;
  primaryHandle: string;
  displayName: string | null;
  bio: string | null;
  tagline: string | null;
  avatarUrl: string | null;
  domain: string | null;
  did: string | null;
  pdsHost: string | null;
}

interface AccountEntry {
  id: string;
  platform: string;
  handle: string;
  profileUrl: string | null;
  verificationStatus: string;
  verificationMethod: string | null;
}

// --- Platform config ---

const PLATFORM_LABELS: Record<string, string> = {
  atproto: 'Bluesky',
  mastodon: 'Mastodon',
  github: 'GitHub',
  twitter: 'Twitter/X',
  linkedin: 'LinkedIn',
  threads: 'Threads',
  figma: 'Figma',
  domain: 'Website',
  other: 'Other',
};

function platformLabel(platform: string, handle: string): string {
  if (platform === 'atproto') {
    if (handle.startsWith('did:')) return 'Atmosphere';
    return 'Bluesky';
  }
  return PLATFORM_LABELS[platform] || platform.charAt(0).toUpperCase() + platform.slice(1);
}

/** Google Favicon API — works for any domain, no CORS issues */
function faviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`;
}

const PLATFORM_DOMAINS: Record<string, string> = {
  atproto: 'bsky.app',
  mastodon: 'mastodon.social',
  github: 'github.com',
  twitter: 'x.com',
  linkedin: 'linkedin.com',
  threads: 'threads.net',
  figma: 'figma.com',
};

function platformFaviconUrl(platform: string, profileUrl?: string | null): string | null {
  // For websites/other, try to extract domain from profile URL
  if ((platform === 'domain' || platform === 'other') && profileUrl) {
    try {
      const domain = new URL(profileUrl).hostname;
      return faviconUrl(domain);
    } catch { /* fall through */ }
  }
  const domain = PLATFORM_DOMAINS[platform];
  if (domain) return faviconUrl(domain);
  return null;
}

// --- URL detection ---

interface DetectedAccount {
  platform: string;
  handle: string;
  profileUrl: string;
}

/** Detect platform and handle from a pasted URL */
function detectFromUrl(input: string): DetectedAccount | null {
  const s = input.trim();
  if (!s) return null;

  // Normalize — add https:// if missing but looks like a URL
  const url = s.startsWith('http') ? s : (s.includes('.') && s.includes('/') ? `https://${s}` : null);
  if (!url) return null;

  const patterns: [RegExp, string, (m: RegExpMatchArray) => { handle: string; profileUrl: string }][] = [
    [/bsky\.app\/profile\/([a-zA-Z0-9._-]+)/, 'atproto', m => ({
      handle: m[1], profileUrl: `https://bsky.app/profile/${m[1]}`,
    })],
    [/github\.com\/([a-zA-Z0-9_-]+)\/?$/, 'github', m => ({
      handle: m[1], profileUrl: `https://github.com/${m[1]}`,
    })],
    [/(x|twitter)\.com\/([a-zA-Z0-9_]+)\/?$/, 'twitter', m => ({
      handle: m[2], profileUrl: `https://x.com/${m[2]}`,
    })],
    [/linkedin\.com\/in\/([a-zA-Z0-9_-]+)\/?/, 'linkedin', m => ({
      handle: m[1], profileUrl: `https://linkedin.com/in/${m[1]}`,
    })],
    [/threads\.net\/@?([a-zA-Z0-9_.]+)\/?$/, 'threads', m => ({
      handle: m[1], profileUrl: `https://threads.net/@${m[1]}`,
    })],
    [/figma\.com\/@([a-zA-Z0-9_-]+)\/?$/, 'figma', m => ({
      handle: m[1], profileUrl: `https://figma.com/@${m[1]}`,
    })],
    // Mastodon/Fediverse — any domain with /@user path
    [/^https?:\/\/([a-zA-Z0-9.-]+\.[a-z]+)\/@([a-zA-Z0-9_]+)\/?$/, 'mastodon', m => ({
      handle: `${m[2]}@${m[1]}`, profileUrl: `https://${m[1]}/@${m[2]}`,
    })],
  ];

  for (const [pattern, platform, extract] of patterns) {
    const match = url.match(pattern);
    if (match) return { platform, ...extract(match) };
  }

  // Unknown URL — treat as website
  try {
    const parsed = new URL(url);
    return { platform: 'domain', handle: parsed.hostname, profileUrl: url };
  } catch {
    return null;
  }
}

/** Auto-generate profile URL from platform + handle */
function generateProfileUrl(platform: string, handle: string): string | null {
  if (!handle) return null;
  switch (platform) {
    case 'github': return `https://github.com/${handle}`;
    case 'twitter': return `https://x.com/${handle}`;
    case 'linkedin': return `https://linkedin.com/in/${handle}`;
    case 'threads': return `https://threads.net/@${handle}`;
    case 'atproto': return `https://bsky.app/profile/${handle}`;
    case 'figma': return `https://figma.com/@${handle}`;
    case 'mastodon': {
      // handle format: user@instance.tld
      const parts = handle.split('@').filter(Boolean);
      if (parts.length === 2) return `https://${parts[1]}/@${parts[0]}`;
      return null;
    }
    case 'domain': return handle.startsWith('http') ? handle : `https://${handle}`;
    default: return null;
  }
}

// --- Component ---

export default function EditProfilePage() {
  const router = useRouter();
  const params = useParams();
  const slug = typeof params.slug === 'string' ? params.slug : '';

  const [user, setUser] = useState<UserProfile | null>(null);
  const [accounts, setAccounts] = useState<AccountEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Add account form
  const [newPlatform, setNewPlatform] = useState('');
  const [newHandle, setNewHandle] = useState('');
  const [newProfileUrl, setNewProfileUrl] = useState('');
  const [addingAccount, setAddingAccount] = useState(false);
  const [detectedFavicon, setDetectedFavicon] = useState<string | null>(null);
  const [urlDetected, setUrlDetected] = useState(false);

  // Edit profile
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editTagline, setEditTagline] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const sessionRes = await fetch('/api/auth/session');
    if (!sessionRes.ok) { router.push('/login'); return; }
    const session = await sessionRes.json();
    if (session.slug !== slug) { router.push(`/${slug}`); return; }
    const userRes = await fetch(`/api/v1/users/${session.slug}`);
    const userData = await userRes.json();
    setUser(userData.user);
    setAccounts(userData.accounts || []);
    setEditName(userData.user.displayName || '');
    setEditBio(userData.user.bio || '');
    setEditTagline(userData.user.tagline || '');
    setLoading(false);
  }

  const handleProfileUrlChange = useCallback((value: string) => {
    setNewProfileUrl(value);
    const detected = detectFromUrl(value);
    if (detected) {
      setNewPlatform(detected.platform);
      setNewHandle(detected.handle);
      setUrlDetected(true);
      try {
        const domain = new URL(detected.profileUrl).hostname;
        setDetectedFavicon(faviconUrl(domain));
      } catch {
        setDetectedFavicon(null);
      }
    } else {
      setUrlDetected(false);
      setDetectedFavicon(null);
    }
  }, []);

  async function handleAddAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!newPlatform || !newHandle) return;

    setAddingAccount(true);
    const profileUrl = newProfileUrl || generateProfileUrl(newPlatform, newHandle);
    const res = await fetch('/api/v1/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform: newPlatform,
        handle: newHandle,
        profileUrl: profileUrl || undefined,
      }),
    });

    if (res.ok) {
      setNewPlatform('');
      setNewHandle('');
      setNewProfileUrl('');
      setDetectedFavicon(null);
      setUrlDetected(false);
      await fetchData();
    }
    setAddingAccount(false);
  }

  async function handleDeleteAccount(id: string) {
    await fetch(`/api/v1/accounts?id=${id}`, { method: 'DELETE' });
    await fetchData();
  }

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    await fetch(`/api/v1/users/${user.slug}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: editName, bio: editBio, tagline: editTagline }),
    });
    setEditing(false);
    await fetchData();
  }

  const primaryAccountId = accounts.find(a => a.platform === 'atproto')?.id;
  const canSubmit = newPlatform && newHandle;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-fg-muted text-sm">Loading...</p>
      </div>
    );
  }
  if (!user) return null;

  return (
    <div className="flex justify-center min-h-screen px-4 py-16">
      <div className="max-w-profile w-full">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-12">
          <h1 className="text-lg font-bold">Edit Profile</h1>
          <a href={`/@${user.slug}`} className="text-sm text-fg-muted hover:text-accent transition-colors">
            View profile &#x2197;
          </a>
        </div>

        {/* Profile section */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-header mb-0">Profile</h2>
            <button
              onClick={() => setEditing(!editing)}
              className="text-sm text-fg-muted hover:text-accent transition-colors"
            >
              {editing ? 'Cancel' : 'Edit'}
            </button>
          </div>

          {editing ? (
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="text-xs text-fg-light block mb-1">Display Name</label>
                <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="input" />
              </div>
              <div>
                <label className="text-xs text-fg-light block mb-1">Tagline</label>
                <input type="text" value={editTagline} onChange={(e) => setEditTagline(e.target.value)} placeholder="e.g., Design in San Francisco" className="input" />
              </div>
              <div>
                <label className="text-xs text-fg-light block mb-1">Bio</label>
                <textarea value={editBio} onChange={(e) => setEditBio(e.target.value)} rows={3} className="input resize-none" />
              </div>
              <button type="submit" className="btn-primary">Save</button>
            </form>
          ) : (
            <div className="flex items-start gap-4">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className="w-12 h-12 rounded-full object-cover" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-fg/10 flex items-center justify-center text-fg-muted font-medium">
                  {(user.displayName || user.primaryHandle).charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <p className="font-medium">{user.displayName || user.primaryHandle}</p>
                {user.tagline && <p className="text-sm text-fg-muted">{user.tagline}</p>}
                {user.bio && <p className="text-sm text-fg-muted mt-1 whitespace-pre-line">{user.bio}</p>}
              </div>
            </div>
          )}
        </section>

        {/* Linked Accounts */}
        <section className="mb-12">
          <h2 className="section-header">Linked Accounts</h2>

          <div className="space-y-3 mb-6">
            {/* Rhyzo profile link — always first */}
            <div className="flex items-center gap-3 group">
              <img src="/favicon.ico" alt="" className="w-4 h-4 shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              <span className="text-fg-light text-sm w-20 shrink-0">Rhyzo</span>
              <CopyLink
                url={`https://rhyzo.com/@${user.slug}`}
                label={`rhyzo.com/@${user.slug}`}
                className="text-sm flex-1 truncate text-fg-muted hover:text-accent transition-colors"
              />
            </div>

            {/* Linked accounts */}
            {accounts.map((account) => {
              const favicon = platformFaviconUrl(account.platform, account.profileUrl);
              const isPrimary = account.id === primaryAccountId;
              const url = account.profileUrl || generateProfileUrl(account.platform, account.handle);
              return (
                <div key={account.id} className="flex items-center gap-3 group">
                  {favicon ? (
                    <img src={favicon} alt="" className="w-4 h-4 shrink-0" />
                  ) : (
                    <div className="w-4 h-4 shrink-0 rounded-sm bg-fg/10" />
                  )}
                  <span className="text-fg-light text-sm w-20 shrink-0">
                    {platformLabel(account.platform, account.handle)}
                  </span>
                  <span className="text-sm flex-1 truncate">
                    {url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer me"
                        className="hover:text-accent transition-colors inline-flex items-center gap-1"
                      >
                        {account.handle}
                        <span className="text-fg-light text-xs opacity-0 group-hover:opacity-100 transition-opacity">&#x2197;</span>
                      </a>
                    ) : (
                      account.handle
                    )}
                  </span>
                  <span className="text-xs text-fg-light">
                    {account.verificationStatus === 'verified' ? (
                      <span className="text-verified">&#x2713; verified</span>
                    ) : (
                      <span>unverified</span>
                    )}
                  </span>
                  {!isPrimary && (
                    <button
                      onClick={() => handleDeleteAccount(account.id)}
                      className="text-xs text-fg-light hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      remove
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add account form */}
          <form onSubmit={handleAddAccount} className="border border-fg/10 rounded-lg p-4">
            <h3 className="text-xs font-medium text-fg-muted mb-3">Add Account</h3>

            {/* Profile URL — primary input */}
            <div className="relative mb-3">
              {detectedFavicon && (
                <img
                  src={detectedFavicon}
                  alt=""
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                />
              )}
              <input
                type="text"
                value={newProfileUrl}
                onChange={(e) => handleProfileUrlChange(e.target.value)}
                placeholder="Paste a profile URL..."
                className={`input w-full ${detectedFavicon ? 'pl-9' : ''}`}
              />
            </div>

            {/* Detected info or manual fields */}
            {urlDetected && newPlatform ? (
              <div className="flex items-center gap-2 mb-3 px-1">
                <span className="text-xs text-fg-muted">Detected:</span>
                <span className="text-xs font-medium">{PLATFORM_LABELS[newPlatform] || newPlatform}</span>
                <span className="text-xs text-fg-light">&middot;</span>
                <span className="text-xs">{newHandle}</span>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-px flex-1 bg-fg/10" />
                  <span className="text-xs text-fg-light">or add manually</span>
                  <div className="h-px flex-1 bg-fg/10" />
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <select
                    value={newPlatform}
                    onChange={(e) => setNewPlatform(e.target.value)}
                    className="input"
                  >
                    <option value="">Platform...</option>
                    <option value="github">GitHub</option>
                    <option value="twitter">Twitter/X</option>
                    <option value="linkedin">LinkedIn</option>
                    <option value="threads">Threads</option>
                    <option value="mastodon">Mastodon</option>
                    <option value="figma">Figma</option>
                    <option value="domain">Website</option>
                    <option value="other">Other</option>
                  </select>
                  <input
                    type="text"
                    value={newHandle}
                    onChange={(e) => setNewHandle(e.target.value)}
                    placeholder="Handle or username"
                    className="input"
                  />
                </div>
              </>
            )}

            <button
              type="submit"
              className="btn-secondary text-xs"
              disabled={addingAccount || !canSubmit}
            >
              {addingAccount ? 'Adding...' : 'Add account'}
            </button>
          </form>
        </section>

        {/* Identity details */}
        {(user.did || user.pdsHost) && (
          <section className="mb-12">
            <h2 className="section-header">Identity</h2>
            <div className="space-y-2 text-sm">
              <div className="flex gap-4">
                <span className="text-fg-light w-16 shrink-0">Handle</span>
                <span>{user.primaryHandle}</span>
              </div>
              {user.did && (
                <div className="flex gap-4">
                  <span className="text-fg-light w-16 shrink-0">DID</span>
                  <code className="text-xs bg-fg/5 px-1.5 py-0.5 rounded break-all">{user.did}</code>
                </div>
              )}
              {user.pdsHost && (
                <div className="flex gap-4">
                  <span className="text-fg-light w-16 shrink-0">PDS</span>
                  <span className="text-fg-muted">{user.pdsHost}</span>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
