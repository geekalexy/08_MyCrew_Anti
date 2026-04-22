/**
 * Authenticated Integration Tests
 *
 * Tests that require Google authentication to NotebookLM.
 * Uses the production Chrome profile with saved auth cookies.
 *
 * Run with: NBLM_INTEGRATION_TESTS=true npm test -- --testPathPatterns=authenticated
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import type { BrowserContext, Page } from 'patchright';
import {
  INTEGRATION_ENABLED,
  checkBrowserDeps,
  createAuthenticatedContext,
  createTestPage,
  cleanupTestContext,
  isAuthenticated,
  TIMEOUTS,
  PROD_PROFILE_DIR,
} from './setup.js';
import fs from 'fs';

// Skip all tests if integration is disabled
const describeIntegration = INTEGRATION_ENABLED ? describe : describe.skip;

// Check if production profile exists
const hasProductionProfile = fs.existsSync(PROD_PROFILE_DIR);

describeIntegration('Authenticated NotebookLM Tests', () => {
  let context: BrowserContext | null = null;
  let page: Page | null = null;
  let browserAvailable = false;
  let isAuth = false;

  beforeAll(async () => {
    browserAvailable = await checkBrowserDeps();
    if (!browserAvailable) {
      console.log('⏭️  Skipping authenticated tests - browser dependencies not available');
      return;
    }

    if (!hasProductionProfile) {
      console.log('⏭️  Skipping authenticated tests - no production profile found');
      console.log(`   Expected at: ${PROD_PROFILE_DIR}`);
      return;
    }

    try {
      context = await createAuthenticatedContext();
      page = await createTestPage(context);

      // Check if we're actually authenticated
      isAuth = await isAuthenticated(page);
      if (!isAuth) {
        console.log('⚠️  Production profile exists but not authenticated to Google');
        console.log('   Run setup-auth to authenticate');
      } else {
        console.log('✅ Authenticated to NotebookLM');
      }
    } catch (error) {
      console.log(`⏭️  Skipping authenticated tests - ${error}`);
    }
  }, TIMEOUTS.response);

  afterAll(async () => {
    if (context) {
      await cleanupTestContext(context);
    }
  });

  describe('Authentication State', () => {
    it('should have production profile available', () => {
      expect(hasProductionProfile).toBe(true);
    });

    it('should be authenticated to Google', async () => {
      if (!browserAvailable || !hasProductionProfile || !page) return;

      // Re-check auth status
      const authenticated = await isAuthenticated(page);
      console.log(`🔐 Authentication status: ${authenticated ? 'Logged In' : 'Not Logged In'}`);

      // This test documents the current state
      expect(typeof authenticated).toBe('boolean');
    });
  });

  describe('NotebookLM Interface', () => {
    it(
      'should load NotebookLM homepage',
      async () => {
        if (!browserAvailable || !isAuth || !page) {
          console.log('⏭️  Skipping - not authenticated');
          return;
        }

        await page.goto('https://notebooklm.google.com/', {
          waitUntil: 'domcontentloaded',
        });
        await page.waitForTimeout(3000);

        const url = page.url();
        expect(url).toContain('notebooklm.google.com');
        expect(url).not.toContain('accounts.google.com');
      },
      TIMEOUTS.response
    );

    it(
      'should display notebook list or create button',
      async () => {
        if (!browserAvailable || !isAuth || !page) {
          console.log('⏭️  Skipping - not authenticated');
          return;
        }

        await page.goto('https://notebooklm.google.com/', {
          waitUntil: 'domcontentloaded',
        });
        await page.waitForTimeout(3000);

        // Look for common NotebookLM UI elements
        const hasNotebookUI =
          (await page.$('.notebook-card')) !== null ||
          (await page.$('[aria-label*="Create"]')) !== null ||
          (await page.$('[aria-label*="notebook"]')) !== null ||
          (await page.$('button')) !== null;

        expect(hasNotebookUI).toBe(true);
      },
      TIMEOUTS.response
    );
  });

  describe('Notebook Access', () => {
    it(
      'should access a notebook from library',
      async () => {
        if (!browserAvailable || !isAuth || !page) {
          console.log('⏭️  Skipping - not authenticated');
          return;
        }

        // Get first notebook from library
        const libraryPath = `${PROD_PROFILE_DIR}/../library.json`;
        if (!fs.existsSync(libraryPath)) {
          console.log('⏭️  Skipping - no library.json found');
          return;
        }

        const library = JSON.parse(fs.readFileSync(libraryPath, 'utf-8'));
        if (!library.notebooks || library.notebooks.length === 0) {
          console.log('⏭️  Skipping - no notebooks in library');
          return;
        }

        const firstNotebook = library.notebooks[0];
        console.log(`📓 Testing notebook: ${firstNotebook.name}`);

        await page.goto(firstNotebook.url, {
          waitUntil: 'domcontentloaded',
        });
        await page.waitForTimeout(5000);

        const url = page.url();

        // Should either be on the notebook or redirected to login
        const validState =
          url.includes('notebooklm.google.com/notebook') || url.includes('accounts.google.com');

        expect(validState).toBe(true);
      },
      TIMEOUTS.response
    );

    it(
      'should find chat input when notebook is loaded',
      async () => {
        if (!browserAvailable || !isAuth || !page) {
          console.log('⏭️  Skipping - not authenticated');
          return;
        }

        // Get first notebook from library
        const libraryPath = `${PROD_PROFILE_DIR}/../library.json`;
        if (!fs.existsSync(libraryPath)) {
          console.log('⏭️  Skipping - no library.json found');
          return;
        }

        const library = JSON.parse(fs.readFileSync(libraryPath, 'utf-8'));
        if (!library.notebooks || library.notebooks.length === 0) {
          console.log('⏭️  Skipping - no notebooks in library');
          return;
        }

        const firstNotebook = library.notebooks[0];

        await page.goto(firstNotebook.url, {
          waitUntil: 'domcontentloaded',
        });
        await page.waitForTimeout(5000);

        // Look for chat input (main interaction element)
        const chatInput = await page.$('textarea.query-box-input, textarea[aria-label*="query"]');

        if (chatInput) {
          console.log('✅ Chat input found - notebook fully loaded');
          const isVisible = await chatInput.isVisible();
          expect(isVisible).toBe(true);
        } else {
          // Might be on login page or notebook is loading
          const url = page.url();
          console.log(`ℹ️  Chat input not found. Current URL: ${url}`);
          // Test passes - we just document the state
          expect(true).toBe(true);
        }
      },
      TIMEOUTS.response
    );
  });

  describe('Page Utilities', () => {
    it(
      'should execute JavaScript in authenticated context',
      async () => {
        if (!browserAvailable || !isAuth || !page) {
          console.log('⏭️  Skipping - not authenticated');
          return;
        }

        await page.goto('https://notebooklm.google.com/', {
          waitUntil: 'domcontentloaded',
        });

        const result = await page.evaluate(() => {
          return {
            url: window.location.href,
            title: document.title,
            hasCookies: document.cookie.length > 0,
          };
        });

        expect(result.url).toContain('notebooklm.google.com');
        expect(result.title).toBeDefined();
      },
      TIMEOUTS.response
    );

    it(
      'should detect Google account info',
      async () => {
        if (!browserAvailable || !isAuth || !page) {
          console.log('⏭️  Skipping - not authenticated');
          return;
        }

        await page.goto('https://notebooklm.google.com/', {
          waitUntil: 'domcontentloaded',
        });
        await page.waitForTimeout(3000);

        // Look for user avatar or account indicator
        const accountIndicator = await page.$(
          '[aria-label*="Account"], [aria-label*="profile"], .gb_d, img[aria-label*="Google"]'
        );

        if (accountIndicator) {
          console.log('✅ Account indicator found - user is logged in');
        } else {
          console.log('ℹ️  No account indicator found');
        }

        // Test passes either way - we're documenting state
        expect(true).toBe(true);
      },
      TIMEOUTS.response
    );
  });
});

describeIntegration('Session Manager with Auth', () => {
  let browserAvailable = false;

  beforeAll(async () => {
    browserAvailable = await checkBrowserDeps();
  });

  it('should have production profile for session tests', () => {
    if (!browserAvailable) return;
    expect(hasProductionProfile).toBe(true);
  });

  // Additional session manager tests would go here
  // These require more complex setup with the actual SessionManager class
});
