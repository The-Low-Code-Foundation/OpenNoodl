/**
 * CN-008 — "the AI can use your nodes".
 *
 * Runs headlessly the way ERG-002's `libraryOverview` tests do: no Electron, no
 * `ProjectModel`. The input is the **recorded** node-library payload CN-003
 * captured from a running editor (`tests-unit/cn-003/fixtures`), not a
 * hand-written one, so the port sets these assertions reason about are the ones
 * the viewer really sends.
 *
 * 🔴 **Two of this task's own spec clauses are false, and the cheapest way to
 * lose that again is to leave it in prose.** Both are pinned here as tests
 * (`the premises this task was written on`), so re-introducing either fails:
 *
 * 1. *"the AI does not know the lane exists"* — it does. A kit node is
 *    `inNodePicker`, so `catalogOverview()` already names it.
 * 2. *"the ports an instance would actually set — the inputs with no default"* —
 *    that selector matches **nothing** on a real kit.
 */
import {
  AuthoringContextBuilder,
  KIT_BASE_INPUT_PORTS,
  KIT_BASE_OUTPUT_PORTS
} from '../../src/editor/src/models/AiAssistant/authoring/ContextBuilder';
import { initialUserMessage } from '../../src/editor/src/models/AiAssistant/authoring/prompts/authoring';
import type { AuthoringRequest } from '../../src/editor/src/models/AiAssistant/authoring/types';
import type { ExplainGraph } from '../../src/editor/src/models/AiAssistant/explain/types';
import { catalogWithOverlay, defaultCatalog, shippedCatalogIndex } from '../../src/editor/src/validation/catalog';
import { overlayFromNodeLibrary } from '../../src/editor/src/validation/kitOverlay';
import payload from '../cn-003/fixtures/kit-app.editor-nodelibrary.json';

const EMPTY_GRAPH: ExplainGraph = { components: [] };
const REQUEST: AuthoringRequest = { description: 'a page', componentPath: 'Pages/Test' };

/** The two `Demo Kit` nodes the fixture records, as catalog overlay entries. */
const overlay = overlayFromNodeLibrary(payload as never);

/**
 * A builder over the shipped catalog **plus** the recorded kit — never the
 * module singleton `setCatalogOverlay` installs, so nothing here can leak into
 * another suite (or be leaked into by one).
 */
function withKits(): AuthoringContextBuilder {
  return new AuthoringContextBuilder(EMPTY_GRAPH, {}, catalogWithOverlay(overlay.nodes).index);
}

/** A builder over the shipped catalog only — a project with no kits. */
function withoutKits(): AuthoringContextBuilder {
  return new AuthoringContextBuilder(EMPTY_GRAPH, {}, shippedCatalogIndex());
}

