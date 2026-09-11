/**
 * FB-027 — copy and duplicate take the whole stack, because there is no multi-select to select
 * one with.
 *
 * Richard: *"I can't shift click blocks in the visual function editor, which is sad for copy
 * pasting."*
 *
 * **He is right and it cannot be fixed the obvious way.** Blockly 12 core selects one block at a
 * time; `@mit-app-inventor/blockly-plugin-workspace-multiselect` is the plugin that adds
 * shift-click and marquee selection, and its peer range is `blockly >=11 <12` while this editor is
 * pinned to 12.3.1. LGC-006 recorded that constraint in 2026-08-12 and it is still true — checked
 * against the registry, not from memory. Richard ruled on 2026-08-27 that the plugin is not worth
 * a major-version rollback, and that what exists should carry the gesture instead.
 *
 * ## What was actually wrong, and it is not only the missing selection
 *
 * `BlockSvg.toCopyData(addNextBlocks = false)` — **the default is `false`**, and all four of
 * Blockly's own call sites (context-menu Duplicate, Ctrl+C, Ctrl+X, and the comment duplicate)
 * call it with no argument. So copying a block took the block and the blocks plugged *into* it and
 * silently left everything **stacked below** it behind. For a Visual Function that is the common
 * case — a program is a stack — so "copy this" quietly meant "copy the first line of this".
 *
 * ⚠️ `MyBlocksSave.ts` says the Save-as-a-block gesture takes the stack *"exactly as Blockly's own
 * Duplicate behaves"*. That comparison was wrong when it was written: `bodyFromBlocks` does take
 * the stack, and Blockly's Duplicate did not. The sentence is corrected there.
 *
 * ## Why the default is patched rather than the four call sites re-registered
 *
 * One seam reaches all of them, and it reaches them **in the right order** — a plugin or a future
 * Blockly call site that copies a block gets the same answer without this module having to know
 * about it. Re-registering the shortcuts would have meant restating their key codes and their
 * precondition functions, which is three more things to keep in step with Blockly.
 *
 * `cut` is the one that does not follow for free, and it is why this module is not a one-liner.
 * Cut is *copy, then* `checkAndDelete()`, and `checkAndDelete` heals the stack — it reconnects
 * what was below to what was above. Left alone, Ctrl+X would put the whole stack on the clipboard
 * and remove one block from the workspace. So the cut shortcut's callback is replaced, and only
 * its callback: the same name and the same key codes are re-registered over it.
 *
 * ⚠️ **`Delete` is deliberately untouched.** It also goes through `checkAndDelete`, and a Delete
 * key that took the rest of the program with it would be a far worse surprise than the one being
 * fixed.
 *
 * The policy lives here, apart from the workspace component, because it is reachable from the
 * plain-Node `tests-unit` runner: nothing below imports React, the DOM or an editor singleton, and
 * the two registries arrive as arguments so a spec can hand in doubles.
 *
 * @module BlocklyEditor
 */

/** The id Blockly registers its block Duplicate context-menu item under. */
export const DUPLICATE_ITEM_ID = 'blockDuplicate';

/** The name Blockly registers its cut keyboard shortcut under. */
export const CUT_SHORTCUT_NAME = 'cut';

/**
 * What the Duplicate item says once it means the stack.
 *
 * Richard's ask was *"say so in the UI"*, and this is where the gesture is: a builder reads the
 * menu item at the moment they are about to use it, which no hint strip elsewhere can match.
 * Blockly's own `DUPLICATE_BLOCK` message stays the fallback for the comment item, which still
 * duplicates one comment.
 */
export const DUPLICATE_STACK_TEXT = 'Duplicate this and everything below';

/** The Blockly surface this module writes to, named structurally so a spec can double it. */
export interface StackCopyBlockly {
  BlockSvg: { prototype: { toCopyData(addNextBlocks?: boolean): unknown } };
  ContextMenuRegistry: {
    registry: {
      getItem(id: string): { displayText?: unknown; callback?: unknown } | null;
    };
  };
  ShortcutRegistry: {
    registry: {
      getRegistry(): Record<string, StackCopyShortcut>;
      register(shortcut: StackCopyShortcut, allowOverrides?: boolean): void;
      unregister(shortcutName: string): boolean;
    };
  };
  clipboard: { copy(copyable: unknown, location?: unknown): unknown };
}

/** The slice of a Blockly keyboard shortcut this module re-registers. */
export interface StackCopyShortcut {
  name: string;
  keyCodes?: unknown[];
  preconditionFn?: unknown;
  callback?: (...args: unknown[]) => boolean;
  [extra: string]: unknown;
}

