/**
 * LGC-009 — what the hat buys back, measured at the model layer.
 *
 * ## 🔴 This is **not** acceptance criterion 4, and must not be read as it
 *
 * Criterion 4 says `Blockly.Events.disableOrphans` *can be re-registered* and that a hatted
 * program survives a drag — **driven, not asserted headlessly**, because *"the whole defect it
 * replaces was invisible to every spec in the phase"*. Nothing here registers the listener in the
 * editor; `BlocklyWorkspace.tsx` still carries its tombstone. What this file does is the same
 * thing the finding did, in the same place, with the sign flipped: it drives the **real**
 * `Events.disableOrphans` over a **real** headless workspace and shows that the hatless fixture
 * is destroyed and the hatted one is not.
 *
 * That is evidence the language change does what it was ruled for. It is not evidence the editor
 * behaves, and the two are not the same claim.
 *
 * ## Two harness notes, from the finding, so the next person does not lose the time twice
 *
 *  - Blockly fires change events **on a timeout**, not synchronously. A state read straight after
 *    `Events.fire` shows `ENABLED` and looks like a pass. Every test here drains first.
 *  - `isDragging` exists only on `WorkspaceSvg`, so headless `disableOrphans` throws
 *    `b.isDragging is not a function`. Stubbed to `() => false` — the correct value at the moment
 *    the listener matters, because a drag's `BlockMove` fires at drag *end*.
 */

import * as Blockly from 'blockly';

import { HAT_BLOCK_TYPE } from '@noodl/runtime/src/nodes/std-library/logic-builder-io';

import {
  ORPHANED_BLOCK_DISABLED_REASON,
  REASON_DISABLED,
  classifyBlockForDoIt
} from '../../src/editor/src/views/BlocklyEditor/DoIt';
import { initNoodlBlocks } from '../../src/editor/src/views/BlocklyEditor/NoodlBlocks';
import { generateCode, initNoodlGenerators } from '../../src/editor/src/views/BlocklyEditor/NoodlGenerators';
import { ensureHatsInJson } from '../../src/editor/src/views/BlocklyEditor/hatMigration';
import { DRIVE_WORKSPACE } from './fixtures';

initNoodlBlocks();
initNoodlGenerators();

/** Let Blockly's event queue drain, so the listener has actually run. */
function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 50));
}

function withWorkspace<T>(body: (workspace: Blockly.Workspace) => T): T {
  const workspace = newWatchableWorkspace();
  try {
    return body(workspace);
  } finally {
    workspace.dispose();
  }
}

/**
 * ⚠️ The async twin, and it is not a tidiness split.
 *
 * A synchronous `try/finally` around an `async` body disposes the workspace the moment the body
 * *returns its promise* — before a single `await` has resumed. Every assertion after the first
 * `await settle()` then runs against a disposed workspace, which reports **no disabled blocks and
 * no top blocks**: it looks like the hat working, and it is the harness lying. Cost: one debug
 * cycle, recorded here so it is not two.
 */
async function withWorkspaceAsync(body: (workspace: Blockly.Workspace) => Promise<void>): Promise<void> {
  const workspace = newWatchableWorkspace();
  try {
    await body(workspace);
  } finally {
    workspace.dispose();
  }
}

function newWatchableWorkspace(): Blockly.Workspace {
  const workspace = new Blockly.Workspace();
  // See the header. Without this, `disableOrphans` throws rather than running.
  (workspace as unknown as { isDragging: () => boolean }).isDragging = () => false;
  return workspace;
}

/** Load a program the way `BlocklyWorkspace` does, then arm the listener the finding is about. */
function loadAndWatch(workspace: Blockly.Workspace, json: string): void {
  try {
    // Events off during load, exactly as `BlocklyWorkspace.tsx` does it — and the finding is
    // explicit that a probe which omits this wrapper reports the opposite result, convincingly.
    Blockly.Events.disable();
    Blockly.serialization.workspaces.load(JSON.parse(json), workspace);
  } finally {
    Blockly.Events.enable();
  }
  workspace.addChangeListener(Blockly.Events.disableOrphans);
}

/** One user gesture: nudge the top block. */
function nudgeTopBlock(workspace: Blockly.Workspace): void {
  const top = workspace.getTopBlocks(true)[0];
  Blockly.Events.fire(new Blockly.Events.BlockMove(top));
}

function disabledReasonsInSave(workspace: Blockly.Workspace): string[] {
  return JSON.stringify(Blockly.serialization.workspaces.save(workspace)).includes('disabledReasons')
    ? ['ORPHANED_BLOCK present in the serialised workspace']
    : [];
}

