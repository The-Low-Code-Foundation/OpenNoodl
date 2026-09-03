/**
 * EXP-013 AC3/AC4/AC5 — a refusal cascades, and the export says so, by node, with the root named.
 *
 * ## What was measured before this existed (the reverted arm, `probe13-reverted.log`)
 *
 * `tests/fixtures/task-desk` — a button fires a `Run Tasks` (no rule), whose `Done` calls a
 * `Cloud Function` whose `Done` navigates, and whose `Completed` fires a `Set Variable` fed by a
 * `String` and read by a `Text` through a `Variable` — produced **seven notes and not one named
 * the Run Tasks node**: its id appeared only inside dropped-wire keys, which the unreported-
 * deferral sweep takes as the node having been reported. The five nodes behind it were refused
 * as three different sentences (*"the trigger is not a rendered element event or a receiver"*,
 * the catch-all *"logic node (RouterNavigate)"*, *"no static binding"*), none pointing at the
 * root. The pre-flight said `Pages/Tasks — 7 refusals`.
 *
 * ## The rows here
 *
 * - **Cardinality** — the headline the modal prints is *"N the export has no rule for, M more
 *   silenced by them"*, and the cheap mistake is to count a silenced node on both sides. So:
 *   `task-desk` reads **1 + 5, never 6**; `quiet-desk` **1 + 3**; and on every fixture
 *   `unsilenced + silenced` is the number of refused nodes.
 * - **The root, not the intermediate** — `goHome` is fired by `sync`, which is fired by `tasks`;
 *   its cause is `tasks`. A one-hop attribution would name `sync`.
 * - **The verdict** turns on the pathway family: `task-desk` trips (a backend verb and a
 *   navigation are silenced), `quiet-desk` does not (a `Set Variable`, a constant and a store).
 * - **Two readers, one set of rows** — the report and the README carry the same sentence the
 *   pre-flight does, and the README's first step is the root.
 * - **Nothing else moved** — `summary.refusals` (the report's list length) is unchanged by the
 *   rows on every fixture, by construction: the rows are built from `dispositions`, and the
 *   notes are not touched.
 */

import * as fs from 'fs';
import * as path from 'path';

import { Catalog } from '../src/catalog';
import { emitApp } from '../src/emit/emitApp';
import { preflight, renderPreflight, summarizePreflight, PreflightSummary } from '../src/emit/preflight';
import { README_PATH } from '../src/emit/readme';
import { cascadeOf, describeNode, nextSteps, pathwayVerdict, REPORT_PATH, ReportComponent } from '../src/emit/report';
import { parseProject } from '../src/parse/parseProject';
import { isPathwayType } from '../src/analyze/plan';
import { RefusedNode } from '../src/ir/types';

const CATALOG_PATH = path.join(__dirname, '..', '..', 'noodl-types', 'src', 'node-catalog.json');
const catalog: Catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
const FIXTURE_DIR = path.join(__dirname, 'fixtures');
const FIXTURES = fs.readdirSync(FIXTURE_DIR).filter((f) => fs.statSync(path.join(FIXTURE_DIR, f)).isDirectory());

const irOf = (fixture: string) => parseProject(path.join(FIXTURE_DIR, fixture), catalog);
const appOf = (fixture: string) => emitApp(irOf(fixture), catalog);
const summaryOf = (fixture: string): PreflightSummary => preflight(irOf(fixture), catalog);
const rowsOf = (fixture: string, component: string): RefusedNode[] =>
  appOf(fixture).report.components.find((c) => c.path === component)?.refusals ?? [];
const rowOf = (rows: RefusedNode[], id: string): RefusedNode => {
  const row = rows.find((r) => r.nodeId === id);
  if (row === undefined) throw new Error(`no refusal row for ${id} in ${rows.map((r) => r.nodeId).join(', ')}`);
  return row;
};

