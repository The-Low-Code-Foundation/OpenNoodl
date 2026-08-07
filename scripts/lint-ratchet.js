/**
 * ESLint ratchet.
 *
 * A plain `eslint` gate is not usable here: the editor sources carry ~8,300
 * pre-existing errors (mostly no-unused-vars, no-this-alias, prop-types), so a
 * pass/fail gate would be red on day one and get overridden — which is worse
 * than no gate at all.
 *
 * Instead we hold the line: the error count may fall but never rise. New code
 * has to be clean, and legacy debt gets paid down whenever someone touches a
 * file. Warnings never block (REV-003); the per-rule `TSFixme` ratchet arrives
 * with PLAT-004 in Phase 14.
 *
 *   node scripts/lint-ratchet.js            # check against .eslint-baseline.json
 *   node scripts/lint-ratchet.js --update   # rewrite the baseline from reality
 */
const fs = require('fs');
const path = require('path');

const { ESLint } = require('eslint');

const ROOT = path.join(__dirname, '..');
const BASELINE_PATH = path.join(ROOT, '.eslint-baseline.json');

async function main() {
  const update = process.argv.includes('--update');
  const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));

  const eslint = new ESLint({ cwd: ROOT, errorOnUnmatchedPattern: false });
  const results = await eslint.lintFiles(baseline.targets);

  let errors = 0;
  let warnings = 0;
  const byRule = {};
  for (const result of results) {
    errors += result.errorCount;
    warnings += result.warningCount;
    for (const message of result.messages) {
      if (message.severity !== 2) continue;
      const rule = message.ruleId || '(parse error)';
      byRule[rule] = (byRule[rule] || 0) + 1;
    }
  }

  console.log(`ESLint: ${errors} errors, ${warnings} warnings across ${results.length} files`);
  console.log(`Baseline: ${baseline.maxErrors} errors`);

  if (update) {
    fs.writeFileSync(BASELINE_PATH, JSON.stringify({ ...baseline, maxErrors: errors, byRule }, null, 2) + '\n');
    console.log(`Baseline updated to ${errors}.`);
    return 0;
  }

  if (errors > baseline.maxErrors) {
    const added = errors - baseline.maxErrors;
    console.error(`\n✗ ${added} new ESLint error(s). The count may go down, never up.\n`);

    const worse = Object.entries(byRule)
      .map(([rule, count]) => [rule, count, count - (baseline.byRule[rule] || 0)])
      .filter(([, , delta]) => delta > 0)
      .sort((a, b) => b[2] - a[2]);

    if (worse.length) {
      console.error('Rules that grew since the baseline:');
      for (const [rule, count, delta] of worse) {
        console.error(`  +${delta}\t${rule} (${count})`);
      }
      console.error('');
    }
    console.error('Fix them, or — if you genuinely removed lint-clean code — run');
    console.error('`npm run lint:baseline` and commit the new baseline with an explanation.\n');
    return 1;
  }

  if (errors < baseline.maxErrors) {
    console.log(`\n✓ ${baseline.maxErrors - errors} fewer error(s) than the baseline. Lower it with \`npm run lint:baseline\`.\n`);
  } else {
    console.log('\n✓ Holding the line.\n');
  }
  return 0;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err);
    process.exit(1);
  }
);
