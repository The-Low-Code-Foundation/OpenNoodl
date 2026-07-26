/**
 * Hardcoded color ratchet (UIX-002).
 *
 * The design tokens landed in UIX-001 (`packages/noodl-core-ui/src/styles/
 * custom-properties/colors.css`) are the only source of truth for color in
 * the app's chrome. Every hex literal outside that file is a value the
 * light theme (UIX-008) cannot flip and a re-palette cannot reach — debt of
 * exactly the shape PLAT-004 paid down for `TSFixme`: not evenly spread,
 * concentrated in a legacy tail, worth a baseline + ratchet rather than a
 * pass/fail gate that would need to be all-or-nothing on day one.
 *
 * So this is a ratchet, not a gate: per-package counts may fall but never
 * rise. Counting is per PACKAGE (not one combined total) so a drop in one
 * package can never mask a silent rise in the other — the scenario this
 * task was explicitly built to avoid, since UIX-002 and UIX-003 touch
 * noodl-editor and noodl-core-ui in parallel.
 *
 * Counting method: regex over `.css`/`.scss` source text, comments and
 * `url(data:...)` payloads stripped first (a data URI can legitimately
 * contain '#'-prefixed hex-looking runs; a comment is not live CSS). This
 * is the same class of tool as PLAT-004's grep-based precursor, not an AST
 * parser — CSS has no equivalent to the TypeScript compiler API readily
 * available here, and the spec this ratchet implements
 * (dev-docs/tasks/phase-23-visual-refresh/UIX-002-LEGACY-HEX-MOPUP.md)
 * explicitly signs off on "rough grep -cE" as the baselining method. What
 * matters is that the same method counts the baseline and every check
 * against it, so the number is comparable even if not philosophically exact.
 *
 * Permanent exemptions (never counted, listed in `exclude` below):
 *   - Vendored third-party CSS we do not own or edit: Font Awesome.
 *     (`packages/noodl-editor/src/assets/lib/fontawesome/`)
 *
 * Documented in-source exemptions (counted, but explained where they live):
 *   - The Lessons tutorial popup's light cream card + sage-teal accent in
 *     `packages/noodl-editor/src/assets/css/style.css` (search for "UIX-002
 *     EXEMPTION" in that file). It predates the token system; forcing it
 *     onto the dark elevation ladder would invert its intentionally-light
 *     look, which is a visual redesign this task is not chartered to do.
 *   - `--theme-color-*` `colors.css`/`fonts.css`/etc. token *definition*
 *     files are excluded outright (see `exclude`): a token has to be
 *     spelled as a literal somewhere, and counting the definition would
 *     leave a floor the burn-down could never reach — same reasoning as
 *     `tsfixme-ratchet.js` skipping the `type TSFixme = any` declaration.
 *
 *   node scripts/hex-color-ratchet.js             # check against the baseline
 *   node scripts/hex-color-ratchet.js --update    # rewrite the baseline from reality
 *   node scripts/hex-color-ratchet.js --report    # regenerate the clustering report
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const BASELINE_PATH = path.join(ROOT, '.hex-color-baseline.json');
const REPORT_PATH = path.join(ROOT, 'dev-docs/reference/HARDCODED-COLORS.md');

/** Directory names never descended into, anywhere under the roots. */
const SKIP_DIRS = new Set(['node_modules', 'dist', 'out', 'coverage', '.git', '.cache', 'storybook-static']);

