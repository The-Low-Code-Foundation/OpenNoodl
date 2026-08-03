/**
 * AIX-011 — the plan model, the planning session, and the fan-out orchestrator.
 *
 * Everything here is offline: the chat functions are scripts, the project is
 * the real corpus as plain data. What is under test is the structure the spec
 * demands: plans are validated and ordered before any authoring; rejecting a
 * plan costs zero authoring turns; dropping an operation authors only the
 * rest; sibling operations see each other's *intents* (and the AIX-007
 * cache-stable prefix survives the plan block); a staged create is visible to
 * later operations' validation; and a failed operation stages nothing while
 * the rest stand — with the dependency closure making an invalid partial
 * accept unrepresentable at plan level.
 */

import { buildComponentV2Files } from '../../src/editor/src/io/ProjectExporter';
import { buildCandidate } from '../../src/editor/src/models/AiAssistant/authoring/candidate';
import {
  componentRefTargets,
  graphComponentFromFiles,
  orderPlanOperations,
  planExcludedWith,
  planOperationRequires,
  planRequiredWith,
  validatePlan,
  type AuthoringPlan
} from '../../src/editor/src/models/AiAssistant/authoring/plan';
import { PlanningSession } from '../../src/editor/src/models/AiAssistant/authoring/PlanningSession';
import { PlanRun } from '../../src/editor/src/models/AiAssistant/authoring/PlanRun';
import { initialUserMessage } from '../../src/editor/src/models/AiAssistant/authoring/prompts/authoring';
import type { ComponentFiles } from '../../src/editor/src/models/AiAssistant/authoring/types';
import type { AiChatRequest, AiChatResponse } from '../../src/editor/src/models/AiAssistant/client/types';
import { fromSerialisedProject } from '../../src/editor/src/models/AiAssistant/explain/graph';

/* eslint-disable @typescript-eslint/no-var-requires */
const gitRepoUtf8 = require('../testfs/git-repo-utf8/project.json');
/* eslint-enable @typescript-eslint/no-var-requires */

function loadGraph() {
  return fromSerialisedProject(JSON.parse(JSON.stringify(gitRepoUtf8)));
}

const usage = { promptTokens: 10, completionTokens: 5, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: 0.01 };

function toolResponse(name: string, args: Record<string, unknown>): AiChatResponse {
  return {
    text: '',
    toolCalls: [{ id: `call-${Math.random().toString(36).slice(2, 8)}`, name, arguments: args }],
    usage,
    model: 'test',
    stopReason: 'tool_calls'
  };
}

const CHECKOUT_SUBMISSION = {
  nodes: [
    { id: 'co_root', type: 'Group', label: 'Checkout root' },
    { id: 'co_text', type: 'Text', parent: 'co_root', parameters: { text: 'Checkout' } }
  ],
  visual_roots: ['co_root']
};

/** The Article revision instantiates the component op-1 creates. */
const ARTICLE_SUBMISSION = {
  nodes: [
    { id: 'ar_root', type: 'Group', label: 'Article root' },
    { id: 'ar_checkout', type: '/Pages/Checkout', parent: 'ar_root' }
  ],
  visual_roots: ['ar_root']
};

/** Route a session's chat by the component named in its opening task. */
function planChatScript(log: string[]) {
  return async (request: AiChatRequest): Promise<AiChatResponse> => {
    const opening = request.messages.find((m) => m.role === 'user')?.content ?? '';
    if (opening.includes('"Pages/Checkout"')) {
      log.push('Pages/Checkout');
      return toolResponse('submit_component', CHECKOUT_SUBMISSION);
    }
    if (opening.includes('"Pages/Article"')) {
      log.push('Pages/Article');
      return toolResponse('submit_component', ARTICLE_SUBMISSION);
    }
    log.push('unknown');
    return toolResponse('submit_component', { nodes: [{ id: 'x', type: 'NoSuchType' }] });
  };
}

const THREE_OP_PLAN: AuthoringPlan = {
  request: 'Wire Checkout into the app',
  operations: [
    { id: 'op-1', kind: 'create', target: 'Pages/Checkout', intent: 'The new checkout page.' },
    { id: 'op-2', kind: 'update', target: 'Pages/Article', intent: 'Link the article page to Checkout.' },
    { id: 'op-3', kind: 'doc', target: 'docs/ARCHITECTURE.md', intent: 'Record the checkout flow.' }
  ]
};

