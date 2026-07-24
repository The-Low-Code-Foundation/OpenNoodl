/**
 * "Author via MCP, open in the editor" — proxy test. The editor loads v2
 * components through ProjectImporter.reconstructLegacyComponent (SUB-001
 * ComponentLoader path); we assert an MCP-authored component reconstructs into
 * a well-formed legacy component graph.
 */
import * as fs from 'fs';

import { reconstructLegacyComponent } from '../../noodl-editor/src/editor/src/io/ProjectImporter';

import type { ComponentV2File, ConnectionsV2File, NodesV2File } from '../src/editor-deps';
import type { CreateComponentResponse } from '../src/tools/responses';
import { call, connect, copyFixture, readJson, TestSession } from './helpers';

describe('MCP-authored components load through the editor import path', () => {
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

  it('reconstructs an MCP-created page into a legacy component graph', async () => {
    const res = await call<CreateComponentResponse>(session, 'create_component', {
      path: 'Pages/Settings',
      nodes: [
        { id: 'page', type: 'Page', parameters: { title: 'Settings' } },
        { id: 'layout', type: 'Group', parent: 'page' },
        { id: 'text', type: 'Text', parent: 'layout', parameters: { text: 'Settings' } },
        { id: 'back', type: 'net.noodl.controls.button', parent: 'layout' },
        { id: 'nav', type: 'RouterNavigate' }
      ],
      connections: [{ fromId: 'back', fromProperty: 'onClick', toId: 'nav', toProperty: 'navigate' }]
    });
    expect(res.isError).toBe(false);

    const component = readJson<ComponentV2File>(dir, 'components/Pages/Settings/component.json');
    const nodes = readJson<NodesV2File>(dir, 'components/Pages/Settings/nodes.json');
    const connections = readJson<ConnectionsV2File>(dir, 'components/Pages/Settings/connections.json');

    const legacy = reconstructLegacyComponent('Pages/Settings', component, nodes, connections);

    expect(legacy.name).toBe('/Pages/Settings');
    // Two roots: the page tree and the free-floating navigate node.
    const rootIds = legacy.graph.roots.map((r) => r.id).sort();
    expect(rootIds).toEqual(['nav', 'page']);
    // The tree nests correctly.
    const page = legacy.graph.roots.find((r) => r.id === 'page')!;
    expect(page.children?.[0].id).toBe('layout');
    expect(page.children?.[0].children?.map((c) => c.id)).toEqual(['text', 'back']);
    // Connections survive.
    expect(legacy.graph.connections).toEqual([
      { fromId: 'back', fromProperty: 'onClick', toId: 'nav', toProperty: 'navigate' }
    ]);
  });
});
