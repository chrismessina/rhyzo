'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardRedirect() {
  const router = useRouter();

  useEffect(() => {
    fetch('/api/auth/session')
      .then(r => { if (r.ok) return r.json(); return null; })
      .then(data => {
        if (data?.slug) {
          router.replace(`/${data.slug}/edit`);
        } else {
          router.replace('/login');
        }
      })
      .catch(() => router.replace('/login'));
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-fg-muted text-sm">Redirecting...</p>
    </div>
  );
}
