/**
 * TopologyNode Component
 *
 * Renders a single component node in the topology map.
 */

import classNames from 'classnames';
import React from 'react';

import { TopologyNode as TopologyNodeType } from '../utils/topologyTypes';
import css from './TopologyNode.module.scss';

export interface TopologyNodeProps {
  node: TopologyNodeType;
  onClick?: (node: TopologyNodeType) => void;
  onMouseEnter?: (node: TopologyNodeType, event: React.MouseEvent) => void;
  onMouseLeave?: (node: TopologyNodeType, event: React.MouseEvent) => void;
}

export function TopologyNode({ node, onClick, onMouseEnter, onMouseLeave }: TopologyNodeProps) {
  if (node.x === undefined || node.y === undefined || !node.width || !node.height) {
    return null;
  }

  const isOrphan = node.usageCount === 0 && node.depth === 999;

  return (
    <g
      className={classNames(css['TopologyNode'], {
        [css['TopologyNode--page']]: node.type === 'page',
        [css['TopologyNode--current']]: node.isCurrentComponent,
        [css['TopologyNode--shared']]: node.usageCount >= 2,
        [css['TopologyNode--orphan']]: isOrphan
      })}
      transform={`translate(${node.x}, ${node.y})`}
      onClick={() => onClick?.(node)}
      onMouseEnter={(e) => onMouseEnter?.(node, e)}
      onMouseLeave={(e) => onMouseLeave?.(node, e)}
      style={{ cursor: 'pointer' }}
    >
      {/* Background rectangle */}
      <rect className={css['TopologyNode__rect']} width={node.width} height={node.height} rx={4} />

      {/* Node icon indicator */}
      <text className={css['TopologyNode__icon']} x={8} y={20} fontSize={14}>
        {node.type === 'page' ? '📄' : '🧩'}
      </text>

      {/* Component name */}
      <text
        className={css['TopologyNode__text']}
        x={node.width / 2}
        y={node.height / 2 + 4}
        textAnchor="middle"
        fontSize={12}
      >
        {node.name.length > 15 ? node.name.substring(0, 13) + '...' : node.name}
      </text>

      {/* Current component indicator */}
      {node.isCurrentComponent && (
        <text className={css['TopologyNode__star']} x={node.width - 20} y={20} fontSize={16}>
          ⭐
        </text>
      )}

      {/* Usage count badge (for shared components) */}
      {node.usageCount >= 2 && (
        <g transform={`translate(${node.width - 24}, ${node.height - 20})`}>
          <circle className={css['TopologyNode__badge']} cx={12} cy={10} r={10} />
          <text className={css['TopologyNode__badgeText']} x={12} y={14} textAnchor="middle" fontSize={10}>
            ×{node.usageCount}
          </text>
        </g>
      )}

      {/* Orphan warning indicator */}
      {isOrphan && (
        <g transform={`translate(${node.width - 20}, 8)`}>
          <circle className={css['TopologyNode__warning']} cx={8} cy={8} r={8} />
          <text className={css['TopologyNode__warningText']} x={8} y={12} textAnchor="middle" fontSize={12}>
            !
          </text>
        </g>
      )}
    </g>
  );
}
