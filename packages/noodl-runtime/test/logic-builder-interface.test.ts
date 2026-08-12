/**
 * LGC-004 — the signature, as a display of it needs to read it.
 *
 * `detectInterface` exists so the interface rails (and, when someone builds it, the props panel)
 * have a shape they can render **without parsing the workspace themselves**. The whole value of
 * that is register **L11**: one fact, one source. So the claims graded here are mostly claims
 * about *agreement* — that the rows say the same thing `detectIO` says, on the same input.
 *
 * ⚠️ **These run with no Blockly anywhere**, which is not incidental. It is the acceptance
 * criterion "verify with the node placed but never opened": a Visual Function whose workspace has
 * never been rendered still has a signature, because the signature is in the JSON. If any of this
 * needed a workspace to be injected first, the rails would be lying about a node nobody opened.
 */

import { detectIO, detectInterface, typeOfPort } from '../src/nodes/std-library/logic-builder-io';

function workspace(...blocks: unknown[]) {
  return JSON.stringify({ blocks: { languageVersion: 0, blocks } });
}

function block(type: string, fields?: Record<string, string>, extra?: Record<string, unknown>) {
  return { type, ...(fields ? { fields } : {}), ...extra };
}

describe('detectInterface — the same ports, with the two facts a display needs', () => {
  it('returns nothing for absent, blank or unparseable input', () => {
    const empty = { inputs: [], outputs: [] };

    expect(detectInterface(undefined)).toEqual(empty);
    expect(detectInterface(null)).toEqual(empty);
    expect(detectInterface('')).toEqual(empty);
    expect(detectInterface('{ not json')).toEqual(empty);
    expect(detectInterface('{}')).toEqual(empty);
    expect(detectInterface(JSON.stringify({ blocks: {} }))).toEqual(empty);
  });

  it('marks a declared port declared, with its declared type', () => {
    const io = detectInterface(
      workspace(
        block('noodl_define_input', { NAME: 'count', TYPE: 'number' }),
        block('noodl_define_output', { NAME: 'label', TYPE: 'string' })
      )
    );

    expect(io.inputs).toEqual([{ name: 'count', kind: 'value', type: 'number', declared: true }]);
    expect(io.outputs).toEqual([{ name: 'label', kind: 'value', type: 'string', declared: true }]);
  });

  /**
   * LGC-004 §3 / register L12. This is the property the whole task is written around: a program
   * that declares nothing still has a signature, and the rows say so honestly rather than
   * guessing a type or hiding the port until someone declares it.
   */
  it('marks an undeclared-but-used port inferred, typed `*`', () => {
    const io = detectInterface(
      workspace(
        block(
          'noodl_set_output',
          { NAME: 'greeting' },
          { inputs: { VALUE: { block: block('noodl_get_input', { NAME: 'name' }) } } }
        )
      )
    );

    expect(io.inputs).toEqual([{ name: 'name', kind: 'value', type: '*', declared: false }]);
    expect(io.outputs).toEqual([{ name: 'greeting', kind: 'value', type: '*', declared: false }]);
  });

  it('counts a declaration anywhere in the file, not only the first mention', () => {
    const io = detectInterface(
      workspace(block('noodl_get_input', { NAME: 'count' }), block('noodl_define_input', { NAME: 'count', TYPE: 'number' }))
    );

    expect(io.inputs).toHaveLength(1);
    expect(io.inputs[0].declared).toBe(true);
  });

  /**
   * 🔴 The row states the type the node **registers**, not a better one.
   *
   * `detectIO` resolves a type clash in document order, so a bare use serialised above its own
   * declaration leaves the port at `'*'` — and the node really does register `'*'`. A rail that
   * read the declaration and printed `number` would describe a port that does not exist, which is
   * the failure this task exists to avoid pointed the other way.
   */
  it('never reports a type the node would not register', () => {
    const source = workspace(
      block('noodl_get_input', { NAME: 'count' }),
      block('noodl_define_input', { NAME: 'count', TYPE: 'number' })
    );

    expect(typeOfPort(detectIO(source), 'input', 'count')).toBe('*');
    expect(detectInterface(source).inputs[0].type).toBe('*');
  });

  it('reports signals on both sides, declared and used', () => {
    const io = detectInterface(
      workspace(
        block('noodl_define_signal_input', { NAME: 'start' }),
        block('noodl_define_signal_output', { NAME: 'finished' }),
        block('noodl_send_signal', { NAME: 'failed' })
      )
    );

    expect(io.inputs).toEqual([{ name: 'start', kind: 'signal', type: 'signal', declared: true }]);
    expect(io.outputs).toEqual([
      { name: 'finished', kind: 'signal', type: 'signal', declared: true },
      { name: 'failed', kind: 'signal', type: 'signal', declared: false }
    ]);
  });

  /**
   * The node registers one port per name and consults the signal lists first
   * (`registerInputIfNeeded`), so a name used both ways is a signal on the node. The row has to
   * agree, or it describes a value port the node never creates.
   */
  it('reads a name used as both a value and a signal as the signal the node will register', () => {
    const io = detectInterface(
      workspace(block('noodl_get_input', { NAME: 'go' }), block('noodl_define_signal_input', { NAME: 'go' }))
    );

    expect(io.inputs).toEqual([{ name: 'go', kind: 'signal', type: 'signal', declared: true }]);
  });

  it('walks statement bodies, shadows and the rest of a stack, exactly as detectIO does', () => {
    const source = workspace(
      block('controls_if', undefined, {
        inputs: {
          IF0: { block: block('noodl_get_input', { NAME: 'enabled' }) },
          DO0: { block: block('noodl_send_signal', { NAME: 'fired' }) }
        }
      }),
      block(
        'noodl_set_output',
        { NAME: 'a' },
        {
          inputs: { VALUE: { shadow: block('noodl_get_input', { NAME: 'shadowed' }) } },
          next: { block: block('noodl_set_output', { NAME: 'b' }) }
        }
      )
    );

    expect(detectInterface(source).inputs.map((p) => p.name)).toEqual(['enabled', 'shadowed']);
    expect(detectInterface(source).outputs.map((p) => p.name)).toEqual(['fired', 'a', 'b']);
  });

  it('accepts an already-parsed workspace object, like detectIO', () => {
    const io = detectInterface(JSON.parse(workspace(block('noodl_set_output', { NAME: 'x' }))));
    expect(io.outputs.map((p) => p.name)).toEqual(['x']);
  });
});

