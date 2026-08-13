import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';

import { EventDispatcher } from '../../../shared/utils/EventDispatcher';
import { ensureHatsInJson } from '../views/BlocklyEditor/hatMigration';
import { tabLocationRefresh } from '../views/CanvasTabs/tabLocation';
import { tabsClosedByNodeRemoval, RemovedNode } from './canvasTabsNodeRemoval';

/**
 * Tab types supported by the canvas tab system
 */
export type TabType = 'logic-builder';

/**
 * Tab data structure
 */
export interface Tab {
  /** Unique tab identifier */
  id: string;
  /** Type of tab */
  type: TabType;
  /** Node ID (for logic-builder tabs) */
  nodeId?: string;
  /** Node name for display (for logic-builder tabs) */
  nodeName?: string;
  /**
   * VFN-004 — `ComponentModel.id` of the component the node lives in.
   *
   * 🔴 This is the identity the tab navigates by, and the only one. A name is a snapshot that a
   * rename invalidates, and `ProjectModel` has no path normalisation that would make a stale one
   * resolve; an id survives both. The two name fields below are display only.
   *
   * Optional because a tab can be opened without one (a caller that emits `LogicBuilder.OpenTab`
   * by hand), and a tab that does not know where it belongs must say nothing rather than guess —
   * see `isTabAway` in `views/CanvasTabs/tabLocation.ts`.
   */
  componentId?: string;
  /** `ComponentModel.displayName` at open time — the tab's first segment. Display only. */
  componentName?: string;
  /** `ComponentModel.fullName` at open time — the tooltip, and the refusal. Display only. */
  componentPath?: string;
  /** Blockly workspace JSON (for logic-builder tabs) */
  workspace?: string;
  /**
   * VFN-011 — the node's saved `generatedCode` at the moment the tab was opened.
   *
   * ⚠️ **A snapshot, and read-only.** It is here so the block editor's value strip can tell a
   * program generated before value tracing — one that emits no `__p`/`__s`, so no badge can ever
   * appear for it — from one that simply has not run yet. Nothing writes it back: the node's own
   * parameter is updated by the workspace's flush, not from here.
   */
  generatedCode?: string;
}

/**
 * Context value shape
 */
export interface CanvasTabsContextValue {
  /** All open tabs */
  tabs: Tab[];
  /** Currently active tab ID */
  activeTabId: string;
  /** Open a new tab or switch to existing */
  openTab: (tab: Omit<Tab, 'id'> & { id?: string }) => void;
  /** Close a tab by ID */
  closeTab: (tabId: string) => void;
  /** Close several tabs in one transition — see the note on the implementation */
  closeTabs: (tabIds: readonly string[]) => void;
  /** Switch to a different tab */
  switchTab: (tabId: string) => void;
  /** Update tab data */
  updateTab: (tabId: string, updates: Partial<Tab>) => void;
  /** Get tab by ID */
  getTab: (tabId: string) => Tab | undefined;
}

/** What `Model.nodeRemoved` carries, narrowed to the one field VFN-001 reads. */
interface NodeRemovedEvent {
  args?: {
    model?: RemovedNode;
  };
}

const CanvasTabsContext = createContext<CanvasTabsContextValue | undefined>(undefined);

/**
 * Hook to access canvas tabs context
 */
export function useCanvasTabs(): CanvasTabsContextValue {
  const context = useContext(CanvasTabsContext);
  if (!context) {
    throw new Error('useCanvasTabs must be used within a CanvasTabsProvider');
  }
  return context;
}

interface CanvasTabsProviderProps {
  children: ReactNode;
}

/**
 * Provider for canvas tabs state
 */
