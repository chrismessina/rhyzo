# Account Discovery & Verification Plan

**Date:** 2026-03-29
**Status:** Draft
**Goal:** When a user signs into Rhyzo with their AT Proto handle, automatically discover their other accounts across the open web and make it easy to claim and verify ownership of each.

---

## Mental model

Think of discovery as casting a net and verification as reeling it in.

The user's AT Proto identity is the anchor point — their DID document, their profile bio, their domain handle. From that anchor, Rhyzo fans out across protocols and platforms, following links like a spider tracing threads in a web. Each thread has a different strength: a `rel="me"` link from a domain you control is steel cable; a matching username on GitHub is fishing line. The plan below ranks those threads by signal strength and implementation cost, then defines how users reel each one in (verify ownership) once discovered.

```
                         ┌─────────────┐
                         │  AT Proto   │
                         │  DID anchor │
                         └──────┬──────┘
                                │
              ┌─────────────────┼─────────────────┐
              │                 │                 │
        ┌─────┴─────┐   ┌──────┴──────┐   ┌──────┴──────┐
        │ DID doc    │   │ Profile     │   │ Domain      │
        │ alsoKnown  │   │ bio/links   │   │ handle      │
        │ As fields  │   │ parsing     │   │ resolution  │
        └─────┬─────┘   └──────┬──────┘   └──────┬──────┘
              │                │                  │
         ┌────┴────┐    ┌─────┴─────┐    ┌───────┴───────┐
         │Farcaster │    │ Mastodon  │    │ rel=me        │
         │Nostr     │    │ GitHub    │    │ WebFinger     │
         │Web DIDs  │    │ Twitter   │    │ DNS TXT       │
         └─────────┘    │ LinkedIn  │    │ microformats  │
                         └──────────┘    └───────────────┘
```

---

## Current state

Rhyzo already has schema support for seven verification methods (`oauth`, `rel-me`, `dns`, `post-code`, `atproto-did`, `did-web`, `webfinger`) and a `verificationChallenges` table for challenge-response flows. Only AT Proto OAuth is implemented. The `accounts` table stores `platform`, `handle`, `verificationMethod`, and `verificationStatus` — no schema changes needed for Phase 1 or 2.

---

## Discovery heuristics — stack ranked

The table below ranks each discovery signal by three dimensions: **signal quality** (how reliably it identifies a real account owned by this person), **reach** (how many users/platforms it covers), and **implementation effort** (engineering time to build, test, deploy). The composite rank weighs signal quality highest, then reach, then effort.

### Tier 1 — High signal, low effort (implement first)

| # | Heuristic | Signal | Reach | Effort | Notes |
|---|-----------|--------|-------|--------|-------|
| 1 | **`alsoKnownAs` in DID documents** | ★★★★★ | ★★★ | ★☆☆ | Already resolving DIDs. The `alsoKnownAs` array often contains `at://`, `web+did:`, Mastodon `acct:` URIs, and domain handles. Parse and normalize. |
| 2 | **`rel="me"` on user's domain** | ★★★★★ | ★★★★ | ★★☆ | If the user has a domain-based AT Proto handle (e.g. `chrismessina.me`), fetch that domain's HTML and extract all `<a rel="me">` and `<link rel="me">` hrefs. This is the IndieWeb gold standard. |
| 3 | **WebFinger on known servers** | ★★★★ | ★★★ | ★★☆ | Query `/.well-known/webfinger?resource=acct:{handle}@{domain}` on Mastodon instances, Rhyzo itself, and any domain the user controls. Returns profile URIs and `rel="me"` aliases. |
| 4 | **AT Proto profile bio/links** | ★★★★ | ★★★★★ | ★☆☆ | Already fetching profile from PDS. Parse `description` field for URLs (twitter.com/x, github.com/x, etc.) and known handle formats (@user@instance, github.com/user). |
| 5 | **Domain handle → DNS/HTTP probes** | ★★★★ | ★★★ | ★★☆ | For domain-based handles, also check `_atproto.` TXT records, `/.well-known/nostr.json`, `/.well-known/farcaster.json`, and `humans.json` at the domain root. One fetch per well-known path. |

### Tier 2 — Good signal, moderate effort (implement second)

