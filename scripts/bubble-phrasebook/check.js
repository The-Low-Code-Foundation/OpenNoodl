#!/usr/bin/env node
/**
 * COM-002 AC4 — execute every code cell on the Bubble phrasebook.
 *
 * 🔴 The AC says *executed*, not read, and the distinction is the whole task:
 * the corpus this page is built from shipped 61 code cells that had never been
 * run, and running them found that a fifth of them do not do what their own row
 * says. A checker that inspected the text would have found none of it.
 *
 * 🔴 It also must not be the failure `scripts/generate-node-docs.js` documents
 * at its head — a `--check` that regenerates from a stale artifact and compares
 * the result against pages generated from the same stale artifact, reporting
 * clean because both sides are equally wrong. Nothing here compares text to
 * text. Every cell is COMPILED AND RUN, and its value is compared to a fixture
 * written by hand from Bubble's own Example and Result columns.
 *
 * ## The two sandboxes are the product's, not this file's
 *
 * A checker that invents its own JavaScript environment grades code nobody will
 * ever run that way, so both environments are taken from the runtime:
 *
 * - **Function cells** are compiled exactly as `simplejavascript.ts` compiles
 *   them: `new AsyncFunction('Inputs', 'Outputs', 'Noodl', 'Component', prefix +
 *   body)`, where `prefix` is READ OUT OF the real
 *   `JavascriptNodeParser.getCodePrefix()`. That is why a bare `return;` at the
 *   top level of a cell is legal — the body IS a function body. ⚠️ The parser is
 *   read as text rather than `require`d: it pulls in `./model`, which is
 *   TypeScript, so importing it from a plain Node script fails outright. Reading
 *   it keeps the prefix tied to the product, and `codePrefix()` throws rather
 *   than defaulting if the function it looks for ever moves.
 * - **Expression cells** are compiled as `expression.ts` compiles them: the
 *   free variables become arguments and the body becomes
 *   `preamble + 'return (' + code + ');'`.
 *
 * The Expression preamble is not exported, so it is reproduced here — and
 * because a reproduction drifts silently, `assertPreambleMatchesRuntime()`
 * reads `expression.ts` and fails if the runtime's alias list and this file's
 * ever stop agreeing. The instrument is armed rather than assumed.
 *
 * Usage: node scripts/bubble-phrasebook/check.js [--json]
 * Exit codes: 0 = every cell ran and matched, 1 = a cell failed, 2 = IO error.
 *
 * @module scripts/bubble-phrasebook/check
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const EXPRESSION_SRC = path.join(REPO_ROOT, 'packages/noodl-runtime/src/nodes/std-library/expression.ts');
const PARSER_SRC = path.join(REPO_ROOT, 'packages/noodl-runtime/src/javascriptnodeparser.js');

const { rows } = require('./rows');

/** The Expression node's pre-defined names, mirrored from `expression.ts`. */
const EXPRESSION_GLOBALS = {
  min: Math.min, max: Math.max, cos: Math.cos, sin: Math.sin, tan: Math.tan,
  sqrt: Math.sqrt, pi: Math.PI, round: Math.round, floor: Math.floor,
  ceil: Math.ceil, abs: Math.abs, random: Math.random, pow: Math.pow,
  log: Math.log, exp: Math.exp
};

/**
 * Fails if the runtime's Expression preamble stops matching the names above.
 *
 * Without this, adding `atan` to the runtime would leave the checker quietly
 * grading expressions against an environment the product no longer has — the
 * checker would still be green and would no longer be measuring anything.
 */
