/**
 * WFA-004 — the definition⇄graph conversion.
 *
 * The invariant these specs exist to protect is the one the whole task rests
 * on: **a canvas node id IS a step id**. `ExecutionOverlay` keys on
 * `step.nodeId → getNodeBounds(nodeId)` and the workflow engine writes the
 * workflow's own step ids into `nodeId` (F15), so an id-mapping table anywhere
 * in this path would silently stop WFA-002's run inspector from ever placing a
 * badge.
 *
 * Jasmine, not Jest — the editor's suite runs inside a real Electron renderer
 * (`tests/index.ts` → webpack.test.js) and Jasmine provides the globals, so
 * there is nothing to import.
 */

import { WorkflowDocument } from '../../src/editor/src/models/workflow/WorkflowDocument';
import {
  PORT_NEXT,
  PORT_ON_ERROR,
  routePortName,
  typeNameForKind
} from '../../src/editor/src/models/workflow/workflowNodeLibrary';
import { layoutWorkflow } from '../../src/editor/src/models/workflow/workflowLayout';
import { EventDispatcher } from '../../src/shared/utils/EventDispatcher';

import type {
  StepKindCatalog,
  WorkflowDefinition,
  WorkflowRef
} from '../../src/editor/src/models/workflow/types';

/**
 * A catalog with only what these specs consult. It is deliberately hand-written
 * and deliberately small: the spec that asserts the catalog's real SHAPE runs
 * against a live backend (`workflowcatalog.test.ts`), because a hand-written
 * copy of a served contract is exactly the drift the served registry exists to
 * prevent. This one only stands in for "a catalog was fetched".
 */
const CATALOG: StepKindCatalog = {
  version: 'test',
  source: 'test',
  docs: 'test',
  valueLanguage: {},
  kinds: [
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
    },
    {
      kind: 'branch',
      displayName: 'Branch (IF)',
      category: 'Workflow Logic',
      source: 'CF11-001',
      summary: '',
      whenToUse: '',
      invokesFunction: false,
      params: [{ name: 'condition', type: 'condition', raw: true, description: '' }],
      routes: [
        { name: 'ontrue', description: '' },
        { name: 'onfalse', description: '' }
      ],
      output: ''
    },
    {
      kind: 'merge',
      displayName: 'Merge',
      category: 'Workflow Logic',
      source: 'CF11-001',
      summary: '',
      whenToUse: '',
      invokesFunction: false,
      params: [{ name: 'mode', type: 'enum', enums: ['all', 'any'], description: '' }],
      routes: [],
      output: ''
    },
    {
      kind: 'switch',
      displayName: 'Switch',
      category: 'Workflow Logic',
      source: 'CF11-001',
      summary: '',
      whenToUse: '',
      invokesFunction: false,
      params: [
        { name: 'value', type: 'any', description: '' },
        { name: 'cases', type: 'array', raw: true, description: '' }
      ],
      routes: [
        { name: '<case label>', description: '', dynamic: true },
        { name: 'default', description: '' }
      ],
      output: ''
    }
  ]
};

const REF: WorkflowRef = {
  backendId: 'backend_test',
  backendName: 'Test backend',
  id: 'orderPipeline',
  name: 'Order Pipeline',
  stepCount: 6
};

/**
 * The phase-19 test workflow: a branch, a call with a retry policy, an error
 * route and a merge. (CWF-005 folded the standalone `retry` kind into
 * `call-function`, so the charge step is a Call Function carrying `maxAttempts`.)
 */
