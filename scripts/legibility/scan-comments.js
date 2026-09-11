#!/usr/bin/env node
/**
 * LEG-001 — the instrument for the measurement the task is graded on.
 *
 * `label` is in the authoring vocabulary and 89.3% of agent-authored nodes carry
 * one. `metadata.comment` was **not** in it and carried **1 in 2,045**. LEG-001
 * declared the field; this script is how the second arm gets re-measured, and it
 * exists because that 1-in-2,045 was computed by hand and had **no committed
 * instrument** — a number nobody can re-derive is not a baseline, it is a memory.
 *
 * Companion to `scan-labels.js`, deliberately kept separate: that script scores
 * candidate *predicates* for a lint rule, this one counts one field.
 *
 * ⚠️ **It reads both project shapes.** `scan-labels.js` reads only legacy
 * `project.json`, which was fine when every corpus project was legacy. New
 * projects are v2 (`nodegx.project.json` + `components/<path>/nodes.json`), so a
 * fresh replay authored today is **invisible** to a legacy-only reader — it would
 * report zero nodes and zero comments and look exactly like a model that wrote
 * nothing. See `v2-format-now-default-for-new-projects`.
 *
 * ⚠️ **The denominator is broader than LEG-002 §2's, and deliberately so.** This
 * counts every node on disk; `scan-labels.js` reports 1,126 nodes for the same
 * twelve model runs where this reports 1,998. The *numerators* agree — 1,006
 * labelled here against the 1,003 in LEG-001's table — so the gap is entirely in
 * what is admitted as a countable node, not in the fact being measured. Quote a
 * comment rate from this script against **this** script's denominator, and do not
 * mix it with a hand-derived one; the honest headline is the raw pair
 * (comments, nodes), which is why every line prints both.
 *
 * Reproduces, unchanged, three facts stated independently in the task files:
 * zero comments across all twelve model runs, exactly one comment in the whole
 * of `NodeGX test projects/` and it is in a project called `test`, and
 * `project-examples/agent-chat` at 0 labels and 0 comments of 262 nodes.
 *
 * Usage:
 *   node scripts/legibility/scan-comments.js                    # every corpus
 *   node scripts/legibility/scan-comments.js --corpus model-runs
 *   node scripts/legibility/scan-comments.js --project <dir>    # one project
 *   node scripts/legibility/scan-comments.js --show <dir>       # print the comments
 *
 * @module scripts/legibility/scan-comments
 */

'use strict';

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

/** Same resolution order as `scan-labels.js`, so both agree on the corpus. */
const TEST_PROJECTS = (() => {
  const candidates = [
    process.env.NODEGX_TEST_PROJECTS,
    path.resolve(REPO_ROOT, '..', 'NodeGX test projects'),
    path.resolve(REPO_ROOT, '..', '..', 'NodeGX test projects')
  ].filter(Boolean);
  return candidates.find((c) => fs.existsSync(c)) ?? candidates[1];
})();

/** Kept identical to `scan-labels.js`'s list so the two are directly comparable. */
const MODEL_RUNS = [
  'phase55-replay-haiku',
  'phase55-replay-sonnet',
  'phase55-s6-haiku',
  'phase55-s6-qwen35-27b',
  'phase55-s6-sonnet',
  'phase55-s8-deepseek-v4-pro',
  'phase55-s8-ds-probe',
  'phase55-s8-kimi-k3',
  'phase55-s8-kimi-k3-rerun',
  'phase58-awp006-deepseek',
  'phase58-backend-alltools',
  'phase58-backend-deferred'
];

// ─── Reading, both shapes ────────────────────────────────────────────────────

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function walkNodes(nodes, visit) {
  for (const n of nodes || []) {
    visit(n);
    walkNodes(n.children, visit);
  }
}

/**
 * Every node of a project, whichever shape it is stored in.
 *
 * Legacy: one `project.json` with `components[].graph.roots[]`.
 * v2: `nodegx.project.json` beside `components/<path>/nodes.json`, each of which
 * holds `{ roots: [...] }` — the same node objects, one file per component.
 */
