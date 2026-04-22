/**
 * Session Integration Tests
 *
 * Tests for BrowserSession and SessionManager with actual browser context.
 * These tests verify session lifecycle, cleanup, and basic operations.
 *
 * Run with: NBLM_INTEGRATION_TESTS=true npm test -- --testPathPatterns=integration
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { chromium, type BrowserContext } from 'patchright';
import { BrowserSession } from '../../src/session/browser-session.js';
import { SessionManager } from '../../src/session/session-manager.js';
import { AuthManager } from '../../src/auth/auth-manager.js';
import { SharedContextManager } from '../../src/session/shared-context-manager.js';
import { CONFIG } from '../../src/config.js';
import { INTEGRATION_ENABLED, checkBrowserDeps, TIMEOUTS } from './setup.js';

// Use temp profile for tests to avoid conflicts with production
const TEST_PROFILE_DIR = `${CONFIG.dataDir}/test-session-profile`;

// Skip all tests if integration is disabled
const describeIntegration = INTEGRATION_ENABLED ? describe : describe.skip;

describeIntegration('BrowserSession Unit Tests', () => {
  // These tests don't require a browser - they test pure methods
  let mockSharedContextManager: SharedContextManager;
  let mockAuthManager: AuthManager;

  beforeAll(() => {
    mockAuthManager = new AuthManager();
    mockSharedContextManager = new SharedContextManager(mockAuthManager);
  });

  afterAll(async () => {
    await mockSharedContextManager.closeContext();
  });

  describe('Session Properties', () => {
    it('should create session with correct initial values', () => {
      const session = new BrowserSession(
        'test-session-1',
        mockSharedContextManager,
        mockAuthManager,
        'https://notebooklm.google.com/notebook/test123'
      );

      expect(session.sessionId).toBe('test-session-1');
      expect(session.notebookUrl).toBe('https://notebooklm.google.com/notebook/test123');
      expect(session.messageCount).toBe(0);
      expect(session.createdAt).toBeLessThanOrEqual(Date.now());
      expect(session.lastActivity).toBeLessThanOrEqual(Date.now());
    });

    it('should update activity timestamp', async () => {
      const session = new BrowserSession(
        'test-session-2',
        mockSharedContextManager,
        mockAuthManager,
        'https://notebooklm.google.com/notebook/test123'
      );

      const initialActivity = session.lastActivity;

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 50));

      session.updateActivity();

      expect(session.lastActivity).toBeGreaterThan(initialActivity);
    });

    it('should correctly detect expired sessions', async () => {
      const session = new BrowserSession(
        'test-session-3',
        mockSharedContextManager,
        mockAuthManager,
        'https://notebooklm.google.com/notebook/test123'
      );

      // Session should not be expired immediately
      expect(session.isExpired(60)).toBe(false);

      // Session should be expired with 0 timeout
      expect(session.isExpired(0)).toBe(true);
    });

    it('should return correct session info', () => {
      const session = new BrowserSession(
        'test-session-4',
        mockSharedContextManager,
        mockAuthManager,
        'https://notebooklm.google.com/notebook/test123'
      );

      const info = session.getInfo();

      expect(info.id).toBe('test-session-4');
      expect(info.notebook_url).toBe('https://notebooklm.google.com/notebook/test123');
      expect(info.message_count).toBe(0);
      expect(info.age_seconds).toBeGreaterThanOrEqual(0);
      expect(info.inactive_seconds).toBeGreaterThanOrEqual(0);
      expect(info.created_at).toBeDefined();
      expect(info.last_activity).toBeDefined();
    });

    it('should report not initialized before init()', () => {
      const session = new BrowserSession(
        'test-session-5',
        mockSharedContextManager,
        mockAuthManager,
        'https://notebooklm.google.com/notebook/test123'
      );

      expect(session.isInitialized()).toBe(false);
      expect(session.getPage()).toBeNull();
    });
  });
});

describeIntegration('SessionManager Tests', () => {
  let authManager: AuthManager;
  let sessionManager: SessionManager;
  let browserAvailable = false;

  beforeAll(async () => {
    browserAvailable = await checkBrowserDeps();
    if (!browserAvailable) {
      console.log('⏭️  Skipping SessionManager tests - browser dependencies not available');
      return;
    }
    authManager = new AuthManager();
  }, TIMEOUTS.navigation);

  beforeEach(() => {
    if (!browserAvailable) return;
    sessionManager = new SessionManager(authManager);
  });

  afterEach(async () => {
    if (!browserAvailable) return;
    if (sessionManager) {
      await sessionManager.closeAllSessions();
    }
  });

  describe('Stats and Info', () => {
    it('should return empty stats initially', () => {
      if (!browserAvailable) return;

      const stats = sessionManager.getStats();

      expect(stats.active_sessions).toBe(0);
      expect(stats.max_sessions).toBeGreaterThan(0);
      expect(stats.session_timeout).toBeGreaterThan(0);
      expect(stats.total_messages).toBe(0);
      expect(stats.oldest_session_seconds).toBe(0);
    });

    it('should return empty sessions list initially', () => {
      if (!browserAvailable) return;

      const sessions = sessionManager.getAllSessionsInfo();

      expect(sessions).toEqual([]);
    });

    it('should return null for non-existent session', () => {
      if (!browserAvailable) return;

      const session = sessionManager.getSession('non-existent');

      expect(session).toBeNull();
    });
  });

  describe('Session Validation', () => {
    it('should reject empty notebook URL', async () => {
      if (!browserAvailable) return;

      await expect(sessionManager.getOrCreateSession('test-session', '')).rejects.toThrow(
        'Notebook URL is required'
      );
    });

    it('should reject relative notebook URL', async () => {
      if (!browserAvailable) return;

      await expect(
        sessionManager.getOrCreateSession('test-session', '/notebook/test')
      ).rejects.toThrow('must be an absolute URL');
    });

    it('should reject invalid URL format', async () => {
      if (!browserAvailable) return;

      await expect(sessionManager.getOrCreateSession('test-session', 'not-a-url')).rejects.toThrow(
        'must be an absolute URL'
      );
    });
  });

  describe('Close Operations', () => {
    it('should return false when closing non-existent session', async () => {
      if (!browserAvailable) return;

      const result = await sessionManager.closeSession('non-existent');

      expect(result).toBe(false);
    });

    it('should handle closeAllSessions with no sessions', async () => {
      if (!browserAvailable) return;

      // Should not throw
      await sessionManager.closeAllSessions();

      expect(sessionManager.getStats().active_sessions).toBe(0);
    });

    it('should cleanup inactive sessions when none exist', async () => {
      if (!browserAvailable) return;

      const cleaned = await sessionManager.cleanupInactiveSessions();

      expect(cleaned).toBe(0);
    });
  });
});

// Note: SharedContextManager tests are skipped because they require
// Chrome to be installed at a specific system path.
// The browser lifecycle tests below cover the essential functionality
// using Patchright's bundled Chromium instead.

describeIntegration('Browser Session Lifecycle', () => {
  let browserAvailable = false;
  let context: BrowserContext | null = null;

  beforeAll(async () => {
    browserAvailable = await checkBrowserDeps();
    if (!browserAvailable) {
      console.log('⏭️  Skipping lifecycle tests - browser dependencies not available');
      return;
    }

    // Create a simple browser context for testing
    context = await chromium.launchPersistentContext('', {
      headless: true,
      viewport: { width: 1024, height: 768 },
    });
  }, TIMEOUTS.navigation);

  afterAll(async () => {
    if (context) {
      await context.close();
    }
  });

  it('should create and close pages correctly', async () => {
    if (!browserAvailable || !context) return;

    const initialPages = context.pages().length;

    const page = await context.newPage();
    expect(context.pages().length).toBe(initialPages + 1);

    await page.close();
    expect(context.pages().length).toBe(initialPages);
  });

  it('should navigate to external URLs', async () => {
    if (!browserAvailable || !context) return;

    const page = await context.newPage();

    await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });

    expect(page.url()).toContain('example.com');

    await page.close();
  });

  it('should handle multiple pages in same context', async () => {
    if (!browserAvailable || !context) return;

    const page1 = await context.newPage();
    const page2 = await context.newPage();

    await page1.goto('https://example.com');
    await page2.goto('https://www.google.com');

    expect(page1.url()).toContain('example.com');
    expect(page2.url()).toContain('google.com');

    await page1.close();
    await page2.close();
  });
});
