/**
 * Server-side credential encryption utilities
 * Uses AES-256-GCM for authenticated encryption
 *
 * AES-256-GCM provides:
 * - Confidentiality: Password cannot be read without the key
 * - Integrity: Any tampering will be detected via authTag
 * - Authentication: Only holders of the key can encrypt/decrypt
 */

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits

/**
 * Get encryption key from environment variable
 * Key must be 32 bytes (256 bits) for AES-256
 */
function getEncryptionKey(): Buffer {
  const key = process.env.STORE_CREDENTIALS_ENCRYPTION_KEY;

  if (!key) {
    throw new Error(
      "STORE_CREDENTIALS_ENCRYPTION_KEY environment variable is required. " +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }

  // If key is hex-encoded (64 chars = 32 bytes), decode it
  if (key.length === 64 && /^[0-9a-fA-F]+$/.test(key)) {
    return Buffer.from(key, "hex");
  }

  // If key is base64-encoded (44 chars = 32 bytes), decode it
  if (key.length === 44) {
    const decoded = Buffer.from(key, "base64");
    if (decoded.length === 32) {
      return decoded;
    }
  }

  throw new Error(
    "STORE_CREDENTIALS_ENCRYPTION_KEY must be 32 bytes (64 hex characters or 44 base64 characters). " +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
  );
}

/**
 * Encrypted data structure
 */
export interface EncryptedData {
  /** Encrypted password (hex-encoded) */
  encryptedPassword: string;
  /** Initialization vector (hex-encoded) */
  iv: string;
  /** Authentication tag for GCM verification (hex-encoded) */
  authTag: string;
}

/**
 * Encrypt a password using AES-256-GCM
 *
 * @param password - The plaintext password to encrypt
 * @returns Encrypted data with IV and auth tag for storage
 */
export function encryptPassword(password: string): EncryptedData {
  const key = getEncryptionKey();

  // Generate a random initialization vector
  const iv = crypto.randomBytes(IV_LENGTH);

  // Create cipher
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  // Encrypt the password
  let encrypted = cipher.update(password, "utf8", "hex");
  encrypted += cipher.final("hex");

  // Get the authentication tag
  const authTag = cipher.getAuthTag();

  return {
    encryptedPassword: encrypted,
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex"),
  };
}

/**
 * Decrypt a password using AES-256-GCM
 *
 * @param encryptedData - The encrypted data with IV and auth tag
 * @returns The decrypted plaintext password
 * @throws Error if decryption fails (wrong key or tampered data)
 */
export function decryptPassword(encryptedData: EncryptedData): string {
  const key = getEncryptionKey();

  // Convert hex strings back to buffers
  const iv = Buffer.from(encryptedData.iv, "hex");
  const authTag = Buffer.from(encryptedData.authTag, "hex");

  // Create decipher
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  // Decrypt the password
  let decrypted = decipher.update(encryptedData.encryptedPassword, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Generate a new encryption key for environment variable
 * Run this once to create a key for .env
 *
 * Usage: node -e "console.log(require('./src/lib/encryption').generateEncryptionKey())"
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString("hex");
}