/**
 * 🔴 **The agreement gate.**
 *
 * Two projections of one traversal is the whole design; the way it would rot is somebody adding a
 * block type to one of them. These assert the two readers report the same port set on inputs
 * varied enough that a divergence has somewhere to hide.
 */
describe('detectInterface agrees with detectIO, port for port', () => {
  const sources = [
    workspace(),
    workspace(block('noodl_define_input', { NAME: 'count', TYPE: 'number' })),
    workspace(block('noodl_define_input', { NAME: 'count' })),
    workspace(block('noodl_get_input', { NAME: 'count' }), block('noodl_get_input', { NAME: 'count' })),
    workspace(block('noodl_define_output', { NAME: 'total', TYPE: 'number' }), block('noodl_set_output', { NAME: 'total' })),
    workspace(block('noodl_send_signal', { NAME: 'done' }), block('noodl_define_signal_output', { NAME: 'done' })),
    workspace(block('noodl_define_signal_input', { NAME: 'run' }), block('noodl_get_input', { NAME: 'run' })),
    // The same clash the other way round, so the agreement gate cannot be satisfied by whichever
    // mention happens to come first.
    workspace(block('noodl_get_input', { NAME: 'run' }), block('noodl_define_signal_input', { NAME: 'run' })),
    workspace(block('noodl_set_output', { NAME: 'done' }), block('noodl_send_signal', { NAME: 'done' })),
    workspace(
      block(
        'controls_if',
        undefined,
        {
          inputs: {
            IF0: { block: block('noodl_get_input', { NAME: 'enabled' }) },
            DO0: {
              block: block(
                'noodl_set_output',
                { NAME: 'result' },
                { next: { block: block('noodl_send_signal', { NAME: 'fired' }) } }
              )
            }
          }
        }
      )
    )
  ];

  it.each(sources.map((source, index) => [index, source]))('reports the same input ports (case %i)', (_index, source) => {
    const io = detectIO(source as string);
    const iface = detectInterface(source as string);

    const fromIO = io.inputs.map((p) => p.name).concat(io.signalInputs).sort();
    expect(iface.inputs.map((p) => p.name).sort()).toEqual(Array.from(new Set(fromIO)).sort());
  });

  it.each(sources.map((source, index) => [index, source]))('reports the same output ports (case %i)', (_index, source) => {
    const io = detectIO(source as string);
    const iface = detectInterface(source as string);

    const fromIO = io.outputs.map((p) => p.name).concat(io.signalOutputs).sort();
    expect(iface.outputs.map((p) => p.name).sort()).toEqual(Array.from(new Set(fromIO)).sort());
  });

  it.each(sources.map((source, index) => [index, source]))(
    'gives every value row the type the node registers (case %i)',
    (_index, source) => {
      const io = detectIO(source as string);

      for (const port of detectInterface(source as string).inputs) {
        if (port.kind !== 'value') continue;
        expect(port.type).toBe(typeOfPort(io, 'input', port.name));
      }

      for (const port of detectInterface(source as string).outputs) {
        if (port.kind !== 'value') continue;
        expect(port.type).toBe(typeOfPort(io, 'output', port.name));
      }
    }
  );

  it.each(sources.map((source, index) => [index, source]))(
    'calls a row a signal exactly when the node would register a signal (case %i)',
    (_index, source) => {
      const io = detectIO(source as string);
      const iface = detectInterface(source as string);

      for (const port of iface.inputs) {
        expect(port.kind === 'signal').toBe(io.signalInputs.indexOf(port.name) !== -1);
      }
      for (const port of iface.outputs) {
        expect(port.kind === 'signal').toBe(io.signalOutputs.indexOf(port.name) !== -1);
      }
    }
  );
});