function baseFilesFor(legacyName: string): ComponentFiles | undefined {
  const serialised = (gitRepoUtf8.components as Array<{ name: string }>).find((c) => c.name === legacyName);
  if (!serialised) return undefined;
  return buildComponentV2Files(
    JSON.parse(JSON.stringify(serialised)),
    '2026-01-01T00:00:00.000Z'
  ) as ComponentFiles;
}

describe('AIX-011 plan model', () => {
  it('validates plans at plan time: creates must be new, updates must exist, one op per component', () => {
    const existing = new Set(['/Pages/Article', '/Pages/Home']);
    const errors = validatePlan(
      {
        request: 'x',
        operations: [
          { id: 'op-1', kind: 'create', target: 'Pages/Article', intent: 'recreate an existing page' },
          { id: 'op-2', kind: 'update', target: 'Pages/Nowhere', intent: 'update a missing page' },
          { id: 'op-3', kind: 'update', target: 'Pages/Home', intent: 'first home edit' },
          { id: 'op-4', kind: 'update', target: 'Pages/Home', intent: 'second home edit' },
          { id: 'op-5', kind: 'update', target: 'Pages/Home', intent: '' }
        ]
      },
      { existingComponents: existing }
    );
    expect(errors.some((e) => e.includes('already exists'))).toBe(true);
    expect(errors.some((e) => e.includes('no such component'))).toBe(true);
    expect(errors.some((e) => e.includes('more than one operation'))).toBe(true);
    expect(errors.some((e) => e.includes('no intent'))).toBe(true);
    expect(validatePlan(THREE_OP_PLAN, { existingComponents: new Set(['/Pages/Article']) })).toEqual([]);
  });

  it('orders creates before updates before docs, keeping plan order within a kind', () => {
    const ordered = orderPlanOperations([
      { id: 'a', kind: 'doc', target: 'docs/X.md', intent: 'x' },
      { id: 'b', kind: 'update', target: 'U1', intent: 'x' },
      { id: 'c', kind: 'create', target: 'C1', intent: 'x' },
      { id: 'd', kind: 'update', target: 'U2', intent: 'x' },
      { id: 'e', kind: 'create', target: 'C2', intent: 'x' }
    ]);
    expect(ordered.map((op) => op.id)).toEqual(['c', 'e', 'b', 'd', 'a']);
  });

  it('derives operation-level requires from staged component references, and closes both ways', () => {
    const checkout = buildCandidate(
      { description: 'x', componentPath: 'Pages/Checkout' },
      CHECKOUT_SUBMISSION as never
    ).files!;
    const article = buildCandidate(
      { description: 'x', componentPath: 'Pages/Article' },
      ARTICLE_SUBMISSION as never
    ).files!;
    expect([...componentRefTargets(article)]).toEqual(['/Pages/Checkout']);

    const requires = planOperationRequires([
      { operation: THREE_OP_PLAN.operations[0], files: checkout },
      { operation: THREE_OP_PLAN.operations[1], files: article },
      { operation: THREE_OP_PLAN.operations[2] }
    ]);
    expect(requires.get('op-2')).toEqual(['op-1']);
    expect(requires.get('op-1')).toEqual([]);

    // Dropping the create drops its dependents; keeping the update keeps its provider.
    expect([...planExcludedWith(requires, ['op-1'])].sort()).toEqual(['op-1', 'op-2']);
    expect([...planRequiredWith(requires, ['op-2'])].sort()).toEqual(['op-1', 'op-2']);
  });

  it('graphComponentFromFiles derives hierarchy and instance ports like the serialised adapter', () => {
    const files = buildCandidate(
      { description: 'x', componentPath: 'Pages/Checkout' },
      {
        nodes: [
          { id: 'root', type: 'Group' },
          { id: 'in', type: 'Component Inputs', ports: [{ name: 'Open', plug: 'output', type: '*' }] },
          { id: 'child', type: 'Text', parent: 'root' }
        ]
      }
    ).files!;
    const component = graphComponentFromFiles('/Pages/Checkout', files);
    expect(component.name).toBe('/Pages/Checkout');
    const root = component.nodes.find((n) => n.id === 'root')!;
    expect(root.children).toEqual(['child']);
    expect(component.nodes.find((n) => n.id === 'child')!.parent).toBe('root');
    expect(component.nodes.find((n) => n.id === 'in')!.instancePorts).toEqual(['Open']);
  });
});