function orderPipeline(): WorkflowDefinition {
  return {
    version: 1,
    id: 'orderPipeline',
    name: 'Order Pipeline',
    entry: 'start',
    concurrency: 1,
    steps: [
      { id: 'start', name: 'Receive order', kind: 'wait', params: { duration: 5 }, next: ['decide'] },
      {
        id: 'decide',
        name: 'Over £100?',
        kind: 'branch',
        params: { condition: { left: { $path: 'body.total' }, op: 'gt', right: 100 } },
        routes: { ontrue: ['charge'], onfalse: ['logsmall'] }
      },
      {
        id: 'charge',
        name: 'Charge card',
        kind: 'call-function',
        ref: 'chargeCard',
        params: { maxAttempts: 2 },
        next: ['tally'],
        onError: ['logfail']
      },
      { id: 'logsmall', name: 'Log small order', kind: 'wait', params: { duration: 1 }, next: ['tally'] },
      { id: 'logfail', name: 'Log failure', kind: 'wait', params: { duration: 1 }, next: ['tally'] },
      { id: 'tally', name: 'Tally', kind: 'merge', params: { mode: 'any' } }
    ],
    createdAt: '2026-07-28T00:00:00.000Z',
    updatedAt: '2026-07-28T00:00:00.000Z'
  };
}

