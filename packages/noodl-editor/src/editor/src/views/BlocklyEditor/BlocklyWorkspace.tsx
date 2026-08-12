/**
 * BlocklyWorkspace Component
 *
 * React wrapper for the Google Blockly visual programming workspace, as used by the Logic
 * Builder node. Owns one Blockly workspace for its lifetime: injection, persistence,
 * language, theme and disposal.
 *
 * One instance is one node's blocks. Callers must key the element by node id — the workspace
 * is injected once and deliberately never reloaded from props (see `initialWorkspace`), so a
 * reused instance would show the wrong program and then save it over the right one.
 *
 * @module BlocklyEditor
 */

import * as Blockly from 'blockly';
import React, { useEffect, useRef, useState } from 'react';

import { CanvasTheme } from '../nodegrapheditor/canvas/CanvasTheme';
import { applyLanguage, currentLanguageCode } from './BlocklyLocale';
import { buildBlocklyTheme, resolveBlocklyChrome } from './BlocklyTheme';
import css from './BlocklyWorkspace.module.scss';
import { buildToolbox } from './BlocklyToolbox';
import { generateWithMyBlocks, initMyBlocks, myBlocksFlyout, MY_BLOCKS_CATEGORY } from './MyBlocksBlocks';
import { myBlocksStore } from './MyBlocksShelves';
import type { BlocklyWorkspaceJson } from './myblocks/format';
import { initBlocklyIntegration } from './initialize';

/** How long to coalesce edits before serialising and generating code. */
const SAVE_DEBOUNCE_MS = 300;

export interface BlocklyWorkspaceProps {
  /**
   * Workspace JSON to open with. Read once, on mount — later changes are ignored, because
   * this prop is fed by our own `onChange` and re-loading on it would fight the user's
   * cursor. Key the component by node id to show a different program.
   */
  initialWorkspace?: string;
  /** Called after every settled edit with the serialised workspace and the generated code. */
  onChange?: (workspace: Blockly.WorkspaceSvg, json: string, code: string) => void;
  /** Read-only mode */
  readOnly?: boolean;
}

