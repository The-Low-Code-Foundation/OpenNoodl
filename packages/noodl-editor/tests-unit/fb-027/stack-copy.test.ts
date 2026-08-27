/**
 * FB-027 — copy, duplicate and cut take the whole stack.
 *
 * Richard: *"I can't shift click blocks in the visual function editor, which is sad for copy
 * pasting."* Blockly 12 has no multi-select and the plugin that adds it peers on `blockly <12`,
 * so the gesture that exists has to carry the group instead — and it did not: `toCopyData`'s
 * `addNextBlocks` parameter defaults to `false`, and all four of Blockly's own call sites pass
 * nothing.
 *
 * The registries arrive as arguments, so these rows drive the real registration logic against
 * doubles rather than a re-implementation of it. The one thing a double cannot prove is that
 * `blockDuplicate` and `cut` are the ids Blockly really uses; that is asserted against the
 * installed Blockly at the bottom.
 */
import * as Blockly from 'blockly';

import {
  CUT_SHORTCUT_NAME,
  DUPLICATE_ITEM_ID,
  DUPLICATE_STACK_TEXT,
  applyStackCopy,
  resetStackCopyForTests,
  type StackCopyBlockly,
  type StackCopyShortcut
} from '../../src/editor/src/views/BlocklyEditor/stackCopy';

function makeBlockly() {
  const copyCalls: { addNextBlocks: unknown }[] = [];
  const registered: StackCopyShortcut[] = [];
  const unregistered: string[] = [];
  const copied: unknown[] = [];
  const duplicateItem: { displayText?: unknown; callback?: unknown } = {
    displayText: () => 'Duplicate'
  };
  const cutShortcut: StackCopyShortcut = {
    name: CUT_SHORTCUT_NAME,
    keyCodes: ['ctrl+x'],
    preconditionFn: () => true,
    callback: () => true
  };

  const blockly: StackCopyBlockly = {
    BlockSvg: {
      prototype: {
        toCopyData(addNextBlocks?: boolean) {
          copyCalls.push({ addNextBlocks });
          return { blockState: {} };
        }
      }
    },
    ContextMenuRegistry: { registry: { getItem: (id) => (id === DUPLICATE_ITEM_ID ? duplicateItem : null) } },
    ShortcutRegistry: {
      registry: {
        getRegistry: () => (unregistered.includes(CUT_SHORTCUT_NAME) ? {} : { [CUT_SHORTCUT_NAME]: cutShortcut }),
        // Blockly's own `register` throws when the key code is still mapped — `allowOverrides`
        // only silences the *name* warning. The first version of this double accepted anything,
        // so these rows were green while the editor threw on startup; it now refuses what
        // Blockly refuses.
        register: (shortcut) => {
          if (!unregistered.includes(shortcut.name)) {
            throw new Error(`Shortcut named ${shortcut.name} already registered`);
          }
          registered.push(shortcut);
        },
        unregister: (name: string) => {
          unregistered.push(name);
          return true;
        }
      }
    },
    clipboard: {
      copy: (copyable) => {
        copied.push(copyable);
        return { paster: 'block' };
      }
    }
  };

  return { blockly, copyCalls, registered, unregistered, copied, duplicateItem, cutShortcut };
}

beforeEach(resetStackCopyForTests);

describe('FB-027 — what a copy takes', () => {
  it('🔴 takes the stack below the block, which Blockly by default does not', () => {
    const { blockly, copyCalls } = makeBlockly();
    applyStackCopy(blockly);

    blockly.BlockSvg.prototype.toCopyData();

    expect(copyCalls).toEqual([{ addNextBlocks: true }]);
  });

  /**
   * An explicit argument still wins. Blockly serialises an insertion marker as one block on
   * purpose, and a default that could not be overridden would be a different bug.
   */
  it('leaves an explicit argument alone in both directions', () => {
    const { blockly, copyCalls } = makeBlockly();
    applyStackCopy(blockly);

    blockly.BlockSvg.prototype.toCopyData(false);
    blockly.BlockSvg.prototype.toCopyData(true);

    expect(copyCalls).toEqual([{ addNextBlocks: false }, { addNextBlocks: true }]);
  });

  /** Richard's *"say so in the UI"*, at the point the gesture is made. */
  it('says what Duplicate now does', () => {
    const { blockly, duplicateItem } = makeBlockly();
    applyStackCopy(blockly);

    expect((duplicateItem.displayText as () => string)()).toBe(DUPLICATE_STACK_TEXT);
  });
});

