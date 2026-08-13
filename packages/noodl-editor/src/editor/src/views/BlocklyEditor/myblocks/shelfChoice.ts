/**
 * The shelf picker (VFN-007) — its options, and the keys that move between them.
 *
 * Two shelves, each with a consequence that has to sit *beside* the option rather than behind
 * it. That is the whole reason this is not a `<select>`, and it is why the options are a data
 * table here rather than JSX: a spec can read a table, and it cannot read a component.
 *
 * ## 🔴 Why there is no `<input type="radio">` behind this any more
 *
 * `BaseDialog` renders its children **twice** — once into a zero-height `MeasuringContainer`
 * it measures the body with, once into the visible `ChildContainer`. Every dialog body is
 * therefore two React instances in one document.
 *
 * A native radio group is scoped to the **document** by `name`, so two options became *four
 * radios in one group* and the browser kept exactly one of them checked. Measured live on
 * 2026-08-13, clean before/after, one click on the visible "My backpack" row:
 *
 * ```
 * BEFORE  [2] visible   This project  checked=TRUE
 * AFTER   [1] MEASURING My backpack   checked=TRUE   <- the check went to the invisible copy
 *         [3] visible   My backpack   checked=false  <- and never arrived here
 * ```
 *
 * After the click **no visible radio was checked at all**, while React's state was correctly
 * `'user'` — which is exactly why the report says "afterwards it correctly saves to the
 * backpack". The contrast hypothesis this task started with is ruled out: a radio that is not
 * checked has no checked mark whose contrast could be measured.
 *
 * The fix is to stop participating in a native radio group at all. The picker is an ARIA
 * radiogroup of themed option cards, so the *only* thing that decides which row reads as chosen
 * is React state — which was correct all along. The duplicate-render problem cannot reach it,
 * because there is no browser-owned group to duplicate.
 *
 * ⚠️ **This is not confined to this dialog.** Any native radio group inside a `BaseDialog` has
 * it. Worth a grep before someone adds the next one.
 *
 * @module BlocklyEditor/myblocks
 */

import type { MyBlocksScope } from './store';

export interface ShelfOption {
  value: MyBlocksScope;
  /** The shelf, named the way a builder would name it. */
  label: string;
  /**
   * What choosing it costs or buys, in one sentence.
   *
   * 🔴 Load-bearing, not decoration. The difference between the two shelves shows up weeks
   * later — when a collaborator opens the project and the block is not there — so the
   * consequence has to be readable *at the moment of choosing*, which a collapsed control
   * cannot do.
   */
  note: string;
}

/**
 * "This project" first, and chosen by default.
 *
 * It is the shelf that travels with the project, and `DEFAULT_SCOPE` in `MyBlocksSave.ts`
 * carries the argument: the cheaper mistake is the default.
 */
export const SHELF_OPTIONS: readonly ShelfOption[] = [
  {
    value: 'project',
    label: 'This project',
    note: 'It travels with the project. Anyone who opens it gets this block.'
  },
  {
    value: 'user',
    label: 'My backpack',
    note: 'Only you, but in every project you open.'
  }
];

/** The option a scope stands for, or `undefined` for a scope the picker does not offer. */
export function shelfOption(scope: MyBlocksScope): ShelfOption | undefined {
  return SHELF_OPTIONS.find((option) => option.value === scope);
}

/**
 * Where a key press moves the choice, or `null` when the key is not ours.
 *
 * The ARIA radiogroup pattern: arrows move focus *and* selection, and they wrap. Space and
 * Enter re-select what is already focused, which is a no-op with roving tabindex and is
 * implemented anyway — focus can arrive somewhere the roving index did not put it, and a Space
 * that did nothing there would read as a dead control.
 *
 * 🔴 `null` and not `current`: the caller uses it to decide whether to call `preventDefault`,
 * and a picker that swallowed Tab or Escape would trap the builder in the dialog.
 */
export function shelfAfterKey(key: string, current: MyBlocksScope): MyBlocksScope | null {
  const index = SHELF_OPTIONS.findIndex((option) => option.value === current);
  const from = index === -1 ? 0 : index;
  const count = SHELF_OPTIONS.length;

  switch (key) {
    case 'ArrowDown':
    case 'ArrowRight':
      return SHELF_OPTIONS[(from + 1) % count].value;
    case 'ArrowUp':
    case 'ArrowLeft':
      return SHELF_OPTIONS[(from - 1 + count) % count].value;
    case ' ':
    case 'Spacebar':
    case 'Enter':
      return SHELF_OPTIONS[from].value;
    default:
      return null;
  }
}
