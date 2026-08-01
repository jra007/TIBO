import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const KEY_LENGTH = 32;
const VERSION_PREFIX = 'v1:';

/**
 * Derived once from JWT_SECRET rather than requiring a second dedicated env var — this is a
 * dev/small-deployment tradeoff (see JWT_SECRET's own dev fallback in auth.constants.ts); a
 * production hardening pass should introduce a distinct ENCRYPTION_KEY.
 */
function encryptionKey(): Buffer {
  const secret = process.env.JWT_SECRET || 'dev-insecure-secret-change-me';
  return scryptSync(secret, 'tibo-secret-encryption', KEY_LENGTH);
}

/** Encrypts a secret (SMTP password, LDAP bind password) for storage. Returns null for null/empty input — "no secret set" stays representable. */
export function encryptSecret(plaintext: string | null | undefined): string | null {
  if (!plaintext) return null;
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return VERSION_PREFIX + Buffer.concat([iv, authTag, ciphertext]).toString('base64');
}

/** Decrypts a value produced by encryptSecret. Returns null if nothing was stored. */
export function decryptSecret(stored: string | null | undefined): string | null {
  if (!stored) return null;
  if (!stored.startsWith(VERSION_PREFIX)) return stored; // legacy/plaintext fallback
  const raw = Buffer.from(stored.slice(VERSION_PREFIX.length), 'base64');
  const iv = raw.subarray(0, IV_LENGTH);
  const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + 16);
  const ciphertext = raw.subarray(IV_LENGTH + 16);
  const decipher = createDecipheriv(ALGORITHM, encryptionKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
