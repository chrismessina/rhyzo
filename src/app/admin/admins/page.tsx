'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface AdminEntry {
  id: string;
  primaryHandle: string;
  displayName: string | null;
  avatarUrl: string | null;
  did: string | null;
  slug: string;
  createdAt: string;
}

export default function AdminAdminsPage() {
  const router = useRouter();
  const [admins, setAdmins] = useState<AdminEntry[]>([]);
  const [error, setError] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [currentDid, setCurrentDid] = useState<string | null>(null);

  useEffect(() => {
    // Get current user's DID from session
    fetch('/api/auth/session').then(r => r.json()).then(s => {
      if (s.userId) {
        // We'll use the userId to prevent self-removal in UI
        // but the API handles it server-side
      }
    }).catch(() => {});
    fetchAdmins();
  }, []);

  async function fetchAdmins() {
    const res = await fetch('/api/v1/admin/admins');
    if (res.status === 401) { router.push('/login'); return; }
    if (res.status === 403) { setError('Forbidden'); return; }
    const data = await res.json();
    setAdmins(data.admins);

    // Get current user DID
    const sessionRes = await fetch('/api/auth/session');
    if (sessionRes.ok) {
      const session = await sessionRes.json();
      const userRes = await fetch(`/api/v1/users/${session.slug}`);
      if (userRes.ok) {
        const userData = await userRes.json();
        setCurrentDid(userData.user.did);
      }
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!identifier.trim()) return;
    setAdding(true);
    setAddError('');

    const res = await fetch('/api/v1/admin/admins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: identifier.trim() }),
    });

    if (!res.ok) {
      const data = await res.json();
      setAddError(data.error || 'Failed to add admin');
    } else {
      setIdentifier('');
      fetchAdmins();
    }
    setAdding(false);
  }

  async function handleRemove(did: string) {
    if (!confirm('Remove this admin?')) return;
    const res = await fetch(`/api/v1/admin/admins/${did}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || 'Failed to remove admin');
    } else {
      fetchAdmins();
    }
  }

  if (error) {
    return (
      <div className="flex justify-center min-h-screen px-4 py-16">
        <div className="max-w-profile w-full">
          <p className="text-red-500 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-center min-h-screen px-4 py-16">
      <div className="max-w-profile w-full">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-lg font-bold">Admin Management</h1>
          <div className="flex items-center gap-4 text-sm">
            <a href="/admin" className="text-fg-muted hover:text-accent transition-colors">Overview</a>
            <a href="/admin/users" className="text-fg-muted hover:text-accent transition-colors">Users</a>
          </div>
        </div>

        {/* Add admin form */}
        <form onSubmit={handleAdd} className="border border-fg/10 rounded-lg p-4 mb-8">
          <h3 className="text-xs font-medium text-fg-muted mb-3">Add Admin</h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={identifier}
              onChange={e => setIdentifier(e.target.value)}
              placeholder="Handle or DID..."
              className="input flex-1"
            />
            <button
              type="submit"
              disabled={adding || !identifier.trim()}
              className="btn-primary text-xs whitespace-nowrap"
            >
              {adding ? 'Adding...' : 'Add Admin'}
            </button>
          </div>
          {addError && <p className="text-red-500 text-xs mt-2">{addError}</p>}
        </form>

        {/* Admin list */}
        <section>
          <h2 className="section-header">Current Admins ({admins.length})</h2>
          <div className="space-y-3">
            {admins.map(admin => (
              <div key={admin.id} className="flex items-center gap-3 group">
                {admin.avatarUrl ? (
                  <img src={admin.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-fg/10 flex items-center justify-center text-fg-muted text-xs font-medium">
                    {(admin.displayName || admin.primaryHandle).charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{admin.displayName || admin.primaryHandle}</p>
                  <p className="text-xs text-fg-light truncate">{admin.primaryHandle}</p>
                </div>
                {admin.did !== currentDid && admin.did && (
                  <button
                    onClick={() => handleRemove(admin.did!)}
                    className="text-xs text-fg-light hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    remove
                  </button>
                )}
                {admin.did === currentDid && (
                  <span className="text-xs text-fg-light">you</span>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