export function BlocklyWorkspace({ initialWorkspace, onChange, readOnly = false }: BlocklyWorkspaceProps) {
  const blocklyDiv = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The change listener is registered once, so it must not close over `onChange` — a
  // re-rendered parent would otherwise keep writing through the callback captured at mount.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  /**
   * The last code that generated cleanly (LGC-007 §3).
   *
   * A program whose saved blocks cannot be expanded — a cycle in the definition graph, a
   * definition deleted from under a reference, a definition whose shape changed — has no
   * honest JavaScript. The blocks are still saved; the *code* falls back to the last good one
   * rather than becoming empty or becoming a different program, because a Logic Builder node
   * that silently starts doing something else is worse than one that stops changing.
   */
  const lastGoodCodeRef = useRef('');

  // Injection waits on the language bundle, so the toolbox is built with the right labels
  // rather than being rebuilt a frame later.
  const [failedToLoad, setFailedToLoad] = useState(false);

  useEffect(() => {
    let disposed = false;
    let workspace: Blockly.WorkspaceSvg | null = null;
    const themeContext = {};

    const flushSave = () => {
      if (!workspace || !onChangeRef.current) return;
      const saved = Blockly.serialization.workspaces.save(workspace) as BlocklyWorkspaceJson;
      const json = JSON.stringify(saved);

      // Saved blocks are inlined before generation (LGC-007). A workspace that uses none takes
      // the fast path and behaves exactly as it did before the feature existed.
      const generated = generateWithMyBlocks(workspace, saved, myBlocksStore());
      if (generated.error) {
        console.error('[Blockly] The saved blocks in this program could not be expanded:', generated.error.message);
      } else {
        lastGoodCodeRef.current = generated.code;
      }

      onChangeRef.current(workspace, json, lastGoodCodeRef.current);
    };

    async function setup() {
      // Custom blocks and generators must exist before the toolbox referencing them is built.
      initBlocklyIntegration();
      initMyBlocks();

      const labels = await applyLanguage(currentLanguageCode());
      if (disposed || !blocklyDiv.current) return;

      const chrome = resolveBlocklyChrome();

      workspace = Blockly.inject(blocklyDiv.current, {
        toolbox: buildToolbox(labels),
        theme: buildBlocklyTheme(),
        readOnly,
        trashcan: true,
        zoom: {
          controls: true,
          wheel: true,
          startScale: 1.0,
          maxScale: 3,
          minScale: 0.3,
          scaleSpeed: 1.2
        },
        grid: {
          spacing: 20,
          length: 3,
          colour: chrome.subtle,
          snap: true
        },
        move: { scrollbars: true, drag: true, wheel: true }
      });

      workspaceRef.current = workspace;

      // The My Blocks category is dynamic, like Variables and Functions: its contents change
      // whenever a definition is saved, renamed or deleted, and Blockly rebuilds it on every
      // flyout open. Registering it after injection is the documented order.
      workspace.registerToolboxCategoryCallback(MY_BLOCKS_CATEGORY, myBlocksFlyout(myBlocksStore()) as never);

      if (initialWorkspace) {
        try {
          // Events off during load: deserialisation fires a BLOCK_CREATE per block, which
          // would otherwise debounce into a save that writes the file back to itself.
          Blockly.Events.disable();
          Blockly.serialization.workspaces.load(JSON.parse(initialWorkspace), workspace);
        } catch (error) {
          console.error('[Blockly] Could not load the saved blocks', error);
        } finally {
          Blockly.Events.enable();
        }
      }

      workspace.addChangeListener(changeListener);

      // Follow the editor's light/dark setting (UIX-005 contract). The grid is not part of
      // the theme object and Blockly's setter for it is private, so the grid colour is
      // restyled from CSS instead (see `.blocklyGridPattern` in the stylesheet) — which
      // re-resolves on a theme flip for free.
      CanvasTheme.instance.on(() => {
        if (!workspace) return;
        workspace.setTheme(buildBlocklyTheme());
      }, themeContext);
    }

    /**
     * Persist on anything that changed the program.
     *
     * `isUiEvent` is the whole filter: Blockly marks clicks, selections, viewport moves and
     * drags as UI events, and everything else — create, delete, change, and crucially the
     * BLOCK_MOVE that fires when two blocks are connected — as a real change. Enumerating UI
     * event types by hand is what previously dropped block connections on the floor.
     */
    function changeListener(event: Blockly.Events.Abstract) {
      if (!workspace || event.isUiEvent) return;
      if (event.type === Blockly.Events.FINISHED_LOADING) return;
      // Mid-drag intermediate states are not worth serialising; the drop fires its own event.
      if (workspace.isDragging()) return;

      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(flushSave, SAVE_DEBOUNCE_MS);
    }

    setup().catch((error) => {
      console.error('[Blockly] Could not open the block editor', error);
      if (!disposed) setFailedToLoad(true);
    });

    return () => {
      disposed = true;

      // A pending edit must not be lost to a tab close — flush it rather than drop it.
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
        flushSave();
      }

      CanvasTheme.instance.off(themeContext);

      if (workspace) {
        workspace.removeChangeListener(changeListener);
        workspace.dispose();
      }
      workspace = null;
      workspaceRef.current = null;
    };
    // Mount-only by design: see `initialWorkspace`. `readOnly` is fixed per tab, and the
    // component is keyed by node id so a different program means a fresh mount.
  }, []);

  return (
    <div className={css.Root}>
      {failedToLoad ? (
        <div className={css.LoadError}>The block editor could not be opened. See the developer console for details.</div>
      ) : null}
      <div ref={blocklyDiv} className={css.BlocklyContainer} />
    </div>
  );
}
