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
class CloudFile {
  readonly name: string;
  readonly url: string;
  /** MIME type the backend reported on upload; absent on a wire that does not report one. */
  readonly contentType?: string;
  /** Bytes the backend reported on upload; absent on a wire that does not report one. */
  readonly size?: number;

  constructor({ name, url, contentType, size }: { name: string; url: string; contentType?: string; size?: number }) {
    this.name = name;
    this.url = url;
    // Assigned only when present, so `'contentType' in file` distinguishes "the
    // backend did not say" from "the backend said empty".
    if (contentType !== undefined) this.contentType = contentType;
    if (size !== undefined) this.size = size;
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

  toString(): string {
    return this.url;
  }
}

export = CloudFile;
