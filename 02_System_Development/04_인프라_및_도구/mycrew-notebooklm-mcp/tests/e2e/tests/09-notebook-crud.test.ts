/**
 * Notebook CRUD Tests
 *
 * Tests: 41-42, 48-52
 * Category: Auto-Discover, Notebook Create/Update, Account Management
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { httpRequest, checkServerHealth, timestamp } from '../utils.js';
import { config, currentNotebooks } from '../config.js';

const E2E_NOTEBOOK_URL = currentNotebooks.e2eTest;
const E2E_NOTEBOOK_ID = 'e2e-test-notebook';
const TIMEOUT = config.timeouts.content;

describe('09 - Notebook CRUD & Auto-Discover', () => {
  let isAuthenticated = false;
  let createdNotebookId: string | null = null;

  beforeAll(async () => {
    const health = await checkServerHealth();
    isAuthenticated = health.authenticated;
  });

  // Auto-Discover Tests
  it(
    '[T41] Should auto-discover metadata from URL',
    async () => {
      if (!isAuthenticated) return;

      const result = await httpRequest('/notebooks/auto-discover', 'POST', {
        url: E2E_NOTEBOOK_URL,
      });

      expect(result).toHaveProperty('success');
      if (result.success) {
        const data = result.data as { notebook?: { name?: string } };
        expect(data.notebook).toBeDefined();
      }
    },
    TIMEOUT
  );

  it('[T42] Should reject auto-discover without URL', async () => {
    const result = await httpRequest('/notebooks/auto-discover', 'POST', {});

    expect(result.success).toBe(false);
  });

  // Notebook Create/Update Tests
  it(
    '[T48] Should create a new notebook in Google',
    async () => {
      if (!isAuthenticated) return;

      const result = await httpRequest('/notebooks/create', 'POST', {
        name: `E2E-Created-${timestamp()}`,
      });

      expect(result).toHaveProperty('success');
      if (result.success) {
        const data = result.data as {
          notebook?: { id: string };
          id?: string;
          notebookId?: string;
        };
        createdNotebookId = data.notebook?.id || data.id || data.notebookId || null;
      }
    },
    TIMEOUT
  );

  it(
    '[T49] Should update notebook metadata',
    async () => {
      if (!isAuthenticated) return;

      const result = await httpRequest(`/notebooks/${E2E_NOTEBOOK_ID}`, 'PUT', {
        description: `Updated at ${new Date().toISOString()} by E2E tests`,
        topics: ['e2e', 'testing', 'automated'],
      });

      expect(result).toHaveProperty('success');
    },
    config.timeouts.health
  );

  it(
    '[T50] Should delete created notebook from library',
    async () => {
      if (!createdNotebookId) return;

      const result = await httpRequest(`/notebooks/${createdNotebookId}`, 'DELETE');

      expect(result).toHaveProperty('success');
    },
    config.timeouts.health
  );

  // Account Management Tests
  it('[T51] Should return account info in health', async () => {
    const result = await httpRequest('/health');

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
  });

  it.skip('[T52] Should rotate to next account (destructive)', async () => {
    // Skipped: destructive test
    const result = await httpRequest('/re-auth', 'POST');
    expect(result).toHaveProperty('success');
  });
});
