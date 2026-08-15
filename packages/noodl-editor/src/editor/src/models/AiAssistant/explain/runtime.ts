/**
 * FIX-001 §1a — Explain Mode: the runtime layer
 *
 * Assembly (./assemble) reads the *authored* graph: what the user typed into
 * each node. That is enough to answer "what is this graph for" and not enough to
 * answer *"why is the output value null?"* — the question that opened this task —
 * because the output value is not in the graph at all. It is in the running
 * preview.
 *
 * So this module describes a second, optional layer: what the runtime holds
 * **right now**, plus the warnings the editor is already showing. Three
 * properties keep it honest:
 *
 *  - **Pure, like assembly.** Nothing here opens a socket or reads a singleton.
 *    A {@link RuntimeSnapshot} is plain data produced by an editor-side adapter
 *    (`utils/provenance/explainRuntime`) and handed in, which is what lets the
 *    specs render a runtime layer with no preview, no editor and no network.
 *  - **Absent means absent.** No snapshot renders no Runtime section, and the
 *    prompt then has nothing to distinguish — that is the pre-FIX-001 behaviour,
 *    unchanged, and it is what the MCP and headless callers still get.
 *  - **A value is never inferred.** An authored parameter and a current value
 *    are different facts about different things, and the render marks which is
 *    which on every line. A model that blurs them produces exactly the confident
 *    wrong answer this task exists to remove.
 *
 * @module AiAssistant/explain/runtime
 */

import { enrichedNode } from '../../../validation/enrichedCatalog';
import type { ExplainContext, GraphComponent, GraphNode } from './types';

export type RuntimeDirection = 'input' | 'output';

/** A port, addressed the way the runtime wants it (`getPortValues`, OBS-002 layer 1). */
export interface RuntimePortRef {
  node: string;
  port: string;
  direction: RuntimeDirection;
}

/** A port the runtime answered for. `value` is already a preview string. */
export interface RuntimePortValue extends RuntimePortRef {
  value: string;
  /** Set when {@link MAX_RUNTIME_VALUE_CHARS} cut the value short. */
  truncated?: boolean;
}

/** An editor warning, in the shape `WarningsModel` reports it. */
export interface RuntimeDiagnosis {
  nodeId: string;
  message: string;
}

/**
 * What the editor could learn about the running app at one instant.
 *
 * A **snapshot per turn**, not a subscription: values move, and an explanation
 * that silently referred to a value from four questions ago would be worse than
 * one with no values at all. Each turn re-reads and says so.
 */
export interface RuntimeSnapshot {
  /** False when no preview is running — `values` is then empty by construction. */
  isPreviewRunning: boolean;
  values: readonly RuntimePortValue[];
  /**
   * Nodes the runtime answered for at all.
   *
   * Not the same as "the preview is running": a node in a component that is not
   * currently mounted is absent from a perfectly healthy preview, and telling
   * the model *that* is the difference between an empty read-out and a wrong
   * one. Same distinction the Ports tab draws (`PortsTab/portValues`).
   */
  liveNodeIds: readonly string[];
  /** Editor warnings for this component. Available with **no** preview at all. */
  diagnoses: readonly RuntimeDiagnosis[];
  /**
   * Set when the read itself failed — the preview did not answer, or the socket
   * is gone. Rendered as "could not read", never as "not running": those are
   * different states and only one of them is the user's fault.
   */
  error?: string;
}

/**
 * How much of one value the model is shown.
 *
 * A port can hold a whole fetched record. This is deliberately shorter than
 * assembly's parameter cap: an authored parameter is the thing being explained,
 * a runtime value is evidence about it, and twenty of them arrive at once.
 *
 * ⚠️ There is **no redaction story** here — a port holding a token renders it.
 * Flagged in FIX-001's open questions; assembly has the same gap for authored
 * parameters today, so this adds no new class of exposure.
 */
export const MAX_RUNTIME_VALUE_CHARS = 200;

/** Caps on the request itself, so one explanation is one bounded round trip. */
export interface RuntimePortsOptions {
  /** Hard cap on ports asked for across the whole context. */
  maxPorts?: number;
  /** Hard cap per node, so one `Group` cannot spend the whole request. */
  maxPortsPerNode?: number;
}

const DEFAULT_PORT_LIMITS: Required<RuntimePortsOptions> = { maxPorts: 200, maxPortsPerNode: 40 };

export const EMPTY_RUNTIME: RuntimeSnapshot = {
  isPreviewRunning: false,
  values: [],
  liveNodeIds: [],
  diagnoses: []
};

// ── Which ports are worth asking about ────────────────────────────────────────

function refKey(ref: RuntimePortRef): string {
  return ref.node + '|' + ref.port + '|' + ref.direction;
}

