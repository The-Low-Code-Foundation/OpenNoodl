/**
 * FB-017 — the tier ruling, and the sweep that keeps it honest.
 *
 * The sweep at the bottom is the one that matters. The unit cases above it grade a function
 * against inputs this file made up; the sweep grades the ruling against the 29 visual nodes and
 * 1,386 input ports that are actually in the library, which is the population a builder meets.
 */

import {
  ADVANCED_CSS_GROUP,
  ADVANCED_CSS_GROUPS,
  BASIC_CSS_ORDER,
  SUBJECT_GROUPS,
  activityBadgeLabel,
  countActivePorts,
  sumActiveCounts,
  orderPropertyGroups,
  tierForGroup
} from '../../src/editor/src/views/panels/propertyeditor/propertyPanelTiers';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const catalog = require('../../../noodl-types/src/node-catalog.json');

const groupsOf = (...names: string[]) => names.map((name) => ({ name }));
const namesOf = (groups: { name: string }[]) => groups.map((g) => g.name);

describe('tierForGroup', () => {
  it('folds away the shared CSS plumbing', () => {
    expect(tierForGroup('Advanced HTML')).toBe('advanced');
    expect(tierForGroup('Pointer Events')).toBe('advanced');
    expect(tierForGroup('Placement')).toBe('advanced');
  });

  it('keeps the groups Richard named basic', () => {
    for (const name of ['Margin and padding', 'Dimensions', 'Border Style', 'Corner Radius', 'Box Shadow']) {
      expect(tierForGroup(name)).toBe('basic');
    }
  });

  /**
   * 🔴 The deviation from AC3, asserted rather than only argued in a comment.
   *
   * AC3 asks for advanced-by-default. A third-party or kit node's subject heading is exactly the
   * case that default gets wrong, so the behaviour is pinned here: if someone later flips the
   * default to satisfy the letter of the AC, this test says what it costs.
   */
  it('leaves a group it has never heard of BASIC, so a kit node keeps its own ports visible', () => {
    expect(tierForGroup('Some Third Party Heading')).toBe('basic');
    expect(tierForGroup('')).toBe('basic');
  });
});

describe('orderPropertyGroups', () => {
  it('puts the node subject before the shared CSS, and General before the rest of it', () => {
    const { basic } = orderPropertyGroups(groupsOf('Margin and padding', 'Image', 'Dimensions', 'General'));
    expect(namesOf(basic)).toEqual(['General', 'Image', 'Dimensions', 'Margin and padding']);
  });

  it("orders the CSS basics by Richard's list, not alphabetically or by declaration", () => {
    const declared = groupsOf('Box Shadow', 'Margin and padding', 'Dimensions', 'Corner Radius', 'Layout');
    const { basic } = orderPropertyGroups(declared);
    expect(namesOf(basic)).toEqual(['Dimensions', 'Layout', 'Margin and padding', 'Corner Radius', 'Box Shadow']);
  });

  it('sorts unnamed subject groups alphabetically', () => {
    const { basic } = orderPropertyGroups(groupsOf('Video', 'Data', 'Pages'));
    expect(namesOf(basic)).toEqual(['Data', 'Pages', 'Video']);
  });

  it('sends Other to the back', () => {
    const { basic } = orderPropertyGroups(groupsOf('Other', 'Dimensions', 'General'));
    expect(namesOf(basic)).toEqual(['General', 'Dimensions', 'Other']);
  });

  it('collects the advanced groups without reordering them', () => {
    const { advanced } = orderPropertyGroups(groupsOf('Pointer Events', 'General', 'Advanced HTML', 'Scroll'));
    expect(namesOf(advanced)).toEqual(['Pointer Events', 'Advanced HTML', 'Scroll']);
  });

  it('carries the original objects through, not copies', () => {
    const group = { name: 'Dimensions', views: [1, 2, 3] };
    const { basic } = orderPropertyGroups([group]);
    expect(basic[0]).toBe(group);
  });

  /**
   * AC3's cardinality check. "The panel got shorter" and "the panel lost a port" look identical
   * on screen, so the partition is asserted to be exactly that — a partition.
   */
  it('is a partition: every group lands in exactly one tier, none invented, none dropped', () => {
    const input = groupsOf(
      'General',
      'Image',
      'Dimensions',
      'Margin and padding',
      'Advanced HTML',
      'Pointer Events',
      'Other',
      'A Heading Nobody Classified'
    );

    const { basic, advanced } = orderPropertyGroups(input);

    expect(basic.length + advanced.length).toBe(input.length);
    expect([...namesOf(basic), ...namesOf(advanced)].sort()).toEqual(namesOf(input).sort());
  });
});

