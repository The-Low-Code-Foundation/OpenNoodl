/**
 * LGC-007 §1 — the gesture that saves a group of blocks.
 *
 * The engine has been complete since 2026-08-12 and had no way in: `bodyFromBlocks` and
 * `previewSignature` existed and nothing called them. This file is the caller. It owns the
 * context-menu item, the per-workspace session that lets a renderer-wide menu item find the
 * right store, and the request object the dialog fills in. It owns **no React and no copy** —
 * the sentences are `myblocks/saveIntent.ts` and the surface is `MyBlocksSaveDialog.tsx`, so
 * everything decided here is reachable from the plain-Node runner.
 *
 * ## 🔴 "Select blocks" is not the gesture this editor has
 *
 * §1 says *"Select blocks → Save as a block"*, and the toolbox's empty state used to instruct
 * builders to "select some blocks". **Blockly 12 core has no multi-select** — one block is
 * selected at a time, and the multi-select plugin is not installed and cannot be installed in
 * this lane. So the real gesture is one right-click on the **top block of the group**, and
 * everything inside it and stacked below it comes with it.
 *
 * ⚠️ **This used to end "exactly as Blockly's own *Duplicate* behaves", and that was never true.**
 * `BlockSvg.toCopyData(addNextBlocks = false)` defaults to `false` and all four of Blockly's own
 * call sites passed nothing, so Duplicate took the block and its inputs and left the stack below
 * it behind — the opposite of what `bodyFromBlocks` does here. FB-027 made the comparison true
 * rather than deleting it: see `stackCopy.ts`.
 *
 * That is not a compromise so much as the honest reading: a builder does not think of `n ÷ 2`
 * as three blocks they must select, they think of it as one thing they are pointing at. But it
 * *is* a surprise when the click lands mid-stack, so the dialog says how many blocks are coming
 * — see `countSavedBlocks`. The API here stays array-shaped so a multi-select plugin can feed it
 * later without a rewrite.
 *
 * ## Why the menu item is registered once and the store arrives per workspace
 *
 * `Blockly.ContextMenuRegistry` is a renderer-wide singleton — the same shape `DoItController`
 * already deals with. The item is registered once and finds its way from the clicked block back
 * to that workspace's store through `sessions`, keyed by `workspace.id` so a disposed workspace
 * is removable by id.
 *
 * @module BlocklyEditor
 */

import * as Blockly from 'blockly';

import { HAT_BLOCK_TYPE } from '@noodl/runtime/src/nodes/std-library/logic-builder-io';

import { bodyFromBlocks, previewSignature } from './MyBlocksBlocks';
import type { BlocklyWorkspaceJson, MyBlockDefinition } from './myblocks/format';
import { countSavedBlocks, normaliseBlockName, previewBlockIds } from './myblocks/saveIntent';
import type { InferredSignature } from './myblocks/shape';
import type { MyBlocksScope, MyBlocksStore } from './myblocks/store';

export const SAVE_MENU_ITEM_ID = 'noodlSaveAsMyBlock';

/**
 * The menu item's label.
 *
 * *Save as a block* is the phrase the My Blocks flyout's empty state tells a builder to look
 * for, so the two are one string apart from the ellipsis, which is the platform convention for
 * "a dialog follows". Preferred over *Save to My Blocks* (names a place rather than an act, and
 * pre-empts the shelf choice the dialog is about to offer) and over *Create block from
 * selection* (there is no selection, and "create" reads as authoring a new empty thing).
 */
export const SAVE_MENU_LABEL = 'Save as a block…';

/**
 * ⚠️ The hat has no `previousConnection` and no output plug (LGC-009), so a definition rooted
 * at one could not be spliced anywhere: the inliner would hand Blockly a hat under a `next`
 * connection, which is a workspace it refuses to load. Refused by name, with the reason in the
 * label — `'disabled'` and never `'hidden'`, for the reason Do It's item states at length.
 */
export const HAT_REFUSAL = 'the start block cannot go inside a saved block';

export interface SaveChoice {
  name: string;
  description?: string;
  scope: MyBlocksScope;
}

/**
 * VFN-006 — the thing that draws the outline, as this module is allowed to know it.
 *
 * 🔴 **An interface and not an import, and that is load-bearing.** The implementation
 * (`MyBlocksSaveOutline.ts`) reaches the DOM and `CanvasTheme`, and this file is in the import
 * graph of four plain-Node suites — `lgc-007`, `vfn-006`, `vfn-007` and `vfn-008`. One value
 * import of that module from here fails all four *to run*, which counts as a failure and does
 * not look like one; the same trap `MyBlocksBlocks.ts` documents about `MyBlocksShelves`. So the
 * layer is **injected** by `BlocklyWorkspace.tsx`, which is React already, and everything below
 * works exactly the same when nobody injected one.
 */
