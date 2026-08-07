/**
 * A workflow's triggers, drawn as its entry nodes (WFA-005 §1).
 *
 * THE THING TO BE CLEAR ABOUT: a trigger is a BACKEND object, not part of the
 * workflow definition. `triggers.json` holds it, the running service writes
 * status back into that file between your read and your write, and one trigger
 * may point at a *function* and so belong to no canvas at all. Drawing them here
 * is a **view** — which is why:
 *
 *  - nothing about a trigger is written by `WorkflowDocument.toInput`, and a
 *    trigger node is not a step to `kindFromTypeName`;
 *  - the rows are read-only, and enabling / disabling / deleting are actions
 *    that name the backend they affect;
 *  - the nodes are added while the graph is being BUILT, before the document
 *    binds its listeners, so a workflow does not open dirty because it has a
 *    trigger.
 *
 * A workflow with no trigger still gets an entry marker — the `manual` node —
 * because "how does this start?" deserves a visible answer rather than being
 * answered by an absence.
 *
 * @module models/workflow/workflowTriggerNodes
 */

import { NodeGraphNode } from '@noodl-models/nodegraphmodel';

import { cronGloss, TriggerDef, webhookUrl } from '../triggers/TriggerBackendClient';
import { LAYOUT_COLUMN_WIDTH, LAYOUT_ROW_HEIGHT } from './workflowLayout';
import { isTriggerTypeName, PORT_FIRES, PORT_IN, triggerTypeFromTypeName, triggerTypeName } from './workflowNodeLibrary';

import type { WorkflowGraphModel } from './WorkflowGraphModel';

/** The id of the synthetic node drawn for a workflow that nothing triggers. */
export const MANUAL_TRIGGER_NODE_ID = '__manual__';

export function isTriggerNode(node: { typename?: string } | null | undefined): boolean {
  return Boolean(node?.typename && isTriggerTypeName(node.typename));
}

/** The trigger id a node stands for, or null for the manual marker. */
export function triggerIdOfNode(node: { id: string; typename?: string }): string | null {
  if (!isTriggerNode(node)) return null;
  return node.id === MANUAL_TRIGGER_NODE_ID ? null : node.id;
}

