import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

/**
 * Tab types supported by the canvas tab system
 */
export type TabType = 'canvas' | 'logic-builder';

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
  // Always start with the canvas tab
  const [tabs, setTabs] = useState<Tab[]>([
    {
      id: 'canvas',
      type: 'canvas'
    }
  ]);

  const [activeTabId, setActiveTabId] = useState<string>('canvas');

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

      // Add new tab
      const tab: Tab = {
        ...newTab,
        id: tabId
      };
      return [...prevTabs, tab];
    });

    // Switch to the new/existing tab
    setActiveTabId(tabId);
  }, []);

  /**
   * Close a tab by ID
   */
  const closeTab = useCallback(
    (tabId: string) => {
      // Can't close the canvas tab
      if (tabId === 'canvas') {
        return;
      }

      setTabs((prevTabs) => {
        const tabIndex = prevTabs.findIndex((t) => t.id === tabId);
        if (tabIndex === -1) {
          return prevTabs;
        }

        const newTabs = prevTabs.filter((t) => t.id !== tabId);

        // If closing the active tab, switch to canvas
        if (activeTabId === tabId) {
          setActiveTabId('canvas');
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