describe('WFA-004 workflow document', () => {
  describe('a definition becomes a graph', () => {
    it('uses the step id as the node id — the identity the overlay depends on', () => {
      const doc = WorkflowDocument.fromDefinition(REF, orderPipeline(), CATALOG);

      const ids: string[] = [];
      doc.graph.forEachNode((n) => {
        ids.push(n.id);
      });

      expect(ids.sort()).toEqual(['charge', 'decide', 'logfail', 'logsmall', 'start', 'tally']);
      expect(doc.graph.findNodeWithId('charge')).toBeDefined();
    });

    it('types each node from its kind', () => {
      const doc = WorkflowDocument.fromDefinition(REF, orderPipeline(), CATALOG);
      expect(doc.graph.findNodeWithId('decide').typename).toBe(typeNameForKind('branch'));
      expect(doc.graph.findNodeWithId('charge').typename).toBe(typeNameForKind('call-function'));
    });

    it('labels a node with the step name, and subtitles a function step with its ref', () => {
      const doc = WorkflowDocument.fromDefinition(REF, orderPipeline(), CATALOG);
      const charge = doc.graph.findNodeWithId('charge');
      expect(charge.label).toBe('Charge card');
      // `typeLabelOverride` is what the canvas painter already reads for the
      // card's sub-label — no painter change to show the function invoked.
      expect(charge.metadata.typeLabelOverride).toBe('Retry · chargeCard');
    });

    it('turns next, routes and onError into connections on distinct ports', () => {
      const doc = WorkflowDocument.fromDefinition(REF, orderPipeline(), CATALOG);
      const from = (fromId: string, port: string) =>
        doc.graph.connections.filter((c) => c.fromId === fromId && c.fromProperty === port).map((c) => c.toId);

      expect(from('start', PORT_NEXT)).toEqual(['decide']);
      expect(from('decide', routePortName('ontrue'))).toEqual(['charge']);
      expect(from('decide', routePortName('onfalse'))).toEqual(['logsmall']);
      expect(from('charge', PORT_ON_ERROR)).toEqual(['logfail']);
      expect(from('charge', PORT_NEXT)).toEqual(['tally']);
    });

    it('drops a `ref` out of params — it is a step field, not a param', () => {
      const doc = WorkflowDocument.fromDefinition(REF, orderPipeline(), CATALOG);
      const step = doc.toInput().steps.find((s) => s.id === 'charge');
      expect(step.ref).toBe('chargeCard');
      expect(step.params.ref).toBeUndefined();
      expect(step.params.maxAttempts).toBe(2);
    });
  });

  describe('a graph becomes a definition', () => {
    it('round-trips every step, edge, param and name', () => {
      const original = orderPipeline();
      const doc = WorkflowDocument.fromDefinition(REF, original, CATALOG);
      const written = doc.toInput();

      expect(written.entry).toBe('start');
      expect(written.steps.length).toBe(original.steps.length);

      for (const before of original.steps) {
        const after = written.steps.find((s) => s.id === before.id);
        expect(after).toBeDefined();
        expect(after.kind).toBe(before.kind);
        expect(after.name).toBe(before.name);
        expect(after.ref).toBe(before.ref);
        expect(after.next || []).toEqual(before.next || []);
        expect(after.onError || []).toEqual(before.onError || []);
        expect(after.routes || {}).toEqual(before.routes || {});
        expect(after.params || {}).toEqual(before.params || {});
      }
    });

    it('writes a position for every step, so the next open is not re-laid-out', () => {
      const doc = WorkflowDocument.fromDefinition(REF, orderPipeline(), CATALOG);
      for (const step of doc.toInput().steps) {
        expect(typeof step.ui.x).toBe('number');
        expect(typeof step.ui.y).toBe('number');
      }
    });

    it('keeps a hand-arranged position rather than re-laying it out', () => {
      const definition = orderPipeline();
      definition.steps[0].ui = { x: 999, y: 777 };

      const doc = WorkflowDocument.fromDefinition(REF, definition, CATALOG);
      expect(doc.graph.findNodeWithId('start').x).toBe(999);
      expect(doc.graph.findNodeWithId('start').y).toBe(777);

      const written = doc.toInput().steps.find((s) => s.id === 'start');
      expect(written.ui).toEqual({ x: 999, y: 777 });
    });

    it('does not invent a name for a step that had none', () => {
      const definition = orderPipeline();
      delete definition.steps[0].name;

      const doc = WorkflowDocument.fromDefinition(REF, definition, CATALOG);
      const written = doc.toInput().steps.find((s) => s.id === 'start');
      // The label falls back to the id on the canvas; writing that back as a
      // `name` would turn every unnamed step into a named one on first save.
      expect(written.name).toBeUndefined();
    });
  });

  describe('switch routes come from its own cases', () => {
    it('grows one output port per case label', () => {
      const definition: WorkflowDefinition = {
        version: 1,
        id: 'sw',
        entry: 'route',
        concurrency: 1,
        steps: [
          {
            id: 'route',
            kind: 'switch',
            params: { value: { $path: 'body.status' }, cases: [{ label: 'paid', equals: 'paid' }, { label: 'failed', equals: 'failed' }] }
          }
        ],
        createdAt: '',
        updatedAt: ''
      };

      const doc = WorkflowDocument.fromDefinition({ ...REF, id: 'sw' }, definition, CATALOG);
      const names = doc.graph.findNodeWithId('route').dynamicports.map((p: { name: string }) => p.name);
      expect(names).toEqual([routePortName('paid'), routePortName('failed')]);
    });

    /**
     * The step is in the graph BEFORE it announces its ports.
     *
     * `setDynamicPorts` broadcasts `Model.instancePortsChanged` to every global
     * listener, and those listeners identify what an event is about by walking
     * `owner`. Announcing from an unowned node crashed `ViewerConnection`'s
     * handler with a TypeError that propagated out of `WorkflowDocument.open`,
     * so ONE `switch` step made an entire workflow fail to open — found in the
     * WFA-004 live pass, invisible to the spec above because no listener is
     * attached here.
     *
     * Asserted as the invariant rather than by re-testing the listener: the
     * listener is one of several, and the thing that must be true is that a
     * node has a graph when it tells the world its ports changed.
     */
    it('adds the step to the graph before announcing its ports', () => {
      const definition: WorkflowDefinition = {
        version: 1,
        id: 'sw',
        entry: 'route',
        concurrency: 1,
        steps: [
          {
            id: 'route',
            kind: 'switch',
            params: { value: { $path: 'body.status' }, cases: [{ label: 'paid', equals: 'paid' }] }
          }
        ],
        createdAt: '',
        updatedAt: ''
      };

      const owners: unknown[] = [];
      const group = {};
      EventDispatcher.instance.on(
        'Model.instancePortsChanged',
        (e: { model: { owner?: unknown } }) => owners.push(e.model.owner),
        group
      );

      try {
        WorkflowDocument.fromDefinition({ ...REF, id: 'sw' }, definition, CATALOG);
      } finally {
        EventDispatcher.instance.off(group);
      }

      expect(owners.length).toBeGreaterThan(0);
      owners.forEach((owner) => expect(owner).toBeDefined());
    });
  });

  describe('the canvas refuses to draw a cycle', () => {
    it('refuses an edge that would close a loop', () => {
      const doc = WorkflowDocument.fromDefinition(REF, orderPipeline(), CATALOG);

      const status = doc.graph.getConnectionStatus({
        sourceNode: doc.graph.findNodeWithId('tally'),
        sourcePort: PORT_NEXT,
        targetNode: doc.graph.findNodeWithId('start'),
        targetPort: 'in'
      });

      expect(status.connectable).toBe(false);
      expect(status.message).toContain('loop');
    });

    it('refuses a self-edge', () => {
      const doc = WorkflowDocument.fromDefinition(REF, orderPipeline(), CATALOG);
      const status = doc.graph.getConnectionStatus({
        sourceNode: doc.graph.findNodeWithId('start'),
        sourcePort: PORT_NEXT,
        targetNode: doc.graph.findNodeWithId('start'),
        targetPort: 'in'
      });
      expect(status.connectable).toBe(false);
    });

    it('allows a forward edge that does not close a loop', () => {
      const doc = WorkflowDocument.fromDefinition(REF, orderPipeline(), CATALOG);
      const status = doc.graph.getConnectionStatus({
        sourceNode: doc.graph.findNodeWithId('start'),
        sourcePort: PORT_ON_ERROR,
        targetNode: doc.graph.findNodeWithId('logfail'),
        targetPort: 'in'
      });
      expect(status.connectable).toBe(true);
    });

    it('refuses an edge onto anything but the step input', () => {
      const doc = WorkflowDocument.fromDefinition(REF, orderPipeline(), CATALOG);
      const status = doc.graph.getConnectionStatus({
        sourceNode: doc.graph.findNodeWithId('start'),
        sourcePort: PORT_NEXT,
        targetNode: doc.graph.findNodeWithId('decide'),
        targetPort: 'condition'
      });
      expect(status.connectable).toBe(false);
    });
  });

  describe('a new step gets a readable id', () => {
    it('renames a guid to something the execution record can be read with', () => {
      const doc = WorkflowDocument.fromDefinition(REF, orderPipeline(), CATALOG);
      const { NodeGraphNode } = require('../../src/editor/src/models/nodegraphmodel');

      const node = NodeGraphNode.fromJSON({
        id: '3f2a1c04-1111-2222-3333-444455556666',
        type: typeNameForKind('branch'),
        x: 0,
        y: 0
      });
      doc.graph.addRoot(node);

      // `branch` is taken by no existing step in this workflow, so the first
      // one is unsuffixed.
      expect(node.id).toBe('branch');
      expect(doc.graph.findNodeWithId('branch')).toBe(node);
    });

    it('keeps a non-guid id, so undoing a delete does not orphan the edges pointing at it', () => {
      const doc = WorkflowDocument.fromDefinition(REF, orderPipeline(), CATALOG);
      const node = doc.graph.findNodeWithId('logfail');
      doc.graph.removeNode(node);
      doc.graph.addRoot(node);
      expect(node.id).toBe('logfail');
    });
  });

  describe('layout', () => {
    it('is deterministic — the same definition lays out the same way twice', () => {
      const a = layoutWorkflow(orderPipeline().steps, 'start');
      const b = layoutWorkflow(orderPipeline().steps, 'start');
      for (const [id, pos] of a) expect(b.get(id)).toEqual(pos);
    });

    it('puts the entry step leftmost and every edge left to right', () => {
      const positions = layoutWorkflow(orderPipeline().steps, 'start');
      expect(positions.get('start').x).toBeLessThan(positions.get('decide').x);
      expect(positions.get('decide').x).toBeLessThan(positions.get('charge').x);
      expect(positions.get('charge').x).toBeLessThan(positions.get('tally').x);
    });

    it('terminates on a cyclic definition rather than hanging the editor', () => {
      const steps = orderPipeline().steps;
      steps.find((s) => s.id === 'tally').next = ['start'];
      const positions = layoutWorkflow(steps, 'start');
      expect(positions.size).toBe(steps.length);
    });
  });
});
