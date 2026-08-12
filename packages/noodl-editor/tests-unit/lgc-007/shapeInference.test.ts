/**
 * LGC-007 §1 — shape follows purity.
 *
 * §1 and register L21 are settled: *"Blockly's block shape already encodes pure-vs-effectful,
 * and users already read it. Do not invent a visual language for something the toolkit says
 * for free."* So there is nothing to design here, and exactly one thing to get right — the
 * inference that picks between Blockly's two existing shapes:
 *
 * - **value** — an output plug, droppable inside `a + …`;
 * - **statement** — stacks, and cannot be dropped mid-expression.
 *
 * The acceptance criterion is a pair: *"A pure single-output group becomes a value block and
 * can be dropped inside `a + …`. A group with signals becomes a statement block and cannot."*
 * The first half of each is graded here and in `inliner.test.ts`; **the "and cannot" half is
 * Blockly's connection checker refusing the drag**, which needs a drive and is written up under
 * Deferred verification in the task file. What is provable here is that we never hand Blockly a
 * value block for a group that has signals in it — which is the half that, if wrong, would let
 * the drag succeed.
 */

import {
  inferSignature,
  schemaWithCalls,
  STATIC_BLOCK_SCHEMA,
  valueInputsOf
} from '../../src/editor/src/views/BlocklyEditor/myblocks/shape';
import { arithmetic, callValue, getInput, number, sendSignal, setOutput, workspace } from './fixtures';

describe('LGC-007 §1 — pure and one output is a value block', () => {
  it('a lone expression', () => {
    const inferred = inferSignature(workspace(arithmetic('ADD', getInput('a'), getInput('b'))));

    expect(inferred.shape).toBe('value');
    expect(inferred.reasons).toContain('it produces one value and changes nothing');
  });

  it('a read of an input on its own', () => {
    expect(inferSignature(workspace(getInput('n'))).shape).toBe('value');
  });

  it('a call to another saved value block', () => {
    // The schema answers for a call block from the block's own `extraState`, so a body that
    // calls a saved block can be classified with no store present.
    expect(inferSignature(workspace(callValue('other'))).shape).toBe('value');
  });
});

describe('LGC-007 §1 — signals or several outputs make it a statement block', () => {
  it('a group that sends a signal, and says so in plain English', () => {
    const inferred = inferSignature(workspace(sendSignal('done')));

    expect(inferred.shape).toBe('statement');
    expect(inferred.reasons).toContain('it sends or declares a signal');
  });

  it('a signal buried inside a stack, not just at its root', () => {
    const inferred = inferSignature(workspace(setOutput('a', number(1), sendSignal('done'))));

    expect(inferred.shape).toBe('statement');
    expect(inferred.reasons).toContain('it sends or declares a signal');
  });

  it('a group that writes two outputs, and counts them', () => {
    const inferred = inferSignature(workspace(setOutput('a', number(1), setOutput('b', number(2)))));

    expect(inferred.shape).toBe('statement');
    expect(inferred.outputCount).toBe(2);
    expect(inferred.reasons).toContain('it writes 2 outputs');
  });

  it('a group that writes one output — a statement, because setting is something you do', () => {
    const inferred = inferSignature(workspace(setOutput('a', number(1))));

    expect(inferred.shape).toBe('statement');
    expect(inferred.reasons).toContain('its first block is something you do, not a value');
  });

  it('two separate stacks, which is not one expression however pure each half is', () => {
    const inferred = inferSignature(workspace(getInput('a'), getInput('b')));

    expect(inferred.shape).toBe('statement');
    expect(inferred.reasons).toContain('it is 2 separate stacks, not one expression');
  });

  it('nothing at all', () => {
    const inferred = inferSignature(workspace());

    expect(inferred.shape).toBe('statement');
    expect(inferred.reasons).toEqual(['it has no blocks in it']);
    expect(inferred.params).toEqual([]);
  });

  it('an unknown block type falls to statement, which is the safe direction', () => {
    // A value group misfiled as a statement is usable; the reverse generates nonsense. The
    // editor path asks Blockly rather than this table, precisely so it does not have to guess.
    expect(inferSignature(workspace({ type: 'some_plugin_block' })).shape).toBe('statement');
  });
});

describe('LGC-007 §1 — the signature: holes become parameters', () => {
  it('an empty socket is a parameter, named after the socket', () => {
    const inferred = inferSignature(workspace(arithmetic('MULTIPLY', undefined, number(2))));

    expect(inferred.params).toHaveLength(1);
    expect(inferred.params[0].name).toBe('a');
    expect(inferred.params[0].hole).toEqual(['0', 'i:A']);
  });

  it('two holes in one block keep distinct names', () => {
    const inferred = inferSignature(workspace(arithmetic('ADD')));

    expect(inferred.params.map((p) => p.name)).toEqual(['a', 'b']);
  });

  it('a hole reached through a `next` records the route to it', () => {
    const inferred = inferSignature(workspace(setOutput('a', number(1), setOutput('b'))));

    expect(inferred.params).toHaveLength(1);
    expect(inferred.params[0].hole).toEqual(['0', 'n', 'i:VALUE']);
  });

  it('a shadow block counts as filled, because it is a default the user can see and overtype', () => {
    const inferred = inferSignature(
      workspace({ type: 'math_arithmetic', fields: { OP: 'ADD' }, inputs: { A: { shadow: number(1) }, B: { shadow: number(2) } } })
    );

    expect(inferred.params).toEqual([]);
  });

  it('deduplicates names when the same socket name appears twice', () => {
    const inferred = inferSignature(workspace(arithmetic('ADD', undefined, arithmetic('MULTIPLY', undefined, number(2)))));

    expect(inferred.params.map((p) => p.name)).toEqual(['a', 'a 2']);
  });
});

describe('LGC-007 §1 — the schema seam', () => {
  it('reads a call block’s sockets off the block rather than any table', () => {
    const call = callValue('somewhere', [number(1)], ['first', 'second']);

    expect(valueInputsOf(call, STATIC_BLOCK_SCHEMA)).toEqual(['ARG0', 'ARG1']);
  });

  it('knows the two call block types have opposite shapes', () => {
    const schema = schemaWithCalls();

    expect(schema.hasOutput('myblocks_call_value')).toBe(true);
    expect(schema.hasOutput('myblocks_call_statement')).toBe(false);
  });
});
