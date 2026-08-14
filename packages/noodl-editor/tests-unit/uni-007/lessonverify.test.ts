/**
 * UNI-007 — the static two-vocabulary check.
 *
 * These tests run under jest rather than in the jasmine/electron suite where the
 * other lesson tests live, and that is the point: UNI-010 runs this verifier
 * inside an MCP sidecar with no renderer around it, so a runner that needs
 * Electron to start would be testing it in the one environment it does not have
 * to work in (jest.config.js, the OBS-002 rule).
 *
 * The `real catalog` block is a **corpus guard**, not a fixture check. It asserts
 * the shape of the shipped `node-catalog.json` directly, so a catalog change that
 * creates a new ambiguity or retires a node fails here rather than in a learner's
 * lesson. The counts below were re-derived from the catalog on 2026-08-14 and
 * corrected LESSON-FORMAT.md §3, which recorded nine divergences and named
 * `Variable` as safe.
 */

import {
  LessonVocabulary,
  defaultLessonVocabulary,
  formatLessonFindings,
  typeNamesInCondition,
  typeNamesInPath,
  verifyLessonManifest,
  verifyLessonSource
} from '../../src/editor/src/models/lessonverify';
import { defaultCatalog } from '../../src/editor/src/validation/catalog';
import type { LessonManifest } from '../../src/editor/src/models/lessonformat';

// ─── A tiny hand-built catalog, so the classifier is tested on its own terms ──

function catalogNode(typeName: string, displayName: string, isDeprecated = false) {
  return {
    typeName,
    displayName,
    isVisual: true,
    isDeprecated,
    inNodePicker: !isDeprecated,
    availableIn: ['browser'],
    providedBy: 'noodl-runtime',
    inputs: [],
    outputs: [],
    dynamicPorts: null,
    parameterEncoding: null
  };
}

/** One node of each class the classifier distinguishes. */
const fakeCatalog = {
  nodes: [
    catalogNode('Group', 'Group'), // clean
    catalogNode('For Each', 'Repeater'), // plain divergence
    catalogNode('Collection', 'Array', true), // ambiguous pair, deprecated half
    catalogNode('Collection2', 'Array'), // ambiguous pair, live half
    catalogNode('Variable', 'Variable', true), // shadowed: deprecated type…
    catalogNode('Variable2', 'Variable') // …live node displayed under the same string
  ]
};

const vocabulary = new LessonVocabulary(fakeCatalog as never);

describe('LessonVocabulary.classifyTypeName', () => {
  it('accepts a live type name whose display name matches it', () => {
    expect(vocabulary.classifyTypeName('Group').code).toBe('ok');
  });

  it('accepts a live type name that diverges from its display name', () => {
    expect(vocabulary.classifyTypeName('For Each').code).toBe('ok');
  });

  it('rejects a display name, and suggests the type name it maps to', () => {
    const verdict = vocabulary.classifyTypeName('Repeater');
    expect(verdict.code).toBe('display-name-used');
    expect(verdict.severity).toBe('error');
    expect(verdict.suggestion).toBe('For Each');
  });

  it('rejects an ambiguous display name and offers NO substitution', () => {
    const verdict = vocabulary.classifyTypeName('Array');
    expect(verdict.code).toBe('ambiguous-display-name');
    expect(verdict.severity).toBe('error');
    // The whole point: choosing for the author is how a condition ends up
    // resolving to the wrong one of two nodes (failure class F3).
    expect(verdict.suggestion).toBeUndefined();
    expect(verdict.candidates).toEqual(['Collection', 'Collection2']);
  });

  it('rejects a name that IS a real type when that type is the shadowed, deprecated one', () => {
    // The class an existence check cannot catch: "Variable" names a real catalog
    // entry, so `hasType('Variable')` is true, and the learner still cannot pass.
    const verdict = vocabulary.classifyTypeName('Variable');
    expect(verdict.code).toBe('shadowed-by-deprecated');
    expect(verdict.severity).toBe('error');
    expect(verdict.suggestion).toBe('Variable2');
  });

  it('rejects a string that is neither vocabulary, with a near-miss suggestion', () => {
    const verdict = vocabulary.classifyTypeName('Grup');
    expect(verdict.code).toBe('unknown-node-type');
    expect(verdict.suggestion).toBe('Group');
  });

  it('warns, but does not reject, a deprecated type nothing else shadows', () => {
    const soloDeprecated = new LessonVocabulary({
      nodes: [catalogNode('OldThing', 'Old Thing', true)]
    } as never);
    const verdict = soloDeprecated.classifyTypeName('OldThing');
    expect(verdict.code).toBe('deprecated-node-type');
    expect(verdict.severity).toBe('warning');
  });
});

