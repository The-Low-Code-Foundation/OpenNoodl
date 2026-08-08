#!/usr/bin/env node
/**
 * Reduce a replay transcript to the two things LAS-011 step 3 needs: the tool-call
 * sequence, and every rejection the model was handed.
 *
 * Two input dialects, because the matrix has two rigs:
 *   - `claude -p --output-format stream-json` (the haiku/sonnet rig)
 *   - `mcp-model-driver.js --out` JSONL (the open-weight rig)
 * Detected from the shape, not from a flag, so a file can be dropped in either way.
 *
 * The rejections matter as much as the calls. The phase's whole thesis is that a
 * speaking gate is obeyed where prose is dropped, so "how many rejections, of what
 * class, and did the next call fix it" is the measurement that says whether
 * LAS-001..007 worked. Counting only calls hides that entirely.
 *
 *   node .../extract-transcript.js <transcript> [--calls-only]
 *
 * @module measurements/extract-transcript
 */
const fs = require('fs');

/** Diagnostic codes the phase's gates emit, as they appear in rejection text. */
const CODE = /\b(interfaceless-instance|component-port-direction|unknown-instance-parameter|unknown-parameter|invalid-parameter-value|repeated-sibling-subtree|unsized-absolute-box|raw-color-literal|layout-string|oversized-page|inactive-conditional-parameter)\b/g;

/**
 * One readable line out of a rejection payload.
 *
 * Read off a real transcript rather than guessed at. An authoring door answers
 *
 *   { error: { code, message, details: { readable: [ "WARN [code] …", … ],
 *                                        examples: { recipes: [ … ] } } } }
 *
 * so the first *line* is always `{`. `readable` is LAS-002's diagnostics and
 * `examples.recipes` is LAS-007's attachment — whether a recipe rode along is
 * exactly what this session needs to count, so it is reported, not just the text.
 */
function rejectionGist(text) {
  const raw = String(text || '');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return raw.replace(/\s+/g, ' ').trim().slice(0, 220);
  }
  const err = parsed.error || parsed;
  const details = err.details || {};
  const readable = details.readable || details.errors || [];
  const recipes = ((details.examples || {}).recipes || []).length;
  const head = String(err.message || '').replace(/\s+/g, ' ');
  const first = readable.length ? String(readable[0]).replace(/\s+/g, ' ') : '';
  return (
    `${err.code || '?'} · ${head}` +
    (readable.length ? ` · ${readable.length} diag: ${first.slice(0, 150)}` : '') +
    (recipes ? ` · +${recipes} recipe(s)` : '')
  );
}

/** Did LAS-007's attachment ride along with this rejection? */
function recipeCount(text) {
  try {
    const parsed = JSON.parse(String(text));
    const err = parsed.error || parsed;
    return (((err.details || {}).examples || {}).recipes || []).length;
  } catch {
    return 0;
  }
}

function readLines(file) {
  return fs
    .readFileSync(file, 'utf8')
    .trim()
    .split('\n')
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

/** claude CLI stream-json → a flat event list. */
function fromClaudeStream(rows) {
  const names = new Map();
  const events = [];
  let summary = null;
  for (const row of rows) {
    if (row.type === 'result') {
      summary = {
        outcome: row.subtype,
        turns: row.num_turns,
        costUsd: row.total_cost_usd,
        durS: Math.round((row.duration_ms || 0) / 1000)
      };
    }
    for (const block of (row.message && row.message.content) || []) {
      if (block.type === 'tool_use') {
        names.set(block.id, block.name);
        events.push({ kind: 'call', name: block.name, input: block.input });
      } else if (block.type === 'tool_result') {
        const text =
          typeof block.content === 'string'
            ? block.content
            : (block.content || []).map((c) => c.text || '').join('\n');
        events.push({ kind: 'result', name: names.get(block.tool_use_id) || '?', isError: Boolean(block.is_error), text });
      }
    }
  }
  return { events, summary };
}

/** mcp-model-driver JSONL → the same flat event list. */
function fromDriver(rows) {
  const events = [];
  let summary = null;
  for (const row of rows) {
    if (row.kind === 'assistant') {
      for (const call of row.toolCalls || []) events.push({ kind: 'call', name: call.name, input: call.arguments });
    } else if (row.kind === 'tool-result') {
      events.push({ kind: 'result', name: row.name, isError: row.isError, text: row.text || '' });
    } else if (row.kind === 'run-end') {
      summary = { outcome: row.stop, turns: row.turns, costUsd: row.costUsd, durS: row.durS };
    }
  }
  return { events, summary };
}

function main() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith('--'));
  if (!file) {
    process.stderr.write('usage: extract-transcript.js <transcript.jsonl> [--calls-only]\n');
    process.exit(2);
  }
  const rows = readLines(file);
  const isDriver = rows.some((r) => r.kind === 'run-start' || r.kind === 'run-end');
  const { events, summary } = isDriver ? fromDriver(rows) : fromClaudeStream(rows);

  const s = summary || { outcome: 'incomplete', turns: '?', costUsd: 0, durS: '?' };
  process.stdout.write(
    `# ${s.outcome} turns=${s.turns} costUsd=${Number(s.costUsd || 0).toFixed(2)} durS=${s.durS}\n`
  );

  const calls = events.filter((e) => e.kind === 'call');
  for (const c of calls) process.stdout.write(c.name + '\n');
  if (args.includes('--calls-only')) return;

  const errors = events.filter((e) => e.kind === 'result' && e.isError);
  const codeCounts = {};
  for (const e of events) {
    if (e.kind !== 'result') continue;
    for (const m of String(e.text).match(CODE) || []) codeCounts[m] = (codeCounts[m] || 0) + 1;
  }

  const withRecipe = errors.filter((e) => recipeCount(e.text) > 0).length;
  process.stdout.write(
    `\n# --- rejections: ${errors.length} of ${calls.length} calls ` +
      `(${withRecipe} carried a LAS-007 recipe) ---\n`
  );
  const byTool = {};
  for (const e of errors) byTool[e.name] = (byTool[e.name] || 0) + 1;
  for (const [name, n] of Object.entries(byTool).sort((a, b) => b[1] - a[1])) {
    process.stdout.write(`${n}\t${name}\n`);
  }
  process.stdout.write('\n# --- diagnostic codes seen by the model ---\n');
  const codes = Object.entries(codeCounts).sort((a, b) => b[1] - a[1]);
  if (!codes.length) process.stdout.write('(none)\n');
  for (const [code, n] of codes) process.stdout.write(`${n}\t${code}\n`);

  process.stdout.write('\n# --- what each rejection actually said ---\n');
  for (const e of errors) process.stdout.write(`[${e.name}] ${rejectionGist(e.text)}\n`);
}

if (require.main === module) main();

module.exports = { fromClaudeStream, fromDriver };
