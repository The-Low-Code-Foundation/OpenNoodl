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
    expect(byId.get('op-3')!.status).toBe('doc');
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
    expect([...partial.excluded].sort()).toEqual(['op-1', 'op-2']);
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
    expect(state.operations.map((op) => op.status)).toEqual(['staged', 'doc']);
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
    const withPlan = initialUserMessage(request, 'OVERVIEW', 'CATALOG', undefined, 'PLAN CONTEXT LINE');
    expect(withPlan.cacheBoundary).toBe(without.cacheBoundary);
    expect(withPlan.content.slice(0, withPlan.cacheBoundary)).toBe(without.content.slice(0, without.cacheBoundary));
    expect(withPlan.content.indexOf('PLAN CONTEXT LINE')).toBeGreaterThan(withPlan.cacheBoundary);
  });
});
