import React from 'react';

import { CanvasTabsProvider } from '../../contexts/CanvasTabsContext';
import { ProjectModel } from '../../models/projectmodel';
import { CanvasHud } from '../CanvasOverlays/CanvasHud';
import { ExecutionOverlay } from '../CanvasOverlays/ExecutionOverlay';
import { HighlightOverlay } from '../CanvasOverlays/HighlightOverlay';
import { RecordingOverlay } from '../CanvasOverlays/RecordingOverlay';
import { CanvasTabs } from '../CanvasTabs';
import { navigateToTabComponent } from '../CanvasTabs/tabNavigation';
import { EditorBanner } from '../EditorBanner';
import { refFromComponentName } from '../../models/workflow/functionRefResolution';
import { descentFor } from '../../models/workflow/workflowDescent';
import { NodeGraphComponentTrail } from '../NodeGraphComponentTrail';
import { CloudFunctionTrailStatus } from '../NodeGraphComponentTrail/CloudFunctionTrailStatus';
import {
  beginLogicOverlayDrag,
  endLogicOverlayDrag,
  setLogicOverlayOpen,
  updateLogicOverlayDrag
} from './LogicOverlay';
import { CenterToFitMode } from './canvas/types';

import type { NodeGraphEditor } from '../nodegrapheditor';

/**
 * The long-lived React overlays over the canvas and their glue (PLAT-001
 * wave 2 extraction — bodies moved verbatim from nodegrapheditor.ts): canvas
 * tabs, editor banner, highlight overlay, execution overlay and the component
 * trail title, plus canvas show/hide when the Logic Builder takes over.
 *
 * All roots go through the editor's OverlayHost named slots. Viewport-tracking
 * overlays (highlight, execution) follow the documented contract — they get
 * `{ viewport: {x, y, zoom}, getNodeBounds }` and are re-rendered by the
 * editor whenever pan/zoom changes.
 */
export class OverlayViews {
  constructor(private editor: NodeGraphEditor) {}

  /**
   * Render the CanvasTabs React component
   */
  renderCanvasTabs() {
    this.editor.overlays.renderSlot(
      'canvas-tabs',
      this.editor.shell.canvasTabsRoot,
      React.createElement(
        CanvasTabsProvider,
        null,
        React.createElement(CanvasTabs, {
          onWorkspaceChange: this.handleBlocklyWorkspaceChange.bind(this),
          /**
           * VFN-004 — clicking a tab takes the canvas to where its blocks live.
           *
           * Supplied here rather than reached for inside the window, for the same reason
           * `onWorkspaceChange` is: the window renders a box of blocks and cannot see a node
           * graph. `navigateToTabComponent` goes through `switchToComponent` — the door the
           * components panel uses — and not through `Router.route()`, which is a silent no-op
           * editor→editor and would look exactly like the dead click this replaces.
           */
          onTabActivate: (tab) => navigateToTabComponent(tab),
          // LGC-010: the window reports pointer positions and the box it measured at
          // `mousedown`; the editor owns the arithmetic, because the viewport it is clamped
          // into is the whole document rather than anything the component can see.
          overlayDrag: {
            onDragStart: ({ handle, origin, pointerX, pointerY }) =>
              beginLogicOverlayDrag(handle, origin, pointerX, pointerY),
            onDrag: (pointerX: number, pointerY: number) => updateLogicOverlayDrag(this.editor, pointerX, pointerY),
            onDragEnd: () => endLogicOverlayDrag(this.editor)
          }
        })
      )
    );
  }

