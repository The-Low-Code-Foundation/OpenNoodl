/**
 * Node picker hooks (UIX-013).
 *
 * Three concerns, one file, but each one now stands alone:
 *
 *  - `usePicker`      — state, derived results and the actions the view calls;
 *  - `usePickerKeys`  — the global key handling (`↑↓` / `←→` / `⏎`);
 *  - `useNodeDocs`    — the preview pane's docs, read from the bundled catalog.
 *
 * The search *matching* lives in `NodePicker.search.ts` and the state
 * transitions in `NodePicker.reducer.ts`; this file only wires them to React.
 */
import { ipcRenderer } from 'electron';
import { RefObject, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';

import { INodeType } from '@noodl-types/nodeTypes';

import getDocsEndpoint from '@noodl-utils/getDocsEndpoint';
import { getNodeDocs } from '@noodl-utils/nodeDocs';
import { INodeIndex } from '@noodl-utils/createnodeindex';

import { initialPickerState, PickerActionType, pickerReducer, PickerState } from './NodePicker.reducer';
import { getRecentNodeNames } from './NodePicker.recents';
import { buildResults, flattenIndex, getItemLabel, PickerItem, PickerResults } from './NodePicker.search';

export interface PickerController {
  state: PickerState;
  results: PickerResults;
  /** The item under the keyboard cursor, if any. */
  cursoredItem: PickerItem | undefined;
  /** Recently placed nodes, resolved against the current index. */
  recentItems: PickerItem[];

  setQuery: (query: string) => void;
  setActiveCategory: (category: string | null) => void;
  moveCursor: (skip: number) => void;
  setCursor: (key: string | null) => void;
}

export function usePicker(index: INodeIndex): PickerController {
  const [state, dispatch] = useReducer(pickerReducer, initialPickerState);

  const results = useMemo(
    () => buildResults({ index, query: state.query, activeCategory: state.activeCategory }),
    [index, state.query, state.activeCategory]
  );

  // Push the render order into the reducer so cursor movement is a pure clamp.
  // `buildResults` depends only on inputs the reducer does not derive, so this
  // cannot loop.
  useEffect(() => {
    dispatch({
      type: PickerActionType.SetResults,
      itemKeys: results.items.map((item) => item.key),
      categoriesWithMatches: results.categories.filter((category) => category.count > 0).map((c) => c.name)
    });
  }, [results]);

  const cursoredItem = useMemo(
    () => results.items.find((item) => item.key === state.cursorKey),
    [results.items, state.cursorKey]
  );

  // Recents are resolved against the whole index, not the filtered results —
  // the rail shows them regardless of what is typed in the search box.
  const recentItems = useMemo(() => {
    const names = getRecentNodeNames();
    if (!names.length) return [];

    const all = buildResults({ index, query: '', activeCategory: null });
    return names.map((name) => all.items.find((item) => item.name === name)).filter(Boolean) as PickerItem[];
  }, [index]);

  return {
    state,
    results,
    cursoredItem,
    recentItems,

    setQuery: useCallback((query: string) => dispatch({ type: PickerActionType.SetQuery, query }), []),
    setActiveCategory: useCallback(
      (category: string | null) => dispatch({ type: PickerActionType.SetActiveCategory, category }),
      []
    ),
    moveCursor: useCallback((skip: number) => dispatch({ type: PickerActionType.MoveCursor, skip }), []),
    setCursor: useCallback((key: string | null) => dispatch({ type: PickerActionType.SetCursor, key }), [])
  };
}

/**
 * Hover handling for the preview pane.
 *
 * Two rules, both learned from using it:
 *
 *  1. **Hover moves the keyboard cursor** rather than setting a second,
 *     transient "hovered" state. With two states the pane showed
 *     `hovered ?? cursored`, so taking the mouse off a card — including to go
 *     and scroll the pane itself — snapped the preview back to wherever the
 *     cursor happened to be. Nothing is cleared on mouse-out now: what you
 *     last pointed at stays up until you point at something else.
 *  2. **A card has to be dwelled on**, not merely crossed. The pane sits to the
 *     right of the grid, so the trip from a card to the pane passes over other
 *     cards; without the delay each one would steal the preview in passing.
 *
 * `override` exists for rail entries (recents), which may not be in the current
 * result list at all and therefore cannot be represented by the cursor.
 */
const HOVER_INTENT_MS = 130;

export interface HoverPreview {
  /** Preview a result card — moves the cursor once the pointer settles. */
  hoverItem: (item: PickerItem) => void;
  /** Preview something outside the results (a recent), until the next hover. */
  hoverOverride: (item: PickerItem) => void;
  /** Pointer left — cancels a pending hover, keeps what is on screen. */
  cancelHover: () => void;
  /** Set when a rail entry is being previewed. */
  override: PickerItem | undefined;
  /** Call when the keyboard takes over, so the rail preview steps aside. */
  clearOverride: () => void;
}

export function useHoverPreview(setCursor: (key: string) => void): HoverPreview {
  const [override, setOverride] = useState<PickerItem | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const cancelHover = useCallback(() => clearTimeout(timer.current), []);

  useEffect(() => cancelHover, [cancelHover]);

  const schedule = useCallback(
    (fn: () => void) => {
      clearTimeout(timer.current);
      timer.current = setTimeout(fn, HOVER_INTENT_MS);
    },
    []
  );

  return {
    override,
    cancelHover,
    clearOverride: useCallback(() => setOverride(undefined), []),
    hoverItem: useCallback(
      (item: PickerItem) =>
        schedule(() => {
          setOverride(undefined);
          setCursor(item.key);
        }),
      [schedule, setCursor]
    ),
    hoverOverride: useCallback((item: PickerItem) => schedule(() => setOverride(item)), [schedule])
  };
}

/** Total node count of an index — the "128 nodes" readout next to the search box. */
export function useNodeCount(index: INodeIndex): number {
  return useMemo(() => flattenIndex(index).length, [index]);
}

/**
 * The search field owns focus for the whole picker: you can always type. The
 * cursor keys are therefore handled globally and only the ones the text field
 * has no use for are taken outright.
 */
export interface PickerKeysOptions {
  /** Grid width, so `↑↓` move by a row rather than by a card. */
  columns: number;
  onMove: (skip: number) => void;
  onInsert: () => void;
  /** The search field, used to decide whether `←→` belong to the caret. */
  searchInput: RefObject<HTMLInputElement>;
  isEnabled?: boolean;
}

export function usePickerKeys({ columns, onMove, onInsert, searchInput, isEnabled = true }: PickerKeysOptions) {
  // Handlers close over the cursor, so they change on every render. Held in a
  // ref, the window listener is registered once instead of being torn down and
  // rebuilt each keystroke.
  const handlers = useRef({ onMove, onInsert });
  handlers.current = { onMove, onInsert };

  useEffect(() => {
    if (!isEnabled) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey) return;

      const input = searchInput.current;
      const caret = input?.selectionStart ?? 0;
      const length = input?.value.length ?? 0;
      const hasSelection = input ? input.selectionStart !== input.selectionEnd : false;

      switch (event.key) {
        case 'ArrowDown':
          handlers.current.onMove(columns);
          break;

        case 'ArrowUp':
          handlers.current.onMove(-columns);
          break;

        // The caret keeps `←→` while it has somewhere to go inside the query —
        // editing what you typed always wins over moving the selection.
        case 'ArrowRight':
          if (hasSelection || caret < length) return;
          handlers.current.onMove(1);
          break;

        case 'ArrowLeft':
          if (hasSelection || caret > 0) return;
          handlers.current.onMove(-1);
          break;

        case 'Enter':
          handlers.current.onInsert();
          break;

        default:
          return;
      }

      event.preventDefault();
      event.stopPropagation();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [columns, searchInput, isEnabled]);
}

/** Keep the search field focused, including after the window regains focus. */
export function useSearchFocus(searchInput: RefObject<HTMLInputElement>) {
  useEffect(() => {
    function focus() {
      // In rAF to avoid React's flushDiscreteUpdates warning on mount.
      requestAnimationFrame(() => searchInput.current?.focus());
    }

    focus();

    ipcRenderer.on('window-focused', focus);
    return () => {
      ipcRenderer.off('window-focused', focus);
    };
  }, [searchInput]);
}

/* -------------------------------------------------------------------------- */
/* Docs                                                                        */
/* -------------------------------------------------------------------------- */

export interface NodeDocs {
  /** Rendered documentation HTML, empty when the catalog does not know the node. */
  content: string;
  /** "Read more" page for the node, empty when it has none. */
  url: string;
  /**
   * Always false. Kept so the preview pane's props do not change shape: the
   * docs are now a synchronous read of a bundled artifact, so there is no
   * moment at which they are pending. See {@link useNodeDocs}.
   */
  isLoading: boolean;
}

const EMPTY_DOCS: NodeDocs = { content: '', url: '', isLoading: false };

/**
 * Documentation for the previewed node.
 *
 * ALPHA-006 §1: this used to debounce 250 ms and then fetch the node's markdown
 * page off the docs site, so arrowing through a category fired a request per
 * card, the pane was blank offline, and the 35% of nodes whose page is missing
 * or moved rendered as "No documentation yet." forever. It is now a lookup in
 * the enriched catalog that ships in the binary — synchronous, offline, and
 * unable to disagree with the ports the same pane lists below it.
 */
export function useNodeDocs(type: INodeType | undefined): NodeDocs {
  return useMemo(() => {
    const docs = getNodeDocs(type?.name);
    if (!docs) return EMPTY_DOCS;

    return {
      content: docs.html,
      url: docs.path ? getDocsEndpoint() + docs.path : '',
      isLoading: false
    };
  }, [type]);
}

/* -------------------------------------------------------------------------- */
/* Ports                                                                       */
/* -------------------------------------------------------------------------- */

export interface PreviewPort {
  name: string;
  isSignal: boolean;
  direction: 'in' | 'out';
}

const MAX_PREVIEW_INPUTS = 5;
const MAX_PREVIEW_OUTPUTS = 3;

function isSignalPort(port: TSFixme) {
  const type = port?.type;
  return type === 'signal' || type?.name === 'signal';
}

export interface PreviewPorts {
  ports: PreviewPort[];
  /** Everything the node declares, so the pane can say "8 of 111". */
  total: number;
}

/**
 * The handful of ports worth showing in the preview.
 *
 * "Key" has to mean something. `Group` declares 111 ports: the first eight in
 * declaration order are `cssClassName`, `styleCss` and friends, and the first
 * eight by the runtime's own `index` are four margins and two alignments. So
 * the selection is tiered:
 *
 *  - **inputs** — ungrouped ports and the `General` group first (a node's
 *    primary inputs are the ones it does not file under a styling section),
 *    then everything else, each tier in the runtime's declared order;
 *  - **outputs** — signals first, because those are what a node is wired up by.
 *
 * Dynamic ports are excluded: they only exist once a node has been placed and
 * configured.
 */
export function getPreviewPorts(type: INodeType | undefined): PreviewPorts {
  const ports = Array.isArray(type?.ports) ? type.ports : [];

  const toPort = (port: TSFixme, direction: 'in' | 'out'): PreviewPort => ({
    name: String(port.displayName || port.name),
    isSignal: isSignalPort(port),
    direction
  });

  const declaredIndex = (port: TSFixme) =>
    typeof port?.index === 'number' ? port.index : Number.MAX_SAFE_INTEGER;

  const isPrimary = (port: TSFixme) => !port?.group || port.group === 'General';

  const byTier = (tier: (port: TSFixme) => boolean) => (a: TSFixme, b: TSFixme) => {
    const rank = Number(tier(b)) - Number(tier(a));
    return rank !== 0 ? rank : declaredIndex(a) - declaredIndex(b);
  };

  const inputs = ports.filter((port) => port?.plug === 'input' || port?.plug === 'input/output');
  const outputs = ports.filter((port) => port?.plug === 'output' || port?.plug === 'input/output');

  return {
    ports: [
      ...[...inputs].sort(byTier(isPrimary)).slice(0, MAX_PREVIEW_INPUTS).map((p) => toPort(p, 'in')),
      ...[...outputs].sort(byTier(isSignalPort)).slice(0, MAX_PREVIEW_OUTPUTS).map((p) => toPort(p, 'out'))
    ],
    total: inputs.length + outputs.length
  };
}

export { getItemLabel };
