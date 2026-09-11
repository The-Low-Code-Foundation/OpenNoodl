/**
 * LGC-002 — "Do It", the editor half.
 *
 * Both halves graded here drive a **real headless Blockly workspace** with the real Noodl
 * blocks and the real JavaScript generator, because both are claims about Blockly's behaviour
 * and asserting them against a re-implementation of its shapes would pass around the defect
 * rather than catch it.
 *
 *  - **§2, the offer rule.** Value blocks are evaluated; statement blocks are refused with a
 *    reason. The reason matters as much as the refusal: a greyed menu item with no explanation
 *    is the same dead end as a missing one.
 *  - **§1, the fragment.** One block's subtree becomes a `new Function` body. The detail that
 *    breaks this silently is the generator prelude: `blockToCode` on its own emits a *call* to
 *    a helper function whose *definition* only `finish()` produces, so a `random integer` block
 *    generates a fragment that throws `ReferenceError` at the far end of the relay while
 *    working perfectly in the whole program.
 *
 * ⚠️ Nothing here executes a fragment. Execution is the viewer's, against the node's live
 * inputs — `packages/noodl-runtime/test/logic-builder-probe.test.ts` is its half.
 */

import * as Blockly from 'blockly';

import {
  DECLARATION_BLOCK_TYPES,
  REASON_DECLARES,
  REASON_DISABLED,
  REASON_NO_VALUE,
  REASON_WRITES,
  WRITING_BLOCK_TYPES,
  answerForReply,
  classifyBlockForDoIt,
  generateFragmentForBlock,
  invalidatesBalloons,
  wrapPreview
} from '../../src/editor/src/views/BlocklyEditor/DoIt';
import { initNoodlBlocks } from '../../src/editor/src/views/BlocklyEditor/NoodlBlocks';
import { initNoodlGenerators } from '../../src/editor/src/views/BlocklyEditor/NoodlGenerators';

initNoodlBlocks();
initNoodlGenerators();

function withWorkspace<T>(body: (workspace: Blockly.Workspace) => T): T {
  const workspace = new Blockly.Workspace();
  try {
    return body(workspace);
  } finally {
    workspace.dispose();
  }
}

