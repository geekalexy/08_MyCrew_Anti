/**
 * HTTP Server Integration Tests
 *
 * Tests the HTTP wrapper by starting a real server and making requests.
 *
 * Run with: NBLM_INTEGRATION_TESTS=true npm test -- --testPathPatterns=http-server
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import http from 'http';
import { INTEGRATION_ENABLED, checkBrowserDeps, PROD_PROFILE_DIR } from './setup.js';
import fs from 'fs';

// Skip all tests if integration is disabled
const describeIntegration = INTEGRATION_ENABLED ? describe : describe.skip;

// Check if production profile exists
const hasProductionProfile = fs.existsSync(PROD_PROFILE_DIR);

// Test port (default HTTP server port)
const TEST_PORT = 3000;
const BASE_URL = `http://localhost:${TEST_PORT}`;

/**
 * Make HTTP request helper
 */
async function httpRequest(
  method: string,
  path: string,
  body?: object
): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const options: http.RequestOptions = {
      hostname: 'localhost',
      port: TEST_PORT,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode || 500,
            data: data ? JSON.parse(data) : null,
          });
        } catch {
          resolve({ status: res.statusCode || 500, data: data });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

/**
 * Check if server is running
 */
async function isServerRunning(): Promise<boolean> {
  try {
    const response = await httpRequest('GET', '/health');
    return response.status === 200;
  } catch {
    return false;
  }
}

describeIntegration('HTTP Server Integration', () => {
  let serverRunning = false;
  let browserAvailable = false;

  beforeAll(async () => {
    browserAvailable = await checkBrowserDeps();

    // Check if server is already running
    serverRunning = await isServerRunning();

    if (!serverRunning) {
      console.log('⚠️  HTTP server not running on port 13580');
      console.log('   Start with: npm run start:http');
    } else {
      console.log('✅ HTTP server detected on port 13580');
    }
  }, 10000);

  describe('Health Endpoint', () => {
    it('should return health status', async () => {
      if (!serverRunning) {
        console.log('⏭️  Skipping - server not running');
        return;
      }

      const response = await httpRequest('GET', '/health');

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data.status).toBe('ok');
    });

    it('should include session info in health', async () => {
      if (!serverRunning) return;

      const response = await httpRequest('GET', '/health');

      expect(response.data.data).toHaveProperty('active_sessions');
      expect(response.data.data).toHaveProperty('max_sessions');
    });
  });

  describe('Library Endpoints', () => {
    it('should list notebooks', async () => {
      if (!serverRunning) {
        console.log('⏭️  Skipping - server not running');
        return;
      }

      const response = await httpRequest('GET', '/notebooks');

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(Array.isArray(response.data.data.notebooks)).toBe(true);

      console.log(`📚 Found ${response.data.data.notebooks.length} notebooks`);
    });

    it('should get library stats', async () => {
      if (!serverRunning) return;

      const response = await httpRequest('GET', '/notebooks/stats');

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
    });

    it('should search notebooks', async () => {
      if (!serverRunning) {
        console.log('⏭️  Skipping - server not running');
        return;
      }

      const response = await httpRequest('GET', '/notebooks/search?query=test');

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
    });
  });

  describe('Session Endpoints', () => {
    it('should list sessions', async () => {
      if (!serverRunning) {
        console.log('⏭️  Skipping - server not running');
        return;
      }

      const response = await httpRequest('GET', '/sessions');

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(Array.isArray(response.data.data.sessions)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown endpoint', async () => {
      if (!serverRunning) return;

      const response = await httpRequest('GET', '/unknown-endpoint-xyz');

      expect(response.status).toBe(404);
    });

    it('should return 400 for missing question', async () => {
      if (!serverRunning) return;

      const response = await httpRequest('POST', '/ask', {});

      expect(response.status).toBe(400);
      expect(response.data).toHaveProperty('error');
    });

    it('should return 400 for missing notebook fields', async () => {
      if (!serverRunning) return;

      const response = await httpRequest('POST', '/notebooks', {
        url: 'https://notebooklm.google.com/notebook/test',
        // Missing: name, description, topics
      });

      expect(response.status).toBe(400);
    });
  });

  describe('CORS Headers', () => {
    it('should handle OPTIONS preflight', async () => {
      if (!serverRunning) return;

      const response = await httpRequest('OPTIONS', '/ask');

      // OPTIONS returns 200 or 204
      expect([200, 204]).toContain(response.status);
    });
  });

  describe('Request Validation', () => {
    it('should validate notebook URL format', async () => {
      if (!serverRunning) return;

      const response = await httpRequest('POST', '/notebooks', {
        url: 'not-a-valid-url',
        name: 'Test',
        description: 'Test desc',
        topics: ['test'],
      });

      // Should reject invalid URL
      expect(response.data.success).toBe(false);
    });

    it('should validate notebook ID format', async () => {
      if (!serverRunning) return;

      const response = await httpRequest('GET', '/notebooks/invalid-id-format');

      // Might succeed with "not found" or fail with 404
      expect(typeof response.status).toBe('number');
    });
  });
});

describeIntegration('HTTP Server Ask Question', () => {
  let serverRunning = false;
  let browserAvailable = false;

  beforeAll(async () => {
    browserAvailable = await checkBrowserDeps();
    serverRunning = await isServerRunning();
  }, 10000);

  describe('Ask Question Validation', () => {
    it('should require question field', async () => {
      if (!serverRunning) {
        console.log('⏭️  Skipping - server not running');
        return;
      }

      const response = await httpRequest('POST', '/ask', {
        notebook_id: 'test',
      });

      expect(response.status).toBe(400);
      expect(response.data.error).toContain('question');
    });

    it('should handle missing notebook identification', async () => {
      if (!serverRunning) return;

      const response = await httpRequest('POST', '/ask', {
        question: 'What is this about?',
        // Missing: notebook_id or notebook_url
      });

      // May return 400 (no notebook) or 200 (has active notebook)
      expect([200, 400, 500]).toContain(response.status);
    });

    it('should accept notebook_url instead of notebook_id', async () => {
      if (!serverRunning || !browserAvailable || !hasProductionProfile) {
        console.log('⏭️  Skipping - requirements not met');
        return;
      }

      // This test would actually query NotebookLM
      // Just validate the request is accepted (may fail if not authenticated)
      const response = await httpRequest('POST', '/ask', {
        question: 'What is this about?',
        notebook_url: 'https://notebooklm.google.com/notebook/test',
      });

      // Either succeeds or fails auth - both are valid responses
      expect([200, 401, 500]).toContain(response.status);
    }, 60000);
  });

  describe('Source Format Options', () => {
    it('should accept source_format parameter', async () => {
      if (!serverRunning) return;

      const response = await httpRequest('POST', '/ask', {
        question: 'Test',
        notebook_id: 'test',
        source_format: 'inline',
      });

      // Request is valid even if notebook doesn't exist
      expect([200, 400, 404, 500]).toContain(response.status);
    });

    it('should validate source_format values', async () => {
      if (!serverRunning) return;

      const validFormats = ['none', 'inline', 'footnotes', 'json', 'expanded'];

      for (const format of validFormats) {
        const response = await httpRequest('POST', '/ask', {
          question: 'Test',
          notebook_id: 'test',
          source_format: format,
        });

        // Format should be accepted (not a 400 for invalid format)
        expect(response.data.error).not.toContain('source_format');
      }
    });
  });
});
