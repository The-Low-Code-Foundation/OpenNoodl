import { buildResults } from '../../src/editor/src/views/NodePicker/NodePicker.search';

/**
 * UIX-013 — the picker's result model.
 *
 * The behaviour the acceptance criteria turn on: every match visible with
 * nothing collapsed, exact names first, rail counts that agree with the
 * results, non-matching categories present-but-empty rather than gone, and a
 * stated reason for any match that isn't on the name.
 */

function node(name: string, extra: Record<string, unknown> = {}) {
  return { name, color: 'visual', ports: [], searchTags: [], ...extra } as TSFixme;
}

const INDEX = {
  coreNodes: [
    {
      name: 'UI Elements',
      description: '',
      type: 'visual',
      subCategories: [
        { name: 'Basic Elements', items: [node('Group'), node('Text'), node('Rich Text')] },
        { name: 'UI Controls', items: [node('Text Input'), node('Button')] }
      ],
      items: []
    },
    {
      name: 'Logic & Utilities',
      description: '',
      type: 'logic',
      subCategories: [
        {
          name: 'Strings',
          items: [node('String Format', { color: undefined, searchTags: ['text', 'template'] })]
        }
      ],
      items: []
    },
    {
      name: 'Navigation',
      description: '',
      type: 'logic',
      subCategories: [{ name: 'Navigation', items: [node('Router')] }],
      items: []
    },
    {
      name: 'Read & Write Data',
      description: '',
      type: 'data',
      subCategories: [
        {
          name: 'Backend',
          items: [
            node('Send Email', {
              color: 'data',
              ports: [{ name: 'bodyText', plug: 'input', type: 'string' }]
            })
          ]
        }
      ],
      items: []
    }
  ],
  customNodes: [
    {
      name: 'Project components',
      description: '',
      type: 'none',
      subCategories: [{ name: '', items: [node('/Gen/Forms/TextField', { displayName: 'TextField' })] }]
    }
  ]
} as TSFixme;

function build(query: string, activeCategory: string | null = null) {
  return buildResults({ index: INDEX, query, activeCategory });
}

describe('NodePicker buildResults — browse (UIX-013)', () => {
  it('renders every node with nothing collapsed', () => {
    const results = build('');

    // 9 nodes plus the comment action.
    expect(results.items.filter((item) => item.kind === 'node').length).toBe(9);
    expect(results.isSearching).toBe(false);
  });

  it('groups by sub-category and lists every category in the rail', () => {
    const results = build('');

    expect(results.groups.map((group) => group.title)).toEqual([
      'Basic Elements',
      'UI Controls',
      'Strings',
      'Navigation',
      'Backend',
      'Project components',
      'Other'
    ]);

    expect(results.categories.map((category) => category.name)).toEqual([
      'UI Elements',
      'Logic & Utilities',
      'Navigation',
      'Read & Write Data',
      'Project components'
    ]);
  });

  it('tints from the node colour, falling back to the category', () => {
    const results = build('');
    const byLabel = (label: string) => results.items.find((item) => item.label === label);

    expect(byLabel('Group').tint).toBe('visual');
    // No node colour of its own — takes the category's.
    expect(byLabel('String Format').tint).toBe('logic');
  });

  it('filters to one category without changing the rail counts', () => {
    const all = build('');
    const filtered = build('', 'UI Elements');

    expect(filtered.items.every((item) => item.categoryName === 'UI Elements')).toBe(true);
    expect(filtered.categories).toEqual(all.categories);
  });
});

