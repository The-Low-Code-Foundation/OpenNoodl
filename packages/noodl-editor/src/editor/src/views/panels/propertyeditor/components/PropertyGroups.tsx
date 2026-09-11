import classNames from 'classnames';
import React, { useLayoutEffect, useRef } from 'react';

import { ADVANCED_CSS_GROUP, activityBadgeLabel, sumActiveCounts } from '../propertyPanelTiers';

export interface PropertyGroupModel {
  name: string;
  isExpanded: boolean;
  /** Row views belonging to the group — raw elements or jQuery-wrapped */
  els: TSFixme[];
  /**
   * FB-017 AC2: how many of the group's ports are connected or set. Drawn as a badge when the
   * group is collapsed, so nothing folded away is doing something invisible.
   */
  activeCount?: number;
}

export interface PropertyGroupsProps {
  /** The basic tier, already ordered by `orderPropertyGroups`. */
  groups: PropertyGroupModel[];
  /**
   * FB-017: groups folded into the single `Advanced CSS` section. Empty or omitted renders no
   * section at all — a node with no advanced ports must not grow an empty heading.
   */
  advancedGroups?: PropertyGroupModel[];
  /** Whether the `Advanced CSS` section itself is open. Collapsed by default; see `propertyPanelViewState`. */
  isAdvancedExpanded?: boolean;
  /** When false the rows are rendered without group chrome (the single "Other" group case) */
  showHeaders: boolean;
  /**
   * FB-017 AC7: the active property filter, or empty. Used only to explain an empty result —
   * the filtering itself happens in `propertyPanelFilter.ts` before the groups arrive here.
   */
  filterQuery?: string;
  /** Called with the group name and the state it should move to. */
  onToggleGroup?: (groupName: string, isExpanded: boolean) => void;
}

/** Hosts row views built outside React, replacing whatever was there before. */
function RowHost({ els, className, style }: { els: TSFixme[]; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);

  // Layout effect so the rows are in place before paint — the property panel
  // measures them (popout anchoring, scroll restore) right after rendering.
  useLayoutEffect(() => {
    const container = ref.current;
    if (!container) return;

    while (container.firstChild) container.removeChild(container.firstChild);

    els.forEach((el) => {
      el && container.appendChild(el);
    });
  }, [els]);

  return <div className={className} style={style} ref={ref} />;
}

/**
 * A group's heading: the label, a disclosure chevron, and — when collapsed — a count of the
 * ports inside that are connected or set.
 *
 * 🔴 It is a real `<button>` with `aria-expanded`, not the clickable `<div>` it replaces. Before
 * FB-017 this was a plain div with no handler at all: `Ports.ts` declared `groupExpansions`, read
 * it on every render, and never wrote to it, so the collapse mechanism was dead code with a live
 * reader. A div that toggles is the same defect wearing a cursor — it is unreachable by keyboard
 * and announces nothing, on a panel whose whole job is now progressive disclosure.
 *
 * ⚠️ The chevron is a text glyph with `aria-hidden`, following `VariantSelector`, rather than the
 * shared `Icon`. That keeps this module renderable by the `tests-unit` jest runner, which has no
 * renderer around it — `Icon` is one of the imports that makes a spec here fail *to run* rather
 * than fail.
 *
 * Exported for that runner. It calls no hooks, so `renderElements` can evaluate it end-to-end and
 * grade the actual chevron, `aria-expanded` and badge — whereas `PropertyGroups` below reaches
 * `RowHost`, which calls `useRef` and `useLayoutEffect` and therefore throws there. The same split
 * `views/Community.tsx` makes for the same reason: the hook-free half is the half worth grading,
 * and what remains — that the sections are composed in the right order around it — is a drive.
 */
export function GroupHeading({
  name,
  isExpanded,
  activeCount,
  onToggle
}: {
  name: string;
  isExpanded: boolean;
  activeCount?: number;
  onToggle?: (isExpanded: boolean) => void;
}) {
  const badge = isExpanded ? null : activityBadgeLabel(activeCount ?? 0);

  return (
    <button
      type="button"
      className="property-group-label"
      aria-expanded={isExpanded}
      onClick={() => onToggle && onToggle(!isExpanded)}
    >
      <span className={classNames('property-group-chevron', isExpanded && 'is-expanded')} aria-hidden>
        ▾
      </span>
      <span className="property-group-name">{name}</span>
      {badge && <span className="property-group-badge">{badge}</span>}
    </button>
  );
}

