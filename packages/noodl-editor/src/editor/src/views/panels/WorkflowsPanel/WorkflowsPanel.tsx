import { useBackendStatusChanged } from '@noodl-hooks/useBackendStatusChanged';
import { ipcInvoke } from '@noodl-utils/ipc';
import { useEventListener } from '@noodl-hooks/useEventListener';
import React, { useCallback, useEffect, useState } from 'react';

import { IconName } from '@noodl-core-ui/components/common/Icon';
import { IconButton, IconButtonVariant } from '@noodl-core-ui/components/inputs/IconButton';
import { Tooltip } from '@noodl-core-ui/components/popups/Tooltip';
import { BasePanel } from '@noodl-core-ui/components/sidebar/BasePanel';

import { SidebarModel, SidebarModelEvent } from '@noodl-models/sidebar/sidebarmodel';
import { listWorkflows, runWorkflow, deleteWorkflow } from '@noodl-models/workflow/WorkflowBackendClient';
import { WorkflowDocument } from '@noodl-models/workflow/WorkflowDocument';
import { WorkflowEditorEvent, WorkflowEditorService } from '@noodl-models/workflow/WorkflowEditorService';

import { EventDispatcher } from '../../../../../shared/utils/EventDispatcher';
import styles from './WorkflowsPanel.module.scss';

import type { WorkflowRef } from '@noodl-models/workflow/types';

export const WorkflowsPanel_ID = 'workflows';

/**
 * The Workflows panel (WFA-004) — where a workflow is found and opened.
 *
 * Workflows are NOT in the Components panel, and that is the §1 decision
 * showing through rather than an omission: a workflow is not a project
 * component. It lives in a backend's data directory, arrives with no project,
 * survives no `git clone`, and is not deployed with the app. Listing it beside
 * the project's components would imply all four falsely. So it is listed by the
 * backend it belongs to, and every row says which backend that is.
 *
 * With no backend running there is nothing to list and nothing to author
 * against — the panel says so and points at Backend Services, rather than
 * showing an empty list that reads as "you have no workflows".
 */
