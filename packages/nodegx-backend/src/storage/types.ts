/**
 * StorageDriver — the put/get/delete/stream/stat seam BAK-006 puts between
 * file routes and wherever the bytes actually live.
 *
 * Two implementations ship: `LocalDriver` (default, disk beside the data dir)
 * and `S3Driver` (S3-compatible, for operators who want files off the VPS
 * disk). Both satisfy this same interface, so `FileRoutes` and the transform/
 * sweep code never branch on which driver is active — the branch happens
 * exactly once, in `FileSubsystem`, at construction (config doc: BAK-007's
 * `BackupDestination` comment names this driver as its own future follow-on;
 * this interface is written generically enough to serve that later without
 * change).
 *
 * A driver's `key` is an OPAQUE string it alone interprets — callers never
 * parse or construct one, they only round-trip whatever `put()` returned.
 * `LocalDriver` uses a hash-bucketed relative path; `S3Driver` uses an object
 * key. Neither leaks its shape to the metadata layer (`key` is stored as an
 * opaque `String` column on `_Files`).
 *
 * @module nodegx-backend/storage/types
 */

export interface StorageStat {
  exists: boolean;
  size: number;
}

export interface StorageDriver {
  readonly kind: 'local' | 's3';

  /** Write `data` under a NEW key derived from `hash` (collision-proofed by the driver) and return that key. */
  put(hash: string, data: Buffer): Promise<string>;

  /** Read the full object. Throws if absent. */
  get(key: string): Promise<Buffer>;

  /** A readable stream of the object, for large-file serving without buffering the whole thing. */
  createReadStream(key: string): NodeJS.ReadableStream;

  /** Delete the object. Not an error if already absent (idempotent, matches the old FileRoutes.delete). */
  delete(key: string): Promise<void>;

  stat(key: string): Promise<StorageStat>;

  /**
   * Enumerate every key currently stored — the orphan sweep's "what blobs
   * actually exist" half. `LocalDriver` walks its directory tree; `S3Driver`
   * paginates ListObjectsV2. Bounded by nothing but the store's own size, so
   * the sweep is a background job, never inline with a request.
   */
  listKeys(): AsyncIterable<string>;
}
