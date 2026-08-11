/** DSG-004 §2.3 — the fontWeight census: how many components render at one weight. */
import { loadCorpus, isRepoProject } from './corpus';

const TEXT_TYPES = new Set(['Text', 'net.noodl.controls.button', 'net.noodl.controls.textinput']);
const rows: Array<{ project: string; component: string; texts: number; weights: string[]; page: boolean; repo: boolean }> = [];

for (const p of loadCorpus()) {
  for (const c of p.components) {
    const texts = c.nodes.filter((n) => TEXT_TYPES.has(n.type));
    if (texts.length === 0) continue;
    const weights = new Set<string>();
    for (const t of texts) {
      const w = t.parameters?.['fontWeight'];
      weights.add(w === undefined || w === null || w === '' ? 'unset' : JSON.stringify(w));
    }
    rows.push({
      project: p.name,
      component: c.name,
      texts: texts.length,
      weights: [...weights],
      page: c.nodes.some((n) => n.type === 'Page'),
      repo: isRepoProject(p)
    });
  }
}

const hist = new Map<number, number>();
for (const r of rows) hist.set(r.texts, (hist.get(r.texts) ?? 0) + 1);
console.log(`components with text: ${rows.length}`);
console.log('text-node counts: ' + [...hist.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}:${v}`).join(' '));

for (const floor of [4, 6, 8, 10, 12]) {
  const big = rows.filter((r) => r.texts >= floor);
  const monotone = big.filter((r) => r.weights.length === 1);
  const monotone400 = monotone.filter((r) => r.weights[0] === 'unset' || /400|normal/.test(r.weights[0]));
  console.log(
    `>=${floor} text nodes: ${big.length} components; one distinct weight: ${monotone.length}; ` +
      `that weight is unset/400: ${monotone400.length} (repo ${monotone400.filter((r) => r.repo).length}); ` +
      `pages only: ${monotone400.filter((r) => r.page).length}`
  );
}

console.log('--- >=8 text nodes, single unset/400 weight ---');
for (const r of rows.filter((r) => r.texts >= 8 && r.weights.length === 1 && (r.weights[0] === 'unset' || /400|normal/.test(r.weights[0])))) {
  console.log(`  ${r.repo ? 'repo' : 'test'} ${r.project} ${r.component} texts=${r.texts} weights=${r.weights.join('|')}${r.page ? ' PAGE' : ''}`);
}
console.log('--- weight values seen ---');
const vals = new Map<string, number>();
for (const r of rows) for (const w of r.weights) vals.set(w, (vals.get(w) ?? 0) + 1);
console.log([...vals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => `${k}:${v}`).join('  '));
