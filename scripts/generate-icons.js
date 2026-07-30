#!/usr/bin/env node
/**
 * Regenerate every app-icon raster from the one SVG master.
 *
 * The master is packages/noodl-editor/build/icon.svg. Everything else is derived,
 * so editing a PNG by hand is always wrong — run this instead. Without it the
 * rasters drift from the master silently, and nothing in CI would notice.
 *
 * Where each output is consumed:
 *   build/icon.png  1024  electron-builder generates the mac .icns and the Windows
 *                         .ico from this (mac.icon / win.icon are unset, so it
 *                         falls back to the buildResources dir, which is build/).
 *                         Needs >=512 for mac and >=256 for Windows.
 *   src/assets/images/icon.png  512  three consumers: electron-builder's
 *                         linux.icon (AppImage + deb, needs >=512), the
 *                         BrowserWindow icon on Windows/Linux, and the About
 *                         window (main.js icon_path).
 *   src/assets/images/icon128.png  128  currently referenced by nothing.
 *   src/assets/images/icon48.png    48  currently referenced by nothing.
 *
 * The last two are kept in step rather than deleted, so that if something starts
 * using them it does not pick up a stale mark. Delete them if they stay unused.
 *
 * Usage: npm run icons  [--check]
 *   --check regenerates into a temp dir and fails if any committed raster differs,
 *   which is what a CI gate would call.
 */
const { execFileSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const EDITOR = path.join(REPO, 'packages', 'noodl-editor');
const MASTER = path.join(EDITOR, 'build', 'icon.svg');

const TARGETS = [
  { size: 1024, out: path.join(EDITOR, 'build', 'icon.png') },
  { size: 512, out: path.join(EDITOR, 'src', 'assets', 'images', 'icon.png') },
  { size: 128, out: path.join(EDITOR, 'src', 'assets', 'images', 'icon128.png') },
  { size: 48, out: path.join(EDITOR, 'src', 'assets', 'images', 'icon48.png') }
];

const check = process.argv.includes('--check');

function haveRsvg() {
  try {
    execFileSync('rsvg-convert', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

if (!fs.existsSync(MASTER)) {
  console.error(`Icon master missing: ${path.relative(REPO, MASTER)}`);
  process.exit(1);
}

if (!haveRsvg()) {
  console.error('rsvg-convert not found. Install it with:  brew install librsvg');
  process.exit(1);
}

const sha = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 12);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-icons-'));
let drifted = 0;

for (const { size, out } of TARGETS) {
  const dest = check ? path.join(tmp, path.basename(out)) : out;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  execFileSync('rsvg-convert', ['-w', String(size), '-h', String(size), MASTER, '-o', dest]);

  const rel = path.relative(REPO, out);
  if (!check) {
    console.log(`  ${String(size).padStart(4)}px  ${rel}`);
    continue;
  }

  // rsvg-convert is deterministic for a given input, so a hash mismatch means the
  // committed raster was not generated from the current master.
  if (!fs.existsSync(out) || sha(out) !== sha(dest)) {
    console.error(`  DRIFT  ${rel} does not match the SVG master`);
    drifted++;
  } else {
    console.log(`  ok     ${rel}`);
  }
}

fs.rmSync(tmp, { recursive: true, force: true });

if (check && drifted) {
  console.error(`\n${drifted} raster(s) out of date. Run:  npm run icons`);
  process.exit(1);
}

console.log(check ? '\n✓ All rasters match the master.' : '\n✓ Regenerated from build/icon.svg');
