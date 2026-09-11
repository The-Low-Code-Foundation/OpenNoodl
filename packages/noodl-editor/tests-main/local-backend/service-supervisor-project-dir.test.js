/**
 * SB-015 — the main-process half of "the editor's spawner tells the service
 * which project it is starting".
 *
 * The renderer half is graded in `tests-unit/sb-015/`. What that runner cannot
 * reach is the two links that finish the chain, and they fail in different ways:
 *
 *  - **`BackendManager.startBackend`** must put `options.projectDir` onto the
 *    supervisor's config. A drop here is silent: the backend starts, comes up
 *    fine, and enforces the defaults.
 *  - **`ServiceSupervisor`** must turn that config into `--project-dir` on the
 *    child's command line. A drop here is *equally* silent, and the argv is the
 *    only place the two spawners (`noodl-mcp`'s and this one) can be compared.
 *
 * 🔴 **`buildSpawnArgs` was extracted from `start()` so this could be an
 * assertion about behaviour rather than about source text.** `start()` spawns a
 * real `nodegx-backend` bundle that need not be built, so the alternative was a
 * `toContain('--project-dir')` over the file — which passes just as happily when
 * the line is unreachable. The real module is used here, not a fake.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

jest.mock('electron', () => ({
  ipcMain: { handle: jest.fn(), on: jest.fn() },
  BrowserWindow: { getAllWindows: () => [] }
}));

/** Fake supervisors, newest last — the config each one was handed is the point. */
const supervisors = [];

jest.mock('../../src/main/src/local-backend/ServiceSupervisor', () => ({
  ServiceSupervisor: class FakeServiceSupervisor {
    constructor(config) {
      this.config = config;
      this.endpoint = `http://127.0.0.1:${config.port}`;
      this.ready = null;
      supervisors.push(this);
    }
    start() {
      this.child = { pid: 515100 + supervisors.length, exitCode: null, killed: false };
      this.ready = { port: this.config.port };
      return Promise.resolve(this.ready);
    }
    isRunning() {
      return !!this.child;
    }
    stop() {
      this.child = null;
      return Promise.resolve();
    }
    async fetchHealth() {
      return { persistence: { mode: 'sqlite', persistent: true, ephemeral: false, error: null } };
    }
    logTail() {
      return '';
    }
  }
}));

const { BackendManager } = require('../../src/main/src/local-backend/BackendManager');

// The REAL supervisor, loaded past the mock, because its argv is the subject.
const RealServiceSupervisor = jest.requireActual(
  '../../src/main/src/local-backend/ServiceSupervisor'
).ServiceSupervisor;

// ─── argv ───────────────────────────────────────────────────────────────────

describe('SB-015 ServiceSupervisor.buildSpawnArgs', () => {
  const base = { id: 'backend_a', name: 'App backend', dataDir: '/data/backend_a', port: 8578 };

  it('passes --project-dir when it was given one', () => {
    const args = new RealServiceSupervisor({ ...base, projectDir: '/projects/my-site' }).buildSpawnArgs('/svc/index.js');
    expect(args).toContain('--project-dir');
    expect(args[args.indexOf('--project-dir') + 1]).toBe('/projects/my-site');
  });

  it('🔴 passes NO --project-dir when there is no project (known-firing control)', () => {
    // Without this arm, every assertion above is satisfied by a supervisor that
    // pushes the flag unconditionally — which would hand the service the string
    // "undefined" as a directory and turn an inert case into a parse error.
    const args = new RealServiceSupervisor(base).buildSpawnArgs('/svc/index.js');
    expect(args).not.toContain('--project-dir');
  });

  it('🔴 does NOT confuse the project directory with the data directory', () => {
    // These are two different paths for two different things and the whole task
    // exists because one of them was missing. `--data-dir` is the backend's own
    // storage; `--project-dir` is where `nodegx.security.json` is read from.
    const args = new RealServiceSupervisor({ ...base, projectDir: '/projects/my-site' }).buildSpawnArgs('/svc/index.js');
    expect(args[args.indexOf('--data-dir') + 1]).toBe('/data/backend_a');
    expect(args[args.indexOf('--project-dir') + 1]).toBe('/projects/my-site');
  });

  it('leaves the argv shape BackendManager reads back off it intact', () => {
    // `BackendManager` recovers the service entry from `spawnargs[1]` for the
    // orphan registry, and `verifyIsOurBackend` reads `--backend-id` off the
    // live command line. Appending a flag must not disturb either.
    const args = new RealServiceSupervisor({ ...base, projectDir: '/p', ephemeral: true }).buildSpawnArgs('/svc/index.js');
    expect(args[0]).toBe('/svc/index.js');
    expect(args[1]).toBe('serve');
    expect(args[args.indexOf('--backend-id') + 1]).toBe('backend_a');
    expect(args[args.indexOf('--parent-pid') + 1]).toBe(String(process.pid));
    expect(args).toContain('--ephemeral');
  });
});

// ─── the link into it ───────────────────────────────────────────────────────

describe('SB-015 BackendManager hands the project to the supervisor', () => {
  let root;
  let manager;

  function giveBackend(id, port) {
    const dir = path.join(root, 'backends', id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'config.json'),
      JSON.stringify({ id, name: 'App backend', createdAt: new Date().toISOString(), port, projectIds: [] })
    );
  }

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'sb015-manager-'));
    supervisors.length = 0;
    manager = new BackendManager({
      backendsPath: path.join(root, 'backends'),
      registryDeps: {
        isAlive: () => false,
        readCommandLine: async () => null,
        probeHealth: async () => null,
        kill: () => undefined
      }
    });
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('puts the renderer’s projectDir on the supervisor config', async () => {
    giveBackend('backend_a', 8578);
    await manager.startBackend('backend_a', { projectDir: '/projects/my-site' });
    expect(supervisors[0].config.projectDir).toBe('/projects/my-site');
  });

  it('leaves it undefined when the renderer sent none (known-firing control)', async () => {
    giveBackend('backend_b', 8579);
    await manager.startBackend('backend_b', {});
    expect(supervisors[0].config.projectDir).toBeUndefined();
    // …and the start itself still succeeded, so the absence is a no-op rather
    // than a refusal. Every backend that predates SB-015 is in this case.
    expect(supervisors[0].isRunning()).toBe(true);
  });

  it('treats a blank projectDir as none rather than as a directory', async () => {
    giveBackend('backend_c', 8580);
    await manager.startBackend('backend_c', { projectDir: '   ' });
    expect(supervisors[0].config.projectDir).toBeUndefined();
  });

  it('keeps ephemeral working beside it', async () => {
    giveBackend('backend_d', 8581);
    await manager.startBackend('backend_d', { ephemeral: true, projectDir: '/projects/x' });
    expect(supervisors[0].config.ephemeral).toBe(true);
    expect(supervisors[0].config.projectDir).toBe('/projects/x');
  });
});
