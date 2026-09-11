#!/usr/bin/env node
/**
 * FLD-011 AC2 + AC4 — the settle budget, graded for speed AND for finding stability.
 *
 * Usage:
 *   node dev-docs/tasks/phase-84-.../demo/fld-011-arms.js --corpus [--json <file>]
 *   node dev-docs/tasks/phase-84-.../demo/fld-011-arms.js <project-dir> [...]
 *   node dev-docs/tasks/phase-84-.../demo/fld-011-arms.js --tabs --corpus  # AC4: serial vs parallel
 *   node dev-docs/tasks/phase-84-.../demo/fld-011-arms.js --report <file>   # re-derive, no renders
 *
 * ## `--tabs` — AC3/AC4's other pair, and it needs no reverted module at all
 *
 * The settle arms above have to build a textually reverted copy of the module, because the old
 * behaviour no longer exists in the source. The parallel arms do not: `concurrency` is a parameter,
 * `1` **is** the serial sweep navigation for navigation, and both arms are the same build differing
 * by a number. That removes the whole class of error the `buildFixedArm` assertions exist to catch.
 *
 * 🔴 The two-sided control matters more here, not less. A lane count changes *when* each page is
 * read as well as how fast, so a project whose page moves on a timer can legitimately read
 * differently — and the only way to tell that from a regression is to ask each arm whether it
 * agrees with itself first.
 *
 * 🔴 **These arms cannot share one render, and that is the difference from FLD-012.**
 * `fld-012-arms.js` evaluates four measurement expressions against ONE DOM, because what varied was
 * the expression. Here what varies is *how long we wait before reading*, which is a property of the
 * render itself — so the arms are necessarily two renders, and two renders can differ for reasons
 * that have nothing to do with the budget.
 *
 * So **each arm is run twice and controlled against itself**, and the verdict is read off both
 * controls before the two arms are ever compared:
 *
 *   - both arms self-agree, and agree with each other  → IDENTICAL.
 *   - both arms self-agree and differ from each other  → 🔴 CHANGED. A real regression, named.
 *   - the SETTLED arm disagrees with itself            → the new budget is flaky here. Not a pass.
 *   - the FIXED arm disagrees with itself              → 🔴 the OLD code was reading a moving page,
 *     and any difference from it grades the timers, not the budget.
 *
 * 🔴 **The last case is not hypothetical, and controlling only the new arm would have misreported
 * it as a regression.** `project-examples/lessons/snacks` shows a "Feed me." caption about five
 * seconds after boot, driven by a timer in the lesson. The fixed arm reaches the phone measurement
 * at 3500 + 1200 + 1200 = 5.9s — straddling that boundary — and the settled arm reaches it at
 * ~0.8s. The fixed arm therefore counts 10 visible text elements where the settled arm counts 9,
 * `flat-type-scale` gates at **>= 10**, and a one-sided instrument reports that the settle budget
 * deleted a finding. It did not: the finding was manufactured by how long the old sleeps happened
 * to be on this machine, and it would flip on a slower one.
 *
 * The `fixed` arm is the CURRENT module with `settle(...)` textually reverted to the `wait(ms)`
 * calls it replaced, written beside the original so its own `require`s resolve, loaded, then
 * unlinked (FLD-008's shape). Both replacements are asserted, so a moved source fails loudly
 * instead of silently grading the same code twice.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..', '..', '..', '..');
const SOURCE = path.join(REPO, 'scripts', 'devtools', 'render-report.js');

/**
 * The reverted module: what this file looked like before the settle budget.
 *
 * 🔴 Each replacement is asserted. A `replace` that matches nothing returns the string unchanged,
 * so an unasserted revert of a source that has moved produces an arm identical to the other one —
 * two runs of the same code, reported as a clean before/after.
 */
function buildFixedArm() {
  let src = fs.readFileSync(SOURCE, 'utf8');
  const reverts = [
    ["await main.settle('boot', BOOT_MS, 2);", 'await wait(BOOT_MS);'],
    // ⚠️ Moved by the parallel-tabs work: the navigation settle lives in `attachTab` now and takes
    // its ceiling as a parameter, so the revert is `wait(ceilingMs)` rather than `wait(PAGE_NAV_MS)`.
    // In the serial sweep the ceiling handed in IS `PAGE_NAV_MS`, so the arm is the same old timer;
    // in a fresh tab it is `BOOT_MS`, which is what the old code had no fresh tab to spend.
    ['await settle(`navigate ${urlPath}`, ceilingMs, 2);', 'await wait(ceilingMs);'],
    ["await settle(`viewport ${vp.name}`, REFLOW_MS, 2);", 'await wait(REFLOW_MS);']
  ];
  for (const [from, to] of reverts) {
    if (!src.includes(from)) {
      throw new Error(
        `The fixed arm could not be built: render-report.js no longer contains ${JSON.stringify(from)}. ` +
          'Update this script rather than grading the settled code against itself.'
      );
    }
    src = src.split(from).join(to);
  }
  const file = path.join(path.dirname(SOURCE), `render-report.fld011-fixed-${process.pid}.js`);
  fs.writeFileSync(file, src);
  return file;
}

