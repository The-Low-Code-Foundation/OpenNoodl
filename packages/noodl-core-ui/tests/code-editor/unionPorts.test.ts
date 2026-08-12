/**
 * Phase 61's shared prelude — the union of the declared ports and the mined ones.
 *
 * The contract worth pinning is not "both lists appear" but the two places where
 * the obvious answer is the wrong one:
 *
 * 1. **A collision resolves to the declared type**, because `_updatePorts` pushes
 *    the proplist first and `_exists` drops the mined duplicate
 *    (`simplejavascript.ts:786-849`, `javascriptnodeparser.js:296-300`). A port
 *    declared `String` and written `Outputs.Done()` is a value port that no wire
 *    will fire.
 * 2. **`declared` and `mined` stay separate flags.** Four consumers were about to
 *    need "declared but never read", which a merged list cannot express — the
 *    reason `collectDeclaredPorts` and `minePorts` were kept apart in the first
 *    place (`authoringContext.ts:69-77`).
 */
import type { OpenNodeFact } from '@noodl-core-ui/components/code-editor/authoringContext';
import { unionPorts } from '@noodl-core-ui/components/code-editor/utils/unionPorts';

function node(declaredInputs: { name: string; type: string }[], declaredOutputs: { name: string; type: string }[]): OpenNodeFact {
  return { nodeId: 'n1', typeName: 'JavaScriptFunction', declaredInputs, declaredOutputs };
}

describe('unionPorts', () => {
  it('finds nothing when there is no node and no code', () => {
    expect(unionPorts(null, '')).toEqual({ inputs: [], outputs: [] });
  });

  it('mines with no node open — a Function node can have ports before anyone declares one', () => {
    const { inputs, outputs } = unionPorts(null, 'Outputs.total = Inputs.price;');
    expect(inputs).toEqual([{ name: 'price', type: '*', declared: false, mined: true, kind: 'value' }]);
    expect(outputs).toEqual([{ name: 'total', type: '*', declared: false, mined: true, kind: 'value' }]);
  });

  it('lists a declared port nobody has used, flagged as such', () => {
    const { inputs } = unionPorts(node([{ name: 'Value', type: 'number' }], []), '');
    expect(inputs).toEqual([{ name: 'Value', type: 'number', declared: true, mined: false, kind: 'value' }]);
  });

  it('flags a port that is both declared and used, as one row', () => {
    const { inputs } = unionPorts(node([{ name: 'Value', type: 'number' }], []), 'return Inputs.Value * 2;');
    expect(inputs).toEqual([{ name: 'Value', type: 'number', declared: true, mined: true, kind: 'value' }]);
  });

  it('keeps declared rows first, then the mined names none of them claimed', () => {
    const { inputs } = unionPorts(node([{ name: 'B', type: 'string' }], []), 'Inputs.A; Inputs.B; Inputs.C;');
    expect(inputs.map((p) => p.name)).toEqual(['B', 'A', 'C']);
    expect(inputs.map((p) => p.declared)).toEqual([true, false, false]);
  });

  it("separates 'declared but never read' from 'used but never declared'", () => {
    const { inputs } = unionPorts(node([{ name: 'Unused', type: 'string' }], []), 'return Inputs.Undeclared;');
    expect(inputs.filter((p) => p.declared && !p.mined).map((p) => p.name)).toEqual(['Unused']);
    expect(inputs.filter((p) => p.mined && !p.declared).map((p) => p.name)).toEqual(['Undeclared']);
  });

  it('types a called output as a signal', () => {
    const { outputs } = unionPorts(null, 'Outputs.Done();');
    expect(outputs).toEqual([{ name: 'Done', type: 'signal', declared: false, mined: true, kind: 'signal' }]);
  });

  it('types an assigned output as a value', () => {
    expect(unionPorts(null, 'Outputs.result = 1;').outputs[0].kind).toBe('value');
  });

  it('honours a declared signal an author has not written yet', () => {
    const { outputs } = unionPorts(node([], [{ name: 'Done', type: 'signal' }]), '');
    expect(outputs[0]).toEqual({ name: 'Done', type: 'signal', declared: true, mined: false, kind: 'signal' });
  });

  it('lets the declared type beat the code — a declared value called like a signal stays a value', () => {
    // The trap. `_exists` drops the mined `signal` push, so the node registers a
    // value port; a consumer that believed the body would say the opposite.
    const { outputs } = unionPorts(node([], [{ name: 'Done', type: 'string' }]), 'Outputs.Done();');
    expect(outputs).toEqual([{ name: 'Done', type: 'string', declared: true, mined: true, kind: 'value' }]);
  });

  it('lets the declared type beat the code in the other direction too', () => {
    const { outputs } = unionPorts(node([], [{ name: 'Done', type: 'signal' }]), 'Outputs.Done = 1;');
    expect(outputs[0].kind).toBe('signal');
    expect(outputs[0].mined).toBe(true);
  });

  it('never calls a reachable input a signal', () => {
    // `inputTypeEnums` (`simplejavascript.ts:742-770`) has seven value types and
    // no Signal, so no `intype-` an author can choose reaches here; and calling
    // an input in the body types it `'*'` like any other, because only the two
    // `Outputs` patterns produce `'signal'`.
    const { inputs } = unionPorts(node([{ name: 'Declared', type: 'string' }], []), 'Inputs.Called();');
    expect(inputs.map((p) => p.kind)).toEqual(['value', 'value']);
  });

  it('does not let an output name collide with an input of the same name', () => {
    const { inputs, outputs } = unionPorts(node([], []), 'Outputs.x = Inputs.x;');
    expect(inputs.map((p) => p.name)).toEqual(['x']);
    expect(outputs.map((p) => p.name)).toEqual(['x']);
  });

  it('reads both notations, in the miner\'s pattern order rather than document order', () => {
    // ⚠️ `minePorts` runs each pattern over the whole document in turn, so every
    // `Inputs.x` precedes every `Inputs["x"]` however they are written. The rail
    // and the bar list ports in this order; it is stable, but it is not the order
    // the names appear on screen, and a consumer that promised the latter would
    // be wrong on the first mixed-notation body it met.
    const { inputs } = unionPorts(null, 'Inputs["with space"]; Inputs.plain;');
    expect(inputs.map((p) => p.name)).toEqual(['plain', 'with space']);
  });

  it('gives the same answer twice', () => {
    const fact = node([{ name: 'Value', type: 'number' }], [{ name: 'Done', type: 'signal' }]);
    const code = 'Outputs.Done(); Outputs.extra = Inputs.Value;';
    expect(unionPorts(fact, code)).toEqual(unionPorts(fact, code));
  });

  it('does not mutate the node fact it was given', () => {
    const fact = node([{ name: 'Value', type: 'number' }], []);
    unionPorts(fact, 'Inputs.Value;');
    expect(fact.declaredInputs).toEqual([{ name: 'Value', type: 'number' }]);
  });
});