describe('LGC-002 §2 — who is offered Do It', () => {
  it('offers it on a value block', () => {
    withWorkspace((workspace) => {
      const block = workspace.newBlock('math_arithmetic');

      expect(block.outputConnection).toBeTruthy();
      expect(classifyBlockForDoIt(block)).toEqual({ offered: true });
    });
  });

  it('offers it on `get input`, which is the one a beginner reaches for first', () => {
    withWorkspace((workspace) => {
      expect(classifyBlockForDoIt(workspace.newBlock('noodl_get_input'))).toEqual({ offered: true });
    });
  });

  it('refuses each writing block with the task\'s own sentence', () => {
    withWorkspace((workspace) => {
      for (const type of ['noodl_set_output', 'noodl_set_variable', 'noodl_send_signal']) {
        expect(classifyBlockForDoIt(workspace.newBlock(type))).toEqual({
          offered: false,
          reason: REASON_WRITES
        });
      }
    });
  });

  it('refuses the two writing blocks the task did not list, because they write too', () => {
    // `set property on object` writes into a live `Noodl.Object`; `add to array` mutates a
    // live `Noodl.Array`. The task named three examples, not a complete set, and leaving these
    // two off would have made the rule look enforced while the blocks most able to corrupt a
    // builder's data walked through it.
    withWorkspace((workspace) => {
      expect(classifyBlockForDoIt(workspace.newBlock('noodl_set_object_property')).offered).toBe(false);
      expect(classifyBlockForDoIt(workspace.newBlock('noodl_array_add')).offered).toBe(false);
    });
  });

  it('every block on the writing list is in fact a statement block', () => {
    // The list is a list of names, and a name that stopped matching a block — a rename, a
    // block that gained an output — would silently stop refusing. This is what notices.
    withWorkspace((workspace) => {
      for (const type of WRITING_BLOCK_TYPES) {
        const block = workspace.newBlock(type);
        expect([type, !!block.outputConnection]).toEqual([type, false]);
        expect(classifyBlockForDoIt(block).offered).toBe(false);
      }
    });
  });

  it('refuses a declaration block, which has nothing to work out at all', () => {
    withWorkspace((workspace) => {
      for (const type of DECLARATION_BLOCK_TYPES) {
        expect(classifyBlockForDoIt(workspace.newBlock(type))).toEqual({
          offered: false,
          reason: REASON_DECLARES
        });
      }
    });
  });

  it('refuses a plain control-flow statement, which has no value to show', () => {
    withWorkspace((workspace) => {
      expect(classifyBlockForDoIt(workspace.newBlock('controls_if'))).toEqual({
        offered: false,
        reason: REASON_NO_VALUE
      });
    });
  });

  it('refuses a disabled block, and says that is why', () => {
    withWorkspace((workspace) => {
      const block = workspace.newBlock('math_number');
      block.setDisabledReason(true, 'manual');

      expect(classifyBlockForDoIt(block)).toEqual({ offered: false, reason: REASON_DISABLED });
    });
  });

  it('never refuses without a reason', () => {
    // The whole point of §2 is greyed-with-a-reason. An empty string here would grey the menu
    // item and say nothing, which is the failure mode the rule exists to avoid.
    withWorkspace((workspace) => {
      for (const type of WRITING_BLOCK_TYPES.concat(DECLARATION_BLOCK_TYPES).concat(['controls_if', 'controls_repeat_ext'])) {
        const offer = classifyBlockForDoIt(workspace.newBlock(type));
        expect(offer.offered).toBe(false);
        expect((offer as { reason: string }).reason.length).toBeGreaterThan(20);
      }
    });
  });
});

