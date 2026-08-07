/**
 * SUB-002 — Round-Trip Fidelity (whole-object)
 *
 * Proves that a real legacy project survives export → import unchanged, using
 * whole-object equality rather than field-by-field checks. This is the guard
 * that stops the v2 writer (wired in by SUB-001) from silently destroying user
 * data on save.
 *
 * Fixtures are REAL projects taken verbatim from tests/testfs/ (the same corpus
 * the git/import suites use), plus one synthetic project that exercises the
 * awkward fields no real project in the repo happens to set (lesson, visualRoots,
 * variant conflicts, non-array routes, dynamic-port nodes, deep nesting).
 *
 * Normalisation: the v2 format intentionally omits empty collections — an
 * established, tested contract (see ProjectExporter.test.ts, "omits empty
 * parameters object"). An empty `{}`/`[]` and an absent key are semantically
 * identical in this format (the editor recomputes ports on load; an empty
 * parameter bag carries no data). We therefore strip empty collections from
 * BOTH sides before comparing. Because the same normaliser is applied to both,
 * any genuine (non-empty) difference still fails the assertion — only the
 * empty-vs-absent noise is collapsed. Uses Jasmine matchers (Electron runner).
 *
 * @see dev-docs/tasks/phase-13-format-ai-substrate/NOTES.md (field audit)
 */

import { ProjectExporter, LegacyProject, legacyNameToPath } from '../../src/editor/src/io/ProjectExporter';
import { ProjectImporter, ImportInput } from '../../src/editor/src/io/ProjectImporter';
import type {
  ComponentV2File,
  ConnectionsV2File,
  NodesV2File,
  ProjectV2File,
  RegistryV2File,
  RoutesV2File,
  StylesV2File
} from '../../src/editor/src/schemas';
import { contentAt, metadataAt } from './v2-files';

// Real fixtures loaded via require() to skip TypeScript's deep literal inference
// (big-merge-test-mine is ~4.7MB — typing it as a literal would be pathological).
/* eslint-disable @typescript-eslint/no-var-requires */
const trivial = require('../testfs/import_proj2/project.json') as LegacyProject; // {id,name,components,version}
const smallRootNode = require('../testfs/import_proj1/project.json') as LegacyProject; // rootNodeId + variants
const thumbnail = require('../testfs/watchproject/project.json') as LegacyProject; // thumbnailURI top-level key
const variantsStyles = require('../testfs/import_proj5/project.json') as LegacyProject; // variants + styles.{colors,text}
const commentsLarge = require('../testfs/git-repo-utf8/project.json') as LegacyProject; // 44 comps, comments
const xlarge = require('../testfs/big-merge-test-mine/project.json') as LegacyProject; // 176 comps — scale
const syntheticAwkward = require('./fixtures/synthetic-awkward.project.json') as LegacyProject;
// SUB-011: object-valued (inline expression) parameters — see expression-parameters.test.ts
const expressionParameters = require('./fixtures/expression-parameters.project.json') as LegacyProject;
/* eslint-enable @typescript-eslint/no-var-requires */

// ── Round-trip bridge ────────────────────────────────────────────────────────

/** Export a project to v2 files, then import them straight back to legacy. */
function roundTrip(project: LegacyProject): LegacyProject {
  const exporter = new ProjectExporter();
  const importer = new ProjectImporter();
  const result = exporter.export(project);

  const components: ImportInput['components'] = {};
  for (const comp of project.components) {
    const compPath = legacyNameToPath(comp.name);
    const component = contentAt<ComponentV2File>(result, `components/${compPath}/component.json`);
    const nodes = contentAt<NodesV2File>(result, `components/${compPath}/nodes.json`);
    const connections = contentAt<ConnectionsV2File>(result, `components/${compPath}/connections.json`);
    if (component && nodes && connections) {
      components[compPath] = { component, nodes, connections };
    }
  }

  const routes = contentAt<RoutesV2File>(result, 'nodegx.routes.json');
  const styles = contentAt<StylesV2File>(result, 'nodegx.styles.json');

  const input: ImportInput = {
    project: contentAt<ProjectV2File>(result, 'nodegx.project.json'),
    registry: contentAt<RegistryV2File>(result, 'components/_registry.json'),
    ...(routes ? { routes } : {}),
    ...(styles ? { styles } : {}),
    components
  };

  return importer.import(input).project;
}

/**
 * Recursively remove empty plain objects and empty arrays. Preserves every
 * primitive (including 0, false, "", null). Applied symmetrically to both the
 * original and the round-tripped project — see the file header for why this is
 * sound.
 */
function stripEmpty<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((v) => stripEmpty(v)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const cleaned = stripEmpty(v);
      const isEmptyObj =
        cleaned !== null &&
        typeof cleaned === 'object' &&
        !Array.isArray(cleaned) &&
        Object.keys(cleaned).length === 0;
      const isEmptyArr = Array.isArray(cleaned) && cleaned.length === 0;
      if (isEmptyObj || isEmptyArr) continue;
      out[k] = cleaned;
    }
    return out as T;
  }
  return value;
}

