/**
 * AIX-007 — summarise and compare measurement runs.
 *
 * The harness prints a summary as it goes; this reads the archived JSONL back,
 * which is what makes an A/B re-checkable months later without re-spending the
 * money. It also re-prices every run under ONE current price table, because
 * the baseline was recorded before the registry prices were corrected and
 * comparing its as-recorded cost against a later run would be comparing two
 * different instruments.
 *
 *   node packages/noodl-editor/scripts/aix002-measure/analyse.mjs <run.jsonl> [...]
 *   node .../analyse.mjs --baseline=<run.jsonl> <candidate.jsonl>
 */
import fs from 'fs';
import path from 'path';

/**
 * Prices must match `client/models.ts`. Duplicated rather than imported: this
 * is a plain .mjs script and the registry is TypeScript behind path aliases.
 * MAINTENANCE: sonnet-5 intro pricing ends 2026-08-31.
 */
const PRICES = {
  'claude-sonnet-5': { in: 2.0, out: 10.0 },
  'claude-opus-4-8': { in: 5.0, out: 25.0 },
  'claude-haiku-4-5': { in: 1.0, out: 5.0 }
};
const CACHE_READ = 0.1;
const CACHE_WRITE = 1.25;

function priceOf(model) {
  const key = Object.keys(PRICES).find((id) => model.startsWith(id));
  if (!key) throw new Error(`No price for model "${model}" — add it to PRICES.`);
  return PRICES[key];
}

/** Re-price one session from its token counts, under the current table. */
function repriced(record) {
  const p = priceOf(record.model);
  const m = record.metrics;
  const read = m.cacheReadTokens ?? 0;
  const write = m.cacheWriteTokens ?? 0;
  return (
    (m.promptTokens / 1e6) * p.in +
    (read / 1e6) * p.in * CACHE_READ +
    (write / 1e6) * p.in * CACHE_WRITE +
    (m.completionTokens / 1e6) * p.out
  );
}

function load(file) {
  const records = fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));

  const n = records.length;
  const sum = (pick) => records.reduce((total, r) => total + pick(r), 0);
  const cacheRead = sum((r) => r.metrics.cacheReadTokens ?? 0);
  const cacheWrite = sum((r) => r.metrics.cacheWriteTokens ?? 0);
  const inputTokens = sum((r) => r.metrics.promptTokens) + cacheRead + cacheWrite;
  const multiTurn = records.filter((r) => r.metrics.turns > 1);
  // The assertion that proves caching is on: a later turn read the prefix an
  // earlier turn wrote. A cost drop alone could come from anywhere.
  const verified = multiTurn.filter((r) =>
    (r.metrics.usageByTurn ?? []).filter((t) => t.turn > 1).some((t) => t.cacheReadTokens > 0)
  );

  return {
    file: path.basename(file),
    n,
    effort: records[0]?.effort ?? '(default)',
    model: records[0]?.model ?? '?',
    firstAttempt: records.filter((r) => r.firstAttemptValid === true).length,
    authored: records.filter((r) => r.status === 'authored').length,
    meanTurns: sum((r) => r.metrics.turns) / n,
    inputTokens,
    outputTokens: sum((r) => r.metrics.completionTokens),
    cacheRead,
    cacheWrite,
    hitRate: inputTokens === 0 ? 0 : cacheRead / inputTokens,
    cacheVerified: `${verified.length}/${multiTurn.length}`,
    meanCost: sum(repriced) / n,
    meanSeconds: sum((r) => r.durationMs) / n / 1000,
    records
  };
}

function report(run) {
  console.log(`\n── ${run.file}`);
  console.log(`   model / effort:      ${run.model} / ${run.effort}`);
  console.log(`   sessions:            ${run.n}`);
  console.log(`   first-attempt valid: ${run.firstAttempt}/${run.n}    authored: ${run.authored}/${run.n}`);
  console.log(`   mean turns:          ${run.meanTurns.toFixed(2)}`);
  console.log(`   input tok (total):   ${run.inputTokens}   output: ${run.outputTokens}`);
  console.log(`   cache read/write:    ${run.cacheRead}/${run.cacheWrite}   hit rate ${(run.hitRate * 100).toFixed(1)}%`);
  console.log(`   cache verified:      ${run.cacheVerified} multi-turn sessions read a prior turn`);
  console.log(`   mean $/component:    $${run.meanCost.toFixed(4)}   (repriced under the current table)`);
  console.log(`   mean latency:        ${run.meanSeconds.toFixed(0)}s`);
  for (const r of run.records) {
    const marks = r.rounds.map((round) => (round.ok ? '✓' : '✗')).join('') || '-';
    console.log(
      `     ${r.slug.padEnd(16)} ${r.status.padEnd(10)} ${marks.padEnd(5)} ` +
        `turns ${String(r.metrics.turns).padStart(2)}  out ${String(r.metrics.completionTokens).padStart(6)}  ` +
        `$${repriced(r).toFixed(4)}  ${(r.durationMs / 1000).toFixed(0)}s`
    );
  }
}

function compare(baseline, candidate) {
  const drop = (1 - candidate.meanCost / baseline.meanCost) * 100;
  console.log('\n── A/B ─────────────────────────────────────────────────');
  console.log(`   baseline:  ${baseline.file}`);
  console.log(`   candidate: ${candidate.file}`);
  console.log(
    `   mean $/component:    $${baseline.meanCost.toFixed(4)} → $${candidate.meanCost.toFixed(4)}  ` +
      `(${drop >= 0 ? '-' : '+'}${Math.abs(drop).toFixed(1)}%)`
  );
  console.log(`   first-attempt valid: ${baseline.firstAttempt}/${baseline.n} → ${candidate.firstAttempt}/${candidate.n}`);
  console.log(`   mean turns:          ${baseline.meanTurns.toFixed(2)} → ${candidate.meanTurns.toFixed(2)}`);
  console.log(`   output tokens:       ${baseline.outputTokens} → ${candidate.outputTokens}`);
  console.log(`   mean latency:        ${baseline.meanSeconds.toFixed(0)}s → ${candidate.meanSeconds.toFixed(0)}s`);

  // Per-prompt validity, so a regression names itself instead of averaging away.
  const before = new Map(baseline.records.map((r) => [r.slug, r.firstAttemptValid]));
  const regressed = candidate.records.filter((r) => before.get(r.slug) === true && r.firstAttemptValid !== true);
  console.log(
    regressed.length === 0
      ? '   no prompt regressed from valid to invalid'
      : `   REGRESSED: ${regressed.map((r) => r.slug).join(', ')}`
  );
  console.log(`   target: >=30% cost drop with validity held — ${drop >= 30 && regressed.length === 0 ? 'MET' : 'NOT MET'}`);
}

const args = process.argv.slice(2);
const baselineArg = args.find((a) => a.startsWith('--baseline='));
const files = args.filter((a) => !a.startsWith('--'));
if (files.length === 0) throw new Error('Usage: analyse.mjs [--baseline=<run.jsonl>] <run.jsonl> [...]');

const runs = files.map(load);
for (const run of runs) report(run);
if (baselineArg) compare(load(baselineArg.slice('--baseline='.length)), runs[runs.length - 1]);
