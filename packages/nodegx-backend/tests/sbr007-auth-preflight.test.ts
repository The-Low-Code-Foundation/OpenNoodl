/**
 * SBR-007 D21 — the CORS allow-list must cover the headers our own auth client
 * sends.
 *
 * `ParseAuthAdapter._makeRequest` (noodl-runtime) sets four headers on every
 * auth call: `X-Parse-Application-Id`, `X-Parse-Installation-Id`,
 * `X-Parse-Session-Token` and `Content-Type`. `X-Parse-Installation-Id` was not
 * in `ALLOW_HEADERS`, so on any deployed site whose backend is a different
 * origin — the normal deployed shape — Chrome refused the request after a
 * successful preflight (`HeaderDisallowedByPreflightResponse`) and the site
 * builder's panel reported *"That email and password did not match."* for a
 * correct password. The backend never saw the request.
 *
 * 🔴 **The second case is why the first one means anything.** "Every header I
 * asked for is allowed" is also what a list that had become `*`, or one echoing
 * the request back, would produce — and that would be a security regression
 * wearing this test's green. So a header nothing sends must be REFUSED by the
 * same call. Without that control, the fix and a wildcard are the same pass.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { BackendService } from '../src/service';

jest.setTimeout(30000);

/** Exactly what `ParseAuthAdapter._makeRequest` sets, in wire case. */
const AUTH_HEADERS = [
  'content-type',
  'x-parse-application-id',
  'x-parse-installation-id',
  'x-parse-session-token'
];

describe('SBR-007 D21 — auth preflight', () => {
  let service: BackendService;
  let base: string;
  let dataDir: string;

  beforeAll(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-d21-'));
    service = new BackendService({
      dataDir,
      port: 0,
      backendId: 'backend_d21',
      backendName: 'D21 Preflight Test'
    });
    const started = await service.start();
    base = started.listen.url;
  });

  afterAll(async () => {
    await service.stop();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  /** The `Access-Control-Allow-Headers` a preflight naming `requested` returns. */
  async function preflight(requested: string[]): Promise<string[]> {
    const res = await fetch(`${base}/login`, {
      method: 'OPTIONS',
      headers: {
        origin: 'https://site.example',
        'access-control-request-method': 'POST',
        'access-control-request-headers': requested.join(',')
      }
    });
    const allowed = res.headers.get('access-control-allow-headers') || '';
    return allowed
      .split(',')
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean);
  }

  it('allows every header the auth client sends', async () => {
    const allowed = await preflight(AUTH_HEADERS);
    for (const header of AUTH_HEADERS) {
      expect(allowed).toContain(header);
    }
  });

  it('🔴 control: still refuses a header nothing sends', async () => {
    // Asked for in the same call, so this is the same instrument answering
    // about two headers rather than two runs answering about one.
    const allowed = await preflight([...AUTH_HEADERS, 'x-not-a-real-header']);
    expect(allowed).toContain('x-parse-installation-id');
    expect(allowed).not.toContain('x-not-a-real-header');
  });
});
