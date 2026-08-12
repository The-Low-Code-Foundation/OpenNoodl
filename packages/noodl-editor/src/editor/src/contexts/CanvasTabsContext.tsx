import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';

import { EventDispatcher } from '../../../shared/utils/EventDispatcher';
import { ensureHatsInJson } from '../views/BlocklyEditor/hatMigration';

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
  /** Blockly workspace JSON (for logic-builder tabs) */
  workspace?: string;
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
  /** Switch to a different tab */
  switchTab: (tabId: string) => void;
  /** Update tab data */
  updateTab: (tabId: string, updates: Partial<Tab>) => void;
  /** Get tab by ID */
  getTab: (tabId: string) => Tab | undefined;
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
        return prevTabs;
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

    const handleOpenTab = (data: { nodeId: string; nodeName: string; workspace: string }) => {
      console.log('[CanvasTabsContext] Received LogicBuilder.OpenTab event:', data);
      openTab({
        type: 'logic-builder',
        nodeId: data.nodeId,
        nodeName: data.nodeName,
        workspace: data.workspace
      });
    };

    EventDispatcher.instance.on('LogicBuilder.OpenTab', handleOpenTab, context);

    return () => {
      EventDispatcher.instance.off(context);
    };
  }, [openTab]);

  /**
   * Close a tab by ID
   */
  const closeTab = useCallback(
    (tabId: string) => {
      setTabs((prevTabs) => {
        const tabIndex = prevTabs.findIndex((t) => t.id === tabId);
        if (tabIndex === -1) {
          return prevTabs;
        }

        const newTabs = prevTabs.filter((t) => t.id !== tabId);

        // If closing the active tab, switch to another tab or clear active
        if (activeTabId === tabId) {
          if (newTabs.length > 0) {
            setActiveTabId(newTabs[newTabs.length - 1].id);
          } else {
            setActiveTabId(undefined);
            // Emit event that all Logic Builder tabs are closed
            EventDispatcher.instance.emit('LogicBuilder.AllTabsClosed');
          }
        }

        return newTabs;
      });
    },
    [activeTabId]
  );

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
    switchTab,
    updateTab,
    getTab
  };

  return <CanvasTabsContext.Provider value={value}>{children}</CanvasTabsContext.Provider>;
}
