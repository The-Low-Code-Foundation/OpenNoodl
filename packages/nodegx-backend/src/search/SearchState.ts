/**
 * SearchState — search.json wired to disk (BAK-008).
 *
 * Mirrors security/state.ts's SecurityState shape deliberately: a JSON policy
 * file in the data dir, strictly validated on load (an invalid file refuses to
 * start rather than running with a config that silently isn't what's on disk),
 * atomic writes, migrate-on-first-run. This is the ONE source of truth for
 * "which collections have search enabled, on which fields" — the admin HTTP
 * routes, the MCP tools, and startup reconciliation (SearchIndexer) all read
 * and write through this class so they cannot drift from each other.
 *
 * @module nodegx-backend/search/SearchState
 */

import * as fs from 'fs';
import * as path from 'path';

import { CollectionSearchConfig, SearchConfig, defaultSearchConfig, validateSearchConfig } from './model';

export class SearchStartupError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'SearchStartupError';
    this.code = code;
  }
}

const SEARCH_FILE = 'search.json';

function atomicWriteJSON(filePath: string, value: unknown): void {
  const tmp = `${filePath}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n');
  fs.renameSync(tmp, filePath);
}

export class SearchState {
  readonly config: SearchConfig;
  /** True when the default config was just written (first-run notice, mirrors SecurityState). */
  readonly migratedThisStart: boolean;
  private readonly dataDir: string;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    const configPath = path.join(dataDir, SEARCH_FILE);

    if (fs.existsSync(configPath)) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      } catch (e) {
        throw new SearchStartupError(
          'SEARCH_CONFIG_INVALID',
          `${configPath} is not valid JSON: ${e instanceof Error ? e.message : e}`
        );
      }
      const errors = validateSearchConfig(parsed);
      if (errors.length > 0) {
        throw new SearchStartupError(
          'SEARCH_CONFIG_INVALID',
          `${configPath} is invalid — refusing to start with a search config that would not be fully honored:\n` +
            errors.map((e) => `  - ${e}`).join('\n')
        );
      }
      this.config = parsed as SearchConfig;
      this.migratedThisStart = false;
    } else {
      this.config = defaultSearchConfig();
      fs.mkdirSync(dataDir, { recursive: true });
      atomicWriteJSON(configPath, this.config);
      this.migratedThisStart = true;
    }
  }

  /** Persist the (mutated) config. Callers mutate this.config then save(), or use setCollection/removeCollection below. */
  save(): void {
    atomicWriteJSON(path.join(this.dataDir, SEARCH_FILE), this.config);
  }

  configFor(collection: string): CollectionSearchConfig | undefined {
    return this.config.collections[collection];
  }

  isEnabled(collection: string): boolean {
    const c = this.config.collections[collection];
    return Boolean(c && c.enabled);
  }

  /** Collections with search currently enabled — the reconciliation set at startup. */
  enabledCollections(): string[] {
    return Object.keys(this.config.collections).filter((name) => this.config.collections[name].enabled);
  }

  /** Set (or replace) one collection's search config, validated against the whole doc. */
  setCollection(name: string, entry: CollectionSearchConfig): void {
    const candidate: SearchConfig = {
      ...this.config,
      collections: { ...this.config.collections, [name]: entry }
    };
    const errors = validateSearchConfig(candidate);
    if (errors.length > 0) {
      throw new Error(`Invalid search config for "${name}":\n${errors.map((e) => `- ${e}`).join('\n')}`);
    }
    this.config.collections[name] = entry;
    this.save();
  }

  /** Remove a collection's search config entirely (search.json no longer mentions it). */
  removeCollection(name: string): boolean {
    const existed = this.config.collections[name] !== undefined;
    delete this.config.collections[name];
    this.save();
    return existed;
  }
}
