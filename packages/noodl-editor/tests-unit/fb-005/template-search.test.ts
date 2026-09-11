/**
 * FB-005 T4 — narrowing the template shelf: categories, and a search that answers a sentence.
 *
 * ───────────────────────────────────────────────────────────────────────────────
 * ## 🔴 WHAT THE RECALL FIGURE IN §4 IS, AND WHAT IT IS NOT
 *
 * AC4 asks for a **measured recall with an old-vocabulary control, the way FB-014 did**. FB-014
 * measured a retriever against a corpus somebody else had written — the Bench's real posts. There
 * is no equivalent here: the published shelf holds **one row** (`hello-world`), because the
 * platform half of FB-005 is not deployed. So the corpus in §4 is a fixture, and one author wrote
 * both the summaries and the queries.
 *
 * **That makes the absolute number worthless and the DIFFERENCE meaningful.** An author who
 * wanted 100% recall would get it by writing the corpus to match. So the measurement is run twice
 * over the identical corpus and the identical queries — once with terms ORed (what shipped) and
 * once with them ANDed (what `websearch_to_tsquery` does by default) — and the assertion is that
 * **the two arms disagree**. A known-good and a known-broken instrument that agree have measured
 * nothing; this is the same rule `EMBEDDED_TEMPLATE_CATEGORIES`' prose-category arm applies.
 *
 * ⚠️ **Stated plainly so nobody later quotes the wrong half**: this file grades the MATCHER over
 * a plausible shelf. It does not grade the shelf. When the shelf has real rows, re-run §4 over
 * them — `run-a-checker-over-the-artefacts-that-already-exist` is the standing lesson, and 52
 * green specs over fixtures once shipped two defects the first pass over 29 real modules found.
 *
 * ## The corpus is Richard's own roster, not invented content
 *
 * The rows in §4 are the eight templates ruled for 0.2.1 on 2026-08-26 (phase 76's README §1
 * order), plus `hello-world` and a contact form. Using the real roster is what surfaced §2's
 * finding: **three of the eight have no honest category in the ruled vocabulary.**
 */

import {
  EMPTY_TEMPLATE_FILTER,
  TEMPLATE_CATEGORY_LABELS,
  categoryLabel,
  filterTemplates,
  isFilterActive,
  queryTerms,
  scoreTemplate,
  tokenize,
  type TemplateFilter
} from '../../../noodl-core-ui/src/preview/launcher/Launcher/components/ProjectCreationWizard/steps/templateFilter';
import {
  TemplateStepBody,
  type TemplateChoice
} from '../../../noodl-core-ui/src/preview/launcher/Launcher/components/ProjectCreationWizard/steps/TemplateStep';

import { byClass, render, text } from '../support/renderElements';

/**
 * The vocabulary, as `0020`'s `project_template_category_known` declares it.
 *
 * 🔴 A **fourth** hand-written copy — the DDL, `TEMPLATE_CATEGORIES` in `projecttemplates.ts`,
 * `EMBEDDED_TEMPLATE_CATEGORIES` in `template-shelf.test.ts`, and this. The cost of that is
 * written down beside each one: a platform-side addition reddens these files loudly, which is
 * cheaper than a ruling that quietly stops being true.
 */
const PLATFORM_CATEGORIES = ['starter', 'data-app', 'dashboard', 'site', 'form', 'integration'];

const draw = (
  items: TemplateChoice[],
  filter: TemplateFilter = EMPTY_TEMPLATE_FILTER,
  selectedUrl = ''
) =>
  render(
    TemplateStepBody({
      gallery: { items, isLoading: false },
      selectedUrl,
      onSelect: () => undefined,
      filter,
      onFilterChange: () => undefined
    })
  );

// ── 1. The label map is a copy of the vocabulary, and copies drift ────────────

