/**
 * Integration Test Setup
 *
 * These tests run actual browser automation in headless mode.
 * They require:
 * - A valid Chrome profile with Google authentication
 * - Network access to notebooklm.google.com
 * - System dependencies: sudo apt-get install libasound2t64
 *
 * Enable with: NBLM_INTEGRATION_TESTS=true npm test
 */

import { chromium, type BrowserContext, type Page } from 'patchright';
import { CONFIG } from '../../src/config.js';
import path from 'path';
import fs from 'fs';

// Account profile directory (from account manager)
const ACCOUNTS_DIR = path.join(CONFIG.dataDir, 'accounts');

// Check if integration tests should run
export const INTEGRATION_ENABLED = process.env.NBLM_INTEGRATION_TESTS === 'true';

// Track if browser dependencies are available
let browserDepsAvailable: boolean | null = null;

/**
 * Check if browser dependencies are installed
 */
export async function checkBrowserDeps(): Promise<boolean> {
  if (browserDepsAvailable !== null) return browserDepsAvailable;

  try {
    const context = await chromium.launch({ headless: true });
    await context.close();
    browserDepsAvailable = true;
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('missing dependencies') || message.includes('libasound')) {
      console.log(
        '⚠️  Browser dependencies not installed. Run: sudo apt-get install libasound2t64'
      );
      browserDepsAvailable = false;
      return false;
    }
    throw error;
  }
}

// Production profile directory (with auth cookies)
// Try account manager profiles first, fall back to legacy chrome_profile
export const PROD_PROFILE_DIR =
  getAccountProfileDir() || path.join(CONFIG.dataDir, 'chrome_profile');

/**
 * Get the profile directory for the first available account
 */
function getAccountProfileDir(): string | null {
  if (!fs.existsSync(ACCOUNTS_DIR)) {
    return null;
  }

  // Look for accounts.json
  const configPath = path.join(CONFIG.dataDir, 'accounts.json');
  if (!fs.existsSync(configPath)) {
    return null;
  }

  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    if (!config.accounts || config.accounts.length === 0) {
      return null;
    }

    // Find first enabled account with valid profile
    for (const account of config.accounts) {
      if (!account.enabled) continue;

      const profileDir = path.join(ACCOUNTS_DIR, account.id, 'profile');
      const stateFile = path.join(ACCOUNTS_DIR, account.id, 'browser_state', 'state.json');

      // Check if profile exists and has state
      if (fs.existsSync(profileDir) && fs.existsSync(stateFile)) {
        return profileDir;
      }
    }
  } catch {
    // Ignore errors, fall back to legacy
  }

  return null;
}

// Test notebook URL (can be overridden)
export const TEST_NOTEBOOK_URL =
  process.env.NBLM_TEST_NOTEBOOK_URL || 'https://notebooklm.google.com/notebook/test-notebook';

// Timeouts for integration tests
export const TIMEOUTS = {
  navigation: 30000,
  element: 10000,
  response: 60000,
  short: 5000,
};

/**
 * Skip helper for integration tests
 */
export function skipIfNoIntegration(): void {
  if (!INTEGRATION_ENABLED) {
    console.log('⏭️  Skipping integration tests (set NBLM_INTEGRATION_TESTS=true to enable)');
  }
}

/**
 * Create a test browser context in headless mode
 */
export async function createTestContext(): Promise<BrowserContext> {
  // Use a test-specific profile directory
  const testProfileDir = path.join(CONFIG.dataDir, 'test-profile');

  // Ensure directory exists
  if (!fs.existsSync(testProfileDir)) {
    fs.mkdirSync(testProfileDir, { recursive: true });
  }

  const context = await chromium.launchPersistentContext(testProfileDir, {
    headless: true,
    viewport: { width: 1024, height: 768 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--no-sandbox',
    ],
  });

  return context;
}

/**
 * Create an authenticated browser context using production profile
 * This reuses existing Google auth cookies for testing authenticated flows
 */
export async function createAuthenticatedContext(): Promise<BrowserContext> {
  if (!fs.existsSync(PROD_PROFILE_DIR)) {
    throw new Error(
      `Production profile not found at ${PROD_PROFILE_DIR}. ` +
        'Run setup-auth first to create an authenticated session.'
    );
  }

  const context = await chromium.launchPersistentContext(PROD_PROFILE_DIR, {
    headless: true,
    viewport: { width: 1024, height: 768 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--no-sandbox',
    ],
  });

  return context;
}

/**
 * Create a test page with common setup
 */
export async function createTestPage(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();

  // Set default timeouts
  page.setDefaultTimeout(TIMEOUTS.element);
  page.setDefaultNavigationTimeout(TIMEOUTS.navigation);

  return page;
}

/**
 * Wait for page to be fully loaded
 */
export async function waitForPageLoad(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
}

/**
 * Check if user is authenticated to Google
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  try {
    // Navigate to NotebookLM
    await page.goto('https://notebooklm.google.com/', {
      waitUntil: 'domcontentloaded',
    });

    // Wait a bit for redirects
    await page.waitForTimeout(2000);

    // Check if we're on a login page
    const url = page.url();
    if (url.includes('accounts.google.com')) {
      return false;
    }

    // Check if NotebookLM loaded
    const isNotebookLM = url.includes('notebooklm.google.com');
    return isNotebookLM;
  } catch {
    return false;
  }
}

/**
 * Clean up test context
 */
export async function cleanupTestContext(context: BrowserContext): Promise<void> {
  try {
    await context.close();
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Wrapper for integration test that handles skip logic
 */
export function integrationTest(
  name: string,
  fn: () => Promise<void>,
  timeout = TIMEOUTS.response
): void {
  if (!INTEGRATION_ENABLED) {
    test.skip(name, () => {});
  } else {
    test(name, fn, timeout);
  }
}

/**
 * Wrapper for integration describe block
 */
export function integrationDescribe(name: string, fn: () => void): void {
  if (!INTEGRATION_ENABLED) {
    describe.skip(name, fn);
  } else {
    describe(name, fn);
  }
}