describe('AIX-011 planning session', () => {
  it('produces an ordered, validated plan from one submit_plan call — and only planning turns happen', async () => {
    let chatCalls = 0;
    const chat = async (): Promise<AiChatResponse> => {
      chatCalls++;
      return toolResponse('submit_plan', {
        operations: [
          { kind: 'update', target: 'Pages/Article', intent: 'Link to checkout.' },
          { kind: 'create', target: 'Pages/Checkout', intent: 'The checkout page.' }
        ]
      });
    };
    const outcome = await new PlanningSession(loadGraph(), 'wire checkout in', { chat }).run();
    expect(outcome.status).toBe('planned');
    expect(outcome.plan!.operations.map((op) => op.kind)).toEqual(['create', 'update']);
    expect(outcome.plan!.operations.every((op) => op.id.startsWith('op-'))).toBe(true);
    // Criterion 2, structurally: producing (and therefore rejecting) a plan is
    // planning turns only — no authoring session exists until PlanRun runs.
    expect(chatCalls).toBe(1);
  });

  it('feeds plan validation errors back for one repair round', async () => {
    const submissions: Array<Record<string, unknown>> = [
      { operations: [{ kind: 'update', target: 'Pages/Nowhere', intent: 'update a missing page' }] },
      { operations: [{ kind: 'create', target: 'Pages/Checkout', intent: 'The checkout page.' }] }
    ];
    const seen: string[] = [];
    const chat = async (request: AiChatRequest): Promise<AiChatResponse> => {
      const last = request.messages[request.messages.length - 1];
      if (last.role === 'tool') seen.push(last.content);
      return toolResponse('submit_plan', submissions.shift()!);
    };
    const outcome = await new PlanningSession(loadGraph(), 'wire checkout in', { chat }).run();
    expect(outcome.status).toBe('planned');
    expect(seen.some((s) => s.includes('no such component'))).toBe(true);
  });

  it('prose without a plan is a decline, not an error', async () => {
    const chat = async (): Promise<AiChatResponse> => ({
      text: 'The project already has a checkout page wired in.',
      toolCalls: [],
      usage,
      model: 'test',
      stopReason: 'stop'
    });
    const outcome = await new PlanningSession(loadGraph(), 'wire checkout in', { chat }).run();
    expect(outcome.status).toBe('declined');
    expect(outcome.note).toContain('already has');
  });
});

