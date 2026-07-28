#!/usr/bin/env node
/**
 * Regenerates `dev-docs/tasks/phase-30-node-library-audit/NODE-REGISTER.md` from the node catalog.
 *
 * The register's point is that the *smell* columns are derivable, so they cannot drift or be
 * argued with — only the `Verdict` column is human-written, and this script preserves it across
 * regenerations by re-reading the existing table. Run it after any change to the node library so
 * the audit's denominator stays honest.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const CATALOG = path.join(ROOT, 'packages/noodl-types/src/node-catalog.json');
const OUT = path.join(ROOT, 'dev-docs/tasks/phase-30-node-library-audit/NODE-REGISTER.md');

const isSignal = (p) => p.isSignal === true;
const matches = (ports, re) => ports.some((p) => re.test(p.name) || re.test(p.displayName || ''));

/** Verdicts are hand-written; keep them keyed by display name across regenerations. */
function readExistingVerdicts() {
  if (!fs.existsSync(OUT)) return {};
  const verdicts = {};
  for (const line of fs.readFileSync(OUT, 'utf8').split('\n')) {
    const cells = line.split('|');
    if (cells.length < 11) continue;
    const name = cells[2].trim().replace(/ _\(deprecated\)_$/, '');
    const verdict = cells[10].trim();
    if (name && verdict) verdicts[name] = verdict;
  }
  return verdicts;
}

function main() {
  const catalog = JSON.parse(fs.readFileSync(CATALOG, 'utf8'));
  const verdicts = readExistingVerdicts();

  const nodes = catalog.nodes
    .slice()
    .sort(
      (a, b) => (a.category || '').localeCompare(b.category || '') || a.displayName.localeCompare(b.displayName)
    );

  const lines = [
    '# Node Register — all ' + nodes.length + ' catalogued nodes',
    '',
    'Generated from `packages/noodl-types/src/node-catalog.json` (catalogFormatVersion ' +
      catalog.catalogFormatVersion +
      ').',
    'Regenerate with `node scripts/node-audit/register.js` — hand-written `Verdict` cells are preserved.',
    '',
    'The smell columns are *machine-derivable*, not verdicts.',
    '',
    '- **Fail?** — has a signal input and signal outputs, but no failure/error output: the node can go wrong and say nothing.',
    '- **Mute?** — has a signal input and no signal output at all: nothing downstream can sequence off it.',
    '- **Doc%** — share of ports carrying a `description`, i.e. what the property panel and the AI authoring loop can read.',
    '',
    '| # | Node | Category | Ports (in/out) | Fail? | Mute? | Doc% | SSR | Runtimes | Verdict |',
    '|---|---|---|---|---|---|---|---|---|---|'
  ];

  nodes.forEach((n, i) => {
    const ins = n.inputs || [];
    const outs = n.outputs || [];
    const inSig = ins.filter(isSignal);
    const outSig = outs.filter(isSignal);
    const total = ins.length + outs.length;
    const doc = total ? Math.round([...ins, ...outs].filter((p) => p.description).length / total * 100) : 100;
    const fail = inSig.length > 0 && outSig.length > 0 && !matches(outs, /fail|error/i) ? '⚠️' : '';
    const mute = inSig.length > 0 && outSig.length === 0 ? '⚠️' : '';
    const name = n.displayName + (n.isDeprecated ? ' _(deprecated)_' : '');
    lines.push(
      `| ${i + 1} | ${name} | ${n.category || '—'} | ${ins.length}/${outs.length} | ${fail} | ${mute} | ` +
        `${doc}% | ${(n.ssr && n.ssr.compat) || '—'} | ${(n.availableIn || []).join(', ')} | ${
          verdicts[n.displayName] || ''
        } |`
    );
  });

  fs.writeFileSync(OUT, lines.join('\n') + '\n');
  console.log(`Wrote ${nodes.length} rows to ${path.relative(ROOT, OUT)}`);
}

main();
