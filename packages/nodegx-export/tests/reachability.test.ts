/**
 * Which components a route can reach (EXP-002-RECORD-VERBS-TARGET §20, `src/analyze/reach.ts`).
 *
 * The measurement that motivated this: over the 40-project corpus, **904 of 4,441 nodes (20.4%)
 * live in components nothing reaches, and they hold 432 of the 666 deferrals (64.9%)** — so the
 * export's headline 85.00% and its reach over code that actually runs (93.38%) are two different
 * numbers, and only one of them is about the export. Three handoffs in a row put a wall at the top
 * of the list whose every node is inside a downloaded filter kit that no project ever places.
 *
 * The tests are mostly built rather than found, because the interesting cases are the ones that
 * would make the report *wrong*: a live component called dead. Each edge kind is broken separately
 * — if a For Each's `template` stopped counting as an edge, only the test that removes that one
 * parameter goes red, and the fixture's other paths to the same component would otherwise hide it.
 *
 * 🔴 The regression guard that cost the most to learn is `route through the sheet-marked name`.
 * `components/__page__/Home` is named `/#__page__/Home`; a join built on folder names instead of
 * `component.json`'s `path` makes nine of the corpus's forty projects look like they have
 * unresolvable routes and no exported pages. There is no such defect. The paired test deletes the
 * route to prove the component's reachability really does come from it.
 */
import * as fs from 'fs';
import * as path from 'path';

import { Catalog } from '../src/catalog';
import { componentReachability } from '../src/analyze/reach';
import { emitApp } from '../src/emit/emitApp';
import { parseProject } from '../src/parse/parseProject';
import { ComponentIR, ExportIR, NodeIR } from '../src/ir/types';

const CATALOG_PATH = path.join(__dirname, '..', '..', 'noodl-types', 'src', 'node-catalog.json');
const catalog: Catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));

const puppyIr = parseProject(path.join(__dirname, 'fixtures', 'puppy-test-3'), catalog);
const cheerIr = parseProject(path.join(__dirname, 'fixtures', 'cheer'), catalog);

const clone = (source: ExportIR): ExportIR => structuredClone(source);
const componentOf = (source: ExportIR, componentPath: string): ComponentIR =>
  source.components.find((c) => c.path === componentPath)!;
const nodeOfType = (source: ExportIR, componentPath: string, type: string): NodeIR =>
  componentOf(source, componentPath).nodes.find((n) => n.type === type)!;

/** The five probe components the fixture holds and never places, in `ir.components` order. */
const PUPPY_UNREACHED = [
  '/Components/BenchEmitter',
  '/Components/BenchLogicProbe',
  '/Components/BenchProbe',
  '/Components/BenchProbeNoDefault',
  '/Components/Custom text'
];