describe('AIX-011 plan run', () => {
  it('authors each component operation through the existing loop; staged creates are visible to later ops', async () => {
    const log: string[] = [];
    const openings: string[] = [];
    const chat = planChatScript(log);
    const spyChat = async (request: AiChatRequest): Promise<AiChatResponse> => {
      const opening = request.messages.find((m) => m.role === 'user')?.content ?? '';
      openings.push(opening);
      return chat(request);
    };

    const run = new PlanRun(loadGraph(), THREE_OP_PLAN, {
      baseFilesFor,
      session: { chat: spyChat }
    });
    const state = await run.run();

    expect(state.phase).toBe('done');
    const byId = new Map(state.operations.map((op) => [op.operation.id, op]));
    expect(byId.get('op-1')!.status).toBe('staged');
    // op-2's candidate instantiates /Pages/Checkout, which exists nowhere but
    // in op-1's staged files — the gate passing proves the graph extension.
    expect(byId.get('op-2')!.status).toBe('staged');
    // op-3 is a doc operation and this run was given no docs reader, so it
    // fails loudly rather than authoring a document against an imagined file.
    // The doc turn itself is covered in authoring-doc-session.test.
    expect(byId.get('op-3')!.status).toBe('failed');
    expect(log).toEqual(['Pages/Checkout', 'Pages/Article']);

    // Sibling context: each session's opening turn carries the plan's intents…
    expect(openings[1]).toContain('THE PLAN');
    expect(openings[1]).toContain('The new checkout page.');
    // …but never a sibling graph (op-1's node ids do not leak into op-2).
    expect(openings[1]).not.toContain('co_root');

    // The dependency closure is live on the run.
    const accepted = run.acceptedOperations();
    expect(accepted.operations.map((op) => op.operation.id)).toEqual(['op-1', 'op-2']);
    const partial = run.acceptedOperations(['op-1']);
    expect(partial.operations).toEqual([]);
    // op-3 is in the closure too: an operation that failed is excluded for the
    // same reason a user-dropped one is — the closure is the accepted set's
    // complement, not just the user's choices.
    expect([...partial.excluded].sort()).toEqual(['op-1', 'op-2', 'op-3']);
  });

  it('dropping an operation from the plan authors only the remaining ones (criterion 3)', async () => {
    const log: string[] = [];
    const plan: AuthoringPlan = {
      ...THREE_OP_PLAN,
      operations: THREE_OP_PLAN.operations.filter((op) => op.id !== 'op-2')
    };
    const run = new PlanRun(loadGraph(), plan, { baseFilesFor, session: { chat: planChatScript(log) } });
    const state = await run.run();
    expect(log).toEqual(['Pages/Checkout']);
    expect(state.operations.map((op) => op.status)).toEqual(['staged', 'failed']);
  });

  it('one operation failing the gate stages nothing for it and leaves the rest staged (criterion 5)', async () => {
    const log: string[] = [];
    const chat = async (request: AiChatRequest): Promise<AiChatResponse> => {
      const opening = request.messages.find((m) => m.role === 'user')?.content ?? '';
      if (opening.includes('"Pages/Checkout"')) {
        log.push('Pages/Checkout');
        // Never valid: the gate rejects every attempt.
        return toolResponse('submit_component', { nodes: [{ id: 'x', type: 'NoSuchType' }] });
      }
      log.push('Pages/Article');
      // Without op-1 staged, referencing /Pages/Checkout would fail — this
      // revision stands alone instead.
      return toolResponse('submit_component', {
        nodes: [{ id: 'ar_root', type: 'Group', label: 'Article root' }],
        visual_roots: ['ar_root']
      });
    };
    const run = new PlanRun(loadGraph(), THREE_OP_PLAN, {
      baseFilesFor,
      session: { chat, maxTurns: 3, maxSubmits: 2 }
    });
    const state = await run.run();
    const byId = new Map(state.operations.map((op) => [op.operation.id, op]));
    expect(byId.get('op-1')!.status).toBe('failed');
    expect(byId.get('op-1')!.error).toBeDefined();
    expect(byId.get('op-2')!.status).toBe('staged');
    // The accepted set is exactly the staged survivors — applying it is the
    // user's explicit choice; nothing has touched any project model here.
    expect(run.acceptedOperations().operations.map((op) => op.operation.id)).toEqual(['op-2']);
  });
});

describe('AIX-011 prompt stability (AIX-007 guard)', () => {
  it('the plan block sits entirely after the cache boundary — the stable prefix is byte-identical', () => {
    const request = { description: 'a page', componentPath: 'Pages/Checkout' };
    const without = initialUserMessage(request, 'OVERVIEW', 'CATALOG', undefined);
    // NB the `undefined` docs slot: AIX-009 landed `docs` ahead of `planContext`
    // in this signature, and both sit on the variable side of the boundary.
    const withPlan = initialUserMessage(request, 'OVERVIEW', 'CATALOG', undefined, undefined, 'PLAN CONTEXT LINE');
    expect(withPlan.cacheBoundary).toBe(without.cacheBoundary);
    expect(withPlan.content.slice(0, withPlan.cacheBoundary)).toBe(without.content.slice(0, without.cacheBoundary));
    expect(withPlan.content.indexOf('PLAN CONTEXT LINE')).toBeGreaterThan(withPlan.cacheBoundary);
  });
});

