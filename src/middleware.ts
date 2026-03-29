import { NextRequest, NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // Handle /:slug.json or /@slug.json → rewrite to /api/v1/users/:slug (with JSON response)
  if (path.endsWith('.json') && !path.startsWith('/api')) {
    let slug = path.slice(1, -5); // Remove leading / and trailing .json
    // Strip leading @ or %40
    try { slug = decodeURIComponent(slug); } catch { /* use raw */ }
    if (slug.startsWith('@')) slug = slug.slice(1);
    if (slug && !slug.includes('/')) {
      const url = req.nextUrl.clone();
      url.pathname = `/api/v1/users/${slug}`;
      url.searchParams.set('format', 'json');
      return NextResponse.rewrite(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match paths that could be /:slug.json
    '/((?!_next|api|favicon\\.ico).*\\.json)',
  ],
};
