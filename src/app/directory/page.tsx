'use client';

import { useEffect, useState, useCallback } from 'react';

interface DirectoryUser {
  slug: string;
  primaryHandle: string;
  displayName: string | null;
  avatarUrl: string | null;
  oauthVerified: boolean;
  accountCount: number;
  createdAt: string;
}

export default function DirectoryPage() {
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('newest');

  const fetchDirectory = useCallback(async (p: number, q: string, s: string) => {
    const res = await fetch(
      `/api/v1/directory?page=${p}&search=${encodeURIComponent(q)}&sort=${s}`
    );
    const data = await res.json();
    setUsers(data.users);
    setTotal(data.total);
    setPage(data.page);
    setTotalPages(data.totalPages);
  }, []);

  useEffect(() => {
    fetchDirectory(1, search, sort);
  }, [fetchDirectory, search, sort]);

  return (
    <div className="flex justify-center min-h-screen px-4 py-16">
      <div className="max-w-profile w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-lg font-bold">Directory</h1>
            <p className="text-sm text-fg-muted">{total} {total === 1 ? 'identity' : 'identities'}</p>
          </div>
          <a href="/" className="text-sm text-fg-muted hover:text-accent transition-colors">Home</a>
        </div>

        {/* Search + Sort */}
        <div className="flex gap-3 mb-8">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by handle or name..."
            className="input flex-1"
          />
          <select
            value={sort}
            onChange={e => setSort(e.target.value)}
            className="input w-auto"
          >
            <option value="newest">Newest</option>
            <option value="alpha">A–Z</option>
          </select>
        </div>

        {/* User list */}
        {users.length === 0 ? (
          <p className="text-sm text-fg-muted">No identities found.</p>
        ) : (
          <div className="space-y-1">
            {users.map(user => (
              <a
                key={user.slug}
                href={`/@${user.slug}`}
                className="flex items-center gap-3 p-3 -mx-3 rounded-lg hover:bg-fg/[0.02] transition-colors group"
              >
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-fg/10 flex items-center justify-center text-fg-muted text-sm font-medium shrink-0">
                    {(user.displayName || user.primaryHandle).charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate group-hover:text-accent transition-colors">
                      {user.displayName || user.primaryHandle}
                    </span>
                    {user.oauthVerified && (
                      <span className="text-verified text-xs">&#x2713;</span>
                    )}
                  </div>
                  <p className="text-xs text-fg-light truncate">{user.primaryHandle}</p>
                </div>
                <span className="text-xs text-fg-light whitespace-nowrap">
                  {user.accountCount} {user.accountCount === 1 ? 'account' : 'accounts'}
                </span>
              </a>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 mt-8">
            <button
              onClick={() => fetchDirectory(page - 1, search, sort)}
              disabled={page <= 1}
              className="text-sm text-fg-muted hover:text-accent disabled:opacity-30 transition-colors"
            >
              &#x2190; Previous
            </button>
            <span className="text-xs text-fg-light">Page {page} of {totalPages}</span>
            <button
              onClick={() => fetchDirectory(page + 1, search, sort)}
              disabled={page >= totalPages}
              className="text-sm text-fg-muted hover:text-accent disabled:opacity-30 transition-colors"
            >
              Next &#x2192;
            </button>
          </div>
        )}

        {/* Footer */}
        <footer className="border-t border-fg/10 pt-8 mt-16">
          <p className="text-xs text-fg-light">
            Verified with{' '}
            <a href="/" className="hover:text-accent transition-colors">Rhyzo</a>
            {' '}&mdash; decentralized identity resolution for the open web.
          </p>
        </footer>
      </div>
    </div>
  );
}
