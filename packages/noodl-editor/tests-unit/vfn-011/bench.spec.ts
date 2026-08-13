/**
 * VFN-011 Part 2 — the bench: what it holds, what it sends, and what it must never write.
 *
 * The drift gate (`drift-gate.spec.ts`) grades the *execution*. This file grades everything around
 * it, and the two claims it exists for are the two standing constraints the task names:
 *
 *  1. 🔴 **The bench enumerates no ports.** Its rows are a projection of `RailModel`, which is
 *     `detectInterface`, which is a projection of `detectIO`'s one traversal. A bench "needs the
 *     inputs" and it is one line to write a second list; the test for having *not* written one is
 *     that a mutation to the workspace moves the bench's rows without anything telling it.
 *  2. 🔴 **Nothing about pressing Run writes to the program.** Acceptance criterion 8, and the one
 *     most likely to be quietly false: a bench that serialised its inputs into the saved workspace
 *     would change the program by testing it, and the diff would look like an ordinary edit.
 *
 * Both are graded against a **real Blockly workspace**, serialised the way `BlocklyWorkspace`
 * serialises it, because a hand-written `RailModel` would let both claims pass without either
 * mechanism existing.
 */

import * as Blockly from 'blockly';
import { javascriptGenerator } from 'blockly/javascript';

import { BenchController, DEFAULT_BENCH_TRIGGER } from '../../src/editor/src/views/BlocklyEditor/BenchController';
import {
  SANDBOX_NOTE,
  benchInputRows,
  benchInputsFor,
  benchOutputRows,
  benchRunNote,
  benchTriggers,
  coerceSandboxValue
} from '../../src/editor/src/views/BlocklyEditor/benchModel';
import { withBlockProbes } from '../../src/editor/src/views/BlocklyEditor/BlockProbes';
import { railModelForWorkspace } from '../../src/editor/src/views/BlocklyEditor/interfaceRails';
import type { RailModel } from '../../src/editor/src/views/BlocklyEditor/interfaceRails';
import type { BlockRunFrame } from '../../src/editor/src/views/BlocklyEditor/BlockValueTrace';
import { initNoodlBlocks } from '../../src/editor/src/views/BlocklyEditor/NoodlBlocks';
import { initNoodlGenerators } from '../../src/editor/src/views/BlocklyEditor/NoodlGenerators';

initNoodlBlocks();
initNoodlGenerators();

function defineInput(workspace: Blockly.Workspace, name: string, type: string): Blockly.Block {
  const block = workspace.newBlock('noodl_define_input');
  block.setFieldValue(name, 'NAME');
  block.setFieldValue(type, 'TYPE');
  return block;
}

function defineSignalInput(workspace: Blockly.Workspace, name: string): Blockly.Block {
  const block = workspace.newBlock('noodl_define_signal_input');
  block.setFieldValue(name, 'NAME');
  return block;
}

function getInput(workspace: Blockly.Workspace, name: string): Blockly.Block {
  const block = workspace.newBlock('noodl_get_input');
  block.setFieldValue(name, 'NAME');
  return block;
}

function setOutput(workspace: Blockly.Workspace, name: string, value: Blockly.Block): Blockly.Block {
  const block = workspace.newBlock('noodl_set_output');
  block.setFieldValue(name, 'NAME');
  block.getInput('VALUE')!.connection!.connect(value.outputConnection!);
  return block;
}

function doubled(workspace: Blockly.Workspace, of: Blockly.Block): Blockly.Block {
  const two = workspace.newBlock('math_number');
  two.setFieldValue('2', 'NUM');
  const block = workspace.newBlock('math_arithmetic');
  block.setFieldValue('MULTIPLY', 'OP');
  block.getInput('A')!.connection!.connect(of.outputConnection!);
  block.getInput('B')!.connection!.connect(two.outputConnection!);
  return block;
}

/** The program the drive would use: `Define input amount (number)` → `set output doubled`. */
function buildDoubler(workspace: Blockly.Workspace): void {
  defineInput(workspace, 'amount', 'number');
  defineSignalInput(workspace, 'calculate');
  setOutput(workspace, 'doubled', doubled(workspace, getInput(workspace, 'amount')));
}

/** A controller wired the way `BlocklyWorkspace` wires it, with the DOM replaced by two arrays. */
function benchFor(workspace: Blockly.Workspace) {
  const frames: { frame: BlockRunFrame; note: string }[] = [];
  let repaints = 0;

  const controller = new BenchController({
    nodeId: 'node-1',
    model: (): RailModel => railModelForWorkspace(workspace),
    generate: () => {
      const probed = withBlockProbes(() => javascriptGenerator.workspaceToCode(workspace));
      return { code: probed.result, probedIds: probed.probedIds };
    },
    publish: (frame, note) => frames.push({ frame, note }),
    onChanged: () => repaints++
  });

  return { controller, frames, repaints: () => repaints };
}

