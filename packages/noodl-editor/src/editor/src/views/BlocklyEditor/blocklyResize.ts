/**
 * LGC-008 — the one seam through which a *container* size change reaches Blockly.
 *
 * ## Why this exists at all
 *
 * Blockly does not observe its container. Read in `blockly_compressed.js`, `inject` binds a
 * single listener — `window` `"resize"` — and that handler is the only caller of
 * `svgResize` the library ships:
 *
 * ```js
 * conditionalBind(window, "resize", null, function () {
 *   hideTooltip(); a.hideComponents(true);
 *   repositionForWindowResize(dropdowndiv); repositionForWindowResize(widgetdiv);
 *   svgResize(a); bumpTopObjectsIntoBounds(a);
 * });
 * ```
 *
 * So a workspace whose *container* changes size while the window does not — which is every
 * splitter drag and every pane layout change in this editor — keeps the SVG width and height
 * it was injected with. `svgResize` itself is the fix, and it is entirely mechanical:
 *
 * ```js
 * svgResize(ws) {
 *   while (ws.options.parentWorkspace) ws = ws.options.parentWorkspace;
 *   const svg = ws.getParentSvg(), cached = ws.getCachedParentSvgSize();
 *   const parent = svg.parentElement;
 *   if (parent instanceof HTMLElement) {
 *     const w = parent.offsetWidth, h = parent.offsetHeight;
 *     if (cached.width !== w)  { svg.setAttribute('width',  w + 'px'); ws.setCachedParentSvgSize(w, null); }
 *     if (cached.height !== h) { svg.setAttribute('height', h + 'px'); ws.setCachedParentSvgSize(null, h); }
 *     ws.resize();
 *   }
 * }
 * ```
 *
 * Note what it reads: `parentElement.offsetWidth/offsetHeight`. Under `display: none` those
 * are **0**, and it will happily cache 0 and set the SVG to `0px`. Callers therefore must not
 * fire it at a hidden pane — the handler registered by `BlocklyWorkspace` guards on exactly
 * that.
 *
 * ## Why a registry rather than a ref or a ResizeObserver
 *
 * ⚠️ **Not a `ResizeObserver`.** An occluded Electron renderer fires zero of them and clamps
 * timers by roughly 1000× (both in the registers). A `ResizeObserver`-based resize appears to
 * work whenever the window is focused and fails exactly where a splitter drag is used —
 * including in every headless drive that would otherwise have caught it. For the same reason
 * callers must invoke this **synchronously** from the drag handler: a `requestAnimationFrame`
 * or `setTimeout` hop reintroduces the clamp this is written to avoid.
 *
 * ⚠️ **No `blockly` import here, deliberately.** Blockly is ~1.1 MB and `CanvasTabs` loads it
 * as a lazy chunk on first tab open (see `CanvasTabs.tsx`). The layout code that needs to
 * *trigger* a resize — `EditorDocument`, a future pane splitter — is in the eager bundle, so
 * if it imported Blockly to reach `svgResize` it would pull the whole library into the main
 * renderer bundle for every session, including the overwhelming majority that never open a
 * Logic Builder. This module stores plain closures; only `BlocklyWorkspace`, which is already
 * inside the lazy chunk, ever puts a Blockly call into one.
 *
 * The set is keyed by nothing: every live workspace registers, and a resize resizes all of
 * them. That is correct for a pane design where more than one workspace may be mounted at
 * once (one visible, others hidden behind a tab), because the hidden ones self-guard.
 */

/** A closure that re-measures one live Blockly workspace against its container. */
export type BlocklyResizeHandler = () => void;

const handlers = new Set<BlocklyResizeHandler>();

/**
 * Register a live workspace's resize closure.
 *
 * @returns the unregister function. Call it from the same teardown that disposes the
 *          workspace — a handler left behind would call into a disposed workspace.
 */
export function registerBlocklyResizeHandler(handler: BlocklyResizeHandler): () => void {
  handlers.add(handler);
  return () => {
    handlers.delete(handler);
  };
}

/**
 * Re-measure every live Blockly workspace against its container. Safe to call when none are
 * open — that is the common case and it costs an empty iteration.
 *
 * Call this **synchronously** from whatever changed the geometry: a splitter's `onDrag`, a
 * pane swap, a tab reveal. Do not defer it.
 */
export function resizeBlocklyWorkspaces(): void {
  // A copy, because a handler that throws and unregisters itself would otherwise mutate the
  // set mid-iteration.
  for (const handler of Array.from(handlers)) {
    try {
      handler();
    } catch (error) {
      console.error('[Blockly] A workspace could not be resized', error);
    }
  }
}

/** Test seam: how many live workspaces are currently registered. */
export function blocklyResizeHandlerCount(): number {
  return handlers.size;
}
