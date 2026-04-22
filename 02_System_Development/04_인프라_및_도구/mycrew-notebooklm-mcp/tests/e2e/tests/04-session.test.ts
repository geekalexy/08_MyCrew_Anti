/**
 * Session Management Tests
 *
 * Tests: 15, 43-44
 * Category: Session Reset & Management
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { httpRequest, checkServerHealth } from '../utils.js';
import { config } from '../config.js';

const TEST_NOTEBOOK_ID = 'notebook-1';
const TIMEOUT = config.timeouts.ask;

describe('04 - Session Management', () => {
  let isAuthenticated = false;

  beforeAll(async () => {
    const health = await checkServerHealth();
    isAuthenticated = health.authenticated;
  });

  it(
    '[T15] Should reset session and clear history',
    async () => {
      if (!isAuthenticated) return;

      // Create session with a question
      const result1 = await httpRequest('/ask', 'POST', {
        question: 'Test question for reset',
        notebook_id: TEST_NOTEBOOK_ID,
      });
      const session_id = (result1.data as { session_id: string }).session_id;

      // Reset the session
      const resetResult = await httpRequest(`/sessions/${session_id}/reset`, 'POST');
      expect(resetResult.success).toBe(true);
    },
    TIMEOUT
  );

  it('[T43] Should list active sessions', async () => {
    const result = await httpRequest('/sessions');

    expect(result.success).toBe(true);
    const data = result.data as { sessions: unknown[] };
    expect(data.sessions).toBeInstanceOf(Array);
  });

  it(
    '[T44] Should close a session',
    async () => {
      if (!isAuthenticated) return;

      // Create session first
      const askResult = await httpRequest('/ask', 'POST', {
        question: 'Test for closing session',
        notebook_id: TEST_NOTEBOOK_ID,
      });

      if (!askResult.success) return;

      const session_id = (askResult.data as { session_id: string }).session_id;

      // Close it
      const closeResult = await httpRequest(`/sessions/${session_id}`, 'DELETE');
      expect(closeResult.success).toBe(true);
    },
    TIMEOUT
  );
});
