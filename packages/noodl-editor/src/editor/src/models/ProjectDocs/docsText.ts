/**
 * AIX-009 — Project context documents: the pure half.
 *
 * Paths, caps, and the text transforms that turn a doc on disk into a prompt
 * block. Deliberately free of `filesystem`, `ProjectModel` and Electron so the
 * authoring loop's context builder can import it in the headless measurement
 * bundle — the same rule the AIX-006 `StyleVocabulary` submodule follows.
 *
 * The format has no manifest: git owns `docs/`, a text editor is a first-class
 * way to work on it, and exactly four paths are known to the system. Anything
 * else under `docs/` is carried and editable but never injected.
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

export interface KnownDoc {
  kind: KnownDocKind;
  /** Project-relative, forward-slashed. */
  path: string;
  title: string;
  audience: string;
  purpose: string;
  /** Injected on every authoring turn, or only when the agent asks for it. */
  injection: 'default' | 'pull';
}

export const KNOWN_DOCS: readonly KnownDoc[] = [
  {
    kind: 'conventions',
    path: DOC_CONVENTIONS,
    title: 'Conventions',
    audience: 'AI first',
    purpose: 'The rules the assistant must follow in this project.',
    injection: 'default'
  },
  {
    kind: 'brief',
    path: DOC_BRIEF,
    title: 'Brief',
    audience: 'human + AI',
    purpose: 'What this app is, who uses it, what is deliberately out of scope.',
    injection: 'default'
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

/** The three doc bodies the authoring loop may see. Absent file = absent field. */
export interface ProjectDocsContent {
  conventions?: string;
  brief?: string;
  architecture?: string;
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
export function renderDocForPrompt(doc: KnownDoc, source: string, cap = DOC_CAPS[doc.kind]): string {
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
