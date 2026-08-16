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
 *  - our own toolbox category names, from {@link TOOLBOX_LABELS}. Blockly has no messages for
 *    these — they are our strings. A language with no entry falls back to English category
 *    names while still getting localised block text, which is the right trade: partial
 *    translation beats none, and it is obvious what is missing.
 *
 * Each bundle is a separate `import()`, so exactly one language's messages are ever fetched.
 *
 * @module BlocklyEditor
 */

import { EditorSettings } from '@noodl-utils/editorsettings';

import { DEFAULT_TOOLBOX_LABELS, ToolboxLabels } from './BlocklyToolbox';

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
 * Toolbox category names per language. Only languages translated with confidence appear
 * here; the rest fall back to {@link DEFAULT_TOOLBOX_LABELS}.
 */
const TOOLBOX_LABELS: Record<string, ToolboxLabels> = {
  fr: {
    noodlInputsOutputs: 'Entrées / Sorties',
    noodlSignals: 'Signaux',
    noodlVariables: "Variables d'exécution",
    noodlObjects: "Objets de l'app",
    noodlArrays: "Tableaux de l'app",
    noodlAppConfig: "Config de l'app",
    noodlLibraries: 'Bibliothèques & navigateur',
    logic: 'Logique',
    loops: 'Boucles',
    math: 'Maths',
    text: 'Texte',
    lists: 'Listes',
    debug: 'Débogage',
    variables: 'Variables',
    functions: 'Fonctions',
    myBlocks: 'Mes blocs'
  },
  es: {
    noodlInputsOutputs: 'Entradas / Salidas',
    noodlSignals: 'Señales',
    noodlVariables: 'Variables de ejecución',
    noodlObjects: 'Objetos de la app',
    noodlArrays: 'Arreglos de la app',
    noodlAppConfig: 'Config de la app',
    noodlLibraries: 'Bibliotecas y navegador',
    logic: 'Lógica',
    loops: 'Bucles',
    math: 'Matemáticas',
    text: 'Texto',
    lists: 'Listas',
    debug: 'Depuración',
    variables: 'Variables',
    functions: 'Funciones',
    myBlocks: 'Mis bloques'
  },
  de: {
    noodlInputsOutputs: 'Eingänge / Ausgänge',
    noodlSignals: 'Signale',
    noodlVariables: 'Laufzeit-Variablen',
    noodlObjects: 'App-Objekte',
    noodlArrays: 'App-Arrays',
    noodlAppConfig: 'App-Konfiguration',
    noodlLibraries: 'Bibliotheken & Browser',
    logic: 'Logik',
    loops: 'Schleifen',
    math: 'Mathematik',
    text: 'Text',
    lists: 'Listen',
    debug: 'Debug',
    variables: 'Variablen',
    functions: 'Funktionen',
    myBlocks: 'Meine Blöcke'
  },
  it: {
    noodlInputsOutputs: 'Ingressi / Uscite',
    noodlSignals: 'Segnali',
    noodlVariables: 'Variabili di runtime',
    noodlObjects: "Oggetti dell'app",
    noodlArrays: "Array dell'app",
    noodlAppConfig: "Config dell'app",
    noodlLibraries: 'Librerie e browser',
    logic: 'Logica',
    loops: 'Cicli',
    math: 'Matematica',
    text: 'Testo',
    lists: 'Liste',
    debug: 'Debug',
    variables: 'Variabili',
    functions: 'Funzioni',
    myBlocks: 'I miei blocchi'
  },
  nl: {
    noodlInputsOutputs: 'Invoer / Uitvoer',
    noodlSignals: 'Signalen',
    noodlVariables: 'Runtime-variabelen',
    noodlObjects: 'App-objecten',
    noodlArrays: 'App-arrays',
    noodlAppConfig: 'App-configuratie',
    noodlLibraries: 'Bibliotheken & browser',
    logic: 'Logica',
    loops: 'Lussen',
    math: 'Wiskunde',
    text: 'Tekst',
    lists: 'Lijsten',
    debug: 'Debug',
    variables: 'Variabelen',
    functions: 'Functies',
    myBlocks: 'Mijn blokken'
  },
  'pt-br': {
    noodlInputsOutputs: 'Entradas / Saídas',
    noodlSignals: 'Sinais',
    noodlVariables: 'Variáveis de execução',
    noodlObjects: 'Objetos do app',
    noodlArrays: 'Arrays do app',
    noodlAppConfig: 'Config do app',
    noodlLibraries: 'Bibliotecas e navegador',
    logic: 'Lógica',
    loops: 'Laços',
    math: 'Matemática',
    text: 'Texto',
    lists: 'Listas',
    debug: 'Depuração',
    variables: 'Variáveis',
    functions: 'Funções',
    myBlocks: 'Meus blocos'
  }
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

  return TOOLBOX_LABELS[resolved] || DEFAULT_TOOLBOX_LABELS;
}
