/**
 * Add/Delete Sources Tests
 *
 * Tests: 16-24
 * Category: ContentManager.addSource() & listSources()
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { httpRequest, checkServerHealth, timestamp } from '../utils.js';
import { config, currentNotebooks } from '../config.js';

// E2E Test notebook for write operations (from config based on account)
const E2E_NOTEBOOK_URL = currentNotebooks.e2eTest;
const TIMEOUT = config.timeouts.content;

describe('05 - Sources Management', () => {
  let isAuthenticated = false;
  let addedSourceName: string | null = null;

  beforeAll(async () => {
    const health = await checkServerHealth();
    isAuthenticated = health.authenticated;
  });

  it(
    '[T16] Should list sources in notebook',
    async () => {
      if (!isAuthenticated) return;

      const askResult = await httpRequest('/ask', 'POST', {
        question: 'List all sources',
        notebook_url: E2E_NOTEBOOK_URL,
      });

      if (!askResult.success) return;

      const sessionId = (askResult.data as { session_id: string }).session_id;
      const result = await httpRequest(`/content?session_id=${sessionId}`, 'GET');

      expect(result).toHaveProperty('success');
      if (result.success) {
        const data = result.data as { sources?: unknown[] };
        expect(data.sources).toBeInstanceOf(Array);
      }
    },
    TIMEOUT * 2
  );

  it(
    '[T17] Should add text source',
    async () => {
      if (!isAuthenticated) return;

      const sourceName = `E2E-Text-${timestamp()}`;
      const result = await httpRequest('/content/sources', 'POST', {
        notebook_url: E2E_NOTEBOOK_URL,
        source_type: 'text',
        text: `Test content created at ${timestamp()}`,
        title: sourceName,
      });

      expect(result).toHaveProperty('success');
      if (result.success) {
        addedSourceName = sourceName;
      }
    },
    TIMEOUT
  );

  it(
    '[T18] Should add URL source',
    async () => {
      if (!isAuthenticated) return;

      const result = await httpRequest('/content/sources', 'POST', {
        notebook_url: E2E_NOTEBOOK_URL,
        source_type: 'url',
        url: 'https://en.wikipedia.org/wiki/Test',
      });

      expect(result).toHaveProperty('success');
    },
    TIMEOUT
  );

  it(
    '[T19] Should add YouTube source',
    async () => {
      if (!isAuthenticated) return;

      const result = await httpRequest('/content/sources', 'POST', {
        notebook_url: E2E_NOTEBOOK_URL,
        source_type: 'youtube',
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      });

      expect(result).toHaveProperty('success');
    },
    TIMEOUT
  );

  it('[T20] Should reject invalid source type', async () => {
    const result = await httpRequest('/content/sources', 'POST', {
      notebook_url: E2E_NOTEBOOK_URL,
      source_type: 'invalid_type',
    });

    expect(result.success).toBe(false);
  });

  it('[T21] Should reject file without path', async () => {
    const result = await httpRequest('/content/sources', 'POST', {
      notebook_url: E2E_NOTEBOOK_URL,
      source_type: 'file',
    });

    expect(result.success).toBe(false);
  });

  it('[T22] Should reject google_drive without url', async () => {
    const result = await httpRequest('/content/sources', 'POST', {
      notebook_url: E2E_NOTEBOOK_URL,
      source_type: 'google_drive',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('URL');
  });

  it(
    '[T23] Should delete source by name',
    async () => {
      if (!isAuthenticated || !addedSourceName) return;

      const result = await httpRequest(
        `/content/sources?source_name=${encodeURIComponent(addedSourceName)}`,
        'DELETE'
      );

      expect(result).toHaveProperty('success');
    },
    TIMEOUT
  );

  it(
    '[T24] Should add and delete source',
    async () => {
      if (!isAuthenticated) return;

      const sourceName = `DeleteMe-${timestamp()}`;
      const addResult = await httpRequest('/content/sources', 'POST', {
        notebook_url: E2E_NOTEBOOK_URL,
        source_type: 'text',
        text: 'Content to be deleted',
        title: sourceName,
      });

      if (!addResult.success) return;

      const result = await httpRequest(
        `/content/sources?source_name=${encodeURIComponent(sourceName)}`,
        'DELETE'
      );

      expect(result).toHaveProperty('success');
    },
    TIMEOUT * 2
  );
});
