/**
 * WFA-005 — a workflow's triggers, drawn as its entry nodes.
 *
 * The property these specs exist to protect is the one that makes the drawing
 * safe: **a trigger node is a VIEW of a backend object and is never part of the
 * definition.** It has to appear on the canvas, in the graph, wired to the entry
 * step — and be invisible to every piece of code that asks "what are the steps
 * of this workflow?".
 *
 * That is not a theoretical worry. Adding these nodes immediately made the
 * `$path` predecessor picker offer a trigger as an upstream step, which would
 * have produced `{"$path": "upstream.trg_…"}` — a definition the backend rejects
 * with a 400. Same shape as WFA-004's F49: a global structure grew a member that
 * every existing walker assumed could not exist.
 *
 * Jasmine, not Jest — the editor's suite runs in a real Electron renderer.
 */

import { WorkflowDocument } from '../../src/editor/src/models/workflow/WorkflowDocument';
import { upstreamSteps, danglingReference } from '../../src/editor/src/models/workflow/workflowScope';
import {
  isTriggerTypeName,
  kindFromTypeName,
  PORT_FIRES,
  triggerTypeName,
  typeNameForKind
} from '../../src/editor/src/models/workflow/workflowNodeLibrary';
import {
  cronGloss,
  isTargetResolved,
  webhookUrl
} from '../../src/editor/src/models/triggers/TriggerBackendClient';
import {
  isTriggerNode,
  MANUAL_TRIGGER_NODE_ID,
  triggerParameters,
  triggersForWorkflow,
  triggerSubLabel
} from '../../src/editor/src/models/workflow/workflowTriggerNodes';

import type { TriggerDef } from '../../src/editor/src/models/triggers/TriggerBackendClient';
import type {
  StepKindCatalog,
  WorkflowDefinition,
  WorkflowRef
} from '../../src/editor/src/models/workflow/types';

const REF: WorkflowRef = {
  backendId: 'backend_test',
  backendName: 'SQLite backend',
  id: 'orderPipeline',
  name: 'Order Pipeline',
  stepCount: 3
};

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
      source: 'test',
      summary: '',
      whenToUse: '',
      invokesFunction: false,
      params: [{ name: 'duration', type: 'number', description: '' }],
      routes: [],
      output: ''
    },
    {
      kind: 'call-function',
      displayName: 'Call Function',
      category: 'Workflow',
      source: 'test',
      summary: '',
      whenToUse: '',
      invokesFunction: true,
      params: [],
      routes: [],
      output: ''
    }
  ]
};

function definition(): WorkflowDefinition {
  return {
    version: 1,
    id: 'orderPipeline',
    name: 'Order Pipeline',
    entry: 'start',
    concurrency: 1,
    steps: [
      { id: 'start', name: 'Receive order', kind: 'call-function', ref: 'saveOrder', next: ['hold'] },
      { id: 'hold', name: 'Hold', kind: 'wait', params: { duration: 1 } }
    ],
    createdAt: '2026-07-28T00:00:00.000Z',
    updatedAt: '2026-07-28T00:00:00.000Z'
  };
}

function status() {
  return { lastFiredAt: null, nextFireAt: null, lastResult: null, fireCount: 0 };
}

function webhookTrigger(overrides: Partial<TriggerDef> = {}): TriggerDef {
  return {
    id: 'trg_hook',
    type: 'webhook',
    name: 'Order received',
    enabled: true,
    target: { kind: 'workflow', name: 'orderPipeline' },
    webhook: { slug: 'orders', scheme: 'token', maxBodyBytes: 1048576 },
    status: status(),
    ...overrides
  } as TriggerDef;
}

function scheduleTrigger(overrides: Partial<TriggerDef> = {}): TriggerDef {
  return {
    id: 'trg_cron',
    type: 'schedule',
    name: 'Nightly',
    enabled: true,
    target: { kind: 'workflow', name: 'orderPipeline' },
    schedule: { cron: '0 3 * * *', missedFirePolicy: 'skip', payload: { mode: 'nightly' } },
    status: status(),
    ...overrides
  } as TriggerDef;
}

const ENDPOINT = 'http://127.0.0.1:8578';

function open(triggers: TriggerDef[]) {
  return WorkflowDocument.fromDefinition(REF, definition(), CATALOG, { triggers, endpoint: ENDPOINT });
}

function nodeIds(doc: WorkflowDocument): string[] {
  const ids: string[] = [];
  doc.graph.forEachNode((n) => {
    ids.push(n.id);
  });
  return ids.sort();
}