describe('component reachability', () => {
  // The control pair: one fixture where every component is placed and one where five are not.
  // Both arms run the same walk, so "it found something" and "it did not" are the same code
  // answering differently — an all-unreachable bug fails the cheer arm, an all-reachable one
  // fails the puppy arm, and neither can pass both.
  it('answers "nothing is orphaned" for a project whose components are all placed', () => {
    const result = componentReachability(cheerIr);
    expect(result.inconclusive).toBeNull();
    expect(result.unreachable).toEqual([]);
  });

  it('names exactly the components no route reaches, and leaves the rest alone', () => {
    const result = componentReachability(puppyIr);
    expect(result.inconclusive).toBeNull();
    expect(result.unreachable).toEqual(PUPPY_UNREACHED);
    // The complement is the assertion that matters for the report: a page, the app shell and the
    // repeater's row component are all live, so "unreachable" is not standing in for "not a page".
    expect(result.unreachable).not.toContain('/App');
    expect(result.unreachable).not.toContain('/Pages/Landing');
    expect(result.unreachable).not.toContain('/Components/PuppyCard');
  });

  it('resolves a route written in the sheet-marked legacy form', () => {
    // `/#__page__/Home` is the component in `components/__page__/Home`. Joining on the folder
    // name instead breaks this, and breaks it silently — the component simply reads as an orphan.
    expect(componentReachability(puppyIr).unreachable).not.toContain('/#__page__/Home');
  });

  it('and that page is reachable BECAUSE of the route, not by accident', () => {
    // This is the test that found the defect it now guards. Dropping the route left the page
    // reachable, because the walk was also reading the App shell's own `pages` parameter — a
    // second copy of the route list, reached as an ordinary instantiation edge. Routes are roots
    // and come from `RouterIR` alone now, so removing one really does remove the page.
    const ir = clone(puppyIr);
    ir.project.routers[0].routes = ir.project.routers[0].routes.filter((r) => r !== '/#__page__/Home');
    expect(componentReachability(ir).unreachable).toContain('/#__page__/Home');
  });

  it('and a Router node cannot re-route a page through its own parameter blob', () => {
    // The direct statement of the same rule, so it survives a rewrite of the test above: with the
    // route gone from RouterIR, the parameter that still lists it must buy nothing.
    const ir = clone(puppyIr);
    ir.project.routers[0].routes = [];
    delete ir.project.routers[0].startPage;
    const router = nodeOfType(ir, 'App', 'Router');
    expect(JSON.stringify(router.parameters)).toContain('/#__page__/Home');
    expect(componentReachability(ir).unreachable).toContain('/#__page__/Home');
    expect(componentReachability(ir).unreachable).toContain('/Pages/Landing');
  });

  it("counts a For Each's template as an edge", () => {
    // PuppyCard is reached only through Pages/Landing's repeater — no node instantiates it by
    // type — so dropping the parameter is a clean test of that one edge kind.
    const ir = clone(puppyIr);
    const forEach = nodeOfType(ir, 'Pages/Landing', 'For Each');
    forEach.parameters = forEach.parameters.filter((p) => p.name !== 'template');
    expect(componentReachability(ir).unreachable).toContain('/Components/PuppyCard');
  });

  it('counts a component instance as an edge', () => {
    const ir = clone(puppyIr);
    const landing = componentOf(ir, 'Pages/Landing');
    landing.nodes.push({
      id: 'places-the-probe',
      type: '/Components/BenchProbe',
      catalogRef: null,
      parameters: [],
      declaredPorts: [],
      portKnowledge: 'complete'
    });
    expect(componentReachability(ir).unreachable).not.toContain('/Components/BenchProbe');
  });

  it('reaches transitively, so placing a component places what it places', () => {
    const ir = clone(puppyIr);
    // BenchEmitter is unreachable; give it a child that is also unreachable, then place only
    // BenchEmitter. Both must come live, or the walk is one hop deep.
    componentOf(ir, 'Components/BenchEmitter').nodes.push({
      id: 'emitter-places-probe',
      type: '/Components/BenchProbe',
      catalogRef: null,
      parameters: [],
      declaredPorts: [],
      portKnowledge: 'complete'
    });
    expect(componentReachability(ir).unreachable).toEqual(expect.arrayContaining(['/Components/BenchProbe']));

    componentOf(ir, 'Pages/Landing').nodes.push({
      id: 'landing-places-emitter',
      type: '/Components/BenchEmitter',
      catalogRef: null,
      parameters: [],
      declaredPorts: [],
      portKnowledge: 'complete'
    });
    const after = componentReachability(ir).unreachable;
    expect(after).not.toContain('/Components/BenchEmitter');
    expect(after).not.toContain('/Components/BenchProbe');
  });
});

