import React, { useState } from 'react';

import type { RunnableWorkflow } from '../../hooks/useWorkflowRunner';
import styles from './RunWorkflow.module.scss';

interface Props {
  workflows: RunnableWorkflow[];
  loading: boolean;
  unreachable: string[];
  /** Resolves with the execution id, or `null` if the run is still going. */
  onRun: (workflow: RunnableWorkflow, payload: Record<string, unknown>) => Promise<string | null>;
  /**
   * Called as soon as the run has been dispatched. `/admin/workflow-defs/:id/run`
   * answers only when the run FINISHES, so a long run would otherwise leave the
   * panel with nothing to show and nothing to cancel — while the record the user
   * needs already exists, `running`, in the list. Refreshing here is what makes
   * cancel reachable at all.
   */
  onStarted: () => void;
  /** Called with the new execution id so the panel can select it. */
  onRan: (executionId: string) => void;
}

/**
 * WFA-002: run a WF-001 workflow definition with an editable payload.
 *
 * The routes have existed since WF-001 and nothing in the editor called them —
 * testing a change to a workflow meant a round trip through `curl` with an admin
 * token read out of `secrets.json`. That is the friction this phase exists to
 * remove; the run itself is four lines of IPC.
 */
export function RunWorkflow({ workflows, loading, unreachable, onRun, onStarted, onRan }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string>('');
  const [payloadText, setPayloadText] = useState('{}');
  const [inFlight, setInFlight] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const key = (w: RunnableWorkflow) => `${w.backendId}::${w.id}`;
  const workflow = workflows.find((w) => key(w) === selected) ?? workflows[0];

  if (loading) return null;

  if (workflows.length === 0) {
    // Deliberately silent when there is simply no backend — the list's own empty
    // state already says that, and two notices saying it is worse than one.
    if (unreachable.length === 0) return null;
    return <div className={styles.Row}>Could not read workflows from {unreachable.join(', ')}.</div>;
  }

  if (!open) {
    return (
      <div className={styles.Row}>
        <button className={styles.Toggle} onClick={() => setOpen(true)}>
          Run a workflow…
        </button>
        {inFlight ? (
          <span className={styles.Count}>Running {inFlight} — open it below to cancel</span>
        ) : (
          <span className={styles.Count}>
            {workflows.length} {workflows.length === 1 ? 'definition' : 'definitions'}
          </span>
        )}
        {error && <span className={styles.Error}>{error}</span>}
      </div>
    );
  }

  function submit() {
    if (!workflow) return;
    let payload: Record<string, unknown>;
    try {
      const parsed = JSON.parse(payloadText || '{}');
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('The payload must be a JSON object.');
      }
      payload = parsed as Record<string, unknown>;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The payload is not valid JSON.');
      return;
    }

    setError(null);
    setInFlight(workflow.name);
    setOpen(false);

    // Deliberately NOT awaited before the UI moves on: the route answers when
    // the run finishes, which for a `wait` step can be minutes. The record is
    // written at start, so a refresh now puts the in-flight run in the list
    // where it can be opened and cancelled.
    onStarted();
    onRun(workflow, payload)
      .then((executionId) => {
        setInFlight(null);
        // `null` = the run outlived the request ceiling and is still going. The
        // list is the place to watch it from there; selecting nothing is right.
        if (executionId) onRan(executionId);
        else onStarted();
      })
      .catch((e) => {
        setInFlight(null);
        setError(e instanceof Error ? e.message : String(e));
      });
  }

  return (
    <div className={styles.Form}>
      <select
        className={styles.Select}
        value={workflow ? key(workflow) : ''}
        onChange={(e) => setSelected(e.target.value)}
        aria-label="Workflow to run"
      >
        {workflows.map((w) => (
          <option key={key(w)} value={key(w)}>
            {w.name} ({w.stepCount} steps) — {w.backendName}
          </option>
        ))}
      </select>

      <textarea
        className={styles.Payload}
        value={payloadText}
        onChange={(e) => setPayloadText(e.target.value)}
        spellCheck={false}
        rows={4}
        aria-label="Run payload (JSON)"
      />

      {error && <span className={styles.Error}>{error}</span>}

      <div className={styles.Actions}>
        <button className={styles.Cancel} onClick={() => setOpen(false)}>
          Cancel
        </button>
        <button className={styles.Submit} onClick={submit}>
          Run
        </button>
      </div>
    </div>
  );
}