describe('NodePicker buildResults — search (UIX-013)', () => {
  it('ranks exact and leading name matches first', () => {
    const results = build('text');

    // The strongest match overall is the first card on screen...
    expect(results.items[0].label).toBe('Text');
    // ...and within a group, leading matches beat contained ones, shorter names
    // beat longer ones.
    expect(results.groups[0].items.map((item) => item.label)).toEqual(['Text', 'Text Input', 'Rich Text']);
  });

  it('puts tag and port matches below every name match, and says why they matched', () => {
    const results = build('text');
    const labels = results.items.map((item) => item.label);

    expect(labels.indexOf('String Format')).toBeGreaterThan(labels.indexOf('Rich Text'));

    expect(results.items.find((item) => item.label === 'String Format').reason).toEqual({
      kind: 'tag',
      text: 'text'
    });
    expect(results.items.find((item) => item.label === 'Send Email').reason).toEqual({
      kind: 'port',
      text: 'bodyText'
    });
    expect(results.items.find((item) => item.label === 'Send Email').meta).toBe('port · bodyText');
  });

  it('marks the matched range of the name for highlighting', () => {
    const results = build('text');
    const rich = results.items.find((item) => item.label === 'Rich Text');

    expect(rich.highlight).toEqual([5, 9]);
    expect(results.items.find((item) => item.label === 'String Format').highlight).toBe(null);
  });

  it('groups by category, best match first', () => {
    const results = build('text');

    expect(results.groups[0].title).toBe('UI Elements');
    expect(results.groups.map((group) => group.title)).toContain('Read & Write Data');
  });

  it('counts every match per category and keeps categories with none', () => {
    const results = build('text');

    const counts = Object.fromEntries(results.categories.map((c) => [c.name, c.count]));
    expect(counts).toEqual({
      'UI Elements': 3,
      'Logic & Utilities': 1,
      Navigation: 0,
      'Read & Write Data': 1,
      'Project components': 1
    });

    // Dimmed, not hidden — "0 under Navigation" is information.
    expect(results.categories.map((c) => c.name)).toContain('Navigation');
    expect(results.total).toBe(6);
    expect(results.matchingCategoryCount).toBe(4);
  });

  it('counts stay put when a category filter is applied', () => {
    const unfiltered = build('text');
    const filtered = build('text', 'UI Elements');

    expect(filtered.categories).toEqual(unfiltered.categories);
    expect(filtered.total).toBe(unfiltered.total);
    expect(filtered.items.length).toBe(3);
  });

  it('is case insensitive and ignores surrounding whitespace', () => {
    expect(build('  TEXT ').total).toBe(build('text').total);
  });

  it('returns nothing for a query that matches nothing', () => {
    const results = build('websocket');

    expect(results.items.length).toBe(0);
    expect(results.groups.length).toBe(0);
    expect(results.categories.every((category) => category.count === 0)).toBe(true);
  });

  it('offers the comment action only when it is being looked for', () => {
    expect(build('comm').items.some((item) => item.kind === 'action')).toBe(true);
    expect(build('text').items.some((item) => item.kind === 'action')).toBe(false);
  });
});

/**
 * LEG-006 — the picker row carries the component's own sentence.
 *
 * The acceptance is "a human can tell two similarly-named components apart from
 * the list without opening either", so the fixture is two components whose
 * labels differ by one character. Everything else about the row is identical;
 * the description is the only thing that can separate them.
 *
 * Project component rows are `ComponentModel`s pushed straight into the index
 * by `createnodeindex.ts`, so `description` on the fixture node is the field
 * `ComponentModel` now holds (LEG-006 added it, and the `ProjectImporter` half
 * is what puts a value in it).
 */
const DESCRIBED_INDEX = {
  coreNodes: [
    {
      name: 'UI Elements',
      description: '',
      type: 'visual',
      subCategories: [{ name: 'Basic Elements', items: [node('Group')] }],
      items: []
    }
  ],
  customNodes: [
    {
      name: 'Project components',
      description: '',
      type: 'none',
      subCategories: [
        {
          name: '',
          items: [
            node('/Pages/Checkout', {
              displayName: 'Checkout',
              description: 'The live one-page checkout: address, card and the confirm button.'
            }),
            node('/Pages/Checkout2', {
              displayName: 'Checkout2',
              description: 'The abandoned two-step checkout kept for the A/B test. Do not link to it.'
            }),
            node('/Components/Undescribed', { displayName: 'Undescribed' })
          ]
        }
      ]
    }
  ]
} as TSFixme;

