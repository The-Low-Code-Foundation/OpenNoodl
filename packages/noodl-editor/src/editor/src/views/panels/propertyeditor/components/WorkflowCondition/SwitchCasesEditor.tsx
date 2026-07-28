import React from 'react';

import { ConditionEditor } from './ConditionEditor';
import styles from './WorkflowCondition.module.scss';
import { WorkflowValueInput, type ScopeRoot } from './WorkflowValueInput';

import type { Condition, ConditionOpSpec } from '@noodl-models/workflow/types';
import type { NodeGraphModel } from '@noodl-models/nodegraphmodel';

interface SwitchCase {
  label: string;
  equals?: unknown;
  when?: Condition;
}

export interface SwitchCasesEditorProps {
  value: SwitchCase[] | undefined;
  onChange: (value: SwitchCase[]) => void;
  ops: ConditionOpSpec[];
  scope?: ScopeRoot[];
  graph?: NodeGraphModel;
  stepId?: string;
}

/**
 * `switch`'s cases — a DSL structure whose labels **become output ports**
 * (WFA-004 §2).
 *
 * It gets a real editor rather than a JSON textarea for the same reason a
 * condition does, and with one extra consequence: editing a label here renames
 * a port on the card, so a case with no label or a duplicate one would leave a
 * port that no edge can be attached to. Both are rejected at write time; both
 * are visible here as you type.
 */
export function SwitchCasesEditor({ value, onChange, ops, scope, graph, stepId }: SwitchCasesEditorProps) {
  const cases = Array.isArray(value) ? value : [];

  const update = (i: number, next: SwitchCase) => onChange(cases.map((c, j) => (j === i ? next : c)));

  const labelProblem = (c: SwitchCase, i: number): string | null => {
    if (!c.label) return 'A case needs a label — it names the output port.';
    if (c.label === 'default') return '"default" is reserved: it is the no-match route.';
    if (cases.some((other, j) => j !== i && other.label === c.label)) return 'Two cases cannot share a label.';
    return null;
  };

  return (
    <div className={styles.Root}>
      {cases.map((c, i) => {
        const problem = labelProblem(c, i);
        const usesCondition = 'when' in c;
        return (
          <div key={i} className={styles.Case}>
            <div className={styles.CaseHeader}>
              <input
                className={`${styles.Input} ${styles.CaseLabel}`}
                value={c.label || ''}
                placeholder="case label"
                aria-label={`Case ${i + 1} label`}
                onChange={(e) => update(i, { ...c, label: e.target.value })}
              />
              <select
                className={styles.OpSelect}
                value={usesCondition ? 'when' : 'equals'}
                aria-label={`Case ${i + 1} match kind`}
                onChange={(e) => {
                  // Exactly one of `equals` / `when` — the validator requires
                  // it, so the editor cannot leave both set even briefly.
                  if (e.target.value === 'when') update(i, { label: c.label, when: { all: [] } });
                  else update(i, { label: c.label, equals: '' });
                }}
              >
                <option value="equals">equals</option>
                <option value="when">when</option>
              </select>
              <button className={styles.SmallButton} onClick={() => onChange(cases.filter((_, j) => j !== i))}>
                ×
              </button>
            </div>

            {problem && <div className={styles.Error}>{problem}</div>}

            {usesCondition ? (
              <ConditionEditor
                value={c.when}
                onChange={(when) => update(i, { label: c.label, when })}
                ops={ops}
                scope={scope}
                graph={graph}
                stepId={stepId}
              />
            ) : (
              <WorkflowValueInput
                value={c.equals}
                onChange={(equals) => update(i, { label: c.label, equals })}
                graph={graph}
                stepId={stepId}
                scope={scope}
                ariaLabel={`Case ${i + 1} value`}
              />
            )}
          </div>
        );
      })}

      <button className={styles.AddButton} onClick={() => onChange([...cases, { label: '', equals: '' }])}>
        + case
      </button>
      {cases.length === 0 && <span className={styles.Hint}>A switch needs at least one case.</span>}
    </div>
  );
}