/** Catalog ports for a type, as name → isSignal, per direction. */
function catalogPorts(type: string): { inputs: Map<string, boolean>; outputs: Map<string, boolean> } {
  const inputs = new Map<string, boolean>();
  const outputs = new Map<string, boolean>();
  const node = enrichedNode(type);
  for (const port of node?.inputs ?? []) inputs.set(port.name, !!port.isSignal);
  for (const port of node?.outputs ?? []) outputs.set(port.name, !!port.isSignal);
  return { inputs, outputs };
}

/**
 * Ports serialised on the instance, split by direction.
 *
 * A component instance has no catalog entry at all, so this is the *only* source
 * for its ports — and `plug` is the field that says which way one points
 * (LAS-001; see `GraphNode.ports`). A port with neither plug is skipped rather
 * than guessed at: asking the runtime for a port in the wrong direction returns
 * `exists: false`, which reads as "the node is not mounted" and is a lie.
 */
function instancePortsByDirection(node: GraphNode): { inputs: Set<string>; outputs: Set<string> } {
  const inputs = new Set<string>();
  const outputs = new Set<string>();
  for (const port of node.ports ?? []) {
    if (typeof port.plug !== 'string') continue;
    if (port.plug.includes('input')) inputs.add(port.name);
    if (port.plug.includes('output')) outputs.add(port.name);
  }
  return { inputs, outputs };
}

/**
 * The ports one explanation needs current values for.
 *
 * Not "every port of every included node": a context can hold sixty nodes and a
 * single `Group` declares over eighty ports, so that request would be thousands
 * of refs for a question about one output. The rule instead follows what a
 * reader can actually ask about:
 *
 *  - **On a selected node, every output** — "why is the output null" is a
 *    question about an output, and outputs carry no authored value, so the
 *    runtime is the only place they exist at all.
 *  - **On a selected node, inputs that are fed or authored** — an input nobody
 *    set behaves by the node's own default, which never passes through this
 *    channel (see `foldPortValues`), so asking about it buys nothing.
 *  - **On every other node, only the ports on a wire in this context** — those
 *    are the hops a data-flow answer walks.
 *
 * Signals are excluded throughout: a signal carries no value, and reading one
 * reports the internal sender.
 *
 * Selected nodes are emitted first so that if the cap bites, what survives is
 * what the question was about.
 */
export function portsToResolve(
  component: GraphComponent,
  context: ExplainContext,
  options: RuntimePortsOptions = {}
): RuntimePortRef[] {
  const limits = { ...DEFAULT_PORT_LIMITS, ...options };
  const includedIds = new Set(context.nodes.map((n) => n.id));
  const selectedIds = new Set(context.selectedIds);

  // Ports on a wire, from the connections *in this context* — a connection that
  // was cut at the context boundary is not a hop this answer can walk.
  const wired = new Map<string, Set<string>>();
  const wire = (nodeId: string, port: string, direction: RuntimeDirection) => {
    let set = wired.get(nodeId);
    if (!set) wired.set(nodeId, (set = new Set()));
    set.add(direction + '|' + port);
  };
  for (const connection of context.connections) {
    // A signal wire has no value at either end.
    if (connection.isSignal) continue;
    wire(connection.fromId, connection.fromProperty, 'output');
    wire(connection.toId, connection.toProperty, 'input');
  }

  // Authored parameters, which are inputs by definition. Read off the context
  // rather than the graph node so the empty-and-default filtering assembly
  // already did is not repeated here (and cannot drift from it).
  const authored = new Map<string, Set<string>>();
  for (const node of context.nodes) {
    if (!node.parameters.length) continue;
    authored.set(node.id, new Set(node.parameters.map((p) => p.name)));
  }

  const refs: RuntimePortRef[] = [];
  const seen = new Set<string>();

  const collect = (node: GraphNode): void => {
    if (refs.length >= limits.maxPorts) return;

    const catalog = catalogPorts(node.type);
    const instance = instancePortsByDirection(node);
    const onWire = wired.get(node.id) ?? new Set<string>();
    const params = authored.get(node.id) ?? new Set<string>();
    const isSelected = selectedIds.has(node.id);

    const wanted: RuntimePortRef[] = [];
    const want = (port: string, direction: RuntimeDirection) => {
      const signal = direction === 'output' ? catalog.outputs.get(port) : catalog.inputs.get(port);
      if (signal) return;
      wanted.push({ node: node.id, port, direction });
    };

    if (isSelected) {
      // Every output, catalog-declared and instance-declared alike.
      for (const [port, signal] of catalog.outputs) if (!signal) want(port, 'output');
      for (const port of instance.outputs) want(port, 'output');
      // Inputs only where there is something to see.
      for (const port of params) want(port, 'input');
      for (const key of onWire) {
        const [direction, port] = key.split('|') as [RuntimeDirection, string];
        want(port, direction);
      }
    } else {
      for (const key of onWire) {
        const [direction, port] = key.split('|') as [RuntimeDirection, string];
        want(port, direction);
      }
    }

    let takenHere = 0;
    for (const ref of wanted) {
      if (refs.length >= limits.maxPorts || takenHere >= limits.maxPortsPerNode) break;
      const key = refKey(ref);
      if (seen.has(key)) continue;
      seen.add(key);
      refs.push(ref);
      takenHere++;
    }
  };

  const byId = new Map(component.nodes.map((n) => [n.id, n]));
  for (const id of context.selectedIds) {
    const node = byId.get(id);
    if (node) collect(node);
  }
  for (const node of component.nodes) {
    if (!includedIds.has(node.id) || selectedIds.has(node.id)) continue;
    collect(node);
  }

  return refs;
}

