#!/usr/bin/env node
/**
 * LEG-002 §3 — the corpus run that pins *non-trivial*.
 *
 * The task file's candidate definition ("anything with children, anything with
 * three or more authored parameters, anything with more than one outgoing
 * connection") is a guess, and the task file says so: **pin it against the
 * corpus before choosing it**, because a rule that reports 4,400 of 5,509 nodes
 * is not a diagnostic, it is a second copy of the node list.
 *
 * This script is that instrument. It reads every project it is pointed at with
 * no dependency on the validator (raw JSON, both project shapes), derives the
 * facts a `rules/` rule could actually see, and scores several candidate
 * predicates side by side so the choice is made on numbers.
 *
 * ⚠️ **The facts are deliberately limited to what `NormNode` carries** — type,
 * label, parent, children, instance ports — plus the component's connections.
 * A `rules/` rule is the only kind that reaches the ProblemsPanel *and*
 * `validate:project` (the precondition checks in `authoredCandidate.ts` reach
 * neither), and `NormNode` has no `parameters`. `paramCount` is measured anyway,
 * so the cost of the parameter clause the task file proposed can be *priced*
 * rather than assumed — see the `C1-with-params` / `C1-no-params` pair.
 *
 * Usage:
 *   node scripts/legibility/scan-labels.js                 # all three corpora
 *   node scripts/legibility/scan-labels.js --corpus library
 *   node scripts/legibility/scan-labels.js --list <corpus> # per-project rows
 *   node scripts/legibility/scan-labels.js --hits C4 --corpus library --limit 40
 *
 * @module scripts/legibility/scan-labels
 */

'use strict';

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

/**
 * The model-run corpus lives outside the repository, and a worktree sits one
 * directory deeper than the primary checkout — so this looks in both places
 * rather than assuming which checkout it is running from. `NODEGX_TEST_PROJECTS`
 * overrides.
 */
const TEST_PROJECTS = (() => {
  const candidates = [
    process.env.NODEGX_TEST_PROJECTS,
    path.resolve(REPO_ROOT, '..', 'NodeGX test projects'),
    path.resolve(REPO_ROOT, '..', '..', 'NodeGX test projects')
  ].filter(Boolean);
  return candidates.find((c) => fs.existsSync(c)) ?? candidates[1];
})();

// ─── Corpora ─────────────────────────────────────────────────────────────────

/**
 * The phase-55/58 model runs — every `phase5*` project directory on disk.
 *
 * LEG-002 §2 calls this "eleven … 1,123 nodes … 89.3%". This list is **twelve**
 * and totals 1,126 nodes at 89.3%: §2's set is this one minus one of the two
 * three-node stubs (`phase55-s8-kimi-k3`, `phase58-backend-alltools`), which
 * moves the total by 3 and the percentage by 0.0. Listing all twelve is the
 * honest set; the reconciliation is recorded so the two numbers are not read as
 * a disagreement.
 */
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

function walkForProjectJson(dir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === '.git') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walkForProjectJson(full, out);
    else if (e.name === 'project.json') out.push(full);
  }
  return out;
}

function corpora() {
  const repo = walkForProjectJson(REPO_ROOT, []).sort();
  const library = repo.filter((p) => p.startsWith(path.join(REPO_ROOT, 'library') + path.sep));
  const runs = MODEL_RUNS.map((n) => path.join(TEST_PROJECTS, n)).filter((p) => fs.existsSync(p));
  return {
    repo: { label: 'every project.json in this repo', targets: repo },
    library: { label: 'library/ prefabs and modules', targets: library },
    runs: { label: 'phase-55/58 model runs', targets: runs }
  };
}

// ─── Loading ─────────────────────────────────────────────────────────────────

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/** `{ name, nodes: [{id,type,label,parent,children,parameters}], connections }[]` */
function loadComponents(target) {
  const stat = fs.statSync(target);
  if (stat.isDirectory()) {
    const registry = path.join(target, 'components', '_registry.json');
    if (fs.existsSync(registry)) return loadV2(target, registry);
    return loadLegacy(path.join(target, 'project.json'));
  }
  return loadLegacy(target);
}

