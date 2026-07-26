/**
 * BAK-003 — the MCP backend tools driven against a REAL running nodegx-backend.
 *
 * This proves the model doc's headline agent criterion end to end, over MCP
 * alone: "lock a collection to a role, create the role, assign a user, verify
 * the effect." The backend is the actual built `dist/cli.js` spawned as a child
 * process (the way it runs in production), discovered exactly the way the tools
 * discover it — a config.json + secrets.json under NODEGX_BACKENDS_DIR.
 *
 * Skips (loudly) if the backend bundle hasn't been built, so a fresh checkout
 * without `npm run build` in nodegx-backend doesn't hard-fail this package.
 */
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { connect, TestSession, call } from './helpers';

const BACKEND_DIR = path.join(__dirname, '..', '..', 'nodegx-backend');
const BACKEND_CLI = path.join(BACKEND_DIR, 'dist', 'cli.js');
const FIXTURE = path.join(__dirname, 'fixtures', 'demo-app');

const haveBundle = fs.existsSync(BACKEND_CLI);
const describeOrSkip = haveBundle ? describe : describe.skip;

jest.setTimeout(40000);

interface Started {
  proc: ChildProcess;
  port: number;
  backendsDir: string;
  dataDir: string;
}

async function startBackend(): Promise<Started> {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-backend-data-'));
  // Lock the backend so enforcement is active (non-loopback would need it too;
  // loopback + devOpen:false enforces identically and needs no wide bind).
  fs.writeFileSync(
    path.join(dataDir, 'security.json'),
    JSON.stringify({
      version: 1,
      devOpen: false,
      defaults: {
        permissions: {
          find: 'authenticated',
          get: 'authenticated',
          create: 'authenticated',
          update: 'authenticated',
          delete: 'authenticated'
        },
        creatorOwns: true
      },
      collections: {},
      functions: {},
      files: { upload: 'authenticated', read: 'public', delete: 'nobody' },
      signup: 'public'
    })
  );

  const proc = spawn(process.execPath, [BACKEND_CLI, 'serve', '--data-dir', dataDir, '--port', '0'], {
    stdio: ['ignore', 'pipe', 'pipe']
  });

  const port = await new Promise<number>((resolve, reject) => {
    let buf = '';
    const timer = setTimeout(() => reject(new Error(`backend did not become ready:\n${buf}`)), 20000);
    proc.stdout!.on('data', (chunk) => {
      buf += chunk.toString();
      const m = buf.match(/NODEGX_BACKEND_READY (\{.*\})/);
      if (m) {
        clearTimeout(timer);
        resolve(JSON.parse(m[1]).port);
      }
    });
    proc.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`backend exited early (${code}):\n${buf}`));
    });
  });

  // The discovery layout the tools read: ~/.noodl/backends/<id>/{config,secrets}.json
  const backendsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-backends-'));
  const id = 'mcp_test_backend';
  fs.mkdirSync(path.join(backendsDir, id));
  fs.writeFileSync(
    path.join(backendsDir, id, 'config.json'),
    JSON.stringify({ id, name: 'MCP Test Backend', port })
  );
  fs.copyFileSync(path.join(dataDir, 'secrets.json'), path.join(backendsDir, id, 'secrets.json'));

  return { proc, port, backendsDir, dataDir };
}

/** Create a user directly against the backend (the tools don't sign users up). */
async function signup(port: number, username: string): Promise<string> {
  const res = await fetch(`http://127.0.0.1:${port}/users`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password: `pw-${username}` })
  });
  return (await res.json()).objectId as string;
}

