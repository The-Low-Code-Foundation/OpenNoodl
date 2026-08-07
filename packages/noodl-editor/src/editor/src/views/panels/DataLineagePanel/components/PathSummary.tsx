/**
 * PathSummary Component
 * Shows a compact summary of the lineage path
 */

import React from 'react';

import type { LineagePath } from '../../../../utils/graphAnalysis';
import css from './PathSummary.module.scss';

export interface PathSummaryProps {
  upstream: LineagePath;
  downstream: LineagePath[];
  selectedNodeLabel: string;
}

export function PathSummary({ upstream, downstream, selectedNodeLabel }: PathSummaryProps) {
  // Build compact path summary
  const upstreamSummary = upstream.steps.map((s) => s.node.label || s.node.typename).join(' → ');
  const downstreamSummaries = downstream.map((path) =>
    path.steps.map((s) => s.node.label || s.node.typename).join(' → ')
  );

  const hasUpstream = upstream.steps.length > 0;
  const hasDownstream = downstream.length > 0 && downstream.some((p) => p.steps.length > 0);

  if (!hasUpstream && !hasDownstream) {
    return null;
  }

  return (
    <div className={css['PathSummary']}>
      <div className={css['PathSummary-title']}>Path Summary</div>
      <div className={css['PathSummary-content']}>
        {hasUpstream && (
          <div className={css['Path']}>
            <span className={css['Path-segment']}>{upstreamSummary}</span>
            <span className={css['Path-arrow']}>→</span>
          </div>
        )}

        <div className={css['Path-selected']}>
          <strong>{selectedNodeLabel}</strong>
        </div>

        {hasDownstream && (
          <>
            {downstreamSummaries.map((summary, index) => (
              <div key={index} className={css['Path']}>
                <span className={css['Path-arrow']}>→</span>
                <span className={css['Path-segment']}>{summary}</span>
                {downstream.length > 1 && <span className={css['Path-branch']}>Branch {index + 1}</span>}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
