#!/usr/bin/env node
/**
 * Emits one audit worksheet per node category into
 * `dev-docs/tasks/phase-30-node-library-audit/audit/`.
 *
 * The point is that an auditor should never start from a blank page. Every check that can be
 * answered from the catalog is answered here — ports, signals, documentation coverage, type
 * reachability — so the human (or model) pass only has to do the part that requires reading code.
 *
 * Existing worksheets are NOT overwritten: once someone has filled one in, re-running this script
 * leaves it alone and reports it as skipped. Delete a file to regenerate it.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const CATALOG = path.join(ROOT, 'packages/noodl-types/src/node-catalog.json');
const OUTDIR = path.join(ROOT, 'dev-docs/tasks/phase-30-node-library-audit/audit');

const typeName = (t) => (typeof t === 'string' ? t : (t && t.name) || '?');
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** The twelve checks, derived from defect classes A–F in FINDINGS.md. */
const CHECKS = [
  ['A1', 'Every mutation path notifies — including mutations made from a Function node or workflow'],
  ['A2', 'An explicit Refresh / re-run input actually re-reads the source rather than a cached copy'],
  ['A3', 'No change is swallowed: not the first one, and not one coalesced away inside a frame'],
  ['G1', '`null` on an input clears; `undefined` abstains; neither is coerced to a string or 0'],
  ['B1', 'If it can fail, it has a Failure/Error output — not just an editor warning'],
  ['B2', 'Failure information is available at runtime (deployed, cloud, export), not editor-only'],
  ['B3', 'Every signal input has a terminating signal output so downstream can sequence'],
  ['C1', 'Every port has a `description` the property panel and the AI loop can read'],
  ['D1', 'No contract matched by bare string (port names, component output names) without validation'],
  ['E1', 'Declared port types can actually connect to something; the accurate type is not worse than `*`'],
  ['F1', 'Any target it resolves implicitly can also be named explicitly, and the resolution is visible'],
  ['H1', 'Survives unmount/remount, delete, and its declared SSR compat is honest']
];

function analyse(n) {
  const ins = n.inputs || [];
  const outs = n.outputs || [];
  const sig = (p) => p.isSignal === true;
  const inSig = ins.filter(sig);
  const outSig = outs.filter(sig);
  const total = ins.length + outs.length;
  const documented = [...ins, ...outs].filter((p) => p.description).length;
  return {
    ins,
    outs,
    inSig,
    outSig,
    total,
    documented,
    docPct: total ? Math.round((documented / total) * 100) : 100,
    /**
     * ⚠️ A failure surface is a **signal** named like one, not any port named like one.
     *
     * This used to test names only, so a node with a *string* output called `Error` and no failure
     * signal at all pre-filled as "✅ has one" — and NDA-012's Data pass found four such nodes in a
     * single directory, every one of them stamped ✅. **Fifteen categories were audited from this
     * column before anyone read it.** `register.js` had the identical bug in its `Fail?` column.
     *
     * It is a pre-fill, not a verdict, and the phase's rule that a blank verdict is not a pass is
     * the only thing that limited the damage. Keep it honest anyway.
     */
    hasFailure: outs.some((p) => p.isSignal === true && /fail|error/i.test(p.name + ' ' + (p.displayName || ''))),
    deadTypes: [...ins, ...outs].filter((p) => ['object', 'array'].includes(typeName(p.type)))
  };
}

function worksheet(n, a) {
  const L = [];
  L.push(`### ${n.displayName}  \`${n.typeName}\``);
  L.push('');
  const flags = [];
  if (n.isDeprecated) flags.push('**deprecated**');
  if (n.inNodePicker === false) flags.push('not in picker');
  if (!n.docs) flags.push('**no docs URL**');
  L.push(
    `${a.ins.length} inputs / ${a.outs.length} outputs · ${a.inSig.length} signal in / ${a.outSig.length} signal out · ` +
      `docs ${a.docPct}% · SSR \`${(n.ssr && n.ssr.compat) || '—'}\` · ${(n.availableIn || []).join(', ') || '—'}` +
      (flags.length ? ` · ${flags.join(' · ')}` : '')
  );
  L.push('');
  L.push(`Source: _(fill in)_ · Docs: ${n.docs ? `[link](${n.docs})` : '**none**'}`);
  L.push('');
  L.push('| Check | Pre-filled | Verdict | Note |');
  L.push('|---|---|---|---|');
  for (const [id, text] of CHECKS) {
    let pre = '';
    if (id === 'B1') {
      pre = a.inSig.length === 0 ? 'n/a — no action input' : a.hasFailure ? '✅ has one' : '⚠️ **none**';
    } else if (id === 'B3') {
      pre = a.inSig.length === 0 ? 'n/a' : a.outSig.length === 0 ? '⚠️ **no signal out**' : '✅';
    } else if (id === 'C1') {
      pre = a.docPct === 100 ? '✅ 100%' : `⚠️ **${a.docPct}%** (${a.documented}/${a.total})`;
    } else if (id === 'E1') {
      pre = a.deadTypes.length
        ? `⚠️ ${a.deadTypes.length} object/array port(s): ${a.deadTypes.map((p) => p.name).join(', ')}`
        : '✅ no dead-end types';
    } else if (id === 'H1') {
      pre = `declares \`${(n.ssr && n.ssr.compat) || '—'}\``;
    }
    L.push(`| ${id} | ${pre} | ⬜ | |`);
  }
  L.push('');
  L.push('**Verdict:** ⬜ not audited');
  L.push('');
  return L.join('\n');
}

function main() {
  const catalog = JSON.parse(fs.readFileSync(CATALOG, 'utf8'));
  fs.mkdirSync(OUTDIR, { recursive: true });

  const byCategory = {};
  for (const n of catalog.nodes) {
    const c = n.category || 'Uncategorised';
    (byCategory[c] = byCategory[c] || []).push(n);
  }

  const written = [];
  const skipped = [];
  const index = [];

  for (const category of Object.keys(byCategory).sort()) {
    const nodes = byCategory[category].sort((a, b) => a.displayName.localeCompare(b.displayName));
    const file = path.join(OUTDIR, `${slug(category)}.md`);
    index.push(`| [${category}](./${slug(category)}.md) | ${nodes.length} | 0 |`);

    if (fs.existsSync(file)) {
      skipped.push(path.basename(file));
      continue;
    }

    const L = [
      `# Audit worksheet — ${category} (${nodes.length} nodes)`,
      '',
      'Generated by `node scripts/node-audit/worksheets.js`. **Existing files are never overwritten** —',
      'delete this file to regenerate it.',
      '',
      'Checks are defined in [NDA-012](../NDA-012-PER-NODE-AUDIT.md) and derive from the defect classes',
      'in [FINDINGS.md](../FINDINGS.md). The `Pre-filled` column is machine-derived from the node catalog;',
      'everything else needs the source read. Verdicts: ✅ pass · ⚠️ defect · 🔵 by design, document it ·',
      '⬜ not audited.',
      '',
      '---',
      ''
    ];
    for (const n of nodes) L.push(worksheet(n, analyse(n)), '---', '');
    fs.writeFileSync(file, L.join('\n'));
    written.push(path.basename(file));
  }

  console.log(`Wrote ${written.length} worksheet(s); skipped ${skipped.length} existing.`);
  if (skipped.length) console.log('  skipped:', skipped.join(', '));
  console.log('\nIndex rows for NDA-012:\n');
  console.log('| Category | Nodes | Audited |');
  console.log('|---|---|---|');
  console.log(index.join('\n'));
}

main();