describe('FB-005 T4 — the category labels are the ruled vocabulary, both directions', () => {
  it('every ruled category has a label', () => {
    // A category on the platform with no label here draws its raw slug at a person.
    for (const category of PLATFORM_CATEGORIES) {
      expect(Object.keys(TEMPLATE_CATEGORY_LABELS)).toContain(category);
    }
  });

  it('every label names a ruled category — no invented ones', () => {
    // 🔴 THE OTHER DIRECTION, and it is the one a `toContain` loop cannot see. A label map with
    // an extra key is a facet vocabulary that has quietly forked from the CHECK constraint.
    for (const category of Object.keys(TEMPLATE_CATEGORY_LABELS)) {
      expect(PLATFORM_CATEGORIES).toContain(category);
    }
  });

  it('the two lists are the same size — the cardinality assertion', () => {
    // Two `toContain` loops are satisfied by two identical lists AND by two empty ones.
    expect(Object.keys(TEMPLATE_CATEGORY_LABELS)).toHaveLength(PLATFORM_CATEGORIES.length);
    expect(PLATFORM_CATEGORIES.length).toBeGreaterThan(0);
  });

  it('an unknown category falls through to its slug rather than to nothing', () => {
    // `ORIGIN_LABELS`' rule: a badge naming something we have not labelled is a bug somebody can
    // see; a missing badge is one nobody can.
    expect(categoryLabel('starter')).toBe('Starter');
    expect(categoryLabel('quantum-widget')).toBe('quantum-widget');
    expect(categoryLabel('')).toBe('');
  });
});

// ── 2. The corpus: Richard's 0.2.1 roster ────────────────────────────────────

/**
 * 🔴 **THREE OF THESE HAVE NO HONEST CATEGORY, AND THAT IS A FINDING, NOT A FIXTURE PROBLEM.**
 * The vocabulary was ruled on 2026-08-26 from `0020`, which was written before the template
 * roster existed. `pixel-game`, `interactive-fiction` and `shared-canvas` are none of
 * starter / data-app / dashboard / site / form / integration — so the CHECK constraint forces
 * them into `starter`, which is where the facet bar starts lying: a pill labelled **Starter**
 * that contains a game, a story engine and a shared canvas is not a filter, it is a bin.
 *
 * ⚠️ Left as-is here on purpose. The fix is a platform migration plus a ruling, both Richard's,
 * and this spec is the place the cost is recorded rather than the place it is decided.
 */
const ROSTER: TemplateChoice[] = [
  {
    url: 'community://site-builder',
    title: 'Site Builder',
    description:
      'A public website whose pages are records, with an admin panel your client edits without opening the graph.',
    category: 'site',
    origin: 'Community'
  },
  {
    url: 'community://landing-page',
    title: 'Personal Landing Page',
    description: 'A single page about you: a short bio, links, and a contact form that emails you.',
    category: 'site',
    origin: 'Community'
  },
  {
    url: 'community://pixel-game',
    title: 'Pixel Game',
    description: 'A tile grid, a sprite you move with the keyboard, and a score that counts up.',
    category: 'starter',
    origin: 'Community'
  },
  {
    url: 'community://storefront',
    title: 'Storefront',
    description: 'Products, a basket and a checkout, backed by Stripe.',
    category: 'data-app',
    origin: 'Community'
  },
  {
    url: 'community://membership-hub',
    title: 'Membership Hub',
    description: 'Sign-up, log-in and roles, with pages only members can reach.',
    category: 'data-app',
    origin: 'Community'
  },
  {
    url: 'community://data-dashboard',
    title: 'Data Dashboard',
    description: 'Charts and tables over your records, filtered by date.',
    category: 'dashboard',
    origin: 'Community'
  },
  {
    url: 'community://interactive-fiction',
    title: 'Interactive Fiction',
    description: 'A branching story: passages, choices, and the state the reader carries between them.',
    category: 'starter',
    origin: 'Community'
  },
  {
    url: 'community://shared-canvas',
    title: 'Shared Pixel Canvas',
    description: 'Everyone draws on one grid at the same time, over the realtime hub.',
    category: 'starter',
    origin: 'Community'
  },
  {
    url: 'embedded://hello-world',
    title: 'Hello World',
    description: 'A blank project with one page, to start from nothing.',
    category: 'starter',
    origin: 'Built in'
  },
  {
    url: 'community://contact-form',
    title: 'Contact Form',
    description: 'A form that validates, stores what it collects and emails you a copy.',
    category: 'form',
    origin: 'Community'
  }
];