describe('LGC-002 §1 — the fragment', () => {
  it('generates a `return` of the block\'s own expression', () => {
    withWorkspace((workspace) => {
      const block = workspace.newBlock('math_number');
      block.setFieldValue('42', 'NUM');

      const fragment = generateFragmentForBlock(workspace, block);

      expect(fragment.expression).toBe('42');
      expect(fragment.code.trim().endsWith('return (42);')).toBe(true);
    });
  });

  it('generates the whole subtree, not just the top block', () => {
    withWorkspace((workspace) => {
      const times = workspace.newBlock('math_arithmetic');
      times.setFieldValue('MULTIPLY', 'OP');
      const price = workspace.newBlock('noodl_get_input');
      price.setFieldValue('price', 'NAME');
      const quantity = workspace.newBlock('noodl_get_input');
      quantity.setFieldValue('quantity', 'NAME');
      times.getInput('A').connection.connect(price.outputConnection);
      times.getInput('B').connection.connect(quantity.outputConnection);

      expect(generateFragmentForBlock(workspace, times).expression).toBe('Inputs["price"] * Inputs["quantity"]');
    });
  });

  it('emits the generator prelude, so a helper the block calls is defined', () => {
    // 🔴 The detail that breaks this silently. `blockToCode` emits `mathRandomInt(1, 6)`; the
    // definition of `mathRandomInt` exists only because `init`/`finish` bracket the call. A
    // fragment without it throws `ReferenceError` in the viewer for a block that works.
    withWorkspace((workspace) => {
      const block = workspace.newBlock('math_random_int');

      const fragment = generateFragmentForBlock(workspace, block);

      expect(fragment.expression).toContain('mathRandomInt');
      expect(fragment.code).toContain('function mathRandomInt(');
      // And the body is a real program: the definition comes before the return that uses it.
      expect(fragment.code.indexOf('function mathRandomInt(')).toBeLessThan(fragment.code.indexOf('return ('));
    });
  });

  it('declares the workspace variables a fragment reads, rather than leaving a ReferenceError', () => {
    withWorkspace((workspace) => {
      const block = workspace.newBlock('variables_get');

      const fragment = generateFragmentForBlock(workspace, block);

      expect(fragment.code).toMatch(/var\s/);
    });
  });

  it('parenthesises the expression, so precedence cannot leak into the return', () => {
    withWorkspace((workspace) => {
      const sum = workspace.newBlock('math_arithmetic');
      const a = workspace.newBlock('math_number');
      a.setFieldValue('1', 'NUM');
      const b = workspace.newBlock('math_number');
      b.setFieldValue('2', 'NUM');
      sum.getInput('A').connection.connect(a.outputConnection);
      sum.getInput('B').connection.connect(b.outputConnection);

      expect(generateFragmentForBlock(workspace, sum).code).toContain('return (1 + 2);');
    });
  });

  it('compiles to a function with exactly the runtime\'s eight parameters', () => {
    // The seam claim, checked rather than assumed: what this generates is compilable by the
    // same `new Function(...)` call `_compileFunction` makes. Compiled here, never run — the
    // running is the viewer's, against inputs this window does not have.
    withWorkspace((workspace) => {
      const block = workspace.newBlock('noodl_get_input');
      block.setFieldValue('price', 'NAME');

      const fragment = generateFragmentForBlock(workspace, block);
      const fn = new Function(
        'Inputs',
        'Outputs',
        'Noodl',
        'Variables',
        'Objects',
        'Arrays',
        'sendSignalOnOutput',
        '__triggerSignal__',
        fragment.code
      );

      expect(fn.length).toBe(8);
    });
  });

  it('returns null for a block that generates nothing', () => {
    withWorkspace((workspace) => {
      expect(generateFragmentForBlock(workspace, workspace.newBlock('noodl_define_input'))).toBeNull();
    });
  });

  it('returns null for a disabled block rather than an empty `return ()`', () => {
    withWorkspace((workspace) => {
      const block = workspace.newBlock('math_number');
      block.setDisabledReason(true, 'manual');

      // `return ();` is a syntax error, so getting this wrong turns "this block is off" into
      // "the block could not be compiled" at the far end of the relay.
      expect(generateFragmentForBlock(workspace, block)).toBeNull();
    });
  });

  it('leaves the generator clean, so the next generation is not the last one\'s leftovers', () => {
    // `init`/`finish` are generator-global state. A fragment that leaked its definitions would
    // put `function mathRandomInt(...)` into the *next* Do It — and, worse, into the
    // `workspaceToCode` the debounce writes into the user's saved program.
    withWorkspace((workspace) => {
      generateFragmentForBlock(workspace, workspace.newBlock('math_random_int'));

      const plain = workspace.newBlock('math_number');
      plain.setFieldValue('7', 'NUM');

      expect(generateFragmentForBlock(workspace, plain).code).not.toContain('mathRandomInt');
    });
  });

  it('does not disturb what the workspace saves', () => {
    // 🔴 The defect this task is most likely to produce is a decoration that reaches the saved
    // program. Generation is the half that runs on every right-click, so it is graded here:
    // serialise, generate, serialise again, compare. The balloon's half of the same claim
    // needs a rendered workspace and is in `## Deferred verification`.
    withWorkspace((workspace) => {
      const block = workspace.newBlock('math_random_int');
      const before = JSON.stringify(Blockly.serialization.workspaces.save(workspace));

      generateFragmentForBlock(workspace, block);

      expect(JSON.stringify(Blockly.serialization.workspaces.save(workspace))).toBe(before);
    });
  });
});

