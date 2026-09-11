/**
 * LGC-009 §1 — the hat, and acceptance criterion 1.
 *
 * ## What is graded here
 *
 * 1. **The shape.** A block with a `next`, no `previous` and no output — the row the
 *    `disableOrphans` finding's table said was missing from all 15 of them, and the reason every
 *    Noodl program matched a predicate that means "unreachable code".
 * 2. **Criterion 1, by generating both and diffing**, not by reading the generator. *"A program
 *    with a hat generates the same code as today's equivalent hatless program"* is a claim about
 *    a string, so the fixture is generated flat, then migrated, then generated again, and the two
 *    strings are compared byte for byte. Twice: bare, and with LGC-003's probes installed, because
 *    the probes are what a hat could most plausibly perturb — a hat that emitted a `__s(…)` would
 *    add a mark for a block that is not a statement of the program.
 *
 * ⚠️ Real headless Blockly with the real blocks and the real generator, for `do-it.spec.ts`'s
 * reason: every claim here is a claim about Blockly's behaviour, and asserting it against a
 * re-implementation of Blockly's rules would pass around the defect rather than catch it.
 */

import * as Blockly from 'blockly';

import { HAT_BLOCK_TYPE, DEFAULT_HAT_SIGNAL } from '@noodl/runtime/src/nodes/std-library/logic-builder-io';

import { withBlockProbes } from '../../src/editor/src/views/BlocklyEditor/BlockProbes';
import { initNoodlBlocks } from '../../src/editor/src/views/BlocklyEditor/NoodlBlocks';
import { generateCode, initNoodlGenerators } from '../../src/editor/src/views/BlocklyEditor/NoodlGenerators';
import { ensureHatsInJson } from '../../src/editor/src/views/BlocklyEditor/hatMigration';
import { buildToolbox } from '../../src/editor/src/views/BlocklyEditor/BlocklyToolbox';
import { DRIVE_WORKSPACE } from './fixtures';

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

/** Load a serialised program and generate it, exactly as `flushSave` does. */
function generateFrom(json: string): string {
  return withWorkspace((workspace) => {
    Blockly.serialization.workspaces.load(JSON.parse(json), workspace);
    return generateCode(workspace as Blockly.WorkspaceSvg);
  });
}

function generateProbedFrom(json: string): { code: string; probedIds: string[] } {
  return withWorkspace((workspace) => {
    Blockly.serialization.workspaces.load(JSON.parse(json), workspace);
    const probed = withBlockProbes(() => generateCode(workspace as Blockly.WorkspaceSvg));
    return { code: probed.result, probedIds: [...probed.probedIds].sort() };
  });
}

describe('LGC-009 §1 — the shape the grammar was missing', () => {
  it('has a next, no previous and no output — the one row the finding\'s table had none of', () => {
    withWorkspace((workspace) => {
      const hat = workspace.newBlock(HAT_BLOCK_TYPE);

      expect(hat.nextConnection).toBeTruthy();
      expect(hat.previousConnection).toBeNull();
      expect(hat.outputConnection).toBeNull();
    });
  });

  it('is drawn as a hat, which is Blockly\'s own opt-in rather than a theme guess', () => {
    withWorkspace((workspace) => {
      expect((workspace.newBlock(HAT_BLOCK_TYPE) as unknown as { hat?: string }).hat).toBe('cap');
    });
  });

  it('names the node\'s built-in `run` signal by default', () => {
    withWorkspace((workspace) => {
      expect(workspace.newBlock(HAT_BLOCK_TYPE).getFieldValue('NAME')).toBe(DEFAULT_HAT_SIGNAL);
    });
  });

  it('is the first block in the Signals category, where a beginner opens first', () => {
    const toolbox = buildToolbox() as unknown as {
      contents: { name?: string; contents?: { type: string }[] }[];
    };
    const signals = toolbox.contents.find((c) => c.contents && c.contents.some((b) => b.type === HAT_BLOCK_TYPE));

    expect(signals).toBeTruthy();
    expect(signals!.contents![0].type).toBe(HAT_BLOCK_TYPE);
  });

  it('accepts a statement under it, and refuses to sit under one', () => {
    withWorkspace((workspace) => {
      const hat = workspace.newBlock(HAT_BLOCK_TYPE);
      const statement = workspace.newBlock('noodl_define_input');

      hat.nextConnection!.connect(statement.previousConnection!);
      expect(statement.getParent()).toBe(hat);

      // Nothing to connect *to* — which is what makes "orphan" mean something in this grammar.
      expect(hat.previousConnection).toBeNull();
    });
  });
});

