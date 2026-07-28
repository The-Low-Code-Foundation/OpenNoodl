/**
 * CanvasTheme — the single source of every colour painted on the node-graph
 * canvas (UIX-005).
 *
 * Resolution order per colour:
 *   1. the UIX-001 CSS custom property (documented token name), read via one
 *      `getComputedStyle(document.documentElement)` pass at initialisation and
 *      again on every theme change;
 *   2. a typed fallback literal — the dark-theme token values — for headless /
 *      no-CSS contexts (the SUB-009 headless editor export, the Electron
 *      test-runner pages and jsdom run without the editor stylesheet — without
 *      these fallbacks the canvas would paint garbage there).
 *
 * Theme-change contract (UIX-008 depends on this even though only the dark
 * theme exists when this ships). Any of the following re-resolves all colours,
 * invalidates the cached grid pattern and notifies listeners:
 *   - `CanvasTheme.instance.refresh()` (direct call);
 *   - `window.dispatchEvent(new CustomEvent('nodegx:themechanged'))` — the
 *     primary hook; the editor's ThemeManager (UIX-008) fires this on every
 *     theme change;
 *   - flipping the root element's `data-theme` attribute (or a legacy theme
 *     `class`) — observed with a MutationObserver as a safety net.
 *
 * Listeners follow the PLAT-001 listener-context rule: register with
 * `on(listener, context)`, detach with `off(context)`. `NodeGraphEditor`
 * subscribes in its constructor (repaint on change) and detaches in
 * `dispose()`.
 */

export const THEME_CHANGED_EVENT = 'nodegx:themechanged';

/**
 * The port type name that paints a wire as an error path (WFA-004).
 *
 * Declared here, next to the colour it selects, so the connection painter and
 * the workflow node library cannot disagree about the spelling. It is a port
 * *type* rather than a flag on the connection because that is how every other
 * wire already picks its colour — `connectionColors(fromPort.type)`.
 */
export const WIRE_TYPE_ERROR = 'signal-error';

type Listener = { fn: () => void; context: unknown };

/** One colour: optional CSS token name + mandatory headless fallback. */
export type ColorSpec = { css?: string; fallback: string };

/**
 * Resolve a table of CSS custom properties to literal colour strings — the one
 * primitive for "I need concrete colours, not `var()`".
 *
 * Some consumers cannot use `var()` at all: the canvas paints into a 2D
 * context, and `react-json-view` (UIX-012, the debug inspector popup) takes a
 * base16 object of literals. Both go through here so there is a single place
 * that knows how a token becomes a value, and a single headless fallback rule.
 *
 * Pair it with `CanvasTheme.instance.on(...)` (or the `useThemeTokens` hook) to
 * re-resolve when the theme flips.
 */
export function resolveThemeTokens<K extends string>(specs: Record<K, ColorSpec>): Record<K, string> {
  const style = hasDom() ? getComputedStyle(document.documentElement) : undefined;
  const out = {} as Record<K, string>;

  for (const key of Object.keys(specs) as K[]) {
    const spec = specs[key];
    const value = style && spec.css ? style.getPropertyValue(spec.css).trim() : '';
    out[key] = value || spec.fallback;
  }

  return out;
}

/**
 * The colour table. `css` is the UIX-001 token the value resolves from in a
 * styled document; `fallback` is the dark-theme literal used when the token is
 * absent (headless/test contexts).
 */
