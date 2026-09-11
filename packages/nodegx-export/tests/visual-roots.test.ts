/**
 * Which node actually draws (EXP-002-RECORD-VERBS-TARGET-OUTPUT §18).
 *
 * `nodes.json` states its visual roots outright, and that list is what the runtime renders from:
 * it feeds `componentModel.roots`, and `componentinstance.ts:326` is
 * `return this._internal.roots[0].render();` — one root, the rest detached. The editor agrees,
 * sending "This node is detached from the main node tree and won't be rendered" against
 * roots[1..] (`graph-warnings.ts`), and re-derives the field on every save.
 *
 * The planner used to answer the question itself, from `n.parent === undefined` — while the tree
 * walk beside it read hierarchy from `children`. Two notions of the same thing in one function.
 * Across the 40-project corpus the two never disagreed about roots[0], so no emitted tree was
 * wrong; the export got the right answer because source order happened to put the real root
 * first. These tests are mostly the cases the corpus does not contain, built rather than found,
 * because "it works on everything we have" is what a latent defect looks like from inside.
 *
 * The other half of the slice: a node under a discarded root is not waiting on EXP-003 to grow a
 * generator — it never draws at all. It now defers with that verdict instead of `logic node (…)`,
 * the same distinction §17a drew for the record verbs that always fail.
 */
import * as fs from 'fs';
import * as path from 'path';

import { Catalog, CatalogIndex, loadCatalog } from '../src/catalog';
import { planProject } from '../src/analyze/plan';
import { parseProject } from '../src/parse/parseProject';
import { ComponentIR, ExportIR, NodeIR } from '../src/ir/types';

const FIXTURE = path.join(__dirname, 'fixtures', 'puppy-test-3');

const catalog: Catalog = loadCatalog();
const index = new CatalogIndex(catalog);
const baseIr = parseProject(FIXTURE, catalog);

const CARD = 'Components/PuppyCard';
const DETACHED = /detached from the node tree/;

const cloneIr = (): ExportIR => structuredClone(baseIr);
const componentOf = (source: ExportIR, componentPath: string): ComponentIR =>
  source.components.find((c) => c.path === componentPath)!;
const planOf = (source: ExportIR, componentPath: string) =>
  planProject(source, index).plans.find((p) => p.path === componentPath)!;
const reasonFor = (source: ExportIR, componentPath: string, nodeId: string): string => {
  const disp = planOf(source, componentPath).dispositions[nodeId] as { reason?: string; kind: string };
  return disp?.reason ?? disp?.kind ?? '(absent)';
};

/** A parentless visual node, prepended so source order and the declared list disagree. */
const prependRoot = (source: ExportIR, componentPath: string, id: string, type = 'Group'): NodeIR => {
  const node: NodeIR = {
    id,
    type,
    catalogRef: type,
    parameters: [],
    declaredPorts: [],
    portKnowledge: 'complete'
  };
  componentOf(source, componentPath).nodes.unshift(node);
  return node;
};

// ---------------------------------------------------------------------------------------------
// The file's own answer wins — the case the corpus does not contain
// ---------------------------------------------------------------------------------------------

