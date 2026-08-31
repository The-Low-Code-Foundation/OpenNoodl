#!/usr/bin/env node
/**
 * VIB-003 — generate the starter imagery module.
 *
 * Regenerate:  node scripts/library/make-starter-imagery.js
 *
 * ## Why this exists
 *
 * Register V7: `templates/` is 91 files, all JSON, and no template has ever shipped an asset. Of
 * 64 catalog examples, five carry an `Image` node and **none** carries a drawable picture — two
 * set `src: ""` and three set nothing at all. A model imitating that corpus produces pages with a
 * hole where the imagery goes, and the design doctrine's *"every listing gets a photo"* has
 * nowhere on this machine to point.
 *
 * `installStarterAssets` already solves the identical problem for typography and glyphs: Inter and
 * Lucide are copied out of the app bundle into every new project, offline, with nothing to
 * approve. This adds the third thing a page needs to stop looking empty, through the same door.
 *
 * ## 🔴 Why it is generated, and why it is abstract
 *
 * **Generated** because a photograph has a provenance and a licence, and a repository that ships
 * one is making a claim it cannot check on a reader's behalf. These are drawn from the design
 * system's own geometry, and the licence question does not arise.
 *
 * **Abstract, and deliberately hue-neutral**, which is the decision worth arguing with:
 *
 * - An `<img src>` SVG is a separate document. It **cannot read the page's CSS custom
 *   properties** — `var(--primary)` inside it resolves against nothing. So unlike
 *   `--gradient-brand`, which VIB-002 wrote in terms of other tokens precisely so a preset
 *   re-themes it for free, a starter picture's colours are frozen at generation time.
 * - A frozen picture in the brand blue therefore clashes the first time somebody switches preset,
 *   and it clashes *loudly*, because it is the largest thing on the page.
 * - So the palette here is ink-to-slate with no hue of its own. It reads as a designed ground
 *   under any preset, and `backgroundGradient` — which *is* a token, and *does* re-theme — paints
 *   the brand over it. That composition is exactly what VIB-002 built the two background ports
 *   for: `background-image: <gradient>, url(<image>)`, gradient first.
 *
 * ⚠️ These are a floor, not an ambition. They exist so that "the page has no imagery" stops being
 * the default state of every project on this machine, and every one of them is meant to be
 * replaced by the author's own picture. The doctrine says so in those words.
 */
const fs = require('fs');
const path = require('path');

const OUT = path.join(
  __dirname,
  '..',
  '..',
  'packages',
  'noodl-editor',
  'src',
  'assets',
  'starter-project',
  'noodl_modules',
  'starter-imagery'
);

/**
 * The ink ramp, dark to light. Slate-neutral on purpose (see the header): a hue here would fight
 * whichever preset the project ends up wearing.
 */
const INK = {
  950: '#070b14',
  900: '#0b1220',
  800: '#131c2e',
  700: '#1d2840',
  600: '#2b3854',
  500: '#3d4d6d',
  400: '#5a6b8c',
  300: '#8593ae',
  200: '#b9c2d3'
};

