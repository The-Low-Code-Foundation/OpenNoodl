/**
 * PNL-006 — the per-row warning indicator.
 *
 * Deliberately **inert**: it carries a count and nothing else.
 *
 * The spec asked for a click that opens the Problems panel filtered to this
 * component. It cannot be honoured as written, for two independent reasons, and
 * shipping a control that silently does nothing is worse than shipping an
 * indicator that never promised to:
 *
 *   1. `ProblemsPanel` takes no props. It renders
 *      `ProjectValidationService.instance`'s report, groups it by component name
 *      internally, and exposes no filter, no selection and no imperative entry
 *      point. Adding one means changing that panel, which is outside this task's
 *      territory.
 *   2. The two surfaces do not even show the same warnings. This dot counts
 *      `WarningsModel` entries — the editor/runtime warnings (missing node type,
 *      broken connection, conflicting merge) that also drive the top bar's
 *      warning badge. The Problems panel shows SUB-006 *semantic validation*
 *      diagnostics. A click that jumped from one to the other could easily land
 *      on a component the Problems panel lists nothing for.
 *
 * Filed as a follow-up in PNL-006-NOTES.md. `cursor: help` and a `title` say
 * "hover me", not "click me".
 */

import React from 'react';

import css from '../ComponentsPanel.module.scss';

export interface WarningDotProps {
  count: number | undefined;
}

export function WarningDot({ count }: WarningDotProps) {
  if (!count) return null;

  return (
    <div
      className={css['Warning']}
      data-test="component-tree-warning"
      data-count={count}
      role="img"
      aria-label={`${count} ${count === 1 ? 'warning' : 'warnings'}`}
      title={`${count} ${count === 1 ? 'warning' : 'warnings'} in this component`}
    />
  );
}
