/**
 * WF-003 — the admin credential of a DEPLOYED backend survives a restart.
 *
 * This is a regression test with a specific history. WF-003 brought the service
 * up in a container (`--host 0.0.0.0`, no `--token`, persistent data volume),
 * read the minted credential out of `/data/secrets.json`, restarted the
 * container, and found a different credential. Because deploys run with
 * `restart: unless-stopped`, that meant the admin dashboard's password changed
 * on every reboot — and nothing said so. The cause was a WF-004-era safety net
 * in `resolveOptions` that BAK-003 had superseded (see src/config.ts).
 *
 * The unit-level assertion lives in config.test.ts. This one exists because the
 * bug was only visible through the *composition*: options resolution, then
 * SecurityState's "did the caller choose a token?" branch, then the file on
 * disk. A test of either half alone passed while the product was broken.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { BackendService } from '../src/service';

jest.setTimeout(30000);

/** The locked policy a deploy runs with (the interlock forbids devOpen here). */
const PRODUCTION_SECURITY = {
  version: 1,
  devOpen: false,
  defaults: {
    permissions: { find: 'authenticated', get: 'authenticated', create: 'authenticated', update: 'authenticated', delete: 'authenticated' },
    creatorOwns: true
  },
  collections: {},
  functions: {},
  files: { upload: 'authenticated', read: 'public', delete: 'nobody' },
  signup: 'public'
};

function readAdminToken(dataDir: string): string {
  const raw = JSON.parse(fs.readFileSync(path.join(dataDir, 'secrets.json'), 'utf-8'));
  return raw.adminToken;
}

describe('WF-003 deploy — admin credential lifecycle', () => {
  let dataDir: string;

  beforeEach(() => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-deploy-cred-'));
    fs.writeFileSync(path.join(dataDir, 'security.json'), JSON.stringify(PRODUCTION_SECURITY, null, 2));
  });

  afterEach(() => {
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  /** Start on a NON-loopback bind, exactly as the container does. */
  async function startDeployed(authToken: string | null = null) {
    const service = new BackendService({ dataDir, port: 0, host: '0.0.0.0', authToken });
    const started = await service.start();
    return { service, started };
  }

  it('mints a credential on first start and reports it as first-run', async () => {
    const { service, started } = await startDeployed();
    try {
      expect(started.security.adminTokenMintedThisStart).toBe(true);
      expect(readAdminToken(dataDir).length).toBeGreaterThan(20);
    } finally {
      await started.stop();
      void service;
    }
  });

  it('reuses the SAME credential on restart, and stops calling it first-run', async () => {
    const first = await startDeployed();
    const minted = readAdminToken(dataDir);
    await first.started.stop();

    const second = await startDeployed();
    try {
      // The property the container test found broken.
      expect(readAdminToken(dataDir)).toBe(minted);
      expect(second.started.security.adminTokenMintedThisStart).toBe(false);
    } finally {
      await second.started.stop();
    }
  });

  it('still lets an operator choose the credential with --token, and keeps it', async () => {
    const chosen = 'an-operator-chosen-admin-credential';
    const first = await startDeployed(chosen);
    await first.started.stop();
    expect(readAdminToken(dataDir)).toBe(chosen);

    // And a later start with no token must not replace the operator's choice.
    const second = await startDeployed(null);
    try {
      expect(readAdminToken(dataDir)).toBe(chosen);
    } finally {
      await second.started.stop();
    }
  });

  it('refuses to start a non-loopback bind with dev-open (the deploy interlock)', async () => {
    fs.writeFileSync(
      path.join(dataDir, 'security.json'),
      JSON.stringify({ ...PRODUCTION_SECURITY, devOpen: true }, null, 2)
    );
    const service = new BackendService({ dataDir, port: 0, host: '0.0.0.0', authToken: null });
    await expect(service.start()).rejects.toThrow(/devOpen/i);
  });
});
