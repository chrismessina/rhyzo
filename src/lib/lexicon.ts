/**
 * Rhyzo Lexicon definitions for AT Protocol.
 * Records stored in the user's PDS repo for data sovereignty.
 *
 * Inspired by Keytrace (dev.keytrace.claim) and Blento patterns.
 */

// Collection NSIDs
export const PROFILE_NSID = 'com.rhyzo.profile';
export const CLAIM_NSID = 'com.rhyzo.claim';

/**
 * com.rhyzo.profile — Singleton profile record.
 * Stored at: at://{did}/com.rhyzo.profile/self
 */
export interface FingerProfile {
  displayName?: string;
  bio?: string;
  tagline?: string;
  domain?: string;
  avatarUrl?: string;
  createdAt: string; // ISO datetime
  updatedAt?: string;
}

/**
 * com.rhyzo.claim — Identity claim linking this DID to an external account.
 * Stored at: at://{did}/com.rhyzo.claim/{tid}
 */
export interface FingerClaim {
  type: string; // 'github' | 'mastodon' | 'twitter' | 'linkedin' | 'threads' | 'domain' | 'figma' | ...
  handle: string; // Username on the platform
  profileUrl?: string; // Link to the profile
  verificationMethod?: string; // 'oauth' | 'rel-me' | 'dns' | 'post-code' | 'did-web' | 'webfinger'
  verificationStatus: string; // 'verified' | 'pending' | 'unverified'
  identity?: {
    subject: string;
    displayName?: string;
    avatarUrl?: string;
    profileUrl?: string;
  };
  verifiedAt?: string; // ISO datetime
  createdAt: string; // ISO datetime
}

// Lexicon schema documents (for reference / future validation)
export const profileLexicon = {
  lexicon: 1,
  id: PROFILE_NSID,
  defs: {
    main: {
      type: 'record',
      key: 'literal:self',
      description: 'Rhyzo profile settings. Singleton record stored in the user\'s ATProto repo.',
      record: {
        type: 'object',
        properties: {
          displayName: { type: 'string', maxGraphemes: 128 },
          bio: { type: 'string', maxGraphemes: 1024 },
          tagline: { type: 'string', maxGraphemes: 256 },
          domain: { type: 'string', maxGraphemes: 256 },
          avatarUrl: { type: 'string', format: 'uri' },
          createdAt: { type: 'string', format: 'datetime' },
          updatedAt: { type: 'string', format: 'datetime' },
        },
        required: ['createdAt'],
      },
    },
  },
};

export const claimLexicon = {
  lexicon: 1,
  id: CLAIM_NSID,
  defs: {
    main: {
      type: 'record',
      key: 'tid',
      description: 'An identity claim linking this DID to an external account.',
      record: {
        type: 'object',
        required: ['type', 'handle', 'verificationStatus', 'createdAt'],
        properties: {
          type: {
            type: 'string',
            knownValues: ['github', 'mastodon', 'twitter', 'linkedin', 'threads', 'domain', 'figma', 'npm', 'activitypub'],
          },
          handle: { type: 'string' },
          profileUrl: { type: 'string', format: 'uri' },
          verificationMethod: {
            type: 'string',
            knownValues: ['oauth', 'rel-me', 'dns', 'post-code', 'did-web', 'webfinger'],
          },
          verificationStatus: {
            type: 'string',
            knownValues: ['verified', 'pending', 'unverified'],
          },
          identity: {
            type: 'ref',
            ref: '#identity',
          },
          verifiedAt: { type: 'string', format: 'datetime' },
          createdAt: { type: 'string', format: 'datetime' },
        },
      },
    },
    identity: {
      type: 'object',
      required: ['subject'],
      properties: {
        subject: { type: 'string' },
        displayName: { type: 'string' },
        avatarUrl: { type: 'string', format: 'uri' },
        profileUrl: { type: 'string', format: 'uri' },
      },
    },
  },
};