export function CanvasTabsProvider({ children }: CanvasTabsProviderProps) {
  // Start with no tabs - Logic Builder tabs are opened on demand
  const [tabs, setTabs] = useState<Tab[]>([]);

  const [activeTabId, setActiveTabId] = useState<string | undefined>(undefined);

  /**
   * Open a new tab or switch to existing one
   */
  const openTab = useCallback((newTab: Omit<Tab, 'id'> & { id?: string }) => {
    // Generate ID if not provided
    const tabId = newTab.id || `${newTab.type}-${newTab.nodeId || Date.now()}`;

    setTabs((prevTabs) => {
      // Check if tab already exists
      const existingTab = prevTabs.find((t) => t.id === tabId);
      if (existingTab) {
        // Tab exists, just switch to it
        setActiveTabId(tabId);

        /**
         * VFN-004 — but refresh where it says it belongs.
         *
         * The decision lives in `tabLocationRefresh` rather than here, for the reason every
         * decision in this provider ends up there: the provider cannot be rendered by either of
         * this package's runners, so anything left inside it cannot be graded. `undefined` means
         * nothing would change, and handing React the same array back is what stops a reopen of
         * an unchanged tab from re-rendering the mounted Blockly workspaces.
         */
        const refreshed = tabLocationRefresh(existingTab, newTab);
        if (!refreshed) return prevTabs;

        return prevTabs.map((t) => (t.id === tabId ? { ...t, ...refreshed } : t));
      }

      /**
       * LGC-009 — a program acquires its hat here, on the way in.
       *
       * This is the one seam every block editor opens through, and it is deliberately *not*
       * inside `BlocklyWorkspace`: the workspace component reads `initialWorkspace` once and
       * never reloads it, so a migration applied after injection would fight the load it was
       * meant to precede. Doing it here also means the migration is a pure string-to-string
       * transform with nothing rendered around it.
       *
       * ⚠️ **Nothing is written to disk here.** The node's `workspace` parameter is untouched
       * until the author's first settled edit flushes the workspace back through
       * `handleBlocklyWorkspaceChange` — so opening a program and closing it again changes no
       * bytes, which is what LGC-002 §2 and LGC-004 #13 grade.
       *
       * `seedEmpty` is what makes the hat mandatory for a program that does not exist yet: a
       * freshly dropped Visual Function opens with a hat on the canvas rather than with the
       * empty sheet that used to leave "where does this start?" unanswerable.
       */
      const tab: Tab = {
        ...newTab,
        workspace: ensureHatsInJson(newTab.workspace, { seedEmpty: true }),
        id: tabId
      };

      const newTabs = [...prevTabs, tab];

      // Emit event that a Logic Builder tab was opened (first tab)
      if (prevTabs.length === 0) {
        EventDispatcher.instance.emit('LogicBuilder.TabOpened');
      }

      return newTabs;
    });

    // Switch to the new/existing tab
    setActiveTabId(tabId);
  }, []);

  /**
   * Listen for Logic Builder tab open requests from property panel
   */
  useEffect(() => {
    const context = {};

    const handleOpenTab = (data: {
      nodeId: string;
      nodeName: string;
      workspace: string;
      /** VFN-004 — where the node lives. Absent from a caller that predates the field. */
      componentId?: string;
      componentName?: string;
      componentPath?: string;
      generatedCode?: string;
    }) => {
      console.log('[CanvasTabsContext] Received LogicBuilder.OpenTab event:', data);
      openTab({
        type: 'logic-builder',
        nodeId: data.nodeId,
        nodeName: data.nodeName,
        componentId: data.componentId,
        componentName: data.componentName,
        componentPath: data.componentPath,
        workspace: data.workspace,
        // VFN-011 — a snapshot of what the app would run, carried for the value strip's empty
        // state. Optional: an older emitter that does not send it leaves the strip unable to
        // accuse the program of being stale, which is the correct silence.
        generatedCode: data.generatedCode
      });
    };

    EventDispatcher.instance.on('LogicBuilder.OpenTab', handleOpenTab, context);

    return () => {
      EventDispatcher.instance.off(context);
    };
  }, [openTab]);

  /**
   * Close a set of tabs in one transition.
   *
   * ⚠️ One call rather than a loop of `closeTab`, and that is load-bearing. Two `closeTab` calls
   * in the same handler are batched, so both read the `activeTabId` of the render they were
   * scheduled from: the first sees a survivor and hands the active id to it, the second no longer
   * matches the active id at all, and `LogicBuilder.AllTabsClosed` — the only route by which the
   * floating window closes — is never emitted. Closing two tabs at once is not exotic: it is what
   * deleting a group containing two Visual Functions does, and what *Done* does.
   *
   * `setActiveTabId` takes the functional form for the same reason: what the next active tab
   * should be is a question about the tabs that survive, not about the render this was called in.
   */
  const closeTabs = useCallback((tabIds: readonly string[]) => {
    if (tabIds.length === 0) return;
    const closing = new Set(tabIds);

    setTabs((prevTabs) => {
      const remaining = prevTabs.filter((t) => !closing.has(t.id));
      if (remaining.length === prevTabs.length) return prevTabs;

      setActiveTabId((prevActive) => {
        if (remaining.length === 0) return undefined;
        if (prevActive && remaining.some((t) => t.id === prevActive)) return prevActive;
        return remaining[remaining.length - 1].id;
      });

      if (remaining.length === 0) {
        // The last tab going is what closes the window. There is deliberately no separate
        // "window is open" state for this to get out of step with.
        EventDispatcher.instance.emit('LogicBuilder.AllTabsClosed');
      }

      return remaining;
    });
  }, []);

  /**
   * Close a tab by ID
   */
  const closeTab = useCallback(
    (tabId: string) => {
      closeTabs([tabId]);
    },
    [closeTabs]
  );

  /**
   * 🔴 VFN-001 — a deleted node takes its tab with it.
   *
   * The second half of the report: *"including potentially the very logic node you're editing,
   * and then the editor stays open which shouldn't happen"*. However the node goes — the fixed
   * Delete, the context menu, an undo of the paste that created it — the tab that was editing it
   * survived, holding a `nodeId` that resolves to nothing. `BlockTraceClient` keeps arming a node
   * that is gone, and the 300 ms debounce writes the workspace back to a model that is no longer
   * in the graph.
   *
   * `Model.nodeRemoved` fires once for the removed node, and `forEach` covers it and its
   * descendants — a Visual Function nested under a group is removed with the group and emits no
   * event of its own.
   *
   * 🔴 Closing through `closeTabs` and nothing else is deliberate. When the last tab goes it fires
   * `LogicBuilder.AllTabsClosed`, which is the single route by which the window closes; a
   * "hide the window" flag here would be a second source of truth for the window's open-ness,
   * which is derived from which tabs are open and from nothing else.
   */
  useEffect(() => {
    const context = {};

    EventDispatcher.instance.on(
      'Model.nodeRemoved',
      (event: NodeRemovedEvent) => {
        closeTabs(tabsClosedByNodeRemoval(tabs, event?.args?.model));
      },
      context
    );

    return () => {
      EventDispatcher.instance.off(context);
    };
  }, [tabs, closeTabs]);

  /**
   * Switch to a different tab
   */
  const switchTab = useCallback((tabId: string) => {
    setTabs((prevTabs) => {
      // Verify tab exists
      const tab = prevTabs.find((t) => t.id === tabId);
      if (!tab) {
        console.warn(`[CanvasTabs] Tab ${tabId} not found`);
        return prevTabs;
      }

      setActiveTabId(tabId);
      return prevTabs;
    });
  }, []);

  /**
   * Update tab data
   */
  const updateTab = useCallback((tabId: string, updates: Partial<Tab>) => {
    setTabs((prevTabs) => {
      return prevTabs.map((tab) => {
        if (tab.id === tabId) {
          return { ...tab, ...updates };
        }
        return tab;
      });
    });
  }, []);

  /**
   * Get tab by ID
   */
  const getTab = useCallback(
    (tabId: string): Tab | undefined => {
      return tabs.find((t) => t.id === tabId);
    },
    [tabs]
  );

  const value: CanvasTabsContextValue = {
    tabs,
    activeTabId,
    openTab,
    closeTab,
    closeTabs,
    switchTab,
    updateTab,
    getTab
  };

  return <CanvasTabsContext.Provider value={value}>{children}</CanvasTabsContext.Provider>;
}
