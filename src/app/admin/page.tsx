'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Stats {
  totalUsers: number;
  verifiedUsers: number;
  bannedUsers: number;
  adminUsers: number;
  recentSignups: Array<{
    id: string;
    handle: string;
    slug: string;
    displayName: string | null;
    avatarUrl: string | null;
    createdAt: string;
  }>;
}

export default function AdminPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/v1/admin/stats')
      .then(res => {
        if (res.status === 401) { router.push('/login'); return null; }
        if (res.status === 403) { setError('You do not have admin access.'); return null; }
        return res.json();
      })
      .then(data => { if (data) setStats(data); })
      .catch(() => setError('Failed to load stats'));
  }, [router]);

  if (error) {
    return (
      <div className="flex justify-center min-h-screen px-4 py-16">
        <div className="max-w-profile w-full">
          <p className="text-red-500 text-sm">{error}</p>
          <a href="/" className="text-sm text-accent hover:underline mt-4 inline-block">Back to home</a>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-fg-muted text-sm">Loading...</p>
      </div>
    );
  }

  const verifiedPct = stats.totalUsers > 0 ? Math.round((stats.verifiedUsers / stats.totalUsers) * 100) : 0;

  return (
    <div className="flex justify-center min-h-screen px-4 py-16">
      <div className="max-w-profile w-full">
        <div className="flex items-center justify-between mb-12">
          <h1 className="text-lg font-bold">Admin Dashboard</h1>
          <div className="flex items-center gap-4 text-sm">
            <a href="/admin/users" className="text-fg-muted hover:text-accent transition-colors">Users</a>
            <a href="/admin/admins" className="text-fg-muted hover:text-accent transition-colors">Admins</a>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 gap-4 mb-12">
          <StatCard label="Total Users" value={stats.totalUsers} />
          <StatCard label="OAuth Verified" value={`${stats.verifiedUsers} (${verifiedPct}%)`} />
          <StatCard label="Banned" value={stats.bannedUsers} />
          <StatCard label="Admins" value={stats.adminUsers} />
        </div>

        {/* Recent signups */}
        <section>
          <h2 className="section-header">Recent Signups (7 days)</h2>
          {stats.recentSignups.length === 0 ? (
            <p className="text-sm text-fg-muted">No recent signups.</p>
          ) : (
            <div className="space-y-3">
              {stats.recentSignups.map(user => (
                <a
                  key={user.id}
                  href={`/admin/users?search=${encodeURIComponent(user.handle)}`}
                  className="flex items-center gap-3 group"
                >
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-fg/10 flex items-center justify-center text-fg-muted text-xs font-medium">
                      {(user.displayName || user.handle).charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate group-hover:text-accent transition-colors">
                      {user.displayName || user.handle}
                    </p>
                    <p className="text-xs text-fg-light">{user.handle}</p>
                  </div>
                  <span className="text-xs text-fg-light">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </span>
                </a>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-fg/10 rounded-lg p-4">
      <p className="text-xs text-fg-light mb-1">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}