function nodesOfProject(projectDir) {
  const out = [];

  const legacy = path.join(projectDir, 'project.json');
  if (fs.existsSync(legacy)) {
    const p = readJson(legacy);
    for (const c of p?.components || []) walkNodes(c.graph?.roots, (n) => out.push(n));
    return { shape: 'legacy', nodes: out };
  }

  if (fs.existsSync(path.join(projectDir, 'nodegx.project.json'))) {
    const compRoot = path.join(projectDir, 'components');
    const stack = [compRoot];
    while (stack.length) {
      const dir = stack.pop();
      let entries;
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) stack.push(full);
        else if (e.name === 'nodes.json') {
          const doc = readJson(full);
          walkNodes(doc?.roots || doc?.nodes, (n) => out.push(n));
        }
      }
    }
    return { shape: 'v2', nodes: out };
  }

  return { shape: 'none', nodes: out };
}

/** The one fact this script is about. `setComment` stores trimmed-or-undefined. */
function commentOf(node) {
  const c = node?.metadata?.comment;
  return typeof c === 'string' && c.trim() ? c.trim() : null;
}

function scoreProject(projectDir) {
  const { shape, nodes } = nodesOfProject(projectDir);
  const comments = [];
  for (const n of nodes) {
    const c = commentOf(n);
    if (c) comments.push({ id: n.id, type: n.type, label: n.label, comment: c });
  }
  const labelled = nodes.filter((n) => typeof n.label === 'string' && n.label.trim()).length;
  return { dir: projectDir, shape, nodes: nodes.length, labelled, comments };
}

// ─── Corpora ─────────────────────────────────────────────────────────────────

function dirsIn(root) {
  try {
    return fs
      .readdirSync(root, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => path.join(root, e.name));
  } catch {
    return [];
  }
}

function corpora() {
  return {
    'model-runs': MODEL_RUNS.map((n) => path.join(TEST_PROJECTS, n)).filter((d) => fs.existsSync(d)),
    'test-projects': dirsIn(TEST_PROJECTS),
    library: dirsIn(path.join(REPO_ROOT, 'library', 'modules')).concat(
      fs.existsSync(path.join(REPO_ROOT, 'project-examples'))
        ? dirsIn(path.join(REPO_ROOT, 'project-examples'))
        : []
    )
  };
}

// ─── Reporting ───────────────────────────────────────────────────────────────

function ratio(part, whole) {
  if (!whole) return '—';
  if (!part) return `0 of ${whole}`;
  return `${part} of ${whole} (${((part / whole) * 100).toFixed(1)}%, 1 in ${Math.round(whole / part)})`;
}

function reportCorpus(name, dirs) {
  let nodes = 0;
  let comments = 0;
  let labelled = 0;
  const rows = [];
  for (const d of dirs) {
    const r = scoreProject(d);
    if (!r.nodes) continue;
    nodes += r.nodes;
    labelled += r.labelled;
    comments += r.comments.length;
    rows.push(r);
  }
  console.log(`\n=== ${name} — ${rows.length} projects, ${nodes} nodes`);
  console.log(`    comments : ${ratio(comments, nodes)}`);
  console.log(`    labels   : ${ratio(labelled, nodes)}`);
  for (const r of rows.filter((r) => r.comments.length)) {
    console.log(`    · ${path.basename(r.dir)} [${r.shape}] — ${r.comments.length} of ${r.nodes}`);
  }
  return { nodes, comments, labelled };
}

function main() {
  const argv = process.argv.slice(2);
  const arg = (flag) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : null;
  };

  const one = arg('--project') || arg('--show');
  if (one) {
    const r = scoreProject(path.resolve(one));
    console.log(`${r.dir}\n  shape: ${r.shape}\n  nodes: ${r.nodes}`);
    console.log(`  comments: ${ratio(r.comments.length, r.nodes)}`);
    console.log(`  labels  : ${ratio(r.labelled, r.nodes)}`);
    if (argv.includes('--show')) {
      console.log('\n  --- every comment, for judging ---');
      r.comments.forEach((c, i) => {
        console.log(`  ${String(i + 1).padStart(3)}. [${c.type}] ${c.label || '(no label)'}\n       ${c.comment}`);
      });
    }
    return;
  }

  const all = corpora();
  const only = arg('--corpus');
  const totals = { nodes: 0, comments: 0 };
  for (const [name, dirs] of Object.entries(all)) {
    if (only && name !== only) continue;
    const t = reportCorpus(name, dirs);
    if (name !== 'test-projects') {
      totals.nodes += t.nodes;
      totals.comments += t.comments;
    }
  }
  if (!only) {
    console.log(`\n=== model-runs + library combined: comments ${ratio(totals.comments, totals.nodes)}`);
  }
}

main();
