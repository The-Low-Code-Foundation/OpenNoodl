import React, { useContext, createContext, useMemo, useState } from 'react';

import { getNodePickerSize, NodePickerSize } from './NodePicker.constants';

export interface NodePickerFooterState {
  hints: { keys: string[]; label: string }[];
  status?: string;
}

export interface INodePickerContext {
  isBlocked: boolean;
  doBlockPicker: () => void;
  doUnblockPicker: () => void;

  activeTab: string;
  setActiveTab: (value: string) => void;

  /**
   * The panel's actual pixel size (UIX-013). Derived once from the viewport in
   * `NodePicker.constants` and shared, so the wrapper element, the stylesheet
   * and the layout decisions that depend on width (grid columns, whether the
   * rail and preview fit) all read the same number.
   */
  size: NodePickerSize;

  /** Footer hint bar contents, published by the active tab. */
  footer: NodePickerFooterState;
  setFooter: (footer: NodePickerFooterState) => void;
}

const DEFAULT_FOOTER: NodePickerFooterState = { hints: [] };

const NodePickerContext = createContext<INodePickerContext>(undefined);

export interface NodePickerContextProviderProps {
  children: React.ReactNode;
  /**
   * The size the wrapper element was given. Passed in rather than recomputed so
   * the measured element and the rendered panel are the same size by
   * construction, not by both happening to ask the same question.
   */
  size?: NodePickerSize;
}

export function NodePickerContextProvider({ children, size: sizeProp }: NodePickerContextProviderProps) {
  const [isBlocked, setIsBlocked] = useState(false);
  const [activeTab, setActiveTab] = useState('Nodes');
  const [footer, setFooter] = useState<NodePickerFooterState>(DEFAULT_FOOTER);

  // Sized once per open: the popup does not resize with the window while it is
  // showing, and re-measuring mid-session would reflow the grid under the user.
  const [size] = useState(() => sizeProp ?? getNodePickerSize());

  const value = useMemo(
    () => ({
      isBlocked,
      doBlockPicker: () => setIsBlocked(true),
      doUnblockPicker: () => setIsBlocked(false),
      activeTab,
      setActiveTab,
      size,
      footer,
      setFooter
    }),
    [isBlocked, activeTab, size, footer]
  );

  return <NodePickerContext.Provider value={value}>{children}</NodePickerContext.Provider>;
}

export function useNodePickerContext() {
  const context = useContext(NodePickerContext);

  if (context === undefined) {
    throw new Error('useNodePickerContext must be a child of NodePickerContextProvider');
  }

  return context;
}
