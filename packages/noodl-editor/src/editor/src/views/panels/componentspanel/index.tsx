/**
 * ComponentsPanel Wrapper
 *
 * Temporary wrapper that will be replaced with direct import
 * from the new ComponentsPanel React component.
 */

import React from 'react';

import { ComponentsPanel as NewComponentsPanel } from '../ComponentsPanelNew/ComponentsPanelReact';

export interface ComponentsPanelProps {
  options?: {
    showSheetList?: boolean;
    hideSheets?: string[];
  };
}

/**
 * Wrapper component for ComponentsPanel
 * Currently using new React implementation
 */
export function ComponentsPanel({ options }: ComponentsPanelProps) {
  return <NewComponentsPanel options={options} />;
}

// Re-export types for compatibility
export type { ComponentsPanelOptions } from '../ComponentsPanelNew/types';
