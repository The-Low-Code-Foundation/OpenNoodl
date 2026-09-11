/**
 * FB-005 T4 — narrowing the template shelf: categories, and a search box that answers a sentence.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * ## 🔴 ONE PRODUCER. A facet's count IS the rows behind it.
 *
 * `facets.ts` in `nodegx-community` states the rule this file is built to keep: *"a facet count
 * comes from a `group by` and the list comes from a `where`; two producers of one number is
 * exactly where they drift, and nothing in a 'does it render?' test can see it."* So
 * `filterTemplates` returns the rows **and** the pills from one call: each pill's `count` is
 * `matches()` re-run over the filter that pill's own click would produce — the text query held,
 * the category dimension swapped. A count that lied would now require this function to disagree
 * with itself inside one pass.
 *
 * ⚠️ Everything here is in memory, over a list the picker has already fetched whole. That is
 * `facets.ts`'s choice and it carries `facets.ts`'s limit: the shelf is curated and small by
 * construction (R-templates, 2026-08-22), and the day it is thousands of rows this becomes a
 * `where` and a `group by` on the platform instead. Stated so that day is a decision rather than
 * a discovery.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * ## 🔴 TERMS ARE ORed AND THE RANKING SUPPLIES THE PRECISION
 *
 * This is FB-014's finding, re-applied on the client. `websearch_to_tsquery('english', 'a
 * dashboard that shows records from a database')` is seven lexemes joined by `&` — seven words
 * that must ALL appear in one document — and FB-014 measured that at 2 documents out of 22 *even
 * when the query used the corpus's own vocabulary*. `bench.ts:searchThreads` fixed it by ORing
 * the terms and letting `ts_rank_cd` decide the order, with exact (all-terms) matches first.
 *
 * A template shelf makes that worse, not better, because the documents are *tiny*: a title and a
 * one-sentence summary. ANDing five words against a 12-word summary matches nothing, ever. So:
 * a row is a hit if it matches **one** content term, and the ordering is
 * `all-terms-matched → weighted score → the shelf's own order`.
 *
 * ⚠️ **Not matching on `origin`.** It is a provenance badge (`Built in`, `Community`), not
 * content — typing "community" would return every platform row regardless of what it is for.
 * Provenance is a facet's job if it ever needs one, and giving it to the text box quietly makes
 * the search mean two different things.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * ## ⚠️ THE CATEGORY IS A MACHINE SLUG AND A PERSON DOES NOT TYPE ONE
 *
 * The vocabulary was ruled on 2026-08-26 — `starter`, `data-app`, `dashboard`, `site`, `form`,
 * `integration` — canonical from `0020`'s CHECK constraint, including for templates compiled
 * into the editor. That is right for storage and wrong for a card: `hello-world`'s card drew the
 * literal string `starter` from the moment the ruling landed, and nobody searching a shelf types
 * `data-app`. So this module carries the display labels, and searches BOTH — the slug is
 * tokenised (`data-app` → `data`, `app`), so "data app" and "Data app" both find it.
 *
 * 🔴 **THAT MAKES THIS A THIRD COPY OF THE VOCABULARY** (the DDL, `TEMPLATE_CATEGORIES` in
 * `projecttemplates.ts`, `EMBEDDED_TEMPLATE_CATEGORIES` in the spec, and now this). A copy of a
 * list drifts, so this one is not trusted to be right — `template-search.test.ts` asserts its
 * key set **equals** the vocabulary, both directions, which is the cardinality assertion the two
 * producers meeting here call for. A category added on the platform and not here reddens it.
 *
 * ⚠️ **An unknown category is still drawn and still gets a pill.** A platform row whose category
 * this editor has never heard of falls through to its raw slug, exactly as `ORIGIN_LABELS` does
 * for an unlabelled provider — because the alternative is a template that has no pill, and is
 * therefore reachable only by not filtering at all.
 *
 * @module noodl-core-ui/preview/launcher/Launcher/components/ProjectCreationWizard
 */
import type { TemplateChoice } from './TemplateStep';

// ───────────────────────────────────────────────────────────────────────────────
// The query
// ───────────────────────────────────────────────────────────────────────────────

/**
 * What the picker is currently narrowed to.
 *
 * ⚠️ `category: null` is "every category", and it is null rather than `''` so that the empty
 * string cannot be both a category name and the absence of one. `query` is the raw text the
 * person typed, untrimmed — trimming is this module's job, not the input's, so that what is in
 * the box and what is in the filter are the same string.
 */
export interface TemplateFilter {
  category: string | null;
  query: string;
}

export const EMPTY_TEMPLATE_FILTER: TemplateFilter = { category: null, query: '' };

/** Whether anything is narrowed at all. Used to tell "no rows on the shelf" from "no rows here". */
export function isFilterActive(filter: TemplateFilter): boolean {
  return filter.category !== null || filter.query.trim().length > 0;
}

