#!/usr/bin/env node
/**
 * DSG-008 — measure every icon on screen against the surface it is painted on.
 *
 * ## Why this is a tool and not a code review
 *
 * `Icon.module.scss` states the house rule in its own header: a glyph paints with `currentColor`
 * and the **host** sets `color`. That rule is unenforceable by reading, for three reasons that
 * all bite at once:
 *
 * - a host that sets `fill` instead of `color` looks correct and does nothing, because the
 *   shipped glyphs declare their own `fill`/`stroke` attribute and an *inherited* `fill` loses to
 *   an element's own presentation attribute — and half the set is stroked, where `fill` is the
 *   wrong property entirely;
 * - a host that sets neither inherits whatever `color` happens to be ambient wherever it was
 *   mounted, which is a different answer per call site and not visible in the component's file;
 * - the background is usually painted by an ancestor several levels up, so no single stylesheet
 *   contains both halves of the pair.
 *
 * So the honest instrument is the running app: read the computed paint of every glyph, walk up
 * for the first opaque background behind it, and divide.
 *
 * ## What it reports
 *
 * WCAG 1.4.11 asks **3:1** for a graphical object that conveys meaning, and that is the bar used
 * here. Anything under it is listed with its nearest identifiable owner, so the fix has an
 * address. Icons that are decorative beside a visible text label are still reported — this tool
 * does not know which is which, and a human deciding "that one is fine" is cheaper than a human
 * finding it in the first place.
 *
 * Usage:
 *   node scripts/devtools/icon-contrast.js                 # the editor, current theme
 *   node scripts/devtools/icon-contrast.js --target=viewer
 *   node scripts/devtools/icon-contrast.js --json
 */

const { appTarget, connect, evaluate } = require('./cdp');

const args = process.argv.slice(2);
const targetArg = args.find((a) => a.startsWith('--target='));
const target = targetArg ? targetArg.split('=')[1] : 'editor';
const asJson = args.includes('--json');

/**
 * The measurement, run inside the renderer.
 *
 * ⚠️ Everything here is read from `getComputedStyle`, never from the stylesheets. A rule that is
 * present and losing looks identical to a rule that is absent, and this audit exists precisely
 * because several of them were present and losing.
 */
