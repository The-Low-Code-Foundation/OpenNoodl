/**
 * AIX-004 — Explain Mode: citation → canvas
 *
 * The one thing an explanation of a *visual* artifact can do that an
 * explanation of code cannot is point. Hovering a cited node lights it up on
 * canvas; clicking it navigates there and selects it.
 *
 * Read-only, like everything else in this feature: navigating and highlighting
 * change the view, never the project.
 *
 * @module noodl-editor/views/panels/ExplainPanel/canvasLink
 */

import { NodeGraphContextTmp } from '@noodl-contexts/NodeGraphContext/NodeGraphContext';

import { ProjectModel } from '@noodl-models/projectmodel';

import { HighlightManager } from '../../../services/HighlightManager';
import type { IHighlightHandle } from '../../../services/HighlightManager/types';

/** Channel used for explanation hover highlights — cleared as soon as the pointer leaves. */
const CHANNEL = 'selection';

let hoverHandle: IHighlightHandle | undefined;

/** Light up a cited node on canvas while the pointer is over its citation. */
export function highlightCitedNode(nodeId: string): void {
  clearCitedHighlight();
  try {
    hoverHandle = HighlightManager.instance.highlightNodes([nodeId], {
      channel: CHANNEL,
      label: 'Explanation',
      persistent: false
    });
  } catch (error) {
    console.warn('[explain] could not highlight node', nodeId, error);
  }
}

export function clearCitedHighlight(): void {
  hoverHandle?.dismiss();
  hoverHandle = undefined;
}

/**
 * Navigate to a cited node and select it. `componentName` is the component the
 * explanation was assembled from — citations never point outside it, so there is
 * no search to do.
 */
export function revealCitedNode(componentName: string, nodeId: string): void {
  const project = ProjectModel.instance;
  const nodeGraph = NodeGraphContextTmp.nodeGraph;
  if (!project || !nodeGraph) return;

  const component = project.getComponentWithName(componentName);
  if (!component) return;

  // `switchToComponent` only reads `.id` off the node argument, the same
  // stand-in the Problems panel passes.
  nodeGraph.switchToComponent(component, {
    node: { id: nodeId } as never,
    pushHistory: true
  });
}
