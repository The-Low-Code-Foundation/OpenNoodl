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