/**
 * AIX-011 criterion 7 — a `doc` operation is only plannable if the planner can
 * see that the project has docs.
 *
 * The planning system prompt gates a doc operation on the project's docs being
 * "listed in the overview material". Nothing listed them: `PlanningSession`
 * built its context with no docs at all, and `projectOverview()` names only
 * components. The condition was one the product could never satisfy — which is
 * why both live plan runs contained zero doc operations and the doc-authoring
 * turn had never once been seen against a real model.
 */
describe('AIX-011 criterion 7 — the planner can see the project docs', () => {
  it('names the docs the project has, and says nothing when it has none', async () => {
    let opening = '';
    const chat = async (request: AiChatRequest): Promise<AiChatResponse> => {
      opening = request.messages[1].content;
      return toolResponse('submit_plan', {
        operations: [{ kind: 'update', target: 'Pages/Article', intent: 'x' }]
      });
    };

    const withDocs = new PlanningSession(loadGraph(), 'add author profiles', {
      chat,
      projectDocs: { architecture: '# Architecture\n\nThe page map lives here.' }
    });
    expect((await withDocs.run()).status).toBe('planned');
    expect(opening.indexOf('docs/ARCHITECTURE.md')).toBeGreaterThan(-1);
    expect(opening.indexOf('PROJECT DOCUMENTS')).toBeGreaterThan(-1);

    const withoutDocs = new PlanningSession(loadGraph(), 'add author profiles', { chat, projectDocs: {} });
    expect((await withoutDocs.run()).status).toBe('planned');
    expect(opening.indexOf('PROJECT DOCUMENTS')).toBe(-1);
  });

  it('ignores a doc whose file is present but empty', async () => {
    let opening = '';
    const chat = async (request: AiChatRequest): Promise<AiChatResponse> => {
      opening = request.messages[1].content;
      return toolResponse('submit_plan', {
        operations: [{ kind: 'update', target: 'Pages/Article', intent: 'x' }]
      });
    };
    const session = new PlanningSession(loadGraph(), 'add author profiles', {
      chat,
      projectDocs: { conventions: '   \n' }
    });
    await session.run();
    expect(opening.indexOf('PROJECT DOCUMENTS')).toBe(-1);
  });
});

/**
 * AIB-001 slice 4 — an apply failure is a question, not an outcome.
 *
 * `applyAuthoredPlan` rolling back cleanly is correct engineering and terrible
 * product: it left the user holding a red sentence and a dead plan, with no way
 * forward that did not discard every other authored component. The transaction
 * stays all-or-nothing — what becomes incremental is the recovery.
 */