describe('when reachability cannot be decided', () => {
  it('refuses to answer when a reachable For Each picks its row component by script', () => {
    const ir = clone(puppyIr);
    const forEach = nodeOfType(ir, 'Pages/Landing', 'For Each');
    forEach.parameters.push({ name: 'templateType', value: { kind: 'literal', value: 'dynamic' } });
    const result = componentReachability(ir);
    expect(result.unreachable).toEqual([]);
    expect(result.inconclusive).toContain('Pages/Landing');
    expect(result.inconclusive).toContain('chosen by a script');
  });

  it('but a dynamic For Each in an UNREACHABLE component changes nothing', () => {
    // The negative control, and the shape the corpus actually has: every dynamic template in the
    // 40 projects sits inside the unplaced filter kit, so it never runs and cannot rescue
    // anything. Without this arm the guard above would look like "any dynamic template anywhere".
    const ir = clone(puppyIr);
    const probe = componentOf(ir, 'Components/BenchProbe');
    probe.nodes.push({
      id: 'dynamic-in-dead-code',
      type: 'For Each',
      catalogRef: 'For Each',
      parameters: [{ name: 'templateType', value: { kind: 'literal', value: 'dynamic' } }],
      declaredPorts: [],
      portKnowledge: 'partial'
    });
    const result = componentReachability(ir);
    expect(result.inconclusive).toBeNull();
    expect(result.unreachable).toEqual(PUPPY_UNREACHED);
  });

  it("does not treat an 'explicit' templateType as dynamic", () => {
    // foreach.tsx:496 — absent and 'explicit' both read the static `template` input. One corpus
    // repeater authors 'explicit' outright, and reading it as dynamic would silence the report
    // for that whole project.
    const ir = clone(puppyIr);
    const forEach = nodeOfType(ir, 'Pages/Landing', 'For Each');
    forEach.parameters.push({ name: 'templateType', value: { kind: 'literal', value: 'explicit' } });
    const result = componentReachability(ir);
    expect(result.inconclusive).toBeNull();
    expect(result.unreachable).toEqual(PUPPY_UNREACHED);
  });

  it('refuses to answer when the project has no Router, rather than calling every component dead', () => {
    const ir = clone(puppyIr);
    ir.project.routers = [];
    const result = componentReachability(ir);
    expect(result.unreachable).toEqual([]);
    expect(result.inconclusive).toContain('no Router');
  });

  it('refuses to answer when no route names a component the project has', () => {
    const ir = clone(puppyIr);
    ir.project.routers[0].routes = ['/Pages/Deleted'];
    delete ir.project.routers[0].startPage;
    // The Router's own component is a root, so this only reaches the shell — but the honest
    // report is still "there is no root to walk from", not "eleven components are dead".
    ir.project.routers[0].componentPath = 'Nothing/Here';
    const result = componentReachability(ir);
    expect(result.unreachable).toEqual([]);
    expect(result.inconclusive).toContain('no root to walk from');
  });
});

describe('the export report', () => {
  const app = emitApp(puppyIr, catalog);
  const unreachableNotes = app.notes.filter((n) => n.includes('no route reaches this component'));

  it('names each unreachable component once, and no reachable one', () => {
    // Cardinality, not just presence: two producers meeting at one list is how a count doubles
    // while every assertion still passes.
    expect(unreachableNotes).toHaveLength(PUPPY_UNREACHED.length);
    for (const legacy of PUPPY_UNREACHED) {
      expect(unreachableNotes.filter((n) => n.startsWith(`${legacy.replace(/^\//, '')}:`))).toHaveLength(1);
    }
    expect(unreachableNotes.some((n) => n.includes('PuppyCard'))).toBe(false);
  });

  it('says what the note means for the rest of the report', () => {
    expect(unreachableNotes[0]).toContain('nothing in the running app renders it');
  });

  it('emits no such note for a project whose components are all placed', () => {
    expect(emitApp(cheerIr, catalog).notes.filter((n) => n.includes('no route reaches'))).toEqual([]);
  });

  it('reports and does not act — the unreachable components are still emitted', () => {
    // The rule the note depends on: this is a statement about the author's project, not a licence
    // for the export to drop code. An export that started skipping them would make the note true
    // and the output wrong.
    expect(app.files['src/components/BenchProbe.tsx']).toBeDefined();
    expect(app.files['src/components/BenchEmitter.tsx']).toBeDefined();
  });
});