describe('WFA-005 trigger entry nodes', () => {
  describe('which triggers belong on this canvas', () => {
    it('takes workflow-targeted triggers for THIS workflow only', () => {
      const mine = webhookTrigger();
      const otherWorkflow = webhookTrigger({ id: 'trg_other', target: { kind: 'workflow', name: 'somethingElse' } });
      // Out of scope by the spec's own words: a function is not a workflow and
      // has no entry node here.
      const aFunction = webhookTrigger({ id: 'trg_fn', target: { kind: 'function', name: 'orderPipeline' } });

      const chosen = triggersForWorkflow([mine, otherWorkflow, aFunction], 'orderPipeline');
      expect(chosen.map((t) => t.id)).toEqual(['trg_hook']);
    });
  });

  describe('the nodes on the canvas', () => {
    it('adds one node per trigger, keyed by the trigger id', () => {
      const doc = open([webhookTrigger(), scheduleTrigger()]);
      expect(nodeIds(doc)).toEqual(['hold', 'start', 'trg_cron', 'trg_hook']);
    });

    it('wires each trigger to the entry step, out of `fires` and into `in`', () => {
      const doc = open([webhookTrigger()]);
      const wire = doc.graph.connections.find((c) => c.fromId === 'trg_hook');
      expect(wire).toBeDefined();
      expect(wire.fromProperty).toBe(PORT_FIRES);
      expect(wire.toId).toBe('start');
    });

    it('draws a manual entry marker when nothing triggers the workflow', () => {
      const doc = open([]);
      expect(nodeIds(doc)).toContain(MANUAL_TRIGGER_NODE_ID);
      // Deliberately unwired: the gap is what says "nothing starts this".
      expect(doc.graph.connections.some((c) => c.fromId === MANUAL_TRIGGER_NODE_ID)).toBe(false);
    });

    /**
     * "Not asked" is not "nothing". The manual marker is a positive claim, and
     * the pure conversion path has not asked a backend anything.
     */
    it('draws no entry node at all when the triggers were never fetched', () => {
      const doc = WorkflowDocument.fromDefinition(REF, definition(), CATALOG);
      expect(nodeIds(doc)).toEqual(['hold', 'start']);
    });

    it('places them left of the entry step', () => {
      const doc = open([webhookTrigger()]);
      expect(doc.graph.findNodeWithId('trg_hook').x).toBeLessThan(doc.graph.findNodeWithId('start').x);
    });

    it('opens clean — a workflow is not dirty because something triggers it', () => {
      expect(open([webhookTrigger()]).isDirty).toBe(false);
      expect(open([]).isDirty).toBe(false);
    });
  });

  describe('a trigger node is not a step', () => {
    it('has no step kind, so `toInput` cannot write it into the definition', () => {
      expect(kindFromTypeName(triggerTypeName('webhook'))).toBeUndefined();
      expect(isTriggerTypeName(triggerTypeName('webhook'))).toBe(true);
      // …while a real step still resolves.
      expect(kindFromTypeName(typeNameForKind('wait'))).toBe('wait');
    });

    it('is absent from the saved definition, wires and all', () => {
      const doc = open([webhookTrigger(), scheduleTrigger()]);
      const input = doc.toInput();
      expect(input.steps.map((s) => s.id).sort()).toEqual(['hold', 'start']);
      // The entry step's own edges are untouched by the trigger wire.
      expect(input.steps.find((s) => s.id === 'start').next).toEqual(['hold']);
      expect(input.entry).toBe('start');
    });

    /**
     * The defect adding these nodes actually caused. A trigger IS upstream of
     * the entry step on the canvas, so the picker offered it — and
     * `{"$path": "upstream.trg_hook.…"}` is a 400 from the backend, which is
     * precisely the drift the scope module exists to prevent.
     */
    it('is not offered as an upstream step by the $path picker', () => {
      const doc = open([webhookTrigger()]);
      const upstream = upstreamSteps(doc.graph, 'hold');
      expect(upstream.map((s) => s.id)).toEqual(['start']);
    });

    it('is reported as "no such step" when a $path names one', () => {
      const doc = open([webhookTrigger()]);
      const problem = danglingReference(doc.graph, 'hold', 'upstream.trg_hook.result');
      expect(problem).not.toBeNull();
      expect(problem.message).toContain('no step called');
    });

    it('does not become the entry step when the stored entry is deleted', () => {
      const doc = open([webhookTrigger()]);
      doc.graph.removeNode(doc.graph.findNodeWithId('start'));
      expect(doc.entry).toBe('hold');
    });
  });

  describe('what the card says', () => {
    it('names the schedule in plain English, and says when it is off', () => {
      expect(triggerSubLabel(scheduleTrigger())).toBe('Schedule · at 03:00 daily');
      expect(triggerSubLabel(scheduleTrigger({ enabled: false }))).toContain('DISABLED');
    });

    it('names a webhook by its slug, and a workflow with none as manual', () => {
      expect(triggerSubLabel(webhookTrigger())).toBe('Webhook · POST /orders');
      expect(triggerSubLabel(null)).toContain('nothing triggers this');
    });
  });

  describe('what the property editor shows', () => {
    it('gives a webhook its full URL', () => {
      const rows = triggerParameters(webhookTrigger(), {
        backendId: 'backend_test',
        backendName: 'SQLite backend',
        endpoint: ENDPOINT
      });
      expect(rows.url).toBe('http://127.0.0.1:8578/hooks/backend_test/orders');
      expect(rows.scheme).toContain('Bearer');
    });

    /** The spec's trap: a canvas node must not imply the secret is recoverable. */
    it('never implies the webhook secret can be read back', () => {
      const rows = triggerParameters(webhookTrigger(), {
        backendId: 'backend_test',
        backendName: 'SQLite backend',
        endpoint: ENDPOINT
      });
      expect(rows.secret).toContain('Not recoverable');
      expect(String(rows.secret)).not.toContain('whsec_');
    });

    it('shows a schedule its gloss, next fire and payload', () => {
      const rows = triggerParameters(scheduleTrigger(), {
        backendId: 'backend_test',
        backendName: 'SQLite backend',
        endpoint: ENDPOINT
      });
      expect(rows.cron).toBe('0 3 * * *');
      expect(rows.when).toBe('at 03:00 daily');
      expect(rows.payload).toBe('{"mode":"nightly"}');
    });

    it('says a schedule with no payload sends an empty body, rather than saying nothing', () => {
      const bare = scheduleTrigger({ schedule: { cron: '0 3 * * *', missedFirePolicy: 'skip' } });
      const rows = triggerParameters(bare, { backendId: 'b', backendName: 'B', endpoint: ENDPOINT });
      expect(rows.payload).toContain('{}');
    });

    it('still gives a URL path when the backend is not running', () => {
      const rows = triggerParameters(webhookTrigger(), {
        backendId: 'backend_test',
        backendName: 'SQLite backend',
        endpoint: null
      });
      expect(String(rows.url)).toContain('/hooks/backend_test/orders');
    });
  });

  describe('the helpers the panel and the canvas share', () => {
    it('glosses the cron shapes people actually write', () => {
      expect(cronGloss('*/5 * * * *')).toBe('every 5 minutes');
      expect(cronGloss('* * * * *')).toBe('every minute');
      expect(cronGloss('0 3 * * *')).toBe('at 03:00 daily');
      expect(cronGloss('30 * * * *')).toBe('every hour, at 30 past');
      expect(cronGloss('@daily')).toBe('every day at midnight');
      expect(cronGloss('0 9 * * 1')).toBe('at 09:00 every Monday');
    });

    /** A wrong gloss is read as the truth about when this fires. */
    it('says nothing rather than guessing at an expression it does not recognise', () => {
      expect(cronGloss('0 0 1-5,10 */2 3')).toBeNull();
      expect(cronGloss('nonsense')).toBeNull();
    });

    it('builds the hook URL the sender is pointed at', () => {
      expect(webhookUrl('http://127.0.0.1:8578/', 'backend_test', 'orders')).toBe(
        'http://127.0.0.1:8578/hooks/backend_test/orders'
      );
    });

    it('resolves a target against what the backend has, per kind', () => {
      const targets = { functions: ['saveOrder'], workflows: [{ id: 'orderPipeline', name: 'Order Pipeline' }], known: true };
      expect(isTargetResolved({ kind: 'function', name: 'saveOrder' }, targets)).toBe(true);
      expect(isTargetResolved({ kind: 'function', name: 'orderPipeline' }, targets)).toBe(false);
      expect(isTargetResolved({ kind: 'workflow', name: 'orderPipeline' }, targets)).toBe(true);
    });

    /**
     * "We could not ask" must not be reported as "it is not there" — a wrong
     * warning about a working trigger is worse than no warning.
     */
    it('answers null when the backend could not be asked', () => {
      expect(isTargetResolved({ kind: 'function', name: 'saveOrder' }, { functions: [], workflows: [], known: false })).toBeNull();
    });
  });
});
