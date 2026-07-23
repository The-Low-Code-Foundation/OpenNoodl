/**
 * End-to-end tests over a real MCP client/server pair (InMemoryTransport):
 * the exact code path an external agent exercises, minus the stdio framing.
 */
import * as fs from 'fs';

import { call, connect, copyFixture, exists, readJson, TestSession } from './helpers';

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
      const info = await call(ro, 'get_project_info');
      expect(info.data.mode).toBe('read-only');
    } finally {
      await ro.close();
    }
  });

  // ─── Read ───────────────────────────────────────────────────────────────────

  it('get_project_info orients the agent', async () => {
    const { isError, data } = await call(session, 'get_project_info');
    expect(isError).toBe(false);
    expect(data.name).toBe('Demo App');
    expect(data.mode).toBe('read-write');
    expect(data.rootComponent.path).toBe('App');
    expect(data.stats.totalComponents).toBe(3);
  });

  it('get_component returns graph + revision, accepts legacy names', async () => {
    const { data } = await call(session, 'get_component', { path: '/Pages/Home', include_usages: true });
    expect(data.path).toBe('Pages/Home');
    expect(data.legacyName).toBe('/Pages/Home');
    expect(data.nodes).toHaveLength(6);
    expect(data.connections).toHaveLength(1);
    expect(data.revision).toMatch(/^[0-9a-f]{12}$/);
    expect(data.usages).toEqual([]);
  });

  it('search_project finds by type, component ref and text', async () => {
    const byType = await call(session, 'search_project', { node_type: 'net.noodl.controls.button' });
    expect(byType.data.matches).toEqual([
      expect.objectContaining({ component: 'Pages/Home', nodeId: 'btn', matchedOn: 'type' })
    ]);
    const byRef = await call(session, 'search_project', { node_type: 'Card' });
    expect(byRef.data.matches).toEqual([expect.objectContaining({ nodeId: 'card' })]);
    const byText = await call(session, 'search_project', { text: 'welcome' });
    expect(byText.data.matches).toEqual([expect.objectContaining({ nodeId: 'title', matchedOn: 'parameter:text' })]);
  });

  it('explain_component produces a structured description', async () => {
    const { data } = await call(session, 'explain_component', { path: 'Pages/Home' });
    expect(data.visualTree).toHaveLength(1);
    expect(data.visualTree[0].id).toBe('page');
    expect(data.visualTree[0].children.map((c: any) => c.id)).toEqual(['layout']);
    expect(data.logicNodes.map((n: any) => n.id)).toEqual(['nav']);
    expect(data.componentRefs).toEqual(['Card']);
    expect(data.dataFlow).toHaveLength(1);
    expect(data.dataFlow[0].from).toContain('onClick');
  });

  // ─── Catalog ────────────────────────────────────────────────────────────────

  it('list_node_types filters compactly; get_node_type returns enriched detail', async () => {
    const list = await call(session, 'list_node_types', { query: 'button' });
    const names = list.data.nodeTypes.map((r: any) => r.typeName);
    expect(names).toContain('net.noodl.controls.button');
    expect(list.data.categories.length).toBeGreaterThan(0);

    const detail = await call(session, 'get_node_type', { type_names: ['net.noodl.controls.button', 'Grup'] });
    const [button, miss] = detail.data.types;
    expect(button.outputs.map((p: any) => p.name)).toContain('onClick');
    expect(miss.error).toContain('Unknown');
    expect(miss.suggestion).toBe('Group');
  });

  it('examples are browsable and fetchable', async () => {
    const list = await call(session, 'list_examples', { node_type: 'RouterNavigate' });
    expect(list.data.examples.length).toBeGreaterThanOrEqual(0);
    const all = await call(session, 'list_examples');
    expect(all.data.examples.length).toBeGreaterThan(10);
    const first = all.data.examples[0];
    const ex = await call(session, 'get_example', { id: first.id });
    expect(ex.data.id).toBe(first.id);
    expect(ex.data.components[0].nodes.length).toBeGreaterThan(0);

    const missing = await call(session, 'get_example', { id: 'nope' });
    expect(missing.isError).toBe(true);
    expect(missing.data.error.code).toBe('not-found');
  });

  // ─── Validate ───────────────────────────────────────────────────────────────

  it('validate_project is clean on the fixture (strict)', async () => {
    const { data } = await call(session, 'validate_project', { strict: true });
    expect(data.summary.errors).toBe(0);
  });

  // ─── Author: create ─────────────────────────────────────────────────────────

  const settingsNodes = [
    { id: 'page', type: 'Page', label: 'Settings', parameters: { title: 'Settings' } },
    { id: 'layout', type: 'Group', parent: 'page' },
    { id: 'heading', type: 'Text', parent: 'layout', parameters: { text: 'Settings' } },
    { id: 'back', type: 'net.noodl.controls.button', parent: 'layout', parameters: { label: 'Back' } },
    { id: 'nav', type: 'RouterNavigate', label: 'Back Home', parameters: { target: '/Pages/Home' } }
  ];

  it('create_component validates, writes and updates the registry', async () => {
    const res = await call(session, 'create_component', {
      path: 'Pages/Settings',
      nodes: settingsNodes,
      connections: [{ fromId: 'back', fromProperty: 'onClick', toId: 'nav', toProperty: 'navigate' }],
      description: 'Settings page with a back button'
    });
    expect(res.isError).toBe(false);
    expect(res.data.created).toBe('Pages/Settings');
    expect(res.data.legacyName).toBe('/Pages/Settings');
    expect(res.data.type).toBe('page'); // inferred from the path
    expect(res.data.validation.summary.errors).toBe(0);

    // Files + registry on disk
    expect(exists(dir, 'components/Pages/Settings/nodes.json')).toBe(true);
    const registry = readJson(dir, 'components/_registry.json');
    expect(registry.components['Pages/Settings'].type).toBe('page');
    expect(registry.stats.totalComponents).toBe(4);

    // children[] derived from parent fields
    const nodes = readJson(dir, 'components/Pages/Settings/nodes.json');
    const page = nodes.nodes.find((n: any) => n.id === 'page');
    expect(page.children).toEqual(['layout']);

    // Whole project still validates
    const validation = await call(session, 'validate_project', { strict: true });
    expect(validation.data.summary.errors).toBe(0);
  });

  it('rejects a typo node type with a suggestion and writes nothing', async () => {
    const res = await call(session, 'create_component', {
      path: 'Pages/Broken',
      nodes: [{ id: 'g', type: 'Grup' }]
    });
    expect(res.isError).toBe(true);
    expect(res.data.error.code).toBe('validation-failed');
    const diagnostic = res.data.error.details.newErrors[0];
    expect(diagnostic.code).toBe('unknown-node-type');
    expect(diagnostic.suggestion).toBe('Group');
    expect(exists(dir, 'components/Pages/Broken')).toBe(false);
    const registry = readJson(dir, 'components/_registry.json');
    expect(registry.components['Pages/Broken']).toBeUndefined();
  });

  it('rejects a bad port with valid alternatives and writes nothing', async () => {
    // Port checks apply to static-port nodes (dynamic-port nodes are skipped by
    // SUB-006 design) — Counter's outputs are static.
    const res = await call(session, 'create_component', {
      path: 'Pages/Broken2',
      nodes: [
        { id: 'counter', type: 'Counter' },
        { id: 'sw', type: 'Switch' }
      ],
      connections: [{ fromId: 'counter', fromProperty: 'cont', toId: 'sw', toProperty: 'flip' }]
    });
    expect(res.isError).toBe(true);
    const errs = res.data.error.details.newErrors;
    const portError = errs.find((d: any) => d.code === 'nonexistent-port');
    expect(portError).toBeDefined();
    expect(`${portError.suggestion} ${(portError.alternatives ?? []).join(',')}`).toMatch(/countChanged|currentCount/);
    expect(exists(dir, 'components/Pages/Broken2')).toBe(false);
  });

  it('rejects a connection to a nonexistent node and writes nothing', async () => {
    const res = await call(session, 'create_component', {
      path: 'Pages/Broken4',
      nodes: settingsNodes,
      connections: [{ fromId: 'back', fromProperty: 'onClick', toId: 'ghost', toProperty: 'navigate' }]
    });
    expect(res.isError).toBe(true);
    expect(res.data.error.details.newErrors.some((d: any) => d.code === 'dangling-connection')).toBe(true);
    expect(exists(dir, 'components/Pages/Broken4')).toBe(false);
  });

  it('rejects malformed node input with nothing written', async () => {
    // `parameters` must be an object — rejected at the argument-schema layer.
    const res = await call(session, 'create_component', {
      path: 'Pages/Broken3',
      nodes: [{ id: 'x', type: 'Group', parameters: 'not-an-object' as unknown as Record<string, unknown> }]
    });
    expect(res.isError).toBe(true);
    expect(exists(dir, 'components/Pages/Broken3')).toBe(false);
  });

  // ─── Author: update ─────────────────────────────────────────────────────────

  it('update_component applies batched operations with revision safety', async () => {
    const before = await call(session, 'get_component', { path: 'Pages/Home' });
    const res = await call(session, 'update_component', {
      path: 'Pages/Home',
      if_revision: before.data.revision,
      operations: [
        {
          op: 'add_node',
          node: { id: 'settingsBtn', type: 'net.noodl.controls.button', parent: 'layout', parameters: { label: 'Settings' } }
        },
        { op: 'add_node', node: { id: 'navSettings', type: 'RouterNavigate' } },
        {
          op: 'add_connection',
          connection: { fromId: 'settingsBtn', fromProperty: 'onClick', toId: 'navSettings', toProperty: 'navigate' }
        }
      ]
    });
    expect(res.isError).toBe(false);
    expect(res.data.applied).toHaveLength(3);
    expect(res.data.validation.summary.errors).toBe(0);

    const after = await call(session, 'get_component', { path: 'Pages/Home' });
    expect(after.data.nodes).toHaveLength(8);
    expect(after.data.connections).toHaveLength(2);
    const layout = after.data.nodes.find((n: any) => n.id === 'layout');
    expect(layout.children).toContain('settingsBtn');

    // Stale revision now fails
    const stale = await call(session, 'update_component', {
      path: 'Pages/Home',
      if_revision: before.data.revision,
      operations: [{ op: 'remove_node', id: 'navSettings' }]
    });
    expect(stale.isError).toBe(true);
    expect(stale.data.error.code).toBe('conflict');
  });

  it('a failing operation aborts the whole batch', async () => {
    const before = readJson(dir, 'components/Pages/Home/nodes.json');
    const res = await call(session, 'update_component', {
      path: 'Pages/Home',
      operations: [
        { op: 'add_node', node: { id: 'ok', type: 'Text', parent: 'layout' } },
        { op: 'remove_node', id: 'does-not-exist' }
      ]
    });
    expect(res.isError).toBe(true);
    expect(res.data.error.code).toBe('invalid-argument');
    expect(readJson(dir, 'components/Pages/Home/nodes.json')).toEqual(before);
  });

  it('update_component rejects new semantic errors but tolerates preexisting ones', async () => {
    // Introduce a component that already has an unknown type on disk (module node).
    const res = await call(session, 'create_component', {
      path: 'Widgets/Module',
      nodes: [{ id: 'm', type: 'some.module.widget' }],
      allow_unknown_types: true
    });
    expect(res.isError).toBe(false);

    // An edit that does NOT touch the unknown node must pass...
    const ok = await call(session, 'update_component', {
      path: 'Widgets/Module',
      operations: [{ op: 'add_node', node: { id: 'label', type: 'Text' } }]
    });
    expect(ok.isError).toBe(false);
    expect(ok.data.validation.preexistingErrors?.length ?? 0).toBeGreaterThan(0);

    // ...while an edit introducing a NEW unknown type still fails.
    const bad = await call(session, 'update_component', {
      path: 'Widgets/Module',
      operations: [{ op: 'add_node', node: { id: 'bad', type: 'Grup' } }]
    });
    expect(bad.isError).toBe(true);
    expect(bad.data.error.details.newErrors[0].suggestion).toBe('Group');
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

    const res = await call(session, 'update_component', {
      path: 'Card',
      operations: [{ op: 'update_node', id: 'card_text', parameters: { text: 'edited on a legacy component' } }]
    });
    expect(res.isError).toBe(false);

    const component = readJson(dir, 'components/Card/component.json');
    expect(component.id).toBeTruthy();
    expect(readJson(dir, 'components/Card/nodes.json').componentId).toBe(component.id);
    expect(readJson(dir, 'components/Card/connections.json').componentId).toBe(component.id);
  });

  it('list_components explains an empty type-filter result (Gate G1 feedback)', async () => {
    const res = await call(session, 'list_components', { type: 'cloud' });
    expect(res.data.components).toEqual([]);
    expect(res.data.note).toContain('No components of type "cloud"');
    expect(res.data.note).toContain('visual');
  });

  it('update_component set replaces the whole graph', async () => {
    const res = await call(session, 'update_component', {
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
    const onDisk = readJson(dir, 'components/Card/nodes.json');
    expect(onDisk.nodes).toHaveLength(3);
    expect(onDisk.nodes.find((n: any) => n.id === 't1').parent).toBe('root');
  });

  // ─── Author: delete ─────────────────────────────────────────────────────────

  it('delete_component refuses while referenced, force-deletes with a report', async () => {
    const refused = await call(session, 'delete_component', { path: 'Card' });
    expect(refused.isError).toBe(true);
    expect(refused.data.error.details.usages).toEqual([
      expect.objectContaining({ component: 'Pages/Home', nodeId: 'card' })
    ]);
    expect(exists(dir, 'components/Card/nodes.json')).toBe(true);

    const forced = await call(session, 'delete_component', { path: 'Card', force: true });
    expect(forced.isError).toBe(false);
    expect(exists(dir, 'components/Card/nodes.json')).toBe(false);
    expect(forced.data.brokenReferences.length).toBeGreaterThan(0);

    const validation = await call(session, 'validate_project', {});
    expect(validation.data.summary.errors).toBeGreaterThan(0); // Home now has a dangling ref — reported honestly
  });

  it('delete_component removes an unreferenced component cleanly', async () => {
    // Remove the Card instance from Home first, then delete Card.
    const detach = await call(session, 'update_component', {
      path: 'Pages/Home',
      operations: [{ op: 'remove_node', id: 'card' }]
    });
    expect(detach.isError).toBe(false);
    const res = await call(session, 'delete_component', { path: 'Card' });
    expect(res.isError).toBe(false);
    const validation = await call(session, 'validate_project', { strict: true });
    expect(validation.data.summary.errors).toBe(0);
  });
});
