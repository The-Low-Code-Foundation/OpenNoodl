import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { ProjectModel } from '@noodl-models/projectmodel';
import { SidebarModel } from '@noodl-models/sidebar';
import { SidebarModelEvent } from '@noodl-models/sidebar/sidebarmodel';
import { EditorSettings } from '@noodl-utils/editorsettings';

/**
 * PNL-003 — the side panel's width, in one place.
 *
 * It used to live in three: `EditorPage`'s `useState`, `SideNavigation`'s CSS
 * `min-width`, and the divider's own props. That is how the reset survived —
 * `updateSidebarSize` slammed the width back to 380px on every panel switch and
 * every window resize, and nothing persisted it, so a width you dragged lasted
 * until you clicked another rail icon.
 *
 * Now: the width is per panel, per project, and persisted. The CSS just fills
 * what the divider is given, and the divider's props are derived from here.
 */

/** The icon rail. Fixed, always visible; the phase parks it deliberately. */
export const RAIL_WIDTH = 52;

/**
 * The narrowest a panel may be dragged before it collapses. 240px is the value
 * the mock's compact breakpoint assumes; PNL-004 makes the panels themselves
 * work at it.
 */
export const MIN_PANEL_WIDTH = 240;

/** Today's 380px divider size, minus the rail — i.e. the width panels have had. */
export const DEFAULT_PANEL_WIDTH = 328;

/** Below this, a drag reads as "collapse", with a snap so it isn't accidental. */
const COLLAPSE_SNAP_WIDTH = 160;

/** Wide mode. Generalises the `55vw` the shelved topology panel prototyped. */
const WIDE_MAX_WIDTH = 760;
const WIDE_VIEWPORT_FRACTION = 0.55;

/** Canvas left over when the panel is clamped against a small window. */
const MIN_CANVAS_WIDTH = 320;

const SETTINGS_KEY = 'editor-sidebar-widths';
const FLOAT_SETTINGS_KEY = 'editor-sidebar-float-rects';

/** PNL-009: a floating panel's card, in editor-area coordinates. */
export interface FloatRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const FLOAT_DEFAULT: FloatRect = { x: 96, y: 64, width: 420, height: 520 };
const FLOAT_MIN_WIDTH = 280;
const FLOAT_MIN_HEIGHT = 200;
/** Keep at least this much of the card reachable inside the editor area. */
const FLOAT_KEEP_VISIBLE = 120;

export type SidePanelMode = 'docked' | 'wide' | 'hidden' | 'floating' | 'full';

/**
 * F41 — hide/reveal as a pure transition over (mode, remembered mode).
 *
 * `mode` is a single enum, so `setMode('hidden')` used to *overwrite* 'floating'
 * or 'full' and un-hiding hardcoded 'docked'. ⌘B on a floating panel therefore
 * returned it docked, silently dropping the mode you were working in.
 *
 * Carrying the mode a panel was hidden *from* keeps the modes CSS-only, which is
 * PNL-009's constraint: nothing is re-parented — a legacy `Frame`-hosted view
 * would not survive that — only which class the same element carries changes.
 *
 * Pure and exported so the round trip is provable without React test infra.
 */
export interface SidePanelHideState {
  mode: SidePanelMode;
  /** The mode a hidden panel returns to. Only meaningful while `mode` is 'hidden'. */
  remembered: SidePanelMode;
}

/** Hide, remembering where from. Hiding twice must not forget the first answer. */
export function hideTransition(state: SidePanelHideState): SidePanelHideState {
  if (state.mode === 'hidden') return state;
  return { mode: 'hidden', remembered: state.mode };
}

/** Un-hide, back to the mode it was hidden from. A no-op if already visible. */
export function revealTransition(state: SidePanelHideState): SidePanelHideState {
  if (state.mode !== 'hidden') return state;
  return { mode: state.remembered, remembered: state.remembered };
}

/** ⌘B / the header's hide button: one verb, both directions. */
export function toggleHiddenTransition(state: SidePanelHideState): SidePanelHideState {
  return state.mode === 'hidden' ? revealTransition(state) : hideTransition(state);
}

