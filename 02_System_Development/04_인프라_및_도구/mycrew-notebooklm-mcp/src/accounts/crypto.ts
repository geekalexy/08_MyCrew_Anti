/**
 * Cryptographic utilities for credential encryption
 *
 * Uses AES-256-GCM for authenticated encryption.
 * Key is derived from environment variable or generated and stored.
 */

import crypto from 'crypto';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { CONFIG } from '../config.js';
import { log } from '../utils/logger.js';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

/**
 * Get or create the encryption key
 *
 * Priority:
 * 1. NBLM_ENCRYPTION_KEY environment variable (hex string, 64 chars)
 * 2. Key file in data directory (~/.notebooklm-mcp/encryption.key)
 * 3. Generate new key and save to file
 */
export async function getEncryptionKey(): Promise<Buffer> {
  // 1. Check environment variable
  const envKey = process.env.NBLM_ENCRYPTION_KEY;
  if (envKey) {
    if (envKey.length !== 64) {
      throw new Error('NBLM_ENCRYPTION_KEY must be 64 hex characters (256 bits)');
    }
    return Buffer.from(envKey, 'hex');
  }

  // 2. Check key file
  const keyFilePath = path.join(CONFIG.dataDir, 'encryption.key');

  if (existsSync(keyFilePath)) {
    const keyHex = await fs.readFile(keyFilePath, 'utf-8');
    const trimmed = keyHex.trim();
    if (trimmed.length !== 64) {
      throw new Error(`Invalid key file: expected 64 hex chars, got ${trimmed.length}`);
    }
    return Buffer.from(trimmed, 'hex');
  }

  // 3. Generate new key
  log.warning('🔐 No encryption key found, generating new one...');
  const newKey = crypto.randomBytes(KEY_LENGTH);
  const newKeyHex = newKey.toString('hex');

  await fs.writeFile(keyFilePath, newKeyHex, { mode: 0o600 }); // Read/write only by owner
  log.success(`✅ Encryption key saved to: ${keyFilePath}`);
  log.warning('⚠️  IMPORTANT: Back up this key! Lost key = lost credentials!');

  return newKey;
}

/**
 * Encrypt a string using AES-256-GCM
 *
 * Format: iv:authTag:ciphertext (all hex encoded)
 */
export async function encrypt(plaintext: string): Promise<string> {
  const key = await getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:ciphertext
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt a string using AES-256-GCM
 *
 * Expects format: iv:authTag:ciphertext (all hex encoded)
 */
export async function decrypt(encryptedData: string): Promise<string> {
  const key = await getEncryptionKey();

  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format (expected iv:authTag:ciphertext)');
  }

  const [ivHex, authTagHex, ciphertext] = parts;

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  if (iv.length !== IV_LENGTH) {
    throw new Error(`Invalid IV length: ${iv.length} (expected ${IV_LENGTH})`);
  }
  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error(`Invalid auth tag length: ${authTag.length} (expected ${AUTH_TAG_LENGTH})`);
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Verify the encryption key is valid by encrypting/decrypting a test string
 */
export async function verifyEncryption(): Promise<boolean> {
  try {
    const testString = 'NotebookLM-MCP-Test-' + Date.now();
    const encrypted = await encrypt(testString);
    const decrypted = await decrypt(encrypted);
    return decrypted === testString;
  } catch (error) {
    log.error(`❌ Encryption verification failed: ${error}`);
    return false;
  }
}

/**
 * Generate a new encryption key (for key rotation)
 * Returns the hex-encoded key (64 characters)
 */
export function generateNewKey(): string {
  return crypto.randomBytes(KEY_LENGTH).toString('hex');
}

/**
 * Mask sensitive data for logging (shows first and last 2 chars)
 */
export function maskSensitive(value: string): string {
  if (value.length <= 4) {
    return '*'.repeat(value.length);
  }
  return `${value.slice(0, 2)}${'*'.repeat(value.length - 4)}${value.slice(-2)}`;
}

/**
 * Mask email for logging (e.g., "t***t@gmail.com")
 */
export function maskEmail(email: string): string {
  if (!email.includes('@')) {
    return maskSensitive(email);
  }
  const [name, domain] = email.split('@');
  if (name.length <= 2) {
    return `${'*'.repeat(name.length)}@${domain}`;
  }
  return `${name[0]}${'*'.repeat(name.length - 2)}${name[name.length - 1]}@${domain}`;
}
