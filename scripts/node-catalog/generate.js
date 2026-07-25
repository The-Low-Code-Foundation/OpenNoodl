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
 *
 * Output is deterministic; the generator runs the extraction twice and
 * asserts byte-identical results before writing anything.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const esbuild = require('esbuild');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const OUT_JSON = path.join(REPO_ROOT, 'packages/noodl-types/src/node-catalog.json');
const OUT_DTS = path.join(REPO_ROOT, 'packages/noodl-types/src/node-catalog.d.ts');

async function bundleExtractor(workDir) {
  const outfile = path.join(workDir, 'extractor.bundle.js');
  await esbuild.build({
    entryPoints: [path.join(__dirname, 'extractor-entry.js')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile,
    alias: { '@noodl/runtime': path.join(REPO_ROOT, 'packages/noodl-runtime') },
    loader: {
      '.css': 'empty',
      '.svg': 'empty',
      '.png': 'empty',
      '.jpg': 'empty',
      '.gif': 'empty',
      '.woff': 'empty',
      '.woff2': 'empty'
    },
    plugins: [
      {
        // noodl-viewer-react/src/types.ts exports only TS types, but a few
        // modules import identifiers from it that also exist as runtime
        // globals (`Noodl.*`), which esbuild cannot elide cross-file. Replace
        // the module with recursive noop proxies; none of it runs during
        // registration.
        name: 'stub-type-only-modules',
        setup(build) {
          const typeModule = path.join(REPO_ROOT, 'packages/noodl-viewer-react/src/types.ts');
          build.onResolve({ filter: /^\.\.?\/.*types$/ }, (args) => {
            if (path.resolve(args.resolveDir, args.path) + '.ts' === typeModule) {
              return { path: typeModule, namespace: 'type-stub' };
            }
            return null;
          });
          build.onLoad({ filter: /.*/, namespace: 'type-stub' }, () => ({
            contents: `
              const noop = new Proxy(function () {}, { get: () => noop, apply: () => noop });
              module.exports = new Proxy({}, { get: () => noop });
            `,
            loader: 'js'
          }));
        }
      }
    ],
    logLevel: 'warning'
  });
  return outfile;
}

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

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'node-catalog-'));
  try {
    const bundlePath = await bundleExtractor(workDir);

    const first = runExtractor(bundlePath, workDir, 'run1');
    const second = runExtractor(bundlePath, workDir, 'run2');
    if (first !== second) {
      throw new Error('Non-deterministic output: two extractor runs differed. Fix the generator before publishing.');
    }

    const catalog = JSON.parse(first);
    const dts = emitTypes(catalog);

    console.log(
      `Catalog: ${catalog.nodes.length} node types, ` +
        `${catalog.nodes.filter((n) => n.dynamicPorts).length} with dynamic ports, ` +
        `${catalog.portTypeNames.length} port value types.`
    );

    if (checkMode) {
      const stale = [];
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
      fs.writeFileSync(OUT_JSON, first);
      fs.writeFileSync(OUT_DTS, dts);
      console.log(`Wrote ${path.relative(REPO_ROOT, OUT_JSON)} and ${path.relative(REPO_ROOT, OUT_DTS)}.`);
    }
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