describe('FB-005 T4 — the roster the measurement runs over', () => {
  it('every row carries a category the platform would accept', () => {
    for (const row of ROSTER) {
      expect(PLATFORM_CATEGORIES).toContain(row.category);
    }
  });

  it('records that three of the roster have no honest category', () => {
    // 🔴 Not a style check — an executable note. If the vocabulary later grows a `game` or a
    // `story`, this goes red and somebody re-reads the header. Until then it states the cost.
    const forcedIntoStarter = ['community://pixel-game', 'community://interactive-fiction', 'community://shared-canvas'];
    for (const url of forcedIntoStarter) {
      expect(ROSTER.find((r) => r.url === url)?.category).toBe('starter');
    }
  });
});

// ── 3. One producer: a pill's count IS the rows behind it ────────────────────

describe('FB-005 T4 — a facet count is what clicking it gives you', () => {
  it('every pill count equals the length of the list that pill produces', () => {
    // 🔴 THE CARDINALITY ASSERTION, at the seam where two producers would meet. It is true by
    // construction today — `filterTemplates` counts by re-running its own predicate — and this
    // is here because "true by construction" is a property of today's code and a test is a
    // property of the repository. `facets.ts` in nodegx-community makes the same argument.
    const filter: TemplateFilter = { category: null, query: '' };
    const { categories } = filterTemplates(ROSTER, filter);

    expect(categories.length).toBeGreaterThan(1);
    for (const facet of categories) {
      const behind = filterTemplates(ROSTER, { ...filter, category: facet.value });
      expect(facet.count).toBe(behind.rows.length);
    }
  });

  it('the counts follow the text query — they are not the whole shelf', () => {
    // The failure this catches: counting the rows already produced instead of re-running the
    // predicate. That reads correct on the one screen it is usually looked at — no filter — and
    // wrong on every other.
    const filter: TemplateFilter = { category: null, query: 'records' };
    const { rows, categories } = filterTemplates(ROSTER, filter);

    const all = categories.find((f) => f.value === null);
    expect(all?.count).toBe(rows.length);
    expect(all?.count).toBeLessThan(ROSTER.length);

    for (const facet of categories) {
      const behind = filterTemplates(ROSTER, { ...filter, category: facet.value });
      expect(facet.count).toBe(behind.rows.length);
    }
  });

  it('a pill with nothing behind it is not drawn, but the active one survives', () => {
    // A pill promising zero is a dead click; the ACTIVE pill promising zero is the only way back.
    const narrow = filterTemplates(ROSTER, { category: null, query: 'checkout' });
    expect(narrow.categories.every((f) => f.count > 0)).toBe(true);
    expect(narrow.categories.map((f) => f.value)).not.toContain('form');

    const stuck = filterTemplates(ROSTER, { category: 'form', query: 'checkout' });
    expect(stuck.rows).toHaveLength(0);
    expect(stuck.categories.find((f) => f.value === 'form')).toBeDefined();
    expect(stuck.categories.find((f) => f.value === 'form')?.count).toBe(0);
  });

  it('a category this editor has never heard of still gets a pill', () => {
    // Otherwise a platform row with a new category is reachable only by not filtering at all.
    const withUnknown = [
      ...ROSTER,
      { url: 'community://quantum', title: 'Quantum', description: 'Something new.', category: 'quantum-widget' }
    ];
    const { categories } = filterTemplates(withUnknown, EMPTY_TEMPLATE_FILTER);
    const pill = categories.find((f) => f.value === 'quantum-widget');
    expect(pill).toBeDefined();
    expect(pill?.label).toBe('quantum-widget');
    expect(pill?.count).toBe(1);
    // …and after the known ones, so the ruled vocabulary still leads the bar.
    expect(categories[categories.length - 1].value).toBe('quantum-widget');
  });

  it('with an empty box the shelf keeps its own order', () => {
    // `EmbeddedTemplateProvider` is registered first so the row that draws with no network is the
    // first card. A sort applied unconditionally would silently take that away.
    const { rows } = filterTemplates(ROSTER, EMPTY_TEMPLATE_FILTER);
    expect(rows.map((r) => r.url)).toEqual(ROSTER.map((r) => r.url));
  });
});

// ── 4. AC4: the measurement ──────────────────────────────────────────────────

/**
 * Ten queries, written as somebody types them into a box — not as keywords.
 *
 * ⚠️ `expected` is the row the query is *about*. Recall here is "did the intended row come back
 * at all"; `rank1` is "did it come back first". Both are reported.
 */
