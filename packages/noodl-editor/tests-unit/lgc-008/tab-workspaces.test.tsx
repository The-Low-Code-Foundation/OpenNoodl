/**
 * LGC-008 F4 — a workspace's edit belongs to the tab that produced it.
 *
 * `CanvasTabs.handleWorkspaceChange` used to write to `activeTab`: the tab from the render that
 * produced the callback, not the tab that owns the workspace that fired. It was safe by a
 * single thread — switching tabs changed the `key`, so React unmounted the outgoing workspace
 * *without re-rendering it*, so its `onChangeRef.current` still held the closure from the render
 * in which it was active. A pane that keeps several workspaces mounted at once breaks exactly
 * that: a background workspace re-renders with its parent, picks up a callback bound to the new
 * active tab, and its next flush writes its blocks and its generated code onto another node.
 *
 * ## What this file can and cannot prove
 *
 * There is no React test environment here: `testEnvironment: 'node'`, no jsdom, no
 * `@testing-library/react`, and nothing may be installed. So the gate is the **element tree**,
 * which is plain objects and needs no renderer — and which is precisely the thing that decides
 * a remount, since React remounts on a change of key, type or sibling position and on nothing
 * else. `buildTabWorkspaces` exists to make that tree a value rather than a side effect of a
 * component that calls hooks.
 *
 * ⚠️ What it does NOT prove: that React really keeps the instance mounted, and that Blockly
 * really keeps its blocks across a splitter drag. Those need a live drive, and they are written
 * out in the task file's *Deferred verification*.
 */

import React from 'react';

import { buildTabWorkspaces, TabWorkspaceEdit } from '../../src/editor/src/views/CanvasTabs/tabWorkspaces';

import type { Tab } from '../../src/editor/src/contexts/CanvasTabsContext';

const tabA: Tab = { id: 'logic-builder-a', type: 'logic-builder', nodeId: 'node-a', nodeName: 'A', workspace: '{"a":1}' };
const tabB: Tab = { id: 'logic-builder-b', type: 'logic-builder', nodeId: 'node-b', nodeName: 'B', workspace: '{"b":1}' };

/**
 * React 19's `ReactElement` types `props` as `unknown` unless it is told the component's props.
 * These specs deliberately read the tree the way React does — by key, type and prop — so the
 * props are reached as a plain record rather than by importing every component's prop type.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyElement = React.ReactElement<Record<string, any>>;

/** The per-tab container elements, in the order they are rendered. */
function containersOf(elements: AnyElement[]) {
  return elements.map((element) => ({
    key: element.key,
    tabId: element.props['data-tab-id'] as string,
    display: element.props.style.display as string,
    element
  }));
}

/**
 * The `BlocklyWorkspace` element inside one tab's container, reached through its `Suspense`.
 * Walked rather than searched by type: the shape of the tree is part of what is being gated,
 * because a workspace that moved to a different parent would remount.
 */
function workspaceIn(container: AnyElement): AnyElement {
  const suspense = container.props.children as AnyElement;
  return suspense.props.children as AnyElement;
}

