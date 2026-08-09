/**
 * AIX-009 — Project context documents: the pure half.
 *
 * Paths, caps, and the text transforms that turn a doc on disk into a prompt
 * block. Deliberately free of `filesystem`, `ProjectModel` and Electron so the
 * authoring loop's context builder can import it in the headless measurement
 * bundle — the same rule the AIX-006 `StyleVocabulary` submodule follows.
 *
 * The format has no manifest: git owns `docs/`, and a text editor is a
 * first-class way to work on it. BLD-007 kept both of those and removed the
 * third property they used to come with — that exactly four paths were known to
 * the system, and anything else under `docs/` was carried, editable and **never
 * injected**. A doc the user wrote could be created, listed and rendered, and
 * was then silently ignored forever.
 *
 * The manifest stays absent. Instead **a doc declares its own injection, in its
 * own front matter**, so the declaration travels with the file through git,
 * through a text editor, and through a copy into another project:
 *
 * ```markdown
 * ---
 * title:  UK VAT rules
 * inject: pull            # pull (default) | always
 * when:   tax, VAT, pricing, invoices
 * ---
 * ```
 *
 * `KNOWN_DOCS` is now a **seed set, not a vocabulary**: BRIEF, ARCHITECTURE and
 * CONVENTIONS are three ordinary documents that happen to ship with templates
 * and to have historical defaults for their paths. Nothing in this module gates
 * injection on membership of it.
 *
 * ⚠️ Front matter is opt-in and absence is not a decision: a doc without it
 * takes the default for its path, and its bytes are passed through untouched.
 * That is what keeps a project that never writes front matter byte-identical to
 * before this task landed — the AIX-007 cache-stable prefix is the property
 * being protected, and it is worth more than the tidiness of rewriting files.
 *
 * @module ProjectDocs/docsText
 */

/** Folder name at the project root. Never inside `.noodl*` — humans read these. */
export const DOCS_DIR = 'docs';

export const DOC_BRIEF = 'docs/BRIEF.md';
export const DOC_ARCHITECTURE = 'docs/ARCHITECTURE.md';
export const DOC_CONVENTIONS = 'docs/CONVENTIONS.md';
export const DOC_DECISIONS_DIR = 'docs/decisions';

export type KnownDocKind = 'brief' | 'architecture' | 'conventions';

/**
 * How a doc reaches the model.
 *
 * `always` — appended to the always-block, on every turn of every session. The
 * user is opting into a real per-turn cost, so any surface offering the choice
 * must state it rather than presenting two equal-looking radio buttons.
 *
 * `pull` — listed in `get_project_doc` with its title and hints, fetched on the
 * turn it becomes relevant. The always-block is untouched, so the cached prefix
 * is untouched. This is the default, and it is the default because it is the
 * one that cannot make an unrelated project slower.
 */
export type DocInjection = 'always' | 'pull';

export interface KnownDoc {
  kind: KnownDocKind;
  /** Project-relative, forward-slashed. */
  path: string;
  title: string;
  audience: string;
  purpose: string;
  /**
   * The historical default for this path, used when the file declares nothing.
   * A seed doc that *does* declare front matter overrides it like any other —
   * this is a default, not a rule.
   */
  injection: DocInjection;
}

export const KNOWN_DOCS: readonly KnownDoc[] = [
  {
    kind: 'conventions',
    path: DOC_CONVENTIONS,
    title: 'Conventions',
    audience: 'AI first',
    purpose: 'The rules the assistant must follow in this project.',
    injection: 'always'
  },
  {
    kind: 'brief',
    path: DOC_BRIEF,
    title: 'Brief',
    audience: 'human + AI',
    purpose: 'What this app is, who uses it, what is deliberately out of scope.',
    injection: 'always'
  },
  {
    kind: 'architecture',
    path: DOC_ARCHITECTURE,
    title: 'Architecture',
    audience: 'human + AI',
    purpose: 'Page map, data model, backend contracts — and the reasons behind them.',
    injection: 'pull'
  }
];

/**
 * Per-source hard caps, in characters. Prose must never be able to squeeze out
 * component reads, so each source is capped *before* it reaches the shared
 * budget rather than relying on the budget to notice.
 *
 * `architecture` is the largest and is pull-only, so its cap is looser — a turn
 * that asks for it has decided the cost is worth paying.
 */