describe('LGC-002 §3 — when the balloons stop being true', () => {
  function event(type: string, extra: Record<string, unknown> = {}) {
    return { type, isUiEvent: false, ...extra } as unknown as Blockly.Events.Abstract;
  }

  it('dismisses on a created, deleted or edited block', () => {
    expect(invalidatesBalloons(event(Blockly.Events.BLOCK_CREATE))).toBe(true);
    expect(invalidatesBalloons(event(Blockly.Events.BLOCK_DELETE))).toBe(true);
    expect(invalidatesBalloons(event(Blockly.Events.BLOCK_CHANGE))).toBe(true);
  });

  it('does NOT dismiss on a drag that only moves a block around', () => {
    // The balloon is a child of the block's own SVG group, so it travels with the block and
    // stays correct. Dismissing here would make Do It unusable at the exact moment a builder
    // is rearranging blocks to understand them.
    expect(invalidatesBalloons(event(Blockly.Events.BLOCK_MOVE, { oldParentId: 'a', newParentId: 'a' }))).toBe(false);
    expect(
      invalidatesBalloons(event(Blockly.Events.BLOCK_MOVE, { oldParentId: undefined, newParentId: undefined }))
    ).toBe(false);
  });

  it('DOES dismiss on a move that connects or disconnects', () => {
    // Connecting changes what every block above computes, and `BLOCK_MOVE` is how Blockly
    // reports it — the same event, telling two entirely different stories.
    expect(invalidatesBalloons(event(Blockly.Events.BLOCK_MOVE, { oldParentId: undefined, newParentId: 'b' }))).toBe(
      true
    );
    expect(invalidatesBalloons(event(Blockly.Events.BLOCK_MOVE, { oldParentId: 'b', newParentId: undefined }))).toBe(
      true
    );
  });

  it('ignores UI events entirely', () => {
    const click = { type: Blockly.Events.CLICK, isUiEvent: true } as unknown as Blockly.Events.Abstract;

    expect(invalidatesBalloons(click)).toBe(false);
  });
});

describe('LGC-002 §4 — what the balloon says', () => {
  it('shows the value in the dialect the viewer sent', () => {
    expect(answerForReply({ ok: true, value: '"hello"' })).toEqual({ state: 'value', text: '"hello"', note: undefined });
  });

  it('shows `undefined` rather than an empty balloon when a block computes nothing', () => {
    expect(answerForReply({ ok: true }).text).toBe('undefined');
  });

  it('shows the error, in the error state', () => {
    const answer = answerForReply({ ok: false, error: 'nope is not defined', errorPhase: 'run' });

    expect(answer.state).toBe('error');
    expect(answer.text).toBe('nope is not defined');
  });

  it('never leaves an error balloon empty', () => {
    // A failure with no message is the silence §4 exists to stop. The runtime guarantees a
    // message; this is the second belt, because the wire is between them.
    expect(answerForReply({ ok: false }).text.length).toBeGreaterThan(10);
    expect(answerForReply({ ok: false, error: '' }).text.length).toBeGreaterThan(10);
  });

  it('says when it swallowed a signal, rather than eating it quietly', () => {
    const answer = answerForReply({ ok: true, value: '1', suppressedSignals: ['done', 'next'] });

    expect(answer.note).toContain('"done"');
    expect(answer.note).toContain('"next"');
  });

  it('says so on the failure branch too', () => {
    expect(answerForReply({ ok: false, error: 'boom', suppressedSignals: ['done'] }).note).toContain('"done"');
  });
});

describe('LGC-002 §3 — the balloon stays a readable size', () => {
  it('wraps a long preview by character, because previews have no spaces to break at', () => {
    const lines = wrapPreview('{alpha:1,beta:2,gamma:3,delta:4,epsilon:5,zeta:6}', 10, 7);

    expect(lines[0]).toBe('{alpha:1,b');
    expect(lines.every((line) => line.length <= 10)).toBe(true);
  });

  it('caps the number of lines and marks that it did', () => {
    const lines = wrapPreview('x'.repeat(500), 10, 3);

    expect(lines).toHaveLength(3);
    expect(lines[2].endsWith('…')).toBe(true);
  });

  it('shows something for an empty string rather than a balloon with no content', () => {
    expect(wrapPreview('')).toEqual(['(empty)']);
  });

  it('leaves a value that already fits alone', () => {
    expect(wrapPreview('42')).toEqual(['42']);
  });
});
