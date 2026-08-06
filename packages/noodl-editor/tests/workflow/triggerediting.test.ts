/**
 * WFA-008 — editing a trigger, from the editor's side.
 *
 * The backend specs (`nodegx-backend/tests/triggers-edit.test.ts`) prove the
 * property the feature exists for: after an edit, the secret a sender already
 * holds still authenticates. These specs protect the two things the EDITOR is
 * responsible for, and both of them are about what is NOT sent:
 *
 *  - `buildTriggerInput` builds an input rather than spreading the form, because
 *    the registry checks the caller's keys before anything is copied (F8) — so a
 *    spread form would earn a 400 naming a key the user never typed — and
 *    because `enabled` and `secret` must be absent: absent `enabled` means "keep
 *    what is stored", and a sent `secret` REPLACES it.
 *  - the entry nodes on an open canvas are a view of these objects, so an edit
 *    made on another surface has to reach them — including the case that only
 *    editing creates, where a **re-targeted** trigger stops belonging to the open
 *    workflow at all.
 *
 * Jasmine, not Jest — the editor's suite runs in a real Electron renderer.
 */

import { WorkflowDocument } from '../../src/editor/src/models/workflow/WorkflowDocument';
import {
  buildTriggerInput,
  describeTriggerChange,
  EMPTY_FORM,
  formStateFromDef,
  OTHER,
  targetNameOf,
  triggerLabelOf
} from '../../src/editor/src/models/triggers/triggerEditing';
import { refreshTriggerNode, triggerSubLabel } from '../../src/editor/src/models/workflow/workflowTriggerNodes';

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
  stepCount: 2
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
    steps: [{ id: 'start', name: 'Hold', kind: 'wait', params: { duration: 1 } }],
    createdAt: '2026-07-28T00:00:00.000Z',
    updatedAt: '2026-07-28T00:00:00.000Z'
  };
}

const status = () => ({ lastFiredAt: null, nextFireAt: null, lastResult: null, fireCount: 0 });

function webhookDef(overrides: Partial<TriggerDef> = {}): TriggerDef {
  return {
    id: 'trg_hook',
    type: 'webhook',
    name: 'Order received',
    enabled: true,
    target: { kind: 'workflow', name: 'orderPipeline' },
    webhook: { slug: 'orders', scheme: 'token', maxBodyBytes: 1048576 },
    createdAt: '2026-07-28T00:00:00.000Z',
    updatedAt: '2026-07-28T01:00:00.000Z',
    status: status(),
    ...overrides
  } as TriggerDef;
}

function scheduleDef(overrides: Partial<TriggerDef> = {}): TriggerDef {
  return {
    id: 'trg_cron',
    type: 'schedule',
    name: 'Nightly',
    enabled: true,
    target: { kind: 'workflow', name: 'orderPipeline' },
    schedule: { cron: '0 3 * * *', missedFirePolicy: 'skip', payload: { mode: 'nightly' } },
    createdAt: '2026-07-28T00:00:00.000Z',
    updatedAt: '2026-07-28T01:00:00.000Z',
    status: status(),
    ...overrides
  } as TriggerDef;
}

const CTX = { backendId: 'backend_test', backendName: 'SQLite backend', endpoint: 'http://127.0.0.1:8578' };

