import React, { useEffect, useRef, useState } from 'react';

import styles from './WorkflowCondition.module.scss';
import { WorkflowValueInput, type ScopeRoot } from './WorkflowValueInput';

import type { TransformOpSpec } from '@noodl-models/workflow/types';
import type { NodeGraphModel } from '@noodl-models/nodegraphmodel';

export type TransformRow = [field: string, value: unknown];

export interface TransformOutputEditorProps {
  /** The `output` object as stored, or undefined on a fresh card. */
  value: unknown;
  onChange: (value: Record<string, unknown>) => void;
  /** The served operation vocabulary. Empty from a backend that serves none. */
  ops: TransformOpSpec[];
  scope?: ScopeRoot[];
  graph?: NodeGraphModel;
  stepId?: string;
}

/** No operation — the field is a plain value. Not a name any operation can take. */
const NO_OP = '';

/**
 * A `transform` step's `output` (CWF-004) — one row per field of the object the
 * step produces.
 *
 * **Every operand is the same `WorkflowValueInput` a condition uses**, and that
 * is deliberate rather than convenient: two editors that disagreed about what a
 * value looks like would teach two dialects of one syntax, which is the exact
 * mistake `values.ts` exists on the backend to prevent. This control adds one
 * thing to CWF-001's rows editor and one thing only — an operation picker per
 * row, built from the SERVED vocabulary, so it can never offer an operation the
 * target backend cannot perform.
 *
 * Three behaviours worth stating, because each is a mistake you would otherwise
 * find at run time:
 *
 *  - **Field names commit on blur, not on every keystroke.** A name is a real
 *    key in the produced object; committing per character would fill the undo
 *    queue with `a`, `am`, `amo`… and lose the caret on every re-render.
 *  - **A duplicate name silently loses one of the two values** (they are JSON
 *    object keys), so it is refused here rather than discovered downstream.
 *  - **A field cannot read another field of the same transform.** Every field
 *    resolves against the run in one pass. The empty state and the footer both
 *    say so, because an author will otherwise try it and get `undefined`.
 *
 * ⚠️ A NESTED operation (an operand that is itself an operation) is legal in a
 * definition and is not authorable here in v1 — it renders in the operand's
 * literal field as JSON and round-trips through it unharmed. Deliberate: a
 * recursive operation tree is the condition editor's problem shape, and CWF-004
 * S1 is one row deep on purpose.
 */
