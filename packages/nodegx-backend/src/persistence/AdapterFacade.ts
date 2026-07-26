/**
 * AdapterFacade — promise-shaped, wire-aware view over LocalSQLAdapter.
 *
 * The adapter's public API is callback-shaped (`options.success/error`) and
 * returns *storage-shaped* records (pointers as bare objectId strings, dates as
 * ISO strings). The HTTP surface needs two different views of it:
 *
 *   - `raw*` methods    — storage-shaped records, awaitable. What the BYOB
 *                         `/api/:table` routes (and the Data Browser via IPC
 *                         proxy) have always returned.
 *   - `wire*` methods   — Parse-wire-shaped records: schema-typed columns are
 *                         serialized to the `{__type: ...}` envelopes the four
 *                         runtime clients deserialize (`cloudstore.js`
 *                         `_fromJSON`/`_deserializeJSON`), and `include=`
 *                         expands pointers into embedded `__type: 'Object'`
 *                         records exactly as Parse does.
 *
 * Both views front the same adapter, which is the point: one database, two
 * protocols (WF-004 wire-protocol decision).
 *
 * @module nodegx-backend/persistence/AdapterFacade
 */

import * as crypto from 'crypto';

// QueryBuilder is the adapter's own SQL/serialization helper — reused here so
// BAK-007 import writes serialize values EXACTLY as create()/save() do (JSON
// columns, pointers-as-id, dates-as-ISO, booleans-as-0/1) without duplicating
// that logic. Same declared dependency edge createAdapter.ts uses.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const QueryBuilder = require('@noodl/runtime/src/api/adapters/local-sql/QueryBuilder');

interface AdapterCallbacks {
  success(...args: unknown[]): void;
  error(err: unknown): void;
}

/** Column type descriptor exposed for import coercion (BAK-007). */
export interface ImportColumn {
  name: string;
  type?: string;
  targetClass?: string;
}

/** Minimal column shape from SchemaManager.getTableSchema(). */
interface SchemaColumn {
  name: string;
  type?: string;
  targetClass?: string;
}

/**
 * Row-level ACL context (BAK-003) passed through to the adapter, which
 * compiles it into the SQL statement (QueryBuilder.buildAclPredicate).
 * Absent = no row filtering (dev-open, admin, scoped API keys).
 */
export interface AclOption {
  access: 'read' | 'write';
  keys: string[];
}

export interface QueryOptions {
  where?: Record<string, unknown>;
  sort?: string[] | string;
  limit?: number;
  skip?: number;
  select?: string[] | string;
  include?: string[];
  count?: boolean;
  acl?: AclOption;
}

export interface WireQueryResult {
  results: Record<string, unknown>[];
  count?: number;
}

/** Fields never sent over the wire for `_User` records. */
const USER_PROTECTED_FIELDS = ['_hashed_password', '_email_verify_token', '_perishable_token'];

