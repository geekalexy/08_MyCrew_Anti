# Adding a New Language

This guide explains how to add support for a new UI language in NotebookLM MCP.

## Overview

NotebookLM MCP uses an i18n (internationalization) system to support multiple UI languages. The system works by:

1. Detecting UI elements based on localized text selectors
2. Allowing users to switch between supported languages
3. Building bilingual/multilingual selectors for elements that might appear in different languages

## Current Supported Languages

| Language | Code | File               |
| -------- | ---- | ------------------ |
| French   | `fr` | `src/i18n/fr.json` |
| English  | `en` | `src/i18n/en.json` |

## Adding a New Language

### Step 1: Create the Locale File

Create a new JSON file in `src/i18n/` with the language code (e.g., `de.json` for German):

```bash
cp src/i18n/en.json src/i18n/de.json
```

### Step 2: Translate All Strings

Edit the new file and translate all strings. The structure must match exactly:

```json
{
  "locale": "de",
  "name": "Deutsch",
  "description": "German UI selectors for NotebookLM",

  "tabs": {
    "sources": "Quellen",
    "discussion": "Diskussion",
    "studio": "Studio"
  },

  "buttons": {
    "addSource": "Quelle hinzufügen",
    "addNote": "Notiz hinzufügen"
    // ... all other buttons
  }

  // ... translate all sections
}
```

**Important sections to translate:**

- `tabs` - Main navigation tabs
- `buttons` - All button labels
- `sourceTypes` - Source type menu items
- `placeholders` - Input placeholders
- `contentTypes` - Content generation types (Audio, Video, etc.)
- `contentOptions` - Video styles, presentation lengths, etc.
- `dialogs` - Dialog labels
- `actions` - Action menu items
- `status` - Status messages
- `errors` - Error messages

### Step 3: Update the Type Definition

Edit `src/i18n/index.ts` to add the new locale to the supported types:

```typescript
// Line ~106
export type SupportedLocale = 'fr' | 'en' | 'de'; // Add new code

// Line ~203-205
export function getSupportedLocales(): SupportedLocale[] {
  return ['fr', 'en', 'de']; // Add new code
}
```

### Step 4: Configure Build to Copy Locale Files

Ensure the build process copies JSON files to `dist/i18n/`. Check `tsconfig.json`:

```json
{
  "compilerOptions": {
    // ...
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

The locale files are copied via a post-build script. Verify in `package.json`:

```json
{
  "scripts": {
    "build": "tsc && npm run copy-i18n",
    "copy-i18n": "cp src/i18n/*.json dist/i18n/"
  }
}
```

### Step 5: Test the New Language

1. **Set up a test account** with the Google Account language set to the new language
2. **Run the switch script**:
   ```bash
   ./scripts/switch-account-language.sh --account=your-account --lang=de --show
   ```
3. **Verify visually** that NotebookLM UI appears in the new language
4. **Run E2E tests**:
   ```bash
   ./tests/e2e/run-e2e.sh --lang=de --account=your-account
   ```

### Step 6: Update Documentation

1. Update `README.md` to list the new supported language
2. Update this file to include the new language in the table
3. Update `tests/e2e/config.ts` to add the new language type

## Finding NotebookLM UI Strings

To find the correct translations for NotebookLM UI elements:

1. **Set your Google Account** to the target language
2. **Open NotebookLM** in a browser
3. **Inspect elements** to find exact text strings used
4. **Take screenshots** for reference

Common places to check:

- Tab names (Sources, Chat/Discussion, Studio)
- "Add source" button and menu
- Content generation buttons in Studio
- Dialog buttons (Cancel, Confirm, etc.)
- Error messages

## Environment Variable

The UI locale is set via environment variable:

```bash
# Set locale when starting the server
NOTEBOOKLM_UI_LOCALE=de node dist/http-wrapper.js

# Or in the start command
cmd.exe /c "cd /d D:\\path\\to\\project && set NOTEBOOKLM_UI_LOCALE=de&& node dist/http-wrapper.js"
```

## Bilingual Selector System

The i18n system includes a `SelectorBuilder` class that generates selectors for all supported languages:

```typescript
import { selectors, tAll } from './i18n/index.js';

// Build a selector that matches button text in all languages
const addSourceSelectors = selectors().buttonWithText('addSource').build();
// Returns: ['button:has-text("Ajouter une source")', 'button:has-text("Add source")', ...]

// Get translated text in all languages
const texts = tAll('buttons', 'addSource');
// Returns: ['Ajouter une source', 'Add source', ...]
```

This ensures the automation works regardless of the user's NotebookLM language setting.

## Troubleshooting

### Selectors not matching

1. Check that the translated strings match **exactly** what NotebookLM displays
2. NotebookLM may use different strings in different contexts
3. Some UI elements use aria-labels instead of visible text

### Language not changing

1. The Google Account language must be changed first
2. The Chrome profile must be regenerated (delete and re-authenticate)
3. Check server logs for `🌐 Locale set to: XX`

### Build errors

1. Ensure JSON file is valid (no trailing commas, proper quotes)
2. Ensure all required keys are present
3. Run `npm run build` and check for TypeScript errors

## File Structure

```
src/i18n/
├── index.ts      # i18n system code
├── fr.json       # French translations
├── en.json       # English translations
└── de.json       # German translations (new)

scripts/
└── switch-account-language.sh  # Language switching script

tests/e2e/
├── config.ts     # Test configuration (includes TestLang type)
└── run-e2e.sh    # Test runner with --lang option
```
