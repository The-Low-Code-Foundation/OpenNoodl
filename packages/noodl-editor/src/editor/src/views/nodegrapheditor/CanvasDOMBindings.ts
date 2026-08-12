import { CanvasViewport } from './canvas/CanvasViewport';
import MouseWheelModeDetector from './MouseWheelModeDetector';

import type { NodeGraphEditor } from '../nodegrapheditor';

/**
 * bindNodeGraphCanvas runs again on every resize, so each run has to drop the
 * previous set of listeners.
 */
const boundCanvases = new WeakMap<HTMLCanvasElement, AbortController>();

/**
 * The canvas's CSS size, or `undefined` when it has none to give.
 *
 * 🔴 LGC-008 F3. `clientWidth`/`clientHeight` are **0** for anything under `display: none`,
 * and they are also 0 for a canvas in a container that has not been laid out yet. Neither is a
 * measurement — they are the absence of one — but `bindNodeGraphCanvas` used to write them
 * straight into the viewport metrics, after which `getPanAndScale` answers
 * `{scale: 1, x: 0, y: 0}` (it guards on `canvas.width`), clamping is skipped, and the graph
 * comes back centred on nothing.
 *
 * Reproducible before any of the pane existed: open a Logic Builder (which hid the canvas),
 * resize the window (`ViewportActions.resize` calls `bindCanvas()` unconditionally), close the
 * tab — and the graph returns on a 0×0 canvas until something else happens to resize it.
 *
 * So: a size that cannot be measured returns `undefined`, and every caller treats that as
 * "keep what you had" rather than as "you are zero wide".
 */
export function measureNodeGraphCanvas(canvas: HTMLCanvasElement): { width: number; height: number } | undefined {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (!width || !height) return undefined;
  return { width, height };
}

/**
 * Canvas DOM setup (PLAT-001 wave 3 — body moved verbatim from
 * NodeGraphEditor.bindCanvas): sizing for device-pixel-ratio and the
 * mouse/wheel event bindings. The editor stays the receiver of every event —
 * this module only wires them, so re-binding on resize keeps working the same.
 *
 * The listeners are re-bound whether or not the canvas could be measured: a canvas that is
 * hidden right now is the same element that will be shown again, and dropping its input
 * handling because it happened to be unmeasurable at bind time is a second defect.
 */
export function bindNodeGraphCanvas(editor: NodeGraphEditor): void {
  const canvas = editor.shell.canvas;
  const ctx = (editor.canvas.ctx = canvas.getContext('2d', { alpha: true }));

  // Support retina display
  editor.canvas.ratio = CanvasViewport.devicePixelRatio(ctx);

  const measured = measureNodeGraphCanvas(canvas);

  // No measurement means no write. See `measureNodeGraphCanvas` — the previous metrics are
  // stale but usable, and a zero is neither.
  if (measured) {
    canvas.width = measured.width * editor.canvas.ratio;
    canvas.height = measured.height * editor.canvas.ratio;

    editor.canvas.width = canvas.width;
    editor.canvas.height = canvas.height;

    editor.viewport.setCanvasMetrics(canvas.width, canvas.height, editor.canvas.ratio);
  }

  // Bind mouse events
  const topLeft = function (canvas: HTMLCanvasElement) {
    const { x, y } = canvas.getBoundingClientRect();
    return [x, y];
  };

  editor.topLeftCanvasPos = topLeft(canvas);

  boundCanvases.get(canvas)?.abort();
  const abort = new AbortController();
  boundCanvases.set(canvas, abort);
  const { signal } = abort;

  const events = {
    mousedown: 'down',
    mouseup: 'up',
    mousemove: 'move',
    mouseout: 'out',
    mouseover: 'over'
  };

  for (const i in events) {
    const type = events[i];
    canvas.addEventListener(
      i,
      (evt: MouseEvent) => {
        // @ts-expect-error spaceKey is a NodeGraphEditor extension of the mouse event
        evt.spaceKey = editor.interaction.spaceKeyDown; // This is set by the KeyboardHandler
        editor.mouse(
          type,
          {
            x: evt.pageX - editor.topLeftCanvasPos[0],
            y: evt.pageY - editor.topLeftCanvasPos[1],
            pageX: evt.pageX,
            pageY: evt.pageY
          },
          evt as TSFixme
        );
      },
      { signal }
    );
  }

  canvas.addEventListener(
    'mouseover',
    () => {
      editor.topLeftCanvasPos = topLeft(canvas);
    },
    { signal }
  );

  editor.mouseWheelDetector = new MouseWheelModeDetector();

  canvas.addEventListener('wheel', (e) => editor.handleMouseWheelEvent(e), { signal });
}

/**
 * Whether the canvas's current backing store disagrees with the size it is actually drawn at.
 *
 * `editor.canvas.width`/`height` are device pixels — CSS pixels times the device pixel ratio —
 * so this is the same arithmetic `bindNodeGraphCanvas` does, read back. A canvas that cannot be
 * measured is never "stale": there is nothing to re-measure it *to*.
 */
export function nodeGraphCanvasIsStale(editor: NodeGraphEditor): boolean {
  const measured = measureNodeGraphCanvas(editor.shell.canvas);
  if (!measured) return false;

  // NaN before the first bind, which compares unequal to everything — so an unbound canvas is
  // stale, which is exactly right.
  const ratio = editor.canvas.ratio || 1;
  return editor.canvas.width !== measured.width * ratio || editor.canvas.height !== measured.height * ratio;
}

/**
 * Re-measure the canvas against its container **synchronously**, and only if it moved.
 *
 * 🔴 LGC-008 F3. Nothing in this editor observes the canvas's container. The one path that
 * did — `Frame`'s `onResize`, fed by `useTrackBounds` — is a `ResizeObserver`, and an occluded
 * Electron renderer fires zero of those (registers) while clamping timers ~1000×. So the
 * canvas gets the same treatment `blocklyResize.ts` gives the Blockly workspace: whatever moved
 * the geometry calls this, immediately, from the handler that moved it. Do not defer it behind
 * `requestAnimationFrame` or a timer — that reintroduces the clamp this exists to avoid.
 *
 * Reading `clientWidth` forces the pending layout, which is what makes it safe to call this on
 * the same tick as the style write that changed the geometry.
 *
 * The staleness check is not an optimisation detail: this is called from a splitter's
 * `mousemove`, and `editor.resize` relayouts and repaints the whole graph. A drag that did not
 * change the canvas's width must cost nothing.
 *
 * @returns whether a resize actually happened.
 */
export function remeasureNodeGraphCanvas(editor: NodeGraphEditor): boolean {
  const measured = measureNodeGraphCanvas(editor.shell.canvas);
  if (!measured) return false;
  if (!nodeGraphCanvasIsStale(editor)) return false;

  // The canvas's own size, not the frame's. `currentLayout` is read for centre-on-node, and in
  // split mode the frame is wider than the canvas — feeding it the frame would centre nodes
  // behind the other pane.
  editor.resize({ width: measured.width, height: measured.height });
  return true;
}