export function TransformOutputEditor({ value, onChange, ops, scope, graph, stepId }: TransformOutputEditorProps) {
  const stored = isPlainObject(value) ? value : {};
  const rows: TransformRow[] = Object.entries(stored);

  const [names, setNames] = useState<string[]>(() => rows.map(([k]) => k));
  const committed = useRef(keyOf(rows));

  // Re-sync when the fields changed from OUTSIDE this control — an undo, MCP, a
  // proposal applied. Guarded on our own last commit, so typing is never
  // interrupted by the write it just caused.
  useEffect(() => {
    const incoming = keyOf(rows);
    if (incoming !== committed.current) {
      committed.current = incoming;
      setNames(rows.map(([k]) => k));
    }
    // `rows` is rebuilt every render, so the dep is its KEY LIST — a stable
    // string. Depending on `rows` itself would re-run (and clobber a half-typed
    // name) on every render of the panel.
  }, [keyOf(rows)]);

  const draft: TransformRow[] = rows.map(([k, v], i) => [names[i] ?? k, v]);

  const commit = (next: TransformRow[]) => {
    committed.current = keyOf(next);
    setNames(next.map(([k]) => k));
    const out: Record<string, unknown> = {};
    for (const [k, v] of next) out[k] = v;
    onChange(out);
  };

  const setValue = (i: number, v: unknown) => commit(draft.map((r, j) => (j === i ? [r[0], v] : r)));
  const remove = (i: number) => commit(draft.filter((_, j) => j !== i));

  /** Commit a rename only if it is legal — an illegal one stays in the field. */
  const commitName = (i: number) => {
    const name = (names[i] ?? '').trim();
    if (!name || nameProblem(name, i)) return;
    if (name === rows[i][0]) return;
    commit(draft.map((r, j) => (j === i ? [name, r[1]] : r)));
  };

  function nameProblem(name: string, i: number): string | null {
    if (!name.trim()) return 'A field needs a name — it is what the next step reads the value as.';
    if (draft.some(([other], j) => j !== i && other === name)) return 'Two fields cannot share a name.';
    return null;
  }

  /** A free name, so a new row is never keyed "" against another keyed "". */
  const freeName = () => {
    const taken = new Set(draft.map(([k]) => k));
    let n = 1;
    while (taken.has(`field${n}`)) n++;
    return `field${n}`;
  };

  const opByName = new Map(ops.map((op) => [op.name, op]));

  /**
   * Change the operation on a row, carrying the operands across.
   *
   * Carried rather than reset: picking `$upper` after `$lower` and losing the
   * path you just chose is the kind of small hostility that makes an editor
   * feel unsafe to explore.
   */
  const setOp = (i: number, opName: string) => {
    const current = operandsOf(draft[i][1], opByName);
    if (opName === NO_OP) {
      setValue(i, current[0] ?? '');
      return;
    }
    const op = opByName.get(opName);
    if (!op) return;
    if (op.arity === 1) {
      setValue(i, { [opName]: current[0] ?? '' });
      return;
    }
    const wanted = op.arity === 'variadic' ? Math.max(current.length, 1) : op.arity;
    const args = Array.from({ length: wanted }, (_, k) => (k < current.length ? current[k] : ''));
    setValue(i, { [opName]: args });
  };

  const setOperand = (i: number, index: number, operand: unknown) => {
    const opName = opNameOf(draft[i][1], opByName);
    if (!opName) {
      setValue(i, operand);
      return;
    }
    const op = opByName.get(opName)!;
    if (op.arity === 1) {
      setValue(i, { [opName]: operand });
      return;
    }
    const args = operandsOf(draft[i][1], opByName).slice();
    args[index] = operand;
    setValue(i, { [opName]: args });
  };

  return (
    <div className={styles.Root}>
      {draft.map(([field, v], i) => {
        const problem = nameProblem(field, i);
        const opName = opNameOf(v, opByName);
        const op = opName ? opByName.get(opName) : undefined;
        const operands = operandsOf(v, opByName);

        return (
          <div key={i} className={styles.Case}>
            <div className={styles.CaseHeader}>
              <input
                className={`${styles.Input} ${styles.CaseLabel}`}
                value={field}
                placeholder="field"
                aria-label={`Field ${i + 1} name`}
                onChange={(e) => setNames(names.map((n, j) => (j === i ? e.target.value : n)))}
                onBlur={() => commitName(i)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                }}
              />
              <button className={styles.SmallButton} aria-label={`Remove field ${i + 1}`} onClick={() => remove(i)}>
                ×
              </button>
            </div>

            {problem && <div className={styles.Error}>{problem}</div>}

            <div className={styles.OpRow}>
              <select
                className={styles.OpSelect}
                value={opName || NO_OP}
                aria-label={`Field ${field || i + 1} operation`}
                title={op ? op.description : 'Take the value as it is'}
                onChange={(e) => setOp(i, e.target.value)}
              >
                <option value={NO_OP}>as it is</option>
                {ops.map((candidate) => (
                  <option key={candidate.name} value={candidate.name}>
                    {candidate.label}
                  </option>
                ))}
              </select>
            </div>

            {/* An operation this backend does not serve — a definition written
                against a NEWER backend, opened here. Said out loud rather than
                silently rewritten, because rewriting it would destroy it. */}
            {!op && isOperationShaped(v) && (
              <div className={styles.Error}>
                This field uses an operation this backend does not perform. Leave it alone, or pick one above to
                replace it.
              </div>
            )}

            {op && op.arity === 'variadic' ? (
              <>
                {operands.map((operand, k) => (
                  <WorkflowValueInput
                    key={k}
                    value={operand}
                    onChange={(next) => setOperand(i, k, next)}
                    graph={graph}
                    stepId={stepId}
                    scope={scope}
                    ariaLabel={`Field ${field || i + 1} ${op.args[0] || 'part'} ${k + 1}`}
                  />
                ))}
                <div className={styles.RootActions}>
                  <button
                    className={styles.SmallButton}
                    onClick={() => setValue(i, { [op.name]: [...operands, ''] })}
                    aria-label={`Add a part to field ${field || i + 1}`}
                  >
                    + part
                  </button>
                  {operands.length > 1 && (
                    <button
                      className={styles.SmallButton}
                      onClick={() => setValue(i, { [op.name]: operands.slice(0, -1) })}
                      aria-label={`Remove the last part of field ${field || i + 1}`}
                    >
                      − part
                    </button>
                  )}
                </div>
              </>
            ) : (
              (op ? operands.slice(0, op.arity as number) : [operands[0]]).map((operand, k) => (
                <div key={k} className={styles.Value}>
                  {op && op.args.length > 1 && <span className={styles.Hint}>{op.args[k]}</span>}
                  <WorkflowValueInput
                    value={operand}
                    onChange={(next) => setOperand(i, k, next)}
                    graph={graph}
                    stepId={stepId}
                    scope={scope}
                    ariaLabel={`Field ${field || i + 1} ${op ? op.args[k] || 'value' : 'value'}`}
                  />
                </div>
              ))
            )}
          </div>
        );
      })}

      <button className={styles.AddButton} onClick={() => commit([...draft, [freeName(), '']])}>
        + field
      </button>

      <span className={styles.Hint}>
        {draft.length === 0
          ? 'This step produces the object you describe here, and nothing else. Add a field and point it at the run’s data.'
          : `The next step reads this as “previous.${draft[0][0]}”. A field cannot read another field of the same step — chain a second Transform for that.`}
      </span>
      {ops.length === 0 && (
        <span className={styles.Error}>
          This backend served no operation vocabulary, so only plain values and references can be authored here.
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

const keyOf = (rows: TransformRow[]) => JSON.stringify(rows.map(([k]) => k));

/**
 * True for an object whose SOLE key is `$`-prefixed and is not one of the value
 * language's own forms — the shape the backend treats as an operation. Used to
 * tell "an operation this editor does not know" from "a plain object", which is
 * the difference between a warning and silence.
 */
function isOperationShaped(v: unknown): boolean {
  if (!isPlainObject(v)) return false;
  const keys = Object.keys(v);
  return keys.length === 1 && keys[0].startsWith('$') && keys[0] !== '$path' && keys[0] !== '$literal';
}

/** The served operation a value uses, or null when it is a plain value. */
function opNameOf(v: unknown, ops: Map<string, TransformOpSpec>): string | null {
  if (!isPlainObject(v)) return null;
  const keys = Object.keys(v);
  if (keys.length !== 1) return null;
  return ops.has(keys[0]) ? keys[0] : null;
}

/**
 * A row's operands, whatever form it is in.
 *
 * An arity-1 operation holds its operand VERBATIM and is never unwrapped —
 * matching the backend, where that rule is what makes `{"$length": [1,2,3]}` the
 * length of that array rather than a one-item argument list.
 */
function operandsOf(v: unknown, ops: Map<string, TransformOpSpec>): unknown[] {
  const name = opNameOf(v, ops);
  if (!name) return [v];
  const op = ops.get(name)!;
  const operand = (v as Record<string, unknown>)[name];
  if (op.arity === 1) return [operand];
  return Array.isArray(operand) ? operand : [operand];
}
