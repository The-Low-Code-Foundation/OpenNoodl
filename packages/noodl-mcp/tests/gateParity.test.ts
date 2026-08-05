/**
 * AAQ-005 — the two clients gate authored output identically.
 *
 * The task's acceptance criterion is "a test fails if the two surfaces diverge".
 * This is that test for the write gate: one candidate, one project, judged by the
 * editor's `validateCandidateComponent` and by this server's `validateCandidate`,
 * asserting the same verdict and the same blocking diagnostic codes.
 *
 * It is worth stating what it would have caught. Before AAQ-005 every case below
 * passed in the editor and failed to be noticed here, because
 * `checkParameterValues`, `checkBackendRequirements`, `checkNavigation` and
 * `checkPageShape` appeared nowhere in this package — not applied laxly, absent.
 * The divergence was recorded in the task file as a policy difference over shared
 * rules; it was a missing import, and it let roughly fifteen error-severity
 * parameter diagnostics ship through Claude Code while rejecting the identical
 * submission in the editor.
 *
 * Two differences are deliberate and are NOT asserted away:
 *
 *  - **Catalog.** The editor gate reads `loadDefaultCatalog()`; this server reads
 *    the *enriched* index, so its catalog tools and its gate can never disagree
 *    about a type. Every candidate here uses core types, where the two agree.
 *  - **Backend facts.** The editor's authoring panel knows the project's
 *    `cloudservices` configuration and this server does not, so AIB-007
 *    diagnostics are editor-only. The shared check reads an omitted backend as
 *    "do not check", which is the only honest answer a caller that cannot tell
 *    can give — so neither side reports them here.
 */

import * as fs from 'fs';

import type { ComponentV2File, ConnectionsV2File, Diagnostic, ExplainGraph, NodeV2, NodesV2File } from '../src/editor-deps';
import { graphComponentFromFiles, validateCandidateComponent } from '../src/editor-deps';
import type { ComponentFiles } from '../src/graph';
import { reconcileHierarchy } from '../src/graph';
import { validateCandidate } from '../src/validate';
import { connect, copyFixture } from './helpers';
import type { TestSession } from './helpers';

const LEGACY_NAME = '/Pages/Settings';
const COMPONENT_KEY = 'Pages/Settings';

function candidateFiles(nodes: NodeV2[], connections: ConnectionsV2File['connections'] = []): ComponentFiles {
  const reconciled = reconcileHierarchy(nodes);
  expect(reconciled.errors).toEqual([]);
  const component: ComponentV2File = {
    $schema: 'https://opennoodl.dev/schemas/component-v2.json',
    id: 'parity-component',
    name: 'Settings',
    path: LEGACY_NAME,
    type: 'page',
    created: '1970-01-01T00:00:00.000Z',
    modified: '1970-01-01T00:00:00.000Z',
    modifiedBy: 'parity-spec'
  };
  const nodesFile: NodesV2File = {
    $schema: 'https://opennoodl.dev/schemas/nodes-v2.json',
    componentId: 'parity-component',
    version: 1,
    nodes: reconciled.nodes
  };
  const connectionsFile: ConnectionsV2File = {
    $schema: 'https://opennoodl.dev/schemas/connections-v2.json',
    componentId: 'parity-component',
    version: 1,
    connections
  };
  return { component, nodes: nodesFile, connections: connectionsFile };
}

const blockingCodes = (diagnostics: readonly Diagnostic[]): string[] =>
  [...new Set(diagnostics.map((d) => d.code))].sort();

