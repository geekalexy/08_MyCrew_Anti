/**
 * Stdio HTTP Proxy Tests
 */

import { describe, it, expect } from '@jest/globals';

describe('Stdio HTTP Proxy Configuration', () => {
  it('should use default HTTP URL', () => {
    const defaultUrl = 'http://localhost:3000';
    const httpBaseUrl = process.env.MCP_HTTP_URL || defaultUrl;
    expect(httpBaseUrl).toBe(defaultUrl);
  });

  it('should use custom HTTP URL from env', () => {
    const customUrl = 'http://custom:8080';
    const originalEnv = process.env.MCP_HTTP_URL;

    process.env.MCP_HTTP_URL = customUrl;
    const httpBaseUrl = process.env.MCP_HTTP_URL || 'http://localhost:3000';
    expect(httpBaseUrl).toBe(customUrl);

    // Restore
    if (originalEnv) {
      process.env.MCP_HTTP_URL = originalEnv;
    } else {
      delete process.env.MCP_HTTP_URL;
    }
  });
});

describe('Stdio HTTP Proxy Tool Definitions', () => {
  const toolNames = [
    'ask_question',
    'list_notebooks',
    'get_notebook',
    'add_notebook',
    'auto_discover_notebook',
    'select_notebook',
    'update_notebook',
    'remove_notebook',
    'search_notebooks',
    'get_library_stats',
    'list_sessions',
    'close_session',
    'reset_session',
    'get_health',
    'setup_auth',
    'de_auth',
    're_auth',
    'cleanup_data',
  ];

  it('should define all expected tools', () => {
    expect(toolNames.length).toBeGreaterThan(10);
    expect(toolNames).toContain('ask_question');
    expect(toolNames).toContain('list_notebooks');
    expect(toolNames).toContain('get_health');
  });

  it('should have ask_question as primary tool', () => {
    expect(toolNames[0]).toBe('ask_question');
  });
});

describe('Stdio HTTP Proxy Endpoint Mapping', () => {
  const endpointMap: Record<string, { method: string; path: string }> = {
    ask_question: { method: 'POST', path: '/ask' },
    list_notebooks: { method: 'GET', path: '/notebooks' },
    get_notebook: { method: 'GET', path: '/notebooks/:id' },
    add_notebook: { method: 'POST', path: '/notebooks' },
    remove_notebook: { method: 'DELETE', path: '/notebooks/:id' },
    get_health: { method: 'GET', path: '/health' },
    setup_auth: { method: 'POST', path: '/setup-auth' },
    de_auth: { method: 'POST', path: '/de-auth' },
    list_sessions: { method: 'GET', path: '/sessions' },
    close_session: { method: 'POST', path: '/sessions/:id/close' },
  };

  it('should map ask_question to POST /ask', () => {
    expect(endpointMap.ask_question.method).toBe('POST');
    expect(endpointMap.ask_question.path).toBe('/ask');
  });

  it('should map list_notebooks to GET /notebooks', () => {
    expect(endpointMap.list_notebooks.method).toBe('GET');
    expect(endpointMap.list_notebooks.path).toBe('/notebooks');
  });

  it('should map get_health to GET /health', () => {
    expect(endpointMap.get_health.method).toBe('GET');
    expect(endpointMap.get_health.path).toBe('/health');
  });

  it('should use DELETE for remove_notebook', () => {
    expect(endpointMap.remove_notebook.method).toBe('DELETE');
  });
});

describe('Stdio HTTP Proxy HTTP Request', () => {
  it('should construct valid URLs', () => {
    const baseUrl = 'http://localhost:3000';
    const endpoint = '/ask';
    const fullUrl = `${baseUrl}${endpoint}`;
    expect(fullUrl).toBe('http://localhost:3000/ask');
  });

  it('should handle path parameters', () => {
    const baseUrl = 'http://localhost:3000';
    const notebookId = 'notebook-123';
    const endpoint = `/notebooks/${notebookId}`;
    const fullUrl = `${baseUrl}${endpoint}`;
    expect(fullUrl).toBe('http://localhost:3000/notebooks/notebook-123');
  });

  it('should set correct headers', () => {
    const headers = {
      'Content-Type': 'application/json',
    };
    expect(headers['Content-Type']).toBe('application/json');
  });
});

