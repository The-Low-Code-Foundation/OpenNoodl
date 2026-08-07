#!/usr/bin/env node
/**
 * Node catalog generator (SUB-004).
 *
 * Bundles extractor-entry.js with esbuild (the viewer packages ship TS/JSX
 * that assumes a browser), runs it headlessly in a child Node process, and
 * writes:
 *
 *   packages/noodl-types/src/node-catalog.json  — the catalog artifact
 *   packages/noodl-types/src/node-catalog.d.ts  — types generated from it
 *
 * Modes:
 *   node scripts/node-catalog/generate.js           regenerate artifacts
 *   node scripts/node-catalog/generate.js --check   fail if committed
 *                                                   artifacts are stale
 *   node scripts/node-catalog/generate.js --out-dir <dir>
 *                                                   write elsewhere, leaving the
 *                                                   committed artifacts untouched
 *
 * `--out-dir` exists because regeneration is a whole-file rewrite of an artifact other work may
 * be holding: it folds in every uncommitted node-source edit in the tree, so a generator change
 * cannot be validated by running it in place without also publishing whatever else is dirty.
 *
 * Output is deterministic; the generator runs the extraction twice and
 * asserts byte-identical results before writing anything.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { bundleEntry } = require('./lib/bundle');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const OUT_JSON = path.join(REPO_ROOT, 'packages/noodl-types/src/node-catalog.json');
const OUT_DTS = path.join(REPO_ROOT, 'packages/noodl-types/src/node-catalog.d.ts');

function runExtractor(bundlePath, workDir, label) {
  const outPath = path.join(workDir, `catalog-${label}.json`);
  const result = spawnSync(process.execPath, [bundlePath], {
    env: { ...process.env, NODE_CATALOG_OUT: outPath },
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024
  });
  if (result.status !== 0) {
    process.stderr.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
    throw new Error(`Extractor run "${label}" failed with exit code ${result.status}`);
  }
  return fs.readFileSync(outPath, 'utf8');
}

function emitTypes(catalog) {
  const union = (values) => values.map((v) => `  | '${v.replace(/'/g, "\\'")}'`).join('\n');

  const typeNames = catalog.nodes.map((n) => n.typeName);
  const categories = [...new Set(catalog.nodes.map((n) => n.category).filter(Boolean))].sort();

  return `/* GENERATED FILE — do not edit.
 * Regenerate with: npm run catalog:generate
 * Source of truth: the live node registries (see scripts/node-catalog/).
 * Field semantics: docs/node-catalog/SCHEMA.md
 */

/** Canonical node type strings as they appear in project files (\`node.type\`). */
export type NodeTypeName =
${union(typeNames)};

/** Node palette categories present in the registries. */
export type NodeCategory =
${union(categories)};

/** Port value type names present in the registries. */
export type PortTypeName =
${union(catalog.portTypeNames)};

export type RuntimeEnvironment = 'browser' | 'cloud';

export type DynamicPortMechanism =
  | 'declared-port-groups'
  | 'numbered-inputs'
  | 'component-ports'
  | 'runtime-discovered'
  | 'editor-adapter';

export interface PortType {
  name: PortTypeName | string;
  enums?: Array<{ label: string; value: string } | string>;
  /** Present when the enum list is computed at runtime and not statically known. */
  enumsAreDynamic?: boolean;
  units?: string[];
  defaultUnit?: string;
  allowConnectionsOnly?: boolean;
  allowEditOnly?: boolean;
  [extra: string]: unknown;
}

export interface CatalogPort {
  name: string;
  displayName?: string;
  editorName?: string;
  group?: string;
  plug: 'input' | 'output';
  type: PortType;
  isSignal: boolean;
  default?: unknown;
  description?: string;
  index?: number;
  allowVisualStates?: boolean;
  /** True for ports the editor UI does not expose; avoid authoring against them. */
  hiddenInEditor?: boolean;
}

export interface NumberedInputSpec {
  nameBase: string;
  displayPrefix?: string;
  group?: string;
  type?: PortType;
  index?: number;
}

export interface DynamicPortInfo {
  mechanisms: DynamicPortMechanism[];
  description: string;
  declaredPortGroups?: unknown[];
  numberedInputs?: NumberedInputSpec[];
  editorAdapter?: string;
}

/**
 * One key formula in a node's \`parameters\` object (SUB-013).
 *
 * Every field is observed, not written by hand: the generator drives the node's real
 * dynamic-port hook with seed parameters and records what it emits. \`example\` is a name the
 * runtime actually produced.
 */
export interface ParameterPattern {
  /** The key formula, with \`<variable>\` placeholders. E.g. \`value-<state>-<value>\`. */
  pattern: string;
  plug: 'input' | 'output' | 'input/output';
  /** What each \`<variable>\` stands for, and which parameter it is drawn from. */
  variables?: Record<string, string>;
  /** The editor property group these ports appear under; may itself be templated. */
  group?: string;
  /**
   * The port's value type. A literal type name when it is fixed, \`"varies"\` when it is not,
   * or a sentence naming the parameter it follows — for \`States\`, the value type of
   * \`value-<state>-<value>\` is chosen by the matching \`type-<value>\` parameter.
   */
  valueType?: string;
  /** A real emitted port name, preferring one that shows verbatim interpolation. */
  example: string;
}

/**
 * How to write the keys of this node's \`parameters\` object (SUB-013).
 *
 * \`known: false\` is a deliberate statement, not a gap: the node's port names could not be
 * determined without project context (a live component, a backend schema, user code), and
 * \`reason\` says which. It is the same reasoning as the validator's \`DynamicPortSkipped\` —
 * a check that was knowingly not performed beats silent absence.
 *
 * \`known: true\` with an empty \`patterns\` array means the node computes no names at all: its
 * dynamism is visibility only, and every port it can have is already in \`inputs\`/\`outputs\`.
 */
