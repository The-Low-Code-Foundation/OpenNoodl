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

/**
 * What the three file methods hand their `error` callback.
 *
 * The eleven data methods unwrap the backend's error envelope and pass
 * `res.error` — a string, which is what `Callbacks` describes. The file methods
 * do not: they forward the envelope whole, and both node call sites
 * (`uploadfile.ts`, `signfileurl.ts`) declare exactly this shape and pass it
 * straight to `setError`, which reads `status` to tell a 403 from a 500.
 *
 * **Corrected in BCN-002.** BCN-001 gave all fourteen methods the string form.
 * Putting the wire behind the contract was what surfaced it, which is the
 * argument for doing that before five more adapters register against the shape.
 */
export interface FileError {
  error?: string;
  code?: number;
  status?: number;
}

/** {@link Callbacks} for the file methods, whose errors are envelopes. */
export interface FileCallbacks<TSuccess> {
  success: TSuccess;
  error: (err?: FileError) => void;
}

/**
 * A record's primary key, as the backend actually hands it back.
 *
 * ⚠️ **Not always a string, and the declaration used to say it was.** BCN-004 step 6
 * measured every backend in the rig: **Directus and PostgREST return JSON numbers** for
 * `objectId`, `firstItemId` and Create's `Id`; PocketBase, `nodegx-backend` and Parse
 * return strings. A numeric id survives `_fromJSON` into the Model store, every item in a
 * collection agrees on the type, and feeding one back into a `Record Id` input drives a
 * successful update *and* delete — all confirmed by re-reading, and the render confirmed
 * separately in a deployed bundle.
 *
 * ⚠️ **Do not coerce the primary key to a string to make this go away.** A foreign key
 * arrives as a number too, so `String(article.author_id) === author.objectId` would hold
 * while `author.objectId === article.author_id` did not — coercing only the PK breaks the
 * comparison a graph actually writes.
 *
 * The one place the mixture is safe by accident: `Model.get` and `Collection`'s diff key a
 * **plain object**, so `7` and `'7'` rendezvous on one record. That is load-bearing —
 * converting `models` to a `Map`, which does not coerce, would silently split every
 * integer-keyed record in two.
 */
export type RecordId = string | number;

/** One record as it crosses the adapter boundary. Always carries at least its id. */
export interface AdapterRecord {
  objectId?: RecordId;
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
  objectId: RecordId;
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
  objectId: RecordId;
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
  objectId: RecordId;
  /** Keyed by property name, valued by amount. Negative to decrement. */
  properties: Record<string, number>;
}

export interface DeleteOptions extends Callbacks<() => void> {
  collection: string;
  objectId: RecordId;
}

// ── Relations ──────────────────────────────────────────────────────────────

/**
 * Add or remove one member of a relation.
 *
 * ## The `targetClass` rename, decided
 *
 * BCN-001 deferred this to BCN-005 and BCN-005 owns it: **`targetCollection` is
 * the field, and `targetClass` stays as a deprecated alias.** Neither half of
 * that is a compromise for its own sake.
 *
 * - The neutral name **wins**, because it already won next door and half a name
 *   is worse than either whole one. The source side of this very interface is
 *   `collection`, not `className` — so today the same concept is spelled two
 *   ways in one options object, one line apart. `collection` and `targetClass`
 *   cannot both be right.
 * - The alias **stays**, because the field is not only ours. `records.js`
 *   exposes `Noodl.Records.addRelation({targetClassName})` on the public
 *   scripting API and maps it to this field, and a user's Function node calling
 *   it is not a call site anyone can grep. Accepting both costs one line in the
 *   two adapters and breaks nothing; removing it is a separate, announceable
 *   change.
 *
 * ⚠️ `targetCollection` is optional **only** so the alias can satisfy it. Use
 * {@link relationTarget} rather than reading either field directly — it is the
 * one place that knows the precedence.
 */
export interface RelationOptions extends Callbacks<(record: AdapterRecord) => void> {
  collection: string;
  objectId: RecordId;
  /** The relation field on the source record. */
  key: string;
  targetObjectId: RecordId;
  /** The collection on the other end. */
  targetCollection?: string;
  /** @deprecated Parse-family spelling of {@link targetCollection}. Still read. */
  targetClass?: string;
}

/**
 * The collection on the other end of a relation, from either spelling.
 *
 * A function rather than a convention, so that "which one wins" is written down
 * once instead of in each adapter — and so that adding a third spelling later
 * is one edit rather than a hunt.
 */
export function relationTarget(options: Pick<RelationOptions, 'targetCollection' | 'targetClass'>): string | undefined {
  return options.targetCollection || options.targetClass || undefined;
}

// ── Files ──────────────────────────────────────────────────────────────────

