/**
 * HLS-006 — `nodegx serve`, driven through real sockets.
 *
 * 🔴 **Everything here reads the address off the listening socket.** HLS-006 AC2 says so in as
 * many words, and the reason is the phase's own standing trap: a config value is a fact about
 * the client. `resolveAccess({}).host === '127.0.0.1'` is graded next door in
 * `hls006-access.test.ts` and it proves the option, not the binding — a `listen()` call that
 * ignored the option entirely would leave that spec green and this one red, which is the only
 * arrangement in which the pair means anything.
 *
 * ⚠️ **What this file cannot see, stated up front.** The remote-caller cases connect over this
 * machine's own LAN address, which is a real non-loopback path but not a second machine. It
 * proves the socket refuses a peer that is not loopback; it does not prove anything about
 * routing, firewalls or NAT. The second machine is HLS-006 AC1's person half and it stays a
 * person's job. On a machine with no external interface the LAN cases do not run at all — the
 * suite says so out loud rather than passing quietly.
 */
import * as fs from 'node:fs';
import * as http from 'node:http';
import * as os from 'node:os';
import * as path from 'node:path';

import { startServe, type ServeHandle } from '../src/cli/serve';
import { lanAddress } from '../src/serve/access';
import { resolveFile } from '../src/serve/staticServer';

const silent = { out: () => undefined, err: () => undefined };

let root: string;
let running: ServeHandle[];

beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'hls006-'));
  fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html><title>site</title><h1>served</h1>');
  fs.writeFileSync(path.join(root, 'app.css'), 'body{color:red}');
  fs.mkdirSync(path.join(root, 'assets'));
  fs.writeFileSync(path.join(root, 'assets', 'logo.svg'), '<svg/>');
});

beforeEach(() => {
  running = [];
});

afterEach(async () => {
  for (const handle of running) {
    handle.server.closeAllConnections();
    await new Promise((resolve) => handle.server.close(resolve));
  }
});

async function serve(args: Partial<Parameters<typeof startServe>[0]> = {}): Promise<ServeHandle> {
  const handle = await startServe({ dir: root, port: 0, share: false, host: null, token: null, ...args }, silent);
  running.push(handle);
  return handle;
}

/** One request, with the status and body it came back with. No client library, no retries. */
function get(host: string, port: number, requestPath: string, headers: http.OutgoingHttpHeaders = {}) {
  return new Promise<{ status: number; body: string; setCookie: string[] }>((resolve, reject) => {
    const request = http.get({ host, port, path: requestPath, headers }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => (body += chunk));
      response.on('end', () =>
        resolve({ status: response.statusCode ?? 0, body, setCookie: response.headers['set-cookie'] ?? [] })
      );
    });
    request.on('error', reject);
  });
}

describe('the binding, read off the socket', () => {
  it('is loopback when nothing asked for anything else', async () => {
    const handle = await serve();
    expect(handle.address).toBe('127.0.0.1');
    // The control: it is a working server, not a broken one that happens to report the right
    // address. Every refusal asserted below is meaningless without this line.
    await expect(get('127.0.0.1', handle.port, '/')).resolves.toMatchObject({ status: 200 });
  });

  /**
   * 🔴 The reverted arm. This is what the code did before HLS-006 — `.listen(port)` with no
   * address — and the assertion above has to reject it. Without this, "the address is
   * 127.0.0.1" could be a sentence about a machine that only has a loopback interface, or about
   * an assertion that never had a way to fail.
   */
  it('would have failed on the binding this task replaced', async () => {
    const control = http.createServer((_request, response) => response.end('ok'));
    await new Promise<void>((resolve) => control.listen(0, () => resolve()));
    const address = control.address() as { address: string };
    expect(address.address).not.toBe('127.0.0.1');
    expect(address.address).toBe('::'); // every interface — #31, as measured
    await new Promise((resolve) => control.close(resolve));
  });

  it('binds every interface only when sharing was asked for', async () => {
    const handle = await serve({ share: true });
    expect(handle.address).toBe('0.0.0.0');
  });

  it('takes any free port with --port 0 and reports the one it got', async () => {
    const handle = await serve({ port: 0 });
    expect(handle.port).toBeGreaterThan(0);
    await expect(get('127.0.0.1', handle.port, '/')).resolves.toMatchObject({ status: 200 });
  });
});

