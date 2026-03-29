# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.2.0] - 2026-03-29

### Added

- Actor typeahead on the sign-in form — suggests Bluesky handles as you type using the `@tijs/actor-typeahead` web component and the public `app.bsky.actor.searchActorsTypeahead` API (suggested by [@goost.art](https://bsky.app/profile/goost.art))
- CLAUDE.md with project context for Claude Code
- CHANGELOG.md and README.md

### Changed

- Reduced AT Protocol OAuth scope from `atproto transition:generic` to `atproto` — Rhyzo now only requests repository write access instead of full Bluesky + auth permissions

### Fixed

- Typeahead dropdown no longer has a gap between the input field and the suggestion list

## [0.1.0] - 2026-03-28

### Added

- AT Protocol OAuth sign-in with PKCE + DPoP
- Public profile pages at `/@handle`
- WebFinger (RFC 7033) endpoint at `/.well-known/webfinger` and `/@handle.json`
- Linked account verification (GitHub, Mastodon, Twitter, LinkedIn, Threads, Figma, and more)
- Admin dashboard with user management and ban controls
- User directory at `/directory`
- Custom Lexicon records (`com.rhyzo.profile`, `com.rhyzo.claim`) written to user's PDS for data sovereignty
- SQLite database with Drizzle ORM
- Fly.io deployment with persistent volume storage
