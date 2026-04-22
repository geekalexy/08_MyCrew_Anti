/**
 * Test Configuration Template
 *
 * This file contains the structure for test configuration.
 * Copy this file to `test-config.local.ts` and fill in your values.
 *
 * IMPORTANT: test-config.local.ts is git-ignored and will never be
 * overwritten by git pull. Your local configuration is safe.
 *
 * Usage:
 *   cp tests/test-config.example.ts tests/test-config.local.ts
 *   # Edit test-config.local.ts with your values
 */

export const testConfig = {
  /**
   * Notebook configurations for testing
   * Replace with your actual notebook UUIDs
   */
  notebooks: {
    // Primary notebook for most tests
    primary: {
      id: 'notebook-1',
      uuid: '00000000-0000-0000-0000-000000000000', // Replace with real UUID
      name: 'Test Notebook',
      url: 'https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000000',
    },
    // Secondary notebook for multi-notebook tests
    secondary: {
      id: 'notebook-2',
      uuid: '00000000-0000-0000-0000-000000000001', // Replace with real UUID
      name: 'Secondary Test Notebook',
      url: 'https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000001',
    },
  },

  /**
   * Test accounts (optional - for multi-account testing)
   * Only needed if testing account rotation features
   */
  accounts: {
    // Account IDs from `npm run accounts list`
    primary: 'account-0000000000000', // Replace with real account ID
    secondary: 'account-0000000000001', // Replace with real account ID
  },

  /**
   * Server configuration
   */
  server: {
    baseUrl: 'http://localhost:3000',
    timeout: 30000, // ms
  },

  /**
   * Test content
   */
  content: {
    // Sample question for ask tests
    sampleQuestion: 'What is the main topic of this notebook?',
    // Sample text for source addition tests
    sampleText: 'This is sample text content for testing source addition.',
    // Sample URL for URL source tests
    sampleUrl: 'https://example.com/sample-article',
  },
};

export type TestConfig = typeof testConfig;