/**
 * What the panel says when a filter matches nothing.
 *
 * 🔴 A panel that has gone blank is indistinguishable from a panel that has broken, and this one
 * has just hidden every property a builder can see — including the tier headings that would
 * otherwise prove it is still alive. The notice names the query back, because the most common
 * reason for no matches is a typo in the box rather than an absent property.
 *
 * Exported for the `tests-unit` runner: it calls no hooks, so `renderElements` can evaluate it.
 */
export function NoMatchesNotice({ query }: { query: string }) {
  return (
    <div className="property-filter-empty">
      <span className="property-filter-empty-title">No properties match “{query}”</span>
      <span className="property-filter-empty-hint">
        Clear the filter to see this node’s properties, including the ones under Advanced CSS.
      </span>
    </div>
  );
}

function Group({
  group,
  onToggleGroup
}: {
  group: PropertyGroupModel;
  onToggleGroup?: PropertyGroupsProps['onToggleGroup'];
}) {
  return (
    <div className="property-group">
      <GroupHeading
        name={group.name}
        isExpanded={group.isExpanded}
        activeCount={group.activeCount}
        onToggle={(next) => onToggleGroup && onToggleGroup(group.name, next)}
      />

      <RowHost els={group.els} className={classNames('properties', !group.isExpanded && 'hidden')} />
    </div>
  );
}

/**
 * The property editor's group sections (legacy `group` template).
 *
 * FB-017 gives it two tiers: the basic groups at the top level, then one `Advanced CSS` section
 * holding the shared CSS plumbing — see `propertyPanelTiers.ts` for which groups those are and
 * why. A `Group` node opens with 18 headings today; the split moves 8 of them behind one.
 */
export function PropertyGroups({
  groups,
  advancedGroups,
  isAdvancedExpanded = false,
  showHeaders,
  filterQuery,
  onToggleGroup
}: PropertyGroupsProps) {
  const hasAdvanced = Boolean(advancedGroups && advancedGroups.length);

  // Checked before the `showHeaders` branch below, because a node whose ports all sit in one
  // unnamed group can still be filtered down to nothing — and that branch would answer it with
  // an empty row host, which is the blank panel this notice exists to prevent.
  if (filterQuery && !groups.length && !hasAdvanced) {
    return <NoMatchesNotice query={filterQuery} />;
  }

  if (!showHeaders) {
    return <RowHost els={groups[0] ? groups[0].els : []} />;
  }

  // The super-group's badge is the sum of what is folded inside it, so a collapsed
  // `Advanced CSS` still reports that something in there is driving the screen — the count is
  // the only thing standing between FB-018's confusion and a new place to hide.
  const advancedActiveCount = sumActiveCounts(advancedGroups ?? []);

  return (
    <>
      {groups.map((group) => (
        <Group key={group.name} group={group} onToggleGroup={onToggleGroup} />
      ))}

      {hasAdvanced && (
        <div className="property-group property-group--advanced">
          <GroupHeading
            name={ADVANCED_CSS_GROUP}
            isExpanded={isAdvancedExpanded}
            activeCount={advancedActiveCount}
            onToggle={(next) => onToggleGroup && onToggleGroup(ADVANCED_CSS_GROUP, next)}
          />

          {/*
           * Nested groups keep their own headings and their own expansion state. Flattening them
           * into one list would drop the only thing telling a builder that `Border Color` under
           * here belongs to the thumb rather than to the element — several of the folded groups
           * are sub-element restylings whose port names are identical to the root's.
           */}
          <div className={classNames('property-group-children', !isAdvancedExpanded && 'hidden')}>
            {(advancedGroups ?? []).map((group) => (
              <Group key={group.name} group={group} onToggleGroup={onToggleGroup} />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
