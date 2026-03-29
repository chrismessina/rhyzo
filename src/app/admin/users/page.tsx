'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

interface UserEntry {
  id: string;
  primaryHandle: string;
  displayName: string | null;
  avatarUrl: string | null;
  slug: string;
  did: string | null;
  role: string;
  oauthVerified: boolean;
  bannedAt: string | null;
  banReason: string | null;
  createdAt: string;
}

function AdminUsersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [users, setUsers] = useState<UserEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Expanded user detail
  const [expandedDid, setExpandedDid] = useState<string | null>(null);
  const [banReason, setBanReason] = useState('');

  const fetchUsers = useCallback(async (p: number, q: string) => {
    const res = await fetch(`/api/v1/admin/users?page=${p}&search=${encodeURIComponent(q)}`);
    if (res.status === 401) { router.push('/login'); return; }
    if (res.status === 403) { setError('Forbidden'); return; }
    const data = await res.json();
    setUsers(data.users);
    setTotal(data.total);
    setPage(data.page);
    setTotalPages(data.totalPages);
  }, [router]);

  useEffect(() => {
    fetchUsers(1, search);
  }, [fetchUsers, search]);

  async function handleAction(did: string, action: string, body?: object) {
    setActionLoading(`${did}-${action}`);
    const method = action === 'delete' ? 'DELETE' : 'POST';
    const url = action === 'delete'
      ? `/api/v1/admin/users/${did}`
      : `/api/v1/admin/users/${did}/${action}`;

    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    setActionLoading(null);
    setExpandedDid(null);
    setBanReason('');
    fetchUsers(page, search);
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
          <h1 className="text-lg font-bold">Users ({total})</h1>
          <div className="flex items-center gap-4 text-sm">
            <a href="/admin" className="text-fg-muted hover:text-accent transition-colors">Overview</a>
            <a href="/admin/admins" className="text-fg-muted hover:text-accent transition-colors">Admins</a>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by handle, DID, slug, or name..."
            className="input"
          />
        </div>

        {/* User list */}
        <div className="space-y-2">
          {users.map(user => (
            <div key={user.id} className="border border-fg/10 rounded-lg">
              <button
                onClick={() => setExpandedDid(expandedDid === user.did ? null : user.did)}
                className="w-full flex items-center gap-3 p-3 text-left hover:bg-fg/[0.02] transition-colors rounded-lg"
              >
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-fg/10 flex items-center justify-center text-fg-muted text-xs font-medium shrink-0">
                    {(user.displayName || user.primaryHandle).charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{user.displayName || user.primaryHandle}</span>
                    {user.role === 'admin' && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-accent/10 text-accent rounded font-medium">admin</span>
                    )}
                    {user.bannedAt && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-red-500/10 text-red-500 rounded font-medium">banned</span>
                    )}
                    {user.oauthVerified && (
                      <span className="text-verified text-xs">&#x2713;</span>
                    )}
                  </div>
                  <p className="text-xs text-fg-light truncate">{user.primaryHandle}</p>
                </div>
                <span className="text-xs text-fg-light">
                  {new Date(user.createdAt).toLocaleDateString()}
                </span>
              </button>

              {expandedDid === user.did && user.did && (
                <div className="border-t border-fg/10 p-4 space-y-3">
                  <div className="text-xs space-y-1 text-fg-muted">
                    <p><span className="text-fg-light">DID:</span> <code className="bg-fg/5 px-1 rounded break-all">{user.did}</code></p>
                    <p><span className="text-fg-light">Slug:</span> {user.slug}</p>
                    <p><span className="text-fg-light">Role:</span> {user.role}</p>
                    {user.bannedAt && <p><span className="text-fg-light">Ban reason:</span> {user.banReason || 'None specified'}</p>}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <a
                      href={`/@${user.slug}`}
                      target="_blank"
                      className="text-xs text-accent hover:underline"
                    >
                      View profile &#x2197;
                    </a>

                    <button
                      onClick={() => handleAction(user.did!, 'reset')}
                      disabled={actionLoading === `${user.did}-reset`}
                      className="text-xs px-2 py-1 border border-fg/20 rounded hover:border-fg/40 transition-colors"
                    >
                      {actionLoading === `${user.did}-reset` ? 'Resetting...' : 'Reset'}
                    </button>

                    {user.bannedAt ? (
                      <button
                        onClick={() => handleAction(user.did!, 'unban')}
                        disabled={actionLoading === `${user.did}-unban`}
                        className="text-xs px-2 py-1 border border-verified/30 text-verified rounded hover:border-verified/60 transition-colors"
                      >
                        {actionLoading === `${user.did}-unban` ? 'Unbanning...' : 'Unban'}
                      </button>
                    ) : (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={banReason}
                          onChange={e => setBanReason(e.target.value)}
                          placeholder="Ban reason"
                          className="text-xs px-2 py-1 border border-fg/20 rounded w-32"
                        />
                        <button
                          onClick={() => handleAction(user.did!, 'ban', { reason: banReason })}
                          disabled={actionLoading === `${user.did}-ban`}
                          className="text-xs px-2 py-1 border border-red-500/30 text-red-500 rounded hover:border-red-500/60 transition-colors"
                        >
                          {actionLoading === `${user.did}-ban` ? 'Banning...' : 'Ban'}
                        </button>
                      </div>
                    )}

                    <button
                      onClick={() => {
                        if (confirm(`Delete ${user.primaryHandle}? This cannot be undone.`)) {
                          handleAction(user.did!, 'delete');
                        }
                      }}
                      disabled={actionLoading === `${user.did}-delete`}
                      className="text-xs px-2 py-1 border border-red-500/30 text-red-500 rounded hover:border-red-500/60 transition-colors"
                    >
                      {actionLoading === `${user.did}-delete` ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 mt-8">
            <button
              onClick={() => fetchUsers(page - 1, search)}
              disabled={page <= 1}
              className="text-sm text-fg-muted hover:text-accent disabled:opacity-30 transition-colors"
            >
              &#x2190; Previous
            </button>
            <span className="text-xs text-fg-light">Page {page} of {totalPages}</span>
            <button
              onClick={() => fetchUsers(page + 1, search)}
              disabled={page >= totalPages}
              className="text-sm text-fg-muted hover:text-accent disabled:opacity-30 transition-colors"
            >
              Next &#x2192;
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminUsersPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-fg-muted text-sm">Loading...</p>
      </div>
    }>
      <AdminUsersContent />
    </Suspense>
  );
}
