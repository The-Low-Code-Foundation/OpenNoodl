/**
 * LBR-008 — "the shelf": cheap discovery of the installable library entries.
 *
 * ✅ **P69 ruling D7 rescoped this task**: CN-003 owns "this project" (the exact
 * overlay of what is installed), and LBR-008 owns discovery of what *could* be
 * installed — the ~60 entries under `library/{prefabs,modules}/` — plus
 * `install_prefab`. The two must not be confused: nothing here touches the
 * catalog, the overlay, or validation. The shelf is an index, and it is read
 * lazily from disk on each call — no cache of any kind, for D3's reason (a
 * stale cache reads exactly like a correct answer). ~60 small JSON files per
 * call is cheap.
 *
 * ## Where the library lives
 *
 * In a checkout, `library/` at the repo root — found by walking up from this
 * module, which works from `src/` under ts-jest and from `dist/noodl-mcp.cjs`
 * alike. `NODEGX_LIBRARY_DIR` overrides it (the suite's door, and the packaged
 * app's until packaging decides where library content ships — a packaged
 * editor has no `library/` on disk; its entries come from the docs-site CDN as
 * versioned zips, which is a *different transport for the same index* and is
 * recorded as LBR-008's follow-up rather than half-built here).
 *
 * @module noodl-mcp/libraryShelf
 */

import * as fs from 'fs';
import * as path from 'path';

export type LibraryEntryType = 'prefab' | 'module';

/** `library.json`, as `scripts/library/schema.json` describes it. */
export interface LibraryJson {
  label: string;
  description: string;
  type: LibraryEntryType;
  tags: string[];
  version: string;
  icon?: string;
  docsPath?: string;
  minEditorVersion?: string;
  runtimeVersion?: string;
  provenance?: { sourceUrl?: string; importedAt?: string };
}

/** One row of the shelf index — deliberately the cheap fields only. */
export interface ShelfRow {
  slug: string;
  type: LibraryEntryType;
  label: string;
  /** First line of the entry's description, capped — the index must cost like an index. */
  description: string;
  tags: string[];
  version: string;
  /** CMP-004 AC2 — present only on a `query` call, saying why this row is in the answer. */
  matchedTerms?: string[];
  /** CMP-004 AC2 — the fields those terms hit, best first. */
  matchedIn?: ShelfField[];
}

/** An entry directory that exists but could not be read as an entry. */
export interface ShelfProblem {
  slug: string;
  type: LibraryEntryType;
  problem: string;
}

export type ResolveResult = { ok: true; root: string } | { ok: false; reason: string };

const TYPE_DIRS: ReadonlyArray<{ dir: string; type: LibraryEntryType }> = [
  { dir: 'prefabs', type: 'prefab' },
  { dir: 'modules', type: 'module' }
];

/**
 * Find the library source root. Env override first, then walk up from this
 * file — `__dirname` is `src/` under ts-jest and `dist/` in the bundle, and
 * both sit under `packages/noodl-mcp`, so the repo root is a short walk.
 */
