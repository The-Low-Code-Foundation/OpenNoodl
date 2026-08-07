import { useBackendStatusChanged } from '@noodl-hooks/useBackendStatusChanged';
import { useEventListener } from '@noodl-hooks/useEventListener';
import React, { useCallback, useState } from 'react';

import { IconName } from '@noodl-core-ui/components/common/Icon';
import { IconButton, IconButtonVariant } from '@noodl-core-ui/components/inputs/IconButton';
import { BasePanel } from '@noodl-core-ui/components/sidebar/BasePanel';
import { Tooltip } from '@noodl-core-ui/components/popups/Tooltip';

import { SidebarModel, SidebarModelEvent } from '@noodl-models/sidebar/sidebarmodel';
import { workflowComponentName } from '@noodl-models/workflow/WorkflowComponentModel';
import { WorkflowEditorService } from '@noodl-models/workflow/WorkflowEditorService';

import { EventDispatcher } from '../../../../../shared/utils/EventDispatcher';
import { ExecutionDetail } from './components/ExecutionDetail/ExecutionDetail';
import { ExecutionFilters } from './components/ExecutionFilters/ExecutionFilters';
import { ExecutionList } from './components/ExecutionList/ExecutionList';
import { RunWorkflow } from './components/RunWorkflow/RunWorkflow';
import styles from './ExecutionHistoryPanel.module.scss';
import { useExecutionDetail } from './hooks/useExecutionDetail';
import { type ExecutionFilters as FiltersState, useExecutionHistory } from './hooks/useExecutionHistory';
import { useWorkflowRunner } from './hooks/useWorkflowRunner';

/**
 * FH-012: the run whose canvas we can open, and the identity of that canvas.
 *
 * Typed structurally rather than importing `ExecutionWithSteps` — only these
 * four fields are read here, and `ExecutionDetail.tsx` already avoids that
 * import for the same reason (the `core-ui` typecheck project reaches these
 * files without the `@noodl-viewer-cloud/*` alias).
 */
interface PinnableExecution {
  workflowId: string;
  workflowName: string;
  steps: unknown[];
  metadata?: Record<string, unknown>;
}

/**
 * Take the canvas to the workflow this run belongs to, and answer with the
 * component name the overlay should tag the pin with.
 *
 * `kind: 'workflow'` is written by `WorkflowEngine` alone, which is the only
 * thing that runs a workflow — and therefore the only run with a canvas to go
 * to. A cloud function CALL is logged by `WorkflowRunner.run` with
 * `workflowId = functionName` and no `kind`, so it answers null and the pin
 * stays on the canvas in front of the user, where the overlay's "this run
 * recorded no steps" notice explains itself. So does a trigger REJECTION
 * record, which has a workflow id but never ran anything.
 *
 * A failed open answers null for the same reason: a pin the user can see on the
 * wrong canvas beats a pin tagged to a canvas that would not open.
 */
async function openOwningWorkflow(execution: PinnableExecution): Promise<string | null> {
  const metadata = execution.metadata;
  const backendId = typeof metadata?.backendId === 'string' ? metadata.backendId : undefined;
  if (metadata?.kind !== 'workflow' || !backendId || !execution.workflowId) return null;

  const service = WorkflowEditorService.instance;
  // Already there: `isOpen` is what keeps the Workflows panel's run-&-pin (and
  // a second pin of the same run) from reopening the document under itself.
  if (!service.isOpen(backendId, execution.workflowId)) {
    try {
      await service.open({
        backendId,
        backendName: typeof metadata.backendName === 'string' ? metadata.backendName : '',
        id: execution.workflowId,
        name: execution.workflowName,
        stepCount: execution.steps.length
      });
    } catch {
      return null;
    }
  }

  return workflowComponentName(execution.workflowId);
}

/**
 * CF11-006/007: Execution History Panel
 *
 * Sidebar panel showing execution history for cloud functions and WF-001
 * workflows, merged across the editor-local store and every running backend.
 *
 * Registered in router.setup.ts at order 8.8 (between backend-services and
 * app-setup). WFA-002 removed its `experimental` flag — it has a main-process
 * handler, real data and a working detail view, and it is the only surface that
 * can explain what a backend run did.
 *
 * CF11-007: "Pin to Canvas" in ExecutionDetail emits 'execution:pinToCanvas' via
 * EventDispatcher so the ExecutionOverlay mounted by nodegrapheditor.ts picks it
 * up.
 */