export const DOC_CAPS: Record<KnownDocKind, number> = {
  conventions: 4_000,
  brief: 1_500,
  architecture: 12_000
};

/**
 * BLD-007 — the cap for a doc the system did not ship a template for.
 *
 * Sits between `conventions` and `architecture`: generous enough that an
 * ordinary reference document (a tax rule, a brand voice, an API's quirks)
 * arrives whole, small enough that one file cannot eat the budget the agent
 * needs for reading components. Truncation is stated in the injected text by
 * `renderDocForPrompt`, because a silently short user doc is exactly the
 * failure this format exists to avoid.
 */
export const DEFAULT_DOC_CAP = 6_000;

/** BLD-007 — a doc discovered under `docs/`, with the injection it declared. */
export interface DiscoveredDoc {
  /** Project-relative, forward-slashed. */
  path: string;
  title: string;
  inject: DocInjection;
  /** Free-text hints from `when:`, shown to the agent in the tool list. */
  when: string[];
  /** The prose, with any front-matter block already stripped. */
  body: string;
}

/**
 * The doc bodies the authoring loop may see.
 *
 * The three named fields are the seed docs, kept as fields rather than folded
 * into `extra` so every existing consumer (`ContextBuilder`, `collectSources`,
 * the review types) compiles and behaves unchanged. `extra` is additive and
 * optional, which is what makes "a project with no user docs sends the same
 * bytes as before" a property of the *shape* rather than of a code path someone
 * has to remember to keep exercising.
 */
export interface ProjectDocsContent {
  conventions?: string;
  brief?: string;
  architecture?: string;
  /** BLD-007: every other markdown doc under `docs/`, with its declaration. */
  extra?: DiscoveredDoc[];
}

// ── BLD-007: front matter ─────────────────────────────────────────────────────

/** The keys this format understands. Anything else is carried, not obeyed. */
export interface DocFrontMatter {
  title?: string;
  inject?: DocInjection;
  when?: string[];
}

export interface ParsedDoc {
  frontMatter: DocFrontMatter;
  /** The prose, with the block removed. Identical to the source when absent. */
  body: string;
  hadFrontMatter: boolean;
  /**
   * Things the block said that this format could not use — an unknown `inject`
   * value, a key it does not understand. Surfaced so the Docs panel can say
   * "this line does nothing" instead of the doc quietly behaving as if the line
   * were not there, which is how a user concludes the feature is broken.
   */
  problems: string[];
}

/**
 * Read a leading `---` fenced block, if there is one.
 *
 * Hand-rolled rather than pulled from a YAML library on purpose: this module is
 * the one the headless measurement bundle imports, and it is deliberately free
 * of dependencies. The subset is three keys of scalars — a YAML parser here
 * would buy nothing and cost the containment rule.
 *
 * ⚠️ The block must be the very first bytes of the file. A `---` further down is
 * a horizontal rule in someone's prose, and treating it as configuration would
 * silently swallow a paragraph.
 */
