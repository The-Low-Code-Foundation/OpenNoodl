/**
 * FB-002 / FB-013 — one filter pill, drawn once, with its selected state on something you can see.
 *
 * ## 🔴 Why this component exists at all: the state was carried by FILL, and fill was invisible
 *
 * Three surfaces — the Bench, the people directory and Chat — each had their own copy of the same
 * seven lines of pill markup, all pointing at one shared `.FilterPill` class whose `is-active`
 * rule changed **only the background and the text ink**. Measured live in the running editor on
 * the Chat tab (session 57):
 *
 * | pair | was | needs |
 * |---|---|---|
 * | active fill vs panel | **1.36:1** | 3:1 for a non-text state boundary (WCAG 1.4.11) |
 * | active vs inactive fill | 1.94:1 | — |
 * | border, active vs inactive | **identical** (4.17:1 both) | — |
 * | label text vs its own fill | 8.46:1 | ✅ passes AA comfortably |
 *
 * So every individual *label* was perfectly legible and **which pill was selected was not**. That
 * is the distinction the old rule missed: state visibility is not text contrast. FB-002 recorded
 * it on the Bench, NAT-008 inherited it on People, and FB-013's C4 made it three surfaces — at
 * which point a shared defect behind three copied call sites is worth one component.
 *
 * ## ✅ The state is on the BORDER and in the TEXT, and that is FB-005 T4's answer, not a new one
 *
 * `TemplateStep`'s facet pills solved exactly this and were measured at **4.80:1 dark / 4.14:1
 * light** for the active border against their panel. This is the same mechanism on the community
 * palette:
 *
 * | pair | dark | light |
 * |---|---|---|
 * | active border vs panel | **5.60:1** | **4.57:1** |
 * | active border vs its own fill | **4.13:1** | **3.74:1** |
 *
 * ⚠️ Those four numbers are the INSTRUMENT's, not arithmetic done by hand beside it —
 * `tests-unit/fb-002/filter-pill-state.test.tsx` gates them, and they are what it reports.
 *
 * 🔴 **Both sides of the border are checked and both must clear 3:1**, because a boundary is only
 * a boundary against what sits on either side of it — a border that reads against the panel and
 * vanishes into its own fill is still a line nobody can find.
 *
 * 🔴 **The border width does not change between states.** 1px either way, colour only. A border
 * that grows on activation reflows the row, and the list appearing to jump when you click a filter
 * is its own defect — the same reasoning `TemplateStep` writes down for using 2px in both states.
 *
 * ⚠️ **The fill still changes, and is deliberately no longer load-bearing.** It is a nicety now;
 * delete it and the state survives. That is the property worth keeping, and the spec asserts it.
 *
 * ## ⚠️ The `✓` is `aria-hidden`, and that is not an oversight
 *
 * A state carried only by colour fails WCAG 1.4.1 regardless of how much contrast the colour has,
 * so the pill says it in text too. But the button already carries `aria-pressed`, which is how a
 * screen reader is *supposed* to hear this — letting the `✓` into the accessible name would make
 * it announce *"Solved 3 ✓, pressed"*, saying the same thing twice. The marker is therefore for
 * eyes that cannot separate the two blues, and the accessible name stays exactly what it was.
 *
 * @module noodl-core-ui/components/community/CommunityFilterPill
 */

import React from 'react';

import css from './Community.module.scss';

/**
 * The shape every filter pill on every community surface arrives as.
 *
 * ⚠️ Structural on purpose: the Bench, People and Chat each declare their own pill type
 * (`CommunityFilterPill` in `CommunityDirectoryView`, `CommunityChatFilterPill` in
 * `CommunityChatView`) and all three are this shape. This component takes the shape rather than
 * any one of those names, so it does not make three view models depend on each other.
 */
export type FilterPillModel = {
  key: string;
  label: string;
  count: number;
  active: boolean;
};

export interface FilterPillProps {
  filter: FilterPillModel;
  onSelect: (key: string) => void;
  /**
   * ⚠️ Optional because the people directory never had one. Bench and Chat name their pills for
   * the drives that click them, and a drive that cannot address a pill cannot verify a filter.
   */
  dataTest?: string;
}

export function FilterPill({ filter, onSelect, dataTest }: FilterPillProps) {
  return (
    <button
      type="button"
      className={`${css['FilterPill']} ${filter.active ? css['is-active'] : ''}`}
      aria-pressed={filter.active}
      data-test={dataTest}
      onClick={() => onSelect(filter.key)}
    >
      {filter.label} <span className={css['FilterCount']}>{filter.count}</span>
      {filter.active && (
        <span className={css['FilterPillMark']} aria-hidden="true">
          ✓
        </span>
      )}
    </button>
  );
}