describe('FB-027 — cut removes what it copied', () => {
  function cutCallback(registered: StackCopyShortcut[]) {
    const shortcut = registered.find((s) => s.name === CUT_SHORTCUT_NAME);
    return shortcut?.callback as (w: unknown, e: unknown, s: unknown, scope: unknown) => boolean;
  }

  it('🔴 disposes a statement block without healing the stack back into place', () => {
    const { blockly, registered, copied } = makeBlockly();
    applyStackCopy(blockly);

    const disposals: { healStack: unknown }[] = [];
    const block = {
      // No `outputConnection` — a statement block, the kind that has a stack below it.
      getRelativeToSurfaceXY: () => ({ x: 0, y: 0 }),
      dispose: (healStack?: boolean) => disposals.push({ healStack })
    };

    expect(cutCallback(registered)(null, null, null, { focusedNode: block })).toBe(true);
    expect(copied).toEqual([block]);
    // `healStack: true` is `checkAndDelete`'s own answer, and it is what left the copied stack
    // sitting in the workspace after Ctrl+X.
    expect(disposals).toEqual([{ healStack: false }]);
  });

  /**
   * The control, and it is a real difference rather than symmetry for its own sake: a value
   * block has no stack below it, so healing is still the right answer and the row would pass
   * vacuously if both arms disposed the same way.
   */
  it('heals for a value block, which has no stack below it', () => {
    const { blockly, registered } = makeBlockly();
    applyStackCopy(blockly);

    const disposals: { healStack: unknown }[] = [];
    const block = {
      outputConnection: {},
      getRelativeToSurfaceXY: () => ({ x: 0, y: 0 }),
      dispose: (healStack?: boolean) => disposals.push({ healStack })
    };

    cutCallback(registered)(null, null, null, { focusedNode: block });

    expect(disposals).toEqual([{ healStack: true }]);
  });

  it('hands anything that is not a block back to Blockly rather than guessing', () => {
    const { blockly, registered, cutShortcut, copied } = makeBlockly();
    let fellThrough = false;
    cutShortcut.callback = () => {
      fellThrough = true;
      return true;
    };
    applyStackCopy(blockly);

    // A workspace comment: cuttable, and not something this module knows how to dispose.
    cutCallback(registered)(null, null, null, { focusedNode: { getText: () => 'a note' } });

    expect(fellThrough).toBe(true);
    expect(copied).toEqual([]);
  });

  /**
   * Blockly's registries are renderer-wide and every workspace injection runs the integration
   * setup. A second application would nest one cut replacement inside the other.
   */
  it('applies once, however many workspaces are injected', () => {
    const { blockly, registered } = makeBlockly();

    expect(applyStackCopy(blockly)).toBe(true);
    expect(applyStackCopy(blockly)).toBe(false);
    expect(applyStackCopy(blockly)).toBe(false);

    expect(registered).toHaveLength(1);
  });
});

/**
 * The doubles above cannot say that these are the names Blockly actually uses — and a wrong id
 * fails silently, because both writers return early rather than throw. So they are read off the
 * installed Blockly.
 */
describe('FB-027 — the ids are the real ones', () => {
  /**
   * The row the doubles could not stand in for. `ShortcutRegistry.register` throws on a key code
   * that is already mapped, and the first version of this suite passed while the editor threw at
   * startup — every spec that calls `initBlocklyIntegration` went red instead. Applying to the
   * real registry is the only thing that says the replacement is legal.
   */
  it('🔴 applies to the real Blockly without throwing', () => {
    expect(() => applyStackCopy(Blockly as never)).not.toThrow();
    expect(Blockly.ShortcutRegistry.registry.getRegistry()[CUT_SHORTCUT_NAME]).toBeDefined();
  });

  it('finds the block Duplicate item and the cut shortcut in the installed Blockly', () => {
    expect(Blockly.ContextMenuRegistry.registry.getItem(DUPLICATE_ITEM_ID)).not.toBeNull();
    expect(Blockly.ShortcutRegistry.registry.getRegistry()[CUT_SHORTCUT_NAME]).toBeDefined();
  });

  /** The defect itself, read off the toolkit: Blockly's default really is one block. */
  it('confirms Blockly still defaults toCopyData to a single block', () => {
    // `toCopyData(addNextBlocks = false)` — the length of the function is 0 because the parameter
    // has a default, so the signature is read from the serialisation call instead: a block saved
    // with no options carries `next`, one saved the way `toCopyData` asks for it does not.
    const workspace = new Blockly.Workspace();
    try {
      Blockly.defineBlocksWithJsonArray([
        { type: 'fb027_step', message0: 'step', previousStatement: null, nextStatement: null }
      ]);
      const first = workspace.newBlock('fb027_step');
      const second = workspace.newBlock('fb027_step');
      first.nextConnection.connect(second.previousConnection);

      const withNext = Blockly.serialization.blocks.save(first) as { next?: unknown };
      const withoutNext = Blockly.serialization.blocks.save(first, { addNextBlocks: false }) as { next?: unknown };

      expect(withNext.next).toBeDefined();
      expect(withoutNext.next).toBeUndefined();
    } finally {
      workspace.dispose();
    }
  });
});
