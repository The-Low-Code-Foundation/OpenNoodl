/**
 * LineagePath Component
 * Displays a single lineage path (upstream or downstream)
 */

import React from 'react';

import type { LineagePath as LineagePathType } from '../../../../utils/graphAnalysis';
import css from './LineagePath.module.scss';

export interface LineagePathProps {
  path: LineagePathType;
  direction: 'upstream' | 'downstream';
  onNavigateToNode: (componentName: string, nodeId: string) => void;
}

export function LineagePath({ path, direction, onNavigateToNode }: LineagePathProps) {
  if (!path || path.steps.length === 0) {
    return null;
  }

  return (
    <div className={css['LineagePath']} data-direction={direction}>
      {path.steps.map((step, index) => (
        <div key={`${step.node.id}-${index}`} className={css['Step']}>
          <div
            className={css['Step-node']}
            onClick={() => onNavigateToNode(step.component.name, step.node.id)}
            title={`Click to navigate to ${step.node.label || step.node.typename}`}
          >
            <span className={css['Step-icon']}>🔵</span>
            <span className={css['Step-label']}>{step.node.label || step.node.typename}</span>
            {step.port && <span className={css['Step-port']}>→ {step.port}</span>}
          </div>

          {step.transformation && <div className={css['Step-transformation']}>{step.transformation}</div>}

          {step.isSource && <div className={css['Step-badge']}>SOURCE</div>}
          {step.isSink && <div className={css['Step-badge']}>SINK</div>}

          {index < path.steps.length - 1 && <div className={css['Step-arrow']}>↓</div>}
        </div>
      ))}

      {path.crossings && path.crossings.length > 0 && (
        <div className={css['Crossings']}>
          <div className={css['Crossings-label']}>Component boundaries crossed: {path.crossings.length}</div>
        </div>
      )}
    </div>
  );
}