/**
 * Docking is explicit (Escape, the dock button, dragging the divider back out),
 * so it also retires what a later un-hide would restore — otherwise a ⌘B round
 * trip would resurrect a float you had already left.
 */
export function dockTransition(): SidePanelHideState {
  return { mode: 'docked', remembered: 'docked' };
}

export interface SidePanelLayout {
  /** What the `FrameDivider` should be sized to: rail + panel. */
  dividerSize: number;
  dividerSizeMin: number;
  mode: SidePanelMode;
  /** The floating card's rect, in editor-area coordinates. Only read in 'floating'. */
  floatRect: FloatRect;
  /** The editor area's rect in viewport coordinates, reported by the divider. */
  editorArea: { x: number; y: number; width: number; height: number } | null;
  setEditorArea: (bounds: DOMRect) => void;
  /** The divider's own drag callbacks. */
  onDividerDragStart: () => void;
  onDividerSizeChanged: (size: number) => void;
  onDividerDragEnd: () => void;
  toggleWide: () => void;
  toggleHidden: () => void;
  toggleFloating: () => void;
  toggleFull: () => void;
  /**
   * Enter full mode, idempotently. `toggleFull` is the header button's verb;
   * this is the one a *caller* wants — "open this surface full-screen" must not
   * mean "…unless it already was, in which case dock it". The seven backend
   * surfaces that used to `createPortal` into a fixed overlay open through here.
   */
  openFull: () => void;
  /** Docked, whatever mode it was in. Escape's target. */
  dock: () => void;
  /** Drag/resize the floating card. `bounds` is the editor area's own size. */
  setFloatRect: (rect: FloatRect, bounds: { width: number; height: number }) => void;
  /** Clicking a rail icon must bring a hidden panel back. */
  revealIfHidden: () => void;
  /**
   * Hide, idempotently — the caller's verb, the way `openFull` is.
   *
   * BLD-009 needs it: expanding the Build thread into the document surface has
   * to give the rail's width to the workspace it just opened, and `toggleHidden`
   * would *reveal* a panel the user had already hidden. `hideTransition` is
   * already idempotent and already remembers the mode it hid from, so this is
   * that pure transition with the toggle's ambiguity removed — and it is the
   * very callback the divider's own collapse floor has always used.
   */
  hideIfShown: () => void;
}

const SidePanelLayoutContext = createContext<SidePanelLayout | null>(null);

export function useSidePanelLayoutContext(): SidePanelLayout | null {
  return useContext(SidePanelLayoutContext);
}

function readStoredWidths(): Record<string, number> {
  if (!ProjectModel.instance) return {};
  const projectSettings = EditorSettings.instance.get(ProjectModel.instance.id) || {};
  const stored = projectSettings[SETTINGS_KEY];
  return stored && typeof stored === 'object' ? { ...stored } : {};
}

function writeStoredWidths(widths: Record<string, number>) {
  if (!ProjectModel.instance) return;
  // Same per-project store `useSetupSettings` uses for the active panel, keyed
  // by project id — so widths are per project, which is the intent: different
  // projects lean on different panels.
  EditorSettings.instance.setMerge(ProjectModel.instance.id, { [SETTINGS_KEY]: widths });
}

/** A panel's own default, declared at its `register()` call. */
function defaultWidthFor(panelId: string): number {
  const panel = panelId ? SidebarModel.instance.getPanel(panelId) : null;
  return panel?.defaultWidth ?? DEFAULT_PANEL_WIDTH;
}

/**
 * FIX-009 — the panels that take turns in the *selection slot* share one width.
 *
 * `components`, `PropertyEditor` and `PortEditor` are not three panels the user
 * sizes independently; they are one slot whose contents swap as the canvas
 * selection changes (`SidebarModel.switchToNode` on select, `hidePanels` on
 * deselect). Storing a width per panel id means the first drag writes *one* of
 * them, and every select/deselect from then on moves the divider — and the
 * canvas with it — to whichever width that panel happens to remember.
 *
 * `d12b1329` equalised the three *defaults*, which held only until the first
 * drag. Grouping the storage key is what actually makes them one slot.
 *
 * `PortEditor` is in the group for the same reason the other two are, and
 * `panelHoldsCanvasSelection` (EditorEventBindings) is the precedent for
 * treating exactly this set as one family.
 *
 * Deliberately *not* the whole docked sidebar: deselect restores whichever panel
 * was active before, which may be Search (340) or Docs (420) — panels users size
 * differently on purpose. Those keep their own widths.
 */
