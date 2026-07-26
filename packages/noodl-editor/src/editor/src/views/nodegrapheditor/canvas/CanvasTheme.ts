/**
 * CanvasTheme — the single source of every colour painted on the node-graph
 * canvas (UIX-005).
 *
 * Resolution order per colour:
 *   1. the UIX-001 CSS custom property (documented token name), read via one
 *      `getComputedStyle(document.documentElement)` pass at initialisation and
 *      again on every theme change;
 *   2. a typed fallback literal for headless / no-CSS contexts (the SUB-009
 *      headless editor export, the Electron test-runner pages and jsdom run
 *      without the editor stylesheet — without these fallbacks the canvas
 *      would paint garbage there).
 *
 * Theme-change contract (UIX-008 depends on this even though only the dark
 * theme exists when this ships). Any of the following re-resolves all colours,
 * invalidates the cached grid pattern and notifies listeners:
 *   - `CanvasTheme.instance.refresh()` (direct call);
 *   - `window.dispatchEvent(new CustomEvent('nodegx:themechanged'))`;
 *   - toggling a class on `<html>` (e.g. `theme-light`) — observed with a
 *     MutationObserver on the root element's `class` attribute.
 *
 * Listeners follow the PLAT-001 listener-context rule: register with
 * `on(listener, context)`, detach with `off(context)`. `NodeGraphEditor`
 * subscribes in its constructor (repaint on change) and detaches in
 * `dispose()`.
 */

export const THEME_CHANGED_EVENT = 'nodegx:themechanged';

type Listener = { fn: () => void; context: unknown };

/** One colour: optional CSS token name + mandatory headless fallback. */
type ColorSpec = { css?: string; fallback: string };

/**
 * The colour table. `css` is the UIX-001 token the value resolves from in a
 * styled document; `fallback` is the literal used when the token is absent
 * (headless/test contexts).
 */
const COLOR_SPECS = {
  /* Node card annotation colours (diff/review — SUB-007 / AIX-003) */
  annotationCreated: { fallback: '#5BF59E' },
  annotationChanged: { fallback: '#83B8BA' },
  annotationDeleted: { fallback: '#F57569' },
  /** Ink for the +/-/~ glyph inside the corner badge. */
  annotationBadgeGlyph: { fallback: '#1c1c1c' },

  /** Selection / drag-affordance ring. */
  selection: { fallback: '#ffffff' },

  /** Errors and destructive affordances (unhealthy borders, delete marker). */
  danger: { fallback: '#F57569' },
  /** Connection delete marker fill. */
  deleteMarker: { fallback: '#dc322f' },
  /** The X glyph on the delete marker. */
  deleteMarkerGlyph: { fallback: '#ffffff' },

  /** Connection-drag indicator line + endpoints. */
  dragLine: { fallback: '#ffa300' },
  /** Rect-select dashed box. */
  multiselect: { fallback: '#aaaaaa' },
  /** Multi-selection AABB outline (was the one pre-existing token bridge). */
  multiselectBox: { css: '--theme-color-fg-default', fallback: '#a6b0bb' },

  /** Parent→child hierarchy spine. */
  hierarchyLine: { fallback: '#504f4f' },
  /** Child insert-location indicator bar. */
  insertIndicator: { fallback: '#ffffff' },
  /** Dim layer behind a connection drag (painted at 0.6 globalAlpha). */
  scrim: { fallback: '#000000' },

  /** Debug-inspector wire pulse. */
  wirePulse: { fallback: '#ffe85d' }
} satisfies Record<string, ColorSpec>;

export type CanvasThemeColors = { [K in keyof typeof COLOR_SPECS]: string };

function hasDom(): boolean {
  return typeof document !== 'undefined' && typeof getComputedStyle === 'function' && !!document.documentElement;
}

export class CanvasTheme {
  private static _instance: CanvasTheme | undefined;

  static get instance(): CanvasTheme {
    if (!CanvasTheme._instance) CanvasTheme._instance = new CanvasTheme();
    return CanvasTheme._instance;
  }

  colors: CanvasThemeColors;

  /** Bumped on every refresh; consumers may use it as a cache key. */
  generation = 0;

  private listeners: Listener[] = [];
  private observer: MutationObserver | undefined;

  private constructor() {
    this.colors = this.resolve();

    if (hasDom()) {
      // UIX-008 contract: explicit notification...
      window.addEventListener(THEME_CHANGED_EVENT, () => this.refresh());
      // ...and automatic pickup of a theme class flip on the root element.
      if (typeof MutationObserver !== 'undefined') {
        this.observer = new MutationObserver(() => this.refresh());
        this.observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
      }
    }
  }

  /**
   * Re-resolve every colour from the current CSS custom properties and notify
   * listeners. Safe to call in headless contexts (falls back to the table).
   */
  refresh() {
    this.colors = this.resolve();
    this.generation++;
    for (const l of this.listeners.slice()) l.fn();
  }

  /** Register a theme-change listener. Detach with `off(context)`. */
  on(fn: () => void, context: unknown) {
    this.listeners.push({ fn, context });
  }

  off(context: unknown) {
    this.listeners = this.listeners.filter((l) => l.context !== context);
  }

  private resolve(): CanvasThemeColors {
    const style = hasDom() ? getComputedStyle(document.documentElement) : undefined;

    const out = {} as Record<string, string>;
    for (const key of Object.keys(COLOR_SPECS) as (keyof typeof COLOR_SPECS)[]) {
      const spec: ColorSpec = COLOR_SPECS[key];
      let value = '';
      if (style && spec.css) {
        value = style.getPropertyValue(spec.css).trim();
      }
      out[key] = value || spec.fallback;
    }
    return out as CanvasThemeColors;
  }
}
