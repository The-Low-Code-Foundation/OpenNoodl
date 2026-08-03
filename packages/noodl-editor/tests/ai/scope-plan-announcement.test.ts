/**
 * AIB-005 — the editor announces the plan the launcher agreed.
 *
 * > *"When I finished and clicked to build, it took me into the hello world app
 * > and didn't show anything about it building the app I'd asked for."*
 *
 * The handover has worked since AIX-012. What is under test here is the one
 * predicate the announcement rests on — which is more delicate than it looks,
 * because AIB-003 moved consumption of the handover into `PlanSessionStore` and
 * left the launcher's module state as the earlier of two homes for the same
 * fact. `scopePlanAnnouncement` is the single place that knows both, so that no
 * caller has to pick a source and be right half the time.
 *
 * The strip itself is React; this is the rule it renders, specable without
 * mounting it — the same split `ProjectReviewBanner` uses.
 */

import { PlanSessionStore } from '../../src/editor/src/models/AiAssistant/authoring/PlanSessionStore';
import type { AuthoringPlan } from '../../src/editor/src/models/AiAssistant/authoring/plan';
import {
  peekPendingScopePlan,
  setPendingScopePlan,
  takePendingScopePlan
} from '../../src/editor/src/models/AiAssistant/scoping/pendingPlan';
import { scopePlanAnnouncement } from '../../src/editor/src/views/panels/AiAuthoringPanel/ScopePlanStrip';

const PLAN: AuthoringPlan = {
  request: 'A chat app',
  operations: [
    { id: 'op-1', kind: 'create', target: 'Pages/Signup', intent: 'Sign up.' },
    { id: 'op-2', kind: 'create', target: 'Pages/Chats', intent: 'The chat list.' },
    { id: 'op-3', kind: 'create', target: 'Pages/Chat', intent: 'One chat.' }
  ]
};

describe('AIB-005 — what earns a canvas announcement', () => {
  beforeEach(() => {
    setPendingScopePlan(null);
    PlanSessionStore.instance.discard('proj-a');
    PlanSessionStore.instance.discard('proj-b');
  });

  afterAll(() => {
    setPendingScopePlan(null);
    PlanSessionStore.instance.discard('proj-a');
    PlanSessionStore.instance.discard('proj-b');
  });

  it('announces a launcher handover that no panel has consumed yet', () => {
    setPendingScopePlan({ projectId: 'proj-a', plan: PLAN, recordPath: 'docs/decisions/000-initial-scope.md' });
    expect(scopePlanAnnouncement('proj-a')).toEqual({ operations: 3 });
  });

  it('goes on announcing after the Build panel has taken it into the session', () => {
    // The take is what AIB-003 does on the panel's first mount. The plan is now
    // in the store and gone from module state, and the announcement must not
    // vanish with it — the user has still not seen anything.
    setPendingScopePlan({ projectId: 'proj-a', plan: PLAN, recordPath: 'docs/decisions/000-initial-scope.md' });
    const taken = takePendingScopePlan('proj-a');
    PlanSessionStore.instance.update('proj-a', { plan: taken!.plan, origin: 'scoping' });

    expect(peekPendingScopePlan('proj-a')).toBeUndefined();
    expect(scopePlanAnnouncement('proj-a')).toEqual({ operations: 3 });
  });

  it('says nothing for a project with no scoped plan, or for a plan the user typed themselves', () => {
    expect(scopePlanAnnouncement('proj-a')).toBeUndefined();
    // A plan produced in the Build panel needs no announcement: the user is
    // looking at it. `origin` is what separates the two.
    PlanSessionStore.instance.update('proj-a', { plan: PLAN, origin: null });
    expect(scopePlanAnnouncement('proj-a')).toBeUndefined();
  });

  it('stops once the plan has been authored or applied', () => {
    PlanSessionStore.instance.update('proj-a', { plan: PLAN, origin: 'scoping' });
    expect(scopePlanAnnouncement('proj-a')).toBeDefined();

    PlanSessionStore.instance.update('proj-a', { run: {} as never });
    expect(scopePlanAnnouncement('proj-a')).toBeUndefined();

    PlanSessionStore.instance.update('proj-a', { run: null, applied: { count: 3, docs: [] } });
    expect(scopePlanAnnouncement('proj-a')).toBeUndefined();
  });

  it('dismissal silences the announcement and keeps the plan (criterion 3)', () => {
    PlanSessionStore.instance.update('proj-a', { plan: PLAN, origin: 'scoping' });
    PlanSessionStore.instance.update('proj-a', { announcementDismissed: true });

    expect(scopePlanAnnouncement('proj-a')).toBeUndefined();
    // The whole rule of this phase: nothing but an explicit Abandon or a
    // successful apply may destroy authored work, and "Not now" is neither.
    expect(PlanSessionStore.instance.get('proj-a').plan).toBe(PLAN);
  });

  it('does not announce another project’s plan, and opening that project does not consume it (criterion 5)', () => {
    setPendingScopePlan({ projectId: 'proj-a', plan: PLAN, recordPath: 'docs/decisions/000-initial-scope.md' });

    expect(scopePlanAnnouncement('proj-b')).toBeUndefined();
    // AIB-005 changed this: `takePendingScopePlan` used to clear on a project
    // mismatch, so opening any other project first silently destroyed the
    // handover for the one just scoped. The id check is what protects the wrong
    // project; clearing protected nothing.
    expect(takePendingScopePlan('proj-b')).toBeUndefined();
    expect(scopePlanAnnouncement('proj-a')).toEqual({ operations: 3 });
    expect(takePendingScopePlan('proj-a')!.plan).toBe(PLAN);
    // Still single-consumption by its own project.
    expect(takePendingScopePlan('proj-a')).toBeUndefined();
  });
});
