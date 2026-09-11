/**
 * REL-009b — the watcher's two judgements, and its coalescing.
 *
 * These are the parts that decide whether an agent's write reaches the canvas,
 * whether the editor feeds itself its own saves in a loop, and whether a
 * person's unsaved work survives someone else writing the same component. All
 * three are gradeable without Electron, a filesystem or an editor singleton,
 * which is why `decide.ts` has no imports.
 *
 * 🔴 What these specs CANNOT see: whether the canvas survives the swap (that is
 * a screenshot — REL-009b AC2), and whether `fs.watch` reports the paths this
 * mapping expects on a real save. The second is covered by the real-filesystem
 * arm at the foot of this file; the first is not coverable here at all, and the
 * task file says so.
 */

import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

import { armWatcher } from '../support/armWatcher';
import {
  ProjectFileWatcher,
  componentPathFromRelativePath,
  decideComponentReload,
  type WatchHandle
} from '../../src/editor/src/services/ProjectFileWatcher';

describe('REL-009b — mapping a changed file onto a component', () => {
  it('maps each of the three component files onto the component path', () => {
    expect(componentPathFromRelativePath('components/Pages/Home/nodes.json')).toBe('Pages/Home');
    expect(componentPathFromRelativePath('components/Pages/Home/component.json')).toBe('Pages/Home');
    expect(componentPathFromRelativePath('components/Pages/Home/connections.json')).toBe('Pages/Home');
    expect(componentPathFromRelativePath('components/Header/nodes.json')).toBe('Header');
  });

  it('maps Windows separators, since fs.watch reports the platform form', () => {
    expect(componentPathFromRelativePath('components\\Pages\\Home\\nodes.json')).toBe('Pages/Home');
  });

  // 🔴 The one that matters most. The editor's own save stages `<file>.tmp` and
  // renames it, so without this the editor sees every save it makes — as a file
  // that may not even be complete JSON yet.
  it('ignores the .tmp staging files the editor\'s own two-phase save writes', () => {
    expect(componentPathFromRelativePath('components/Pages/Home/nodes.json.tmp')).toBeNull();
    expect(componentPathFromRelativePath('components/Pages/Home/component.json.tmp')).toBeNull();
    expect(componentPathFromRelativePath('components/Pages/Home/connections.json.tmp')).toBeNull();
  });

  it('ignores everything that is not one of a component\'s three files', () => {
    expect(componentPathFromRelativePath('components/_registry.json')).toBeNull();
    expect(componentPathFromRelativePath('nodegx.routes.json')).toBeNull();
    expect(componentPathFromRelativePath('nodegx.project.json')).toBeNull();
    expect(componentPathFromRelativePath('components/Pages/Home/README.md')).toBeNull();
    expect(componentPathFromRelativePath('components/Pages/Home')).toBeNull();
    expect(componentPathFromRelativePath('')).toBeNull();
  });

  it('ignores noisy and hidden directories', () => {
    expect(componentPathFromRelativePath('.git/objects/ab/nodes.json')).toBeNull();
    expect(componentPathFromRelativePath('components/.git/nodes.json')).toBeNull();
    expect(componentPathFromRelativePath('components/node_modules/x/nodes.json')).toBeNull();
    expect(componentPathFromRelativePath('components/.hidden/nodes.json')).toBeNull();
  });
});

