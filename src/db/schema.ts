import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(), // uuid
  primaryHandle: text('primary_handle').notNull(),
  displayName: text('display_name'),
  bio: text('bio'),
  tagline: text('tagline'),
  avatarUrl: text('avatar_url'),
  domain: text('domain'),
  did: text('did'),
  pdsHost: text('pds_host'),
  slug: text('slug').notNull().unique(),
  oauthVerified: integer('oauth_verified', { mode: 'boolean' }).notNull().default(false),
  role: text('role').notNull().default('user'), // 'user' | 'admin'
  bannedAt: integer('banned_at', { mode: 'timestamp' }),
  banReason: text('ban_reason'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(), // uuid
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  platform: text('platform').notNull(), // atproto | mastodon | github | domain | twitter | linkedin | threads | ...
  handle: text('handle').notNull(),
  profileUrl: text('profile_url'),
  verificationMethod: text('verification_method'), // oauth | rel-me | dns | post-code | atproto-did | did-web | webfinger
  verificationStatus: text('verification_status').notNull().default('unverified'), // verified | pending | unverified | expired | failed
  verifiedAt: integer('verified_at', { mode: 'timestamp' }),
  metadata: text('metadata', { mode: 'json' }), // JSON blob for extra data
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

export const verificationChallenges = sqliteTable('verification_challenges', {
  id: text('id').primaryKey(), // uuid
  accountId: text('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  method: text('method').notNull(),
  challengeCode: text('challenge_code').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// OAuth state store (in-flight authorization requests)
export const oauthStates = sqliteTable('oauth_states', {
  key: text('key').primaryKey(),
  state: text('state').notNull(), // JSON blob
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// OAuth session store (active AT Proto sessions with tokens)
export const oauthSessions = sqliteTable('oauth_sessions', {
  key: text('key').primaryKey(), // DID (sub)
  session: text('session').notNull(), // JSON blob
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

// Type exports
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type VerificationChallenge = typeof verificationChallenges.$inferSelect;
