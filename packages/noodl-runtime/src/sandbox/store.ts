/**
 * AIX-008 — Sandbox preview: the in-memory store
 *
 * Everything a previewed graph reads or writes lives here for the life of the
 * preview and is thrown away with it. Writes work — creating a record, editing
 * one, deleting one, signing in — because a profile form that cannot save is
 * not a preview of a profile form.
 *
 * Query support is the subset the data nodes actually emit (Parse's `where`
 * operators, `order`, `limit`/`skip`, `count`). Anything unrecognised is
 * ignored rather than failing: an over-strict sandbox that returns nothing is
 * exactly the failure this whole task exists to remove.
 *
 * @module noodl-runtime/sandbox/store
 */

import { synthesizeRecord, synthesizeRecords } from './synth';
import { SANDBOX_RECORD_FLAG, type SandboxDataset, type SandboxRecord } from './types';

/** How many records a class gets when the editor did not predict it. */
const DEFAULT_RECORD_COUNT = 5;

/** Fields to invent for a class nobody described. */
const FALLBACK_FIELDS = ['name', 'description', 'imageUrl', 'status', 'count'];

export interface SandboxQuery {
  where?: Record<string, unknown>;
  limit?: number;
  skip?: number;
  /** Parse order string: `"name"`, `"-createdAt"`, or a comma-separated list. */
  order?: string;
  count?: boolean | number;
}

export interface SandboxQueryResult {
  results: SandboxRecord[];
  /** Total matches before limit/skip — what a "count" query wants. */
  count: number;
}

function compare(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  return String(a ?? '').localeCompare(String(b ?? ''));
}

function matchesOperators(value: unknown, condition: Record<string, unknown>): boolean {
  for (const [op, operand] of Object.entries(condition)) {
    switch (op) {
      case '$eq':
        if (value !== operand) return false;
        break;
      case '$ne':
        if (value === operand) return false;
        break;
      case '$gt':
        if (!(compare(value, operand) > 0)) return false;
        break;
      case '$gte':
        if (!(compare(value, operand) >= 0)) return false;
        break;
      case '$lt':
        if (!(compare(value, operand) < 0)) return false;
        break;
      case '$lte':
        if (!(compare(value, operand) <= 0)) return false;
        break;
      case '$in':
        if (!Array.isArray(operand) || !operand.includes(value)) return false;
        break;
      case '$nin':
        if (Array.isArray(operand) && operand.includes(value)) return false;
        break;
      case '$exists':
        if ((value !== undefined && value !== null) !== Boolean(operand)) return false;
        break;
      case '$regex':
        try {
          if (!new RegExp(String(operand), 'i').test(String(value ?? ''))) return false;
        } catch {
          // An unparseable regex matches everything rather than nothing.
        }
        break;
      default:
        // Unknown operator ($relatedTo, $inQuery, …): not enforced. The sandbox
        // errs towards showing records.
        break;
    }
  }
  return true;
}

export function matchesWhere(record: SandboxRecord, where: Record<string, unknown> | undefined): boolean {
  if (!where) return true;

  for (const [key, condition] of Object.entries(where)) {
    if (key === '$or') {
      const clauses = Array.isArray(condition) ? condition : [];
      if (clauses.length > 0 && !clauses.some((c) => matchesWhere(record, c as Record<string, unknown>))) return false;
      continue;
    }
    if (key === '$and') {
      const clauses = Array.isArray(condition) ? condition : [];
      if (!clauses.every((c) => matchesWhere(record, c as Record<string, unknown>))) return false;
      continue;
    }

    const value = record[key];
    if (condition !== null && typeof condition === 'object' && !Array.isArray(condition)) {
      const asObject = condition as Record<string, unknown>;
      // A pointer/date literal is a value, not a set of operators.
      if ('__type' in asObject) {
        if (JSON.stringify(value) !== JSON.stringify(asObject)) return false;
        continue;
      }
      if (!matchesOperators(value, asObject)) return false;
      continue;
    }
    if (value !== condition) return false;
  }

  return true;
}

