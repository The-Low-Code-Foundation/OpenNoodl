/**
 * LGC-009 — what `detectIO` does with a hat.
 *
 * ## The question this file answers
 *
 * The hat names a signal. `noodl_define_signal_input` also names a signal. The task file called
 * that *"a second, competing declaration of the same port"* and pointed at LGC-004's register
 * **L39**, which records that `detectIO` resolves a clash by **document order** — an order the
 * author cannot see. A mandatory hat landing on top of that would be a real defect, and
 * acceptance criterion 3 is the constraint: **one port per signal, not two.**
 *
 * ## What is graded, and why it is graded twice
 *
 * Every claim here is asserted in **both document orders**, and the two results are compared to
 * each other as well as to the expected value. An assertion in one order would pass just as well
 * against an implementation that *did* pick a winner by position — which is the defect. Only the
 * pair of runs distinguishes "deduplicated" from "the first one happened to be right".
 *
 * 🔴 The property that makes this hold is stated in `logic-builder-io.ts` beside the case: a
 * signal port carries no type, so there is no fact for two declarations of it to disagree about,
 * and therefore nothing to tie-break. L39's ordering defect is confined to value-port *types*
 * and the hat cannot reach it. The two `detectIO` fields that L39 governs — `inputs` / `outputs`
 * — are asserted unchanged by a hat, so a future edit that gave the hat a type would fail here.
 */

import {
  DEFAULT_HAT_SIGNAL,
  HAT_BLOCK_TYPE,
  detectIO,
  detectInterface,
  typeOfPort
} from '../src/nodes/std-library/logic-builder-io';

function workspace(...blocks: unknown[]) {
  return JSON.stringify({ blocks: { languageVersion: 0, blocks } });
}

function block(type: string, fields?: Record<string, string>, extra?: Record<string, unknown>) {
  return { type, ...(fields ? { fields } : {}), ...extra };
}

/** A hat with `blocks` stacked under it, exactly as the migration writes one. */
function hat(signal: string, ...stack: Record<string, unknown>[]) {
  let next: Record<string, unknown> | undefined;
  for (let i = stack.length - 1; i >= 0; i--) {
    next = next ? { ...stack[i], next: { block: next } } : stack[i];
  }
  return block(HAT_BLOCK_TYPE, { NAME: signal }, next ? { next: { block: next } } : {});
}

describe('LGC-009 — the hat declares a signal input', () => {
  it('is a signal input port on its own', () => {
    const io = detectIO(workspace(hat('start')));

    expect(io.signalInputs).toEqual(['start']);
    expect(io.inputs).toEqual([]);
    expect(io.outputs).toEqual([]);
    expect(io.signalOutputs).toEqual([]);
  });

  it('reads as a declared signal row, not an inferred one', () => {
    const rows = detectInterface(workspace(hat('start'))).inputs;

    expect(rows).toEqual([{ name: 'start', kind: 'signal', type: 'signal', declared: true }]);
  });

  it('names the node\'s own `run` port by default, which is reserved and so publishes nothing new', () => {
    // `RESERVED_INPUTS` in logic-builder.ts holds the lower-case `run`, and `updatePorts` drops
    // a block-declared name that collides with it. A default hat therefore adds no port at all.
    expect(DEFAULT_HAT_SIGNAL).toBe('run');

    const io = detectIO(workspace(hat(DEFAULT_HAT_SIGNAL)));
    expect(io.signalInputs).toEqual(['run']);
  });

  it('walks the stack under it, so a hatted program reports the ports the same program reported flat', () => {
    const stack = [
      block('noodl_define_input', { NAME: 'price', TYPE: 'number' }),
      block('noodl_set_output', { NAME: 'total' }),
      block('noodl_send_signal', { NAME: 'done' })
    ];

    const flat = detectIO(
      workspace({
        ...stack[0],
        next: { block: { ...stack[1], next: { block: stack[2] } } }
      })
    );
    const hatted = detectIO(workspace(hat('run', ...stack)));

    expect(hatted.inputs).toEqual(flat.inputs);
    expect(hatted.outputs).toEqual(flat.outputs);
    expect(hatted.signalOutputs).toEqual(flat.signalOutputs);
    // The only difference the hat may make anywhere in the port set.
    expect(hatted.signalInputs).toEqual(['run']);
    expect(flat.signalInputs).toEqual([]);
  });
});

describe('LGC-009 acceptance criterion 3 — one port per signal, in either document order', () => {
  const declare = block('noodl_define_signal_input', { NAME: 'run' });

  /** Hat above its own `Define signal input`, and the same two blocks the other way round. */
  const hatFirst = workspace(hat('run'), declare);
  const declareFirst = workspace(declare, hat('run'));

  it('reports the signal once, not twice, whichever block comes first', () => {
    expect(detectIO(hatFirst).signalInputs).toEqual(['run']);
    expect(detectIO(declareFirst).signalInputs).toEqual(['run']);
  });

  it('reports one interface row, not two, whichever block comes first', () => {
    expect(detectInterface(hatFirst).inputs).toEqual([
      { name: 'run', kind: 'signal', type: 'signal', declared: true }
    ]);
    expect(detectInterface(declareFirst).inputs).toEqual([
      { name: 'run', kind: 'signal', type: 'signal', declared: true }
    ]);
  });

  it('returns *identical* results for the two orders, which is the claim an order-sensitive resolver would fail', () => {
    expect(detectIO(hatFirst)).toEqual(detectIO(declareFirst));
    expect(detectInterface(hatFirst)).toEqual(detectInterface(declareFirst));
  });

  it('leaves the value ports L39 is actually about exactly where they were', () => {
    // The hat carries no type, so it cannot participate in the first-mention type race. A `get`
    // above its own `Define` still reports `'*'` — L39's pinned behaviour, unchanged by the hat.
    const use = block('noodl_get_input', { NAME: 'count' });
    const declaredNumber = block('noodl_define_input', { NAME: 'count', TYPE: 'number' });

    expect(typeOfPort(detectIO(workspace(hat('run'), use, declaredNumber)), 'input', 'count')).toBe('*');
    expect(typeOfPort(detectIO(workspace(hat('run'), declaredNumber, use)), 'input', 'count')).toBe('number');
  });
});

describe('LGC-009 — a name used by a hat and by a value block', () => {
  it('is one port and it is the signal, whichever comes first (L42 unchanged)', () => {
    const value = block('noodl_get_input', { NAME: 'go' });

    const hatFirst = detectInterface(workspace(hat('go'), value)).inputs;
    const valueFirst = detectInterface(workspace(value, hat('go'))).inputs;

    expect(hatFirst).toEqual([{ name: 'go', kind: 'signal', type: 'signal', declared: true }]);
    expect(valueFirst).toEqual(hatFirst);
  });
});