const QUERIES: { query: string; expected: string }[] = [
  { query: 'a website my client can edit themselves', expected: 'community://site-builder' },
  { query: 'personal landing page', expected: 'community://landing-page' },
  { query: 'somewhere to sell products online', expected: 'community://storefront' },
  { query: 'dashboard with charts over my records', expected: 'community://data-dashboard' },
  { query: 'how do I let people sign up and log in', expected: 'community://membership-hub' },
  { query: 'a game', expected: 'community://pixel-game' },
  { query: 'collect messages from visitors', expected: 'community://contact-form' },
  { query: 'start from nothing', expected: 'embedded://hello-world' },
  { query: 'a branching story', expected: 'community://interactive-fiction' },
  { query: 'drawing together at the same time', expected: 'community://shared-canvas' }
];

/**
 * The known-BROKEN arm: every term must match, which is what `websearch_to_tsquery` does to a
 * bare sentence and what FB-014 measured at 2 documents out of 22.
 */
function andRetrieval(items: TemplateChoice[], query: string): TemplateChoice[] {
  const terms = queryTerms(query);
  return items.filter((item) => terms.every((term) => scoreTemplate(item, [term]).score > 0));
}

describe('FB-005 T4 — AC4: the search answers a sentence, not only a keyword', () => {
  const shipped = QUERIES.map(({ query, expected }) => {
    const rows = filterTemplates(ROSTER, { category: null, query }).rows;
    return { query, expected, hit: rows.some((r) => r.url === expected), rank1: rows[0]?.url === expected };
  });

  const anded = QUERIES.map(({ query, expected }) => ({
    query,
    hit: andRetrieval(ROSTER, query).some((r) => r.url === expected)
  }));

  const orRecall = shipped.filter((r) => r.hit).length;
  const andRecall = anded.filter((r) => r.hit).length;

  it('reports the measurement', () => {
    // 🔴 Printed, not just asserted. A recall figure nobody can read is a figure nobody can
    // check, and §4's whole point is that the ABSOLUTE number is not the evidence.
    const misses = shipped.filter((r) => !r.hit).map((r) => r.query);
    const notFirst = shipped.filter((r) => r.hit && !r.rank1).map((r) => r.query);
    // eslint-disable-next-line no-console
    console.log(
      `[FB-005 T4] recall — ORed terms (shipped): ${orRecall}/${QUERIES.length}; ` +
        `ANDed terms (control): ${andRecall}/${QUERIES.length}; ` +
        `rank-1: ${shipped.filter((r) => r.rank1).length}/${QUERIES.length}` +
        (misses.length ? `; missed: ${misses.join(' | ')}` : '') +
        (notFirst.length ? `; found but not first: ${notFirst.join(' | ')}` : '')
    );
    expect(QUERIES).toHaveLength(10);
  });

  it('every query finds the row it is about', () => {
    for (const row of shipped) {
      expect(row.hit).toBe(true);
    }
  });

  it('🔴 the ANDed control retrieves STRICTLY FEWER — the two arms disagree', () => {
    // THE MEASUREMENT. Two arms that agreed would mean the OR change bought nothing, and a
    // fixture corpus can make a single arm say anything its author likes.
    expect(andRecall).toBeLessThan(orRecall);
  });

  it('the ANDed control misses the multi-word sentences specifically', () => {
    // Naming WHICH queries it loses is what ties this to FB-014's finding rather than to a
    // number that merely happens to be smaller.
    const andMissed = anded.filter((r) => !r.hit).map((r) => r.query);
    expect(andMissed).toContain('a website my client can edit themselves');
    expect(andMissed).toContain('how do I let people sign up and log in');
    // …and it keeps the ones that are already keywords, which is why it looked fine for so long.
    expect(andMissed).not.toContain('a game');
    expect(andMissed).not.toContain('personal landing page');
  });

  it('a one-word query still works — the OR did not cost precision at the top', () => {
    const rows = filterTemplates(ROSTER, { category: null, query: 'checkout' }).rows;
    expect(rows[0]?.url).toBe('community://storefront');
  });

  it('a strong multi-word match comes out on top', () => {
    const rows = filterTemplates(ROSTER, { category: null, query: 'personal landing page' }).rows;
    expect(rows[0]?.url).toBe('community://landing-page');
    // "page" alone matches several rows, so this is a real ordering, not a single-hit list.
    expect(rows.length).toBeGreaterThan(1);
  });

  it('🔴 answering EVERY term outranks answering one of them LOUDLY', () => {
    // ─────────────────────────────────────────────────────────────────────────
    // 🔴 THIS SPEC EXISTS BECAUSE THE ONE ABOVE DOES NOT GRADE WHAT ITS NAME CLAIMED. A mutant
    // that deleted the `matchedAll` clause from the sort SURVIVED it: for "personal landing
    // page" the intended row also wins on raw score, so the ordering was right for a reason the
    // assertion never touched. Same shape as T3's `indexOf` finding — a spec that passes for a
    // mechanism other than the one it is named after.
    //
    // This query is built so the two mechanisms DISAGREE. `site` is in Site Builder's TITLE
    // (weight 3) and is Personal Landing Page's CATEGORY (weight 2); `bio` is only in Personal
    // Landing Page's summary (weight 1). Both score 3 — so score alone cannot separate them, and
    // the tiebreak would take shelf order, which puts Site Builder first. Only `matchedAll` puts
    // the row that answered the whole query on top.
    const rows = filterTemplates(ROSTER, { category: null, query: 'site bio' }).rows;
    expect(rows.map((r) => r.url)).toEqual(['community://landing-page', 'community://site-builder']);

    const [full, partial] = rows.map((r) => scoreTemplate(r, queryTerms('site bio')));
    expect(full.score).toBe(partial.score); // the discriminator: score is a tie…
    expect(full.matchedAll).toBe(true); // …and this is the only thing that separates them
    expect(partial.matchedAll).toBe(false);
  });
});

