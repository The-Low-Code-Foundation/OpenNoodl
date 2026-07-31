/**
 * A stored file, normalised at the adapter boundary.
 *
 * The sibling of `recordIdentity.ts`, and deliberately built the same way: an
 * adapter declares **what its wire calls each field**, the boundary renames, and
 * the renaming itself is written once and tested once rather than five times.
 * That shape was chosen there because the second adapter inherits a proven
 * helper instead of writing its own; files are the case where it pays most,
 * because the five backends disagree about more than the name of one field.
 *
 * | Backend | stored handle | url | content type | size |
 * |---|---|---|---|---|
 * | NodeGX / Parse wire | `name` | `url` | `contentType` | `size` |
 * | Directus | `id` + `filename_disk` | `/assets/{id}` | `type` | `filesize` |
 * | Supabase Storage | `path` / `Key` | `/object/public/{bucket}/{path}` | `metadata.mimetype` | `metadata.size` |
 * | PocketBase | the field value on a record | `/api/files/{c}/{id}/{name}` | — | — |
 *
 * **Only the first row is implemented.** BCN-007 step 1 is the Parse wire, and
 * the other three need BCN-004's REST transport, which does not exist yet. The
 * table is here because it is what the mapping type has to be able to express,
 * and two entries in it already say it cannot:
 *
 * 1. **Directus and Supabase build the URL rather than returning one.** A file
 *    reference is `{name, url}` all the way up to `CloudFile.toString()`, so
 *    those adapters have to synthesise the `url` from the handle plus their base
 *    address. That is not a field rename and this helper does not do it — see
 *    `urlFrom` below for the seam it gets instead.
 * 2. **PocketBase's handle is not one string.** A file there is addressed by
 *    (collection, record id, filename) and is meaningless without its record.
 *    `FileRef.name` cannot hold that, and inventing a delimited composite here
 *    would decide BCN-007 step 3 by accident. Left undecided on purpose.
 *
 * @module api/backends/fileRef
 */

import type { FileRef, FileUrlKind, SignedFileUrl } from '@noodl/backend-contract';

/**
 * What one wire calls each field of a file.
 *
 * `name` and `url` are required because {@link FileRef}'s are; the other four
 * are omitted by an adapter whose backend does not report that field at all,
 * which is different from reporting it empty and is why they are absent rather
 * than mapped to `''`.
 */
export interface FileRefWireFields {
  /** The field holding the **stored** handle — what a later sign or delete is addressed by. */
  name: string;
  url: string;
  id?: string;
  filename?: string;
  contentType?: string;
  size?: string;
}

/**
 * The Parse wire's names, which are the contract's names.
 *
 * `contentType` and `size` are ours: `nodegx-backend`'s `FileUploadResult` has
 * carried both since BAK-006 and the wire threw them away, because the old
 * `success` handed the raw response to a `CloudFile` that reads two fields.
 * Upstream Parse returns `{name, url}` only, so on that backend the two stay
 * absent — which is the honest answer and the reason they are optional.
 */
export const PARSE_FILE_FIELDS: Readonly<FileRefWireFields> = Object.freeze({
  name: 'name',
  url: 'url',
  contentType: 'contentType',
  size: 'size'
});

/** Anything a backend answered with. Loose on purpose: it is their shape, not ours. */
type WireBody = Record<string, unknown> | null | undefined;

function readString(body: WireBody, field: string | undefined): string | undefined {
  if (!body || field === undefined) return undefined;
  const value = body[field];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * Bytes, from a backend that may report them as a number or as a string.
 *
 * Directus's `filesize` is a string in its REST payloads and a number in some of
 * its SDK types; PostgREST returns `bigint` columns as strings by default. A
 * numeric string is coerced, anything else is dropped rather than turned into
 * `NaN` — a size port showing `NaN` is worse than a size port showing nothing,
 * because only one of the two is obviously missing.
 */
function readSize(body: WireBody, field: string | undefined): number | undefined {
  if (!body || field === undefined) return undefined;
  const value = body[field];
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value);
  return undefined;
}

/**
 * Turn a backend's upload/read response into a {@link FileRef}.
 *
 * `urlFrom` is the seam for the two backends that do not return a URL at all.
 * It is given the already-resolved stored name and the raw body, and its answer
 * wins over the mapped `url` field — Directus and Supabase both address a file
 * by handle and serve it from a path the client composes, and an adapter that
 * had to post-process the returned ref would be doing the composition after the
 * normalisation instead of inside it.
 *
 * ## What this deliberately does not do
 *
 * **It does not reject a response with no `url`.** A backend that answers 200
 * with neither a name nor a url produces a `FileRef` with both undefined, which
 * is exactly what the wire did before — `new CloudFile(response)` on a body with
 * no `url` has always yielded a file whose `toString()` is `undefined`. Adding
 * an error path here would be a behaviour change on a case no backend in the rig
 * produces, argued from a hypothetical. Recorded in BCN-007-NOTES instead, for
 * whoever has a second wire to compare against.
 */
export function normalizeFileRef(
  body: WireBody,
  fields: FileRefWireFields,
  urlFrom?: (name: string | undefined, body: WireBody) => string | undefined
): FileRef {
  const name = readString(body, fields.name);
  const url = urlFrom ? urlFrom(name, body) : readString(body, fields.url);

  // `name` and `url` are typed required on `FileRef` and are asserted rather
  // than proven here. See the note above: this layer reports what the backend
  // sent, and a 200 with neither is a backend bug it cannot usefully paper over.
  const ref = { name, url } as FileRef;

  const id = readString(body, fields.id);
  if (id !== undefined) ref.id = id;

  const filename = readString(body, fields.filename);
  if (filename !== undefined) ref.filename = filename;

  const contentType = readString(body, fields.contentType);
  if (contentType !== undefined) ref.contentType = contentType;

  const size = readSize(body, fields.size);
  if (size !== undefined) ref.size = size;

  return ref;
}

/**
 * Turn a backend's signing response into a {@link SignedFileUrl}.
 *
 * `kind` is passed in rather than sniffed out of the body, and that is the whole
 * point of the type. An adapter knows which of the three kinds of URL its
 * backend just minted — it wrote the request — and a heuristic over the response
 * ("does the query string contain `sig`?") would be a guess dressed as a fact
 * about how the link will fail for the user. See `FileUrlKind`.
 */
export function normalizeSignedFileUrl(body: WireBody, kind: FileUrlKind): SignedFileUrl {
  const signed = { url: readString(body, 'url'), kind } as SignedFileUrl;

  const expiresAt = readString(body, 'expiresAt');
  if (expiresAt !== undefined) signed.expiresAt = expiresAt;

  const ttlSeconds = readSize(body, 'ttlSeconds');
  if (ttlSeconds !== undefined) signed.ttlSeconds = ttlSeconds;

  return signed;
}
