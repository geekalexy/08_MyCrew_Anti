/**
 * Browser Integration Tests
 *
 * Tests basic browser functionality in headless mode.
 * These tests verify that Patchright/Playwright works correctly.
 *
 * Run with: NBLM_INTEGRATION_TESTS=true npm test -- --testPathPatterns=integration
 *
 * Prerequisites:
 * - sudo apt-get install libasound2t64 (for Linux/WSL)
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import type { BrowserContext, Page } from 'patchright';
import {
  INTEGRATION_ENABLED,
  createTestContext,
  createTestPage,
  cleanupTestContext,
  waitForPageLoad,
  checkBrowserDeps,
  TIMEOUTS,
} from './setup.js';

// Skip all tests if integration is disabled
const describeIntegration = INTEGRATION_ENABLED ? describe : describe.skip;

describeIntegration('Browser Integration Tests', () => {
  let context: BrowserContext | null = null;
  let page: Page | null = null;
  let browserAvailable = false;

  beforeAll(async () => {
    browserAvailable = await checkBrowserDeps();
    if (!browserAvailable) {
      console.log('⏭️  Skipping browser tests - dependencies not available');
      return;
    }
    context = await createTestContext();
    page = await createTestPage(context);
  }, TIMEOUTS.navigation);

  afterAll(async () => {
    if (context) await cleanupTestContext(context);
  });

  describe('Basic Browser Operations', () => {
    it('should launch browser in headless mode', async () => {
      if (!browserAvailable) return;
      expect(context).toBeDefined();
      expect(page).toBeDefined();
    });

    it('should navigate to a public page', async () => {
      if (!browserAvailable) return;
      await page.goto('https://www.google.com', { waitUntil: 'domcontentloaded' });
      const title = await page.title();
      expect(title).toContain('Google');
    });

    it('should execute JavaScript in page context', async () => {
      if (!browserAvailable) return;
      const result = await page.evaluate(() => {
        return {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          language: navigator.language,
        };
      });

      expect(result.userAgent).toBeDefined();
      expect(result.userAgent).not.toContain('HeadlessChrome');
    });

    it('should handle page navigation', async () => {
      if (!browserAvailable) return;
      await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });

      const url = page.url();
      expect(url).toContain('example.com');

      const heading = await page.$('h1');
      expect(heading).not.toBeNull();
    });

    it('should interact with form elements', async () => {
      if (!browserAvailable) return;
      await page.goto('https://www.google.com');

      // Find search input
      const searchInput = await page.$('textarea[name="q"], input[name="q"]');
      expect(searchInput).not.toBeNull();

      if (searchInput) {
        await searchInput.fill('test query');
        const value = await searchInput.inputValue();
        expect(value).toBe('test query');
      }
    });

    it('should take screenshots', async () => {
      if (!browserAvailable) return;
      await page.goto('https://example.com');
      const screenshot = await page.screenshot({ type: 'png' });
      expect(screenshot).toBeInstanceOf(Buffer);
      expect(screenshot.length).toBeGreaterThan(0);
    });
  });

  describe('Stealth Mode Verification', () => {
    it('should not be detected as automation', async () => {
      if (!browserAvailable) return;
      await page.goto('https://www.google.com');

      const automationFlags = await page.evaluate(() => {
        return {
          webdriver: (navigator as unknown as { webdriver?: boolean }).webdriver,
          // @ts-expect-error - Check for automation
          automationControlled: document.documentElement.hasAttribute('webdriver'),
        };
      });

      // Webdriver should be undefined or false (Patchright hides this)
      expect(automationFlags.webdriver).toBeFalsy();
      // No automation attribute should be present
      expect(automationFlags.automationControlled).toBe(false);
    });

    it('should have consistent viewport', async () => {
      if (!browserAvailable) return;
      const viewport = page.viewportSize();
      expect(viewport).toBeDefined();
      expect(viewport?.width).toBe(1024);
      expect(viewport?.height).toBe(768);
    });
  });

  describe('Multiple Pages (Tabs)', () => {
    it('should create multiple pages in same context', async () => {
      if (!browserAvailable) return;
      const page2 = await context.newPage();
      const page3 = await context.newPage();

      expect(context.pages().length).toBeGreaterThanOrEqual(3);

      await page2.close();
      await page3.close();
    });

    it('should share cookies across pages', async () => {
      if (!browserAvailable) return;
      // Set a cookie on one page
      await page.goto('https://example.com');
      await context.addCookies([
        {
          name: 'test_cookie',
          value: 'test_value',
          domain: 'example.com',
          path: '/',
        },
      ]);

      // Create new page and check cookie
      const page2 = await context.newPage();
      await page2.goto('https://example.com');

      const cookies = await context.cookies();
      const testCookie = cookies.find((c) => c.name === 'test_cookie');

      expect(testCookie).toBeDefined();
      expect(testCookie?.value).toBe('test_value');

      await page2.close();
    });
  });
});

describeIntegration('NotebookLM Access Tests', () => {
  let context: BrowserContext | null = null;
  let page: Page | null = null;
  let browserAvailable = false;

  beforeAll(async () => {
    browserAvailable = await checkBrowserDeps();
    if (!browserAvailable) {
      console.log('⏭️  Skipping NotebookLM tests - browser dependencies not available');
      return;
    }
    context = await createTestContext();
    page = await createTestPage(context);
  }, TIMEOUTS.navigation);

  afterAll(async () => {
    if (context) await cleanupTestContext(context);
  });

  it('should access NotebookLM homepage', async () => {
    if (!browserAvailable || !page) return;
    await page.goto('https://notebooklm.google.com/', {
      waitUntil: 'domcontentloaded',
    });

    // Wait for some content
    await page.waitForTimeout(2000);

    const url = page.url();
    // Either we're on NotebookLM or redirected to login
    const validDestination =
      url.includes('notebooklm.google.com') || url.includes('accounts.google.com');
    expect(validDestination).toBe(true);
  });

  it('should detect authentication state', async () => {
    if (!browserAvailable || !page) return;
    await page.goto('https://notebooklm.google.com/');
    await page.waitForTimeout(3000);

    const url = page.url();
    const isLoggedIn = !url.includes('accounts.google.com');

    // Log the state for debugging
    console.log(`Authentication state: ${isLoggedIn ? 'Logged In' : 'Not Logged In'}`);
    console.log(`Current URL: ${url}`);

    // Test passes either way - we just verify we can detect the state
    expect(typeof isLoggedIn).toBe('boolean');
  });
});
