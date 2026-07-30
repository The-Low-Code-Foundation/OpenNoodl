#!/usr/bin/env node
/**
 * SUB-013 §4 — does `parameterEncoding` actually help a small model author a node?
 *
 * The success criterion for this task is behavioural, and it has to be measured against a small
 * local model rather than a frontier one. That is not a convenience: the constraint that motivated
 * the whole task is that people should be able to drive this with a local open-weight model, and
 * ambient pattern-induction — guessing `value-<state>-<value>` from a few examples — is precisely
 * the capability that shrinks first when the model does. A frontier model may well not need the
 * field. If a 3B model does not do better with it than without, the field is not carrying its
 * weight and the design in §2 is wrong.
 *
 * Two conditions, identical but for one key of the catalog entry:
 *
 *   without   the node's catalog entry as it stood before SUB-013 — `dynamicPorts` prose included
 *   with      the same entry, plus `parameterEncoding`
 *
 * Grading is objective and needs no answer key: each answer is fed to the node's real
 * dynamic-port hook, and a key is correct when the hook generates a port with that name. See
 * eval-grade-entry.js.
 *
 * Usage:
 *   node scripts/node-catalog/encoding-eval.js --catalog <node-catalog.json> [--model llama3.2] [--repeats 3]
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { bundleEntry } = require('./lib/bundle');

const TASKS = require('./fixtures/encoding-eval-tasks.json');
const OLLAMA = process.env.OLLAMA_HOST || 'http://localhost:11434';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}

/** The catalog entry a model is shown, with or without the new field. */
function entryFor(node, withEncoding) {
  const entry = {
    typeName: node.typeName,
    displayName: node.displayName,
    inputs: node.inputs.map((p) => ({ name: p.name, type: p.type.name, plug: p.plug })),
    outputs: node.outputs.map((p) => ({ name: p.name, type: p.type.name, plug: p.plug })),
    dynamicPorts: node.dynamicPorts
  };
  if (withEncoding && node.parameterEncoding) entry.parameterEncoding = node.parameterEncoding;
  return entry;
}

/** A pattern string as a regex source, for the grader (which has no access to this module). */
function patternSource(pattern) {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return `^${escaped.replace(/<N>/g, '(\\d+)').replace(/<[A-Za-z0-9_]+>/g, '(.+)')}$`;
}

function prompt(task, entry) {
  return [
    'You are authoring a node in a Noodl project file. Below is the node type\'s catalog entry.',
    '',
    '```json',
    JSON.stringify(entry, null, 2),
    '```',
    '',
    `Task: ${task.instruction}`,
    '',
    'Write the `parameters` object for this node. Reply with a single JSON object and nothing else —',
    'no explanation, no markdown fence. The object\'s keys are parameter names exactly as the runtime',
    'expects them.'
  ].join('\n');
}

function ask(model, text) {
  const body = JSON.stringify({
    model,
    prompt: text,
    stream: false,
    options: { temperature: 0, num_predict: 900 }
  });
  const result = spawnSync('curl', ['-s', '-m', '240', `${OLLAMA}/api/generate`, '-d', '@-'], {
    input: body,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024
  });
  if (result.status !== 0) throw new Error(`ollama call failed: ${result.stderr}`);
  return JSON.parse(result.stdout).response || '';
}

