/** DSG-004 §2.2 — what `inactive-conditional-parameter` already reports, by port. */
import { loadCorpus, isRepoProject } from './corpus';
import { loadDefaultCatalog } from '../../../../packages/noodl-editor/src/editor/src/validation/catalog';
import { checkParameterValues } from '../../../../packages/noodl-editor/src/editor/src/validation/parameterValues';
import { DiagnosticCode } from '../../../../packages/noodl-editor/src/editor/src/validation/diagnostics';

const catalog = loadDefaultCatalog();
const SIZE_GATED = new Set(['width', 'height', 'objectFit']);
const byPort = new Map<string, number>();
const byTypePort = new Map<string, number>();
let total = 0;
let sizeGated = 0;
const sizeGatedProjects = new Set<string>();
const authoredHits: string[] = [];
let imagesNoBox = 0;
let images = 0;

for (const p of loadCorpus()) {
  for (const c of p.components) {
    const diags = checkParameterValues(c.nodes as never, catalog, { component: c.name });
    for (const d of diags) {
      if (d.code !== DiagnosticCode.InactiveConditionalParameter) continue;
      total++;
      const port = d.location.port ?? '?';
      byPort.set(port, (byPort.get(port) ?? 0) + 1);
      const key = `${d.location.nodeType}.${port}`;
      byTypePort.set(key, (byTypePort.get(key) ?? 0) + 1);
      if (SIZE_GATED.has(port)) {
        sizeGated++;
        sizeGatedProjects.add(p.name);
        if (!isRepoProject(p)) authoredHits.push(`${p.name} ${c.name} ${d.location.nodeType}.${port}`);
      }
    }
    for (const n of c.nodes) {
      if (n.type !== 'Image') continue;
      images++;
      const q = n.parameters ?? {};
      if (q['sizeMode'] !== 'explicit' && !q['width'] && !q['height']) imagesNoBox++;
    }
  }
}

console.log(`inactive-conditional-parameter total: ${total}`);
console.log('by port: ' + [...byPort.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join('  '));
console.log(`sizeMode-gated (width/height/objectFit): ${sizeGated} in ${sizeGatedProjects.size} projects`);
console.log('by type.port (size-gated only): ' + [...byTypePort.entries()].filter(([k]) => SIZE_GATED.has(k.split('.').pop()!)).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join('  '));
console.log(`Images: ${images}; with no explicit box at all (no sizeMode:explicit, no width, no height): ${imagesNoBox}`);
console.log('--- size-gated hits outside this repo (the authored/QA half) ---');
for (const h of authoredHits) console.log('  ' + h);
