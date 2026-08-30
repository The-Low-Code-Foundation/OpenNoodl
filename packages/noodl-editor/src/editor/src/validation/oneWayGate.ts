/**
 * DEF-024 (P78 D36) — a `mounted`/`visible` gate that can only ever turn ON, decidable from the
 * graph alone.
 *
 * The register's sentence was *"a `Condition` can only ever turn a gate ON"*, and the node is
 * more honest than that: `result` pushes `false` whenever a test finds false. What can only turn
 * a gate on is the AUTHORED shape every gate in the members' template used — a constant-`true`
 * condition whose only trigger is `Evaluate`. Such a Condition tests true on every pulse, so the
 * `mounted` it feeds can only ever receive `true`, and the element it gates can be shown but
 * never put away again within a page life. Two sibling answers built that way both stay up —
 * *"we will email you"* directly above *"we will not email you"* — and the person cannot tell
 * which one won (`def024-gate-drive.test.ts`, driven in real Chrome at HEAD: tick then untick
 * leaves both notices in the document).
 *
 * The drive's control arm is the reason this rule can point at a repair: the product already
 * ships the two-way shape. A `Switch` (the same Logic category) takes `On`/`Off` signals and
 * pushes `Current State` on every change, so one Switch per answer — `state → mounted`, each
 * path switching the others off — shows exactly one answer at a time, with fewer nodes than the
 * paired-Condition workaround. The workaround (a constant-`false` Condition on the same port,
 * fired by the path that should hide it) is also silent here by construction: it makes the
 * port's pushable set `{true, false}`.
 *
 * ## The predicate, and why each abstention abstains
 *
 * For a `mounted`/`visible` input on a statically-typed visual node, collect every wire into it.
 * The rule fires only when EVERY writer is a `Condition` value output (`result`/`isfalse`) whose
 * `condition` input is unwired — a constant — and the union of values those writers can push is
 * exactly `{true}`:
 *
 *  - any non-Condition writer (a Switch's state, a component output, a Variable) can push either
 *    value → abstain;
 *  - a Condition whose `condition` is WIRED re-tests on change and pushes both ways → abstain;
 *  - a constant Condition with no `Evaluate` wire can never fire, so it contributes nothing to
 *    the pushable set (a port whose writers can push nothing at all is a dead gate — a different
 *    absence, not claimed here);
 *  - a pushable set of `{false}` is a one-way DISMISS — it ends in the emptier screen, does not
 *    accumulate contradictions, and the corpus carries deliberate instances → not fired on, by
 *    decision (the calibration script prints them so the decision has numbers beside it).
 *
 * ## Honest limits
 *
 * A component-instance target is skipped: whether the referenced component is visual — whether
 * `mounted` exists on it at all — is not in this graph. An unknown node type is skipped
 * (`unknown-type-check-skipped` owns those). And the rule reads one component: a gate cleared
 * from outside through a Component Input is invisible to it, which is the quiet direction —
 * such a port has a non-Condition writer inside the component and abstains anyway.
 *
 * ## Severity
 *
 * A **warning**, deliberately not in `AUTHORED_BLOCKING_WARNINGS` on first ship — the layout
 * pair's argument: promotion is earned on corpus evidence of firing correctly against authored
 * output (`npm run calibrate:gates`), and a reveal-once latch is expressible on purpose. The
 * non-promotion is pinned in the spec so a later edit cannot promote silently.
 *
 * Pure: the caller supplies nodes, a catalog, and the component's wires.
 *
 * @module noodl-editor/validation/oneWayGate
 */

import type { CatalogIndex } from './CatalogIndex';
import { DiagnosticCode, type Diagnostic } from './diagnostics';
import type { FunctionWireLike } from './functionPorts';
import { isComponentRef } from './model';
import type { ParameterizedNode } from './parameterValues';

/** The two ports through which conditional UI exists or holds space. */
const GATE_PORTS = ['mounted', 'visible'] as const;

/** The Condition node's two value outputs — the only outputs this rule reasons about. */
const CONDITION_VALUE_OUTPUTS = new Set(['result', 'isfalse']);

export interface CheckOneWayGateOptions {
  /** Component identifier for the diagnostics' location. */
  component: string;
  /** Read for `isVisual` — whether the target node has a gate port at all. */
  catalog: CatalogIndex;
  /** Every connection in the component; the rule reads writers and the Conditions' own inputs. */
  wires?: readonly FunctionWireLike[];
}

/**
 * What one writer can ever push into the gate port, or `null` for "not a constant Condition —
 * abstain from the whole port".
 */
function pushableValues(
  wire: FunctionWireLike,
  byId: Map<string, ParameterizedNode>,
  wires: readonly FunctionWireLike[]
): Set<boolean> | null {
  const source = byId.get(wire.fromId);
  if (!source || source.type !== 'Condition') return null;
  if (!CONDITION_VALUE_OUTPUTS.has(wire.fromProperty)) return null;
  // A wired condition re-tests on change and pushes both ways.
  if (wires.some((w) => w.toId === source.id && w.toProperty === 'condition')) return null;
  // A constant Condition with nothing to trigger it never evaluates and never pushes.
  if (!wires.some((w) => w.toId === source.id && w.toProperty === 'eval')) return new Set();
  const condition = !!(source.parameters ?? {})['condition'];
  return new Set([wire.fromProperty === 'result' ? condition : !condition]);
}

/**
 * DEF-024 — a gate whose every writer can only ever push `true`, so the element it mounts can
 * never be put away again.
 */
export function checkOneWayGate(nodes: readonly ParameterizedNode[], options: CheckOneWayGateOptions): Diagnostic[] {
  const { component, catalog, wires } = options;
  if (!wires || wires.length === 0) return [];
  const diagnostics: Diagnostic[] = [];
  const byId = new Map<string, ParameterizedNode>(nodes.map((n) => [n.id, n]));

  for (const node of nodes) {
    if (isComponentRef(node.type)) continue;
    if (!catalog.getNode(node.type)?.isVisual) continue;

    for (const port of GATE_PORTS) {
      const writers = wires.filter((w) => w.toId === node.id && w.toProperty === port);
      if (writers.length === 0) continue;

      const union = new Set<boolean>();
      let knowable = true;
      for (const writer of writers) {
        const pushable = pushableValues(writer, byId, wires);
        if (pushable === null) {
          knowable = false;
          break;
        }
        for (const value of pushable) union.add(value);
      }
      if (!knowable) continue;
      if (!(union.size === 1 && union.has(true))) continue;

      const gates = writers
        .map((w) => byId.get(w.fromId))
        .filter((s): s is ParameterizedNode => !!s)
        .map((s) => s.label || s.id)
        .join(', ');
      diagnostics.push({
        code: DiagnosticCode.GateOnlyTurnsOn,
        severity: 'warning',
        message:
          `This ${node.type}'s ${port} can only ever become true: every wire into it comes from a Condition ` +
          `(${gates}) whose condition is a constant, so every Evaluate pushes true and nothing can ever put the ` +
          'element away again within a page life. A second answer shown later leaves both on the screen at once. ' +
          "Wire a Switch's Current State here instead — its On and Off signals are the two directions — or add a " +
          'constant-false Condition on this same port, fired by the path that should hide it.',
        location: {
          component,
          nodeId: node.id,
          nodeType: node.type,
          ...(node.label ? { nodeLabel: node.label } : {}),
          port,
          plug: 'input' as const
        },
        suggestion: "Switch state → " + port
      });
    }
  }

  return diagnostics;
}
