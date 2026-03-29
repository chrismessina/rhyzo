'use client';

import { useState } from 'react';

export default function ClaimButton({ handle }: { handle: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleClaim() {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/v1/auth/atproto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle }),
      });

      const data = await res.json();

      if (res.ok && data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        setError(data.error || 'Failed to start verification');
      }
    } catch {
      setError('Connection failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleClaim}
        className="btn-primary"
        disabled={loading}
      >
        {loading ? 'Connecting to PDS...' : 'Claim this account'}
      </button>
      {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
    </div>
  );
}
