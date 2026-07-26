/**
 * File routes (BAK-006, growing WF-004's raw upload/serve/delete):
 *
 *   POST   /files/:name        raw body -> { url, name } (201)
 *   GET    /files/:name        serve bytes (originals, or `?thumb=` a cached resize)
 *   DELETE /files/:name        remove blob + metadata (+ cached thumbnails)
 *   GET    /files/:name/sign   mint a short-TTL signed URL for a private file
 *
 * `:name` is the STORED name the wire has always used — `<random8>_<sanitized
 * original>` — kept byte-identical to WF-004 so existing `CloudFile.url`s
 * (and every File-typed pointer already saved by an app) keep resolving. What
 * changed underneath: bytes now live behind a `StorageDriver` (local disk by
 * default, S3-compatible optionally — see ../storage/), addressed by an
 * OPAQUE, hash-bucketed `key` this route never constructs by hand, and every
 * upload gets a `_Files` metadata row (../storage/MetadataStore.ts) carrying
 * the SNIFFED content type, size, hash, owner, and (optionally) a BAK-003 ACL.
 *
 * ## Metadata/blob consistency
 *
 * `upload()` writes the blob via the driver FIRST, then the metadata row.
 * These are two different systems (filesystem-or-S3, and SQLite) — there is
 * no cross-system transaction. If the row insert throws, the just-written
 * blob is deleted (best-effort rollback) and the request fails loudly (500);
 * if the PROCESS dies between the two steps, the result is a genuine orphan
 * blob, which is exactly what the orphan sweep (../storage/orphanSweep.ts,
 * scheduled via FileSubsystem) exists to find and report. This is the honest
 * shape of "transactional consistency" across a blob store and a database —
 * not a false claim of atomicity, a documented detection net (BAK-006-NOTES
 * §transactional-consistency).
 *
 * ## Private files and signed URLs
 *
 * A file is private when uploaded with the `X-NodeGX-File-Private: true`
 * header (not wired into the shipped Upload File node — see BAK-006-NOTES
 * §private-upload-surface for why that is a deliberate v1 scope cut, not an
 * oversight) by an authenticated user; its `_Files` row gets an ACL granting
 * only the uploader read+write, reusing BAK-003's row-ACL model verbatim
 * (`canAccessRecord`) — there is no second permission system for files.
 *
 * Reading a private file needs EITHER a principal the row's ACL admits
 * (checked the same way any ACL'd record is checked) OR a valid `?exp=&sig=`
 * pair (../storage/signing.ts) — the escape hatch for `<img src>`, which
 * cannot carry a session-token header. `GET /files/:name/sign` mints one,
 * gated by the SAME row-ACL check. Because a signed URL EXPIRES, the `url`
 * `upload()` returns for a private file is always the PLAIN (unsigned) path —
 * a persisted `CloudFile.url` for a private file is not directly usable in an
 * `<img>` without first calling `/sign`; this is documented, not hidden.
 *
 * @module nodegx-backend/server/files
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import type { RequestContext } from './HttpServer';
import { CORS_HEADERS, HttpError, readRawBody, sendJSON } from './http-util';
import { canAccessRecord } from '../security/model';
import type { FileSubsystem } from '../storage/FileSubsystem';
import type { FileRecord } from '../storage/MetadataStore';
import { sniff } from '../storage/sniff';
import { signFileAccess, verifyFileAccess } from '../storage/signing';
import { renderThumbnail, TransformUnavailableError, type FitMode } from '../storage/transform';

function sanitizeName(name: string): string {
  const base = path.basename(name);
  return base.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function sha256hex(data: Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

interface ThumbSpec {
  key: string; // cache-path-safe identifier for this spec (preset name, or "WxHfit")
  width: number;
  height: number;
  fit: FitMode;
}

export class FileRoutes {
  private readonly thumbsDir: string;
  private baseUrl: string;

  constructor(private readonly dataDir: string, baseUrl: string, private readonly subsystem: FileSubsystem) {
    this.thumbsDir = path.join(dataDir, 'files', 'thumbs');
    this.baseUrl = baseUrl;
  }

  setBaseUrl(url: string): void {
    this.baseUrl = url;
  }

  // ==========================================================================
  // Upload
  // ==========================================================================

  async upload(ctx: RequestContext): Promise<void> {
    const config = this.subsystem.config.get();

    // Reject on the declared Content-Length FIRST, same pattern WF-005's
    // webhook body limit uses (HttpServer.ts's handleWebhook comment): reading
    // past the limit then destroying the socket races the 413 response with a
    // connection reset, so a real sender (which always sets Content-Length for
    // a file upload) never actually SEES the 413 — it just sees the socket
    // die. `readRawBody`'s own maxSize is kept as a backstop for chunked/
    // unset-length bodies.
    const declaredLength = Number(ctx.req.headers['content-length'] || '0');
    if (declaredLength && declaredLength > config.maxUploadBytes) {
      throw new HttpError(413, `Upload exceeds this backend's ${config.maxUploadBytes}-byte limit.`);
    }

    const body = await readRawBody(ctx.req, config.maxUploadBytes);
    if (body.length === 0) throw new HttpError(400, 'Refusing an empty upload.');

    const originalName = sanitizeName(ctx.params.name);
    const sniffed = sniff(body, originalName);

    if (config.contentTypes.denyList.includes(sniffed.contentType)) {
      throw new HttpError(400, `Content type "${sniffed.contentType}" is not allowed on this backend.`);
    }
    if (config.contentTypes.allowList && !config.contentTypes.allowList.includes(sniffed.contentType)) {
      throw new HttpError(400, `Content type "${sniffed.contentType}" is not in this backend's allow list.`);
    }

    const hash = sha256hex(body);
    const storedName = `${crypto.randomBytes(8).toString('hex')}_${originalName}`;
    const isPrivate = String(ctx.req.headers['x-nodegx-file-private'] || '').toLowerCase() === 'true';
    const owner = ctx.principal.kind === 'user' ? ctx.principal.userId : null;

    const driver = this.subsystem.getDriver();
    const key = await driver.put(hash, body);
    try {
      const record = await this.subsystem.metadata.create({
        storedName,
        originalName,
        size: body.length,
        contentType: sniffed.contentType,
        hash,
        driver: driver.kind,
        key,
        owner,
        private: isPrivate
      });
      sendJSON(ctx.res, 201, {
        url: `${this.baseUrl}/files/${encodeURIComponent(storedName)}`,
        name: storedName,
        size: record.size,
        contentType: record.contentType
      });
    } catch (e) {
      // Best-effort rollback of the blob we just wrote — see module doc.
      try {
        await driver.delete(key);
      } catch {
        /* the orphan sweep will find it if this also fails */
      }
      throw e;
    }
  }

  // ==========================================================================
  // Serve (original or thumbnail)
  // ==========================================================================

  async serve(ctx: RequestContext): Promise<void> {
    const storedName = ctx.params.name;
    const record = await this.subsystem.metadata.findByStoredName(storedName);
    if (!record) throw new HttpError(404, 'File not found.', 153);

    this.assertReadable(ctx, record);

    const thumbParam = ctx.query.thumb;
    if (thumbParam) {
      await this.serveThumbnail(ctx, record, thumbParam);
      return;
    }

    const etag = `"${record.hash}"`;
    if (ctx.req.headers['if-none-match'] === etag) {
      ctx.res.writeHead(304, { ETag: etag, ...CORS_HEADERS });
      ctx.res.end();
      return;
    }

    const driver = this.subsystem.getDriver();
    ctx.res.writeHead(200, {
      'Content-Type': record.contentType,
      'Content-Length': record.size,
      ETag: etag,
      'Cache-Control': record.private ? 'private, no-store' : 'public, max-age=31536000, immutable',
      ...CORS_HEADERS
    });
    const stream = driver.createReadStream(record.key);
    stream.on('error', (e: Error) => {
      // Headers are already sent; the best we can do is end the connection loudly in the log.
      // eslint-disable-next-line no-console
      console.error(`[nodegx-backend] error streaming file "${storedName}": ${e.message}`);
      ctx.res.destroy();
    });
    stream.pipe(ctx.res);
  }

  /** `GET /files/:name/sign` — mint a short-TTL signed URL for a (typically private) file. */
  async signUrl(ctx: RequestContext): Promise<void> {
    const storedName = ctx.params.name;
    const record = await this.subsystem.metadata.findByStoredName(storedName);
    if (!record) throw new HttpError(404, 'File not found.', 153);
    this.assertReadable(ctx, record, { allowSignature: false });

    const ttl = this.subsystem.config.get().signedUrlTtlSeconds;
    const secret = this.subsystem.getSigningSecret();
    const { exp, sig } = signFileAccess(secret, storedName, ttl);
    sendJSON(ctx.res, 200, {
      url: `${this.baseUrl}/files/${encodeURIComponent(storedName)}?exp=${exp}&sig=${sig}`,
      expiresAt: new Date(exp * 1000).toISOString(),
      ttlSeconds: ttl
    });
  }

  /**
   * Row-level read gate for a private file: the presented signature (unless
   * `allowSignature: false`, used by /sign itself — minting a NEW signature
   * must be justified by real read access, not a still-valid old one) OR the
   * resolved principal's BAK-003 ACL standing. Public files (no ACL) always
   * pass — this only ever narrows, never widens, what the coarse `files.read`
   * route gate (HttpServer's `checkAccess`) already allowed through.
   */
  private assertReadable(ctx: RequestContext, record: FileRecord, opts: { allowSignature?: boolean } = {}): void {
    if (!record.private && !record.ACL) return;
    if (opts.allowSignature !== false) {
      const exp = Number(ctx.query.exp);
      const sig = ctx.query.sig;
      if (sig && verifyFileAccess(this.subsystem.getSigningSecret(), record.storedName, exp, sig)) return;
    }
    if (canAccessRecord(ctx.principal, record, 'read')) return;
    throw new HttpError(403, 'This file is private.', 119);
  }

  // ==========================================================================
  // Thumbnails
  // ==========================================================================

  private resolveThumbSpec(ctx: RequestContext, raw: string): ThumbSpec {
    const presets = this.subsystem.config.get().thumbnails.presets;
    const preset = presets[raw];
    if (preset) return { key: raw, width: preset.width, height: preset.height, fit: preset.fit };

    const m = /^(\d{1,4})x(\d{1,4})$/.exec(raw);
    if (m) {
      if (ctx.principal.kind !== 'admin') {
        throw new HttpError(403, 'Arbitrary thumbnail dimensions are admin-only; use a named preset.', 119);
      }
      const width = Number(m[1]);
      const height = Number(m[2]);
      return { key: `${width}x${height}`, width, height, fit: 'contain' };
    }
    throw new HttpError(400, `Unknown thumbnail preset "${raw}". Known presets: ${Object.keys(presets).join(', ') || '(none configured)'}.`);
  }

  private async serveThumbnail(ctx: RequestContext, record: FileRecord, rawSpec: string): Promise<void> {
    const spec = this.resolveThumbSpec(ctx, rawSpec);
    const etag = `"${record.hash}-${spec.key}"`;
    if (ctx.req.headers['if-none-match'] === etag) {
      ctx.res.writeHead(304, { ETag: etag, ...CORS_HEADERS });
      ctx.res.end();
      return;
    }

    const cacheDir = path.join(this.thumbsDir, record.hash);
    const cacheFile = path.join(cacheDir, `${spec.key}.bin`);
    const cacheMetaFile = path.join(cacheDir, `${spec.key}.meta.json`);

    let buffer: Buffer;
    let contentType: string;
    if (fs.existsSync(cacheFile) && fs.existsSync(cacheMetaFile)) {
      buffer = fs.readFileSync(cacheFile);
      contentType = (JSON.parse(fs.readFileSync(cacheMetaFile, 'utf-8')) as { contentType: string }).contentType;
    } else {
      const status = this.subsystem.transformStatus();
      if (!status.available) {
        sendJSON(ctx.res, 501, {
          error: 'Image transforms are unavailable on this backend.',
          reason: status.reason
        });
        return;
      }
      const source = await this.subsystem.getDriver().get(record.key);
      try {
        const rendered = await renderThumbnail(source, record.contentType, spec);
        buffer = rendered.buffer;
        contentType = rendered.contentType;
      } catch (e) {
        if (e instanceof TransformUnavailableError) {
          sendJSON(ctx.res, 501, { error: 'Image transforms are unavailable on this backend.', reason: e.reason });
          return;
        }
        throw new HttpError(400, `Could not render a thumbnail for this file: ${e instanceof Error ? e.message : e}`);
      }
      fs.mkdirSync(cacheDir, { recursive: true });
      fs.writeFileSync(cacheFile, buffer);
      fs.writeFileSync(cacheMetaFile, JSON.stringify({ contentType }));
    }

    ctx.res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': buffer.length,
      ETag: etag,
      'Cache-Control': record.private ? 'private, no-store' : 'public, max-age=31536000, immutable',
      ...CORS_HEADERS
    });
    ctx.res.end(buffer);
  }

  // ==========================================================================
  // Delete
  // ==========================================================================

  async delete(ctx: RequestContext): Promise<void> {
    const storedName = ctx.params.name;
    const record = await this.subsystem.metadata.findByStoredName(storedName);
    if (!record) {
      // Idempotent, matching WF-004's original behavior.
      sendJSON(ctx.res, 200, {});
      return;
    }
    if ((record.private || record.ACL) && !canAccessRecord(ctx.principal, record, 'write')) {
      throw new HttpError(403, 'You cannot delete this file.', 119);
    }

    const driver = this.subsystem.getDriver();
    await driver.delete(record.key);
    await this.subsystem.metadata.deleteById(record.objectId);

    // Invalidate cached thumbnails for this file's content — the success
    // criterion "a replaced file invalidates its cached thumbnails": a
    // replace in this wire protocol is delete-then-reupload (there is no
    // in-place "replace this stored name"), and the reupload gets a NEW hash
    // (different bytes) or a brand-new storedName+key (identical bytes) —
    // either way the OLD cache entries below are for content nothing points
    // at anymore once this delete completes.
    const cacheDir = path.join(this.thumbsDir, record.hash);
    if (fs.existsSync(cacheDir)) fs.rmSync(cacheDir, { recursive: true, force: true });

    sendJSON(ctx.res, 200, {});
  }
}