/** One pill. `value: null` is the "All" pill. */
export interface TemplateFacet {
  value: string | null;
  label: string;
  count: number;
  active: boolean;
}

// ───────────────────────────────────────────────────────────────────────────────
// The vocabulary, as a person reads it
// ───────────────────────────────────────────────────────────────────────────────

/**
 * The ruled vocabulary, in the order the pills are drawn.
 *
 * 🔴 Order is deliberate and it is not alphabetical: `starter` first because it is where somebody
 * with no idea what they want should land, then the shapes of app in roughly descending
 * likelihood. Alphabetical would put `dashboard` first and `starter` fifth.
 */
export const TEMPLATE_CATEGORY_LABELS: Record<string, string> = {
  starter: 'Starter',
  'data-app': 'Data app',
  dashboard: 'Dashboard',
  site: 'Site',
  form: 'Form',
  integration: 'Integration'
};

/**
 * What to draw for a category slug.
 *
 * ⚠️ Falls through to the slug for anything unknown — `ORIGIN_LABELS`' rule, stated there: *"a
 * badge naming a provider we have not labelled is a bug somebody can see, and a missing badge is
 * one nobody can."* The same holds for a category the platform has added and this editor has not
 * yet been taught.
 */
export function categoryLabel(slug: string): string {
  return TEMPLATE_CATEGORY_LABELS[slug] ?? slug;
}

// ───────────────────────────────────────────────────────────────────────────────
// Matching
// ───────────────────────────────────────────────────────────────────────────────

/**
 * Words that carry no signal on a shelf of six templates.
 *
 * 🔴 **THEY ARE DROPPED FROM MATCHING, NOT FROM THE QUERY** — and if dropping them would leave
 * nothing at all, every term is put back. Without that rescue a box containing only `and` would
 * silently search for nothing while looking like it had searched.
 *
 * ⚠️ **THE RESCUE IS ALL-OR-NOTHING, AND THAT LIMIT IS WORTH STATING BECAUSE THE OBVIOUS READING
 * IS WRONG.** It fires only when EVERY term is a stopword. `for each` keeps `each` and drops
 * `for`, so a shelf search for the node named *For Each* is really a search for *each*. That is
 * harmless over titles and summaries and it would NOT be harmless over a node catalogue, where
 * `For Each`, `And` and `Or` are shipped node names — so if this matcher is ever pointed at one,
 * this is the line that has to change first. (Measured: the spec asserting the wider claim went
 * red, which is how this paragraph came to say the narrower one.)
 *
 * ⚠️ Kept short on purpose. Every word here is one a person cannot search for while any other
 * word is in the box, so the list earns its place by being words that appear in almost every
 * summary rather than by being "common English".
 */
const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'how', 'i', 'in', 'is', 'it',
  'me', 'my', 'of', 'on', 'or', 'that', 'the', 'their', 'them', 'this', 'to', 'want', 'with',
  'you', 'your'
]);

/**
 * Split text into comparable words.
 *
 * ⚠️ Splits on anything that is not a letter or a digit, which is what makes `data-app` into
 * `data` and `app` — so the slug and the label a person would type tokenise to the same words.
 * `.toLowerCase()` before splitting rather than after, so the two are one pass.
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 0);
}

/**
 * Whether a query term matches a word in a document.
 *
 * ⚠️ **Prefix in BOTH directions, and that is the client-side stand-in for a stemmer.** Postgres
 * would stem `dashboard` and `dashboards` to one lexeme; here `word.startsWith(term)` catches the
 * singular typed against the plural stored, and `term.startsWith(word)` catches the plural typed
 * against the singular.
 *
 * ⚠️ The two floors are different because the two directions fail differently. Forward needs
 * `term.length >= 3`, so a two-letter fragment cannot match half the shelf — and `for` matching
 * `form` is on purpose, because somebody typing `for` on a template shelf wants the form.
 * **Reverse needs BOTH sides `>= 4`**, and that is the load-bearing one: without a floor on the
 * *word*, every term beginning with `a` would match the word `a`, so any document containing a
 * one-letter word would match almost any query.
 */
function termMatchesWord(term: string, word: string): boolean {
  if (term === word) return true;
  if (term.length >= 3 && word.startsWith(term)) return true;
  if (term.length >= 4 && word.length >= 4 && term.startsWith(word)) return true;
  return false;
}

/**
 * The searchable words of one row, by weight.
 *
 * 🔴 The category appears here **twice over** — as its slug's words and as its label's — because
 * `data-app` and `Data app` are the same fact and only one of them is stored. `Array.from(new
 * Set(...))` because "data" appearing in both would otherwise score twice for one match.
 */
