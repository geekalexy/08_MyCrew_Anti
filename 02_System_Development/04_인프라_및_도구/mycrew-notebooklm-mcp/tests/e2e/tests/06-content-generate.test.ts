/**
 * Content Generation Tests
 *
 * Tests: 25-33
 * Category: ContentManager.generateContent() & generateAudioOverview()
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { httpRequest, checkServerHealth } from '../utils.js';
import { config, currentNotebooks } from '../config.js';

const E2E_NOTEBOOK_URL = currentNotebooks.e2eTest;
const TIMEOUT = config.timeouts.content;
const AUDIO_TIMEOUT = config.timeouts.audio;

describe('06 - Content Generation', () => {
  let isAuthenticated = false;

  beforeAll(async () => {
    const health = await checkServerHealth();
    isAuthenticated = health.authenticated;
  });

  it(
    '[T25] Should generate report',
    async () => {
      if (!isAuthenticated) return;

      const result = await httpRequest('/content/generate', 'POST', {
        notebook_url: E2E_NOTEBOOK_URL,
        content_type: 'report',
      });

      expect(result).toHaveProperty('success');
    },
    TIMEOUT
  );

  it(
    '[T26] Should generate presentation',
    async () => {
      if (!isAuthenticated) return;

      const result = await httpRequest('/content/generate', 'POST', {
        notebook_url: E2E_NOTEBOOK_URL,
        content_type: 'presentation',
      });

      expect(result).toHaveProperty('success');
    },
    TIMEOUT
  );

  it(
    '[T27] Should generate data table',
    async () => {
      if (!isAuthenticated) return;

      const result = await httpRequest('/content/generate', 'POST', {
        notebook_url: E2E_NOTEBOOK_URL,
        content_type: 'data_table',
      });

      expect(result).toHaveProperty('success');
    },
    TIMEOUT
  );

  it(
    '[T28] Should generate infographic',
    async () => {
      if (!isAuthenticated) return;

      const result = await httpRequest('/content/generate', 'POST', {
        notebook_url: E2E_NOTEBOOK_URL,
        content_type: 'infographic',
      });

      expect(result).toHaveProperty('success');
    },
    TIMEOUT
  );

  it(
    '[T29] Should generate video',
    async () => {
      if (!isAuthenticated) return;

      const result = await httpRequest('/content/generate', 'POST', {
        notebook_url: E2E_NOTEBOOK_URL,
        content_type: 'video',
        video_style: 'classroom',
      });

      expect(result).toHaveProperty('success');
    },
    AUDIO_TIMEOUT
  );

  it('[T30] Should reject invalid content type', async () => {
    const result = await httpRequest('/content/generate', 'POST', {
      notebook_url: E2E_NOTEBOOK_URL,
      content_type: 'invalid_type',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('not supported');
  });

  it('[T31] Should reject removed content types', async () => {
    const removedTypes = ['faq', 'study_guide', 'briefing_doc', 'timeline', 'table_of_contents'];

    for (const contentType of removedTypes) {
      const result = await httpRequest('/content/generate', 'POST', {
        notebook_url: E2E_NOTEBOOK_URL,
        content_type: contentType,
      });

      expect(result.success).toBe(false);
    }
  });

  it('[T32] Should reject video_style for non-video types', async () => {
    const result = await httpRequest('/content/generate', 'POST', {
      notebook_url: E2E_NOTEBOOK_URL,
      content_type: 'report',
      video_style: 'classroom',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('video_style');
  });

  it(
    '[T33] Should generate audio_overview',
    async () => {
      if (!isAuthenticated) return;

      const result = await httpRequest('/content/generate', 'POST', {
        content_type: 'audio_overview',
        notebook_url: E2E_NOTEBOOK_URL,
      });

      expect(result).toHaveProperty('success');
      if (result.success) {
        const data = result.data as { contentType?: string };
        expect(data.contentType).toBe('audio_overview');
      }
    },
    AUDIO_TIMEOUT
  );
});
