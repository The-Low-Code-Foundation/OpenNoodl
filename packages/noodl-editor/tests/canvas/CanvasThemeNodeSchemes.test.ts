import { CanvasTheme } from '../../src/editor/src/views/nodegrapheditor/canvas/CanvasTheme';

/**
 * UIX-012: the DOM node colour schemes (node picker item, connection popup,
 * node-references panel) used to be dark-only literals shipped by the runtime's
 * `nodelibraryexport.js`. They now derive from the same CSS tokens the canvas
 * paints from, so they have to be right in BOTH themes.
 *
 * The spec runner does not load the editor stylesheet, so these specs write the
 * tokens they care about onto `document.documentElement` as inline custom
 * properties — `getComputedStyle` resolves those exactly as it resolves the
 * real `colors.css`, which keeps the real `resolve()`/`derive()` path under
 * test without depending on a stylesheet being present.
 */

/**
 * The values `colors.css` gives these tokens, per theme.
 *
 * 🔴 THIS IS A COPY, and NAT-002 caught it drifting. It held `--theme-color-fg-muted` at
 * `#6b7682`/`#7c8894` — the values that token carried until D9 retired it to an alias of
 * `fg-default-shy`. The map is self-consistent, so nothing here would have failed; it would
 * simply have gone on grading a palette the product no longer ships. When a token named below
 * moves in `colors.css`, it has to move here too.
 */
const DARK_TOKENS = {
  '--theme-color-bg-0': '#161c24',
  '--theme-color-bg-1': '#212932',
  '--theme-color-fg-highlight': '#eef2f6',
  '--theme-color-fg-default-shy': '#abb8c5',
  '--theme-color-node-category-default': '#7d8a98',
  '--theme-color-node-category-visual': '#5ca9ff',
  '--theme-color-node-category-data': '#45d08a',
  '--theme-color-node-category-function': '#f776c4',
  '--theme-color-node-category-component': '#a78bfa'
};

const LIGHT_TOKENS = {
  '--theme-color-bg-0': '#eef1f5',
  '--theme-color-bg-1': '#ffffff',
  '--theme-color-fg-highlight': '#18212b',
  '--theme-color-fg-default-shy': '#59626e',
  '--theme-color-node-category-default': '#7a8691',
  '--theme-color-node-category-visual': '#2e7cd6',
  '--theme-color-node-category-data': '#1e9e63',
  '--theme-color-node-category-function': '#d6479a',
  '--theme-color-node-category-component': '#7c5ce0'
};

const CATEGORIES = ['component', 'visual', 'data', 'javascript', 'default'];
const SCHEME_KEYS = [
  'base',
  'baseHighlighted',
  'header',
  'headerHighlighted',
  'outline',
  'outlineHighlighted',
  'text'
];

function applyTokens(tokens: Record<string, string>) {
  for (const [name, value] of Object.entries(tokens)) {
    document.documentElement.style.setProperty(name, value);
  }
  CanvasTheme.instance.refresh();
}

function clearTokens() {
  for (const name of Object.keys(DARK_TOKENS)) {
    document.documentElement.style.removeProperty(name);
  }
  CanvasTheme.instance.refresh();
}

/** rgb()/rgba()/#hex → channels, so the assertions can talk about luminance. */
function channels(color: string) {
  const hex = color.trim().match(/^#([0-9a-fA-F]{6})$/);
  if (hex) {
    return {
      r: parseInt(hex[1].slice(0, 2), 16),
      g: parseInt(hex[1].slice(2, 4), 16),
      b: parseInt(hex[1].slice(4, 6), 16)
    };
  }
  const m = color.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/);
  if (!m) throw new Error(`Not a parsable color: ${color}`);
  return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) };
}