// ─── Where the verifier looks ────────────────────────────────────────────────

describe('typeNamesInPath', () => {
  it('reads only %-prefixed segments — never the component name, label or index', () => {
    expect(typeNamesInPath('Start Page:#My Group:%Text')).toEqual(['Text']);
    expect(typeNamesInPath('App:%Group:0:%Text')).toEqual(['Group', 'Text']);
  });

  it('does not treat the leading component name as a type, even when %-prefixed', () => {
    // Segment 0 is always a component name; `findNodeWithPath` never type-matches it.
    expect(typeNamesInPath('%Group:#Card')).toEqual([]);
  });

  it('returns nothing for a path made only of labels and indices', () => {
    expect(typeNamesInPath('App:#Card:1')).toEqual([]);
  });
});

describe('typeNamesInCondition', () => {
  it('reads hasType and the path together', () => {
    expect(typeNamesInCondition({ node: 'App:%Group', hasType: 'Text' })).toEqual(['Group', 'Text']);
  });

  it('reads both ends of a connection condition', () => {
    expect(
      typeNamesInCondition({
        connection: { from: 'App:%Button', to: 'App:%Text', fromPort: 'click', toPort: 'show' }
      })
    ).toEqual(['Button', 'Text']);
  });

  it('reads nothing from conditions that name no node type', () => {
    expect(typeNamesInCondition({ previewRouteEquals: '/Home' })).toEqual([]);
    expect(typeNamesInCondition({ node: 'App:#Card', hasLabel: 'Card' })).toEqual([]);
  });
});

// ─── The verifier over whole manifests ───────────────────────────────────────

function manifest(steps: LessonManifest['steps']): LessonManifest {
  return { format: 'noodl-lesson@1', title: 'T', steps };
}

describe('verifyLessonManifest', () => {
  const opts = { vocabulary };

  it('passes a lesson whose conditions use type names', () => {
    const report = verifyLessonManifest(
      manifest([
        { kind: 'popup', body: 'Hello' },
        { title: 'Add a Repeater', completeWhen: [{ node: 'App:%For Each', exists: true }] }
      ]),
      opts
    );
    expect(report.ok).toBe(true);
    expect(report.findings).toEqual([]);
  });

  it('catches the silent failure: prose vocabulary in a condition', () => {
    // This lesson is correct prose and broken logic. Before this check it
    // installed clean and told the learner they had not done a completed step.
    const report = verifyLessonManifest(
      manifest([{ title: 'Add a Repeater', completeWhen: [{ node: 'App:%Repeater', exists: true }] }]),
      opts
    );
    expect(report.ok).toBe(false);
    expect(report.findings).toHaveLength(1);
    expect(report.findings[0].code).toBe('display-name-used');
    expect(report.findings[0].value).toBe('Repeater');
    expect(report.findings[0].suggestion).toBe('For Each');
    expect(report.findings[0].step).toBe(0);
    expect(report.findings[0].where).toBe('Step 1 ("Add a Repeater") condition 1');
  });

  it('rejects an ambiguous name rather than repairing it', () => {
    const report = verifyLessonManifest(manifest([{ completeWhen: [{ node: 'App:%Array', exists: true }] }]), opts);
    expect(report.ok).toBe(false);
    expect(report.findings[0].code).toBe('ambiguous-display-name');
    expect(report.findings[0].suggestion).toBeUndefined();
  });

  it('reports a warning without failing the lesson', () => {
    const soloDeprecated = {
      vocabulary: new LessonVocabulary({ nodes: [catalogNode('OldThing', 'Old Thing', true)] } as never)
    };
    const report = verifyLessonManifest(
      manifest([{ completeWhen: [{ node: 'App:%OldThing', exists: true }] }]),
      soloDeprecated
    );
    expect(report.ok).toBe(true);
    expect(report.findings[0].severity).toBe('warning');
  });

  it('finds every bad name across steps and conditions, not just the first', () => {
    const report = verifyLessonManifest(
      manifest([
        { completeWhen: [{ node: 'App:%Repeater', exists: true }] },
        {
          completeWhen: [
            { node: 'App:%Array', exists: true },
            { node: 'App:%Group', hasType: 'Variable' }
          ]
        }
      ]),
      opts
    );
    expect(report.findings.map((f) => f.code)).toEqual([
      'display-name-used',
      'ambiguous-display-name',
      'shadowed-by-deprecated'
    ]);
  });

  it('reports a malformed lesson as a finding rather than throwing', () => {
    // Both producers of this format hand it machine-written JSON; a verifier that
    // throws is one whose caller has to guess.
    const report = verifyLessonManifest({ steps: [{ completeWhen: [{ node: 'App' } as never] }] }, opts);
    expect(report.ok).toBe(false);
    expect(report.findings.some((f) => f.code === 'malformed-lesson')).toBe(true);
  });

  it('reports a non-manifest as malformed', () => {
    expect(verifyLessonManifest(null as never, opts).findings[0].code).toBe('malformed-lesson');
    expect(verifyLessonManifest({ title: 'no steps' } as never, opts).ok).toBe(false);
  });
});

