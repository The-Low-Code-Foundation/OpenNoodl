/**
 * useDraggable Hook
 *
 * Provides drag-and-drop functionality for SVG elements with snap-to-grid.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { snapPositionToGrid } from '../utils/snapToGrid';

export interface DraggableState {
  isDragging: boolean;
  currentX: number;
  currentY: number;
}

export interface UseDraggableOptions {
  initialX: number;
  initialY: number;
  onDragEnd?: (x: number, y: number) => void;
  enabled?: boolean;
}

export interface UseDraggableResult {
  isDragging: boolean;
  x: number;
  y: number;
  handleMouseDown: (e: React.MouseEvent) => void;
}

/**
 * Hook for making SVG elements draggable with snap-to-grid.
 *
 * @param options - Configuration options
 * @returns Drag state and handlers
 */
export function useDraggable({
  initialX,
  initialY,
  onDragEnd,
  enabled = true
}: UseDraggableOptions): UseDraggableResult {
  const [isDragging, setIsDragging] = useState(false);
  const [currentX, setCurrentX] = useState(initialX);
  const [currentY, setCurrentY] = useState(initialY);

  const dragStartRef = useRef<{ x: number; y: number; mouseX: number; mouseY: number } | null>(null);

  // Update position when initial position changes (from layout)
  useEffect(() => {
    if (!isDragging) {
      setCurrentX(initialX);
      setCurrentY(initialY);
    }
  }, [initialX, initialY, isDragging]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!enabled) return;

      e.stopPropagation();
      e.preventDefault();

      setIsDragging(true);
      dragStartRef.current = {
        x: currentX,
        y: currentY,
        mouseX: e.clientX,
        mouseY: e.clientY
      };
    },
    [enabled, currentX, currentY]
  );

  useEffect(() => {
    if (!isDragging || !dragStartRef.current) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;

      const dx = e.clientX - dragStartRef.current.mouseX;
      const dy = e.clientY - dragStartRef.current.mouseY;

      setCurrentX(dragStartRef.current.x + dx);
      setCurrentY(dragStartRef.current.y + dy);
    };

    const handleMouseUp = () => {
      if (!dragStartRef.current) return;

      // Snap to grid
      const snapped = snapPositionToGrid(currentX, currentY);

      setCurrentX(snapped.x);
      setCurrentY(snapped.y);
      setIsDragging(false);

      // Notify parent
      onDragEnd?.(snapped.x, snapped.y);

      dragStartRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, currentX, currentY, onDragEnd]);

  return {
    isDragging,
    x: currentX,
    y: currentY,
    handleMouseDown
  };
}