const COLOR_SPECS = {
  /* --- Ground ------------------------------------------------------------ */
  /** Canvas ground (also set on `.nodegrapgeditor-bg` in CSS). */
  ground: { css: '--theme-color-bg-0', fallback: '#0b0e12' },
  /** Base colour of the dot grid; alpha is applied in `derive()`. */
  gridDotBase: { css: '--theme-color-fg-highlight', fallback: '#eef2f6' },

  /* --- Node card ---------------------------------------------------------- */
  cardBg: { css: '--theme-color-bg-1', fallback: '#12161b' },
  cardBgHover: { css: '--theme-color-bg-2', fallback: '#181d24' },
  cardBorder: { css: '--theme-color-border-default', fallback: '#232a33' },
  cardBorderHover: { css: '--theme-color-border-strong', fallback: '#37404c' },
  /** Node name. */
  cardText: { css: '--theme-color-fg-highlight', fallback: '#eef2f6' },
  /** Type line. */
  cardSubText: { css: '--theme-color-fg-muted', fallback: '#6b7682' },
  /**
   * The "this node has a comment" gutter stripe (CAN-004).
   *
   * The primary accent, deliberately: a comment is informational, and the two
   * obvious alternatives are already spoken for — red is danger-only under the
   * phase-23 law, amber means warning (UIX-004's toolbar). It is not the node's
   * `cat.accent` either, or the stripe would read as another category tint
   * rather than as a mark that means something.
   */
  commentIndicator: { css: '--theme-color-primary', fallback: '#4da3ff' },
  /** Port row labels. */
  portText: { css: '--theme-color-fg-default', fallback: '#a6b0bb' },

  /** Selection / drag-affordance ring (accent; glow derived below). */
  selection: { css: '--theme-color-primary', fallback: '#4da3ff' },

  /* --- Status ------------------------------------------------------------- */
  /**
   * Errors and destructive affordances (unhealthy borders, error wires).
   *
   * The `deleteMarker` / `deleteMarkerGlyph` pair that used to sit here went
   * with the arm-then-confirm wire delete it painted (CAN-003).
   */
  danger: { css: '--theme-color-danger', fallback: '#f97066' },

  /* --- Annotations (diff/review — SUB-007 / AIX-003) ---------------------- */
  annotationCreated: { css: '--theme-color-success', fallback: '#3ccb7f' },
  annotationChanged: { css: '--theme-color-warning', fallback: '#fdb022' },
  annotationDeleted: { css: '--theme-color-danger', fallback: '#f97066' },
  /** Ink for the +/-/~ glyph inside the corner badge (dark on colour). */
  annotationBadgeGlyph: { css: '--theme-color-bg-0', fallback: '#0b0e12' },

  /* --- Editor decorations ------------------------------------------------- */
  /** Connection-drag indicator line + endpoints. */
  dragLine: { css: '--theme-color-primary', fallback: '#4da3ff' },
  /** Rect-select dashed box. */
  multiselect: { css: '--theme-color-fg-muted', fallback: '#6b7682' },
  /** Multi-selection AABB outline. */
  multiselectBox: { css: '--theme-color-fg-default', fallback: '#a6b0bb' },
  /** Parent→child hierarchy spine (the mock's `--border-2` spine). */
  hierarchyLine: { css: '--theme-color-border-strong', fallback: '#37404c' },
  /** Child insert-location indicator bar. */
  insertIndicator: { css: '--theme-color-primary', fallback: '#4da3ff' },
  /** Dim layer behind a connection drag (painted at 0.6 globalAlpha). */
  scrim: { css: '--theme-color-bg-page', fallback: '#07090c' },

  /* --- Wires -------------------------------------------------------------- */
  wireSignal: { css: '--theme-color-wire-signal', fallback: '#35c3e8' },
  wireData: { css: '--theme-color-wire-data', fallback: '#45d08a' },
  /** Debug-inspector wire pulse. */
  wirePulse: { css: '--theme-color-fg-highlight', fallback: '#eef2f6' },

  /* --- Node categories (UIX-001 category tokens) --------------------------
     component, visual, data, javascript, default. `javascript` maps onto the
     *function* token (pink).

     WFA-004 adds `logic`, which UIX-005 left out because no browser node type
     declares that category and amber also carries warning/Changed. Workflow
     step kinds DO have a logic category (`branch`, `switch`, `for-each`,
     `merge`, and the timing kinds), so the token now has a referent. The
     collision with amber-as-warning is bounded: a warning is drawn as a badge
     and an annotation is drawn on the wire, neither of which is a category
     chip, and no node type carries both. */
  categoryVisual: { css: '--theme-color-node-category-visual', fallback: '#5ca9ff' },
  categoryData: { css: '--theme-color-node-category-data', fallback: '#45d08a' },
  categoryLogic: { css: '--theme-color-node-category-logic', fallback: '#f5b843' },
  categoryJavascript: { css: '--theme-color-node-category-function', fallback: '#f776c4' },
  categoryComponent: { css: '--theme-color-node-category-component', fallback: '#a78bfa' },
  categoryDefault: { css: '--theme-color-fg-muted', fallback: '#6b7682' }
} satisfies Record<string, ColorSpec>;

type BaseColors = { [K in keyof typeof COLOR_SPECS]: string };

