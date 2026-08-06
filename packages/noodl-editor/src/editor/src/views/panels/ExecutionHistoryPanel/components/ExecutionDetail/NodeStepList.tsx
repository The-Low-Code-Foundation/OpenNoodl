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
    // WFA-002: found live — "No steps recorded" read as data loss; it is the
    // shape of the data. `ExecutionLogger.startNode` is called by the WF-001
    // workflow engine for every step, so a workflow run always has them.
    //
    // CWF-013 changed the other half and the wording lagged behind it: a cloud
    // function's graph nodes are still never recorded individually, but a `Log`
    // node writes a step of its own. So "a function call is one execution, not
    // node by node" is now true only of a function with no Log node in it —
    // which is exactly the call looking at this message, and is what it says.
    return (
      <div className={styles.Empty}>
        <span>No per-step data.</span>
        <span className={styles.EmptyHint}>
          Workflow runs record every step. A cloud function records only what its Log nodes report — this call
          reached none, so it is one execution with nothing inside it.
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
