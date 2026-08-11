/**
 * DSG-004 §2.1 — exploratory census of horizontal Groups, before any threshold
 * is chosen. Prints the distribution the rule's two thresholds are picked from.
 *
 * Usage: npx ts-node -P scripts/tsconfig.json dev-docs/.../explore-rows.ts [--list]
 */
import { loadCorpus, isRepoProject, CorpusNode } from './corpus';
import { loadDefaultCatalog } from '../../../../packages/noodl-editor/src/editor/src/validation/catalog';

const LIST = process.argv.includes('--list');
const catalog = loadDefaultCatalog();
const COLUMNS = 'net.noodl.visual.columns';

function isVisual(type: string): boolean {
  if (type.startsWith('/') || type.startsWith('#')) return true; // component instance
  const n = catalog.getNode(type);
  return n ? !!n.isVisual : false;
}

const projects = loadCorpus();
let groups = 0;
let rowGroups = 0;
const rows: Array<{
  project: string;
  component: string;
  label: string;
  visualChildren: number;
  bigChildren: number;
  subtree: number;
  wrap: boolean;
  repeaterChild: boolean;
  columnsAncestor: boolean;
  minChild: number;
  medianChild: number;
  repo: boolean;
}> = [];

for (const p of projects) {
  for (const c of p.components) {
    const byId = new Map<string, CorpusNode>(c.nodes.map((n) => [n.id, n]));
    const parentOf = new Map<string, string>();
    for (const n of c.nodes) for (const ch of n.children ?? []) parentOf.set(ch, n.id);

    const sizeOf = (id: string, seen = new Set<string>()): number => {
      if (seen.has(id)) return 0;
      seen.add(id);
      const n = byId.get(id);
      if (!n) return 0;
      let s = 1;
      for (const ch of n.children ?? []) s += sizeOf(ch, seen);
      return s;
    };

    for (const n of c.nodes) {
      if (n.type !== 'Group') continue;
      groups++;
      const dir = n.parameters?.['flexDirection'];
      const wrap = n.parameters?.['flexWrap'] === 'wrap' || n.parameters?.['flexWrap'] === 'wrap-reverse';
      if (dir !== 'row') continue;
      rowGroups++;
      const childNodes = (n.children ?? []).map((id) => byId.get(id)).filter((x): x is CorpusNode => !!x);
      const visualChildren = childNodes.filter((ch) => isVisual(ch.type));
      const bigChildren = visualChildren.filter((ch) => sizeOf(ch.id) >= 2).length;
      const childSizes = visualChildren.map((ch) => sizeOf(ch.id)).sort((a, b) => a - b);
      const minChild = childSizes.length ? childSizes[0] : 0;
      const medianChild = childSizes.length ? childSizes[Math.floor(childSizes.length / 2)] : 0;
      const repeaterChild = childNodes.some((ch) => ch.type === 'For Each');
      let a = parentOf.get(n.id);
      let columnsAncestor = false;
      const guard = new Set<string>();
      while (a && !guard.has(a)) {
        guard.add(a);
        if (byId.get(a)?.type === COLUMNS) { columnsAncestor = true; break; }
        a = parentOf.get(a);
      }
      rows.push({
        project: p.name,
        component: c.name,
        label: n.label || n.id,
        visualChildren: visualChildren.length,
        bigChildren,
        subtree: sizeOf(n.id),
        wrap,
        repeaterChild,
        columnsAncestor,
        minChild,
        medianChild,
        repo: isRepoProject(p)
      });
    }
  }
}

console.log(`projects: ${projects.length} (repo ${projects.filter(isRepoProject).length})`);
console.log(`Group nodes: ${groups}; flexDirection=row: ${rowGroups}`);

const hist = (pick: (r: (typeof rows)[number]) => number, name: string) => {
  const counts = new Map<number, number>();
  for (const r of rows) counts.set(pick(r), (counts.get(pick(r)) ?? 0) + 1);
  console.log(
    name + ': ' + [...counts.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}:${v}`).join('  ')
  );
};
hist((r) => r.visualChildren, 'visual children');
hist((r) => r.bigChildren, 'children with subtree>=2');

for (const minKids of [2, 3]) {
  for (const minChild of [2, 3, 4, 5]) {
    const hits = rows.filter((r) => r.visualChildren >= minKids && r.minChild >= minChild && !r.columnsAncestor);
    console.log(
      `  visualChildren>=${minKids} & EVERY child subtree>=${minChild} & no Columns ancestor → ${hits.length} hits ` +
        `(${new Set(hits.map((h) => h.project)).size} projects; repo ${hits.filter((h) => h.repo).length})`
    );
  }
}
console.log(`wrapped rows: ${rows.filter((r) => r.wrap).length}`);
console.log(`rows with a For Each child: ${rows.filter((r) => r.repeaterChild).length}`);
console.log(`rows under a Columns: ${rows.filter((r) => r.columnsAncestor).length}`);

if (process.argv.includes('--repeaters')) {
  for (const r of rows.filter((x) => x.repeaterChild)) {
    console.log(
      `${r.repo ? 'repo ' : 'test '} ${r.project} ${r.component} "${r.label}" kids=${r.visualChildren} wrap=${r.wrap} cols=${r.columnsAncestor}`
    );
  }
}

if (LIST) {
  for (const r of rows
    .filter((r) => r.visualChildren >= 3 && r.minChild >= 3 && !r.columnsAncestor)
    .sort((a, b) => b.subtree - a.subtree)) {
    console.log(
      `${r.repo ? 'repo ' : 'test '} ${r.project} ${r.component} "${r.label}" kids=${r.visualChildren} min=${r.minChild} med=${r.medianChild} subtree=${r.subtree}${r.wrap ? ' WRAP' : ''}${r.repeaterChild ? ' REPEATER' : ''}`
    );
  }
}
