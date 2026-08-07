/**
 * AIX-011 criterion 7 — the doc lint: does this markdown describe the graph?
 *
 * The prose analogue of `styleLint`. The AIX-009…012 group rests on one design
 * line — **no AI-generated markdown that describes the graph** — and a design
 * line enforced only by a paragraph of prompt is a design line that erodes.
 * This is the mechanical check: after a doc submission is otherwise usable, it
 * is scanned for the sentences that restate structure, and the findings feed
 * ONE advisory pass (never a rejection, exactly like the style lint — the
 * linter suggests, the loop decides).
 *
 * It is deliberately conservative, because a false positive here asks the model
 * to delete a true sentence:
 *
 *  - Only *distinctive* node type names count. "Group", "Text" and "Condition"
 *    are ordinary English and appear in honest prose constantly; a two-word type
 *    ("Component Inputs", "Page Router") or a type nobody writes by accident
 *    ("Repeater") does not.
 *  - A bare mention is not a finding. A finding needs a type name in a sentence
 *    that is *about structure* — containment, wiring, or a node count — which is
 *    what the STRUCTURE_PHRASES and the wire arrow detect.
 *  - Code fences are skipped entirely. A doc quoting an API payload or a config
 *    snippet is doing its job, and that is where an external contract lives.
 *
 * @module AiAssistant/authoring/docLint
 */

import { CatalogIndex, loadDefaultCatalog } from '../../../validation';

/**
 * Type names common enough as English that seeing one in prose says nothing.
 * Everything else in the catalog is distinctive: nobody writes "the Repeater"
 * about a business rule.
 */
const AMBIGUOUS_TYPE_NAMES = new Set([
  'Group',
  'Text',
  'Image',
  'Video',
  'Condition',
  'Circle',
  'States',
  'String',
  'Number',
  'Boolean',
  'Object',
  'Array',
  'Color',
  'Value',
  'Event',
  'Timer',
  'Counter',
  'Switch',
  'Options',
  'Columns',
  'Icon',
  'Page',
  'Component',
  'Model',
  'Collection',
  'Function',
  'Script',
  'Expression'
]);

/** Sentences that are about wiring, containment or node counts. */
const STRUCTURE_PHRASES: Array<{ pattern: RegExp; why: string }> = [
  { pattern: /\b(connects?|connected|wires?|wired)\s+(to|into|from)\b/i, why: 'describes a connection' },
  { pattern: /\bconnect(ed|s)?\s+its\b/i, why: 'describes a connection' },
  { pattern: /\b(input|output)\s+(port|signal)s?\b/i, why: 'describes ports' },
  { pattern: /\bthe\s+\w+\s+port\b/i, why: 'describes ports' },
  { pattern: /\b(contains?|consists? of|is (?:made|built) (?:up )?of|holds?)\s+(a|an|the|\d+|several|two|three)\b/i, why: 'describes what a component contains' },
  { pattern: /\bnested (inside|within|under)\b/i, why: 'describes the node hierarchy' },
  { pattern: /\b\d+\s+nodes?\b/i, why: 'counts nodes' },
  { pattern: /\bchild (node|nodes|of)\b/i, why: 'describes the node hierarchy' },
  { pattern: /\bnode graph (contains|has|shows)\b/i, why: 'describes the graph' }
];

/** `A → B` / `A -> B`: a wire drawn in prose. */
const WIRE_ARROW = /\s(?:->|→|-->)\s/;

export interface DocLintOptions {
  /** Type vocabulary; defaults to the shipped catalog's authorable types. */
  typeNames?: readonly string[];
  /**
   * Only lint what this submission ADDS. Passing the file's previous content
   * means the human's own existing prose is never reported back at the model —
   * it is not the model's to rewrite, and reporting it produces a revision that
   * "fixes" the human's document.
   */
  baseline?: string | null;
}

export interface DocLintFinding {
  /** 1-based line number in the submitted content. */
  line: number;
  text: string;
  why: string;
}

export interface DocLint {
  findings: DocLintFinding[];
  /** Agent-oriented lines for `docAdvisoryMessage`. */
  lines: string[];
}

let distinctiveCache: Set<string> | undefined;

/**
 * Node names distinctive enough that a prose mention means something.
 *
 * **Both** the internal `typeName` and the editor's `displayName`, because they
 * routinely differ and the model writes the one a human sees: the node the
 * picker calls "Repeater" has the type name `For Each`, and "Array" is
 * `Collection2`. Keying this on type names alone was silently blind to every
 * restatement written in the vocabulary of the actual UI — which is all of
 * them.
 */
function distinctiveTypeNames(catalog?: CatalogIndex): Set<string> {
  if (!catalog && distinctiveCache) return distinctiveCache;
  const index = catalog ?? loadDefaultCatalog();
  const names = new Set<string>();
  const consider = (name: string | undefined) => {
    if (!name) return;
    // Component references ("/Pages/Home") are not node types in this sense —
    // naming a page in a doc is exactly what a doc should do.
    if (name.startsWith('/')) return;
    if (AMBIGUOUS_TYPE_NAMES.has(name)) return;
    if (name.length < 5) return;
    names.add(name);
  };
  for (const typeName of index.authorableTypeNames()) {
    consider(typeName);
    consider(index.getNode(typeName)?.displayName);
  }
  if (!catalog) distinctiveCache = names;
  return names;
}

/** Lines outside fenced code blocks, with their 1-based numbers. */
function proseLines(content: string): Array<{ line: number; text: string }> {
  const out: Array<{ line: number; text: string }> = [];
  let inFence = false;
  content.split('\n').forEach((text, index) => {
    if (/^\s*(```|~~~)/.test(text)) {
      inFence = !inFence;
      return;
    }
    if (inFence) return;
    out.push({ line: index + 1, text });
  });
  return out;
}

/**
 * Scan a proposed doc body for graph restatement.
 *
 * A line is a finding when it is structural AND concrete: a structure phrase or
 * a wire arrow, plus either a distinctive node type name or an explicit node
 * count. Either half alone is ordinary prose — "the checkout flow connects to
 * Stripe" is a contract, not a graph.
 */
export function docLint(content: string, options: DocLintOptions = {}): DocLint {
  const types = options.typeNames ? new Set(options.typeNames) : distinctiveTypeNames();
  const existing = new Set(
    options.baseline ? proseLines(options.baseline).map((l) => l.text.trim()) : []
  );

  const findings: DocLintFinding[] = [];
  for (const { line, text } of proseLines(content)) {
    const trimmed = text.trim();
    if (!trimmed || existing.has(trimmed)) continue;

    const structural = STRUCTURE_PHRASES.find((p) => p.pattern.test(trimmed));
    const hasWire = WIRE_ARROW.test(trimmed);
    if (!structural && !hasWire) continue;

    const namedType = [...types].find((name) => trimmed.includes(name));
    const countsNodes = /\b\d+\s+nodes?\b/i.test(trimmed);
    if (!namedType && !countsNodes) continue;

    findings.push({
      line,
      text: trimmed.length > 160 ? `${trimmed.slice(0, 157)}…` : trimmed,
      why: structural?.why ?? 'draws a connection in prose'
    });
  }

  return {
    findings,
    lines: findings.map((f) => `line ${f.line} ${f.why}: "${f.text}"`)
  };
}
