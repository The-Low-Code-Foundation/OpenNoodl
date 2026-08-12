import { remeasureNodeGraphCanvas } from './CanvasDOMBindings';

import type { NodeGraphEditor } from '../nodegrapheditor';

/**
 * Canvas show/hide when the Logic Builder takes the canvas over (body moved verbatim from
 * `OverlayViews.setCanvasVisibility`, then given the re-measure it was missing).
 *
 * It lives out here for the same reason `CanvasDOMBindings` does: it is DOM and arithmetic with
 * no React in it, so it can be gated in a plain-Node runner. `OverlayViews` cannot — it imports
 * half a dozen React components — and the property that matters here is not a rendering
 * property.
 *
 * 🔴 LGC-008 F3, the half that is not in `bindNodeGraphCanvas`. Hiding the canvas is only half a
 * state change; **showing it again is the other half, and nothing did it.** `setCanvasVisibility`
 * wrote `display` and returned, so a canvas revealed into a container that had changed size
 * while it was hidden kept the metrics it had before — and since `ViewportActions.resize` calls
 * `bindCanvas()` unconditionally, a window resize *during* the takeover had already replaced
 * those metrics with zeros. The reveal is the moment the canvas can be measured again, so it is
 * the moment it must be.
 */
export function setNodeGraphCanvasVisibility(editor: NodeGraphEditor, visible: boolean): void {
  const {
    canvas,
    commentLayerBg,
    commentLayerFg,
    highlightOverlayLayer,
    recordingOverlayLayer,
    componentTrailRoot,
    canvasHudRoot
  } = editor.shell;

  // Show/hide the canvas and related elements. The recording HUD goes with them: the Logic
  // Builder takes the whole canvas over, and a Record pill floating on top of a Blockly
  // workspace is a control over a surface it has nothing to say about.
  const layers = [canvas, commentLayerBg, commentLayerFg, highlightOverlayLayer, recordingOverlayLayer, canvasHudRoot];
  for (const el of layers) {
    el.style.display = visible ? 'block' : 'none';
  }
  componentTrailRoot.style.display = visible ? 'flex' : 'none';
  editor.domElementContainer.style.display = visible ? '' : 'none';

  // The reveal, synchronously and in this order: the `display` writes above are what make the
  // canvas measurable at all, and `remeasureNodeGraphCanvas` reads `clientWidth`, which forces
  // the pending layout. Nothing here waits for a frame — an occluded renderer would not give
  // us one.
  if (visible) {
    remeasureNodeGraphCanvas(editor);
  }
}
