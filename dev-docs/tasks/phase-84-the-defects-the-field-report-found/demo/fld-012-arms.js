#!/usr/bin/env node
/**
 * FLD-012 — the fix and its reverted arms, measured on the SAME DOM.
 *
 * AC3 wants the `visible` correction asserted on its own and the findings it removes recorded as a
 * number. AC4 wants the four rules that inherit `visible` shown to have moved in the direction
 * expected and none of them to have gone to zero. AC5 wants a reverted arm. All three are the same
 * measurement asked three ways, so this does it once.
 *
 * 🔴 **One render, four arms.** The change lives in an expression that runs in the page, so a
 * before/after taken as two separate renders would be comparing two DOMs and calling the difference
 * a fix. This renders each page ONCE and evaluates four builds of the expression against that one
 * DOM:
 *
 *   `head`        — the source as it stands
 *   `no-visible`  — the `visible` opacity/visibility correction reverted, the rest kept
 *   `no-empty`    — the `empty-decorated-box` control skips reverted, the rest kept
 *   `original`    — both reverted; what shipped before FLD-012
 *
 * The arms are built by applying the inverse patch **textually** to the module's own source, the
 * shape FLD-008 established. Every replacement is asserted present first, so a source that has
 * moved fails loudly instead of silently grading nothing — a reverted arm that no longer reverts
 * anything reads as a perfect result.
 *
 * Usage:
 *   node dev-docs/tasks/phase-84-.../demo/fld-012-arms.js <project-dir> [<project-dir> ...]
 *   node dev-docs/tasks/phase-84-.../demo/fld-012-arms.js --corpus        # the whole corpus
 *   ... --json <file>   also write the per-project numbers as JSON
 */
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..', '..', '..');
const { withRenderedPage, summarise, placeholderStrings, routedPages } = require(
  path.join(REPO, 'scripts/devtools/render-report.js')
);
const MEASURE_SRC = path.join(REPO, 'packages/nodegx-render-measure/src/index.js');

// ── the inverse patches ───────────────────────────────────────────────────────────────────────
const VISIBLE_NEW = `  const visible = all.filter((el) => {
    const cs = styleOf(el);
    if (cs.visibility === 'hidden' || cs.opacity === '0') {
      transparentExcluded += 1;
      return false;
    }
    return el.offsetParent !== null || cs.position === 'fixed';
  });`;
const VISIBLE_OLD = `  const visible = all.filter((el) => el.offsetParent !== null || getComputedStyle(el).position === 'fixed');`;

const EMPTY_NEW = `    if (FORM_CONTROL_TAGS.indexOf(el.tagName) !== -1) return false;
    if (isControlFurniture(el)) return false;
`;
const EMPTY_OLD = '';

/** Apply one replacement, refusing to continue if the text it expects is not there. */
function revert(src, from, to, label) {
  const n = src.split(from).length - 1;
  if (n !== 1) {
    throw new Error(
      `FLD-012 arm "${label}": expected exactly ONE occurrence of the text being reverted, found ${n}. ` +
        'The source has moved; this arm would have graded nothing. Re-read src/index.js and fix the patch.'
    );
  }
  return src.replace(from, to);
}

/** Compile a variant of the module from source text, the way `purity.test.js` proves is possible. */
function moduleFrom(src) {
  const module_ = { exports: {} };
  new Function('module', 'exports', `${src}\nreturn module.exports;`)(module_, module_.exports);
  return module_.exports;
}

function arms() {
  const head = fs.readFileSync(MEASURE_SRC, 'utf8');
  const noVisible = revert(head, VISIBLE_NEW, VISIBLE_OLD, 'no-visible');
  const noEmpty = revert(head, EMPTY_NEW, EMPTY_OLD, 'no-empty');
  const original = revert(noVisible, EMPTY_NEW, EMPTY_OLD, 'original');
  return {
    head: moduleFrom(head),
    'no-visible': moduleFrom(noVisible),
    'no-empty': moduleFrom(noEmpty),
    original: moduleFrom(original)
  };
}

const ARM_NAMES = ['original', 'no-visible', 'no-empty', 'head'];

