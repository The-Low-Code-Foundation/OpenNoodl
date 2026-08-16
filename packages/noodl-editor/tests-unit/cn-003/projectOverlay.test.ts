/**
 * CN-003 slice 3 — the editor's project catalog overlay: the seam.
 *
 * ## What this file grades, and what it deliberately does not
 *
 * The **mapping** (payload → catalog entries) is graded in
 * `@nodegx/kit-catalog`'s own suite, against a *captured* node-library payload —
 * not here, and not twice. What is graded here is the half that only exists in
 * the editor:
 *
 * - installing an overlay changes what `loadDefaultCatalog()` knows, and
 *   clearing it changes it back (CN-003 acceptance 1, including the "and false
 *   for a project without the kit" half, which is the one that catches an
 *   overlay leaking between projects in a session);
 * - the bundled catalog is never mutated;
 * - the generation counter moves, because two long-lived `SemanticValidator`s in
 *   the editor memoise against it and a validator built over a stale index is
 *   indistinguishable from a project whose kits are genuinely unknown;
 * - a kit that shadows a shipped type does not take it over.
 *
 * ⚠️ **The payloads below are hand-written, and that is only allowable because
 * this file tests the seam.** A hand-written payload cannot say whether the
 * mapping is right — this phase has twice lost time to specs that named controls
 * which had never been run. The claims that need a real register are in
 * `packages/noodl-mcp/tests/kitAgreement.test.ts`, which compares the recorded
 * editor payload against a live extraction.
 */

import {
  catalogGeneration,
  catalogOverlayNodes,
  defaultCatalog,
  loadDefaultCatalog,
  projectCatalog,
  setCatalogOverlay
} from '../../src/editor/src/validation/catalog';
import { builtinTypeNamesFor, overlayFromNodeLibrary } from '../../src/editor/src/validation/kitOverlay';

/** A kit node type, in the shape `generateNodeLibrary` exports. */
function kitNodeType(name: string, moduleName = 'Demo Kit') {
  return {
    name,
    displayNodeName: name.split('.').pop(),
    module: moduleName,
    category: 'Visual',
    ports: [
      { name: 'label', type: 'string', plug: 'input' },
      { name: 'progress', type: { name: 'number' }, plug: 'input' },
      { name: 'clicked', type: 'signal', plug: 'output' }
    ]
  };
}

const PAYLOAD = {
  nodetypes: [
    kitNodeType('demo.kit.Badge'),
    kitNodeType('demo.kit.Meter'),
    // A built-in, as the payload carries it: no `module`.
    { name: 'Group', category: 'Visual', ports: [] }
  ]
};

afterEach(() => {
  setCatalogOverlay([]);
});

describe('the editor route', () => {
  it('maps only the entries a module registered', () => {
    const { nodes } = overlayFromNodeLibrary(PAYLOAD);
    expect(nodes.map((n) => n.typeName)).toEqual(['demo.kit.Badge', 'demo.kit.Meter']);
    expect(nodes.every((n) => n.providedBy === 'project-kit')).toBe(true);
    expect(nodes.every((n) => n.kitModule === 'Demo Kit')).toBe(true);
  });

  it('answers "no kit nodes" for an absent or empty library rather than throwing', () => {
    // The editor calls this on every library load, including the one that runs
    // at module construction before any project is open.
    expect(overlayFromNodeLibrary(undefined).nodes).toEqual([]);
    expect(overlayFromNodeLibrary({ nodetypes: [] }).nodes).toEqual([]);
  });

  it('learns built-in names from the shipped catalog *and* from the payload', () => {
    // The union is the point: the payload cannot name a built-in a kit has
    // already overwritten, and the shipped catalog is a filtered view of the
    // register. Each source contributes something the other lacks.
    const names = builtinTypeNamesFor(PAYLOAD);
    expect(names.has('Text')).toBe(true); // shipped catalog only — not in this payload
    expect(names.has('Group')).toBe(true); // payload, no `module`
    expect(names.has('demo.kit.Badge')).toBe(false); // a kit node is never a built-in
  });
});

