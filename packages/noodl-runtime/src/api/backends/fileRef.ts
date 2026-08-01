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
 * | Directus | `id` | *synthesised* `/assets/{id}` | `type` | `filesize` |
 * | Supabase Storage | `Key` (`bucket/path`) | *synthesised* `/object/public/{Key}` | — | — |
 * | PocketBase | the field value on a record | *synthesised* `/api/files/{c}/{id}/{name}` | — | — |
 *
 * **All four rows are implemented now** — BCN-007 step 1 shipped the first and
 * steps 2–3 the rest — and three of the four disagree with what step 1 wrote
 * here from documentation. Each correction was measured, and each is the kind
 * that would have been silent:
 *
 * 1. **Directus's stored handle is `id`, not `filename_disk`.** `DELETE /files`
 *    and the asset route are both keyed by the UUID; `filename_disk` is
 *    `{uuid}.{ext}` and looks close enough to work until an extension is
 *    missing. `filename_disk` is not mapped at all now — see
 *    {@link DIRECTUS_FILE_FIELDS}.
 * 2. **Supabase reports neither a content type nor a size on upload.** The
 *    response is `{Key, Id}` and nothing else (measured —
 *    `BCN-007-SUPABASE-STORAGE-OUTPUT.txt` §2). Step 1's table promised
 *    `metadata.mimetype` and `metadata.size`; those exist, but only on a
 *    *second* request to `POST /object/list/{bucket}`. Absent is the honest
 *    answer for an upload and the adapter does not make a second round trip to
 *    dress it up.
 * 3. **The Directus URL this composes does not work in an `<img>`.**
 *    `/assets/{id}` answers **403 unauthenticated** (BCN-004-FILE-FACTS §2.1),
 *    so the synthesised `url` is the address of the file and not a usable link.
 *    That is deliberate and is the same rule `nodegx-backend` already follows
 *    for a private file — the persisted URL is the plain one, and the usable one
 *    comes from `signFileUrl`. The alternative was to bake the caller's access
 *    token into a `FileRef.url` that gets **saved into a record property**, i.e.
 *    to persist a credential into the user's database. See
 *    `RestDataAdapter.signFileUrl`.
 *
 * The remaining structural facts, both still true:
 *
 * - **Three of the four build the URL rather than returning one.** A file
 *   reference is `{name, url}` all the way up to `CloudFile.toString()`, so
 *   those adapters synthesise the `url` from the handle plus their base address.
 *   That is not a field rename and this helper does not do it — see `urlFrom`.
 * - **PocketBase's handle is not one string.** A file there is addressed by
 *   (collection, record id, filename) and is meaningless without its record.
 *   `FileRef.name` still cannot hold that; it now travels beside it in
 *   `FileRef.target`, which is a discriminated union rather than a delimited
 *   composite for exactly the reason step 1 refused to invent one.
 *
 * @module api/backends/fileRef
 */

import type { FileRef, FileTarget, FileUrlKind, SignedFileUrl } from '@noodl/backend-contract';

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

/**
 * Directus's `/files` payload. **Measured**, twice.
 *
 * BCN-004's probe confirmed the field names step 1 had written from
 * documentation (`BCN-004-FILE-FACTS.md` §1) and BCN-007 step 2 re-read the same
 * payload for the one thing that probe did not have to decide: which field is
 * the *handle*.
 *
 * ⚠️ **`name` maps to `id`, not to `filename_disk`.** Both `DELETE /files/{id}`
 * and `/assets/{id}` are addressed by the UUID. `filename_disk` is that UUID
 * with the extension appended, which is close enough to look right in a log and
 * wrong for every file whose type Directus could not name. `filename_disk` is
 * therefore not mapped at all — a field that is never the answer to any question
 * this contract asks.
 *
 * `filename_download` is the user's own filename, which is what `FileRef.filename`
 * means everywhere else.
 */
export const DIRECTUS_FILE_FIELDS: Readonly<FileRefWireFields> = Object.freeze({
  name: 'id',
  // Directus returns no `url` at all — the adapter passes `urlFrom`. Named here
  // anyway so the shape stays total; `urlFrom` wins when it is supplied.
  url: 'url',
  id: 'id',
  filename: 'filename_download',
  contentType: 'type',
  size: 'filesize'
});