// ── 5. The old-vocabulary control ────────────────────────────────────────────

describe('FB-005 T4 — the old-vocabulary control', () => {
  /**
   * 🔴 The vocabulary moved on 2026-08-26: `hello-world`'s category was the prose string
   * `'Getting Started'` and is now the slug `starter`. FB-014's control asks what a query in the
   * RETIRED vocabulary now does, because that is the question a rename makes unanswerable by
   * accident.
   */
  it('no row is reachable through the retired prose category any more', () => {
    for (const row of ROSTER) {
      expect(tokenize(row.category)).not.toContain('getting');
      expect(tokenize(categoryLabel(row.category))).not.toContain('getting');
    }
  });

  it('🔴 a `starter` row whose text never says "start" is NOT found by "getting started"', () => {
    // THE CONTROL. Under the old vocabulary this row's category literally read "Getting Started",
    // so this query returned it. It no longer does, and that is the measured consequence of the
    // ruling rather than an assumption about it.
    const rows = filterTemplates(ROSTER, { category: null, query: 'getting started' }).rows;
    expect(ROSTER.find((r) => r.url === 'community://pixel-game')?.category).toBe('starter');
    expect(rows.map((r) => r.url)).not.toContain('community://pixel-game');
  });

  it('…while a row that does say it is still found — the control is not measuring silence', () => {
    // 🔴 A control that returns nothing proves nothing. `hello-world`'s summary says "to start
    // from nothing", so the query still lands somewhere — through the DESCRIPTION, not the
    // category. Without this arm, the assertion above is satisfied by a search that is broken.
    const rows = filterTemplates(ROSTER, { category: null, query: 'getting started' }).rows;
    expect(rows.map((r) => r.url)).toContain('embedded://hello-world');
  });

  it('the label is what a person types: "data app" finds `data-app`', () => {
    // The slug and its label tokenise to the same words, which is what makes the ruled
    // machine vocabulary searchable by somebody who has never seen it.
    const rows = filterTemplates(ROSTER, { category: null, query: 'data app' }).rows;
    expect(rows.map((r) => r.url)).toContain('community://storefront');
    expect(rows.map((r) => r.url)).toContain('community://membership-hub');
  });
});

// ── 6. Tokenising, stopwords and the rescue ──────────────────────────────────