function luminance(color: string) {
  const c = channels(color);
  return (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;
}

describe('CanvasTheme node colour schemes (UIX-012)', () => {
  afterEach(clearTokens);

  it('produces a complete scheme for every category, and falls back to default', () => {
    for (const name of CATEGORIES) {
      const scheme = CanvasTheme.instance.nodeColorScheme(name);
      for (const key of SCHEME_KEYS) {
        expect(typeof scheme[key]).toBe('string');
        expect(scheme[key].length).toBeGreaterThan(0);
      }
    }

    const fallback = CanvasTheme.instance.nodeColorScheme('default');
    expect(CanvasTheme.instance.nodeColorScheme('no-such-category')).toEqual(fallback);
    expect(CanvasTheme.instance.nodeColorScheme(undefined)).toEqual(fallback);
  });

  it('keeps the dark-palette identities (headerHighlighted = base, outline = header)', () => {
    for (const name of CATEGORIES) {
      const scheme = CanvasTheme.instance.nodeColorScheme(name);
      expect(scheme.headerHighlighted).toBe(scheme.base);
      expect(scheme.outline).toBe(scheme.header);
    }
  });

  it('works with no CSS at all (headless fallbacks stay dark)', () => {
    clearTokens();

    for (const name of CATEGORIES) {
      const scheme = CanvasTheme.instance.nodeColorScheme(name);
      expect(luminance(scheme.base)).toBeLessThan(0.4);
      expect(luminance(scheme.text)).toBeGreaterThan(0.6);
    }
  });

  it('gives dark surfaces with light ink on the dark theme', () => {
    applyTokens(DARK_TOKENS);

    for (const name of CATEGORIES) {
      const scheme = CanvasTheme.instance.nodeColorScheme(name);
      expect(luminance(scheme.base)).toBeLessThan(0.4);
      // The header sits one elevation step deeper than the card body.
      expect(luminance(scheme.header)).toBeLessThan(luminance(scheme.base) + 0.01);
      // Ink is clearly lighter than the surface it sits on.
      expect(luminance(scheme.text)).toBeGreaterThan(luminance(scheme.base) + 0.3);
    }
  });

  it('gives light surfaces with dark ink on the light theme', () => {
    applyTokens(LIGHT_TOKENS);

    for (const name of CATEGORIES) {
      const scheme = CanvasTheme.instance.nodeColorScheme(name);
      expect(luminance(scheme.base)).toBeGreaterThan(0.6);
      expect(luminance(scheme.header)).toBeLessThan(luminance(scheme.base) + 0.01);
      expect(luminance(scheme.text)).toBeLessThan(luminance(scheme.base) - 0.3);
    }
  });

  it('reproduces the shipped dark palette closely enough not to be a re-skin', () => {
    applyTokens(DARK_TOKENS);

    // The `nodelibraryexport.js` literals this replaced.
    // 🔴 NAT-003 MOVED THESE ON PURPOSE, which is a different thing from drift. UIX-012's claim
    // was "deriving from tokens did not change what a node looks like", and it pinned the
    // runtime's literals to prove it. NAT-003 lifted `bg-0`/`bg-1`, node cards are
    // `mix(bg-1, accent, 0.2)`, so the cards moved WITH the canvas — deliberately, because a card
    // that dissolves into its ground still dissolves if only the ground is rescued.
    // ⚠️ These are re-derived, not re-guessed, and `nodelibraryexport.ts` was updated to the same
    // values in the same change. The assertion still does its job: it binds two packages'
    // palettes together, and it fails if either moves alone.
    const shipped = {
      component: '#3c3d5a',
      visual: '#2d435b',
      data: '#284a44',
      javascript: '#4c384f',
      default: '#333c46'
    };

    for (const [name, expected] of Object.entries(shipped)) {
      const actual = channels(CanvasTheme.instance.nodeColorScheme(name).base);
      const target = channels(expected);
      for (const ch of ['r', 'g', 'b'] as const) {
        expect(Math.abs(actual[ch] - target[ch])).toBeLessThan(16);
      }
    }
  });

  it('re-resolves the schemes on a theme change', () => {
    applyTokens(DARK_TOKENS);
    const dark = CanvasTheme.instance.nodeColorScheme('visual').base;

    applyTokens(LIGHT_TOKENS);
    const light = CanvasTheme.instance.nodeColorScheme('visual').base;

    expect(light).not.toBe(dark);
    expect(luminance(light)).toBeGreaterThan(luminance(dark));
  });

  it('notifies listeners registered with a context, and stops after off()', () => {
    const context = {};
    let calls = 0;
    CanvasTheme.instance.on(() => calls++, context);

    CanvasTheme.instance.refresh();
    expect(calls).toBe(1);

    CanvasTheme.instance.off(context);
    CanvasTheme.instance.refresh();
    expect(calls).toBe(1);
  });
});
