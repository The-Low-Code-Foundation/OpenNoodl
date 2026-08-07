/**
 * Node picker interaction state (UIX-013).
 *
 * The accordion is gone, and with it the state model that made it fragile: a
 * `allCategories[].isCollapsed` array, a three-mode cursor context
 * (search / category / node), and a `NodePickerCategory` that mirrored its
 * collapsed prop into local state only the header click wrote to. UIX-012 fixed
 * the resulting drift by making this reducer the single source of truth; this
 * task removes the state entirely — a persistent rail cannot be collapsed, so
 * there is nothing left to keep in sync.
 *
 * What remains is three values:
 *
 *  - `query`        — the search box;
 *  - `activeCategory` — the rail filter, `null` for "All";
 *  - `cursorKey`    — the keyboard cursor, stored as an item *key* rather than
 *                     an index so re-ranking (which happens on every keystroke)
 *                     moves the highlight with the node instead of leaving it
 *                     pointing at whatever slid into that slot.
 *
 * `itemKeys` is the flat render order the cursor walks, pushed in by the view
 * whenever the results change. It is the only derived value the reducer holds,
 * and it is held so that cursor movement can be a pure clamp.
 */

export interface PickerState {
  query: string;
  activeCategory: string | null;
  cursorKey: string | null;
  /** Flat, render-ordered result keys. */
  itemKeys: string[];
}

export const initialPickerState: PickerState = {
  query: '',
  activeCategory: null,
  cursorKey: null,
  itemKeys: []
};

export enum PickerActionType {
  SetQuery = 'SET_QUERY',
  SetActiveCategory = 'SET_ACTIVE_CATEGORY',
  /** The results changed — re-anchor the cursor. */
  SetResults = 'SET_RESULTS',
  MoveCursor = 'MOVE_CURSOR',
  SetCursor = 'SET_CURSOR'
}

export type PickerAction =
  | { type: PickerActionType.SetQuery; query: string }
  | { type: PickerActionType.SetActiveCategory; category: string | null }
  | { type: PickerActionType.SetResults; itemKeys: string[]; categoriesWithMatches: string[] }
  | { type: PickerActionType.MoveCursor; skip: number }
  | { type: PickerActionType.SetCursor; key: string | null };

function clampCursor(state: PickerState, skip: number): PickerState {
  if (!state.itemKeys.length) return state.cursorKey === null ? state : { ...state, cursorKey: null };

  const current = state.cursorKey === null ? -1 : state.itemKeys.indexOf(state.cursorKey);

  // From "nowhere" (an empty or stale cursor), any movement lands on the first
  // result rather than jumping to the end.
  const next = current === -1 ? 0 : Math.min(state.itemKeys.length - 1, Math.max(0, current + skip));

  return { ...state, cursorKey: state.itemKeys[next] };
}

export function pickerReducer(state: PickerState, action: PickerAction): PickerState {
  switch (action.type) {
    case PickerActionType.SetQuery:
      if (action.query === state.query) return state;
      return { ...state, query: action.query };

    case PickerActionType.SetActiveCategory:
      if (action.category === state.activeCategory) return state;
      return { ...state, activeCategory: action.category };

    case PickerActionType.SetResults: {
      const { itemKeys, categoriesWithMatches } = action;

      // A category filter that survives a new query is useful ("show me the
      // Data ones"); one that leaves you staring at an empty pane is not. Drop
      // it only when the current query has nothing under it.
      const activeCategory =
        state.activeCategory && !categoriesWithMatches.includes(state.activeCategory) ? null : state.activeCategory;

      // The cursor is always *on* something when there is something to be on —
      // that is the "visible at every step" requirement, and on a new search it
      // puts the cursor on the top-ranked result.
      const cursorKey =
        state.cursorKey && itemKeys.includes(state.cursorKey) ? state.cursorKey : itemKeys[0] ?? null;

      if (activeCategory === state.activeCategory && cursorKey === state.cursorKey && sameKeys(state.itemKeys, itemKeys))
        return state;

      return { ...state, itemKeys, activeCategory, cursorKey };
    }

    case PickerActionType.MoveCursor:
      return clampCursor(state, action.skip);

    case PickerActionType.SetCursor:
      if (action.key === state.cursorKey) return state;
      return { ...state, cursorKey: action.key };

    default:
      return state;
  }
}

function sameKeys(a: string[], b: string[]) {
  return a.length === b.length && a.every((key, i) => key === b[i]);
}