describe('task-desk — one root, five silenced, and the root is the one named', () => {
  const rows = rowsOf('task-desk', 'Pages/Tasks');

  test('every refused node is a row, whether or not a note names it (the reverted arm named none of the root)', () => {
    expect(rows.map((r) => r.nodeId).sort()).toEqual(['doneStr', 'goHome', 'setStatus', 'statusVar', 'sync', 'tasks']);
  });

  test('the root has no cause, and carries the picker name and the author’s label', () => {
    const root = rowOf(rows, 'tasks');
    expect(root.causedBy).toBeUndefined();
    // EXP-011 §53: the node is refused BY NAME now (no template), and stays the root — the cascade is about the graph, not the sentence.
    expect(root).toMatchObject({ type: 'RunTasks', displayName: 'Run Tasks', label: 'Run the batch', reason: 'it names no Template component, so every Do answers Failure with "No task template is selected" and never runs a task' });
  });

  test('the three trigger cascades name the root — through three different reason sentences', () => {
    expect(rowOf(rows, 'sync').causedBy).toEqual(['tasks']);
    // EXP-011 §53: `tasks.done` is a chain output the Run Tasks registration owns now, so the wire is no longer a
    // trigger wire and `sync` falls to the verdict sweep's sentence — still a sentence about `sync`, not about the root.
    expect(rowOf(rows, 'sync').reason).toBe('its Call is never fired by a translatable trigger');
    expect(rowOf(rows, 'setStatus').causedBy).toEqual(['tasks']);
    // 🔴 `goHome` is fired by `sync`, not by `tasks`. Its cause is still `tasks`: the root, never
    // the intermediate. A one-hop attribution reads `['sync']` here.
    expect(rowOf(rows, 'goHome').causedBy).toEqual(['tasks']);
    expect(rowOf(rows, 'goHome').reason).toBe('logic node (RouterNavigate)');
  });

  test('the value side cascades too: the constant that only feeds a silenced setter, and the store nothing translatable writes', () => {
    expect(rowOf(rows, 'doneStr').causedBy).toEqual(['tasks']);
    expect(rowOf(rows, 'statusVar').causedBy).toEqual(['tasks']);
  });

  test('pathway is a fact about the type: the Cloud Function and the Navigate, not the setter or the constant', () => {
    expect(rowOf(rows, 'sync').pathway).toBe(true);
    expect(rowOf(rows, 'goHome').pathway).toBe(true);
    expect(rowOf(rows, 'setStatus').pathway).toBe(false);
    expect(rowOf(rows, 'doneStr').pathway).toBe(false);
    expect(rowOf(rows, 'tasks').pathway).toBe(false);
  });

  test('🔴 cardinality: 1 + 5, never 6', () => {
    const cascade = summaryOf('task-desk').cascade;
    expect(cascade.roots).toHaveLength(1);
    expect(cascade.roots[0].node.nodeId).toBe('tasks');
    expect(cascade.roots[0].silences).toHaveLength(5);
    expect(cascade.unsilenced).toBe(1);
    expect(cascade.silenced).toBe(5);
    expect(cascade.unsilenced + cascade.silenced).toBe(rows.length);
  });

  test('the verdict trips, names the root and the two pathway nodes, and the report’s list length did not move', () => {
    const summary = summaryOf('task-desk');
    expect(summary.verdict).toBe(
      'This export would be missing a pathway, not a node: "Run the batch" (Run Tasks) in `Pages/Tasks`. ' +
        'Without it, "Sync tasks" (Cloud Function), "Go home" (Navigate) never run. ' +
        'Replace it or wait for a release that translates it.'
    );
    // The reverted arm read 7 (probe13-reverted.log); the rows add no line to the list. EXP-011 §53 moved it to 8: the
    // Run Tasks is refused BY NAME now, so the wire into its Do carries that sentence and `sync` (no longer named by a
    // dropped trigger wire) gets its own verdict note — one more line, both about the same root (probe16-after2.log).
    expect(summary.refusals).toBe(8);
    expect(summary.attention[0].nodes).toHaveLength(6);
  });
});

