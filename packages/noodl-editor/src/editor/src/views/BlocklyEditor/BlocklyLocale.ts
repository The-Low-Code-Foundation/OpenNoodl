/**
 * Language for the Logic Builder block editor.
 *
 * Blockly ships translations for every standard block, so the text a learner actually reads
 * — "repeat 10 times", "set item to", "if / else" — is localised for free once the right
 * message bundle is loaded. That matters more here than anywhere else in the editor: the
 * audience for a block editor is people who are learning, often in their first language, and
 * often not in English.
 *
 * Two things are localised:
 *  - the block text, by Blockly, from `blockly/msg/<code>`;
 *  - our own toolbox category names, from `BlocklyToolbox.toolboxLabelsFor`. Blockly has no
 *    messages for these — they are our strings. A language with no entry falls back to English
 *    category names while still getting localised block text, which is the right trade: partial
 *    translation beats none, and it is obvious what is missing.
 *
 * 🔴 **The category-name table lives in `BlocklyToolbox.ts`, not here, and that is a testability
 * decision.** This module imports `@noodl-utils/editorsettings`, which does not resolve under
 * `tests-unit` — so for as long as the table lived here, **nothing could grade the translations
 * at all**, and FIX-005's rename of one label across six languages would have been ungated.
 * `BlocklyToolbox.ts` imports nothing that cannot be reached from a plain-Node runner, which is
 * the same reason `convertModes.ts` and `objectData.ts` exist.
 *
 * Each bundle is a separate `import()`, so exactly one language's messages are ever fetched.
 *
 * @module BlocklyEditor
 */

import { EditorSettings } from '@noodl-utils/editorsettings';

import { DEFAULT_TOOLBOX_LABELS, ToolboxLabels, toolboxLabelsFor } from './BlocklyToolbox';

/** Editor-settings key holding the chosen language, or `'system'`. */
export const BLOCK_LANGUAGE_SETTINGS_KEY = 'blockEditor.language';

/** `'system'` follows the OS/app locale; anything else pins a language. */
export type BlockLanguage = 'system' | string;

/**
 * The languages we offer, by Blockly message-bundle code. Native names, because a language
 * picker that lists languages in a language you cannot read is not a picker.
 */
export const SUPPORTED_LANGUAGES: { code: string; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' },
  { code: 'de', label: 'Deutsch' },
  { code: 'it', label: 'Italiano' },
  { code: 'pt-br', label: 'Português (Brasil)' },
  { code: 'nl', label: 'Nederlands' },
  { code: 'pl', label: 'Polski' },
  { code: 'sv', label: 'Svenska' },
  { code: 'da', label: 'Dansk' },
  { code: 'fi', label: 'Suomi' },
  { code: 'tr', label: 'Türkçe' },
  { code: 'cs', label: 'Čeština' },
  { code: 'el', label: 'Ελληνικά' },
  { code: 'ro', label: 'Română' },
  { code: 'uk', label: 'Українська' },
  { code: 'ru', label: 'Русский' },
  { code: 'ar', label: 'العربية' },
  { code: 'he', label: 'עברית' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'id', label: 'Bahasa Indonesia' },
  { code: 'vi', label: 'Tiếng Việt' },
  { code: 'th', label: 'ไทย' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'zh-hans', label: '简体中文' },
  { code: 'zh-hant', label: '繁體中文' }
];

/**
 * Message-bundle loaders. Written out one by one rather than as a computed
 * `import(\`blockly/msg/${code}\`)` so webpack emits one predictable chunk per language
 * instead of a context module over all 125 of Blockly's locales.
 */
// `Promise<unknown>`: each import resolves to a module namespace whose members are the
// message strings, plus a `default` re-export. `setLocale` copies the string members and
// ignores the rest, so the namespace goes in as-is rather than being reshaped here.
const MESSAGE_LOADERS: Record<string, () => Promise<unknown>> = {
  en: () => import('blockly/msg/en'),
  fr: () => import('blockly/msg/fr'),
  es: () => import('blockly/msg/es'),
  de: () => import('blockly/msg/de'),
  it: () => import('blockly/msg/it'),
  'pt-br': () => import('blockly/msg/pt-br'),
  nl: () => import('blockly/msg/nl'),
  pl: () => import('blockly/msg/pl'),
  sv: () => import('blockly/msg/sv'),
  da: () => import('blockly/msg/da'),
  fi: () => import('blockly/msg/fi'),
  tr: () => import('blockly/msg/tr'),
  cs: () => import('blockly/msg/cs'),
  el: () => import('blockly/msg/el'),
  ro: () => import('blockly/msg/ro'),
  uk: () => import('blockly/msg/uk'),
  ru: () => import('blockly/msg/ru'),
  ar: () => import('blockly/msg/ar'),
  he: () => import('blockly/msg/he'),
  hi: () => import('blockly/msg/hi'),
  id: () => import('blockly/msg/id'),
  vi: () => import('blockly/msg/vi'),
  th: () => import('blockly/msg/th'),
  ja: () => import('blockly/msg/ja'),
  ko: () => import('blockly/msg/ko'),
  'zh-hans': () => import('blockly/msg/zh-hans'),
  'zh-hant': () => import('blockly/msg/zh-hant')
};

/**
 * Map a BCP-47 tag onto a supported bundle: exact match, then the Chinese script variants,
 * then the bare language subtag. `fr-CA` lands on `fr`; anything unknown lands on English.
 */
export function resolveLanguageCode(tag: string | undefined | null): string {
  if (!tag) return 'en';

  const lower = tag.toLowerCase();
  if (MESSAGE_LOADERS[lower]) return lower;

  if (lower.startsWith('zh')) {
    return /hant|tw|hk|mo/.test(lower) ? 'zh-hant' : 'zh-hans';
  }
  if (lower.startsWith('pt')) return 'pt-br';

  const base = lower.split('-')[0];
  return MESSAGE_LOADERS[base] ? base : 'en';
}

/** The language actually in force: the pinned setting, else the app locale. */
export function currentLanguageCode(): string {
  const saved = EditorSettings.instance.get(BLOCK_LANGUAGE_SETTINGS_KEY);

  if (typeof saved === 'string' && saved !== 'system') {
    return resolveLanguageCode(saved);
  }

  return resolveLanguageCode(typeof navigator !== 'undefined' ? navigator.language : undefined);
}

/**
 * Load and apply a language, returning the toolbox labels to build the toolbox with.
 *
 * Applies globally — `Blockly.setLocale` mutates the shared `Blockly.Msg` table, so every
 * open workspace shows the new language once it re-renders. Falls back to English rather
 * than throwing: a missing translation must never stop the editor from opening.
 */
export async function applyLanguage(code: string): Promise<ToolboxLabels> {
  const resolved = MESSAGE_LOADERS[code] ? code : 'en';

  try {
    // Blockly itself is imported dynamically here too: the Settings panel imports this
    // module for its language list, and it must not pull the library into the main bundle.
    const [Blockly, messages] = await Promise.all([import('blockly'), MESSAGE_LOADERS[resolved]()]);
    Blockly.setLocale(messages as unknown as { [key: string]: string });
  } catch (error) {
    console.error('[Blockly] Could not load messages for language', resolved, error);
    return DEFAULT_TOOLBOX_LABELS;
  }

  return toolboxLabelsFor(resolved);
}

