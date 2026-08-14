/**
 * End-to-end tests over a real MCP client/server pair (InMemoryTransport):
 * the exact code path an external agent exercises, minus the stdio framing.
 */
import * as fs from 'fs';
import * as path from 'path';

import type { NodeTypeDetail, NodeTypeLookupMiss, NodeTypeSummary } from '../src/catalog';
import type { ComponentV2File, ConnectionsV2File, NodesV2File, RegistryV2File } from '../src/editor-deps';
import type {
  CreateComponentResponse,
  DeleteComponentResponse,
  DeletionRefusalDetails,
  ExplainComponentResponse,
  GetComponentResponse,
  GetExampleResponse,
  GetNodeTypeResponse,
  ListComponentsResponse,
  ListExamplesResponse,
  ListNodeTypesResponse,
  ProjectInfoResponse,
  SearchProjectResponse,
  ToolErrorPayload,
  UpdateComponentResponse,
  ValidateProjectResponse,
  ValidationFailureDetails
} from '../src/tools/responses';
import { call, connect, copyFixture, exists, readJson, reveal, TestSession } from './helpers';

/**
 * `get_node_type` returns a union per requested name — a full entry or a lookup
 * miss. The specs know which they asked for; these say so, and report the other
 * case as a readable failure instead of a property read on the wrong branch.
 */
type NodeTypeResult = GetNodeTypeResponse['types'][number];
const isMiss = (t: NodeTypeResult): t is NodeTypeLookupMiss => 'error' in t;
const isSummary = (t: NodeTypeResult): t is NodeTypeSummary => !isMiss(t) && 'ports' in t;

function asDetail(t: NodeTypeResult): NodeTypeDetail {
  if (isMiss(t)) throw new Error(`Expected a node type entry, got a miss: ${t.error}`);
  if (isSummary(t)) throw new Error(`Expected full detail, got a summary for ${t.typeName}`);
  // AWP-005 §2 widened the union with the per-port view; a caller asking for
  // full detail and getting one is the same mistake as getting a summary.
  if (!('availableIn' in t)) throw new Error(`Expected full detail, got a per-port view for ${t.typeName}`);
  return t;
}

function asMiss(t: NodeTypeResult): NodeTypeLookupMiss {
  if (!isMiss(t)) throw new Error(`Expected a lookup miss, got the entry for ${t.typeName}`);
  return t;
}

/** The `details` of a `validation-failed` rejection, or a readable failure. */
function validationDetails(payload: ToolErrorPayload<ValidationFailureDetails>): ValidationFailureDetails {
  const details = payload.error?.details;
  if (!details) throw new Error(`Expected validation details, got ${JSON.stringify(payload)}`);
  return details;
}

