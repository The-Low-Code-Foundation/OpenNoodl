/**
 * BoundaryIndicator - Visual indicator for cross-component path boundaries
 *
 * Displays a floating badge when a highlighted path continues into a parent or child component.
 * Shows the component name and provides a navigation button to jump to that component.
 *
 * @example
 * ```tsx
 * <BoundaryIndicator
 *   boundary={{
 *     fromComponent: 'App',
 *     toComponent: 'UserCard',
 *     direction: 'down',
 *     edgeNodeId: 'node-123'
 *   }}
 *   position={{ x: 100, y: 200 }}
 *   onNavigate={(componentName) => editor.switchToComponent(componentName)}
 * />
 * ```
 */

import React from 'react';

import type { ComponentBoundary } from '../../../services/HighlightManager';
import css from './BoundaryIndicator.module.scss';

export interface BoundaryIndicatorProps {
  /** Component boundary information */
  boundary: ComponentBoundary;

  /** Position on canvas (canvas coordinates) */
  position: {
    x: number;
    y: number;
  };

  /** Callback when user clicks navigation button */
  onNavigate: (componentName: string) => void;
}

/**
 * BoundaryIndicator component
 *
 * Renders a floating badge indicating that a highlighted path continues into another component.
 * Includes a navigation button to jump to that component.
 */
export function BoundaryIndicator({ boundary, position, onNavigate }: BoundaryIndicatorProps) {
  const isGoingUp = boundary.direction === 'up';
  const targetComponent = boundary.toComponent;

  const handleNavigate = (e: React.MouseEvent) => {
    e.stopPropagation();
    onNavigate(targetComponent);
  };

  // Position the indicator
  const style: React.CSSProperties = {
    left: `${position.x}px`,
    top: `${position.y}px`
  };

  return (
    <div
      className={`${css.boundaryIndicator} ${isGoingUp ? css.directionUp : css.directionDown}`}
      style={style}
      data-boundary-id={`${boundary.fromComponent}-${boundary.toComponent}`}
    >
      <div className={css.content}>
        <div className={css.icon}>{isGoingUp ? '↑' : '↓'}</div>
        <div className={css.label}>
          <div className={css.text}>Path continues in</div>
          <div className={css.componentName}>{targetComponent}</div>
        </div>
        <button
          className={css.navigateButton}
          onClick={handleNavigate}
          title={`Navigate to ${targetComponent}`}
          type="button"
        >
          →
        </button>
      </div>
    </div>
  );
}