| # | Heuristic | Signal | Reach | Effort | Notes |
|---|-----------|--------|-------|--------|-------|
| 6 | **Farcaster handle/FID resolution** | ★★★★ | ★★★ | ★★★ | Query Farcaster hub API or Neynar API with the user's domain or known Ethereum address. Farcaster usernames are unique and verifiable. |
| 7 | **Nostr NIP-05 domain verification** | ★★★★ | ★★ | ★★☆ | Fetch `/.well-known/nostr.json?name={user}` from the user's domain. Returns npub. Moderate reach (Nostr is niche but growing). |
| 8 | **HTML meta tags (OGP, Twitter Cards)** | ★★★ | ★★★★ | ★★☆ | When fetching a user's domain, also extract `<meta property="og:*">`, `<meta name="twitter:*">`, `<link rel="canonical">`, `<link rel="alternate">`. Can reveal social handles and canonical URLs. |
| 9 | **RSS / Atom / JSON Feed autodiscovery** | ★★★ | ★★★ | ★★☆ | Parse `<link rel="alternate" type="application/rss+xml">` etc. from user's domain. Feed metadata often contains author URIs, social links, and `rel="me"` equivalent fields. |
| 10 | **ActivityStreams 2.0 `movedTo`** | ★★★★ | ★★ | ★★★ | For Mastodon/ActivityPub accounts, fetch the actor JSON and check `movedTo` field. High signal when present (explicit migration pointer) but only relevant for fediverse users. |
| 11 | **Known handle formats in bios** | ★★★ | ★★★★★ | ★★★ | Regex extraction of patterns like `@user@instance.tld` (Mastodon), `@user.bsky.social` (Bluesky), `npub1...` (Nostr), `fid:12345` (Farcaster), `github.com/user` from any bio text. High false-positive risk — treat as suggestions, not verified. |

### Tier 3 — Moderate signal, higher effort (implement when needed)

| # | Heuristic | Signal | Reach | Effort | Notes |
|---|-----------|--------|-------|--------|-------|
| 12 | **HTML Microformats2 (`h-card`)** | ★★★★ | ★★ | ★★★ | Parse `h-card` from user's domain for `u-url`, `u-uid`, `rel="me"` properties. High signal when present but low adoption outside IndieWeb community. Requires mf2 parser library. |
| 13 | **Schema.org / JSON-LD** | ★★★ | ★★★ | ★★★ | Extract `Person` or `ProfilePage` structured data from user's domain. Contains `sameAs` array linking to social profiles. Moderate adoption on personal sites. |
| 14 | **Dublin Core metadata** | ★★ | ★★ | ★★☆ | Extract `<meta name="DC.creator">` etc. Low adoption, low signal for identity linking. Only useful as supplementary data. |
| 15 | **XFN (XHTML Friends Network)** | ★★★ | ★ | ★★☆ | Parse `rel="me"` is already covered; the broader XFN vocabulary (`rel="contact"`, `rel="colleague"`) adds social graph data but not identity data. Deprioritize. |
| 16 | **FOAF (Friend of a Friend)** | ★★ | ★ | ★★★ | RDF/XML format. Nearly extinct outside academic/Semantic Web circles. Only implement if specific user demand exists. Requires RDF parser. |
| 17 | **`humans.json` / `humans.txt`** | ★★ | ★ | ★☆☆ | Non-standard but trivial to check. Very low adoption. Include as a bonus probe when already fetching from a domain. |

### Tier 4 — High effort, variable signal (consider carefully)

| # | Heuristic | Signal | Reach | Effort | Notes |
|---|-----------|--------|-------|--------|-------|
| 18 | **Closed platform profile scraping** | ★★★ | ★★★★★ | ★★★★★ | GitHub API is feasible (public, rate-limited). Facebook, YouTube, LinkedIn require auth/scraping and are legally risky. Recommend: GitHub API only in Phase 2, others via user-submitted links only. |

---

## Verification methods — how users claim discovered accounts

Once Rhyzo discovers a potential account, the user needs to prove they own it. Different platforms afford different proofs:

### Method 1: OAuth (strongest, platform-dependent)

**How it works:** User authenticates directly with the platform. Rhyzo receives a token proving ownership.

**Platforms:** AT Proto (implemented), Mastodon (OAuth 2.0), GitHub (OAuth), potentially Farcaster (SIWF — Sign In With Farcaster).

**Effort:** ★★★ per platform (each needs its own OAuth client registration and callback handler).

**Priority:** High for Mastodon and GitHub (large overlap with AT Proto users). These two would cover a significant chunk of the target audience.

### Method 2: Bidirectional `rel="me"` (strong, domain-dependent)

**How it works:** User adds `<a rel="me" href="https://rhyzo.com/@handle">` to their site. Rhyzo confirms the link exists and points back. IndieAuth standard.

**Platforms:** Any website the user controls, Mastodon profiles (which support `rel="me"` natively), GitHub profiles.

**Effort:** ★★☆ — HTTP fetch + HTML parse + bidirectional check. Already have schema support.

**Priority:** High — this is the most universal verification method for the open web.

### Method 3: DNS TXT/CNAME record (strong, domain-dependent)

