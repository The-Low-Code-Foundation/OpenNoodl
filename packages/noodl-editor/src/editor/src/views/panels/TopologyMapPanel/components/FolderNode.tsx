/**
 * FolderNode Component
 *
 * Renders a folder node in the topology map with color-coded styling.
 */

import React from 'react';

import { Icon, IconSize } from '@noodl-core-ui/components/common/Icon';

import { calculateFolderSectionPositions } from '../utils/folderCardHeight';
import { getFolderIcon } from '../utils/folderColors';
import { FolderNode as FolderNodeType } from '../utils/topologyTypes';
import css from './FolderNode.module.scss';

interface FolderNodeProps {
  folder: FolderNodeType;
  isSelected?: boolean;
  onClick?: (folder: FolderNodeType) => void;
  onDoubleClick?: (folder: FolderNodeType) => void;
}

/**
 * Renders a folder node with appropriate styling based on folder type.
 */
export function FolderNode({ folder, isSelected = false, onClick, onDoubleClick }: FolderNodeProps) {
  if (!folder.x || !folder.y || !folder.width || !folder.height) {
    return null;
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick?.(folder);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDoubleClick?.(folder);
  };

  const typeClassName = css[`FolderNode--${folder.type}`] || '';
  const selectedClassName = isSelected ? css['FolderNode--selected'] : '';

  // Calculate dynamic positions for each section
  const positions = calculateFolderSectionPositions(folder);

  return (
    <g
      className={`${css['FolderNode']} ${typeClassName} ${selectedClassName}`}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      style={{ cursor: 'pointer' }}
    >
      {/* Background rectangle */}
      <rect
        className={css['FolderNode__background']}
        x={folder.x}
        y={folder.y}
        width={folder.width}
        height={folder.height}
        rx={8}
      />

      {/* Border rectangle */}
      <rect
        className={css['FolderNode__border']}
        x={folder.x}
        y={folder.y}
        width={folder.width}
        height={folder.height}
        rx={8}
      />

      {/* Icon (SVG embedded via foreignObject) */}
      <foreignObject x={folder.x + 12} y={positions.iconY} width={20} height={20}>
        <Icon icon={getFolderIcon(folder.type)} size={IconSize.Default} />
      </foreignObject>

      {/* Folder name - wrapped in foreignObject for proper text wrapping */}
      <foreignObject x={folder.x + 38} y={positions.titleY} width={folder.width - 50} height={positions.titleHeight}>
        <div className={css['FolderNode__nameWrapper']}>{folder.name}</div>
      </foreignObject>

      {/* Component names preview - wrapped in foreignObject for text wrapping */}
      {folder.componentNames.length > 0 && (
        <foreignObject x={folder.x + 12} y={positions.componentListY} width={folder.width - 24} height={30}>
          <div className={css['FolderNode__componentListWrapper']}>
            {folder.componentNames.slice(0, 3).join(', ')}
            {folder.componentNames.length > 3 && `, +${folder.componentNames.length - 3} more`}
          </div>
        </foreignObject>
      )}

      {/* Connection stats */}
      <text className={css['FolderNode__connections']} x={folder.x + 12} y={positions.statsY} fontSize="11">
        {folder.connectionCount.incoming} in • {folder.connectionCount.outgoing} out
      </text>

      {/* Component count */}
      <text
        className={css['FolderNode__count']}
        x={folder.x + folder.width / 2}
        y={positions.countY}
        textAnchor="middle"
        dominantBaseline="middle"
      >
        {folder.componentCount} component{folder.componentCount !== 1 ? 's' : ''}
      </text>
    </g>
  );
}