describe('verifyLessonSource', () => {
  it('reports unparseable JSON as a finding, not an exception', () => {
    const report = verifyLessonSource('{ not json', { vocabulary });
    expect(report.ok).toBe(false);
    expect(report.findings[0].code).toBe('malformed-lesson');
  });

  it('verifies a parsed source end to end', () => {
    const report = verifyLessonSource(
      JSON.stringify(manifest([{ completeWhen: [{ node: 'App:%Repeater', exists: true }] }])),
      { vocabulary }
    );
    expect(report.findings[0].suggestion).toBe('For Each');
  });
});

describe('formatLessonFindings', () => {
  it('renders one line per finding', () => {
    const report = verifyLessonManifest(manifest([{ completeWhen: [{ node: 'App:%Repeater', exists: true }] }]), {
      vocabulary
    });
    expect(formatLessonFindings(report)).toMatch(/^ERROR Step 1 condition 1: /);
    expect(formatLessonFindings({ ok: true, findings: [] })).toBe('No problems found.');
  });
});

// ─── Corpus guard over the SHIPPED catalog ───────────────────────────────────

describe('the real node catalog', () => {
  const real = defaultLessonVocabulary();
  const nodes = defaultCatalog().nodes;

  /**
   * LESSON-FORMAT.md §3 tabulated nine divergences. Re-derived 2026-08-14: the
   * plain-divergence class alone is 103. These assertions pin the *classes*, so
   * a catalog change that moves a node between them fails here.
   */
  it('classifies every display name that is not also a type name', () => {
    const typeNames = new Set<string>(nodes.map((n) => n.typeName));
    const displayNames = new Set<string>(nodes.map((n) => n.displayName));

    const divergent = [...displayNames].filter((d) => !typeNames.has(d));
    const ambiguous = divergent.filter((d) => real.nodesWithDisplayName(d).length > 1);

    expect(divergent.length).toBeGreaterThanOrEqual(100);
    expect(ambiguous.sort()).toEqual(['Array', 'Component Object', 'Object', 'Parent Component Object']);

    for (const name of divergent) {
      const verdict = real.classifyTypeName(name);
      expect(verdict.code).toBe(ambiguous.includes(name) ? 'ambiguous-display-name' : 'display-name-used');
      // Ambiguity is never repaired; a unique divergence always is.
      expect(verdict.suggestion === undefined).toBe(ambiguous.includes(name));
    }
  });

  it('rejects the six shadowed names an existence check would let through', () => {
    // Each of these IS a real type name, so `CatalogIndex.hasType` returns true
    // for all of them. `Variable` is in the curriculum spine (CURRICULUM-DESIGN
    // D3) and `Button` / `Text Input` are in any beginner lesson.
    const shadowed = ['Button', 'Checkbox', 'Cloud Function', 'Radio Button', 'Text Input', 'Variable'];
    for (const name of shadowed) {
      const verdict = real.classifyTypeName(name);
      expect(verdict.code).toBe('shadowed-by-deprecated');
      expect(verdict.suggestion).toBeTruthy();
      expect(verdict.suggestion).not.toBe(name);
    }
    expect(real.classifyTypeName('Variable').suggestion).toBe('Variable2');
    expect(real.classifyTypeName('Text Input').suggestion).toBe('net.noodl.controls.textinput');
  });

  it('accepts the type names the nine documented divergences map to', () => {
    for (const typeName of [
      'For Each',
      'For Each Actions',
      'Static Data',
      'Timer',
      'Collection2',
      'CollectionInsert',
      'Model2',
      'DbModel2',
      'Router'
    ]) {
      expect(real.classifyTypeName(typeName).code).toBe('ok');
    }
  });

  it('accepts the plain nodes a lesson uses most', () => {
    for (const typeName of ['Group', 'Text', 'Image', 'Circle', 'Condition', 'Expression', 'Counter']) {
      expect(real.classifyTypeName(typeName).code).toBe('ok');
    }
  });
});
