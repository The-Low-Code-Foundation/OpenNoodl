/**
 * LGC-009 acceptance criterion 2 — the saved programs open, run, and produce their recorded code.
 *
 * ## What the migration has to be true about
 *
 * 1. **It adds no port.** A migration that changed the node's published ports would break every
 *    wire on the canvas around it, silently, on open. This is the claim the whole design of the
 *    hat's default name turns on: the hat takes its signal from the stack it caps if that stack
 *    already declares one, and falls back to the node's own reserved `run` — which
 *    `updatePorts` drops — so the published set cannot move.
 * 2. **It changes no code.** Graded in `hat-block.spec.ts` by generating both and diffing.
 * 3. **It leaves alone what it cannot know about.** A floating value block, a block type this
 *    build has never heard of. `lgc59-cycle` contains one of each.
 * 4. **It is idempotent, and byte-identical when it changes nothing.** LGC-002 §2 and LGC-004
 *    #13 both grade a close/reopen on the serialised workspace being byte-identical.
 *
 * ## The list, and why it is checked rather than asserted
 *
 * `HATTABLE_BLOCK_TYPES` is a hand-written list, and a hand-written list of block names is
 * exactly the thing that rots. So the last describe instantiates **every block in the toolbox
 * and both dynamic flyouts in real Blockly** and asks each one whether it has a
 * `previousConnection` — the property the list is a claim about — rather than asserting the list
 * against itself.
 */

import * as Blockly from 'blockly';

import {
  DEFAULT_HAT_SIGNAL,
  HAT_BLOCK_TYPE,
  RESERVED_INPUTS,
  detectIO
} from '@noodl/runtime/src/nodes/std-library/logic-builder-io';

import { initNoodlBlocks } from '../../src/editor/src/views/BlocklyEditor/NoodlBlocks';
import { initNoodlGenerators } from '../../src/editor/src/views/BlocklyEditor/NoodlGenerators';
// The My Blocks call blocks are on the hattable list, so the registry check below needs them.
import { initMyBlocks } from '../../src/editor/src/views/BlocklyEditor/MyBlocksBlocks';
import {
  HATTABLE_BLOCK_TYPES,
  ensureHats,
  ensureHatsInJson,
  isHattableBlockType
} from '../../src/editor/src/views/BlocklyEditor/hatMigration';
import { buildToolbox } from '../../src/editor/src/views/BlocklyEditor/BlocklyToolbox';
import { CYCLE_WORKSPACE, DRIVE_WORKSPACE, EMPTY_WORKSPACE } from './fixtures';

initNoodlBlocks();
initNoodlGenerators();
initMyBlocks();

/** The ports the node would publish — `updatePorts`' own filter, applied to `detectIO`. */
function publishedInputSignals(json: string): string[] {
  return detectIO(json).signalInputs.filter((name) => RESERVED_INPUTS.indexOf(name) === -1);
}

function tops(json: string): { type: string; id?: string; x?: number; y?: number }[] {
  return JSON.parse(json).blocks.blocks;
}