export interface SaveOutline {
  /**
   * Outline these blocks for as long as the dialog is up.
   *
   * @returns how many were actually drawn — see {@link SaveBlockRequest.outline}.
   */
  pin(blockIds: readonly string[]): number;
  /** The dialog has gone: on save, on cancel and on Escape alike. */
  unpin(): void;
  /** Outline these blocks while a pointer is over the menu item. Never outranks a pin. */
  show(blockIds: readonly string[]): void;
  /** The pointer left. */
  hide(): void;
}

/**
 * Everything the dialog needs, and nothing that needs the dialog.
 *
 * The shape is deliberately inert: no Blockly objects reach the React side, so the dialog
 * cannot accidentally hold a workspace open, and a spec can drive `commit` with no renderer.
 */
export interface SaveBlockRequest {
  /** How many blocks are going in — the gesture takes more than the one that was clicked. */
  blockCount: number;
  /**
   * VFN-006 — the ids of those same blocks, so the dialog can point at them.
   *
   * The same walk of the same body that produced `blockCount`, which is what makes criterion 3
   * true by construction rather than by agreement: the outline and the number cannot drift,
   * because there is one answer and it is rendered twice.
   */
  previewBlockIds: string[];
  /**
   * VFN-006 — how many blocks are **above** the clicked one in its own stack, and staying.
   *
   * `0` for the ordinary case. Non-zero means the right-click landed mid-stack, which is the
   * surprise this feature's header predicted and the one thing the count alone cannot convey: a
   * builder looking at "5 blocks" over an 8-block stack does not know which 5.
   */
  blocksAbove: number;
  /**
   * VFN-006 — the outline, when there is one to drive.
   *
   * Absent whenever the workspace is not rendered, which is every use in the plain-Node runner.
   * `pin` answers with the number it actually **drew**, so the dialog can say *"outlined behind
   * this dialog"* only when there is something behind it.
   */
  outline?: Pick<SaveOutline, 'pin' | 'unpin'>;
  /** The body as it will be stored. */
  body: BlocklyWorkspaceJson;
  /** The shape the definition will get, and why. Already inferred — do not re-infer it. */
  signature: InferredSignature;
  /** A human rendering of the top block, for the name field's placeholder. Never a default. */
  suggestedName: string;
  /** Every definition already on either shelf, for the duplicate-name warning. */
  taken: { id: string; name: string }[];
  /** Where a save goes unless the builder says otherwise. See {@link DEFAULT_SCOPE}. */
  defaultScope: MyBlocksScope;
  /**
   * Write it to the shelf.
   *
   * @throws MyBlocksCycleError — the save-time half of §3's guard, which the dialog must show
   *   rather than swallow. Nothing is written when it throws.
   */
  commit(choice: SaveChoice): MyBlockDefinition;
}

export type SaveBlockDialog = (request: SaveBlockRequest) => void;

/**
 * **This project**, not the backpack.
 *
 * §2 gives the project shelf the property that decides it: definitions saved into the project
 * travel with it and reach a collaborator through git. A builder who saves to their own
 * backpack by accident has a block that works until someone else opens the project; a builder
 * who saves to the project by accident has one extra entry in `project.json`. The cheaper
 * mistake is the default.
 */
export const DEFAULT_SCOPE: MyBlocksScope = 'project';

interface SaveSession {
  workspace: Blockly.Workspace;
  store: MyBlocksStore;
  openDialog: SaveBlockDialog;
  /** VFN-006. Absent on a workspace with nothing rendered — every use in the runner. */
  outline?: SaveOutline;
  /** VFN-009 — see {@link AttachSaveOptions.onSaved}. */
  onSaved?: (definition: MyBlockDefinition) => void;
}

const sessions = new Map<string, SaveSession>();

let menuItemRegistered = false;

/**
 * The blocks a right-click on `block` actually saves.
 *
 * One entry today, because there is no multi-select — but the root filter in `bodyFromBlocks`
 * is what makes an array right, and a plugin that gives us a real selection can pass it
 * straight through.
 */
export function selectionFor(block: Blockly.Block): Blockly.Block[] {
  return [block];
}

/**
 * How many blocks sit **above** the selection in its own stack and are staying put.
 *
 * VFN-006 §3. The save takes the clicked block and everything under it, so a click in the middle
 * of a stack silently splits it — the exact surprise the report is about, and one the count
 * cannot convey on its own.
 *
 * ⚠️ *Its own stack*, which is why this walks `getNextBlock` back down rather than trusting
 * `getPreviousBlock` alone. A block sitting first inside a C-block's statement input has its
 * previous connection occupied — by the C-block — and nothing above it in that stack. Blockly's
 * `getPreviousBlock()` returns the C-block there, and counting it (and its other inputs, and
 * everything above *it*) as "the blocks above this one" would be a sentence about the wrong
 * blocks. The round trip through `getNextBlock` is the test for "same stack".
 *
 * Counted the way `countSavedBlocks` counts, shadows excluded, so the two numbers in the dialog
 * are in the same units.
 */
