/**
 * AAQ-005 criterion 3 — *"A scripted multi-component session (no model) creates
 * a page + two section components + a token write in one changeset, applies
 * atomically, and undoes as one group."*
 *
 * ## No model, and what that means here
 *
 * The established no-provider recipe, not a second one: `AuthoringSession` and
 * `PlanRun` take a `chat` function, and `authoring-plan.test.ts`'s
 * `planChatScript` routes a scripted reply by the component named in the
 * session's opening user message. That is reused verbatim in shape below.
 * Nothing constructs an `AiClient`, nothing reads a key, and the assertion that
 * this is true is the scripted call log — three calls, three targets, in the
 * order the plan ordered them.
 *
 * The other half of "no model" is that everything downstream is the app's own
 * code: `PlanRun` fans out through the real `AuthoringSession`, each candidate
 * goes through the real SUB-006 + AAQ-005 gate, and `applyAuthoredPlan` is the
 * one function that touches the real `ProjectModel`.
 *
 * ## What was measured before anything was built
 *
 * ⚠️ **"undoes as one group" already held, and was measured rather than
 * assumed.** `applyAuthoredPlan` records every mutation into ONE
 * `UndoActionGroup` and pushes it once; a three-component plan produces exactly
 * one undo step. The spec below re-asserts it because it is criterion 3's own
 * words, not because it was in doubt.
 *
 * **The token write did not, and could not.**
 * `StyleTokensModel.setToken(…, { undo: true })` mints and pushes its *own*
 * group per token, so a five-token palette would have left six undo steps and
 * "undo the build" would have undone the last colour. That gap is what
 * `planTokens.ts` closes, and its header carries the AAQ-009 boundary: this task
 * builds the **transaction**, AAQ-009 builds which tokens a bespoke identity
 * carries and the `set_design_tokens` tool that asks for them.
 *
 * ## The fixture, and why it is shaped this way
 *
 * A page and two *sections* it instantiates — AAQ-008's components-by-default
 * shape, and the one that actually exercises the substrate: the page's candidate
 * names `/Sections/Summary` and `/Sections/Activity`, which exist nowhere but in
 * two sibling operations' staged files, so the gate passing at all proves the
 * cross-operation graph extension. Sections are ordered before the page for that
 * reason (`orderPlanOperations` ranks by kind and keeps plan order within one).
 *
 * ⚠️ **Both sections are authored with the SAME node ids** — `root`, `title` —
 * because that is what a model does, and AAQ-011 F12's fix is what stops it
 * being a project-wide id collision. Criterion 3 would pass without that and
 * leave a corrupt project, so it is asserted here too.
 */

import { asText } from '../../src/editor/src/models/AiAssistant/client/content';
import { PlanRun } from '../../src/editor/src/models/AiAssistant/authoring/PlanRun';
import type { AuthoringPlan } from '../../src/editor/src/models/AiAssistant/authoring/plan';
import { applyAuthoredPlan } from '../../src/editor/src/models/AiAssistant/authoring/planStaging';
import type { AppliedPlanOperation } from '../../src/editor/src/models/AiAssistant/authoring/planStaging';
import { createPlanTokenWriter } from '../../src/editor/src/models/AiAssistant/authoring/planTokens';
import { StagingError } from '../../src/editor/src/models/AiAssistant/authoring/staging';
import type { AiChatRequest, AiChatResponse } from '../../src/editor/src/models/AiAssistant/client/types';
import { fromSerialisedProject } from '../../src/editor/src/models/AiAssistant/explain/graph';
import { ProjectModel } from '../../src/editor/src/models/projectmodel';
import { StyleTokensModel } from '../../src/editor/src/models/StyleTokensModel/StyleTokensModel';
import { UndoQueue } from '../../src/editor/src/models/undo-queue-model';
import { expectRejection } from './helpers';

/* eslint-disable @typescript-eslint/no-var-requires */
const gitRepoUtf8 = require('../testfs/git-repo-utf8/project.json');
/* eslint-enable @typescript-eslint/no-var-requires */

const usage = { promptTokens: 10, completionTokens: 5, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: 0 };

