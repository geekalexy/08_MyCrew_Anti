/**
 * Auto-Discovery Module Unit Tests
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock logger
jest.unstable_mockModule('../utils/logger.js', () => ({
  log: {
    info: jest.fn(),
    success: jest.fn(),
    warning: jest.fn(),
    error: jest.fn(),
    dim: jest.fn(),
  },
}));

describe('AutoDiscovery', () => {
  let AutoDiscovery: any;
  let mockSessionManager: any;
  let mockSession: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Create mock session
    mockSession = {
      ask: jest.fn(),
    };

    // Create mock session manager
    mockSessionManager = {
      getOrCreateSession: jest.fn().mockResolvedValue(mockSession),
    };

    // Import the module after mocks are set up
    const module = await import('../auto-discovery/auto-discovery.js');
    AutoDiscovery = module.AutoDiscovery;
  });

  describe('Constructor', () => {
    it('should create instance with session manager', () => {
      const autoDiscovery = new AutoDiscovery(mockSessionManager);
      expect(autoDiscovery).toBeDefined();
    });
  });

  describe('discoverMetadata', () => {
    it('should successfully discover valid metadata', async () => {
      const validResponse = JSON.stringify({
        name: 'test-notebook',
        description: 'This is a test notebook. It contains test data.',
        tags: ['test', 'notebook', 'example', 'demo', 'sample', 'unit', 'testing', 'validation'],
      });

      mockSession.ask.mockResolvedValue({ answer: validResponse });

      const autoDiscovery = new AutoDiscovery(mockSessionManager);
      const result = await autoDiscovery.discoverMetadata(
        'https://notebooklm.google.com/notebook/abc'
      );

      expect(result.name).toBe('test-notebook');
      expect(result.description).toBe('This is a test notebook. It contains test data.');
      expect(result.tags).toHaveLength(8);
    });

    it('should handle markdown-wrapped JSON response', async () => {
      const wrappedResponse =
        '```json\n{"name": "wrapped-notebook", "description": "First sentence. Second sentence.", "tags": ["a", "b", "c", "d", "e", "f", "g", "h"]}\n```';

      mockSession.ask.mockResolvedValue({ answer: wrappedResponse });

      const autoDiscovery = new AutoDiscovery(mockSessionManager);
      const result = await autoDiscovery.discoverMetadata(
        'https://notebooklm.google.com/notebook/abc'
      );

      expect(result.name).toBe('wrapped-notebook');
    });

    it('should retry on failure', async () => {
      const validResponse = JSON.stringify({
        name: 'retry-test',
        description: 'This notebook was discovered after retry. Success on second attempt.',
        tags: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'],
      });

      // First call fails, second succeeds
      mockSession.ask
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValueOnce({ answer: validResponse });

      const autoDiscovery = new AutoDiscovery(mockSessionManager);
      const result = await autoDiscovery.discoverMetadata(
        'https://notebooklm.google.com/notebook/abc',
        1
      );

      expect(result.name).toBe('retry-test');
      expect(mockSession.ask).toHaveBeenCalledTimes(2);
    }, 10000);

    it('should throw after max retries', async () => {
      mockSession.ask.mockRejectedValue(new Error('Persistent error'));

      const autoDiscovery = new AutoDiscovery(mockSessionManager);

      await expect(
        autoDiscovery.discoverMetadata('https://notebooklm.google.com/notebook/abc', 0)
      ).rejects.toThrow('Auto-discovery failed');
    });

    it('should throw on invalid JSON response', async () => {
      mockSession.ask.mockResolvedValue({ answer: 'This is not valid JSON' });

      const autoDiscovery = new AutoDiscovery(mockSessionManager);

      await expect(
        autoDiscovery.discoverMetadata('https://notebooklm.google.com/notebook/abc', 0)
      ).rejects.toThrow(/Invalid JSON response|Auto-discovery failed/);
    });

    it('should throw on missing required fields', async () => {
      mockSession.ask.mockResolvedValue({ answer: JSON.stringify({ name: 'incomplete' }) });

      const autoDiscovery = new AutoDiscovery(mockSessionManager);

      await expect(
        autoDiscovery.discoverMetadata('https://notebooklm.google.com/notebook/abc', 0)
      ).rejects.toThrow(/Missing required fields|Auto-discovery failed/);
    });
  });

  describe('Metadata Validation', () => {
    it('should accept valid kebab-case name', async () => {
      const validResponse = JSON.stringify({
        name: 'valid-name',
        description: 'Short description. Second sentence.',
        tags: ['1', '2', '3', '4', '5', '6', '7', '8'],
      });

      mockSession.ask.mockResolvedValue({ answer: validResponse });

      const autoDiscovery = new AutoDiscovery(mockSessionManager);
      const result = await autoDiscovery.discoverMetadata(
        'https://notebooklm.google.com/notebook/abc',
        0
      );

      expect(result.name).toBe('valid-name');
    });

    it('should accept single word name', async () => {
      const validResponse = JSON.stringify({
        name: 'notebook',
        description: 'Single word name test. Works correctly.',
        tags: ['1', '2', '3', '4', '5', '6', '7', '8'],
      });

      mockSession.ask.mockResolvedValue({ answer: validResponse });

      const autoDiscovery = new AutoDiscovery(mockSessionManager);
      const result = await autoDiscovery.discoverMetadata(
        'https://notebooklm.google.com/notebook/abc',
        0
      );

      expect(result.name).toBe('notebook');
    });

    it('should accept three-word name', async () => {
      const validResponse = JSON.stringify({
        name: 'my-test-notebook',
        description: 'Three word name test. Works correctly.',
        tags: ['1', '2', '3', '4', '5', '6', '7', '8'],
      });

      mockSession.ask.mockResolvedValue({ answer: validResponse });

      const autoDiscovery = new AutoDiscovery(mockSessionManager);
      const result = await autoDiscovery.discoverMetadata(
        'https://notebooklm.google.com/notebook/abc',
        0
      );

      expect(result.name).toBe('my-test-notebook');
    });

    it('should reject invalid name format', async () => {
      const invalidResponse = JSON.stringify({
        name: 'Invalid Name With Spaces',
        description: 'Test description. Second sentence.',
        tags: ['1', '2', '3', '4', '5', '6', '7', '8'],
      });

      mockSession.ask.mockResolvedValue({ answer: invalidResponse });

      const autoDiscovery = new AutoDiscovery(mockSessionManager);

      await expect(
        autoDiscovery.discoverMetadata('https://notebooklm.google.com/notebook/abc', 0)
      ).rejects.toThrow(/Invalid name format|Auto-discovery failed/);
    });

    it('should reject name with too many words', async () => {
      const invalidResponse = JSON.stringify({
        name: 'too-many-words-in-name',
        description: 'Test description. Second sentence.',
        tags: ['1', '2', '3', '4', '5', '6', '7', '8'],
      });

      mockSession.ask.mockResolvedValue({ answer: invalidResponse });

      const autoDiscovery = new AutoDiscovery(mockSessionManager);

      await expect(
        autoDiscovery.discoverMetadata('https://notebooklm.google.com/notebook/abc', 0)
      ).rejects.toThrow(/Invalid name format|Auto-discovery failed/);
    });

    it('should accept 8 tags', async () => {
      const validResponse = JSON.stringify({
        name: 'test-notebook',
        description: 'Description here. Second sentence.',
        tags: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'],
      });

      mockSession.ask.mockResolvedValue({ answer: validResponse });

      const autoDiscovery = new AutoDiscovery(mockSessionManager);
      const result = await autoDiscovery.discoverMetadata(
        'https://notebooklm.google.com/notebook/abc',
        0
      );

      expect(result.tags).toHaveLength(8);
    });

    it('should accept 10 tags', async () => {
      const validResponse = JSON.stringify({
        name: 'test-notebook',
        description: 'Description here. Second sentence.',
        tags: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'],
      });

      mockSession.ask.mockResolvedValue({ answer: validResponse });

      const autoDiscovery = new AutoDiscovery(mockSessionManager);
      const result = await autoDiscovery.discoverMetadata(
        'https://notebooklm.google.com/notebook/abc',
        0
      );

      expect(result.tags).toHaveLength(10);
    });

    it('should reject too few tags', async () => {
      const invalidResponse = JSON.stringify({
        name: 'test-notebook',
        description: 'Description here. Second sentence.',
        tags: ['a', 'b', 'c'],
      });

      mockSession.ask.mockResolvedValue({ answer: invalidResponse });

      const autoDiscovery = new AutoDiscovery(mockSessionManager);

      await expect(
        autoDiscovery.discoverMetadata('https://notebooklm.google.com/notebook/abc', 0)
      ).rejects.toThrow(/Invalid tags count|Auto-discovery failed/);
    });

    it('should reject too many tags', async () => {
      const invalidResponse = JSON.stringify({
        name: 'test-notebook',
        description: 'Description here. Second sentence.',
        tags: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'],
      });

      mockSession.ask.mockResolvedValue({ answer: invalidResponse });

      const autoDiscovery = new AutoDiscovery(mockSessionManager);

      await expect(
        autoDiscovery.discoverMetadata('https://notebooklm.google.com/notebook/abc', 0)
      ).rejects.toThrow(/Invalid tags count|Auto-discovery failed/);
    });

    it('should reject empty tags', async () => {
      const invalidResponse = JSON.stringify({
        name: 'test-notebook',
        description: 'Description here. Second sentence.',
        tags: ['a', '', 'c', 'd', 'e', 'f', 'g', 'h'],
      });

      mockSession.ask.mockResolvedValue({ answer: invalidResponse });

      const autoDiscovery = new AutoDiscovery(mockSessionManager);

      await expect(
        autoDiscovery.discoverMetadata('https://notebooklm.google.com/notebook/abc', 0)
      ).rejects.toThrow(/Invalid tag|Auto-discovery failed/);
    });

    it('should truncate long descriptions', async () => {
      const longDescription = 'A'.repeat(200) + '.';
      const validResponse = JSON.stringify({
        name: 'test-notebook',
        description: longDescription,
        tags: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'],
      });

      mockSession.ask.mockResolvedValue({ answer: validResponse });

      const autoDiscovery = new AutoDiscovery(mockSessionManager);
      const result = await autoDiscovery.discoverMetadata(
        'https://notebooklm.google.com/notebook/abc',
        0
      );

      expect(result.description.length).toBeLessThanOrEqual(150);
    });
  });

  describe('Response Parsing', () => {
    it('should clean markdown json code blocks', async () => {
      const wrappedResponse =
        '```json\n{\n  "name": "clean-test",\n  "description": "Test cleaning. Second sentence.",\n  "tags": ["a", "b", "c", "d", "e", "f", "g", "h"]\n}\n```';

      mockSession.ask.mockResolvedValue({ answer: wrappedResponse });

      const autoDiscovery = new AutoDiscovery(mockSessionManager);
      const result = await autoDiscovery.discoverMetadata(
        'https://notebooklm.google.com/notebook/abc',
        0
      );

      expect(result.name).toBe('clean-test');
    });

    it('should clean simple code blocks', async () => {
      const wrappedResponse =
        '```\n{"name": "simple-test", "description": "Test. Second.", "tags": ["a", "b", "c", "d", "e", "f", "g", "h"]}\n```';

      mockSession.ask.mockResolvedValue({ answer: wrappedResponse });

      const autoDiscovery = new AutoDiscovery(mockSessionManager);
      const result = await autoDiscovery.discoverMetadata(
        'https://notebooklm.google.com/notebook/abc',
        0
      );

      expect(result.name).toBe('simple-test');
    });

    it('should handle extra whitespace', async () => {
      const spacedResponse =
        '\n\n  {"name": "whitespace-test", "description": "Test. Second.", "tags": ["a", "b", "c", "d", "e", "f", "g", "h"]}  \n\n';

      mockSession.ask.mockResolvedValue({ answer: spacedResponse });

      const autoDiscovery = new AutoDiscovery(mockSessionManager);
      const result = await autoDiscovery.discoverMetadata(
        'https://notebooklm.google.com/notebook/abc',
        0
      );

      expect(result.name).toBe('whitespace-test');
    });
  });
});

describe('AutoGeneratedMetadata Type', () => {
  it('should have correct structure', () => {
    const metadata = {
      name: 'test-name',
      description: 'Test description. Second sentence.',
      tags: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5', 'tag6', 'tag7', 'tag8'],
    };

    expect(metadata.name).toBeDefined();
    expect(metadata.description).toBeDefined();
    expect(metadata.tags).toBeDefined();
    expect(Array.isArray(metadata.tags)).toBe(true);
  });

  it('should enforce required fields', () => {
    interface AutoGeneratedMetadata {
      name: string;
      description: string;
      tags: string[];
    }

    const metadata: AutoGeneratedMetadata = {
      name: 'required',
      description: 'All required. Second.',
      tags: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'],
    };

    expect(typeof metadata.name).toBe('string');
    expect(typeof metadata.description).toBe('string');
    expect(Array.isArray(metadata.tags)).toBe(true);
  });
});

describe('Name Validation Rules', () => {
  describe('kebab-case validation', () => {
    const validNames = [
      'simple',
      'two-words',
      'three-word-name',
      'a-b-c',
      'abc123',
      'test123name',
      'a1-b2-c3',
    ];

    const invalidNames = [
      'With Spaces',
      'CamelCase',
      'UPPERCASE',
      'under_score',
      'too-many-words-in-name',
      'has.dots',
      '',
      '-starts-with-dash',
      'ends-with-dash-',
    ];

    it('should recognize valid kebab-case names', () => {
      const regex = /^[a-z0-9]+(-[a-z0-9]+){0,2}$/;

      validNames.forEach((name) => {
        expect(regex.test(name)).toBe(true);
      });
    });

    it('should reject invalid names', () => {
      const regex = /^[a-z0-9]+(-[a-z0-9]+){0,2}$/;

      invalidNames.forEach((name) => {
        expect(regex.test(name)).toBe(false);
      });
    });
  });
});

describe('Description Truncation Rules', () => {
  describe('character limit enforcement', () => {
    it('should not truncate short descriptions', () => {
      const short = 'Short description.';
      expect(short.length).toBeLessThan(150);
    });

    it('should detect long descriptions', () => {
      const long = 'A'.repeat(200);
      expect(long.length).toBeGreaterThan(150);
    });

    it('should find last period for truncation', () => {
      const text = 'First sentence here. Second sentence with more text.';
      const lastPeriod = text.lastIndexOf('.');
      expect(lastPeriod).toBeGreaterThan(0);
    });

    it('should add ellipsis when truncating mid-sentence', () => {
      const text = 'Very long sentence without any periods to break at';
      const truncated = text.substring(0, 47) + '...';
      expect(truncated).toContain('...');
      expect(truncated.length).toBe(50);
    });
  });
});

describe('Tags Validation Rules', () => {
  describe('tag count validation', () => {
    it('should accept 8 tags', () => {
      const tags = ['1', '2', '3', '4', '5', '6', '7', '8'];
      expect(tags.length >= 8 && tags.length <= 10).toBe(true);
    });

    it('should accept 9 tags', () => {
      const tags = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
      expect(tags.length >= 8 && tags.length <= 10).toBe(true);
    });

    it('should accept 10 tags', () => {
      const tags = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
      expect(tags.length >= 8 && tags.length <= 10).toBe(true);
    });

    it('should reject 7 tags', () => {
      const tags = ['1', '2', '3', '4', '5', '6', '7'];
      expect(tags.length >= 8 && tags.length <= 10).toBe(false);
    });

    it('should reject 11 tags', () => {
      const tags = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'];
      expect(tags.length >= 8 && tags.length <= 10).toBe(false);
    });
  });

  describe('tag content validation', () => {
    it('should reject empty string tags', () => {
      const tag = '';
      expect(typeof tag === 'string' && tag.trim().length > 0).toBe(false);
    });

    it('should reject whitespace-only tags', () => {
      const tag = '   ';
      expect(typeof tag === 'string' && tag.trim().length > 0).toBe(false);
    });

    it('should accept valid string tags', () => {
      const tag = 'valid-tag';
      expect(typeof tag === 'string' && tag.trim().length > 0).toBe(true);
    });
  });
});