/**
 * One stored file, as it crosses the adapter boundary.
 *
 * `name` and `url` are the two the rest of NodeGX already runs on: `CloudFile`
 * is built from exactly those two, `signFileUrl` and `deleteFile` are addressed
 * by `name`, and `cloudstore.js`'s `_serializeObject` persists a File-typed
 * record property as `{__type: 'File', url, name}`. They are therefore required
 * and keep their Parse-family spelling, per the phase's naming decision.
 *
 * The other four are what BCN-007 adds, and every one of them is a field some
 * backend returns and the wire currently throws away. They are **optional
 * because they are not always knowable**, not because they are unimportant:
 *
 * - `id` is the backend's own handle where that is a different thing from the
 *   stored name. Ours and Parse's are the same string, so neither sets it;
 *   Directus keys files by a UUID and serves them from `/assets/{id}`, so the
 *   name and the address are genuinely two values there.
 * - `filename` is what the user called the file. Ours sanitises and prefixes
 *   (`<random8>_<sanitized original>`), so `name` and `filename` diverge the
 *   moment anyone uploads `my photo.png`.
 * - `contentType` is the **sniffed** type where a backend sniffs. BAK-006's
 *   `sniff.ts` exists because a client's declared type decides what renders and
 *   clients lie; an adapter that reports the declared type here re-introduces
 *   the bug that module was written to fix.
 * - `size` in bytes.
 *
 * ⚠️ **These four survive an upload, not a round trip.** A file read back off a
 * record comes through `_deserializeJSON`, which reconstructs a `CloudFile` from
 * the persisted `{__type: 'File', url, name}` and has never had anywhere to put
 * a size or a content type. So a `FileRef` from `uploadFile` may carry all six
 * fields and the same file loaded from a record will carry two. Widening the
 * persisted shape is a stored-data change and belongs to whoever owns the record
 * wire, not here.
 */
export interface FileRef {
  /** The **stored** name — what `signFileUrl` and `deleteFile` are addressed by. */
  name: string;
  /** Where the bytes are served from. Not necessarily usable without credentials — see {@link FileUrlKind}. */
  url: string;
  id?: string;
  filename?: string;
  contentType?: string;
  size?: number;
  /**
   * Where the file lives, for the two backends where a name is not an address.
   *
   * See {@link FileTarget}. Absent on the Parse-wire backends and on Directus,
   * whose files are independent objects addressed by one string.
   */
  target?: FileTarget;
}

/**
 * Where a file lives, on a backend that does not store files independently.
 *
 * BCN-007 step 1 left this undecided **on purpose** and said so at the point
 * where the temptation was: *"PocketBase's handle is not one string. A file
 * there is addressed by (collection, record id, filename) and is meaningless
 * without its record. `FileRef.name` cannot hold that, and inventing a delimited
 * composite here would decide step 3 by accident."*
 *
 * This is the decision, and the spec asked for it in these words: *"Either the
 * capability is `degraded` … or `uploadFile` takes an optional record target
 * that the other backends ignore. Prefer the latter if it does not distort the
 * contract; prefer the former over a lie."*
 *
 * **Both, in the end, and for different reasons.** The target is here because a
 * composite handle stuffed into `name` would be a lie that typechecks — the
 * classic plausible-wrong-value this phase exists to remove. And the descriptor
 * cells are *also* `degraded`, because a target is something the app author has
 * to supply and cannot be guessed: an Upload File node with no Collection set is
 * a file with nowhere to live, and `degraded` is what puts that in front of them
 * before they ship rather than after.
 *
 * A discriminated union rather than one bag of optional strings, because the two
 * are not the same idea wearing different names. Measured, both of them:
 *
 * - `record` — **PocketBase.** A file *is* a field on a record. Uploading is a
 *   multipart create-or-update of that record; deleting is a `PATCH` setting the
 *   field to `null`; and deleting the record takes its files with it. All three
 *   observed — `BCN-007-FILES-PROBE-OUTPUT.txt` §3.
 * - `bucket` — **Supabase Storage.** A file is an object at a path inside a
 *   named bucket, and the bucket's `public` flag decides whether the plain URL
 *   works at all. Neither the bucket nor the path can be defaulted: a guessed
 *   bucket name is a 400 the user cannot diagnose. Observed —
 *   `BCN-007-SUPABASE-STORAGE-OUTPUT.txt`.
 *
 * The other three backends **ignore this field entirely**, which is what makes
 * it safe to put on the shared options: it is never read where it has no
 * meaning, rather than being read and quietly mistranslated.
 */
export type FileTarget =
  | {
      readonly kind: 'record';
      /** PocketBase collection name. */
      readonly collection: string;
      /** The record the file hangs off. Absent on an upload that creates one. */
      readonly recordId?: string;
      /** The `file`-typed field on that record. */
      readonly field: string;
    }
  | {
      readonly kind: 'bucket';
      /** Supabase Storage bucket. Its `public` flag decides what the plain URL does. */
      readonly bucket: string;
      /** Object path inside the bucket, `/`-separated. */
      readonly path: string;
    };

