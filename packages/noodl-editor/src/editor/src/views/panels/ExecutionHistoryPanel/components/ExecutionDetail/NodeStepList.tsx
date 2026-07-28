import React, { useMemo } from 'react';

import type { ExecutionStep } from '@noodl-viewer-cloud/execution-history';

import { NodeStepItem } from './NodeStepItem';
import styles from './NodeStepList.module.scss';
import { annotateSteps } from './stepAnnotations';

interface Props {
  steps: ExecutionStep[];
}

/**
 * Ordered list of node execution steps, in the DAG order the engine ran them.
 *
 * `skipped` steps are included: they are the record of the paths a branch did
 * NOT take, which is the thing a user is usually looking for.
 */
export function NodeStepList({ steps }: Props) {
  const annotations = useMemo(() => annotateSteps(steps), [steps]);

  if (steps.length === 0) {
    // WFA-002: found live — a cloud function call ALWAYS lands here.
    // `ExecutionLogger.startNode` is called only by the WF-001 workflow engine,
    // so a function's graph nodes are never recorded individually. "No steps
    // recorded" read as data loss; it is the shape of the data.
    return (
      <div className={styles.Empty}>
        <span>No per-step data.</span>
        <span className={styles.EmptyHint}>
          Only workflow runs record steps. A cloud function call is recorded as one execution, not node by node.
        </span>
      </div>
    );
  }

  return (
    <div className={styles.List}>
      {steps.map((step, i) => (
        <NodeStepItem key={step.id} step={step} index={i} annotation={annotations.get(step.id) ?? {}} />
      ))}
    </div>
  );
}