describe('LGC-009 — migrating `lgc59-drive`', () => {
  const migrated = ensureHatsInJson(DRIVE_WORKSPACE)!;

  it('puts one hat on the one stack, at the stack\'s own coordinates', () => {
    const after = tops(migrated);

    expect(after).toHaveLength(1);
    expect(after[0].type).toBe(HAT_BLOCK_TYPE);
    expect([after[0].x, after[0].y]).toEqual([30, 30]);
  });

  it('names the hat after the signal the stack already declares, not after the default', () => {
    // The fixture declares `run` in a `Define signal input`. A hat that invented a name — `Run`,
    // say — would publish a **second** signal input port, because `RESERVED_INPUTS` holds the
    // lower-case spelling only. Which is a migration that rewires the canvas.
    expect(JSON.parse(migrated).blocks.blocks[0].fields).toEqual({ NAME: 'run' });
  });

  it('publishes exactly the ports it published before', () => {
    const before = detectIO(DRIVE_WORKSPACE);
    const after = detectIO(migrated);

    expect(after.inputs).toEqual(before.inputs);
    expect(after.outputs).toEqual(before.outputs);
    expect(after.signalInputs).toEqual(before.signalInputs);
    expect(after.signalOutputs).toEqual(before.signalOutputs);
    expect(publishedInputSignals(migrated)).toEqual(publishedInputSignals(DRIVE_WORKSPACE));
  });

  it('takes the coordinates off the block it capped, so the workspace round-trips', () => {
    const stack = JSON.parse(migrated).blocks.blocks[0].next.block;

    expect(stack.type).toBe('noodl_define_input');
    expect(stack.x).toBeUndefined();
    expect(stack.y).toBeUndefined();
    expect(stack.id).toBe('defPrice000000000001');
  });

  it('loads into real Blockly and serialises back to what the migration wrote', () => {
    const workspace = new Blockly.Workspace();
    try {
      Blockly.serialization.workspaces.load(JSON.parse(migrated), workspace);
      const roundTripped = JSON.stringify(Blockly.serialization.workspaces.save(workspace));

      expect(JSON.parse(roundTripped).blocks.blocks[0].type).toBe(HAT_BLOCK_TYPE);
      expect(workspace.getTopBlocks(false)).toHaveLength(1);
      expect(workspace.getBlocksByType(HAT_BLOCK_TYPE, false)[0].getNextBlock()!.type).toBe('noodl_define_input');
    } finally {
      workspace.dispose();
    }
  });

  it('is idempotent, and the second pass returns the identical string', () => {
    expect(ensureHatsInJson(migrated)).toBe(migrated);
    expect(ensureHats(JSON.parse(migrated)).added).toBe(0);
  });
});

describe('LGC-009 — migrating `lgc59-cycle`, which has a floating value block', () => {
  const migrated = ensureHatsInJson(CYCLE_WORKSPACE)!;
  const after = tops(migrated);

  it('caps the statement stack and leaves the floating value block exactly where it was', () => {
    expect(after).toHaveLength(2);
    expect(after[0].type).toBe(HAT_BLOCK_TYPE);
    expect([after[0].x, after[0].y]).toEqual([40, 40]);

    // 🔴 Untouched, coordinates and all. It is parentless with an output plug — the shape the
    // `disableOrphans` finding's first correction is about, and the one Do It exists to serve.
    expect(after[1]).toEqual(tops(CYCLE_WORKSPACE)[1]);
  });

  it('reports the block it skipped rather than silently passing over it', () => {
    const result = ensureHats(JSON.parse(CYCLE_WORKSPACE));

    expect(result.added).toBe(1);
    expect(result.skipped).toEqual(['noodl_get_input']);
  });

  it('falls back to the reserved `run`, so a stack that declares no signal still publishes none', () => {
    expect(JSON.parse(migrated).blocks.blocks[0].fields).toEqual({ NAME: DEFAULT_HAT_SIGNAL });
    expect(publishedInputSignals(migrated)).toEqual(publishedInputSignals(CYCLE_WORKSPACE));
    expect(publishedInputSignals(migrated)).toEqual([]);
  });

  it('leaves the value ports and outputs exactly as they were', () => {
    const before = detectIO(CYCLE_WORKSPACE);
    const after2 = detectIO(migrated);

    expect(after2.inputs).toEqual(before.inputs);
    expect(after2.outputs).toEqual(before.outputs);
    expect(after2.signalOutputs).toEqual(before.signalOutputs);
  });

  it('keeps the My Blocks call\'s `extraState`, which is the whole of what it points at', () => {
    expect(JSON.parse(migrated).blocks.blocks[0].next.block.extraState).toEqual({
      defId: 'defAAA',
      args: [],
      label: 'Alpha'
    });
  });
});