**How it works:** User adds a TXT record like `rhyzo-verify=<challenge-code>` or a CNAME `_rhyzo.domain.com → verify.rhyzo.com` to their domain's DNS.

**Platforms:** Any domain the user controls.

**Effort:** ★★☆ — DNS lookup via `dns.resolve` or public DNS API. Challenge code generation already supported by `verificationChallenges` table.

**Priority:** Medium — strong proof but higher friction for non-technical users.

### Method 4: Post-code verification (moderate, platform-dependent)

**How it works:** Rhyzo generates a unique code. User posts it (or includes it in their bio) on the target platform. Rhyzo checks for the code via API or scraping.

**Platforms:** Any platform with public posts/bios — Mastodon (API), Bluesky (API), GitHub (gist or bio), Nostr (note), Farcaster (cast).

**Effort:** ★★★ — need per-platform API integration to check for the code. Challenge generation is already built.

**Priority:** Medium — good fallback when OAuth isn't available.

### Method 5: DID-based verification (strongest for decentralized protocols)

**How it works:** For platforms with DID support, verify that the same DID (or a linked DID) controls both accounts.

**Sub-methods:**
- **`did:web`** — User hosts `/.well-known/did.json` on their domain containing their AT Proto DID. Rhyzo fetches and confirms.
- **`alsoKnownAs` backlink** — User's DID document lists a Rhyzo URI in `alsoKnownAs`. Rhyzo confirms the DID doc contains the expected reference.
- **Cross-protocol DID linking** — If a Farcaster FID or Nostr npub can be deterministically linked to the same controller.

**Effort:** ★★☆ for did:web (HTTP fetch + JSON parse), ★★★ for cross-protocol.

**Priority:** High for did:web (already partially built into handle resolution).

### Method 6: WebFinger backlink (moderate)

**How it works:** Rhyzo queries the target platform's WebFinger endpoint. If the response includes a `rel="me"` link pointing to the user's Rhyzo profile or known identity, it's treated as a soft verification.

**Platforms:** Mastodon, any WebFinger-supporting service.

**Effort:** ★★☆ — already have WebFinger infrastructure.

**Priority:** Medium — useful as a supplementary signal, not standalone proof.

---

## Implementation phases

### Phase 1: Domain-anchored discovery (2–3 weeks)

**Prerequisite:** User has a domain-based AT Proto handle (e.g. `chrismessina.me`).

**Discovery pipeline:**
1. On sign-in (or manual "discover accounts" action), resolve user's DID document
2. Extract `alsoKnownAs` URIs → normalize to platform + handle pairs
3. Fetch user's domain HTML (single HTTP request, reuse for multiple heuristics):
   - Extract `rel="me"` links
   - Extract `<meta>` OGP/Twitter handles
   - Extract `<link rel="alternate">` feeds
   - Extract JSON-LD `sameAs` if present
4. Parse AT Proto profile bio for URLs and handle patterns
5. Probe well-known paths on user's domain: `/.well-known/nostr.json`, `/.well-known/webfinger`
6. Present discovered accounts as "suggested links" on the edit profile page

**Verification (Phase 1):**
- `rel="me"` bidirectional check (automatic for discovered links)
- DNS TXT record challenge
- `did:web` verification

**New components:**
- `src/lib/discovery.ts` — Discovery engine (fetch, parse, normalize)
- `src/lib/verify.ts` — Verification engine (check proofs)
- `src/app/api/v1/discover/route.ts` — API endpoint to trigger discovery
- `src/app/api/v1/verify/route.ts` — API endpoint to trigger/check verification
- UI: "Discover accounts" button + suggested accounts panel on edit page

**Schema changes:** None required — existing `accounts` and `verificationChallenges` tables suffice. May add a `discoverySource` field to `accounts.metadata` JSON to track how each account was found.

### Phase 2: Protocol-native discovery (2–3 weeks)

**New discovery signals:**
- WebFinger queries on Mastodon instances (from `rel="me"` links or `alsoKnownAs`)
- Farcaster hub/Neynar API queries
- Nostr NIP-05 resolution
- ActivityStreams 2.0 actor fetch (`movedTo`, `alsoKnownAs` in AP context)
- RSS/Atom feed author metadata

**New verification methods:**
- Mastodon OAuth (register Rhyzo as an OAuth client)
- GitHub OAuth
- Post-code verification (Mastodon API, Bluesky API, Nostr relay)

**New components:**
- `src/lib/discovery/mastodon.ts` — Mastodon/AP discovery
- `src/lib/discovery/farcaster.ts` — Farcaster discovery
- `src/lib/discovery/nostr.ts` — Nostr discovery
- OAuth clients for Mastodon + GitHub
- Post-code generation + checking flow in UI

### Phase 3: Deep parsing & closed platforms (2–4 weeks)