function loadV2(dir, registryPath) {
  const registry = readJson(registryPath);
  const out = [];
  for (const [key, entry] of Object.entries(registry.components ?? {})) {
    const compDir = path.join(dir, 'components', entry.path);
    const nodesFile = path.join(compDir, 'nodes.json');
    const connFile = path.join(compDir, 'connections.json');
    const nodes = fs.existsSync(nodesFile) ? readJson(nodesFile).nodes ?? [] : [];
    const connections = fs.existsSync(connFile) ? readJson(connFile).connections ?? [] : [];
    out.push({
      name: key,
      nodes: nodes.map((n) => ({
        id: n.id,
        type: n.type,
        label: n.label,
        parent: n.parent,
        children: Array.isArray(n.children) ? n.children : [],
        parameters: n.parameters ?? null
      })),
      connections
    });
  }
  return out;
}

function loadLegacy(file) {
  const project = readJson(file);
  const out = [];
  for (const comp of project.components ?? []) {
    const nodes = [];
    const visit = (node, parentId) => {
      nodes.push({
        id: node.id,
        type: node.type,
        label: node.label,
        parent: parentId,
        children: (node.children ?? []).map((c) => c.id),
        parameters: node.parameters ?? null
      });
      for (const child of node.children ?? []) visit(child, node.id);
    };
    for (const root of comp.graph?.roots ?? []) visit(root, undefined);
    out.push({ name: comp.name, nodes, connections: comp.graph?.connections ?? [] });
  }
  return out;
}

// ─── Facts ───────────────────────────────────────────────────────────────────

/**
 * Node types whose identity IS their explanation, and which a label would only
 * repeat. `Component Inputs`/`Component Outputs` are singletons in a component
 * and the canvas names them; a `Page` is the component. These are the "skip
 * nodes whose type is its own explanation" half of the task file's candidate.
 */
const SELF_EXPLANATORY = new Set([
  'Component Inputs',
  'Component Outputs',
  'PageInputs',
  'Page Inputs',
  'net.noodl.visual.page',
  'Page',
  'Router',
  'PageRouter',
  'net.noodl.visual.columns'
]);

/**
 * Types the runtime already names from one of their own parameters
 * (`usePortAsLabel` in the node definitions). The canvas shows
 * `Variable 'cartCount'`, not `Variable`, so the node is *already* named and a
 * label would be a second name for the same thing.
 *
 * Extracted from `packages/noodl-runtime/src/nodes/**` and
 * `packages/noodl-viewer-react/src/nodes/**` by grep; regenerate with
 * `--dump-useportaslabel` if the library grows.
 */
const USE_PORT_AS_LABEL = new Set([
  'String Format',
  'Expression',
  'OptimisticUpdate',
  'StateHistory',
  'WebSocket',
  'StateSnapshot',
  'Undo',
  'GlobalStore',
  'ActionDispatcher',
  'ActionHandler',
  'SetVariable',
  'GlobalStoreSet',
  'String',
  'ClearCollection',
  'Variable2',
  'GlobalStoreSubscribe',
  'SubscribeToChanges',
  'Collection2',
  'InsertModelInCollection',
  'RemoveModelFromCollection',
  'DbModel2',
  'DbCollection2',
  'NewDbModelProperties',
  'RemoveDbModelRelation',
  'SetDbModelProperties',
  'AddDbModelRelation',
  'Model2',
  'net.noodl.controls.checkbox'
]);

function nodeFacts(component) {
  const outFrom = new Map();
  const inTo = new Map();
  for (const c of component.connections ?? []) {
    if (!c) continue;
    if (c.fromId) outFrom.set(c.fromId, (outFrom.get(c.fromId) ?? 0) + 1);
    if (c.toId) inTo.set(c.toId, (inTo.get(c.toId) ?? 0) + 1);
  }
  const byParent = new Map();
  for (const n of component.nodes) {
    const key = n.parent ?? '<root>';
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(n);
  }

  return component.nodes.map((n) => {
    const siblings = byParent.get(n.parent ?? '<root>') ?? [];
    const sameType = siblings.filter((s) => s.type === n.type);
    const sameTypeSiblings = sameType.length;
    // How many of the same-type sibling run carry no label. A run where only one
    // is nameless is a gap, not an ambiguity — the others already read.
    const sameTypeUnlabelled = sameType.filter((s) => !(typeof s.label === 'string' && s.label.trim() !== '')).length;
    return {
      id: n.id,
      type: n.type,
      component: component.name,
      groupKey: `${component.name} ${n.parent ?? '<root>'} ${n.type}`,
      sameTypeUnlabelled,
      labelled: typeof n.label === 'string' && n.label.trim() !== '',
      childCount: n.children.length,
      paramCount: n.parameters ? Object.keys(n.parameters).length : 0,
      outCount: outFrom.get(n.id) ?? 0,
      inCount: inTo.get(n.id) ?? 0,
      sameTypeSiblings,
      isComponentRef: n.type.startsWith('/') || n.type.startsWith('#'),
      selfExplanatory: SELF_EXPLANATORY.has(n.type),
      selfNaming: USE_PORT_AS_LABEL.has(n.type)
    };
  });
}