describe('LGC-008 F4 — buildTabWorkspaces', () => {
  it('binds each workspace edit to its own tab, not to whichever tab is active', () => {
    const edits: TabWorkspaceEdit[] = [];
    const elements = buildTabWorkspaces({
      tabs: [tabA, tabB],
      activeTabId: tabA.id,
      onEdit: (edit) => edits.push(edit)
    });

    for (const container of containersOf(elements)) {
      const workspace = workspaceIn(container.element);
      workspace.props.onChange(null, `blocks-for-${container.tabId}`, `code-for-${container.tabId}`);
    }

    // Every edit reports the tab whose element produced it. With one workspace mounted this is
    // true of the old code too; with more than one it is the whole defect.
    for (const edit of edits) {
      expect(edit.workspace).toBe(`blocks-for-${edit.tab.id}`);
      expect(edit.code).toBe(`code-for-${edit.tab.id}`);
    }
    expect(edits.length).toBe(elements.length);
  });

  it('threads a declined generation through as undefined rather than as the empty program', () => {
    // LGC-007's ruling, restated at this seam: `''` is a real program a user can have written,
    // and a refusal that writes it publishes its silence over the last good code.
    const edits: TabWorkspaceEdit[] = [];
    const elements = buildTabWorkspaces({ tabs: [tabA], activeTabId: tabA.id, onEdit: (e) => edits.push(e) });

    workspaceIn(elements[0]).props.onChange(null, '{"blocks":[]}', undefined);

    expect(edits).toHaveLength(1);
    expect(edits[0].code).toBeUndefined();
    expect(edits[0].workspace).toBe('{"blocks":[]}');
  });

  it('keys each tab on the outermost per-tab element, so showing and hiding never moves a key', () => {
    const elements = buildTabWorkspaces({ tabs: [tabA], activeTabId: tabA.id, onEdit: jest.fn() });
    const [container] = containersOf(elements);

    expect(container.key).toBe(tabA.id);
    expect(container.display).toBe('block');
  });

  it('passes each tab its own saved blocks and node id', () => {
    // `BlocklyWorkspace` reads `initialWorkspace` once, on mount. Handing it the wrong tab's
    // JSON is the same class of defect as saving to the wrong tab, one step earlier.
    const elements = buildTabWorkspaces({ tabs: [tabA, tabB], activeTabId: tabB.id, onEdit: jest.fn() });

    for (const container of containersOf(elements)) {
      const tab = [tabA, tabB].find((t) => t.id === container.tabId) as Tab;
      const workspace = workspaceIn(container.element);
      expect(workspace.props.nodeId).toBe(tab.nodeId);
      expect(workspace.props.initialWorkspace).toBe(tab.workspace);
    }
  });

  it('mounts every open tab and hides the inactive ones, rather than unmounting them', () => {
    // The acceptance criterion the pane is graded on. `BlocklyWorkspace` injects once and never
    // reloads from props, so a remount is a fresh workspace rebuilt from the last saved JSON —
    // it discards whatever is still inside the 300 ms debounce along with the scroll position
    // and the undo stack.
    const containers = containersOf(buildTabWorkspaces({ tabs: [tabA, tabB], activeTabId: tabB.id, onEdit: jest.fn() }));

    expect(containers.map((c) => c.tabId)).toEqual([tabA.id, tabB.id]);
    expect(containers.map((c) => c.display)).toEqual(['none', 'block']);
    // Keys and order both stay put across a switch — the two things React remounts on.
    const switched = containersOf(buildTabWorkspaces({ tabs: [tabA, tabB], activeTabId: tabA.id, onEdit: jest.fn() }));
    expect(switched.map((c) => c.key)).toEqual(containers.map((c) => c.key));
    expect(switched.map((c) => c.display)).toEqual(['block', 'none']);
  });

  it('🔴 a background workspace saves to its own node, not to the active tab', () => {
    // The F4 defect itself, and the reason it had to be fixed before this structure existed. A
    // background workspace re-renders whenever its parent does, so it is handed a *new*
    // `onChange` bound to whatever tab is active now. Its next flush — an edit made before the
    // switch, landing after it — used to write its blocks and its generated code onto the other
    // node's model. Silently, and only visible in the saved file.
    const edits: TabWorkspaceEdit[] = [];
    const elements = buildTabWorkspaces({
      tabs: [tabA, tabB],
      activeTabId: tabB.id, // B is active; A is mounted behind it
      onEdit: (edit) => edits.push(edit)
    });

    const background = containersOf(elements).find((c) => c.tabId === tabA.id);
    workspaceIn(background.element).props.onChange(null, '{"a":2}', 'code A');

    expect(edits).toHaveLength(1);
    expect(edits[0].tab.id).toBe(tabA.id);
    expect(edits[0].tab.nodeId).toBe(tabA.nodeId);
  });
});
