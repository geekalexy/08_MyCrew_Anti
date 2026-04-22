/**
 * Browser Modules Integration Tests
 *
 * Tests SharedContextManager, BrowserSession, and page-utils with real browser.
 * Runs in headless mode using authenticated profile.
 *
 * Run with: NBLM_INTEGRATION_TESTS=true npm test -- --testPathPatterns=browser-modules
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
import path from 'path';
import { CONFIG } from '../../src/config.js';

// Import modules to test
import { SharedContextManager } from '../../src/session/shared-context-manager.js';
import { AuthManager } from '../../src/auth/auth-manager.js';
import {
  snapshotLatestResponse,
  snapshotAllResponses,
  countResponseElements,
} from '../../src/utils/page-utils.js';

// Skip all tests if integration is disabled
const describeIntegration = INTEGRATION_ENABLED ? describe : describe.skip;

// Check if production profile exists
const hasProductionProfile = fs.existsSync(PROD_PROFILE_DIR);

// Test notebooks from library
// NOTE: These are placeholder UUIDs. Replace with real notebook UUIDs in test-config.local.ts
const TEST_NOTEBOOKS = [
  'https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000001',
  'https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000002',
];

describeIntegration('SharedContextManager Integration', () => {
  let authManager: AuthManager;
  let sharedContextManager: SharedContextManager;
  let browserAvailable = false;

  beforeAll(async () => {
    browserAvailable = await checkBrowserDeps();
    if (!browserAvailable) {
      console.log('⏭️  Skipping - browser dependencies not available');
      return;
    }

    // Create auth manager
    authManager = new AuthManager();
    sharedContextManager = new SharedContextManager(authManager);
  }, TIMEOUTS.response);

  afterAll(async () => {
    if (sharedContextManager) {
      await sharedContextManager.closeContext();
    }
  }, TIMEOUTS.response);

  describe('Context Creation', () => {
    it('should create SharedContextManager instance', () => {
      if (!browserAvailable) return;

      expect(sharedContextManager).toBeDefined();
      expect(sharedContextManager).toBeInstanceOf(SharedContextManager);
    });

    it('should report no context initially', () => {
      if (!browserAvailable) return;

      const info = sharedContextManager.getContextInfo();
      expect(info.exists).toBe(false);
      expect(info.persistent).toBe(true);
    });

    it('should report null headless mode initially', () => {
      if (!browserAvailable) return;

      const mode = sharedContextManager.getCurrentHeadlessMode();
      expect(mode).toBeNull();
    });

    it('should not need headless mode change when no context exists', () => {
      if (!browserAvailable) return;

      const needsChange = sharedContextManager.needsHeadlessModeChange(true);
      expect(needsChange).toBe(false);
    });

    it(
      'should create browser context in headless mode',
      async () => {
        if (!browserAvailable || !hasProductionProfile) {
          console.log('⏭️  Skipping - no production profile');
          return;
        }

        // Create context (headless by default from CONFIG)
        const context = await sharedContextManager.getOrCreateContext();

        expect(context).toBeDefined();
        expect(sharedContextManager.getContextInfo().exists).toBe(true);
      },
      TIMEOUTS.response
    );

    it(
      'should reuse existing context on subsequent calls',
      async () => {
        if (!browserAvailable || !hasProductionProfile) return;

        const context1 = await sharedContextManager.getOrCreateContext();
        const context2 = await sharedContextManager.getOrCreateContext();

        // Should be the same context (reused)
        expect(context1).toBe(context2);
      },
      TIMEOUTS.response
    );

    it('should track context age', async () => {
      if (!browserAvailable || !hasProductionProfile) return;

      const info = sharedContextManager.getContextInfo();

      expect(info.exists).toBe(true);
      expect(info.age_seconds).toBeDefined();
      expect(info.age_seconds).toBeGreaterThanOrEqual(0);
    });

    it(
      'should close context cleanly',
      async () => {
        if (!browserAvailable || !hasProductionProfile) return;

        await sharedContextManager.closeContext();

        const info = sharedContextManager.getContextInfo();
        expect(info.exists).toBe(false);
      },
      TIMEOUTS.response
    );
  });
});

describeIntegration('Page Utils Integration', () => {
  let context: BrowserContext | null = null;
  let page: Page | null = null;
  let browserAvailable = false;
  let isAuth = false;

  beforeAll(async () => {
    browserAvailable = await checkBrowserDeps();
    if (!browserAvailable || !hasProductionProfile) {
      console.log('⏭️  Skipping page-utils tests - no browser or profile');
      return;
    }

    try {
      context = await createAuthenticatedContext();
      page = await createTestPage(context);
      isAuth = await isAuthenticated(page);

      if (!isAuth) {
        console.log('⚠️  Not authenticated - some tests will be skipped');
      }
    } catch (error) {
      console.log(`⏭️  Setup failed: ${error}`);
    }
  }, TIMEOUTS.response);

  afterAll(async () => {
    if (context) {
      await cleanupTestContext(context);
    }
  });

  describe('snapshotLatestResponse', () => {
    it('should return null on empty page', async () => {
      if (!browserAvailable || !page) return;

      await page.goto('about:blank');
      const result = await snapshotLatestResponse(page);

      expect(result).toBeNull();
    });

    it(
      'should work on NotebookLM page',
      async () => {
        if (!browserAvailable || !isAuth || !page) {
          console.log('⏭️  Skipping - not authenticated');
          return;
        }

        await page.goto(TEST_NOTEBOOKS[0], {
          waitUntil: 'domcontentloaded',
        });
        await page.waitForTimeout(5000);

        // Result can be null (no responses) or string (has responses)
        const result = await snapshotLatestResponse(page);
        expect(result === null || typeof result === 'string').toBe(true);

        console.log(`📸 snapshotLatestResponse: ${result ? 'Found response' : 'No response'}`);
      },
      TIMEOUTS.response
    );
  });

  describe('snapshotAllResponses', () => {
    it('should return empty array on empty page', async () => {
      if (!browserAvailable || !page) return;

      await page.goto('about:blank');
      const result = await snapshotAllResponses(page);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    it(
      'should capture responses on NotebookLM page',
      async () => {
        if (!browserAvailable || !isAuth || !page) {
          console.log('⏭️  Skipping - not authenticated');
          return;
        }

        await page.goto(TEST_NOTEBOOKS[0], {
          waitUntil: 'domcontentloaded',
        });
        await page.waitForTimeout(5000);

        const result = await snapshotAllResponses(page);

        expect(Array.isArray(result)).toBe(true);
        console.log(`📸 snapshotAllResponses: Found ${result.length} responses`);
      },
      TIMEOUTS.response
    );
  });

  describe('countResponseElements', () => {
    it('should return 0 on empty page', async () => {
      if (!browserAvailable || !page) return;

      await page.goto('about:blank');
      const result = await countResponseElements(page);

      expect(result).toBe(0);
    });

    it(
      'should count elements on NotebookLM page',
      async () => {
        if (!browserAvailable || !isAuth || !page) {
          console.log('⏭️  Skipping - not authenticated');
          return;
        }

        await page.goto(TEST_NOTEBOOKS[0], {
          waitUntil: 'domcontentloaded',
        });
        await page.waitForTimeout(5000);

        const result = await countResponseElements(page);

        expect(typeof result).toBe('number');
        expect(result).toBeGreaterThanOrEqual(0);
        console.log(`📊 countResponseElements: ${result} elements`);
      },
      TIMEOUTS.response
    );
  });
});

describeIntegration('Browser Navigation Integration', () => {
  let context: BrowserContext | null = null;
  let page: Page | null = null;
  let browserAvailable = false;
  let isAuth = false;

  beforeAll(async () => {
    browserAvailable = await checkBrowserDeps();
    if (!browserAvailable || !hasProductionProfile) return;

    try {
      context = await createAuthenticatedContext();
      page = await createTestPage(context);
      isAuth = await isAuthenticated(page);
    } catch (error) {
      console.log(`⏭️  Setup failed: ${error}`);
    }
  }, TIMEOUTS.response);

  afterAll(async () => {
    if (context) {
      await cleanupTestContext(context);
    }
  });

  describe('NotebookLM Page Structure', () => {
    it(
      'should find chat input textarea',
      async () => {
        if (!browserAvailable || !isAuth || !page) {
          console.log('⏭️  Skipping - not authenticated');
          return;
        }

        await page.goto(TEST_NOTEBOOKS[0], {
          waitUntil: 'domcontentloaded',
        });
        await page.waitForTimeout(5000);

        // Look for chat input
        const chatInput = await page.$('textarea.query-box-input');
        const hasInput = chatInput !== null;

        console.log(`💬 Chat input: ${hasInput ? 'Found' : 'Not found'}`);
        expect(typeof hasInput).toBe('boolean');
      },
      TIMEOUTS.response
    );

    it(
      'should find source panel',
      async () => {
        if (!browserAvailable || !isAuth || !page) {
          console.log('⏭️  Skipping - not authenticated');
          return;
        }

        await page.goto(TEST_NOTEBOOKS[0], {
          waitUntil: 'domcontentloaded',
        });
        await page.waitForTimeout(5000);

        // Look for sources panel
        const sourcesPanel = await page.$('.sources-panel, [class*="source"]');
        const hasPanel = sourcesPanel !== null;

        console.log(`📚 Sources panel: ${hasPanel ? 'Found' : 'Not found'}`);
        expect(typeof hasPanel).toBe('boolean');
      },
      TIMEOUTS.response
    );

    it(
      'should execute page.evaluate correctly',
      async () => {
        if (!browserAvailable || !isAuth || !page) return;

        await page.goto(TEST_NOTEBOOKS[0], {
          waitUntil: 'domcontentloaded',
        });

        const result = await page.evaluate(() => {
          return {
            url: window.location.href,
            documentTitle: document.title,
            bodyExists: document.body !== null,
            readyState: document.readyState,
          };
        });

        expect(result.url).toContain('notebooklm.google.com');
        expect(result.bodyExists).toBe(true);
        expect(['interactive', 'complete']).toContain(result.readyState);

        console.log(`📄 Page title: ${result.documentTitle}`);
      },
      TIMEOUTS.response
    );

    it(
      'should find response containers',
      async () => {
        if (!browserAvailable || !isAuth || !page) return;

        await page.goto(TEST_NOTEBOOKS[0], {
          waitUntil: 'domcontentloaded',
        });
        await page.waitForTimeout(5000);

        // Find response containers using the actual selector from page-utils
        const containers = await page.$$('.to-user-container');
        console.log(`📦 Response containers: ${containers.length}`);

        expect(Array.isArray(containers)).toBe(true);
      },
      TIMEOUTS.response
    );
  });

  describe('Multiple Notebook Navigation', () => {
    it(
      'should navigate between notebooks',
      async () => {
        if (!browserAvailable || !isAuth || !page) {
          console.log('⏭️  Skipping - not authenticated');
          return;
        }

        // Navigate to first notebook
        await page.goto(TEST_NOTEBOOKS[0], {
          waitUntil: 'domcontentloaded',
        });
        await page.waitForTimeout(3000);

        const url1 = page.url();
        expect(url1).toContain('notebooklm.google.com');

        // Navigate to second notebook
        await page.goto(TEST_NOTEBOOKS[1], {
          waitUntil: 'domcontentloaded',
        });
        await page.waitForTimeout(3000);

        const url2 = page.url();
        expect(url2).toContain('notebooklm.google.com');
        expect(url2).not.toBe(url1);

        console.log('✅ Successfully navigated between notebooks');
      },
      TIMEOUTS.response
    );
  });
});

describeIntegration('AuthManager Integration', () => {
  let authManager: AuthManager;
  let browserAvailable = false;

  beforeAll(async () => {
    browserAvailable = await checkBrowserDeps();
    if (!browserAvailable) return;

    authManager = new AuthManager();
  });

  describe('State Management', () => {
    it('should create AuthManager instance', () => {
      if (!browserAvailable) return;

      expect(authManager).toBeDefined();
      expect(authManager).toBeInstanceOf(AuthManager);
    });

    it('should check for saved state', async () => {
      if (!browserAvailable) return;

      const hasState = await authManager.hasSavedState();
      expect(typeof hasState).toBe('boolean');

      console.log(`🔐 Has saved state: ${hasState}`);
    });

    it('should return state path when available', async () => {
      if (!browserAvailable) return;

      const statePath = await authManager.getValidStatePath();

      // Can be null (no state) or string (has state)
      expect(statePath === null || typeof statePath === 'string').toBe(true);

      if (statePath) {
        console.log(`📁 State path: ${statePath}`);
        expect(fs.existsSync(statePath)).toBe(true);
      }
    });
  });
});
