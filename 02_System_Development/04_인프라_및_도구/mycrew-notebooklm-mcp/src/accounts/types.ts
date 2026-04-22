/**
 * Account Management Types
 *
 * Types for multi-account support with rotation and auto-login
 */

/**
 * Account configuration stored in accounts.json
 */
export interface AccountConfig {
  id: string;
  email: string;
  enabled: boolean;
  priority: number; // Lower = higher priority
  hasCredentials: boolean;
  hasTotp: boolean;
  createdAt: string;
  notes?: string;
}

/**
 * Encrypted credentials stored per account
 */
export interface EncryptedCredentials {
  emailEncrypted: string;
  passwordEncrypted: string;
  totpSecretEncrypted?: string;
  encryptedAt: string;
}

/**
 * Quota tracking per account
 */
export interface AccountQuota {
  used: number;
  limit: number;
  resetAt: string; // ISO date string (midnight UTC)
  lastUpdated: string;
}

/**
 * Runtime account state
 */
export interface AccountState {
  sessionStatus: 'valid' | 'expiring' | 'expired' | 'unknown';
  lastActivity: string | null;
  lastLoginAttempt: string | null;
  loginFailures: number;
  consecutiveFailures: number;
  lastError?: string;
}

/**
 * Full account info (config + state + quota)
 */
export interface Account {
  config: AccountConfig;
  quota: AccountQuota;
  state: AccountState;
  profileDir: string;
  stateFilePath: string;
}

/**
 * Account health check result
 */
export interface AccountHealth {
  accountId: string;
  email: string;
  enabled: boolean;
  sessionValid: boolean;
  quotaRemaining: number;
  quotaPercent: number;
  lastActivity: string | null;
  issues: string[];
}

/**
 * Rotation strategy for account selection
 */
export type RotationStrategy = 'least_used' | 'round_robin' | 'failover' | 'random';

/**
 * Global accounts configuration
 */
export interface AccountsConfig {
  accounts: AccountConfig[];
  rotationStrategy: RotationStrategy;
  keepAliveIntervalHours: number;
  autoLoginEnabled: boolean;
  alertWebhook?: string;
  encryptionKeyId?: string; // Reference to which key was used
}

/**
 * Account selection result
 */
export interface AccountSelection {
  account: Account;
  reason: string;
}

/**
 * Auto-login result
 */
export interface AutoLoginResult {
  success: boolean;
  accountId: string;
  error?: string;
  duration: number;
  requiresManualIntervention: boolean;
}