describe('the badge on a collapsed group', () => {
  const probe = (connected: string[], set: string[]) => ({
    isConnected: (name: string) => connected.includes(name),
    isSet: (name: string) => set.includes(name)
  });

  it('counts a port once whether it is connected, set, or both', () => {
    expect(countActivePorts(['a', 'b', 'c'], probe(['a'], ['b']))).toBe(2);
    expect(countActivePorts(['a'], probe(['a'], ['a']))).toBe(1);
  });

  it('counts nothing on an untouched group', () => {
    expect(countActivePorts(['a', 'b'], probe([], []))).toBe(0);
  });

  it('says nothing at zero rather than drawing "0 set" on every heading', () => {
    expect(activityBadgeLabel(0)).toBeNull();
    expect(activityBadgeLabel(1)).toBe('1 set');
    expect(activityBadgeLabel(7)).toBe('7 set');
  });

  it('sums PORTS across the folded groups, not the groups that have any', () => {
    // A section holding six live ports and a section holding one must not read identically on
    // the collapsed super-group — the number is about the screen, not about the file layout.
    expect(sumActiveCounts([{ activeCount: 6 }, { activeCount: 1 }])).toBe(7);
    expect(sumActiveCounts([{ activeCount: 0 }, {}, { activeCount: 2 }])).toBe(2);
    expect(sumActiveCounts([])).toBe(0);
  });
});

/**
 * The sweep — FB-017 AC3, run over the corpus that exists rather than over fixtures.
 *
 * ⚠️ The catalog does not contain dynamically-built ports (88 node types build ports at runtime;
 * `PORT-GROUP-VOCABULARY.md` records the blind spot). That is a limit on what this sweep can
 * prove, and it is the reason the tier default is the harmless one: a group this file cannot see
 * stays visible.
 */
describe('the ruling, swept over the real node catalog', () => {
  const visualNodes = catalog.nodes.filter((n: TSFixme) => n.isVisual);

  /** group name → the visual node types that carry it */
  const carriers = new Map<string, Set<string>>();
  for (const node of visualNodes) {
    for (const port of node.inputs || []) {
      const name = port.group || 'Other';
      if (!carriers.has(name)) carriers.set(name, new Set());
      carriers.get(name).add(node.typeName);
    }
  }

  /** Carried by three or more node types — plumbing rather than one node's private heading. */
  const sharedGroups = [...carriers.entries()].filter(([, nodes]) => nodes.size >= 3).map(([name]) => name);

  it('reads a corpus big enough to mean something', () => {
    // Guards against the sweep passing because it swept nothing — a catalog that failed to load,
    // or an `isVisual` flag that changed shape, would otherwise read as a clean sheet.
    expect(visualNodes.length).toBeGreaterThanOrEqual(25);
    expect(sharedGroups.length).toBeGreaterThanOrEqual(15);
  });

  it('classifies every shared visual group explicitly', () => {
    const classified = new Set([...Object.keys(ADVANCED_CSS_GROUPS), ...BASIC_CSS_ORDER, ...SUBJECT_GROUPS, 'Other']);
    const unclassified = sharedGroups.filter((name) => !classified.has(name));

    expect(unclassified).toEqual([]);
  });

  it('has no rules for groups that no longer exist', () => {
    // The other direction: a heading renamed in the library leaves a rule here matching nothing,
    // and a rule that matches nothing is a group silently back on the first screen.
    const live = new Set(carriers.keys());
    const dead = [...Object.keys(ADVANCED_CSS_GROUPS), ...BASIC_CSS_ORDER, ...SUBJECT_GROUPS].filter(
      (name) => !live.has(name)
    );

    expect(dead).toEqual([]);
  });

  it('never leaves a visual node that has groups with nothing in its basic tier', () => {
    // The failure mode advanced-by-default would have caused, asserted against every visual node.
    //
    // ⚠️ Nodes with no input ports at all are excluded, and the exclusion is named rather than
    // silent: `Component Children` has zero inputs, so its basic tier is empty because there is
    // nothing to tier, not because the ruling folded its ports away. Asserting over it would
    // have made this test fail for the one reason it is not looking for.
    const withGroups = visualNodes.filter((n: TSFixme) => (n.inputs || []).length > 0);
    expect(withGroups.length).toBeGreaterThanOrEqual(25);

    const starved: string[] = [];
    for (const node of withGroups) {
      const groups = [...new Set((node.inputs || []).map((p: TSFixme) => p.group || 'Other'))].map((name) => ({
        name: name as string
      }));

      if (orderPropertyGroups(groups).basic.length === 0) starved.push(node.typeName);
    }

    expect(starved).toEqual([]);
  });

  it('actually folds something away on the node the task was filed about', () => {
    // A ruling that classified nothing would pass every test above.
    const group = visualNodes.find((n: TSFixme) => n.typeName === 'Group');
    expect(group).toBeDefined();

    const groups = [...new Set((group.inputs || []).map((p: TSFixme) => p.group || 'Other'))].map((name) => ({
      name: name as string
    }));

    const { basic, advanced } = orderPropertyGroups(groups);

    // Measured, not quoted: a `Group` carries 87 input ports under 18 distinct headings, and the
    // ruling folds 8 of those into `Advanced CSS`. FB-017's own ground-truth note says 19 — it
    // counted one heading that is not there.
    expect(groups.length).toBe(18);
    expect(advanced.length).toBe(8);
    expect(basic.length).toBe(10);
    expect(namesOf(basic)[0]).toBe('General');
  });

  it('names the super-group consistently', () => {
    expect(ADVANCED_CSS_GROUP).toBe('Advanced CSS');
    // The super-group is chrome the panel draws, never a group a port declares — if a node ever
    // declared it, the panel would nest a section inside itself.
    expect(carriers.has(ADVANCED_CSS_GROUP)).toBe(false);
  });
});
