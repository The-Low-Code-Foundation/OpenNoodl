/**
 * FB-017 AC7 — what a query does to the panel's groups.
 *
 * ## What this can see, and what it deliberately cannot
 *
 * Every judgement AC7 makes is in `propertyPanelFilter.ts`: what a query is compared against,
 * which rows survive it, which groups are dropped, and whether the box is offered at all. The
 * rows themselves are raw elements built by twenty-nine legacy view classes, so there is nothing
 * to render here and nothing worth mocking — the views below are object literals of exactly the
 * fields the module reads.
 *
 * 🔴 What this cannot see is that `Ports.renderGroups` calls any of it, that a hit inside a
 * collapsed `Advanced CSS` is actually revealed on screen, or that clearing the box restores the
 * builder's own expansion state. Those are the drive, and they are named here rather than assumed
 * — source-text assertions pass on dead code.
 */
import {
  FILTER_MIN_ROWS,
  countFilterableRows,
  filterGroups,
  isFilterActive,
  normalizeSearchText,
  shouldOfferFilter,
  viewMatchesQuery
} from '../../src/editor/src/views/panels/propertyeditor/propertyPanelFilter';

/** A row as `Ports.getViewGroupsFromPorts` builds it: the port name and the label drawn. */
const row = (name: string, displayName = name) => ({ name, displayName });

/**
 * 🔴 These are the REAL port names and labels, read out of `node-shared-port-definitions.ts`, and
 * that matters more than it looks.
 *
 * An earlier version of this file invented `Margin and padding` rows labelled `Left`/`Right`/
 * `Top`/`Bottom` to prove the group-name rule was load-bearing. It is not load-bearing there —
 * the real ports are `marginLeft` labelled `Margin Left`, so the word is on every row twice — and
 * the fixture was therefore satisfied by row matching alone. Deleting the group-name branch left
 * all 24 assertions green. The fixture had a hole shaped exactly like the rule it was written to
 * defend, and only mutating the source found it.
 *
 * So the groups below are chosen by measurement: `Style` and `Alignment` are groups whose own
 * word appears on none of their rows, and `Placement` is a group whose rows can only be reached
 * by port name.
 */

/** Real: the word "margin" is on every row, twice. Row matching alone is enough here. */
const marginGroup = {
  name: 'Margin and padding',
  views: [row('marginLeft', 'Margin Left'), row('marginRight', 'Margin Right'), row('paddingTop', 'Padding Top')]
};

/** 🔴 Real, and the sharpest case: not one row carries the word "style". */
const styleGroup = {
  name: 'Style',
  views: [row('opacity', 'Opacity'), row('mixBlendMode', 'Blend Mode'), row('visible', 'Visible')]
};

/** 🔴 Real: the rows are `alignX`/`alignY` labelled `Align X`/`Align Y` — never "alignment". */
const alignmentGroup = {
  name: 'Alignment',
  views: [row('alignX', 'Align X'), row('alignY', 'Align Y')]
};

/** 🔴 Real: labelled `Pos X`/`Rotation`, so only the PORT NAME carries "transform". */
const placementGroup = {
  name: 'Placement',
  views: [row('transformX', 'Pos X'), row('transformRotation', 'Rotation')]
};

/**
 * Real, and the pair that matters most to AC7: `Dimensions` is a basic-tier group and
 * `Dimension Constraints` is one of the 22 that FB-017 folds into the collapsed `Advanced CSS`.
 * A builder typing `width` is asking a question that spans the tier boundary — which is the whole
 * reason the filter has to reach inside the folded tier at all.
 */
const dimensionsGroup = {
  name: 'Dimensions',
  views: [row('sizeMode', 'Size Mode'), row('width', 'Width'), row('height', 'Height')]
};

const constraintsGroup = {
  name: 'Dimension Constraints',
  views: [row('minWidth', 'Min Width'), row('maxWidth', 'Max Width'), row('minHeight', 'Min Height')]
};