function assertPreambleMatchesRuntime() {
  const src = fs.readFileSync(EXPRESSION_SRC, 'utf8');
  const start = src.indexOf('const functionPreamble');
  if (start === -1) throw new Error('expression.ts no longer declares functionPreamble — this checker cannot mirror it');
  const block = src.slice(start, src.indexOf('].join(', start));
  const declared = new Set();
  for (const m of block.matchAll(/(\w+)\s*=\s*Math\.(\w+)/g)) declared.add(m[1]);
  const mine = new Set(Object.keys(EXPRESSION_GLOBALS));
  const missing = [...declared].filter((n) => !mine.has(n));
  const extra = [...mine].filter((n) => !declared.has(n));
  if (missing.length || extra.length) {
    throw new Error(
      'The Expression node\'s pre-defined names have moved and this checker did not.\n' +
        (missing.length ? `  the runtime defines, this file does not: ${missing.join(', ')}\n` : '') +
        (extra.length ? `  this file defines, the runtime does not: ${extra.join(', ')}\n` : '') +
        '  Update EXPRESSION_GLOBALS in scripts/bubble-phrasebook/check.js.'
    );
  }
  return declared.size;
}

/** Runs one Expression cell the way `expression.ts` runs it. */
function runExpression(code, vars) {
  const globalNames = Object.keys(EXPRESSION_GLOBALS);
  const varNames = Object.keys(vars);
  const body = 'return (' + code + ');';
  // eslint-disable-next-line no-new-func
  const fn = new Function(...globalNames, ...varNames, body);
  return fn(...globalNames.map((n) => EXPRESSION_GLOBALS[n]), ...varNames.map((n) => vars[n]));
}

/**
 * The prefix `simplejavascript.ts` prepends to every Function body, taken from
 * the runtime's own source.
 *
 * Throws rather than falling back to `''`: a silent default would compile every
 * cell in an environment the product does not have, and every row would still
 * be green.
 */
