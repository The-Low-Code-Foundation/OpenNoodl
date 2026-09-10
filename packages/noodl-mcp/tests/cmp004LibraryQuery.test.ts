/**
 * CMP-004 AC2 (P85) — the shelf becomes searchable by what a part DOES.
 *
 * The AC's own worked example is *"is there a date formatter?"*, and until this the shelf could
 * not be asked it: `list_library` took `type` and an exact `tag`, and nothing else.
 *
 * 🔴 **The measurement that decided it, and the reason "state why tags are enough" was not the
 * answer.** Over the 72 entries actually on the shelf:
 *
 *  - the ONE entry that formats things (`intl-format`) is tagged **`Utilities`**; the other eight
 *    utilities are tagged **`Utility`**. `list_library({tag: "Utility"})` therefore returns eight
 *    rows and excludes the only formatting entry there is. That is asserted below, against the
 *    real library, because it is the whole case;
 *  - 22 distinct tags cover 72 entries, `UI` alone covers 50, and seven tags have one member each.
 *
 * ⚠️ **These specs run against the REAL `library/` tree, not a fixture.** A fixture shelf would
 * grade the matcher against entries written to be found by it — and a budget measured on a fixture
 * bounds the fixture. The cost is that adding entries can move a count; every count here is
 * asserted as a floor or a relationship rather than as a frozen number, except the two tag counts,
 * which ARE the finding.
 */

import { entryComponentNames, listShelf, queryTerms, resolveLibraryRoot, scoreEntry } from '../src/libraryShelf';

const resolved = resolveLibraryRoot();
if (!resolved.ok) throw new Error(`the real library root is required for this suite: ${resolved.reason}`);
const ROOT = resolved.root;

const slugs = (query: string) => listShelf(ROOT, { query }).rows.map((r) => r.slug);

describe('CMP-004 AC2 — why an exact tag was not enough', () => {
  it('the only formatting entry on the shelf is tagged Utilities while every other utility is Utility', () => {
    const utility = listShelf(ROOT, { tag: 'Utility' }).rows.map((r) => r.slug);
    const utilities = listShelf(ROOT, { tag: 'Utilities' }).rows.map((r) => r.slug);

    expect(utilities).toEqual(['intl-format']);
    expect(utility).not.toContain('intl-format');
    expect(utility.length).toBeGreaterThan(4);
    // 🔴 The two tags differ by one character and partition the shelf wrongly. An agent asking the
    // obvious question in the obvious way is told the formatting entry does not exist.
  });

  it('the tag vocabulary does not narrow — one tag covers most of the shelf', () => {
    const all = listShelf(ROOT).rows;
    const ui = listShelf(ROOT, { tag: 'UI' }).rows;
    expect(all.length).toBeGreaterThan(60);
    expect(ui.length / all.length).toBeGreaterThan(0.5);
  });
});

describe("CMP-004 AC2 — the AC's own worked example", () => {
  it('answers "is there a date formatter?" with the entry that formats dates', () => {
    const found = slugs('is there a date formatter');
    expect(found).toContain('intl-format');
    // 🔴 It is not merely present, it is the ANSWER: a ranked list an agent reads top-down.
    expect(found[0]).toBe('intl-format');
  });

  it('finds it by a word no field spells — "formatter" against a label saying "Format"', () => {
    // A plain substring test fails here and fails SILENTLY: "format".includes("formatter") is
    // false, so the shelf answers "nothing" and the agent builds from scratch.
    expect(slugs('formatter')).toContain('intl-format');
    expect(slugs('formatting')).toContain('intl-format');
    expect(slugs('format')).toContain('intl-format');
  });

  it('says which terms hit and where, so a row can be judged rather than trusted', () => {
    const row = listShelf(ROOT, { query: 'date formatter' }).rows.find((r) => r.slug === 'intl-format');
    expect(row).toBeDefined();
    expect(row!.matchedTerms).toEqual(expect.arrayContaining(['date', 'formatter']));
    expect(row!.matchedIn).toContain('label');
  });
});

