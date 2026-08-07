import React from 'react';

import { ConditionEditor } from './ConditionEditor';
import styles from './WorkflowCondition.module.scss';
import { type ScopeRoot } from './WorkflowValueInput';

import type { Condition, ConditionOpSpec, ValidateTypeSpec } from '@noodl-models/workflow/types';
import type { NodeGraphModel } from '@noodl-models/nodegraphmodel';

/** A rule as it is stored. Exactly one of `path` / `when` is ever set. */
export interface ValidateRule {
  path?: string;
  required?: boolean;
  type?: string;
  when?: Condition;
  message?: string;
}

export interface ValidateRulesEditorProps {
  value: unknown;
  onChange: (value: ValidateRule[]) => void;
  /** The served condition operators — a `when` rule is an ordinary condition. */
  ops: ConditionOpSpec[];
  /** The served type vocabulary. Empty from a backend that serves none. */
  types: ValidateTypeSpec[];
  scope?: ScopeRoot[];
  graph?: NodeGraphModel;
  stepId?: string;
}

/** "Any type" — the rule asserts presence only. Not a name any type can take. */
const ANY_TYPE = '';

/**
 * A `validate` step's `rules` (CWF-004 slice 2) — one row per thing that must be
 * true before the run goes any further.
 *
 * **Two rule forms and nothing else**, which is what makes this a control rather
 * than a JSON textarea. A rule is either a claim about a path — is it there, and
 * is it one of the types this backend checks — or a condition, in which case it
 * hands off to the very same `ConditionEditor` a `branch` uses. There is no
 * third form and no free text anywhere except the path and the message.
 *
 * Three behaviours worth stating, because each is otherwise found at run time:
 *
 *  - **`required` defaults to TRUE**, and the control says so in words rather
 *    than leaving an unticked box to be interpreted. A rule naming a path
 *    normally means "this must be here".
 *  - **A rule with "optional" and no type asserts nothing**, so it is flagged
 *    here — the backend refuses it at write time, and being told at save is
 *    later than being told while you are looking at it.
 *  - **The type list is SERVED.** Removing a type from the backend removes it
 *    from this dropdown with no editor change, which is the property CWF-004
 *    asks for by name. Nothing here holds a copy of the list.
 */
