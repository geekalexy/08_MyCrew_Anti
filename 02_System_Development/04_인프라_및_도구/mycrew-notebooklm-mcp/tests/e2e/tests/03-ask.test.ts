/**
 * Ask Question Tests
 *
 * Tests: 11-14
 * Category: BrowserSession.ask() - Core Q&A
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { httpRequest, checkServerHealth } from '../utils.js';
import { config, currentNotebooks } from '../config.js';

const E2E_NOTEBOOK_URL = currentNotebooks.e2eTest;
const TIMEOUT = config.timeouts.ask;

describe('03 - Ask Question (Core Q&A)', () => {
  let isAuthenticated = false;

  beforeAll(async () => {
    const health = await checkServerHealth();
    isAuthenticated = health.authenticated;
  });

  it(
    '[T11] Should answer a simple question',
    async () => {
      if (!isAuthenticated) return;

      const result = await httpRequest('/ask', 'POST', {
        question: 'What is this notebook about?',
        notebook_url: E2E_NOTEBOOK_URL,
      });

      expect(result.success).toBe(true);
      const data = result.data as { answer: string; status: string };
      expect(data.status).toBe('success');
      expect(data.answer).toBeTruthy();
      expect(data.answer.length).toBeGreaterThan(50);
    },
    TIMEOUT
  );

  it(
    '[T12] Should answer a specific question',
    async () => {
      if (!isAuthenticated) return;

      const result = await httpRequest('/ask', 'POST', {
        question: 'What are the main concepts covered in this notebook?',
        notebook_url: E2E_NOTEBOOK_URL,
      });

      expect(result.success).toBe(true);
      const data = result.data as { answer: string };
      expect(data.answer).toBeTruthy();
    },
    TIMEOUT
  );

  it(
    '[T13] Should maintain session context for follow-up',
    async () => {
      if (!isAuthenticated) return;

      // First question
      const result1 = await httpRequest('/ask', 'POST', {
        question: 'Who is the main author mentioned?',
        notebook_url: E2E_NOTEBOOK_URL,
      });
      expect(result1.success).toBe(true);
      const session_id = (result1.data as { session_id: string }).session_id;

      // Follow-up using same session
      const result2 = await httpRequest('/ask', 'POST', {
        question: 'Tell me more about them.',
        notebook_url: E2E_NOTEBOOK_URL,
        session_id: session_id,
      });

      expect(result2.success).toBe(true);
      const data = result2.data as { answer: string; session_id: string };
      expect(data.answer).toBeTruthy();
      expect(data.session_id).toBe(session_id);
    },
    TIMEOUT * 2
  );

  it(
    '[T14] Should include source citations in response',
    async () => {
      if (!isAuthenticated) return;

      const result = await httpRequest('/ask', 'POST', {
        question: 'Give me a key definition with sources.',
        notebook_url: E2E_NOTEBOOK_URL,
      });

      expect(result.success).toBe(true);
      const data = result.data as { answer: string };
      expect(data.answer).toBeTruthy();
      // Response should have citation markers (numbers)
      expect(data.answer).toMatch(/\d+/);
    },
    TIMEOUT
  );

  it(
    '[T15] Should format sources inline when source_format=inline',
    async () => {
      if (!isAuthenticated) return;

      const result = await httpRequest('/ask', 'POST', {
        question: 'Give me a definition with sources.',
        notebook_url: E2E_NOTEBOOK_URL,
        source_format: 'inline',
      });

      expect(result.success).toBe(true);
      const data = result.data as { answer: string };
      expect(data.answer).toBeTruthy();
      // Inline format should have [N: "source text"] pattern
      expect(data.answer).toMatch(/\[\d+:\s*"[^"]+"\]/);
    },
    TIMEOUT
  );

  it(
    '[T16] Should format sources as footnotes when source_format=footnotes',
    async () => {
      if (!isAuthenticated) return;

      const result = await httpRequest('/ask', 'POST', {
        question: 'Give me a definition with sources.',
        notebook_url: E2E_NOTEBOOK_URL,
        source_format: 'footnotes',
      });

      expect(result.success).toBe(true);
      const data = result.data as { answer: string };
      expect(data.answer).toBeTruthy();
      // Footnotes format should have "Sources:" section at the end
      expect(data.answer).toMatch(/---\s*\n\*\*Sources:\*\*/);
    },
    TIMEOUT
  );

  it(
    '[T17] Should return citation data when source_format=json',
    async () => {
      if (!isAuthenticated) return;

      const result = await httpRequest('/ask', 'POST', {
        question: 'Give me a definition with sources.',
        notebook_url: E2E_NOTEBOOK_URL,
        source_format: 'json',
      });

      expect(result.success).toBe(true);
      const data = result.data as { answer: string; citation_result?: { citations: unknown[] } };
      expect(data.answer).toBeTruthy();
      // JSON format should include citation_result object
      expect(data.citation_result).toBeDefined();
      expect(Array.isArray(data.citation_result?.citations)).toBe(true);
    },
    TIMEOUT
  );
});
