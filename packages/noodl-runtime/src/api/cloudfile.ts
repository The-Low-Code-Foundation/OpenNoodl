/**
 * A file stored in the backend, as it appears to a graph.
 *
 * A name and a url first: `toString` returns the url, so a Cloud File wired into an
 * Image node's Source — or interpolated into a text — works without the author having
 * to know it is an object at all.
 *
 * ## Why `contentType` and `size` are here, and why they are optional
 *
 * BCN-007 step 1 normalised the upload response into a {@link FileRef} that carries
 * both, because `nodegx-backend` has returned both on a 201 since BAK-006 and the wire
 * was throwing them away. The live pass confirmed the 201 really does carry them — and
 * then found they died one line later, because this constructor destructured `{name,
 * url}` out of a four-field object. So the contract grew two fields no graph could
 * read. They are read here instead.
 *
 * They are **optional and stay optional**, for two honest reasons rather than one:
 *
 * 1. **Upstream Parse returns `{name, url}` only.** On that backend the two are absent,
 *    which is the true answer and not a zero.
 * 2. **A file read back from a *record property* has neither.** `cloudstore.js`'s
 *    `_serializeJSON` writes a File as `{__type, url, name}`, so the round-trip through
 *    a saved record drops them by construction. That is the register's "the normalised
 *    reference stops meaning what the spec assumes one save later" and it belongs to
 *    BCN-007's remainder — not papered over here, where a default would turn "this
 *    backend never told us" and "a save discarded it" into the same value.
 *
 * @module noodl-runtime
 */
import type { FileTarget } from '@noodl/backend-contract';

class CloudFile {
  readonly name: string;
  readonly url: string;
  /** MIME type the backend reported on upload; absent on a wire that does not report one. */
  readonly contentType?: string;
  /** Bytes the backend reported on upload; absent on a wire that does not report one. */
  readonly size?: number;
  /**
   * Where the file lives, on a backend where the name is not an address.
   *
   * BCN-007 step 3: PocketBase addresses a file by (collection, record id,
   * filename) and Supabase by (bucket, path). `signFileUrl` and `deleteFile`
   * need those, and the only place they can come from is the reference the
   * upload returned — so it is carried here rather than asked of the author a
   * second time.
   *
   * ⚠️ **It does not survive a save.** `_serializeObject` persists a File-typed
   * record property as `{__type: 'File', url, name}`, so a file read back off a
   * record has no target and Sign File URL on PocketBase or Supabase will refuse
   * with a sentence. That is the same round-trip limit `contentType` and `size`
   * have and it is documented rather than papered over — see the note above.
   * Widening the persisted envelope is a stored-data change on the Parse wire.
   */
  readonly target?: FileTarget;

  constructor({
    name,
    url,
    contentType,
    size,
    target
  }: {
    name: string;
    url: string;
    contentType?: string;
    size?: number;
    target?: FileTarget;
  }) {
    this.name = name;
    this.url = url;
    // Assigned only when present, so `'contentType' in file` distinguishes "the
    // backend did not say" from "the backend said empty".
    if (contentType !== undefined) this.contentType = contentType;
    if (size !== undefined) this.size = size;
    if (target !== undefined) this.target = target;
  }

  getUrl(): string {
    return this.url;
  }

  getName(): string {
    return this.name;
  }

  getContentType(): string | undefined {
    return this.contentType;
  }

  getSize(): number | undefined {
    return this.size;
  }

  /** See {@link CloudFile.target}. `undefined` on the three backends that do not need one. */
  getTarget(): FileTarget | undefined {
    return this.target;
  }

  toString(): string {
    return this.url;
  }
}

export = CloudFile;