function toolResponse(name: string, args: Record<string, unknown>): AiChatResponse {
  return {
    text: '',
    toolCalls: [{ id: `call-${Math.random().toString(36).slice(2, 8)}`, name, arguments: args }],
    usage,
    model: 'scripted',
    stopReason: 'tool_calls'
  };
}

/** A section: a Group with a Text under it. Both sections use these same ids. */
function sectionSubmission(label: string) {
  return {
    nodes: [
      { id: 'root', type: 'Group', label },
      { id: 'title', type: 'Text', parent: 'root', parameters: { text: label } }
    ],
    visual_roots: ['root']
  };
}

/** The page, instantiating both sections by name. */
const DASHBOARD_SUBMISSION = {
  nodes: [
    { id: 'page', type: 'Page', label: 'Dashboard', parameters: { title: 'Dashboard', urlPath: '/dashboard' } },
    { id: 'root', type: 'Group', parent: 'page', label: 'Dashboard root' },
    { id: 'summary', type: '/Sections/Summary', parent: 'root' },
    { id: 'activity', type: '/Sections/Activity', parent: 'root' }
  ],
  visual_roots: ['page']
};

const PLAN: AuthoringPlan = {
  request: 'A dashboard page built from a summary section and an activity section.',
  operations: [
    { id: 'op-1', kind: 'create', target: 'Sections/Summary', intent: 'The summary card.' },
    { id: 'op-2', kind: 'create', target: 'Sections/Activity', intent: 'The activity list.' },
    { id: 'op-3', kind: 'create', target: 'Pages/Dashboard', intent: 'The page, built from the two sections.' }
  ]
};

const TOKENS = { '--primary': '#1d4ed8', '--surface': '#0b1020' };

/** The scripted reply, routed by the component named in the opening message. */
function scriptedChat(log: string[]) {
  return async (request: AiChatRequest): Promise<AiChatResponse> => {
    const opening = asText(request.messages.find((m) => m.role === 'user')?.content ?? '');
    if (opening.includes('"Sections/Summary"')) {
      log.push('Sections/Summary');
      return toolResponse('submit_component', sectionSubmission('Summary'));
    }
    if (opening.includes('"Sections/Activity"')) {
      log.push('Sections/Activity');
      return toolResponse('submit_component', sectionSubmission('Activity'));
    }
    if (opening.includes('"Pages/Dashboard"')) {
      log.push('Pages/Dashboard');
      return toolResponse('submit_component', DASHBOARD_SUBMISSION);
    }
    log.push(`unrouted: ${opening.slice(0, 40)}`);
    return { text: 'I am not sure.', toolCalls: [], usage, model: 'scripted', stopReason: 'stop' };
  };
}

function loadProject(): ProjectModel {
  return ProjectModel.fromJSON(JSON.parse(JSON.stringify(gitRepoUtf8)));
}

function loadGraph() {
  return fromSerialisedProject(JSON.parse(JSON.stringify(gitRepoUtf8)));
}

/** Run the scripted plan and hand back the accepted set, exactly as the panel does. */
async function stagePlan(log: string[]): Promise<AppliedPlanOperation[]> {
  const run = new PlanRun(loadGraph(), PLAN, { session: { chat: scriptedChat(log) } });
  const state = await run.run();
  expect(state.phase).toBe('done');
  expect(state.operations.map((o) => o.status)).toEqual(['staged', 'staged', 'staged']);
  const { operations } = run.acceptedOperations();
  expect(operations.length).toBe(3);
  return operations;
}

