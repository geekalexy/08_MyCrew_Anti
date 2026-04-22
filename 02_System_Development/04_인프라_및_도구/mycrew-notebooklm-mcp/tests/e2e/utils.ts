/**
 * E2E Test Utilities
 *
 * Shared utilities for all E2E tests.
 */

import { execSync } from 'child_process';
import { config } from './config.js';

export interface HttpResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

/**
 * Make HTTP request to the server
 * Uses Windows curl via cmd.exe for WSL compatibility
 */
export async function httpRequest(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: Record<string, unknown>
): Promise<HttpResponse> {
  const url = `${config.serverUrl}${endpoint}`;

  try {
    let cmd: string;
    if (method === 'GET') {
      // Escape % as %% for cmd.exe (URL-encoded params contain % characters)
      const escapedUrl = url.replace(/%/g, '%%');
      cmd = `curl -s "${escapedUrl}"`;
    } else {
      const bodyStr = body ? JSON.stringify(body).replace(/"/g, '\\"') : '{}';
      cmd = `curl -s -X ${method} "${url}" -H "Content-Type: application/json" -d "${bodyStr}"`;
    }

    // Run via Windows cmd.exe for WSL compatibility
    const result = execSync(`cmd.exe /c ${cmd}`, {
      encoding: 'utf-8',
      timeout: 120000,
    });

    return JSON.parse(result);
  } catch (error) {
    // Try native fetch as fallback (for non-WSL environments)
    try {
      const options: RequestInit = {
        method,
        headers: { 'Content-Type': 'application/json' },
      };
      if (body) {
        options.body = JSON.stringify(body);
      }
      const response = await fetch(url, options);
      return response.json();
    } catch {
      return { success: false, error: String(error) };
    }
  }
}

/**
 * Check if server is available and authenticated
 */
export async function checkServerHealth(): Promise<{
  available: boolean;
  authenticated: boolean;
  data?: Record<string, unknown>;
}> {
  try {
    const result = await httpRequest('/health');
    return {
      available: result.success === true,
      authenticated: (result.data as { authenticated?: boolean })?.authenticated === true,
      data: result.data as Record<string, unknown>,
    };
  } catch {
    return { available: false, authenticated: false };
  }
}

/**
 * Generate timestamp for unique test data
 */
export function timestamp(): string {
  return Date.now().toString();
}

/**
 * Log test result
 */
export function logResult(testName: string, passed: boolean, details?: string): void {
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} ${testName}${details ? ` - ${details}` : ''}`);
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
