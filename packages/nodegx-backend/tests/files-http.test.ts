/**
 * BAK-006 end-to-end over a real BackendService — the file-storage v2 surface
 * (WF-004's raw `/files` grown into metadata, validation, private files +
 * signed URLs, thumbnails, and the admin config/sweep surface).
 *
 * Runs dev-open (default) except where a test needs real sessions (private
 * files), matching the style of backup-http.test.ts / security-enforcement.
 * `sharp` is genuinely NOT installed in this worktree (an optionalDependency;
 * see BAK-006-NOTES §sharp-availability) — the thumbnail tests below prove
 * the REAL loud-501 behavior, not a simulated one.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import type { FileConfigResponse, SweepResponse } from '../src/server/admin-files';
import type { FileUploadResult, SignedUrlResult } from '../src/server/files';

import { BackendService } from '../src/service';

import { ErrorBody, ParseRecord, request } from './helpers/http';

jest.setTimeout(30000);

// A real, tiny PNG (1x1 transparent) — used to prove sniffing beats the
// client-declared name/extension, and (where sharp is installed) genuinely
// decodable, so the thumbnail path renders real bytes rather than 400ing.
const PNG_BYTES = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489' +
    '0000000d4944415478da63fccfc0500f000485018084a98c210000000049454e44ae426082',
  'hex'
);
const PDF_BYTES = Buffer.from('%PDF-1.4\n%fake pdf content for testing\n%%EOF', 'ascii');

/**
 * Is `sharp` actually installed here? It is an `optionalDependency`, so both
 * answers are legitimate environments and the thumbnail tests below assert the
 * REAL behaviour of whichever one they are running in — a 501 carrying a reason
 * when it is absent, a rendered image when it is present. Never a simulation,
 * and never a suite that passes only on one side of the fence.
 */
const SHARP_AVAILABLE = (() => {
  try {
    require.resolve('sharp');
    return true;
  } catch {
    return false;
  }
})();