const SELECTION_SLOT_KEY = 'selection-slot';

/** Group members, in the order a pre-group width is inherited from below. */
const SELECTION_SLOT_PANELS = ['components', 'PropertyEditor', 'PortEditor'];

const WIDTH_GROUPS: Record<string, string> = {
  components: SELECTION_SLOT_KEY,
  PropertyEditor: SELECTION_SLOT_KEY,
  PortEditor: SELECTION_SLOT_KEY
};

/** The key a panel's width is stored under — its group's, or its own. */
export function widthKeyFor(panelId: string): string {
  return WIDTH_GROUPS[panelId] ?? panelId;
}

/**
 * The stored width for a panel, or `undefined` to fall back to its default.
 *
 * The legacy leg is the upgrade path: a width dragged before the group existed
 * was written under the panel's own id, and dropping it would silently reset
 * every user's sidebar on upgrade. The first group member that has one wins,
 * and the next drag writes the group key, which takes precedence from then on.
 */
export function storedWidthFor(widths: Record<string, number>, panelId: string): number | undefined {
  const key = widthKeyFor(panelId);

  const grouped = widths[key];
  if (typeof grouped === 'number') return grouped;

  // Not in a group: there is no legacy key to look under, its own id *is* it.
  if (key === panelId) return undefined;

  for (const memberId of SELECTION_SLOT_PANELS) {
    if (widthKeyFor(memberId) !== key) continue;
    const legacy = widths[memberId];
    if (typeof legacy === 'number') return legacy;
  }

  return undefined;
}

function readStoredFloatRects(): Record<string, FloatRect> {
  if (!ProjectModel.instance) return {};
  const projectSettings = EditorSettings.instance.get(ProjectModel.instance.id) || {};
  const stored = projectSettings[FLOAT_SETTINGS_KEY];
  return stored && typeof stored === 'object' ? { ...stored } : {};
}

function writeStoredFloatRects(rects: Record<string, FloatRect>) {
  if (!ProjectModel.instance) return;
  EditorSettings.instance.setMerge(ProjectModel.instance.id, { [FLOAT_SETTINGS_KEY]: rects });
}

/**
 * Keep a floating card inside the editor area, and always leave enough of its
 * header on screen to grab. A card you cannot reach is a card you cannot close.
 */
function constrainFloat(rect: FloatRect, bounds: { width: number; height: number }): FloatRect {
  const width = Math.max(FLOAT_MIN_WIDTH, Math.min(rect.width, Math.max(FLOAT_MIN_WIDTH, bounds.width)));
  const height = Math.max(FLOAT_MIN_HEIGHT, Math.min(rect.height, Math.max(FLOAT_MIN_HEIGHT, bounds.height)));
  return {
    width,
    height,
    // Never over the rail (it has to stay clickable) and never so far right
    // that the header cannot be grabbed to bring it back.
    x: Math.min(Math.max(rect.x, RAIL_WIDTH), Math.max(RAIL_WIDTH, bounds.width - FLOAT_KEEP_VISIBLE)),
    y: Math.min(Math.max(rect.y, 0), Math.max(0, bounds.height - 36))
  };
}

