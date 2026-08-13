/**
 * VFN-008 — a placed saved block publishes the ports its body contributes.
 *
 * ## The defect this file exists to have caught
 *
 * A saved block's body is inlined into the host program at generate time, so a definition
 * containing `set output "total"` makes the host node's program write `Outputs["total"]`. But
 * `updatePorts` calls `detectIO` on the **raw** serialised workspace, and the expansion happens to
 * a different copy that only the generator ever sees. `detectIO` had never heard of a call block,
 * so it contributed no mentions at all:
 *
 * ```
 * detectIO(workspace containing the call block)  → outputs: []
 * detectIO(the same body, inlined)               → outputs: [{ name: 'total', type: '*' }]
 * generateWithMyBlocks(...)                      → 'Outputs["total"] = 7;\n'
 * ```
 *
 * The program was right and the node was deaf: the code wrote an output that had no port for
 * anyone to wire to.
 *
 * ## Why this suite is here and not only in the editor
 *
 * The fix is that a call block **states** the ports of the definition it was bound against, in
 * `extraState.ports`, and `detectIO` reads them. That reader ships inside the runtime bundle
 * because dynamic ports are announced from the *viewer* window, which cannot see the editor's
 * shelves — the whole reason `logic-builder-io.ts` exists. So the reader has to be gradeable with
 * no editor, no Blockly and no store present, which is exactly what this file is. The editor's
 * `tests-unit/vfn-008` suite closes the other half: that what the editor *writes* is what this
 * reads, through a real Blockly round trip.
 *
 * ## 🔴 Every criterion here is an absence, so read the controls first
 *
 * "The port appears" is the only positive claim in the file; everything else is *a port does not
 * appear when it should not*, and a suite of absences is indistinguishable from an instrument that
 * measured nothing. The controls at the bottom are the reason to believe it: they reproduce the
 * pre-fix silence on demand by removing exactly one key, they prove the reader is reading the
 * stated rows rather than inferring anything from the block type, and they feed it four kinds of
 * rubbish and require it to stay quiet rather than throw.
 */
import {
  CALL_PORTS_STATE_KEY,
  MY_BLOCKS_CALL_STATEMENT,
  MY_BLOCKS_CALL_VALUE,
  RESERVED_INPUTS,
  RESERVED_OUTPUTS,
  detectIO,
  detectInterface,
  typeOfPort
} from '../src/nodes/std-library/logic-builder-io';

function workspace(...blocks: unknown[]) {
  return JSON.stringify({ blocks: { languageVersion: 0, blocks } });
}

interface Row {
  name: string;
  kind?: 'value' | 'signal';
  type?: string;
  declared?: boolean;
}

/** A call block as the editor serialises one, with a stated interface. */
function call(
  type: string,
  ports: { inputs?: Row[]; outputs?: Row[] } | undefined,
  extra: Record<string, unknown> = {}
) {
  const extraState: Record<string, unknown> = { defId: 'mb_1', args: [], label: 'Total' };
  if (ports !== undefined) {
    extraState[CALL_PORTS_STATE_KEY] = { inputs: ports.inputs ?? [], outputs: ports.outputs ?? [] };
  }
  return { type, extraState, ...extra };
}

/** The ports `updatePorts` would actually publish — its own reserved-name filter, applied. */
function published(json: string) {
  const io = detectIO(json);
  return {
    inputs: io.inputs.filter((p) => RESERVED_INPUTS.indexOf(p.name) === -1).map((p) => p.name),
    outputs: io.outputs.filter((p) => RESERVED_OUTPUTS.indexOf(p.name) === -1).map((p) => p.name),
    signalInputs: io.signalInputs.filter((n) => RESERVED_INPUTS.indexOf(n) === -1),
    signalOutputs: io.signalOutputs.filter((n) => RESERVED_OUTPUTS.indexOf(n) === -1)
  };
}

