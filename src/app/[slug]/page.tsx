import { db, schema } from '@/db';
import { eq } from 'drizzle-orm';
import type { Metadata } from 'next';
import { resolveIdentity, handleToSlug } from '@/lib/atproto';
import ClaimButton from './claim-button';
import CopyLink from '@/app/copy-link';

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

// Types for the resolved identity passed via query params (unclaimed profiles)
interface ResolvedData {
  handle: string;
  did: string;
  pds: string;
  name: string;
  avatar: string;
  bio: string;
}

/** Strip leading @ (or %40) from the URL slug to get the DB slug / handle.
 * Next.js App Router percent-encodes @ to %40 in dynamic params because
 * @ is reserved for parallel route slots. */
function normalizeSlug(slug: string): string {
  let s = slug;
  try { s = decodeURIComponent(slug); } catch { /* use raw value */ }
  return s.startsWith('@') ? s.slice(1) : s;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const rawSlug = (await params).slug;
  const slug = normalizeSlug(rawSlug);
  const sp = await searchParams;

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

  // DID-first: try to resolve and find by DID, fallback to slug
  const found = await findUserByDid(slug);
  if (found) {
    const user = found.user;
    const profileUrl = `${baseUrl}/@${user.slug}`;
    const displayName = user.displayName || user.primaryHandle;
    // Split displayName into first/last for OG profile
    const nameParts = (displayName || '').split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    return {
      title: `${displayName} — Rhyzo`,
      description: user.tagline || user.bio || `${user.primaryHandle} on Rhyzo`,
      alternates: {
        types: {
          'application/jrd+json': `${baseUrl}/@${user.slug}.json`,
        },
      },
      openGraph: {
        title: displayName,
        description: user.tagline || user.bio || `${user.primaryHandle} on Rhyzo`,
        url: profileUrl,
        siteName: 'Rhyzo',
        type: 'profile',
        firstName,
        ...(lastName ? { lastName } : {}),
        username: user.slug,
        ...(user.avatarUrl ? { images: [{ url: user.avatarUrl, width: 256, height: 256, alt: displayName }] } : {}),
      },
    };
  }

  const name = sp.name || sp.handle || slug;
  return {
    title: `${name} — Rhyzo`,
    description: `${name} — unclaimed identity on Rhyzo`,
  };
}

/**
 * Find or resolve a user. DID is the authoritative identifier.
 * Flow: slug (handle) → resolve DID → look up user by DID
 */
async function findUserByDid(slug: string): Promise<{ user: typeof schema.users.$inferSelect } | null> {
  // Try resolving the slug as an AT Proto handle to get the DID
  try {
    const identity = await resolveIdentity(slug);

    // Look up by DID (the stable identifier)
    let user = db.select().from(schema.users).where(eq(schema.users.did, identity.did)).get();

    if (user) {
      // Handle migration: if handle changed, update slug + handle
      if (user.primaryHandle !== identity.handle) {
        const newSlug = handleToSlug(identity.handle);
        const slugOwner = db.select().from(schema.users).where(eq(schema.users.slug, newSlug)).get();
        if (!slugOwner || slugOwner.id === user.id) {
          db.update(schema.users)
            .set({
              primaryHandle: identity.handle,
              slug: newSlug,
              displayName: identity.displayName || user.displayName,
              avatarUrl: identity.avatarUrl || user.avatarUrl,
              pdsHost: identity.pdsHost,
              updatedAt: new Date(),
            })
            .where(eq(schema.users.id, user.id))
            .run();
          user = db.select().from(schema.users).where(eq(schema.users.id, user.id)).get()!;
        }
      }
      return { user };
    }
  } catch {
    // Handle resolution failed — fall through to DB slug lookup
  }

  // Fallback: direct DB lookup by slug (for handles we can't resolve live)
  const user = db.select().from(schema.users).where(eq(schema.users.slug, slug)).get();
  if (user) return { user };

  return null;
}

export default async function ProfilePage({ params, searchParams }: Props) {
  const rawSlug = (await params).slug;
  const slug = normalizeSlug(rawSlug);
  const sp = await searchParams;

  // DID-first: resolve handle → DID → find user
  const found = await findUserByDid(slug);
  if (found) {
    return <ClaimedProfile user={found.user} />;
  }

  // Check if we have resolved data from query params (stub profile)
  if (sp.did) {
    return <StubProfile data={{
      handle: sp.handle || slug,
      did: sp.did,
      pds: sp.pds || '',
      name: sp.name || sp.handle || slug,
      avatar: sp.avatar || '',
      bio: sp.bio || '',
    }} />;
  }

  // Try resolving as a handle for a stub profile
  try {
    const identity = await resolveIdentity(slug);
    return <StubProfile data={{
      handle: identity.handle,
      did: identity.did,
      pds: identity.pdsHost,
      name: identity.displayName || identity.handle,
      avatar: identity.avatarUrl || '',
      bio: identity.description || '',
    }} />;
  } catch {
    // Not found at all
  }

  return <NotFoundProfile slug={slug} />;
}