describe('LGC-009 acceptance criterion 1 — a hatted program generates what the hatless one did', () => {
  const hatted = ensureHatsInJson(DRIVE_WORKSPACE)!;

  it('migrated the fixture at all, so the comparison below is not comparing a string to itself', () => {
    expect(hatted).not.toBe(DRIVE_WORKSPACE);
    expect(JSON.parse(hatted).blocks.blocks[0].type).toBe(HAT_BLOCK_TYPE);
  });

  it('generates a byte-identical program', () => {
    const before = generateFrom(DRIVE_WORKSPACE);

    expect(before).toContain('Outputs["total"]');
    expect(generateFrom(hatted)).toBe(before);
  });

  it('generates a byte-identical *instrumented* program, with the same probed ids', () => {
    const before = generateProbedFrom(DRIVE_WORKSPACE);
    const after = generateProbedFrom(hatted);

    expect(after.code).toBe(before.code);
    // The hat contributes no probe: it is not a statement of the program, so a mark for it would
    // report a block that never ran as having run. `suppressPrefixSuffix`, via
    // `DECLARATION_BLOCK_TYPES`.
    expect(after.probedIds).toEqual(before.probedIds);
    expect(after.probedIds.some((id) => id.startsWith('hat-'))).toBe(false);
  });

  it('emits nothing for the hat itself, even at the top of an empty program', () => {
    withWorkspace((workspace) => {
      workspace.newBlock(HAT_BLOCK_TYPE);
      expect(generateCode(workspace as Blockly.WorkspaceSvg)).toBe('');
    });
  });

  /**
   * 🔴 A pre-existing LGC-003 defect that the hat escalates from occasional to universal, so it
   * is pinned here rather than filed.
   *
   * `withBlockProbes` decided "this block emitted code" with `generated !== ''`, and
   * `blockToCode` returns a statement's code **plus its whole `next` chain**. So a block that
   * emits nothing itself was counted whenever anything was stacked under it — it landed in
   * `probedIds`, could never appear in a run frame (it emits no `__s`), and `markFor` therefore
   * painted it **hollow on every run**. `block-probes.spec.ts` misses it because its `Define
   * input` is a separate top-level block rather than the head of a stack.
   *
   * The hat is the head of *every* stack from now on, which is how this was noticed.
   */
  it('never lets a block that emits no probe be painted hollow — hat or Define, chain head or not', () => {
    withWorkspace((workspace) => {
      Blockly.serialization.workspaces.load(JSON.parse(hatted), workspace);
      const probed = withBlockProbes(() => generateCode(workspace as Blockly.WorkspaceSvg));

      // `hat-defPrice000000000001` is the id the migration gives the fixture's hat.
      expect([...probed.probedIds].filter((id) => id.startsWith('hat-'))).toEqual([]);
      // …and the `Define input` directly beneath it, which is the same defect one block down.
      expect(probed.probedIds.has('defPrice000000000001')).toBe(false);
      expect(probed.probedIds.has('defRun00000000000001')).toBe(false);
      // The blocks that really do emit statements are still there, or the assertion above would
      // pass on an empty set.
      expect(probed.probedIds.has('setTotal000000000001')).toBe(true);
      expect(probed.probedIds.has('sendDone000000000001')).toBe(true);
    });
  });

  it('keeps two independent stacks in their positional order once both are hatted', () => {
    // `workspaceToCode` iterates `getTopBlocks(true)`, which sorts by y then x. A hat that
    // inherits its stack's coordinates preserves that order; one that did not, or a migration
    // that joined the stacks, would reorder the program silently.
    const twoStacks = JSON.stringify({
      blocks: {
        languageVersion: 0,
        blocks: [
          { type: 'noodl_set_output', id: 'lower', x: 10, y: 300, fields: { NAME: 'second' } },
          { type: 'noodl_set_output', id: 'upper', x: 10, y: 10, fields: { NAME: 'first' } }
        ]
      }
    });

    const before = generateFrom(twoStacks);
    expect(before.indexOf('"first"')).toBeLessThan(before.indexOf('"second"'));
    expect(generateFrom(ensureHatsInJson(twoStacks)!)).toBe(before);
  });
});
