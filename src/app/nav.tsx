'use client';

import { useEffect, useRef, useState } from 'react';

interface SessionData {
  userId: string;
  handle: string;
  slug: string;
}

interface UserData {
  role?: string;
  avatarUrl?: string | null;
  displayName?: string | null;
  primaryHandle?: string;
}

export default function Nav() {
  const [session, setSession] = useState<SessionData | null>(null);
  const [user, setUser] = useState<UserData | null>(null);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/auth/session')
      .then(r => { if (r.ok) return r.json(); return null; })
      .then(data => {
        if (data?.userId) {
          setSession(data);
          fetch(`/api/v1/users/${data.slug}`)
            .then(r => r.json())
            .then((d: { user?: UserData }) => {
              if (d.user) setUser(d.user);
            })
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const isAdmin = user?.role === 'admin';
  const handle = session?.handle || user?.primaryHandle || '';
  const initial = (user?.displayName || handle).charAt(0).toUpperCase();

  return (
    <nav className="flex items-center justify-between px-4 py-3 border-b border-fg/10">
      <a href="/" className="text-sm font-bold hover:text-accent transition-colors">
        🍓 Rhyzo
      </a>

      <div className="flex items-center gap-4 text-sm">
        <a href="/directory" className="text-fg-muted hover:text-accent transition-colors">
          Directory
        </a>

        {session ? (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setOpen(v => !v)}
              className="flex items-center"
              aria-label="Account menu"
              aria-expanded={open}
            >
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.displayName || handle}
                  className="w-8 h-8 rounded-full object-cover ring-2 ring-transparent hover:ring-accent/40 transition-all"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-fg/15 flex items-center justify-center text-xs font-semibold hover:bg-fg/20 transition-colors">
                  {initial}
                </div>
              )}
            </button>

            {open && (
              <div className="absolute right-0 mt-2 w-52 rounded-xl border border-fg/10 bg-bg shadow-lg py-1 z-50">
                {/* Identity header */}
                <div className="px-3 py-2 border-b border-fg/10">
                  <p className="text-xs font-semibold truncate">{user?.displayName || handle}</p>
                  <p className="text-xs text-fg-muted truncate">@{handle}</p>
                </div>

                {/* Profile links */}
                <a
                  href={`/${session.slug}`}
                  className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-fg/5 transition-colors"
                  onClick={() => setOpen(false)}
                >
                  View Profile
                </a>
                <a
                  href={`/${session.slug}/edit`}
                  className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-fg/5 transition-colors"
                  onClick={() => setOpen(false)}
                >
                  Edit Profile
                </a>

                {/* Admin section */}
                {isAdmin && (
                  <>
                    <div className="mx-3 my-1 border-t border-fg/10" />
                    <p className="px-3 pt-1 pb-0.5 text-xs font-semibold text-fg-muted uppercase tracking-wide">Admin</p>
                    <a
                      href="/admin"
                      className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-fg/5 transition-colors"
                      onClick={() => setOpen(false)}
                    >
                      Dashboard
                    </a>
                    <a
                      href="/admin/users"
                      className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-fg/5 transition-colors"
                      onClick={() => setOpen(false)}
                    >
                      Users
                    </a>
                  </>
                )}

                {/* Sign out */}
                <div className="mx-3 my-1 border-t border-fg/10" />
                <a
                  href="/api/v1/auth/signout"
                  className="flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-500/5 transition-colors"
                >
                  Sign out
                </a>
              </div>
            )}
          </div>
        ) : (
          <a href="/login" className="text-fg-muted hover:text-accent transition-colors">
            Sign in
          </a>
        )}
      </div>
    </nav>
  );
}
