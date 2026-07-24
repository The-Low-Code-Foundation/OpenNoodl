/**
 * AIX-004 — Explain Mode: citation parsing
 *
 * The model cites nodes as `[Display Name](noodl-node:ID)`. This module is the
 * only thing that knows that syntax: it extracts citations for verification and
 * resolves whether each one points at a node that actually exists.
 *
 * Resolution matters. A citation to a hallucinated id renders as a link that
 * goes nowhere, which reads as a bug in the editor rather than a mistake by the
 * model — so the panel checks every citation against the context and renders
 * unresolved ones as plain text.
 *
 * @module AiAssistant/explain/citations
 */

import type { ExplainContext } from './types';

export const CITATION_SCHEME = 'noodl-node:';

/** Markdown link whose target uses the node scheme. Text may not contain ] or newline. */
const CITATION_PATTERN = /\[([^\]\n]+)\]\(noodl-node:([^)\s]+)\)/g;

export interface Citation {
  /** The link text the model wrote. */
  text: string;
  nodeId: string;
  /** Character offset of the whole `[…](…)` in the source string. */
  index: number;
  length: number;
}

/** Every node citation in a piece of model output, in order. */
export function parseCitations(markdown: string): Citation[] {
  const out: Citation[] = [];
  // Fresh regex state per call — a shared /g regex carries lastIndex between
  // calls and silently skips matches on the second string.
  const pattern = new RegExp(CITATION_PATTERN.source, 'g');
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(markdown)) !== null) {
    out.push({ text: match[1], nodeId: match[2], index: match.index, length: match[0].length });
  }
  return out;
}

/**
 * Split citations into those that name a node in the context and those that do
 * not. Unresolved citations are a model error; the caller decides whether to
 * degrade them to plain text (the panel) or fail (the specs).
 */
export function resolveCitations(
  markdown: string,
  context: ExplainContext
): { resolved: Citation[]; unresolved: Citation[] } {
  const known = new Set(context.nodes.map((n) => n.id));
  const resolved: Citation[] = [];
  const unresolved: Citation[] = [];
  for (const citation of parseCitations(markdown)) {
    (known.has(citation.nodeId) ? resolved : unresolved).push(citation);
  }
  return { resolved, unresolved };
}

/** Rewrite citations that point nowhere into their plain link text. */
export function stripUnresolvedCitations(markdown: string, context: ExplainContext): string {
  const known = new Set(context.nodes.map((n) => n.id));
  return markdown.replace(new RegExp(CITATION_PATTERN.source, 'g'), (whole, text: string, nodeId: string) =>
    known.has(nodeId) ? whole : text
  );
}
