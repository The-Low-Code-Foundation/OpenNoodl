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

  function reconstruct(path: string) {
    const component = readJson<ComponentV2File>(dir, `components/${path}/component.json`);
    const nodes = readJson<NodesV2File>(dir, `components/${path}/nodes.json`);
    const connections = readJson<ConnectionsV2File>(dir, `components/${path}/connections.json`);
    return reconstructLegacyComponent(path, component, nodes, connections);
  }

  // ⚠️ These ids are deliberately distinct from the fixture's other components
  // (AAQ-011/F12). This spec used `page` / `layout` / `nav` — the three ids
  // `/Pages/Home` already carries — which meant it was quietly exercising the
  // collision F12 is about rather than the import path it is named for. The
  // collision case is now its own spec, below.
  it('reconstructs an MCP-created page into a legacy component graph', async () => {
    const res = await call<CreateComponentResponse>(session, 'create_component', {
      path: 'Pages/Settings',
      nodes: [
        { id: 'settings-page', type: 'Page', parameters: { title: 'Settings' } },
        { id: 'settings-layout', type: 'Group', parent: 'settings-page' },
        { id: 'settings-text', type: 'Text', parent: 'settings-layout', parameters: { text: 'Settings' } },
        { id: 'settings-back', type: 'net.noodl.controls.button', parent: 'settings-layout' },
        { id: 'settings-nav', type: 'RouterNavigate', parameters: { target: '/Pages/Home' } }
      ],
      connections: [
        { fromId: 'settings-back', fromProperty: 'onClick', toId: 'settings-nav', toProperty: 'navigate' }
      ]
    });
    expect(res.isError).toBe(false);
    expect(res.data.remappedNodeIds).toBeUndefined();

    const legacy = reconstruct('Pages/Settings');

    expect(legacy.name).toBe('/Pages/Settings');
    // Two roots: the page tree and the free-floating navigate node.
    const rootIds = legacy.graph.roots.map((r) => r.id).sort();
    expect(rootIds).toEqual(['settings-nav', 'settings-page']);
    // The tree nests correctly.
    const page = legacy.graph.roots.find((r) => r.id === 'settings-page')!;
    expect(page.children?.[0].id).toBe('settings-layout');
    expect(page.children?.[0].children?.map((c) => c.id)).toEqual(['settings-text', 'settings-back']);
    // Connections survive.
    expect(legacy.graph.connections).toEqual([
      { fromId: 'settings-back', fromProperty: 'onClick', toId: 'settings-nav', toProperty: 'navigate' }
    ]);
  });

  /**
   * AAQ-011/F12 — the risk the fix introduces, checked against the editor's own
   * loader rather than against our own files: when a write reallocates ids, the
   * parent/child links and the connections must have followed, or the editor
   * reconstructs a component with orphaned roots and dangling wires.
   */
  it('reconstructs a component whose colliding ids were reallocated at write time', async () => {
    const res = await call<CreateComponentResponse>(session, 'create_component', {
      path: 'Pages/Profile',
      nodes: [
        // All three already exist in the fixture's /Pages/Home.
        { id: 'page', type: 'Page', parameters: { title: 'Profile' } },
        { id: 'layout', type: 'Group', parent: 'page' },
        { id: 'nav', type: 'RouterNavigate', parameters: { target: '/Pages/Home' } },
        { id: 'profile-back', type: 'net.noodl.controls.button', parent: 'layout' }
      ],
      connections: [{ fromId: 'profile-back', fromProperty: 'onClick', toId: 'nav', toProperty: 'navigate' }]
    });
    expect(res.isError).toBe(false);
    expect((res.data.remappedNodeIds ?? []).map((r) => r.from).sort()).toEqual(['layout', 'nav', 'page']);

    const legacy = reconstruct('Pages/Profile');
    expect(legacy.graph.roots.map((r) => r.id).sort()).toEqual(['nav-2', 'page-2']);
    const page = legacy.graph.roots.find((r) => r.id === 'page-2')!;
    expect(page.children?.[0].id).toBe('layout-2');
    expect(page.children?.[0].children?.map((c) => c.id)).toEqual(['profile-back']);
    expect(legacy.graph.connections).toEqual([
      { fromId: 'profile-back', fromProperty: 'onClick', toId: 'nav-2', toProperty: 'navigate' }
    ]);
  });
});
