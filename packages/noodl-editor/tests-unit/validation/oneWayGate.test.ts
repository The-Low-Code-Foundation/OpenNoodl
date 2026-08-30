/**
 * DEF-024 (P78 D36) — `gate-only-turns-on`. The RUNTIME reading this rule stands on is pinned in
 * `noodl-mcp/tests/def024-gate-drive.test.ts`, driven in real Chrome at HEAD: the latch shape's
 * tick-then-untick leaves BOTH notices in the document, and the same transitions through one
 * `Switch` per answer leave exactly one. This file pins the DOOR's answer to the same graphs.
 *
 * The mutant ledger (each arm exists to redden exactly one sabotage):
 *  - read only `result` and ignore `isfalse` → the isfalse arm reddens (a constant-false
 *    Condition's `isfalse` pushes true just as one-way).
 *  - drop the wired-`condition` abstention → the wired-condition arm reddens.
 *  - drop the non-Condition-writer abstention → the Switch-writer arm reddens.
 *  - treat a no-`eval` Condition as pushing its constant → the dead-gate arm reddens.
 *  - fire on `{false}` too → the dismiss arm reddens (a one-way hide is a decision, with corpus
 *    numbers beside it in `calibrate:gates`).
 *  - check `mounted` only → the `visible` arm reddens.
 *  - promote to `AUTHORED_BLOCKING_WARNINGS` → the severity arm reddens (the layout pair's
 *    non-promotion pin).
 */

import { authoredPreconditionDiagnostics, isBlockingForAuthoredOutput } from '../../src/editor/src/validation/authoredCandidate';
import { loadDefaultCatalog } from '../../src/editor/src/validation/catalog';
import { DiagnosticCode, type Diagnostic } from '../../src/editor/src/validation/diagnostics';
import type { FunctionWireLike } from '../../src/editor/src/validation/functionPorts';
import { checkOneWayGate } from '../../src/editor/src/validation/oneWayGate';
import type { ParameterizedNode } from '../../src/editor/src/validation/parameterValues';

const catalog = loadDefaultCatalog();
const COMPONENT = '/Pages/Account';

/** The members template's pre-fix gate, verbatim (`CONDITION_GATE` in tpl001Components.ts). */
const LATCH = { condition: true, 'runOnChange-condition': false };
/** The template's s15 workaround: the same shape with the constant flipped. */
const CLEAR = { condition: false, 'runOnChange-condition': false };

function run(nodes: ParameterizedNode[], wires: FunctionWireLike[]): Diagnostic[] {
  return checkOneWayGate(nodes, { component: COMPONENT, catalog, wires });
}

function wire(fromId: string, fromProperty: string, toId: string, toProperty: string): FunctionWireLike {
  return { fromId, fromProperty, toId, toProperty };
}

/** A button, a gate Condition and a notice Group — the drive's defect arm as the door reads it. */
function latchArm(): { nodes: ParameterizedNode[]; wires: FunctionWireLike[] } {
  return {
    nodes: [
      { id: 'tick', type: 'net.noodl.controls.button', parameters: { label: 'Tick' } },
      { id: 'onGate', type: 'Condition', label: 'Show "on"', parameters: { ...LATCH } },
      { id: 'noticeOn', type: 'Group', parameters: { mounted: false } }
    ],
    wires: [wire('tick', 'onClick', 'onGate', 'eval'), wire('onGate', 'result', 'noticeOn', 'mounted')]
  };
}

