/**
 * SUB-002 — Schema drift guard
 *
 * The whole-object round-trip suite proves the CURRENT fields survive. This
 * guard stops a NEW field from silently escaping the format: it walks every
 * real fixture, collects the property names that actually occur at each level
 * of the legacy project model, and asserts each one is representable in the v2
 * JSON schemas — either directly, via a documented rename, or because it is
 * decomposed into its own file.
 *
 * If a future real project (or a model change reflected in the corpus)
 * introduces a field no schema knows about, this fails and names the field —
 * rather than the field vanishing on the next save. Uses Jasmine matchers.
 *
 * @see dev-docs/tasks/phase-13-format-ai-substrate/NOTES.md
 */

import { LegacyProject } from '../../src/editor/src/io/ProjectExporter';

import projectSchema from '../../src/editor/src/schemas/project-v2.schema.json';
import nodesSchema from '../../src/editor/src/schemas/nodes.schema.json';
import connectionsSchema from '../../src/editor/src/schemas/connections.schema.json';
import stylesSchema from '../../src/editor/src/schemas/styles.schema.json';

/* eslint-disable @typescript-eslint/no-var-requires */
const FIXTURES: LegacyProject[] = [
  require('../testfs/import_proj1/project.json'),
  require('../testfs/import_proj2/project.json'),
  require('../testfs/watchproject/project.json'),
  require('../testfs/import_proj5/project.json'),
  require('../testfs/git-repo-utf8/project.json'),
  require('../testfs/big-merge-test-mine/project.json'),
  require('./fixtures/synthetic-awkward.project.json')
];
/* eslint-enable @typescript-eslint/no-var-requires */

const schemaProps = (schema: any): string[] => Object.keys(schema.properties ?? {});
const nodeDefProps = (): string[] => Object.keys(nodesSchema.definitions.node.properties);
const variantDefProps = (): string[] => Object.keys(stylesSchema.definitions.variant.properties);

/** Collect the union of own-property names across a set of objects. */
function keyUnion(objects: Array<Record<string, unknown> | undefined>): Set<string> {
  const keys = new Set<string>();
  for (const o of objects) {
    if (o) for (const k of Object.keys(o)) keys.add(k);
  }
  return keys;
}

function walkNodes(roots: any[] | undefined, visit: (n: any) => void): void {
  for (const n of roots ?? []) {
    visit(n);
    walkNodes(n.children, visit);
  }
}

/** Assert `observed ⊆ allowed`, failing with the offending keys named. */
function expectRepresentable(level: string, observed: Set<string>, allowed: string[]): void {
  const allowedSet = new Set(allowed);
  const orphans = [...observed].filter((k) => !allowedSet.has(k));
  if (orphans.length > 0) {
    fail(
      `${level}: field(s) [${orphans.join(', ')}] appear in real projects but have no ` +
        `representation in the v2 schemas. Add them to the schema + exporter/importer ` +
        `(SUB-002), or extend the documented allow-list if intentionally derived.`
    );
  }
  expect(orphans).toEqual([]);
}

describe('schema drift guard', () => {
  it('every project-level field is representable', () => {
    const observed = keyUnion(FIXTURES as any);
    // Schema props + fields decomposed into their own files.
    const allowed = [
      ...schemaProps(projectSchema),
      'components', // → components/<path>/*.json
      'variants' // → nodegx.styles.json
    ];
    expectRepresentable('project', observed, allowed);
  });

  it('every component-level field is representable', () => {
    const observed = keyUnion(FIXTURES.flatMap((p) => p.components) as any);
    const allowed = [
      ...schemaProps(require('../../src/editor/src/schemas/component.schema.json')),
      'graph' // → nodes.json + connections.json
    ];
    expectRepresentable('component', observed, allowed);
  });

  it('every graph-level field is representable', () => {
    const graphs = FIXTURES.flatMap((p) => p.components.map((c) => c.graph));
    const observed = keyUnion(graphs as any);
    // roots/connections are the graph body; visualRoots/comments live in nodes.json.
    const allowed = ['roots', 'connections', ...schemaProps(nodesSchema)];
    expectRepresentable('graph', observed, allowed);
  });

  it('every node-level field is representable', () => {
    const observed = new Set<string>();
    for (const p of FIXTURES) {
      for (const c of p.components) {
        walkNodes(c.graph?.roots, (n) => Object.keys(n).forEach((k) => observed.add(k)));
      }
    }
    expectRepresentable('node', observed, nodeDefProps());
  });

  it('every variant-level field is representable (accounting for the stateParamaters typo)', () => {
    const observed = keyUnion(FIXTURES.flatMap((p) => p.variants ?? []) as any);
    // Legacy uses the misspelling `stateParamaters`; v2 stores it as `stateParameters`.
    const allowed = [...variantDefProps(), 'stateParamaters'];
    expectRepresentable('variant', observed, allowed);
  });

  it('every metadata.styles sub-key is representable (colors + text→textStyles)', () => {
    const styleObjs = FIXTURES.map((p) => (p.metadata as any)?.styles).filter(Boolean);
    const observed = keyUnion(styleObjs);
    // Legacy `text` maps to schema `textStyles`; `colors` maps directly.
    const allowed = ['colors', 'text'];
    expectRepresentable('metadata.styles', observed, allowed);
  });
});