describe('REL-009b — deciding what a change to a component means', () => {
  const H_LOADED = 'hash-as-loaded';
  const H_DISK = 'hash-the-agent-wrote';
  const H_EDITED = 'hash-the-human-is-editing';

  it('reloads when the disk has moved and we hold no unsaved edits', () => {
    expect(
      decideComponentReload({ baselineHash: H_LOADED, inMemoryHash: H_LOADED, diskHash: H_DISK })
    ).toEqual({ action: 'reload' });
  });

  it('reloads a component the project does not hold — nothing can be lost', () => {
    expect(
      decideComponentReload({ baselineHash: undefined, inMemoryHash: undefined, diskHash: H_DISK })
    ).toEqual({ action: 'reload' });
  });

  // The echo. Without this the editor applies its own autosave back over itself,
  // every few seconds, churning the canvas each time.
  it('skips a change whose content already matches our baseline — our own write', () => {
    expect(
      decideComponentReload({ baselineHash: H_LOADED, inMemoryHash: H_LOADED, diskHash: H_LOADED })
    ).toEqual({ action: 'skip-unchanged' });
  });

  it('refuses to discard unsaved editor edits', () => {
    expect(
      decideComponentReload({ baselineHash: H_LOADED, inMemoryHash: H_EDITED, diskHash: H_DISK })
    ).toEqual({ action: 'refuse-dirty' });
  });

  /**
   * 🔴 The ordering arm, and the reason the two checks are not interchangeable.
   *
   * Sequence: the editor saves component X (baseline becomes what it wrote), the
   * human immediately edits X again (memory moves off the baseline), and only
   * then does the watcher event for that save arrive. The disk still matches the
   * baseline — nothing new is there — but the in-memory copy is dirty.
   *
   * Deciding dirtiness first answers `refuse-dirty` and puts "changed on disk
   * outside the editor" in front of a person about a file the editor itself
   * just wrote. This spec fails if the checks are swapped.
   */
  it('calls its own save unchanged even while the human has since edited the component', () => {
    expect(
      decideComponentReload({ baselineHash: H_LOADED, inMemoryHash: H_EDITED, diskHash: H_LOADED })
    ).toEqual({ action: 'skip-unchanged' });
  });
});

describe('REL-009b — coalescing', () => {
  function fakeClock() {
    let pending: Array<{ id: number; fn: () => void }> = [];
    let nextId = 1;
    return {
      setTimeoutFn: (fn: () => void) => {
        const id = nextId++;
        pending.push({ id, fn });
        return id;
      },
      clearTimeoutFn: (h: unknown) => {
        pending = pending.filter((p) => p.id !== h);
      },
      flush: () => {
        const due = pending;
        pending = [];
        due.forEach((p) => p.fn());
      },
      get pendingCount() {
        return pending.length;
      }
    };
  }

  function harness() {
    const clock = fakeClock();
    let emit: (relativePath: string) => void = () => undefined;
    let closed = 0;
    const batches: string[][] = [];

    const watcher = new ProjectFileWatcher({
      debounceMs: 10,
      setTimeoutFn: clock.setTimeoutFn,
      clearTimeoutFn: clock.clearTimeoutFn,
      watchFactory: (_dir, onEvent): WatchHandle => {
        emit = onEvent;
        return { close: () => (closed += 1) };
      }
    });

    watcher.start('/project', (paths) => batches.push(paths));
    return { watcher, clock, batches, emit: (p: string) => emit(p), closed: () => closed };
  }

  // One logical save writes three files, each staged and renamed: six events.
  it('collapses one component\'s six save events into a single report', () => {
    const h = harness();
    for (const f of ['component.json', 'nodes.json', 'connections.json']) {
      h.emit(`components/Pages/Home/${f}.tmp`);
      h.emit(`components/Pages/Home/${f}`);
    }
    h.clock.flush();

    expect(h.batches).toEqual([['Pages/Home']]);
  });

  it('reports every distinct component in one batch', () => {
    const h = harness();
    h.emit('components/Pages/Home/nodes.json');
    h.emit('components/Header/nodes.json');
    h.clock.flush();

    expect(h.batches).toHaveLength(1);
    expect(h.batches[0].sort()).toEqual(['Header', 'Pages/Home']);
  });

  it('never reports a batch for events that map to nothing', () => {
    const h = harness();
    h.emit('components/_registry.json');
    h.emit('components/Pages/Home/nodes.json.tmp');
    h.clock.flush();

    expect(h.batches).toEqual([]);
    expect(h.clock.pendingCount).toBe(0);
  });

  it('stops watching and drops pending work on stop()', () => {
    const h = harness();
    h.emit('components/Pages/Home/nodes.json');
    h.watcher.stop();
    h.clock.flush();

    expect(h.batches).toEqual([]);
    expect(h.closed()).toBe(1);
    expect(h.watcher.isWatching).toBe(false);
  });

  it('closes the previous watch when started again, so reopening cannot leave two', () => {
    const h = harness();
    h.watcher.start('/project', () => undefined);
    expect(h.closed()).toBe(1);
    h.watcher.stop();
    expect(h.closed()).toBe(2);
  });
});