// ─── Candidate predicates ────────────────────────────────────────────────────

/**
 * Each candidate answers "would this unlabelled node be reported?". They are
 * scored on the same facts so the table below is a like-for-like comparison.
 * `labelled` is never a hit — every candidate is `!labelled && predicate`.
 */
const CANDIDATES = [
  {
    name: 'C0-every-node',
    doc: 'Baseline: every unlabelled node. What "no definition at all" costs.',
    hit: () => true
  },
  {
    name: 'C1-with-params',
    doc: "LEG-002 §3 verbatim: children, or >=3 authored parameters, or >1 outgoing connection; skip self-explanatory/self-naming types with no configuration.",
    hit: (f) =>
      !((f.selfExplanatory || f.selfNaming) && f.paramCount === 0) &&
      (f.childCount > 0 || f.paramCount >= 3 || f.outCount > 1)
  },
  {
    name: 'C1-no-params',
    doc: 'The same, minus the parameter clause — i.e. what a `rules/` rule can actually see. Prices the NormNode limitation.',
    hit: (f) => !(f.selfExplanatory || f.selfNaming) && (f.childCount > 0 || f.outCount > 1)
  },
  {
    name: 'C2-containers',
    doc: 'Containers only: any unlabelled node with children.',
    hit: (f) => !f.selfExplanatory && f.childCount > 0
  },
  {
    name: 'C3-fanout',
    doc: 'Fan-out only: an unlabelled node feeding more than one downstream endpoint.',
    hit: (f) => !(f.selfExplanatory || f.selfNaming) && f.outCount > 1
  },
  {
    name: 'C4-ambiguous-siblings',
    doc:
      'Ambiguous siblings: three or more unlabelled nodes of the SAME type under the SAME parent. ' +
      'The canvas literally reads "Group, Group, Group" and nothing distinguishes them.',
    hit: (f) => !(f.selfExplanatory || f.selfNaming) && f.sameTypeSiblings >= 3
  },
  {
    name: 'C5-ambiguous-container-siblings',
    doc: 'C4 narrowed to the ones that are containers or fan out — the ambiguous nodes a reader has to trace through.',
    hit: (f) =>
      !(f.selfExplanatory || f.selfNaming) && f.sameTypeSiblings >= 3 && (f.childCount > 0 || f.outCount > 1)
  },
  {
    name: 'C6-ambiguous-siblings-2',
    doc: 'C4 at a floor of two rather than three same-type siblings.',
    hit: (f) => !(f.selfExplanatory || f.selfNaming) && f.sameTypeSiblings >= 2
  },
  {
    name: 'C7-all-nameless-run',
    doc:
      'C4 with the run required to be ENTIRELY nameless: three or more same-type siblings, none of them ' +
      'labelled. A run where one of four already reads "Footer" is a gap, not an ambiguity.',
    hit: (f) => !(f.selfExplanatory || f.selfNaming) && f.sameTypeSiblings >= 3 && f.sameTypeUnlabelled === f.sameTypeSiblings
  },
  {
    name: 'C8-shipped',
    doc:
      'THE SHIPPED DEFINITION. Three or more UNLABELLED siblings of one type under one parent (the run need ' +
      'not be entirely nameless — three indistinguishable ones is the claim), each of which is a junction: ' +
      'it has children, or it feeds more than one downstream endpoint. Self-explanatory and self-naming ' +
      'types are skipped.',
    hit: (f) =>
      !(f.selfExplanatory || f.selfNaming) && f.sameTypeUnlabelled >= 3 && (f.childCount > 0 || f.outCount > 1)
  },
  {
    name: 'C9-shipped-no-junction',
    doc: 'C8 without the junction clause — prices what the second half buys.',
    hit: (f) => !(f.selfExplanatory || f.selfNaming) && f.sameTypeUnlabelled >= 3
  }
];