function sortRecords(records: SandboxRecord[], order: string | undefined): SandboxRecord[] {
  if (!order) return records;
  const keys = order
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
  if (keys.length === 0) return records;

  return records.slice().sort((a, b) => {
    for (const key of keys) {
      const descending = key.startsWith('-');
      const field = descending ? key.slice(1) : key;
      const result = compare(a[field], b[field]);
      if (result !== 0) return descending ? -result : result;
    }
    return 0;
  });
}

export class SandboxStore {
  private readonly records = new Map<string, SandboxRecord[]>();
  private readonly fields = new Map<string, string[]>();
  private nextId = 1000;

  /** The signed-in user. Mutable — Set User Properties has to work. */
  readonly user: SandboxRecord;

  /**
   * FIX-013 ruling 1(c) — whether {@link list} invents records for a class the
   * dataset never described. Defaults to `true`; see `SandboxDataset`.
   */
  private readonly synthesizeMissing: boolean;

  constructor(dataset: SandboxDataset | undefined) {
    for (const [name, klass] of Object.entries(dataset?.classes ?? {})) {
      this.fields.set(name, klass.fields ?? []);
      this.records.set(name, (klass.records ?? []).map((r) => ({ ...r })));
    }
    this.user = { ...(dataset?.user ?? ({} as SandboxRecord)) };
    this.synthesizeMissing = dataset?.synthesizeMissing !== false;
  }

  /** Records for a class, inventing the class when the editor did not predict it. */
  list(className: string): SandboxRecord[] {
    const existing = this.records.get(className);
    if (existing) return existing;

    // ⚠️ Cached either way, and that is the point rather than an optimisation:
    // the list a `create` pushes into has to be the same list the next `query`
    // reads, or a form that saves shows nothing afterwards. An empty-state
    // sandbox is still a *writable* one.
    const generated = this.synthesizeMissing
      ? synthesizeRecords(this.fields.get(className) ?? FALLBACK_FIELDS, DEFAULT_RECORD_COUNT)
      : [];
    this.records.set(className, generated);
    return generated;
  }

  query(className: string, query: SandboxQuery = {}): SandboxQueryResult {
    const matched = this.list(className).filter((r) => matchesWhere(r, query.where));
    const ordered = sortRecords(matched, query.order);
    const skip = Math.max(0, Number(query.skip) || 0);
    // limit 0 is Parse's "count only" — it means zero rows, not "no limit".
    const limit = query.limit === undefined || query.limit === null ? ordered.length : Math.max(0, Number(query.limit));
    return { results: ordered.slice(skip, skip + limit), count: matched.length };
  }

  get(className: string, objectId: string): SandboxRecord | undefined {
    return this.list(className).find((r) => r.objectId === objectId || r.id === objectId);
  }

  create(className: string, data: Record<string, unknown>): SandboxRecord {
    const id = `sandbox-new-${this.nextId++}`;
    const now = new Date().toISOString();
    const record: SandboxRecord = {
      ...synthesizeRecord(this.fields.get(className) ?? [], this.list(className).length),
      ...data,
      objectId: id,
      id,
      createdAt: now,
      updatedAt: now,
      [SANDBOX_RECORD_FLAG]: true
    };
    this.list(className).push(record);
    return record;
  }

  update(className: string, objectId: string, data: Record<string, unknown>): SandboxRecord | undefined {
    const record = this.get(className, objectId);
    if (!record) return undefined;
    Object.assign(record, data, { updatedAt: new Date().toISOString() });
    return record;
  }

  remove(className: string, objectId: string): boolean {
    const records = this.list(className);
    const index = records.findIndex((r) => r.objectId === objectId || r.id === objectId);
    if (index === -1) return false;
    records.splice(index, 1);
    return true;
  }

  /** Class names the dataset described — used for the toolbar's summary line. */
  knownClasses(): string[] {
    return Array.from(this.fields.keys());
  }
}
