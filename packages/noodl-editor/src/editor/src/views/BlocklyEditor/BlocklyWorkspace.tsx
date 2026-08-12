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
import { registerBlocklyResizeHandler } from './blocklyResize';
import { buildBlocklyTheme, resolveBlocklyChrome } from './BlocklyTheme';
import css from './BlocklyWorkspace.module.scss';
import { buildToolbox } from './BlocklyToolbox';
import { DoItHandle, attachDoIt } from './DoItController';
import { InterfaceRailsHandle, attachInterfaceRails } from './InterfaceRailsOverlay';
import { withBlockProbes } from './BlockProbes';
import { BlockValueHandle, attachBlockValues } from './BlockValueController';
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
  /**
   * LGC-002 — the Logic Builder node these blocks belong to.
   *
   * Do It generates code here and runs it **in the viewer**, against that node's live inputs,
   * so the node id is the whole address of the round trip. Optional, and the menu item
   * explains its own absence rather than disappearing: a tab opened without one is a wiring
   * mistake, and a missing menu item is the hardest kind of wiring mistake to see.
   */
  nodeId?: string;
}

export function BlocklyWorkspace({ initialWorkspace, onChange, readOnly = false, nodeId }: BlocklyWorkspaceProps) {
  const blocklyDiv = useRef<HTMLDivElement>(null);
  // LGC-004 — the two interface rails. Rendered as siblings of the injection div (rather than as
  // layers over it) so they cannot cover Blockly's left-edge toolbox, and so the workspace is
  // injected at its final width and needs no `svgResize` when they appear.
  const inputsRailDiv = useRef<HTMLDivElement>(null);
  const outputsRailDiv = useRef<HTMLDivElement>(null);
  /** LGC-003 — the scrubber strip goes below the workspace, inside the same root. */
  const rootRef = useRef<HTMLDivElement>(null);
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
    let unregisterResize: (() => void) | null = null;
    // LGC-002. Its own handle rather than anything on the workspace: Do It is an overlay and
    // must stay separable from the workspace's own lifecycle, including its serialisation.
    let doIt: DoItHandle | null = null;
    // LGC-004. Also its own handle: the rails are DOM outside the SVG and must stay separable
    // from the workspace's serialisation, for the reason `DoItBalloons` states at length.
    let rails: InterfaceRailsHandle | null = null;
    // LGC-003. Its own handle for the same reason Do It has one: live values are an overlay
    // and must stay separable from the workspace's own lifecycle and from its serialisation.
    let blockValues: BlockValueHandle | null = null;

    const flushSave = () => {
      if (!workspace || !onChangeRef.current) return;
      const saved = Blockly.serialization.workspaces.save(workspace) as BlocklyWorkspaceJson;
      const json = JSON.stringify(saved);

      /**
       * LGC-003 §1 — the program is generated **instrumented**, always.
       *
       * There is one generated string, not a debug one and a release one, so there is no class
       * of defect that appears only when nobody is watching. `__p` and `__s` are the ninth and
       * tenth parameters the runtime compiles against, and with nothing attached they are the
       * shared identity pair.
       *
       * `probedIds` is what makes the didn't-execute tell honest: a block that emitted no code
       * is not part of the program and must render neutral, not hollow.
       */
      const probed = withBlockProbes(() =>
        // Saved blocks are inlined before generation (LGC-007). A workspace that uses none takes
        // the fast path and behaves exactly as it did before the feature existed.
        generateWithMyBlocks(workspace as Blockly.WorkspaceSvg, saved, myBlocksStore())
      );
      const generated = probed.result;

      if (generated.error) {
        console.error('[Blockly] The saved blocks in this program could not be expanded:', generated.error.message);
      } else {
        lastGoodCodeRef.current = generated.code;
        if (blockValues) blockValues.setProbedIds(probed.probedIds);
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

      /**
       * LGC-008: Blockly only re-measures itself on a **window** resize (its `inject` binds
       * one listener, and that handler is the library's only `svgResize` caller). A splitter
       * drag or a pane layout change moves the container without moving the window, so the
       * workspace has to be told. See `blocklyResize.ts` for why this is a registry of
       * closures and not a `ResizeObserver`.
       *
       * The zero-size guard is not defensive padding: `svgResize` reads
       * `parentElement.offsetWidth/offsetHeight`, which are 0 for anything under
       * `display: none`, and it would cache that 0 and set the SVG to `0px`. A workspace
       * parked behind an inactive tab must therefore ignore the call and be resized again
       * when it is revealed.
       */
      unregisterResize = registerBlocklyResizeHandler(() => {
        const container = blocklyDiv.current;
        if (!workspace || !container) return;
        if (container.offsetWidth === 0 || container.offsetHeight === 0) return;
        Blockly.svgResize(workspace);
      });

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

      /**
       * 🔴 **Do not register `Blockly.Events.disableOrphans` here.** It was, briefly, as
       * LGC-003 §2's static half; it destroyed every program it was shown and was reverted on
       * Richard's ruling. See `FINDING-2026-08-12-disableOrphans-kills-every-program.md`.
       *
       * The predicate disables any parentless block carrying a `previousConnection` *or* an
       * `outputConnection`, plus its whole `next` chain. That means "unreachable code" only in
       * a language where runnable code hangs off a hat block. **`NoodlBlocks.ts` defines no hat**
       * — 9 statement blocks, 6 value blocks, zero hats — so every Noodl program is a
       * free-floating statement stack and the top of every stack matches the predicate. One
       * user gesture greyed the whole program, collapsed `generatedCode` to `""`, and serialised
       * `disabledReasons: ["ORPHANED_BLOCK"]` to `project.json`. Silently: nothing throws.
       *
       * It also broke the drag-out-and-ask flow. A *floating* value block is parentless with an
       * output connection, so it was disabled, and `classifyBlockForDoIt` refuses a disabled
       * block (`DoIt.ts`, `REASON_DISABLED`) — the one shape Do It exists to serve.
       *
       * Narrowing the predicate to value blocks only is the tempting middle path and is also
       * wrong: it still calls `setDisabledReason`, which is model state that Blockly serialises,
       * and `BlockValueBadges.ts` already rules that the tell is *drawn* rather than *set* for
       * exactly this reason.
       *
       * §2's static tell is therefore unbuilt on purpose, re-filed against the drawn treatment.
       * The other route — giving the language a hat, so "orphan" means what Blockly assumes —
       * is filed as its own language task.
       */

      // LGC-002 — right-click a block, see its value. Attached after the load so the balloon
      // layer's own change listener never sees the deserialisation's BLOCK_CREATE storm.
      doIt = attachDoIt(workspace, nodeId);

      // LGC-004 — the signature at the two edges. Attached after the load, like Do It, so its
      // first paint reads the finished program rather than one block of it.
      if (inputsRailDiv.current && outputsRailDiv.current) {
        rails = attachInterfaceRails({
          workspace,
          inputsHost: inputsRailDiv.current,
          outputsHost: outputsRailDiv.current
        });
      }
      // LGC-003 — the whole program answers at once, during a real run.
      if (rootRef.current) blockValues = attachBlockValues(workspace, rootRef.current, nodeId);

      // Follow the editor's light/dark setting (UIX-005 contract). The grid is not part of
      // the theme object and Blockly's setter for it is private, so the grid colour is
      // restyled from CSS instead (see `.blocklyGridPattern` in the stylesheet) — which
      // re-resolves on a theme flip for free.
      CanvasTheme.instance.on(() => {
        if (!workspace) return;
        workspace.setTheme(buildBlocklyTheme());
        if (blockValues) blockValues.refreshTheme();
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

      // LGC-003. The program changed, so every recorded run is now about a program that no
      // longer exists. Dropped immediately rather than at the end of the debounce: the badges
      // are on screen for those 300 ms and would be describing the old blocks.
      if (blockValues) blockValues.invalidate();

      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(flushSave, SAVE_DEBOUNCE_MS);
    }

    setup().catch((error) => {
      console.error('[Blockly] Could not open the block editor', error);
      if (!disposed) setFailedToLoad(true);
    });

    return () => {
      disposed = true;

      // Before the workspace goes: a handler left in the registry would call `svgResize` on
      // a disposed workspace at the next splitter drag.
      unregisterResize?.();
      unregisterResize = null;

      // A pending edit must not be lost to a tab close — flush it rather than drop it.
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
        flushSave();
      }

      CanvasTheme.instance.off(themeContext);

      // Before the workspace goes: the layers hold references to it. Block tracing also has to
      // be disarmed at the far end, and `dispose` is the only place that happens — a tab closed
      // without it leaves a viewer recording values nobody is reading.
      if (doIt) {
        doIt.dispose();
        doIt = null;
      }

      // Before the workspace goes: the rails hold a change listener and a registered drag target
      // on it.
      if (rails) {
        rails.dispose();
        rails = null;
      }

      if (blockValues) {
        blockValues.dispose();
        blockValues = null;
      }

      if (workspace) {
        workspace.removeChangeListener(changeListener);
        workspace.dispose();
      }
      workspace = null;
      workspaceRef.current = null;
    };
    // Mount-only by design: see `initialWorkspace`. `readOnly` is fixed per tab, and the
    // component is keyed by node id so a different program means a fresh mount — which is also
    // what makes `nodeId` safe to capture here: a different node is a different instance.
  }, []);

  return (
    <div className={css.Root} ref={rootRef}>
      {failedToLoad ? (
        <div className={css.LoadError}>The block editor could not be opened. See the developer console for details.</div>
      ) : null}
      <div className={css.Workspace}>
        {/*
          ⚠️ The rails carry their classes from the **first render**, not from `attachInterfaceRails`.
          Their width has to exist before `Blockly.inject` measures the container, and injection
          happens inside the effect — a rail that widened afterwards would leave the SVG at the
          width it was injected with, which is precisely the class of defect `blocklyResize.ts`
          exists for.
        */}
        <div ref={inputsRailDiv} className={css.Rail + ' ' + css.RailInputs} />
        <div ref={blocklyDiv} className={css.BlocklyContainer} />
        <div ref={outputsRailDiv} className={css.Rail + ' ' + css.RailOutputs} />
      </div>
    </div>
  );
}