function fmt(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

/**
 * The card's second line.
 *
 * Enabled/disabled is on it because a disabled trigger that looks like an
 * enabled one is the failure this whole surface exists to prevent — the card
 * has to say it without being selected first.
 */
export function triggerSubLabel(trigger: TriggerDef | null): string {
  if (!trigger) return 'Manual · nothing triggers this';

  const parts: string[] = [];
  if (trigger.type === 'schedule' && trigger.schedule) {
    parts.push('Schedule', cronGloss(trigger.schedule.cron) || trigger.schedule.cron);
  } else if (trigger.type === 'webhook' && trigger.webhook) {
    parts.push('Webhook', `POST /${trigger.webhook.slug}`);
  } else if (trigger.type === 'db-change' && trigger.dbChange) {
    parts.push('DB change', trigger.dbChange.collection);
  } else {
    parts.push(trigger.type);
  }
  if (!trigger.enabled) parts.push('DISABLED');
  return parts.join(' · ');
}

/** The card's title. */
function triggerLabel(trigger: TriggerDef | null): string {
  if (!trigger) return 'Manual';
  if (trigger.name) return trigger.name;
  if (trigger.type === 'webhook' && trigger.webhook) return trigger.webhook.slug;
  if (trigger.type === 'db-change' && trigger.dbChange) return trigger.dbChange.collection;
  return trigger.type;
}

/**
 * The read-only values the property editor shows, as node parameters.
 *
 * Strings throughout, including `enabled`: these are rows to READ. The one that
 * matters most is `url`, which today is assembled by hand out of two panels and
 * is the single most-wanted string in this feature.
 */
export function triggerParameters(
  trigger: TriggerDef | null,
  ctx: { backendId: string; backendName: string; endpoint: string | null }
): Record<string, unknown> {
  if (!trigger) {
    return {};
  }

  const common: Record<string, unknown> = {
    enabled: trigger.enabled ? 'Yes' : 'No — this trigger will not fire',
    target: `${trigger.target.kind} ${trigger.target.name}`,
    lastFired: `${fmt(trigger.status.lastFiredAt)} (${trigger.status.fireCount} times)`,
    lastResult: trigger.status.lastResult
      ? trigger.status.lastResult.ok
        ? 'ok'
        : `failed — ${trigger.status.lastResult.error || 'see Execution History'}`
      : '—'
  };

  if (trigger.type === 'schedule' && trigger.schedule) {
    return {
      cron: trigger.schedule.cron,
      when: cronGloss(trigger.schedule.cron) || 'no plain-English reading of this expression',
      nextFire: fmt(trigger.status.nextFireAt),
      missedFires:
        trigger.schedule.missedFirePolicy === 'skip'
          ? 'skip — missed windows are ignored'
          : 'run once on start — one catch-up, never one per missed window',
      payload: trigger.schedule.payload
        ? JSON.stringify(trigger.schedule.payload)
        : 'none — the run body is {}',
      ...common
    };
  }

  if (trigger.type === 'webhook' && trigger.webhook) {
    return {
      url: ctx.endpoint
        ? webhookUrl(ctx.endpoint, ctx.backendId, trigger.webhook.slug)
        : `POST /hooks/${ctx.backendId}/${trigger.webhook.slug} (start the backend for the full URL)`,
      scheme:
        trigger.webhook.scheme === 'token'
          ? 'Shared token — X-Webhook-Token, Authorization: Bearer, or ?token='
          : 'HMAC-SHA256 — X-Hub-Signature-256, GitHub/Stripe style',
      // The spec's trap: a canvas node must not imply the secret is recoverable.
      secret: 'Shown once when the trigger was created. Not recoverable — create a new trigger to mint another.',
      ...common
    };
  }

  if (trigger.type === 'db-change' && trigger.dbChange) {
    return {
      collection: trigger.dbChange.collection,
      actions: trigger.dbChange.actions.join(', '),
      ...common
    };
  }

  return common;
}

export interface TriggerNodeContext {
  backendId: string;
  backendName: string;
  endpoint: string | null;
}

/**
 * Which of a backend's triggers belong on THIS workflow's canvas.
 *
 * Only a `workflow` target whose name is this definition's id. A
 * function-targeted trigger stays in the Triggers panel — a function is not a
 * workflow and has no entry node here (spec, Out of Scope).
 */
export function triggersForWorkflow(triggers: TriggerDef[], workflowId: string): TriggerDef[] {
  return triggers.filter((t) => t.target.kind === 'workflow' && t.target.name === workflowId);
}

/**
 * Add the entry nodes and wire each to the entry step.
 *
 * Called from `buildGraph`, i.e. before the document binds its listeners, so
 * none of this marks the workflow dirty. Positions are computed left of the
 * entry step and are NOT persisted: a trigger is not a step, so there is no
 * `ui` on it to save, and re-deriving the position is what keeps the picture
 * consistent when a trigger is added from the panel.
 */
export function addTriggerNodes(
  graph: WorkflowGraphModel,
  triggers: TriggerDef[],
  entryStepId: string | undefined,
  ctx: TriggerNodeContext
): void {
  const entryNode = entryStepId ? graph.findNodeWithId(entryStepId) : undefined;
  const anchor = entryNode ? { x: entryNode.x, y: entryNode.y } : { x: 80, y: 80 };

  // The manual marker is the answer to "how does this start?" when nothing
  // does. It is drawn for exactly the same reason the others are.
  const rows: (TriggerDef | null)[] = triggers.length ? triggers : [null];

  rows.forEach((trigger, i) => {
    const node = NodeGraphNode.fromJSON({
      // The trigger's own id, so a node maps back to a backend object with no
      // table — the same identity rule the steps follow.
      id: trigger ? trigger.id : MANUAL_TRIGGER_NODE_ID,
      type: triggerTypeName(trigger ? trigger.type : 'manual'),
      x: anchor.x - LAYOUT_COLUMN_WIDTH,
      y: anchor.y + i * LAYOUT_ROW_HEIGHT,
      label: triggerLabel(trigger),
      parameters: triggerParameters(trigger, ctx),
      metadata: {
        typeLabelOverride: triggerSubLabel(trigger),
        // The colour is `data` for its hue — a trigger is where the run's data
        // comes from — but "Data" is not what a trigger IS, and the sub-label
        // already says what it is.
        hideCategoryChip: true
      }
    });

    /**
     * `disableSelect` — a trigger node appearing is a REDRAW, not the user
     * creating a node (WFA-008, found live).
     *
     * `ModelBindings`' `nodeAdded` handler selects a newly added node unless
     * asked not to, and selecting switches the sidebar to the property editor.
     * The Triggers panel is a *transient* panel, so switching away unmounts it —
     * and with it the banner holding a webhook's **one-time, unrecoverable
     * secret**, the moment after it was created. Creating a trigger from the
     * panel bounced the user to Properties and destroyed the secret in the same
     * tick.
     */
    graph.addRoot(node, { disableSelect: true });

    // A manual marker has nothing to fire, so it is drawn unwired: the gap is
    // the point.
    if (trigger && entryStepId) {
      graph.addConnection({
        fromId: node.id,
        fromProperty: PORT_FIRES,
        toId: entryStepId,
        toProperty: PORT_IN,
        annotation: undefined
      });
    }
  });
}

/**
 * Refresh one trigger node in place — after an enable/disable or an edit.
 *
 * **Written through `setParameter`, not into `node.parameters`** (WFA-008 §4(i)).
 * The direct assignment notified nothing, so a trigger node that was *selected*
 * when its configuration changed kept its property rows painting the old cron —
 * the same staleness WFA-006's live pass found in its own `ref` row, where the
 * row showed the old name beside the new name's answer.
 *
 * Emitting the event is safe in both directions that matter, and both were
 * checked rather than assumed: `WorkflowDocument.bindNode` returns early for a
 * trigger node, so this cannot dirty the document; and `ViewerConnection`'s
 * `isWorkflowModelEvent` guard (F44) drops the global broadcast before it can
 * reach the viewer naming a component it has never heard of.
 */
export function refreshTriggerNode(
  graph: WorkflowGraphModel,
  trigger: TriggerDef,
  ctx: TriggerNodeContext
): void {
  const node = graph.findNodeWithId(trigger.id);
  if (!node || !isTriggerNode(node)) return;

  for (const [name, value] of Object.entries(triggerParameters(trigger, ctx))) {
    if (node.parameters[name] === value) continue;
    node.setParameter(name, value);
  }
  node.setLabel(triggerLabel(trigger));
  node.metadata = { ...(node.metadata || {}), typeLabelOverride: triggerSubLabel(trigger) };
}

/** True when this node type is one of the four entry-node types. */
export function triggerTypeOfNode(node: { typename?: string }): string | undefined {
  return node.typename ? triggerTypeFromTypeName(node.typename) : undefined;
}