describe('CMP-004 AC2 — the query reaches every field the shelf has', () => {
  it('matches a label', () => {
    expect(slugs('accordion')).toContain('accordion');
  });

  it('matches a description — the only place a module writes what its nodes are called', () => {
    // `intl-format` ships Relative Time / Format Number / Format List / Pluralize. None of those
    // names is in its slug, its label or its tags: the description is the whole index for a module.
    const row = listShelf(ROOT, { query: 'pluralize' }).rows.find((r) => r.slug === 'intl-format');
    expect(row).toBeDefined();
    expect(row!.matchedIn).toEqual(['description']);
  });

  it('🔴 matches a component name an entry ships — and NOTHING ELSE about that entry', () => {
    /**
     * The isolation is the whole spec. `filters` is labelled "Filters", tagged UI/Data, and
     * described as *"filter controls that work well with query records"* — the word `date` appears
     * in none of that. It appears in exactly one place: the component `/Filters/Date Filter`.
     *
     * ⚠️ Written this way because the first version of this spec was NOT: it picked a distinctive
     * word out of a component name and asserted the entry came back, and the entry came back off
     * its label. Blanking the component list turned nothing red — the assertion graded nothing.
     */
    const row = listShelf(ROOT, { query: 'date' }).rows.find((r) => r.slug === 'filters');
    expect(row).toBeDefined();
    expect(row!.matchedIn).toEqual(['component']);

    // The control, in the spec rather than in a session's memory: with component names withheld,
    // this entry is unreachable by the word its component is named for.
    const withoutComponents = scoreEntry(['date'], {
      label: row!.label,
      slug: 'filters',
      tags: row!.tags,
      description: 'A prefab for creating filter controls that work well with query records.',
      components: []
    });
    expect(withoutComponents).toBeUndefined();
    expect(
      scoreEntry(['date'], {
        label: row!.label,
        slug: 'filters',
        tags: row!.tags,
        description: 'A prefab for creating filter controls that work well with query records.',
        components: entryComponentNames(`${ROOT}/prefabs/filters`)
      })
    ).toBeDefined();
  });

  it('searches the FULL description, not the 160-character index cap', () => {
    // The row's `description` is capped for display. A term past the cap must still be findable,
    // or an entry is searchable by its first sentence only.
    const long = listShelf(ROOT).rows.find((r) => r.description.endsWith('...'));
    expect(long).toBeDefined();
    expect(listShelf(ROOT, { query: 'zzzznothing' }).rows).toEqual([]);
    // `intl-format`'s "PluralRules" sits well past 160 characters into its description.
    expect(slugs('pluralrules')).toContain('intl-format');
  });
});

describe('CMP-004 AC2 — an honest nothing, and stable ranking', () => {
  it('returns nothing rather than everything when nothing matches', () => {
    expect(listShelf(ROOT, { query: 'xylophone tuning fork' }).rows).toEqual([]);
    // 🔴 The control: the same call with no query returns the whole shelf, so the empty answer
    // above is the matcher speaking and not a broken root.
    expect(listShelf(ROOT).rows.length).toBeGreaterThan(60);
  });

  it('an all-stopword query is not a search at all — it lists', () => {
    const listed = listShelf(ROOT).rows.length;
    expect(listShelf(ROOT, { query: 'is there a' }).rows.length).toBe(listed);
    expect(listShelf(ROOT, { query: '   ' }).rows.length).toBe(listed);
  });

  it('combines with type and tag rather than replacing them', () => {
    const both = listShelf(ROOT, { type: 'prefab', query: 'date' });
    expect(both.rows.length).toBeGreaterThan(0);
    expect(both.rows.every((r) => r.type === 'prefab')).toBe(true);
    // `intl-format` is a module, so it is correctly absent here despite being the best `date` match.
    expect(both.rows.map((r) => r.slug)).not.toContain('intl-format');
    expect(both.considered).toBeLessThan(listShelf(ROOT).considered);
  });

  it('ranks a label hit above a description hit, and is stable', () => {
    const rows = listShelf(ROOT, { query: 'date' }).rows;
    expect(rows.length).toBeGreaterThan(1);
    expect(rows[0].matchedIn![0]).not.toBe('description');
    // The last row is there on a description hit alone — the ordering is doing work.
    expect(rows[rows.length - 1].matchedIn).toEqual(['description']);
    expect(listShelf(ROOT, { query: 'date' }).rows.map((r) => r.slug)).toEqual(rows.map((r) => r.slug));
  });

  it('reports the denominator the answer was drawn from', () => {
    const searched = listShelf(ROOT, { query: 'date' });
    expect(searched.considered).toBe(listShelf(ROOT).rows.length);
    expect(searched.rows.length).toBeLessThan(searched.considered);
  });
});

