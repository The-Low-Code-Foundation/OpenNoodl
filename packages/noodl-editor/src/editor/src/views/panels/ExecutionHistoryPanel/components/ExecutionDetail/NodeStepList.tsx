import React from 'react';

import type { ExecutionStep } from '@noodl-viewer-cloud/execution-history';

import { NodeStepItem } from './NodeStepItem';
import styles from './NodeStepList.module.scss';

interface Props {
  steps: ExecutionStep[];
}

/** Ordered list of node execution steps. */
export function NodeStepList({ steps }: Props) {
  if (steps.length === 0) {
    return <div className={styles.Empty}>No steps recorded</div>;
  }

  return (
    <div className={styles.List}>
      {steps.map((step, i) => (
        <NodeStepItem key={step.id} step={step} index={i} />
      ))}
    </div>
  );
}
