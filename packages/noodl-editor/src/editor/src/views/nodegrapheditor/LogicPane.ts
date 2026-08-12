import { resizeBlocklyWorkspaces } from '../BlocklyEditor/blocklyResize';
import { remeasureNodeGraphCanvas } from './CanvasDOMBindings';
import { LOGIC_PANE_DEFAULT_PERCENT, logicPaneSplitPercent } from './logicPaneSplit';

import type { NodeGraphEditor } from '../nodegrapheditor';

/**
 * LGC-008 — opening a Visual Function opens a **pane**, and the canvas stays on screen.
 *
 * ## What this replaced
 *
 * `setCanvasVisibility` wrote `display: none` onto the canvas, both comment layers, the
 * highlight overlay, the recording overlay, the canvas HUD, the component trail and the DOM
 * layer, on the premise that "the Logic Builder takes the whole canvas over". Richard ruled on
 * 2026-08-12 that *a pane, not a takeover* means both surfaces are on screen at once, which
 * retires the premise and every hide that hung off it. The blanket hide is therefore **gone**,
 * not conditional: there is no state in which this module hides a canvas layer.
 *
 * ⚠️ That hide was doing almost no occlusion work anyway (§5): `canvasTabsRoot` is absolute,
 * full size, `z-index: 100` and opaque, so every hidden layer except one was already covered.
 * The exception is the highlight overlay, whose clipping wrapper was the only one built without
 * a `z-index` — its 999/1000/1001 escaped into the body-level stacking context and out-painted
 * the tabs root. `CanvasShell` now gives it `z-index: 7`, which is what makes removing the hide
 * safe rather than merely possible (L27).
 *
 * ## Why the geometry is CSS and the resizes are calls
 *
 * The split itself is one custom property on the shell root, and the stylesheet insets every
 * canvas layer from it — so the layers clip to the canvas pane rather than each needing to be
 * told where the splitter is. But neither surface *observes* its container: Blockly re-measures
 * only on a window resize, and the node graph canvas was only re-measured by a `ResizeObserver`
 * that an occluded Electron renderer never fires. So every geometry change here ends in two
 * explicit, **synchronous** re-measures. No `requestAnimationFrame`, no timer: an occluded
 * renderer clamps those ~1000× and this is called from a `mousemove`.
 */

/** The custom property holding the canvas pane's width. Read by `styles/nodegrapheditor.css`. */
export const LOGIC_PANE_SPLIT_VAR = '--logic-pane-canvas-width';

/** The class that puts the shell into split mode. Every split rule is scoped to it. */
export const LOGIC_PANE_SPLIT_CLASS = 'is-logic-split';

/**
 * Re-measure both surfaces against the geometry as it is right now.
 *
 * Both are no-ops when nothing moved — `remeasureNodeGraphCanvas` compares against the backing
 * store it already has, and a Blockly workspace behind an inactive tab measures 0 and declines.
 */
function remeasureBothPanes(editor: NodeGraphEditor): void {
  remeasureNodeGraphCanvas(editor);
  resizeBlocklyWorkspaces();
}

/**
 * Open or close the logic pane.
 *
 * Called when the first Logic Builder tab opens and when the last one closes. Opening does not
 * touch the split unless there isn't one yet: a builder who dragged the divider and then closed
 * the tab gets their arrangement back when they open the next one.
 */
export function setLogicPaneOpen(editor: NodeGraphEditor, open: boolean): void {
  const root = editor.shell.root;

  if (open && !root.style.getPropertyValue(LOGIC_PANE_SPLIT_VAR)) {
    root.style.setProperty(LOGIC_PANE_SPLIT_VAR, `${LOGIC_PANE_DEFAULT_PERCENT}%`);
  }

  root.classList.toggle(LOGIC_PANE_SPLIT_CLASS, open);

  // The class change *is* the geometry change, and it has already happened — reading
  // `clientWidth` inside the re-measure forces the pending layout, so this sees the new width
  // rather than the old one.
  remeasureBothPanes(editor);
}

/**
 * Move the splitter to follow a pointer at `pointerClientX`.
 *
 * Called synchronously from the splitter's `mousemove`. The write and both re-measures happen
 * on that same tick, in that order, so nothing is ever drawn against a split that has not been
 * applied yet.
 */
export function setLogicPaneSplit(editor: NodeGraphEditor, pointerClientX: number): void {
  const root = editor.shell.root;
  const bounds = root.getBoundingClientRect();

  root.style.setProperty(LOGIC_PANE_SPLIT_VAR, `${logicPaneSplitPercent(pointerClientX, bounds)}%`);

  remeasureBothPanes(editor);
}
