/**
 * The full-text search config model, pure form (BAK-008).
 *
 * `search.json` lives beside `security.json` in the data dir, same shared-file
 * convention (see security/state.ts and config/SecretsStore's doc comment):
 * per-collection opt-in FTS5 search. Unknown keys are errors, not warnings —
 * the same "an accepted-and-ignored config field is a bug, not a feature"
 * stance BAK-003's security config takes.
 *
 * @module nodegx-backend/search/model
 */

/** Per-collection search config. `fields` are real column names to index. */
export interface CollectionSearchConfig {
  enabled: boolean;
  fields: string[];
  /** FTS5 tokenizer name. Defaults to 'unicode61' if omitted. */
  tokenizer?: string;
}

export interface SearchConfig {
  version: 1;
  collections: Record<string, CollectionSearchConfig>;
}

export function defaultSearchConfig(): SearchConfig {
  return { version: 1, collections: {} };
}

/**
 * Tokenizers this build accepts. unicode61 is the default and the only one
 * documented/exercised by tests (BAK-008 scope: no language-specific stemming
 * promises) — the others are valid FTS5 tokenizers SQLite ships and are
 * accepted so an advanced config isn't rejected outright, but are not
 * verified here.
 */
export const SUPPORTED_TOKENIZERS = ['unicode61', 'ascii', 'porter', 'trigram'] as const;

const FIELD_NAME_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/**
 * Strict validation: unknown keys anywhere are errors. Returns a list of error
 * strings; empty = valid.
 */
export function validateSearchConfig(raw: unknown): string[] {
  const errors: string[] = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return ['search config must be a JSON object'];
  }
  const cfg = raw as Record<string, unknown>;

  const TOP_KEYS = new Set(['version', 'collections']);
  for (const key of Object.keys(cfg)) {
    if (!TOP_KEYS.has(key)) errors.push(`unknown top-level key "${key}"`);
  }
  if (cfg.version !== 1) errors.push(`unsupported version ${JSON.stringify(cfg.version)} (expected 1)`);

  const collections = cfg.collections as Record<string, unknown> | undefined;
  if (!collections || typeof collections !== 'object' || Array.isArray(collections)) {
    errors.push('collections must be an object');
    return errors;
  }

  for (const [name, entry] of Object.entries(collections)) {
    if (name.startsWith('_')) {
      errors.push(`collections.${name}: system collections cannot carry a search config`);
      continue;
    }
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      errors.push(`collections.${name} must be an object`);
      continue;
    }
    const e = entry as Record<string, unknown>;
    for (const key of Object.keys(e)) {
      if (key !== 'enabled' && key !== 'fields' && key !== 'tokenizer') {
        errors.push(`unknown key "${key}" in collections.${name}`);
      }
    }
    if (typeof e.enabled !== 'boolean') {
      errors.push(`collections.${name}.enabled must be a boolean`);
    }
    if (!Array.isArray(e.fields) || e.fields.some((f) => typeof f !== 'string')) {
      errors.push(`collections.${name}.fields must be an array of strings`);
    } else {
      if (e.enabled === true && e.fields.length === 0) {
        errors.push(`collections.${name}.fields must be non-empty when enabled`);
      }
      for (const f of e.fields as string[]) {
        if (!FIELD_NAME_RE.test(f)) {
          errors.push(`collections.${name}.fields: "${f}" is not a valid column name`);
        }
      }
    }
    if (e.tokenizer !== undefined) {
      if (typeof e.tokenizer !== 'string' || !(SUPPORTED_TOKENIZERS as readonly string[]).includes(e.tokenizer)) {
        errors.push(
          `collections.${name}.tokenizer: unknown tokenizer ${JSON.stringify(e.tokenizer)} ` +
            `(expected one of ${SUPPORTED_TOKENIZERS.join(', ')})`
        );
      }
    }
  }

  return errors;
}
