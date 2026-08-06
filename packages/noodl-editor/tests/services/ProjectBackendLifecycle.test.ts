/**
 * AAQ-011 / F10 — the project's backend follows the project.
 *
 * Jasmine, and it runs in the Electron suite like everything else in this
 * directory. Every external effect is injected, which is not a convenience: this
 * suite runs in a renderer with **no `window.require`**, so the real `getIpc()`
 * is `null` here and a spec against the real channels would pass by doing
 * nothing at all — the exact shape of green-but-untested this repo keeps finding.
 *
 * What is asserted is the decision table, because the decisions are the design:
 * adopt or start, stop or leave alone, and whose start it was.
 */

import {
  ProjectBackendLifecycleImpl,
  type ProjectBackendState
} from '../../src/editor/src/services/ProjectBackendLifecycle';
import { intentFor } from '../../src/editor/src/services/projectBackendStatusToasts';

interface Call {
  channel: string;
  args: unknown[];
}

/** A fake main process: a set of backends, each running or not. */
function makeWorld(
  backends: { id: string; name: string; port: number; running?: boolean }[],
  overrides: { startFails?: string } = {}
) {
  const calls: Call[] = [];
  const running = new Set(backends.filter((b) => b.running).map((b) => b.id));

  const invoke = async <T,>(channel: string, ...args: unknown[]): Promise<T> => {
    calls.push({ channel, args });
    if (channel === 'backend:list') {
      return backends.map(({ id, name, port }) => ({ id, name, port })) as unknown as T;
    }
    const id = args[0] as string;
    const meta = backends.find((b) => b.id === id);
    if (channel === 'backend:status') {
      return (running.has(id)
        ? { running: true, port: meta?.port, endpoint: `http://127.0.0.1:${meta?.port}` }
        : { running: false }) as unknown as T;
    }
    if (channel === 'backend:start') {
      if (overrides.startFails === id) throw new Error('the SQLite engine is unavailable');
      running.add(id);
      return { running: true, port: meta?.port, endpoint: `http://127.0.0.1:${meta?.port}` } as unknown as T;
    }
    if (channel === 'backend:stop') {
      running.delete(id);
      return { running: false } as unknown as T;
    }
    throw new Error(`unexpected channel ${channel}`);
  };

  return { calls, running, invoke };
}

