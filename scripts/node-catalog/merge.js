#!/usr/bin/env node
/**
 * Node catalog enrichment merge (SUB-005).
 *
 * Combines the generated structural catalog (SUB-004) with the authored
 * enrichment corpus into the published enriched catalog:
 *
 *   packages/noodl-types/src/node-catalog-enriched.json
 *   packages/noodl-types/src/node-catalog-enriched.d.ts
 *
 * Authored inputs (docs/node-catalog/):
 *   enrichment/<type>.json   per-node semantics
 *   examples/<id>.json       validated v2 graph fragments
 *   compatibility.json       connection-compatibility semantics
 *
 * Modes:
 *   node scripts/node-catalog/merge.js                     regenerate artifact
 *   node scripts/node-catalog/merge.js --check             fail if committed artifact is stale
 *   node scripts/node-catalog/merge.js --require-coverage  undocumented nodes are errors
 *
 * Field semantics and the error/warning contract: docs/node-catalog/ENRICHMENT.md
 */
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const CATALOG_JSON = path.join(REPO_ROOT, 'packages/noodl-types/src/node-catalog.json');
const OUT_JSON = path.join(REPO_ROOT, 'packages/noodl-types/src/node-catalog-enriched.json');
const OUT_DTS = path.join(REPO_ROOT, 'packages/noodl-types/src/node-catalog-enriched.d.ts');
const ENRICHMENT_DIR = path.join(REPO_ROOT, 'docs/node-catalog/enrichment');
const EXAMPLES_DIR = path.join(REPO_ROOT, 'docs/node-catalog/examples');
const COMPATIBILITY_JSON = path.join(REPO_ROOT, 'docs/node-catalog/compatibility.json');

const errors = [];
const warnings = [];

function fileNameForType(typeName) {
  return typeName.toLowerCase().replace(/[^a-z0-9.]+/g, '-') + '.json';
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    errors.push(`${path.relative(REPO_ROOT, file)}: ${err.message}`);
    return null;
  }
}

function listJsonFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => path.join(dir, f));
}

/**
 * The editor's connection gate, verbatim logic from
 * packages/noodl-editor/src/editor/src/models/nodelibrary/nodelibrary.ts
 * (canCastPortTypes): same type or wildcard always connects, otherwise the
 * runtime-exported typecast table decides.
 */
function canCast(typecasts, from, to) {
  if (from === '*' || to === '*') return true;
  if (from === to) return true;
  const cast = typecasts.find((c) => c.from === from);
  return !!cast && cast.to.includes(to);
}

function checkEnrichmentEntry(entry, file, catalogByType, exampleIds) {
  const rel = path.relative(REPO_ROOT, file);
  if (!entry || typeof entry.typeName !== 'string') {
    errors.push(`${rel}: missing typeName`);
    return null;
  }
  const node = catalogByType.get(entry.typeName);
  if (!node) {
    errors.push(`${rel}: typeName "${entry.typeName}" is not in the structural catalog`);
    return null;
  }
  const expected = fileNameForType(entry.typeName);
  if (path.basename(file) !== expected) {
    errors.push(`${rel}: filename should be "${expected}" for typeName "${entry.typeName}"`);
  }
  for (const field of ['summary', 'description', 'whenToUse']) {
    if (typeof entry[field] !== 'string' || !entry[field].trim()) {
      errors.push(`${rel}: required field "${field}" is missing or empty`);
    }
  }
  if (entry.summary && entry.summary.length > 140) {
    errors.push(`${rel}: summary exceeds 140 characters`);
  }
  if (node.dynamicPorts) {
    if (typeof entry.runtimeBehavior !== 'string' || !entry.runtimeBehavior.trim()) {
      errors.push(`${rel}: node has dynamic ports — "runtimeBehavior" is required`);
    }
  } else if (entry.runtimeBehavior) {
    errors.push(`${rel}: node has no dynamic ports — "runtimeBehavior" must be omitted`);
  }
  if (entry.ports) {
    const known = new Set([...node.inputs, ...node.outputs].map((p) => p.name));
    for (const portName of Object.keys(entry.ports)) {
      if (!node.dynamicPorts && !known.has(portName)) {
        errors.push(`${rel}: port note for unknown port "${portName}" on static node`);
      }
    }
  }
  if (!Array.isArray(entry.examples) || entry.examples.length === 0) {
    // Deprecated / picker-hidden nodes get minimal entries; examples would teach wirings we discourage.
    if (!node.isDeprecated && node.inNodePicker) warnings.push(`${rel}: no examples listed`);
  } else {
    for (const id of entry.examples) {
      if (!exampleIds.has(id)) {
        errors.push(`${rel}: references unknown example "${id}"`);
      }
    }
  }
  for (const related of entry.relatedNodes || []) {
    if (!catalogByType.has(related)) {
      errors.push(`${rel}: relatedNodes contains unknown type "${related}"`);
    }
  }
  return entry;
}

