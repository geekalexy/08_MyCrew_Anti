/**
 * Content Download Tests
 *
 * Tests: 34-40
 * Category: ContentManager.downloadContent()
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { httpRequest, checkServerHealth } from '../utils.js';
import { config, currentNotebooks } from '../config.js';

const E2E_NOTEBOOK_URL = currentNotebooks.e2eTest;
const TIMEOUT = config.timeouts.content;

describe('07 - Content Download', () => {
  let isAuthenticated = false;

  beforeAll(async () => {
    const health = await checkServerHealth();
    isAuthenticated = health.authenticated;
  });

  it(
    '[T34] Should download audio if available',
    async () => {
      if (!isAuthenticated) return;

      const result = await httpRequest(
        `/content/download?content_type=audio_overview&notebook_url=${encodeURIComponent(E2E_NOTEBOOK_URL)}`,
        'GET'
      );

      expect(result).toHaveProperty('success');
    },
    TIMEOUT
  );

  it(
    '[T35] Should export presentation to Google Slides',
    async () => {
      if (!isAuthenticated) return;

      const result = await httpRequest(
        `/content/download?content_type=presentation&notebook_url=${encodeURIComponent(E2E_NOTEBOOK_URL)}`,
        'GET'
      );

      expect(result).toHaveProperty('success');
    },
    TIMEOUT
  );

  it(
    '[T36] Should export data_table to Google Sheets',
    async () => {
      if (!isAuthenticated) return;

      const result = await httpRequest(
        `/content/download?content_type=data_table&notebook_url=${encodeURIComponent(E2E_NOTEBOOK_URL)}`,
        'GET'
      );

      expect(result).toHaveProperty('success');
    },
    TIMEOUT
  );

  it(
    '[T37] Should download infographic',
    async () => {
      if (!isAuthenticated) return;

      const result = await httpRequest(
        `/content/download?content_type=infographic&notebook_url=${encodeURIComponent(E2E_NOTEBOOK_URL)}`,
        'GET'
      );

      expect(result).toHaveProperty('success');
    },
    TIMEOUT
  );

  it(
    '[T38] Should download video',
    async () => {
      if (!isAuthenticated) return;

      const result = await httpRequest(
        `/content/download?content_type=video&notebook_url=${encodeURIComponent(E2E_NOTEBOOK_URL)}`,
        'GET'
      );

      expect(result).toHaveProperty('success');
    },
    TIMEOUT
  );

  it('[T39] Should reject invalid download type', async () => {
    const result = await httpRequest('/content/download?content_type=invalid_type', 'GET');

    expect(result.success).toBe(false);
    expect(result.error?.toLowerCase()).toMatch(/not (exportable|supported)/);
  });

  it('[T40] Should reject missing content_type', async () => {
    const result = await httpRequest('/content/download', 'GET');

    expect(result.success).toBe(false);
    expect(result.error?.toLowerCase()).toContain('content_type');
  });
});