describe('AAQ-005 criterion 3 — a scripted multi-component session, one changeset', () => {
  let project: ProjectModel;
  let tokens: StyleTokensModel;
  let previousInstance: ProjectModel | undefined;

  beforeEach(() => {
    UndoQueue.instance.clear();
    project = loadProject();
    // `StyleTokensModel` persists through `ProjectModel.instance.setMetaData`,
    // so the token half of "one changeset" is only really being tested when the
    // project under test IS the instance. Restored in afterEach — the
    // established pattern in this suite (`tests/project/projectimport.js`).
    previousInstance = ProjectModel.instance;
    ProjectModel.instance = project;
    tokens = new StyleTokensModel();
  });

  afterEach(() => {
    tokens.dispose();
    ProjectModel.instance = previousInstance;
    UndoQueue.instance.clear();
  });

  it('authors three components with no model in the loop, in plan order', async () => {
    const log: string[] = [];
    const operations = await stagePlan(log);

    // Three scripted turns, no provider: the sections before the page, because
    // the page instantiates them.
    expect(log).toEqual(['Sections/Summary', 'Sections/Activity', 'Pages/Dashboard']);
    expect(operations.map((op) => op.operation.target)).toEqual([
      'Sections/Summary',
      'Sections/Activity',
      'Pages/Dashboard'
    ]);
  });

  it('applies the page, both sections and the token write as ONE changeset', async () => {
    const operations = await stagePlan([]);
    const primaryBefore = tokens.getToken('--primary')!.value;
    expect(primaryBefore).not.toBe(TOKENS['--primary']);

    const result = await applyAuthoredPlan(project, operations, {
      tokens: TOKENS,
      tokenWriter: createPlanTokenWriter(tokens, project)
    });

    expect(project.getComponentWithName('/Sections/Summary')).toBeDefined();
    expect(project.getComponentWithName('/Sections/Activity')).toBeDefined();
    const page = project.getComponentWithName('/Pages/Dashboard')!;
    expect(page).toBeDefined();
    // The page really instantiates the two components the same changeset made.
    const types: string[] = [];
    // Braces, not an implicit return: `push` answers a length and a truthy
    // return means "stop" to this iterator.
    page.graph.forEachNode((node: { typename: string }) => {
      types.push(node.typename);
    });
    expect(types).toContain('/Sections/Summary');
    expect(types).toContain('/Sections/Activity');

    expect(result.tokens!.sort()).toEqual(['--primary', '--surface']);
    expect(tokens.getToken('--primary')!.value).toBe(TOKENS['--primary']);

    // ONE undo step for all four effects — three components, the router
    // registration and the palette.
    expect(UndoQueue.instance.getHistory().length).toBe(1);
    expect(result.registration).toBeDefined();
  });

  it('undoes as one group: one undo takes the components AND the palette back', async () => {
    const operations = await stagePlan([]);
    const primaryBefore = tokens.getToken('--primary')!.value;
    const before = JSON.stringify(project.toJSON());

    await applyAuthoredPlan(project, operations, {
      tokens: TOKENS,
      tokenWriter: createPlanTokenWriter(tokens, project)
    });
    const after = JSON.stringify(project.toJSON());
    expect(after).not.toBe(before);

    UndoQueue.instance.undo();

    expect(project.getComponentWithName('/Pages/Dashboard')).toBeUndefined();
    expect(project.getComponentWithName('/Sections/Summary')).toBeUndefined();
    expect(tokens.getToken('--primary')!.value).toBe(primaryBefore);
    // Byte-identical, which covers the router registration and the stored
    // custom tokens (they live in project metadata) as well as the components.
    expect(JSON.stringify(project.toJSON())).toBe(before);

    UndoQueue.instance.redo();
    expect(JSON.stringify(project.toJSON())).toBe(after);
    expect(tokens.getToken('--primary')!.value).toBe(TOKENS['--primary']);
  });

  it('applies atomically: a refusal leaves neither the other components nor the tokens', async () => {
    const operations = await stagePlan([]);
    const primaryBefore = tokens.getToken('--primary')!.value;

    // The real race: something else created one of the plan's targets between
    // authoring and apply. Applying operation 1 on its own is the cheapest
    // faithful way to produce it.
    await applyAuthoredPlan(project, [operations[0]], {});
    UndoQueue.instance.clear();
    const sabotaged = JSON.stringify(project.toJSON());
    expect(project.getComponentWithName('/Sections/Summary')).toBeDefined();

    const error = await expectRejection(() =>
      applyAuthoredPlan(project, operations, { tokens: TOKENS, tokenWriter: createPlanTokenWriter(tokens, project) })
    );
    expect(error instanceof StagingError).toBe(true);

    // Preflight refused, so nothing at all ran — not the two operations that
    // could have applied, and not the palette.
    expect(JSON.stringify(project.toJSON())).toBe(sabotaged);
    expect(project.getComponentWithName('/Sections/Activity')).toBeUndefined();
    expect(project.getComponentWithName('/Pages/Dashboard')).toBeUndefined();
    expect(tokens.getToken('--primary')!.value).toBe(primaryBefore);
    expect(UndoQueue.instance.getHistory().length).toBe(0);
  });

  it('refuses a plan carrying tokens when the caller cannot write them', async () => {
    const operations = await stagePlan([]);
    const before = JSON.stringify(project.toJSON());

    const error = await expectRejection(() => applyAuthoredPlan(project, operations, { tokens: TOKENS }));
    expect(error.message).toContain('design token');
    // Refused in preflight: not one component applied, which is the point —
    // silently applying an unstyled app is the failure this guards.
    expect(JSON.stringify(project.toJSON())).toBe(before);
    expect(UndoQueue.instance.getHistory().length).toBe(0);
  });

  it('refuses a token name that could never reach a stylesheet, before any mutation', async () => {
    const operations = await stagePlan([]);
    const before = JSON.stringify(project.toJSON());

    const error = await expectRejection(() =>
      applyAuthoredPlan(project, operations, {
        tokens: { primary: '#ff0000' },
        tokenWriter: createPlanTokenWriter(tokens, project)
      })
    );
    expect(error.message).toContain('CSS custom property');
    expect(JSON.stringify(project.toJSON())).toBe(before);
    expect(tokens.getToken('primary')).toBeUndefined();
  });

  it('⚠️ without the metadata snapshot, undo leaves the project byte-different', async () => {
    // The defect this drive found, asserted directly so the repair cannot be
    // deleted as redundant: restoring every token VALUE does not restore the
    // project. `_store()` writes `{version, customTokens: []}` under
    // `designTokens`, and a project that never had a custom token had no such
    // key — so a plan that wrote a palette and was undone left one behind.
    // `StyleTokensModel`'s own undo specs cannot see this: they read values back
    // out of the model, not out of the project.
    const operations = await stagePlan([]);
    const before = JSON.stringify(project.toJSON());

    await applyAuthoredPlan(project, operations, {
      tokens: TOKENS,
      // No store: the writer restores the values and nothing else.
      tokenWriter: createPlanTokenWriter(tokens)
    });
    UndoQueue.instance.undo();

    expect(tokens.getToken('--primary')!.value).not.toBe(TOKENS['--primary']); // values came back…
    expect(JSON.stringify(project.toJSON())).not.toBe(before); // …the project did not
    expect(project.getMetaData('designTokens')).toBeDefined();
  });

  it('a token the plan INTRODUCED is removed on undo, not left holding an empty value', async () => {
    const operations = await stagePlan([]);
    expect(tokens.getToken('--brand-accent')).toBeUndefined();

    await applyAuthoredPlan(project, operations, {
      tokens: { '--brand-accent': '#ff6a00' },
      tokenWriter: createPlanTokenWriter(tokens, project)
    });
    expect(tokens.getToken('--brand-accent')!.value).toBe('#ff6a00');

    UndoQueue.instance.undo();
    // Not `''` — a custom token holding an empty string resolves to nothing and
    // is worse than the token's absence.
    expect(tokens.getToken('--brand-accent')).toBeUndefined();
  });

  it('the two sections were authored with the SAME ids and do not collide (AAQ-011 F12)', async () => {
    const operations = await stagePlan([]);
    await applyAuthoredPlan(project, operations, {});

    const idsOf = (legacyName: string): string[] => {
      const ids: string[] = [];
      project.getComponentWithName(legacyName)!.graph.forEachNode((node: { id: string }) => {
        ids.push(node.id);
      });
      return ids;
    };

    // The model wrote `root`/`title` into both. Without F12's allocator both
    // components would carry both ids and `ProjectModel.findNodeWithId` would
    // answer with the wrong node — criterion 3 would pass on a corrupt project.
    expect(idsOf('/Sections/Summary')).toEqual(['root', 'title']);
    expect(idsOf('/Sections/Activity')).toEqual(['root-2', 'title-2']);
    expect(project.findNodeWithId('title-2')).toBe(
      project.getComponentWithName('/Sections/Activity')!.graph.findNodeWithId('title-2')
    );
  });
});