describe('VFN-008 — a call block contributes the ports its definition body declares', () => {
  it('publishes the output a saved block sets — the reported defect, in one line', () => {
    const json = workspace(call(MY_BLOCKS_CALL_STATEMENT, { outputs: [{ name: 'total', declared: false }] }));

    expect(detectIO(json).outputs).toEqual([{ name: 'total', type: '*' }]);
  });

  it('carries the declared type across, so the port is registered as the body typed it', () => {
    const json = workspace(
      call(MY_BLOCKS_CALL_STATEMENT, {
        inputs: [{ name: 'price', type: 'number', declared: true }],
        outputs: [{ name: 'total', type: 'number', declared: true }]
      })
    );

    expect(typeOfPort(detectIO(json), 'input', 'price')).toBe('number');
    expect(typeOfPort(detectIO(json), 'output', 'total')).toBe('number');
  });

  it('an undeclared row is a port with no type, exactly as a bare `get input` is', () => {
    // `declared` is the row's word for "some block inside the body states this port". A body that
    // only *uses* `count` gives the host a `count` port of type `*` — the same answer a bare
    // `get input count` in the host workspace gives, because it is the same rule.
    const json = workspace(call(MY_BLOCKS_CALL_VALUE, { inputs: [{ name: 'count', type: 'number', declared: false }] }));

    expect(detectIO(json).inputs).toEqual([{ name: 'count', type: '*' }]);
  });

  it('signals travel too, on the right side and as signals rather than values', () => {
    const json = workspace(
      call(MY_BLOCKS_CALL_STATEMENT, {
        inputs: [{ name: 'start', kind: 'signal', declared: true }],
        outputs: [{ name: 'finished', kind: 'signal', declared: false }]
      })
    );

    const io = detectIO(json);
    expect(io.signalInputs).toEqual(['start']);
    expect(io.signalOutputs).toEqual(['finished']);
    expect(io.inputs).toEqual([]);
    expect(io.outputs).toEqual([]);
  });

  it('a call block nested inside a stack or a socket is found, like every other block', () => {
    const nested = workspace({
      type: 'controls_if',
      inputs: {
        DO0: { block: call(MY_BLOCKS_CALL_STATEMENT, { outputs: [{ name: 'inBody' }] }) },
        IF0: { block: call(MY_BLOCKS_CALL_VALUE, { inputs: [{ name: 'inSocket' }] }) }
      },
      next: { block: call(MY_BLOCKS_CALL_STATEMENT, { outputs: [{ name: 'afterwards' }] }) }
    });

    const io = detectIO(nested);
    expect(io.inputs.map((p) => p.name)).toEqual(['inSocket']);
    expect(io.outputs.map((p) => p.name)).toEqual(['inBody', 'afterwards']);
  });

  it('a name the host also mentions is one port, not two', () => {
    // The dedupe is `valuePorts`' existing `Set` and nothing new, but a call block is the first
    // thing that can mention a port the author cannot see, so it is worth pinning that the host's
    // own declaration still wins the type by the ordinary first-mention rule.
    const json = workspace(
      { type: 'noodl_define_output', fields: { NAME: 'total', TYPE: 'number' } },
      call(MY_BLOCKS_CALL_STATEMENT, { outputs: [{ name: 'total', declared: false }] })
    );

    expect(detectIO(json).outputs).toEqual([{ name: 'total', type: 'number' }]);
  });

  it('`detectInterface` agrees, because it is the same traversal projected differently', () => {
    const json = workspace(
      call(MY_BLOCKS_CALL_STATEMENT, {
        inputs: [{ name: 'price', type: 'number', declared: true }],
        outputs: [{ name: 'total', declared: false }, { name: 'done', kind: 'signal', declared: true }]
      })
    );

    expect(detectInterface(json).inputs).toEqual([{ name: 'price', kind: 'value', type: 'number', declared: true }]);
    expect(detectInterface(json).outputs).toEqual([
      { name: 'total', kind: 'value', type: '*', declared: false },
      { name: 'done', kind: 'signal', type: 'signal', declared: true }
    ]);
  });

  it('a reserved name stated by a definition is still filtered before it reaches the canvas', () => {
    // A saved block could name a port the node already owns. `updatePorts` filters those, and a
    // call block must not be a way around that filter.
    const json = workspace(
      call(MY_BLOCKS_CALL_STATEMENT, {
        inputs: [{ name: 'run' }, { name: 'price' }],
        outputs: [{ name: 'error' }, { name: 'total' }]
      })
    );

    expect(published(json).inputs).toEqual(['price']);
    expect(published(json).outputs).toEqual(['total']);
  });
});

/**
 * 🔴 The negative controls.
 *
 * Every test above asserts a port *appears*, which one hard-coded `push` would satisfy. These
 * require the reader to be reading, and require its silence to be recoverable on demand.
 */
