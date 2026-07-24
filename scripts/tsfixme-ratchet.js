/**
 * Type escape-hatch ratchet (PLAT-004).
 *
 * `TSFixme` is the project's alias for `any`, declared in the global types and
 * documented as "TO BE REMOVED". It is not randomly distributed: it clusters at
 * the seams where typed editor code calls into untyped runtime, viewer or
 * legacy view code. Attacking the markers directly is mostly wasted effort —
 * a marker at a runtime call site cannot be replaced with a real type until the
 * runtime *has* real types (PLAT-003), and markers in views that PLAT-002 will
 * delete outright are worth nothing.
 *
 * So this is a ratchet, not a gate: the counts may fall but never rise. The
 * durable part is the mechanism. Without it every future contributor — and
 * every AI agent working under time pressure — reaches for `TSFixme` to make an
 * error go away, and the count drifts back up regardless of cleanup work done.
 *
 * All four escape hatches are counted separately, so the ratchet cannot be
 * satisfied by trading one for another: swapping `TSFixme` for a bare `any` or
 * silencing the error with `@ts-ignore` fails just the same.
 *
 * Counting is done with the TypeScript parser rather than grep. Grep cannot
 * tell `any` the keyword from `any` in a comment, a string, or the middle of
 * "company", and it miscounts JSX and regex literals. The parser is exact, and
 * exactness is what makes the number hard to argue with.
 *
 *   node scripts/tsfixme-ratchet.js             # check against the baseline
 *   node scripts/tsfixme-ratchet.js --update    # rewrite the baseline from reality
 *   node scripts/tsfixme-ratchet.js --report    # regenerate the clustering report
 */
const fs = require('fs');
const path = require('path');

const ts = require('typescript');

const ROOT = path.join(__dirname, '..');
const BASELINE_PATH = path.join(ROOT, '.tsfixme-baseline.json');
const REPORT_PATH = path.join(ROOT, 'dev-docs/reference/TYPE-ESCAPE-HATCHES.md');

/**
 * Directory names never descended into, anywhere under the roots.
 *
 * Deliberately short. Names like `build` and `lib` are *not* here: the editor
 * has real sources in `utils/compilation/build`, and skipping by name would
 * have hidden them silently — an exclusion that quietly shrinks the denominator
 * is worse than no exclusion. Anything else is excluded by explicit path in the
 * baseline's `exclude` list, where a reviewer can see it.
 */
const SKIP_DIRS = new Set(['node_modules', 'dist', 'out', 'coverage', '.git', '.cache', 'storybook-static']);

/** The kinds we count, in report order. */
const KINDS = ['TSFixme', 'any', '@ts-ignore', '@ts-nocheck', '@ts-expect-error'];

// -- discovery ---------------------------------------------------------------

/** Every .ts/.tsx file under `roots`, sorted, repo-relative, POSIX separators. */
function findSourceFiles(roots, exclude = []) {
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
      } else if (entry.isFile() && /\.tsx?$/.test(entry.name)) {
        files.push(rel);
      }
    }
  }

  for (const root of roots) walk(path.join(ROOT, root));
  return files.sort();
}

// -- counting ----------------------------------------------------------------

/**
 * Count escape hatches in one file.
 *
 * The `type TSFixme = any` declaration itself is skipped whole — the alias has
 * to be spelled somewhere, and counting its own definition would leave a floor
 * the burn-down could never reach.
 */