describe('WFA-008 — the edit form', () => {
  describe('filling it from a stored definition', () => {
    it('round-trips a webhook', () => {
      const form = formStateFromDef(webhookDef());
      expect(form.type).toBe('webhook');
      expect(form.slug).toBe('orders');
      expect(form.scheme).toBe('token');
      expect(form.targetKind).toBe('workflow');
      expect(targetNameOf(form)).toBe('orderPipeline');
    });

    it('round-trips a schedule, including its payload as JSON text', () => {
      const form = formStateFromDef(scheduleDef());
      expect(form.cron).toBe('0 3 * * *');
      expect(form.missedPolicy).toBe('skip');
      expect(JSON.parse(form.payloadText)).toEqual({ mode: 'nightly' });
    });

    /**
     * A function that is not deployed yet is a legitimate target (WFA-005), so
     * the stored name has to survive even when the picker cannot offer it — which
     * is why it is written into both halves of the control.
     */
    it('keeps a target name the backend may not have in the typed half too', () => {
      const form = formStateFromDef(webhookDef({ target: { kind: 'function', name: 'notDeployedYet' } }));
      expect(form.targetTyped).toBe('notDeployedYet');
      expect(targetNameOf({ ...form, targetPick: OTHER })).toBe('notDeployedYet');
    });

    it('a db-change definition fills the action checkboxes from what is stored', () => {
      const form = formStateFromDef(
        webhookDef({ type: 'db-change', webhook: undefined, dbChange: { collection: 'Orders', actions: ['update', 'delete'] } })
      );
      expect(form.collection).toBe('Orders');
      expect(form.actions).toEqual({ create: false, update: true, delete: true });
    });
  });

  describe('what the form sends — and does not', () => {
    /**
     * The heart of the task. `upsert` keeps a webhook's stored secret unless the
     * caller sends one, and it keeps the stored `enabled` unless the caller sends
     * that; both are therefore ABSENT, not false and not undefined-valued keys
     * (an explicit `undefined` would still be a key the strict input validator
     * sees).
     */
    it('never carries `secret` or `enabled`', () => {
      const built = buildTriggerInput(formStateFromDef(webhookDef()));
      if ('error' in built) throw new Error(built.error);
      expect('secret' in built.input).toBe(false);
      expect('enabled' in built.input).toBe(false);
      expect('id' in built.input).toBe(false);
    });

    /** Built, not spread: only the chosen type's block goes out (F8's rule). */
    it('sends only the chosen type`s config block', () => {
      const webhook = buildTriggerInput(formStateFromDef(webhookDef()));
      if ('error' in webhook) throw new Error(webhook.error);
      expect(webhook.input.webhook).toEqual({ slug: 'orders', scheme: 'token' });
      expect('schedule' in webhook.input).toBe(false);
      expect('dbChange' in webhook.input).toBe(false);

      const schedule = buildTriggerInput(formStateFromDef(scheduleDef()));
      if ('error' in schedule) throw new Error(schedule.error);
      expect('webhook' in schedule.input).toBe(false);
      expect(schedule.input.schedule.cron).toBe('0 3 * * *');
    });

    /**
     * The block is rebuilt from the input on every write, so `maxBodyBytes` is
     * NOT sent and the registry re-applies its default. Asserted because the
     * alternative — passing the stored value through — reads as harmless and
     * would make this form the place a body limit silently resets if the default
     * ever changed.
     */
    it('does not send maxBodyBytes, which the registry owns', () => {
      const built = buildTriggerInput(formStateFromDef(webhookDef()));
      if ('error' in built) throw new Error(built.error);
      expect('maxBodyBytes' in built.input.webhook).toBe(false);
    });

    it('omits an empty payload rather than sending {}', () => {
      const built = buildTriggerInput(formStateFromDef(scheduleDef({ schedule: { cron: '0 3 * * *', missedFirePolicy: 'skip' } })));
      if ('error' in built) throw new Error(built.error);
      expect('payload' in built.input.schedule).toBe(false);
    });

    it('reports a malformed payload against the payload field, not as a type error', () => {
      const built = buildTriggerInput({ ...EMPTY_FORM, targetTyped: 'f', payloadText: '{nope' });
      expect('error' in built && built.error).toMatch(/payload is not valid JSON/);
    });

    it('refuses a payload that is not an object, because it is delivered as the body', () => {
      const built = buildTriggerInput({ ...EMPTY_FORM, targetTyped: 'f', payloadText: '[1,2]' });
      expect('error' in built && built.error).toMatch(/must be a JSON object/);
    });

    it('refuses an empty target rather than posting one', () => {
      const built = buildTriggerInput({ ...EMPTY_FORM, targetTyped: '   ' });
      expect('error' in built && built.error).toMatch(/target function is required/);
    });

    /**
     * CWF-002. `async` is the ABSENCE of the key, not the string "async": a form
     * that always sent it would write a default into every triggers.json and
     * make an unchanged setting read as a decision on every diff.
     */
    it('sends responseMode only when it is sync AND the target is a workflow', () => {
      const workflowSync = buildTriggerInput({
        ...EMPTY_FORM,
        type: 'webhook',
        targetKind: 'workflow',
        targetTyped: 'quote',
        slug: 'quote',
        responseMode: 'sync'
      });
      if ('error' in workflowSync) throw new Error(workflowSync.error);
      expect(workflowSync.input.responseMode).toBe('sync');

      // Async is silence.
      const workflowAsync = buildTriggerInput({
        ...EMPTY_FORM,
        type: 'webhook',
        targetKind: 'workflow',
        targetTyped: 'quote',
        slug: 'quote'
      });
      if ('error' in workflowAsync) throw new Error(workflowAsync.error);
      expect('responseMode' in workflowAsync.input).toBe(false);

      // A function target already relays its own response, and the registry
      // refuses `sync` there — so the form must not send a 400.
      const fnSync = buildTriggerInput({
        ...EMPTY_FORM,
        type: 'webhook',
        targetKind: 'function',
        targetTyped: 'hello',
        slug: 'hello',
        responseMode: 'sync'
      });
      if ('error' in fnSync) throw new Error(fnSync.error);
      expect('responseMode' in fnSync.input).toBe(false);
    });

    it('reports a bad response timeout against its own field', () => {
      const built = buildTriggerInput({
        ...EMPTY_FORM,
        type: 'webhook',
        targetKind: 'workflow',
        targetTyped: 'quote',
        slug: 'quote',
        responseMode: 'sync',
        responseTimeoutText: '999999'
      });
      expect('error' in built && built.error).toMatch(/response timeout/);
    });

    it('trims what it sends', () => {
      const built = buildTriggerInput({ ...EMPTY_FORM, type: 'webhook', targetTyped: ' fn ', slug: ' hook ' });
      if ('error' in built) throw new Error(built.error);
      expect(built.input.target.name).toBe('fn');
      expect(built.input.webhook.slug).toBe('hook');
    });
  });

  describe('what changed under the form', () => {
    it('names a disable in words rather than reporting that something changed', () => {
      const before = webhookDef();
      const after = webhookDef({ enabled: false, updatedAt: '2026-07-28T02:00:00.000Z' });
      expect(describeTriggerChange(before, after)).toEqual(['it was disabled']);
    });

    it('names a retarget, a cron and a slug', () => {
      expect(describeTriggerChange(scheduleDef(), scheduleDef({ target: { kind: 'function', name: 'other' } }))[0]).toMatch(
        /now runs the function “other”/
      );
      expect(
        describeTriggerChange(scheduleDef(), scheduleDef({ schedule: { cron: '5 * * * *', missedFirePolicy: 'skip' } }))
      ).toContain('its cron is now “5 * * * *”');
      expect(
        describeTriggerChange(
          webhookDef(),
          webhookDef({ webhook: { slug: 'moved', scheme: 'token', maxBodyBytes: 1048576 } })
        )
      ).toContain('its URL slug is now “moved”');
    });

    /**
     * A rotation moves `updatedAt` and changes nothing in the definition, so a
     * diff that reported "nothing changed" would be denying what the timestamp
     * plainly says.
     */
    it('says something happened when the definition is identical', () => {
      const changes = describeTriggerChange(webhookDef(), webhookDef({ updatedAt: '2026-07-28T03:00:00.000Z' }));
      expect(changes.length).toBe(1);
      expect(changes[0]).toMatch(/secret may have been rotated/);
    });

    /** Status moves on its own. Reporting it would make every save look contested. */
    it('does not report a fire as a change', () => {
      const fired = webhookDef({ status: { lastFiredAt: '2026-07-28T04:00:00.000Z', nextFireAt: null, lastResult: { ok: true, at: 'x' }, fireCount: 9 } });
      expect(describeTriggerChange(webhookDef(), fired)[0]).toMatch(/secret may have been rotated/);
    });

    it('names a trigger the way a sentence about it needs to', () => {
      expect(triggerLabelOf(webhookDef())).toBe('Order received');
      expect(triggerLabelOf(webhookDef({ name: undefined }))).toBe('orders');
    });
  });

  describe('an edited trigger on an open canvas', () => {
    it('repaints the card from the new definition', () => {
      const doc = WorkflowDocument.fromDefinition(REF, definition(), CATALOG, {
        triggers: [scheduleDef()],
        endpoint: CTX.endpoint
      });

      refreshTriggerNode(doc.graph, scheduleDef({ schedule: { cron: '*/5 * * * *', missedFirePolicy: 'skip' } }), CTX);

      const node = doc.graph.findNodeWithId('trg_cron');
      expect(node.parameters.cron).toBe('*/5 * * * *');
      expect(node.metadata.typeLabelOverride).toBe(triggerSubLabel(scheduleDef({ schedule: { cron: '*/5 * * * *', missedFirePolicy: 'skip' } })));
    });

    /**
     * The parameter is written through `setParameter` so the property editor's
     * row has an event to re-render on (§4(i)) — and that event must NOT reach
     * the document's dirty tracking, because a backend object changing is not an
     * unsaved edit to the definition.
     */
    it('notifies the parameter change without dirtying the workflow', () => {
      const doc = WorkflowDocument.fromDefinition(REF, definition(), CATALOG, {
        triggers: [scheduleDef()],
        endpoint: CTX.endpoint
      });
      const node = doc.graph.findNodeWithId('trg_cron');

      let notified = 0;
      node.on('parametersChanged', () => {
        notified++;
      }, {});

      refreshTriggerNode(doc.graph, scheduleDef({ schedule: { cron: '*/5 * * * *', missedFirePolicy: 'skip' } }), CTX);

      expect(notified).toBeGreaterThan(0);
      expect(doc.isDirty).toBe(false);
    });

    it('does not notify for a value that did not change', () => {
      const doc = WorkflowDocument.fromDefinition(REF, definition(), CATALOG, {
        triggers: [scheduleDef()],
        endpoint: CTX.endpoint
      });
      const node = doc.graph.findNodeWithId('trg_cron');
      let notified = 0;
      node.on('parametersChanged', () => {
        notified++;
      }, {});

      refreshTriggerNode(doc.graph, scheduleDef(), CTX);

      expect(notified).toBe(0);
    });

    /**
     * The case that only editing can produce, and the one the walker audit went
     * looking for: a trigger re-targeted at ANOTHER workflow no longer belongs on
     * this canvas. The node has to go, the definition must not change, and the
     * document must not be dirty — nothing about the workflow was edited.
     */
    it('drops the entry node when the trigger is re-targeted away, leaving the definition alone', () => {
      const doc = WorkflowDocument.fromDefinition(REF, definition(), CATALOG, {
        triggers: [webhookDef()],
        endpoint: CTX.endpoint
      });
      expect(doc.graph.findNodeWithId('trg_hook')).toBeDefined();

      // What `refreshTriggers` does with the answer, without the IPC: this
      // workflow's set is now empty, so the nodes are rebuilt.
      doc.triggers = [];
      (doc as unknown as { rebuildTriggerNodes: () => void }).rebuildTriggerNodes();

      expect(doc.graph.findNodeWithId('trg_hook')).toBeFalsy();
      expect(doc.graph.connections.some((c) => c.fromId === 'trg_hook')).toBe(false);
      expect(doc.isDirty).toBe(false);
      expect(doc.toInput().steps.length).toBe(1);
      expect(JSON.stringify(doc.toInput())).not.toContain('trg_hook');
    });

    /**
     * Found live, and it destroyed a secret.
     *
     * `ModelBindings`' `nodeAdded` handler selects a newly added node unless told
     * not to, and selecting switches the sidebar to the property editor. The
     * Triggers panel is *transient*, so switching away unmounts it — taking the
     * banner holding the webhook's one-time, unrecoverable secret with it, one
     * tick after it was created. A trigger node appearing is a redraw of a view,
     * never the user creating a node, so it never claims the selection.
     */
    it('adds trigger nodes without claiming the selection', () => {
      const doc = WorkflowDocument.fromDefinition(REF, definition(), CATALOG, {
        triggers: [webhookDef()],
        endpoint: CTX.endpoint
      });

      const seen: { id: string; disableSelect: unknown }[] = [];
      doc.graph.on(
        'nodeAdded',
        (args: { model: { id: string }; disableSelect?: boolean }) => {
          seen.push({ id: args.model.id, disableSelect: args.disableSelect });
        },
        {}
      );

      doc.triggers = [webhookDef(), scheduleDef()];
      (doc as unknown as { rebuildTriggerNodes: () => void }).rebuildTriggerNodes();

      expect(seen.length).toBe(2);
      expect(seen.every((s) => s.disableSelect === true)).toBe(true);
    });

    it('draws the manual marker once the last trigger stops belonging here', () => {
      const doc = WorkflowDocument.fromDefinition(REF, definition(), CATALOG, {
        triggers: [webhookDef()],
        endpoint: CTX.endpoint
      });
      doc.triggers = [];
      (doc as unknown as { rebuildTriggerNodes: () => void }).rebuildTriggerNodes();

      // A block body, not an expression: `forEachNode`'s callback returning a
      // truthy value is an early exit, and `Array.push` returns a length.
      const ids: string[] = [];
      doc.graph.forEachNode((n) => {
        ids.push(n.id);
      });
      expect(ids).toContain('__manual__');
    });
  });
});
