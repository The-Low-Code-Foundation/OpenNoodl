/**
 * `IDataAdapter` — the fourteen data methods.
 *
 * Extracted from `noodl-runtime/src/api/cloudstore.js`, not designed. Every
 * option below is one that file actually reads; nothing was added because it
 * would be nicer to have. That restraint is the entire safety argument for
 * BCN-002: if the contract is exactly the shape twenty-five existing nodes
 * already call, then putting the Parse client behind it changes nothing
 * observable, and "nothing observable changed" is a claim that can be tested.
 *
 * **Fourteen, not the eighteen the phase spec asked for.** `CloudStore` has
 * eighteen methods, but four of them are not contract material:
 * `_initCloudServices` (construction, replaced by `BackendHandle`),
 * `_makeRequest` (**this is the Parse-ness — it is the thing each adapter
 * replaces**), and `on`/`off` (event subscription, not a data operation; see
 * `events.ts`). The remaining fourteen are exactly the fourteen rows the
 * phase README's own table lists. The count came from the class, the table came
 * from the operations, and the table was right.
 *
 * **Why callbacks.** `{success, error}` on an options object is the idiom across
 * both `CloudStore` and `UserService`, and every standard-library node is
 * written to it. Promisifying is a defensible modernisation and it is
 * deliberately not done here: it would multiply BCN-002's diff by an order of
 * magnitude and buy nothing this phase needs. Recorded as a follow-up.
 *
 * @module backend-contract/data
 */

import type { BackendHandle } from './backends';
import type { Filter } from './filter';

/** The two callbacks every operation takes. `error` receives a message, not an `Error`. */
export interface Callbacks<TSuccess> {
  success: TSuccess;
  error: (err?: string) => void;
}

/** One record as it crosses the adapter boundary. Always carries at least its id. */
export interface AdapterRecord {
  objectId?: string;
  [field: string]: unknown;
}

/** An access-control list, in the shape BAK-003's model uses. */
export type Acl = Record<string, unknown>;

/**
 * `include`, `select` and `sort` are accepted as an array **or** a pre-joined
 * comma string, because `cloudstore.js:165-167` accepts both and callers in the
 * wild use both. Adapters receive the array form: normalising is the contract
 * layer's job, done once, rather than five adapters each remembering to.
 */
export type ListOption = string | string[];

// ── Query & read ───────────────────────────────────────────────────────────

export interface QueryOptions extends Callbacks<(results: AdapterRecord[], count?: number) => void> {
  collection: string;
  where?: Filter;
  limit?: number;
  skip?: number;
  /** Relation fields to resolve inline rather than returning as ids. */
  include?: ListOption;
  select?: ListOption;
  sort?: ListOption;
  /** Ask for the total alongside the page. */
  count?: boolean;
  /**
   * Full-text search, and **not** a filter operator.
   *
   * BAK-008 made this a dedicated parameter that switches the built-in backend
   * to FTS5 ranking, composed with `where` rather than expressed inside it.
   * It stays a separate capability key (`data.search`) for that reason: a
   * backend can support every filter operator and still have no ranked search,
   * and several do.
   */
  search?: string;
}

/**
 * `count` is `query` with `limit=0&count=1` on the wire, and a separate method
 * to callers. Both are kept: the node that counts records is a different node
 * from the one that queries them, and collapsing them would make the capability
 * descriptor unable to say what the PocketBase and PostgREST probes found —
 * that counting works on backends where aggregation does not.
 */
export interface CountOptions extends Callbacks<(count: number) => void> {
  collection: string;
  where?: Filter;
}

export interface DistinctOptions extends Callbacks<(values: unknown[]) => void> {
  collection: string;
  property: string;
  where?: Filter;
}

/**
 * Server-side grouping and totals.
 *
 * The Parse adapter carries a live server-version fork here (`cloudstore.js:212`:
 * `dbVersionMajor > 4` switches `$group`/`$match` to `group`/`match` and the
 * grouping key from `_id` to `objectId`). That is Parse-server-version
 * knowledge and it belongs inside the Parse adapter, not in this signature.
 */
export interface AggregateOptions extends Callbacks<(result: Record<string, unknown>) => void> {
  collection: string;
  where?: Filter;
  group: Record<string, unknown>;
  limit?: number;
  skip?: number;
}

export interface FetchOptions extends Callbacks<(record: AdapterRecord) => void> {
  collection: string;
  objectId: string;
  include?: ListOption;
}

// ── Write ──────────────────────────────────────────────────────────────────

export interface CreateOptions extends Callbacks<(record: AdapterRecord) => void> {
  collection: string;
  data: Record<string, unknown>;
  /**
   * Passed straight through. Per the phase decision that the permissions model
   * is not unified, this is meaningful on the Parse-family backends only and is
   * `unsupported` elsewhere — hence the `data.acl` capability key rather than a
   * silent no-op.
   */
  acl?: Acl;
}