/** Pull the first JSON object out of a reply, fenced or not. */
function extractJson(text) {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  if (start === -1) return null;
  // Scan for the matching brace rather than trusting the model to stop cleanly.
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) {
      try {
        return JSON.parse(candidate.slice(start, i + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}

async function main() {
  const catalogPath = arg('catalog');
  if (!catalogPath) throw new Error('--catalog <path to node-catalog.json> is required');
  const model = arg('model', 'llama3.2:latest');
  const repeats = Number(arg('repeats', '3'));

  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  const byName = new Map(catalog.nodes.map((n) => [n.typeName, n]));

  const missingField = TASKS.tasks.filter((t) => !(byName.get(t.typeName) || {}).parameterEncoding);
  if (missingField.length) {
    throw new Error(
      `The catalog at ${catalogPath} has no parameterEncoding for ${missingField.map((t) => t.typeName).join(', ')}. ` +
        'Point --catalog at a catalog generated after SUB-013.'
    );
  }

  const answers = [];
  for (const task of TASKS.tasks) {
    const node = byName.get(task.typeName);
    for (const condition of ['without', 'with']) {
      for (let repeat = 0; repeat < repeats; repeat++) {
        const text = ask(model, prompt(task, entryFor(node, condition === 'with')));
        const parsed = extractJson(text);
        process.stdout.write(parsed ? '.' : '?');
        answers.push({
          id: `${task.id}#${repeat}`,
          condition,
          typeName: task.typeName,
          requires: task.requires,
          // Graded against the same patterns in both conditions — they are the yardstick, not
          // part of what the "without" model was shown.
          patterns: (node.parameterEncoding.patterns || []).map((p) => patternSource(p.pattern)),
          seededBy: node.parameterEncoding.seededBy || [],
          parsed: !!parsed,
          parseError: parsed ? undefined : text.slice(0, 200),
          parameters: parsed || {}
        });
      }
    }
  }
  process.stdout.write('\n');

  // Grade inside the bundle, where the real registries are.
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'encoding-eval-'));
  try {
    const bundlePath = await bundleEntry(path.join(__dirname, 'eval-grade-entry.js'), workDir, 'grade');
    const answersPath = path.join(workDir, 'answers.json');
    const gradedPath = path.join(workDir, 'graded.json');
    fs.writeFileSync(answersPath, JSON.stringify(answers));
    const run = spawnSync(process.execPath, [bundlePath], {
      env: { ...process.env, EVAL_ANSWERS: answersPath, EVAL_OUT: gradedPath },
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024
    });
    if (run.status !== 0) {
      process.stderr.write(run.stdout || '');
      process.stderr.write(run.stderr || '');
      throw new Error('grader failed');
    }
    const graded = JSON.parse(fs.readFileSync(gradedPath, 'utf8'));
    const dump = arg('dump');
    if (dump) {
      // Grades alone cannot tell "got the formula wrong" from "wrote the seed in the wrong
      // shape, so no ports generated at all" — and those call for opposite fixes.
      fs.writeFileSync(dump, JSON.stringify(graded.map((g, i) => ({ ...g, answer: answers[i].parameters })), null, 2));
      console.log(`\nAnswers written to ${dump}`);
    }
    report(graded, model, repeats);
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

function report(graded, model, repeats) {
  const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const pct = (x) => `${(x * 100).toFixed(0)}%`;

  console.log(`\nModel: ${model}   repeats: ${repeats}   answers: ${graded.length}\n`);
  console.log('  task                        without    with');
  console.log('  ' + '-'.repeat(46));

  const ids = [...new Set(graded.map((g) => g.id.split('#')[0]))];
  for (const id of ids) {
    const rows = (condition) => graded.filter((g) => g.id.startsWith(`${id}#`) && g.condition === condition);
    const w = mean(rows('without').map((g) => g.score));
    const e = mean(rows('with').map((g) => g.score));
    const arrow = e > w + 0.05 ? '  +' : e < w - 0.05 ? '  -' : '   ';
    console.log(`  ${id.padEnd(26)} ${pct(w).padStart(6)}  ${pct(e).padStart(6)}${arrow}`);
  }

  const overall = (condition) => {
    const rows = graded.filter((g) => g.condition === condition);
    return {
      score: mean(rows.map((g) => g.score)),
      precision: mean(rows.map((g) => g.precision || 0)),
      recall: mean(rows.map((g) => g.recall || 0)),
      shapeValidity: mean(rows.map((g) => g.shapeValidity || 0)),
      wroteSeeds: rows.filter((g) => g.wroteSeeds).length / rows.length,
      parsed: rows.filter((g) => g.parsed).length / rows.length,
      cleanRuns: rows.filter((g) => g.parsed && !(g.wrongKeys || []).length && !(g.missingRequired || []).length).length
    };
  };
  const without = overall('without');
  const withEnc = overall('with');

  console.log('  ' + '-'.repeat(46));
  console.log(`  ${'overall score'.padEnd(26)} ${pct(without.score).padStart(6)}  ${pct(withEnc.score).padStart(6)}`);
  console.log(`  ${'  key precision'.padEnd(26)} ${pct(without.precision).padStart(6)}  ${pct(withEnc.precision).padStart(6)}`);
  console.log(`  ${'  required-port recall'.padEnd(26)} ${pct(without.recall).padStart(6)}  ${pct(withEnc.recall).padStart(6)}`);
  console.log(`  ${'  keys matching a formula'.padEnd(26)} ${pct(without.shapeValidity).padStart(6)}  ${pct(withEnc.shapeValidity).padStart(6)}`);
  console.log(`  ${'  wrote all seed params'.padEnd(26)} ${pct(without.wroteSeeds).padStart(6)}  ${pct(withEnc.wroteSeeds).padStart(6)}`);
  console.log(`  ${'  fully correct answers'.padEnd(26)} ${String(without.cleanRuns).padStart(6)}  ${String(withEnc.cleanRuns).padStart(6)}`);
  console.log(`  ${'  replies that parsed'.padEnd(26)} ${pct(without.parsed).padStart(6)}  ${pct(withEnc.parsed).padStart(6)}`);

  const verdict =
    withEnc.score > without.score + 0.1
      ? 'parameterEncoding clearly helps this model.'
      : withEnc.score > without.score
        ? 'parameterEncoding helps, but not clearly. Treat as inconclusive.'
        : 'parameterEncoding did NOT help this model. The §2 design does not carry its weight as it stands.';
  console.log(`\n  ${verdict}\n`);

  const wrong = graded.filter((g) => g.condition === 'with').flatMap((g) => g.wrongKeys || []);
  if (wrong.length) {
    const counts = {};
    for (const k of wrong) counts[k] = (counts[k] || 0) + 1;
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 12);
    console.log('  Keys still invented in the "with" condition:');
    for (const [key, n] of top) console.log(`    ${String(n).padStart(3)}x  ${key}`);
    console.log('');
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