describe('what it refuses to serve', () => {
  it('refuses a project folder and names the two commands that are missing', async () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hls006-project-'));
    fs.writeFileSync(path.join(projectDir, 'nodegx.project.json'), '{}');
    await expect(serve({ dir: projectDir })).rejects.toThrow(/nodegx export/);
    await expect(serve({ dir: projectDir })).rejects.toThrow(/npm run build/);
  });

  it('refuses an unbuilt export and says to build it', async () => {
    const exportDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hls006-export-'));
    fs.writeFileSync(path.join(exportDir, 'package.json'), '{}');
    await expect(serve({ dir: exportDir })).rejects.toThrow(/npm ci && npm run build/);
  });

  it('refuses a folder that is not there', async () => {
    await expect(serve({ dir: path.join(os.tmpdir(), 'hls006-absent') })).rejects.toThrow(/There is no folder/);
  });

  /**
   * ⚠️ The containment check is on the resolved path. A check on the request string passes
   * `%2e%2e%2f`, because the string being inspected is not the string that gets opened.
   */
  it.each(['/../secret.txt', '/%2e%2e%2fsecret.txt', '/assets/../../secret.txt'])(
    'does not escape the root via %s',
    (requestPath) => {
      expect(resolveFile(root, requestPath)).toBeNull();
    }
  );

  it('does not treat a sibling folder with a shared prefix as inside the root', () => {
    // `/tmp/site-secrets` starts with `/tmp/site`, which is why the check is on `root + sep`.
    expect(resolveFile('/tmp/site', '/../site-secrets/x')).toBeNull();
  });

  it('still serves the files that are inside it', () => {
    expect(resolveFile(root, '/app.css')).toBe(path.join(root, 'app.css'));
    expect(resolveFile(root, '/assets/logo.svg')).toBe(path.join(root, 'assets', 'logo.svg'));
    expect(resolveFile(root, '/')).toBe(path.join(root, 'index.html'));
  });
});

/**
 * The LAN cases. `lanAddress()` is the machine's own external IPv4 — a real non-loopback path to
 * the same socket. See the file note for exactly what this does and does not prove.
 */
const lan = lanAddress();

// 🔴 Not a silent skip. A security assertion that quietly does not run is the shape of a gate
// with a hole in it, so the absence is itself a test that says why.
(lan === null ? it : it.skip)('records that the LAN cases could not run on this machine', () => {
  expect(lanAddress()).toBeNull();
  console.warn('HLS-006: no external IPv4 interface, so the remote-caller cases did not run.');
});

(lan === null ? describe.skip : describe)('a caller that is not this machine', () => {
  it('is refused without a token, refused with a wrong one, and served with the right one', async () => {
    const handle = await serve({ share: true, token: 'the-right-token' });

    // 🔴 All three in one run, against one server, which is the acceptance criterion's wording.
    // A 401 read on its own is indistinguishable from a server that is simply down.
    const missing = await get(lan as string, handle.port, '/');
    const wrong = await get(lan as string, handle.port, '/?t=not-it');
    const right = await get(lan as string, handle.port, '/?t=the-right-token');

    expect(missing.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(right.status).toBe(200);
    expect(right.body).toContain('served');

    // The refusal is about the credential: the same socket serves the same path to the same
    // client the moment the token is right, and says nothing about which way it was wrong.
    expect(missing.body).toBe(wrong.body);
    expect(missing.body).not.toContain('the-right-token');
  });

  it('accepts the token from a header and from a cookie as well as the URL', async () => {
    const handle = await serve({ share: true, token: 'the-right-token' });
    await expect(get(lan as string, handle.port, '/', { 'x-nodegx-token': 'the-right-token' })).resolves.toMatchObject({
      status: 200
    });
    await expect(get(lan as string, handle.port, '/', { cookie: 'nodegx_token=the-right-token' })).resolves.toMatchObject(
      { status: 200 }
    );
    await expect(
      get(lan as string, handle.port, '/', { authorization: 'Bearer the-right-token' })
    ).resolves.toMatchObject({ status: 200 });
  });

  it('hands back a cookie so the page the token opened can load its assets', async () => {
    const handle = await serve({ share: true, token: 'the-right-token' });
    const page = await get(lan as string, handle.port, '/?t=the-right-token');
    expect(page.setCookie.join(';')).toContain('nodegx_token=the-right-token');

    // Without that cookie the stylesheet the page asks for next is a 401, which is the failure
    // this exists to prevent: a share that renders unstyled and looks like a broken export.
    await expect(get(lan as string, handle.port, '/app.css')).resolves.toMatchObject({ status: 401 });
    await expect(
      get(lan as string, handle.port, '/app.css', { cookie: 'nodegx_token=the-right-token' })
    ).resolves.toMatchObject({ status: 200 });
  });

  it('cannot be reached at all when sharing was not asked for', async () => {
    const handle = await serve();
    // Not a 401 — nothing is listening on that interface, which is a stronger statement and the
    // one AC2 is about. `ECONNREFUSED` is the socket refusing, not the handler.
    await expect(get(lan as string, handle.port, '/?t=anything')).rejects.toMatchObject({ code: 'ECONNREFUSED' });
    // …and the control, in the same run: it is up and serving on loopback.
    await expect(get('127.0.0.1', handle.port, '/')).resolves.toMatchObject({ status: 200 });
  });

  it('does not challenge this machine even while shared', async () => {
    const handle = await serve({ share: true, token: 'the-right-token' });
    await expect(get('127.0.0.1', handle.port, '/')).resolves.toMatchObject({ status: 200 });
  });
});