/**
 * Supabase Storage's upload response, which is `{Key, Id}` and nothing else.
 *
 * Measured — `BCN-007-SUPABASE-STORAGE-OUTPUT.txt` §2. `Key` is
 * `{bucket}/{path}`, so it is both the handle and the tail of every URL the
 * service serves the object from.
 *
 * ⚠️ **No `contentType` and no `size`, deliberately unmapped.** Storage does know
 * both — they are in `metadata.mimetype` / `metadata.size` on
 * `POST /object/list/{bucket}` — but that is a second request, made after the
 * upload, whose failure would have to be swallowed. Reporting them absent is the
 * true answer about *this* response, and absence is exactly what lets a node
 * distinguish "this backend does not say" from "this file is empty".
 */
export const SUPABASE_FILE_FIELDS: Readonly<FileRefWireFields> = Object.freeze({
  name: 'Key',
  url: 'url',
  id: 'Id'
});

/**
 * PocketBase does not have a file payload — it has a **record**, one of whose
 * fields holds a filename.
 *
 * So there is no field map here worth the name: the adapter reads
 * `record[field]` (a string, or an array for a `maxSelect > 1` field), and
 * everything else is composed. Measured — `BCN-007-FILES-PROBE-OUTPUT.txt` §3a:
 * the created record carries **no key matching /size/i and none matching
 * /mime|contenttype/i**, so those two are not merely unmapped, they are not
 * there.
 *
 * Exported as a named constant rather than inlined so the four wires read alike
 * at the call site, and so the emptiness is a stated fact rather than an
 * omission someone later "fixes".
 */
export const POCKETBASE_FILE_FIELDS: Readonly<FileRefWireFields> = Object.freeze({
  name: 'name',
  url: 'url'
});

/**
 * The expiry a JWT declares about itself.
 *
 * Three of the five backends hand back a credential-bearing URL whose lifetime
 * is written inside the credential and nowhere else in the response: Directus's
 * access token (900s, measured), PocketBase's file token (180s in the rig, and
 * configurable per install), and Supabase's signed-URL token (whatever
 * `expiresIn` asked for). `SignedFileUrl.expiresAt` exists so an author can hold
 * that number, and the only place to read it is the token.
 *
 * ⚠️ **Returns `undefined` rather than guessing.** A Directus *static* token is
 * not a JWT and never expires; a malformed segment is not an error worth
 * throwing over. Absent means "this link has no expiry we can see", which is
 * different from — and must not be rendered as — "expires now".
 *
 * Deliberately not a JWT *verifier*. Nothing here trusts the token; it reads a
 * claim the issuer put there for the client's benefit and the server enforces
 * independently.
 */
export function jwtExpiry(token: string | undefined): { expiresAt: string; ttlSeconds: number } | undefined {
  if (typeof token !== 'string') return undefined;
  const segments = token.split('.');
  if (segments.length !== 3) return undefined;

  let claims: Record<string, unknown>;
  try {
    // `base64url` is a Node/modern-browser Buffer encoding; the manual padding
    // keeps this working under `atob`, which the viewer bundle uses.
    const json = typeof atob === 'function' ? atob(base64UrlToBase64(segments[1])) : bufferDecode(segments[1]);
    claims = JSON.parse(json) as Record<string, unknown>;
  } catch {
    return undefined;
  }

  const exp = claims.exp;
  if (typeof exp !== 'number' || !Number.isFinite(exp)) return undefined;

  const ttlSeconds = Math.round(exp - Date.now() / 1000);
  return { expiresAt: new Date(exp * 1000).toISOString(), ttlSeconds };
}

function base64UrlToBase64(segment: string): string {
  const padded = segment.replace(/-/g, '+').replace(/_/g, '/');
  return padded + '='.repeat((4 - (padded.length % 4)) % 4);
}

function bufferDecode(segment: string): string {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return Buffer.from(segment, 'base64').toString('utf-8');
}

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
  urlFrom?: (name: string | undefined, body: WireBody) => string | undefined,
  /**
   * Where the file lives, for the two backends where the name is not an
   * address. Passed in by the adapter — it is the only layer that knows, and it
   * is not something that can be read back off any of these responses.
   */
  target?: FileTarget
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

  if (target !== undefined) ref.target = target;

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
