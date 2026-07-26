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
 * `CommentLayer.css`, `HelpCenter.module.scss` and `Clippy.module.scss` all
 * select on them, and `HelpCenter`/`Clippy` portal into `.help-center-layer` /
 * `.clippy-layer` by document-level query.
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
 * Wrap a layer in a full-size clipping div.
 *
 * The wrapper is not decoration: without it, comments positioned below the
 * bottom of the parent scroll all their siblings (a Chromium bug the original
 * template worked around the same way).
 */
function clippingWrapper(child: HTMLElement, pointerEvents: 'none' | undefined): HTMLDivElement {
  const wrapper = div({
    position: 'absolute',
    overflow: 'hidden',
    width: '100%',
    height: '100%',
    ...(pointerEvents ? { pointerEvents } : {})
  });
  wrapper.appendChild(child);
  return wrapper;
}

export function createCanvasShell(): CanvasShell {
  const root = div({ width: '100%', height: '100%' }, undefined, 'nodegrapgeditor-bg nodegrapheditor-canvas');

  const editorBannerRoot = div({ position: 'absolute', width: '100%', zIndex: '1001' }, 'editor-banner-root');

  const canvasTabsRoot = div(
    { position: 'absolute', width: '100%', height: '100%', zIndex: '100', pointerEvents: 'none' },
    'canvas-tabs-root'
  );

  const commentLayerBg = div(undefined, 'comment-layer-bg');

  const canvas = document.createElement('canvas');
  canvas.id = 'nodegraphcanvas';
  canvas.width = 1000;
  canvas.height = 600;
  Object.assign(canvas.style, { position: 'absolute', width: '100%', height: '100%' });

  const highlightOverlayLayer = div(undefined, 'highlight-overlay-layer');
  const executionOverlayLayer = div({ pointerEvents: 'all' }, 'execution-overlay-layer');
  const commentLayerFg = div({ pointerEvents: 'all' }, 'comment-layer-fg');

  const domLayer = div(undefined, 'nodegraph-dom-layer');
  const domLayerWrapper = div({ position: 'relative' });
  domLayerWrapper.appendChild(domLayer);

  const componentTrailRoot = div(undefined, undefined, 'nodegraph-component-trail-root');
  const canvasHudRoot = div(undefined, undefined, 'canvas-hud-root');
  const helpCenterLayer = div(undefined, undefined, 'help-center-layer');
  const clippyLayer = div(undefined, undefined, 'clippy-layer');

  root.append(
    editorBannerRoot,
    canvasTabsRoot,
    clippingWrapper(commentLayerBg, undefined),
    canvas,
    clippingWrapper(highlightOverlayLayer, 'none'),
    clippingWrapper(executionOverlayLayer, 'none'),
    clippingWrapper(commentLayerFg, 'none'),
    domLayerWrapper,
    canvasHudRoot,
    componentTrailRoot,
    helpCenterLayer,
    clippingWrapper(clippyLayer, 'none')
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
    domLayer,
    componentTrailRoot,
    canvasHudRoot
  };
}
