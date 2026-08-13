/**
 * The design system's colour tokens, resolved from `colors.css`, and the WCAG contrast formula.
 *
 * ## Why a contrast measurement can live in a plain-Node runner at all
 *
 * The repo's standing instrument for this is `scripts/devtools/icon-contrast.js`, which samples
 * *rendered pixels* in a running editor — and it exists because a whole class of defect (nine
 * dark-on-dark glyphs, worst 1.16:1) cannot be found by reading. That instrument is still the
 * authority on anything whose colour is decided at paint time.
 *
 * This one answers a narrower question and answers it without a renderer: **what do the two
 * tokens a rule names actually resolve to, and what is the ratio between them?** When a
 * stylesheet says `background-color: var(--theme-color-primary)` on a surface that says
 * `var(--theme-color-bg-3)`, the pair is decided in the source, in both themes, and a pixel is
 * not needed to know it. That makes a contrast floor a *gate* rather than an after-the-fact
 * audit.
 *
 * ⚠️ What it deliberately cannot see: anything composited (a translucent overlay over an unknown
 * parent), anything a theme overrides outside `colors.css`, and whether the element is painted at
 * all. A rule that measures 6:1 here and is covered by another element still fails a human. Those
 * remain a drive's job.
 */
import * as fs from 'fs';
import * as path from 'path';

const COLORS_CSS = path.join(__dirname, '../../../noodl-core-ui/src/styles/custom-properties/colors.css');

export type ThemeName = 'dark' | 'light';

export type TokenMap = Record<string, string>;

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** The bodies of every rule whose selector is exactly `selector`. */
function ruleBodies(source: string, selector: string): string[] {
  const bodies: string[] = [];
  const pattern = new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{`, 'g');

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source))) {
    const open = match.index + match[0].length;
    const close = source.indexOf('}', open);
    if (close === -1) continue;
    bodies.push(source.slice(open, close));
  }
  return bodies;
}

function readDeclarations(body: string, into: TokenMap): TokenMap {
  for (const declaration of body.split(';')) {
    const colon = declaration.indexOf(':');
    if (colon === -1) continue;
    const name = declaration.slice(0, colon).trim();
    if (!name.startsWith('--')) continue;
    into[name] = declaration.slice(colon + 1).trim();
  }
  return into;
}

/**
 * Every token, as the named theme sees it.
 *
 * Dark is the bare `:root` blocks — base palette first, then the theme layer over it. Light is
 * that whole map with `:root[data-theme='light']` applied on top, which is exactly how the
 * cascade resolves it in the app: the light theme restates only what it changes.
 */
export function themeTokens(theme: ThemeName): TokenMap {
  const source = stripComments(fs.readFileSync(COLORS_CSS, 'utf8'));

  const tokens: TokenMap = {};
  for (const body of ruleBodies(source, ':root')) readDeclarations(body, tokens);
  if (theme === 'dark') return tokens;

  for (const body of ruleBodies(source, ":root[data-theme='light']")) readDeclarations(body, tokens);
  return tokens;
}

/** Follow `var(--x)` until a literal colour falls out. `undefined` for a token that is absent. */
export function resolveToken(tokens: TokenMap, name: string): string | undefined {
  let value = tokens[name];
  if (value === undefined) return undefined;

  for (let depth = 0; depth < 20 && /var\(\s*--[\w-]+\s*\)/.test(value); depth++) {
    value = value.replace(/var\(\s*(--[\w-]+)\s*\)/g, (whole, token: string) => tokens[token] ?? whole);
  }
  return value;
}

export type Rgb = [number, number, number];

/** `#abc`, `#aabbcc`, `rgb(…)` and `rgba(…)` — the four spellings `colors.css` uses. */
export function parseColor(value: string | undefined): Rgb | null {
  if (!value) return null;
  const text = value.trim();

  let match = text.match(/^#([0-9a-f]{6})$/i);
  if (match) return [0, 2, 4].map((i) => parseInt(match![1].slice(i, i + 2), 16)) as Rgb;

  match = text.match(/^#([0-9a-f]{3})$/i);
  if (match) return [0, 1, 2].map((i) => parseInt(match![1][i] + match![1][i], 16)) as Rgb;

  match = text.match(/^rgba?\(([^)]+)\)$/i);
  if (match) {
    const parts = match[1].split(',').map((part) => parseFloat(part));
    if (parts.length < 3 || parts.some((part) => Number.isNaN(part))) return null;
    // ⚠️ Alpha is dropped, not composited. A translucent token measured against an unknown
    // parent would be a made-up number, so callers must not pass one — see the header.
    return [parts[0], parts[1], parts[2]];
  }

  return null;
}

function relativeLuminance(colour: Rgb): number {
  const [r, g, b] = colour.map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x contrast ratio, 1–21. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * The ratio between two tokens in one theme.
 *
 * Throws rather than returning a sentinel when a token is missing or unparseable: a contrast
 * gate that quietly scored `0` for a token somebody renamed would be the exact shape of gate
 * this repo has a register entry about — one that reads a field its source lacks.
 */
export function tokenContrast(theme: ThemeName, foreground: string, background: string): number {
  const tokens = themeTokens(theme);

  const fg = parseColor(resolveToken(tokens, foreground));
  const bg = parseColor(resolveToken(tokens, background));

  if (!fg) throw new Error(`${foreground} does not resolve to a measurable colour in the ${theme} theme`);
  if (!bg) throw new Error(`${background} does not resolve to a measurable colour in the ${theme} theme`);

  return contrastRatio(fg, bg);
}