export class AdapterFacade {
  // The adapter is plain untyped CommonJS from @noodl/runtime.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly adapter: any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(adapter: any) {
    this.adapter = adapter;
  }

  // ==========================================================================
  // Promise wrappers (storage-shaped, "raw")
  // ==========================================================================

  private call<T>(method: string, options: Record<string, unknown>, mapSuccess?: (...args: unknown[]) => T): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const cb: AdapterCallbacks = {
        success: (...args: unknown[]) => resolve(mapSuccess ? mapSuccess(...args) : (args[0] as T)),
        error: (err: unknown) => reject(err instanceof Error ? err : new Error(String(err)))
      };
      this.adapter[method]({ ...options, ...cb });
    });
  }

  rawQuery(collection: string, options: QueryOptions = {}): Promise<WireQueryResult> {
    return this.call<WireQueryResult>('query', { collection, ...options }, (results, count) => ({
      results: results as Record<string, unknown>[],
      count: count as number | undefined
    }));
  }

  rawFetch(collection: string, objectId: string, acl?: AclOption): Promise<Record<string, unknown>> {
    return this.call('fetch', { collection, objectId, acl });
  }

  rawCreate(collection: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.call('create', { collection, data });
  }

  rawSave(
    collection: string,
    objectId: string,
    data: Record<string, unknown>,
    acl?: AclOption
  ): Promise<Record<string, unknown>> {
    return this.call('save', { collection, objectId, data, acl });
  }

  rawDelete(collection: string, objectId: string, acl?: AclOption): Promise<void> {
    return this.call('delete', { collection, objectId, acl });
  }

  rawCount(collection: string, where?: Record<string, unknown>, acl?: AclOption): Promise<number> {
    return this.call('count', { collection, where, acl });
  }

  rawIncrement(
    collection: string,
    objectId: string,
    properties: Record<string, number>,
    acl?: AclOption
  ): Promise<Record<string, unknown>> {
    return this.call('increment', { collection, objectId, properties, acl });
  }

  rawAggregate(
    collection: string,
    group: Record<string, Record<string, string>>,
    where?: Record<string, unknown>,
    acl?: AclOption
  ): Promise<Record<string, unknown>> {
    return this.call('aggregate', { collection, group, where, acl });
  }

  rawDistinct(collection: string, property: string, where?: Record<string, unknown>, acl?: AclOption): Promise<unknown[]> {
    return this.call('distinct', { collection, property, where, acl });
  }

  addRelation(collection: string, objectId: string, key: string, targetObjectId: string): Promise<void> {
    return this.call('addRelation', { collection, objectId, key, targetObjectId });
  }

  removeRelation(collection: string, objectId: string, key: string, targetObjectId: string): Promise<void> {
    return this.call('removeRelation', { collection, objectId, key, targetObjectId });
  }

  // ==========================================================================
  // Schema access
  // ==========================================================================

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get schemaManager(): any {
    return this.adapter.schemaManager;
  }

  /** Column map for a collection: name -> { type, targetClass }. */
  private columnTypes(collection: string): Map<string, SchemaColumn> {
    const map = new Map<string, SchemaColumn>();
    const schema = this.schemaManager && this.schemaManager.getTableSchema(collection);
    if (schema && Array.isArray(schema.columns)) {
      for (const col of schema.columns as SchemaColumn[]) {
        map.set(col.name, col);
      }
    }
    return map;
  }

  // ==========================================================================
  // Parse-wire serialization
  // ==========================================================================

  /**
   * Serialize one storage-shaped record to the Parse wire: Pointer columns get
   * `{__type: 'Pointer'}` envelopes (or the expanded target when included),
   * Date columns get `{__type: 'Date', iso}`. `createdAt`/`updatedAt` stay
   * plain ISO strings, as Parse sends them.
   */
  private async toWire(
    collection: string,
    record: Record<string, unknown>,
    include: string[],
    acl?: AclOption
  ): Promise<Record<string, unknown>> {
    const types = this.columnTypes(collection);
    const out: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(record)) {
      if (collection === '_User' && USER_PROTECTED_FIELDS.includes(key)) continue;
      if (value === null || value === undefined) {
        out[key] = value;
        continue;
      }
      if (key === 'createdAt' || key === 'updatedAt' || key === 'objectId') {
        out[key] = value;
        continue;
      }

      const col = types.get(key);
      if (col && col.type === 'Pointer' && typeof value === 'string') {
        const className = col.targetClass || 'Unknown';
        if (include.includes(key)) {
          try {
            // The caller's read ACL applies to the TARGET row too — without
            // this, include= is a one-hop ACL bypass. An unreadable target
            // degrades to the unexpanded envelope, same as a dangling pointer.
            const target = await this.rawFetch(className, value, acl && { ...acl, access: 'read' });
            const expanded = await this.toWire(className, target, [], acl);
            out[key] = { __type: 'Object', className, ...expanded };
          } catch {
            // Dangling or unreadable pointer — fall back to the unexpanded envelope.
            out[key] = { __type: 'Pointer', className, objectId: value };
          }
        } else {
          out[key] = { __type: 'Pointer', className, objectId: value };
        }
      } else if (col && col.type === 'Date' && typeof value === 'string') {
        out[key] = { __type: 'Date', iso: value };
      } else if (col && col.type === 'Boolean') {
        out[key] = Boolean(value);
      } else {
        // File/GeoPoint/Object/Array come back from the adapter already parsed
        // (JSON columns), keeping their stored `__type` envelopes where present.
        out[key] = value;
      }
    }

    return out;
  }

  private normalizeInclude(include?: string[] | string): string[] {
    if (!include) return [];
    const arr = Array.isArray(include) ? include : String(include).split(',');
    // Single-level expansion only — dotted paths (`a.b`) expand their first
    // segment. Recorded limitation; the record nodes only offer one level.
    return arr.map((s) => s.trim().split('.')[0]).filter(Boolean);
  }

  // ==========================================================================
  // Parse-wire operations
  // ==========================================================================

  async wireQuery(collection: string, options: QueryOptions): Promise<WireQueryResult> {
    const include = this.normalizeInclude(options.include);
    const { results, count } = await this.rawQuery(collection, options);
    const wire: Record<string, unknown>[] = [];
    for (const record of results) {
      wire.push(await this.toWire(collection, record, include, options.acl));
    }
    const out: WireQueryResult = { results: wire };
    if (count !== undefined) out.count = count;
    return out;
  }

  async wireFetch(
    collection: string,
    objectId: string,
    include?: string[] | string,
    acl?: AclOption
  ): Promise<Record<string, unknown>> {
    const record = await this.rawFetch(collection, objectId, acl);
    return this.toWire(collection, record, this.normalizeInclude(include), acl);
  }

  /**
   * Serialize a full record for session/user responses (login, /users/me) —
   * wire-shaped, protected fields stripped.
   */
  wireRecord(collection: string, record: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.toWire(collection, record, []);
  }

  // ==========================================================================
  // Import support (BAK-007) — synchronous, transaction-safe writes
  //
  // The adapter is synchronous under the hood (node:sqlite), but its public
  // methods are callback-wrapped and returned as Promises, which cannot run
  // inside a synchronous `db.transaction(fn)`. Import needs a per-collection
  // transaction (all-or-nothing, never a half-import), so these helpers do the
  // writes synchronously via the same QueryBuilder the adapter uses.
  // ==========================================================================

  /** Schema column descriptors for a collection ({} when the table is unknown). */
  getColumns(collection: string): ImportColumn[] {
    const schema = this.schemaManager && this.schemaManager.getTableSchema(collection);
    return schema && Array.isArray(schema.columns) ? (schema.columns as ImportColumn[]) : [];
  }

  /** Run `fn` inside a single SQLite transaction (commit on return, rollback on throw). */
  transaction<T>(fn: () => T): T {
    return this.adapter.transaction(fn) as T;
  }

  private inferColumnType(value: unknown): string {
    if (value && typeof value === 'object') {
      const v = value as Record<string, unknown>;
      if (v.__type === 'Date') return 'Date';
      if (v.__type === 'Pointer') return 'Pointer';
      if (v.__type === 'File') return 'File';
      if (v.__type === 'GeoPoint') return 'GeoPoint';
      if (Array.isArray(value)) return 'Array';
      return 'Object';
    }
    if (typeof value === 'boolean') return 'Boolean';
    if (typeof value === 'number') return 'Number';
    return 'String';
  }

  /** Ensure the table + a column for every data key exists (idempotent). */
  ensureImportShape(collection: string, columns: ImportColumn[], sampleData: Record<string, unknown>): void {
    const sm = this.schemaManager;
    if (!sm) return;
    sm.createTable({ name: collection, columns: [] });
    const existing = new Set(this.getColumns(collection).map((c) => c.name));
    // Explicit schema first (correct types), then anything the data implies.
    for (const col of columns) {
      if (col.name && !existing.has(col.name) && col.type !== 'Relation') {
        sm.addColumn(collection, col);
        existing.add(col.name);
      }
    }
    for (const [key, value] of Object.entries(sampleData)) {
      if (['objectId', 'createdAt', 'updatedAt', 'id', 'ACL'].includes(key)) continue;
      if (value === null || value === undefined) continue;
      if (existing.has(key)) continue;
      sm.addColumn(collection, { name: key, type: this.inferColumnType(value) });
      existing.add(key);
    }
  }

  /** True if a row with this objectId exists (synchronous). */
  existsSync(collection: string, objectId: string): boolean {
    try {
      const db = this.adapter.getDatabase();
      const row = db
        .prepare(`SELECT 1 FROM ${QueryBuilder.escapeTable(collection)} WHERE "objectId" = ?`)
        .get(objectId);
      return !!row;
    } catch {
      return false;
    }
  }

  /**
   * Insert or update a record by objectId, synchronously (for transactional
   * import). Returns which action occurred. Assumes ensureImportShape was
   * already called for this collection.
   */
  upsertSync(collection: string, objectId: string | undefined, data: Record<string, unknown>): 'created' | 'updated' {
    const db = this.adapter.getDatabase();
    const clean: Record<string, unknown> = { ...data };
    delete clean.objectId;
    if (objectId && this.existsSync(collection, objectId)) {
      const { sql, params } = QueryBuilder.buildUpdate({ collection, objectId, data: clean });
      db.prepare(sql).run(...params);
      return 'updated';
    }
    const id = objectId || crypto.randomUUID();
    const { sql, params } = QueryBuilder.buildInsert({ collection, data: clean }, id);
    db.prepare(sql).run(...params);
    return 'created';
  }
}