export function parseDocFrontMatter(source: string): ParsedDoc {
  const text = source.replace(/\r\n/g, '\n');
  const problems: string[] = [];
  const absent: ParsedDoc = { frontMatter: {}, body: source, hadFrontMatter: false, problems };

  if (!text.startsWith('---\n')) return absent;
  const end = text.indexOf('\n---', 3);
  if (end === -1) return absent;

  const block = text.slice(4, end);
  // Only ever `key: value` lines — a nested structure is not this format.
  if (/^\s*[-[{]/m.test(block.replace(/^\s*#.*$/gm, ''))) {
    // A list or map at the top level: not something we can obey, and not
    // something to guess at either.
    problems.push('Front matter must be simple `key: value` lines.');
  }

  const frontMatter: DocFrontMatter = {};
  for (const raw of block.split('\n')) {
    const line = raw.replace(/\s+#.*$/, '').trim();
    if (!line || line.startsWith('#')) continue;
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim().toLowerCase();
    const value = unquote(line.slice(colon + 1).trim());
    if (!value) continue;

    switch (key) {
      case 'title':
        frontMatter.title = value;
        break;
      case 'inject':
        if (value.toLowerCase() === 'always' || value.toLowerCase() === 'pull') {
          frontMatter.inject = value.toLowerCase() as DocInjection;
        } else {
          problems.push(`inject: "${value}" is not a mode. Use "always" or "pull".`);
        }
        break;
      case 'when':
        frontMatter.when = splitHints(value);
        break;
      default:
        problems.push(`"${key}" is not a key this format understands; it has no effect.`);
    }
  }

  // Everything past the closing fence, with the blank lines authors habitually
  // leave under it removed: the body is what a model reads, and a doc that
  // opened with two blank lines would differ from the same doc without front
  // matter for no reason a reader could see.
  const afterFence = text.indexOf('\n', end + 1);
  const body = afterFence === -1 ? '' : text.slice(afterFence + 1).replace(/^\n+/, '');
  return { frontMatter, body, hadFrontMatter: true, problems };
}

/** The prose a model should read: the source, minus any front matter. */
export function docBody(source: string): string {
  const parsed = parseDocFrontMatter(source);
  return parsed.hadFrontMatter ? parsed.body : source;
}

/**
 * The injection for a path, given whatever the file declared.
 *
 * A declaration always wins. Absent one, the three seed paths keep the
 * behaviour they have always had — so an existing project is unchanged by this
 * task — and every other path is `pull`, which is the mode that cannot cost a
 * project that never asked for it anything.
 */
export function resolveInjection(relPath: string, declared: DocInjection | undefined): DocInjection {
  if (declared) return declared;
  const known = KNOWN_DOCS.find((d) => d.path === normalizeDocPath(relPath));
  return known?.injection ?? 'pull';
}

/** BLD-007 — everything the system knows about one doc on disk. */
export interface DocDescriptor {
  /** Project-relative, forward-slashed. */
  path: string;
  title: string;
  inject: DocInjection;
  when: string[];
  /** Set for the three seed docs; absent for everything the user invented. */
  kind?: KnownDocKind;
  /** Characters, applied before the shared budget ever sees the text. */
  cap: number;
  /** Whether the file carried front matter, as opposed to taking defaults. */
  declared: boolean;
  problems: string[];
}

/**
 * Describe a doc from its path and contents. The one place the format's
 * defaults live — both clients (the editor loop and `noodl-mcp`) resolve a doc
 * through this function, so a doc the panel says is always-injected cannot be
 * one the MCP server reports as pull.
 */
export function describeDoc(relPath: string, source: string): DocDescriptor {
  const path = normalizeDocPath(relPath);
  const known = KNOWN_DOCS.find((d) => d.path === path);
  const { frontMatter, body, hadFrontMatter, problems } = parseDocFrontMatter(source);

  return {
    path,
    title: frontMatter.title ?? known?.title ?? deriveTitle(path, body),
    inject: resolveInjection(path, frontMatter.inject),
    when: frontMatter.when ?? [],
    ...(known ? { kind: known.kind } : {}),
    cap: known ? DOC_CAPS[known.kind] : DEFAULT_DOC_CAP,
    declared: hadFrontMatter,
    problems
  };
}

/** First markdown heading, else a de-slugged filename. Never an empty title. */
function deriveTitle(path: string, body: string): string {
  const heading = body.match(/^#{1,6}\s+(.+?)\s*$/m);
  if (heading) return heading[1].trim();
  const base = path.slice(path.lastIndexOf('/') + 1).replace(/\.md$/i, '');
  return base.replace(/[-_]+/g, ' ').trim() || base;
}

function unquote(value: string): string {
  const trimmed = value.trim();
  const quoted = /^(['"])(.*)\1$/.exec(trimmed);
  return quoted ? quoted[2] : trimmed;
}

/** `tax, VAT` and `[tax, VAT]` are the same list. */
function splitHints(value: string): string[] {
  const inner = /^\[(.*)\]$/.exec(value.trim());
  return (inner ? inner[1] : value)
    .split(',')
    .map((s) => unquote(s).trim())
    .filter(Boolean);
}

export interface TruncatedDoc {
  text: string;
  truncated: boolean;
  /** Length of the source before truncation. */
  originalChars: number;
}

/**
 * Cut a doc down to `maxChars` at a heading boundary.
 *
 * Cutting mid-sentence produces a rule the agent half-reads and then guesses at,
 * which is worse than not having the rule. So the cut lands on the last markdown
 * heading that fits; failing that the last blank line; failing that the cap
 * itself. Callers state the truncation in the injected text — a silently short
 * CONVENTIONS.md is exactly the failure this format exists to avoid.
 */
export function truncateDoc(source: string, maxChars: number): TruncatedDoc {
  const text = source.replace(/\r\n/g, '\n');
  if (text.length <= maxChars) return { text, truncated: false, originalChars: text.length };

  const head = text.slice(0, maxChars);
  // Last heading start that is not the very first line (cutting to nothing is
  // not an improvement over cutting mid-sentence).
  const headingMatches = [...head.matchAll(/^#{1,6} .*$/gm)];
  const lastHeading = headingMatches.length > 1 ? headingMatches[headingMatches.length - 1] : undefined;
  let cut = lastHeading?.index;

  if (cut === undefined || cut < maxChars / 4) {
    const lastBlank = head.lastIndexOf('\n\n');
    cut = lastBlank > maxChars / 4 ? lastBlank : maxChars;
  }

  return {
    text: text.slice(0, cut).trimEnd(),
    truncated: true,
    originalChars: text.length
  };
}

/**
 * A doc rendered for the prompt: capped, and — when capped — saying so in the
 * text the model reads, with the file path so it can ask a human rather than
 * invent the missing half.
 */
export function renderDocForPrompt(doc: KnownDoc | DocDescriptor, source: string, cap = docCap(doc)): string {
  const { text, truncated, originalChars } = truncateDoc(source, cap);
  if (!truncated) return text;
  return [
    text,
    '',
    `[TRUNCATED — ${doc.path} is ${originalChars} characters and only the first ${text.length} are shown here.`,
    'Rules below this point were not included. Ask before assuming this project has no rule about something,',
    'and say in your response that the conventions were truncated.]'
  ].join('\n');
}

/** The cap a doc is subject to, whichever kind of description you hold. */
export function docCap(doc: KnownDoc | DocDescriptor): number {
  return 'cap' in doc ? doc.cap : DOC_CAPS[doc.kind];
}

/** `true` when a path is one of the four known locations (decisions included). */
export function isKnownDocPath(relPath: string): boolean {
  const p = normalizeDocPath(relPath);
  return KNOWN_DOCS.some((d) => d.path === p) || p.startsWith(`${DOC_DECISIONS_DIR}/`);
}

/**
 * Normalise a caller-supplied doc path to the project-relative, forward-slashed
 * form the rest of the module uses. Accepts `BRIEF.md`, `docs/BRIEF.md`,
 * `./docs/BRIEF.md` and backslashes; does NOT decide whether the result is safe
 * — that is `assertInsideDocs`'s job, and it is deliberately a separate step so
 * a caller cannot get containment for free by normalising.
 */
export function normalizeDocPath(relPath: string): string {
  const cleaned = relPath.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
  return cleaned.startsWith(`${DOCS_DIR}/`) || cleaned === DOCS_DIR ? cleaned : `${DOCS_DIR}/${cleaned}`;
}

/** Thrown for a path that escapes `docs/`. Never a "sanitised" fallback. */
export class DocPathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DocPathError';
  }
}

/**
 * Resolve and contain a doc path. Rejects traversal, absolute paths and
 * non-markdown files rather than silently rewriting them — a write tool that
 * quietly relocates its target is worse than one that refuses.
 */
export function assertInsideDocs(relPath: string): string {
  if (!relPath || !relPath.trim()) throw new DocPathError('A document path is required.');
  if (/^([a-zA-Z]:)?[\\/]/.test(relPath.trim())) {
    throw new DocPathError(`"${relPath}" is an absolute path; project docs are addressed relative to docs/.`);
  }
  const p = normalizeDocPath(relPath);
  const segments = p.split('/');
  if (segments[0] !== DOCS_DIR || segments.some((s) => s === '..' || s === '.' || s === '')) {
    throw new DocPathError(`"${relPath}" resolves outside docs/. Project docs live under docs/ only.`);
  }
  if (!p.toLowerCase().endsWith('.md')) {
    throw new DocPathError(`"${relPath}" is not a markdown file. Project docs are .md files under docs/.`);
  }
  return p;
}
