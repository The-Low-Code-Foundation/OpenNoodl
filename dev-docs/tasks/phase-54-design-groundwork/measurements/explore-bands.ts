/** DSG-004 §2.1, arm A — the 19 candidate bands with their own size parameters. */
import { loadCorpus, isRepoProject, CorpusNode } from './corpus';
import { loadDefaultCatalog } from '../../../../packages/noodl-editor/src/editor/src/validation/catalog';

const catalog = loadDefaultCatalog();
const isVisual = (t: string) => t.startsWith('/') || t.startsWith('#') || !!catalog.getNode(t)?.isVisual;

for (const p of loadCorpus()) {
  for (const c of p.components) {
    const byId = new Map<string, CorpusNode>(c.nodes.map((n) => [n.id, n]));
    const parentOf = new Map<string, string>();
    for (const n of c.nodes) for (const ch of n.children ?? []) parentOf.set(ch, n.id);
    const sizeOf = (id: string, seen = new Set<string>()): number => {
      if (seen.has(id)) return 0;
      seen.add(id);
      const n = byId.get(id);
      if (!n) return 0;
      return 1 + (n.children ?? []).reduce((a, ch) => a + sizeOf(ch, seen), 0);
    };
    for (const n of c.nodes) {
      if (n.type !== 'Group' || n.parameters?.['flexDirection'] !== 'row') continue;
      const kids = (n.children ?? []).map((id) => byId.get(id)).filter((x): x is CorpusNode => !!x).filter((k) => isVisual(k.type));
      if (kids.length < 3) continue;
      if (kids.some((k) => sizeOf(k.id) < 3)) continue;
      let a = parentOf.get(n.id), cols = false;
      const g = new Set<string>();
      while (a && !g.has(a)) { g.add(a); if (byId.get(a)?.type === 'net.noodl.visual.columns') { cols = true; break; } a = parentOf.get(a); }
      if (cols) continue;
      const q = n.parameters ?? {};
      console.log(
        `${isRepoProject(p) ? 'repo' : 'test'} ${p.name} ${c.name} "${n.label ?? n.id}" kids=${kids.length} ` +
        `sizeMode=${JSON.stringify(q['sizeMode'])} width=${JSON.stringify(q['width'])} justify=${JSON.stringify(q['justifyContent'])} gap=${JSON.stringify(q['columnGap'])}`
      );
    }
  }
}