export function ExecutionHistoryPanel() {
  const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(null);
  const [filters, setFilters] = useState<FiltersState>({
    status: undefined,
    startDate: undefined,
    endDate: undefined
  });

  const { executions, sources, loading, error, refresh } = useExecutionHistory(filters);
  const runner = useWorkflowRunner();

  // CF11-007: fetch full execution (with steps) and pin it to the canvas overlay
  const { execution: detailExecution } = useExecutionDetail(selectedExecutionId);

  /**
   * FH-012: pinning a run is a request to LOOK at it, so it takes you there.
   *
   * The navigation is awaited before the event goes out. The overlay hides a
   * pin whose canvas is not the open one, so emitting first would flash a pin
   * on the canvas you are leaving; and the identity carried on the event is
   * what makes the pin survive the switch either way.
   */
  const handlePinToCanvas = useCallback(
    async (executionId: string) => {
      // detailExecution is already loaded by useExecutionDetail above
      if (!detailExecution || detailExecution.id !== executionId) return;

      const componentName = await openOwningWorkflow(detailExecution as unknown as PinnableExecution);
      EventDispatcher.instance.emit('execution:pinToCanvas', { execution: detailExecution, componentName });
    },
    [detailExecution]
  );

  /**
   * A dispatched run's record is written by the backend as the run STARTS, so a
   * refresh issued in the same tick races the HTTP round trip — observed live:
   * the in-flight row was missing until Refresh was pressed. One follow-up
   * fetch shortly after covers the gap without turning this into a poller
   * (live/streaming execution is explicitly out of scope for WFA-002).
   */
  const handleStarted = useCallback(() => {
    refresh();
    setTimeout(refresh, 800);
  }, [refresh]);

  const handleRan = useCallback(
    (executionId: string) => {
      // The route answers when the run FINISHES, so by now the record is final.
      refresh();
      setSelectedExecutionId(executionId);
    },
    [refresh]
  );

  const handleCancel = useCallback(
    async (backendId: string, executionId: string) => {
      await runner.cancel(backendId, executionId);
      refresh();
    },
    [runner, refresh]
  );

  /**
   * WFA-002: the sidebar CACHES a panel's element (`setActivePanel` keeps it in
   * `this.panels`), so switching away and back does not remount and does not
   * refetch. Found live: open this panel, start a backend from Backend Services,
   * come back — and it still said "No backend is running" until Refresh was
   * pressed. Everything here is about the state of another process, so becoming
   * the active panel has to be a fetch.
   */
  useEventListener(SidebarModel.instance, SidebarModelEvent.activeChanged, () => {
    if (SidebarModel.instance.ActiveId !== 'execution-history') return;
    refresh();
    runner.refresh();
  });

  /**
   * F34's other half, closed by WFA-005. Becoming active covers "I was away
   * while things changed"; it cannot cover "I was watching". A backend started
   * — or gone — while this panel is in front of you is now an event.
   */
  useBackendStatusChanged(() => {
    refresh();
    runner.refresh();
  });

  return (
    /* PNL-005: shared chrome. The hand-rolled 12/16px bar with its own 13px/600
       title is gone; Refresh is an action-slot icon button rather than a `↻`
       glyph in a bare `<button>`. */
    <BasePanel
      title="Execution History"
      isFill
      UNSAFE_content_style={{ paddingInline: 0, paddingTop: 0 }}
      headerSlot={
        <Tooltip content="Refresh" showAfterMs={300}>
          <IconButton
            variant={IconButtonVariant.Transparent}
            icon={IconName.Refresh}
            onClick={() => {
              refresh();
              runner.refresh();
            }}
            testId="execution-history-refresh"
          />
        </Tooltip>
      }
    >
      {!selectedExecutionId && (
        <>
          <ExecutionFilters filters={filters} onChange={setFilters} />
          <RunWorkflow
            workflows={runner.workflows}
            loading={runner.loading}
            unreachable={runner.unreachable}
            onRun={runner.run}
            onStarted={handleStarted}
            onRan={handleRan}
          />
        </>
      )}

      <div className={styles.Body}>
        {selectedExecutionId ? (
          <ExecutionDetail
            executionId={selectedExecutionId}
            onBack={() => setSelectedExecutionId(null)}
            onPinToCanvas={handlePinToCanvas}
            onCancel={handleCancel}
          />
        ) : (
          <ExecutionList
            executions={executions}
            sources={sources}
            loading={loading}
            error={error}
            onSelect={setSelectedExecutionId}
          />
        )}
      </div>
    </BasePanel>
  );
}
