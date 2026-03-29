'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function LoginForm() {
  const [handle, setHandle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const searchParams = useSearchParams();

  useEffect(() => {
    const errParam = searchParams.get('error');
    if (errParam) setError(errParam);
    const handleParam = searchParams.get('handle');
    if (handleParam) setHandle(handleParam);
  }, [searchParams]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!handle.trim()) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/v1/auth/atproto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle: handle.trim() }),
      });

      const data = await res.json();

      if (res.ok && data.authUrl) {
        // Redirect to the user's PDS authorization server
        window.location.href = data.authUrl;
      } else {
        setError(data.error || 'Failed to start sign in');
      }
    } catch {
      setError('Connection failed. Is your handle correct?');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4">
      <div className="max-w-profile w-full">
        <a href="/" className="text-fg-light text-sm hover:text-fg transition-colors mb-8 inline-block">
          &larr; Back
        </a>

        <h1 className="text-2xl font-bold mb-2">Sign in</h1>
        <p className="text-fg-muted text-sm mb-8">
          Sign in with your AT Protocol handle. You&apos;ll be redirected to your PDS to authorize Rhyzo.
          Works with any PDS — Bluesky, selfhosted.social, Periwinkle, or your own.
        </p>

        <form onSubmit={handleLogin}>
          <label className="section-header block mb-3">AT Protocol Handle</label>
          <input
            type="text"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="chrismessina.me or user.bsky.social"
            className="input mb-4"
            disabled={loading}
            autoFocus
          />

          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl bg-fg text-bg text-sm font-semibold hover:bg-fg/90 transition-colors duration-150 disabled:opacity-60"
            disabled={loading}
          >
            {!loading && (
              <svg viewBox="0 0 64 57" className="h-4 w-auto fill-current shrink-0" aria-hidden="true">
                <path d="M13.873 3.805C21.21 9.332 29.103 20.537 32 26.55v15.882c0-.338-.13.044-.41.867-1.512 4.456-7.418 21.847-20.923 7.944-7.111-7.32-3.819-14.64 9.125-16.85-7.405 1.264-15.73-.825-18.014-9.015C1.12 23.022 0 8.51 0 6.55 0-3.268 8.579-.182 13.873 3.805ZM50.127 3.805C42.79 9.332 34.897 20.537 32 26.55v15.882c0-.338.13.044.41.867 1.512 4.456 7.418 21.847 20.923 7.944 7.111-7.32 3.819-14.64-9.125-16.85 7.405 1.264 15.73-.825 18.014-9.015C62.88 23.022 64 8.51 64 6.55c0-9.818-8.578-6.732-13.873-2.745Z" />
              </svg>
            )}
            {loading ? 'Connecting…' : 'Continue with Bluesky'}
          </button>
        </form>

        <div className="mt-8 p-4 rounded-lg bg-fg/[0.03] border border-fg/10">
          <p className="text-xs text-fg-light leading-relaxed">
            <strong className="text-fg-muted">How it works:</strong> We resolve your handle to find your PDS,
            then redirect you there to authorize Rhyzo via OAuth. Your PDS verifies your identity — we never
            see your password. After authorization, we can write your Rhyzo profile data to your PDS for
            data sovereignty.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-fg-muted text-sm">Loading...</p>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