describe('BAK-006 file storage v2 over HTTP', () => {
  let dataDir: string;
  let service: BackendService;
  let base: string;
  let adminToken: string;

  interface User {
    id: string;
    token: string;
  }
  let alice: User;
  let bob: User;

  const req = <T = unknown>(method: string, p: string, body?: unknown, headers: Record<string, string> = {}) =>
    request<T>(base, method, p, { body, headers });

  /** POST raw bytes to /files/:name. Returns the whole result so a spec can assert the status. */
  const postFile = (name: string, bytes: Buffer, headers: Record<string, string> = {}) =>
    request<FileUploadResult>(base, 'POST', `/files/${name}`, { body: bytes, headers, raw: true });

  /** The same, for the majority of cases that only care about a successful upload. */
  async function uploadFile(
    name: string,
    bytes: Buffer,
    headers: Record<string, string> = {}
  ): Promise<FileUploadResult> {
    const res = await postFile(name, bytes, headers);
    if (res.status !== 201) throw new Error(`upload of ${name} failed: ${res.status} ${res.text}`);
    return res.json;
  }

  const asUser = (u: User) => ({ 'x-parse-session-token': u.token });
  const asAdmin = () => ({ authorization: `Bearer ${adminToken}` });

  async function signup(username: string): Promise<User> {
    const { status, json } = await req<ParseRecord & { sessionToken: string }>('POST', '/users', {
      username,
      password: `pw-${username}`
    });
    expect(status).toBe(201);
    return { id: json.objectId, token: json.sessionToken };
  }

  beforeAll(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-bak006-'));
    service = new BackendService({ dataDir, port: 0, backendId: 'bak006', backendName: 'BAK006 Test' });
    base = (await service.start()).listen.url;
    adminToken = JSON.parse(fs.readFileSync(path.join(dataDir, 'secrets.json'), 'utf-8')).adminToken;
    alice = await signup('alice');
    bob = await signup('bob');
  });

  afterAll(async () => {
    await service.stop();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  // ==========================================================================
  // Upload, sniffing, headers
  // ==========================================================================

  it('uploads a file and serves it back with the SNIFFED content type, not the declared extension', async () => {
    // The client lies about the type.
    const uploadJson = await uploadFile('definitely-a.pdf', PNG_BYTES, { 'content-type': 'application/pdf' });
    expect(uploadJson.name).toMatch(/_definitely-a\.pdf$/);
    expect(uploadJson.contentType).toBe('image/png'); // sniffed, not "application/pdf"

    const get = await fetch(uploadJson.url);
    expect(get.status).toBe(200);
    expect(get.headers.get('content-type')).toBe('image/png');
    expect(get.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    expect(get.headers.get('etag')).toBeTruthy();
    const bytes = Buffer.from(await get.arrayBuffer());
    expect(bytes.equals(PNG_BYTES)).toBe(true);
  });

  it('a conditional GET (If-None-Match) with the current ETag returns 304', async () => {
    const { url } = await uploadFile('cond.png', PNG_BYTES);
    const first = await fetch(url);
    const etag = first.headers.get('etag') as string;
    const second = await fetch(url, { headers: { 'if-none-match': etag } });
    expect(second.status).toBe(304);
  });

  it('deleting removes the file; a subsequent GET is 404; delete is idempotent', async () => {
    const { name, url } = await uploadFile('to-delete.png', PNG_BYTES);
    const del1 = await req('DELETE', `/files/${name}`);
    expect(del1.status).toBe(200);
    const gone = await fetch(url);
    expect(gone.status).toBe(404);
    const del2 = await req('DELETE', `/files/${name}`); // idempotent
    expect(del2.status).toBe(200);
  });

  // ==========================================================================
  // Validation: size + content-type policy
  // ==========================================================================

  it('rejects an oversized upload with an actionable error, then accepts once the limit is restored', async () => {
    const cfgBefore = await req<FileConfigResponse>('GET', '/admin/files/config', undefined, asAdmin());
    const originalMax = cfgBefore.json.config.maxUploadBytes;

    await req('PUT', '/admin/files/config', { maxUploadBytes: 8 }, asAdmin());
    expect((await postFile('big.png', PNG_BYTES)).status).toBe(413);

    await req('PUT', '/admin/files/config', { maxUploadBytes: originalMax }, asAdmin());
    expect((await postFile('big.png', PNG_BYTES)).status).toBe(201);
  });

  it('rejects a disallowed (sniffed) content type with an actionable error', async () => {
    await req('PUT', '/admin/files/config', { contentTypes: { denyList: ['application/pdf'], allowList: null } }, asAdmin());
    const denied = await request<ErrorBody>(base, 'POST', '/files/doc.pdf', { body: PDF_BYTES, raw: true });
    expect(denied.status).toBe(400);
    expect(String(denied.json.error)).toMatch(/not allowed/i);

    // PNGs are unaffected.
    expect((await postFile('still-ok.png', PNG_BYTES)).status).toBe(201);

    await req('PUT', '/admin/files/config', { contentTypes: { denyList: [], allowList: null } }, asAdmin());
  });

  it('refuses an empty upload', async () => {
    const res = await fetch(`${base}/files/empty.png`, { method: 'POST', body: Buffer.alloc(0) });
    expect(res.status).toBe(400);
  });

  // ==========================================================================
  // Private files + signed URLs
  // ==========================================================================

  it('a private file: owner reads it directly (session), another user is denied, anonymous is denied', async () => {
    const { url, name } = await uploadFile('secret.png', PNG_BYTES, {
      'x-nodegx-file-private': 'true',
      ...asUser(alice)
    });

    const asOwner = await fetch(url, { headers: asUser(alice) });
    expect(asOwner.status).toBe(200);

    const asOther = await fetch(url, { headers: asUser(bob) });
    expect(asOther.status).toBe(403);

    const anon = await fetch(url);
    expect(anon.status).toBe(403);

    // Admin always bypasses (master-key semantics).
    const asAdminFetch = await fetch(url, { headers: asAdmin() });
    expect(asAdminFetch.status).toBe(200);

    // Cache-Control must never let a shared cache store a gated response.
    expect(asOwner.headers.get('cache-control')).toBe('private, no-store');

    // Clean up.
    await req('DELETE', `/files/${name}`, undefined, asUser(alice));
  });

  it('a signed URL lets an UNAUTHENTICATED request (the <img src> case) read a private file, scoped and time-limited', async () => {
    const { name } = await uploadFile('secret2.png', PNG_BYTES, {
      'x-nodegx-file-private': 'true',
      ...asUser(alice)
    });

    // Another user cannot even mint a signature for alice's file.
    const bobSign = await req('GET', `/files/${name}/sign`, undefined, asUser(bob));
    expect(bobSign.status).toBe(403);

    const sign = await req<SignedUrlResult>('GET', `/files/${name}/sign`, undefined, asUser(alice));
    expect(sign.status).toBe(200);
    expect(sign.json.url).toContain('sig=');
    expect(sign.json.url).toContain('exp=');

    // No auth headers at all — exactly what an <img src="..."> sends.
    const viaSignedUrl = await fetch(sign.json.url);
    expect(viaSignedUrl.status).toBe(200);
    const bytes = Buffer.from(await viaSignedUrl.arrayBuffer());
    expect(bytes.equals(PNG_BYTES)).toBe(true);

    // Tampering with the signature is refused.
    const tampered = sign.json.url.replace(/sig=[0-9a-f]+/, 'sig=' + '0'.repeat(64));
    const tamperedRes = await fetch(tampered);
    expect(tamperedRes.status).toBe(403);

    // A signature is scoped to ITS file — cannot be replayed against another stored name.
    const swapped = sign.json.url.replace(name, 'some-other-name.png');
    const swappedRes = await fetch(swapped);
    expect([403, 404]).toContain(swappedRes.status); // 404 if the other name doesn't exist, 403 if it does and denies

    await req('DELETE', `/files/${name}`, undefined, asUser(alice));
  });

  it('a signed URL expires (real time, short TTL)', async () => {
    await req('PUT', '/admin/files/config', { signedUrlTtlSeconds: 1 }, asAdmin());
    const { name } = await uploadFile('secret3.png', PNG_BYTES, {
      'x-nodegx-file-private': 'true',
      ...asUser(alice)
    });
    const sign = await req<SignedUrlResult>('GET', `/files/${name}/sign`, undefined, asUser(alice));
    expect(sign.status).toBe(200);

    const fresh = await fetch(sign.json.url);
    expect(fresh.status).toBe(200);

    // exp is second-granularity (floor(now/1000) + ttl), so with ttl=1 the
    // REAL remaining time at sign-instant is anywhere in (0, 1000]ms — wait
    // well past the worst case (comfortable margin for a loaded CI machine).
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const expired = await fetch(sign.json.url);
    expect(expired.status).toBe(403);

    await req('PUT', '/admin/files/config', { signedUrlTtlSeconds: 300 }, asAdmin());
    await req('DELETE', `/files/${name}`, undefined, asUser(alice));
  });

  it('a non-owner cannot delete a private file', async () => {
    const { name } = await uploadFile('secret4.png', PNG_BYTES, {
      'x-nodegx-file-private': 'true',
      ...asUser(alice)
    });
    const bobDelete = await req('DELETE', `/files/${name}`, undefined, asUser(bob));
    expect(bobDelete.status).toBe(403);
    const aliceDelete = await req('DELETE', `/files/${name}`, undefined, asUser(alice));
    expect(aliceDelete.status).toBe(200);
  });

  // ==========================================================================
  // Thumbnails: asserted against the REAL sharp availability of this
  // environment (see SHARP_AVAILABLE) — never mocked, either way
  // ==========================================================================

  it('?thumb= on a named preset renders when sharp is present, and 501s with a reason when it is not', async () => {
    const { url } = await uploadFile('thumbme.png', PNG_BYTES);
    const res = await fetch(`${url}?thumb=sm`);

    if (SHARP_AVAILABLE) {
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('image/png');
      expect(Buffer.from(await res.arrayBuffer()).length).toBeGreaterThan(0);
    } else {
      expect(res.status).toBe(501);
      const body = (await res.json()) as ErrorBody & { reason?: string };
      expect(String(body.reason)).toMatch(/sharp/i);
    }

    // Originals are completely unaffected either way.
    const original = await fetch(url);
    expect(original.status).toBe(200);
  });

  it('an unknown thumbnail preset is a 400, not a 501 or a silent fallback', async () => {
    const { url } = await uploadFile('thumbme2.png', PNG_BYTES);
    const res = await fetch(`${url}?thumb=not-a-real-preset`);
    expect(res.status).toBe(400);
  });

  it('arbitrary WxH thumbnail dimensions are admin-only, gated BEFORE the sharp-availability check', async () => {
    const { url } = await uploadFile('thumbme3.png', PNG_BYTES);

    const nonAdmin = await fetch(`${url}?thumb=999x999`);
    expect(nonAdmin.status).toBe(403);

    // Passed the admin gate — what follows is whatever the real transform
    // availability dictates, which is the point: the 403 above is decided first.
    const admin = await fetch(`${url}?thumb=999x999`, { headers: asAdmin() });
    expect(admin.status).toBe(SHARP_AVAILABLE ? 200 : 501);
  });

  // ==========================================================================
  // Admin config surface
  // ==========================================================================

  it('GET /admin/files/config reports limits, driver, and honest transform availability', async () => {
    const res = await req<FileConfigResponse>('GET', '/admin/files/config', undefined, asAdmin());
    expect(res.status).toBe(200);
    expect(res.json.driverKind).toBe('local');
    expect(res.json.transformsAvailable).toBe(SHARP_AVAILABLE);
    if (!SHARP_AVAILABLE) {
      expect(String(res.json.transformUnavailableReason)).toMatch(/sharp/i);
    }
    expect(res.json.config.thumbnails.presets.sm).toEqual({ width: 64, height: 64, fit: 'cover' });
  });

  it('rejects an s3 driver config missing endpoint/bucket', async () => {
    const res = await req('PUT', '/admin/files/config', { driver: { type: 's3', endpoint: '', bucket: '' } }, asAdmin());
    expect(res.status).toBe(400);
  });

  // ==========================================================================
  // Orphan sweep — report-only by default, deletes only when explicitly asked
  // ==========================================================================

  it('the orphan sweep finds a planted orphan blob and an orphaned metadata row, reports both, and does not delete unless asked', async () => {
    // A live file, for the "orphan row" half: delete its blob directly on disk
    // without going through DELETE (bypassing metadata cleanup) to simulate
    // a blob lost outside the normal path.
    const { url: liveUrl } = await uploadFile('will-lose-its-blob.png', PNG_BYTES);
    const liveGet = await fetch(liveUrl);
    expect(liveGet.status).toBe(200);

    const blobsRoot = path.join(dataDir, 'files', 'blobs');
    function findBlobFiles(dir: string): string[] {
      const out: string[] = [];
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...findBlobFiles(full));
        else out.push(full);
      }
      return out;
    }
    const before = findBlobFiles(blobsRoot);
    // Remove ONE real blob on disk (simulating a lost blob for a live row).
    fs.unlinkSync(before[0]);

    // Plant an orphan blob: a file on disk with no metadata row pointing at it.
    const orphanDir = path.join(blobsRoot, 'de', 'ad');
    fs.mkdirSync(orphanDir, { recursive: true });
    const orphanKey = 'de/ad/deadbeef-cafebabe';
    fs.writeFileSync(path.join(orphanDir, 'deadbeef-cafebabe'), 'planted orphan blob');

    const reportOnly = await req<SweepResponse>('POST', '/admin/files/sweep', {}, asAdmin());
    expect(reportOnly.status).toBe(200);
    expect(reportOnly.json.report.orphanBlobs).toContain(orphanKey);
    expect(reportOnly.json.report.orphanRows.length).toBeGreaterThanOrEqual(1);
    expect(reportOnly.json.report.deleted).toBe(false);
    // Report-only: the planted blob must STILL be on disk.
    expect(fs.existsSync(path.join(orphanDir, 'deadbeef-cafebabe'))).toBe(true);

    const withDelete = await req<SweepResponse>('POST', '/admin/files/sweep', { deleteOrphans: true }, asAdmin());
    expect(withDelete.status).toBe(200);
    expect(withDelete.json.report.deleted).toBe(true);
    expect(fs.existsSync(path.join(orphanDir, 'deadbeef-cafebabe'))).toBe(false);

    // Orphan ROWS are never auto-deleted, even with deleteOrphans:true — an
    // operator has to look at those (module doc: "never rows").
    const again = await req<SweepResponse>('POST', '/admin/files/sweep', {}, asAdmin());
    expect(again.json.report.orphanRows.length).toBeGreaterThanOrEqual(1);
  });
});
