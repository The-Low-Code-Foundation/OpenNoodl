/**
 * DSG-004 §2.4 — the premise check the spec asks for *before* the rule is
 * specced: is a hover state expressible at all, by the clients that would be
 * gated on it?
 */
import { loadCorpus, isRepoProject } from './corpus';
import { loadDefaultCatalog } from '../../../../packages/noodl-editor/src/editor/src/validation/catalog';

const catalog = loadDefaultCatalog();
const withHoverState = catalog
  .authorableTypeNames()
  .filter((t) => (catalog.getNode(t)?.visualStates ?? []).some((s: { name: string }) => s.name === 'hover'));

let interactive = 0;
let withStates = 0;
let withHover = 0;
let hoverSignalsWired = 0;
const projectsUsing = new Set<string>();

for (const p of loadCorpus()) {
  for (const c of p.components) {
    const clickable = new Set<string>();
    for (const conn of c.connections ?? []) {
      if (/^(click|hoverStart|hoverEnd|pointer)/i.test(conn.fromProperty)) clickable.add(conn.fromId);
      if (/^hover/i.test(conn.fromProperty)) hoverSignalsWired++;
    }
    for (const n of c.nodes as any[]) {
      const isControl = n.type === 'net.noodl.controls.button' || clickable.has(n.id);
      if (isControl) interactive++;
      const sp = n.stateParameters;
      if (sp && Object.keys(sp).length) {
        withStates++;
        if (sp.hover) {
          withHover++;
          projectsUsing.add(p.name + (isRepoProject(p) ? ' (repo)' : ''));
        }
      }
    }
  }
}

console.log(`node types declaring a "hover" visual state: ${withHoverState.length} — ${withHoverState.join(', ')}`);
console.log(`interactive nodes (Button, or a node with a click/pointer/hover wire out): ${interactive}`);
console.log(`nodes carrying stateParameters at all: ${withStates}`);
console.log(`nodes carrying stateParameters.hover: ${withHover}`);
console.log(`connections drawn out of a hover signal: ${hoverSignalsWired}`);
console.log(`projects using a hover state: ${[...projectsUsing].join(', ') || '(none)'}`);
