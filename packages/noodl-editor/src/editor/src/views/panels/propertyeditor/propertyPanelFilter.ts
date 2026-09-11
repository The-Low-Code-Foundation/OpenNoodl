/**
 * FB-017 AC7 — finding a property by name, including one the tier split has folded away.
 *
 * The two-tier panel that FB-017 built solves the first-screen problem and creates a second one:
 * a builder who *knows* the property they want now has somewhere new to look for it. `Advanced
 * CSS` starts collapsed, and 22 groups are inside it. AC2's badge says *something* in there is
 * live; it does not say *which*, and it says nothing at all about a port that is merely present.
 * This module is the answer to "where did `Transform Origin X` go".
 *
 * ## Everything here is pure, and that is the point
 *
 * The panel's rows are not React — `Ports.renderParams` builds raw elements from twenty-nine row
 * classes and hands them to `RowHost` to append. So the *decision* about which rows survive a
 * query cannot be graded by rendering anything; it has to be a function over the view objects.
 * That is the same split `propertyPanelTiers.ts` makes and for the same reason: the half worth
 * grading is the half with the judgement in it.
 *
 * ## What a query is matched against, and why it is three things
 *
 * Measured over the 58 shared CSS ports in `node-shared-port-definitions.ts`, across their 14
 * groups. Both of the extra match paths below are load-bearing for real groups, and neither was
 * obvious before counting:
 *
 * | Match path | Groups that need it | Because |
 * | --- | --- | --- |
 * | label (`displayName`) | most | it is the word on screen |
 * | port **name** | `Placement` | rows are `transformX`/`transformRotation`, labelled `Pos X`/`Rotation` — `transform` is on no label |
 * | **group** name | `Style`, `Alignment`, `Dimensions`, `Layout`, `Placement`, `Dimension Constraints` | the group's own word appears on none of its rows |
 *
 * `Style` is the sharpest of them: its rows are `Opacity`, `Blend Mode`, `Visible` and `zIndex`,
 * so a builder typing `style` — a word the panel puts in a heading right above those rows — would
 * be told there is no such thing. A group hit therefore keeps the **whole** group, because "show
 * me Style" means the section, not the subset of its rows that happen to repeat the word.
 *
 * ⚠️ `Margin and padding` is *not* one of these, though it looks like it should be: its ports are
 * `marginLeft`…`paddingBottom` and its labels are `Margin Left`…`Padding Bottom`, so the word is
 * on every row twice. An earlier draft of this file asserted the opposite, and the spec fixture
 * built to prove it passed with the group-name rule deleted — see the spec's note.
 */

/**
 * Below this many rows the panel does not offer a filter at all.
 *
 * 🔴 The number is a measurement, not a preference: at the panel's row height a builder sees
 * about this many rows without scrolling, and a filter cannot find anything the eye already has
 * on screen. Above it the panel is a scroll, and scanning it is work.
 *
 * ⚠️ It is deliberately a row count rather than "does this node have more than one group". A
 * two-group node with three ports is not a haystack; a one-group node with forty is.
 */
export const FILTER_MIN_ROWS = 12;

/** How deep to look inside container views before assuming the structure is cyclic. */
const MAX_VIEW_DEPTH = 4;

/**
 * Folds a label or a query down to the characters that carry meaning.
 *
 * Case and separators are dropped, so `corner radius`, `Corner-Radius` and `cornerradius` are one
 * query, and it matches both the label `Corner Radius` and the port name `cornerRadius`. That
 * equivalence is the whole reason to normalise rather than lowercase: the label and the port name
 * for the same property differ *precisely* by spacing and case, and a builder should not have to
 * know which one the panel is comparing against.
 */