describe('FB-005 T4 — the terms a query is reduced to', () => {
  it('drops words that carry no signal', () => {
    expect(queryTerms('a dashboard for the team')).toEqual(['dashboard', 'team']);
  });

  it('🔴 puts them back rather than searching for nothing', () => {
    // The rescue: a box holding only stopwords would otherwise search for nothing while looking
    // like it had searched.
    expect(queryTerms('and or')).toEqual(['and', 'or']);
    expect(queryTerms('the')).toEqual(['the']);
  });

  it('🔴 …but the rescue is ALL-or-nothing, and this is where that bites', () => {
    // MEASURED, not assumed — the spec first asserted the wider claim and went red. One
    // non-stopword is enough to suppress the rescue, so `for each` searches for `each`. Harmless
    // over titles and summaries; NOT harmless over a node catalogue, where `For Each` is a
    // shipped node name. This is the assertion that turns red if this matcher is ever pointed
    // at one.
    expect(queryTerms('for each')).toEqual(['each']);
  });

  it('an empty box reduces to no terms at all', () => {
    // Which is what makes `filterTemplates` return the shelf rather than nothing.
    expect(queryTerms('   ')).toEqual([]);
    expect(filterTemplates(ROSTER, EMPTY_TEMPLATE_FILTER).rows).toHaveLength(ROSTER.length);
  });

  it('splits a slug into the words a person types', () => {
    expect(tokenize('data-app')).toEqual(['data', 'app']);
    expect(tokenize('Shared Pixel Canvas')).toEqual(['shared', 'pixel', 'canvas']);
  });

  it('matches a plural typed against a singular stored, and back', () => {
    const dashboard = ROSTER.find((r) => r.url === 'community://data-dashboard') as TemplateChoice;
    expect(scoreTemplate(dashboard, ['dashboards']).score).toBeGreaterThan(0);
    expect(scoreTemplate(dashboard, ['dashboard']).score).toBeGreaterThan(0);
    expect(scoreTemplate(dashboard, ['dash']).score).toBeGreaterThan(0);
  });

  it('🔴 a one-letter word in a summary does not match every query', () => {
    // The reverse-prefix floor. Without `>= 4` on the WORD, `anything`.startsWith('a') is true,
    // so any row containing the word "a" would answer almost any query.
    const single: TemplateChoice = { url: 'x://y', title: 'Z', description: 'a b c', category: 'form' };
    expect(scoreTemplate(single, ['anything']).score).toBe(0);
    expect(scoreTemplate(single, ['because']).score).toBe(0);
  });

  it('a term matching nothing scores zero — the instrument can say no', () => {
    const dashboard = ROSTER.find((r) => r.url === 'community://data-dashboard') as TemplateChoice;
    expect(scoreTemplate(dashboard, ['zebra']).score).toBe(0);
  });

  it('the title outweighs the description', () => {
    const dashboard = ROSTER.find((r) => r.url === 'community://data-dashboard') as TemplateChoice;
    // "dashboard" is in the title; "filtered" is only in the summary.
    expect(scoreTemplate(dashboard, ['dashboard']).score).toBeGreaterThan(
      scoreTemplate(dashboard, ['filtered']).score
    );
  });
});

describe('FB-005 T4 — isFilterActive tells a narrow list from a short shelf', () => {
  it('is false only when nothing is narrowed', () => {
    expect(isFilterActive(EMPTY_TEMPLATE_FILTER)).toBe(false);
    expect(isFilterActive({ category: null, query: '   ' })).toBe(false);
    expect(isFilterActive({ category: 'form', query: '' })).toBe(true);
    expect(isFilterActive({ category: null, query: 'x' })).toBe(true);
  });
});

// ── 7. The picker, rendered ──────────────────────────────────────────────────

/**
 * 🔴 **RENDERED, NOT GREPPED** — NAT-005's walker, for the reason its header gives: source
 * analysis cannot tell a component that draws nothing from one that was never called. Every
 * assertion below is about what a person sees.
 */