export function useSidePanelLayout(): SidePanelLayout {
  const [activeId, setActiveId] = useState<string>(() => SidebarModel.instance.ActiveId);
  const [widths, setWidths] = useState<Record<string, number>>(readStoredWidths);
  const [mode, setMode] = useState<SidePanelMode>('docked');
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [floatRects, setFloatRects] = useState<Record<string, FloatRect>>(readStoredFloatRects);
  const [editorArea, setEditorAreaState] = useState<{ x: number; y: number; width: number; height: number } | null>(
    null
  );

  // True only between the divider's own dragstart and dragend. `FrameDivider`
  // calls `onSizeChanged` for programmatic changes too (it echoes back a clamped
  // size whenever `size` changes), and persisting those would write the *wide*
  // width in as the panel's remembered width the moment you toggled wide.
  const isDragging = useRef(false);

  useEffect(() => {
    const eventGroup = {};

    SidebarModel.instance.on(
      SidebarModelEvent.activeChanged,
      (panelId: string) => {
        setActiveId(panelId);
        // The mock treats wide as per-session and clears it on a panel switch.
        // Shipped as such and recorded in NOTES as a decision to revisit.
        // The mock treats wide as per-session and clears it on a panel switch.
        // Floating and full are *modes you are working in* — switching panels
        // inside them is the point (the rail stays live), so they persist.
        setMode((prev) => (prev === 'wide' ? 'docked' : prev));
      },
      eventGroup
    );

    return () => {
      SidebarModel.instance.off(eventGroup);
    };
  }, []);

  useEffect(() => {
    // A window resize must NOT change the remembered width. All it does is make
    // the clamp below recompute, so shrinking the window caps the panel and
    // restoring the window brings the width back.
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const wideWidth = useMemo(
    () => Math.min(WIDE_MAX_WIDTH, Math.floor(viewportWidth * WIDE_VIEWPORT_FRACTION)),
    [viewportWidth]
  );

  const maxPanelWidth = useMemo(
    () => Math.max(MIN_PANEL_WIDTH, viewportWidth - RAIL_WIDTH - MIN_CANVAS_WIDTH),
    [viewportWidth]
  );

  const storedWidth = storedWidthFor(widths, activeId) ?? defaultWidthFor(activeId);

  const panelWidth = useMemo(() => {
    // Floating and full take the panel out of the flow entirely — it is
    // positioned over the editor area rather than beside it — so the divider
    // gives all the width to the canvas underneath. Same as hidden, as far as
    // the split is concerned.
    if (mode === 'hidden' || mode === 'floating' || mode === 'full') return 0;
    const target = mode === 'wide' ? wideWidth : storedWidth;
    return Math.min(Math.max(target, MIN_PANEL_WIDTH), maxPanelWidth);
  }, [mode, wideWidth, storedWidth, maxPanelWidth]);

  // The widths as of right now, so the setter below stays pure. Writing to
  // EditorSettings inside a `setState` updater is a side effect during render —
  // and `EditorSettings` notifies its listeners, so panels subscribed to it
  // re-render mid-render. That deadlocks the renderer, which is how this was
  // found rather than reasoned about.
  const widthsRef = useRef(widths);
  widthsRef.current = widths;

  const persistWidth = useCallback((panelId: string, width: number) => {
    if (!panelId) return;
    // FIX-009: written under the *group's* key, so dragging any panel in the
    // selection slot sizes all of them — in both directions.
    const key = widthKeyFor(panelId);
    if (widthsRef.current[key] === width) return;
    const next = { ...widthsRef.current, [key]: width };
    widthsRef.current = next;
    setWidths(next);
    writeStoredWidths(next);
  }, []);

  const onDividerDragStart = useCallback(() => {
    isDragging.current = true;
  }, []);

  const onDividerDragEnd = useCallback(() => {
    isDragging.current = false;
  }, []);

  /**
   * F41: the mode a hidden panel comes back to. A ref rather than state — it is
   * never rendered, and reading it inside a `setMode` updater has to be safe.
   */
  const modeBeforeHidden = useRef<SidePanelMode>('docked');

  /**
   * Run one of the pure transitions above against the live state.
   *
   * The ref write happens inside the updater on purpose, and unlike the width
   * store above (whose write in an updater deadlocked the renderer, see below)
   * this one is safe: a ref assignment notifies nobody, and every transition is
   * a pure function of `prev`, so React re-invoking the updater with the same
   * `prev` — StrictMode's double call — produces the same answer.
   */
  const applyHideTransition = useCallback((transition: (state: SidePanelHideState) => SidePanelHideState) => {
    setMode((prev) => {
      const next = transition({ mode: prev, remembered: modeBeforeHidden.current });
      modeBeforeHidden.current = next.remembered;
      return next.mode;
    });
  }, []);

  const hide = useCallback(() => applyHideTransition(hideTransition), [applyHideTransition]);

  const onDividerSizeChanged = useCallback(
    (size: number) => {
      // Ignore the divider echoing our own programmatic size back at us.
      if (!isDragging.current) return;
      if (typeof size !== 'number' || Number.isNaN(size)) return;

      const dragged = size - RAIL_WIDTH;

      if (dragged < COLLAPSE_SNAP_WIDTH) {
        // Dragging past the floor collapses rather than leaving a sliver. The
        // remembered width is deliberately left alone, so revealing restores it.
        hide();
        return;
      }

      const clamped = Math.min(Math.max(dragged, MIN_PANEL_WIDTH), maxPanelWidth);
      // A deliberate drag back out is a docked width, so it also retires the
      // remembered mode — otherwise a later ⌘B round trip would resurrect a
      // float you had already dragged your way out of.
      applyHideTransition(dockTransition);
      persistWidth(activeId, clamped);
    },
    [activeId, applyHideTransition, hide, maxPanelWidth, persistWidth, storedWidth]
  );

  const toggleWide = useCallback(() => {
    setMode((prev) => (prev === 'wide' ? 'docked' : 'wide'));
  }, []);

  const toggleHidden = useCallback(() => applyHideTransition(toggleHiddenTransition), [applyHideTransition]);

  const toggleFloating = useCallback(() => {
    setMode((prev) => (prev === 'floating' ? 'docked' : 'floating'));
  }, []);

  const toggleFull = useCallback(() => {
    setMode((prev) => (prev === 'full' ? 'docked' : 'full'));
  }, []);

  const openFull = useCallback(() => setMode('full'), []);

  const dock = useCallback(() => applyHideTransition(dockTransition), [applyHideTransition]);

  const setEditorArea = useCallback((bounds: DOMRect) => {
    setEditorAreaState((prev) =>
      prev && prev.x === bounds.x && prev.y === bounds.y && prev.width === bounds.width && prev.height === bounds.height
        ? prev
        : { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }
    );
  }, []);

  const floatRectsRef = useRef(floatRects);
  floatRectsRef.current = floatRects;

  const setFloatRect = useCallback(
    (rect: FloatRect, bounds: { width: number; height: number }) => {
      if (!activeId) return;
      const next = { ...floatRectsRef.current, [activeId]: constrainFloat(rect, bounds) };
      floatRectsRef.current = next;
      setFloatRects(next);
      // Same purity rule as the widths: the write happens beside the setter,
      // never inside its updater.
      writeStoredFloatRects(next);
    },
    [activeId]
  );

  const floatRect = floatRects[activeId] ?? FLOAT_DEFAULT;

  // F41: a rail click brings a hidden panel back to the mode it was hidden from,
  // not unconditionally to docked.
  const revealIfHidden = useCallback(() => applyHideTransition(revealTransition), [applyHideTransition]);

  return {
    dividerSize: RAIL_WIDTH + panelWidth,
    // The floor the divider itself enforces is the collapse threshold, not the
    // panel minimum — dragging *below* the minimum is how you collapse.
    dividerSizeMin: RAIL_WIDTH,
    mode,
    floatRect,
    editorArea,
    setEditorArea,
    onDividerDragStart,
    onDividerSizeChanged,
    onDividerDragEnd,
    toggleWide,
    toggleHidden,
    toggleFloating,
    toggleFull,
    openFull,
    dock,
    setFloatRect,
    revealIfHidden,
    // BLD-009 — the same `hide` the divider's collapse floor already calls. One
    // implementation; the interface name says what a *caller* gets, which is the
    // distinction `openFull` draws against `toggleFull` above.
    hideIfShown: hide
  };
}

export interface SidePanelLayoutProviderProps {
  value: SidePanelLayout;
  children: React.ReactNode;
}

export function SidePanelLayoutProvider({ value, children }: SidePanelLayoutProviderProps) {
  return <SidePanelLayoutContext.Provider value={value}>{children}</SidePanelLayoutContext.Provider>;
}