describe('AAQ-005 — the editor gate and the MCP write gate agree', () => {
  let dir: string;
  let session: TestSession;
  let graph: ExplainGraph;

  beforeEach(async () => {
    dir = copyFixture();
    session = await connect(dir, true);
    graph = {
      components: session.store
        .listComponents()
        .map((row) => graphComponentFromFiles(row.legacyName, session.store.readComponent(row.path).files))
    };
  });

  afterEach(async () => {
    await session.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  /** Run one candidate through both bindings and return their verdicts. */
  function judge(files: ComponentFiles) {
    const editor = validateCandidateComponent(graph, LEGACY_NAME, files as never);
    const mcp = validateCandidate(session.store, COMPONENT_KEY, files, undefined);
    return { editor, mcp };
  }

  it('agrees that a well-formed page is clean', () => {
    const files = candidateFiles([
      { id: 'page', type: 'Page', parameters: { title: 'Settings', urlPath: '/settings' } } as NodeV2,
      { id: 'body', type: 'Group', parent: 'page' } as NodeV2,
      { id: 'copy', type: 'Text', parent: 'body', parameters: { text: 'Settings' } } as NodeV2
    ]);

    const { editor, mcp } = judge(files);
    expect(editor.ok).toBe(true);
    expect(mcp.ok).toBe(true);
    expect(blockingCodes(mcp.newErrors)).toEqual(blockingCodes(editor.errors));
  });

  it('agrees that a connection-only parameter is an error (the AAQ-005 headline case)', () => {
    // `variant` is settable only by a connection. Assigning it statically is
    // silently discarded at runtime — the mechanism that threw away a whole
    // build's styling — and it is an ERROR, not a blocking warning, so the
    // `severity === 'error'` filter this gate already had would have caught it
    // if the diagnostic had ever been computed here.
    const files = candidateFiles([
      { id: 'page', type: 'Page', parameters: { title: 'Settings' } } as NodeV2,
      {
        id: 'cta',
        type: 'net.noodl.controls.button',
        parent: 'page',
        parameters: { label: 'Save', variant: 'primary' }
      } as NodeV2
    ]);

    const { editor, mcp } = judge(files);
    expect(editor.ok).toBe(false);
    expect(mcp.ok).toBe(false);
    expect(blockingCodes(mcp.newErrors)).toEqual(blockingCodes(editor.errors));
    expect(blockingCodes(mcp.newErrors)).toContain('connection-only-parameter');
  });

  it('agrees that a bare dimension blocks, though it is only a warning', () => {
    const files = candidateFiles([
      { id: 'page', type: 'Page', parameters: { title: 'Settings' } } as NodeV2,
      { id: 'body', type: 'Group', parent: 'page', parameters: { width: 228 } } as NodeV2
    ]);

    const { editor, mcp } = judge(files);
    expect(editor.ok).toBe(false);
    expect(mcp.ok).toBe(false);
    expect(blockingCodes(mcp.newErrors)).toEqual(blockingCodes(editor.errors));
    expect(mcp.newErrors.every((d) => d.severity === 'warning')).toBe(true);
    expect(blockingCodes(mcp.newErrors)).toContain('unitless-dimension');
  });

  it('agrees that a navigation to a component the project does not have blocks', () => {
    const files = candidateFiles([
      { id: 'page', type: 'Page', parameters: { title: 'Settings' } } as NodeV2,
      { id: 'go', type: 'RouterNavigate', parameters: { target: '/Pages/Nowhere' } } as NodeV2
    ]);

    const { editor, mcp } = judge(files);
    expect(editor.ok).toBe(false);
    expect(mcp.ok).toBe(false);
    expect(blockingCodes(mcp.newErrors)).toEqual(blockingCodes(editor.errors));
    expect(blockingCodes(mcp.newErrors)).toContain('unresolved-navigation');
  });

  it('agrees that a navigation to a component the project DOES have is fine', () => {
    const files = candidateFiles([
      { id: 'page', type: 'Page', parameters: { title: 'Settings' } } as NodeV2,
      { id: 'go', type: 'RouterNavigate', parameters: { target: '/Pages/Home' } } as NodeV2
    ]);

    const { editor, mcp } = judge(files);
    expect(editor.ok).toBe(true);
    expect(mcp.ok).toBe(true);
  });

  it('agrees that an instance port with no plug blocks (AAQ-005 slice 3)', () => {
    // The finding that came out of converging the two tool vocabularies. A
    // declared port with no `plug` is INERT: `NodeGraphNode.getPorts(filter)`
    // selects on `p.plug`, and a component's interface is derived from
    // `getPorts('input')`/`getPorts('output')` — so this Component Inputs node
    // gives the component no inputs at all, silently. This package's port schema
    // did not declare `plug` until slice 3, so an external agent was never told
    // the field existed, and neither gate checked it.
    const files = candidateFiles([
      { id: 'page', type: 'Page', parameters: { title: 'Settings' } } as NodeV2,
      { id: 'in', type: 'Component Inputs', ports: [{ name: 'Title', type: '*' }] } as unknown as NodeV2
    ]);

    const { editor, mcp } = judge(files);
    expect(editor.ok).toBe(false);
    expect(mcp.ok).toBe(false);
    expect(blockingCodes(mcp.newErrors)).toEqual(blockingCodes(editor.errors));
    expect(blockingCodes(mcp.newErrors)).toContain('port-without-plug');
  });

  it('agrees that a plug of "input/output" is fine — it is what 92 corpus ports use', () => {
    const files = candidateFiles([
      { id: 'page', type: 'Page', parameters: { title: 'Settings' } } as NodeV2,
      {
        id: 'in',
        type: 'Component Inputs',
        ports: [{ name: 'Title', plug: 'input/output', type: '*' }]
      } as unknown as NodeV2
    ]);

    const { editor, mcp } = judge(files);
    expect(editor.ok).toBe(true);
    expect(mcp.ok).toBe(true);
  });

  it('agrees that a routed component with no Page node is a warning and does NOT block', () => {
    // AAQ-011 F7 lives here: the rule is right and blocking it would need 57
    // fixture sites corrected first. Both clients must be on the same side of
    // that decision, which is the reason `AUTHORED_BLOCKING_WARNINGS` is one set
    // rather than two.
    const files = candidateFiles([{ id: 'body', type: 'Group', parameters: { text: undefined } } as NodeV2]);

    const { editor, mcp } = judge(files);
    expect(editor.ok).toBe(true);
    expect(mcp.ok).toBe(true);
    expect(editor.diagnostics.some((d) => d.code === 'page-without-page-node')).toBe(true);
    expect(mcp.diagnostics.some((d) => d.code === 'page-without-page-node')).toBe(true);
  });
});