export function normalizeSearchText(text: unknown): string {
  if (typeof text !== 'string') return '';
  return text.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Whether a raw query is asking for anything.
 *
 * 🔴 A query that normalises to nothing — whitespace, or punctuation a builder is midway through
 * typing — is inactive rather than a filter matching nothing. The difference is a panel showing
 * every property versus a panel that has gone blank because someone pressed the space bar.
 */
export function isFilterActive(rawQuery: string | undefined): boolean {
  return normalizeSearchText(rawQuery).length > 0;
}

/**
 * The shape this module needs from a property row, which is a subset of `TypeView`.
 *
 * Structural rather than an import of `TypeView` so the specs can build a row out of an object
 * literal — the real class reaches `EventDispatcher` and the model layer through its constructor,
 * and none of that has any bearing on whether a name matches a query.
 */
export interface FilterableView {
  /** The port's underlying name — `marginLeft`. */
  name?: string;
  /** The label the row draws — `Left`. */
  displayName?: string;
  /** A `PopoutGroup`'s button text. */
  label?: string;
  /** A `PopoutGroup`'s group name — its ports are not built until the popout opens. */
  popoutGroup?: string;
  /** A `TabGroup`'s name; it carries no `displayName` of its own. */
  tabGroup?: string;
  /** `PropListType`'s per-item rows. */
  childViews?: FilterableView[];
  /** A `TabGroup`'s rows, one tab's worth of which is on screen at a time. */
  views?: FilterableView[];
}

export interface FilterableGroup<V extends FilterableView = FilterableView> {
  name: string;
  views: V[];
}

/** The strings a single view answers to, ignoring anything nested inside it. */
function ownSearchText(view: FilterableView): string[] {
  return [view.displayName, view.name, view.label, view.popoutGroup, view.tabGroup].filter(
    (value): value is string => typeof value === 'string'
  );
}

/**
 * Whether a view — or anything it contains — answers to the query.
 *
 * ⚠️ A container view matches *whole*. A `TabGroup` stands in for several ports at once and
 * renders one tab's worth at a time; a `PopoutGroup`'s ports do not exist until its button is
 * clicked. Filtering inside either would mean hiding rows a builder can see the container for but
 * cannot reach, so a hit anywhere inside keeps the container intact. That under-filters, and
 * under-filtering is the safe direction here for the same reason it is for AC2's badge: this
 * exists to say "it is in here", never to certify that nothing else is.
 *
 * ⚠️ Recursion is bounded and walks `childViews`/`views` only — never `parent`, which every
 * `TypeView` carries back to the `Ports` instance that owns it. Following that would walk the
 * whole panel from any row and report every query as a match on everything.
 */
export function viewMatchesQuery(view: FilterableView, normalizedQuery: string, depth = 0): boolean {
  if (!view || !normalizedQuery) return false;

  for (const text of ownSearchText(view)) {
    if (normalizeSearchText(text).includes(normalizedQuery)) return true;
  }

  if (depth >= MAX_VIEW_DEPTH) return false;

  const nested = [...(view.childViews ?? []), ...(view.views ?? [])];
  return nested.some((child) => viewMatchesQuery(child, normalizedQuery, depth + 1));
}

/**
 * The groups a query leaves standing, each holding only its matching rows.
 *
 * A group whose *name* matches keeps every row it has: "show me margin" means the margin
 * properties, not the subset of them whose individual labels happen to repeat the word. A group
 * left with no rows is dropped entirely rather than rendered as an empty heading.
 *
 * An inactive query returns the groups untouched — the same array, so a caller can tell that
 * nothing was filtered without comparing contents.
 */
export function filterGroups<V extends FilterableView, G extends FilterableGroup<V>>(
  groups: readonly G[],
  rawQuery: string | undefined
): G[] {
  const query = normalizeSearchText(rawQuery);
  if (!query) return groups as G[];

  const result: G[] = [];

  for (const group of groups) {
    if (normalizeSearchText(group.name).includes(query)) {
      result.push(group);
      continue;
    }

    const views = (group.views || []).filter((view) => viewMatchesQuery(view, query));
    if (views.length) result.push({ ...group, views });
  }

  return result;
}

/** How many rows the panel would draw for these groups, containers counting as the one row they are. */
export function countFilterableRows(groups: readonly FilterableGroup[]): number {
  return groups.reduce((total, group) => total + (group.views ? group.views.length : 0), 0);
}

/**
 * Whether this node's panel is long enough to be worth a filter box.
 *
 * Evaluated against the *unfiltered* groups by the caller, so that filtering down to two rows
 * cannot make the box that did the filtering disappear out from under the cursor.
 */
export function shouldOfferFilter(groups: readonly FilterableGroup[]): boolean {
  return countFilterableRows(groups) >= FILTER_MIN_ROWS;
}