describe('AIB-001 — retrying one operation of a plan', () => {
  it('re-authors only the named operation and leaves every other candidate staged', async () => {
    const log: string[] = [];
    const run = new PlanRun(loadGraph(), THREE_OP_PLAN, { baseFilesFor, session: { chat: planChatScript(log) } });
    await run.run();
    expect(log).toEqual(['Pages/Checkout', 'Pages/Article']);

    const articleBefore = run.filesFor('op-2');
    await run.retryOperation('op-1', 'pathParams expects a comma-separated string');

    // One more authoring session, for the named operation only.
    expect(log).toEqual(['Pages/Checkout', 'Pages/Article', 'Pages/Checkout']);
    // …and the sibling's staged candidate is untouched, not re-run and not lost.
    expect(run.filesFor('op-2')).toBe(articleBefore);
    expect(run.state.operations.find((op) => op.operation.id === 'op-1')!.status).toBe('staged');
  });

  it('hands the model the failure it is fixing, so a retry is not a re-roll', async () => {
    const openings: string[] = [];
    const chat = planChatScript([]);
    const spyChat = async (request: AiChatRequest): Promise<AiChatResponse> => {
      openings.push(request.messages.find((m) => m.role === 'user')?.content ?? '');
      return chat(request);
    };
    const run = new PlanRun(loadGraph(), THREE_OP_PLAN, { baseFilesFor, session: { chat: spyChat } });
    await run.run();
    openings.length = 0;

    await run.retryOperation('op-1', 'node "params" parameter "pathParams" (stringlist) is an array');
    expect(openings[0]).toContain('rejected when the plan was applied');
    expect(openings[0]).toContain('pathParams');
    // The intent survives — the model is revising this operation, not a new one.
    expect(openings[0]).toContain('The new checkout page.');
  });

  it('a retry that fails keeps the candidate the user already had', async () => {
    // The previous candidate was rejected by the PROJECT, not by the gate — it
    // is still the best thing anyone has, and destroying it would reproduce the
    // exact loss this task exists to stop, one level down.
    let goodTurnsLeft = 2;
    const good = planChatScript([]);
    const chat = async (request: AiChatRequest): Promise<AiChatResponse> => {
      if (goodTurnsLeft-- > 0) return good(request);
      return toolResponse('submit_component', { nodes: [{ id: 'x', type: 'NoSuchTypeAtAll' }] });
    };

    const run = new PlanRun(loadGraph(), THREE_OP_PLAN, { baseFilesFor, session: { chat } });
    await run.run();
    const staged = run.filesFor('op-1');
    expect(staged).toBeDefined();

    await run.retryOperation('op-1', 'something went wrong');
    const op1 = run.state.operations.find((op) => op.operation.id === 'op-1')!;
    expect(op1.status).toBe('failed');
    expect(run.filesFor('op-1')).toBe(staged);
  });

  it('refuses to retry a doc operation, which is re-authored by re-running the plan', async () => {
    const run = new PlanRun(loadGraph(), THREE_OP_PLAN, { baseFilesFor, session: { chat: planChatScript([]) } });
    await run.run();
    await expectAsync(run.retryOperation('op-3')).toBeRejected();
    await expectAsync(run.retryOperation('op-nope')).toBeRejected();
  });
});

/**
 * AIB-002 — the run is legible.
 *
 * Richard's complaint was not about a nicer spinner. It was two requirements
 * wearing one sentence: know *what it is doing*, and *act on finished work
 * while the rest runs*. Both are answered by the run publishing per-operation
 * state the UI can use, instead of one global `busy` and one feed belonging to
 * whichever session happens to be active.
 *
 * The clock is injected for the same reason everything else here is: a spec
 * that pins "operation 1 took four minutes" must not depend on the machine.
 */
