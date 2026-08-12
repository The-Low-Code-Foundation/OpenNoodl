/**
 * The node graph editor's DOM shell: the canvas plus the stack of layers that
 * sit under and over it.
 *
 * This replaces `templates/nodegrapheditor.html` and the `View.bindView` call
 * that parsed it (PLAT-002 wave 5b). The template carried no `data-*` bindings,
 * so nothing is lost by building the same tree in code — and the callers that
 * used to re-query it with `el.find('#...')` now get typed handles instead.
 *
 * The ids and class names are load-bearing: `styles/nodegrapheditor.css`,
 * `CommentLayer.css` and `HelpCenter.module.scss` all select on them, and
 * `HelpCenter` portals into `.help-center-layer` by document-level query.
 */
export interface CanvasShell {
  /** The shell root; the editor's `el`. */
  root: HTMLDivElement;
  /** Read-only mode warning banner root. */
  editorBannerRoot: HTMLDivElement;
  canvasTabsRoot: HTMLDivElement;
  commentLayerBg: HTMLDivElement;
  commentLayerFg: HTMLDivElement;
  canvas: HTMLCanvasElement;
  highlightOverlayLayer: HTMLDivElement;
  /** CF11-007 canvas execution visualisation. */
  executionOverlayLayer: HTMLDivElement;
  /**
   * HUD-001: the Record control and the badges that light up as nodes fire.
   *
   * Its own layer, and not a lodger in `executionOverlayLayer`. `OverlayHost.renderSlot`
   * keeps ONE React root per named slot and unmounts it when the slot is re-rendered with a
   * different element, so a second `renderSlot('execution-overlay', …)` would not add a HUD —
   * it would delete the pinned workflow run. TALK-003 proposed sharing the slot; this is why
   * it does not.
   */
  recordingOverlayLayer: HTMLDivElement;
  /** Host for the DOM-rendered node views (`NodeGraphEditorNode`). */
  domLayer: HTMLDivElement;
  componentTrailRoot: HTMLDivElement;
  /** PAR-003: HUD overlays (AI pill, zoom cluster) over the canvas. */
  canvasHudRoot: HTMLDivElement;
}

function div(style?: Partial<CSSStyleDeclaration>, id?: string, className?: string): HTMLDivElement {
  const el = document.createElement('div');
  if (id) el.id = id;
  if (className) el.className = className;
  if (style) Object.assign(el.style, style);
  return el;
}

/**
 * The class every canvas-pane layer carries.
 *
 * LGC-008: it is what the split rules in `styles/nodegrapheditor.css` inset, so that the comment
 * layers, the highlight overlay, the recording overlay and the execution overlay all clip to the
 * **canvas pane** rather than to the shell. A comment positioned right of the splitter must not
 * draw over the blocks.
 *
 * ⚠️ The box model lives in the stylesheet rather than inline for exactly this reason: an inline
 * `width: 100%` beats any selector, so a layer that set its own width could not be narrowed by
 * the split rule. Only the per-layer differences — `pointer-events`, `z-index` — stay inline.
 */
export const CANVAS_LAYER_CLASS = 'nodegraph-canvas-layer';

/**
 * Wrap a layer in a full-size clipping div.
 *
 * The wrapper is not decoration: without it, comments positioned below the
 * bottom of the parent scroll all their siblings (a Chromium bug the original
 * template worked around the same way).
 */
function clippingWrapper(child: HTMLElement, pointerEvents: 'none' | undefined, zIndex?: string): HTMLDivElement {
  const wrapper = div(
    {
      ...(pointerEvents ? { pointerEvents } : {}),
      ...(zIndex ? { zIndex } : {})
    },
    undefined,
    CANVAS_LAYER_CLASS
  );
  wrapper.appendChild(child);
  return wrapper;
}

/**
 * FH-012: the canvas-overlay layer's ceiling.
 *
 * `ExecutionOverlay`'s header, notice and timeline are each `z-index: 200`, and
 * nothing between them and `<body>` was a stacking context — not this wrapper
 * (positioned, `z-index: auto`), not the shell root (unpositioned). So those
 * 200s were competing directly with `PopupLayer`'s `.popup-layer` (`z-index:
 * 10`, appended to `<body>` by `router.tsx`) and won: the pin bars drew over
 * the node picker, and over its dimmed backdrop.
 *
 * A positive `z-index` on the wrapper makes it a stacking context, so all three
 * 200s — and the badges and the data popup with them — resolve INSIDE it and
 * the whole layer competes as one number. 5 is chosen to stay above everything
 * in the shell that paints at `z-index: auto` and would otherwise cover the
 * bars by document order: `#nodegraph-dom-layer`, `.canvas-hud-root` (the AI
 * pill and zoom cluster), `.nodegraph-component-trail-root` (the 38px bottom
 * bar the timeline sits on), `#comment-layer-fg` and `.help-center-layer`. And
 * it is below 10, which is the whole point.
 *
 * Deliberately NOT bumping `.popup-layer` to 201: that fixes one instance and
 * leaves the class. Two other escapees remain and are not this task's —
 * `#canvas-tabs-root` (100) and `#editor-banner-root` (1001) still reach the
 * body-level stacking context, as do `HighlightOverlay`'s 999/1000/1001. The
 * execution bars were already below the highlight overlay and above the tabs
 * root; only the first of those relationships is preserved here, and the tabs
 * root is empty unless a Logic Builder tab is open, in which case it owns the
 * canvas anyway.
 */
