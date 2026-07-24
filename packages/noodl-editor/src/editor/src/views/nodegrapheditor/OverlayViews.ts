import React from 'react';

import { CanvasTabsProvider } from '../../contexts/CanvasTabsContext';
import { ProjectModel } from '../../models/projectmodel';
import { ExecutionOverlay } from '../CanvasOverlays/ExecutionOverlay';
import { HighlightOverlay } from '../CanvasOverlays/HighlightOverlay';
import { CanvasTabs } from '../CanvasTabs';
import { EditorBanner } from '../EditorBanner';
import { NodeGraphComponentTrail } from '../NodeGraphComponentTrail';

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
      this.editor.el.find('#canvas-tabs-root').get(0),
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
   * Render the EditorBanner React component (for read-only mode)
   */
  renderEditorBanner() {
    // Only show banner if in read-only mode
    this.editor.overlays.renderSlot(
      'editor-banner',
      this.editor.el.find('#editor-banner-root').get(0),
      this.editor.readOnly
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
      this.editor.el.find('#highlight-overlay-layer').get(0),
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
      this.editor.el.find('#execution-overlay-layer').get(0),
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
   * Set canvas visibility (hide when Logic Builder is open, show when closed)
   */
  setCanvasVisibility(visible: boolean) {
    const editor = this.editor;
    const canvasElement = editor.el.find('#nodegraphcanvas');
    const commentLayerBg = editor.el.find('#comment-layer-bg');
    const commentLayerFg = editor.el.find('#comment-layer-fg');
    const highlightOverlay = editor.el.find('#highlight-overlay-layer');
    const componentTrail = editor.el.find('.nodegraph-component-trail-root');

    if (visible) {
      // Show canvas and related elements
      canvasElement.css('display', 'block');
      commentLayerBg.css('display', 'block');
      commentLayerFg.css('display', 'block');
      highlightOverlay.css('display', 'block');
      componentTrail.css('display', 'flex');
      editor.domElementContainer.style.display = '';
    } else {
      // Hide canvas and related elements
      canvasElement.css('display', 'none');
      commentLayerBg.css('display', 'none');
      commentLayerFg.css('display', 'none');
      highlightOverlay.css('display', 'none');
      componentTrail.css('display', 'none');
      editor.domElementContainer.style.display = 'none';
    }
  }

  updateTitle() {
    const editor = this.editor;
    const rootElem = editor.el[0].querySelector('.nodegraph-component-trail-root') as HTMLElement;

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
        canNavigateForward: editor.navigationHistory.canNavigateForward
      };

      editor.overlays.renderSlot('title', rootElem, React.createElement(NodeGraphComponentTrail, props));
    } else {
      editor.overlays.renderSlot('title', rootElem, null);
    }
  }
}