function checkExample(example, file, catalogByType) {
  const rel = path.relative(REPO_ROOT, file);
  if (!example || typeof example.id !== 'string') {
    errors.push(`${rel}: missing id`);
    return null;
  }
  if (path.basename(file) !== `${example.id}.json`) {
    errors.push(`${rel}: filename must equal "<id>.json" (id: "${example.id}")`);
  }
  for (const field of ['title', 'description']) {
    if (typeof example[field] !== 'string' || !example[field].trim()) {
      errors.push(`${rel}: required field "${field}" is missing or empty`);
    }
  }
  if (!Array.isArray(example.components) || example.components.length === 0) {
    errors.push(`${rel}: must contain at least one component`);
    return example;
  }
  const typesInGraph = new Set();
  for (const component of example.components) {
    for (const node of component.nodes || []) {
      typesInGraph.add(node.type);
      const catalogNode = catalogByType.get(node.type);
      if (catalogNode && !catalogNode.dynamicPorts && node.parameters) {
        const inputs = new Set(catalogNode.inputs.map((p) => p.name));
        for (const key of Object.keys(node.parameters)) {
          if (!inputs.has(key)) {
            errors.push(`${rel}: node "${node.id}" (${node.type}) has unknown parameter "${key}"`);
          }
        }
      }
    }
  }
  if (!Array.isArray(example.demonstrates) || example.demonstrates.length === 0) {
    errors.push(`${rel}: "demonstrates" must list at least one node type`);
  } else {
    for (const typeName of example.demonstrates) {
      if (!catalogByType.has(typeName)) {
        errors.push(`${rel}: demonstrates unknown type "${typeName}"`);
      } else if (!typesInGraph.has(typeName)) {
        errors.push(`${rel}: demonstrates "${typeName}" but the graph never uses it`);
      }
    }
  }
  return example;
}

function checkCompatibility(compat, typecasts) {
  const rel = path.relative(REPO_ROOT, COMPATIBILITY_JSON);
  if (!compat) return;

  const catalogPairs = new Set();
  for (const cast of typecasts) {
    for (const to of cast.to) catalogPairs.add(`${cast.from}→${to}`);
  }
  const documentedPairs = new Set(Object.keys(compat.castSemantics || {}));
  for (const pair of catalogPairs) {
    if (!documentedPairs.has(pair)) {
      errors.push(`${rel}: catalog typecast "${pair}" has no entry in castSemantics`);
    }
  }
  for (const pair of documentedPairs) {
    if (!catalogPairs.has(pair)) {
      errors.push(`${rel}: castSemantics documents "${pair}" which the catalog does not permit`);
    }
  }

  for (const pair of compat.verifiedPairs?.permitted || []) {
    if (!canCast(typecasts, pair.from, pair.to)) {
      errors.push(`${rel}: verifiedPairs.permitted ${pair.from}→${pair.to} is NOT permitted by the rules`);
    }
  }
  for (const pair of compat.verifiedPairs?.rejected || []) {
    if (canCast(typecasts, pair.from, pair.to)) {
      errors.push(`${rel}: verifiedPairs.rejected ${pair.from}→${pair.to} IS permitted by the rules`);
    }
  }
}

