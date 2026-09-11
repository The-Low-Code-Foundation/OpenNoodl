#!/usr/bin/env node
/*
 * POL-006 — generate the Lucide icon set that every new project starts with.
 *
 * Source of truth is the library module (`library/modules/lucide-icons/`), which carries the full
 * 1998-glyph ISC webfont imported 2026-07-25. This writes the *starter* copy into
 * `packages/noodl-editor/src/assets/starter-project/`, from where `starterAssets.ts` copies it into
 * each new project.
 *
 * ## What differs from the library module, and why
 *
 * **The stylesheet is the whole set; the manifest's `icons` list is curated.** That split is the
 * answer to Richard's second ask — *"make sure a user can expand the number easily, adding their own
 * icons to the project from the Lucide library"*. The picker shows `manifest.icons`; the renderer
 * needs a CSS rule for whichever class it is handed. Ship all 1998 rules (89KB, next to a 274KB
 * font) and adding a glyph is one line in `manifest.json` and nothing else — no regeneration, no
 * new asset, no network. A trimmed stylesheet would have saved 80KB and made that story false.
 *
 * **woff2 only.** The library module also ships `lucide.ttf` (844KB) for a breadth of browser
 * support no NodeGX target needs. Dropping it takes the starter set from 1.1MB to 274KB, and the
 * `src:` list is rewritten to match — a stylesheet referencing a font file that is not there is a
 * 404 in every app anyone builds.
 *
 * ## The curated list
 *
 * `CURATED` below is the selection, grouped by what a person is looking for rather than
 * alphabetically. The criteria, in order:
 *
 *   1. Every glyph an app's *chrome* needs — navigation, state, the CRUD verbs, media transport.
 *   2. The concrete nouns that recur in the app types NodeGX is for: commerce, messaging, files,
 *      accounts, calendars, dashboards.
 *   3. Nothing whose meaning depends on brand recognition, and nothing so specific it will be
 *      wrong more often than right.
 *
 * Names are validated against the library manifest, so a typo fails the build rather than shipping
 * a glyph that renders as a blank box.
 *
 * Usage:  node scripts/library/make-starter-iconset.js [--check]
 *
 * `--check` verifies the committed output matches what this would generate, and writes nothing.
 * That is what a gate should run; there is no point committing a generated file nobody re-derives.
 */
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '../..');
const SOURCE_DIR = path.join(REPO_ROOT, 'library/modules/lucide-icons/project/noodl_modules/lucide-icons');
const TARGET_DIR = path.join(REPO_ROOT, 'packages/noodl-editor/src/assets/starter-project/noodl_modules/lucide-icons');

/**
 * The starter set. Grouped for the reader; flattened and sorted on the way out so the generated
 * manifest has a stable order regardless of how this list is edited.
 *
 * This list is the ONLY place a glyph is added. Editing the generated manifest instead leaves
 * `--check` red and the next regenerate DELETES the glyph again — which is how icon-inbox,
 * icon-recycle and icon-sprout (VIB-007, 03c327c84) came to sit in the shipped manifest and not
 * here, and why the gate had been red ever since.
 */
