import { detectIO, typeOfPort } from '../src/nodes/std-library/logic-builder-io';

/**
 * Build a Blockly `workspaces.save()` payload from top-level block stacks.
 * The shape is Blockly's, not ours — these fixtures mirror what the editor
 * actually writes into the `workspace` parameter.
 */
function workspace(...blocks: unknown[]) {
  return JSON.stringify({ blocks: { languageVersion: 0, blocks } });
}

function block(type: string, fields?: Record<string, string>, extra?: Record<string, unknown>) {
  return { type, ...(fields ? { fields } : {}), ...extra };
}

describe('detectIO', () => {
  it('returns an empty result for absent, blank or unparseable input', () => {
    const empty = { inputs: [], outputs: [], signalInputs: [], signalOutputs: [] };

    expect(detectIO(undefined)).toEqual(empty);
    expect(detectIO(null)).toEqual(empty);
    expect(detectIO('')).toEqual(empty);
    expect(detectIO('{ not json')).toEqual(empty);
    expect(detectIO('{}')).toEqual(empty);
    expect(detectIO(JSON.stringify({ blocks: {} }))).toEqual(empty);
  });

  it('reads declared inputs and outputs with their declared types', () => {
    const io = detectIO(
      workspace(
        block('noodl_define_input', { NAME: 'count', TYPE: 'number' }),
        block('noodl_define_output', { NAME: 'label', TYPE: 'string' })
      )
    );

    expect(io.inputs).toEqual([{ name: 'count', type: 'number' }]);
    expect(io.outputs).toEqual([{ name: 'label', type: 'string' }]);
  });

  it('infers ports from use, so an undeclared program still works', () => {
    const io = detectIO(
      workspace(block('noodl_set_output', { NAME: 'greeting' }, { inputs: { VALUE: { block: block('noodl_get_input', { NAME: 'name' }) } } }))
    );

    expect(io.inputs).toEqual([{ name: 'name', type: '*' }]);
    expect(io.outputs).toEqual([{ name: 'greeting', type: '*' }]);
  });

  it('lets a declaration win the type over a later bare use', () => {
    const io = detectIO(
      workspace(
        block('noodl_define_input', { NAME: 'count', TYPE: 'number' }),
        block('noodl_get_input', { NAME: 'count' })
      )
    );

    expect(io.inputs).toEqual([{ name: 'count', type: 'number' }]);
    expect(typeOfPort(io, 'input', 'count')).toBe('number');
    expect(typeOfPort(io, 'input', 'nope')).toBe('*');
  });

  it('detects signals in both directions, declared and used', () => {
    const io = detectIO(
      workspace(
        block('noodl_define_signal_input', { NAME: 'start' }),
        block('noodl_define_signal_output', { NAME: 'finished' }),
        block('noodl_send_signal', { NAME: 'failed' })
      )
    );

    expect(io.signalInputs).toEqual(['start']);
    expect(io.signalOutputs).toEqual(['finished', 'failed']);
  });

  it('walks statement bodies, so ports inside an if-block are found', () => {
    const io = detectIO(
      workspace(
        block('controls_if', undefined, {
          inputs: {
            IF0: { block: block('noodl_get_input', { NAME: 'enabled' }) },
            DO0: { block: block('noodl_send_signal', { NAME: 'fired' }) }
          }
        })
      )
    );

    expect(io.inputs).toEqual([{ name: 'enabled', type: '*' }]);
    expect(io.signalOutputs).toEqual(['fired']);
  });

  it('walks shadow blocks and the rest of a stack via next', () => {
    const io = detectIO(
      workspace(
        block('noodl_set_output', { NAME: 'a' }, {
          inputs: { VALUE: { shadow: block('noodl_get_input', { NAME: 'shadowed' }) } },
          next: { block: block('noodl_set_output', { NAME: 'b' }) }
        })
      )
    );

    expect(io.inputs).toEqual([{ name: 'shadowed', type: '*' }]);
    expect(io.outputs.map((o) => o.name)).toEqual(['a', 'b']);
  });

  it('deduplicates repeated names', () => {
    const io = detectIO(
      workspace(
        block('noodl_set_output', { NAME: 'result' }),
        block('noodl_set_output', { NAME: 'result' }),
        block('noodl_send_signal', { NAME: 'done' }),
        block('noodl_send_signal', { NAME: 'done' })
      )
    );

    expect(io.outputs).toEqual([{ name: 'result', type: '*' }]);
    expect(io.signalOutputs).toEqual(['done']);
  });

  it('accepts an already-parsed workspace object', () => {
    const io = detectIO(JSON.parse(workspace(block('noodl_set_output', { NAME: 'x' }))));
    expect(io.outputs).toEqual([{ name: 'x', type: '*' }]);
  });
});
