import React from 'react';

import {
  OVERLAY_HANDLE_CURSOR,
  OVERLAY_RESIZE_HANDLES,
  type OverlayHandle,
  type OverlayRect
} from '../nodegrapheditor/logicOverlayGeometry';
import css from './CanvasTabs.module.scss';

/** What a component reports when a drag of the floating window begins. */
export interface OverlayDragStart {
  handle: OverlayHandle;
  /** The window's box at `mousedown`, measured from the element itself. */
  origin: OverlayRect;
  pointerX: number;
  pointerY: number;
}

export interface OverlayDragCallbacks {
  onDragStart: (start: OverlayDragStart) => void;
  onDrag: (pointerX: number, pointerY: number) => void;
  onDragEnd: () => void;
}

/**
 * LGC-010 — the mouse contract for moving and resizing the floating block editor.
 *
 * ⚠️ Written against `mousemove` on `window` rather than a drag library, and it reports
 * **synchronously**. An occluded Electron renderer fires zero `ResizeObserver` callbacks and
 * clamps timers ~1000×, so anything deferred works whenever the window happens to be focused and
 * fails exactly where a block editor is used. `LogicOverlay` writes the new geometry and
 * re-measures Blockly on this same tick.
 *
 * The listeners go on `window`, not on the handle: a fast drag outruns a 6 px target, and a
 * pointer that leaves the handle mid-drag must not silently stop dragging. `preventDefault` on
 * mousedown is what stops the drag turning into a text selection across the whole editor.
 *
 * No React state, deliberately. The geometry lives in four CSS custom properties on the shell
 * root, so a drag is a style write rather than a re-render of every mounted Blockly workspace at
 * pointer frequency.
 */
export function beginOverlayDrag(
  event: React.MouseEvent,
  handle: OverlayHandle,
  windowElement: HTMLElement | null,
  callbacks: OverlayDragCallbacks
): void {
  if (!windowElement) return;

  event.preventDefault();
  event.stopPropagation();

  const box = windowElement.getBoundingClientRect();

  callbacks.onDragStart({
    handle,
    origin: { left: box.left, top: box.top, width: box.width, height: box.height },
    pointerX: event.clientX,
    pointerY: event.clientY
  });

  const cursor = handle === 'move' ? 'grabbing' : OVERLAY_HANDLE_CURSOR[handle];

  const onMouseMove = (moveEvent: MouseEvent) => callbacks.onDrag(moveEvent.clientX, moveEvent.clientY);
  const onMouseUp = () => {
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    document.body.style.removeProperty('cursor');
    callbacks.onDragEnd();
  };

  // While dragging, every element under the pointer would otherwise show its own cursor — and
  // the pointer spends most of a resize outside the window it is resizing.
  document.body.style.setProperty('cursor', cursor);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
}

export interface OverlayResizeHandlesProps {
  windowRef: React.RefObject<HTMLElement>;
  callbacks: OverlayDragCallbacks;
}

/**
 * The eight resize targets around the window's edge.
 *
 * All eight, not just a corner grip: a window that can only grow from its bottom-right corner
 * cannot be widened leftwards without being moved first, which is two gestures for one
 * intention. They are 6 px strips overhanging the border by half, so the grab target is centred
 * on the visible edge rather than sitting inside the blocks.
 */
export function OverlayResizeHandles({ windowRef, callbacks }: OverlayResizeHandlesProps) {
  return (
    <>
      {OVERLAY_RESIZE_HANDLES.map((handle) => (
        <div
          key={handle}
          className={`${css['ResizeHandle']} ${css[`is-${handle}`]}`}
          onMouseDown={(event) => beginOverlayDrag(event, handle, windowRef.current, callbacks)}
          role="separator"
          aria-label={`Resize the block editor (${handle})`}
        />
      ))}
    </>
  );
}
