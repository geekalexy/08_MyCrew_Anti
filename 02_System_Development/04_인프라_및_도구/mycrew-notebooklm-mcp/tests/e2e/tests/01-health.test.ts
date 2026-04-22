/**
 * Health & Authentication Tests
 *
 * Tests: 1-3
 * Category: Health & Auth
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { httpRequest, checkServerHealth } from '../utils.js';

describe('01 - Health & Authentication', () => {
  let serverHealth: Awaited<ReturnType<typeof checkServerHealth>>;

  beforeAll(async () => {
    serverHealth = await checkServerHealth();
  });

  it('[T01] Server should be running', async () => {
    expect(serverHealth.available).toBe(true);
  });

  it('[T02] Server should be authenticated', async () => {
    expect(serverHealth.authenticated).toBe(true);
  });

  it('[T03] Should return full health status', async () => {
    const result = await httpRequest('/health');

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      status: 'ok',
      authenticated: true,
      headless: expect.any(Boolean),
      max_sessions: expect.any(Number),
    });
  });
});