// ── Reading a snapshot ────────────────────────────────────────────────────────

/** Index a snapshot for lookup while rendering. */
export function runtimeIndex(snapshot: RuntimeSnapshot): Map<string, RuntimePortValue> {
  const map = new Map<string, RuntimePortValue>();
  for (const value of snapshot.values) map.set(refKey(value), value);
  return map;
}

/** Cut a value to {@link MAX_RUNTIME_VALUE_CHARS}, marking it when the cap bites. */
export function truncateRuntimeValue(value: string): { value: string; truncated?: boolean } {
  if (value.length <= MAX_RUNTIME_VALUE_CHARS) return { value };
  return { value: value.slice(0, MAX_RUNTIME_VALUE_CHARS) + '…', truncated: true };
}

function renderValue(entry: RuntimePortValue): string {
  return entry.truncated ? `${entry.value} (cut short)` : entry.value;
}

/**
 * The `## Runtime` section: current values, what is not mounted, and the
 * editor's warnings.
 *
 * The no-preview case is not an empty section, and that is the point of
 * acceptance criterion 2. A model given a context that simply *stops* after the
 * node types has no way to know whether the values were unavailable or merely
 * all null, and will happily answer as though it had seen them. Saying "there
 * are none, and here is why" is what turns a hallucinated value into "start the
 * preview and ask me again".
 */
export function renderRuntime(context: ExplainContext, snapshot: RuntimeSnapshot): string {
  const lines: string[] = ['## Runtime'];

  if (snapshot.error) {
    lines.push(
      `The editor tried to read the running app and could not: ${snapshot.error}.`,
      `You do not know any current value. Do not guess one from the authored parameters above.`
    );
  } else if (!snapshot.isPreviewRunning) {
    lines.push(
      `No preview is running, so there are no current values to see. Everything above is the`,
      `authored graph — what the user typed, not what the app holds.`,
      `If the question is about a value the app has *now*, say plainly that you cannot see it`,
      `while nothing is running, and answer what the graph alone can support.`
    );
  } else {
    const index = snapshot.values;
    if (index.length === 0) {
      lines.push(`The preview is running, but it answered for none of the ports in this context.`);
    } else {
      lines.push(
        `The preview is running. These are the values it holds **right now**, read just before`,
        `this message. They are current values, not authored ones, and they change as the app runs.`,
        ''
      );
      for (const entry of index) {
        lines.push(`- \`${entry.node}\`.${entry.port} (${entry.direction}) = ${renderValue(entry)}`);
      }
    }

    // A node the runtime never heard of is not a node with no values — it is a
    // node that is not on screen, which is frequently the whole answer.
    const live = new Set(snapshot.liveNodeIds);
    const absent = context.nodes.filter((n) => !live.has(n.id)).map((n) => n.id);
    if (absent.length) {
      // One line, ids and all: a reader (and a spec) has to be able to see which node the claim
      // is about without reassembling a sentence that was wrapped for tidiness.
      lines.push(
        '',
        `Not mounted in the running app right now, so they hold no values — a fact about the app's ` +
          `current state, not a fault: ${absent.map((id) => `\`${id}\``).join(', ')}.`
      );
    }
  }

  // Only warnings on nodes the model can see. A warning citing an id that is
  // nowhere else in the context invites a citation the panel cannot resolve, and
  // `stripUnresolvedCitations` would then quietly demote it to plain text.
  const visible = new Set(context.nodes.map((n) => n.id));
  const diagnoses = snapshot.diagnoses.filter((d) => visible.has(d.nodeId));
  if (diagnoses.length) {
    lines.push(
      '',
      `### Warnings the editor is showing`,
      `These come from the editor itself and are true whether or not a preview is running.`,
      ''
    );
    for (const diagnosis of diagnoses) {
      lines.push(`- \`${diagnosis.nodeId}\`: ${diagnosis.message}`);
    }
  }

  return lines.join('\n');
}
