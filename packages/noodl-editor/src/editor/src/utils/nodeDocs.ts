/**
 * ALPHA-006 §1 — node help, read from the bundled catalog instead of the web.
 *
 * ## What this replaces
 *
 * Until now every in-editor help surface fetched the **raw markdown source** of a
 * page on the docs site over HTTP and rendered only the slice between a pair of
 * bespoke `##head##` marker comments, resolving a homegrown `@include`
 * transclusion itself.
 * That protocol had four consumers (`docs-parser.ts`, `ConnectionPopup/DocsParser.ts`,
 * `NodeLabel.tsx`, `NodePicker.hooks.ts`) and three standing problems:
 *
 *  - it needed the network, so the help panel was blank offline;
 *  - it could disagree with the node in front of you — 39 of the catalog's `docs`
 *    URLs point at a page that is missing or has moved, and 17 nodes have no URL
 *    at all, which is **35% of the library silently undocumented**;
 *  - every failure was swallowed, so "no page" and "no network" both rendered as
 *    an empty panel.
 *
 * The enriched node catalog ships *inside the binary* (`@noodl/types`'s
 * `node-catalog-enriched.json`) and covers 153/153 nodes with a summary, a
 * description, when-to-use guidance, per-port prose and related nodes. It is the
 * same artifact the node picker's index and the semantic validator read, so what
 * the help text says about a port and what the node actually declares **cannot
 * drift**.
 *
 * ## The two documents rule
 *
 * `PORT-DESCRIPTION-STYLE.md` is explicit that a port's `description` (one plain
 * sentence, canonical, read by the catalog and the AI loop) and its `tooltip`
 * (rich HTML, read by the property panel's hover popup) are **two documents for
 * two readers**. Nothing here touches `tooltip`; the property panel keeps
 * rendering it exactly as before. This module only ever reads `description` and
 * the enrichment layer above it.
 *
 * ## Purity
 *
 * No React, no Electron, no editor singletons — so `tests-unit/` can grade it
 * without starting a renderer. The docs *origin* is deliberately not resolved
 * here: {@link nodeDocsPath} returns a site-relative path and the renderer call
 * sites join it to `getDocsEndpoint()`. That also keeps the legacy
 * `docs.noodl.net` literal out of this file — the path is derived from the URL,
 * not string-replaced onto it.
 *
 * @module noodl-editor/utils/nodeDocs
 */

import { enrichedNode, type NodeEnrichment } from '../validation/enrichedCatalog';

/** Everything a help surface needs about one node type. */
export interface NodeDocsContent {
  typeName: string;
  displayName: string;
  category: string;
  summary: string;
  description: string;
  whenToUse: string;
  /** Present only on nodes whose ports are created at runtime. */
  runtimeBehavior?: string;
  patterns: string[];
  antiPatterns: string[];
  relatedNodes: string[];
  isDeprecated: boolean;
  /** Rendered HTML for the preview panes. Never empty when this object exists. */
  html: string;
  /** Site-relative "read more" path, or `''` when the node has no page. */
  path: string;
}

/** Per-port help, keyed by the port's canonical `name` (not its display name). */
export interface NodePortDocs {
  inputs: Record<string, string>;
  outputs: Record<string, string>;
}

/* -------------------------------------------------------------------------- */
/* Inline formatting                                                           */
/* -------------------------------------------------------------------------- */

/**
 * The enrichment is prose with a little inline markdown: 140 of 153 nodes use
 * backticks for port and type names, four use `**bold**`. Nothing uses links,
 * images, tables or fenced blocks.
 *
 * That is deliberately rendered by hand rather than by handing the text to
 * Remarkable. The markdown pipeline is the thing this task is removing, it has a
 * documented habit of eating content it does not recognise (HTML comments at a
 * blank line, `-->`), and `html: true` on a full markdown renderer would let any
 * future `<` in the catalog become live markup. Escaping first and then putting
 * back exactly two constructs is both smaller and closed.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Escape, then restore `` `code` `` and `**bold**`. Safe on any input. */
