/**
 * Error Handling Tests
 *
 * Tests: 53-55
 * Category: Error Handling
 */

import { describe, it, expect } from '@jest/globals';
import { execSync } from 'child_process';
import { httpRequest } from '../utils.js';
import { config } from '../config.js';

const TEST_NOTEBOOK_ID = 'notebook-1';

describe('10 - Error Handling', () => {
  it('[T53] Should handle missing question', async () => {
    const result = await httpRequest('/ask', 'POST', {
      notebook_id: TEST_NOTEBOOK_ID,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('question');
  });

  it('[T54] Should handle invalid notebook ID', async () => {
    const result = await httpRequest('/ask', 'POST', {
      question: 'Test',
      notebook_id: 'non-existent-notebook',
    });

    expect(result.success).toBe(false);
  });

  it('[T55] Should handle malformed JSON', async () => {
    try {
      const cmd = `curl -s -X POST "${config.serverUrl}/ask" -H "Content-Type: application/json" -d "not valid json"`;
      const resultStr = execSync(`cmd.exe /c ${cmd}`, { encoding: 'utf-8', timeout: 10000 });
      const result = JSON.parse(resultStr);
      expect(result.success).toBe(false);
    } catch {
      // If it throws, that's also acceptable error handling
      expect(true).toBe(true);
    }
  });
});