export type CanvasCategoryName = 'component' | 'visual' | 'data' | 'logic' | 'javascript' | 'default';

export type CanvasCategoryColors = {
  /** Full-strength category hue (chip glyph, category accents). */
  accent: string;
  /** Soft fill behind the chip glyph (accent @ 15%). */
  chipFill: string;
};

/**
 * The DOM-side node colour scheme (UIX-012).
 *
 * Shape-compatible with `INodeColorScheme` (noodl-editor `types/nodeTypes`) and
 * with the `colors.nodes.*` blob the runtime's `nodelibraryexport.js` still
 * ships — but derived from the same CSS tokens the canvas paints from, so it is
 * correct in BOTH themes instead of being frozen at the dark literals.
 *
 * Consumers are the surfaces that render node chrome in the DOM rather than on
 * the canvas: the node picker item (`EditorNode`), the connection popup and the
 * node-references panel.
 */
export type NodeColorScheme = {
  /** Card body. */
  base: string;
  /** Card body, hovered/keyboard-cursored. */
  baseHighlighted: string;
  /** Title bar / group header (one elevation step deeper than `base`). */
  header: string;
  /** Title bar, highlighted — reads as the card body, as in the dark palette. */
  headerHighlighted: string;
  /** Card outline at rest. */
  outline: string;
  /** Card outline when selected — the full-strength category hue. */
  outlineHighlighted: string;
  /** Ink on the card. */
  text: string;
};

export type CanvasWireColors = {
  normal: string;
  highlighted: string;
  pulsing: string;
};

export type CanvasThemeColors = BaseColors & {
  /** True when the resolved ground is dark (drives derived alphas). */
  isDark: boolean;
  /** Dot-grid colour with theme-appropriate alpha applied. */
  gridDot: string;
  /** Soft outer glow behind the accent selection ring. */
  selectionGlow: string;
  wireSignalHighlighted: string;
  wireDataHighlighted: string;
  wireErrorHighlighted: string;
  categories: Record<CanvasCategoryName, CanvasCategoryColors>;
  /** DOM node chrome (picker / connection popup / references panel). */
  nodeSchemes: Record<CanvasCategoryName, NodeColorScheme>;
};

/* ----------------------------------------------------------------------------
 * Small colour math helpers (hex + rgb()/rgba() input)
 * ------------------------------------------------------------------------- */

function parseColor(color: string): { r: number; g: number; b: number } | undefined {
  const c = color.trim();
  if (c.startsWith('#')) {
    const hex = c.slice(1);
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16)
      };
    }
    if (hex.length === 6 || hex.length === 8) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16)
      };
    }
    return undefined;
  }
  const m = c.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/);
  if (m) return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) };
  return undefined;
}

