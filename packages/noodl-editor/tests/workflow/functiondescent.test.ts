/**
 * WFA-006 — a step, the function it calls, and the gap between two stores.
 *
 * These specs are about the document rather than the helper: what a card says,
 * what gets a warning, what a rename does, and — the F49/F51 shape — that
 * growing the card did not grow the definition. `toInput` walks every node on
 * the canvas, and resolution state deliberately does not live anywhere it can
 * see, which is the invariant worth asserting rather than re-testing.
 *
 * Jasmine, not Jest.
 */

import { ComponentModel } from '../../src/editor/src/models/componentmodel';
import { NodeGraphModel } from '../../src/editor/src/models/nodegraphmodel';
import { ProjectModel } from '../../src/editor/src/models/projectmodel';
import { WarningsModel } from '../../src/editor/src/models/warningsmodel';
import { callersInDefinition, usageLabel } from '../../src/editor/src/models/workflow/functionUsage';
import {
  buildWorkflowNodeLibrary,
  PORT_TYPE_FUNCTION_REF,
  typeNameForKind
} from '../../src/editor/src/models/workflow/workflowNodeLibrary';
import { WorkflowDocument } from '../../src/editor/src/models/workflow/WorkflowDocument';

import type { StepKindCatalog, WorkflowDefinition, WorkflowRef } from '../../src/editor/src/models/workflow/types';

const CATALOG: StepKindCatalog = {
  version: 'test',
  source: 'test',
  docs: 'test',
  valueLanguage: {},
  kinds: [
    {
      kind: 'call-function',
      displayName: 'Call Function',
      category: 'Workflow',
      source: 'WF-001',
      summary: '',
      whenToUse: '',
      invokesFunction: true,
      params: [],
      routes: [],
      output: ''
    },
    {
      kind: 'for-each',
      displayName: 'For Each',
      category: 'Workflow Logic',
      source: 'CF11-001',
      summary: '',
      whenToUse: '',
      invokesFunction: true,
      params: [{ name: 'items', type: 'path', description: '' }],
      routes: [
        { name: 'empty', description: '' },
        { name: 'nonempty', description: '' }
      ],
      output: ''
    },
    {
      kind: 'wait',
      displayName: 'Wait',
      category: 'Workflow Timing',
      source: 'CF11-003',
      summary: '',
      whenToUse: '',
      invokesFunction: false,
      params: [{ name: 'duration', type: 'number', description: '' }],
      routes: [],
      output: ''
    }
  ]
};

const REF: WorkflowRef = {
  backendId: 'backend_test',
  backendName: 'SQLite backend',
  id: 'orderPipeline',
  name: 'Order Pipeline',
  stepCount: 3
};

function definition(): WorkflowDefinition {
  return {
    version: 1,
    id: 'orderPipeline',
    name: 'Order Pipeline',
    entry: 'save',
    concurrency: 1,
    steps: [
      { id: 'save', name: 'Save order', kind: 'call-function', ref: 'saveOrder', next: ['charge'] },
      { id: 'charge', name: 'Charge card', kind: 'call-function', ref: 'chargeCard', next: ['pause'] },
      { id: 'pause', name: 'Pause', kind: 'wait', params: { duration: 1 } }
    ],
    createdAt: '2026-07-28T00:00:00.000Z',
    updatedAt: '2026-07-28T00:00:00.000Z'
  };
}

function project(functionNames: string[]): ProjectModel {
  const model = new ProjectModel();
  for (const name of functionNames) {
    model.addComponent(
      new ComponentModel({ name: `/#__cloud__/${name}`, graph: new NodeGraphModel(), id: `/#__cloud__/${name}` })
    );
  }
  return model;
}

function open(functionNames: string[], deployed: { names: string[]; known: boolean }) {
  // The project has to be the instance BEFORE the document builds its cards:
  // setting it registers a module, which clears every warning.
  ProjectModel.instance = project(functionNames);
  const doc = WorkflowDocument.fromDefinition(REF, definition(), CATALOG);
  doc.adoptDeployedFunctions(deployed);
  return doc;
}

function subLabel(doc: WorkflowDocument, stepId: string): string {
  return doc.graph.findNodeWithId(stepId).metadata.typeLabelOverride;
}

function isFlagged(doc: WorkflowDocument, stepId: string): boolean {
  const node = doc.graph.findNodeWithId(stepId);
  return !node.getHealth().healthy;
}

