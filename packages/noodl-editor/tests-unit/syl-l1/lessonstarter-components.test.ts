/**
 * P79 L1 + G3 — `derive_starter` and the component the learner creates.
 *
 * Lesson 8 (`snacks`) was the first spine lesson whose learner creates a
 * component, and its first derivation shipped a starter with an EMPTY `/Snack`
 * in it: every node graded, every node subtracted, the directory and the
 * registry entry copied across untouched. The chain gate refused it — correctly,
 * an empty `/Snack` is not lesson 7's app — and it was finished by hand.
 *
 * 🔴 **Two lessons look identical at the moment a component empties and want
 * opposite starters**, so every block here is a pair:
 *
 * - *"make a Snack component"* — nothing else refers to it ⇒ **dropped**;
 * - *"build the Home page"* — the router lists it, or a node places it ⇒ **kept,
 *   empty**, because the learner is filling in something that exists.
 *
 * And G3, found in the same tool: a `connection` condition whose endpoint an
 * earlier step already removed used to read *"no such wire exists in the
 * solution"* — the identical sentence a typo'd port name produces. The three
 * absences are now three sentences, and each is asserted by its reason.
 */

import { deriveLessonStarter } from '../../src/editor/src/models/lessonstarter';
import { buildLessonEvalContext } from '../../src/editor/src/models/lessonprojectcontext';
import type {
  LessonProjectComponentFiles,
  LessonProjectSource
} from '../../src/editor/src/models/lessonprojectcontext';
import { compileConditions } from '../../src/editor/src/models/lessonformat';
import type { LessonManifest } from '../../src/editor/src/models/lessonformat';
import { evalConditionsWithContext } from '../../src/editor/src/views/lessons/lessonevalconditions';
import type { ConnectionV2, NodeV2 } from '../../src/editor/src/schemas';

// ─── Fixtures ───────────────────────────────────────────────────────────────

function component(
  registryPath: string,
  legacyName: string,
  nodes: NodeV2[],
  connections: ConnectionV2[] = []
): LessonProjectComponentFiles {
  return {
    registryPath,
    component: { id: registryPath, name: registryPath.split('/').pop() as string, path: legacyName, type: 'visual' },
    nodes: { componentId: registryPath, nodes, visualRoots: nodes.length ? [nodes[0].id] : [] },
    connections: { componentId: registryPath, connections }
  };
}

const HOME = '/#__page__/Home';
const SNACK = '/Snack';

/**
 * Lesson 8's shape, small: a Home page whose Repeater places `/Snack`, and a
 * `/Snack` component of a Group, a Text and a Component Inputs wired to it.
 */
function snacksSolution(): LessonProjectSource {
  return {
    rootNodeId: 'router-1',
    components: [
      component('App', '/App', [
        { id: 'router-1', type: 'Router', label: 'Main', parameters: { pages: { startPage: HOME, routes: [HOME] } } }
      ]),
      component('__page__/Home', HOME, [
        { id: 'page-1', type: 'Page', children: ['menu-1'] },
        { id: 'menu-1', type: 'For Each', label: 'Menu', parameters: { template: SNACK }, parent: 'page-1' }
      ]),
      component(
        'Snack',
        SNACK,
        [
          { id: 'row-1', type: 'Group', label: 'Snack row', children: ['name-1'] },
          { id: 'name-1', type: 'Text', label: 'Name', parent: 'row-1' },
          { id: 'inputs-1', type: 'Component Inputs', label: 'Fields' }
        ],
        [{ fromId: 'inputs-1', fromProperty: 'name', toId: 'name-1', toProperty: 'text' }]
      ),
      // Empty in the SOLUTION — a control: nothing subtracted it, so nothing may drop it.
      component('Spare', '/Spare', [])
    ]
  };
}

function stepHolds(source: LessonProjectSource, manifest: LessonManifest, stepIndex: number): boolean {
  const step = manifest.steps[stepIndex];
  const compiled = compileConditions(step.completeWhen, `step ${stepIndex}`);
  return evalConditionsWithContext(compiled, buildLessonEvalContext(source));
}

function lesson(...completeWhen: LessonManifest['steps'][number]['completeWhen'][]): LessonManifest {
  return {
    format: 'noodl-lesson@1',
    title: 'A lesson',
    steps: completeWhen.map((c, i) => ({ title: `Step ${i + 1}`, body: 'Do the thing.', completeWhen: c }))
  };
}