const CORPUS: Array<{ name: string; project: LegacyProject }> = [
  { name: 'trivial (import_proj2)', project: trivial },
  { name: 'rootNodeId + variants (import_proj1)', project: smallRootNode },
  { name: 'thumbnailURI (watchproject)', project: thumbnail },
  { name: 'variants + styles (import_proj5)', project: variantsStyles },
  { name: 'comments, 44 components (git-repo-utf8)', project: commentsLarge },
  { name: 'xlarge, 176 components (big-merge-test-mine)', project: xlarge },
  { name: 'synthetic awkward (all edge fields)', project: syntheticAwkward },
  { name: 'object-valued expression parameters (SUB-011)', project: expressionParameters }
];

// ── Whole-object round-trip ──────────────────────────────────────────────────

describe('round-trip fidelity (whole-object)', () => {
  for (const { name, project } of CORPUS) {
    it(`preserves every field of: ${name}`, () => {
      const out = roundTrip(project);
      expect(stripEmpty(out)).toEqual(stripEmpty(project));
    });
  }
});

// ── Targeted per-field specs (name the field on regression) ──────────────────

describe('round-trip fidelity — previously-dropped fields', () => {
  it('carries project.rootNodeId', () => {
    expect(roundTrip(smallRootNode).rootNodeId).toEqual(smallRootNode.rootNodeId);
    expect(smallRootNode.rootNodeId).toBeDefined();
  });

  it('carries project.id', () => {
    expect(roundTrip(trivial).id).toEqual(trivial.id);
    expect(trivial.id).toBeDefined();
  });

  it('carries project.thumbnailURI', () => {
    expect(thumbnail.thumbnailURI).toBeDefined();
    expect(roundTrip(thumbnail).thumbnailURI).toEqual(thumbnail.thumbnailURI);
  });

  it('carries project.lesson', () => {
    expect(roundTrip(syntheticAwkward).lesson).toEqual(syntheticAwkward.lesson);
  });

  it('carries graph.comments', () => {
    const withComments = commentsLarge.components.find((c) => c.graph?.comments?.length);
    expect(withComments).toBeDefined();
    const out = roundTrip(commentsLarge);
    const outComp = out.components.find((c) => c.name === withComments!.name)!;
    expect(outComp.graph.comments).toEqual(withComments!.graph.comments);
  });

  it('carries graph.visualRoots', () => {
    const out = roundTrip(syntheticAwkward);
    expect(out.components[0].graph.visualRoots).toEqual(['node-a', 'node-c']);
  });

  it('carries variant conflicts', () => {
    const out = roundTrip(syntheticAwkward);
    expect(out.variants![0].conflicts).toEqual([{ property: 'cornerRadius', kind: 'Changed' }]);
  });

  it('carries legacy styles.text (was read under the wrong key)', () => {
    const out = roundTrip(variantsStyles);
    expect(metadataAt(out, ['styles', 'text'])).toEqual(metadataAt(variantsStyles, ['styles', 'text']));
    expect(metadataAt(variantsStyles, ['styles', 'text'])).toBeDefined();
  });

  it('carries non-array routes (stays in metadata)', () => {
    const out = roundTrip(syntheticAwkward);
    expect(metadataAt(out, ['routes'])).toEqual(metadataAt(syntheticAwkward, ['routes']));
  });

  it('carries dynamic ports on nodes', () => {
    const out = roundTrip(syntheticAwkward);
    const exprNode = out.components[0].graph.roots[0].children![0];
    expect(exprNode.dynamicports).toEqual([
      { name: 'a', type: 'number', plug: 'input' },
      { name: 'b', type: 'number', plug: 'input' }
    ]);
  });
});

// ── Assertion-sensitivity (the negative test) ────────────────────────────────

describe('round-trip fidelity — assertion is sensitive to loss', () => {
  it('detects a dropped field (proves the suite would catch a regression)', () => {
    // Simulate an exporter that forgets comments by deleting them post-export.
    const exporter = new ProjectExporter();
    const importer = new ProjectImporter();
    const result = exporter.export(commentsLarge);

    const components: ImportInput['components'] = {};
    for (const comp of commentsLarge.components) {
      const compPath = legacyNameToPath(comp.name);
      const nodes = contentAt<NodesV2File>(result, `components/${compPath}/nodes.json`);
      if (nodes) delete nodes.comments; // <-- the simulated regression
      components[compPath] = {
        component: contentAt<ComponentV2File>(result, `components/${compPath}/component.json`),
        nodes,
        connections: contentAt<ConnectionsV2File>(result, `components/${compPath}/connections.json`)
      };
    }
    const damaged = importer.import({
      project: contentAt<ProjectV2File>(result, 'nodegx.project.json'),
      registry: contentAt<RegistryV2File>(result, 'components/_registry.json'),
      styles: contentAt<StylesV2File>(result, 'nodegx.styles.json'),
      components
    }).project;

    expect(stripEmpty(damaged)).not.toEqual(stripEmpty(commentsLarge));
  });
});