describe('DEF-024 — gate-only-turns-on', () => {
  it('reports the drive’s latch shape verbatim: a constant-true Condition is a gate that can only ever turn on', () => {
    const { nodes, wires } = latchArm();
    const found = run(nodes, wires);
    expect(found.map((d) => d.code)).toEqual([DiagnosticCode.GateOnlyTurnsOn]);
    const d = found[0];
    expect(d.severity).toBe('warning');
    expect(d.location.nodeId).toBe('noticeOn');
    expect(d.location.port).toBe('mounted');
    // The message names the gate, the mechanism and both exits — the Switch
    // shape the drive's control arm measured, and the paired-clear workaround.
    expect(d.message).toContain('Show "on"');
    expect(d.message).toContain('Switch');
    expect(d.message).toContain('constant-false Condition');
  });

  it('is silent on the template’s s15 workaround — a constant-false clear on the same port makes the set {true, false}', () => {
    const { nodes, wires } = latchArm();
    nodes.push({ id: 'onClear', type: 'Condition', parameters: { ...CLEAR } });
    wires.push(wire('untick', 'onClick', 'onClear', 'eval'), wire('onClear', 'result', 'noticeOn', 'mounted'));
    expect(run(nodes, wires)).toEqual([]);
  });

  it('is silent when the writer is a Switch’s state — any non-Condition writer can push either value', () => {
    const nodes: ParameterizedNode[] = [
      { id: 'sw', type: 'Switch', parameters: {} },
      { id: 'noticeOn', type: 'Group', parameters: { mounted: false } }
    ];
    expect(run(nodes, [wire('sw', 'state', 'noticeOn', 'mounted')])).toEqual([]);
  });

  it('abstains on MIXED writers — a latch beside a Switch on the same port is a port the Switch can still clear', () => {
    // Kills the mutant that demotes the non-Condition abstention to "contributes
    // nothing": {true} ∪ {} would read as {true} and fire on a two-way port.
    const { nodes, wires } = latchArm();
    nodes.push({ id: 'sw', type: 'Switch', parameters: {} });
    wires.push(wire('sw', 'state', 'noticeOn', 'mounted'));
    expect(run(nodes, wires)).toEqual([]);
  });

  it('abstains when the Condition’s condition input is wired — it re-tests on change and pushes both ways', () => {
    const { nodes, wires } = latchArm();
    nodes.push({ id: 'standing', type: 'Switch', parameters: {} });
    wires.push(wire('standing', 'state', 'onGate', 'condition'));
    expect(run(nodes, wires)).toEqual([]);
  });

  it('does not claim a dead gate — a constant Condition with no Evaluate wire can never push anything', () => {
    const { nodes, wires } = latchArm();
    expect(run(nodes, wires.filter((w) => w.toProperty !== 'eval'))).toEqual([]);
  });

  it('reports isfalse from a constant-false Condition — the same one-way true through the other output', () => {
    const { nodes, wires } = latchArm();
    nodes.find((n) => n.id === 'onGate')!.parameters = { ...CLEAR };
    const rewired = wires.map((w) => (w.fromProperty === 'result' ? { ...w, fromProperty: 'isfalse' } : w));
    expect(run(nodes, rewired).map((d) => d.code)).toEqual([DiagnosticCode.GateOnlyTurnsOn]);
  });

  it('does NOT fire on a one-way dismiss — a set of exactly {false} is a decision, recorded here', () => {
    const { nodes, wires } = latchArm();
    nodes.find((n) => n.id === 'onGate')!.parameters = { ...CLEAR };
    expect(run(nodes, wires)).toEqual([]);
  });

  it('reports a latched visible for the same reason as a latched mounted', () => {
    const { nodes, wires } = latchArm();
    const rewired = wires.map((w) => (w.toProperty === 'mounted' ? { ...w, toProperty: 'visible' } : w));
    const found = run(nodes, rewired);
    expect(found.map((d) => d.code)).toEqual([DiagnosticCode.GateOnlyTurnsOn]);
    expect(found[0].location.port).toBe('visible');
  });

  it('skips a component-instance target — whether mounted exists on it is not in this graph', () => {
    const { nodes, wires } = latchArm();
    nodes.find((n) => n.id === 'noticeOn')!.type = '/Members/Notice';
    expect(run(nodes, wires)).toEqual([]);
  });

  it('fires once per latched port — two accumulated answers are two repairs', () => {
    const { nodes, wires } = latchArm();
    nodes.push(
      { id: 'offGate', type: 'Condition', parameters: { ...LATCH } },
      { id: 'noticeOff', type: 'Group', parameters: { mounted: false } },
      { id: 'untick', type: 'net.noodl.controls.button', parameters: {} }
    );
    wires.push(wire('untick', 'onClick', 'offGate', 'eval'), wire('offGate', 'result', 'noticeOff', 'mounted'));
    const found = run(nodes, wires);
    expect(found.map((d) => d.location.nodeId).sort()).toEqual(['noticeOff', 'noticeOn']);
  });

  it('reaches the door through authoredPreconditionDiagnostics, and stays advisory there', () => {
    const { nodes, wires } = latchArm();
    const found = authoredPreconditionDiagnostics({
      component: COMPONENT,
      nodes,
      components: [COMPONENT],
      catalog,
      wires,
      connections: new Set<string>()
    }).filter((d) => d.code === DiagnosticCode.GateOnlyTurnsOn);
    expect(found).toHaveLength(1);
    // The non-promotion pin: advisory on first ship, the layout pair's argument.
    // A later edit that promotes it must come back here with corpus evidence.
    expect(isBlockingForAuthoredOutput(found[0])).toBe(false);
  });
});