const DESIGN_SNACK = [
  { node: `${SNACK}:#Snack row`, hasType: 'Group' },
  { node: `${SNACK}:#Snack row:#Name`, hasType: 'Text' }
];
const WIRE_SNACK = [
  { node: `${SNACK}:#Fields`, hasType: 'Component Inputs' },
  { connection: { from: `${SNACK}:#Fields`, fromPort: 'name', to: `${SNACK}:#Snack row:#Name`, toPort: 'text' } }
];
const PLACE_SNACK = [
  { node: `${HOME}:%Page:#Menu`, hasType: 'For Each' },
  { node: `${HOME}:%Page:#Menu`, paramsEqual: { template: SNACK } }
];

function starterOf(result: ReturnType<typeof deriveLessonStarter>): LessonProjectSource {
  expect(result.ok).toBe(true);
  return result.starter as LessonProjectSource;
}

// ─── L1: the component the learner creates ──────────────────────────────────

describe('L1 — a component every node of which was subtracted', () => {
  it('is DROPPED when nothing left in the project refers to it — the learner is creating it', () => {
    const solution = snacksSolution();
    const manifest = lesson(DESIGN_SNACK, WIRE_SNACK, PLACE_SNACK);

    // The arm that makes the other arm mean something: every step holds against the solution.
    for (const i of [0, 1, 2]) expect(stepHolds(solution, manifest, i)).toBe(true);

    const result = deriveLessonStarter(solution, manifest);
    const starter = starterOf(result);
    for (const i of [0, 1, 2]) expect(stepHolds(starter, manifest, i)).toBe(false);

    // 🔴 Not "Snack is empty". Snack is NOT THERE — that is the whole row.
    expect(starter.components.map((c) => c.registryPath).sort()).toEqual(['App', 'Spare', '__page__/Home']);
    expect(result.removedComponents).toEqual(['Snack']);

    // Reported once, against the step that removed the last of it, and by reason.
    const dropped = result.retractions.filter((r) => r.kind === 'remove-component');
    expect(dropped).toHaveLength(1);
    expect(dropped[0].step).toBe(1); // Fields went in step 2 (index 1); the row and the Text in step 1
    expect(dropped[0].detail).toContain('dropped "/Snack"');
    expect(dropped[0].detail).toContain('nothing else in the project refers to it');

    // And the page it was placed from survived, minus the Repeater the lesson grades.
    const home = starter.components.find((c) => c.registryPath === '__page__/Home');
    expect(home?.nodes.nodes.map((n) => n.id)).toEqual(['page-1']);
  });

  it('is KEPT, empty, when a Repeater still names it in a parameter — and the retraction says which', () => {
    const solution = snacksSolution();
    // No step grades the Repeater, so `Menu` keeps `template: "/Snack"`.
    const manifest = lesson(DESIGN_SNACK, WIRE_SNACK);

    const result = deriveLessonStarter(solution, manifest);
    const starter = starterOf(result);

    const snack = starter.components.find((c) => c.registryPath === 'Snack');
    expect(snack).toBeDefined();
    expect(snack?.nodes.nodes).toEqual([]);
    expect(snack?.connections.connections).toEqual([]);
    expect(result.removedComponents).toEqual([]);
    expect(result.retractions.some((r) => r.kind === 'remove-component')).toBe(false);

    // 🔴 The reading taken is written down, so an author whose lesson is the
    // inconsistent shape (create a component a page already places) can act.
    const kept = result.retractions.find((r) => r.detail.includes('EMPTY component'));
    expect(kept?.kind).toBe('unsupported');
    expect(kept?.detail).toContain('names it in "template"');
    expect(kept?.detail).toContain('grade that reference too');
  });

  it('is KEPT when a node on a page is an instance of it', () => {
    const solution = snacksSolution();
    const home = solution.components.find((c) => c.registryPath === '__page__/Home') as LessonProjectComponentFiles;
    home.nodes.nodes[0].children = ['menu-1', 'instance-1'];
    home.nodes.nodes.push({ id: 'instance-1', type: SNACK, label: 'One snack', parent: 'page-1' });

    const result = deriveLessonStarter(solution, lesson(DESIGN_SNACK, WIRE_SNACK, PLACE_SNACK));
    const starter = starterOf(result);

    expect(starter.components.some((c) => c.registryPath === 'Snack')).toBe(true);
    expect(result.removedComponents).toEqual([]);
    const kept = result.retractions.find((r) => r.detail.includes('EMPTY component'));
    expect(kept?.detail).toContain('"One snack"');
    expect(kept?.detail).toContain('is an instance of it');
  });

  it('is KEPT when a router lists it as a page — "build the Home page" is a lesson', () => {
    const solution = snacksSolution();
    // `exists: true` on the Page removes everything on Home.
    const manifest = lesson([{ node: `${HOME}:%Page`, exists: true }]);
    expect(stepHolds(solution, manifest, 0)).toBe(true);

    const result = deriveLessonStarter(solution, manifest);
    const starter = starterOf(result);
    expect(stepHolds(starter, manifest, 0)).toBe(false);

    const home = starter.components.find((c) => c.registryPath === '__page__/Home');
    expect(home?.nodes.nodes).toEqual([]);
    expect(result.removedComponents).toEqual([]);
    const kept = result.retractions.find((r) => r.detail.includes('EMPTY component'));
    expect(kept?.detail).toContain('lists it as a page');
  });

  it('never touches a component that was already empty in the solution', () => {
    const solution = snacksSolution();
    const result = deriveLessonStarter(solution, lesson(DESIGN_SNACK, WIRE_SNACK, PLACE_SNACK));
    const starter = starterOf(result);

    // `Spare` had nothing to subtract, so it is neither dropped nor reported.
    expect(starter.components.some((c) => c.registryPath === 'Spare')).toBe(true);
    expect(result.retractions.some((r) => r.detail.includes('Spare'))).toBe(false);
  });

  it('does not mutate the solution when it drops a component', () => {
    const solution = snacksSolution();
    const before = JSON.stringify(solution);
    const result = deriveLessonStarter(solution, lesson(DESIGN_SNACK, WIRE_SNACK, PLACE_SNACK));
    expect(result.removedComponents).toEqual(['Snack']);
    expect(JSON.stringify(solution)).toBe(before);
  });
});

