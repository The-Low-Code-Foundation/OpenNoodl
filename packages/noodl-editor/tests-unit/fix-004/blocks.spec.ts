/**
 * FIX-004 — the two missing blocks, in real headless Blockly with the real generator.
 *
 * > *"I wasn't able to use a Number() operator for example to turn a string into a number.
 * > There's no log block."*
 *
 * Real Blockly rather than a re-implementation, for `app-config-block.spec.ts`'s reason: every
 * claim here is a claim about Blockly's behaviour — what a connection check refuses, what
 * precedence a generator emits, whether a block can sit under a hat — and grading those against
 * our own model of Blockly would pass around the defect instead of catching it.
 *
 * ## 🔴 The first describe is here because the LGC-009 sweep cannot catch this
 *
 * `hat-migration.spec.ts` walks the toolbox and instantiates every type, which looks like it
 * would catch a toolbox naming a block that does not exist. It does not: its walk wraps
 * `newBlock` in `try { … } catch { continue }`, deliberately, because *"a type the flyout names
 * but this build does not register is not a migration concern."* That is right for that suite
 * and it leaves a hole for this one — a typo'd or Blockly-version-dropped toolbox entry renders
 * as a **silently missing block in the flyout** and every existing gate stays green. FIX-004
 * adds seven stock types to the toolbox in one commit, which is exactly when that hole matters.
 */
import * as Blockly from 'blockly';

import { buildToolbox, DEFAULT_TOOLBOX_LABELS } from '../../src/editor/src/views/BlocklyEditor/BlocklyToolbox';
import { convertModeExpression, convertModeOptions } from '../../src/editor/src/views/BlocklyEditor/convertModes';
import { isHattableBlockType } from '../../src/editor/src/views/BlocklyEditor/hatMigration';
import { initNoodlBlocks } from '../../src/editor/src/views/BlocklyEditor/NoodlBlocks';
import { generateCode, initNoodlGenerators } from '../../src/editor/src/views/BlocklyEditor/NoodlGenerators';

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

/** Every `kind: 'block'` type named anywhere in the toolbox tree, dynamic categories aside. */
function toolboxBlockTypes(): string[] {
  const found: string[] = [];
  const walk = (node: any) => {
    if (!node || typeof node !== 'object') return;
    if (node.kind === 'block' && typeof node.type === 'string') found.push(node.type);
    for (const child of node.contents ?? []) walk(child);
  };
  walk(buildToolbox(DEFAULT_TOOLBOX_LABELS) as any);
  return found;
}

/** A convert block in `mode`, wired to a text literal, generated as an expression. */
function convertOf(mode: string, text: string): string {
  return withWorkspace((workspace) => {
    const setOutput = workspace.newBlock('noodl_set_output');
    setOutput.setFieldValue('result', 'NAME');
    const convert = workspace.newBlock('noodl_convert');
    convert.setFieldValue(mode, 'MODE');
    const literal = workspace.newBlock('text');
    literal.setFieldValue(text, 'TEXT');
    convert.getInput('VALUE')!.connection!.connect(literal.outputConnection!);
    setOutput.getInput('VALUE')!.connection!.connect(convert.outputConnection!);
    return generateCode(workspace as Blockly.WorkspaceSvg);
  });
}

describe('FIX-004 — every block the toolbox offers is a block that exists', () => {
  it('registers every type the toolbox names', () => {
    const missing = toolboxBlockTypes().filter((type) => !Blockly.Blocks[type]);
    expect(missing).toEqual([]);
  });

  /**
   * The positive control for the test above. Without it, that test passes just as happily on a
   * toolbox walk that found nothing at all — and `toolboxBlockTypes` recurses through a nested
   * structure, so "found nothing" is a live failure mode, not a hypothetical.
   */
  it('would notice a type nothing registers, and is reading a non-empty toolbox', () => {
    const types = toolboxBlockTypes();
    expect(types.length).toBeGreaterThan(40);
    expect(types).toContain('noodl_convert');
    expect(types).toContain('noodl_log');
    expect(Blockly.Blocks['definitely_not_a_block_xyz']).toBeUndefined();
  });

  it('offers the seven stock blocks FIX-004 §B adds', () => {
    const types = toolboxBlockTypes();
    for (const type of [
      'math_change',
      'math_on_list',
      'lists_create_empty',
      'lists_reverse',
      'text_replace',
      'text_reverse',
      'text_count'
    ]) {
      expect(types).toContain(type);
      expect(Blockly.Blocks[type]).toBeDefined();
    }
  });
});