const HEX_RE = /#[0-9a-fA-F]{3,8}\b/g;
const COMMENT_RE = /\/\*[\s\S]*?\*\//g;
// TS/JS line comments; the [^:'"`] guard keeps protocol-relative and quoted
// "//" (http://..., strings) from being treated as a comment opener.
const LINE_COMMENT_RE = /(^|[^:'"`])\/\/.*$/gm;
const DATA_URL_RE = /url\(\s*(['"]?)data:[^)]*\1\s*\)/g;

// -- discovery ---------------------------------------------------------------

/** Every file matching `extRe` under `roots` (a root may also be a single file). */
function findSourceFiles(roots, exclude, extRe) {
  const excluded = new Set(exclude);
  const files = [];

  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return; // a root that does not exist in this checkout is not an error
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      const rel = path.relative(ROOT, full).split(path.sep).join('/');
      if (excluded.has(rel)) continue;
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(full);
      } else if (entry.isFile() && extRe.test(entry.name)) {
        files.push(rel);
      }
    }
  }

  for (const root of roots) {
    const full = path.join(ROOT, root);
    let stat;
    try {
      stat = fs.statSync(full);
    } catch {
      continue;
    }
    if (stat.isFile()) {
      const rel = root.split(path.sep).join('/');
      if (!excluded.has(rel) && extRe.test(root)) files.push(rel);
    } else {
      walk(full);
    }
  }
  return files.sort();
}

// -- counting ----------------------------------------------------------------

/** Count hex color literals in one file, after stripping comments and data URIs. */
function countFile(relPath, stripLineComments) {
  const raw = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
  let stripped = raw.replace(COMMENT_RE, '').replace(DATA_URL_RE, 'url()');
  if (stripLineComments) stripped = stripped.replace(LINE_COMMENT_RE, '$1');
  const matches = stripped.match(HEX_RE);
  return matches ? matches.length : 0;
}

/** The workspace package a repo-relative path belongs to (`packages/<name>/...` -> `<name>`). */
function packageOf(relPath) {
  const segments = relPath.split('/');
  return segments[0] === 'packages' ? segments[1] : segments[0];
}

function countAll(baseline) {
  const cssFiles = findSourceFiles(baseline.targets, baseline.exclude, /\.(css|scss)$/);
  // Canvas-paint TS scope (UIX-005): the node-graph painter/renderer files
  // paint colors outside CSS's reach, so the ratchet covers them too, under
  // their own pseudo-package. CanvasTheme.ts is the token/fallback definition
  // site and is excluded for the same reason colors.css is.
  // .ts only: the paint code is plain TS; .tsx under these roots is React DOM
  // overlay chrome (UIX-004/009 territory), same as the CSS scopes cover.
  const tsFiles = findSourceFiles(baseline.tsTargets || [], baseline.tsExclude || [], /\.ts$/);

  const byFile = {};
  const byPackage = {};

  for (const file of cssFiles) {
    const count = countFile(file, false);
    if (count === 0) continue;
    byFile[file] = count;
    const pkg = packageOf(file);
    byPackage[pkg] = (byPackage[pkg] || 0) + count;
  }

  for (const file of tsFiles) {
    const count = countFile(file, true);
    if (count === 0) continue;
    byFile[file] = count;
    byPackage['canvas-paint-ts'] = (byPackage['canvas-paint-ts'] || 0) + count;
  }

  return { scanned: cssFiles.length + tsFiles.length, byFile, byPackage };
}

// -- reporting ---------------------------------------------------------------

function formatTable(rows, headers) {
  const widths = headers.map((header, i) => Math.max(header.length, ...rows.map((row) => String(row[i]).length)));
  const line = (cells) => '| ' + cells.map((cell, i) => String(cell).padEnd(widths[i])).join(' | ') + ' |';
  return [line(headers), '|' + widths.map((w) => '-'.repeat(w + 2)).join('|') + '|', ...rows.map(line)].join('\n');
}

function headCommit() {
  try {
    return require('child_process').execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim();
  } catch {
    return 'unknown';
  }
}

/** Uncommitted `.css`/`.scss` changes, which a recorded baseline would silently include. */
function dirtySources() {
  try {
    return require('child_process')
      .execSync('git status --porcelain -- "*.css" "*.scss"', { cwd: ROOT })
      .toString()
      .trim()
      .split('\n')
      .filter(Boolean).length;
  } catch {
    return 0;
  }
}

function writeReport(result, commit) {
  const files = Object.entries(result.byFile).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const packages = Object.entries(result.byPackage).sort((a, b) => b[1] - a[1]);

  const lines = [
    '# Hardcoded colors — clustering report',
    '',
    '<!-- Generated by `npm run colors:report`. Do not edit by hand. -->',
    '',
    `Snapshot of \`${commit}\`. ${result.scanned} \`.css\`/\`.scss\` files scanned; ${files.length} carry at least one literal hex color.`,
    '',
    'This is a snapshot, not a live number — regenerate it before relying on it.',
    'The gate is [`.hex-color-baseline.json`](../../.hex-color-baseline.json); this file is for targeting.',
    '',
    '## By package',
    '',
    formatTable(packages, ['Package', 'Count']),
    '',
    '## Every file with a remaining literal',
    '',
    formatTable(
      files.map(([file, count]) => [`\`${file}\``, count]),
      ['File', 'Count']
    ),
    ''
  ];

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, lines.join('\n'));
  console.log(`Report written to ${path.relative(ROOT, REPORT_PATH)}`);
}

// -- main ----------------------------------------------------------------

function main() {
  const update = process.argv.includes('--update');
  const report = process.argv.includes('--report');
  const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));

  const result = countAll(baseline);
  const packages = Array.from(new Set([...Object.keys(baseline.max), ...Object.keys(result.byPackage)])).sort();

  console.log(`Scanned ${result.scanned} files (.css/.scss under ${baseline.targets.join(', ')}; canvas-paint .ts)\n`);
  const rows = packages.map((pkg) => {
    const count = result.byPackage[pkg] || 0;
    const max = baseline.max[pkg] ?? 0;
    const delta = count - max;
    return [pkg, count, max, delta > 0 ? `+${delta}` : delta < 0 ? String(delta) : '='];
  });
  console.log(formatTable(rows, ['Package', 'Count', 'Baseline', 'Delta']));
  console.log('');

  if (report) writeReport(result, headCommit());

  if (update) {
    const dirty = dirtySources();
    if (dirty > 0) {
      console.warn(`! ${dirty} uncommitted .css/.scss file(s) — their colors are being written into`);
      console.warn(`  the baseline as if they were part of ${headCommit()}. Commit first if that is wrong.\n`);
    }

    const next = {
      ...baseline,
      commit: headCommit(),
      max: result.byPackage,
      byFile: result.byFile
    };
    fs.writeFileSync(BASELINE_PATH, JSON.stringify(next, null, 2) + '\n');
    console.log(`Baseline updated to ${Object.values(result.byPackage).reduce((a, b) => a + b, 0)} total.`);
    return 0;
  }

  const risen = packages.filter((pkg) => (result.byPackage[pkg] || 0) > (baseline.max[pkg] ?? 0));
  if (risen.length) {
    console.error(
      `✗ ${risen.map((p) => `${p} rose by ${(result.byPackage[p] || 0) - (baseline.max[p] ?? 0)}`).join(', ')}.`
    );
    console.error('  These counts may go down, never up.\n');

    const worse = Object.entries(result.byFile)
      .map(([file, count]) => [file, count - (baseline.byFile[file] || 0)])
      .filter(([, delta]) => delta > 0)
      .sort((a, b) => b[1] - a[1]);

    if (worse.length) {
      console.error('Files that grew since the baseline:');
      for (const [file, delta] of worse.slice(0, 20)) console.error(`  +${delta}\t${file}`);
      console.error('');
    }

    console.error('Map the new literal(s) to a --theme-color-*/--base-color-* token (see');
    console.error('dev-docs/guidelines/DESIGN-TOKENS.md and the mapping rules in');
    console.error('dev-docs/tasks/phase-23-visual-refresh/UIX-002-LEGACY-HEX-MOPUP.md). If a value');
    console.error('genuinely cannot be tokenized yet, document why at the call site, run');
    console.error('`npm run colors:baseline`, and commit the raised baseline so a reviewer sees');
    console.error('the decision. Raising it silently is the one thing this gate exists to stop.\n');
    return 1;
  }

  const fallenTotal = packages.reduce((acc, pkg) => acc + Math.max(0, (baseline.max[pkg] ?? 0) - (result.byPackage[pkg] || 0)), 0);
  if (fallenTotal > 0) {
    console.log(`✓ ${fallenTotal} fewer literal(s) than the baseline. Lower it with \`npm run colors:baseline\`.\n`);
  } else {
    console.log('✓ Holding the line.\n');
  }
  return 0;
}

try {
  process.exit(main());
} catch (err) {
  console.error(err);
  process.exit(1);
}
