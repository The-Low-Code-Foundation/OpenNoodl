import React, { useMemo, useState } from 'react';

import { danglingReference, upstreamSteps } from '@noodl-models/workflow/workflowScope';
import { isLiteralSpec, isPathSpec } from '@noodl-models/workflow/types';

import styles from './WorkflowCondition.module.scss';

import type { NodeGraphModel } from '@noodl-models/nodegraphmodel';

export interface ScopeRoot {
  name: string;
  description: string;
}

export interface WorkflowValueInputProps {
  value: unknown;
  onChange: (value: unknown) => void;
  /** The graph and the step this value belongs to — for the predecessor picker. */
  graph?: NodeGraphModel;
  stepId?: string;
  /** Scope roots from the served value language. */
  scope?: ScopeRoot[];
  placeholder?: string;
  ariaLabel?: string;
}

/** How a value is currently written. */
type Mode = 'literal' | 'path';

function modeOf(value: unknown): Mode {
  return isPathSpec(value) ? 'path' : 'literal';
}

/**
 * Render a literal so it can be typed back. Strings stay bare — quoting every
 * string would make the common case (`"paid"`) look like a mistake — and
 * everything else is JSON, which is what `parseLiteral` reads back.
 */
function literalText(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (isLiteralSpec(value)) return literalText((value as { $literal: unknown }).$literal);
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

/**
 * Read a typed literal back.
 *
 * A bare number or `true`/`false`/`null` becomes that value — a condition
 * comparing `total gt "100"` against a number is the mistake this prevents, and
 * it is a silent one because a string is a legal operand. Anything else stays a
 * string unless it parses as JSON.
 */
export function parseLiteral(text: string): unknown {
  const t = text.trim();
  if (t === '') return '';
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (t === 'null') return null;
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  if (t.startsWith('[') || t.startsWith('{')) {
    try {
      return JSON.parse(t);
    } catch {
      return text;
    }
  }
  return text;
}

/**
 * One operand: a literal, or a reference into the run scope (WFA-004 §4).
 *
 * The reference side is a picker over reachable predecessors rather than free
 * text alone, because the alternative is typing `upstream.<stepId>.…` from
 * memory and finding out it was wrong when the backend answers 400. Free text
 * is still there as the fallback — the scope has runtime shapes the editor
 * cannot enumerate — and a reference the write-time validator would reject is
 * flagged in the editor with the same reason it would give.
 */
export function WorkflowValueInput({
  value,
  onChange,
  graph,
  stepId,
  scope,
  placeholder,
  ariaLabel
}: WorkflowValueInputProps) {
  const [mode, setMode] = useState<Mode>(modeOf(value));

  const upstream = useMemo(
    () => (graph && stepId ? upstreamSteps(graph, stepId) : []),
    [graph, stepId]
  );

  const path = isPathSpec(value) ? value.$path : '';
  const dangling = useMemo(
    () => (graph && stepId && mode === 'path' && path ? danglingReference(graph, stepId, path) : null),
    [graph, stepId, mode, path]
  );

  function switchMode(next: Mode) {
    setMode(next);
    if (next === 'path' && !isPathSpec(value)) onChange({ $path: '' });
    if (next === 'literal' && isPathSpec(value)) onChange('');
  }

  return (
    <div className={styles.Value}>
      <div className={styles.ValueRow}>
        <select
          className={styles.ModeSelect}
          value={mode}
          onChange={(e) => switchMode(e.target.value as Mode)}
          aria-label={`${ariaLabel || 'Value'} kind`}
          title="A fixed value, or a reference to data the run produced"
        >
          <option value="literal">value</option>
          <option value="path">from</option>
        </select>

        {mode === 'literal' ? (
          <input
            className={styles.Input}
            value={literalText(value)}
            placeholder={placeholder || 'a value'}
            aria-label={ariaLabel || 'Value'}
            onChange={(e) => onChange(parseLiteral(e.target.value))}
          />
        ) : (
          <input
            className={styles.Input}
            value={path}
            placeholder="previous.total"
            aria-label={`${ariaLabel || 'Value'} path`}
            onChange={(e) => onChange({ $path: e.target.value })}
            list={undefined}
          />
        )}
      </div>

      {mode === 'path' && (
        <div className={styles.PathHelpers}>
          {(scope || []).map((root) => (
            <button
              key={root.name}
              className={styles.Chip}
              title={root.description}
              onClick={() => onChange({ $path: root.name.replace('<stepId>', '') })}
            >
              {root.name}
            </button>
          ))}
          {upstream.map((step) => (
            <button
              key={step.id}
              className={styles.Chip}
              title={`The output of ${step.label}${step.kindLabel ? ` (${step.kindLabel})` : ''}`}
              onClick={() => onChange({ $path: `upstream.${step.id}.` })}
            >
              {step.label}
            </button>
          ))}
          {upstream.length === 0 && (
            <span className={styles.Hint}>Nothing runs before this step yet, so only the run payload is readable.</span>
          )}
        </div>
      )}

      {dangling && <div className={styles.Error}>{dangling.message}</div>}
    </div>
  );
}
