/**
 * SUB-005 enrichment lookup for the editor.
 *
 * `./catalog` bundles the *structural* catalog (SUB-004): types, ports, dynamic
 * port mechanisms — everything the semantic validator needs. This module adds
 * the *semantic* layer authored by SUB-005: what a node is for, when to use it,
 * what each port means. The validator does not need any of it; explanation does,
 * because the difference between a useful explanation and a generic doc-string
 * is whether the model had to guess what a port meant.
 *
 * Loaded lazily. The enriched file is ~1.45 MB, so nothing pays for it until a
 * feature actually asks — which today means opening the Explain panel.
 *
 * @module noodl-editor/validation/enrichedCatalog
 */

import type { NodeEnrichment } from '../../../../../noodl-types/src/node-catalog-enriched';
import type { CatalogNode } from '../../../../../noodl-types/src/node-catalog';

export type { NodeEnrichment };

export interface EnrichedCatalogNode extends CatalogNode {
  enrichment?: NodeEnrichment;
}

interface EnrichedCatalogFile {
  nodes: EnrichedCatalogNode[];
  enrichment?: { version?: string; coverage?: { documented: number; total: number } };
}

let cached: Map<string, EnrichedCatalogNode> | undefined;

function load(): Map<string, EnrichedCatalogNode> {
  if (cached) return cached;
  cached = new Map();
  try {
    // require(), not import: keeps TypeScript from inferring a 1.45 MB literal
    // type, and keeps the cost off startup — webpack still bundles the JSON.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const file = require('../../../../../noodl-types/src/node-catalog-enriched.json') as EnrichedCatalogFile;
    for (const node of file.nodes ?? []) cached.set(node.typeName, node);
  } catch (error) {
    // A missing enriched catalog degrades explanations; it must never break the
    // editor, so callers get an empty index and fall back to structure alone.
    console.warn('[explain] enriched node catalog unavailable — explanations will be less specific', error);
  }
  return cached;
}

/** The enriched catalog entry for a node type, when the catalog knows it. */
export function enrichedNode(typeName: string): EnrichedCatalogNode | undefined {
  return load().get(typeName);
}

/** Authored semantics for a node type, when SUB-005 documented it. */
export function enrichmentFor(typeName: string): NodeEnrichment | undefined {
  return load().get(typeName)?.enrichment;
}

/** Authored semantics for a single port, when documented. */
export function portDescription(typeName: string, portName: string): string | undefined {
  return load().get(typeName)?.enrichment?.ports?.[portName];
}

/** Test seam: drop the memoised index so a spec can assert on cold loading. */
export function resetEnrichedCatalogCache(): void {
  cached = undefined;
}