  /**
   * Handle workspace changes from Blockly editor.
   *
   * 🔴 `code` is `undefined` when generation **declined** (LGC-007 §3) — a cycle in the
   * saved-block definition graph, a missing definition, a shape mismatch, a budget overrun.
   * The blocks are still the user's edit and are still saved; the `generatedCode` parameter
   * is **left exactly as it is**, so the node keeps running its last-known-good program.
   *
   * This is the point at which a refusal used to publish its silence: the empty string was
   * written here and reached `project.json`, and reopening could not recover it because the
   * cycle was still there and re-emptied it. The rule the class needs, stated once, here:
   * **ask what a refusal path writes, not whether it warns.**
   */
  handleBlocklyWorkspaceChange(nodeId: string, workspace: string, code: string | undefined) {
    console.log(`[NodeGraphEditor] Workspace changed for node ${nodeId}`);

    const node = this.editor.findNodeWithId(nodeId);
    if (!node) {
      console.warn(`[NodeGraphEditor] Node ${nodeId} not found`);
      return;
    }

    // Save workspace JSON to node model. Unconditional: refusing to generate is not a reason
    // to lose the blocks the user just edited.
    node.model.setParameter('workspace', workspace);

    if (code === undefined) {
      console.warn(
        `[NodeGraphEditor] Blocks saved for node ${nodeId}, but generation declined — ` +
          `keeping the previous generated code rather than emptying it.`
      );
      return;
    }

    // Save generated JavaScript code to node model
    // This triggers the runtime's parameterUpdated listener which calls updatePorts()
    node.model.setParameter('generatedCode', code);

    console.log(`[NodeGraphEditor] Saved workspace and generated code for node ${nodeId}`);
  }

  /**
   * Render the EditorBanner React component (for read-only mode).
   *
   * Gated on the *project* being read-only, not just this canvas: diff and
   * review documents also run their canvases with readOnly=true, and those
   * must not get the "opened read-only" banner.
   */
  renderEditorBanner() {
    const projectIsReadOnly = Boolean(ProjectModel.instance?._isReadOnly);
    this.editor.overlays.renderSlot(
      'editor-banner',
      this.editor.shell.editorBannerRoot,
      this.editor.readOnly && projectIsReadOnly
        ? React.createElement(EditorBanner, {
            onDismiss: this.handleDismissBanner.bind(this)
          })
        : null
    );
  }

  /**
   * Handle banner dismiss
   */
  handleDismissBanner() {
    console.log('[NodeGraphEditor] Banner dismissed');
    // Banner handles its own visibility via state
  }

  /**
   * Get node bounds for the highlight overlay
   * Maps node IDs to their screen coordinates
   */
  getNodeBounds = (nodeId: string) => {
    const node = this.editor.findNodeWithId(nodeId);
    if (!node) return null;

    return {
      x: node.global.x,
      y: node.global.y,
      width: node.nodeSize.width,
      height: node.nodeSize.height
    };
  };

  /**
   * Render the HighlightOverlay React component
   */
  renderHighlightOverlay() {
    // Get current viewport state
    const panAndScale = this.editor.getPanAndScale();
    const viewport = {
      x: panAndScale.x,
      y: panAndScale.y,
      zoom: panAndScale.scale
    };

    // Render the overlay
    this.editor.overlays.renderSlot(
      'highlight-overlay',
      this.editor.shell.highlightOverlayLayer,
      React.createElement(HighlightOverlay, {
        viewport,
        getNodeBounds: this.getNodeBounds
      })
    );
  }

  /**
   * Update the highlight overlay with new viewport state
   * Called whenever pan/zoom changes
   */
  updateHighlightOverlay() {
    if (this.editor.overlays.hasSlot('highlight-overlay')) {
      this.renderHighlightOverlay();
    }
  }

  /**
   * Render the ExecutionOverlay React component (CF11-007)
   *
   * Mounts into #execution-overlay-layer. The React component manages its own
   * pinned-execution state via EventDispatcher ('execution:pinToCanvas').
   * We re-render on every pan/zoom so the viewport prop stays current.
   */
  renderExecutionOverlay() {
    const panAndScale = this.editor.getPanAndScale();
    const viewport = {
      x: panAndScale.x,
      y: panAndScale.y,
      zoom: panAndScale.scale
    };

    this.editor.overlays.renderSlot(
      'execution-overlay',
      this.editor.shell.executionOverlayLayer,
      React.createElement(ExecutionOverlay, {
        viewport,
        getNodeBounds: this.getNodeBounds
      })
    );
  }

  /**
   * Update the execution overlay with new viewport state.
   * Called whenever pan/zoom changes (same cadence as updateHighlightOverlay).
   */
  updateExecutionOverlay() {
    if (this.editor.overlays.hasSlot('execution-overlay')) {
      this.renderExecutionOverlay();
    }
  }