function buildDescribed(query: string) {
  return buildResults({ index: DESCRIBED_INDEX, query, activeCategory: null });
}

describe('NodePicker buildResults — component descriptions (LEG-006)', () => {
  it('carries the description onto the item', () => {
    const item = buildDescribed('').items.find((i) => i.name === '/Pages/Checkout');

    expect(item).toBeTruthy();
    expect(item.description).toBe('The live one-page checkout: address, card and the confirm button.');
  });

  it('shows it on the card instead of the redundant category line', () => {
    // In browse the second line is normally the category, which for every one
    // of these rows reads "Project components" — the group heading, repeated.
    const item = buildDescribed('').items.find((i) => i.name === '/Pages/Checkout');

    expect(item.meta).toBe('The live one-page checkout: address, card and the confirm button.');
  });

  it('separates two components whose names differ by one character', () => {
    const items = buildDescribed('checkout').items;
    const first = items.find((i) => i.name === '/Pages/Checkout');
    const second = items.find((i) => i.name === '/Pages/Checkout2');

    expect(first).toBeTruthy();
    expect(second).toBeTruthy();
    expect(first.meta).not.toBe(second.meta);
    expect(second.meta).toContain('abandoned');
  });

  it('leaves a component without one exactly as it was', () => {
    const item = buildDescribed('').items.find((i) => i.name === '/Components/Undescribed');

    expect(item.description).toBeUndefined();
    expect(item.meta).toBe('Project components');
  });

  it('does not put a description where a core node has none', () => {
    const item = buildDescribed('').items.find((i) => i.name === 'Group');

    expect(item.description).toBeUndefined();
    expect(item.meta).toBe('UI Elements');
  });

  it('still explains a non-name match — the reason outranks the description', () => {
    // A row that appeared because of a search tag must still say so, or the
    // description turns "why is this here?" back into a mystery (UIX-013).
    const tagged = {
      coreNodes: [
        {
          name: 'Logic & Utilities',
          description: '',
          type: 'logic',
          subCategories: [
            { name: 'Strings', items: [node('String Format', { searchTags: ['template'] })] }
          ],
          items: []
        }
      ],
      customNodes: []
    } as TSFixme;

    const results = buildResults({ index: tagged, query: 'template', activeCategory: null });
    const item = results.items.find((i) => i.name === 'String Format');

    expect(item.meta).toBe('tag · template');
  });
});

/**
 * LGC-001 §1 — the arithmetic terms, and the order they answer in.
 *
 * A test user typed the words he knew — `add`, `multiply`, `round` — and got
 * nothing back, because this product has no math nodes and the three that *do*
 * answer those words advertised only `javascript` and `blockly`. The tags that
 * fix that live on the node definitions in `@noodl/runtime` and are graded
 * there (`test/lgc-001-logic-triad.test.ts`). What is graded here is the half
 * that is picker arithmetic: **which of the three the tag match answers first**.
 *
 * The fixture is the real Logic category, in the real order
 * `nodelibraryexport.ts` now lists it in, with the real labels and a
 * representative slice of the real tags. It is deliberately *not* the whole
 * library: the claim is about ranking, and a fixture small enough to read is
 * what makes a failure legible.
 *
 * ⚠️ The regression this pins is subtle and was live before LGC-001. Every tag
 * match sits at the same rank, so the tie-break decided the answer, and the
 * tie-break was "shorter label first" — which answers `Function` (8 characters)
 * ahead of `Expression` (10) and `Visual Function` (15). That is the exact
 * inverse of what the task requires, and it would have been invisible in any
 * spec that only asserted "all three are returned".
 */
const LOGIC_TAGS = ['math', 'multiply', 'round', 'percent'];