function countFile(relPath) {
  const text = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
  // setParentNodes gives us getChildren(), which yields punctuation and keyword
  // tokens as well as nodes — needed below to reach every comment.
  const source = ts.createSourceFile(relPath, text, ts.ScriptTarget.Latest, /* setParentNodes */ true);

  const counts = Object.fromEntries(KINDS.map((kind) => [kind, 0]));
  const countedComments = new Set();

  function visit(node) {
    if (ts.isTypeAliasDeclaration(node) && node.name.text === 'TSFixme') return;

    if (node.kind === ts.SyntaxKind.AnyKeyword) {
      counts.any++;
    } else if (ts.isIdentifier(node) && node.text === 'TSFixme') {
      counts.TSFixme++;
    }

    // Directives live in trivia, not in the tree. Every comment in a file is
    // leading trivia of exactly one token, so walking tokens and reading their
    // comment ranges reaches all of them — including the ones before the
    // closing brace of a block, and the trailing ones before end-of-file.
    //
    // An earlier version scanned raw tokens instead. It silently lost comments
    // in eight files, because a scanner without parser context cannot tell a
    // regex literal from a division, or JSX text from a comparison. Anything
    // that miscounts by construction is not a gate worth having.
    for (const range of ts.getLeadingCommentRanges(text, node.pos) || []) {
      if (countedComments.has(range.pos)) continue;
      countedComments.add(range.pos);
      const comment = text.slice(range.pos, range.end);
      for (const kind of ['@ts-ignore', '@ts-nocheck', '@ts-expect-error']) {
        // Counted once per comment: repeating a directive in one comment does
        // not silence twice, and TypeScript honours only the first.
        if (comment.includes(kind)) counts[kind]++;
      }
    }

    for (const child of node.getChildren(source)) visit(child);
  }

  visit(source);

  return counts;
}

/** Count every file, returning totals, per-file and per-package breakdowns. */
function countAll(roots, exclude) {
  const files = findSourceFiles(roots, exclude);
  const totals = Object.fromEntries(KINDS.map((kind) => [kind, 0]));
  const byFile = {};
  const byPackage = {};

  for (const file of files) {
    const counts = countFile(file);
    const sum = KINDS.reduce((acc, kind) => acc + counts[kind], 0);
    if (sum === 0) continue;

    byFile[file] = counts;
    for (const kind of KINDS) totals[kind] += counts[kind];

    // Group by workspace package, but keep non-package roots (`scripts/`)
    // whole — splitting those on the second segment names a file, not a group.
    const segments = file.split('/');
    const pkg = segments[0] === 'packages' ? segments[1] : segments[0];
    byPackage[pkg] = byPackage[pkg] || Object.fromEntries(KINDS.map((kind) => [kind, 0]));
    for (const kind of KINDS) byPackage[pkg][kind] += counts[kind];
  }

  return { scanned: files.length, totals, byFile, byPackage };
}

// -- reporting ---------------------------------------------------------------

const sumOf = (counts) => KINDS.reduce((acc, kind) => acc + counts[kind], 0);

function formatTable(rows, headers) {
  const widths = headers.map((header, i) => Math.max(header.length, ...rows.map((row) => String(row[i]).length)));
  const line = (cells) => '| ' + cells.map((cell, i) => String(cell).padEnd(widths[i])).join(' | ') + ' |';
  return [line(headers), '|' + widths.map((w) => '-'.repeat(w + 2)).join('|') + '|', ...rows.map(line)].join('\n');
}

/**
 * The clustering report. Its audience is PLAT-002 and PLAT-003: it says which
 * files carry the markers, so the burn-down happens where typing work is
 * already landing rather than in files scheduled for deletion.
 */
