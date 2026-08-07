/**
 * AIB-003 slices 1–2 — the store that stops a tab click destroying a build.
 *
 * Reported as *"I went to the docs panel, then when I came back to the build
 * panel, switched the tab to project, my conversation and all the AI created
 * pages were gone"*. The Build panel conditionally renders `ProjectAuthoringView`,
 * so the scope toggle unmounted it, and its cleanup called `runRef.current
 * ?.dispose()` — three components' worth of authored, validated, staged output,
 * gone to a click.
 *
 * The view is React and this runner has no DOM, so what is asserted here is the
 * thing the view was getting wrong: **who owns the state, and what is allowed to
 * destroy it**. The criteria about mounting and unmounting are structural once
 * the answer is "not the component".
 */

import { PlanSessionStore, PLAN_SESSION_CHANGED } from '../../src/editor/src/models/AiAssistant/authoring/PlanSessionStore';
import type { PlanRun } from '../../src/editor/src/models/AiAssistant/authoring/PlanRun';
import type { AuthoringPlan } from '../../src/editor/src/models/AiAssistant/authoring/plan';
import { EventDispatcher } from '../../src/shared/utils/EventDispatcher';

const PLAN: AuthoringPlan = {
  request: 'Wire Checkout in',
  operations: [{ id: 'op-1', kind: 'create', target: 'Pages/Checkout', intent: 'The checkout page.' }]
};

/** A `PlanRun` stand-in that records what was done to it. */
function fakeRun() {
  const calls: string[] = [];
  return {
    calls,
    run: {
      cancel: () => calls.push('cancel'),
      dispose: () => calls.push('dispose')
    } as unknown as PlanRun
  };
}

let store: PlanSessionStore;
beforeEach(() => {
  // A fresh store per spec: the singleton is the production wiring, not a
  // constraint on the class.
  store = new PlanSessionStore();
});

describe('who owns the plan', () => {
  it('hands back an empty session for a project it has never seen', () => {
    const session = store.get('project-a');
    expect(session.plan).toBeNull();
    expect(session.run).toBeNull();
    expect(session.description).toBe('');
    expect([...session.excluded]).toEqual([]);
  });

  it('keeps a plan and its run across any number of reads — no mount owns them', () => {
    const { run } = fakeRun();
    store.update('project-a', { plan: PLAN, run });

    // Two "mounts" reading the same project, and a third read after them.
    expect(store.get('project-a').plan).toEqual(PLAN);
    expect(store.get('project-a').run).toBe(run);
    expect(store.get('project-a').plan).toEqual(PLAN);
  });

  it('merges a patch instead of replacing the session', () => {
    store.update('project-a', { plan: PLAN });
    store.update('project-a', { description: 'still typing' });
    expect(store.get('project-a').plan).toEqual(PLAN);
    expect(store.get('project-a').description).toBe('still typing');
  });

  it('tells subscribers, because a run publishes whether or not anyone is looking', () => {
    const seen: number[] = [];
    const context = {};
    store.on(PLAN_SESSION_CHANGED, () => seen.push(1), context);
    store.update('project-a', { plan: PLAN });
    store.update('project-a', { description: 'x' });
    store.off(context);
    store.update('project-a', { description: 'y' });
    expect(seen).toHaveLength(2);
  });
});

describe('one session per project (criterion 3)', () => {
  it('keeps the first project\'s plan while a second project has none', () => {
    const { run } = fakeRun();
    store.update('project-a', { plan: PLAN, run });

    expect(store.get('project-b').plan).toBeNull();
    expect(store.get('project-b').run).toBeNull();
    // Switching back finds it exactly as it was left.
    expect(store.get('project-a').plan).toEqual(PLAN);
    expect(store.get('project-a').run).toBe(run);
  });

  it('gives an unsaved project a session of its own rather than sharing one', () => {
    store.update(undefined, { description: 'unsaved work' });
    expect(store.get('project-a').description).toBe('');
    expect(store.get(undefined).description).toBe('unsaved work');
  });
});

describe('what is allowed to destroy authored output', () => {
  it('discard — the user\'s Abandon, or a successful apply — and nothing else', () => {
    const { calls, run } = fakeRun();
    store.update('project-a', { plan: PLAN, run, description: 'typed' });

    store.discard('project-a');

    expect(calls).toEqual(['dispose']);
    expect(store.get('project-a').plan).toBeNull();
    expect(store.get('project-a').run).toBeNull();
    expect(store.get('project-a').description).toBe('');
  });

  it('a closing project stops its run authoring but keeps what it staged (criterion 4)', () => {
    const { calls, run } = fakeRun();
    store.update('project-a', { plan: PLAN, run });

    EventDispatcher.instance.notifyListeners('ProjectModel.instanceWillChange');

    // Cancelled, not disposed: nothing keeps spending money authoring against a
    // project nobody has open, and nothing throws away what it already staged.
    // A cancelled run keeps its staged candidates, which is this phase's rule
    // applied to its own machinery.
    expect(calls).toEqual(['cancel']);
    expect(store.get('project-a').plan).toEqual(PLAN);
    expect(store.get('project-a').run).toBe(run);
  });

  it('discarding one project leaves another project\'s work alone', () => {
    const a = fakeRun();
    const b = fakeRun();
    store.update('project-a', { plan: PLAN, run: a.run });
    store.update('project-b', { plan: PLAN, run: b.run });

    store.discard('project-a');

    expect(b.calls).toEqual([]);
    expect(store.get('project-b').plan).toEqual(PLAN);
  });
});
