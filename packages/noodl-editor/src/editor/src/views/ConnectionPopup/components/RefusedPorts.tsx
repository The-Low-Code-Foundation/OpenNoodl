import classNames from 'classnames';
import React, { useState } from 'react';

import { Icon, IconName, IconSize } from '@noodl-core-ui/components/common/Icon';

import css from '../ConnectionPopup.module.scss';
import { refusedGroupSummary } from '../portCopy';
import { dominantReason, dominantTypeName } from '../refusalPlan';
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
 */
export interface RefusedPortsProps {
  ports: TSFixme[];
  colors: TSFixme;
  /** Whether clicking a row redirects. Inert when the offer is only advisory. */
  canRedirect?: boolean;
  onRefusalClicked?: () => void;
  /** Headings to print above their ports once expanded. Only the folded block needs these. */
  showGroupNames?: boolean;
}

export function RefusedPorts({ ports, colors, canRedirect, onRefusalClicked, showGroupNames }: RefusedPortsProps) {
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