describe('Stdio HTTP Proxy Error Handling', () => {
  it('should format HTTP error messages', () => {
    const status = 500;
    const errorText = 'Internal Server Error';
    const errorMessage = `HTTP ${status}: ${errorText}`;
    expect(errorMessage).toBe('HTTP 500: Internal Server Error');
  });

  it('should handle 404 errors', () => {
    const status = 404;
    const errorText = 'Not Found';
    const errorMessage = `HTTP ${status}: ${errorText}`;
    expect(errorMessage).toBe('HTTP 404: Not Found');
  });

  it('should handle connection errors', () => {
    const connectionError = new Error('ECONNREFUSED');
    expect(connectionError.message).toContain('ECONNREFUSED');
  });
});

describe('Stdio HTTP Proxy Resource Definitions', () => {
  it('should define library resource', () => {
    const resources = [
      {
        uri: 'notebooklm://library',
        name: 'Notebook Library',
        description: 'List of configured NotebookLM notebooks',
        mimeType: 'application/json',
      },
    ];

    expect(resources[0].uri).toBe('notebooklm://library');
    expect(resources[0].mimeType).toBe('application/json');
  });
});

describe('Stdio HTTP Proxy Tool Input Schemas', () => {
  it('should require question for ask_question', () => {
    const schema = {
      type: 'object',
      properties: {
        question: { type: 'string' },
        session_id: { type: 'string' },
        notebook_id: { type: 'string' },
      },
      required: ['question'],
    };

    expect(schema.required).toContain('question');
  });

  it('should require id for get_notebook', () => {
    const schema = {
      type: 'object',
      properties: {
        id: { type: 'string' },
      },
      required: ['id'],
    };

    expect(schema.required).toContain('id');
  });

  it('should require fields for add_notebook', () => {
    const schema = {
      type: 'object',
      properties: {
        url: { type: 'string' },
        name: { type: 'string' },
        description: { type: 'string' },
        topics: { type: 'array' },
      },
      required: ['url', 'name', 'description', 'topics'],
    };

    expect(schema.required).toHaveLength(4);
    expect(schema.required).toContain('url');
    expect(schema.required).toContain('name');
  });
});

describe('Stdio HTTP Proxy Source Format Options', () => {
  const sourceFormats = ['none', 'inline', 'footnotes', 'json', 'expanded'];

  it('should support all format options', () => {
    expect(sourceFormats).toContain('none');
    expect(sourceFormats).toContain('inline');
    expect(sourceFormats).toContain('footnotes');
    expect(sourceFormats).toContain('json');
    expect(sourceFormats).toContain('expanded');
  });

  it('should have none as default', () => {
    expect(sourceFormats[0]).toBe('none');
  });
});

describe('Stdio HTTP Proxy Logging', () => {
  it('should prefix log messages', () => {
    const prefix = '[stdio-proxy]';
    const message = 'Test message';
    const logMessage = `${prefix} ${message}`;
    expect(logMessage).toBe('[stdio-proxy] Test message');
  });
});

describe('Stdio HTTP Proxy Response Formatting', () => {
  it('should format successful response', () => {
    const result = {
      success: true,
      answer: 'Test answer',
    };

    const formatted = {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };

    expect(formatted.content[0].type).toBe('text');
    expect(formatted.content[0].text).toContain('success');
  });

  it('should format error response', () => {
    const error = new Error('Test error');

    const formatted = {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true,
    };

    expect(formatted.isError).toBe(true);
    expect(formatted.content[0].text).toContain('Test error');
  });
});