export function blocksAboveSelection(blocks: Blockly.Block[]): number {
  const first = blocks[0];
  if (!first || typeof first.getPreviousBlock !== 'function') return 0;

  let count = 0;
  let current: Blockly.Block | null = first;
  let previous = first.getPreviousBlock();

  while (previous && previous.getNextBlock() === current) {
    count += ownAndInputs(previous);
    current = previous;
    previous = previous.getPreviousBlock();
  }

  return count;
}

/** A block plus everything plugged into it, but **not** what is stacked under it. */
function ownAndInputs(block: Blockly.Block): number {
  const all = block.getDescendants(false).filter((b) => !b.isShadow()).length;
  const next = block.getNextBlock();
  const below = next ? next.getDescendants(false).filter((b) => !b.isShadow()).length : 0;
  return all - below;
}

/** Is this a block a saved definition could be rooted at? */
export function canSaveBlock(block: Blockly.Block | null | undefined): { ok: boolean; reason?: string } {
  if (!block) return { ok: false, reason: 'there is no block here' };
  if (block.type === HAT_BLOCK_TYPE) return { ok: false, reason: HAT_REFUSAL };
  return { ok: true };
}

/**
 * Build the request for a selection.
 *
 * @param onSaved run after a successful commit — the toolbox's My Blocks category is rebuilt on
 *   every flyout *open*, so this exists only for the case where the flyout is already open when
 *   the save lands.
 */
export function prepareSaveRequest(
  store: MyBlocksStore,
  blocks: Blockly.Block[],
  onSaved?: (definition: MyBlockDefinition) => void,
  outline?: SaveOutline
): SaveBlockRequest {
  const body = bodyFromBlocks(blocks);

  return {
    body,
    blockCount: countSavedBlocks(body),
    // VFN-006 — the same body, walked once more. Deliberately not a second selection: the whole
    // property criterion 3 asks for is that the outline and the number are one answer.
    previewBlockIds: previewBlockIds(body),
    blocksAbove: blocksAboveSelection(blocks),
    outline,
    signature: previewSignature(body),
    suggestedName: describeBlock(blocks[0]),
    taken: store.list().map((d) => ({ id: d.id, name: d.name })),
    defaultScope: DEFAULT_SCOPE,
    commit: (choice) => {
      const definition = store.save({
        name: normaliseBlockName(choice.name),
        description: choice.description,
        body,
        scope: choice.scope
      });
      if (onSaved) onSaved(definition);
      return definition;
    }
  };
}

/**
 * A short human rendering of a block — `n ÷ 2` — used as the name field's **placeholder**.
 *
 * Deliberately not a default value. A placeholder shows what is being named; a default gets
 * committed by a builder who pressed Enter, and the shelf fills with blocks called `n ÷ 2`.
 */
export function describeBlock(block: Blockly.Block | undefined): string {
  if (!block) return '';
  try {
    return block.toString(28);
  } catch {
    // `toString` walks fields, and a block whose field needs a rendered workspace is not worth
    // taking the dialog down for.
    return '';
  }
}

/**
 * Register the *Save as a block…* item. Idempotent; the registry is renderer-wide.
 */
export function registerSaveAsBlockMenuItem(): void {
  if (menuItemRegistered) return;
  // A hot reload can leave the previous module's item registered, and `register` throws on a
  // duplicate id — the same guard, and the same reason, as Do It's.
  if (Blockly.ContextMenuRegistry.registry.getItem(SAVE_MENU_ITEM_ID)) {
    menuItemRegistered = true;
    return;
  }

  Blockly.ContextMenuRegistry.registry.register({
    id: SAVE_MENU_ITEM_ID,
    scopeType: Blockly.ContextMenuRegistry.ScopeType.BLOCK,
    // Under Do It (weight 0) and above Blockly's own items, which start at 1. These are the two
    // things a builder does *to* the block they are pointing at; duplicate, comment and collapse
    // are things they do to the canvas.
    weight: 0.5,

    preconditionFn: (scope) => {
      const block = scope.block as Blockly.Block | undefined;
      if (!block) return 'hidden';
      // Some other Blockly instance in the editor, or the flyout's own workspace — a flyout
      // block is a template, and saving a template is not a thing.
      if (!sessions.has(block.workspace.id)) return 'hidden';
      if (block.isShadow()) return 'hidden';

      return canSaveBlock(block).ok ? 'enabled' : 'disabled';
    },

    displayText: (scope) => {
      const block = scope.block as Blockly.Block | undefined;
      const verdict = canSaveBlock(block);
      const label = verdict.ok ? SAVE_MENU_LABEL : `Save as a block — ${verdict.reason}`;

      // VFN-006 criterion 1 — the outline goes up while the item is hovered.
      const session = block ? sessions.get(block.workspace.id) : undefined;
      if (!verdict.ok || !session?.outline || typeof document === 'undefined') return label;

      return hoverLabel(label, session.outline, previewBlockIds(bodyFromBlocks(selectionFor(block!))));
    },

    callback: (scope) => {
      const block = scope.block as Blockly.Block | undefined;
      if (!block) return;

      const session = sessions.get(block.workspace.id);
      if (!session) return;
      if (!canSaveBlock(block).ok) return;

      session.openDialog(
        prepareSaveRequest(
          session.store,
          selectionFor(block),
          (definition) => {
            refreshMyBlocksFlyout(session.workspace);
            // VFN-009 — and tell anything else that lists the shelves. A backpack save touches
            // neither `ProjectModel` nor `project.json`, so the *Saved blocks* section in project
            // settings has no other way to hear about it and would go on showing a stale list.
            session.onSaved?.(definition);
          },
          session.outline
        )
      );
    }
  });

  menuItemRegistered = true;
}