describe('LGC-009 — the reason string, pinned against the library that sets it', () => {
  it('is exactly what the real `Events.disableOrphans` writes onto a block', async () => {
    // Blockly does not export this constant — `Blockly.constants` publishes `MANUALLY_DISABLED`
    // and two field names and nothing else — so `DoIt.ts` holds a string literal. This is what
    // stops a Blockly upgrade renaming it and silently un-fixing `classifyBlockForDoIt`.
    await withWorkspaceAsync(async (workspace) => {
      const floating = workspace.newBlock('math_number');
      workspace.addChangeListener(Blockly.Events.disableOrphans);
      Blockly.Events.fire(new Blockly.Events.BlockMove(floating));
      await settle();

      expect([...floating.getDisabledReasons()]).toEqual([ORPHANED_BLOCK_DISABLED_REASON]);
    });
  });
});

describe('LGC-009 — Do It survives the listener it used to be taken out by', () => {
  it('still offers a floating value block, which is the one shape the feature exists for', () => {
    withWorkspace((workspace) => {
      const floating = workspace.newBlock('math_arithmetic');
      floating.setDisabledReason(true, ORPHANED_BLOCK_DISABLED_REASON);

      expect(floating.isEnabled()).toBe(false);
      expect(classifyBlockForDoIt(floating)).toEqual({ offered: true });
    });
  });

  it('still refuses a block the author actually switched off', () => {
    withWorkspace((workspace) => {
      const block = workspace.newBlock('math_number');
      block.setDisabledReason(true, 'manual');

      expect(classifyBlockForDoIt(block)).toEqual({ offered: false, reason: REASON_DISABLED });
    });
  });

  it('refuses a block that is both orphaned and switched off — the orphan does not cancel the other', () => {
    withWorkspace((workspace) => {
      const block = workspace.newBlock('math_number');
      block.setDisabledReason(true, ORPHANED_BLOCK_DISABLED_REASON);
      block.setDisabledReason(true, 'manual');

      expect(classifyBlockForDoIt(block)).toEqual({ offered: false, reason: REASON_DISABLED });
    });
  });
});

describe('LGC-009 — the finding, reproduced and then inverted', () => {
  it('destroys the hatless fixture, exactly as the finding recorded', async () => {
    await withWorkspaceAsync(async (workspace) => {
      loadAndWatch(workspace, DRIVE_WORKSPACE);
      const before = generateCode(workspace as Blockly.WorkspaceSvg);
      expect(before).toContain('Outputs["total"]');

      nudgeTopBlock(workspace);
      await settle();

      // One gesture. The whole program, greyed, emptied and serialised that way.
      expect(generateCode(workspace as Blockly.WorkspaceSvg)).toBe('');
      expect(disabledReasonsInSave(workspace)).not.toEqual([]);
    });
  });

  it('leaves the hatted fixture alone, code and serialisation both', async () => {
    const hatted = ensureHatsInJson(DRIVE_WORKSPACE)!;

    await withWorkspaceAsync(async (workspace) => {
      loadAndWatch(workspace, hatted);
      const before = generateCode(workspace as Blockly.WorkspaceSvg);
      const savedBefore = JSON.stringify(Blockly.serialization.workspaces.save(workspace));
      expect(before).toContain('Outputs["total"]');

      nudgeTopBlock(workspace);
      await settle();

      expect(workspace.getTopBlocks(true)[0].type).toBe(HAT_BLOCK_TYPE);
      expect(generateCode(workspace as Blockly.WorkspaceSvg)).toBe(before);
      expect(disabledReasonsInSave(workspace)).toEqual([]);
      expect(JSON.stringify(Blockly.serialization.workspaces.save(workspace))).toBe(savedBefore);
    });
  });

  it('still greys a stack the author has not attached to anything, which is the tell working', async () => {
    // The point is not that nothing is ever disabled. It is that "orphan" now picks out the
    // blocks that really are stranded — and only those.
    const hatted = ensureHatsInJson(DRIVE_WORKSPACE)!;

    await withWorkspaceAsync(async (workspace) => {
      loadAndWatch(workspace, hatted);
      const stranded = workspace.newBlock('noodl_set_output');
      stranded.setFieldValue('stranded', 'NAME');
      Blockly.Events.fire(new Blockly.Events.BlockMove(stranded));
      await settle();

      expect(stranded.isEnabled()).toBe(false);
      expect([...stranded.getDisabledReasons()]).toEqual([ORPHANED_BLOCK_DISABLED_REASON]);
      // …and the hatted program beside it is untouched.
      expect(generateCode(workspace as Blockly.WorkspaceSvg)).toContain('Outputs["total"]');
    });
  });
});
