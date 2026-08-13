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

import { ProjectModel } from '../../models/projectmodel';
import { openSettingsPanel } from '../panels/SettingsPanel/settingsPanelRoute';
import { CanvasTheme } from '../nodegrapheditor/canvas/CanvasTheme';
import { appConfigFlyout, setConfigVariablesProvider, APP_CONFIG_CATEGORY, APP_CONFIG_SETTINGS_BUTTON } from './appConfig';
import { applyLanguage, currentLanguageCode } from './BlocklyLocale';
import { registerBlocklyResizeHandler } from './blocklyResize';
import { buildBlocklyTheme, resolveBlocklyChrome } from './BlocklyTheme';
import css from './BlocklyWorkspace.module.scss';
import { buildToolbox } from './BlocklyToolbox';
import { BenchController } from './BenchController';
import { DoItHandle, attachDoIt } from './DoItController';
import { InterfaceRailsHandle, attachInterfaceRails } from './InterfaceRailsOverlay';
import { railModelForWorkspace } from './interfaceRails';
import { withBlockProbes } from './BlockProbes';
import { BlockValueHandle, attachBlockValues } from './BlockValueController';
import {
  generateWithMyBlocks,
  initMyBlocks,
  myBlocksFlyout,
  setMyBlocksDefinitionSource,
  MY_BLOCKS_CATEGORY
} from './MyBlocksBlocks';
import { attachMyBlocksSave, type MyBlocksSaveHandle } from './MyBlocksSave';
import { openSaveBlockDialog } from './MyBlocksSaveDialog';
import { myBlocksStore } from './MyBlocksShelves';
import type { BlocklyWorkspaceJson } from './myblocks/format';
import { initBlocklyDialogs } from './BlocklyDialogs';
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
  /**
   * Called after every settled edit with the serialised workspace and the generated code.
   *
   * 🔴 `code` is `undefined` when generation **declined** — a cycle in the saved-block
   * definition graph, a missing definition, a shape mismatch, a budget overrun. It does not
   * mean "the program is empty"; it means *this edit produced no honest JavaScript*. The
   * blocks in `json` are still the user's and must still be saved. The receiver must leave
   * whatever `generatedCode` it already holds alone.
   *
   * The distinction is the whole point of the type. An empty string here would be
   * indistinguishable from a program the user really did empty, and writing it is how a
   * refusal publishes its silence over the last-known-good code.
   */
  onChange?: (workspace: Blockly.WorkspaceSvg, json: string, code: string | undefined) => void;
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
  /**
   * VFN-011 — the node's saved `generatedCode`, as it is on disk right now.
   *
   * Read once on mount, exactly like {@link initialWorkspace}, and for the same reason: every
   * later value of it comes from this component's own flush. It exists so the strip can say
   * *why* it is empty — a program generated before value tracing emits no probes and can never
   * badge anything — and it is **never written back**. See `BlockValueOptions.generatedCode`.
   */
  generatedCode?: string;
}