export function resolveLibraryRoot(): ResolveResult {
  const env = process.env.NODEGX_LIBRARY_DIR;
  if (env) {
    if (looksLikeLibraryRoot(env)) return { ok: true, root: env };
    return {
      ok: false,
      reason: `NODEGX_LIBRARY_DIR points at "${env}", which has no prefabs/ or modules/ directory.`
    };
  }
  let dir = __dirname;
  for (let i = 0; i < 10; i++) {
    const candidate = path.join(dir, 'library');
    if (looksLikeLibraryRoot(candidate)) return { ok: true, root: candidate };
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return {
    ok: false,
    reason:
      'No library/ directory found walking up from the server. This server reads library content from a ' +
      'checkout (library/ at the repo root); set NODEGX_LIBRARY_DIR to point at one.'
  };
}

function looksLikeLibraryRoot(dir: string): boolean {
  return TYPE_DIRS.some((t) => {
    try {
      return fs.statSync(path.join(dir, t.dir)).isDirectory();
    } catch {
      return false;
    }
  });
}

/** One line, capped, for the index. The full text is `get_library_entry`'s job. */
function oneLine(description: string): string {
  const line = description.split('\n')[0].trim();
  return line.length > 160 ? `${line.slice(0, 157)}...` : line;
}

export function readLibraryJson(entryDir: string): LibraryJson {
  const raw = fs.readFileSync(path.join(entryDir, 'library.json'), 'utf8');
  const parsed = JSON.parse(raw) as LibraryJson;
  if (!parsed || typeof parsed.label !== 'string' || (parsed.type !== 'prefab' && parsed.type !== 'module')) {
    throw new Error('library.json is missing label/type');
  }
  return parsed;
}

/**
 * The shelf index. Reads every entry's `library.json`, nothing else — no
 * project loads, no zips, no validation. A malformed entry (a peer mid-edit, a
 * half-written directory) is reported in `problems` rather than either failing
 * the whole list or silently vanishing from it.
 */
/**
 * CMP-004 AC2 — the free-text query.
 *
 * ## Why tags were not enough, measured over the 72 entries on the shelf
 *
 * 🔴 The one entry that formats things is tagged **`Utilities`**. The other eight utilities are
 * tagged **`Utility`**. So `list_library({tag: "Utility"})` — the obvious query, and the only
 * kind the shelf could answer before this — returns eight rows and **excludes the only formatting
 * entry there is**. The rest of the vocabulary is no better: 22 distinct tags over 72 entries, of
 * which `UI` covers **50**, and `Localization`, `Pages`, `Payments`, `Service`, `Animation`,
 * `Custom nodes` and `Utilities` cover **one each**. A vocabulary where the commonest tag holds
 * 69% of the shelf and seven tags hold one entry apiece is not an index, and no amount of asking
 * the right tag fixes a tag that was typed twice two ways.
 *
 * ⚠️ **This is deliberately NOT `find_tools`' matcher**, which is a substring test over a tool
 * group's id, title and keywords and pointedly refuses to search the group's prose. That refusal
 * is right there and wrong here: a tool group's purpose is a sentence whose incidental nouns
 * duplicate the tool names, whereas a library entry's description is *the only place what the
 * part does is written down*. `intl-format`'s node names — Relative Time, Format Number, Format
 * List, Pluralize — exist nowhere in its metadata except that sentence.
 *
 * ## The matcher
 *
 * Word-prefix, both directions, four characters in: a query term matches a haystack word when
 * either starts with the other. That is what makes *"date formatter"* find a part whose label
 * says *"Format"* — a plain substring test does not, because `"format".includes("formatter")` is
 * false, and that failure is silent and looks exactly like an empty shelf.
 *
 * Terms are ORed, not ANDed, and the row carries which terms hit and where. An AND is better
 * precision and a worse failure: *"format a date as Thursday"* has a term no entry can match, and
 * ANDing it answers "nothing on the shelf" — the one answer that makes an agent build from
 * scratch. Ranking carries the precision instead.
 */
const QUERY_STOPWORDS = new Set([
  'a', 'an', 'and', 'any', 'are', 'as', 'be', 'can', 'do', 'does', 'for', 'from', 'get', 'has',
  'have', 'how', 'i', 'in', 'is', 'it', 'its', 'me', 'my', 'need', 'of', 'on', 'or', 'that', 'the',
  'their', 'there', 'they', 'this', 'to', 'use', 'want', 'was', 'what', 'which', 'with', 'you'
]);

/** Lowercase alphanumeric words, which is all either side of the match needs to be. */
function words(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/i).filter((w) => w.length > 0);
}

export function queryTerms(query: string): string[] {
  const seen = new Set<string>();
  for (const w of words(query)) {
    if (w.length < 2 || QUERY_STOPWORDS.has(w)) continue;
    seen.add(w);
  }
  return [...seen];
}