export const EXECUTION_OVERLAY_Z = '5';

/**
 * HUD-001: the recording HUD sits one step above the execution overlay.
 *
 * Same reasoning as {@link EXECUTION_OVERLAY_Z} — a positive `z-index` makes the wrapper a
 * stacking context so everything inside it competes as one number — and the same ceiling: below
 * `.popup-layer`'s 10, so the node picker still draws over the HUD. Above 5 because a pinned
 * workflow run and a live recording can be on screen at once (HUD-001 criterion 3) and the
 * thing the user just pressed has to be the thing they can see.
 */
export const RECORDING_OVERLAY_Z = '6';

/**
 * 🔴 L27 — the highlight overlay's wrapper was the only one built without a `z-index`, and that
 * is the one hide in `setCanvasVisibility` that was load-bearing.
 *
 * `HighlightedConnection` (999), `HighlightedNode` (1000) and `BoundaryIndicator` (1001) are
 * children of a positioned wrapper with `z-index: auto`, which is **not** a stacking context —
 * so all three escaped into the body-level context and out-painted the tabs root's 100. While
 * the canvas was hidden that never showed. With both panes on screen it would draw lesson and
 * help highlights straight over the Blockly workspace.
 *
 * 7 by the same reasoning as its two neighbours: it makes the wrapper a stacking context so the
 * whole layer competes as one number, it keeps the documented order (execution 5 < recording 6 <
 * highlight 7 — a highlight is a teaching instrument and must be visible over both), and it
 * stays below `.popup-layer`'s 10 so the node picker still draws over everything.
 */
export const HIGHLIGHT_OVERLAY_Z = '7';

export function createCanvasShell(): CanvasShell {
  const root = div({ width: '100%', height: '100%' }, undefined, 'nodegrapgeditor-bg nodegrapheditor-canvas');

  const editorBannerRoot = div({ position: 'absolute', width: '100%', zIndex: '1001' }, 'editor-banner-root');

  // LGC-008: the box model of the tabs root and the canvas is in `styles/nodegrapheditor.css`,
  // not here. An inline `width: 100%` outranks every selector, so a layer that sized itself
  // could not be narrowed into a pane by the split rule.
  const canvasTabsRoot = div({ zIndex: '100', pointerEvents: 'none' }, 'canvas-tabs-root');

  const commentLayerBg = div(undefined, 'comment-layer-bg');

  const canvas = document.createElement('canvas');
  canvas.id = 'nodegraphcanvas';
  canvas.width = 1000;
  canvas.height = 600;

  const highlightOverlayLayer = div(undefined, 'highlight-overlay-layer');
  const executionOverlayLayer = div({ pointerEvents: 'all' }, 'execution-overlay-layer');
  const recordingOverlayLayer = div({ pointerEvents: 'all' }, 'recording-overlay-layer');
  const commentLayerFg = div({ pointerEvents: 'all' }, 'comment-layer-fg');

  /**
   * LGC-008: the DOM layer gets a clipping wrapper like every other layer, so node views and the
   * wire-label editor clip to the canvas pane instead of drawing over the blocks.
   *
   * `pointerEvents: 'none'` on the wrapper with `auto` back on `#nodegraph-dom-layer` (in the
   * stylesheet) is not belt and braces: the wrapper is now a full-size box sitting above the
   * canvas in document order, so without it the canvas would stop receiving mouse events
   * entirely. The layer itself is a 0×0 origin carrying the pan/zoom transform — it intercepts
   * nothing; its absolutely-positioned children do, which is exactly what was wanted.
   */
  const domLayer = div(undefined, 'nodegraph-dom-layer');
  const domLayerWrapper = clippingWrapper(domLayer, 'none');

  const componentTrailRoot = div(undefined, undefined, 'nodegraph-component-trail-root');
  const canvasHudRoot = div(undefined, undefined, 'canvas-hud-root');
  const helpCenterLayer = div(undefined, undefined, 'help-center-layer');

  root.append(
    editorBannerRoot,
    canvasTabsRoot,
    clippingWrapper(commentLayerBg, undefined),
    canvas,
    clippingWrapper(highlightOverlayLayer, 'none', HIGHLIGHT_OVERLAY_Z),
    clippingWrapper(executionOverlayLayer, 'none', EXECUTION_OVERLAY_Z),
    clippingWrapper(recordingOverlayLayer, 'none', RECORDING_OVERLAY_Z),
    clippingWrapper(commentLayerFg, 'none'),
    domLayerWrapper,
    canvasHudRoot,
    componentTrailRoot,
    helpCenterLayer
  );

  return {
    root,
    editorBannerRoot,
    canvasTabsRoot,
    commentLayerBg,
    commentLayerFg,
    canvas,
    highlightOverlayLayer,
    executionOverlayLayer,
    recordingOverlayLayer,
    domLayer,
    componentTrailRoot,
    canvasHudRoot
  };
}
