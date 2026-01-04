/**
 * Folder Card Height Calculation
 *
 * Utilities to calculate dynamic heights for folder cards based on content.
 */

import { FolderNode } from './topologyTypes';

/**
 * Configuration for height calculations
 */
const HEIGHT_CONFIG = {
  HEADER_HEIGHT: 40, // Icon + title area base
  LINE_HEIGHT: 18, // Height per text line
  COMPONENT_LIST_HEIGHT: 30, // Height when component list is shown
  FOOTER_HEIGHT: 50, // Stats + count area
  MIN_HEIGHT: 110 // Minimum card height
};

/**
 * Estimates the number of lines a text will wrap to given a max width.
 *
 * @param text The text to measure
 * @param maxCharsPerLine Rough estimate of characters per line (default: 15)
 * @returns Estimated number of lines
 */
export function estimateTextLines(text: string, maxCharsPerLine: number = 15): number {
  if (!text) return 1;
  return Math.max(1, Math.ceil(text.length / maxCharsPerLine));
}

/**
 * Calculates the dynamic height needed for a folder card.
 *
 * @param folder The folder node
 * @returns The calculated height in pixels
 */
export function calculateFolderHeight(folder: FolderNode): number {
  // Calculate title height (max 2 lines with ellipsis)
  const titleLines = Math.min(2, estimateTextLines(folder.name, 15));
  const titleHeight = titleLines * HEIGHT_CONFIG.LINE_HEIGHT;

  // Component list height (if present)
  const componentListHeight = folder.componentNames.length > 0 ? HEIGHT_CONFIG.COMPONENT_LIST_HEIGHT : 0;

  // Total height
  const totalHeight = HEIGHT_CONFIG.HEADER_HEIGHT + titleHeight + componentListHeight + HEIGHT_CONFIG.FOOTER_HEIGHT;

  // Ensure minimum height
  return Math.max(HEIGHT_CONFIG.MIN_HEIGHT, totalHeight);
}

/**
 * Calculates Y positions for each section of the folder card.
 *
 * @param folder The folder node with x, y, width, height set
 * @returns Object with Y positions for each section
 */
export function calculateFolderSectionPositions(folder: FolderNode) {
  const titleLines = Math.min(2, estimateTextLines(folder.name, 15));
  const titleHeight = titleLines * HEIGHT_CONFIG.LINE_HEIGHT;

  return {
    iconY: folder.y! + 16,
    titleY: folder.y! + 14,
    titleHeight: titleHeight + 10, // Add gap after title
    componentListY: folder.y! + HEIGHT_CONFIG.HEADER_HEIGHT + titleHeight + 10,
    statsY: folder.y! + folder.height! - 50,
    countY: folder.y! + folder.height! - 15
  };
}