/**
 * The rules that inherit `visible`, read off the source rather than guessed.
 *
 * 🔴 The first version of this list was invented from the task doc's prose and named three codes
 * that DO NOT EXIST (`accent-poverty`, `accent-dominance`, `irregular-rhythm`). Every one of them
 * read 0 in both arms, which looks exactly like "the fix changed nothing here" and is really
 * "nothing was ever being counted". Two further corrections came out of reading the source:
 *
 *   - `flat-type-scale` inherits `visible` through `textEls` and is the rule that actually MOVED
 *     on the corpus. It was not in the doc's list of four at all.
 *   - The rhythm bands are measured but NO finding consumes them — `v.rhythm` has no reader in
 *     `summarise`. There is no rhythm rule to move.
 */
const INHERITING = [
  'elements-overflowing',
  'horizontal-overflow',
  'single-column-grid',
  'single-ground',
  'flat-type-scale',
  'no-display-type',
  'dead-placeholder-text',
  'broken-image',
  'no-imagery',
  'clipped-page',
  'content-not-visible',
  'empty-decorated-box'
];

async function measureProject(projectDir, built) {
  const placeholders = placeholderStrings();
  // `routedPages` returns a RECORD, not an array — {ok, pages, startPage, pathType}. And the URL a
  // route needs depends on `pathType`: register row P17, a hash-routed project addresses its pages
  // as `/#/path` and stripping the fragment would land you back on the start page.
  const routing = routedPages(projectDir);
  const perArm = {};
  for (const a of ARM_NAMES) perArm[a] = { findings: [], visibleCount: 0, transparentExcluded: 0, pages: 0 };

  await withRenderedPage({ projectDir }, async (page) => {
    await page.setViewport({ width: 1280, height: 900 });
    const toUrl = (urlPath) => {
      const clean = urlPath.startsWith('/') ? urlPath : '/' + urlPath;
      return routing.pathType === 'hash' ? '/#' + clean : clean;
    };
    const others = (routing.pages || [])
      .filter((p) => p.reachable && !p.isStart && p.urlPath)
      .map((p) => p.urlPath);
    const routes = [null, ...others];
    const seen = new Set();
    for (const route of routes) {
      if (route !== null) {
        if (seen.has(route)) continue;
        seen.add(route);
        await page.navigate(toUrl(route));
      }
      for (const armName of ARM_NAMES) {
        const raw = await page.evaluate(built[armName].measureExpression(placeholders, []));
        if (!raw || raw.error) continue;
        const measured = { desktop: { requested: { width: 1280, height: 900 }, ...raw, consoleErrors: [] } };
        const { findings } = built[armName].summarise(measured, undefined, {});
        perArm[armName].findings.push(...findings.map((f) => ({ ...f, route: route || '(start)' })));
        perArm[armName].pages += 1;
        // `visible` is not reported directly; its size is what every rule below is drawn from, so
        // it is read separately rather than inferred from a finding count that could move for
        // several reasons at once.
        perArm[armName].visibleCount += raw.visibleCount || 0;
        perArm[armName].transparentExcluded += raw.transparentExcluded || 0;
      }
    }
  });
  return perArm;
}

function tally(findings) {
  const by = {};
  for (const f of findings) by[f.code] = (by[f.code] || 0) + 1;
  return by;
}

async function main() {
  const argv = process.argv.slice(2);
  // Re-derive the readout from a saved run. The render is the expensive half and the numbers do not
  // change when the way they are summarised does.
  const reportAt = argv.indexOf('--report');
  if (reportAt !== -1) {
    report(JSON.parse(fs.readFileSync(argv[reportAt + 1], 'utf8')));
    return;
  }

  const jsonAt = argv.indexOf('--json');
  const jsonOut = jsonAt === -1 ? null : argv[jsonAt + 1];
  let dirs = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--json' && argv[i - 1] !== '--report');
  if (argv.includes('--corpus')) dirs = corpus();
  if (!dirs.length && reportAt === -1) {
    console.error('usage: fld-012-arms.js <project-dir> [...] | --corpus  [--json <file>] | --report <file>');
    process.exit(2);
  }

  const built = arms();
  const results = {};
  for (const d of dirs) {
    const dir = path.resolve(d);
    const name = path.relative(REPO, dir);
    process.stderr.write(`measuring ${name} …\n`);
    try {
      const perArm = await measureProject(dir, built);
      results[name] = {};
      for (const a of ARM_NAMES) {
        results[name][a] = {
          total: perArm[a].findings.length,
          byCode: tally(perArm[a].findings),
          visible: perArm[a].visibleCount,
          transparentExcluded: perArm[a].transparentExcluded,
          pages: perArm[a].pages
        };
      }
    } catch (e) {
      process.stderr.write(`  FAILED: ${e.message}\n`);
      results[name] = { error: e.message };
    }
  }

  report(results);
  if (jsonOut) {
    fs.writeFileSync(jsonOut, JSON.stringify(results, null, 2) + '\n');
    process.stderr.write(`wrote ${jsonOut}\n`);
  }
}

