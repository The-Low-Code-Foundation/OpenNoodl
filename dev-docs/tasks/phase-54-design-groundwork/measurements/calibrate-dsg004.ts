/**
 * DSG-004 — the calibration run, against the **shipped** checks.
 *
 * Every number in `responsiveArrangement.ts`, `typographyHierarchy.ts` and the
 * `InertDimension` entry in `diagnostics.ts` comes from this script, and it
 * imports the real modules rather than re-implementing them: a rule calibrated
 * against a JS twin of itself is calibrated against nothing (BCN-003).
 *
 * It runs over three populations, because they answer different questions:
 *
 *  1. **both corpora** (107 projects) — the false-positive question;
 *  2. **the recipe library** (`docs/node-catalog/examples`) — the F23 question:
 *     does the corpus that exists to teach the right shape contain the defect?
 *  3. **the reference build** alone — the acceptance criterion: it must fire
 *     there, because that project is the calibration fixture.
 *
 * Usage: npx ts-node -P scripts/tsconfig.json dev-docs/.../calibrate-dsg004.ts
 */

import * as fs from 'fs';
import * as path from 'path';

import { loadCorpus, isRepoProject, CorpusComponent } from './corpus';
import { loadDefaultCatalog } from '../../../../packages/noodl-editor/src/editor/src/validation/catalog';
import { DiagnosticCode, type Diagnostic } from '../../../../packages/noodl-editor/src/editor/src/validation/diagnostics';
import { checkResponsiveArrangement } from '../../../../packages/noodl-editor/src/editor/src/validation/responsiveArrangement';
import { checkTypographyHierarchy } from '../../../../packages/noodl-editor/src/editor/src/validation/typographyHierarchy';
import { checkParameterValues } from '../../../../packages/noodl-editor/src/editor/src/validation/parameterValues';
import { AUTHORED_BLOCKING_WARNINGS } from '../../../../packages/noodl-editor/src/editor/src/validation/authoredCandidate';

const catalog = loadDefaultCatalog();

function runAll(component: CorpusComponent): Diagnostic[] {
  return [
    ...checkResponsiveArrangement(component.nodes as never, { component: component.name, catalog }),
    ...checkTypographyHierarchy(component.nodes as never, { component: component.name }),
    ...checkParameterValues(component.nodes as never, catalog, { component: component.name })
  ];
}

const OF_INTEREST = new Set<string>([
  DiagnosticCode.UncollapsibleMultiColumn,
  DiagnosticCode.InertDimension,
  DiagnosticCode.MonotoneTypography
]);

// ── 1. Both corpora ──────────────────────────────────────────────────────────
const byCode = new Map<string, { total: number; projects: Set<string>; hits: string[] }>();
for (const code of OF_INTEREST) byCode.set(code, { total: 0, projects: new Set(), hits: [] });

const projects = loadCorpus();
for (const p of projects) {
  for (const c of p.components) {
    for (const d of runAll(c)) {
      if (!OF_INTEREST.has(d.code)) continue;
      const entry = byCode.get(d.code)!;
      entry.total++;
      entry.projects.add(p.name);
      entry.hits.push(
        `${isRepoProject(p) ? 'repo' : 'test'} ${p.name} ${c.name} ${d.location.nodeType} "${d.location.nodeLabel ?? d.location.nodeId}"`
      );
    }
  }
}

console.log(`# corpus: ${projects.length} projects (${projects.filter(isRepoProject).length} in this repository)\n`);
for (const [code, entry] of byCode) {
  console.log(`## ${code} — ${entry.total} hits in ${entry.projects.size} projects` +
    (AUTHORED_BLOCKING_WARNINGS.has(code) ? ' [blocks authored output]' : ''));
  for (const h of entry.hits) console.log('   ' + h);
  console.log('');
}

// ── 2. The recipe library ────────────────────────────────────────────────────
const EXAMPLES = path.resolve(__dirname, '../../../../docs/node-catalog/examples');
let exampleHits = 0;
for (const file of fs.readdirSync(EXAMPLES).filter((f) => f.endsWith('.json'))) {
  const example = JSON.parse(fs.readFileSync(path.join(EXAMPLES, file), 'utf8'));
  for (const c of example.components ?? []) {
    for (const d of runAll({ name: `${file}:${c.name}`, nodes: c.nodes ?? [], connections: c.connections ?? [] })) {
      if (!OF_INTEREST.has(d.code)) continue;
      exampleHits++;
      console.log(`RECIPE ${d.code} ${file} ${c.name} ${d.location.nodeType} "${d.location.nodeLabel ?? d.location.nodeId}"`);
    }
  }
}
console.log(`\n# recipe library: ${exampleHits} hits (F23 check — an example that teaches the defect)\n`);

// ── 3. The reference build ───────────────────────────────────────────────────
const reference = projects.find((p) => p.name === 'ecommerce-example');
if (!reference) {
  console.log('# reference build not present in this checkout — acceptance criterion unmeasured');
} else {
  console.log('# ecommerce-example (the reference build, DSG-001):');
  for (const c of reference.components) {
    for (const d of runAll(c)) {
      if (!OF_INTEREST.has(d.code)) continue;
      console.log(`   ${d.code} ${c.name} "${d.location.nodeLabel ?? d.location.nodeId}"`);
    }
  }
}