const CURATED = {
  navigation: [
    'icon-arrow-left', 'icon-arrow-right', 'icon-arrow-up', 'icon-arrow-down',
    'icon-chevron-left', 'icon-chevron-right', 'icon-chevron-up', 'icon-chevron-down',
    'icon-chevrons-left', 'icon-chevrons-right', 'icon-menu', 'icon-more-horizontal',
    'icon-more-vertical', 'icon-external-link', 'icon-link', 'icon-home', 'icon-compass',
    'icon-map', 'icon-map-pin', 'icon-navigation', 'icon-corner-down-right', 'icon-move'
  ],
  actions: [
    'icon-plus', 'icon-minus', 'icon-x', 'icon-check', 'icon-search', 'icon-filter',
    'icon-pencil', 'icon-trash-2', 'icon-copy', 'icon-clipboard', 'icon-save', 'icon-share-2',
    'icon-download', 'icon-upload', 'icon-refresh-cw', 'icon-rotate-ccw', 'icon-undo-2',
    'icon-redo-2', 'icon-settings', 'icon-sliders-horizontal', 'icon-log-in', 'icon-log-out',
    'icon-send', 'icon-scissors', 'icon-maximize-2', 'icon-minimize-2', 'icon-zoom-in',
    'icon-zoom-out', 'icon-printer', 'icon-power'
  ],
  state: [
    'icon-info', 'icon-alert-circle', 'icon-alert-triangle', 'icon-check-circle-2',
    'icon-x-circle', 'icon-help-circle', 'icon-loader-2', 'icon-eye', 'icon-eye-off',
    'icon-lock', 'icon-unlock', 'icon-shield', 'icon-shield-check', 'icon-bell', 'icon-bell-off',
    'icon-star', 'icon-heart', 'icon-bookmark', 'icon-flag', 'icon-thumbs-up', 'icon-thumbs-down',
    'icon-ban', 'icon-circle', 'icon-circle-dot', 'icon-square', 'icon-square-check'
  ],
  content: [
    'icon-file', 'icon-file-text', 'icon-files', 'icon-folder', 'icon-folder-open',
    'icon-image', 'icon-video', 'icon-music', 'icon-mic', 'icon-camera', 'icon-paperclip',
    'icon-book-open', 'icon-newspaper', 'icon-list', 'icon-list-checks', 'icon-layout-grid',
    'icon-layout-list', 'icon-table', 'icon-columns-2', 'icon-rows-2', 'icon-align-left',
    'icon-align-center', 'icon-align-right', 'icon-bold', 'icon-italic', 'icon-underline',
    'icon-type', 'icon-quote', 'icon-code', 'icon-terminal', 'icon-hash'
  ],
  people: [
    'icon-user', 'icon-users', 'icon-user-plus', 'icon-user-check', 'icon-user-x',
    'icon-user-circle-2', 'icon-contact', 'icon-at-sign', 'icon-mail', 'icon-mail-open',
    'icon-message-circle', 'icon-message-square', 'icon-phone', 'icon-phone-call', 'icon-video-off',
    'icon-inbox'
  ],
  commerce: [
    'icon-shopping-cart', 'icon-shopping-bag', 'icon-credit-card', 'icon-wallet', 'icon-receipt',
    'icon-tag', 'icon-tags', 'icon-package', 'icon-truck', 'icon-store', 'icon-gift',
    'icon-percent', 'icon-dollar-sign', 'icon-euro', 'icon-banknote'
  ],
  data: [
    'icon-database', 'icon-server', 'icon-cloud', 'icon-cloud-off', 'icon-cloud-upload',
    'icon-cloud-download', 'icon-bar-chart-3', 'icon-line-chart', 'icon-pie-chart',
    'icon-trending-up', 'icon-trending-down', 'icon-activity', 'icon-gauge', 'icon-hard-drive',
    'icon-wifi', 'icon-wifi-off', 'icon-globe', 'icon-rss'
  ],
  time: [
    'icon-calendar', 'icon-calendar-days', 'icon-calendar-check', 'icon-calendar-plus',
    'icon-clock', 'icon-timer', 'icon-hourglass', 'icon-history', 'icon-alarm-clock'
  ],
  media: [
    'icon-play', 'icon-pause', 'icon-square-play', 'icon-skip-back', 'icon-skip-forward',
    'icon-rewind', 'icon-fast-forward', 'icon-repeat', 'icon-shuffle', 'icon-volume-2',
    'icon-volume-x', 'icon-headphones'
  ],
  devices: [
    'icon-monitor', 'icon-smartphone', 'icon-tablet', 'icon-laptop', 'icon-keyboard',
    'icon-mouse-pointer-2', 'icon-printer-check', 'icon-usb', 'icon-battery', 'icon-plug'
  ],
  misc: [
    'icon-sun', 'icon-moon', 'icon-cloud-sun', 'icon-palette', 'icon-brush', 'icon-sparkles',
    'icon-zap', 'icon-flame', 'icon-lightbulb', 'icon-key', 'icon-wrench', 'icon-hammer',
    'icon-puzzle', 'icon-rocket', 'icon-award', 'icon-trophy', 'icon-target', 'icon-leaf',
    'icon-coffee', 'icon-smile', 'icon-frown', 'icon-thermometer', 'icon-scale', 'icon-anchor',
    'icon-recycle', 'icon-sprout'
  ]
};