export function WorkflowsPanel() {
  const [workflows, setWorkflows] = useState<WorkflowRef[]>([]);
  const [unreachable, setUnreachable] = useState<string[]>([]);
  const [backendCount, setBackendCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [newName, setNewName] = useState('');
  const [newBackendId, setNewBackendId] = useState('');

  const service = WorkflowEditorService.instance;
  const [document, setDocument] = useState<WorkflowDocument | null>(service.document);
  const [dirty, setDirty] = useState(service.document?.isDirty ?? false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const result = await listWorkflows();
    setWorkflows(result.workflows);
    setUnreachable(result.unreachable);
    setBackendCount(result.backendCount);
    setLoading(false);
    // WFA-005: a workflow's triggers are drawn on its canvas as entry nodes, and
    // they are edited from a different surface (the Triggers panel, MCP, the
    // admin API). Refresh is the moment to re-read them, so the canvas is not
    // left showing an entry node that has been deleted somewhere else.
    await WorkflowEditorService.instance.document?.refreshTriggers().catch(() => undefined);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // WFA-002's F34: an inactive panel stays mounted and hidden, so becoming
  // active is a moment worth re-reading another process's state at.
  useEventListener(SidebarModel.instance, SidebarModelEvent.activeChanged, () => {
    if (SidebarModel.instance.ActiveId !== WorkflowsPanel_ID) return;
    refresh();
  });

  // F47, closed in WFA-005. `activeChanged` could not help the case that
  // actually bites: this panel already open and in front of you when a backend
  // starts, still reading "Start a backend to author workflows" until Refresh.
  // There is now an event for it.
  useBackendStatusChanged(refresh);

  useEventListener(service, WorkflowEditorEvent.documentChanged, () => {
    setDocument(service.document);
    setDirty(service.document?.isDirty ?? false);
  });
  useEventListener(service, WorkflowEditorEvent.dirtyChanged, () => setDirty(service.document?.isDirty ?? false));
  useEventListener(service, WorkflowEditorEvent.saved, () => {
    setStatus('Saved to the backend.');
    refresh();
  });

  const guard = useCallback(async (what: string, fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      await fn();
    } catch (e) {
      // The backend validator's own message names the step and the problem.
      // Shown verbatim: it is the same text that would appear if this
      // definition ever stopped a backend from booting.
      setError(`${what} failed.\n${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }, []);

  const open = useCallback(
    (ref: WorkflowRef) => guard(`Opening ${ref.name}`, async () => void (await service.open(ref))),
    [guard, service]
  );

  const save = useCallback(
    () => guard('Saving', async () => void (await service.document?.save())),
    [guard, service]
  );

  /**
   * §7: run it, and pin the execution to this canvas in one gesture.
   *
   * The pin rides `execution:pinToCanvas`, the event `ExecutionDetail` already
   * emits and the overlay already listens for (F17) — so authoring and watching
   * are the same surface, which is the point of the phase.
   */
  const run = useCallback(
    () =>
      guard('Running', async () => {
        const doc = service.document;
        if (!doc) return;
        if (doc.isDirty) await doc.save();

        const executionId = await runWorkflow(doc.ref.backendId, doc.definition.id, {});
        if (!executionId) {
          // F33: the run route answers only on completion, behind a hard
          // 30-second request ceiling. A `wait` step legitimately outlives it,
          // and calling that a failure was the lie WFA-002 removed.
          setStatus('Still running — it outlived the request ceiling. Watch it in Execution History.');
          return;
        }

        const execution = await ipcInvoke<{ error?: string } | null>('execution-history:get', executionId);
        if (!execution || execution.error) {
          setStatus(`Ran as ${executionId}, but its record could not be read back.`);
          return;
        }

        setStatus(`Ran as ${executionId} — pinned to the canvas.`);
        EventDispatcher.instance.emit('execution:pinToCanvas', { execution });
      }),
    [guard, service]
  );

  const remove = useCallback(
    (ref: WorkflowRef) =>
      guard(`Deleting ${ref.name}`, async () => {
        await deleteWorkflow(ref.backendId, ref.id);
        if (service.isOpen(ref.backendId, ref.id)) service.close();
        await refresh();
      }),
    [guard, refresh, service]
  );

  const create = useCallback(
    () =>
      guard('Creating', async () => {
        const backendId = newBackendId || workflows[0]?.backendId || '';
        const backendName = workflows.find((w) => w.backendId === backendId)?.backendName || 'backend';
        const name = newName.trim() || 'New workflow';
        const id = `wf_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'new'}`;

        const doc = await WorkflowDocument.create({ backendId, backendName, id, name }, 'call-function');
        service.adopt(doc);
        setCreating(false);
        setNewName('');
        setStatus('Created on the canvas. It is not on the backend until you save it.');
      }),
    [guard, newBackendId, newName, service, workflows]
  );

  const backends = [...new Map(workflows.map((w) => [w.backendId, w.backendName])).entries()];
  const grouped = backends.map(([id, name]) => ({
    id,
    name,
    items: workflows.filter((w) => w.backendId === id)
  }));

  return (
    <BasePanel
      title="Workflows"
      isFill
      UNSAFE_content_style={{ paddingInline: 0, paddingTop: 0 }}
      headerSlot={
        <>
          <Tooltip content="New workflow" showAfterMs={300}>
            <IconButton
              icon={IconName.Plus}
              variant={IconButtonVariant.Transparent}
              onClick={() => setCreating((c) => !c)}
              isDisabled={backendCount === 0}
              testId="workflows-new"
            />
          </Tooltip>
          <Tooltip content="Refresh" showAfterMs={300}>
            <IconButton
              icon={IconName.Refresh}
              variant={IconButtonVariant.Transparent}
              onClick={refresh}
              testId="workflows-refresh"
            />
          </Tooltip>
        </>
      }
    >
      <div className={styles.Body}>
        {document && (
          <div className={styles.OpenBar}>
            <div className={styles.OpenTitle}>
              {document.component.displayName}
              {dirty && <span className={styles.Dirty}> — unsaved</span>}
            </div>
            <div className={styles.OpenMeta}>
              On {document.ref.backendName}. Entry step: {document.entry}.
            </div>
            <div className={styles.Actions}>
              <button className={`${styles.Button} ${styles.Primary}`} onClick={save} disabled={busy || !dirty}>
                Save
              </button>
              <button className={styles.Button} onClick={run} disabled={busy}>
                Run &amp; pin
              </button>
              <button className={styles.Button} onClick={() => service.close()} disabled={busy}>
                Close
              </button>
              <button
                className={`${styles.Button} ${styles.Danger}`}
                onClick={() => setConfirmDelete(true)}
                disabled={busy}
              >
                Delete
              </button>
            </div>
            {confirmDelete && (
              <div className={styles.Actions}>
                <span className={styles.Status}>Delete it from {document.ref.backendName}?</span>
                <button
                  className={`${styles.Button} ${styles.Danger}`}
                  onClick={() => {
                    setConfirmDelete(false);
                    remove({
                      backendId: document.ref.backendId,
                      backendName: document.ref.backendName,
                      id: document.definition.id,
                      name: document.component.displayName,
                      stepCount: 0
                    });
                  }}
                >
                  Yes, delete
                </button>
                <button className={styles.Button} onClick={() => setConfirmDelete(false)}>
                  Keep it
                </button>
              </div>
            )}
            {status && <div className={styles.Status}>{status}</div>}
            {error && <div className={styles.Error}>{error}</div>}
          </div>
        )}

        {creating && (
          <div className={styles.Form}>
            <input
              className={styles.Input}
              placeholder="Workflow name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              aria-label="Workflow name"
            />
            {backends.length > 1 && (
              <select
                className={styles.Select}
                value={newBackendId || backends[0][0]}
                onChange={(e) => setNewBackendId(e.target.value)}
                aria-label="Backend"
              >
                {backends.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            )}
            <div className={styles.Actions}>
              <button className={`${styles.Button} ${styles.Primary}`} onClick={create} disabled={busy}>
                Create
              </button>
              <button className={styles.Button} onClick={() => setCreating(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {!loading && backendCount === 0 && (
          <div className={styles.Notice}>
            <strong className={styles.NoticeTitle}>Start a backend to author workflows.</strong>
            A workflow lives in a backend&rsquo;s data directory, not in this project — so there is nothing to list,
            and nothing to author against, until one is running. Start one from the Backend Services panel.
          </div>
        )}

        {!loading && backendCount > 0 && workflows.length === 0 && (
          <div className={styles.Notice}>
            <strong className={styles.NoticeTitle}>No workflows on this backend yet.</strong>
            Use + above to make one. It stays on the canvas until you save it.
          </div>
        )}

        {unreachable.length > 0 && (
          <div className={styles.Notice}>Could not read workflows from {unreachable.join(', ')}.</div>
        )}

        {grouped.map((group) => (
          <div key={group.id}>
            <div className={styles.BackendGroup}>{group.name}</div>
            {group.items.map((w) => (
              <button
                key={`${w.backendId}::${w.id}`}
                className={`${styles.Item} ${service.isOpen(w.backendId, w.id) ? styles.ItemOpen : ''}`}
                onClick={() => open(w)}
                title="Open on the canvas"
              >
                <span className={styles.ItemName}>{w.name}</span>
                <span className={styles.ItemMeta}>
                  {w.stepCount} {w.stepCount === 1 ? 'step' : 'steps'}
                </span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </BasePanel>
  );
}
