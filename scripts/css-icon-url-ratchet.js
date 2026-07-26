/**
 * CSS-background icon gate (UIX-011).
 *
 * An SVG pulled into CSS with `background-image: url(x.svg)`, `content:
 * url(x.svg)` or `-webkit-mask: url(x.svg)` is fetched and rendered as an
 * *independent document*. It inherits nothing from the referencing element, so
 * `currentColor` inside it resolves against its own root — i.e. black — and the
 * glyph is frozen at whatever colour it was authored with. That is invisible
 * while the app ships one theme and becomes a bug the moment it ships two,
 * which is exactly what UIX-008 did.
 *
 * UIX-011 retired all 50 such references. Every chrome icon now goes through
 * `@noodl-core-ui/components/common/Icon`, which inlines the SVG into the DOM
 * so `currentColor` picks up the ambient token.
 *
 * Unlike `hex-color-ratchet.js` this is a **gate at zero, not a ratchet**.
 * A ratchet is the right tool when there is a legacy tail to burn down
 * gradually; there is no tail left here, so any reintroduction is a straight
 * regression and should fail rather than quietly raise a number.
 *
 * Counting method: regex over `.css`/`.scss` source text with comments
 * stripped first (a comment is not live CSS — this file's own prose would
 * otherwise trip it). `url(data:...)` payloads are ignored: an inline data URI
 * is not a separate document fetch and can be authored with `currentColor`.
 *
 * Permanent exemptions (listed in EXCLUDE below):
 *   - Vendored Font Awesome CSS. Those are *font* loads, not icons, and we do
 *     not own the files. Font Awesome's own retirement is a separate question.
 *   - `frames/viewer-frame/assets/style.css` — the runtime viewer frame, not
 *     editor chrome. Out of UIX-011's scope by spec.
 *
 *   node scripts/css-icon-url-ratchet.js          # check (exit 1 on any hit)
 *   node scripts/css-icon-url-ratchet.js --list   # list every scanned file
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const TARGETS = ['packages/noodl-editor/src', 'packages/noodl-core-ui/src'];

const EXCLUDE = [
  'packages/noodl-editor/src/assets/lib/fontawesome/css/font-awesome.css',
  'packages/noodl-editor/src/assets/lib/fontawesome/css/font-awesome.min.css',
  'packages/noodl-editor/src/frames/viewer-frame/assets/style.css'
];

const SKIP_DIRS = new Set(['node_modules', 'dist', 'out', 'coverage', '.git', '.cache', 'storybook-static']);

const BLOCK_COMMENT_RE = /\/\*[\s\S]*?\*\//g;
const LINE_COMMENT_RE = /(^|[^:'"`])\/\/.*$/gm;
const DATA_URL_RE = /url\(\s*(['"]?)data:[^)]*\1\s*\)/g;
/** `url(...)` whose target ends in `.svg`, quoted or not, with or without a query/fragment. */
const SVG_URL_RE = /url\(\s*(['"]?)([^)'"]*\.svg)(?:[?#][^)'"]*)?\1\s*\)/gi;

function findStyleSheets() {
  const excluded = new Set(EXCLUDE);
  const files = [];

  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      const rel = path.relative(ROOT, full).split(path.sep).join('/');
      if (excluded.has(rel)) continue;
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(full);
      } else if (entry.isFile() && /\.(css|scss)$/.test(entry.name)) {
        files.push(rel);
      }
    }
  }

  for (const target of TARGETS) walk(path.join(ROOT, target));
  return files.sort();
}

/** Every `url(*.svg)` in one stylesheet, as `{ line, ref }`, comments and data URIs ignored. */
function findRefs(relPath) {
  const raw = fs.readFileSync(path.join(ROOT, relPath), 'utf8');

  // Blank out comments and data URIs while preserving newlines, so the line
  // numbers reported below still match the file on disk.
  const blank = (match) => match.replace(/[^\n]/g, ' ');
  const stripped = raw
    .replace(BLOCK_COMMENT_RE, blank)
    .replace(LINE_COMMENT_RE, (m, p1) => p1 + blank(m.slice(p1.length)))
    .replace(DATA_URL_RE, blank);

  const hits = [];
  for (const match of stripped.matchAll(SVG_URL_RE)) {
    const line = stripped.slice(0, match.index).split('\n').length;
    hits.push({ line, ref: match[2] });
  }
  return hits;
}

function main() {
  const list = process.argv.includes('--list');
  const files = findStyleSheets();

  const offenders = [];
  for (const file of files) {
    for (const hit of findRefs(file)) offenders.push({ file, ...hit });
  }

  if (list) for (const file of files) console.log(file);

  console.log(`Scanned ${files.length} .css/.scss files under ${TARGETS.join(', ')}\n`);

  if (offenders.length === 0) {
    console.log('✓ 0 url()-to-SVG references. Icons render through the Icon component.\n');
    return 0;
  }

  console.error(`✗ ${offenders.length} url()-to-SVG reference(s) in editor stylesheets:\n`);
  for (const { file, line, ref } of offenders) console.error(`  ${file}:${line}\t${ref}`);
  console.error('');
  console.error('An SVG referenced from CSS renders as its own document and cannot inherit');
  console.error('the theme colour — it will be frozen at its authored colour and will not');
  console.error('follow the light theme. Render it through the Icon component instead:');
  console.error('');
  console.error("  import { Icon, IconName } from '@noodl-core-ui/components/common/Icon';");
  console.error('  <Icon icon={IconName.Foo} />');
  console.error('');
  console.error('Add the glyph to packages/noodl-core-ui/src/assets/icons/icon-component/');
  console.error('(currentColor, 16x16, per dev-docs/guidelines/ICONOGRAPHY.md) and give it an');
  console.error('IconName entry. If the glyph genuinely cannot go through the DOM — canvas');
  console.error('painting is the one known case — it does not belong in a stylesheet either.');
  console.error('');
  return 1;
}

try {
  process.exit(main());
} catch (err) {
  console.error(err);
  process.exit(1);
}