describe('the premises this task was written on', () => {
  it('the fixture really is the recorded two-kit-node payload', () => {
    expect(overlay.nodes.map((n) => n.typeName)).toEqual(['demo.kit.Badge', 'demo.kit.Meter']);
    expect(overlay.collisions).toHaveLength(0);
  });

  it('🔴 FALSE: "the AI does not know the lane exists" — catalogOverview already names kit types', () => {
    const overview = withKits().catalogOverview();
    expect(overview).toContain('demo.kit.Badge');
    expect(overview).toContain('demo.kit.Meter');
    // ...but it names them and nothing else: no kit, no display name, no
    // purpose. That gap — not their absence — is what `nodeKitOverview` fills.
    expect(overview).not.toContain('Demo Kit');
    expect(overview).not.toContain('Demo Badge');
  });

  it('🔴 FALSE: "the inputs with no default" selects ZERO ports on a real kit', () => {
    const index = catalogWithOverlay(overlay.nodes).index;
    for (const typeName of index.projectKitTypeNames()) {
      const authorInputs = index.getNode(typeName)!.inputs.filter((p) => !KIT_BASE_INPUT_PORTS.has(p.name));
      expect(authorInputs.length).toBeGreaterThan(0);
      const withoutDefault = authorInputs.filter((p) => p.default === undefined || p.default === null || p.default === '');
      // Had the spec's selector been followed, every node would have printed a
      // heading with an empty port list under it — while `charge()` reported a
      // cost and every mechanical criterion passed.
      expect(withoutDefault).toEqual([]);
    }
  });

  it('🔴 `docs` on a SHIPPED node is a URL, never prose — the field is two vocabularies', () => {
    const shipped = defaultCatalog().nodes.map((n) => (n as { docs?: string }).docs).filter((d): d is string => !!d);
    expect(shipped.length).toBeGreaterThan(100);
    expect(shipped.filter((d) => !/^https?:\/\//.test(d))).toEqual([]);
    // The kit's, by contrast, is the author's sentence.
    const badge = catalogWithOverlay(overlay.nodes).index.getNode('demo.kit.Badge')!;
    expect((badge as { docs?: string }).docs).toBe('A labelled badge that can show a percentage.');
  });

  it('the base port set agrees with what the runtime actually put on every kit node', () => {
    // Containment, in the direction that matters: if `react-component-node.ts`
    // stops adding one of these, the next re-record of the fixture fails here
    // rather than quietly leaving a stale name in the exclusion list.
    // ⚠️ It cannot catch the runtime ADDING a port — that shows up as a stray
    // inherited port in the handout, not as a wrong answer.
    const index = catalogWithOverlay(overlay.nodes).index;
    for (const typeName of index.projectKitTypeNames()) {
      const node = index.getNode(typeName)!;
      const inputs = new Set(node.inputs.map((p) => p.name));
      const outputs = new Set(node.outputs.map((p) => p.name));
      for (const name of KIT_BASE_INPUT_PORTS) expect([typeName, name, inputs.has(name)]).toEqual([typeName, name, true]);
      for (const name of KIT_BASE_OUTPUT_PORTS) expect([typeName, name, outputs.has(name)]).toEqual([typeName, name, true]);
    }
  });
});

describe('AuthoringContextBuilder.nodeKitOverview', () => {
  it('is undefined (and charges nothing) for a project with no kits', () => {
    const builder = withoutKits();
    expect(builder.nodeKitOverview()).toBeUndefined();
    expect(builder.totalChars()).toBe(0);
  });

  it('groups the nodes under their kit and names it', () => {
    const overview = withKits().nodeKitOverview()!;
    expect(overview).toContain('Demo Kit');
    expect(overview).toContain('- demo.kit.Badge — "Demo Badge" (visual)');
    expect(overview).toContain('- demo.kit.Meter — "Demo Meter" (visual)');
  });

  it("carries the author's own sentence about each node", () => {
    const overview = withKits().nodeKitOverview()!;
    expect(overview).toContain('A labelled badge that can show a percentage.');
    expect(overview).toContain('A horizontal meter.');
  });

  it('lists the ports the author declared and NOT the ones the runtime added', () => {
    const overview = withKits().nodeKitOverview()!;
    // Declared by the kit — these are what an instance is configured through.
    for (const port of ['label (string)', 'progress (number)', 'showProgress (boolean)', 'background (color)']) {
      expect(overview).toContain(port);
    }
    expect(overview).toContain('clicked (signal)');
    expect(overview).not.toContain('signal, signal');
    // Added by `react-component-node.ts` to every kit node. Repeating them per
    // node is pure prompt cost and the model knows them from the built-ins.
    for (const port of ['cssClassName', 'styleCss', 'didMount', 'willUnmount', 'boundingWidth', 'childIndex']) {
      expect(overview).not.toContain(port);
    }
  });

  it('is charged through charge(), under its own source', () => {
    const builder = withKits();
    const overview = builder.nodeKitOverview()!;
    expect(builder.log).toEqual([{ source: 'node-kit-overview', chars: overview.length }]);
  });

  it('tells the model these are ordinary nodes configured through ports (P1, P2)', () => {
    const overview = withKits().nodeKitOverview()!;
    expect(overview).toContain('ordinary nodes');
    expect(overview).toMatch(/never propose editing a kit's JavaScript/);
  });

  it('states the remainder rather than truncating silently when a kit is large', () => {
    // The 40-node kit the task asked us to decide about before a user finds one.
    const many = Array.from({ length: 40 }, (_, i) => ({
      ...overlay.nodes[0],
      typeName: `big.kit.Node${String(i).padStart(2, '0')}`,
      displayName: `Node ${i}`
    }));
    const overview = new AuthoringContextBuilder(EMPTY_GRAPH, {}, catalogWithOverlay(many).index).nodeKitOverview()!;
    expect(overview).toContain('… 10 further kit node types are installed but not listed here');
    expect(overview).toContain('big.kit.Node00');
    expect(overview).not.toContain('big.kit.Node39');
  });
});

describe('nodeTypeDetails — the dropped kit `docs` string', () => {
  it("states what a kit node is for, instead of a heading with no purpose under it", () => {
    // A kit type can never have SUB-005 enrichment (that catalog is generated at
    // repo-build time and keyed by type name), so before CN-008 this handout
    // reached the model with a heading, a placement line and nothing else.
    const details = withKits().nodeTypeDetails(['demo.kit.Meter']);
    expect(details).toContain('### demo.kit.Meter (Visual)');
    expect(details).toContain('A horizontal meter.');
  });

  it("never renders a shipped node's docs URL as its summary", () => {
    // `docs` on a built-in is `https://docs.noodl.net/…`. Reading the field
    // without splitting the two vocabularies would put a link where a summary
    // goes on 158 node types.
    //
    // ⚠️ **What actually holds this up is the provenance gate in
    // `renderNodeType`, not `kitDocs`'s URL check** — a built-in never reaches
    // `kitDocs` at all. The URL check is graded on its own reachable input in
    // the case below; this one would pass with that check deleted, and saying
    // so is cheaper than discovering it during a later refactor.
    const details = withoutKits().nodeTypeDetails(['Group', 'Text']);
    expect(details).not.toContain('https://docs.noodl.net');
  });

  it('omits a kit `docs` that is a URL rather than printing a bare link', () => {
    // Reachable and plausible: an author who points `docs` at their own hosted
    // page. A URL is not a sentence about what the node is for, and a line
    // reading `- x.y.Z — "Z" (visual). https://…` teaches the model to cite it.
    const linked = [{ ...overlay.nodes[0], typeName: 'linked.kit.Node', docs: 'https://example.com/my-kit' }];
    const overview = new AuthoringContextBuilder(EMPTY_GRAPH, {}, catalogWithOverlay(linked).index).nodeKitOverview()!;
    expect(overview).toContain('linked.kit.Node');
    expect(overview).not.toContain('https://example.com/my-kit');
  });
});

describe('initialUserMessage — the node-kit block', () => {
  it('omits the block entirely, byte for byte, when the project has no kits', () => {
    const withArg = initialUserMessage(
      REQUEST,
      'overview',
      'catalog',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      withoutKits().nodeKitOverview()
    );
    // AC2: byte-identical to the call as it existed before this task.
    const before = initialUserMessage(REQUEST, 'overview', 'catalog');
    expect(withArg.content).toBe(before.content);
    expect(withArg.cacheBoundary).toBe(before.cacheBoundary);
    expect(withArg.content).not.toContain('NODE KITS');
  });

  it('puts the block in the cache-stable prefix, right after the catalog', () => {
    const opening = initialUserMessage(
      REQUEST,
      'overview',
      'catalog',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      withKits().nodeKitOverview()
    );
    // AC3, read off the assembled prompt rather than asserted from intent.
    const stablePrefix = opening.content.slice(0, opening.cacheBoundary);
    expect(stablePrefix).toContain("--- THIS PROJECT'S NODE KITS ---");
    expect(stablePrefix).toContain('Demo Kit');
    expect(stablePrefix.indexOf('--- END NODE CATALOG ---')).toBeLessThan(
      stablePrefix.indexOf("--- THIS PROJECT'S NODE KITS ---")
    );
  });
});