export function formatInline(text: string): string {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

function paragraph(text: string | undefined, className?: string): string {
  if (!text) return '';
  const cls = className ? ` class="${className}"` : '';
  return `<p${cls}>${formatInline(text)}</p>`;
}

function section(title: string, body: string): string {
  return body ? `<h3>${escapeHtml(title)}</h3>${body}` : '';
}

function list(items: string[] | undefined): string {
  if (!items?.length) return '';
  return `<ul>${items.map((item) => `<li>${formatInline(item)}</li>`).join('')}</ul>`;
}

/* -------------------------------------------------------------------------- */
/* Node docs                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The catalog stores `docs` as an absolute URL on the legacy host, which is a
 * **stable key, not an address** — ALPHA-006 criterion 6 keeps the literal on the
 * node definitions and rewrites it at read time. Taking the pathname is that
 * rewrite: it works for any origin the field is ever given, and it means this
 * file never names the old host.
 */
export function nodeDocsPath(typeName: string): string {
  const raw = enrichedNode(typeName)?.docs;
  if (!raw) return '';

  try {
    const { pathname } = new URL(raw);
    // The old site served `…-short.md` fragments and `#/`-prefixed hash routes
    // to the fetch protocol; a person following a link wants neither.
    return pathname.replace(/^\/#\//, '/').replace(/(-short)?\.md$/, '');
  } catch {
    // Already relative.
    return raw.startsWith('/') ? raw : `/${raw}`;
  }
}

function renderHtml(
  enrichment: NodeEnrichment,
  extra: { isDeprecated: boolean; relatedDisplayNames: string[] }
): string {
  return [
    paragraph(enrichment.summary, 'node-docs-summary'),
    extra.isDeprecated
      ? '<p class="node-docs-deprecated">This node is deprecated and kept only so existing projects keep working.</p>'
      : '',
    paragraph(enrichment.description),
    section('When to use it', paragraph(enrichment.whenToUse)),
    section('Ports at runtime', paragraph(enrichment.runtimeBehavior)),
    section('Patterns', list(enrichment.patterns)),
    section('Watch out for', list(enrichment.antiPatterns)),
    section(
      'Related nodes',
      extra.relatedDisplayNames.length
        ? `<p>${extra.relatedDisplayNames.map((name) => `<code>${escapeHtml(name)}</code>`).join(', ')}</p>`
        : ''
    )
  ]
    .filter(Boolean)
    .join('');
}

/**
 * Help for a node type, or `undefined` when the catalog does not know it.
 *
 * A miss is expected and normal: local components, prefab-provided nodes and
 * workflow entry nodes are not in the catalog. Callers render their own empty
 * state rather than a stale page.
 */
export function getNodeDocs(typeName: string | undefined): NodeDocsContent | undefined {
  if (!typeName) return undefined;

  const node = enrichedNode(typeName);
  const enrichment = node?.enrichment;
  if (!node || !enrichment) return undefined;

  const relatedDisplayNames = (enrichment.relatedNodes ?? []).map(
    (related) => enrichedNode(related)?.displayName ?? related
  );

  return {
    typeName: node.typeName,
    displayName: node.displayName ?? node.typeName,
    category: node.category ?? '',
    summary: enrichment.summary ?? '',
    description: enrichment.description ?? '',
    whenToUse: enrichment.whenToUse ?? '',
    runtimeBehavior: enrichment.runtimeBehavior,
    patterns: enrichment.patterns ?? [],
    antiPatterns: enrichment.antiPatterns ?? [],
    relatedNodes: enrichment.relatedNodes ?? [],
    isDeprecated: Boolean(node.isDeprecated),
    html: renderHtml(enrichment, { isDeprecated: Boolean(node.isDeprecated), relatedDisplayNames }),
    path: nodeDocsPath(typeName)
  };
}

/**
 * One line of help for a node, for places with room for a sentence and no more
 * (the property panel's help button, a hover). Falls back to the first sentence
 * of the description when a node somehow has no summary.
 */
export function getNodeSummary(typeName: string | undefined): string {
  const docs = getNodeDocs(typeName);
  if (!docs) return '';
  if (docs.summary) return docs.summary;
  return docs.description.split(/(?<=\.)\s/)[0] ?? '';
}

/* -------------------------------------------------------------------------- */
/* Port docs                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Per-port help, assembled from the two channels the style guide declares:
 *
 *  - the port's own `description` — **canonical**, one sentence, authored beside
 *    the port declaration and carried into the catalog by `catalog:generate`;
 *  - the enrichment's `ports[…]` entry, which may only *add what the source
 *    cannot know* (cross-node context, usage guidance).
 *
 * Both are rendered when both exist and say different things, description first.
 * Neither is derived from `tooltip`, which stays the property panel's own
 * document.
 *
 * Keyed by the port's canonical `name`. The old fetch protocol keyed on the
 * lower-cased *display* name with a regexp fallback for wildcard doc markers;
 * the catalog has no wildcards, so exact names are both sufficient and exact.
 */
export function getPortDocs(typeName: string | undefined): NodePortDocs {
  const empty: NodePortDocs = { inputs: {}, outputs: {} };
  if (!typeName) return empty;

  const node = enrichedNode(typeName);
  if (!node) return empty;

  const enrichmentPorts = node.enrichment?.ports ?? {};

  const collect = (ports: Array<{ name: string; description?: string }> | undefined) => {
    const out: Record<string, string> = {};
    for (const port of ports ?? []) {
      const description = typeof port.description === 'string' ? port.description.trim() : '';
      const added = (enrichmentPorts[port.name] ?? '').trim();

      const parts: string[] = [];
      if (description) parts.push(paragraph(description));
      // Only when it adds something: several enrichment entries restate the
      // declaration verbatim, and two identical paragraphs read as a bug.
      if (added && added !== description) parts.push(paragraph(added));

      if (parts.length) out[port.name] = parts.join('');
    }
    return out;
  };

  return {
    inputs: collect(node.inputs),
    outputs: collect(node.outputs)
  };
}

/**
 * Help for a single port, by canonical name. Returns `''` when neither channel
 * documented it — a blank port is visibly undocumented, which is the honest
 * state and the one the style guide prefers to a restatement.
 */
export function getPortDoc(typeName: string | undefined, plug: 'input' | 'output', portName: string): string {
  const docs = getPortDocs(typeName);
  return (plug === 'input' ? docs.inputs : docs.outputs)[portName] ?? '';
}