/**
 * The menu item's label as an element that turns the outline on while it is pointed at.
 *
 * ⚠️ `displayText` may return an `HTMLElement` — Blockly's own `ActionRegistryItem` says so —
 * which is why this needs no `MutationObserver` on the widget div and no matching of menu rows by
 * their text. We are handed the element the menu will render, so the listeners go on the exact
 * row every time, and they die with the menu.
 *
 * The `pointerenter` also promotes itself to the surrounding `.blocklyMenuItem` when it can find
 * one: Blockly's row has padding this span does not cover, and a pointer crossing that padding
 * would otherwise flicker the outline off and on. The span's own `pointerleave` is kept as the
 * fallback for the case where the row cannot be found, so the outline is never left up.
 */
function hoverLabel(text: string, outline: SaveOutline, blockIds: string[]): HTMLElement {
  const span = document.createElement('span');
  span.textContent = text;

  const leave = () => outline.hide();

  span.addEventListener('pointerenter', () => {
    outline.show(blockIds);

    const row = typeof span.closest === 'function' ? span.closest('.blocklyMenuItem') : null;
    if (row && !(row as { noodlOutlineWired?: boolean }).noodlOutlineWired) {
      (row as { noodlOutlineWired?: boolean }).noodlOutlineWired = true;
      row.addEventListener('pointerleave', leave);
    }
  });
  span.addEventListener('pointerleave', leave);

  return span;
}

/**
 * Rebuild the My Blocks flyout if it happens to be open.
 *
 * Duck-typed rather than typed against `WorkspaceSvg`, because the same session type is used
 * headlessly in the specs and a workspace with no toolbox is not an error here — it is the
 * normal case for every workspace that is not the Logic Builder's.
 */
export function refreshMyBlocksFlyout(workspace: Blockly.Workspace): void {
  const toolbox = (workspace as { getToolbox?: () => { refreshSelection?: () => void } | null }).getToolbox?.();
  toolbox?.refreshSelection?.();
}

export interface MyBlocksSaveHandle {
  dispose(): void;
}

export interface AttachSaveOptions {
  workspace: Blockly.Workspace;
  store: MyBlocksStore;
  /** Show the dialog. Injected so this module holds no React and stays gradeable. */
  openDialog: SaveBlockDialog;
  /**
   * VFN-006 — the outline layer, injected for the same reason `openDialog` is: it reaches the
   * DOM, and this module must stay importable from the plain-Node runner. See {@link SaveOutline}.
   */
  outline?: SaveOutline;
  /**
   * VFN-009 — run after a definition is committed, in addition to the flyout refresh.
   *
   * ⚠️ Injected rather than emitted from here, for this module's own reason: it is in the import
   * graph of the `lgc-007` specs in the plain-Node runner, and one import of the editor's event
   * dispatcher would fail two suites *to run*. The caller that has a renderer does the emitting.
   */
  onSaved?: (definition: MyBlockDefinition) => void;
}

/** Turn *Save as a block…* on for one open block editor. */
export function attachMyBlocksSave({
  workspace,
  store,
  openDialog,
  outline,
  onSaved
}: AttachSaveOptions): MyBlocksSaveHandle {
  registerSaveAsBlockMenuItem();

  const session: SaveSession = { workspace, store, openDialog, outline, onSaved };
  sessions.set(workspace.id, session);

  return {
    dispose: () => {
      // Only if it is still ours: a re-attach on the same workspace replaced it.
      if (sessions.get(workspace.id) === session) sessions.delete(workspace.id);
    }
  };
}

/** Test seam: is a workspace currently offering the item? */
export function hasSaveSession(workspaceId: string): boolean {
  return sessions.has(workspaceId);
}