describe('CMP-004 AC2 — the matcher itself', () => {
  it('drops stopwords and keeps the words that carry the question', () => {
    expect(queryTerms('is there a date formatter')).toEqual(['date', 'formatter']);
    expect(queryTerms('a component that can upload a file')).toEqual(['component', 'upload', 'file']);
  });

  it('matches on a word prefix in both directions, four characters in', () => {
    const searchable = { label: 'Format Number', slug: 'x', tags: [], description: '', components: [] };
    expect(scoreEntry(['formatter'], searchable)).toBeDefined(); // term longer than the word
    expect(scoreEntry(['form'], searchable)).toBeDefined(); // term shorter than the word
    // 🔴 Three characters is where a prefix stops meaning anything: `for` would match `format`,
    // `form`, `foreach` and `forbidden` alike.
    expect(scoreEntry(['for'], searchable)).toBeUndefined();
    expect(scoreEntry(['numbers'], searchable)).toBeDefined();
    expect(scoreEntry(['colour'], searchable)).toBeUndefined();
    // 🔴 A shared stem is NOT a match — only a prefix is. `numeral` and `number` agree for five
    // characters and neither begins the other, so this is undefined, deliberately.
    expect(scoreEntry(['numeral'], searchable)).toBeUndefined();
  });

  it('🔴 does not let a short word wildcard a long one — `Form` must not match `formatter`', () => {
    // The measured false positive: `date-picker` carries the tag `Form`, a tag outscores a
    // description, and so it beat the entry that actually formats dates.
    expect(scoreEntry(['formatter'], { label: 'x', slug: 'x', tags: ['Form'], description: '', components: [] })).toBeUndefined();
    // …while the match the rule exists for still works.
    expect(scoreEntry(['formatter'], { label: 'Intl Format', slug: 'x', tags: [], description: '', components: [] })).toBeDefined();
    expect(scoreEntry(['formatting'], { label: 'Intl Format', slug: 'x', tags: [], description: '', components: [] })).toBeDefined();
    expect(scoreEntry(['dates'], { label: 'Date Picker', slug: 'x', tags: [], description: '', components: [] })).toBeDefined();
  });

  it('scores a label hit above a description hit for the same term', () => {
    const base = { slug: 'x', tags: [], components: [] };
    const inLabel = scoreEntry(['upload'], { ...base, label: 'File Upload', description: '' });
    const inDescription = scoreEntry(['upload'], { ...base, label: 'Something', description: 'it can upload' });
    expect(inLabel!.score).toBeGreaterThan(inDescription!.score);
  });

  it('scores two matched terms above one', () => {
    const base = { slug: 'x', tags: [], components: [] };
    const one = scoreEntry(['date', 'formatter'], { ...base, label: 'Date Picker', description: '' });
    const two = scoreEntry(['date', 'formatter'], { ...base, label: 'Date Format', description: '' });
    expect(two!.score).toBeGreaterThan(one!.score);
    expect(two!.matchedTerms).toEqual(['date', 'formatter']);
    expect(one!.matchedTerms).toEqual(['date']);
  });
});
