import { CanvasViewport } from './canvas/CanvasViewport';
import MouseWheelModeDetector from './MouseWheelModeDetector';

import type { NodeGraphEditor } from '../nodegrapheditor';

/**
 * bindNodeGraphCanvas runs again on every resize, so each run has to drop the
 * previous set of listeners.
 */
const boundCanvases = new WeakMap<HTMLCanvasElement, AbortController>();

/**
 * Canvas DOM setup (PLAT-001 wave 3 — body moved verbatim from
 * NodeGraphEditor.bindCanvas): sizing for device-pixel-ratio and the
 * mouse/wheel event bindings. The editor stays the receiver of every event —
 * this module only wires them, so re-binding on resize keeps working the same.
 */
export function bindNodeGraphCanvas(editor: NodeGraphEditor): void {
  const canvas = editor.shell.canvas;
  const ctx = (editor.canvas.ctx = canvas.getContext('2d', { alpha: true }));

  // Support retina display
  editor.canvas.ratio = CanvasViewport.devicePixelRatio(ctx);

  const width = canvas.clientWidth;
  const height = canvas.clientHeight;

  canvas.width = width * editor.canvas.ratio;
  canvas.height = height * editor.canvas.ratio;

  editor.canvas.width = canvas.width;
  editor.canvas.height = canvas.height;

  editor.viewport.setCanvasMetrics(canvas.width, canvas.height, editor.canvas.ratio);

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
