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

export type SidePanelMode = 'docked' | 'wide' | 'hidden';

export interface SidePanelLayout {
  /** What the `FrameDivider` should be sized to: rail + panel. */
  dividerSize: number;
  dividerSizeMin: number;
  mode: SidePanelMode;
  /** The divider's own drag callbacks. */
  onDividerDragStart: () => void;
  onDividerSizeChanged: (size: number) => void;
  onDividerDragEnd: () => void;
  toggleWide: () => void;
  toggleHidden: () => void;
  /** Clicking a rail icon must bring a hidden panel back. */
  revealIfHidden: () => void;
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

export function useSidePanelLayout(): SidePanelLayout {
  const [activeId, setActiveId] = useState<string>(() => SidebarModel.instance.ActiveId);
  const [widths, setWidths] = useState<Record<string, number>>(readStoredWidths);
  const [mode, setMode] = useState<SidePanelMode>('docked');
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);

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

  const storedWidth = widths[activeId] ?? defaultWidthFor(activeId);

  const panelWidth = useMemo(() => {
    if (mode === 'hidden') return 0;
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
    if (widthsRef.current[panelId] === width) return;
    const next = { ...widthsRef.current, [panelId]: width };
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

  const onDividerSizeChanged = useCallback(
    (size: number) => {
      // Ignore the divider echoing our own programmatic size back at us.
      if (!isDragging.current) return;
      if (typeof size !== 'number' || Number.isNaN(size)) return;

      const dragged = size - RAIL_WIDTH;

      if (dragged < COLLAPSE_SNAP_WIDTH) {
        // Dragging past the floor collapses rather than leaving a sliver. The
        // remembered width is deliberately left alone, so revealing restores it.
        setMode('hidden');
        return;
      }

      const clamped = Math.min(Math.max(dragged, MIN_PANEL_WIDTH), maxPanelWidth);
      setMode('docked');
      persistWidth(activeId, clamped);
    },
    [activeId, maxPanelWidth, persistWidth, storedWidth]
  );

  const toggleWide = useCallback(() => {
    setMode((prev) => (prev === 'wide' ? 'docked' : 'wide'));
  }, []);

  const toggleHidden = useCallback(() => {
    setMode((prev) => (prev === 'hidden' ? 'docked' : 'hidden'));
  }, []);

  const revealIfHidden = useCallback(() => {
    setMode((prev) => (prev === 'hidden' ? 'docked' : prev));
  }, []);

  return {
    dividerSize: RAIL_WIDTH + panelWidth,
    // The floor the divider itself enforces is the collapse threshold, not the
    // panel minimum — dragging *below* the minimum is how you collapse.
    dividerSizeMin: RAIL_WIDTH,
    mode,
    onDividerDragStart,
    onDividerSizeChanged,
    onDividerDragEnd,
    toggleWide,
    toggleHidden,
    revealIfHidden
  };
}

export interface SidePanelLayoutProviderProps {
  value: SidePanelLayout;
  children: React.ReactNode;
}

export function SidePanelLayoutProvider({ value, children }: SidePanelLayoutProviderProps) {
  return <SidePanelLayoutContext.Provider value={value}>{children}</SidePanelLayoutContext.Provider>;
}
