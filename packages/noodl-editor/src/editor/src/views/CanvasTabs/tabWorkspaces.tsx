import React, { Suspense, lazy } from 'react';

import css from './CanvasTabs.module.scss';

import type { Tab } from '../../contexts/CanvasTabsContext';

/**
 * Blockly is ~1.1 MB before its message bundle, and the overwhelming majority of sessions
 * never open a Logic Builder. Loading it on first tab open keeps it out of the renderer's
 * main bundle entirely.
 *
 * `lazy` does not evaluate the import until something renders the element, which is what lets
 * this module be imported by a plain-Node spec with no Blockly anywhere near it.
 */
const BlocklyWorkspace = lazy(() =>
  import('../BlocklyEditor/BlocklyWorkspace').then((m) => ({ default: m.BlocklyWorkspace }))
);

/** One settled edit, already attributed to the tab whose workspace produced it. */
export interface TabWorkspaceEdit {
  tab: Tab;
  /** The serialised Blockly workspace. Always the user's blocks; always saved. */
  workspace: string;
  /**
   * `undefined` when generation **declined** — see `BlocklyWorkspaceProps.onChange`. Threaded
   * rather than defaulted: the difference between "no honest code for this edit" and "the empty
   * program" is the whole point of the type.
   */
  code: string | undefined;
}

export interface BuildTabWorkspacesArgs {
  tabs: Tab[];
  activeTabId: string | undefined;
  onEdit: (edit: TabWorkspaceEdit) => void;
}

/**
 * The mounted Blockly workspaces, one element per tab.
 *
 * ## Why this is a function and not JSX inside `CanvasTabs`
 *
 * What decides whether a workspace is *remounted* is the element tree: its key, its type and
 * its position among its siblings. React remounts on a change to any of those and on nothing
 * else. So the element tree is the thing to gate, and it is gated here — `CanvasTabs` itself
 * calls hooks, which cannot run outside a renderer, and there is no React test environment in
 * this repo's plain-Node runner (`testEnvironment: 'node'`, no jsdom, no
 * `@testing-library/react`). A pure builder is the largest part of the property that can be
 * held by a spec rather than by a drive.
 *
 * ## 🔴 F4 — why `onChange` is bound to `tab` and not to the active tab
 *
 * `CanvasTabs.handleWorkspaceChange` used to write to `activeTab` — the tab from the render
 * that produced the callback, **not** the tab that owns the workspace that fired. That was safe
 * by a single thread: switching tabs changed the `key`, so React unmounted the outgoing
 * `BlocklyWorkspace` *without re-rendering it*, so its `onChangeRef.current` still held the
 * closure from the render in which it was active, so its unmount flush wrote to the right node.
 *
 * **A pane that keeps several workspaces mounted at once breaks exactly that.** A background
 * workspace *does* re-render when its parent does, so `onChangeRef.current` is replaced with a
 * callback bound to the **new** active tab, and its next flush writes its JSON and its
 * generated code onto a different node's model — "show the wrong program and then save it over
 * the right one", arriving by a route `BlocklyWorkspace.tsx`'s own warning does not describe.
 * The key is not the defence people think it is.
 *
 * The fix is not a key. It is that the callback carries the tab it belongs to, decided here at
 * the call site, where the tab is in hand and cannot be confused with whichever one happens to
 * be active when it fires.
 */
export function buildTabWorkspaces({ tabs, activeTabId, onEdit }: BuildTabWorkspacesArgs): React.ReactElement[] {
  // ⚠️ Only the active tab is mounted, which is what the editor has always done — the pane is
  // the change that mounts more than one, and F4 is fixed *first*, deliberately, so the pane
  // cannot be the thing that exposes it. Removing this filter is the whole of that change.
  const mounted = tabs.filter((tab) => tab.id === activeTabId);

  return mounted.map((tab) => {
    const isActive = tab.id === activeTabId;

    return (
      <div
        // Keyed by tab id, and the key is on the outermost per-tab element so that showing and
        // hiding a tab never changes it. `BlocklyWorkspace` injects its workspace once and
        // never reloads it from props, so a key that moved would show the previous node's
        // blocks and then save them over the newly selected node.
        key={tab.id}
        className={css['BlocklyContainer']}
        // Hidden rather than unmounted. `Blockly.svgResize` reads
        // `parentElement.offsetWidth/offsetHeight`, which are 0 under `display: none`, so a
        // hidden workspace ignores resize calls and must be resized again when it is revealed —
        // which is what the reveal effect in `CanvasTabs` is for.
        style={{ display: isActive ? 'block' : 'none' }}
        data-tab-id={tab.id}
        aria-hidden={!isActive}
      >
        <Suspense fallback={<div className={css['TabLoading']}>Loading the block editor…</div>}>
          <BlocklyWorkspace
            nodeId={tab.nodeId}
            initialWorkspace={tab.workspace || undefined}
            onChange={(_workspaceSvg, workspace, code) => onEdit({ tab, workspace, code })}
          />
        </Suspense>
      </div>
    );
  });
}