describe('VFN-011 — reading a cell as the port\'s type', () => {
  it('honours a declared type and refuses what it cannot read, rather than coercing', () => {
    expect(coerceSandboxValue('12', 'number')).toEqual({ value: 12 });
    // 🔴 `Number("abc")` is `NaN`. A bench that quietly ran the program with `NaN` in it would
    // answer confidently and wrongly, which is worse than not answering at all.
    expect(coerceSandboxValue('abc', 'number').problem).toBe('not a number');
    expect(coerceSandboxValue('abc', 'number').value).toBeUndefined();

    expect(coerceSandboxValue('true', 'boolean')).toEqual({ value: true });
    expect(coerceSandboxValue('no', 'boolean').problem).toBe('type true or false');

    expect(coerceSandboxValue('[1,2]', 'array')).toEqual({ value: [1, 2] });
    expect(coerceSandboxValue('{"a":1}', 'array').problem).toBe('not an array');
    expect(coerceSandboxValue('nonsense', 'object').problem).toBe('not valid JSON');
  });

  it('a string port gets the characters in the box, untrimmed and unparsed', () => {
    expect(coerceSandboxValue('  hello ', 'string')).toEqual({ value: '  hello ' });
    // Not the number 12, and not `true`: this port is declared `string`, and a bench that read a
    // digit as a number here would disagree with the app about what arrived.
    expect(coerceSandboxValue('12', 'string')).toEqual({ value: '12' });
    expect(coerceSandboxValue('true', 'string')).toEqual({ value: 'true' });
  });

  it('an undeclared port reads as JSON when it parses and as text when it does not', () => {
    // `'*'` is the common case: `get input` and `set output` always report it. The rule is the one
    // a person typing into a box would predict, and it is deliberately not an inference from the
    // blocks around the port.
    expect(coerceSandboxValue('12', '*')).toEqual({ value: 12 });
    expect(coerceSandboxValue('true', '*')).toEqual({ value: true });
    expect(coerceSandboxValue('[1]', '*')).toEqual({ value: [1] });
    expect(coerceSandboxValue('hello', '*')).toEqual({ value: 'hello' });
  });
});

describe('VFN-011 — 🔴 the bench reads the rails\' ports and does not enumerate its own', () => {
  it('an edit to the blocks moves the bench\'s rows, with nothing telling it', () => {
    const workspace = new Blockly.Workspace();
    try {
      buildDoubler(workspace);
      const { controller } = benchFor(workspace);

      expect(controller.inputRows().map((r) => r.row.name)).toEqual(['amount', 'calculate']);

      // A port added by a block, not by anything calling the bench. If the bench held its own list
      // this row would simply not appear — which is register L11's defect with a third noun, and
      // the one this task was told it was most likely to write.
      setOutput(workspace, 'tripled', getInput(workspace, 'rate'));

      expect(controller.inputRows().map((r) => r.row.name)).toEqual(['amount', 'calculate', 'rate']);
      expect(controller.outputRows().map((r) => r.row.name)).toEqual(['doubled', 'tripled']);
    } finally {
      workspace.dispose();
    }
  });

  it('carries the rails\' own facts about a row, rather than restating them', () => {
    const workspace = new Blockly.Workspace();
    try {
      buildDoubler(workspace);
      const model = railModelForWorkspace(workspace);
      const rows = benchInputRows(model, new Map());

      // Declared, typed and inferred are the rails' vocabulary and these are the rails' objects.
      expect(rows[0].row.declared).toBe(true);
      expect(rows[0].row.type).toBe('number');
      expect(rows[1].row.kind).toBe('signal');
      // A signal row never gets a value cell: a signal input *is* a run, which is the same
      // distinction `dragBlockJsonForRow` makes when it refuses to build a block for one.
      expect(rows[1].hasValue).toBe(false);
      expect(benchTriggers(model)).toEqual(['calculate']);
    } finally {
      workspace.dispose();
    }
  });

  it('sends only the ports with something in them, and leaves the rest off `Inputs`', () => {
    const workspace = new Blockly.Workspace();
    try {
      buildDoubler(workspace);
      const model = railModelForWorkspace(workspace);

      // ⚠️ Absent, not `undefined`. `Inputs` in the app is `_internal.inputValues`, which only
      // carries ports something wrote to — so `"amount" in Inputs` has to be false here too, and a
      // map of `undefined`s would look identical to every assertion except that one.
      expect(benchInputsFor(model, new Map())).toEqual({});
      expect('amount' in benchInputsFor(model, new Map())).toBe(false);

      expect(benchInputsFor(model, new Map([['amount', '21']]))).toEqual({ amount: 21 });
      // A cell that cannot be read as its type sends nothing rather than sending `NaN`.
      expect(benchInputsFor(model, new Map([['amount', 'abc']]))).toEqual({});
    } finally {
      workspace.dispose();
    }
  });
});

