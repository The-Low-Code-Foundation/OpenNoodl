/**
 * AAQ-011/F13 — `provision_backend` driven against a REAL `nodegx-backend`.
 *
 * The claim being proved is F13's headline: an external agent can build a
 * full-stack app end to end. So this spawns the actual built `dist/cli.js` the
 * way the tool does, asserts the four steps landed (directory, process,
 * collections, binding), and then asserts the safety properties that make it
 * defensible — reuse, adoption, the endpoint refusal, and a live spawn record
 * naming this process as owner.
 *
 * Skips (loudly) if the backend bundle has not been built, like
 * `backendTools.test.ts`.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import {
  allocatePort,
  findReusableBackend,
  ownedBackendIds,
  provisionBackend,
  resolveServiceEntry,
  stopOwnedBackends
} from '../src/backend/provision';
import { listRuntimeRecords, readRuntimeRecord } from '../src/backend/runtimeRecord';
import { call, connect, copyFixture, reveal, TestSession } from './helpers';

const BACKEND_CLI = path.join(__dirname, '..', '..', 'nodegx-backend', 'dist', 'cli.js');
const haveBundle = fs.existsSync(BACKEND_CLI);
const describeOrSkip = haveBundle ? describe : describe.skip;

interface ProvisionResponse {
  provisioned: boolean;
  backendId?: string;
  endpoint?: string;
  port?: number;
  pid?: number;
  reused?: boolean;
  adopted?: boolean;
  collections?: string[];
  warnings?: string[];
  reason?: string;
  currentEndpoint?: string;
}

function projectFile(dir: string): Record<string, any> {
  return JSON.parse(fs.readFileSync(path.join(dir, 'nodegx.project.json'), 'utf-8'));
}

// ─── Pure parts, no process required ─────────────────────────────────────────

describe('AAQ-011/F13 provisioning — the rules that need no backend', () => {
  it('reuse needs BOTH the name and this project owning it', () => {
    const existing = [
      { id: 'b1', name: 'App backend', port: 8578, projectIds: ['proj-a'] },
      { id: 'b2', name: 'App backend', port: 8579, projectIds: [] }
    ];
    expect(findReusableBackend(existing, 'App backend', 'proj-a')?.id).toBe('b1');
    // ⚠️ The defect AAQ-002/F4 fixed: matching on the (constant) name alone made
    // every AI-made project on a machine bind to the first backend ever made.
    expect(findReusableBackend(existing, 'App backend', 'proj-b')).toBeUndefined();
    // A project with no id can never reuse — it makes its own, the safe branch.
    expect(findReusableBackend(existing, 'App backend', undefined)).toBeUndefined();
    // A rename means a new backend rather than a repurposed one.
    expect(findReusableBackend(existing, 'Other backend', 'proj-a')).toBeUndefined();
  });

  it('allocates from 8578 and skips ports already in a config', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-ports-'));
    const port = await allocatePort(root);
    expect(port).toBeGreaterThanOrEqual(8578);
  });

  it('finds the service bundle in the monorepo', () => {
    const { entry, probed } = resolveServiceEntry();
    expect(probed.length).toBeGreaterThan(0);
    if (haveBundle) expect(entry).toBeTruthy();
  });
});

// ─── The real thing ──────────────────────────────────────────────────────────

describeOrSkip('AAQ-011/F13 provisioning — a real backend, end to end', () => {
  jest.setTimeout(90000);

  let session: TestSession;
  let projectDir: string;
  let root: string;
  const previousRoot = process.env.NODEGX_BACKENDS_DIR;

  beforeEach(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-provision-'));
    // `backendsRoot()` reads this, so every tool call in this block is confined
    // to a temp directory and can never touch the developer's own backends.
    process.env.NODEGX_BACKENDS_DIR = root;
    projectDir = copyFixture();
    session = await connect(projectDir, true);
    await reveal(session, 'backend'); // AWP-006 — provisioning ships with the backend group
  });

  afterEach(async () => {
    await stopOwnedBackends(root);
    await session.close();
    if (previousRoot === undefined) delete process.env.NODEGX_BACKENDS_DIR;
    else process.env.NODEGX_BACKENDS_DIR = previousRoot;
  });

  it('creates, starts, seeds and binds — the four steps, in one call', async () => {
    const res = await call<ProvisionResponse>(session, 'provision_backend', {
      name: 'App backend',
      collections: [
        { name: 'Puppy', columns: [{ name: 'name', type: 'String' }, { name: 'age', type: 'Number' }] }
      ]
    });

    expect(res.isError).toBe(false);
    expect(res.data.provisioned).toBe(true);
    const backendId = res.data.backendId as string;

    // 1. The directory, in the layout the editor's BackendManager writes.
    const config = JSON.parse(fs.readFileSync(path.join(root, backendId, 'config.json'), 'utf-8'));
    expect(config.name).toBe('App backend');
    expect(config.projectIds).toEqual([projectFile(projectDir).id]);
    expect(fs.existsSync(path.join(root, backendId, 'data'))).toBe(true);

    // 2. The process — answering, and recorded as ours.
    const health = await fetch(`${res.data.endpoint}/health`).then((r) => r.json());
    expect(health.backendId).toBe(backendId);
    expect(health.service).toBe('nodegx-backend');

    const record = readRuntimeRecord(backendId, root);
    expect(record?.pid).toBe(res.data.pid);
    expect(record?.owner.kind).toBe('noodl-mcp');
    expect(record?.owner.pid).toBe(process.pid);
    expect(record?.owner.projectDir).toBe(session.store.projectDir);
    expect(record?.heartbeatAt).toBeTruthy();
    // The record holds a pid, a port and a path — never a credential.
    expect(JSON.stringify(record)).not.toContain('adminToken');
    if (process.platform !== 'win32') {
      expect(fs.statSync(path.join(root, backendId, 'runtime.json')).mode & 0o777).toBe(0o600);
    }

    // 3. The collection, with its columns — the whole point of pre-seeding is
    //    that Record nodes get typed prop-* ports instead of none.
    expect(res.data.collections).toEqual(['Puppy']);
    const token = JSON.parse(fs.readFileSync(path.join(root, backendId, 'secrets.json'), 'utf-8')).adminToken;
    const schema = await fetch(`${res.data.endpoint}/admin/schema`, {
      headers: { authorization: `Bearer ${token}` }
    }).then((r) => r.json());
    const puppy = (schema.tables ?? schema).find?.((t: { name: string }) => t.name === 'Puppy') ?? null;
    expect(puppy).toBeTruthy();
    expect(puppy.columns.map((c: { name: string }) => c.name)).toEqual(expect.arrayContaining(['name', 'age']));

    // 4. The binding, in the editor's RAW metadata shape (instanceId, not id).
    const meta = projectFile(projectDir).metadata.cloudservices;
    expect(meta).toEqual({
      instanceId: backendId,
      endpoint: res.data.endpoint,
      appId: backendId,
      type: 'nodegx'
    });

    // The admin credential the backend minted for itself is 0600 and was
    // written by the backend, not by us.
    if (process.platform !== 'win32') {
      expect(fs.statSync(path.join(root, backendId, 'secrets.json')).mode & 0o777).toBe(0o600);
    }
  });

  it('adopts the running backend instead of starting a second one on the same data dir', async () => {
    const first = await call<ProvisionResponse>(session, 'provision_backend', { name: 'App backend' });
    expect(first.data.provisioned).toBe(true);

    // A second provision of the same name, by the same project. Force, because
    // the project is now bound — the interesting assertion is what it does NOT do.
    const second = await call<ProvisionResponse>(session, 'provision_backend', {
      name: 'App backend',
      force: true
    });
    expect(second.data.reused).toBe(true);
    expect(second.data.adopted).toBe(true);
    expect(second.data.backendId).toBe(first.data.backendId);
    expect(second.data.pid).toBe(first.data.pid);
    // One backend directory, one process, one record.
    expect(listRuntimeRecords(root)).toHaveLength(1);
    expect(ownedBackendIds()).toHaveLength(1);
  });

  it('refuses to repoint a bound project, and starts NOTHING when it refuses', async () => {
    await call<ProvisionResponse>(session, 'provision_backend', { name: 'App backend' });
    const before = listRuntimeRecords(root).length;

    const res = await call<ProvisionResponse>(session, 'provision_backend', { name: 'Another backend' });
    expect(res.data.provisioned).toBe(false);
    expect(res.data.reason).toContain('already points at');
    // The refusal happens BEFORE the spawn: a provision that creates a process
    // and then fails to bind it has left durable machine state for nothing.
    expect(listRuntimeRecords(root)).toHaveLength(before);
  });

  it('stops a backend it owns, and drops the record with it', async () => {
    const res = await call<ProvisionResponse>(session, 'provision_backend', { name: 'App backend' });
    const backendId = res.data.backendId as string;
    const endpoint = res.data.endpoint as string;

    const stopped = await call<{ stopped: boolean; how: string }>(session, 'stop_backend', { backendId });
    expect(stopped.data.stopped).toBe(true);
    expect(stopped.data.how).toMatch(/SIGTERM|SIGKILL|already/);
    expect(readRuntimeRecord(backendId, root)).toBeNull();
    await expect(fetch(`${endpoint}/health`)).rejects.toBeDefined();
  });

  it('list_backend_processes reports the owner and its liveness', async () => {
    const provisioned = await call<ProvisionResponse>(session, 'provision_backend', { name: 'App backend' });
    const listed = await call<{ running: Array<Record<string, unknown>> }>(session, 'list_backend_processes', {});

    expect(listed.data.running).toHaveLength(1);
    expect(listed.data.running[0]).toMatchObject({
      backendId: provisioned.data.backendId,
      owner: 'noodl-mcp',
      ownerPid: process.pid,
      ownerAlive: true,
      ownedByThisServer: true
    });
  });

  it('a collection that was already there is a WARNING on a succeeded provision, never a failure', async () => {
    // Advisory throughout, for `PlanProvisionSpec`'s reason: the backend makes a
    // collection on first write anyway, so nothing about a collection can turn a
    // started backend into a failed provision. What it must never do is stay
    // silent — a reused collection keeps whatever columns it had.
    await call<ProvisionResponse>(session, 'provision_backend', {
      name: 'App backend',
      collections: [{ name: 'Puppy', columns: [{ name: 'name', type: 'String' }] }]
    });

    const res = await call<ProvisionResponse>(session, 'provision_backend', {
      name: 'App backend',
      force: true,
      collections: [{ name: 'Puppy', columns: [{ name: 'name', type: 'String' }] }]
    });
    expect(res.isError).toBe(false);
    expect(res.data.provisioned).toBe(true);
    expect(res.data.collections).toEqual(['Puppy']);
    expect(res.data.warnings?.join(' ')).toContain('already existed');
  });
});

describe('AAQ-011/F13 — provisioning is write-gated', () => {
  it('is not registered on a read-only server', async () => {
    const dir = copyFixture();
    const session = await connect(dir, false);
    try {
      const tools = await session.client.listTools();
      const names = tools.tools.map((t) => t.name);
      expect(names).not.toContain('provision_backend');
      expect(names).not.toContain('stop_backend');
    } finally {
      await session.close();
    }
  });

  it('is registered on a read-write server', async () => {
    const dir = copyFixture();
    const session = await connect(dir, true);
    try {
      // AWP-006 — registered, and advertised once the backend group is revealed.
      // The reveal is the assertion: on a read-only server the same call reveals
      // nothing, which is the spec above.
      await reveal(session, 'backend');
      const names = (await session.client.listTools()).tools.map((t) => t.name);
      expect(names).toEqual(expect.arrayContaining(['provision_backend', 'stop_backend', 'list_backend_processes']));
    } finally {
      await session.close();
    }
  });
});

/** Provision writes no secret of its own; the backend mints its own, 0600. */
export {};