describe('AIB-002 — what a run publishes about itself', () => {
  /** A clock that advances 1s per read — enough to order events, not to flake. */
  function tickingClock(step = 1000) {
    let t = 1_000_000;
    return () => (t += step);
  }

  it('times the run and every operation in it', async () => {
    const run = new PlanRun(loadGraph(), THREE_OP_PLAN, {
      baseFilesFor,
      session: { chat: planChatScript([]) },
      now: tickingClock()
    });
    const state = await run.run();

    expect(state.startedAt).toBeDefined();
    expect(state.endedAt).toBeGreaterThan(state.startedAt!);
    for (const op of state.operations) {
      // Every operation that ran has both bounds — including op-3, which failed
      // for want of a docs reader. A row that reports no duration because the
      // operation went wrong is the same blank the task exists to remove.
      expect(op.startedAt).toBeDefined();
      expect(op.endedAt).toBeGreaterThan(op.startedAt!);
    }
    // Plan order is wall-clock order — the header's "2 of 3" means something.
    const starts = state.operations.map((op) => op.startedAt!);
    expect([...starts].sort((a, b) => a - b)).toEqual(starts);
  });

  it('freezes the run clock when the run finishes, so a later retry cannot rewrite the total', async () => {
    const run = new PlanRun(loadGraph(), THREE_OP_PLAN, {
      baseFilesFor,
      session: { chat: planChatScript([]) },
      now: tickingClock()
    });
    const finished = await run.run();
    await run.retryOperation('op-1', 'something to fix');

    // The header must not start counting the minutes the user spent reviewing.
    expect(run.state.startedAt).toBe(finished.startedAt);
    expect(run.state.endedAt).toBe(finished.endedAt);
    // The retried operation, however, has its own fresh clock.
    const op1 = run.state.operations.find((op) => op.operation.id === 'op-1')!;
    expect(op1.startedAt!).toBeGreaterThan(finished.endedAt!);
  });

  it('keeps each operation’s own activity feed after the next one starts', async () => {
    const run = new PlanRun(loadGraph(), THREE_OP_PLAN, { baseFilesFor, session: { chat: planChatScript([]) } });
    const state = await run.run();

    const op1 = state.operations.find((op) => op.operation.id === 'op-1')!;
    const op2 = state.operations.find((op) => op.operation.id === 'op-2')!;
    // The whole defect: there used to be ONE feed, holding the active session,
    // replaced wholesale when the next operation started — so operation 1's
    // rows vanished, and while they were up nothing said whose they were.
    expect(op1.session!.legacyName).toBe('/Pages/Checkout');
    expect(op2.session!.legacyName).toBe('/Pages/Article');
    expect(op1.session!.activities.length).toBeGreaterThan(0);
    expect(op1.session).not.toBe(op2.session);
    // A doc operation has no AuthoringSession — its row shows its own detail.
    expect(state.operations.find((op) => op.operation.id === 'op-3')!.session).toBeUndefined();
  });

  it('accumulates cost, and reports it as unknown rather than zero when a turn had no price', async () => {
    const priced = new PlanRun(loadGraph(), THREE_OP_PLAN, { baseFilesFor, session: { chat: planChatScript([]) } });
    const pricedState = await priced.run();
    // Two component sessions at $0.01 a turn.
    expect(pricedState.costUsd).toBeCloseTo(0.02, 5);

    const unpriced = planChatScript([]);
    const run = new PlanRun(loadGraph(), THREE_OP_PLAN, {
      baseFilesFor,
      session: {
        chat: async (request: AiChatRequest) => {
          const response = await unpriced(request);
          return { ...response, usage: { ...response.usage, costUsd: null } };
        }
      }
    });
    // Null, not 0: an alpha user bringing their own key must not be told a plan
    // was free because one turn's model had no published price.
    expect((await run.run()).costUsd).toBeNull();
  });

  it('hands a later operation the candidate as the user edited it mid-run, not as it was authored', async () => {
    // AIB-002 criterion 4. Reviewing operation 1 while operation 3 is still
    // authoring means `setOperationFiles` lands mid-run; what the operations
    // still to come author against has to be the edit.
    const openings: string[] = [];
    const chat = planChatScript([]);
    const run = new PlanRun(loadGraph(), THREE_OP_PLAN, {
      baseFilesFor,
      session: {
        chat: async (request: AiChatRequest) => {
          openings.push(request.messages.find((m) => m.role === 'user')?.content ?? '');
          return chat(request);
        }
      }
    });

    let edited = false;
    run.onChange((state) => {
      if (edited) return;
      if (state.operations.find((op) => op.operation.id === 'op-1')?.status !== 'staged') return;
      edited = true;
      // What a partial keep in the review document does: two nodes become one.
      const staged = run.filesFor('op-1')!;
      run.setOperationFiles('op-1', {
        ...staged,
        nodes: { ...staged.nodes, nodes: staged.nodes.nodes.slice(0, 1) }
      });
    });
    await run.run();

    expect(edited).toBe(true);
    // op-2's project overview describes the EDITED checkout page. This holds
    // because `workingGraph` is recomputed from the staged files at the start of
    // each operation rather than accumulated as they land.
    expect(openings[1]).toContain('/Pages/Checkout — 1 nodes');
    expect(openings[1]).not.toContain('/Pages/Checkout — 2 nodes');
  });

  it('offers a candidate’s siblings and its sample data, for the rendered preview', async () => {
    const run = new PlanRun(loadGraph(), THREE_OP_PLAN, { baseFilesFor, session: { chat: planChatScript([]) } });
    await run.run();

    // AIB-004: the page under review needs the plan's OTHER candidates spliced
    // in beside it, and must never be handed itself.
    expect(run.stagedSiblings('op-2')).toEqual([run.filesFor('op-1')!]);
    expect(run.stagedSiblings('op-1')).toEqual([run.filesFor('op-2')!]);
    // A doc operation is not a component and never joins a sandbox export.
    expect(run.stagedSiblings('op-3').length).toBe(2);
    // No sample data in these submissions, so none is invented.
    expect(run.sampleDataFor('op-1')).toBeUndefined();
  });
});
