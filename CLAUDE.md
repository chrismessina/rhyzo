# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Rhyzo is a decentralized identity resolution service (think: a modern `finger` command for the open web). Users sign in with a Bluesky/AT Protocol handle via OAuth, claim a profile at `rhyzo.com/@handle`, and link verified accounts across platforms.

Live at: **https://rhyzo.com** — deployed on Fly.io (`fly deploy --remote-only`).

## Stack

- **Next.js 14** App Router — server components + client components, no pages router
- **SQLite + Drizzle ORM** — local file DB (`data/rhyzo.db`); `mode: 'timestamp'` stores Unix **seconds** (not ms)
- **AT Protocol OAuth** — PKCE + DPoP; callback at `/api/v1/auth/atproto/callback`
- **JWT sessions** — HS256, stored in an httpOnly cookie; see `src/lib/session.ts`
- **Tailwind CSS** — custom design tokens in `tailwind.config.ts` (`bg`, `fg`, `fg-muted`, `accent`, `verified`)

## Project structure

```
src/
  app/
    [slug]/           # Public profile page + edit page
    .well-known/      # WebFinger endpoint (RFC 7033)
    admin/            # Admin dashboard (role-gated)
    api/v1/           # REST API routes
  db/
    schema.ts         # Drizzle schema — users, accounts, oauth tables
    migrate.ts        # Runs on startup; safe to re-run
  lib/
    atproto.ts        # AT Protocol handle resolution + OAuth
    session.ts        # JWT session helpers
    admin.ts          # Admin role check
```

## Key conventions

- **Public API responses** — always use an explicit field allowlist. Never spread raw DB rows (`{ user }`) into a response — `role`, `bannedAt`, `banReason`, and `id` must never appear in public endpoints. See `src/app/api/v1/users/[slug]/route.ts` for the pattern.
- **Raw SQL in Drizzle** — when using `sql` template literals, pass plain numbers/strings. `Date` objects cause a SQLite binding error (`SQLite3 can only bind numbers...`). Use `Math.floor(Date.now() / 1000)` for timestamp comparisons.
- **Dynamic `[slug]` routes** — Next.js percent-encodes `@` to `%40` in params. Always run `normalizeSlug()` (strips leading `@` or `%40`) before DB lookups. See `src/app/[slug]/page.tsx`.
- **`NEXT_PUBLIC_*` env vars** — inlined at build time. Must be passed as Docker `ARG` in the builder stage, not just as runtime `ENV`. See `Dockerfile` and `fly.toml`.
- **Next.js standalone output** — `next.config.js` uses `output: 'standalone'`. Production runs `node server.js`, not `next start`.
- **DB schema changes** — edit `src/db/schema.ts`, run `npm run db:generate` to create a migration, then `npm run db:migrate` to apply. `db:init` (which runs `src/db/migrate.ts`) executes automatically on `dev` and `build`.

## Environment variables

Copy `.env.example` to `.env` for local dev:

```
DATABASE_URL=file:./data/rhyzo.db
SESSION_SECRET=<random string>
NEXT_PUBLIC_BASE_URL=http://localhost:3002
ADMIN_DIDS=did:plc:yourdidheretogetadminaccess
```

## Commands

```bash
npm install              # install deps
npm run dev              # starts on :3002 (runs db:init first)
npm run build            # production build (runs db:init first)
npm run db:init          # run migrations (tsx src/db/migrate.ts)
npm run db:generate      # generate new migration after schema changes (drizzle-kit generate)
npm run db:migrate       # apply migrations via drizzle-kit
npm run db:studio        # open Drizzle Studio GUI
```

No test runner or linter is configured. There are no test files in the project.

AT Protocol OAuth requires a publicly reachable callback URL. For local dev, use a tunnel (e.g. `ngrok`) and update `NEXT_PUBLIC_BASE_URL` accordingly. The loopback redirect URI is configured in `src/lib/oauth.ts`.

## Deploy

```bash
fly deploy --remote-only
```

Secrets live in Fly (`fly secrets list --app rhyzo`). `SESSION_SECRET` and `ADMIN_DIDS` should be set there, not in `fly.toml`.

## `/:slug.json` — WebFinger JSON profile

Middleware in `src/middleware.ts` rewrites `/@slug.json` → `/api/v1/users/slug?format=json`, returning a JRD (RFC 7033 JSON Resource Descriptor). Profile pages include an `<link rel="alternate" type="application/jrd+json">` pointing to it.

## AT Protocol identity flow

1. User visits `/login`, enters Bluesky handle
2. `src/lib/oauth.ts` initiates PKCE + DPoP OAuth with the user's PDS
3. Callback at `/api/v1/auth/atproto/callback` exchanges code, resolves DID, creates/updates user
4. JWT session set; user redirected to `/@slug`
5. DID is the stable identifier — handle changes are detected and the slug/handle updated automatically
