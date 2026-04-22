/**
 * Test Configuration Loader
 *
 * Loads test configuration from the local file.
 * In CI or when missing, provides a mock config that skips integration tests.
 */

import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const localConfigPath = resolve(__dirname, 'test-config.local.ts');

// Check if running in CI or local config is missing
const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
const hasLocalConfig = existsSync(localConfigPath);

// Mock config for CI - matches test-config.example.ts structure
const mockConfig = {
  notebooks: {
    primary: {
      id: 'mock-notebook-1',
      uuid: '00000000-0000-0000-0000-000000000000',
      name: 'Mock Test Notebook',
      url: 'https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000000',
    },
    secondary: {
      id: 'mock-notebook-2',
      uuid: '00000000-0000-0000-0000-000000000001',
      name: 'Mock Secondary Notebook',
      url: 'https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000001',
    },
    e2eTest: {
      id: 'mock-e2e-notebook',
      uuid: '00000000-0000-0000-0000-000000000002',
      name: 'Mock E2E Test Notebook',
      url: 'https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000002',
    },
  },
  accounts: {
    primary: 'mock-account-1',
    secondary: 'mock-account-2',
  },
  server: {
    baseUrl: 'http://localhost:3000',
    timeout: 30000,
  },
  content: {
    sampleQuestion: 'What is the main topic?',
    sampleText: 'Mock sample text for testing.',
    sampleUrl: 'https://example.com/test',
  },
};

export type TestConfig = typeof mockConfig;

let testConfig: TestConfig;

if (!hasLocalConfig) {
  if (!isCI) {
    console.warn(`
╔════════════════════════════════════════════════════════════════════╗
║                    TEST CONFIGURATION MISSING                       ║
╠════════════════════════════════════════════════════════════════════╣
║  The local test configuration file is missing.                     ║
║  Integration tests will be skipped (NBLM_INTEGRATION_TESTS!=true). ║
║                                                                    ║
║  To enable integration tests:                                      ║
║                                                                    ║
║  1. Copy the example configuration:                                ║
║     cp tests/test-config.example.ts tests/test-config.local.ts     ║
║                                                                    ║
║  2. Edit tests/test-config.local.ts with your values:              ║
║     - Your notebook UUIDs                                          ║
║     - Your account IDs                                             ║
║     - Any other test-specific data                                 ║
╚════════════════════════════════════════════════════════════════════╝
`);
  }
  testConfig = mockConfig;
} else {
  // Dynamic import of local config
  const localModule = await import('./test-config.local.js');
  testConfig = localModule.testConfig;
}

export { testConfig };