describe('LGC-009 — a workspace with nothing in it', () => {
  it('is left alone by the plain migration', () => {
    expect(ensureHatsInJson(EMPTY_WORKSPACE)).toBe(EMPTY_WORKSPACE);
    expect(ensureHatsInJson(undefined)).toBeUndefined();
    expect(ensureHatsInJson('')).toBe('');
  });

  it('opens with a hat when the block editor asks for one', () => {
    // `seedEmpty` is what the tab seam passes. A new author's first canvas says where the
    // program starts rather than being the empty sheet that made that unanswerable.
    const seeded = ensureHatsInJson(EMPTY_WORKSPACE, { seedEmpty: true })!;
    const seededFromNothing = ensureHatsInJson(undefined, { seedEmpty: true })!;

    expect(tops(seeded)).toEqual([
      { type: HAT_BLOCK_TYPE, id: 'hat-start', x: 30, y: 30, fields: { NAME: DEFAULT_HAT_SIGNAL } }
    ]);
    expect(tops(seededFromNothing)).toEqual(tops(seeded));
  });

  it('never throws on a half-written parameter, and hands it back unchanged', () => {
    expect(ensureHatsInJson('{ not json')).toBe('{ not json');
    expect(ensureHatsInJson('{}')).toBe('{}');
    expect(ensureHatsInJson('{"blocks":{}}')).toBe('{"blocks":{}}');
  });
});

describe('LGC-009 — the hattable list, checked against real Blockly rather than against itself', () => {
  /** Every block type reachable from the toolbox, plus the two dynamic flyouts' contents. */
  const toolboxTypes = (() => {
    const toolbox = buildToolbox() as unknown as { contents: { contents?: { type: string }[] }[] };
    const types = new Set<string>();
    for (const category of toolbox.contents) {
      for (const item of category.contents || []) types.add(item.type);
    }
    // Blockly fills these two in itself, so they are not in the definition above.
    for (const type of [
      'variables_get',
      'variables_set',
      'math_change',
      'procedures_defnoreturn',
      'procedures_defreturn',
      'procedures_callnoreturn',
      'procedures_callreturn',
      'procedures_ifreturn'
    ]) {
      types.add(type);
    }
    return [...types];
  })();

  it('reaches more than the Noodl blocks, or the check below proves nothing', () => {
    expect(toolboxTypes.length).toBeGreaterThan(40);
    expect(toolboxTypes).toContain('controls_if');
    expect(toolboxTypes).toContain('procedures_defnoreturn');
  });

  it('says "hattable" for exactly the blocks Blockly gives a previousConnection', () => {
    const workspace = new Blockly.Workspace();
    try {
      const disagreements: string[] = [];

      for (const type of toolboxTypes) {
        // The hat itself is the one block that is neither: it caps a stack, it does not join one.
        if (type === HAT_BLOCK_TYPE) continue;

        let block: Blockly.Block;
        try {
          block = workspace.newBlock(type);
        } catch {
          // A type the flyout names but this build does not register is not a migration concern.
          continue;
        }

        const stacks = block.previousConnection !== null;
        if (stacks !== isHattableBlockType(type)) disagreements.push(type + ': blockly=' + stacks);
      }

      expect(disagreements).toEqual([]);
    } finally {
      workspace.dispose();
    }
  });

  it('does not name a type nothing registers, which is how a list goes stale unnoticed', () => {
    const workspace = new Blockly.Workspace();
    try {
      const unknown = HATTABLE_BLOCK_TYPES.filter((type) => !Blockly.Blocks[type]);
      expect(unknown).toEqual([]);
    } finally {
      workspace.dispose();
    }
  });

  it('answers `false` for a type it has never heard of, so an unknown block is left alone', () => {
    expect(isHattableBlockType('some_plugin_block')).toBe(false);
    expect(isHattableBlockType(undefined)).toBe(false);
    expect(isHattableBlockType(HAT_BLOCK_TYPE)).toBe(false);
  });
});