/** A deterministic pseudo-random, so a regenerate produces the identical bytes. */
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const svg = (w, h, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" ` +
  `role="img" preserveAspectRatio="xMidYMid slice">\n${body}\n</svg>\n`;

/**
 * A wide ground: a bright off-centre wash over near-black, cut by thin diagonal rules.
 *
 * 🔴 **The first version of this function was photographed and thrown away, which is the phase's
 * method applied to its own asset.** It layered five wide, blurred, low-contrast circles and the
 * PNG was a near-flat slate rectangle — the exact failure VIB-002 §4(b) recorded when a two-stop
 * gradient was stretched across 1900px and *"the eye cannot see it"*. A decorative image that reads
 * flat is the tell it exists to avoid, so the range here runs the full ramp (#05080f to #8593ae)
 * and the wash is tight rather than page-wide.
 *
 * The rules are the second half of the fix. Blur alone gives a soft field with no edge in it, and
 * an image with no edge cannot read as *drawn*; three hairlines at a consistent angle are enough
 * geometry to say a decision was made.
 */
function aurora(w, h, seed, opts) {
  const r = rng(seed);
  const o = opts || {};
  const hotX = Math.round(w * (o.hotX !== undefined ? o.hotX : 0.24));
  const hotY = Math.round(h * (o.hotY !== undefined ? o.hotY : 0.18));

  const rules = Array.from({ length: 4 }, (_, i) => {
    const x = Math.round(w * (0.1 + i * 0.24 + r() * 0.06));
    return (
      `    <line x1="${x}" y1="${-h}" x2="${x + Math.round(h * 1.6)}" y2="${h * 2}" ` +
      `stroke="${INK[200]}" stroke-width="1.5" opacity="${(0.1 + r() * 0.09).toFixed(2)}"/>`
    );
  }).join('\n');

  return svg(
    w,
    h,
    `  <defs>
    <linearGradient id="base" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0" stop-color="${INK[900]}"/>
      <stop offset="0.55" stop-color="${INK[950]}"/>
      <stop offset="1" stop-color="#05080f"/>
    </linearGradient>
    <radialGradient id="hot" cx="${(hotX / w).toFixed(3)}" cy="${(hotY / h).toFixed(3)}" r="0.72">
      <stop offset="0" stop-color="${INK[300]}" stop-opacity="0.92"/>
      <stop offset="0.35" stop-color="${INK[500]}" stop-opacity="0.55"/>
      <stop offset="1" stop-color="${INK[900]}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="cool" cx="0.86" cy="0.88" r="0.6">
      <stop offset="0" stop-color="${INK[600]}" stop-opacity="0.75"/>
      <stop offset="1" stop-color="${INK[900]}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#base)"/>
  <rect width="${w}" height="${h}" fill="url(#cool)"/>
  <rect width="${w}" height="${h}" fill="url(#hot)"/>
  <g>
${rules}
  </g>
  <rect width="${w}" height="${h}" fill="none" stroke="${INK[700]}" stroke-width="2" opacity="0.5"/>`
  );
}

/**
 * A card tile: a bright quadrant arc over ink, with one solid form anchoring it.
 *
 * Two things are deliberate and were both fixed after looking at the first render. The arcs are
 * drawn in the LIGHT end of the ramp at full weight — at the ~300px a card actually shows, a
 * hairline two steps off the background is invisible, so the first version's tile was a dark
 * rectangle with a suggestion in it. And each tile gets a different seed AND a different arc
 * origin, so three of them in a row are three pictures.
 *
 * 🔴 That distinctness is not decoration. `repeated-sibling-subtree` fires on three structurally
 * identical siblings (register V12), and a corpus whose three cards carry the *same* picture
 * teaches the shape the rubric calls a WordPress tell — a grid that reads as one thing repeated.
 */
function arcs(w, h, seed) {
  const r = rng(seed);
  const cx = Math.round((0.1 + r() * 0.5) * w);
  const cy = Math.round((0.75 + r() * 0.5) * h);

  const rings = Array.from({ length: 3 }, (_, i) => {
    const rad = Math.round((0.32 + i * 0.26) * w);
    const stroke = [INK[300], INK[400], INK[500]][i];
    const sw = Math.max(3, Math.round(h * 0.016));
    return `  <circle cx="${cx}" cy="${cy}" r="${rad}" fill="none" stroke="${stroke}" stroke-width="${sw}" opacity="${(
      0.9 -
      i * 0.18
    ).toFixed(2)}"/>`;
  }).join('\n');

  const dot = `  <circle cx="${cx}" cy="${cy}" r="${Math.round(w * 0.11)}" fill="${INK[200]}" opacity="0.9"/>`;
  const bar = `  <rect x="0" y="${Math.round(h * 0.78)}" width="${w}" height="${Math.round(
    h * 0.22
  )}" fill="${INK[900]}" opacity="0.55"/>`;

  return svg(
    w,
    h,
    `  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${INK[800]}"/>
      <stop offset="1" stop-color="#05080f"/>
    </linearGradient>
    <clipPath id="c"><rect width="${w}" height="${h}"/></clipPath>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>
  <g clip-path="url(#c)">
${rings}
${dot}
${bar}
  </g>`
  );
}

/** A square portrait stand-in: a lit ring on ink, for an avatar slot with nobody in it yet. */
function portrait(size, seed) {
  const r = rng(seed);
  const cx = size / 2;
  return svg(
    size,
    size,
    `  <defs>
    <radialGradient id="g" cx="0.5" cy="0.3" r="0.9">
      <stop offset="0" stop-color="${INK[600]}"/>
      <stop offset="1" stop-color="#05080f"/>
    </radialGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#g)"/>
  <circle cx="${cx}" cy="${Math.round(size * 0.37)}" r="${Math.round(size * 0.155)}" fill="${INK[200]}" opacity="${(
      0.85 +
      r() * 0.1
    ).toFixed(2)}"/>
  <path d="M ${Math.round(size * 0.17)} ${size} a ${Math.round(size * 0.33)} ${Math.round(
      size * 0.3
    )} 0 0 1 ${Math.round(size * 0.66)} 0 Z" fill="${INK[300]}" opacity="0.85"/>`
  );
}

const FILES = {
  'ground-aurora.svg': aurora(1600, 900, 17, { hotX: 0.24, hotY: 0.16 }),
  'ground-ridge.svg': aurora(1600, 900, 4321, { hotX: 0.72, hotY: 0.38 }),  // ⚠️ 0.72/0.38 rather than the bottom-right corner it started at: photographed in a
  // 560px-tall hero box with objectFit cover, a low corner light is CROPPED OUT and the image
  // reads as a black rectangle. An asset has to be judged in the box it will be used in.
  'tile-1.svg': arcs(800, 600, 91),
  'tile-2.svg': arcs(800, 600, 2024),
  'tile-3.svg': arcs(800, 600, 55501),
  'portrait.svg': portrait(400, 7)
};

const MANIFEST = {
  name: 'Starter imagery',
  _note:
    'Abstract, hue-neutral placeholder art generated by scripts/library/make-starter-imagery.js, so a new ' +
    'project is never one where "the page has no picture" is the only option. Reference a file as ' +
    'noodl_modules/starter-imagery/<name>.svg from an Image src or a Group backgroundImage. It carries no ' +
    'stylesheet and injects nothing. REPLACE THESE with your own pictures — they are deliberately abstract ' +
    'and colourless so they do not fight whichever palette the project ends up wearing, which is also why ' +
    'they will never look as good as the real thing.'
};

fs.mkdirSync(OUT, { recursive: true });
for (const [name, contents] of Object.entries(FILES)) {
  fs.writeFileSync(path.join(OUT, name), contents);
}
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(MANIFEST, null, 2) + '\n');

const total = Object.entries(FILES).reduce((n, [, c]) => n + Buffer.byteLength(c), 0);
console.log(
  `[starter-imagery] ${Object.keys(FILES).length} files + manifest → ${path.relative(process.cwd(), OUT)} ` +
    `(${total} bytes of SVG)`
);
