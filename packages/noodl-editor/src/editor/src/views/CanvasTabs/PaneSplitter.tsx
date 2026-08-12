import React from 'react';

import css from './CanvasTabs.module.scss';

export interface PaneSplitterProps {
  /** Called on every `mousemove` of a drag with the pointer's client X. */
  onDrag: (pointerClientX: number) => void;
}

/**
 * LGC-008 — the splitter between the canvas pane and the logic pane.
 *
 * ⚠️ Written against `mousemove` on `window` rather than against a drag library or a
 * `ResizeObserver`, and it reports **synchronously**: an occluded Electron renderer fires zero
 * `ResizeObserver` callbacks and clamps timers by roughly 1000×, so anything deferred works
 * whenever the window is focused and fails exactly where a splitter drag is used. The receiver
 * (`LogicPane.setLogicPaneSplit`) writes the new geometry and re-measures both surfaces on this
 * same tick.
 *
 * The listeners go on `window`, not on the handle: a fast drag outruns an 8 px target, and a
 * pointer that leaves the handle mid-drag must not silently stop resizing. `preventDefault` on
 * mousedown is what stops the drag turning into a text selection across both panes.
 *
 * No React state, deliberately. The split lives in one CSS custom property on the shell root,
 * so a drag is a style write rather than a re-render of the tab content at mousemove frequency.
 */
export function PaneSplitter({ onDrag }: PaneSplitterProps) {
  const handleMouseDown = (event: React.MouseEvent) => {
    event.preventDefault();

    const onMouseMove = (moveEvent: MouseEvent) => onDrag(moveEvent.clientX);
    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      document.body.style.removeProperty('cursor');
    };

    // While dragging, every element under the pointer would otherwise show its own cursor.
    document.body.style.setProperty('cursor', 'col-resize');
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  return (
    <div
      className={css['PaneSplitter']}
      onMouseDown={handleMouseDown}
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize the block editor"
      title="Drag to resize"
    />
  );
}