const PROBE = `(() => {
  const parseColor = (value) => {
    if (!value) return null;
    const m = value.match(/rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    const parts = m[1].split(',').map((p) => parseFloat(p.trim()));
    const [r, g, b] = parts;
    const a = parts.length > 3 ? parts[3] : 1;
    if ([r, g, b].some((n) => !Number.isFinite(n))) return null;
    return { r, g, b, a };
  };

  const luminance = ({ r, g, b }) => {
    const v = [r, g, b].map((c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  };

  const contrast = (fg, bg) => {
    const l1 = luminance(fg);
    const l2 = luminance(bg);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };

  /** Composite a partly transparent foreground over the background it sits on. */
  const over = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1
  });

  const hex = ({ r, g, b }) =>
    '#' + [r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('');

  /**
   * The first opaque background behind an element, composited through any translucent layers
   * above it. Falls back to the document's, which is what an element over nothing sits on.
   */
  const backgroundBehind = (element) => {
    const stack = [];
    for (let node = element; node && node !== document.documentElement; node = node.parentElement) {
      const colour = parseColor(getComputedStyle(node).backgroundColor);
      if (!colour || colour.a === 0) continue;
      stack.push(colour);
      if (colour.a === 1) break;
    }

    const root =
      parseColor(getComputedStyle(document.documentElement).backgroundColor) ||
      parseColor(getComputedStyle(document.body).backgroundColor) || { r: 0, g: 0, b: 0, a: 1 };

    let result = stack.length && stack[stack.length - 1].a === 1 ? stack.pop() : root;
    while (stack.length) result = over(stack.pop(), result);
    return result;
  };

  /**
   * What a glyph actually paints with.
   *
   * Both properties, because the set has two eras: the solid glyphs carry \`fill="currentColor"\`
   * and the 1.5px line glyphs carry \`stroke="currentColor"\`. A host that coloured only \`fill\`
   * leaves every stroked glyph uncoloured, which is exactly the bug that started this.
   */
  const paintOf = (svg) => {
    const marks = svg.querySelectorAll('path, circle, rect, line, polygon, polyline, ellipse');
    for (const mark of marks.length ? marks : [svg]) {
      const style = getComputedStyle(mark);
      for (const property of ['stroke', 'fill']) {
        const value = style[property];
        if (!value || value === 'none') continue;
        const colour = parseColor(value);
        if (colour && colour.a > 0) return { colour, property, mark };
      }
    }
    return null;
  };

  /**
   * A human-findable name for whatever owns this glyph.
   *
   * ⚠️ Deliberately skips \`Icon-module__*\` and the other generic wrappers. The first named
   * ancestor of every glyph in this app is the \`Icon\` component itself, which is the one answer
   * that cannot help — it is the same for all 878 of them, and the fix is never in that file.
   * What is wanted is the *host*, because the house rule is that the host sets \`color\`.
   */
  const GENERIC = /^(Icon|IconButton|Tooltip|Container|BasePanel|SidePanel)-module__/;

  const ownerOf = (svg) => {
    const parts = [];

    for (let node = svg; node && node !== document.body; node = node.parentElement) {
      const label = node.getAttribute?.('aria-label') || node.getAttribute?.('title');
      if (label) return label.slice(0, 46);

      if (node.id) return '#' + node.id;

      const classes = typeof node.className === 'string' ? node.className : node.className?.baseVal || '';
      for (const cls of classes.split(/\\s+/)) {
        if (!cls) continue;
        // CSS-module class names are \`File-module__Part--hash\`; the hash is noise.
        const named = cls.replace(/--[A-Za-z0-9_-]{4,}$/, '');
        if (GENERIC.test(named)) continue;
        if (/^is-/.test(named)) continue;
        parts.push(named);
        if (parts.length >= 2) return parts.join(' < ');
      }
    }

    return parts.length ? parts.join(' < ') : '(unnamed)';
  };

  const results = [];

  for (const svg of document.querySelectorAll('svg')) {
    const box = svg.getBoundingClientRect();
    // Off screen, zero-sized or hidden glyphs are not what anybody is looking at.
    if (box.width < 2 || box.height < 2) continue;
    if (box.bottom < 0 || box.right < 0 || box.top > innerHeight || box.left > innerWidth) continue;
    const style = getComputedStyle(svg);
    if (style.visibility === 'hidden' || style.display === 'none') continue;
    const opacity = parseFloat(style.opacity);
    if (!(opacity > 0.05)) continue;

    const paint = paintOf(svg);
    if (!paint) continue;

    const background = backgroundBehind(svg);
    // The glyph's own opacity dims it against that background just as an alpha channel would.
    const effective = over({ ...paint.colour, a: paint.colour.a * (Number.isFinite(opacity) ? opacity : 1) }, background);

    results.push({
      owner: ownerOf(svg),
      property: paint.property,
      fg: hex(effective),
      bg: hex(background),
      ratio: Math.round(contrast(effective, background) * 100) / 100,
      size: Math.round(box.width) + 'x' + Math.round(box.height),
      opacity: Number.isFinite(opacity) ? opacity : 1
    });
  }

  return {
    theme: document.documentElement.getAttribute('data-theme') || getComputedStyle(document.body).backgroundColor,
    total: results.length,
    results
  };
})()`;

/** WCAG 1.4.11: a graphical object that conveys meaning needs 3:1 against what is behind it. */
const GRAPHICS_THRESHOLD = 3;

async function main() {
  const page = await appTarget(target);
  const client = await connect(page);

  try {
    const report = await evaluate(client, PROBE);

    if (asJson) {
      console.log(JSON.stringify(report, null, 2));
      return;
    }

    const failures = report.results.filter((r) => r.ratio < GRAPHICS_THRESHOLD).sort((a, b) => a.ratio - b.ratio);

    console.log(`\n${report.total} icons measured on ${target} (theme: ${report.theme})`);
    console.log(`${failures.length} below ${GRAPHICS_THRESHOLD}:1 (WCAG 1.4.11, graphical objects)\n`);

    if (!failures.length) {
      console.log('  Every visible glyph clears the bar.\n');
      return;
    }

    const width = Math.max(...failures.map((f) => f.owner.length), 8);
    console.log(`  ${'ratio'.padEnd(7)}${'paint'.padEnd(8)}${'glyph'.padEnd(9)}${'on'.padEnd(9)}${'size'.padEnd(9)}owner`);
    for (const f of failures) {
      console.log(
        `  ${String(f.ratio).padEnd(7)}${f.property.padEnd(8)}${f.fg.padEnd(9)}${f.bg.padEnd(9)}${f.size.padEnd(9)}${f.owner.slice(0, width)}`
      );
    }
    console.log('');
  } finally {
    client.close?.();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
