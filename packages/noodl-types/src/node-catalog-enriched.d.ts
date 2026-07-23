/* GENERATED FILE — do not edit.
 * Regenerate with: npm run catalog:merge
 * Sources: node-catalog.json (generated) + docs/node-catalog/ (authored).
 * Field semantics: docs/node-catalog/ENRICHMENT.md
 */
import { CatalogNode, NodeCatalog, NodeTypeName, Typecast } from './node-catalog';

export interface NodeEnrichment {
  typeName: NodeTypeName;
  summary: string;
  description: string;
  whenToUse: string;
  ports?: Record<string, string>;
  /** Present exactly when the node has dynamic ports. */
  runtimeBehavior?: string;
  examples?: string[];
  patterns?: string[];
  antiPatterns?: string[];
  relatedNodes?: NodeTypeName[];
}

export interface CatalogExampleNode {
  id: string;
  type: string;
  label?: string;
  parent?: string;
  children?: string[];
  parameters?: Record<string, unknown>;
}

export interface CatalogExampleComponent {
  name: string;
  nodes: CatalogExampleNode[];
  connections: Array<{ fromId: string; fromProperty: string; toId: string; toProperty: string }>;
}

export interface CatalogExample {
  id: string;
  title: string;
  description: string;
  demonstrates: NodeTypeName[];
  components: CatalogExampleComponent[];
}

export interface CompatibilityInfo {
  rules: Record<string, string>;
  signalSemantics: Record<string, string>;
  castSemantics: Record<string, string>;
  verifiedPairs: {
    permitted: Array<{ from: string; to: string; note?: string }>;
    rejected: Array<{ from: string; to: string; note?: string }>;
  };
}

export interface EnrichedCatalogNode extends CatalogNode {
  enrichment?: NodeEnrichment;
}

export interface EnrichedNodeCatalog extends Omit<NodeCatalog, 'nodes'> {
  enrichment: { version: string; docs: string; coverage: { documented: number; total: number } };
  compatibility?: CompatibilityInfo;
  examples: CatalogExample[];
  nodes: EnrichedCatalogNode[];
}