/**
 * What kind of URL a backend just handed back — and the reason this is on the
 * contract rather than in a doc page.
 *
 * The spec's third desired state says it plainly: *"a URL that expires and a URL
 * that requires a header are different things for an app author to hold."* They
 * fail differently, they are shareable differently, and the failure arrives
 * hours later in someone else's browser. A single `url: string` cannot say which
 * one it is, and every backend picks a different one:
 *
 * - `signed` — the URL carries its own proof (`?exp=&sig=`) and stops working at
 *   `expiresAt`. Anyone holding it can fetch it until then; nobody can fetch it
 *   after. This is ours, from BAK-006, and Supabase's.
 * - `token` — the URL only works while it carries a credential belonging to the
 *   **signed-in user**. Pasting it to a colleague either fails for them or hands
 *   them the credential; neither is what the author expected. Directus's asset
 *   access token and PocketBase's file token are both this.
 * - `public` — needs nothing and never expires. Upstream Parse's files are this,
 *   and so is any file on our backend that was not uploaded private.
 *
 * Required, not optional, on {@link SignedFileUrl}: an adapter that cannot say
 * which of the three it produced does not know what it just handed the user.
 */
export type FileUrlKind = 'signed' | 'token' | 'public';

export const FILE_URL_KINDS: readonly FileUrlKind[] = Object.freeze(['signed', 'token', 'public']);

/**
 * The result of asking a backend for a usable link to a file.
 *
 * `expiresAt` is an **ISO string**, not an epoch number. BCN-001 typed it
 * `number`; `nodegx-backend`'s `FileRoutes.signUrl` sends an ISO timestamp and
 * the Sign File URL node has always declared it a string and published it on a
 * `string` port. Corrected in BCN-002 — a wrong type here would have had
 * BCN-004's adapters minting epochs for a port that renders them verbatim.
 *
 * Both it and `ttlSeconds` stay optional because a `public` URL has no expiry to
 * report, and a `token` URL's expiry is the session's rather than the link's.
 */
export interface SignedFileUrl {
  url: string;
  /** See {@link FileUrlKind}. The one field that says how this URL will fail. */
  kind: FileUrlKind;
  expiresAt?: string;
  ttlSeconds?: number;
}

/**
 * ⚠️ **`data` is gone, and it was required.** BCN-001 extracted a `data: unknown`
 * field because `cloudstore.js` merged `options.data` into the upload response
 * before handing it to `success`. Nothing in the repo has ever set it — not the
 * Upload File node, not `Noodl.Files.upload`, not a test — so the merge only ever
 * spread `undefined`, and the contract carried a **required** field no caller
 * could satisfy. Removing it is the same class of correction as BCN-002's three,
 * and it is removed here rather than recorded because BCN-007 is the task that
 * owns what an upload returns: the answer is now {@link FileRef}, and an
 * arbitrary caller-supplied object merged over the backend's own response is the
 * one thing that shape cannot survive.
 */
export interface UploadFileOptions extends FileCallbacks<(result: FileRef) => void> {
  file: { name: string; type?: string };
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
  /**
   * Where to put the file, on the two backends that need to be told.
   *
   * Ignored by `nodegx`, `parse` and `directus`, which store files
   * independently. **Required** by `pocketbase` and `supabase` — see
   * {@link FileTarget} — and their adapters refuse with a sentence rather than
   * guessing a bucket name or attaching the file to nothing.
   *
   * On a `record` target `recordId` may be omitted, which means *create* the
   * record as part of the upload. That is not a convenience: PocketBase has no
   * way to store a file without a record, so an upload with neither an existing
   * record nor permission to make one has genuinely nowhere to go.
   */
  target?: FileTarget;
}

/**
 * Ask the backend for a link to a file that the app can actually use.
 *
 * The method is named for what our backend does — `GET /files/:name/sign` — and
 * three of the five backends do something else. It keeps the name (the node is
 * called Sign File URL and twenty-five nodes' worth of naming precedent says the
 * Parse-family spelling wins) and the *result* carries the difference, in
 * {@link SignedFileUrl.kind}. "Signing" is the question; the answer is allowed
 * to be a token URL, as long as it says so.
 */
export interface SignFileUrlOptions extends FileCallbacks<(result: SignedFileUrl) => void> {
  name: string;
  /** See {@link FileTarget}. Carried back from the `FileRef` the upload returned. */
  target?: FileTarget;
}

/**
 * `success` receives the backend's response, not nothing.
 *
 * Also a BCN-002 correction: `cloudstore.js:481` calls it with the merged
 * response body and `noodl-viewer-cloud/src/api/files.js` accepts a `response`
 * parameter, so the zero-argument form BCN-001 declared could not have been
 * implemented without changing a caller.
 */
export interface DeleteFileOptions extends FileCallbacks<(response?: Record<string, unknown>) => void> {
  file: { name: string };
  /** See {@link FileTarget}. Carried back from the `FileRef` the upload returned. */
  target?: FileTarget;
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