/** A finding as a comparable string — code, viewport, page and message, so a moved count shows. */
const findingKeys = (report) =>
  (report.findings || [])
    .map((f) => `${f.code}|${f.severity}|${f.viewport}|${f.page || ''}|${f.message}`)
    .sort();

async function runArm(renderReport, projectDir, extra = {}) {
  const started = Date.now();
  const { report } = await renderReport({ projectDir, screenshot: 'none', ...extra });
  return {
    wallMs: Date.now() - started,
    sweep: report.sweep,
    durationMs: report.durationMs,
    findings: findingKeys(report),
    pages: (report.pages || []).filter((p) => p.measured).length,
    settle: report.settle ? { ...report.settle, rows: undefined } : undefined,
    summary: report.summary
  };
}

async function main() {
  const argv = process.argv.slice(2);
  const reportAt = argv.indexOf('--report');
  if (reportAt !== -1) {
    report(JSON.parse(fs.readFileSync(argv[reportAt + 1], 'utf8')));
    return;
  }
  const jsonAt = argv.indexOf('--json');
  const jsonOut = jsonAt === -1 ? null : argv[jsonAt + 1];
  let dirs = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--json' && argv[i - 1] !== '--report');
  if (argv.includes('--corpus')) dirs = corpus();
  if (!dirs.length) {
    console.error('usage: fld-011-arms.js <project-dir> [...] | --corpus  [--json <file>] | --report <file>');
    process.exit(2);
  }

  /**
   * `--tabs` — the same build twice, at one lane and at `PAGE_TABS`.
   *
   * Keyed `fixed`/`settled` like the other mode so the two-sided control below is literally the
   * same code reading both pairs. Only the printed labels differ.
   */
  if (argv.includes('--tabs')) {
    const mod = require(SOURCE);
    const results = {};
    for (const dir of dirs) {
      const rel = path.relative(REPO, dir);
      process.stderr.write(`\n${rel}\n`);
      try {
        process.stderr.write('  serial…     ');
        const fixed = await runArm(mod.renderReport, dir, { concurrency: 1 });
        process.stderr.write(`${fixed.wallMs}ms\n  serial2…    `);
        const fixed2 = await runArm(mod.renderReport, dir, { concurrency: 1 });
        process.stderr.write(`${fixed2.wallMs}ms\n  parallel…   `);
        const settled = await runArm(mod.renderReport, dir, { concurrency: mod.PAGE_TABS });
        process.stderr.write(`${settled.wallMs}ms\n  parallel2…  `);
        const settled2 = await runArm(mod.renderReport, dir, { concurrency: mod.PAGE_TABS });
        process.stderr.write(`${settled2.wallMs}ms\n`);
        results[rel] = { fixed, fixed2, settled, settled2 };
      } catch (e) {
        process.stderr.write(`  ERROR ${e.message}\n`);
        results[rel] = { error: e.message };
      }
    }
    report(results, { a: 'serial', b: 'parallel' });
    if (jsonOut) {
      fs.writeFileSync(jsonOut, JSON.stringify(results, null, 2) + '\n');
      process.stderr.write(`\nwrote ${jsonOut}\n`);
    }
    return;
  }

  const fixedFile = buildFixedArm();
  const results = {};
  try {
    // Required AFTER the copy exists, and both from disk, so the two arms are two module instances
    // with two module-level caches rather than one shared one.
    const settledModule = require(SOURCE);
    const fixedModule = require(fixedFile);

    for (const dir of dirs) {
      const rel = path.relative(REPO, dir);
      process.stderr.write(`\n${rel}\n`);
      try {
        process.stderr.write('  fixed…    ');
        const fixed = await runArm(fixedModule.renderReport, dir);
        process.stderr.write(`${fixed.wallMs}ms\n  fixed2…   `);
        const fixed2 = await runArm(fixedModule.renderReport, dir);
        process.stderr.write(`${fixed2.wallMs}ms\n  settled…  `);
        const settled = await runArm(settledModule.renderReport, dir);
        process.stderr.write(`${settled.wallMs}ms\n  settled2… `);
        const settled2 = await runArm(settledModule.renderReport, dir);
        process.stderr.write(`${settled2.wallMs}ms\n`);
        results[rel] = { fixed, fixed2, settled, settled2 };
      } catch (e) {
        process.stderr.write(`  ERROR ${e.message}\n`);
        results[rel] = { error: e.message };
      }
    }
  } finally {
    fs.unlinkSync(fixedFile);
  }

  report(results);
  if (jsonOut) {
    fs.writeFileSync(jsonOut, JSON.stringify(results, null, 2) + '\n');
    process.stderr.write(`\nwrote ${jsonOut}\n`);
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

const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

function report(results, labels = { a: 'fixed', b: 'settled' }) {
  const rows = Object.entries(results).filter(([, r]) => !r.error);
  console.log(`\n== FLD-011 AC2/AC4 — ${labels.a} vs ${labels.b}, per project ==\n`);
  console.log(
    `  pages  ${labels.a.padStart(7)}  ${labels.b.padStart(8)}   speedup   findings   verdict            project`
  );

  let stable = 0;
  let regressed = 0;
  let unstable = 0;
  let oldUnstable = 0;
  let fixedTotal = 0;
  let settledTotal = 0;

  for (const [rel, r] of rows) {
    // 🔴 Both controls are read BEFORE the arms are compared. A difference between two arms that
    // do not agree with themselves is a fact about the project, not about the change.
    const settledAgrees = same(r.settled.findings, r.settled2.findings);
    const fixedAgrees = r.fixed2 ? same(r.fixed.findings, r.fixed2.findings) : true;
    const matches = same(r.fixed.findings, r.settled.findings);
    let verdict;
    if (!settledAgrees) {
      verdict = `${labels.b.toUpperCase()} UNSTABLE`;
      unstable += 1;
    } else if (!fixedAgrees) {
      // The old code disagreed with itself on this project: it was reading a page that is still
      // moving. Any difference from it measures the length of the old sleeps.
      verdict = `🔴 ${labels.a.toUpperCase()} UNSTABLE`;
      oldUnstable += 1;
    } else if (matches) {
      verdict = 'IDENTICAL';
      stable += 1;
    } else {
      verdict = '🔴 CHANGED';
      regressed += 1;
    }
    fixedTotal += r.fixed.wallMs;
    settledTotal += r.settled.wallMs;
    console.log(
      `  ${String(r.settled.pages).padStart(5)}  ${String(r.fixed.wallMs).padStart(6)}  ${String(
        r.settled.wallMs
      ).padStart(8)}  ${(r.fixed.wallMs / r.settled.wallMs).toFixed(2).padStart(7)}x  ${String(
        r.settled.findings.length
      ).padStart(8)}   ${verdict.padEnd(18)} ${rel}`
    );
    if (verdict !== 'IDENTICAL') {
      const a = new Set(r.fixed.findings);
      const b = new Set(r.settled.findings);
      for (const x of r.fixed.findings)
        if (!b.has(x)) console.log(`      ONLY ${labels.a.toUpperCase()} ${x.slice(0, 150)}`);
      for (const x of r.settled.findings)
        if (!a.has(x)) console.log(`      ONLY ${labels.b.toUpperCase()} ${x.slice(0, 150)}`);
      const drift = (label, one, two) => {
        const s1 = new Set(one);
        const s2 = new Set(two);
        for (const x of one) if (!s2.has(x)) console.log(`      ${label} ${x.slice(0, 150)}`);
        for (const x of two) if (!s1.has(x)) console.log(`      ${label} ${x.slice(0, 150)}`);
      };
      if (!settledAgrees) drift(`${labels.b}≠${labels.b}`, r.settled.findings, r.settled2.findings);
      if (!fixedAgrees) drift(`${labels.a}≠${labels.a}`, r.fixed.findings, r.fixed2.findings);
    }
  }

  console.log('\n== totals ==');
  console.log(`  ${rows.length} projects rendered FOUR times each — ${labels.a} twice, ${labels.b} twice.`);
  console.log(
    `  wall: ${(fixedTotal / 1000).toFixed(1)}s ${labels.a} → ${(settledTotal / 1000).toFixed(1)}s ${labels.b} ` +
      `(${(fixedTotal / settledTotal).toFixed(2)}x).`
  );
  console.log(
    `  findings: ${stable} identical, ${regressed} CHANGED, ${unstable} settled-unstable, ` +
      `${oldUnstable} old-arm-unstable.`
  );
  if (unstable) {
    console.log(
      '  🔴 A settled-unstable project is not a pass. Its two settled runs disagreed with each other,\n' +
        '     so the comparison against the fixed arm says nothing either way and must not be counted as one.'
    );
  }
  if (oldUnstable) {
    console.log(
      '  🔴 An old-arm-unstable project is not a regression. The FIXED timers disagreed with themselves\n' +
        '     there, which means that project renders differently depending on how long you happen to wait —\n' +
        '     so the difference measures the old sleep lengths, not the settle budget.'
    );
  }

  // The settle rows say whether the speed came from observing the page or from the ceiling.
  const ceil = rows.reduce((n, [, r]) => n + (r.settled.settle ? r.settled.settle.atCeiling : 0), 0);
  const count = rows.reduce((n, [, r]) => n + (r.settled.settle ? r.settled.settle.count : 0), 0);
  console.log(
    `  settles: ${count} performed, ${ceil} hit the ceiling (those waited the full old timer and read what the old code read).`
  );

  const errs = Object.entries(results).filter(([, r]) => r.error);
  for (const [rel, r] of errs) console.log(`  ERROR ${rel}: ${r.error}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