describe('WFA-006 — what the card says', () => {
  afterEach(() => {
    ProjectModel.instance = undefined;
    WarningsModel.instance.clearAllWarnings();
  });

  it('says nothing extra when the function is in the project and deployed', () => {
    const doc = open(['saveOrder', 'chargeCard'], { names: ['saveOrder', 'chargeCard'], known: true });
    expect(subLabel(doc, 'save')).toBe('Call Function · saveOrder · entry step');
    expect(isFlagged(doc, 'save')).toBe(false);
  });

  it('says "not deployed yet" for the common authoring case, without calling it broken', () => {
    const doc = open(['saveOrder', 'chargeCard'], { names: [], known: true });
    expect(subLabel(doc, 'charge')).toBe('Call Function · chargeCard · in this project · not deployed yet');
    expect(isFlagged(doc, 'charge')).toBe(false);
  });

  it('distinguishes "deployed, not in this project" from "not found" ON THE CARD', () => {
    const doc = open(['saveOrder'], { names: ['saveOrder', 'chargeCard'], known: true });
    expect(subLabel(doc, 'charge')).toBe('Call Function · chargeCard · deployed, not in this project');
    // Not an error: red is reserved for something that is actually wrong.
    expect(isFlagged(doc, 'charge')).toBe(false);
  });

  it('a step that points at nothing is visibly wrong with no interaction', () => {
    const doc = open(['saveOrder'], { names: ['saveOrder'], known: true });
    expect(subLabel(doc, 'charge')).toBe('Call Function · chargeCard · not found');
    // `getHealth` is what the painter reads for the dashed danger ring and the
    // warning glyph — no painter change was needed for §3.
    expect(isFlagged(doc, 'charge')).toBe(true);
    expect(doc.graph.findNodeWithId('charge').getHealth().message).toContain('is not deployed on SQLite backend');
  });

  it('says NOTHING when the backend has not been asked — never "not found"', () => {
    const doc = open(['saveOrder'], { names: [], known: false });
    expect(subLabel(doc, 'charge')).toBe('Call Function · chargeCard');
    expect(isFlagged(doc, 'charge')).toBe(false);
    // The property editor still gets the honest sentence, because selecting a
    // step is asking.
    expect(doc.resolveStep('charge').state).toBe('unknown');
  });

  it('covers every kind that invokes a function, from the served spec rather than a list', () => {
    ProjectModel.instance = project([]);
    const withForEach = definition();
    withForEach.steps.push({ id: 'each', kind: 'for-each', ref: 'chargeLine', params: { items: 'body.lines' } });
    const doc = WorkflowDocument.fromDefinition({ ...REF, stepCount: 4 }, withForEach, CATALOG);
    doc.adoptDeployedFunctions({ names: [], known: true });

    // `for-each` is never named in the editor's code — `invokesFunction` is.
    expect(subLabel(doc, 'each')).toBe('For Each · chargeLine · not found');
    expect(isFlagged(doc, 'each')).toBe(true);
  });

  it('a step that does not call a function is not asked about one', () => {
    const doc = open([], { names: [], known: true });
    expect(doc.resolveStep('pause')).toBe(null);
    expect(isFlagged(doc, 'pause')).toBe(false);
    expect(subLabel(doc, 'pause')).toBe('Wait');
  });

  it('a step with no ref at all is flagged before the backend refuses to save it', () => {
    ProjectModel.instance = project([]);
    const noRef = definition();
    noRef.steps[0].ref = undefined;
    const doc = WorkflowDocument.fromDefinition(REF, noRef, CATALOG);
    doc.adoptDeployedFunctions({ names: [], known: true });

    expect(doc.resolveStep('save').state).toBe('unnamed');
    expect(isFlagged(doc, 'save')).toBe(true);
  });
});

