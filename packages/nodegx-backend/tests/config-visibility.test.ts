/**
 * FH-018 — `GET /config` must never serve a value the caller isn't entitled to.
 *
 * The handler used to take only `res`, so it had no principal and could not
 * filter even in principle: `config-params.json` went out whole, to anyone, on
 * a public route. Parse excluded `masterKeyOnly` params from that response; we
 * did not.
 *
 * Everything here is driven over real HTTP against a real service. Reading the
 * filter would prove nothing — the defect was never in the filter, it was that
 * there wasn't one on the path a request actually takes.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { BackendService } from '../src/service';
import { request } from './helpers/http';

jest.setTimeout(30000);

/** What `GET /config` answers with. */
interface ConfigResponse {
  params: Record<string, unknown>;
}

/**
 * One file with all four shapes at once: a bare public value, a marked secret,
 * a marked-but-not-secret param (the wrapper is about visibility, not about
 * being hidden), and an ordinary object param that merely happens to have a
 * `value` key — which must NOT be mistaken for a wrapper.
 */
const CONFIG_PARAMS = {
  welcomeText: 'Hello',
  stripeKey: { value: 'sk_live_do_not_leak', masterKeyOnly: true },
  mailgunKey: { value: 'key-also-do-not-leak', secret: true },
  publicFlag: { value: 'beta', masterKeyOnly: false },
  theme: { value: 'dark', shade: 3 }
};

describe('FH-018 — GET /config filters by caller', () => {
  let dataDir: string;
  let service: BackendService;
  let base: string;
  let adminToken: string;

  const req = (headers: Record<string, string> = {}) =>
    request<ConfigResponse>(base, 'GET', '/config', { headers });

  beforeAll(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-config-test-'));
    // Enforcement ON: dev-open must not be a way round this, since a dev-open
    // backend is exactly the one an author hand-writes a real API key into.
    fs.writeFileSync(
      path.join(dataDir, 'security.json'),
      JSON.stringify({
        version: 1,
        devOpen: false,
        defaults: {
          permissions: { find: 'authenticated', get: 'authenticated', create: 'authenticated', update: 'authenticated', delete: 'authenticated' },
          creatorOwns: true
        },
        collections: {},
        functions: {},
        files: { upload: 'authenticated', read: 'authenticated', delete: 'nobody' },
        signup: 'public'
      })
    );
    fs.writeFileSync(path.join(dataDir, 'config-params.json'), JSON.stringify(CONFIG_PARAMS));

    service = new BackendService({ dataDir, port: 0, backendId: 'cfg_test', backendName: 'Config Test' });
    const started = await service.start();
    base = started.listen.url;
    expect(started.security.enforced).toBe(true);
    adminToken = JSON.parse(fs.readFileSync(path.join(dataDir, 'secrets.json'), 'utf-8')).adminToken;
  });

  afterAll(async () => {
    await service.stop();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('an unauthenticated caller cannot read a param marked secret', async () => {
    const { status, json, text } = await req();

    expect(status).toBe(200);
    // Omitted, not blanked: an anonymous caller must not even learn the key exists.
    expect(Object.keys(json.params).sort()).toEqual(['publicFlag', 'theme', 'welcomeText']);
    // The strongest form of the assertion — the secret is nowhere in the bytes
    // on the wire, whatever shape the envelope takes.
    expect(text).not.toContain('sk_live_do_not_leak');
    expect(text).not.toContain('key-also-do-not-leak');
    expect(text).not.toContain('stripeKey');
    expect(text).not.toContain('mailgunKey');
  });

  it('unwraps a marked-but-public param, and leaves an ordinary object alone', async () => {
    const { json } = await req();

    expect(json.params.welcomeText).toBe('Hello');
    // `masterKeyOnly: false` means "declared, and public" — the caller gets the
    // value, not the wrapper.
    expect(json.params.publicFlag).toBe('beta');
    // No visibility flag, so not a wrapper: an app param that happens to have a
    // `value` key survives verbatim.
    expect(json.params.theme).toEqual({ value: 'dark', shade: 3 });
  });

  it('an invalid credential is rejected outright, not treated as anonymous', async () => {
    const { status, text } = await req({ 'x-parse-master-key': 'not-the-key' });

    expect(status).toBe(401);
    expect(text).not.toContain('sk_live_do_not_leak');
  });

  it('a session-token caller is still not entitled to a secret', async () => {
    const signup = await request<{ sessionToken: string }>(base, 'POST', '/users', {
      body: { username: 'cfg-user', password: 'pw-cfg-user', email: 'cfg-user@example.com' }
    });
    expect(signup.status).toBe(201);

    const { json, text } = await req({ 'x-parse-session-token': signup.json.sessionToken });

    expect(Object.keys(json.params).sort()).toEqual(['publicFlag', 'theme', 'welcomeText']);
    expect(text).not.toContain('sk_live_do_not_leak');
  });

  it('the master key / admin token gets everything, unwrapped', async () => {
    const headerVariants: Record<string, string>[] = [
      { 'x-parse-master-key': adminToken },
      { authorization: `Bearer ${adminToken}` }
    ];
    for (const headers of headerVariants) {
      const { status, json } = await req(headers);

      expect(status).toBe(200);
      expect(json.params).toEqual({
        welcomeText: 'Hello',
        stripeKey: 'sk_live_do_not_leak',
        mailgunKey: 'key-also-do-not-leak',
        publicFlag: 'beta',
        theme: { value: 'dark', shade: 3 }
      });
    }
  });
});