describe('installing the overlay', () => {
  it('makes the project’s own types known, and clearing makes them unknown again', () => {
    // CN-003 acceptance 1. The "before" assertion is the control: without it,
    // this test would pass against a catalog that had always contained the type.
    expect(loadDefaultCatalog().hasType('demo.kit.Badge')).toBe(false);

    setCatalogOverlay(overlayFromNodeLibrary(PAYLOAD).nodes);
    expect(loadDefaultCatalog().hasType('demo.kit.Badge')).toBe(true);

    // ⚠️ `hasType()` passing is not the same as the match succeeding — the
    // catalog carries 103 known divergences where it does. Assert the entry.
    const node = loadDefaultCatalog().getNode('demo.kit.Badge');
    expect(node?.isVisual).toBe(true);
    expect(node?.inputs.map((p) => p.name)).toEqual(['label', 'progress']);
    expect(node?.outputs.map((p) => p.name)).toEqual(['clicked']);

    setCatalogOverlay([]);
    expect(loadDefaultCatalog().hasType('demo.kit.Badge')).toBe(false);
  });

  it('never mutates the bundled catalog', () => {
    // ⚠️ `String(...)`: the generated `CatalogNode['typeName']` is a *union of
    // the shipped type names*, so a kit type name is not comparable to it —
    // which is also why `projectCatalog()` casts the merged document. A kit node
    // is by construction outside the generated vocabulary.
    const carriesBadge = (nodes: { typeName: unknown }[]) =>
      nodes.some((n) => String(n.typeName) === 'demo.kit.Badge');

    const before = defaultCatalog().nodes.length;
    setCatalogOverlay(overlayFromNodeLibrary(PAYLOAD).nodes);

    expect(defaultCatalog().nodes.length).toBe(before);
    expect(carriesBadge(defaultCatalog().nodes)).toBe(false);
    // …while the catalog the project validates against does carry them.
    expect(projectCatalog().nodes.length).toBe(before + 2);
    expect(carriesBadge(projectCatalog().nodes)).toBe(true);
  });

  it('moves the generation, so anything memoised over the index is rebuilt', () => {
    const before = catalogGeneration();
    setCatalogOverlay(overlayFromNodeLibrary(PAYLOAD).nodes);
    expect(catalogGeneration()).toBeGreaterThan(before);

    // The index is rebuilt with it rather than served from the old cache —
    // which is the failure the counter exists to prevent, one layer down.
    expect(loadDefaultCatalog().hasType('demo.kit.Meter')).toBe(true);

    const installed = catalogGeneration();
    setCatalogOverlay([]);
    expect(catalogGeneration()).toBeGreaterThan(installed);
  });

  it('does not move the generation when nothing was installed and nothing is', () => {
    // The library reloads for many reasons that have nothing to do with kits;
    // each one rebuilding every validator in the editor would be a real cost.
    const before = catalogGeneration();
    setCatalogOverlay([]);
    expect(catalogGeneration()).toBe(before);
  });

  it('keeps a project’s kits out of the next project opened in the session', () => {
    setCatalogOverlay(overlayFromNodeLibrary(PAYLOAD).nodes);
    expect(loadDefaultCatalog().hasType('demo.kit.Badge')).toBe(true);

    // A second project, with its own kit and not the first one's.
    setCatalogOverlay(overlayFromNodeLibrary({ nodetypes: [kitNodeType('other.kit.Thing', 'Other Kit')] }).nodes);
    expect(loadDefaultCatalog().hasType('other.kit.Thing')).toBe(true);
    expect(loadDefaultCatalog().hasType('demo.kit.Badge')).toBe(false);
  });
});

describe('a kit that shadows a shipped type', () => {
  const SHADOW = { nodetypes: [kitNodeType('Text', 'Rogue Kit'), kitNodeType('demo.kit.Badge')] };

  it('is reported as a collision and does not take the type over', () => {
    const { nodes, collisions } = overlayFromNodeLibrary(SHADOW);

    expect(collisions).toEqual([{ typeName: 'Text', kitModule: 'Rogue Kit' }]);
    expect(nodes.map((n) => n.typeName)).toEqual(['demo.kit.Badge']);

    setCatalogOverlay(nodes);
    // The built-in Text still has its own ports, not the kit's three.
    const text = loadDefaultCatalog().getNode('Text');
    expect(text?.providedBy).not.toBe('project-kit');
    expect(text?.inputs.some((p) => p.name === 'text')).toBe(true);
  });

  it('is recorded where a caller can find it', () => {
    setCatalogOverlay(overlayFromNodeLibrary(SHADOW).nodes);
    expect(catalogOverlayNodes().map((n) => n.typeName)).toEqual(['demo.kit.Badge']);
  });
});