describe('FB-005 T4 — the filter bar, drawn', () => {
  it('draws a pill per category present, with its count in the text', () => {
    const tree = draw(ROSTER);
    const pills = byClass(tree, 'TemplateFilter-pill');
    // All + site + data-app + dashboard + starter + form
    expect(pills).toHaveLength(6);
    expect(text(tree)).toContain('All (10)');
    expect(text(tree)).toContain('Starter (4)');
    expect(text(tree)).toContain('Data app (2)');
  });

  it('🔴 draws the category LABEL on a card, not the slug', () => {
    // From the 2026-08-26 ruling until T4 this drew the literal string `data-app` at a person.
    const tree = draw([ROSTER[3]]);
    const tags = byClass(tree, 'TemplateCard-tag').map((n) => n.ownText);
    expect(tags).toContain('Data app');
    expect(tags).not.toContain('data-app');
  });

  it('the active pill says so in text as well as in colour', () => {
    // FB-002 shipped a selected pill at 1.16:1 against its panel. A state written in words
    // cannot be taken away by a contrast ratio.
    const tree = draw(ROSTER, { category: 'form', query: '' });
    const active = byClass(tree, 'TemplateFilter-pill--active');
    expect(active).toHaveLength(1);
    expect(active[0].ownText).toContain('✓');
    expect(active[0].props['aria-pressed']).toBe(true);
  });

  it('a category narrows the list it is drawn beside', () => {
    const tree = draw(ROSTER, { category: 'form', query: '' });
    expect(byClass(tree, 'TemplateCard')).toHaveLength(1);
    expect(text(tree)).toContain('Contact Form');
    expect(text(tree)).not.toContain('Storefront');
  });

  it('a search narrows it too', () => {
    const tree = draw(ROSTER, { category: null, query: 'a game' });
    expect(byClass(tree, 'TemplateCard')).toHaveLength(1);
    expect(text(tree)).toContain('Pixel Game');
  });

  it('🔴 "nothing matches" is NOT the empty-shelf sentence', () => {
    // Opposite facts with opposite fixes: one is ours, the other is one button away. A filtered
    // list rendering the empty-shelf sentence tells somebody their shelf is broken.
    const filtered = draw(ROSTER, { category: null, query: 'zebra' });
    expect(text(filtered)).toContain('No templates match');
    expect(text(filtered)).toContain('Clear filters');
    expect(text(filtered)).not.toContain('no templates to start from');

    const empty = draw([]);
    expect(text(empty)).toContain('no templates to start from');
    expect(text(empty)).not.toContain('No templates match');
  });

  it('an empty shelf draws no filter bar to narrow it with', () => {
    const tree = draw([]);
    expect(byClass(tree, 'TemplateFilter-pill')).toHaveLength(0);
    expect(byClass(tree, 'TemplateFilter-search')).toHaveLength(0);
  });

  it('🔴 says so when the chosen template is filtered out from under the choice', () => {
    // The wizard still holds it — Review names it and Create installs it — so the one thing this
    // screen must not do is go quiet about a selection that is still in force.
    const tree = draw(ROSTER, { category: 'form', query: '' }, 'community://storefront');
    expect(text(tree)).toContain('The template you chose is not in this list');
    expect(text(tree)).toContain('It is still selected');
  });

  it('…and says nothing when the chosen template is on screen', () => {
    // The control. Without it, the assertion above passes on a notice that is always drawn.
    const tree = draw(ROSTER, { category: 'data-app', query: '' }, 'community://storefront');
    expect(text(tree)).not.toContain('The template you chose is not in this list');
  });

  it('…and nothing when the selection is a URL the shelf does not hold', () => {
    // A shorter shelf (a community outage) is not the same as a filtered one, and telling
    // somebody their choice is "not in this list" when the whole provider is down is a sentence
    // about the wrong thing — the `partial` notice already covers that case.
    const tree = draw(ROSTER, EMPTY_TEMPLATE_FILTER, 'community://vanished');
    expect(text(tree)).not.toContain('The template you chose is not in this list');
  });

  it('🔴 renders exactly as T3 did when the host passes no filter at all', () => {
    // Back-compatibility, and it is not hypothetical: phase 76's SB-007 names `TemplateStepBody`
    // as a piece to reuse on the launcher's Templates tab. A required prop added here would have
    // broken that call site before it was written.
    const tree = render(
      TemplateStepBody({
        gallery: { items: ROSTER, isLoading: false },
        selectedUrl: '',
        onSelect: () => undefined
      })
    );
    expect(byClass(tree, 'TemplateCard')).toHaveLength(ROSTER.length);
    expect(byClass(tree, 'TemplateFilter-pill')).toHaveLength(0);
    expect(byClass(tree, 'TemplateFilter-search')).toHaveLength(0);
  });
});