describe('quiet-desk — the control: one root, three silenced, no pathway, no verdict', () => {
  test('1 + 3, and nothing in the cascade is a pathway', () => {
    const summary = summaryOf('quiet-desk');
    expect(summary.cascade.roots).toHaveLength(1);
    expect(summary.cascade.unsilenced).toBe(1);
    expect(summary.cascade.silenced).toBe(3);
    expect(summary.cascade.pathway).toEqual([]);
    expect(summary.verdict).toBeNull();
    expect(pathwayVerdict(summary.cascade)).toBeNull();
  });
});

describe('every fixture — the invariants the two numbers rest on', () => {
  test.each(FIXTURES)('%s — unsilenced + silenced is the number of refused rows, and the notes list is untouched', (fixture) => {
    const app = appOf(fixture);
    const summary = summarizePreflight(app);
    const rows = app.report.components.flatMap((c) => c.refusals ?? []);
    expect(summary.cascade.unsilenced + summary.cascade.silenced).toBe(rows.length);
    // A silenced node is in exactly the lists of the roots it names — counted once, listed under each.
    const listed = summary.cascade.roots.flatMap((r) => r.silences.map((s) => s.node.nodeId));
    for (const row of rows) {
      if (row.causedBy === undefined) continue;
      for (const cause of row.causedBy) {
        const root = summary.cascade.roots.find((r) => r.node.nodeId === cause);
        // A cause that is not a row would be a defect in the plan; one that is must list the node.
        if (root !== undefined) expect(root.silences.some((s) => s.node.nodeId === row.nodeId)).toBe(true);
      }
    }
    expect(new Set(listed).size).toBeLessThanOrEqual(summary.cascade.silenced + listed.length);
    // The refusal count is the report list's length, exactly as `preflight.test.ts` asserts.
    const fromReport =
      app.report.components.reduce((n, c) => n + c.notes.length, 0) +
      app.report.components.filter((c) => c.skipped?.kind === 'deferred').length +
      app.report.modules.length +
      app.report.project.length;
    expect(summary.refusals).toBe(fromReport);
  });

  test.each(FIXTURES)('%s — a row’s cause is never itself, and a root never has a cause', (fixture) => {
    for (const c of appOf(fixture).report.components) {
      for (const row of c.refusals ?? []) {
        if (row.causedBy === undefined) continue;
        expect(row.causedBy).not.toContain(row.nodeId);
        expect(row.causedBy.length).toBeGreaterThan(0);
      }
    }
  });

  test('the corpus holds a cascade beyond the two EXP-013 fixtures, so the rows above are not vacuous there', () => {
    const others = FIXTURES.filter((f) => f !== 'task-desk' && f !== 'quiet-desk');
    const withCascade = others.filter((f) => summaryOf(f).cascade.silenced > 0);
    expect(withCascade.length).toBeGreaterThan(0);
  });
});

describe('AC5 — two readers, one set of rows', () => {
  const app = appOf('task-desk');
  const summary = summarizePreflight(app);

  test('the pre-flight text, the report and the README all carry the verdict sentence', () => {
    const verdict = summary.verdict as string;
    expect(renderPreflight(summary)).toContain(verdict);
    expect(app.files[REPORT_PATH]).toContain(verdict);
    expect(app.files[README_PATH]).toContain(verdict);
  });

  test('the report names the root as a node under its component, with its cascade', () => {
    const report = app.files[REPORT_PATH];
    expect(report).toContain('Nodes left out:');
    expect(report).toContain('- "Run the batch" (Run Tasks) — it names no Template component, so every Do answers Failure with "No task template is selected" and never runs a task');
    expect(report).toContain('…and 5 nodes are left out only because this one fires them: "Sync tasks" (Cloud Function), "Go home" (Navigate)');
    expect(report).toContain('**1 node the export has no rule for, and 5 more left out only because it fires them.**');
  });

  test('the README’s first step is the root', () => {
    const steps = nextSteps(app.report);
    expect(steps[0].title).toBe('Replace the one node the export has no rule for that silences 5 more.');
    expect(steps[0].where).toEqual(['Pages/Tasks']);
    expect(steps[0].detail).toContain('"Run the batch" (Run Tasks) in `Pages/Tasks`');
    expect(app.files[README_PATH]).toContain(`1. **${steps[0].title}**`);
  });

  test('quiet-desk’s first step is the root too, without a verdict in it', () => {
    const steps = nextSteps(appOf('quiet-desk').report);
    expect(steps[0].title).toBe('Replace the one node the export has no rule for that silences 3 more.');
    expect(steps[0].detail).not.toContain('missing a pathway');
  });

  test('a report with no rows at all (built by hand before EXP-013) still renders, with no cascade step', () => {
    const data = {
      projectName: 'Bare',
      files: ['src/App.tsx'],
      components: [{ path: 'Pages/Home', role: 'page', file: 'src/pages/Home.tsx', notes: ['wire a->b dropped: x'], unreachable: false }] as ReportComponent[],
      modules: [],
      project: [],
      backendEndpoint: null,
      usesBackend: false,
      httpModule: false
    };
    expect(cascadeOf(data)).toEqual({ roots: [], unsilenced: 0, silenced: 0, pathway: [] });
    expect(nextSteps(data).map((s) => s.title)[0]).toContain('Fill in one refusal');
  });
});