  /**
   * Render the RecordingOverlay React component (HUD-001).
   *
   * ⚠️ **Its own slot and its own layer, not a second tenant of `execution-overlay`.**
   * `OverlayHost.renderSlot` keeps one React root per named slot and unmounts it when the slot
   * is re-rendered with a different element, so mounting this into the execution overlay's slot
   * would not add a HUD — it would silently delete a pinned workflow run. TALK-003 proposed
   * sharing the slot; HUD-001 corrected it.
   *
   * Same cadence as its execution-overlay twin: re-rendered on every pan and zoom so the
   * viewport prop the badge container transforms by stays current.
   */
  renderRecordingOverlay() {
    const panAndScale = this.editor.getPanAndScale();
    const viewport = {
      x: panAndScale.x,
      y: panAndScale.y,
      zoom: panAndScale.scale
    };

    this.editor.overlays.renderSlot(
      'recording-overlay',
      this.editor.shell.recordingOverlayLayer,
      React.createElement(RecordingOverlay, {
        viewport,
        getNodeBounds: this.getNodeBounds,
        // Read-only canvases are diff and review documents over historical graphs. Arming the
        // live preview from one of those is not a gesture that means anything.
        enabled: !this.editor.readOnly
      })
    );
  }

  /**
   * Update the recording overlay with new viewport state.
   * Called whenever pan/zoom changes (same cadence as updateExecutionOverlay).
   */
  updateRecordingOverlay() {
    if (this.editor.overlays.hasSlot('recording-overlay')) {
      this.renderRecordingOverlay();
    }
  }

  /**
   * Render the canvas HUD overlays (PAR-003): the AI pill (bottom-left) and
   * the zoom cluster (bottom-right) from the editor mock. Zoom actions drive
   * the same ViewportActions path as mouse-wheel zoom; fit is the existing
   * center-to-fit. Re-rendered on every pan/zoom (via updateCanvasHud) so the
   * percentage stays live.
   */
  renderCanvasHud() {
    const editor = this.editor;
    const scale = editor.getPanAndScale().scale;

    const zoomAtCenter = (deltaZ: number) => {
      // Guard: viewport metrics are NaN until the canvas is bound.
      if (!editor.canvas.width || !editor.canvas.height) return;
      editor.viewportActions.updateZoomLevel(editor.viewport.cssWidth / 2, editor.viewport.cssHeight / 2, deltaZ);
    };

    editor.overlays.renderSlot(
      'canvas-hud',
      editor.shell.canvasHudRoot,
      React.createElement(CanvasHud, {
        zoomPercent: Math.round(scale * 100),
        showAiPill: !editor.readOnly,
        onZoomIn: () => zoomAtCenter(4),
        onZoomOut: () => zoomAtCenter(-4),
        onZoomToFit: () => {
          editor.centerToFit(CenterToFitMode.AllNodes);
          editor.relayout();
          editor.repaint();
        }
      })
    );
  }

  /**
   * Update the canvas HUD with the current zoom level.
   * Called whenever pan/zoom changes (same cadence as the other overlays).
   */
  updateCanvasHud() {
    if (this.editor.overlays.hasSlot('canvas-hud')) {
      this.renderCanvasHud();
    }
  }

  /**
   * Open or close the Logic Builder's floating window (LGC-010).
   *
   * It was `setCanvasVisibility` (hid eight layers), then `setLogicPaneOpen` (split the shell).
   * It now moves nothing but the window itself: the canvas keeps its full size and every layer
   * stays exactly where it was. The body is in `LogicOverlay.ts` — no React in it, so it can be
   * gated in a plain-Node runner.
   */
  setLogicOverlayOpen(open: boolean) {
    setLogicOverlayOpen(this.editor, open);
  }

