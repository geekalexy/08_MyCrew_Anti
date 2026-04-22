/**
 * Account Management Module
 *
 * Multi-account support for NotebookLM with:
 * - Encrypted credential storage
 * - Account pool with rotation
 * - Quota tracking
 * - Auto-login
 */

export * from './types.js';
export * from './crypto.js';
export * from './account-manager.js';
export * from './auto-login-manager.js';
