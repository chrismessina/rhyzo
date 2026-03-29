'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function HomeContent() {
  const [handle, setHandle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [signedIn, setSignedIn] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/auth/session')
      .then(r => { if (r.ok) return r.json(); return null; })
      .then(data => { if (data?.userId) setSignedIn(true); })
      .catch(() => {});
  }, []);

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    if (!handle.trim()) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/v1/lookup?handle=${encodeURIComponent(handle.trim())}`);
      const data = await res.json();

      if (data.slug) {
        if (data.claimed) {
          router.push(`/@${data.slug}`);
        } else {
          const params = new URLSearchParams({
            handle: data.handle,
            did: data.resolved?.did || '',
            pds: data.resolved?.pdsHost || '',
            name: data.displayName || data.handle,
            avatar: data.resolved?.avatarUrl || '',
            bio: data.resolved?.description || '',
          });
          router.push(`/@${data.slug}?${params.toString()}`);
        }
      } else if (data.error) {
        setError(data.error);
      }
    } catch {
      setError('Failed to look up handle. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4">
      <div className="max-w-profile w-full">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-2xl font-bold mb-2">🍓 Rhyzo</h1>
          <p className="text-fg-muted text-sm leading-relaxed">
            A modern <code className="text-xs bg-fg/5 px-1.5 py-0.5 rounded">finger</code> command
            for the decentralized web. Look up a handle on any service to find all verified linked accounts.
          </p>
        </div>

        {/* Lookup form */}
        <form onSubmit={handleLookup} className="mb-8">
          <label className="section-header block mb-3">Look up an identity</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="@chrismessina.me or @user@mastodon.social"
              className="input flex-1"
              disabled={loading}
            />
            <button type="submit" className="btn-primary whitespace-nowrap" disabled={loading}>
              {loading ? 'Looking up...' : 'Look up'}
            </button>
          </div>
          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        </form>

        {/* Sign in — hidden when already authenticated */}
        {!signedIn && (
          <div className="border-t border-fg/10 pt-8">
            <label className="section-header block mb-3">Claim your profile</label>
            <p className="text-fg-muted text-sm mb-4">
              Sign in with your AT Protocol handle to claim and manage your Rhyzo profile.
              OAuth verification ensures you truly own the handle.
            </p>
            <a
              href="/login"
              className="inline-flex items-center gap-2.5 px-4 py-3 rounded-xl bg-fg text-bg text-sm font-semibold hover:bg-fg/90 transition-colors duration-150"
            >
              <svg viewBox="0 0 64 57" className="h-4 w-auto fill-current shrink-0" aria-hidden="true">
                <path d="M13.873 3.805C21.21 9.332 29.103 20.537 32 26.55v15.882c0-.338-.13.044-.41.867-1.512 4.456-7.418 21.847-20.923 7.944-7.111-7.32-3.819-14.64 9.125-16.85-7.405 1.264-15.73-.825-18.014-9.015C1.12 23.022 0 8.51 0 6.55 0-3.268 8.579-.182 13.873 3.805ZM50.127 3.805C42.79 9.332 34.897 20.537 32 26.55v15.882c0-.338.13.044.41.867 1.512 4.456 7.418 21.847 20.923 7.944 7.111-7.32 3.819-14.64-9.125-16.85 7.405 1.264 15.73-.825 18.014-9.015C62.88 23.022 64 8.51 64 6.55c0-9.818-8.578-6.732-13.873-2.745Z" />
              </svg>
              Continue with Bluesky
            </a>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-fg/10 text-fg-light text-xs">
          <p>
            Rhyzo uses WebFinger, AT Protocol OAuth, rel-me, and did:web
            to resolve and verify decentralized identities.
          </p>
        </footer>
      </div>
    </div>
  );
}