export function BlocklyWorkspace({
  initialWorkspace,
  onChange,
  readOnly = false,
  nodeId,
  generatedCode
}: BlocklyWorkspaceProps) {
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
   * There is deliberately **no `lastGoodCode` ref here** (LGC-007 §3).
   *
   * A program whose saved blocks cannot be expanded — a cycle in the definition graph, a
   * definition deleted from under a reference, a definition whose shape changed — has no
   * honest JavaScript. The blocks are still saved; the *code* is left exactly as it is,
   * because a Logic Builder node that silently starts doing something else is worse than one
   * that stops changing.
   *
   * 🔴 This used to be `useRef('')`, seeded from nothing and never from the node's saved
   * `generatedCode`. A refusal on the first flush after mount therefore wrote that `''`
   * straight over the good code on disk, and reopening could not recover it because the cycle
   * was still there and re-emptied it. Driven and confirmed 2026-08-12.
   *
   * The fix is not to seed the ref. It is to not have one: the node's own `generatedCode`
   * parameter *is* the last code that generated cleanly, so a second copy of that fact in the
   * editor is the one-fact-two-stores shape this directory keeps finding (L11). `flushSave`
   * passes `undefined` on a refusal and the writer skips the parameter.
   */

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
    // LGC-007 §1. Its own handle for the same reason the three above have one: the context menu
    // registry is renderer-wide and the session that connects it to *this* workspace's store has
    // to be removed when the workspace goes, or a disposed workspace keeps offering to save.
    let myBlocksSave: MyBlocksSaveHandle | null = null;
    // VFN-011. Its own handle for the reason all four above have one, and one more: the bench holds
    // the sandbox values, which are editor state that must die with the tab rather than reach the
    // workspace's serialisation. See `BenchController`.
    let bench: BenchController | null = null;

    /**
     * LGC-003 §1 — the program is generated **instrumented**, always.
     *
     * There is one generated string, not a debug one and a release one, so there is no class of
     * defect that appears only when nobody is watching. `__p` and `__s` are the ninth and tenth
     * parameters the runtime compiles against, and with nothing attached they are the shared
     * identity pair.
     *
     * 🔴 **Extracted by VFN-011 so the bench runs this and not a second generation.** The bench must
     * execute the program the node will have, and the only thing that knows what that is, is the
     * expression the flush uses. Calling `javascriptGenerator` from the bench would have been a
     * second code path with nothing keeping the two in step — the same defect as a second port list
     * one file over, and this directory has found that shape three times.
     */
    const generateProgram = () => {
      const saved = Blockly.serialization.workspaces.save(workspace as Blockly.WorkspaceSvg) as BlocklyWorkspaceJson;
      const probed = withBlockProbes(() =>
        // Saved blocks are inlined before generation (LGC-007). A workspace that uses none takes
        // the fast path and behaves exactly as it did before the feature existed.
        generateWithMyBlocks(workspace as Blockly.WorkspaceSvg, saved, myBlocksStore())
      );
      return { saved, generated: probed.result, probedIds: probed.probedIds };
    };

    const flushSave = () => {
      if (!workspace || !onChangeRef.current) return;
      const { saved, generated, probedIds } = generateProgram();
      const json = JSON.stringify(saved);
      const probed = { probedIds };

      if (generated.error) {
        console.error('[Blockly] The saved blocks in this program could not be expanded:', generated.error.message);
      } else if (blockValues) {
        blockValues.setProbedIds(probed.probedIds as Set<string>);
        // VFN-011 — the code that is about to be written to the node. A refusal (`undefined`)
        // leaves whatever the node already has, so the strip is told nothing rather than told
        // the program went away.
        if (generated.code !== undefined) blockValues.setGeneratedCode(generated.code);
      }

      /**
       * `generated.code` is `undefined` exactly when generation declined, and that is what
       * travels — never `''`. The blocks (`json`) are saved either way; they are the user's
       * edit and refusing to generate is not a reason to lose them.
       */
      onChangeRef.current(workspace, json, generated.code);
    };

    async function setup() {
      // Custom blocks and generators must exist before the toolbox referencing them is built.
      initBlocklyIntegration();
      initMyBlocks();

      /**
       * VFN-008 — where a call block's tooltip finds the definition it points at.
       *
       * Injected rather than imported by `MyBlocksBlocks`: that module is reachable from the
       * plain-Node runner, and `myBlocksStore` reaches `ProjectModel` and `EditorSettings`,
       * which would fail two suites *to run*. The store is a singleton over live shelves, so
       * registering it on every setup is idempotent and never goes stale.
       */
      setMyBlocksDefinitionSource(myBlocksStore());

      /**
       * VFN-003 — point `Blockly.dialog` at this editor's dialog layer before anything can ask
       * it for a name. Its defaults reach `window.prompt`, which an Electron renderer does not
       * implement, so *Create variable* and *Rename variable* did nothing at all.
       *
       * Here rather than in `initBlocklyIntegration` because the dialogs are React and that
       * module is deliberately reachable from the plain-Node test runner. This is the earliest
       * point in the React half, and it is ahead of any workspace existing to prompt from.
       */
      initBlocklyDialogs();

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

      /**
       * VFN-012 — the App Config category, and the same dynamic-category mechanism for the same
       * reason: its contents are the project's app settings, which change under an open editor.
       *
       * The provider is set here, not imported by `appConfig.ts`, because that module is in
       * `initialize.ts`'s import graph and therefore has to stay reachable from the plain-Node
       * `tests-unit` runner — `ProjectModel` is not. Read live on every flyout open, so a
       * variable declared in Settings while this editor is open shows up on the next click with
       * no invalidation to get wrong.
       */
      setConfigVariablesProvider(() => ProjectModel.instance?.getConfigVariables() || []);
      workspace.registerToolboxCategoryCallback(APP_CONFIG_CATEGORY, appConfigFlyout() as never);
      // Criterion 6: the empty category names where to go, and this is the door. Registered
      // whether or not the category is empty — "edit these" is as useful as "create some".
      workspace.registerButtonCallback(APP_CONFIG_SETTINGS_BUTTON, () => openSettingsPanel('project'));

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

      // LGC-007 §1 — right-click a block, save it and everything under it as a My Block. Same
      // store the flyout above reads, so a block saved here is in the toolbox of every Visual
      // Function in the project without anything having to be told about it.
      myBlocksSave = attachMyBlocksSave({
        workspace,
        store: myBlocksStore(),
        openDialog: openSaveBlockDialog
      });

      /**
       * VFN-011 — the bench. Built before the two surfaces that draw it, because both take it as an
       * option, and it holds no DOM of its own.
       *
       * 🔴 `model()` is `railModelForWorkspace`, the same call the rails make, derived per call and
       * cached nowhere. The bench therefore cannot disagree with the rails about which ports exist,
       * because it is not answering the question — it is reading the answer.
       */
      bench = new BenchController({
        nodeId,
        model: () => railModelForWorkspace(workspace as Blockly.WorkspaceSvg),
        generate: () => {
          const { generated, probedIds } = generateProgram();
          return { code: generated.code, probedIds };
        },
        publish: (frame, note, probedIds) => {
          if (!blockValues) return;
          // The probe ids from the generation this run actually used. Without them a bench run of
          // an unflushed edit would be marked against the previous program's denominator, and
          // blocks that are not in the program would paint hollow.
          blockValues.setProbedIds(probedIds as Set<string>);
          blockValues.pushFrame(frame, note);
        },
        onChanged: () => rails?.refresh()
      });

      // LGC-004 — the signature at the two edges. Attached after the load, like Do It, so its
      // first paint reads the finished program rather than one block of it.
      if (inputsRailDiv.current && outputsRailDiv.current) {
        rails = attachInterfaceRails({
          workspace,
          inputsHost: inputsRailDiv.current,
          outputsHost: outputsRailDiv.current,
          bench
        });
      }
      // LGC-003 — the whole program answers at once, during a real run. VFN-011 adds Run to the
      // same strip, so the two ways a program can produce values share one scrubber.
      if (rootRef.current) {
        blockValues = attachBlockValues(workspace, rootRef.current, {
          nodeId,
          generatedCode,
          onRun: {
            label: '▶ Run',
            title:
              'Run these blocks here in the editor, with the app stopped, using the sandbox values in the ' +
              'Inputs rail. Nothing it does reaches your app.',
            run: () => {
              const trigger = bench?.defaultTrigger();
              if (trigger) bench?.run(trigger);
            }
          }
        });
      }

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
      /**
       * VFN-011 — and so is the outputs rail.
       *
       * ⚠️ **The last run's values go, the sandbox inputs stay.** They are different kinds of
       * thing: an output value describes a program that has just changed and is now a lie with no
       * timestamp on it, while a sandbox input is something the *builder* typed and did not
       * change. Clearing both would empty the bench on every keystroke in a block, which is the
       * behaviour that makes a tool not worth reaching for.
       */
      if (bench) bench.invalidate();

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

      // VFN-011 — the sandbox values go with the tab, and this is the line that says so. They are
      // held in a `Map` on this object and written to nothing, so dropping the reference is the
      // whole of their lifecycle (criterion 8).
      bench = null;

      // Before the workspace goes: the save session is an entry in a renderer-wide map, keyed by
      // this workspace's id.
      if (myBlocksSave) {
        myBlocksSave.dispose();
        myBlocksSave = null;
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