/** `color` at alpha `a` as an rgba() string (falls through on parse failure). */
export function withAlpha(color: string, a: number): string {
  const rgb = parseColor(color);
  if (!rgb) return color;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`;
}

/** Mix `color` towards `into` by `t` (0..1). */
function mix(color: string, into: string, t: number): string {
  const a = parseColor(color);
  const b = parseColor(into);
  if (!a || !b) return color;
  const ch = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `rgb(${ch(a.r, b.r)}, ${ch(a.g, b.g)}, ${ch(a.b, b.b)})`;
}

function isDarkColor(color: string): boolean {
  const rgb = parseColor(color);
  if (!rgb) return true;
  // Relative-luminance-ish; enough to pick grid alpha and glyph inks.
  return (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255 < 0.5;
}

function hasDom(): boolean {
  return typeof document !== 'undefined' && typeof getComputedStyle === 'function' && !!document.documentElement;
}

/* ----------------------------------------------------------------------------
 * Fonts — the canvas type ramp (mock: name 600 12.5, type line 10.5,
 * port rows 10.5 mono). Defined once so the measure path
 * (NodeGraphEditorNode.titlebar*Height) and the draw path can never disagree.
 * The old `Inter-*` per-weight families were demoted in UIX-001; the canvas
 * moves to the system stack here.
 * ------------------------------------------------------------------------- */

const SYSTEM_FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";
const MONO_FONT = "ui-monospace, 'SF Mono', Menlo, Consolas, monospace";

export const CanvasFonts = {
  /** Node name (semibold). */
  nodeLabel: `600 12.5px ${SYSTEM_FONT}`,
  /** Type line under the name. */
  nodeSubLabel: `10.5px ${SYSTEM_FONT}`,
  /** Port row labels (mono per mock). */
  portLabel: `10.5px ${MONO_FONT}`,
  /** Annotation corner-badge glyph. */
  annotationBadge: `600 12px ${SYSTEM_FONT}`
} as const;

/**
 * Wire-label chip geometry (CAN-001, extracted from the WFA-004 paint path).
 *
 * Named here rather than left as literals in the connection painter because
 * CAN-002 computes a *wrapped* chip from the same numbers, and two copies of a
 * padding is how they drift.
 */
export const WireLabel = {
  /** Horizontal padding inside the chip, per side. */
  paddingX: 4,
  /** One line of label text — also the single-line chip height. */
  lineHeight: 13,
  /** The chip is nearly opaque: a bare glyph over the dot grid is unreadable. */
  chipAlpha: 0.92,
  /** Default position along the curve. */
  defaultT: 0.5,
  /**
   * Placement clamp. Outside this the chip overlaps a node card, and cards are
   * painted after wires.
   */
  minT: 0.15,
  maxT: 0.85
} as const;

/** Grid geometry (mock: 20px cell, 1px-radius dots). */
export const GRID_CELL_SIZE = 20;
const GRID_DOT_RADIUS = 1;

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

  private gridPatternCache: { pattern: CanvasPattern; generation: number } | undefined;

  private constructor() {
    this.colors = this.resolve();

    // Each hook is guarded independently — headless contexts mix and match
    // which globals they provide (SUB-009 fakes `window` without a DOM; test
    // pages have both; plain Node has neither).
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      // UIX-008 contract: explicit notification...
      window.addEventListener(THEME_CHANGED_EVENT, () => this.refresh());
    }
    if (hasDom() && typeof MutationObserver !== 'undefined') {
      // ...and automatic pickup of a theme flip on the root element (the
      // ThemeManager sets `data-theme`; `class` kept for any legacy toggler).
      this.observer = new MutationObserver(() => this.refresh());
      this.observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
    }
  }

  /**
   * Re-resolve every colour from the current CSS custom properties and notify
   * listeners. Safe to call in headless contexts (falls back to the table).
   */
  refresh() {
    this.colors = this.resolve();
    this.generation++;
    this.gridPatternCache = undefined;
    for (const l of this.listeners.slice()) l.fn();
  }

  /** Register a theme-change listener. Detach with `off(context)`. */
  on(fn: () => void, context: unknown) {
    this.listeners.push({ fn, context });
  }

  off(context: unknown) {
    this.listeners = this.listeners.filter((l) => l.context !== context);
  }

  /** Card/chip colours for a node category (unknown names → default). */
  categoryColors(name: string | undefined): CanvasCategoryColors {
    const categories = this.colors.categories;
    return (name && categories[name as CanvasCategoryName]) || categories.default;
  }

  /**
   * The DOM node colour scheme for a node category (unknown names → default).
   * Same taxonomy and same fallback rule as `categoryColors`, so the picker,
   * the connection popup and the canvas can never disagree about a category.
   */
  nodeColorScheme(name: string | undefined): NodeColorScheme {
    const schemes = this.colors.nodeSchemes;
    return (name && schemes[name as CanvasCategoryName]) || schemes.default;
  }

  /**
   * Wire colours for a connection/port type name: `signal` gets the cyan pair,
   * everything else carries data (matching the old signal/default split).
   *
   * WFA-004 adds `signal-error` — the workflow canvas's `onError` edge. This is
   * the one legitimate use of red under phase 23's danger-only law: the edge
   * exists precisely because something failed. Colour alone would not be enough
   * (greyscale screenshots, colourblindness), so the connection painter also
   * dashes it — see `WIRE_TYPE_ERROR` in NodeGraphEditorConnection.
   */
  connectionColors(typeName: string | undefined): CanvasWireColors {
    const c = this.colors;
    if (typeName === 'signal') {
      return { normal: c.wireSignal, highlighted: c.wireSignalHighlighted, pulsing: c.wirePulse };
    }
    if (typeName === WIRE_TYPE_ERROR) {
      return { normal: c.danger, highlighted: c.wireErrorHighlighted, pulsing: c.wirePulse };
    }
    return { normal: c.wireData, highlighted: c.wireDataHighlighted, pulsing: c.wirePulse };
  }

  /**
   * The ground dot-grid as a repeating CanvasPattern (one `fillRect` per frame
   * — never per-dot draws). Cached until the next theme refresh. Returns
   * undefined when no document is available (headless).
   */
  gridPattern(ctx: CanvasRenderingContext2D): CanvasPattern | undefined {
    if (this.gridPatternCache && this.gridPatternCache.generation === this.generation) {
      return this.gridPatternCache.pattern;
    }
    if (typeof document === 'undefined') return undefined;

    const tile = document.createElement('canvas');
    // Draw the tile at 2x and pattern-transform it down so the dots stay
    // round when the canvas transform magnifies the pattern at high zoom.
    const scale = 2;
    tile.width = GRID_CELL_SIZE * scale;
    tile.height = GRID_CELL_SIZE * scale;
    const tileCtx = tile.getContext('2d');
    if (!tileCtx) return undefined;

    tileCtx.fillStyle = this.colors.gridDot;
    tileCtx.beginPath();
    tileCtx.arc((GRID_CELL_SIZE * scale) / 2, (GRID_CELL_SIZE * scale) / 2, GRID_DOT_RADIUS * scale, 0, Math.PI * 2);
    tileCtx.fill();

    const pattern = ctx.createPattern(tile, 'repeat');
    if (!pattern) return undefined;
    if (typeof DOMMatrix !== 'undefined' && pattern.setTransform) {
      pattern.setTransform(new DOMMatrix().scale(1 / scale));
    }

    this.gridPatternCache = { pattern, generation: this.generation };
    return pattern;
  }

  private resolve(): CanvasThemeColors {
    return this.derive(resolveThemeTokens(COLOR_SPECS) as BaseColors);
  }

  private derive(base: BaseColors): CanvasThemeColors {
    const isDark = isDarkColor(base.ground);
    const chip = (accent: string): CanvasCategoryColors => ({
      accent,
      chipFill: withAlpha(accent, 0.15)
    });
    // Highlighted wires move towards the theme's text pole so they brighten
    // on dark and deepen on light.
    const highlight = (color: string) => mix(color, isDark ? '#ffffff' : '#07090c', 0.35);

    /**
     * DOM node chrome (UIX-012). The card surface is the panel elevation step
     * tinted towards the category hue; the header is the same tint one step
     * deeper. The mix ratios are chosen so the DARK output reproduces the
     * shipped `nodelibraryexport.js` palette to within a couple of levels per
     * channel (e.g. component base #363050 → rgb(53,51,79)) while the LIGHT
     * output is a soft tint of the same hue on a near-white surface, with
     * `fg-highlight` ink — readable on both, by construction rather than by a
     * second hand-authored palette.
     */
    const nodeScheme = (accent: string): NodeColorScheme => {
      const cardBase = mix(base.cardBg, accent, 0.2);
      const cardHeader = mix(base.ground, accent, 0.2);
      return {
        base: cardBase,
        baseHighlighted: mix(base.cardBg, accent, 0.32),
        header: cardHeader,
        // The dark palette has headerHighlighted === base and outline === header;
        // keep those identities so nothing that relied on them shifts.
        headerHighlighted: cardBase,
        outline: cardHeader,
        outlineHighlighted: accent,
        text: base.cardText
      };
    };

    return {
      ...base,
      isDark,
      // The mock's `--dot`: fg-ink at .07 (dark) / .10 (light).
      gridDot: withAlpha(base.gridDotBase, isDark ? 0.07 : 0.1),
      selectionGlow: withAlpha(base.selection, 0.15),
      wireSignalHighlighted: highlight(base.wireSignal),
      wireDataHighlighted: highlight(base.wireData),
      wireErrorHighlighted: highlight(base.danger),
      categories: {
        visual: chip(base.categoryVisual),
        data: chip(base.categoryData),
        logic: chip(base.categoryLogic),
        javascript: chip(base.categoryJavascript),
        component: chip(base.categoryComponent),
        default: chip(base.categoryDefault)
      },
      nodeSchemes: {
        visual: nodeScheme(base.categoryVisual),
        data: nodeScheme(base.categoryData),
        logic: nodeScheme(base.categoryLogic),
        javascript: nodeScheme(base.categoryJavascript),
        component: nodeScheme(base.categoryComponent),
        default: nodeScheme(base.categoryDefault)
      }
    };
  }
}
