import {
  initialPickerState,
  PickerActionType,
  pickerReducer,
  PickerState
} from '../../src/editor/src/views/NodePicker/NodePicker.reducer';

/**
 * UIX-013 — the picker's interaction state.
 *
 * These replace the UIX-012 collapsed-state specs. That bug (a category
 * component mirroring its `isCollapsed` prop into local state only the header
 * click wrote to, so a click desynced it from the reducer and expand-on-search
 * could no longer move it) is gone because the accordion is gone: the rail is
 * persistent and there is no collapsed flag left to keep in sync.
 *
 * What replaces it — and where the regression risk now lives — is the cursor
 * and the rail filter across a re-ranking search.
 */

function stateWith(overrides: Partial<PickerState> = {}): PickerState {
  return { ...initialPickerState, ...overrides };
}

function withResults(state: PickerState, itemKeys: string[], categoriesWithMatches: string[] = []) {
  return pickerReducer(state, { type: PickerActionType.SetResults, itemKeys, categoriesWithMatches });
}

describe('NodePicker pickerReducer — cursor (UIX-013)', () => {
  it('puts the cursor on the first result as soon as there are results', () => {
    const next = withResults(stateWith(), ['a', 'b', 'c']);
    expect(next.cursorKey).toBe('a');
  });

  it('keeps the cursor on the same node when the results are re-ranked', () => {
    let state = withResults(stateWith(), ['a', 'b', 'c']);
    state = pickerReducer(state, { type: PickerActionType.MoveCursor, skip: 1 });
    expect(state.cursorKey).toBe('b');

    // Another keystroke re-orders the same three results.
    state = withResults(state, ['c', 'b', 'a']);
    expect(state.cursorKey).toBe('b');
  });

  it('re-anchors to the top result when the cursored node stops matching', () => {
    let state = withResults(stateWith(), ['a', 'b', 'c']);
    state = pickerReducer(state, { type: PickerActionType.MoveCursor, skip: 2 });
    expect(state.cursorKey).toBe('c');

    state = withResults(state, ['x', 'y']);
    expect(state.cursorKey).toBe('x');
  });

  it('clamps at both ends rather than wrapping', () => {
    let state = withResults(stateWith(), ['a', 'b', 'c']);

    state = pickerReducer(state, { type: PickerActionType.MoveCursor, skip: -1 });
    expect(state.cursorKey).toBe('a');

    state = pickerReducer(state, { type: PickerActionType.MoveCursor, skip: 99 });
    expect(state.cursorKey).toBe('c');
  });

  it('moves a whole row at a time when the grid asks for it', () => {
    let state = withResults(stateWith(), ['a', 'b', 'c', 'd', 'e', 'f']);

    state = pickerReducer(state, { type: PickerActionType.MoveCursor, skip: 3 });
    expect(state.cursorKey).toBe('d');

    state = pickerReducer(state, { type: PickerActionType.MoveCursor, skip: -3 });
    expect(state.cursorKey).toBe('a');
  });

  it('drops the cursor when nothing matches, and takes it back on the next match', () => {
    let state = withResults(stateWith(), ['a', 'b']);

    state = withResults(state, []);
    expect(state.cursorKey).toBe(null);

    state = withResults(state, ['q']);
    expect(state.cursorKey).toBe('q');
  });

  it('lands on the first result when the mouse-set cursor is stale', () => {
    let state = pickerReducer(stateWith({ itemKeys: ['a', 'b'] }), {
      type: PickerActionType.SetCursor,
      key: 'gone'
    });

    state = pickerReducer(state, { type: PickerActionType.MoveCursor, skip: 1 });
    expect(state.cursorKey).toBe('a');
  });
});

describe('NodePicker pickerReducer — rail filter (UIX-013)', () => {
  it('keeps a category filter that still has matches under a new query', () => {
    let state = pickerReducer(stateWith(), { type: PickerActionType.SetActiveCategory, category: 'Data' });
    state = pickerReducer(state, { type: PickerActionType.SetQuery, query: 'rec' });
    state = withResults(state, ['Data::Query Records'], ['Data']);

    expect(state.activeCategory).toBe('Data');
  });

  it('falls back to All when the filtered category has nothing under the query', () => {
    // The regression the old accordion produced as "search shows me nothing":
    // a stale filter must never leave the results pane empty on its own.
    let state = pickerReducer(stateWith(), { type: PickerActionType.SetActiveCategory, category: 'Navigation' });
    state = pickerReducer(state, { type: PickerActionType.SetQuery, query: 'text' });
    state = withResults(state, ['UI Elements::Text'], ['UI Elements']);

    expect(state.activeCategory).toBe(null);
  });

  it('toggling a category does not disturb the query', () => {
    let state = pickerReducer(stateWith(), { type: PickerActionType.SetQuery, query: 'text' });
    state = pickerReducer(state, { type: PickerActionType.SetActiveCategory, category: 'UI Elements' });
    state = pickerReducer(state, { type: PickerActionType.SetActiveCategory, category: null });

    expect(state.query).toBe('text');
    expect(state.activeCategory).toBe(null);
  });

  it('returns the same object when nothing changed', () => {
    const state = withResults(stateWith(), ['a'], ['Cat']);

    expect(pickerReducer(state, { type: PickerActionType.SetQuery, query: '' })).toBe(state);
    expect(pickerReducer(state, { type: PickerActionType.SetActiveCategory, category: null })).toBe(state);
    expect(withResults(state, ['a'], ['Cat'])).toBe(state);
  });
});