describe('VFN-011 — 🔴 criterion 8: nothing about the bench reaches the program', () => {
  it('typing values and pressing Run leaves the serialised workspace byte-identical', () => {
    const workspace = new Blockly.Workspace();
    try {
      buildDoubler(workspace);
      const before = JSON.stringify(Blockly.serialization.workspaces.save(workspace));

      const { controller, frames } = benchFor(workspace);
      controller.setText('amount', '21');
      controller.run('calculate');
      controller.setText('amount', '100');
      controller.run(DEFAULT_BENCH_TRIGGER);

      const after = JSON.stringify(Blockly.serialization.workspaces.save(workspace));

      // The claim, stated as bytes. `project.json` is one level up from here — the node's
      // `workspace` parameter *is* this string — so a bench that changed the program by testing it
      // would have to change this first.
      expect(after).toBe(before);

      // And the bench really ran, twice: an unchanged workspace is only evidence if something
      // happened beside it. This is the vacuous-pass this case would otherwise be.
      expect(frames).toHaveLength(2);
      expect(controller.lastRun()!.result.outputs).toEqual({ doubled: 200 });
    } finally {
      workspace.dispose();
    }
  });

  it('the values survive an edit; the last run\'s outputs do not', () => {
    const workspace = new Blockly.Workspace();
    try {
      buildDoubler(workspace);
      const { controller } = benchFor(workspace);

      controller.setText('amount', '21');
      controller.run('calculate');
      expect(controller.outputRows()[0].preview).toBe('42');

      // The program changed, so the value describes blocks that may no longer exist — the same
      // rule the badges and the Do It balloons follow. What the *builder* typed did not change and
      // is not dropped: a bench that emptied itself on every keystroke in a block would not be
      // worth reaching for.
      controller.invalidate();
      expect(controller.outputRows()[0].preview).toBeUndefined();
      expect(controller.inputRows()[0].text).toBe('21');
    } finally {
      workspace.dispose();
    }
  });
});

describe('VFN-011 — what a run produces, and what it says about itself', () => {
  it('a sandbox run fills the outputs rail and is marked as a sandbox run', () => {
    const workspace = new Blockly.Workspace();
    try {
      buildDoubler(workspace);
      const { controller, frames } = benchFor(workspace);

      controller.setText('amount', '4');
      controller.run('calculate');

      // Criterion 1, as far as a headless spec can reach it: a sandbox value in, a value on the
      // output row out, with no app running and nothing connected.
      const outputs = controller.outputRows();
      expect(outputs.map((r) => r.row.name)).toEqual(['doubled']);
      expect(outputs[0].preview).toBe('8');

      // Criterion 7: the frame is the viewer's shape plus a flag, so one history holds both and a
      // scrubbed-back run can still say which it was.
      expect(frames[0].frame.sandbox).toBe(true);
      expect(frames[0].note).toContain(SANDBOX_NOTE);
      expect(Object.keys(frames[0].frame.values).length).toBeGreaterThan(0);
    } finally {
      workspace.dispose();
    }
  });

  it('a program that throws reports the block that threw and does not take the bench with it', () => {
    const workspace = new Blockly.Workspace();
    try {
      // `null["name"]` — a `get object property` on nothing. The whole program is one statement, so
      // the statement that was executing is the one to name.
      const nothing = workspace.newBlock('logic_null');
      const property = workspace.newBlock('noodl_get_object_property');
      property.setFieldValue('name', 'PROPERTY');
      property.getInput('OBJECT')!.connection!.connect(nothing.outputConnection!);
      const statement = setOutput(workspace, 'result', property);

      const { controller, frames } = benchFor(workspace);
      expect(() => controller.run(DEFAULT_BENCH_TRIGGER)).not.toThrow();

      const result = controller.lastRun()!.result;
      expect(result.ok).toBe(false);
      expect(String(result.error)).toMatch(/null/i);
      // Criterion 5. `__s` announces a statement *before* it runs, so the last one announced is the
      // statement the throw happened inside — the strongest claim available without a try/catch per
      // expression, which would change what the program computes.
      expect(result.errorBlockId).toBe(statement.id);

      // The failed run is still in the scrubber, and still says what happened.
      expect(frames).toHaveLength(1);
      expect(frames[0].note).toContain('Sandbox run failed');
    } finally {
      workspace.dispose();
    }
  });

  it('a press with no blocks says so rather than doing nothing', () => {
    const workspace = new Blockly.Workspace();
    try {
      const { controller, frames } = benchFor(workspace);
      controller.run(DEFAULT_BENCH_TRIGGER);

      expect(controller.lastRun()!.result.ok).toBe(false);
      expect(controller.lastRun()!.result.error).toContain('no blocks to run');
      // A press that changed nothing at all is indistinguishable from a press that did not land —
      // LGC-002 learned that about a menu; this is the same sentence about a button.
      expect(frames).toHaveLength(1);
      expect(frames[0].frame.sandbox).toBe(true);
    } finally {
      workspace.dispose();
    }
  });

  it('Run fires the program\'s own first signal, or the node\'s built-in `run`', () => {
    const workspace = new Blockly.Workspace();
    try {
      buildDoubler(workspace);
      const { controller } = benchFor(workspace);
      expect(controller.defaultTrigger()).toBe('calculate');
    } finally {
      workspace.dispose();
    }

    const bare = new Blockly.Workspace();
    try {
      setOutput(bare, 'result', getInput(bare, 'a'));
      const { controller } = benchFor(bare);
      // ⚠️ Lower case, and it matters twice: it is `DEFAULT_HAT_SIGNAL`, so it matches the string
      // the node's own `Run` port passes, and it is in `RESERVED_INPUTS`, so it names a port the
      // node already has rather than minting one.
      expect(controller.defaultTrigger()).toBe('run');
      expect(DEFAULT_BENCH_TRIGGER).toBe('run');
    } finally {
      bare.dispose();
    }
  });

  it('a signal output the run pulsed shows on its row', () => {
    const workspace = new Blockly.Workspace();
    try {
      const send = workspace.newBlock('noodl_send_signal');
      send.setFieldValue('finished', 'NAME');

      const { controller } = benchFor(workspace);
      controller.run(DEFAULT_BENCH_TRIGGER);

      const rows = controller.outputRows();
      expect(rows.map((r) => r.row.name)).toEqual(['finished']);
      expect(rows[0].pulsed).toBe(true);
    } finally {
      workspace.dispose();
    }
  });
});

