#!/usr/bin/env node
/**
 * Build a trivial before/after gallery from one or two capture folders.
 *
 *   node gallery.mjs <afterDir> [beforeDir] [--out gallery.html]
 *
 * With one folder: a dark|light side-by-side grid per surface (the current corpus).
 * With two: before|after columns per surface+theme, for eyeballing a regression.
 * Self-contained static HTML; images referenced by relative path.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const flag = (n, d) => {
  const i = argv.indexOf(n);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
const positionals = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--')));
const afterDir = positionals[0];
const beforeDir = positionals[1] || null;
const outPath = flag('--out', path.join(__dirname, 'gallery.html'));

if (!afterDir || !fs.existsSync(afterDir)) {
  console.error('usage: node gallery.mjs <afterDir> [beforeDir] [--out gallery.html]');
  process.exit(1);
}

function readManifest(dir) {
  const mp = path.join(dir, 'manifest.json');
  if (fs.existsSync(mp)) return JSON.parse(fs.readFileSync(mp, 'utf8')).manifest;
  // fall back to scanning PNGs named surface--theme.png
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.png'))
    .map((f) => {
      const m = f.match(/^(.*)--(dark|light)\.png$/);
      return m ? { surface: m[1], theme: m[2], file: f } : null;
    })
    .filter(Boolean);
}

const rel = (from, to) => path.relative(path.dirname(outPath), path.join(from, to));
const after = readManifest(afterDir);
const before = beforeDir ? readManifest(beforeDir) : null;
const surfaces = [...new Set(after.map((m) => m.surface))].sort();
const themes = ['dark', 'light'];

const cell = (dir, entry) =>
  entry
    ? `<a href="${rel(dir, entry.file)}" target="_blank"><img loading="lazy" src="${rel(dir, entry.file)}" alt="${entry.surface} ${entry.theme}"></a>`
    : `<div class="missing">— not captured —</div>`;

let rows = '';
for (const surface of surfaces) {
  rows += `<h2>${surface}</h2><div class="grid">`;
  for (const theme of themes) {
    const a = after.find((m) => m.surface === surface && m.theme === theme);
    const b = before ? before.find((m) => m.surface === surface && m.theme === theme) : null;
    rows += `<figure><figcaption>${theme}${before ? ' · before' : ''}</figcaption>${before ? cell(beforeDir, b) : cell(afterDir, a)}</figure>`;
    if (before) rows += `<figure><figcaption>${theme} · after</figcaption>${cell(afterDir, a)}</figure>`;
  }
  rows += `</div>`;
}

const html = `<!doctype html><html><head><meta charset="utf-8"><title>UIX-009 corpus gallery</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: -apple-system, system-ui, sans-serif; margin: 0; padding: 24px; background: #12161b; color: #cbd3dc; }
  h1 { font-size: 20px; } h2 { font-size: 15px; margin: 28px 0 8px; color: #4da3ff; border-top: 1px solid #222933; padding-top: 16px; }
  .meta { color: #6b7682; font-size: 13px; margin-bottom: 8px; }
  .grid { display: grid; grid-template-columns: repeat(${before ? 4 : 2}, 1fr); gap: 12px; }
  figure { margin: 0; }
  figcaption { font-size: 12px; color: #8b95a1; margin-bottom: 4px; }
  img { width: 100%; border: 1px solid #222933; border-radius: 6px; display: block; background: #0b0e12; }
  .missing { color: #6b7682; font-size: 12px; padding: 40px; text-align: center; border: 1px dashed #222933; border-radius: 6px; }
</style></head><body>
<h1>UIX-009 — Visual corpus gallery</h1>
<div class="meta">after: ${path.basename(afterDir)}${before ? ` · before: ${path.basename(beforeDir)}` : ''} · ${surfaces.length} surfaces · both themes</div>
${rows}
</body></html>`;

fs.writeFileSync(outPath, html);
console.log(`gallery → ${outPath} (${surfaces.length} surfaces)`);