function ClaimedProfile({ user }: { user: typeof schema.users.$inferSelect }) {
  const userAccounts = db
    .select()
    .from(schema.accounts)
    .where(eq(schema.accounts.userId, user.id))
    .all();

  const verified = userAccounts.filter((a) => a.verificationStatus === 'verified');
  const unverified = userAccounts.filter((a) => a.verificationStatus !== 'verified');

  return (
    <div className="flex justify-center min-h-screen px-4 py-16">
      <div className="max-w-profile w-full">
        {/* Profile Header */}
        <header className="mb-12">
          <div className="flex items-start gap-4 mb-4">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.displayName || user.primaryHandle}
                className="w-16 h-16 rounded-full object-cover"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-fg/10 flex items-center justify-center text-fg-muted text-xl font-medium">
                {(user.displayName || user.primaryHandle).charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold">{user.displayName || user.primaryHandle}</h1>
              {user.tagline && (
                <p className="text-fg-muted text-sm mt-0.5">{user.tagline}</p>
              )}
              {user.domain && (
                <a
                  href={`https://${user.domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-fg-muted hover:text-accent transition-colors mt-1 inline-flex items-center gap-1"
                >
                  {user.domain}
                  <span className="text-xs">&#x2197;</span>
                </a>
              )}
            </div>
          </div>
          {user.oauthVerified && (
            <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-verified/10 text-verified text-xs font-medium mb-4">
              <span>&#x2713;</span> OAuth Verified
            </div>
          )}
          {user.bio && (
            <p className="text-sm text-fg-muted leading-relaxed whitespace-pre-line">{user.bio}</p>
          )}
          <CopyLink
            url={`https://rhyzo.com/@${user.slug}`}
            label={`rhyzo.com/@${user.slug}`}
            className="text-xs text-fg-light hover:text-accent transition-colors mt-3 inline-block"
          />
        </header>

        {/* Verified Accounts */}
        {verified.length > 0 && (
          <section className="mb-12">
            <h2 className="section-header">Verified Accounts</h2>
            <div className="space-y-3">
              {verified.map((account) => (
                <AccountRow key={account.id} account={account} />
              ))}
            </div>
          </section>
        )}

        {/* Unverified / Claimed Accounts */}
        {unverified.length > 0 && (
          <section className="mb-12">
            <h2 className="section-header">Claimed Accounts</h2>
            <div className="space-y-3">
              {unverified.map((account) => (
                <AccountRow key={account.id} account={account} />
              ))}
            </div>
          </section>
        )}

        {/* Identity Details */}
        {(user.did || user.pdsHost) && (
          <section className="mb-12">
            <h2 className="section-header">Identity</h2>
            <div className="space-y-2 text-sm">
              {user.did && (
                <div className="flex gap-8">
                  <span className="text-fg-light w-16 shrink-0">DID</span>
                  <code className="text-xs bg-fg/5 px-1.5 py-0.5 rounded break-all">
                    {user.did}
                  </code>
                </div>
              )}
              {user.pdsHost && (
                <div className="flex gap-8">
                  <span className="text-fg-light w-16 shrink-0">PDS</span>
                  <span className="text-fg-muted">{user.pdsHost}</span>
                </div>
              )}
            </div>
          </section>
        )}

        <ProfileFooter />
      </div>
    </div>
  );
}

function StubProfile({ data }: { data: ResolvedData }) {
  return (
    <div className="flex justify-center min-h-screen px-4 py-16">
      <div className="max-w-profile w-full">
        {/* Profile Header */}
        <header className="mb-8">
          <div className="flex items-start gap-4 mb-4">
            {data.avatar ? (
              <img
                src={data.avatar}
                alt={data.name}
                className="w-16 h-16 rounded-full object-cover"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-fg/10 flex items-center justify-center text-fg-muted text-xl font-medium">
                {data.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold">{data.name}</h1>
              <p className="text-fg-muted text-sm mt-0.5">{data.handle}</p>
            </div>
          </div>
          {data.bio && (
            <p className="text-sm text-fg-muted leading-relaxed mt-2 whitespace-pre-line">{data.bio}</p>
          )}
        </header>

        {/* Unclaimed notice */}
        <div className="border border-fg/10 rounded-lg p-6 mb-8 bg-fg/[0.02]">
          <p className="text-sm font-medium mb-2">This identity hasn&apos;t been claimed yet</p>
          <p className="text-xs text-fg-muted mb-4 leading-relaxed">
            We resolved this handle via AT Protocol DID resolution. The owner can claim this profile
            by signing in with OAuth to verify ownership.
          </p>
          <ClaimButton handle={data.handle} />
        </div>

        {/* Identity Details */}
        <section className="mb-12">
          <h2 className="section-header">Resolved Identity</h2>
          <div className="space-y-2 text-sm">
            <div className="flex gap-8">
              <span className="text-fg-light w-16 shrink-0">Handle</span>
              <span>{data.handle}</span>
            </div>
            {data.did && (
              <div className="flex gap-8">
                <span className="text-fg-light w-16 shrink-0">DID</span>
                <code className="text-xs bg-fg/5 px-1.5 py-0.5 rounded break-all">
                  {data.did}
                </code>
              </div>
            )}
            {data.pds && (
              <div className="flex gap-8">
                <span className="text-fg-light w-16 shrink-0">PDS</span>
                <span className="text-fg-muted">{data.pds}</span>
              </div>
            )}
          </div>
        </section>

        <ProfileFooter />
      </div>
    </div>
  );
}

function NotFoundProfile({ slug }: { slug: string }) {
  return (
    <div className="flex justify-center min-h-screen px-4 py-16">
      <div className="max-w-profile w-full">
        <h1 className="text-xl font-bold mb-4">Identity not found</h1>
        <p className="text-fg-muted text-sm mb-6">
          Could not resolve &quot;{slug}&quot; as a handle or find it in our directory.
        </p>
        <div className="flex gap-3">
          <a href="/" className="btn-primary">Try a lookup</a>
          <a href="/login" className="btn-secondary">Claim your handle</a>
        </div>
      </div>
    </div>
  );
}

function AccountRow({ account }: { account: typeof schema.accounts.$inferSelect }) {
  const isVerified = account.verificationStatus === 'verified';
  const label = platformLabels[account.platform] || account.platform;
  const faviconDomain = platformDomains[account.platform];
  const favicon = faviconDomain
    ? `https://www.google.com/s2/favicons?domain=${faviconDomain}&sz=32`
    : account.profileUrl
      ? `https://www.google.com/s2/favicons?domain=${(() => { try { return new URL(account.profileUrl).hostname; } catch { return ''; } })()}&sz=32`
      : null;

  return (
    <div className="flex items-center gap-3 group">
      {favicon ? (
        <img src={favicon} alt="" className="w-4 h-4 shrink-0" />
      ) : (
        <div className="w-4 h-4 shrink-0 rounded-sm bg-fg/10" />
      )}
      <span className="text-fg-light text-sm w-20 shrink-0">{label}</span>
      <div className="flex items-center gap-1 flex-1 min-w-0">
        {account.profileUrl ? (
          <a
            href={account.profileUrl}
            target="_blank"
            rel="noopener noreferrer me"
            className="text-sm truncate hover:text-accent transition-colors"
          >
            {account.handle}
            <span className="text-fg-light text-xs ml-1 opacity-0 group-hover:opacity-100 transition-opacity">&#x2197;</span>
          </a>
        ) : (
          <span className="text-sm text-fg-muted truncate">{account.handle}</span>
        )}
      </div>
      <span title={isVerified ? `Verified via ${account.verificationMethod}` : 'Unverified'}>
        {isVerified ? (
          <span className="verified-badge" title={`Verified via ${account.verificationMethod}`}>&#x2713;</span>
        ) : (
          <span className="unverified-badge">&#x25CB;</span>
        )}
      </span>
    </div>
  );
}

function ProfileFooter() {
  return (
    <footer className="border-t border-fg/10 pt-8 mt-16">
      <p className="text-xs text-fg-light">
        Verified with{' '}
        <a href="/" className="hover:text-accent transition-colors">Rhyzo</a>
        {' '}&mdash; decentralized identity resolution for the open web.
      </p>
    </footer>
  );
}

const platformLabels: Record<string, string> = {
  atproto: 'Bluesky',
  mastodon: 'Mastodon',
  github: 'GitHub',
  domain: 'Website',
  twitter: 'Twitter/X',
  linkedin: 'LinkedIn',
  threads: 'Threads',
  figma: 'Figma',
  bluesky: 'Bluesky',
};

const platformDomains: Record<string, string> = {
  atproto: 'bsky.app',
  mastodon: 'mastodon.social',
  github: 'github.com',
  twitter: 'x.com',
  linkedin: 'linkedin.com',
  threads: 'threads.net',
  figma: 'figma.com',
  bluesky: 'bsky.app',
};
