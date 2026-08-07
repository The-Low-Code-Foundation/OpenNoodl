/**
 * What a cloud function's canvas says about the world outside it (WFA-006).
 *
 * Two facts, in the bar the descent's breadcrumb lands in — so the descent and
 * its reverse live in the same strip of screen:
 *
 *  - **Used by N workflows.** The reverse lookup (§1, step 6): the question you
 *    ask right before editing a function. Clicking it lists them by backend and
 *    opens one.
 *  - **Deploy.** §2's third case, and the middle of the phase's own loop —
 *    descend into a function, edit it, deploy it, run the workflow. WFA-001
 *    already pushes on save, so this is the explicit gesture beside the implicit
 *    one, and it says which backend it is about to change.
 *
 * WHY NOT `NodeReferencesPanel`: WFA-006-ASSESSMENT §1. In one line, it indexes
 * `ProjectModel` synchronously by node type, and a workflow is in no project,
 * has no nodes, is fetched per backend and may be unreachable — reusing it would
 * mean replacing everything but the file name. It is also registered
 * `experimental`, so it is not in the rail.
 *
 * @module views/NodeGraphComponentTrail/CloudFunctionTrailStatus
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

import { MenuDialogWidth } from '@noodl-core-ui/components/popups/MenuDialog';

import { findFunctionCallers, FunctionUsage, usageLabel } from '@noodl-models/workflow/functionUsage';
import { WorkflowEditorService } from '@noodl-models/workflow/WorkflowEditorService';

import { CloudFunctionDeployer } from '../../services/CloudFunctionDeployer';
import { showContextMenuInPopup } from '../ShowContextMenuInPopup';
import { ToastLayer } from '../ToastLayer/ToastLayer';
import css from './NodeGraphComponentTrail.module.scss';

export interface CloudFunctionTrailStatusProps {
  /** The bare function name — `saveOrder`, not `/#__cloud__/saveOrder`. */
  functionName: string;
  /**
   * The backend this canvas was descended from, when it was descended into.
   * Absent when the function was opened from the Components panel, in which case
   * Deploy means "every running backend", which is what the push has always
   * meant (WFA-001: `projectIds` is dead).
   */
  backendId?: string;
  backendName?: string;
}

export function CloudFunctionTrailStatus({ functionName, backendId, backendName }: CloudFunctionTrailStatusProps) {
  const [usage, setUsage] = useState<FunctionUsage | null>(null);
  const [deploying, setDeploying] = useState(false);
  const usedByRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let cancelled = false;
    setUsage(null);
    findFunctionCallers(functionName).then((result) => {
      if (!cancelled) setUsage(result);
    });
    return () => {
      cancelled = true;
    };
  }, [functionName]);

  const showCallers = useCallback(() => {
    if (!usage) return;

    if (!usage.callers.length) {
      // Nothing to open, and three different reasons for that. Say which.
      const message =
        usage.backendsAsked === 0
          ? usage.unreachable.length
            ? `Could not read the workflows on ${usage.unreachable.join(', ')}.`
            : 'No backend is running, so nothing can be asked which workflows call this function.'
          : `No workflow on any running backend calls "${functionName}".`;
      ToastLayer.showInteraction(message);
      return;
    }

    showContextMenuInPopup({
      items: usage.callers.map((caller) => ({
        label: `${caller.ref.backendName} · ${caller.ref.name}`,
        // The step ids are what makes this specific rather than "somewhere in
        // there" — a workflow may call the same function from two steps.
        tooltip: `Called from ${caller.stepIds.join(', ')}`,
        onClick: () => void WorkflowEditorService.instance.open(caller.ref).catch(() => undefined)
      })),
      width: MenuDialogWidth.Default,
      // PNL-009: anchored to the button, not to the OS cursor — a menu opened
      // from a button must appear at the button, and a synthesised click does
      // not move the cursor.
      attachTo: usedByRef.current || undefined
    });
  }, [functionName, usage]);

  const deploy = useCallback(async () => {
    setDeploying(true);
    try {
      // Force: the point of pressing this is that you do not trust the hash.
      if (backendId) {
        const ok = await CloudFunctionDeployer.pushToBackend(backendId, { force: true });
        if (ok) ToastLayer.showSuccess(`Deployed this project's cloud functions to ${backendName || 'the backend'}.`);
      } else {
        await CloudFunctionDeployer.pushToAllRunning({ force: true });
        ToastLayer.showSuccess("Deployed this project's cloud functions to every running backend.");
      }
    } finally {
      setDeploying(false);
    }
  }, [backendId, backendName]);

  return (
    <>
      <button
        ref={usedByRef}
        className={css['TrailChip']}
        onClick={showCallers}
        data-test="cloud-function-used-by"
        title="Which workflows call this cloud function"
      >
        {usage ? usageLabel(usage) : 'Checking callers…'}
      </button>
      <button
        className={css['TrailChip']}
        onClick={deploy}
        disabled={deploying}
        data-test="cloud-function-deploy"
        title={
          backendName
            ? `Push this project's cloud functions to ${backendName} now`
            : "Push this project's cloud functions to every running backend now"
        }
      >
        {deploying ? 'Deploying…' : backendName ? `Deploy to ${backendName}` : 'Deploy'}
      </button>
    </>
  );
}
