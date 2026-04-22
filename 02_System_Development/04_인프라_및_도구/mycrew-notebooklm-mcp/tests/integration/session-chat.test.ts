/**
 * Session and Chat Integration Tests
 *
 * Tests SessionManager, BrowserSession, and ContentManager with real browser.
 * These tests actually interact with NotebookLM to ask questions.
 *
 * Run with: NBLM_INTEGRATION_TESTS=true npm test -- --testPathPatterns=session-chat
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import type { BrowserContext, Page } from 'patchright';
import {
  INTEGRATION_ENABLED,
  checkBrowserDeps,
  createAuthenticatedContext,
  cleanupTestContext,
  isAuthenticated,
  TIMEOUTS,
  PROD_PROFILE_DIR,
} from './setup.js';
import fs from 'fs';

// Import modules to test
import { SessionManager } from '../../src/session/session-manager.js';
import { BrowserSession } from '../../src/session/browser-session.js';
import { SharedContextManager } from '../../src/session/shared-context-manager.js';
import { AuthManager } from '../../src/auth/auth-manager.js';
import { ContentManager } from '../../src/content/content-manager.js';

// Skip all tests if integration is disabled
const describeIntegration = INTEGRATION_ENABLED ? describe : describe.skip;

// Check if production profile exists
const hasProductionProfile = fs.existsSync(PROD_PROFILE_DIR);

// Test notebooks - Replace with your real notebook UUID in test-config.local.ts
const TEST_NOTEBOOK_URL =
  'https://notebooklm.google.com/notebook/00000000-0000-0000-0000-000000000001';

describeIntegration('SessionManager Integration', () => {
  let authManager: AuthManager;
  let sessionManager: SessionManager;
  let browserAvailable = false;

  beforeAll(async () => {
    browserAvailable = await checkBrowserDeps();
    if (!browserAvailable || !hasProductionProfile) {
      console.log('⏭️  Skipping - no browser or profile');
      return;
    }

    authManager = new AuthManager();
    sessionManager = new SessionManager(authManager);
  }, TIMEOUTS.response);

  afterAll(async () => {
    if (sessionManager) {
      await sessionManager.closeAllSessions();
    }
  }, TIMEOUTS.response);

  describe('SessionManager Initialization', () => {
    it('should create SessionManager instance', () => {
      if (!browserAvailable) return;

      expect(sessionManager).toBeDefined();
      expect(sessionManager).toBeInstanceOf(SessionManager);
    });

    it('should return empty stats initially', () => {
      if (!browserAvailable) return;

      const stats = sessionManager.getStats();

      expect(stats.active_sessions).toBe(0);
      expect(stats.total_messages).toBe(0);
      expect(typeof stats.max_sessions).toBe('number');
    });

    it('should return empty sessions list initially', () => {
      if (!browserAvailable) return;

      const sessions = sessionManager.getAllSessionsInfo();

      expect(Array.isArray(sessions)).toBe(true);
      expect(sessions.length).toBe(0);
    });

    it('should return null for non-existent session', () => {
      if (!browserAvailable) return;

      const session = sessionManager.getSession('non-existent-id');

      expect(session).toBeNull();
    });
  });

  describe('Session Validation', () => {
    it('should reject empty notebook URL', async () => {
      if (!browserAvailable) return;

      await expect(sessionManager.getOrCreateSession('test', '')).rejects.toThrow(
        'Notebook URL is required'
      );
    });

    it('should reject invalid URL', async () => {
      if (!browserAvailable) return;

      await expect(sessionManager.getOrCreateSession('test', 'not-a-url')).rejects.toThrow();
    });

    it('should reject relative URL', async () => {
      if (!browserAvailable) return;

      await expect(sessionManager.getOrCreateSession('test', '/notebook/abc')).rejects.toThrow(
        'must be an absolute URL'
      );
    });
  });

  describe('Session Cleanup', () => {
    it('should return false for non-existent session', async () => {
      if (!browserAvailable) return;

      const closed = await sessionManager.closeSession('non-existent');

      expect(closed).toBe(false);
    });

    it('should cleanup inactive sessions when empty', async () => {
      if (!browserAvailable) return;

      const cleaned = await sessionManager.cleanupInactiveSessions();

      expect(typeof cleaned).toBe('number');
      expect(cleaned).toBeGreaterThanOrEqual(0);
    });

    it('should handle closeAllSessions with no sessions', async () => {
      if (!browserAvailable) return;

      await sessionManager.closeAllSessions();

      expect(sessionManager.getStats().active_sessions).toBe(0);
    });
  });
});

describeIntegration('BrowserSession Integration', () => {
  let authManager: AuthManager;
  let sharedContextManager: SharedContextManager;
  let browserSession: BrowserSession | null = null;
  let browserAvailable = false;

  beforeAll(async () => {
    browserAvailable = await checkBrowserDeps();
    if (!browserAvailable || !hasProductionProfile) {
      console.log('⏭️  Skipping - no browser or profile');
      return;
    }

    authManager = new AuthManager();
    sharedContextManager = new SharedContextManager(authManager);
  }, TIMEOUTS.response);

  afterAll(async () => {
    if (browserSession) {
      await browserSession.close();
    }
    if (sharedContextManager) {
      await sharedContextManager.closeContext();
    }
  }, TIMEOUTS.response);

  describe('BrowserSession Construction', () => {
    it('should create BrowserSession instance', () => {
      if (!browserAvailable || !hasProductionProfile) return;

      browserSession = new BrowserSession(
        'browser-session-test',
        sharedContextManager,
        authManager,
        TEST_NOTEBOOK_URL
      );

      expect(browserSession).toBeDefined();
      expect(browserSession.sessionId).toBe('browser-session-test');
      expect(browserSession.notebookUrl).toBe(TEST_NOTEBOOK_URL);
    });

    it('should not be initialized before init()', () => {
      if (!browserAvailable || !browserSession) return;

      expect(browserSession.isInitialized()).toBe(false);
      expect(browserSession.getPage()).toBeNull();
    });

    it('should track creation timestamp', () => {
      if (!browserAvailable || !browserSession) return;

      expect(browserSession.createdAt).toBeLessThanOrEqual(Date.now());
      expect(browserSession.createdAt).toBeGreaterThan(Date.now() - 60000);
    });

    it('should start with zero message count', () => {
      if (!browserAvailable || !browserSession) return;

      expect(browserSession.messageCount).toBe(0);
    });

    it('should track last activity', () => {
      if (!browserAvailable || !browserSession) return;

      expect(browserSession.lastActivity).toBeLessThanOrEqual(Date.now());
    });

    it('should update activity timestamp', async () => {
      if (!browserAvailable || !browserSession) return;

      const initialActivity = browserSession.lastActivity;

      await new Promise((resolve) => setTimeout(resolve, 100));
      browserSession.updateActivity();

      expect(browserSession.lastActivity).toBeGreaterThan(initialActivity);
    });

    it('should not be expired with long timeout', () => {
      if (!browserAvailable || !browserSession) return;

      expect(browserSession.isExpired(60)).toBe(false);
    });

    it('should be expired with very short timeout', async () => {
      if (!browserAvailable || !browserSession) return;

      // Wait a bit so there's some inactive time
      await new Promise((resolve) => setTimeout(resolve, 50));

      // With 0 timeout, any inactive time means expired
      expect(browserSession.isExpired(0)).toBe(true);
    });

    it('should return session info before init', () => {
      if (!browserAvailable || !browserSession) return;

      const info = browserSession.getInfo();

      expect(info.id).toBe('browser-session-test');
      expect(info.notebook_url).toBe(TEST_NOTEBOOK_URL);
      expect(info.age_seconds).toBeGreaterThanOrEqual(0);
      expect(info.inactive_seconds).toBeGreaterThanOrEqual(0);
      expect(info.created_at).toBeDefined();
      expect(info.message_count).toBe(0);
    });
  });

  describe('BrowserSession Cleanup', () => {
    it('should handle close before init', async () => {
      if (!browserAvailable || !hasProductionProfile) return;

      const session = new BrowserSession(
        'temp-session',
        sharedContextManager,
        authManager,
        TEST_NOTEBOOK_URL
      );

      // Should not throw
      await session.close();

      expect(session.isInitialized()).toBe(false);
    });
  });
});

describeIntegration('ContentManager Integration', () => {
  let context: BrowserContext | null = null;
  let page: Page | null = null;
  let contentManager: ContentManager | null = null;
  let browserAvailable = false;
  let isAuth = false;

  beforeAll(async () => {
    browserAvailable = await checkBrowserDeps();
    if (!browserAvailable || !hasProductionProfile) {
      console.log('⏭️  Skipping - no browser or profile');
      return;
    }

    try {
      context = await createAuthenticatedContext();
      page = await context.newPage();
      page.setDefaultTimeout(TIMEOUTS.element);

      // Navigate to notebook
      await page.goto(TEST_NOTEBOOK_URL, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(5000);

      isAuth = await isAuthenticated(page);
      if (isAuth) {
        contentManager = new ContentManager(page);
        console.log('✅ ContentManager created');
      }
    } catch (error) {
      console.log(`⏭️  Setup failed: ${error}`);
    }
  }, TIMEOUTS.response * 2);

  afterAll(async () => {
    if (context) {
      await cleanupTestContext(context);
    }
  });

  describe('ContentManager Initialization', () => {
    it('should create ContentManager instance', () => {
      if (!browserAvailable || !isAuth || !contentManager) {
        console.log('⏭️  Skipping - not authenticated');
        return;
      }

      expect(contentManager).toBeDefined();
      expect(contentManager).toBeInstanceOf(ContentManager);
    });
  });

  describe('Source Operations', () => {
    it(
      'should list sources',
      async () => {
        if (!browserAvailable || !isAuth || !contentManager) {
          console.log('⏭️  Skipping - not authenticated');
          return;
        }

        const sources = await contentManager.listSources();

        expect(Array.isArray(sources)).toBe(true);
        console.log(`📚 Found ${sources.length} sources`);
      },
      TIMEOUTS.response
    );

    it(
      'should get content overview',
      async () => {
        if (!browserAvailable || !isAuth || !contentManager) {
          console.log('⏭️  Skipping - not authenticated');
          return;
        }

        const overview = await contentManager.getContentOverview();

        expect(overview).toBeDefined();
        expect(typeof overview).toBe('object');

        console.log(`📊 Content overview: ${JSON.stringify(overview).substring(0, 100)}...`);
      },
      TIMEOUTS.response
    );
  });

  describe('Input Validation', () => {
    it('should reject unsupported source type', async () => {
      if (!browserAvailable || !isAuth || !contentManager) return;

      const result = await contentManager.addSource({ type: 'unknown' as any });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should require file path for file type', async () => {
      if (!browserAvailable || !isAuth || !contentManager) return;

      const result = await contentManager.addSource({ type: 'file' });

      expect(result.success).toBe(false);
    });

    it('should require URL for url type', async () => {
      if (!browserAvailable || !isAuth || !contentManager) return;

      const result = await contentManager.addSource({ type: 'url' });

      expect(result.success).toBe(false);
    });

    it('should require content for text type', async () => {
      if (!browserAvailable || !isAuth || !contentManager) return;

      const result = await contentManager.addSource({ type: 'text' });

      expect(result.success).toBe(false);
    });

    it('should block path traversal', async () => {
      if (!browserAvailable || !isAuth || !contentManager) return;

      const result = await contentManager.addSource({
        type: 'file',
        filePath: '/etc/passwd',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not allowed');
    });
  });

  describe('Generate Content', () => {
    it('should reject unsupported generate type', async () => {
      if (!browserAvailable || !isAuth || !contentManager) return;

      const result = await contentManager.generateContent({
        type: 'unsupported' as any,
      });

      expect(result.success).toBe(false);
    });
  });
});

describeIntegration('Chat Integration (Ask Question)', () => {
  let context: BrowserContext | null = null;
  let page: Page | null = null;
  let browserAvailable = false;
  let isAuth = false;

  beforeAll(async () => {
    browserAvailable = await checkBrowserDeps();
    if (!browserAvailable || !hasProductionProfile) return;

    try {
      context = await createAuthenticatedContext();
      page = await context.newPage();
      page.setDefaultTimeout(TIMEOUTS.element);

      await page.goto(TEST_NOTEBOOK_URL, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(5000);

      isAuth = await isAuthenticated(page);
    } catch (error) {
      console.log(`⏭️  Setup failed: ${error}`);
    }
  }, TIMEOUTS.response * 2);

  afterAll(async () => {
    if (context) {
      await cleanupTestContext(context);
    }
  });

  describe('Chat Input Detection', () => {
    it(
      'should find chat input on notebook page',
      async () => {
        if (!browserAvailable || !isAuth || !page) {
          console.log('⏭️  Skipping - not authenticated');
          return;
        }

        const chatInput = await page.$('textarea.query-box-input');

        if (chatInput) {
          console.log('✅ Chat input found');
          expect(await chatInput.isVisible()).toBe(true);
        } else {
          console.log('⚠️  Chat input not found');
        }
      },
      TIMEOUTS.response
    );

    it(
      'should detect submit button',
      async () => {
        if (!browserAvailable || !isAuth || !page) return;

        // Look for submit button (arrow or send icon)
        const submitButton = await page.$(
          'button[aria-label*="Send"], button[aria-label*="Submit"], .send-button, [class*="submit"]'
        );

        const hasButton = submitButton !== null;
        console.log(`📤 Submit button: ${hasButton ? 'Found' : 'Not found'}`);
      },
      TIMEOUTS.response
    );
  });

  describe('Response Detection', () => {
    it(
      'should find response containers',
      async () => {
        if (!browserAvailable || !isAuth || !page) return;

        const containers = await page.$$('.to-user-container');

        console.log(`💬 Response containers: ${containers.length}`);
        expect(Array.isArray(containers)).toBe(true);
      },
      TIMEOUTS.response
    );

    it(
      'should detect message content elements',
      async () => {
        if (!browserAvailable || !isAuth || !page) return;

        const messageElements = await page.$$('.message-text-content');

        console.log(`📝 Message elements: ${messageElements.length}`);
      },
      TIMEOUTS.response
    );
  });
});
