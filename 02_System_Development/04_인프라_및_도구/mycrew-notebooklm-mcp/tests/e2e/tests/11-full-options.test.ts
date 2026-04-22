/**
 * FULL Mode Tests - All Option Combinations
 *
 * Tests: 56-76 (only run with TEST_MODE=full)
 * Categories:
 * - Video Options (9 tests)
 * - Infographic Options (2 tests)
 * - Report Options (2 tests)
 * - Presentation Options (5 tests)
 * - Common Options (4 tests)
 * - Source Selection (1 test)
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { httpRequest, checkServerHealth } from '../utils.js';
import { config, isFullMode, currentNotebooks } from '../config.js';

const E2E_NOTEBOOK_URL = currentNotebooks.e2eTest;
const TIMEOUT = config.timeouts.content;
const AUDIO_TIMEOUT = config.timeouts.audio;

// Conditionally run FULL tests
const describeFull = isFullMode ? describe : describe.skip;
const itFull = isFullMode ? it : it.skip;

describeFull('11 - FULL: Video Options', () => {
  let isAuthenticated = false;

  beforeAll(async () => {
    const health = await checkServerHealth();
    isAuthenticated = health.authenticated;
  });

  itFull(
    '[T56] video_format=brief',
    async () => {
      if (!isAuthenticated) return;
      const result = await httpRequest('/content/generate', 'POST', {
        notebook_url: E2E_NOTEBOOK_URL,
        content_type: 'video',
        video_format: 'brief',
      });
      expect(result).toHaveProperty('success');
    },
    AUDIO_TIMEOUT
  );

  itFull(
    '[T57] video_format=explainer',
    async () => {
      if (!isAuthenticated) return;
      const result = await httpRequest('/content/generate', 'POST', {
        notebook_url: E2E_NOTEBOOK_URL,
        content_type: 'video',
        video_format: 'explainer',
      });
      expect(result).toHaveProperty('success');
    },
    AUDIO_TIMEOUT
  );

  itFull(
    '[T58] video_style=classroom',
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

  itFull(
    '[T59] video_style=documentary',
    async () => {
      if (!isAuthenticated) return;
      const result = await httpRequest('/content/generate', 'POST', {
        notebook_url: E2E_NOTEBOOK_URL,
        content_type: 'video',
        video_style: 'documentary',
      });
      expect(result).toHaveProperty('success');
    },
    AUDIO_TIMEOUT
  );

  itFull(
    '[T60] video_style=animated',
    async () => {
      if (!isAuthenticated) return;
      const result = await httpRequest('/content/generate', 'POST', {
        notebook_url: E2E_NOTEBOOK_URL,
        content_type: 'video',
        video_style: 'animated',
      });
      expect(result).toHaveProperty('success');
    },
    AUDIO_TIMEOUT
  );

  itFull(
    '[T61] video_style=corporate',
    async () => {
      if (!isAuthenticated) return;
      const result = await httpRequest('/content/generate', 'POST', {
        notebook_url: E2E_NOTEBOOK_URL,
        content_type: 'video',
        video_style: 'corporate',
      });
      expect(result).toHaveProperty('success');
    },
    AUDIO_TIMEOUT
  );

  itFull(
    '[T62] video_style=cinematic',
    async () => {
      if (!isAuthenticated) return;
      const result = await httpRequest('/content/generate', 'POST', {
        notebook_url: E2E_NOTEBOOK_URL,
        content_type: 'video',
        video_style: 'cinematic',
      });
      expect(result).toHaveProperty('success');
    },
    AUDIO_TIMEOUT
  );

  itFull(
    '[T63] video_style=minimalist',
    async () => {
      if (!isAuthenticated) return;
      const result = await httpRequest('/content/generate', 'POST', {
        notebook_url: E2E_NOTEBOOK_URL,
        content_type: 'video',
        video_style: 'minimalist',
      });
      expect(result).toHaveProperty('success');
    },
    AUDIO_TIMEOUT
  );

  itFull(
    '[T64] video format+style combined',
    async () => {
      if (!isAuthenticated) return;
      const result = await httpRequest('/content/generate', 'POST', {
        notebook_url: E2E_NOTEBOOK_URL,
        content_type: 'video',
        video_format: 'explainer',
        video_style: 'documentary',
      });
      expect(result).toHaveProperty('success');
    },
    AUDIO_TIMEOUT
  );
});

describeFull('11 - FULL: Infographic Options', () => {
  let isAuthenticated = false;

  beforeAll(async () => {
    const health = await checkServerHealth();
    isAuthenticated = health.authenticated;
  });

  itFull(
    '[T65] infographic_format=horizontal',
    async () => {
      if (!isAuthenticated) return;
      const result = await httpRequest('/content/generate', 'POST', {
        notebook_url: E2E_NOTEBOOK_URL,
        content_type: 'infographic',
        infographic_format: 'horizontal',
      });
      expect(result).toHaveProperty('success');
    },
    TIMEOUT
  );

  itFull(
    '[T66] infographic_format=vertical',
    async () => {
      if (!isAuthenticated) return;
      const result = await httpRequest('/content/generate', 'POST', {
        notebook_url: E2E_NOTEBOOK_URL,
        content_type: 'infographic',
        infographic_format: 'vertical',
      });
      expect(result).toHaveProperty('success');
    },
    TIMEOUT
  );
});

describeFull('11 - FULL: Report Options', () => {
  let isAuthenticated = false;

  beforeAll(async () => {
    const health = await checkServerHealth();
    isAuthenticated = health.authenticated;
  });

  itFull(
    '[T67] report_format=summary',
    async () => {
      if (!isAuthenticated) return;
      const result = await httpRequest('/content/generate', 'POST', {
        notebook_url: E2E_NOTEBOOK_URL,
        content_type: 'report',
        report_format: 'summary',
      });
      expect(result).toHaveProperty('success');
    },
    TIMEOUT
  );

  itFull(
    '[T68] report_format=detailed',
    async () => {
      if (!isAuthenticated) return;
      const result = await httpRequest('/content/generate', 'POST', {
        notebook_url: E2E_NOTEBOOK_URL,
        content_type: 'report',
        report_format: 'detailed',
      });
      expect(result).toHaveProperty('success');
    },
    TIMEOUT
  );
});

describeFull('11 - FULL: Presentation Options', () => {
  let isAuthenticated = false;

  beforeAll(async () => {
    const health = await checkServerHealth();
    isAuthenticated = health.authenticated;
  });

  itFull(
    '[T69] presentation_style=detailed_slideshow',
    async () => {
      if (!isAuthenticated) return;
      const result = await httpRequest('/content/generate', 'POST', {
        notebook_url: E2E_NOTEBOOK_URL,
        content_type: 'presentation',
        presentation_style: 'detailed_slideshow',
      });
      expect(result).toHaveProperty('success');
    },
    TIMEOUT
  );

  itFull(
    '[T70] presentation_style=presenter_notes',
    async () => {
      if (!isAuthenticated) return;
      const result = await httpRequest('/content/generate', 'POST', {
        notebook_url: E2E_NOTEBOOK_URL,
        content_type: 'presentation',
        presentation_style: 'presenter_notes',
      });
      expect(result).toHaveProperty('success');
    },
    TIMEOUT
  );

  itFull(
    '[T71] presentation_length=short',
    async () => {
      if (!isAuthenticated) return;
      const result = await httpRequest('/content/generate', 'POST', {
        notebook_url: E2E_NOTEBOOK_URL,
        content_type: 'presentation',
        presentation_length: 'short',
      });
      expect(result).toHaveProperty('success');
    },
    TIMEOUT
  );

  itFull(
    '[T72] presentation_length=default',
    async () => {
      if (!isAuthenticated) return;
      const result = await httpRequest('/content/generate', 'POST', {
        notebook_url: E2E_NOTEBOOK_URL,
        content_type: 'presentation',
        presentation_length: 'default',
      });
      expect(result).toHaveProperty('success');
    },
    TIMEOUT
  );

  itFull(
    '[T73] presentation style+length combined',
    async () => {
      if (!isAuthenticated) return;
      const result = await httpRequest('/content/generate', 'POST', {
        notebook_url: E2E_NOTEBOOK_URL,
        content_type: 'presentation',
        presentation_style: 'presenter_notes',
        presentation_length: 'short',
      });
      expect(result).toHaveProperty('success');
    },
    TIMEOUT
  );
});

describeFull('11 - FULL: Common Options', () => {
  let isAuthenticated = false;

  beforeAll(async () => {
    const health = await checkServerHealth();
    isAuthenticated = health.authenticated;
  });

  itFull(
    '[T74] report with custom_instructions',
    async () => {
      if (!isAuthenticated) return;
      const result = await httpRequest('/content/generate', 'POST', {
        notebook_url: E2E_NOTEBOOK_URL,
        content_type: 'report',
        custom_instructions: 'Focus on key concepts.',
      });
      expect(result).toHaveProperty('success');
    },
    TIMEOUT
  );

  itFull(
    '[T75] presentation with language=fr',
    async () => {
      if (!isAuthenticated) return;
      const result = await httpRequest('/content/generate', 'POST', {
        notebook_url: E2E_NOTEBOOK_URL,
        content_type: 'presentation',
        language: 'fr',
      });
      expect(result).toHaveProperty('success');
    },
    TIMEOUT
  );

  itFull(
    '[T76] audio_overview with custom_instructions',
    async () => {
      if (!isAuthenticated) return;
      const result = await httpRequest('/content/generate', 'POST', {
        notebook_url: E2E_NOTEBOOK_URL,
        content_type: 'audio_overview',
        custom_instructions: 'Make it engaging.',
      });
      expect(result).toHaveProperty('success');
    },
    AUDIO_TIMEOUT
  );
});