export function ValidateRulesEditor({ value, onChange, ops, types, scope, graph, stepId }: ValidateRulesEditorProps) {
  const rules: ValidateRule[] = Array.isArray(value) ? (value as ValidateRule[]) : [];

  const update = (i: number, next: ValidateRule) => onChange(rules.map((r, j) => (j === i ? next : r)));
  const remove = (i: number) => onChange(rules.filter((_, j) => j !== i));

  /** Switch a rule between its two forms, keeping the message across. */
  const switchForm = (i: number, form: 'path' | 'when') => {
    const message = rules[i].message;
    // Exactly one of `path` / `when` — the validator requires it, so the editor
    // never leaves both set, not even for one render.
    if (form === 'when') onChange(rules.map((r, j) => (j === i ? { when: { all: [] }, message } : r)));
    else onChange(rules.map((r, j) => (j === i ? { path: '', message } : r)));
  };

  const problemOf = (rule: ValidateRule): string | null => {
    if ('when' in rule) return null;
    if (!rule.path || !rule.path.trim()) return 'A rule needs a path — it is what gets checked.';
    if (rule.required === false && !rule.type) {
      return 'Optional with no type asserts nothing. Give it a type, or make it required.';
    }
    return null;
  };

  return (
    <div className={styles.Root}>
      {rules.map((rule, i) => {
        const isCondition = 'when' in rule;
        const problem = problemOf(rule);

        return (
          <div key={i} className={styles.Case}>
            <div className={styles.CaseHeader}>
              <select
                className={styles.OpSelect}
                value={isCondition ? 'when' : 'path'}
                aria-label={`Rule ${i + 1} kind`}
                title="Check that a path is there, or check any condition"
                onChange={(e) => switchForm(i, e.target.value as 'path' | 'when')}
              >
                <option value="path">a path</option>
                <option value="when">a condition</option>
              </select>
              <button className={styles.SmallButton} aria-label={`Remove rule ${i + 1}`} onClick={() => remove(i)}>
                ×
              </button>
            </div>

            {problem && <div className={styles.Error}>{problem}</div>}

            {isCondition ? (
              <ConditionEditor
                value={rule.when}
                onChange={(when) => update(i, { when, message: rule.message })}
                ops={ops}
                scope={scope}
                graph={graph}
                stepId={stepId}
              />
            ) : (
              <>
                <div className={styles.ValueRow}>
                  <input
                    className={styles.Input}
                    value={rule.path || ''}
                    placeholder="body.customer.email"
                    aria-label={`Rule ${i + 1} path`}
                    onChange={(e) => update(i, { ...rule, path: e.target.value })}
                  />
                </div>

                <div className={styles.PathHelpers}>
                  {/* The served scope carries PATTERN entries — `upstream.<stepId>`,
                      `<param name>` — which describe a family rather than name a
                      root, so inserting one literally would produce a path that
                      checks nothing. Same filter WorkflowValueInput applies. */}
                  {(scope || [])
                    .filter((root) => !root.name.includes('<'))
                    .map((root) => (
                      <button
                        key={root.name}
                        className={styles.Chip}
                        title={root.description}
                        onClick={() => update(i, { ...rule, path: root.name + '.' })}
                      >
                        {root.name}
                      </button>
                    ))}
                </div>

                <div className={styles.OpRow}>
                  <select
                    className={styles.OpSelect}
                    value={rule.required === false ? 'optional' : 'required'}
                    aria-label={`Rule ${i + 1} presence`}
                    title="A path rule requires the path by default"
                    onChange={(e) =>
                      update(i, e.target.value === 'optional' ? { ...rule, required: false } : { ...rule, required: true })
                    }
                  >
                    <option value="required">must be there</option>
                    <option value="optional">optional</option>
                  </select>

                  <select
                    className={styles.OpSelect}
                    value={rule.type || ANY_TYPE}
                    aria-label={`Rule ${i + 1} type`}
                    title="The type this backend will check it against"
                    onChange={(e) => {
                      const next = { ...rule };
                      if (e.target.value === ANY_TYPE) delete next.type;
                      else next.type = e.target.value;
                      update(i, next);
                    }}
                  >
                    <option value={ANY_TYPE}>any type</option>
                    {types.map((t) => (
                      <option key={t.name} value={t.name} title={t.description}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* A type this backend does not check — a definition written
                    against a NEWER backend, opened here. Said out loud rather
                    than silently dropped, because dropping it destroys it. */}
                {rule.type && !types.some((t) => t.name === rule.type) && (
                  <div className={styles.Error}>
                    This rule asks for type “{rule.type}”, which this backend does not check. Leave it alone, or pick
                    one above to replace it.
                  </div>
                )}
              </>
            )}

            <div className={styles.ValueRow}>
              <input
                className={styles.Input}
                value={rule.message || ''}
                placeholder="what to say when this fails (optional)"
                aria-label={`Rule ${i + 1} message`}
                onChange={(e) => update(i, { ...rule, message: e.target.value || undefined })}
              />
            </div>
          </div>
        );
      })}

      <button className={styles.AddButton} onClick={() => onChange([...rules, { path: '', required: true }])}>
        + rule
      </button>

      <span className={styles.Hint}>
        {rules.length === 0
          ? 'A validate step with no rules asserts nothing and is refused when the workflow is saved. Add what must be true before the run goes on.'
          : 'A broken rule fails this step, so an error edge routes it. There is no “invalid” output — error edges already are try/catch.'}
      </span>
      {types.length === 0 && (
        <span className={styles.Error}>
          This backend served no type vocabulary, so a rule here can only check that a path is present.
        </span>
      )}
    </div>
  );
}