/**
 * The shorter of the two a prefix of the longer, four characters in, with at most four characters
 * of tail — `format` ↔ `formatter`, `date` ↔ `dates`, `list` ↔ `listing`.
 *
 * 🔴 **The tail bound is not decoration, it was measured.** Without it, the tag **`Form`** matched
 * the term **`formatter`**, and since a tag scores higher than a description, `date-picker` came
 * back as the best answer to *"is there a date formatter?"* — outranking the entry that actually
 * formats dates, whose own match is in its label. A prefix rule with no bound on the remainder
 * turns every four-letter word into a wildcard, and the failure is a plausible-looking wrong
 * answer rather than an empty one.
 */
const MAX_PREFIX_TAIL = 4;

function wordMatches(term: string, word: string): boolean {
  if (term === word) return true;
  const [shorter, longer] = term.length <= word.length ? [term, word] : [word, term];
  if (shorter.length < 4) return false;
  if (longer.length - shorter.length > MAX_PREFIX_TAIL) return false;
  return longer.startsWith(shorter);
}

/** Which searchable field a term was found in. Ordered by how much a hit there means. */
export type ShelfField = 'label' | 'slug' | 'tag' | 'component' | 'description';

const FIELD_WEIGHT: Record<ShelfField, number> = {
  label: 4,
  slug: 4,
  tag: 3,
  component: 3,
  description: 1
};

export interface ShelfSearchable {
  label: string;
  slug: string;
  tags: string[];
  /** The FULL description, not the one-line index cap — the cap is for display, not for search. */
  description: string;
  /** Component names an entry ships, when it ships components. */
  components: string[];
}

export interface ShelfMatch {
  score: number;
  /** The query terms that hit, in query order — a row can say why it is in the answer. */
  matchedTerms: string[];
  /** The fields they hit, best first. */
  matchedIn: ShelfField[];
}

/** `undefined` when nothing matched, which is the caller's signal to drop the row. */
export function scoreEntry(terms: string[], searchable: ShelfSearchable): ShelfMatch | undefined {
  const fields: Array<{ field: ShelfField; words: string[] }> = [
    { field: 'label', words: words(searchable.label) },
    { field: 'slug', words: words(searchable.slug) },
    { field: 'tag', words: searchable.tags.flatMap(words) },
    { field: 'component', words: searchable.components.flatMap(words) },
    { field: 'description', words: words(searchable.description) }
  ];

  let score = 0;
  const matchedTerms: string[] = [];
  const matchedIn = new Set<ShelfField>();
  for (const term of terms) {
    let best = 0;
    for (const { field, words: haystack } of fields) {
      if (!haystack.some((w) => wordMatches(term, w))) continue;
      matchedIn.add(field);
      best = Math.max(best, FIELD_WEIGHT[field]);
    }
    if (best === 0) continue;
    matchedTerms.push(term);
    score += best;
  }
  if (matchedTerms.length === 0) return undefined;
  const ordered = (['label', 'slug', 'tag', 'component', 'description'] as ShelfField[]).filter((f) =>
    matchedIn.has(f)
  );
  return { score, matchedTerms, matchedIn: ordered };
}