describeOrSkip('MCP backend permission tools (live backend)', () => {
  let backend: Started;
  let session: TestSession;
  let projectDir: string;
  const prevBackendsDir = process.env.NODEGX_BACKENDS_DIR;

  beforeAll(async () => {
    backend = await startBackend();
    process.env.NODEGX_BACKENDS_DIR = backend.backendsDir;
    projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-proj-'));
    fs.cpSync(FIXTURE, projectDir, { recursive: true });
    session = await connect(projectDir, true);
  });

  afterAll(async () => {
    if (session) await session.close();
    if (backend) {
      backend.proc.kill('SIGTERM');
      fs.rmSync(backend.backendsDir, { recursive: true, force: true });
      fs.rmSync(backend.dataDir, { recursive: true, force: true });
    }
    fs.rmSync(projectDir, { recursive: true, force: true });
    if (prevBackendsDir === undefined) delete process.env.NODEGX_BACKENDS_DIR;
    else process.env.NODEGX_BACKENDS_DIR = prevBackendsDir;
  });

  it('list_backends finds the running backend with its admin credential', async () => {
    const { isError, data } = await call<{ backends: { id: string; reachable: boolean; hasAdminCredential: boolean }[] }>(
      session,
      'list_backends'
    );
    expect(isError).toBe(false);
    const found = data.backends.find((b) => b.id === 'mcp_test_backend');
    expect(found).toBeTruthy();
    expect(found!.reachable).toBe(true);
    expect(found!.hasAdminCredential).toBe(true);
  });

  it('get_backend_permissions returns the enforced config', async () => {
    const { data } = await call<{ enforced: boolean; config: { devOpen: boolean } }>(session, 'get_backend_permissions');
    expect(data.enforced).toBe(true);
    expect(data.config.devOpen).toBe(false);
  });

  it('get_backend_admin_dashboard reports the served dashboard (BAK-005)', async () => {
    const { isError, data } = await call<{
      enabled: boolean;
      url: string;
      credentialTier: string;
      security: { enforced: boolean; hasReadonlyTier: boolean };
      sections: Record<string, boolean>;
    }>(session, 'get_backend_admin_dashboard');
    expect(isError).toBe(false);
    expect(data.enabled).toBe(true);
    expect(data.url).toContain('/_admin');
    // This harness holds the full admin credential, and provisions no
    // read-only tier — an agent must be able to see both facts.
    expect(data.credentialTier).toBe('full-admin');
    expect(data.security.enforced).toBe(true);
    expect(data.security.hasReadonlyTier).toBe(false);
    expect(data.sections.collections).toBe(true);
    expect(data.sections.permissions).toBe(true);
  });

  it('the full agent flow: lock a collection to a role, create it, assign a user, verify the effect', async () => {
    const aliceId = await signup(backend.port, 'alice');

    // Lock Reports to role:analyst for every operation.
    const lock = await call(session, 'set_collection_permissions', {
      collection: 'Reports',
      permissions: { find: 'role:analyst', get: 'role:analyst', create: 'role:analyst', update: 'role:analyst', delete: 'role:analyst' }
    });
    expect(lock.isError).toBe(false);

    // Verify BEFORE the role exists: alice is denied.
    const before = await call<{ allowed: boolean; rule: unknown }>(session, 'check_backend_access', {
      principal: { kind: 'user', userId: aliceId },
      collection: 'Reports',
      op: 'find'
    });
    expect(before.data.allowed).toBe(false);
    expect(before.data.rule).toBe('role:analyst');

    // Create the role, assign alice.
    expect((await call(session, 'create_backend_role', { name: 'analyst' })).isError).toBe(false);
    expect((await call(session, 'assign_role_user', { role: 'analyst', userId: aliceId })).isError).toBe(false);

    // Verify AFTER: alice is now allowed; an anonymous caller still is not.
    const afterAlice = await call<{ allowed: boolean }>(session, 'check_backend_access', {
      principal: { kind: 'user', userId: aliceId },
      collection: 'Reports',
      op: 'find'
    });
    expect(afterAlice.data.allowed).toBe(true);

    const afterAnon = await call<{ allowed: boolean }>(session, 'check_backend_access', {
      principal: { kind: 'anonymous' },
      collection: 'Reports',
      op: 'find'
    });
    expect(afterAnon.data.allowed).toBe(false);

    // The role shows the membership.
    const roles = await call<{ roles: { name: string; users: string[] }[] }>(session, 'list_backend_roles');
    const analyst = roles.data.roles.find((r) => r.name === 'analyst');
    expect(analyst!.users).toContain(aliceId);
  });

  it('issues and revokes a scoped API key; the secret is returned once and never listed', async () => {
    const created = await call<{ objectId: string; secret: string }>(session, 'create_backend_api_key', {
      name: 'ci',
      scopes: ['functions:build']
    });
    expect(created.data.secret).toMatch(/^ngxk_/);

    const list = await call<{ keys: { name: string; secret?: string }[] }>(session, 'list_backend_api_keys');
    const key = list.data.keys.find((k) => k.name === 'ci');
    expect(key).toBeTruthy();
    expect(key!.secret).toBeUndefined();

    const revoke = await call<{ success: boolean }>(session, 'revoke_backend_api_key', {
      objectId: created.data.objectId
    });
    expect(revoke.data.success).toBe(true);
  });

  it('a malformed rule is rejected with the backend reason (accept-and-ignore is impossible)', async () => {
    const bad = await call<{ error?: { code: string } }>(session, 'set_collection_permissions', {
      collection: 'Reports',
      permissions: { find: 'everyone' }
    });
    expect(bad.isError).toBe(true);
    expect(bad.data.error!.code).toBe('backend-error');
  });

  it('a system collection cannot be given a CLP entry', async () => {
    const bad = await call<{ error?: { code: string } }>(session, 'set_collection_permissions', {
      collection: '_User',
      permissions: { find: 'public' }
    });
    expect(bad.isError).toBe(true);
  });

  // WF-005 — the agent-authors-automation surface over MCP.
  it('enumerates, creates, toggles, and deletes triggers via MCP (SUB-008)', async () => {
    // Empty to begin with.
    const initial = await call<{ triggers: unknown[] }>(session, 'list_backend_triggers');
    expect(initial.isError).toBe(false);
    expect(Array.isArray(initial.data.triggers)).toBe(true);

    // Create a webhook trigger — the secret comes back exactly once.
    const created = await call<{ trigger: { id: string; enabled: boolean }; secret?: string }>(
      session,
      'create_backend_trigger',
      { type: 'webhook', target: { kind: 'function', name: 'onPush' }, webhook: { slug: 'gh' } }
    );
    expect(created.isError).toBe(false);
    expect(created.data.secret).toMatch(/^whsec_/);
    const id = created.data.trigger.id;

    // A cron trigger too.
    const cron = await call<{ trigger: { id: string } }>(session, 'create_backend_trigger', {
      type: 'schedule',
      target: { kind: 'function', name: 'digest' },
      schedule: { cron: '0 3 * * *', missedFirePolicy: 'skip' }
    });
    expect(cron.isError).toBe(false);

    // Enumerate: both are present, and the secret is NOT exposed in the listing.
    const listed = await call<{ triggers: { id: string; type: string }[] }>(session, 'list_backend_triggers');
    const ids = listed.data.triggers.map((t) => t.id);
    expect(ids).toContain(id);
    expect(ids).toContain(cron.data.trigger.id);
    expect(JSON.stringify(listed.data.triggers)).not.toContain('whsec_');

    // Disable + get.
    await call(session, 'set_backend_trigger_enabled', { id, enabled: false });
    const got = await call<{ trigger: { enabled: boolean } }>(session, 'get_backend_trigger', { id });
    expect(got.data.trigger.enabled).toBe(false);

    // A malformed trigger is rejected by the backend (no silent accept).
    const bad = await call<{ error?: { code: string } }>(session, 'create_backend_trigger', {
      type: 'schedule',
      target: { kind: 'function', name: 'x' },
      schedule: { cron: 'not-a-cron', missedFirePolicy: 'skip' }
    });
    expect(bad.isError).toBe(true);

    // Delete.
    const del = await call<{ deleted: boolean }>(session, 'delete_backend_trigger', { id });
    expect(del.data.deleted).toBe(true);
  });

  // ==========================================================================
  // BAK-002 — email tools. `send_backend_test_email` is only exercised in the
  // unconfigured (loud-failure) path here: a real send needs live SMTP, which
  // this hermetic suite doesn't have — the fake-transport seam that proves a
  // real send actually reaches nodemailer lives in nodegx-backend's own
  // email-flows.test.ts (that seam has no HTTP-visible surface for MCP to hit).
  // ==========================================================================

  describe('email tools (BAK-002)', () => {
    it('get_backend_email_config starts unconfigured, never leaks a password', async () => {
      const { data } = await call<{ configured: boolean; hasSmtpPassword: boolean }>(session, 'get_backend_email_config');
      expect(data.configured).toBe(false);
      expect(data.hasSmtpPassword).toBe(false);
    });

    it('send_backend_test_email fails loudly while unconfigured', async () => {
      const result = await call<{ error?: { message: string } }>(session, 'send_backend_test_email', {
        to: 'someone@example.com'
      });
      expect(result.isError).toBe(true);
      expect(result.data.error!.message).toMatch(/not configured/i);
    });

    it('set_backend_email_config configures SMTP + policy without ever echoing the password', async () => {
      const set = await call<{ configured: boolean; hasSmtpPassword: boolean }>(session, 'set_backend_email_config', {
        enabled: true,
        smtp: { host: 'smtp.example.com', port: 587, secure: false, username: 'apikey' },
        smtpPassword: 'super-secret-app-password',
        fromAddress: 'noreply@example.com',
        fromName: 'MCP Test App',
        baseUrl: 'https://api.example.com'
      });
      expect(set.isError).toBe(false);
      expect(set.data.configured).toBe(true);
      expect(set.data.hasSmtpPassword).toBe(true);
      expect(JSON.stringify(set)).not.toContain('super-secret-app-password');

      const get = await call<{ configured: boolean }>(session, 'get_backend_email_config');
      expect(get.data.configured).toBe(true);
    });

    it('list/set/reset a template, and preview renders the effective (merged) result', async () => {
      const list = await call<{ templates: { id: string; isOverridden: boolean }[] }>(session, 'list_backend_email_templates');
      expect(list.data.templates.map((t) => t.id).sort()).toEqual(['passwordReset', 'verifyEmail']);
      expect(list.data.templates.every((t) => !t.isOverridden)).toBe(true);

      const set = await call<{ effective: { subject: string } }>(session, 'set_backend_email_template', {
        templateId: 'verifyEmail',
        subject: 'Confirm your {{appName}} account'
      });
      expect(set.isError).toBe(false);
      expect(set.data.effective.subject).toBe('Confirm your {{appName}} account');

      const preview = await call<{ preview: { subject: string } }>(session, 'preview_backend_email_template', {
        templateId: 'verifyEmail'
      });
      expect(preview.data.preview.subject).toBe('Confirm your Your App account');

      const reset = await call<{ removed: boolean }>(session, 'reset_backend_email_template', { templateId: 'verifyEmail' });
      expect(reset.data.removed).toBe(true);

      const listAfter = await call<{ templates: { id: string; isOverridden: boolean }[] }>(session, 'list_backend_email_templates');
      expect(listAfter.data.templates.find((t) => t.id === 'verifyEmail')!.isOverridden).toBe(false);
    });
  });

  describe('BAK-006 file storage tools', () => {
    it('reads the default file config, including an honest transformsAvailable (sharp is not installed here)', async () => {
      const { isError, data } = await call<{
        driverKind: string;
        transformsAvailable: boolean;
        transformUnavailableReason?: string;
        config: { maxUploadBytes: number };
      }>(session, 'get_backend_file_config');
      expect(isError).toBe(false);
      expect(data.driverKind).toBe('local');
      expect(data.transformsAvailable).toBe(false);
      expect(data.transformUnavailableReason).toMatch(/sharp/i);
      expect(data.config.maxUploadBytes).toBeGreaterThan(0);
    });

    it('configures limits, content-type policy, and thumbnail presets, and they round-trip', async () => {
      const set = await call<{ config: { maxUploadBytes: number; contentTypes: { denyList: string[] } } }>(
        session,
        'configure_backend_files',
        {
          maxUploadBytes: 5_000_000,
          contentTypes: { denyList: ['application/x-msdownload'] },
          thumbnailPresets: { avatar: { width: 96, height: 96, fit: 'cover' } }
        }
      );
      expect(set.isError).toBe(false);
      expect(set.data.config.maxUploadBytes).toBe(5_000_000);
      expect(set.data.config.contentTypes.denyList).toEqual(['application/x-msdownload']);

      const get = await call<{ config: { thumbnails: { presets: Record<string, unknown> } } }>(session, 'get_backend_file_config');
      expect(get.data.config.thumbnails.presets).toEqual({ avatar: { width: 96, height: 96, fit: 'cover' } });
    });

    it('rejects an invalid orphan-sweep cron rather than silently accepting it', async () => {
      const res = await call(session, 'configure_backend_files', { orphanSweep: { enabled: true, cron: 'not a cron' } });
      expect(res.isError).toBe(true);
    });

    it('runs the orphan sweep on demand, report-only by default', async () => {
      const { isError, data } = await call<{ report: { orphanBlobs: string[]; orphanRows: string[]; deleted: boolean } }>(
        session,
        'run_backend_file_sweep'
      );
      expect(isError).toBe(false);
      expect(data.report.deleted).toBe(false);
      expect(Array.isArray(data.report.orphanBlobs)).toBe(true);
    });
  });
});