  updateTitle() {
    const editor = this.editor;
    const rootElem = editor.shell.componentTrailRoot;

    // WFA-004: a workflow's trail is not a project path. Its adapter is named
    // `/#__workflow__/<id>`, which would otherwise read as a folder called
    // `#__workflow__` containing a component with a machine id. What a reader
    // needs instead is which BACKEND this workflow lives on — the question a
    // project component never has and this document type always does.
    const workflow = editor.activeComponent as unknown as {
      backendName?: string;
      workflowId?: string;
      displayName?: string;
    };
    if (editor.activeComponent && workflow.backendName && workflow.workflowId) {
      editor.componentName = workflow.displayName;
      editor.componentFolder = workflow.backendName + ' /';
      editor.overlays.renderSlot(
        'title',
        rootElem,
        React.createElement(NodeGraphComponentTrail, {
          componentTrail: [
            { name: workflow.backendName, fullName: '', isCurrent: false, isFolderComponent: false },
            {
              name: workflow.displayName,
              fullName: editor.activeComponent.fullName,
              stateText: editor.stateText,
              isCurrent: true,
              isFolderComponent: false
            }
          ],
          onSwitchToComponent: editor.switchToComponent.bind(editor),
          onHistoryForward: editor.navigationHistory.goForward.bind(editor.navigationHistory),
          onHistoryBack: editor.navigationHistory.goBack.bind(editor.navigationHistory),
          canNavigateBack: editor.navigationHistory.canNavigateBack,
          canNavigateForward: editor.navigationHistory.canNavigateForward,
          runtimeType: editor.runtimeType,
          readOnly: Boolean(editor.readOnly)
        } as TSFixme)
      );
      return;
    }

    if (editor.activeComponent) {
      const fullName = editor.activeComponent.fullName;
      const nameParts = fullName.split('/');
      const firstItem = nameParts.shift();
      const componentTrail = [];

      /**
       * WFA-006 §1: the way back out of a descent.
       *
       * A cloud function's trail is an ordinary project path — `#__cloud__` is
       * already suppressed by the trail itself, so it reads `saveOrder`. What it
       * cannot know is that you arrived from a workflow step, so the crumb is
       * prepended here, from the descent pointer, and reads
       * `Order Pipeline › saveOrder`.
       *
       * It is a normal trail item carrying a real `component` — the workflow's
       * canvas adapter — so clicking it goes through exactly the same
       * `switchToComponent` path as any other crumb. The trail component itself
       * is untouched by this, which is what keeps ordinary component navigation
       * out of the blast radius.
       */
      const descent = descentFor(fullName);
      const cloudFunctionName = refFromComponentName(fullName);
      if (descent) {
        componentTrail.push({
          name: descent.workflowName,
          fullName: descent.workflowComponent.fullName,
          component: descent.workflowComponent,
          isCurrent: false,
          isFolderComponent: false
        });
      }

      for (let i = 0; i < nameParts.length; i++) {
        let part = '';

        for (let j = 0; j <= i; j++) {
          part += '/' + nameParts[j];
        }

        componentTrail.push({
          name: nameParts[i],
          fullName: part,
          stateText: editor.stateText,
          // TODO: this returns undefined if the component is a folder,
          // but if a folder and a component has the same name the result
          // of this check will be wrong. i think this is a rare edge case though
          component: ProjectModel.instance.getComponentWithName(part),
          isCurrent: i === nameParts.length - 1,
          isFolderComponent: nameParts.length > 1 && !fullName.endsWith(part)
        });
      }

      const componentName = nameParts.pop();
      editor.componentName = componentName;

      if (nameParts.length) {
        editor.componentFolder = nameParts.join(' / ') + ' /';
      } else {
        editor.componentFolder = '';
      }

      const props = {
        componentTrail,
        onSwitchToComponent: editor.switchToComponent.bind(editor),
        onHistoryForward: editor.navigationHistory.goForward.bind(editor.navigationHistory),
        onHistoryBack: editor.navigationHistory.goBack.bind(editor.navigationHistory),
        canNavigateBack: editor.navigationHistory.canNavigateBack,
        canNavigateForward: editor.navigationHistory.canNavigateForward,
        // PAR-003: the trail is now the mock's bottom bar — it needs the
        // runtime type for the "+" new-component menu and hides authoring
        // affordances on read-only canvases.
        runtimeType: editor.runtimeType,
        readOnly: Boolean(editor.readOnly),
        // WFA-006: on a cloud function's canvas only — who calls it, and the
        // explicit deploy. `refFromComponentName` answers null for anything
        // else, so every other canvas passes `undefined` and renders nothing.
        statusSlot: cloudFunctionName
          ? React.createElement(CloudFunctionTrailStatus, {
              functionName: cloudFunctionName,
              backendId: descent?.backendId,
              backendName: descent?.backendName
            })
          : undefined
      };

      editor.overlays.renderSlot('title', rootElem, React.createElement(NodeGraphComponentTrail, props));
    } else {
      editor.overlays.renderSlot('title', rootElem, null);
    }
  }
}