function writeReport(result, commit) {
  const packages = Object.entries(result.byPackage).sort((a, b) => sumOf(b[1]) - sumOf(a[1]));
  const files = Object.entries(result.byFile).sort((a, b) => sumOf(b[1]) - sumOf(a[1]) || a[0].localeCompare(b[0]));

  // Directory clustering, two levels below the package's src — deep enough to
  // name a subsystem ("views/panels"), shallow enough to stay readable.
  const byArea = {};
  for (const [file, counts] of files) {
    const area = file.split('/').slice(0, 6).join('/');
    byArea[area] = (byArea[area] || 0) + sumOf(counts);
  }

  const lines = [
    '# Type escape hatches — clustering report',
    '',
    '<!-- Generated by `npm run tsfixme:report`. Do not edit by hand. -->',
    '',
    `Snapshot of \`${commit}\`. ${result.scanned} \`.ts\`/\`.tsx\` files scanned; ${files.length} carry at least one marker.`,
    '',
    'This is a snapshot, not a live number — regenerate it before relying on it.',
    'The gate is [`.tsfixme-baseline.json`](../../.tsfixme-baseline.json); this file is for targeting.',
    '',
    '## Totals',
    '',
    formatTable(
      KINDS.map((kind) => [`\`${kind}\``, result.totals[kind]]),
      ['Marker', 'Count']
    ),
    '',
    '## By package',
    '',
    formatTable(
      packages.map(([pkg, counts]) => [pkg, ...KINDS.map((kind) => counts[kind]), sumOf(counts)]),
      ['Package', ...KINDS, 'Total']
    ),
    '',
    '## Where they cluster',
    '',
    formatTable(
      Object.entries(byArea)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 25)
        .map(([area, count]) => [`\`${area}\``, count]),
      ['Area', 'Markers']
    ),
    '',
    '## Worst 40 files',
    '',
    formatTable(
      files.slice(0, 40).map(([file, counts]) => [`\`${file}\``, ...KINDS.map((kind) => counts[kind]), sumOf(counts)]),
      ['File', ...KINDS, 'Total']
    ),
    ''
  ];

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, lines.join('\n'));
  console.log(`Report written to ${path.relative(ROOT, REPORT_PATH)}`);
}

// -- main --------------------------------------------------------------------

function headCommit() {
  try {
    return require('child_process').execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim();
  } catch {
    return 'unknown';
  }
}

function main() {
  const update = process.argv.includes('--update');
  const report = process.argv.includes('--report');
  const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));

  const result = countAll(baseline.targets, baseline.exclude);

  console.log(`Scanned ${result.scanned} .ts/.tsx files under ${baseline.targets.join(', ')}\n`);
  const rows = KINDS.map((kind) => {
    const count = result.totals[kind];
    const max = baseline.max[kind] ?? 0;
    const delta = count - max;
    return [kind, count, max, delta > 0 ? `+${delta}` : delta < 0 ? String(delta) : '='];
  });
  console.log(formatTable(rows, ['Marker', 'Count', 'Baseline', 'Delta']));
  console.log('');

  if (report) writeReport(result, headCommit());

  if (update) {
    const next = {
      ...baseline,
      commit: headCommit(),
      max: result.totals,
      byPackage: result.byPackage,
      byFile: result.byFile
    };
    fs.writeFileSync(BASELINE_PATH, JSON.stringify(next, null, 2) + '\n');
    console.log(`Baseline updated to ${sumOf(result.totals)} markers.`);
    return 0;
  }

  const risen = KINDS.filter((kind) => result.totals[kind] > (baseline.max[kind] ?? 0));
  if (risen.length) {
    console.error(`✗ ${risen.map((k) => `${k} rose by ${result.totals[k] - (baseline.max[k] ?? 0)}`).join(', ')}.`);
    console.error('  These counts may go down, never up.\n');

    const worse = Object.entries(result.byFile)
      .map(([file, counts]) => {
        const before = baseline.byFile[file] || {};
        return [file, risen.reduce((acc, kind) => acc + counts[kind] - (before[kind] ?? 0), 0)];
      })
      .filter(([, delta]) => delta > 0)
      .sort((a, b) => b[1] - a[1]);

    if (worse.length) {
      console.error('Files that grew since the baseline:');
      for (const [file, delta] of worse.slice(0, 20)) console.error(`  +${delta}\t${file}`);
      console.error('');
    }

    console.error('Give the value a real type. If the type genuinely is not knowable yet — it comes');
    console.error('from untyped runtime or viewer code that PLAT-003 has not reached — say so in the');
    console.error('PR, run `npm run tsfixme:baseline`, and commit the raised baseline so a reviewer');
    console.error('sees the decision. Raising it silently is the one thing this gate exists to stop.\n');
    return 1;
  }

  const fallen = KINDS.filter((kind) => result.totals[kind] < (baseline.max[kind] ?? 0));
  if (fallen.length) {
    const total = fallen.reduce((acc, kind) => acc + (baseline.max[kind] ?? 0) - result.totals[kind], 0);
    console.log(`✓ ${total} fewer marker(s) than the baseline. Lower it with \`npm run tsfixme:baseline\`.\n`);
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