/** A block, as much of one as this module reads. */
interface StackBlock {
  outputConnection?: unknown;
  getRelativeToSurfaceXY?(): unknown;
  dispose(healStack?: boolean, animate?: boolean): void;
  isDeletable?(): boolean;
}

let applied = false;

/**
 * Make copy, duplicate and cut take the block and everything stacked below it.
 *
 * Idempotent, and it has to be: Blockly's registries are renderer-wide singletons and every
 * workspace injection runs the integration setup. Wrapping `toCopyData` twice would be harmless
 * today (the second wrapper would pass the same `true`) but re-registering the cut shortcut twice
 * would nest one replacement inside the other, and the second would then read the first's
 * already-cut block.
 *
 * @param blockly the Blockly namespace; injected so a spec can hand in a double
 * @returns whether it did anything, which is `false` on every call after the first
 */
export function applyStackCopy(blockly: StackCopyBlockly): boolean {
  if (applied) return false;
  applied = true;

  patchToCopyData(blockly);
  relabelDuplicate(blockly);
  replaceCut(blockly);

  return true;
}

/** For specs, which need each call to start from the unpatched state. */
export function resetStackCopyForTests(): void {
  applied = false;
}

/**
 * The one line the whole feature rests on: `addNextBlocks` defaults to `true`.
 *
 * An explicit argument still wins, so anything that deliberately asks for one block — Blockly's
 * own insertion-marker serialisation does, through a different function — is unaffected.
 */
function patchToCopyData(blockly: StackCopyBlockly): void {
  const prototype = blockly.BlockSvg.prototype;
  const original = prototype.toCopyData;

  prototype.toCopyData = function (addNextBlocks?: boolean) {
    return original.call(this, addNextBlocks === undefined ? true : addNextBlocks);
  };
}

/** Say what Duplicate now does, at the point the builder is about to press it. */
function relabelDuplicate(blockly: StackCopyBlockly): void {
  const item = blockly.ContextMenuRegistry.registry.getItem(DUPLICATE_ITEM_ID);
  // Blockly could rename the id; a missing item is not worth failing the editor over, and the
  // copy behaviour above is already in place either way.
  if (!item) return;

  item.displayText = () => DUPLICATE_STACK_TEXT;
}

/**
 * Cut removes what it copied.
 *
 * `dispose(healStack)` — `false` takes the stack with it, which is the half `checkAndDelete`
 * would have healed back into place. A value block (one with an `outputConnection`) has no stack
 * below it, so it keeps `checkAndDelete`'s own answer of healing.
 */
function replaceCut(blockly: StackCopyBlockly): void {
  const existing = blockly.ShortcutRegistry.registry.getRegistry()[CUT_SHORTCUT_NAME];
  if (!existing) return;

  /**
   * ⚠️ **Unregister first, and `allowOverrides` is not a substitute for it.** That flag only
   * silences the warning about re-using a shortcut *name*; the throw comes from `addKeyMapping`,
   * which refuses a key code that is already mapped unless collisions are allowed — and allowing
   * a collision would leave both handlers bound to Ctrl+X, running in reverse registration order.
   * `unregister` drops the name and its key mappings together, which is what makes the
   * re-registration below a replacement rather than a second binding.
   *
   * Found by the suite and not by this file's own doubles: the first double accepted any
   * `register` call, so the spec was green while the editor threw on startup. The double now
   * refuses a duplicate the way Blockly does, and a row applies this to the real Blockly.
   */
  blockly.ShortcutRegistry.registry.unregister(CUT_SHORTCUT_NAME);

  blockly.ShortcutRegistry.registry.register(
    {
      ...existing,
      callback(workspace: unknown, event: unknown, shortcut: unknown, scope: unknown) {
        const block = (scope as { focusedNode?: StackBlock } | undefined)?.focusedNode;
        if (!block || typeof block.dispose !== 'function') {
          // Not a block — a comment, say. Blockly's own handler still knows what to do.
          return existing.callback ? existing.callback(workspace, event, shortcut, scope) : false;
        }

        const location = typeof block.getRelativeToSurfaceXY === 'function' ? block.getRelativeToSurfaceXY() : undefined;
        const copied = blockly.clipboard.copy(block, location);
        if (!copied) return false;

        block.dispose(block.outputConnection ? true : false, true);
        return true;
      }
    },
    true
  );
}
