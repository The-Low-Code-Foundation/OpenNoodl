/**
 * SearchIndexer — reconciles the SchemaManager's FTS5 shadow tables/triggers
 * with SearchState's config (BAK-008).
 *
 * This is the ONE place "enabling search" (or "fields changed") turns into a
 * schema operation — the admin HTTP routes and startup reconciliation both
 * call through it, so they cannot implement slightly different rebuild logic
 * that drifts apart. Also the one place the FTS5 capability check happens
 * before any schema mutation is attempted (loud-failure doctrine, RUN-004):
 * an engine without FTS5 throws SearchCapabilityError, which callers turn
 * into an explicit, non-degrading error surfaced in panel/status — never a
 * silent LIKE fallback.
 *
 * @module nodegx-backend/search/SearchIndexer
 */

import type { SchemaManagerLike } from '../persistence/SchemaManagerLike';
import type { SearchState } from './SearchState';
import type { CollectionSearchConfig } from './model';

export interface RebuildReport {
  tableName: string;
  fields: string[];
  tokenizer: string;
  rowsIndexed: number;
  elapsedMs: number;
}

/** Thrown when the engine cannot support search at all (no FTS5). */
export class SearchCapabilityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SearchCapabilityError';
  }
}

// The four methods this class needs are declared on the shared
// `SchemaManagerLike` (PLAT-004). This file used to carry its own copy of that
// interface — the second such copy in the package — which is how the same
// adapter got described twice, differently.

export class SearchIndexer {
  private readonly schemaManager: SchemaManagerLike | null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(schemaManager: SchemaManagerLike | null) {
    this.schemaManager = schemaManager || null;
  }

  /** The BAK-008 "verify first" check, live: does THIS running engine have FTS5? */
  hasFts5(): boolean {
    return Boolean(this.schemaManager && this.schemaManager.hasFts5Support());
  }

  private assertReady(): SchemaManagerLike {
    if (!this.schemaManager) {
      throw new Error('No schema manager available (persistence has not connected).');
    }
    if (!this.schemaManager.hasFts5Support()) {
      throw new SearchCapabilityError(
        'Full-text search requires the SQLite FTS5 extension, which this engine build does not have. ' +
          'Search cannot be enabled on this backend — there is no degraded/LIKE fallback by design ' +
          '(BAK-008). See BAK-008-NOTES.md for the engine finding.'
      );
    }
    return this.schemaManager;
  }

  hasIndex(collection: string): boolean {
    return Boolean(this.schemaManager && this.schemaManager.hasSearchIndex(collection));
  }

  /** (Re)build one collection's shadow table + triggers for its CURRENT config. Idempotent. */
  rebuild(collection: string, cfg: CollectionSearchConfig): RebuildReport {
    const sm = this.assertReady();
    return sm.rebuildSearchIndex(collection, cfg.fields, cfg.tokenizer || 'unicode61') as RebuildReport;
  }

  /** Drop a collection's shadow table + triggers. Safe when none exists. */
  drop(collection: string): void {
    if (this.schemaManager) this.schemaManager.dropSearchIndex(collection);
  }

  /**
   * Reconcile every enabled collection's shadow table against SearchState at
   * startup — the config on disk is authoritative, so a shadow table that
   * doesn't match it yet (fresh start, or a prior crash mid-config-change) is
   * brought into line. Throws SearchCapabilityError (loudly) if any enabled
   * collection cannot be honored on this engine — the service composition
   * root decides whether that is fatal or a startup warning (see service.ts).
   */
  reconcileAll(search: SearchState): RebuildReport[] {
    const reports: RebuildReport[] = [];
    for (const name of search.enabledCollections()) {
      const cfg = search.configFor(name);
      if (cfg) reports.push(this.rebuild(name, cfg));
    }
    return reports;
  }
}
