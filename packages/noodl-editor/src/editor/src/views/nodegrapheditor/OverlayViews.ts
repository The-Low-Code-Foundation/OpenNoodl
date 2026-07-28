import React from 'react';

import { CanvasTabsProvider } from '../../contexts/CanvasTabsContext';
import { ProjectModel } from '../../models/projectmodel';
import { CanvasHud } from '../CanvasOverlays/CanvasHud';
import { ExecutionOverlay } from '../CanvasOverlays/ExecutionOverlay';
import { HighlightOverlay } from '../CanvasOverlays/HighlightOverlay';
import { CanvasTabs } from '../CanvasTabs';
import { EditorBanner } from '../EditorBanner';
import { NodeGraphComponentTrail } from '../NodeGraphComponentTrail';
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
          onWorkspaceChange: this.handleBlocklyWorkspaceChange.bind(this)
        })
      )
    );
  }

  /**
   * Handle workspace changes from Blockly editor
   */
  handleBlocklyWorkspaceChange(nodeId: string, workspace: string, code: string) {
    console.log(`[NodeGraphEditor] Workspace changed for node ${nodeId}`);

    const node = this.editor.findNodeWithId(nodeId);
    if (!node) {
      console.warn(`[NodeGraphEditor] Node ${nodeId} not found`);
      return;
    }

    // Save workspace JSON to node model
    node.model.setParameter('workspace', workspace);

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
   * Set canvas visibility (hide when Logic Builder is open, show when closed)
   */
  setCanvasVisibility(visible: boolean) {
    const editor = this.editor;
    const { canvas, commentLayerBg, commentLayerFg, highlightOverlayLayer, componentTrailRoot, canvasHudRoot } =
      editor.shell;

    // Show/hide the canvas and related elements.
    for (const el of [canvas, commentLayerBg, commentLayerFg, highlightOverlayLayer, canvasHudRoot]) {
      el.style.display = visible ? 'block' : 'none';
    }
    componentTrailRoot.style.display = visible ? 'flex' : 'none';
    editor.domElementContainer.style.display = visible ? '' : 'none';
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
        readOnly: Boolean(editor.readOnly)
      };

      editor.overlays.renderSlot('title', rootElem, React.createElement(NodeGraphComponentTrail, props));
    } else {
      editor.overlays.renderSlot('title', rootElem, null);
    }
  }
}