export interface SaveOptions extends Callbacks<(record: AdapterRecord) => void> {
  collection: string;
  objectId: string;
  /**
   * `cloudstore.js:350` strips `createdAt`/`updatedAt` before sending. Every
   * adapter needs the same server-owned-field exclusion, but the field *names*
   * differ per backend (`date_created` on Directus, `created` on PocketBase),
   * so the list is per-adapter and not a constant here.
   */
  data: Record<string, unknown>;
  acl?: Acl;
}

/**
 * A genuine contract method, not sugar for read-modify-write.
 *
 * It maps to `__op: 'Increment'` on the Parse wire — one atomic operation. A
 * backend without an atomic increment must either find its own (PostgREST has
 * an RPC, Directus does not) or declare `data.increment` **degraded**, because
 * a read-modify-write round trip is racy and a user incrementing a counter from
 * two devices has a right to know that before they find out.
 */
export interface IncrementOptions extends Callbacks<(record: AdapterRecord) => void> {
  collection: string;
  objectId: string;
  /** Keyed by property name, valued by amount. Negative to decrement. */
  properties: Record<string, number>;
}

export interface DeleteOptions extends Callbacks<() => void> {
  collection: string;
  objectId: string;
}

// ── Relations ──────────────────────────────────────────────────────────────

/**
 * `targetClass` is the one place a Parse concept leaks into a signature. Every
 * backend has the notion of "the collection on the other end", so it ought to
 * generalise to a neutral name — BCN-005 owns that rename, and owns it rather
 * than this task because renaming it here would change a field twenty-five
 * nodes pass through before anything can be tested against it.
 */
export interface RelationOptions extends Callbacks<(record: AdapterRecord) => void> {
  collection: string;
  objectId: string;
  /** The relation field on the source record. */
  key: string;
  targetObjectId: string;
  targetClass: string;
}

// ── Files ──────────────────────────────────────────────────────────────────

export interface UploadFileOptions extends Callbacks<(result: { name: string; url: string }) => void> {
  file: { name: string; type?: string };
  data: unknown;
  /**
   * Carried as the `X-NodeGX-File-Private` header (`cloudstore.js:446`) —
   * **ours, not Parse's**. On every other backend privacy is a different
   * mechanism entirely (a Supabase bucket policy, a Directus folder
   * permission), which is why it is a capability key and not just a flag.
   */
  private?: boolean;
  /**
   * Only exists on the XHR upload path. An adapter built on `fetch` cannot
   * report progress at all, so it declares `files.progress` **degraded** — the
   * file still uploads, the bar just never moves.
   */
  onUploadProgress?: (progress: { loaded: number; total: number }) => void;
}

export interface SignFileUrlOptions
  extends Callbacks<(result: { url: string; expiresAt?: number; ttlSeconds?: number }) => void> {
  name: string;
}

export interface DeleteFileOptions extends Callbacks<() => void> {
  file: { name: string };
}

// ── The contract ───────────────────────────────────────────────────────────

/**
 * Fourteen methods. Every one takes the resolved backend first — see
 * `BackendHandle` for why that argument exists.
 */
export interface IDataAdapter {
  query(handle: BackendHandle, options: QueryOptions): void;
  count(handle: BackendHandle, options: CountOptions): void;
  distinct(handle: BackendHandle, options: DistinctOptions): void;
  aggregate(handle: BackendHandle, options: AggregateOptions): void;
  fetch(handle: BackendHandle, options: FetchOptions): void;

  create(handle: BackendHandle, options: CreateOptions): void;
  save(handle: BackendHandle, options: SaveOptions): void;
  increment(handle: BackendHandle, options: IncrementOptions): void;
  delete(handle: BackendHandle, options: DeleteOptions): void;

  addRelation(handle: BackendHandle, options: RelationOptions): void;
  removeRelation(handle: BackendHandle, options: RelationOptions): void;

  uploadFile(handle: BackendHandle, options: UploadFileOptions): void;
  signFileUrl(handle: BackendHandle, options: SignFileUrlOptions): void;
  deleteFile(handle: BackendHandle, options: DeleteFileOptions): void;
}

/**
 * The method names, as data — so a test can assert the interface has exactly
 * these and no more without anyone having to remember to update a count.
 */
export const DATA_ADAPTER_METHODS = Object.freeze([
  'query',
  'count',
  'distinct',
  'aggregate',
  'fetch',
  'create',
  'save',
  'increment',
  'delete',
  'addRelation',
  'removeRelation',
  'uploadFile',
  'signFileUrl',
  'deleteFile'
] as const) satisfies readonly (keyof IDataAdapter)[];