export function listShelf(
  root: string,
  filter: { type?: LibraryEntryType; tag?: string; query?: string } = {}
): { rows: ShelfRow[]; problems: ShelfProblem[]; considered: number } {
  const rows: ShelfRow[] = [];
  /** Entries that passed `type`/`tag` and were then offered to the query — the search's denominator. */
  let considered = 0;
  /**
   * CMP-004 AC2. Component names cost a `project.json` parse per entry — 3 MB and ~25 ms over the
   * whole shelf, measured — so they are read on a `query` call and on no other. An entry is
   * described by its own prose and by what it ships; leaving the second out would mean a query for
   * `Sanitise email` could not find the part called exactly that.
   */
  const terms = filter.query ? queryTerms(filter.query) : [];
  const searching = terms.length > 0;
  const scored: Array<{ row: ShelfRow; match: ShelfMatch }> = [];
  const problems: ShelfProblem[] = [];
  for (const { dir, type } of TYPE_DIRS) {
    if (filter.type && filter.type !== type) continue;
    const base = path.join(root, dir);
    let slugs: string[] = [];
    try {
      slugs = fs
        .readdirSync(base, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);
    } catch {
      continue; // a root may legitimately hold only one of the two dirs
    }
    for (const slug of slugs.sort()) {
      const entryDir = path.join(base, slug);
      if (!fs.existsSync(path.join(entryDir, 'library.json'))) continue; // not an entry (scratch dir, etc.)
      try {
        const meta = readLibraryJson(entryDir);
        const row: ShelfRow = {
          slug,
          type,
          label: meta.label,
          description: oneLine(meta.description ?? ''),
          tags: Array.isArray(meta.tags) ? meta.tags : [],
          version: meta.version ?? '0.0.0'
        };
        if (filter.tag && !row.tags.some((t) => t.toLowerCase() === filter.tag!.toLowerCase())) continue;
        considered += 1;
        if (!searching) {
          rows.push(row);
          continue;
        }
        const match = scoreEntry(terms, {
          label: row.label,
          slug,
          tags: row.tags,
          // 🔴 The FULL description, not `row.description` — that one is capped at 160 characters
          // for display, and searching it would make an entry findable by its first sentence only.
          description: meta.description ?? '',
          components: entryComponentNames(entryDir)
        });
        if (match) scored.push({ row: { ...row, matchedTerms: match.matchedTerms, matchedIn: match.matchedIn }, match });
      } catch (err) {
        problems.push({ slug, type, problem: (err as Error).message });
      }
    }
  }
  if (searching) {
    // Best first, then by how many terms hit, then alphabetically so the answer is stable.
    scored.sort(
      (a, b) =>
        b.match.score - a.match.score ||
        b.match.matchedTerms.length - a.match.matchedTerms.length ||
        a.row.slug.localeCompare(b.row.slug)
    );
    return { rows: scored.map((s) => s.row), problems, considered };
  }
  return { rows, problems, considered };
}

/**
 * The component names an entry ships. Every entry on the shelf today is a legacy monolithic
 * project, so this is `project.json`'s own `components` array — the same read
 * `get_library_entry` does, kept here so the search does not need the tools module.
 *
 * An unreadable or absent file is an entry with no components (every `module` entry), not an
 * error: a module is found by its description, which is where its node names are written.
 */
export function entryComponentNames(entryDir: string): string[] {
  try {
    const raw = fs.readFileSync(path.join(entryDir, 'project', 'project.json'), 'utf8');
    const parsed = JSON.parse(raw) as { components?: Array<{ name?: string }> };
    return (parsed.components ?? []).map((c) => c.name).filter((n): n is string => typeof n === 'string');
  } catch {
    return [];
  }
}

export interface ResolvedEntry {
  slug: string;
  type: LibraryEntryType;
  entryDir: string;
  meta: LibraryJson;
}

/**
 * Resolve one entry by slug. A slug is unique within prefabs and within
 * modules but nothing guarantees it across the two, so an ambiguous slug with
 * no `type` is an error naming both — never a silent pick.
 */
export function resolveEntry(
  root: string,
  slug: string,
  type?: LibraryEntryType
): { ok: true; entry: ResolvedEntry } | { ok: false; reason: string } {
  const hits: ResolvedEntry[] = [];
  for (const t of TYPE_DIRS) {
    if (type && type !== t.type) continue;
    const entryDir = path.join(root, t.dir, slug);
    if (!fs.existsSync(path.join(entryDir, 'library.json'))) continue;
    try {
      hits.push({ slug, type: t.type, entryDir, meta: readLibraryJson(entryDir) });
    } catch (err) {
      return { ok: false, reason: `Entry "${slug}" exists but its library.json could not be read: ${(err as Error).message}` };
    }
  }
  if (hits.length === 0) {
    return { ok: false, reason: `No library entry "${slug}"${type ? ` of type "${type}"` : ''}. Call list_library for the index.` };
  }
  if (hits.length > 1) {
    return { ok: false, reason: `"${slug}" exists as both a prefab and a module — pass type to say which.` };
  }
  return { ok: true, entry: hits[0] };
}

/** The names of the code modules an entry ships (its `project/noodl_modules/*` directories). */
export function entryModuleDirs(entry: ResolvedEntry): string[] {
  const dir = path.join(entry.entryDir, 'project', 'noodl_modules');
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
  } catch {
    return [];
  }
}