describe('WFA-006 §7 — a rename makes the breakage visible', () => {
  afterEach(() => {
    ProjectModel.instance = undefined;
    WarningsModel.instance.clearAllWarnings();
  });

  /**
   * The decision (WFA-006-ASSESSMENT §2) is that a rename does NOT rewrite
   * backend-held workflow definitions. What it must not do is nothing at all:
   * the step has to stop claiming to point at something in this project.
   */
  it('renaming a cloud function stops its callers claiming to resolve, without rewriting them', () => {
    const doc = open(['saveOrder', 'chargeCard'], { names: ['saveOrder', 'chargeCard'], known: true });
    expect(doc.resolveStep('charge').state).toBe('resolved-in-project');

    // The rename, as the components panel performs it.
    const component = ProjectModel.instance.getComponentWithName('/#__cloud__/chargeCard');
    ProjectModel.instance.renameComponent(component, '/#__cloud__/chargeCardV2');

    // The definition was NOT touched — that is the decision, not an omission.
    expect(doc.toInput().steps.find((s) => s.id === 'charge').ref).toBe('chargeCard');

    /**
     * And the step is now `deployed-only` rather than broken, which is the
     * TRUTH rather than a near-miss: the backend is still serving the function
     * under its old name and this step still runs. It stops being broken only
     * when the next deploy removes it — which is exactly why an automatic
     * fix-up would be wrong here. It would rewrite a working step.
     */
    const after = doc.resolveStep('charge');
    expect(after.inProject).toBe(false);
    expect(after.state).toBe('deployed-only');
    expect(subLabel(doc, 'charge')).toBe('Call Function · chargeCard · deployed, not in this project');
  });

  it('…and once the rename reaches the backend, the step is visibly broken', () => {
    const doc = open(['saveOrder', 'chargeCard'], { names: ['saveOrder', 'chargeCard'], known: true });

    const component = ProjectModel.instance.getComponentWithName('/#__cloud__/chargeCard');
    ProjectModel.instance.renameComponent(component, '/#__cloud__/chargeCardV2');
    // The push that follows a save: the backend now serves the new name.
    doc.adoptDeployedFunctions({ names: ['saveOrder', 'chargeCardV2'], known: true });

    expect(doc.resolveStep('charge').state).toBe('unresolved');
    expect(isFlagged(doc, 'charge')).toBe(true);
    // Never silently rewritten to the new name.
    expect(doc.toInput().steps.find((s) => s.id === 'charge').ref).toBe('chargeCard');
  });

  it('offers the names that DO exist, labelled by where they are', () => {
    const doc = open(['saveOrder'], { names: ['saveOrder', 'chargeCard'], known: true });
    const suggestions = doc.functionSuggestions();

    expect(suggestions).toContain(jasmine.objectContaining({ name: 'saveOrder', where: 'In this project' }));
    // Deliberately not merged into one list: one of these is a graph you can
    // open, the other is not.
    expect(suggestions).toContain(
      jasmine.objectContaining({
        name: 'chargeCard',
        where: 'Deployed on SQLite backend, not in this project'
      })
    );
  });
});

describe('WFA-006 — the walker audit (the F49 / F51 shape)', () => {
  afterEach(() => {
    ProjectModel.instance = undefined;
    WarningsModel.instance.clearAllWarnings();
  });

  it('resolution state never reaches the definition', () => {
    const doc = open([], { names: [], known: true });
    const step = doc.toInput().steps.find((s) => s.id === 'charge');

    // The card grew; the step did not. Resolution lives in `metadata` and in
    // `WarningsModel`, neither of which `toInput` walks — and a param the
    // backend does not know is a 400 on save.
    expect(step.ref).toBe('chargeCard');
    expect(step.params).toBeUndefined();
    expect(JSON.stringify(step)).not.toContain('not found');
  });

  it('the descent declines a step that calls no function, so the canvas keeps its own gesture', () => {
    const doc = open([], { names: [], known: true });
    expect(doc.descendInto('pause')).toBe(false);
    expect(doc.descendInto('nosuchstep')).toBe(false);
  });
});

/** The same escape hatch `workflowcatalog.test.ts` uses: `ports` is not on the declared type. */
function refPortOf(kind: string): { name: string; type: { name: string; allowEditOnly?: boolean } } | undefined {
  const type = buildWorkflowNodeLibrary(CATALOG).nodetypes.find((t) => t.name === typeNameForKind(kind));
  const ports = (type as unknown as { ports: { name: string; type: { name: string; allowEditOnly?: boolean } }[] })
    .ports;
  return ports.find((p) => p.name === 'ref');
}

describe('WFA-006 — the `ref` port carries its own control', () => {
  it('is the function-ref port type, which is what puts the resolution in the property editor', () => {
    const ref = refPortOf('call-function');
    expect(ref.type.name).toBe(PORT_TYPE_FUNCTION_REF);
    // Still edit-only: a `ref` is a value you type or pick, never a wire.
    expect(ref.type.allowEditOnly).toBe(true);
  });

  it('gives the same port to every kind that invokes a function, and to no other', () => {
    expect(refPortOf('for-each').type.name).toBe(PORT_TYPE_FUNCTION_REF);
    expect(refPortOf('wait')).toBeUndefined();
  });
});

describe('WFA-006 §6 — which workflows call a function', () => {
  it('finds every step in a definition that calls it, by step id', () => {
    const def = definition();
    def.steps.push({ id: 'chargeAgain', kind: 'call-function', ref: 'chargeCard' });

    expect(callersInDefinition(def, 'chargeCard')).toEqual(['charge', 'chargeAgain']);
    expect(callersInDefinition(def, 'saveOrder')).toEqual(['save']);
    expect(callersInDefinition(def, 'nothing')).toEqual([]);
  });

  it('says "no workflow calls this" and "we could not ask" as different sentences', () => {
    const asked = { functionName: 'f', callers: [], backendsAsked: 2, unreachable: [] };
    const notAsked = { functionName: 'f', callers: [], backendsAsked: 0, unreachable: [] };
    const unreachable = { functionName: 'f', callers: [], backendsAsked: 0, unreachable: ['SQLite backend'] };

    expect(usageLabel(asked)).toBe('Used by no workflow');
    expect(usageLabel(notAsked)).toBe('No backend running');
    expect(usageLabel(unreachable)).toBe('Callers unknown');
  });
});