describe('the pathway family, and an On App Error alone', () => {
  test('isPathwayType — the three families Richard named, and not the feature nodes', () => {
    for (const type of ['CloudFunction2', 'net.noodl.HTTP', 'DbModel2', 'DbCollection2', 'NewDbModelProperties', 'net.noodl.user.LogIn', 'Upload File', 'RouterNavigate', 'PageStackNavigateToPath', 'net.noodl.externallink', 'On App Error']) {
      expect({ type, pathway: isPathwayType(type) }).toEqual({ type, pathway: true });
    }
    for (const type of ['Set Variable', 'String', 'Variable', 'RunTasks', 'Group', 'Timer', 'States']) {
      expect({ type, pathway: isPathwayType(type) }).toEqual({ type, pathway: false });
    }
  });

  test('an On App Error the export has no rule for is a root with an empty cascade, and the verdict says the error pathway is gone', () => {
    const onError: RefusedNode = { nodeId: 'boundary', type: 'On App Error', displayName: 'On App Error', label: 'Catch all', reason: 'logic node (On App Error)', pathway: true };
    const cascade = cascadeOf({ components: [{ path: 'App', role: 'component', file: null, notes: [], unreachable: false, refusals: [onError] }] });
    expect(cascade.roots).toHaveLength(1);
    expect(cascade.roots[0].silences).toEqual([]);
    expect(cascade.unsilenced).toBe(1);
    expect(cascade.silenced).toBe(0);
    expect(pathwayVerdict(cascade)).toBe(
      'This export would be missing a pathway, not a node: "Catch all" (On App Error) in `App`. Without it, the app has no error pathway. Replace it or wait for a release that translates it.'
    );
  });

  test('a node with two roots is listed under both and counted once', () => {
    const a: RefusedNode = { nodeId: 'a', type: 'RunTasks', displayName: 'Run Tasks', reason: 'logic node (RunTasks)', pathway: false };
    const b: RefusedNode = { nodeId: 'b', type: 'RunTasks', displayName: 'Run Tasks', reason: 'logic node (RunTasks)', pathway: false };
    const v: RefusedNode = { nodeId: 'v', type: 'Set Variable', displayName: 'Set Variable', reason: 'x', causedBy: ['a', 'b'], pathway: false };
    const cascade = cascadeOf({ components: [{ path: 'P', role: 'page', file: 'p.tsx', notes: [], unreachable: false, refusals: [a, b, v] }] });
    expect(cascade.roots.map((r) => r.node.nodeId).sort()).toEqual(['a', 'b']);
    expect(cascade.roots.every((r) => r.silences.length === 1)).toBe(true);
    expect(cascade.silenced).toBe(1);
    expect(cascade.unsilenced).toBe(2);
    expect(describeNode(v)).toBe('Set Variable `v`');
  });
});
