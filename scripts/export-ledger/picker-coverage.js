#!/usr/bin/env node
/**
 * picker-coverage — how much of the node picker exports (phase-18, EXP-008).
 *
 * 🔴 THIS IS THE PHASE'S HEADLINE NUMBER. Read the paragraph before using any other one.
 *
 * Phase 18 spent twelve sessions prioritising off a *corpus* metric: the share of node
 * INSTANCES that translate across ~40 old test projects accumulated as drive fixtures since
 * phase 7. That number reads 85%, and it is close to meaningless for the question the phase
 * exists to answer, for three reasons measured in session 31:
 *
 *   1. It is weighted by whatever those projects happened to contain. 83% of everything it
 *      still complains about is ONE downloaded third-party Noodl prefab kit, copied into eight
 *      of the projects and never placed on a page.
 *   2. A fifth of its denominator is in components no route can reach — code no app renders.
 *   3. It cannot see a node nobody in that corpus happened to use. A user placing `Object`,
 *      `HTTP Request` or any date node hits a wall the corpus metric reports as 85% healthy.
 *
 * This script asks the question a person building an app today actually has: **of the nodes I
 * can place from the picker, how many survive an export?** Session 31 measured 51 of 127.
 *
 * The corpus audit is not deleted and is not worthless — it is a good REGRESSION DETECTOR, and
 * session 19 said so in those words before twelve sessions used it as a priority oracle anyway.
 * Use it to notice that something broke. Use this to decide what to build.
 *
 * Usage:
 *   node scripts/export-ledger/picker-coverage.js              # summary + gaps by category
 *   node scripts/export-ledger/picker-coverage.js --json       # machine-readable
 *   node scripts/export-ledger/picker-coverage.js --check      # exit 1 if coverage regressed
 *
 * --check compares against `pickerCoverageFloor` in the ledger. It is a ratchet: coverage may
 * rise freely, and a fall fails CI. Raise the floor in the same commit that raises the number.
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
function argValue(flag, fallback) {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
}

const root = path.join(__dirname, '..', '..');
const catalogPath = argValue('--catalog', path.join(root, 'packages', 'noodl-types', 'src', 'node-catalog.json'));
const ledgerPath = argValue('--ledger', path.join(root, 'packages', 'nodegx-export', 'coverage-ledger.json'));

const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
const status = new Map(ledger.entries.map((e) => [e.typeName, e.status]));

/**
 * The population: what a user can actually place in a project today.
 *
 * `inNodePicker` is the editor's own flag for "this appears in the picker". Deprecated nodes are
 * excluded because we are not asking anyone to build with them, and cloud-only nodes because
 * they never run in a frontend at all — they are the backend's, and EXP-009 owns whether the
 * exported app can *call* them.
 */
const picker = catalog.nodes.filter(
  (n) => n.inNodePicker && !n.isDeprecated && (n.availableIn || []).includes('browser')
);

const exports_ = picker.filter((n) => status.get(n.typeName) === 'translated' || status.get(n.typeName) === 'stubbed');
const gaps = picker.filter((n) => !exports_.includes(n));

const byCategory = new Map();
for (const n of gaps) {
  const key = n.category || '(uncategorised)';
  if (!byCategory.has(key)) byCategory.set(key, []);
  byCategory.get(key).push(n.displayName || n.typeName);
}

const pct = picker.length ? (100 * exports_.length) / picker.length : 0;

if (args.includes('--json')) {
  console.log(
    JSON.stringify(
      {
        pickerNodes: picker.length,
        exportable: exports_.length,
        percent: Number(pct.toFixed(2)),
        gapsByCategory: Object.fromEntries([...byCategory].map(([k, v]) => [k, v.sort()]))
      },
      null,
      2
    )
  );
} else {
  console.log(`\nPICKER COVERAGE: ${exports_.length} of ${picker.length} placeable nodes export (${pct.toFixed(1)}%)\n`);
  console.log('What a user can place today and cannot export, by picker category:\n');
  for (const key of [...byCategory.keys()].sort((a, b) => byCategory.get(b).length - byCategory.get(a).length)) {
    const names = byCategory.get(key).sort();
    console.log(`  ${key} (${names.length})`);
    console.log(`    ${names.join(', ')}\n`);
  }
}

if (args.includes('--check')) {
  const floor = ledger.pickerCoverageFloor;
  if (typeof floor !== 'number') {
    console.error(
      '\nexport-ledger: coverage-ledger.json has no numeric `pickerCoverageFloor`.\n' +
        '  → Add one. It is the ratchet that stops picker coverage sliding while corpus\n' +
        '    coverage looks healthy, which is exactly how phase 18 lost twelve sessions.\n'
    );
    process.exit(1);
  }
  if (exports_.length < floor) {
    console.error(
      `\nexport-ledger: picker coverage FELL — ${exports_.length} nodes export, floor is ${floor}.\n` +
        '  → A node was added to the picker without a translation, or a translation was lost.\n' +
        '    Translate it, or if the fall is intended, lower `pickerCoverageFloor` in the same\n' +
        '    commit so the decision is in the diff.\n'
    );
    process.exit(1);
  }
  if (exports_.length > floor) {
    console.error(
      `\nexport-ledger: picker coverage ROSE — ${exports_.length} nodes export, floor is still ${floor}.\n` +
        '  → Raise `pickerCoverageFloor` to ' +
        exports_.length +
        ' in this commit, so the gain is held.\n'
    );
    process.exit(1);
  }
  console.log(`export-ledger: picker coverage holds at ${exports_.length}/${picker.length} (${pct.toFixed(1)}%).`);
}
