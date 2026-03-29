/**
 * Run database migrations.
 * Called during `npm run build` or can be run standalone.
 */
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = (process.env.DATABASE_URL?.replace('file:', '') || './data/rhyzo.db');

// Ensure directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables directly (simpler than migration files for Phase 1)
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    primary_handle TEXT NOT NULL,
    display_name TEXT,
    bio TEXT,
    tagline TEXT,
    avatar_url TEXT,
    domain TEXT,
    did TEXT,
    pds_host TEXT,
    slug TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    handle TEXT NOT NULL,
    profile_url TEXT,
    verification_method TEXT,
    verification_status TEXT NOT NULL DEFAULT 'unverified',
    verified_at INTEGER,
    metadata TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS verification_challenges (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    method TEXT NOT NULL,
    challenge_code TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    completed_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE INDEX IF NOT EXISTS idx_users_slug ON users(slug);
  CREATE INDEX IF NOT EXISTS idx_users_did ON users(did);
  CREATE INDEX IF NOT EXISTS idx_users_domain ON users(domain);
  CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
  CREATE INDEX IF NOT EXISTS idx_accounts_handle ON accounts(handle);

  CREATE TABLE IF NOT EXISTS oauth_states (
    key TEXT PRIMARY KEY,
    state TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS oauth_sessions (
    key TEXT PRIMARY KEY,
    session TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
`);

// Add oauth_verified column if missing (migration for existing DBs)
try {
  db.exec(`ALTER TABLE users ADD COLUMN oauth_verified INTEGER NOT NULL DEFAULT 0`);
} catch {
  // Column already exists
}

// Add role column if missing
try {
  db.exec(`ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'`);
} catch {
  // Column already exists
}

// Add banned_at column if missing
try {
  db.exec(`ALTER TABLE users ADD COLUMN banned_at INTEGER`);
} catch {
  // Column already exists
}

// Add ban_reason column if missing
try {
  db.exec(`ALTER TABLE users ADD COLUMN ban_reason TEXT`);
} catch {
  // Column already exists
}

console.log('Database initialized at', dbPath);
db.close();
