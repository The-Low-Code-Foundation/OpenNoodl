import {
  CursorActionType,
  CursorContext,
  cursorReducer,
  ICursorState
} from '../../src/editor/src/views/NodePicker/NodePicker.reducer';
import { getIsCategoryCollapsed } from '../../src/editor/src/views/NodePicker/NodePicker.selectors';

/**
 * UIX-012 — node picker collapsed-state drift.
 *
 * `NodePickerCategory` used to mirror its `isCollapsed` prop into local state
 * that only the header click wrote to. A click therefore desynced the component
 * from `cursorState.allCategories`, and any later programmatic open that
 * happened to write the value the reducer already held changed no prop — so the
 * mirrored local state was never re-synced and the category stayed visibly
 * closed on the next search. Separately, re-parsing the categories (which the
 * picker does on every change to the rendered node index, i.e. on every
 * keystroke) reset every category back to collapsed, undoing the
 * expand-on-search that had just been dispatched.
 *
 * These specs pin the reducer as the single source of truth for both.
 */

function categories(names: string[], isCollapsed = true) {
  return names.map((name) => ({ name, isCollapsed, nodes: [{ name: `${name}-node` }] }));
}

function makeState(names: string[], isCollapsed = true): ICursorState {
  return {
    categoryCursor: null,
    nodeCursor: null,
    cursorContext: CursorContext.Search,
    allowNodeCreation: false,
    disableCollapseTransition: true,
    allCategories: categories(names, isCollapsed)
  };
}

describe('NodePicker cursorReducer — category collapsed state (UIX-012)', () => {
  it('toggles a single category by name', () => {
    const state = makeState(['Visuals', 'Data']);

    const opened = cursorReducer(state, { type: CursorActionType.ToggleCategoryByName, name: 'Visuals' });
    expect(getIsCategoryCollapsed(opened, 'Visuals')).toBe(false);
    expect(getIsCategoryCollapsed(opened, 'Data')).toBe(true);

    const closed = cursorReducer(opened, { type: CursorActionType.ToggleCategoryByName, name: 'Visuals' });
    expect(getIsCategoryCollapsed(closed, 'Visuals')).toBe(true);
  });

  it('ignores a toggle for a category that is not rendered', () => {
    const state = makeState(['Visuals']);
    const next = cursorReducer(state, { type: CursorActionType.ToggleCategoryByName, name: 'Nope' });
    expect(next).toBe(state);
  });

  it('does not move the keyboard cursor or leave the search context on a header click', () => {
    const state = makeState(['Visuals', 'Data']);
    const next = cursorReducer(state, { type: CursorActionType.ToggleCategoryByName, name: 'Data' });

    expect(next.cursorContext).toBe(CursorContext.Search);
    expect(next.categoryCursor).toBe(null);
    expect(next.nodeCursor).toBe(null);
  });

  it('never mutates the incoming category objects', () => {
    const state = makeState(['Visuals', 'Data']);
    const before = state.allCategories[0];

    cursorReducer(state, { type: CursorActionType.ToggleCategoryByName, name: 'Visuals' });
    cursorReducer(state, { type: CursorActionType.OpenAllCategories });
    cursorReducer({ ...state, categoryCursor: 0 }, { type: CursorActionType.HandleEnter });

    expect(before.isCollapsed).toBe(true);
    expect(state.allCategories.every((c) => c.isCollapsed)).toBe(true);
  });

  it('carries collapsed state across a category re-parse (the expand-on-search regression)', () => {
    // Search opened everything...
    const opened = cursorReducer(makeState(['Visuals', 'Data']), { type: CursorActionType.OpenAllCategories });

    // ...and then the rendered node index changed, re-parsing the categories
    // with their `isCollapsed: true` default. The open must survive.
    const reparsed = cursorReducer(opened, {
      type: CursorActionType.UpdateAllCurrentCategories,
      allCategories: categories(['Visuals', 'Data'])
    });

    expect(getIsCategoryCollapsed(reparsed, 'Visuals')).toBe(false);
    expect(getIsCategoryCollapsed(reparsed, 'Data')).toBe(false);
  });

  it('gives genuinely new categories the parsed default on a re-parse', () => {
    const opened = cursorReducer(makeState(['Visuals']), { type: CursorActionType.OpenAllCategories });

    const reparsed = cursorReducer(opened, {
      type: CursorActionType.UpdateAllCurrentCategories,
      allCategories: categories(['Visuals', 'Data'])
    });

    expect(getIsCategoryCollapsed(reparsed, 'Visuals')).toBe(false);
    expect(getIsCategoryCollapsed(reparsed, 'Data')).toBe(true);
  });

  it('applies an explicit withCollapsedCategories to the NEW category list', () => {
    const state = makeState(['Visuals']);

    const reparsed = cursorReducer(state, {
      type: CursorActionType.UpdateAllCurrentCategories,
      allCategories: categories(['Visuals', 'Data']),
      withCollapsedCategories: false
    });

    expect(reparsed.allCategories.map((c) => c.name)).toEqual(['Visuals', 'Data']);
    expect(reparsed.allCategories.every((c) => c.isCollapsed === false)).toBe(true);
  });

  it('re-opens a category the user had clicked shut, on the next search update', () => {
    // The exact drift repro: search opens all, user collapses one by clicking
    // its header, user types another character.
    let state = cursorReducer(makeState(['Visuals', 'Data']), { type: CursorActionType.OpenAllCategories });
    state = cursorReducer(state, { type: CursorActionType.ToggleCategoryByName, name: 'Visuals' });
    expect(getIsCategoryCollapsed(state, 'Visuals')).toBe(true);

    state = cursorReducer(state, { type: CursorActionType.HandleSearchUpdate, state: makeState(['Visuals', 'Data']) });
    state = cursorReducer(state, { type: CursorActionType.OpenAllCategories });
    state = cursorReducer(state, {
      type: CursorActionType.UpdateAllCurrentCategories,
      allCategories: categories(['Visuals', 'Data'])
    });

    expect(getIsCategoryCollapsed(state, 'Visuals')).toBe(false);
    expect(getIsCategoryCollapsed(state, 'Data')).toBe(false);
  });

  it('still toggles the cursored category on Enter (keyboard navigation)', () => {
    const state = { ...makeState(['Visuals', 'Data']), categoryCursor: 1, cursorContext: CursorContext.Category };

    const next = cursorReducer(state, { type: CursorActionType.HandleEnter });
    expect(getIsCategoryCollapsed(next, 'Data')).toBe(false);
    expect(getIsCategoryCollapsed(next, 'Visuals')).toBe(true);
  });
});