function corpus() {
  const roots = [path.join(REPO, 'templates'), path.join(REPO, 'project-examples', 'lessons')];
  const found = [];
  const walk = (dir, depth) => {
    if (depth > 3) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    if (entries.some((e) => e.isFile() && e.name === 'nodegx.project.json')) found.push(dir);
    for (const e of entries) if (e.isDirectory() && e.name !== 'node_modules') walk(path.join(dir, e.name), depth + 1);
  };
  for (const r of roots) walk(r, 0);
  return found.sort();
}

function report(results) {
  const codes = new Set();
  for (const r of Object.values(results)) {
    if (r.error) continue;
    for (const a of ARM_NAMES) for (const c of Object.keys(r[a].byCode)) codes.add(c);
  }
  const totals = {};
  for (const a of ARM_NAMES) totals[a] = { total: 0, visible: 0, byCode: {} };
  for (const r of Object.values(results)) {
    if (r.error) continue;
    for (const a of ARM_NAMES) {
      totals[a].total += r[a].total;
      totals[a].visible += r[a].visible;
      for (const [c, n] of Object.entries(r[a].byCode)) totals[a].byCode[c] = (totals[a].byCode[c] || 0) + n;
    }
  }

  console.log('\n== per project, total findings by arm ==');
  console.log(['project'.padEnd(56), ...ARM_NAMES.map((a) => a.padStart(11))].join(''));
  for (const [name, r] of Object.entries(results)) {
    if (r.error) {
      console.log(name.padEnd(56) + '  ERROR: ' + r.error.slice(0, 60));
      continue;
    }
    console.log([name.slice(0, 55).padEnd(56), ...ARM_NAMES.map((a) => String(r[a].total).padStart(11))].join(''));
  }

  console.log('\n== corpus totals, per rule ==');
  console.log(['rule'.padEnd(36), ...ARM_NAMES.map((a) => a.padStart(11))].join(''));
  for (const c of [...codes].sort()) {
    console.log([c.padEnd(36), ...ARM_NAMES.map((a) => String(totals[a].byCode[c] || 0).padStart(11))].join(''));
  }
  console.log(['TOTAL'.padEnd(36), ...ARM_NAMES.map((a) => String(totals[a].total).padStart(11))].join(''));

  console.log('\n== what each half of the fix removed, across the corpus ==');
  const removedByVisible = totals['no-visible'].total - totals.head.total;
  const removedByEmpty = totals['no-empty'].total - totals.head.total;
  console.log(`  the 'visible' correction alone removed : ${removedByVisible} findings`);
  console.log(`  the control skips alone removed        : ${removedByEmpty} findings`);
  console.log(`  both together (original -> head)       : ${totals.original.total - totals.head.total} findings`);
  // AC4 — every rule below is computed over `visible`, so every one of them inherits the change.
  // 🔴 A rule reading 0 in BOTH arms grades nothing: it is a control that was never armed, not
  // evidence that the fix left it alone. They are printed as "not exercised" so the readout cannot
  // be mistaken for a pass.
  console.log('\n  AC4 — the rules that inherit `visible` (down or unchanged, and none may reach zero):');
  let unexercised = 0;
  let regressions = 0;
  for (const c of INHERITING) {
    const o = totals.original.byCode[c] || 0;
    const h = totals.head.byCode[c] || 0;
    let verdict;
    if (o === 0 && h === 0) {
      verdict = 'NOT EXERCISED by this corpus — grades nothing';
      unexercised += 1;
    } else if (h === 0) {
      verdict = '<-- WENT TO ZERO: broken, not clean';
      regressions += 1;
    } else if (h > o) {
      verdict = '<-- WENT UP: the fix cannot add findings';
      regressions += 1;
    } else {
      verdict = o === h ? 'unchanged, still firing' : `moved down by ${o - h}, still firing`;
    }
    console.log(`    ${c.padEnd(22)} original ${String(o).padStart(4)}  ->  head ${String(h).padStart(4)}   ${verdict}`);
  }
  console.log(`\n  ${INHERITING.length - unexercised} of ${INHERITING.length} inheriting rules were exercised by this corpus; ${regressions} regressed.`);
}

main().catch((e) => {
  console.error(e.stack || e.message);
  process.exit(1);
});
