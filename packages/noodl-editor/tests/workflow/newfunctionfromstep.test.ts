/**
 * CWF-004 S6 — "New function from this step", at the document level.
 *
 * The decisions this gesture makes are in `newFunctionFromStep.ts` and are
 * pinned in plain Node (`tests-unit/workflow/newFunctionFromStep.test.ts`, 21
 * specs). What is HERE is everything that needs a project: that the component
 * is really created and really named `/#__cloud__/<name>`, that it is the
 * shipped cloud-function template rather than an empty graph, that the step is
 * retargeted only when it has to be, that the whole gesture is one undo, and
 * that none of it reaches the definition except the `ref`.
 *
 * ⚠️ **Not run in the session that wrote it.** Another session held the editor
 * (dev server on 9222), and the jasmine suite needs a real Electron renderer
 * with the same `userData`. Written against the shapes `functiondescent.test.ts`
 * already exercises for exactly that reason.
 *
 * Jasmine, not Jest.
 */

import { ComponentModel } from '../../src/editor/src/models/componentmodel';
import { NodeGraphModel } from '../../src/editor/src/models/nodegraphmodel';
import { ProjectModel } from '../../src/editor/src/models/projectmodel';
import { UndoQueue } from '../../src/editor/src/models/undo-queue-model';
import { WarningsModel } from '../../src/editor/src/models/warningsmodel';
import { REQUEST_NODE_TYPE } from '../../src/editor/src/models/workflow/newFunctionFromStep';
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
      // CWF-005 folded retry into this kind, so its own knobs are declared
      // params — and must not end up declared as the FUNCTION's inputs.
      params: [{ name: 'maxAttempts', type: 'number', description: '' }],
      routes: [],
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
      {
        id: 'charge',
        name: 'Charge card',
        kind: 'call-function',
        ref: 'chargeCard',
        params: { maxAttempts: 3, amount: { $path: 'previous.result.total' }, currency: 'GBP' },
        next: ['pause']
      },
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
  ProjectModel.instance = project(functionNames);
  const doc = WorkflowDocument.fromDefinition(REF, definition(), CATALOG);
  doc.adoptDeployedFunctions(deployed);
  return doc;
}

/** The `params` string the new function's Request node declares, or undefined. */
function declaredParams(componentName: string): unknown {
  const component = ProjectModel.instance.getComponentWithName(componentName);
  let declared;
  component.graph.forEachNode((node) => {
    if (node.typename === REQUEST_NODE_TYPE) declared = node.parameters.params;
  });
  return declared;
}

function typeNames(componentName: string): string[] {
  const component = ProjectModel.instance.getComponentWithName(componentName);
  const names: string[] = [];
  component.graph.forEachNode((node) => {
    names.push(node.typename);
  });
  return names.sort();
}

describe('CWF-004 S6 — when the gesture is on offer', () => {
  afterEach(() => {
    ProjectModel.instance = undefined;
    WarningsModel.instance.clearAllWarnings();
    UndoQueue.instance.clear();
  });

  it('offers it for a step that names a function neither store has', () => {
    const doc = open(['saveOrder'], { names: ['saveOrder'], known: true });

    expect(doc.resolveStep('charge').state).toBe('unresolved');
    expect(doc.plannedFunctionForStep('charge').name).toBe('chargeCard');
  });

  it('offers it for a step that names nothing, with a name from the step’s label', () => {
    ProjectModel.instance = project([]);
    const noRef = definition();
    noRef.steps[1].ref = undefined;
    const doc = WorkflowDocument.fromDefinition(REF, noRef, CATALOG);
    doc.adoptDeployedFunctions({ names: [], known: true });

    expect(doc.resolveStep('charge').state).toBe('unnamed');
    expect(doc.plannedFunctionForStep('charge').name).toBe('chargeCard');
  });

  it('does NOT offer it for a step that already has a graph to open', () => {
    const doc = open(['saveOrder', 'chargeCard'], { names: ['saveOrder', 'chargeCard'], known: true });
    expect(doc.plannedFunctionForStep('charge')).toBe(null);
  });

  it('does NOT offer it for a function deployed from somewhere else', () => {
    // WFA-006's "offer nothing clever": minting a local one would overwrite it
    // on the next push, and that is a decision to take with its consequence in
    // front of you.
    const doc = open(['saveOrder'], { names: ['saveOrder', 'chargeCard'], known: true });

    expect(doc.resolveStep('charge').state).toBe('deployed-only');
    expect(doc.plannedFunctionForStep('charge')).toBe(null);
  });

  it('does NOT offer it when the backend could not be asked', () => {
    const doc = open(['saveOrder'], { names: [], known: false });

    expect(doc.resolveStep('charge').state).toBe('unknown');
    // An unanswered question is the wrong ground to mint a possibly-colliding
    // name on — which is the whole reason that third value exists.
    expect(doc.plannedFunctionForStep('charge')).toBe(null);
  });

  it('does NOT offer it for a step that calls no function at all', () => {
    const doc = open([], { names: [], known: true });
    expect(doc.plannedFunctionForStep('pause')).toBe(null);
    expect(doc.createFunctionFromStep('pause')).toBe(false);
    expect(doc.createFunctionFromStep('nosuchstep')).toBe(false);
  });
});

