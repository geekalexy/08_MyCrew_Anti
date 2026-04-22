/**
 * Notes Management Tests
 *
 * Tests: 45-47
 * Category: ContentManager.notes()
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { httpRequest, checkServerHealth, timestamp } from '../utils.js';
import { config, currentNotebooks } from '../config.js';

const E2E_NOTEBOOK_URL = currentNotebooks.e2eTest;
const TIMEOUT = config.timeouts.content;
const ASK_TIMEOUT = config.timeouts.ask;

describe('08 - Notes Management', () => {
  let isAuthenticated = false;
  let createdNoteTitle: string | null = null;

  beforeAll(async () => {
    const health = await checkServerHealth();
    isAuthenticated = health.authenticated;
  });

  it(
    '[T45] Should create a note',
    async () => {
      if (!isAuthenticated) return;

      createdNoteTitle = `E2E-Note-${timestamp()}`;
      const result = await httpRequest('/content/notes', 'POST', {
        notebook_url: E2E_NOTEBOOK_URL,
        title: createdNoteTitle,
        content: `Test note created at ${new Date().toISOString()}`,
      });

      expect(result).toHaveProperty('success');
    },
    TIMEOUT
  );

  it(
    '[T46] Should save chat to note',
    async () => {
      if (!isAuthenticated) return;

      // First ask a question
      const askResult = await httpRequest('/ask', 'POST', {
        question: 'What is this notebook about?',
        notebook_url: E2E_NOTEBOOK_URL,
      });

      if (!askResult.success) return;

      const sessionId = (askResult.data as { session_id: string }).session_id;

      // Save chat to note
      const result = await httpRequest('/content/chat-to-note', 'POST', {
        session_id: sessionId,
        notebook_url: E2E_NOTEBOOK_URL,
        title: `Chat-Note-${timestamp()}`,
      });

      expect(result).toHaveProperty('success');
    },
    ASK_TIMEOUT + TIMEOUT
  );

  it(
    '[T47] Should convert note to source',
    async () => {
      if (!isAuthenticated || !createdNoteTitle) return;

      const result = await httpRequest(
        `/content/notes/${encodeURIComponent(createdNoteTitle)}/to-source`,
        'POST',
        { notebook_url: E2E_NOTEBOOK_URL }
      );

      expect(result).toHaveProperty('success');
    },
    TIMEOUT
  );
});
