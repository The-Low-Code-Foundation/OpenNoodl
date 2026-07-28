import React from 'react';

import { isComparison, isGroup } from '@noodl-models/workflow/types';

import styles from './WorkflowCondition.module.scss';
import { WorkflowValueInput, type ScopeRoot } from './WorkflowValueInput';

import type { Comparison, Condition, ConditionOpSpec } from '@noodl-models/workflow/types';
import type { NodeGraphModel } from '@noodl-models/nodegraphmodel';

export interface ConditionEditorProps {
  value: Condition | undefined;
  onChange: (value: Condition) => void;
  /** The operator set, from the backend that will evaluate it. */
  ops: ConditionOpSpec[];
  scope?: ScopeRoot[];
  graph?: NodeGraphModel;
  stepId?: string;
}

function emptyComparison(ops: ConditionOpSpec[]): Comparison {
  return { left: { $path: '' }, op: ops[0]?.name || 'eq', right: '' };
}

/**
 * The control §4 says decides whether the canvas is genuinely usable.
 *
 * A condition is *left value / operator / right value*, and it can be that
 * rather than a code editor because the operator set is closed — a security
 * decision (no `eval` inside a persisted, deployable, agent-authored artifact)
 * that pre-paid for the editor. A JSON textarea here fails the task, so there
 * is not one anywhere in this file.
 *
 * `all` / `any` groups nest, because the language has them and a condition that
 * can only be one comparison would push authors straight back to JSON.
 */
export function ConditionEditor({ value, onChange, ops, scope, graph, stepId }: ConditionEditorProps) {
  if (ops.length === 0) {
    // A pre-1.2.0 backend served no operator list. Guessing one would let the
    // editor offer an operator this backend cannot evaluate — the drift the
    // served registry exists to prevent — so it says so instead.
    return (
      <div className={styles.Notice}>
        This backend does not describe its condition operators, so a condition cannot be edited safely here. Update the
        backend.
      </div>
    );
  }

  if (value === undefined) {
    return (
      <div className={styles.Root}>
        <button className={styles.AddButton} onClick={() => onChange(emptyComparison(ops))}>
          Set a condition
        </button>
      </div>
    );
  }

  return (
    <div className={styles.Root}>
      <ConditionNode
        value={value}
        onChange={onChange}
        ops={ops}
        scope={scope}
        graph={graph}
        stepId={stepId}
        depth={0}
      />
    </div>
  );
}

function ConditionNode({
  value,
  onChange,
  ops,
  scope,
  graph,
  stepId,
  depth,
  onRemove
}: ConditionEditorProps & { depth: number; onRemove?: () => void }) {
  if (isGroup(value)) {
    const kind = Array.isArray((value as { all?: Condition[] }).all) ? 'all' : 'any';
    const children = (value as Record<string, Condition[]>)[kind];

    const replace = (next: Condition[]) => onChange({ [kind]: next } as Condition);

    return (
      <div className={depth > 0 ? `${styles.Group} ${styles.Nested}` : styles.Group}>
        <div className={styles.GroupHeader}>
          <select
            className={styles.OpSelect}
            value={kind}
            onChange={(e) => onChange({ [e.target.value]: children } as Condition)}
            aria-label="Match all or any"
          >
            <option value="all">all of</option>
            <option value="any">any of</option>
          </select>
          <button className={styles.SmallButton} onClick={() => replace([...children, emptyComparison(ops)])}>
            + condition
          </button>
          <button className={styles.SmallButton} onClick={() => replace([...children, { all: [emptyComparison(ops)] }])}>
            + group
          </button>
          {onRemove && (
            <button className={styles.SmallButton} onClick={onRemove} aria-label="Remove group">
              ×
            </button>
          )}
        </div>

        {children.map((child, i) => (
          <ConditionNode
            key={i}
            value={child}
            onChange={(next) => replace(children.map((c, j) => (j === i ? next : c)))}
            onRemove={() =>
              // Collapsing a one-child group back to its child would change the
              // shape under the user mid-edit; an empty group is legal and the
              // backend rejects it loudly if they save it that way.
              replace(children.filter((_, j) => j !== i))
            }
            ops={ops}
            scope={scope}
            graph={graph}
            stepId={stepId}
            depth={depth + 1}
          />
        ))}
      </div>
    );
  }

  if (!isComparison(value)) {
    return <div className={styles.Notice}>This condition is not in a shape this editor can show.</div>;
  }

  const op = ops.find((o) => o.name === value.op);
  const unary = op?.unary ?? false;

  return (
    <div className={depth > 0 ? `${styles.Comparison} ${styles.Nested}` : styles.Comparison}>
      <WorkflowValueInput
        value={value.left}
        onChange={(left) => onChange({ ...value, left })}
        graph={graph}
        stepId={stepId}
        scope={scope}
        ariaLabel="Left"
      />

      <div className={styles.OpRow}>
        <select
          className={styles.OpSelect}
          value={value.op}
          onChange={(e) => {
            const next = ops.find((o) => o.name === e.target.value);
            const updated: Comparison = { ...value, op: e.target.value };
            // A unary operator with a stale `right` would persist a value the
            // engine ignores — quietly misleading the next reader.
            if (next?.unary) delete updated.right;
            else if (updated.right === undefined) updated.right = '';
            if (!next?.takesFlags) delete updated.flags;
            onChange(updated);
          }}
          aria-label="Operator"
        >
          {ops.map((o) => (
            <option key={o.name} value={o.name}>
              {o.label}
            </option>
          ))}
        </select>
        {onRemove && (
          <button className={styles.SmallButton} onClick={onRemove} aria-label="Remove condition">
            ×
          </button>
        )}
      </div>

      {!unary && (
        <WorkflowValueInput
          value={value.right}
          onChange={(right) => onChange({ ...value, right })}
          graph={graph}
          stepId={stepId}
          scope={scope}
          ariaLabel="Right"
        />
      )}

      {op?.takesFlags && (
        <input
          className={styles.Input}
          value={value.flags || ''}
          placeholder="regex flags, e.g. i"
          aria-label="Regex flags"
          onChange={(e) => onChange({ ...value, flags: e.target.value || undefined })}
        />
      )}

      {depth === 0 && (
        <div className={styles.RootActions}>
          <button className={styles.SmallButton} onClick={() => onChange({ all: [value, emptyComparison(ops)] })}>
            + and
          </button>
          <button className={styles.SmallButton} onClick={() => onChange({ any: [value, emptyComparison(ops)] })}>
            + or
          </button>
        </div>
      )}
    </div>
  );
}
