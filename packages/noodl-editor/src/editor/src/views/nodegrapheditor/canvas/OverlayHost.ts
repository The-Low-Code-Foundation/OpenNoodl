import React from 'react';
import { createRoot, Root } from 'react-dom/client';

/**
 * One documented mechanism for mounting React overlays over the canvas
 * (PLAT-001 extraction) — replaces the five ad-hoc root fields plus the
 * ephemeral toolbar/popup roots in nodegrapheditor.ts.
 *
 * Rules (from dev-docs/reference/LEARNINGS.md):
 * - A root is created ONCE per slot and re-rendered on updates. Re-creating a
 *   root on every render loses React state and leaks listeners.
 * - Every root is unmounted on dispose.
 *
 * Named slots are for long-lived overlays whose container element is stable
 * for the life of the editor (canvas tabs, banner, highlight/execution
 * overlays, title trail). If a slot is re-rendered with a different container
 * element, the old root is unmounted and a fresh one is created — this covers
 * containers that get rebuilt.
 *
 * `mount()` is for ephemeral overlays (node toolbar, connection popups) whose
 * container div is created per showing; the returned handle re-renders or
 * unmounts that root.
 *
 * Viewport-tracking overlays follow the shared contract: they receive
 * `{ viewport: {x, y, zoom}, getNodeBounds }` and are re-rendered by the
 * editor whenever pan/zoom changes.
 */
export type OverlayHandle = {
  update(node: React.ReactNode): void;
  unmount(): void;
};

export class OverlayHost {
  private slots = new Map<string, { element: HTMLElement; root: Root }>();
  private ephemeral = new Set<Root>();

  /** Render a long-lived overlay into its slot. No-op (returns false) when the element is missing. */
  renderSlot(slot: string, element: HTMLElement | null | undefined, node: React.ReactNode): boolean {
    if (!element) {
      console.warn(`[OverlayHost] container element for slot '${slot}' not found in DOM`);
      return false;
    }

    let entry = this.slots.get(slot);
    if (entry && entry.element !== element) {
      entry.root.unmount();
      entry = undefined;
    }

    if (!entry) {
      entry = { element, root: createRoot(element) };
      this.slots.set(slot, entry);
    }

    entry.root.render(node);
    return true;
  }

  hasSlot(slot: string): boolean {
    return this.slots.has(slot);
  }

  unmountSlot(slot: string) {
    const entry = this.slots.get(slot);
    if (entry) {
      entry.root.unmount();
      this.slots.delete(slot);
    }
  }

  /** Mount an ephemeral overlay into a per-showing container element. */
  mount(element: HTMLElement, node: React.ReactNode): OverlayHandle {
    const root = createRoot(element);
    root.render(node);
    this.ephemeral.add(root);

    return {
      update: (next: React.ReactNode) => root.render(next),
      unmount: () => {
        if (this.ephemeral.delete(root)) {
          root.unmount();
        }
      }
    };
  }

  /** Unmount everything — called from the editor's dispose. */
  unmountAll() {
    for (const entry of this.slots.values()) {
      entry.root.unmount();
    }
    this.slots.clear();

    for (const root of this.ephemeral) {
      root.unmount();
    }
    this.ephemeral.clear();
  }
}
