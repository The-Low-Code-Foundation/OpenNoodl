/**
 * AIB-003 slice 4 — the store's half of persistence.
 *
 * The single claim worth a test here is the one that is easy to get silently
 * wrong: **a staged candidate reaches the disk with no panel mounted.**
 *
 * A `PlanRun` publishes to its own listeners, not through the store, so a hook
 * on `update()` alone would have persisted the plan, the exclusions and the
 * description — everything except the authored output the whole task is about —
 * and would have looked entirely correct in the running app right up until
 * someone closed the window mid-build. The store subscribes to the run because
 * it is the only thing that holds a session for longer than a mount; the view
 * unsubscribes on a tab click, which is where AIB-003 started.
 */

import { PlanSessionStore } from '../../src/editor/src/models/AiAssistant/authoring/PlanSessionStore';
import type { PlanSessionPersistence } from '../../src/editor/src/models/AiAssistant/authoring/PlanSessionStore';
import type { PlanSessionSnapshot } from '../../src/editor/src/models/AiAssistant/authoring/planSessionSnapshot';
import type { PlanRun } from '../../src/editor/src/models/AiAssistant/authoring/PlanRun';
import type { AuthoringPlan } from '../../src/editor/src/models/AiAssistant/authoring/plan';

const PLAN: AuthoringPlan = {
  request: 'Wire Checkout in',
  operations: [{ id: 'op-1', kind: 'create', target: 'Pages/Checkout', intent: 'The checkout page.' }]
};

/** A `PlanRun` stand-in that can publish, and remembers who is listening. */
function fakeRun() {
  const listeners = new Set<() => void>();
  let staged = 0;
  return {
    listenerCount: () => listeners.size,
    publish: () => {
      staged++;
      for (const listener of [...listeners]) listener();
    },
    run: {
      onChange(listener: () => void) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      snapshot: () => ({ operations: [], files: {}, sampleData: {}, docs: {}, costUsd: staged }),
      cancel: () => undefined,
      dispose: () => undefined
    } as unknown as PlanRun
  };
}

function recorder() {
  const saved: PlanSessionSnapshot[] = [];
  const removed: (string | undefined)[] = [];
  const persistence: PlanSessionPersistence = {
    save: (_projectId, snapshot) => saved.push(snapshot),
    remove: (projectId) => removed.push(projectId)
  };
  return { saved, removed, persistence };
}

let store: PlanSessionStore;
let sink: ReturnType<typeof recorder>;

beforeEach(() => {
  store = new PlanSessionStore();
  sink = recorder();
  store.attachPersistence(sink.persistence);
});

describe('what reaches the disk', () => {
  it('persists a run publish, with nobody subscribed to the view', () => {
    const { run, publish } = fakeRun();
    store.update('project-a', { plan: PLAN, run });
    const afterPlan = sink.saved.length;

    publish();

    expect(sink.saved.length).toBe(afterPlan + 1);
    expect(sink.saved[sink.saved.length - 1].run?.costUsd).toBe(1);
  });

  it('stops following a run it has been asked to replace', () => {
    const first = fakeRun();
    const second = fakeRun();
    store.update('project-a', { plan: PLAN, run: first.run });
    store.update('project-a', { run: second.run });

    // A listener left on the first run is a disposed object writing a session it
    // is no longer part of.
    expect(first.listenerCount()).toBe(0);
    expect(second.listenerCount()).toBe(1);
  });

  it('removes the file when a session stops being worth keeping', () => {
    store.update('project-a', { plan: PLAN });
    store.update('project-a', { plan: null });

    // Abandon-then-type must not leave the abandoned plan on disk to be offered
    // again next launch.
    expect(sink.removed).toContain('project-a');
  });

  it('removes the file on discard, and stops listening to the run it disposed', () => {
    const { run, listenerCount } = fakeRun();
    store.update('project-a', { plan: PLAN, run });

    store.discard('project-a');

    expect(sink.removed).toContain('project-a');
    expect(listenerCount()).toBe(0);
  });

  it('does not write back a session it has just restored', () => {
    const before = sink.saved.length;
    store.restore('project-a', { ...store.get('project-a'), plan: PLAN });

    // A restore that re-persists a normalised copy would rewrite the file it just
    // read, every launch, forever.
    expect(sink.saved.length).toBe(before);
    expect(store.get('project-a').plan).toEqual(PLAN);
  });

  it('picks up a run that was already going when persistence arrived', () => {
    const bare = new PlanSessionStore();
    const { run, publish } = fakeRun();
    bare.update('project-a', { plan: PLAN, run });

    const late = recorder();
    bare.attachPersistence(late.persistence);
    publish();

    // Boot order is not something the store gets to assume.
    expect(late.saved.length).toBe(1);
  });
});

describe('a store with no persistence attached', () => {
  it('behaves exactly as it did after slices 1 to 3', () => {
    const bare = new PlanSessionStore();
    const { run, publish } = fakeRun();

    bare.update('project-a', { plan: PLAN, run });
    publish();
    bare.discard('project-a');

    expect(bare.get('project-a').plan).toBeNull();
  });
});
