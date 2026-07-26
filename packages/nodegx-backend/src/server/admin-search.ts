/**
 * Admin search surface (BAK-008): the HTTP form of per-collection full-text
 * search config.
 *
 *   GET    /admin/search                            config + live FTS5 capability
 *   PUT    /admin/search/collections/:name          enable/configure search (rebuilds)
 *   DELETE /admin/search/collections/:name          disable search (drops the index)
 *   POST   /admin/search/collections/:name/rebuild  explicit reindex (idempotent)
 *
 * All admin-gated by the dispatcher, mirroring admin-security.ts and
 * admin-backups.ts. This is the same config the MCP search tools and the
 * editor's search panel edit — one model, two fronts (BAK-005's served
 * dashboard is a residual; see BAK-008-NOTES.md).
 *
 * @module nodegx-backend/server/admin-search
 */

import type { AdapterFacade } from '../persistence/AdapterFacade';
import type { SearchState } from '../search/SearchState';
import type { CollectionSearchConfig, SearchConfig } from '../search/model';
import { SearchIndexer, SearchCapabilityError, RebuildReport } from '../search/SearchIndexer';
import type { RequestContext } from './HttpServer';
import { HttpError, readJSONBody, sendJSON } from './http-util';

/** `GET /admin/search`. */
export interface SearchConfigResponse {
  config: SearchConfig;
  /** Honest, not aspirational: FTS5 is a build option of the SQLite in use. */
  fts5Available: boolean;
}

/** The body of every `/admin/search/collections/:name` mutation. */
export interface SearchCollectionResponse {
  success: boolean;
  collection: string;
  config?: CollectionSearchConfig;
  /** Present when the write triggered (or the caller asked for) a rebuild. */
  rebuild?: RebuildReport;
  /** DELETE only. */
  removed?: boolean;
}

export class AdminSearchRoutes {
  private readonly search: SearchState;
  private readonly facade: AdapterFacade;
  private readonly indexer: SearchIndexer;

  constructor(search: SearchState, facade: AdapterFacade) {
    this.search = search;
    this.facade = facade;
    this.indexer = new SearchIndexer(facade.schemaManager);
  }

  getConfig(ctx: RequestContext): void {
    sendJSON(ctx.res, 200, {
      config: this.search.config,
      fts5Available: this.indexer.hasFts5()
    } satisfies SearchConfigResponse);
  }

  /** PUT /admin/search/collections/:name — enable/reconfigure + rebuild. */
  async putCollection(ctx: RequestContext): Promise<void> {
    const name = ctx.params.name;
    if (name.startsWith('_')) {
      throw new HttpError(400, 'System collections cannot carry a search config.');
    }
    const body = await readJSONBody(ctx.req);
    const enabled = body.enabled !== false; // hitting this route defaults to enabling
    const fields = Array.isArray(body.fields) ? body.fields.map(String) : [];
    const tokenizer = typeof body.tokenizer === 'string' ? body.tokenizer : undefined;

    if (enabled && fields.length === 0) {
      throw new HttpError(400, 'At least one field is required to enable search.');
    }

    // Validate the fields are real columns on the collection before touching SQL.
    const columns = new Set(this.facade.getColumns(name).map((c) => c.name));
    const unknown = fields.filter((f) => !columns.has(f));
    if (enabled && unknown.length > 0) {
      throw new HttpError(400, `Unknown column(s) for "${name}": ${unknown.join(', ')}. Create the field(s) first.`);
    }

    const entry = { enabled, fields, ...(tokenizer ? { tokenizer } : {}) };
    try {
      this.search.setCollection(name, entry);
    } catch (e) {
      throw new HttpError(400, e instanceof Error ? e.message : String(e));
    }

    if (!enabled) {
      this.indexer.drop(name);
      sendJSON(ctx.res, 200, { success: true, collection: name, config: entry } satisfies SearchCollectionResponse);
      return;
    }

    try {
      const rebuild = this.indexer.rebuild(name, entry);
      sendJSON(ctx.res, 200, { success: true, collection: name, config: entry, rebuild } satisfies SearchCollectionResponse);
    } catch (e) {
      if (e instanceof SearchCapabilityError) {
        // The config write above already landed — the operator's intent is on
        // record, but the engine cannot honor it. Loud, explicit, no fallback.
        throw new HttpError(503, e.message);
      }
      throw e;
    }
  }

  /** DELETE /admin/search/collections/:name — disable + drop the shadow table. */
  deleteCollection(ctx: RequestContext): void {
    const name = ctx.params.name;
    const existed = this.search.removeCollection(name);
    this.indexer.drop(name);
    sendJSON(ctx.res, 200, { success: true, collection: name, removed: existed } satisfies SearchCollectionResponse);
  }

  /** POST /admin/search/collections/:name/rebuild — explicit, idempotent reindex. */
  async rebuild(ctx: RequestContext): Promise<void> {
    const name = ctx.params.name;
    const cfg = this.search.configFor(name);
    if (!cfg || !cfg.enabled) {
      throw new HttpError(400, `Search is not enabled for "${name}".`);
    }
    try {
      const report = this.indexer.rebuild(name, cfg);
      sendJSON(ctx.res, 200, { success: true, collection: name, rebuild: report } satisfies SearchCollectionResponse);
    } catch (e) {
      if (e instanceof SearchCapabilityError) {
        throw new HttpError(503, e.message);
      }
      throw e;
    }
  }
}