// ─── G3: three absences, three sentences ────────────────────────────────────

describe('G3 — a connection condition whose wire is not there to remove', () => {
  it('says which step took the endpoint when an earlier hasType removed it — not "no such wire"', () => {
    const solution = snacksSolution();
    const manifest = lesson(
      [{ node: `${SNACK}:#Fields`, hasType: 'Component Inputs' }],
      [{ connection: { from: `${SNACK}:#Fields`, fromPort: 'name', to: `${SNACK}:#Snack row:#Name`, toPort: 'text' } }]
    );
    // The wire IS in the solution — otherwise the sentence under test is the right one.
    expect(stepHolds(solution, manifest, 1)).toBe(true);

    const result = deriveLessonStarter(solution, manifest);
    const wire = result.retractions.find((r) => r.step === 1);
    expect(wire?.kind).toBe('remove-connection');
    expect(wire?.detail).toContain('went when Step 1 removed "/Snack:#Fields"');
    expect(wire?.detail).not.toContain('no name → text wire');
  });

  it('lists the wires that DO exist when the port name matches none of them — the typo case', () => {
    const solution = snacksSolution();
    const manifest = lesson([
      { connection: { from: `${SNACK}:#Fields`, fromPort: 'nmae', to: `${SNACK}:#Snack row:#Name`, toPort: 'text' } }
    ]);

    const result = deriveLessonStarter(solution, manifest);
    // Nothing to subtract, nothing satisfied: the derivation succeeds and the F2 replay will refuse the step.
    expect(result.retractions).toHaveLength(1);
    expect(result.retractions[0].kind).toBe('unsupported');
    expect(result.retractions[0].detail).toContain('no nmae → text wire exists');
    expect(result.retractions[0].detail).toContain('the wires that do: name → text');
    expect(result.retractions[0].detail).toContain('typo');
  });

  it('says the two nodes are not wired at all when they are not', () => {
    const solution = snacksSolution();
    const manifest = lesson([
      { connection: { from: `${SNACK}:#Snack row`, fromPort: 'onClick', to: `${SNACK}:#Fields`, toPort: 'name' } }
    ]);

    const result = deriveLessonStarter(solution, manifest);
    expect(result.retractions[0].kind).toBe('unsupported');
    expect(result.retractions[0].detail).toContain('not wired to each other at all');
    expect(result.retractions[0].detail).not.toContain('the wires that do');
  });

  it('says a wire two steps both grade was already removed by the first', () => {
    const solution = snacksSolution();
    const wire = {
      connection: { from: `${SNACK}:#Fields`, fromPort: 'name', to: `${SNACK}:#Snack row:#Name`, toPort: 'text' }
    };
    const result = deriveLessonStarter(solution, lesson([wire], [wire]));
    expect(result.retractions.map((r) => r.kind)).toEqual(['remove-connection', 'remove-connection']);
    expect(result.retractions[0].detail).toContain('removed the name → text wire');
    expect(result.retractions[1].detail).toContain('already removed by an earlier step');
  });
});