// ─── Reporting ───────────────────────────────────────────────────────────────

function scan(targets) {
  const facts = [];
  const perTarget = [];
  const failed = [];
  for (const t of targets) {
    let components;
    try {
      components = loadComponents(t);
    } catch (err) {
      failed.push([t, err.message]);
      continue;
    }
    const f = [];
    for (const c of components) f.push(...nodeFacts(c));
    facts.push(...f);
    perTarget.push({ target: t, facts: f });
  }
  return { facts, perTarget, failed };
}

function score(facts) {
  const total = facts.length;
  const labelled = facts.filter((f) => f.labelled).length;
  const rows = CANDIDATES.map((c) => {
    const hit = facts.filter((f) => !f.labelled && c.hit(f));
    // Rows in the panel, if the rule reported once per (component, parent, type)
    // run rather than once per node. The two numbers are the two granularities.
    const groups = new Set(hit.map((f) => f.groupKey)).size;
    return { name: c.name, hits: hit.length, groups, pct: total ? (hit.length / total) * 100 : 0 };
  });
  return { total, labelled, rows };
}

function pad(s, n) {
  s = String(s);
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}
function lpad(s, n) {
  s = String(s);
  return s.length >= n ? s : ' '.repeat(n - s.length) + s;
}

function main() {
  const argv = process.argv.slice(2);
  const arg = (name) => {
    const i = argv.indexOf(name);
    return i === -1 ? undefined : argv[i + 1];
  };
  const only = arg('--corpus');
  const listCorpus = arg('--list');
  const hitsFor = arg('--hits');
  const limit = Number(arg('--limit') ?? 30);

  const all = corpora();
  const names = only ? [only] : ['repo', 'library', 'runs'];

  for (const name of names) {
    const c = all[name];
    if (!c) {
      console.error(`Unknown corpus "${name}". One of: ${Object.keys(all).join(', ')}`);
      process.exit(2);
    }
    const { facts, perTarget, failed } = scan(c.targets);
    const s = score(facts);

    console.log(`\n=== ${name} — ${c.label} ===`);
    console.log(`${c.targets.length} target(s), ${s.total} nodes, ${s.labelled} labelled (${((s.labelled / (s.total || 1)) * 100).toFixed(1)}%)`);
    if (failed.length) console.log(`  (${failed.length} target(s) failed to load)`);
    console.log('');
    console.log(`  ${pad('candidate', 34)}${lpad('hits', 8)}${lpad('% of nodes', 13)}${lpad('grouped', 10)}`);
    for (const r of s.rows) {
      console.log(
        `  ${pad(r.name, 34)}${lpad(r.hits, 8)}${lpad(r.pct.toFixed(1) + '%', 13)}${lpad(r.groups, 10)}`
      );
    }

    if (listCorpus === name) {
      console.log('\n  per target:');
      for (const t of perTarget) {
        const ts = score(t.facts);
        const c8 = ts.rows.find((r) => r.name === 'C8-shipped');
        console.log(
          `    ${lpad(ts.labelled, 5)}/${lpad(ts.total, 5)} ${lpad(((ts.labelled / (ts.total || 1)) * 100).toFixed(0) + '%', 5)}` +
            `  C8=${lpad(c8.hits, 4)} in ${lpad(c8.groups, 3)} run(s)  ${path.relative(path.dirname(REPO_ROOT), t.target)}`
        );
      }
    }

    if (hitsFor) {
      const cand = CANDIDATES.find((x) => x.name === hitsFor);
      if (!cand) {
        console.error(`Unknown candidate "${hitsFor}".`);
        process.exit(2);
      }
      const hits = facts.filter((f) => !f.labelled && cand.hit(f));
      console.log(`\n  ${hits.length} hit(s) for ${hitsFor}; first ${Math.min(limit, hits.length)}:`);
      const byType = new Map();
      for (const h of hits) byType.set(h.type, (byType.get(h.type) ?? 0) + 1);
      for (const [type, n] of [...byType.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit)) {
        console.log(`    ${lpad(n, 5)}  ${type}`);
      }
    }
  }

  console.log('\nCandidate definitions:');
  for (const c of CANDIDATES) console.log(`  ${c.name}: ${c.doc}`);
}

main();