export type ParameterEncoding =
  | {
      known: true;
      /** Parameters whose values the keys are derived from. Empty when they are not. */
      seededBy: string[];
      /** Project metadata the keys come from instead, e.g. \`dbCollections\`. */
      seededByProjectMetadata?: string[];
      patterns: ParameterPattern[];
      notes?: string;
    }
  | { known: false; reason: string };

export interface CatalogNode {
  typeName: NodeTypeName;
  displayName: string;
  category?: NodeCategory;
  isVisual: boolean;
  isDeprecated: boolean;
  /** False for legacy/superseded types or ones created only through specialised flows; avoid authoring these. */
  inNodePicker: boolean;
  availableIn: RuntimeEnvironment[];
  providedBy: 'noodl-runtime' | 'noodl-viewer-react' | 'noodl-viewer-cloud' | 'noodl-editor';
  /**
   * Server-side-rendering compatibility (RUN-002). Present on every
   * browser-available type; absent for cloud-only types, where it does not
   * apply. "safe" runs fully server-side; "partial" runs but with the caveat
   * in note; "client-only" is created inert on the SSR server (ports exist,
   * logic deferred to the browser after hydration).
   */
  ssr?: { compat: 'safe' | 'partial' | 'client-only'; note?: string };
  docs?: string;
  searchTags?: string[];
  module?: string;
  shortDesc?: string;
  singleton?: boolean;
  allowAsChild?: boolean;
  allowChildrenWithCategory?: string[];
  allowAsExportRoot?: boolean;
  useVariants?: boolean;
  visualStates?: Array<{ name: string; label: string }>;
  inputs: CatalogPort[];
  outputs: CatalogPort[];
  dynamicPorts: DynamicPortInfo | null;
  /**
   * How to write the keys of this node's \`parameters\` object. Non-null for exactly the nodes
   * with a \`dynamicPorts\` block — \`dynamicPorts\` says the ports exist, this says what they
   * are called.
   */
  parameterEncoding: ParameterEncoding | null;
}

export interface Typecast {
  from: string;
  to: string[];
}

export interface NodeCatalog {
  catalogFormatVersion: string;
  generatedBy: string;
  schemaDocs: string;
  packages: Record<string, string>;
  portTypeNames: string[];
  typecasts: Typecast[];
  nodes: CatalogNode[];
}
`;
}

async function main() {
  const checkMode = process.argv.includes('--check');
  const outDirIndex = process.argv.indexOf('--out-dir');
  const outDir = outDirIndex === -1 ? null : process.argv[outDirIndex + 1];
  if (outDirIndex !== -1 && !outDir) throw new Error('--out-dir needs a directory');
  const targetJson = outDir ? path.join(outDir, path.basename(OUT_JSON)) : OUT_JSON;
  const targetDts = outDir ? path.join(outDir, path.basename(OUT_DTS)) : OUT_DTS;

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'node-catalog-'));
  try {
    const bundlePath = await bundleEntry(path.join(__dirname, 'extractor-entry.js'), workDir);

    const first = runExtractor(bundlePath, workDir, 'run1');
    const second = runExtractor(bundlePath, workDir, 'run2');
    if (first !== second) {
      throw new Error('Non-deterministic output: two extractor runs differed. Fix the generator before publishing.');
    }

    const catalog = JSON.parse(first);
    const dts = emitTypes(catalog);

    const dynamic = catalog.nodes.filter((n) => n.dynamicPorts);
    console.log(
      `Catalog: ${catalog.nodes.length} node types, ` +
        `${dynamic.length} with dynamic ports, ` +
        `${catalog.portTypeNames.length} port value types.`
    );

    // SUB-013 criterion 1 — no silent gaps. Every node with dynamic ports carries an encoding,
    // either with patterns or with an explicit reason it has none. Asserted rather than
    // reported: a missing block would otherwise read to a consumer exactly like "no encoding
    // needed", which is the ambiguity the field exists to remove.
    const missing = dynamic.filter((n) => !n.parameterEncoding).map((n) => n.typeName);
    if (missing.length) {
      throw new Error(`Nodes with dynamic ports but no parameterEncoding: ${missing.join(', ')}`);
    }
    const withPatterns = dynamic.filter((n) => n.parameterEncoding.known && n.parameterEncoding.patterns.length);
    const visibilityOnly = dynamic.filter((n) => n.parameterEncoding.known && !n.parameterEncoding.patterns.length);
    console.log(
      `Parameter encodings: ${withPatterns.length} with key formulas, ` +
        `${visibilityOnly.length} that compute no names, ` +
        `${dynamic.length - withPatterns.length - visibilityOnly.length} recorded as not statically knowable.`
    );

    if (checkMode) {
      const stale = [];
      // --check always compares against the committed artifacts; --out-dir is a write option.
      const current = { [OUT_JSON]: first, [OUT_DTS]: dts };
      for (const [file, expected] of Object.entries(current)) {
        const committed = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
        if (committed !== expected) stale.push(path.relative(REPO_ROOT, file));
      }
      if (stale.length) {
        console.error(
          `Stale node catalog: ${stale.join(', ')} does not match the registries.\n` +
            'Run "npm run catalog:generate" and commit the result.'
        );
        process.exit(1);
      }
      console.log('Committed catalog is up to date.');
    } else {
      if (outDir) fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(targetJson, first);
      fs.writeFileSync(targetDts, dts);
      console.log(`Wrote ${targetJson} and ${targetDts}.`);
    }
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