function codePrefix() {
  const src = fs.readFileSync(PARSER_SRC, 'utf8');
  const m = src.match(/getCodePrefix\s*=\s*function\s*\(\)\s*\{[\s\S]*?return\s+("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*');/);
  if (!m) throw new Error('javascriptnodeparser.js no longer returns a literal from getCodePrefix — this checker cannot mirror it');
  // eslint-disable-next-line no-eval
  return eval(m[1]);
}

/** Runs one Function cell the way `simplejavascript.ts` runs it. */
async function runFunction(code, inputs, arrays) {
  const values = {};
  const signals = [];
  const outputs = new Proxy(
    {},
    {
      get(_t, name) {
        if (typeof name !== 'string') return undefined;
        // `Outputs.Success()` is a call; anything read and then called is a signal.
        const signal = () => signals.push(name);
        signal.send = signal;
        return signal;
      },
      set(_t, name, value) {
        values[name] = value;
        return true;
      }
    }
  );
  const noodl = { Arrays: { ...(arrays || {}) }, Objects: {}, Variables: {} };
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const fn = new AsyncFunction(
    'Inputs',
    'Outputs',
    'Noodl',
    'Component',
    codePrefix() + code
  );
  await fn(inputs, outputs, noodl, {});
  return { values, signals, arrays: noodl.Arrays };
}

function describe(value) {
  if (value instanceof Date) return `Date(${value.toISOString()})`;
  return JSON.stringify(value);
}

async function main() {
  const json = process.argv.includes('--json');
  const failures = [];
  let ran = 0;

  const aliasCount = assertPreambleMatchesRuntime();

  const seen = new Set();
  for (const row of rows) {
    if (seen.has(row.id)) failures.push({ id: row.id, why: 'duplicate row id' });
    seen.add(row.id);

    const { answer, fixture } = row;
    if (answer.kind === 'node' || answer.kind === 'none') {
      if (answer.kind === 'none' && !answer.prose) {
        failures.push({ id: row.id, why: 'a refused row with no explanation is the ambiguity AC2 exists to remove' });
      }
      continue;
    }
    if (!fixture) {
      failures.push({ id: row.id, why: `a ${answer.kind} row with no fixture is a code cell nothing executes` });
      continue;
    }

    try {
      if (answer.kind === 'expression') {
        const actual = runExpression(answer.code, fixture.vars || {});
        ran += 1;
        if (fixture.expectOneOf) {
          if (!fixture.expectOneOf.some((v) => deepEqual(v, actual))) {
            failures.push({ id: row.id, why: `returned ${describe(actual)}, which is not one of the allowed values` });
          }
        } else if (!deepEqual(fixture.expect, actual)) {
          failures.push({ id: row.id, why: `expected ${describe(fixture.expect)}, got ${describe(actual)}` });
        }
      } else {
        const out = await runFunction(answer.code, fixture.inputs || {}, fixture.arrays);
        ran += 1;
        for (const [name, expected] of Object.entries(fixture.expect || {})) {
          if (!deepEqual(expected, out.values[name])) {
            failures.push({ id: row.id, why: `Outputs.${name}: expected ${describe(expected)}, got ${describe(out.values[name])}` });
          }
        }
        for (const [name, expected] of Object.entries(fixture.expectArrays || {})) {
          if (!deepEqual(expected, out.arrays[name])) {
            failures.push({ id: row.id, why: `Noodl.Arrays.${name}: expected ${describe(expected)}, got ${describe(out.arrays[name])}` });
          }
        }
        for (const signal of fixture.signals || []) {
          if (!out.signals.includes(signal)) {
            failures.push({ id: row.id, why: `never fired Outputs.${signal}() — fired: ${out.signals.join(', ') || 'nothing'}` });
          }
        }
      }
    } catch (e) {
      failures.push({ id: row.id, why: `threw: ${e && e.message ? e.message : String(e)}` });
    }
  }

  // ── The claims about the corpus, proved by running the corpus ──────────────
  // 🔴 "The community's code is wrong" is a claim, and a claim read off the page
  // is worth nothing. Every row that says so carries the ORIGINAL code verbatim,
  // and it is executed here: if it turns out to produce the right answer after
  // all, THIS is what says so, and the row's accusation is the thing that is
  // wrong. Two rows were demoted from "broken" to "works, for the wrong reason"
  // exactly this way.
  const proofs = [];
  for (const row of rows.filter((r) => r.corpusOriginal)) {
    const orig = row.corpusOriginal;
    let produced;
    try {
      produced =
        orig.kind === 'expression'
          ? await Promise.resolve(runExpression(orig.code, orig.vars || {}))
          : (await runFunction(orig.code, orig.inputs || {}, orig.arrays)).values;
    } catch (e) {
      proofs.push({ id: row.id, outcome: `threw: ${e && e.message ? e.message : String(e)}` });
      continue;
    }
    const shownProduced =
      orig.kind === 'function' && produced && Object.keys(produced).length === 0
        ? 'nothing at all — it assigns no Outputs'
        : describe(produced);
    // A row answered by a NODE has no fixture to compare against: the proof there is
    // the observation itself (what the old code actually produces), not an inequality.
    if (!row.fixture) {
      proofs.push({ id: row.id, outcome: shownProduced });
      continue;
    }
    const correct = row.fixture.expect;
    if (deepEqual(correct, produced)) {
      failures.push({
        id: row.id,
        why: `this row accuses the community table of being broken, but its original code returns ${describe(produced)} — the right answer. Demote the claim.`
      });
    } else {
      proofs.push({ id: row.id, outcome: shownProduced });
    }
  }

  if (json) {
    console.log(JSON.stringify({ rows: rows.length, ran, proofs, failures }, null, 2));
  } else {
    for (const f of failures) {
      const row = rows.find((r) => r.id === f.id);
      console.error(`FAIL [${f.id}] ${row ? row.bubble : ''} — ${f.why}`);
    }
    if (proofs.length) {
      console.log(`Corpus originals re-executed — each returned something other than the row's answer:`);
      for (const pr of proofs) {
        const row = rows.find((r) => r.id === pr.id);
        console.log(`  [${pr.id}] ${row.bubble} → ${pr.outcome}`);
      }
    }
    console.log(
      `${ran}/${ran + failures.filter((f) => f.why.startsWith('threw')).length} code cells executed; ` +
        `${rows.length} rows, ${failures.length} failure(s). ` +
        `Expression sandbox mirrors ${aliasCount} runtime aliases.`
    );
  }
  process.exit(failures.length ? 1 : 0);
}

function deepEqual(a, b) {
  try {
    assert.deepStrictEqual(a, b);
    return true;
  } catch {
    return false;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