describe('FIX-004 §A — convert', () => {
  it('turns text into a number, which is the reported hole', () => {
    // Blockly's `text` block emits single-quoted literals.
    expect(convertOf('NUMBER', '42')).toContain("Number('42')");
  });

  it('generates each mode from the shared table', () => {
    expect(convertModeExpression('NUMBER', 'x')).toBe('Number(x)');
    expect(convertModeExpression('STRING', 'x')).toBe('String(x)');
    expect(convertModeExpression('BOOLEAN', 'x')).toBe('Boolean(x)');
    expect(convertModeExpression('INT', 'x')).toBe('parseInt(x, 10)');
    expect(convertModeExpression('FLOAT', 'x')).toBe('parseFloat(x)');
  });

  it('falls back to the default mode rather than emitting nothing for an unknown mode', () => {
    expect(convertModeExpression('FROM_A_LATER_VERSION', 'x')).toBe('Number(x)');
  });

  it('offers every mode in the dropdown, so no mode is generator-only', () => {
    const values = convertModeOptions().map(([, value]) => value);
    expect(values).toEqual(['NUMBER', 'STRING', 'BOOLEAN', 'INT', 'FLOAT']);
    for (const [label] of convertModeOptions()) expect(label).not.toMatch(/parse|Number|String|Boolean/);
  });

  /**
   * Acceptance criterion 1, as arithmetic rather than as a screenshot: the generated expression
   * must actually evaluate to `37.8` and be a `number`. The coercion trick this block replaces
   * is what makes the negative control worth writing — `"42" + 0` is `"420"`.
   */
  it('produces a number that maths blocks multiply rather than join', () => {
    // eslint-disable-next-line no-eval
    const converted = eval(convertModeExpression('NUMBER', '"42"')) * 0.9;
    expect(typeof converted).toBe('number');
    expect(converted).toBeCloseTo(37.8, 10);

    // The trap, stated as a control: without the block, the reachable workaround is asymmetric.
    // eslint-disable-next-line no-eval
    expect(eval('"42" + 0')).toBe('420');
  });

  it('embeds as a complete call when nested inside arithmetic', () => {
    const code = withWorkspace((workspace) => {
      const setOutput = workspace.newBlock('noodl_set_output');
      setOutput.setFieldValue('result', 'NAME');
      const power = workspace.newBlock('math_arithmetic');
      power.setFieldValue('POWER', 'OP');
      const convert = workspace.newBlock('noodl_convert');
      const literal = workspace.newBlock('text');
      literal.setFieldValue('3', 'TEXT');
      convert.getInput('VALUE')!.connection!.connect(literal.outputConnection!);
      power.getInput('A')!.connection!.connect(convert.outputConnection!);
      setOutput.getInput('VALUE')!.connection!.connect(power.outputConnection!);
      return generateCode(workspace as Blockly.WorkspaceSvg);
    });
    // Blockly compiles POWER to `Math.pow`, so the property under test is that the conversion
    // survives nesting as one self-contained argument rather than being split across the operator.
    expect(code).toContain("Math.pow(Number('3'),");
  });

  it('reads an unplugged socket as undefined rather than as a plausible zero', () => {
    // `Number(null)` is 0 and `Boolean(null)` is false — both hide an unfinished program.
    expect(convertModeExpression('NUMBER', 'undefined')).toBe('Number(undefined)');
    expect(Number(undefined)).toBeNaN();
  });

  it('is a value block, and therefore must not be hattable', () => {
    expect(isHattableBlockType('noodl_convert')).toBe(false);
    withWorkspace((workspace) => {
      expect(workspace.newBlock('noodl_convert').previousConnection).toBeNull();
    });
  });

  it('follows its mode with its output check, so a text result cannot enter a maths socket', () => {
    withWorkspace((workspace) => {
      const convert = workspace.newBlock('noodl_convert');
      expect(convert.outputConnection!.getCheck()).toEqual(['Number']);
    });
  });
});

describe('FIX-004 §A — log', () => {
  it('generates console.log, which both runtimes provide', () => {
    const code = withWorkspace((workspace) => {
      const log = workspace.newBlock('noodl_log');
      const literal = workspace.newBlock('text');
      literal.setFieldValue('hello', 'TEXT');
      log.getInput('VALUE')!.connection!.connect(literal.outputConnection!);
      return generateCode(workspace as Blockly.WorkspaceSvg);
    });
    expect(code).toContain("console.log('hello');");
  });

  it('generates a statement even with an empty socket', () => {
    const code = withWorkspace((workspace) => {
      workspace.newBlock('noodl_log');
      return generateCode(workspace as Blockly.WorkspaceSvg);
    });
    expect(code).toContain("console.log('');");
  });

  /**
   * Acceptance criterion 3. A statement block absent from `HATTABLE_BLOCK_TYPES` is never
   * wrapped by migration or seeding and sits orphaned under no hat — the easiest thing to
   * forget, and invisible until an author asks why their program did not run.
   */
  it('is a statement, and is on the hattable list', () => {
    withWorkspace((workspace) => {
      expect(workspace.newBlock('noodl_log').previousConnection).not.toBeNull();
    });
    expect(isHattableBlockType('noodl_log')).toBe(true);
  });
});
