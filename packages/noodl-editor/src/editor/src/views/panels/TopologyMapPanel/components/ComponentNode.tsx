/**
 * ComponentNode Component
 *
 * Renders a single component node in the expanded folder view.
 * Styled as a card with color inherited from parent folder type.
 */

import React from 'react';

import { ComponentModel } from '@noodl-models/componentmodel';

import { Icon, IconSize } from '@noodl-core-ui/components/common/Icon';

import { formatStatsShort, getComponentQuickStats } from '../utils/componentStats';
import { getComponentIcon } from '../utils/folderColors';
import { FolderType } from '../utils/topologyTypes';
import css from './ComponentNode.module.scss';

export interface ComponentNodeProps {
  component: ComponentModel;
  folderType: FolderType;
  x: number;
  y: number;
  width: number;
  height: number;
  onClick?: (component: ComponentModel) => void;
  isSelected?: boolean;
  isAppComponent?: boolean;
}

/**
 * Splits text into lines for multi-line display.
 * Tries to break at sensible points (/, ., -) when possible.
 */
function splitTextForDisplay(text: string, maxCharsPerLine: number = 20): string[] {
  if (text.length <= maxCharsPerLine) return [text];

  const lines: string[] = [];
  let remaining = text;

  while (remaining.length > maxCharsPerLine) {
    // Try to find a good break point
    let breakIndex = maxCharsPerLine;
    const slashIndex = remaining.lastIndexOf('/', maxCharsPerLine);
    const dotIndex = remaining.lastIndexOf('.', maxCharsPerLine);
    const dashIndex = remaining.lastIndexOf('-', maxCharsPerLine);

    // Use the best break point found
    if (slashIndex > 0 && slashIndex > maxCharsPerLine - 10) {
      breakIndex = slashIndex + 1; // Include the slash in the current line
    } else if (dotIndex > 0 && dotIndex > maxCharsPerLine - 10) {
      breakIndex = dotIndex + 1;
    } else if (dashIndex > 0 && dashIndex > maxCharsPerLine - 10) {
      breakIndex = dashIndex + 1;
    }

    lines.push(remaining.slice(0, breakIndex));
    remaining = remaining.slice(breakIndex);
  }

  if (remaining) {
    lines.push(remaining);
  }

  return lines;
}

/**
 * Calculates the dynamic height needed for a component card based on text length.
 */
export function calculateComponentNodeHeight(componentName: string, baseHeight: number = 80): number {
  const lines = splitTextForDisplay(componentName);
  const extraLines = Math.max(0, lines.length - 1);
  const lineHeight = 14;
  return baseHeight + extraLines * lineHeight;
}

/**
 * Renders a card-style component node with inherited folder colors
 */
export function ComponentNode({
  component,
  folderType,
  x,
  y,
  width,
  height,
  onClick,
  isSelected = false,
  isAppComponent = false
}: ComponentNodeProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick?.(component);
  };

  const typeClass = css[`ComponentNode--${folderType}`] || '';
  const selectedClass = isSelected ? css['ComponentNode--selected'] : '';
  const appClass = isAppComponent ? css['ComponentNode--app'] : '';
  const nameLines = splitTextForDisplay(component.name);

  // Calculate stats
  const stats = getComponentQuickStats(component);
  const statsText = formatStatsShort(stats);

  // Get node list
  const nodeNames: string[] = [];
  component.graph.forEachNode((node) => {
    // Get the last part of the node type (e.g., "Group" from "noodl.visual.Group")
    const typeName = node.typename || node.type?.split('.').pop() || '';
    if (typeName) {
      nodeNames.push(typeName);
    }
  });
  const sortedNodeNames = [...new Set(nodeNames)].sort(); // Unique and sorted
  const displayNodeList = sortedNodeNames.slice(0, 5).join(', ');
  const remainingCount = sortedNodeNames.length - 5;

  // Calculate layout
  const iconSize = 16;
  const padding = 12;
  const headerHeight = 36;
  const footerY = y + height - 40;
  const nodeListY = y + height - 22;
  const nameStartY = y + headerHeight / 2 + 2;

  return (
    <g
      className={`${css['ComponentNode']} ${typeClass} ${selectedClass} ${appClass}`}
      onClick={handleClick}
      style={{ cursor: 'pointer' }}
    >
      {/* Card background */}
      <rect className={css['ComponentNode__background']} x={x} y={y} width={width} height={height} rx={8} />

      {/* Card border */}
      <rect className={css['ComponentNode__border']} x={x} y={y} width={width} height={height} rx={8} />

      {/* Header section with icon */}
      <g className={css['ComponentNode__header']}>
        {/* SVG Icon via foreignObject */}
        <foreignObject x={x + padding} y={y + (headerHeight - iconSize) / 2} width={iconSize} height={iconSize}>
          <Icon icon={getComponentIcon(component)} size={IconSize.Small} />
        </foreignObject>
      </g>

      {/* Component name (multi-line) */}
      <text
        className={css['ComponentNode__name']}
        x={x + padding + iconSize + 8}
        y={nameStartY}
        fontSize="13"
        fontWeight="600"
      >
        {nameLines.map((line, index) => (
          <tspan key={index} x={x + padding + iconSize + 8} dy={index === 0 ? 0 : 14}>
            {line}
          </tspan>
        ))}
      </text>

      {/* X-Ray stats (footer) */}
      <text
        className={css['ComponentNode__stats']}
        x={x + width / 2}
        y={footerY}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="10"
      >
        {statsText}
      </text>

      {/* Node list */}
      {sortedNodeNames.length > 0 && (
        <text className={css['ComponentNode__nodeList']} x={x + padding} y={nodeListY} fontSize="9">
          {displayNodeList}
          {remainingCount > 0 && ` +${remainingCount}`}
        </text>
      )}
    </g>
  );
}