describe('VFN-008 — 🔴 negative controls for the call-block port reader', () => {
  it('CONTROL — removing the one key reproduces the pre-fix silence exactly', () => {
    // This is the defect, on demand. A call block with no stated interface contributes nothing,
    // which is what *every* call block did before this change and what an old one still does.
    const withPorts = workspace(call(MY_BLOCKS_CALL_STATEMENT, { outputs: [{ name: 'total' }] }));
    const without = workspace(call(MY_BLOCKS_CALL_STATEMENT, undefined));

    expect(detectIO(withPorts).outputs).toEqual([{ name: 'total', type: '*' }]);
    expect(detectIO(without).outputs).toEqual([]);
    expect(detectIO(without)).toEqual({ inputs: [], outputs: [], signalInputs: [], signalOutputs: [] });
  });

  it('CONTROL — it reads the stated rows, and cannot be inferring them from anything else', () => {
    // Same block type, same defId, same args: only the stated rows differ. If the reader were
    // inventing a port from the block type, or resolving the definition by some other route, these
    // two would not come back different.
    const a = workspace(call(MY_BLOCKS_CALL_STATEMENT, { outputs: [{ name: 'alpha' }] }));
    const b = workspace(call(MY_BLOCKS_CALL_STATEMENT, { outputs: [{ name: 'beta' }] }));

    expect(detectIO(a).outputs.map((p) => p.name)).toEqual(['alpha']);
    expect(detectIO(b).outputs.map((p) => p.name)).toEqual(['beta']);
  });

  it('CONTROL — a call block that states no ports at all publishes none', () => {
    // An empty definition is a real state — a saved block can be a pure statement with no ports —
    // and it must produce nothing rather than a placeholder.
    const json = workspace(call(MY_BLOCKS_CALL_STATEMENT, { inputs: [], outputs: [] }));

    expect(detectIO(json)).toEqual({ inputs: [], outputs: [], signalInputs: [], signalOutputs: [] });
  });

  it('CONTROL — a block that is not a call block is not read for ports', () => {
    // The guard is the block *type*, and a stray `ports` bag on something else must be ignored.
    // Without this, any block anyone ever gives an `extraState.ports` to becomes a port source.
    const json = workspace({
      type: 'controls_if',
      extraState: { [CALL_PORTS_STATE_KEY]: { inputs: [{ name: 'sneaky' }], outputs: [] } }
    });

    expect(detectIO(json).inputs).toEqual([]);
  });

  it('CONTROL — rubbish in the bag is ignored and never throws, because this is a port-registration path', () => {
    // These come off `project.json`. An older version, a hand edit or a truncated file must cost
    // the ports on that one block, not the node.
    const cases = [
      workspace(call(MY_BLOCKS_CALL_STATEMENT, undefined, { extraState: { ports: 'nope' } })),
      workspace({ type: MY_BLOCKS_CALL_STATEMENT, extraState: { ports: { inputs: 'nope', outputs: 3 } } }),
      workspace({ type: MY_BLOCKS_CALL_STATEMENT, extraState: { ports: { inputs: [null, 7, {}], outputs: [{ name: '' }] } } }),
      workspace({ type: MY_BLOCKS_CALL_STATEMENT, extraState: null })
    ];

    for (const json of cases) {
      expect(detectIO(json)).toEqual({ inputs: [], outputs: [], signalInputs: [], signalOutputs: [] });
    }
  });

  it('CONTROL — a row that survives partial rubbish still lands, so the filter is not just refusing everything', () => {
    // The control above would also pass if the reader dropped every row it was ever given. This is
    // the same bag with one good row in it.
    const json = workspace({
      type: MY_BLOCKS_CALL_STATEMENT,
      extraState: { ports: { inputs: [null, { name: 'price', type: 'number', declared: true }], outputs: [{}] } }
    });

    expect(detectIO(json).inputs).toEqual([{ name: 'price', type: 'number' }]);
    expect(detectIO(json).outputs).toEqual([]);
  });

  it('CONTROL — a definition graph that calls itself cannot make port detection recurse', () => {
    // Register L20's cycle hazard belongs to the inliner, which throws on it. This reader must not
    // even be able to reach it: it reads a flat list off one block and follows no definition edge,
    // so a self-referential `defId` is just a block with some rows on it.
    const json = workspace(
      call(MY_BLOCKS_CALL_STATEMENT, { outputs: [{ name: 'total' }] }, { extraState: { defId: 'mb_self', args: [], label: 'Self', ports: { inputs: [], outputs: [{ name: 'total' }] } } })
    );

    expect(detectIO(json).outputs).toEqual([{ name: 'total', type: '*' }]);
  });
});