const TRIAD_INDEX = {
  coreNodes: [
    {
      name: 'UI Elements',
      description: '',
      type: 'visual',
      subCategories: [{ name: 'Basic Elements', items: [node('Group'), node('Text')] }],
      items: []
    },
    {
      name: 'Logic',
      description: '',
      type: 'javascript',
      subCategories: [
        {
          name: '',
          items: [
            node('Expression', { color: 'javascript', searchTags: ['javascript', ...LOGIC_TAGS] }),
            node('Logic Builder', {
              color: 'javascript',
              displayNodeName: 'Visual Function',
              searchTags: ['blockly', 'visual', 'logic', 'blocks', 'nocode', ...LOGIC_TAGS]
            }),
            node('JavaScriptFunction', {
              color: 'javascript',
              displayNodeName: 'Function',
              searchTags: ['javascript', ...LOGIC_TAGS]
            })
          ]
        }
      ],
      items: []
    }
  ],
  customNodes: []
} as TSFixme;

function buildTriad(query: string) {
  return buildResults({ index: TRIAD_INDEX, query, activeCategory: null });
}

describe('NodePicker buildResults — the logic triad (LGC-001 §1)', () => {
  for (const term of ['math', 'multiply', 'round', 'percent']) {
    it(`answers "${term}" with all three, Expression first`, () => {
      const labels = buildTriad(term).items.map((item) => item.label);

      expect(labels).toEqual(['Expression', 'Visual Function', 'Function']);
    });
  }

  it('says on each card that the match was a tag, not the name', () => {
    const reasons = buildTriad('multiply').items.map((item) => item.reason);

    expect(reasons).toEqual([
      { kind: 'tag', text: 'multiply' },
      { kind: 'tag', text: 'multiply' },
      { kind: 'tag', text: 'multiply' }
    ]);
  });

  /**
   * The acceptance criterion that the rename could have broken. "Visual
   * Function" contains "function" at offset 7 and "Function" at offset 0, so
   * both are *name* matches and the offset decides — which is the ordering the
   * picker already had, and the reason Visual Function needs no `function` tag.
   */
  it('still ranks the Function node first for "function", and now returns both', () => {
    const items = buildTriad('function').items;

    expect(items.map((item) => item.label)).toEqual(['Function', 'Visual Function']);
    // Name matches, so no reason is shown — the highlighted name is the reason.
    expect(items.map((item) => item.reason)).toEqual([null, null]);
    expect(items[1].highlight).toEqual([7, 15]);
  });

  /**
   * The control. The ordering above must come from the library's listing order,
   * not from a rule this file happens to satisfy by accident — and the two are
   * easy to confuse, because Expression is also the *first* of the three
   * alphabetically and the shortest-label rule would have answered Function.
   * Reversing the fixture's list reverses the answer, and nothing else changes.
   */
  it('takes the order from the library listing, not from the labels', () => {
    const reversed = {
      ...TRIAD_INDEX,
      coreNodes: [
        TRIAD_INDEX.coreNodes[0],
        {
          ...TRIAD_INDEX.coreNodes[1],
          subCategories: [
            {
              name: '',
              items: [...TRIAD_INDEX.coreNodes[1].subCategories[0].items].reverse()
            }
          ]
        }
      ]
    } as TSFixme;

    const labels = buildResults({ index: reversed, query: 'multiply', activeCategory: null }).items.map(
      (item) => item.label
    );

    expect(labels).toEqual(['Function', 'Visual Function', 'Expression']);
  });

  /**
   * The band guard. A tag match is offset by the node's position in a library
   * of ~250 entries, and a port match sits 1000 above it; the offset is clamped
   * so no amount of library growth can let a tag match overtake a name match or
   * a port match overtake a tag match.
   */
  it('keeps tag matches below name matches and above port matches', () => {
    const results = buildTriad('multiply');

    for (const item of results.items) {
      expect(item.rank).toBeGreaterThanOrEqual(1000);
      expect(item.rank).toBeLessThan(2000);
    }
  });
});
