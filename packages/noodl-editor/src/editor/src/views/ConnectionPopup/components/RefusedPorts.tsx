import classNames from 'classnames';
import React, { useState } from 'react';

import { INodeColorScheme } from '@noodl-types/nodeTypes';

import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';

import css from '../ConnectionPopup.module.scss';
import { refusedGroupSummary } from '../portCopy';
import { dominantReason, dominantTypeName, partitionGated, type PlannablePort } from '../refusalPlan';
import { PortItem } from './PortItem';

/**
 * SIG-001 — a set of refused ports, behind one line.
 *
 * ## Why this is its own component and used in two places
 *
 * Refused ports were first rendered per group, one summary row under each
 * heading. Driven with a **signal** output dragged at a Text Input, that produced
 * **19 summary rows** — every value group on the node refuses a signal, so every
 * heading grew its own *"N value inputs · a signal is a moment, not a value"*,
 * and the four signal inputs that actually work sat below nineteen repetitions of
 * one sentence.
 *
 * Which is the wall SIG-001's acceptance forbids ("still shows its connectable
 * ones without scrolling past a grey wall"), rebuilt out of summaries instead of
 * out of rows. The per-group line is only worth its space when the group *also*
 * has something connectable in it — there it is local context. When a whole group
 * is refused, the group heading carries no information either, and the honest
 * rendering is one line for all of them.
 *
 * So `ConnectionBar` keeps the per-group block for mixed groups and folds every
 * fully-refused group into a single instance of this at the end of the list.
 *
 * ## Why one instance can render two lines
 *
 * FB-021 — a **switched-off** port is in this list without being refused, and no
 * single summary is true of both kinds at once. `partitionGated` splits them and
 * each half gets its own line. Both call sites inherit that by construction,
 * which is why the split lives here rather than in `ConnectionBar`: a mixed
 * *group* has the same defect as the mixed folded block.
 */
export interface RefusedPortsProps {
  /**
   * The same shape `dominantReason` and `dominantTypeName` already take — this
   * component reads `group` and `name` on top of what they read, and both are on
   * it. It was `TSFixme[]` while the two functions it hands every port to were
   * typed, which is the arrangement where a renamed field type-checks.
   */
  ports: PlannablePort[];
  /** `useNodeColorScheme`'s output, passed through to each `PortItem`. */
  colors: INodeColorScheme;
  /** Whether clicking a row redirects. Inert when the offer is only advisory. */
  canRedirect?: boolean;
  onRefusalClicked?: () => void;
  /** Headings to print above their ports once expanded. Only the folded block needs these. */
  showGroupNames?: boolean;
}

export function RefusedPorts({ ports, colors, canRedirect, onRefusalClicked, showGroupNames }: RefusedPortsProps) {
  /*
   * FB-021 — two blocks, never one summary over both. See `partitionGated` for
   * what a drive found here: a `gated` port is not refused at all, so the generic
   * *"N ports this wire can't reach"* that a mixed set falls back to is false
   * about it in the exact way this task was filed about.
   *
   * ⚠️ The redirect is withheld from the gated block on purpose. `canRedirect`
   * offers *a different wire*, which is the right answer when this one is refused
   * and the wrong one when it is legal — the port comes back by changing the
   * setting the row names, not by wiring somewhere else.
   */
  const { refused, gated } = partitionGated(ports);

  if (!refused.length && !gated.length) return null;

  return (
    <>
      <RefusedBlock
        ports={refused}
        colors={colors}
        canRedirect={canRedirect}
        onRefusalClicked={onRefusalClicked}
        showGroupNames={showGroupNames}
      />
      <RefusedBlock ports={gated} colors={colors} showGroupNames={showGroupNames} />
    </>
  );
}

/** One summary line and the rows behind it. The body this component has always had. */
function RefusedBlock({ ports, colors, canRedirect, onRefusalClicked, showGroupNames }: RefusedPortsProps) {
  const [expanded, setExpanded] = useState(false);

  if (!ports.length) return null;

  const reason = dominantReason(ports);
  const typeName = dominantTypeName(ports);

  // Only meaningful for the folded block, where the ports come from many groups
  // and the heading is the only thing that says where a port lives.
  const rendered = [];
  let lastGroup;
  for (const p of ports) {
    if (showGroupNames && p.group !== lastGroup) {
      lastGroup = p.group;
      rendered.push(
        <div key={'g-' + p.group + '-' + p.name} className={css.refusedGroupLabel}>
          {p.group}
        </div>
      );
    }
    rendered.push(
      <PortItem
        key={p.name}
        colors={colors}
        onClick={canRedirect ? onRefusalClicked : undefined}
        isSelected={false}
        port={p}
      />
    );
  }

  return (
    <div className={css.refusedBlock}>
      <button
        type="button"
        className={css.refusedSummary}
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
      >
        <Icon
          icon={expanded ? IconName.CaretDown : IconName.CaretRight}
          size={IconSize.Tiny}
          UNSAFE_className={css.refusedCaret}
        />
        <span className={css.refusedSummaryText}>{refusedGroupSummary(ports.length, reason, typeName)}</span>
      </button>

      {expanded ? rendered : null}
    </div>
  );
}