describe('CWF-004 S6 — what the gesture creates', () => {
  afterEach(() => {
    ProjectModel.instance = undefined;
    WarningsModel.instance.clearAllWarnings();
    UndoQueue.instance.clear();
  });

  it('creates the cloud function the step was already asking for', () => {
    const doc = open(['saveOrder'], { names: ['saveOrder'], known: true });

    expect(doc.createFunctionFromStep('charge')).toBe(true);
    expect(ProjectModel.instance.getComponentWithName('/#__cloud__/chargeCard')).toBeTruthy();

    // The step is repaired, on the card as well as in the row: WFA-006's
    // resolution is recomputed from the project, so nothing here had to tell it.
    expect(doc.resolveStep('charge').state).toBe('resolved-in-project');
    expect(doc.graph.findNodeWithId('charge').getHealth().healthy).toBe(true);
  });

  it('creates the SHIPPED cloud-function template, not an empty graph', () => {
    const doc = open(['saveOrder'], { names: ['saveOrder'], known: true });
    doc.createFunctionFromStep('charge');

    expect(typeNames('/#__cloud__/chargeCard')).toEqual(['noodl.cloud.request', 'noodl.cloud.response']);
  });

  it('declares the step’s own params on the new function, and none of the kind’s knobs', () => {
    const doc = open(['saveOrder'], { names: ['saveOrder'], known: true });
    doc.createFunctionFromStep('charge');

    // `maxAttempts` is a retry policy the kind declares, not something the
    // function receives as part of its public contract.
    expect(declaredParams('/#__cloud__/chargeCard')).toBe('amount,currency');
  });

  it('leaves a working ref alone and retargets only a step it had to rename', () => {
    const doc = open(['saveOrder'], { names: ['saveOrder'], known: true });
    doc.createFunctionFromStep('charge');

    // Unchanged: the author's name was legal, so it was used verbatim.
    expect(doc.graph.findNodeWithId('charge').parameters.ref).toBe('chargeCard');
    expect(doc.toInput().steps.find((s) => s.id === 'charge').ref).toBe('chargeCard');
  });

  it('points an unnamed step at what it just created', () => {
    ProjectModel.instance = project([]);
    const noRef = definition();
    noRef.steps[1].ref = undefined;
    const doc = WorkflowDocument.fromDefinition(REF, noRef, CATALOG);
    doc.adoptDeployedFunctions({ names: [], known: true });

    doc.createFunctionFromStep('charge');

    expect(doc.graph.findNodeWithId('charge').parameters.ref).toBe('chargeCard');
    expect(doc.toInput().steps.find((s) => s.id === 'charge').ref).toBe('chargeCard');
  });

  /**
   * The collision is only reachable through the DERIVED name: a step that names
   * a function the project has is `resolved-in-project` and gets no offer at
   * all. So this is an unnamed step whose label happens to describe a function
   * that already exists.
   */
  it('never mints a name the project already has', () => {
    ProjectModel.instance = project(['chargeCard']);
    const noRef = definition();
    noRef.steps[1].ref = undefined;
    const doc = WorkflowDocument.fromDefinition(REF, noRef, CATALOG);
    doc.adoptDeployedFunctions({ names: [], known: true });

    expect(doc.plannedFunctionForStep('charge').name).toBe('chargeCard2');
    doc.createFunctionFromStep('charge');

    expect(ProjectModel.instance.getComponentWithName('/#__cloud__/chargeCard2')).toBeTruthy();
    expect(doc.graph.findNodeWithId('charge').parameters.ref).toBe('chargeCard2');
    // The pre-existing function was not touched.
    expect(typeNames('/#__cloud__/chargeCard')).toEqual([]);
  });

  it('is one undo for the whole gesture', () => {
    ProjectModel.instance = project([]);
    const noRef = definition();
    noRef.steps[1].ref = undefined;
    const doc = WorkflowDocument.fromDefinition(REF, noRef, CATALOG);
    doc.adoptDeployedFunctions({ names: [], known: true });

    doc.createFunctionFromStep('charge');
    expect(doc.graph.findNodeWithId('charge').parameters.ref).toBe('chargeCard');

    UndoQueue.instance.undo();

    // Undoing half of it would leave either an orphan component named after a
    // step, or a step pointing at a function nobody asked for.
    expect(ProjectModel.instance.getComponentWithName('/#__cloud__/chargeCard')).toBeFalsy();
    expect(doc.graph.findNodeWithId('charge').parameters.ref).toBeUndefined();
  });

  it('adds nothing to the definition but the ref', () => {
    const doc = open(['saveOrder'], { names: ['saveOrder'], known: true });
    doc.createFunctionFromStep('charge');

    const step = doc.toInput().steps.find((s) => s.id === 'charge');
    // The walker invariant WFA-006 asserted, re-asserted for this gesture: a
    // param the backend does not know is a 400 on save.
    expect(Object.keys(step.params).sort()).toEqual(['amount', 'currency', 'maxAttempts']);
    expect(JSON.stringify(step)).not.toContain('__cloud__');
  });
});