function orderedEntry(entry) {
  const out = {};
  for (const key of [
    'typeName',
    'summary',
    'description',
    'whenToUse',
    'ports',
    'runtimeBehavior',
    'examples',
    'patterns',
    'antiPatterns',
    'relatedNodes'
  ]) {
    if (entry[key] !== undefined) out[key] = entry[key];
  }
  return out;
}

function main() {
  const checkMode = process.argv.includes('--check');
  const requireCoverage = process.argv.includes('--require-coverage');

  const catalog = readJson(CATALOG_JSON);
  if (!catalog) {
    console.error(errors.join('\n'));
    process.exit(1);
  }
  const catalogByType = new Map(catalog.nodes.map((n) => [n.typeName, n]));

  const examples = [];
  const exampleIds = new Set();
  for (const file of listJsonFiles(EXAMPLES_DIR)) {
    const example = readJson(file);
    if (!example) continue;
    if (checkExample(example, file, catalogByType)) {
      if (exampleIds.has(example.id)) {
        errors.push(`duplicate example id "${example.id}"`);
      }
      exampleIds.add(example.id);
      examples.push(example);
    }
  }
  examples.sort((a, b) => (a.id < b.id ? -1 : 1));

  const enrichmentByType = new Map();
  for (const file of listJsonFiles(ENRICHMENT_DIR)) {
    const entry = checkEnrichmentEntry(readJson(file), file, catalogByType, exampleIds);
    if (!entry) continue;
    if (enrichmentByType.has(entry.typeName)) {
      errors.push(`duplicate enrichment entry for "${entry.typeName}"`);
      continue;
    }
    enrichmentByType.set(entry.typeName, entry);
  }

  const compatibility = fs.existsSync(COMPATIBILITY_JSON) ? readJson(COMPATIBILITY_JSON) : null;
  if (!compatibility) {
    warnings.push('docs/node-catalog/compatibility.json is missing');
  } else {
    checkCompatibility(compatibility, catalog.typecasts);
  }

  const undocumented = catalog.nodes.filter((n) => !enrichmentByType.has(n.typeName));
  for (const node of undocumented) {
    warnings.push(`catalog node "${node.typeName}" has no enrichment entry`);
  }
  if (requireCoverage && undocumented.length > 0) {
    errors.push(`--require-coverage: ${undocumented.length} catalog node(s) lack enrichment entries`);
  }

  const enriched = {
    ...catalog,
    enrichment: {
      version: '1.0.0',
      docs: 'docs/node-catalog/ENRICHMENT.md',
      coverage: {
        documented: catalog.nodes.length - undocumented.length,
        total: catalog.nodes.length
      }
    },
    compatibility: compatibility || undefined,
    examples,
    nodes: catalog.nodes.map((n) => {
      const entry = enrichmentByType.get(n.typeName);
      return entry ? { ...n, enrichment: orderedEntry(entry) } : n;
    })
  };
  const json = JSON.stringify(enriched, null, 2) + '\n';

  const dts = `/* GENERATED FILE — do not edit.
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
`;

  for (const w of warnings) console.warn(`warning: ${w}`);
  if (errors.length) {
    for (const e of errors) console.error(`error: ${e}`);
    process.exit(1);
  }

  console.log(
    `Enrichment: ${enrichmentByType.size}/${catalog.nodes.length} nodes documented, ` +
      `${examples.length} examples, compatibility ${compatibility ? 'present' : 'MISSING'}.`
  );

  if (checkMode) {
    const stale = [];
    for (const [file, expected] of [
      [OUT_JSON, json],
      [OUT_DTS, dts]
    ]) {
      const committed = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
      if (committed !== expected) stale.push(path.relative(REPO_ROOT, file));
    }
    if (stale.length) {
      console.error(
        `Stale enriched catalog: ${stale.join(', ')} does not match the authored inputs.\n` +
          'Run "npm run catalog:merge" and commit the result.'
      );
      process.exit(1);
    }
    console.log('Committed enriched catalog is up to date.');
  } else {
    fs.writeFileSync(OUT_JSON, json);
    fs.writeFileSync(OUT_DTS, dts);
    console.log(
      `Wrote ${path.relative(REPO_ROOT, OUT_JSON)} and ${path.relative(REPO_ROOT, OUT_DTS)}.`
    );
  }
}

main();