describe('AAQ-011/F10 ProjectBackendLifecycle', () => {
  let bound: string | undefined;
  let states: ProjectBackendState[];

  function makeService(
    world: ReturnType<typeof makeWorld>,
    options: { hasIpc?: boolean; invoke?: typeof world.invoke } = {}
  ) {
    states = [];
    return new ProjectBackendLifecycleImpl({
      hasIpc: () => options.hasIpc !== false,
      invoke: options.invoke ?? world.invoke,
      boundBackendId: () => bound,
      notify: (state) => states.push(state),
      onBackendStarted: async () => undefined
    });
  }

  beforeEach(() => {
    bound = undefined;
    states = [];
  });

  it('starts the backend the open project is bound to', async () => {
    const world = makeWorld([{ id: 'backend_a', name: 'App backend', port: 8578 }]);
    const service = makeService(world);

    bound = 'backend_a';
    await service.reconcile();

    expect(world.running.has('backend_a')).toBe(true);
    expect(states.map((s) => s.phase)).toEqual(['starting', 'running']);
    expect(service.getState().endpoint).toBe('http://127.0.0.1:8578');
  });

  it('publishes "starting" BEFORE the start resolves, so nothing looks frozen', async () => {
    let release: (() => void) | undefined;
    const world = makeWorld([{ id: 'backend_a', name: 'App backend', port: 8578 }]);
    const service = makeService(world, {
      invoke: async <T,>(channel: string, ...args: unknown[]): Promise<T> => {
        if (channel === 'backend:start') {
          await new Promise<void>((resolve) => {
            release = resolve;
          });
        }
        return world.invoke<T>(channel, ...args);
      }
    });

    bound = 'backend_a';
    const done = service.reconcile();
    // Yield enough turns for the list + status round trips to land.
    for (let i = 0; i < 10; i++) await Promise.resolve();

    expect(service.getState().phase).toBe('starting');
    expect(service.getState().backendName).toBe('App backend');
    release?.();
    await done;
    expect(service.getState().phase).toBe('running');
  });

  it('adopts a backend that is already running rather than restarting it', async () => {
    const world = makeWorld([{ id: 'backend_a', name: 'App backend', port: 8578, running: true }]);
    const service = makeService(world);

    bound = 'backend_a';
    await service.reconcile();

    expect(service.getState().phase).toBe('adopted');
    expect(world.calls.some((c) => c.channel === 'backend:start')).toBe(false);
    expect(world.calls.some((c) => c.channel === 'backend:stop')).toBe(false);
  });

  it('does not stop an adopted backend when the project closes — we never started it', async () => {
    const world = makeWorld([{ id: 'backend_a', name: 'App backend', port: 8578, running: true }]);
    const service = makeService(world);

    bound = 'backend_a';
    await service.reconcile();
    bound = undefined;
    await service.reconcile();

    expect(world.calls.some((c) => c.channel === 'backend:stop')).toBe(false);
    expect(world.running.has('backend_a')).toBe(true);
    expect(service.getState().phase).toBe('idle');
  });

  it('stops the backend it started when the project closes', async () => {
    const world = makeWorld([{ id: 'backend_a', name: 'App backend', port: 8578 }]);
    const service = makeService(world);

    bound = 'backend_a';
    await service.reconcile();
    expect(world.running.has('backend_a')).toBe(true);

    bound = undefined;
    await service.reconcile();

    expect(world.calls.filter((c) => c.channel === 'backend:stop').map((c) => c.args[0])).toEqual(['backend_a']);
    expect(world.running.has('backend_a')).toBe(false);
    expect(service.getState().phase).toBe('idle');
  });

  it('switching projects stops the first backend and starts the second', async () => {
    const world = makeWorld([
      { id: 'backend_a', name: 'A', port: 8578 },
      { id: 'backend_b', name: 'B', port: 8579 }
    ]);
    const service = makeService(world);

    bound = 'backend_a';
    await service.reconcile();
    bound = 'backend_b';
    await service.reconcile();

    expect(world.running.has('backend_a')).toBe(false);
    expect(world.running.has('backend_b')).toBe(true);
    expect(service.getState().backendId).toBe('backend_b');
  });

  it('re-opening the same project does not restart the backend it already started', async () => {
    const world = makeWorld([{ id: 'backend_a', name: 'A', port: 8578 }]);
    const service = makeService(world);

    bound = 'backend_a';
    await service.reconcile();
    await service.reconcile();

    expect(world.calls.filter((c) => c.channel === 'backend:start')).toHaveSize(1);
    expect(world.calls.filter((c) => c.channel === 'backend:stop')).toHaveSize(0);
  });

  it('leaves alone a project bound to something that is not a local backend', async () => {
    const world = makeWorld([{ id: 'backend_a', name: 'A', port: 8578 }]);
    const service = makeService(world);

    // A Noodl Cloud instance id, or a local backend that was deleted.
    bound = 'some-cloud-instance-id';
    await service.reconcile();

    expect(world.calls.map((c) => c.channel)).toEqual(['backend:list']);
    expect(service.getState().phase).toBe('idle');
  });

  it('reports a failed start with the reason, and does not claim to have started it', async () => {
    const world = makeWorld([{ id: 'backend_a', name: 'App backend', port: 8578 }], { startFails: 'backend_a' });
    const service = makeService(world);

    bound = 'backend_a';
    await service.reconcile();

    expect(service.getState().phase).toBe('failed');
    expect(service.getState().error).toContain('SQLite engine is unavailable');

    // And because the start failed, closing the project must not try to stop it.
    bound = undefined;
    await service.reconcile();
    expect(world.calls.some((c) => c.channel === 'backend:stop')).toBe(false);
  });

  it('does nothing at all without a main process', async () => {
    const world = makeWorld([{ id: 'backend_a', name: 'A', port: 8578 }]);
    const service = makeService(world, { hasIpc: false });

    bound = 'backend_a';
    await service.reconcile();

    expect(world.calls).toEqual([]);
    expect(states).toEqual([]);
  });

  it('a superseded reconcile never writes state after the one that replaced it', async () => {
    // Two project changes in quick succession. The first must not leave the
    // panel saying "starting A" about a session where B is open.
    const world = makeWorld([
      { id: 'backend_a', name: 'A', port: 8578 },
      { id: 'backend_b', name: 'B', port: 8579 }
    ]);
    const service = makeService(world);

    bound = 'backend_a';
    const first = service.reconcile();
    bound = 'backend_b';
    const second = service.reconcile();
    await Promise.all([first, second]);

    expect(service.getState().backendId).toBe('backend_b');
    expect(states[states.length - 1].backendId).toBe('backend_b');
  });

  it('survives a backend:list that throws', async () => {
    const world = makeWorld([{ id: 'backend_a', name: 'A', port: 8578 }]);
    const service = makeService(world, {
      invoke: async <T,>(channel: string): Promise<T> => {
        if (channel === 'backend:list') throw new Error('main process is gone');
        throw new Error(`unexpected ${channel}`);
      }
    });

    bound = 'backend_a';
    await service.reconcile();
    expect(service.getState().phase).toBe('idle');
  });
});

/**
 * Slice 4 — what the user sees. The rules, not the rendering: a start that
 * finishes fast must show nothing, a start that succeeds must say nothing, and a
 * start that fails must say so and not go away on its own.
 */
describe('AAQ-011/F10 project backend toast rules', () => {
  it('asks for a DELAYED spinner while starting, never an immediate one', () => {
    const intent = intentFor({ phase: 'starting', backendId: 'b', backendName: 'App backend' });
    expect(intent.kind).toBe('spinner-after-delay');
    expect(intent.kind === 'spinner-after-delay' && intent.message).toBe('Starting App backend…');
  });

  it('says nothing on success — the expected state is not news', () => {
    expect(intentFor({ phase: 'running', backendId: 'b' }).kind).toBe('hide');
    expect(intentFor({ phase: 'adopted', backendId: 'b' }).kind).toBe('hide');
    expect(intentFor({ phase: 'idle' }).kind).toBe('hide');
  });

  it('carries the real reason into the failure toast, and says what stops working', () => {
    const intent = intentFor({
      phase: 'failed',
      backendId: 'b',
      backendName: 'App backend',
      error: 'the native SQLite engine is unavailable'
    });
    expect(intent.kind).toBe('error');
    if (intent.kind !== 'error') return;
    expect(intent.title).toContain('App backend');
    expect(intent.message).toContain('native SQLite engine is unavailable');
    expect(intent.message).toContain('Data Browser');
  });

  it('still names something when the backend has no name and no error text', () => {
    const intent = intentFor({ phase: 'failed' });
    expect(intent.kind === 'error' && intent.title).toBe('The project backend could not be started');
    expect(intent.kind === 'error' && intent.message).toContain('did not start');
  });
});