describe('the declared visualRoots decide what draws', () => {
  it('renders the declared root even when another visual node comes first in source order', () => {
    const ir = cloneIr();
    prependRoot(ir, CARD, 'impostor-root');
    // The file still says card-3 draws. Source order now says otherwise.
    expect(componentOf(ir, CARD).visualRoots).toEqual(['card-3']);
    expect(componentOf(ir, CARD).nodes[0].id).toBe('impostor-root');

    expect(planOf(ir, CARD).rootId).toBe('card-3');
  });

  it('the parentless rule alone would have picked the impostor — so the assertion above bites', () => {
    // The control for the test above: with the declared list removed, the planner falls back and
    // does choose the wrong node. Without this row, "rootId === card-3" could pass for any reason.
    const ir = cloneIr();
    prependRoot(ir, CARD, 'impostor-root');
    delete componentOf(ir, CARD).visualRoots;

    expect(planOf(ir, CARD).rootId).toBe('impostor-root');
  });

  it('falls back to the parentless rule for files that predate the field', () => {
    const ir = cloneIr();
    delete componentOf(ir, CARD).visualRoots;

    // card-3 is the only parentless visual node, so the fallback still finds it.
    expect(planOf(ir, CARD).rootId).toBe('card-3');
  });

  it('reads hierarchy the file expresses only through children[]', () => {
    // Two corpus components carry `children` with no `parent` at all. Under the old rule every
    // node in such a file reads as parentless, so the component looked like it had one visual
    // root per node; the declared list collapses that back to the truth.
    const ir = cloneIr();
    const card = componentOf(ir, CARD);
    for (const node of card.nodes) delete node.parent;

    const parentless = card.nodes.filter((n) => n.parent === undefined).length;
    expect(parentless).toBeGreaterThan(1); // the shape that used to invent roots

    const plan = planOf(ir, CARD);
    expect(plan.rootId).toBe('card-3');
    // Nothing is detached: the whole tree is still reachable from the one declared root.
    expect(Object.values(plan.dispositions).filter((d: any) => DETACHED.test(d.reason ?? ''))).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------------------------
// Detached nodes get the runtime's verdict, not the catch-all
// ---------------------------------------------------------------------------------------------

describe('a node under a discarded root never draws', () => {
  it('names the detachment instead of deferring to EXP-003 as a logic node', () => {
    const ir = cloneIr();
    prependRoot(ir, CARD, 'stray-button', 'net.noodl.controls.button');
    componentOf(ir, CARD).visualRoots = ['card-3', 'stray-button'];

    expect(reasonFor(ir, CARD, 'stray-button')).toMatch(DETACHED);
    expect(reasonFor(ir, CARD, 'stray-button')).not.toMatch(/logic node/);
  });

  it('the catch-all is what it replaces — the same node undeclared falls to logic node (…)', () => {
    // Names the ground: without the declaration the node is simply an unreferenced button, and
    // the old reason is what comes back. A pass that could not produce `logic node (…)` here
    // would make the row above vacuous.
    const ir = cloneIr();
    prependRoot(ir, CARD, 'stray-button', 'net.noodl.controls.button');

    expect(reasonFor(ir, CARD, 'stray-button')).toMatch(/logic node \(net\.noodl\.controls\.button\)/);
  });

  it('carries the verdict down the detached subtree, not just to the root of it', () => {
    const ir = cloneIr();
    const stray = prependRoot(ir, CARD, 'stray-group');
    stray.children = ['stray-text'];
    prependRoot(ir, CARD, 'stray-text', 'Text');
    componentOf(ir, CARD).visualRoots = ['card-3', 'stray-group'];

    expect(reasonFor(ir, CARD, 'stray-group')).toMatch(DETACHED);
    expect(reasonFor(ir, CARD, 'stray-text')).toMatch(DETACHED);
  });

  it('does not claim a count, because the two sides disagree about what a visual root is', () => {
    // `Puppy test`'s Home2 declares a `Page Stack` root: the editor's `allowAsChild` accepted it,
    // this side's `isVisual` rejects it. A message quoting "N visual roots" would state one
    // predicate's answer as the other's. The claim that matters needs no number.
    const ir = cloneIr();
    prependRoot(ir, CARD, 'stray-button', 'net.noodl.controls.button');
    componentOf(ir, CARD).visualRoots = ['card-3', 'stray-button'];

    expect(reasonFor(ir, CARD, 'stray-button')).not.toMatch(/\d/);
  });

  it('a declared root that is also a child of the first root still draws', () => {
    // Two corpus Apps declare roots that are ALSO children of roots[0]. Rendering roots[0]
    // renders them, so they are not detached — what draws wins over what does not.
    const ir = cloneIr();
    componentOf(ir, CARD).visualRoots = ['card-3', 'body-2'];

    const plan = planOf(ir, CARD);
    expect(plan.dispositions['body-2']).toEqual({ kind: 'static' });
    expect(reasonFor(ir, CARD, 'body-2')).not.toMatch(DETACHED);
  });

  it('leaves a well-formed single-root component untouched', () => {
    const plan = planOf(cloneIr(), CARD);
    const detached = Object.values(plan.dispositions).filter((d: any) => DETACHED.test(d.reason ?? ''));
    expect(detached).toHaveLength(0);
    expect(plan.rootId).toBe('card-3');
  });
});

// ---------------------------------------------------------------------------------------------
// The parse side
// ---------------------------------------------------------------------------------------------

describe('parseProject carries the field', () => {
  it('reads visualRoots off nodes.json', () => {
    expect(componentOf(baseIr, CARD).visualRoots).toEqual(['card-3']);
  });

  it('keeps an empty list distinct from an absent one', () => {
    // `visualRoots: []` says "this component draws nothing"; an absent field says "this file
    // predates the question". Collapsing them would make the planner guess a root for a
    // component the author deliberately emptied.
    const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'nodegx-visualroots-'));
    const compDir = path.join(dir, 'components', 'Empty');
    fs.mkdirSync(compDir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'nodegx.project.json'),
      JSON.stringify({ name: 'Empty project', structure: { componentsDir: 'components' } })
    );
    fs.writeFileSync(
      path.join(compDir, 'component.json'),
      JSON.stringify({ id: 'empty-1', name: 'Empty', path: '/Empty', type: 'component' })
    );
    fs.writeFileSync(
      path.join(compDir, 'nodes.json'),
      JSON.stringify({ nodes: [{ id: 'g', type: 'Group' }], visualRoots: [] })
    );

    const parsed = parseProject(dir, catalog);
    const empty = parsed.components.find((c) => c.path === 'Empty')!;
    expect(empty.visualRoots).toEqual([]);

    // And the planner honours it: nothing draws, so there is no root and no file.
    const plan = planProject(parsed, index).plans.find((p) => p.path === 'Empty')!;
    expect(plan.rootId).toBeNull();
    expect(plan.file).toBeNull();

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('ignores a visualRoots that is not a list, rather than trusting it', () => {
    // `Array.isArray` here is not decoration. A truthiness test would let a malformed field
    // through — `[]` is truthy, so an empty list survives either way, and only a non-array value
    // tells the two apart. Without the check the planner calls `.map` on it and the whole
    // component throws; with it, the file is treated as one that never stated an answer.
    const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'nodegx-visualroots-bad-'));
    const compDir = path.join(dir, 'components', 'Bad');
    fs.mkdirSync(compDir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'nodegx.project.json'),
      JSON.stringify({ name: 'Bad project', structure: { componentsDir: 'components' } })
    );
    fs.writeFileSync(
      path.join(compDir, 'component.json'),
      JSON.stringify({ id: 'bad-1', name: 'Bad', path: '/Bad', type: 'component' })
    );
    fs.writeFileSync(
      path.join(compDir, 'nodes.json'),
      JSON.stringify({ nodes: [{ id: 'g', type: 'Group' }], visualRoots: 'card-3' })
    );

    const parsed = parseProject(dir, catalog);
    const bad = parsed.components.find((c) => c.path === 'Bad')!;
    expect(bad.visualRoots).toBeUndefined();

    // And the fallback still finds the one parentless visual node.
    expect(planProject(parsed, index).plans.find((p) => p.path === 'Bad')!.rootId).toBe('g');

    fs.rmSync(dir, { recursive: true, force: true });
  });
});