/**
 * The control on the mapping: `fs.watch` has to actually report paths in the
 * shape `componentPathFromRelativePath` expects. Everything above this point
 * would pass just as happily against a mapping built for a filename format node
 * never produces.
 */
/**
 * How long a real `fs.watch` event is allowed to take before we call it a hang.
 * Not a budget the assertion spends: the spec returns as soon as the batch
 * arrives, so a healthy box pays ~73ms of it and a busy one pays what it needs.
 *
 * 🔴 The ceiling is USELESS unless jest's own per-test timeout is longer than
 * it. That default is 5000ms, and the first version of this fix left it there:
 * the 10s ceiling could never be reached, so the effective budget was still a
 * stopwatch — jest's, not the spec's — and under a full 423-suite run the event
 * took over 5s and jest killed the test. It passed one whole-gate run and failed
 * the next. The `it()` below therefore carries an explicit timeout ABOVE this
 * value, and the two must be changed together.
 */
const WATCH_EVENT_CEILING_MS = 30_000;
const WATCH_TEST_TIMEOUT_MS = WATCH_EVENT_CEILING_MS + 5_000;

describe('REL-009b — against a real filesystem', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rel009b-'));
    fs.mkdirSync(path.join(dir, 'components', 'Pages', 'Home'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('reports the component when a real two-phase save lands in it', async () => {
    const watcher = new ProjectFileWatcher({ debounceMs: 60 });
    const batches: string[][] = [];

    watcher.start(dir, (paths) => batches.push(paths));

    // 🔴 ARM THE INSTRUMENT FIRST — see `support/armWatcher.ts`. Every previous
    // fix to this spec adjusted how long to wait AFTER the write (a 600ms sleep,
    // an event-wait, the latch below, a 30s ceiling). None of them could work
    // when the write beat the FSEvents stream, because then no event is coming.
    const armed = await armWatcher({ dir, batches, sentinel: 'components/__arming__/nodes.json', debounceMs: 60 });

    // Exactly what ComponentSaver.saveComponent does: stage a .tmp, then rename.
    const target = path.join(dir, 'components', 'Pages', 'Home', 'nodes.json');
    fs.writeFileSync(`${target}.tmp`, JSON.stringify({ nodes: [] }));
    fs.renameSync(`${target}.tmp`, target);

    // 🔴 Wait for the EVENT, never for a stopwatch. The first form of this
    // spec slept a flat 600ms and asserted afterwards, which grades the box
    // rather than the watcher: the batch lands at ~73ms here when nothing else
    // is running, so the budget was ~8x headroom on a chain of timers, and two
    // concurrent suites ate it. It went red in `test:main` twice while passing
    // green alone. The ceiling below bounds a genuine hang and nothing else.
    const deadline = Date.now() + WATCH_EVENT_CEILING_MS;
    while (batches.length === 0 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }

    // 🔴 Latch the answer HERE, before the settle below is spent. The
    // settle is itself a wait, so without this the ceiling is not load-bearing
    // at all: cut it to 30ms and the batch still lands inside the 200ms on a
    // fast box, while a slow one reddens — the very defect this spec is being
    // fixed for, one level down. A control cutting the ceiling to 30ms PASSED
    // until this latch existed.
    const arrivedWithinCeiling = batches.length > 0;

    // One more debounce window once the first batch is in, so the purity
    // assertion below sees everything the write produced rather than only the
    // first thing to arrive. This one IS a stopwatch, deliberately: running
    // short can only make that assertion see less, never make it fail.
    await new Promise((resolve) => setTimeout(resolve, 200));
    watcher.stop();

    // 🔴 Every assertion is AFTER stop(). An expect() before it leaks the
    // fs.watch handle on failure and jest then never exits — a spec that HANGS
    // `test:main` for everybody is strictly worse than one that reddens it. The
    // control above did exactly that: it failed correctly in 35ms and then hung
    // until it was killed (EXIT=143, not 1).
    expect(armed).toBe(true);
    expect(arrivedWithinCeiling).toBe(true);
    expect(batches.flat()).toContain('Pages/Home');
    // And nothing that is not a component path ever got through.
    expect(batches.flat().every((p) => p === 'Pages/Home')).toBe(true);
  }, WATCH_TEST_TIMEOUT_MS);
});
