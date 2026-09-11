/**
 * DSG-004 §2.1, arm B — the wrapped row Group used as a grid.
 *
 * Prints the parameters of every wrapped row Group that parents a `For Each`,
 * so a *local* discriminator between "a grid of cards" and "a wrapped list of
 * chips" can be looked for rather than assumed.
 */
import { loadCorpus, isRepoProject, CorpusNode } from './corpus';

for (const p of loadCorpus()) {
  for (const c of p.components) {
    const byId = new Map<string, CorpusNode>(c.nodes.map((n) => [n.id, n]));
    for (const n of c.nodes) {
      if (n.type !== 'Group') continue;
      if (n.parameters?.['flexDirection'] !== 'row') continue;
      const wrap = n.parameters?.['flexWrap'];
      const kids = (n.children ?? []).map((id) => byId.get(id)).filter((x): x is CorpusNode => !!x);
      const rep = kids.find((k) => k.type === 'For Each');
      if (!rep) continue;
      const params = n.parameters ?? {};
      console.log(
        `${isRepoProject(p) ? 'repo' : 'test'} ${p.name} ${c.name} "${n.label ?? n.id}" wrap=${String(wrap)} ` +
          `width=${JSON.stringify(params['width'])} columnGap=${JSON.stringify(params['columnGap'])} ` +
          `sizeMode=${JSON.stringify(params['sizeMode'])} template=${JSON.stringify(rep.parameters?.['template'])}`
      );
    }
  }
}