describe('noodl-mcp tools (end to end)', () => {
  let dir: string;
  let session: TestSession;

  beforeEach(async () => {
    dir = copyFixture();
    session = await connect(dir, true);
  });

  afterEach(async () => {
    await session.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  // ─── Modes ──────────────────────────────────────────────────────────────────

  it('read-only mode registers no authoring tools', async () => {
    const ro = await connect(dir, false);
    try {
      const tools = (await ro.client.listTools()).tools.map((t) => t.name);
      expect(tools).toEqual(
        expect.arrayContaining(['get_project_info', 'get_component', 'list_node_types', 'validate_project'])
      );
      expect(tools).not.toContain('create_component');
      expect(tools).not.toContain('update_component');
      expect(tools).not.toContain('delete_component');
      const info = await call<ProjectInfoResponse>(ro, 'get_project_info');
      expect(info.data.mode).toBe('read-only');
    } finally {
      await ro.close();
    }
  });

  // ─── Read ───────────────────────────────────────────────────────────────────

  it('get_project_info orients the agent', async () => {
    const { isError, data } = await call<ProjectInfoResponse>(session, 'get_project_info');
    expect(isError).toBe(false);
    expect(data.name).toBe('Demo App');
    expect(data.mode).toBe('read-write');
    expect(data.rootComponent?.path).toBe('App');
    expect(data.stats?.totalComponents).toBe(3);
  });

  it('FIX-008 E — says which directory it is bound to, so a mis-bound server is detectable', async () => {
    // 🔴 The bound path was announced once, in the `initialize` instructions, and repeated nowhere.
    // A server left registered against somebody else's project therefore answers every question
    // confidently and accepts every write, and nothing in the session says which project it means.
    const { data } = await call<ProjectInfoResponse>(session, 'get_project_info');
    // `path.resolve`, matching the store: the answer must be the path this server holds, not one
    // normalised a second way, or a user comparing it against their registration sees a difference
    // that is not there.
    expect(data.projectDirectory).toBe(path.resolve(dir));
  });

  it('get_component returns graph + revision, accepts legacy names', async () => {
    const { data } = await call<GetComponentResponse>(session, 'get_component', { path: '/Pages/Home', include_usages: true });
    expect(data.path).toBe('Pages/Home');
    expect(data.legacyName).toBe('/Pages/Home');
    expect(data.nodes).toHaveLength(6);
    expect(data.connections).toHaveLength(1);
    expect(data.revision).toMatch(/^[0-9a-f]{12}$/);
    expect(data.usages).toEqual([]);
  });

  it('search_project finds by type, component ref and text', async () => {
    await reveal(session, 'explore'); // AWP-006 — zero calls across four replays, so deferred
    const byType = await call<SearchProjectResponse>(session, 'search_project', { node_type: 'net.noodl.controls.button' });
    expect(byType.data.matches).toEqual([
      expect.objectContaining({ component: 'Pages/Home', nodeId: 'btn', matchedOn: 'type' })
    ]);
    const byRef = await call<SearchProjectResponse>(session, 'search_project', { node_type: 'Card' });
    expect(byRef.data.matches).toEqual([expect.objectContaining({ nodeId: 'card' })]);
    const byText = await call<SearchProjectResponse>(session, 'search_project', { text: 'welcome' });
    expect(byText.data.matches).toEqual([expect.objectContaining({ nodeId: 'title', matchedOn: 'parameter:text' })]);
  });

  it('explain_component produces a structured description', async () => {
    await reveal(session, 'explore');
    const { data } = await call<ExplainComponentResponse>(session, 'explain_component', { path: 'Pages/Home' });
    expect(data.visualTree).toHaveLength(1);
    expect(data.visualTree[0].id).toBe('page');
    expect(data.visualTree[0].children?.map((c) => c.id)).toEqual(['layout']);
    expect(data.logicNodes.map((n) => n.id)).toEqual(['nav']);
    expect(data.componentRefs).toEqual(['Card']);
    expect(data.dataFlow).toHaveLength(1);
    expect(data.dataFlow[0].from).toContain('onClick');
  });

  // ─── Catalog ────────────────────────────────────────────────────────────────

  it('list_node_types filters compactly; get_node_type returns enriched detail', async () => {
    const list = await call<ListNodeTypesResponse>(session, 'list_node_types', { query: 'button' });
    const names = list.data.nodeTypes.map((r) => r.typeName);
    expect(names).toContain('net.noodl.controls.button');
    expect(list.data.categories.length).toBeGreaterThan(0);

    // AWP-005 §2 — `detail` now defaults to "summary", so full is asked for.
    const detail = await call<GetNodeTypeResponse>(session, 'get_node_type', {
      type_names: ['net.noodl.controls.button', 'Grup'],
      detail: 'full'
    });
    const button = asDetail(detail.data.types[0]);
    const miss = asMiss(detail.data.types[1]);
    expect(button.outputs.map((p) => p.name)).toContain('onClick');
    expect(miss.error).toContain('Unknown');
    expect(miss.suggestion).toBe('Group');
  });

  it('get_node_type stays in-band for heavy multi-type requests (DEBT-009)', async () => {
    // The SUB-010 demo's failure mode: several enriched types in one call blew
    // the MCP host's tool-result cap (~126 KB observed), and the host's
    // "saved to file" overflow hint is useless to a filesystem-less agent.
    const heavy = [
      'Group',
      'Text',
      'Image',
      'Page Stack',
      'For Each',
      'net.noodl.controls.button',
      'net.noodl.controls.textinput',
      'net.noodl.controls.options'
    ];

    // Summary mode: compact shape, always small.
    const summary = await call<GetNodeTypeResponse>(session, 'get_node_type', {
      type_names: heavy,
      detail: 'summary'
    });
    expect(summary.data.types).toHaveLength(heavy.length);
    for (const t of summary.data.types) {
      if (isMiss(t)) throw new Error(`Unexpected miss: ${t.error}`);
      expect(isSummary(t)).toBe(true);
    }
    expect(JSON.stringify(summary.data).length).toBeLessThan(30_000);

    // Full mode: the byte budget degrades the tail to summaries in-band
    // rather than letting the response blow the cap.
    const full = await call<GetNodeTypeResponse>(session, 'get_node_type', { type_names: heavy, detail: 'full' });
    expect(full.data.types).toHaveLength(heavy.length);
    expect(JSON.stringify(full.data).length).toBeLessThan(90_000);
    if (full.data.summarized && full.data.summarized.length > 0) {
      expect(full.data.hint).toContain('individually');
      for (const name of full.data.summarized) {
        const entry = full.data.types.find((t) => !isMiss(t) && t.typeName === name);
        expect(entry && isSummary(entry)).toBe(true);
      }
    }
  });

  it('examples are browsable and fetchable', async () => {
    // AWP-006 — `get_example` is resident (14 calls across four replays);
    // `list_examples` is in `explore` (zero calls, and get_node_type already
    // returns each type's example ids and titles inline).
    await reveal(session, 'explore');
    const list = await call<ListExamplesResponse>(session, 'list_examples', { node_type: 'RouterNavigate' });
    expect(list.data.examples.length).toBeGreaterThanOrEqual(0);
    const all = await call<ListExamplesResponse>(session, 'list_examples');
    expect(all.data.examples.length).toBeGreaterThan(10);
    const first = all.data.examples[0];
    const ex = await call<GetExampleResponse>(session, 'get_example', { id: first.id });
    expect(ex.data.id).toBe(first.id);
    expect(ex.data.components[0].nodes.length).toBeGreaterThan(0);

    const missing = await call<ToolErrorPayload>(session, 'get_example', { id: 'nope' });
    expect(missing.isError).toBe(true);
    expect(missing.data.error.code).toBe('not-found');
  });

  // ─── Validate ───────────────────────────────────────────────────────────────

  it('validate_project is clean on the fixture (strict)', async () => {
    const { data } = await call<ValidateProjectResponse>(session, 'validate_project', { strict: true });
    expect(data.summary.errors).toBe(0);
  });

  // ─── Author: create ─────────────────────────────────────────────────────────

  // Node ids are prefixed because they are project-unique, not component-unique:
  // `duplicate-node-id` (SUB-012) reports an id reused across components, and the
  // fixture's own /Pages/Home already uses `page`, `layout` and `nav`. The write
  // gate is component-scoped and cannot see the collision, so it showed up only
  // in the project-wide `validate_project` assertion at the end of the create
  // test — red since 7fd3e053 (AAQ-011 F12).
  const settingsNodes = [
    { id: 'settingsPage', type: 'Page', label: 'Settings', parameters: { title: 'Settings' } },
    { id: 'settingsLayout', type: 'Group', parent: 'settingsPage' },
    { id: 'settingsHeading', type: 'Text', parent: 'settingsLayout', parameters: { text: 'Settings' } },
    { id: 'back', type: 'net.noodl.controls.button', parent: 'settingsLayout', parameters: { label: 'Back' } },
    { id: 'settingsNav', type: 'RouterNavigate', label: 'Back Home', parameters: { target: '/Pages/Home' } }
  ];

  it('create_component validates, writes and updates the registry', async () => {
    const res = await call<CreateComponentResponse>(session, 'create_component', {
      path: 'Pages/Settings',
      nodes: settingsNodes,
      connections: [{ fromId: 'back', fromProperty: 'onClick', toId: 'settingsNav', toProperty: 'navigate' }],
      description: 'Settings page with a back button'
    });
    expect(res.isError).toBe(false);
    expect(res.data.created).toBe('Pages/Settings');
    expect(res.data.legacyName).toBe('/Pages/Settings');
    expect(res.data.type).toBe('page'); // inferred from the path
    expect(res.data.validation.summary.errors).toBe(0);

    // Files + registry on disk
    expect(exists(dir, 'components/Pages/Settings/nodes.json')).toBe(true);
    const registry = readJson<RegistryV2File>(dir, 'components/_registry.json');
    expect(registry.components['Pages/Settings'].type).toBe('page');
    expect(registry.stats?.totalComponents).toBe(4);

    // children[] derived from parent fields
    const nodes = readJson<NodesV2File>(dir, 'components/Pages/Settings/nodes.json');
    const page = nodes.nodes.find((n) => n.id === 'settingsPage');
    expect(page?.children).toEqual(['settingsLayout']);

    // Whole project still validates
    const validation = await call<ValidateProjectResponse>(session, 'validate_project', { strict: true });
    expect(validation.data.summary.errors).toBe(0);
  });

  it('rejects a typo node type with a suggestion and writes nothing', async () => {
    const res = await call<ToolErrorPayload<ValidationFailureDetails>>(session, 'create_component', {
      path: 'Pages/Broken',
      nodes: [{ id: 'g', type: 'Grup' }]
    });
    expect(res.isError).toBe(true);
    expect(res.data.error.code).toBe('validation-failed');
    const diagnostic = validationDetails(res.data).newErrors[0];
    expect(diagnostic.code).toBe('unknown-node-type');
    expect(diagnostic.suggestion).toBe('Group');
    expect(exists(dir, 'components/Pages/Broken')).toBe(false);
    const registry = readJson<RegistryV2File>(dir, 'components/_registry.json');
    expect(registry.components['Pages/Broken']).toBeUndefined();
  });

  it('rejects a bad port with valid alternatives and writes nothing', async () => {
    // Port checks apply to static-port nodes (dynamic-port nodes are skipped by
    // SUB-006 design) — Counter's outputs are static.
    const res = await call<ToolErrorPayload<ValidationFailureDetails>>(session, 'create_component', {
      path: 'Pages/Broken2',
      nodes: [
        { id: 'counter', type: 'Counter' },
        { id: 'sw', type: 'Switch' }
      ],
      connections: [{ fromId: 'counter', fromProperty: 'cont', toId: 'sw', toProperty: 'flip' }]
    });
    expect(res.isError).toBe(true);
    const errs = validationDetails(res.data).newErrors;
    const portError = errs.find((d) => d.code === 'nonexistent-port');
    expect(portError).toBeDefined();
    expect(`${portError?.suggestion} ${(portError?.alternatives ?? []).join(',')}`).toMatch(/countChanged|currentCount/);
    expect(exists(dir, 'components/Pages/Broken2')).toBe(false);
  });

  it('rejects a connection to a nonexistent node and writes nothing', async () => {
    const res = await call<ToolErrorPayload<ValidationFailureDetails>>(session, 'create_component', {
      path: 'Pages/Broken4',
      nodes: settingsNodes,
      connections: [{ fromId: 'back', fromProperty: 'onClick', toId: 'ghost', toProperty: 'navigate' }]
    });
    expect(res.isError).toBe(true);
    expect(validationDetails(res.data).newErrors.some((d) => d.code === 'dangling-connection')).toBe(true);
    expect(exists(dir, 'components/Pages/Broken4')).toBe(false);
  });

  it('rejects malformed node input with nothing written', async () => {
    // `parameters` must be an object — rejected at the argument-schema layer.
    const res = await call<ToolErrorPayload>(session, 'create_component', {
      path: 'Pages/Broken3',
      nodes: [{ id: 'x', type: 'Group', parameters: 'not-an-object' as unknown as Record<string, unknown> }]
    });
    expect(res.isError).toBe(true);
    expect(exists(dir, 'components/Pages/Broken3')).toBe(false);
  });

  // ─── Author: update ─────────────────────────────────────────────────────────

  it('update_component applies batched operations with revision safety', async () => {
    const before = await call<GetComponentResponse>(session, 'get_component', { path: 'Pages/Home' });
    const res = await call<UpdateComponentResponse>(session, 'update_component', {
      path: 'Pages/Home',
      if_revision: before.data.revision,
      operations: [
        {
          op: 'add_node',
          node: { id: 'settingsBtn', type: 'net.noodl.controls.button', parent: 'layout', parameters: { label: 'Settings' } }
        },
        // A Navigate with no target is a dead button, and the gate now says so
        // (AAQ-005 bound `checkNavigation` to this server). The point of the test
        // is batching and revision safety, so give it a real target.
        {
          op: 'add_node',
          node: { id: 'navSettings', type: 'RouterNavigate', parameters: { target: '/Pages/Home' } }
        },
        {
          op: 'add_connection',
          connection: { fromId: 'settingsBtn', fromProperty: 'onClick', toId: 'navSettings', toProperty: 'navigate' }
        }
      ]
    });
    expect(res.isError).toBe(false);
    expect(res.data.applied).toHaveLength(3);
    expect(res.data.validation.summary.errors).toBe(0);

    const after = await call<GetComponentResponse>(session, 'get_component', { path: 'Pages/Home' });
    expect(after.data.nodes).toHaveLength(8);
    expect(after.data.connections).toHaveLength(2);
    const layout = after.data.nodes.find((n) => n.id === 'layout');
    expect(layout?.children).toContain('settingsBtn');

    // Stale revision now fails
    const stale = await call<ToolErrorPayload>(session, 'update_component', {
      path: 'Pages/Home',
      if_revision: before.data.revision,
      operations: [{ op: 'remove_node', id: 'navSettings' }]
    });
    expect(stale.isError).toBe(true);
    expect(stale.data.error.code).toBe('conflict');
  });

  it('a failing operation aborts the whole batch', async () => {
    const before = readJson<NodesV2File>(dir, 'components/Pages/Home/nodes.json');
    const res = await call<ToolErrorPayload>(session, 'update_component', {
      path: 'Pages/Home',
      operations: [
        { op: 'add_node', node: { id: 'ok', type: 'Text', parent: 'layout' } },
        { op: 'remove_node', id: 'does-not-exist' }
      ]
    });
    expect(res.isError).toBe(true);
    expect(res.data.error.code).toBe('invalid-argument');
    expect(readJson<NodesV2File>(dir, 'components/Pages/Home/nodes.json')).toEqual(before);
  });

  it('update_component rejects new semantic errors but tolerates preexisting ones', async () => {
    // Introduce a component that already has an unknown type on disk (module node).
    const res = await call<CreateComponentResponse>(session, 'create_component', {
      path: 'Widgets/Module',
      nodes: [{ id: 'm', type: 'some.module.widget' }],
      allow_unknown_types: true
    });
    expect(res.isError).toBe(false);

    // An edit that does NOT touch the unknown node must pass...
    const ok = await call<UpdateComponentResponse>(session, 'update_component', {
      path: 'Widgets/Module',
      operations: [{ op: 'add_node', node: { id: 'label', type: 'Text' } }]
    });
    expect(ok.isError).toBe(false);
    expect(ok.data.validation.preexistingErrors?.length ?? 0).toBeGreaterThan(0);

    // ...while an edit introducing a NEW unknown type still fails.
    const bad = await call<ToolErrorPayload<ValidationFailureDetails>>(session, 'update_component', {
      path: 'Widgets/Module',
      operations: [{ op: 'add_node', node: { id: 'bad', type: 'Grup' } }]
    });
    expect(bad.isError).toBe(true);
    expect(validationDetails(bad.data).newErrors[0].suggestion).toBe('Group');
  });

  it('backfills missing ids on legacy-exported components (Gate G1 finding)', async () => {
    // Legacy id-less components export to v2 without component.json `id` /
    // nodes-connections `componentId`. Updates must backfill, not reject.
    const strip = (rel: string, key: string) => {
      const p = `${dir}/components/Card/${rel}`;
      const json = JSON.parse(fs.readFileSync(p, 'utf8'));
      delete json[key];
      fs.writeFileSync(p, JSON.stringify(json, null, 2));
    };
    strip('component.json', 'id');
    strip('nodes.json', 'componentId');
    strip('connections.json', 'componentId');

    const res = await call<UpdateComponentResponse>(session, 'update_component', {
      path: 'Card',
      operations: [{ op: 'update_node', id: 'card_text', parameters: { text: 'edited on a legacy component' } }]
    });
    expect(res.isError).toBe(false);

    const component = readJson<ComponentV2File>(dir, 'components/Card/component.json');
    expect(component.id).toBeTruthy();
    expect(readJson<NodesV2File>(dir, 'components/Card/nodes.json').componentId).toBe(component.id);
    expect(readJson<ConnectionsV2File>(dir, 'components/Card/connections.json').componentId).toBe(component.id);
  });

  it('list_components explains an empty type-filter result (Gate G1 feedback)', async () => {
    const res = await call<ListComponentsResponse>(session, 'list_components', { type: 'cloud' });
    expect(res.data.components).toEqual([]);
    expect(res.data.note).toContain('No components of type "cloud"');
    expect(res.data.note).toContain('visual');
  });

  it('update_component set replaces the whole graph', async () => {
    const res = await call<UpdateComponentResponse>(session, 'update_component', {
      path: 'Card',
      set: {
        nodes: [
          { id: 'root', type: 'Group', children: ['t1', 't2'] },
          { id: 't1', type: 'Text', parameters: { text: 'one' } },
          { id: 't2', type: 'Text', parameters: { text: 'two' } }
        ],
        connections: []
      }
    });
    expect(res.isError).toBe(false);
    const onDisk = readJson<NodesV2File>(dir, 'components/Card/nodes.json');
    expect(onDisk.nodes).toHaveLength(3);
    expect(onDisk.nodes.find((n) => n.id === 't1')?.parent).toBe('root');
  });

  // ─── Author: delete ─────────────────────────────────────────────────────────

  it('delete_component refuses while referenced, force-deletes with a report', async () => {
    const refused = await call<ToolErrorPayload<DeletionRefusalDetails>>(session, 'delete_component', { path: 'Card' });
    expect(refused.isError).toBe(true);
    expect(refused.data.error?.details?.usages).toEqual([
      expect.objectContaining({ component: 'Pages/Home', nodeId: 'card' })
    ]);
    expect(exists(dir, 'components/Card/nodes.json')).toBe(true);

    const forced = await call<DeleteComponentResponse>(session, 'delete_component', { path: 'Card', force: true });
    expect(forced.isError).toBe(false);
    expect(exists(dir, 'components/Card/nodes.json')).toBe(false);
    expect(forced.data.brokenReferences?.length).toBeGreaterThan(0);

    const validation = await call<ValidateProjectResponse>(session, 'validate_project', {});
    expect(validation.data.summary.errors).toBeGreaterThan(0); // Home now has a dangling ref — reported honestly
  });

  it('delete_component removes an unreferenced component cleanly', async () => {
    // Remove the Card instance from Home first, then delete Card.
    const detach = await call<UpdateComponentResponse>(session, 'update_component', {
      path: 'Pages/Home',
      operations: [{ op: 'remove_node', id: 'card' }]
    });
    expect(detach.isError).toBe(false);
    const res = await call<DeleteComponentResponse>(session, 'delete_component', { path: 'Card' });
    expect(res.isError).toBe(false);
    const validation = await call<ValidateProjectResponse>(session, 'validate_project', { strict: true });
    expect(validation.data.summary.errors).toBe(0);
  });
});