function build() {
  const sourceManifest = JSON.parse(fs.readFileSync(path.join(SOURCE_DIR, 'manifest.json'), 'utf8'));
  const available = new Set(sourceManifest.icons);

  const chosen = [];
  const missing = [];
  for (const [group, names] of Object.entries(CURATED)) {
    for (const name of names) {
      if (!available.has(name)) missing.push(`${group}: ${name}`);
      else if (!chosen.includes(name)) chosen.push(name);
    }
  }

  if (missing.length > 0) {
    // Loud, and fatal. A curated name that is not in the font renders as a blank box in the picker
    // and in the app, and nothing downstream would ever tell anyone.
    throw new Error(
      `${missing.length} curated icon${missing.length === 1 ? '' : 's'} not in the Lucide font:\n  ` +
        missing.join('\n  ')
    );
  }

  chosen.sort();

  const manifest = {
    name: 'Lucide',
    type: 'iconset',
    browser: { stylesheets: ['noodl_modules/lucide-icons/styles.css'] },
    iconClass: 'lucide',
    codeAsClass: true,
    // Read by nothing in the app — it is here for the person who opens this file looking for the
    // answer to "how do I add one?", which is the question this whole split exists to answer.
    _note:
      'This is a curated starter set. The bundled font contains all ' +
      sourceManifest.icons.length +
      ' Lucide glyphs and styles.css has a rule for every one of them, so any name from ' +
      'https://lucide.dev/icons can be added to the "icons" list below and it will work — no new ' +
      'files, no download. The name is the icon\'s Lucide name prefixed with "icon-".',
    icons: chosen
  };

  // The library stylesheet lists woff2 then ttf; the starter set ships only woff2, so the ttf `src`
  // has to go or every app requests a file that is not there.
  const styles = fs
    .readFileSync(path.join(SOURCE_DIR, 'styles.css'), 'utf8')
    .replace(/,\s*url\(\.\/lucide\.ttf\) format\("truetype"\)/, '');

  if (styles.includes('lucide.ttf')) throw new Error('failed to strip the ttf src from styles.css');

  return { manifest: JSON.stringify(manifest, null, 2) + '\n', styles, count: chosen.length };
}

function main() {
  const check = process.argv.includes('--check');
  const built = build();

  const files = {
    'manifest.json': built.manifest,
    'styles.css': built.styles
  };

  if (check) {
    const differences = [];
    for (const [name, contents] of Object.entries(files)) {
      const target = path.join(TARGET_DIR, name);
      if (!fs.existsSync(target)) differences.push(`${name}: missing`);
      else if (fs.readFileSync(target, 'utf8') !== contents) differences.push(`${name}: out of date`);
    }
    if (!fs.existsSync(path.join(TARGET_DIR, 'lucide.woff2'))) differences.push('lucide.woff2: missing');

    if (differences.length > 0) {
      console.error('✗ starter-iconset: ' + differences.join(', '));
      console.error('  run: node scripts/library/make-starter-iconset.js');
      process.exit(1);
    }
    console.log(`✓ starter-iconset: ${built.count} curated glyphs, generated output is up to date.`);
    return;
  }

  fs.mkdirSync(TARGET_DIR, { recursive: true });
  for (const [name, contents] of Object.entries(files)) {
    fs.writeFileSync(path.join(TARGET_DIR, name), contents);
  }
  fs.copyFileSync(path.join(SOURCE_DIR, 'lucide.woff2'), path.join(TARGET_DIR, 'lucide.woff2'));
  console.log(`wrote ${built.count} curated glyphs to ${path.relative(REPO_ROOT, TARGET_DIR)}`);
}

main();