describe('normalising a query', () => {
  it('drops case and separators, so a label and a port name are one target', () => {
    expect(normalizeSearchText('Corner Radius')).toBe('cornerradius');
    expect(normalizeSearchText('cornerRadius')).toBe('cornerradius');
    expect(normalizeSearchText('corner-radius')).toBe('cornerradius');
  });

  it('answers non-strings with nothing rather than throwing', () => {
    expect(normalizeSearchText(undefined)).toBe('');
    expect(normalizeSearchText(null)).toBe('');
    expect(normalizeSearchText(42)).toBe('');
  });
});

describe('whether a query is asking for anything', () => {
  /**
   * 🔴 The difference between inactive and matching-nothing is the difference between a panel
   * showing every property and a panel that has gone blank because someone pressed the space bar.
   */
  it('treats whitespace and punctuation as no filter at all', () => {
    expect(isFilterActive('')).toBe(false);
    expect(isFilterActive('   ')).toBe(false);
    expect(isFilterActive('--')).toBe(false);
    expect(isFilterActive(undefined)).toBe(false);
  });

  it('is active as soon as there is a character to match on', () => {
    expect(isFilterActive('m')).toBe(true);
    expect(isFilterActive('  radius ')).toBe(true);
  });
});

describe('what a single view answers to', () => {
  it('matches the label a builder can see', () => {
    expect(viewMatchesQuery(row('mixBlendMode', 'Blend Mode'), 'blend')).toBe(true);
  });

  /** Real: `transformRotation` is labelled `Rotation`, so "transform" exists only as the name. */
  it('matches the port name, which is what the docs and the definitions call it', () => {
    expect(viewMatchesQuery(row('transformRotation', 'Rotation'), 'transform')).toBe(true);
  });

  it('does not match an unrelated row', () => {
    expect(viewMatchesQuery(row('opacity', 'Opacity'), 'shadow')).toBe(false);
  });

  /**
   * A `TabGroup` renders one tab's worth of rows at a time and a `PopoutGroup`'s ports are not
   * built until its button is clicked — so a hit inside either keeps the container whole rather
   * than hiding rows the builder can see the container for but cannot reach.
   */
  it('matches a tab group through the rows it stands in for', () => {
    const tabGroup = { tabGroup: 'Hover', views: [row('hoverColor', 'Color')] };
    expect(viewMatchesQuery(tabGroup, 'hovercolor')).toBe(true);
  });

  it('matches a popout group by its button text', () => {
    expect(viewMatchesQuery({ label: 'Edit Breakpoints', popoutGroup: 'breakpoints' }, 'breakpoint')).toBe(true);
  });

  it('matches a prop list through its child rows', () => {
    const parent = { name: 'items', displayName: 'Items', childViews: [row('itemLabel', 'Item Label')] };
    expect(viewMatchesQuery(parent, 'itemlabel')).toBe(true);
  });

  /**
   * 🔴 Every `TypeView` carries `parent` back to the `Ports` instance that owns it. Walking that
   * would reach the whole panel from any row and report every query as matching everything — so
   * recursion follows `childViews`/`views` only, and this is the assertion that says so.
   */
  it('does not walk back up through a view is parent', () => {
    const panelWide = { name: 'opacity', displayName: 'Opacity', parent: { views: [row('shadowColor', 'Shadow')] } };
    expect(viewMatchesQuery(panelWide as never, 'shadow')).toBe(false);
  });

  it('never matches on an empty query', () => {
    expect(viewMatchesQuery(row('opacity', 'Opacity'), '')).toBe(false);
  });
});