function documentFields(item: TemplateChoice): { words: string[]; weight: number }[] {
  return [
    { words: tokenize(item.title), weight: 3 },
    { words: Array.from(new Set([...tokenize(item.category), ...tokenize(categoryLabel(item.category))])), weight: 2 },
    { words: tokenize(item.description), weight: 1 }
  ];
}

/**
 * The terms a query actually searches on.
 *
 * Exported so the spec can state what a sentence was reduced to, rather than inferring it from
 * what matched — a recall figure whose query nobody can see is a figure nobody can check.
 */
export function queryTerms(query: string): string[] {
  const all = tokenize(query);
  const content = all.filter((word) => !STOPWORDS.has(word));
  // 🔴 The rescue. See `STOPWORDS`.
  return content.length > 0 ? content : all;
}

/**
 * How well one row answers one query. `0` is "not a hit".
 *
 * The score is the weighted count of terms that matched somewhere, and `matchedAll` is
 * `searchThreads`' `m.exact` — the rows that answered the whole sentence sort above the rows
 * that answered one word of it, whatever their weights say.
 */
export function scoreTemplate(item: TemplateChoice, terms: string[]): { score: number; matchedAll: boolean } {
  if (terms.length === 0) return { score: 0, matchedAll: false };

  const fields = documentFields(item);
  let score = 0;
  let matchedTerms = 0;

  for (const term of terms) {
    let best = 0;
    for (const field of fields) {
      if (field.weight > best && field.words.some((word) => termMatchesWord(term, word))) {
        best = field.weight;
      }
    }
    if (best > 0) {
      score += best;
      matchedTerms += 1;
    }
  }

  return { score, matchedAll: matchedTerms === terms.length };
}

// ───────────────────────────────────────────────────────────────────────────────
// The one producer
// ───────────────────────────────────────────────────────────────────────────────

export interface TemplateFilterResult {
  /** The rows to draw, best match first when there is a query and shelf order when there is not. */
  rows: TemplateChoice[];
  /** The pills, "All" first. A category with no rows behind it gets no pill. */
  categories: TemplateFacet[];
  /** The terms the query was reduced to. Empty when the box is empty. */
  terms: string[];
}

/**
 * Narrow the shelf, and count the pills from the same pass.
 *
 * 🔴 **A pill's count is what clicking it would give you** — this text query, that category —
 * which is why the counting loop re-runs `matches` rather than tallying the rows it just
 * produced. Tallying the produced rows would make every pill's count either the whole shelf (when
 * no category is chosen) or zero (when one is), and it would look right on the screen where it is
 * usually tested: the one with no filter applied.
 *
 * ⚠️ **Pills come from the rows present, not from the vocabulary.** A pill promising zero is a
 * dead click, and a category this editor does not know still needs one — see the module header.
 */
export function filterTemplates(
  items: readonly TemplateChoice[],
  filter: TemplateFilter
): TemplateFilterResult {
  const terms = queryTerms(filter.query);

  const matches = (item: TemplateChoice, category: string | null): boolean => {
    if (category !== null && item.category !== category) return false;
    if (terms.length === 0) return true;
    return scoreTemplate(item, terms).score > 0;
  };

  const rows = items.filter((item) => matches(item, filter.category));

  // Ranking only when there is something to rank by. With an empty box the shelf's own order is
  // the answer — `EmbeddedTemplateProvider` is registered first so that the row which draws with
  // no network is the first card, and a sort would silently take that away.
  const ranked =
    terms.length === 0
      ? rows
      : rows
          .map((item, index) => ({ item, index, ...scoreTemplate(item, terms) }))
          .sort((a, b) => {
            if (a.matchedAll !== b.matchedAll) return a.matchedAll ? -1 : 1;
            if (a.score !== b.score) return b.score - a.score;
            return a.index - b.index;
          })
          .map((entry) => entry.item);

  // The categories present, in vocabulary order, with anything unknown after them alphabetically.
  const present = Array.from(new Set(items.map((item) => item.category).filter((c) => c.length > 0)));
  const known = Object.keys(TEMPLATE_CATEGORY_LABELS);
  present.sort((a, b) => {
    const ai = known.indexOf(a);
    const bi = known.indexOf(b);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.localeCompare(b);
  });

  const categories: TemplateFacet[] = [
    {
      value: null,
      label: 'All',
      count: items.filter((item) => matches(item, null)).length,
      active: filter.category === null
    },
    ...present
      .map((category) => ({
        value: category,
        label: categoryLabel(category),
        count: items.filter((item) => matches(item, category)).length,
        active: filter.category === category
      }))
      // ⚠️ The ACTIVE pill survives a zero count. Dropping it would remove the control that is
      // the only way back out of the state the person is looking at.
      .filter((facet) => facet.count > 0 || facet.active)
  ];

  return { rows: ranked, categories, terms };
}