**New discovery signals:**
- Full microformats2 parsing (add `microformats-parser` dependency)
- Schema.org / Dublin Core extraction
- GitHub API profile + social links
- Bio pattern matching across all supported platforms

**New verification methods:**
- Sign In With Farcaster (SIWF)
- Nostr event signing (user signs a challenge with their nsec)
- CNAME verification as alternative to TXT

**New components:**
- `src/lib/discovery/structured-data.ts` — mf2, schema.org, Dublin Core
- `src/lib/discovery/github.ts` — GitHub API integration
- `src/lib/discovery/bio-parser.ts` — Cross-platform bio regex engine

### Phase 4: Continuous re-verification & public API (ongoing)

- Scheduled re-verification of existing links (detect broken/changed links)
- Public API for third parties: `GET /api/v1/resolve?handle=user.bsky.social` returns all verified accounts
- Webhook notifications when verification status changes
- Confidence scoring (composite of multiple signals)
- Rate limiting and caching for external fetches

---

## Discovery engine architecture

```
┌──────────────────────────────────────────────────────┐
│                   Discovery Engine                    │
│                                                      │
│  Input: user DID + handle + domain (if any)          │
│                                                      │
│  ┌────────────┐  ┌────────────┐  ┌────────────────┐  │
│  │ DID Doc    │  │ Domain     │  │ Profile Bio    │  │
│  │ Resolver   │  │ Crawler    │  │ Parser         │  │
│  │            │  │            │  │                │  │
│  │ alsoKnown  │  │ rel=me     │  │ URL extraction │  │
│  │ As parsing │  │ meta tags  │  │ handle regex   │  │
│  │            │  │ feeds      │  │                │  │
│  │            │  │ well-known │  │                │  │
│  └─────┬──────┘  └─────┬──────┘  └───────┬────────┘  │
│        │               │                 │           │
│        └───────────────┼─────────────────┘           │
│                        ▼                             │
│              ┌─────────────────┐                     │
│              │   Normalizer    │                     │
│              │                 │                     │
│              │ URL → platform  │                     │
│              │ + handle + URL  │                     │
│              │ deduplication   │                     │
│              └────────┬────────┘                     │
│                       ▼                              │
│              ┌─────────────────┐                     │
│              │ Suggested       │                     │
│              │ Accounts[]      │                     │
│              │                 │                     │
│              │ { platform,     │                     │
│              │   handle,       │                     │
│              │   profileUrl,   │                     │
│              │   source,       │                     │
│              │   confidence }  │                     │
│              └─────────────────┘                     │
└──────────────────────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────┐
│               Verification Engine                     │
│                                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐ │
│  │ OAuth    │ │ rel=me   │ │ DNS      │ │ Post-   │ │
│  │ (per-    │ │ bidir.   │ │ TXT/     │ │ code    │ │
│  │ platform)│ │ check    │ │ CNAME    │ │ verify  │ │
│  └──────────┘ └──────────┘ └──────────┘ └─────────┘ │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐             │
│  │ did:web  │ │ WebFinger│ │ Protocol │             │
│  │ verify   │ │ backlink │ │ signing  │             │
│  └──────────┘ └──────────┘ └──────────┘             │
│                                                      │
│  Output: verificationStatus + verificationMethod     │
└──────────────────────────────────────────────────────┘
```

---

## Effort estimates summary

| Phase | Scope | Estimated effort | Key deliverables |
|-------|-------|-----------------|------------------|
| **1** | Domain-anchored discovery + rel=me/DNS/did:web verification | 2–3 weeks | Discovery engine, 3 verification methods, edit page UI |
| **2** | Protocol-native discovery + Mastodon/GitHub OAuth + post-code | 2–3 weeks | Mastodon + Farcaster + Nostr discovery, 3 new verification methods |
| **3** | Deep structured data parsing + closed platform APIs | 2–4 weeks | mf2, schema.org, GitHub API, bio parser |
| **4** | Re-verification, public API, confidence scoring | Ongoing | Scheduled jobs, public API, webhooks |

---

## Open questions

1. **Privacy:** Should discovery results be visible only to the account owner, or also shown on their public profile as "suggested" links? Recommendation: owner-only until verified.
2. **Rate limiting:** External fetches (domains, APIs) need aggressive caching and rate limiting. Recommend a fetch queue with deduplication.
3. **Confidence thresholds:** At what confidence level should a discovered account be auto-suggested vs. silently logged? Suggest: any signal above "matching username" (Tier 4) gets surfaced.
4. **Verification expiry:** How long should a verification remain valid? Recommend: re-check monthly, downgrade to "stale" if the proof disappears.
5. **User control:** Users should be able to dismiss suggested accounts and opt out of discovery entirely.
