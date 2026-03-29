# Rhyzo

Decentralized identity resolution for the open web. Think of it as a modern [`finger`](https://en.wikipedia.org/wiki/Finger_%28protocol%29) command — sign in with your Bluesky/AT Protocol handle, claim a profile at `rhyzo.com/@handle`, and link verified accounts across platforms.

**Live at [rhyzo.com](https://rhyzo.com)**

## Features

- **AT Protocol OAuth** — sign in with any Bluesky-compatible PDS (Bluesky, selfhosted.social, Periwinkle, or your own)
- **Public profiles** — `rhyzo.com/@yourhandle` with display name, bio, avatar, and linked accounts
- **Identity claims** — link and verify accounts on GitHub, Mastodon, Twitter/X, LinkedIn, Threads, Figma, and more
- **WebFinger (RFC 7033)** — machine-readable identity at `/@handle.json` and `/.well-known/webfinger`
- **Data sovereignty** — profile and claim records are written to your PDS using custom Lexicons (`com.rhyzo.profile`, `com.rhyzo.claim`)
- **Admin dashboard** — user management, ban controls, and stats
- **Actor typeahead** — handle suggestions on the sign-in form powered by `app.bsky.actor.searchActorsTypeahead`

## Stack

- **Next.js 14** (App Router) with server and client components
- **SQLite** via **Drizzle ORM** (local file DB)
- **AT Protocol OAuth** with PKCE + DPoP
- **JWT sessions** (HS256, httpOnly cookie)
- **Tailwind CSS** with custom design tokens

## Getting started

### Prerequisites

- Node.js 20+
- npm

### Setup

```bash
git clone https://github.com/chrismessina/rhyzo.git
cd rhyzo
npm install
cp .env.example .env
```

Edit `.env` with your settings:

```env
DATABASE_URL=file:./data/rhyzo.db
SESSION_SECRET=<random string>
NEXT_PUBLIC_BASE_URL=http://localhost:3000
ADMIN_DIDS=did:plc:yourdidheretogetadminaccess
```

### Run locally

```bash
npm run dev
```

The dev server starts on the port specified in your Next.js config (default 3000). The database is created and migrated automatically on startup.

> **Note:** AT Protocol OAuth requires a publicly reachable callback URL. For local development, use a tunnel (e.g. [ngrok](https://ngrok.com/)) and update `NEXT_PUBLIC_BASE_URL` to match.

### Other commands

```bash
npm run build          # Production build
npm run start          # Start production server
npm run db:generate    # Generate migration after schema changes
npm run db:migrate     # Apply migrations via drizzle-kit
npm run db:studio      # Open Drizzle Studio GUI
```

## Docker

### Development

```bash
docker build --target dev -t rhyzo-dev .
docker run -p 3000:3000 -v $(pwd)/data:/app/data rhyzo-dev
```

### Production

```bash
docker build --target production \
  --build-arg NEXT_PUBLIC_BASE_URL=https://your-domain.com \
  -t rhyzo .

docker run -p 3000:3000 \
  -e DATABASE_URL=file:/app/data/rhyzo.db \
  -e SESSION_SECRET=<random-string> \
  -e ADMIN_DIDS=did:plc:yourdid \
  -v rhyzo-data:/app/data \
  rhyzo
```

> **Important:** `NEXT_PUBLIC_BASE_URL` must be passed as a build arg (`--build-arg`), not just a runtime env var, because Next.js inlines it at build time.

## Deploy to Fly.io

```bash
fly deploy --remote-only
```

Secrets are managed via Fly:

```bash
fly secrets set SESSION_SECRET=<random-string> ADMIN_DIDS=did:plc:yourdid
```

`NEXT_PUBLIC_BASE_URL` is set in `fly.toml` as a build arg (currently `https://rhyzo.com`).

## How it works

1. User visits `/login` and enters their AT Protocol handle
2. Rhyzo resolves the handle, discovers the user's PDS, and initiates OAuth (PKCE + DPoP)
3. The user authorizes on their PDS — Rhyzo never sees their password
4. On callback, Rhyzo creates a local profile, fetches display info from the PDS, and writes a `com.rhyzo.profile` record back to the user's repo
5. The user gets a public profile at `/@handle` and can link additional accounts

DID is the stable identifier — handle changes are detected and updated automatically on sign-in.

## License

MIT
