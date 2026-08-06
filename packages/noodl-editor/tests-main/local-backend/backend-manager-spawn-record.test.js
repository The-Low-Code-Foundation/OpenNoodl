/**
 * AAQ-011 / F10 slice 1 — the wiring, not the mechanism.
 *
 * `BackendProcessRegistry` is proven against real processes in its own suite.
 * What this asserts is the part that suite cannot: that `BackendManager`
 * actually *writes* a record when it spawns and *drops* it when the process is
 * gone — every path, including the two failure paths, because a record that is
 * written but never dropped turns a working editor into a machine that reaps its
 * own live backends on the next launch.
 *
 * `ServiceSupervisor` is faked here on purpose. The real one spawns a
 * `nodegx-backend` bundle that may not be built, and the contract under test is
 * the one BackendManager relies on: `child.pid` exists the moment `start()` is
 * called, before the promise it returns settles.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

jest.mock('electron', () => ({
  ipcMain: { handle: jest.fn(), on: jest.fn() },
  BrowserWindow: { getAllWindows: () => [] }
}));

/** The fake supervisor's instances, newest last, so a test can drive them. */
const supervisors = [];

jest.mock('../../src/main/src/local-backend/ServiceSupervisor', () => ({
  ServiceSupervisor: class FakeServiceSupervisor {
    constructor(config) {
      this.config = config;
      this.endpoint = `http://127.0.0.1:${config.port}`;
      this.ready = null;
      this.lastExit = null;
      this.stopped = false;
      // The behaviour a test dials in before calling startBackend.
      this.failWith = FakeServiceSupervisor.nextFailure;
      this.spawnFails = FakeServiceSupervisor.nextSpawnFails;
      this.boundPort = FakeServiceSupervisor.nextBoundPort;
      FakeServiceSupervisor.nextFailure = null;
      FakeServiceSupervisor.nextSpawnFails = false;
      FakeServiceSupervisor.nextBoundPort = null;
      supervisors.push(this);
    }

    start() {
      if (this.spawnFails) {
        // No child at all — the "entry point not found" shape.
        this.child = null;
        return Promise.reject(new Error('nodegx-backend service not found'));
      }
      // The real supervisor spawns synchronously inside the executor, so the
      // pid is readable before the returned promise settles. BackendManager
      // depends on exactly that.
      this.child = { pid: 424200 + supervisors.length, exitCode: null, killed: false };
      if (this.failWith) return Promise.reject(this.failWith);
      this.ready = { port: this.boundPort || this.config.port };
      return Promise.resolve(this.ready);
    }

    isRunning() {
      return !!(this.child && !this.stopped);
    }

    stop() {
      this.stopped = true;
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
const { ServiceSupervisor } = require('../../src/main/src/local-backend/ServiceSupervisor');

describe('AAQ-011/F10 — BackendManager writes and drops spawn records', () => {
  let root;
  let manager;

  /** Lay down a backend's config.json the way `createBackend` does. */
  function giveBackend(id, port, projectId) {
    const dir = path.join(root, 'backends', id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'config.json'),
      JSON.stringify({ id, name: 'App backend', createdAt: new Date().toISOString(), port, projectIds: projectId ? [projectId] : [] })
    );
  }

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'aaq011-manager-'));
    supervisors.length = 0;
    ServiceSupervisor.nextFailure = null;
    ServiceSupervisor.nextSpawnFails = false;
    ServiceSupervisor.nextBoundPort = null;
    manager = new BackendManager({
      backendsPath: path.join(root, 'backends'),
      // Nothing in this suite may kill a real process or hit the network.
      registryDeps: {
        isAlive: () => false,
        readCommandLine: async () => null,
        probeHealth: async () => null,
        terminate: async () => true
      }
    });
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('records the spawn, with the pid, port and owning project', async () => {
    giveBackend('backend_a', 8578, 'proj_1');
    await manager.startBackend('backend_a');

    const records = manager.registry.listRecords();
    expect(records).toHaveLength(1);
    expect(records[0]).toEqual(
      expect.objectContaining({
        backendId: 'backend_a',
        name: 'App backend',
        pid: supervisors[0].child.pid,
        port: 8578,
        projectId: 'proj_1',
        owner: expect.objectContaining({ pid: process.pid, kind: 'editor' })
      })
    );
    // Written beside the metadata, never inside it — `listBackends` walks that
    // directory and logs anything without a config.json as invalid.
    expect(fs.existsSync(path.join(root, 'backend-runtime', 'processes'))).toBe(true);
    expect(fs.readdirSync(path.join(root, 'backends'))).toEqual(['backend_a']);
  });

  it('records the port the service actually bound, not the one the config asked for', async () => {
    giveBackend('backend_b', 8578);
    ServiceSupervisor.nextBoundPort = 8599;
    await manager.startBackend('backend_b');

    expect(manager.registry.listRecords()[0].port).toBe(8599);
  });

  it('drops the record on an orderly stop', async () => {
    giveBackend('backend_c', 8578);
    await manager.startBackend('backend_c');
    expect(manager.registry.listRecords()).toHaveLength(1);

    await manager.stopBackend('backend_c');
    expect(manager.registry.listRecords()).toEqual([]);
  });

  it('drops the record when the backend dies on its own', async () => {
    giveBackend('backend_d', 8578);
    await manager.startBackend('backend_d');
    expect(manager.registry.listRecords()).toHaveLength(1);

    // The supervisor's crash callback, fired the way ServiceSupervisor fires it.
    supervisors[0].config.onUnexpectedExit({ code: 1, signal: null });
    expect(manager.registry.listRecords()).toEqual([]);
  });

  it('drops the record when the child dies before it is ready', async () => {
    giveBackend('backend_e', 8578);
    ServiceSupervisor.nextFailure = new Error('exited before becoming ready');

    await expect(manager.startBackend('backend_e')).rejects.toThrow('exited before becoming ready');
    expect(manager.registry.listRecords()).toEqual([]);
  });

  it('writes no record when there was never a child to record', async () => {
    giveBackend('backend_f', 8578);
    ServiceSupervisor.nextSpawnFails = true;

    await expect(manager.startBackend('backend_f')).rejects.toThrow('not found');
    expect(manager.registry.listRecords()).toEqual([]);
  });

  it('drops every record on stopAll', async () => {
    giveBackend('backend_g', 8578);
    giveBackend('backend_h', 8579);
    await manager.startBackend('backend_g');
    await manager.startBackend('backend_h');
    expect(manager.registry.listRecords()).toHaveLength(2);

    await manager.stopAll();
    expect(manager.registry.listRecords()).toEqual([]);
  });

  it('keeps the record when a stop THREW — the child may still be alive', async () => {
    giveBackend('backend_i', 8578);
    await manager.startBackend('backend_i');
    supervisors[0].stop = () => Promise.reject(new Error('SIGTERM went nowhere'));

    await manager.stopAll();
    // The only thing that will ever find that child again is this record.
    expect(manager.registry.listRecords().map((r) => r.backendId)).toEqual(['backend_i']);
  });

  it('does not spawn until the startup sweep has finished', async () => {
    giveBackend('backend_j', 8578);

    const order = [];
    let releaseSweep;
    manager.registry.sweep = () =>
      new Promise((resolve) => {
        releaseSweep = () => {
          order.push('sweep');
          resolve({ reaped: [], kept: [], dropped: [], failed: [] });
        };
      });

    manager.claimAndSweep();
    const started = manager.startBackend('backend_j').then(() => order.push('start'));

    // The sweep has not resolved, so nothing may have been spawned yet.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(supervisors).toHaveLength(0);

    releaseSweep();
    await started;
    expect(order).toEqual(['sweep', 'start']);
  });

  it('claims ownership on claimAndSweep and releases it on an orderly exit', async () => {
    manager.registry.sweep = async () => ({ reaped: [], kept: [], dropped: [], failed: [] });
    await manager.claimAndSweep();

    expect(manager.registry.listOwners()).toEqual([
      expect.objectContaining({ pid: process.pid, kind: 'editor' })
    ]);

    manager.releaseOwnership();
    expect(manager.registry.listOwners()).toEqual([]);
  });

  it('starts anyway when the sweep throws', async () => {
    giveBackend('backend_k', 8578);
    manager.registry.sweep = async () => {
      throw new Error('the disk is on fire');
    };
    await manager.claimAndSweep();

    await expect(manager.startBackend('backend_k')).resolves.toEqual(expect.objectContaining({ running: true }));
  });
});