describe('filtering the panel is groups', () => {
  const groups = [marginGroup, styleGroup, alignmentGroup, placementGroup];

  it('returns the groups untouched when nothing is being asked for', () => {
    expect(filterGroups(groups, '')).toBe(groups);
    expect(filterGroups(groups, '   ')).toBe(groups);
  });

  /**
   * 🔴 The assertion the group-name rule lives or dies by. `Style`'s rows are `Opacity`, `Blend
   * Mode` and `Visible` — the word "style" is on none of them, only on the heading above. Delete
   * the group-name branch in `filterGroups` and this is the spec that goes red.
   */
  it('keeps a whole group when the group name is the only thing that matched', () => {
    const result = filterGroups(groups, 'style');
    expect(result.map((g) => g.name)).toEqual(['Style']);
    expect(result[0].views).toHaveLength(3);
  });

  it('does the same for Alignment, whose rows only ever say "align"', () => {
    const result = filterGroups(groups, 'alignment');
    expect(result.map((g) => g.name)).toEqual(['Alignment']);
    expect(result[0].views).toHaveLength(2);
  });

  /**
   * 🔴 The mirror case, and the one that justifies matching the port name at all: `Placement`'s
   * rows are labelled `Pos X` and `Rotation`, so a builder who knows the property as `transform`
   * — which is what the definition calls it and what the docs say — has no label to match on.
   */
  it('reaches a row through its port name when the label does not carry the word', () => {
    const result = filterGroups(groups, 'transform');
    expect(result.map((g) => g.name)).toEqual(['Placement']);
    expect(result[0].views).toHaveLength(2);
  });

  it('keeps only the matching rows when the hit is on a row', () => {
    const result = filterGroups(groups, 'blend');
    expect(result.map((g) => g.name)).toEqual(['Style']);
    expect(result[0].views.map((v) => v.displayName)).toEqual(['Blend Mode']);
  });

  it('drops a group that has nothing left in it rather than drawing an empty heading', () => {
    const result = filterGroups(groups, 'opacity');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Style');
  });

  it('can leave nothing standing, which is a real answer and not a bug', () => {
    expect(filterGroups(groups, 'zzzz')).toEqual([]);
  });

  /**
   * 🔴 `Dimensions` is basic and `Dimension Constraints` is folded into `Advanced CSS`, so this is
   * the shape AC7 exists for: one query, both tiers, and the second group is one the builder
   * cannot see at all until the filter reaches into it.
   */
  it('spans the tier boundary when a query hits both sides of it', () => {
    const result = filterGroups([dimensionsGroup, constraintsGroup], 'width');
    expect(result.map((g) => g.name)).toEqual(['Dimensions', 'Dimension Constraints']);
    expect(result[0].views.map((v) => v.displayName)).toEqual(['Width']);
    expect(result[1].views.map((v) => v.displayName)).toEqual(['Min Width', 'Max Width']);
  });

  it('does not mutate the group it filters, so the unfiltered panel survives the query', () => {
    filterGroups(groups, 'blend');
    expect(styleGroup.views).toHaveLength(3);
  });

  it('matches a port name across the spacing its label uses', () => {
    const result = filterGroups(groups, 'blend mode');
    expect(result.map((g) => g.name)).toEqual(['Style']);
  });
});

describe('whether the panel offers a filter at all', () => {
  const rowsOf = (count: number) => [{ name: 'General', views: Array.from({ length: count }, (_, i) => row(`p${i}`)) }];

  it('counts the rows the panel would draw', () => {
    expect(countFilterableRows([marginGroup, styleGroup])).toBe(6);
    expect(countFilterableRows([])).toBe(0);
  });

  /**
   * The threshold is a row count rather than "does this node have more than one group": a
   * two-group node with three ports is not a haystack, and a one-group node with forty is.
   */
  it('offers nothing on a panel short enough to read at a glance', () => {
    expect(shouldOfferFilter(rowsOf(FILTER_MIN_ROWS - 1))).toBe(false);
  });

  it('offers the box once the panel is a scroll', () => {
    expect(shouldOfferFilter(rowsOf(FILTER_MIN_ROWS))).toBe(true);
    expect(shouldOfferFilter(rowsOf(FILTER_MIN_ROWS + 20))).toBe(true);
  });

  it('counts rows across groups, not groups', () => {
    const spread = Array.from({ length: FILTER_MIN_ROWS }, (_, i) => ({ name: `G${i}`, views: [row(`p${i}`)] }));
    expect(shouldOfferFilter(spread)).toBe(true);
  });
});
