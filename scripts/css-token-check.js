/**
 * Undefined custom-property gate (POL-004).
 *
 * `var(--theme-color-fg-subtle, #7c7c7c)` *reads* as theming and is not. CSS has
 * no undefined-custom-property error, so the declaration renders, the fallback
 * paints, review passes, and the result is the same grey in both themes. It is
 * the most reviewable way to ship a hardcoded colour.
 *
 * So: every `var(--…)` in the editor's and core-ui's stylesheets must name a
 * property that is DEFINED somewhere — either in
 * `packages/noodl-core-ui/src/styles/custom-properties/`, or as a `--x: …`
 * declaration in any stylesheet in the scanned packages (component-local
 * properties are legitimate), or in the host-supplied allow-list below.
 *
 * A gate at zero, not a ratchet. Unlike the hex-colour tail UIX-002 burned down,
 * there is no legacy population here worth preserving: a name that is never
 * defined is a typo or a token someone assumed existed, and both are bugs.
 *
 *   node scripts/css-token-check.js            # fail on any undefined name
 *   node scripts/css-token-check.js --report   # list every name and its status
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

/** Stylesheets in these packages are checked. */
const SCAN = ['packages/noodl-editor/src', 'packages/noodl-core-ui/src'];

/** Where the shared design tokens are declared. */
const TOKEN_DIRS = ['packages/noodl-core-ui/src/styles'];

/**
 * Properties that are deliberately supplied by a HOST at runtime rather than
 * declared in a stylesheet, and are therefore correctly read with a fallback.
 * This list must stay short, and every entry must say who sets it.
 *
 * The distinction that matters: these are *parameters*, not tokens. The
 * fallback is the documented default, not insurance against a typo.
 */
const HOST_SUPPLIED = new Set([
  // Set on context by `SideNavigation.module.scss` (`.Toolbar`) so the rail can
  // tune its idle glyph tone; read by `IconButton.module.scss`, which falls back
  // to `--theme-color-fg-default` for every other host.
  '--icon-button-idle-fg'
]);

/** Build artefacts and vendored CSS we do not own. */
const EXCLUDE = [
  'index.bundle.js',
  'main.bundle.js',
  '/assets/lib/fontawesome/',
  '/node_modules/',
  '/dist/'
];

function walk(dir, pattern, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (EXCLUDE.some((x) => full.includes(x))) continue;
    if (e.isDirectory()) walk(full, pattern, out);
    else if (pattern.test(e.name)) out.push(full);
  }
  return out;
}

/** Strip comments so a commented-out `var()` is not a finding. */
function decomment(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const defined = new Set();
const used = new Map(); // name -> Set(relative file)

const STYLES = /\.(css|scss)$/;
const SCRIPTS = /\.(ts|tsx|js|jsx)$/;

const tokenFiles = TOKEN_DIRS.flatMap((d) => walk(path.join(ROOT, d), STYLES));
const scanFiles = SCAN.flatMap((d) => walk(path.join(ROOT, d), STYLES));
const scriptFiles = SCAN.flatMap((d) => walk(path.join(ROOT, d), SCRIPTS));

// A property is "defined" if anything, anywhere in the scanned packages or the
// token dirs, declares it. Component-local properties are legitimate.
for (const file of new Set([...tokenFiles, ...scanFiles])) {
  const src = decomment(fs.readFileSync(file, 'utf8'));
  for (const m of src.matchAll(/(^|[\s;{])(--[A-Za-z0-9_-]+)\s*:/g)) defined.add(m[2]);
}

// …and equally if a component sets it at runtime. A React `style={{'--offsetX':
// x}}` or a `setProperty('--level', n)` is a real definition — the property is a
// PARAMETER the component passes to its own stylesheet, which is a legitimate
// pattern and the reason this check reads the TSX rather than carrying a
// hand-maintained allow-list that would rot the first time someone renames one.
for (const file of scriptFiles) {
  const src = fs.readFileSync(file, 'utf8');
  for (const m of src.matchAll(/['"`](--[A-Za-z0-9_-]+)['"`]\s*[:,)]/g)) defined.add(m[1]);
  for (const m of src.matchAll(/setProperty\(\s*['"`](--[A-Za-z0-9_-]+)['"`]/g)) defined.add(m[1]);
}

for (const file of scanFiles) {
  const src = decomment(fs.readFileSync(file, 'utf8'));
  for (const m of src.matchAll(/var\(\s*(--[A-Za-z0-9_-]+)/g)) {
    if (!used.has(m[1])) used.set(m[1], new Set());
    used.get(m[1]).add(path.relative(ROOT, file));
  }
}

const undefinedNames = [...used.keys()]
  .filter((n) => !defined.has(n) && !HOST_SUPPLIED.has(n))
  .sort((a, b) => used.get(b).size - used.get(a).size || a.localeCompare(b));

if (process.argv.includes('--report')) {
  console.log(`Scanned ${scanFiles.length} stylesheets; ${defined.size} properties defined.\n`);
  for (const [name, files] of [...used.entries()].sort()) {
    const status = defined.has(name) ? 'ok  ' : HOST_SUPPLIED.has(name) ? 'host' : 'MISS';
    console.log(`${status}  ${name.padEnd(42)} ${files.size} file(s)`);
  }
  process.exit(0);
}

if (undefinedNames.length === 0) {
  console.log(`✓ css-token-check: every var(--…) in ${scanFiles.length} stylesheets names a defined property.`);
  process.exit(0);
}

console.error(`✗ css-token-check: ${undefinedNames.length} custom propert${
  undefinedNames.length === 1 ? 'y is' : 'ies are'
} used but never defined.\n`);
console.error('  A var() naming nothing renders its fallback silently — it looks like a token');
console.error('  and behaves like a hardcoded value that no theme can reach.\n');
for (const name of undefinedNames) {
  const files = [...used.get(name)].sort();
  console.error(`  ${name}  (${files.length} file${files.length === 1 ? '' : 's'})`);
  for (const f of files.slice(0, 8)) console.error(`      ${f}`);
  if (files.length > 8) console.error(`      … and ${files.length - 8} more`);
}
console.error('\n  Fix by defining the property in packages/noodl-core-ui/src/styles/custom-properties/,');
console.error('  or by using the token that was actually meant. Add to HOST_SUPPLIED in this');
console.error('  script ONLY if a host genuinely sets it at runtime — and say which host.');
process.exit(1);