describe('VFN-011 — 🔴 NEGATIVE CONTROLS: each claim above can be made to fail', () => {
  it('the byte-identical check would catch a bench that wrote its values into the workspace', () => {
    const workspace = new Blockly.Workspace();
    try {
      buildDoubler(workspace);
      const before = JSON.stringify(Blockly.serialization.workspaces.save(workspace));

      // What a bench that "remembered its inputs with the program" would do — and note how
      // ordinary the resulting diff is: one more block, exactly like the ones around it. This is
      // the shape criterion 8 is about, built here so the instrument is known to see it.
      const remembered = workspace.newBlock('noodl_define_input');
      remembered.setFieldValue('amount', 'NAME');

      expect(JSON.stringify(Blockly.serialization.workspaces.save(workspace))).not.toBe(before);
    } finally {
      workspace.dispose();
    }
  });

  it('the derived-rows check would catch a bench that cached its port list', () => {
    const workspace = new Blockly.Workspace();
    try {
      buildDoubler(workspace);

      // A bench built the wrong way: the model read once, at construction. Every spec that only
      // checks the first render passes against this, which is why the case above mutates the
      // workspace *after* the controller exists.
      const cached = railModelForWorkspace(workspace);
      setOutput(workspace, 'tripled', getInput(workspace, 'rate'));

      const live = railModelForWorkspace(workspace);
      expect(benchInputRows(cached, new Map()).map((r) => r.row.name)).not.toEqual(
        benchInputRows(live, new Map()).map((r) => r.row.name)
      );
    } finally {
      workspace.dispose();
    }
  });

  it('the run note distinguishes a run that worked from one that did not', () => {
    // If both said the same thing the scrubber's note would be decoration, and criterion 7 would
    // be met by a string that is always present and never informative.
    expect(benchRunNote({ ok: true })).toContain(SANDBOX_NOTE);
    expect(benchRunNote({ ok: true })).not.toContain('failed');
    expect(benchRunNote({ ok: false, error: 'x is not a function' })).toContain('x is not a function');
  });

  it('an output row shows nothing when the run wrote nothing, not a stale value', () => {
    const workspace = new Blockly.Workspace();
    try {
      buildDoubler(workspace);
      const model = railModelForWorkspace(workspace);
      expect(benchOutputRows(model, {}, [])[0].preview).toBeUndefined();
      expect(benchOutputRows(model, { doubled: '8' }, [])[0].preview).toBe('8');
    } finally {
      workspace.dispose();
    }
  });
});
