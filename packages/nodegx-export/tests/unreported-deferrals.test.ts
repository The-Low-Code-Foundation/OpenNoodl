import * as fs from 'fs';
import * as path from 'path';

import { Catalog, CatalogIndex, loadCatalog } from '../src/catalog';
import { planProject } from '../src/analyze/plan';
import { emitApp } from '../src/emit/emitApp';
import { parseProject } from '../src/parse/parseProject';
import { ComponentIR, ExportIR, NodeIR } from '../src/ir/types';

/**
 * EXP-004's "nothing dropped silently", checked against the file the author reads.
 *
 * `src/emit/report.ts` renders a component's `notes` and **never** its `dispositions`, so a gate
 * that computes a reason, files it against the node and pushes no note has dropped that node from
 * the exported app with the report saying nothing about it. Every gate having remembered its own
 * `notes.push` was a property nothing checked, and it was not true: measured over the 60
 * exportable corpus projects, **76 deferred nodes appeared nowhere in their own
 * `EXPORT-REPORT.md`** — against a control of **1490 that did**, with `logic node (…)` present in
 * *both* arms, so the absence was about those nodes and not an unreportable family. Of the 76,
 * **19** sat in components that generate a file, which is where a note can render at all; the
 * sweep took those to **0**.
 *
 * 🔴 **No fixture on disk exercises the sweep's rendered path** — checked, not assumed: over
 * `tests/fixtures` the pass produces zero report lines, because every fixture's deferred logic
 * nodes are already named by a dropped-wire note. So the rows below **build** the case rather
 * than finding it, and a row phrased as "over every fixture, nothing is unreported" would be the
 * `all([])` trap: true, vacuous, and green against a deleted sweep.
 *
 * Every row here asserts the emitted **`EXPORT-REPORT.md`**, not `plan.notes` — §34.5's two rows
 * pinned a sentence by checking `result.notes` while the claim was about `result.files`, and
 * could not see the sentence had gone false.
 */

const FIXTURE = path.join(__dirname, 'fixtures', 'puppy-test-3');

const catalog: Catalog = loadCatalog();
const index = new CatalogIndex(catalog);
const baseIr = parseProject(FIXTURE, catalog);

/** A component that generates a file — the only place a per-component note renders. */
const CARD = 'Components/PuppyCard';
/**
 * ⚠️ Re-pointed in EXP-011 §39: the orphan was a `Timer`, and `Timer` is now `Delay`, translated —
 * its own verdict sweep names it, which is exactly what this control must not have. Re-pointed AGAIN
 * in §59: `Hash` was chosen because §3 kept it out of scope "for good", and §50 reversed that — it is
 * translated now, with a sweep of its own. `Pattern Extractor` is the §50 ruling's own "deliberately
 * out of scope" list, so no pass will ever claim it — and if one does, this control is the alarm.
 */
const ORPHAN = 'orphan-pattern-row';
const ORPHAN_TYPE = 'net.noodl.PatternExtractor';

const cloneIr = (): ExportIR => structuredClone(baseIr);
const componentOf = (source: ExportIR, componentPath: string): ComponentIR =>
  source.components.find((c) => c.path === componentPath)!;
const reportOf = (source: ExportIR): string => String(emitApp(source, catalog).files['EXPORT-REPORT.md'] ?? '');
const planOf = (source: ExportIR, componentPath: string) =>
  planProject(source, index).plans.find((p) => p.path === componentPath)!;

/**
 * A logic node wired to nothing at all. Wired to nothing is the point: a node with wires is
 * already named by the dropped-wire notes, which is why the corpus hides this defect so well.
 */
const addOrphanLogic = (source: ExportIR, type = ORPHAN_TYPE, id = ORPHAN): NodeIR => {
  const node: NodeIR = {
    id,
    type,
    catalogRef: type,
    parameters: [],
    declaredPorts: [],
    portKnowledge: 'complete'
  };
  componentOf(source, CARD).nodes.push(node);
  return node;
};

describe('a deferred node the report never mentioned', () => {
  it('CONTROL: the unmutated fixture generates PuppyCard, and its report does not name the id yet', () => {
    /*
     * Both halves matter. If PuppyCard emitted no file the mutation could never render a note and
     * the row below would be green for the wrong reason; if the id were already in the report the
     * row below would pass without the sweep existing.
     */
    const source = cloneIr();
    expect(planOf(source, CARD).file).not.toBeNull();
    expect(reportOf(source).includes(ORPHAN)).toBe(false);
  });

  it('CONTROL: the orphan really is deferred, and really is named by no other note', () => {
    /*
     * The precondition the sweep is about. A node that some other pass reports, or that is not
     * deferred at all, would make the next row a test of something else entirely.
     */
    const source = cloneIr();
    addOrphanLogic(source);
    const plan = planOf(source, CARD);
    expect(plan.dispositions[ORPHAN]).toEqual({ kind: 'deferred', to: 'EXP-003', reason: `logic node (${ORPHAN_TYPE})` });
    const others = plan.notes.filter((n) => n.includes(ORPHAN));
    expect(others.length).toBe(1);
  });

  it('names it in EXPORT-REPORT.md — the file, not the notes array', () => {
    const source = cloneIr();
    addOrphanLogic(source);
    const report = reportOf(source);
    const lines = report.split('\n').filter((l) => l.includes(ORPHAN));
    // EXP-013: the report names a refused node twice, on purpose — once as a *node row* under
    // "Nodes left out" (built from `dispositions`, which is the list this sweep exists to keep
    // honest) and once as the sweep's own note. Two lines, each asserted by shape.
    expect(lines.length).toBe(2);
    // The row carries the picker's name for the type ("Pattern Extractor"), the note the catalog typeName.
    expect(lines[0]).toContain(`Pattern Extractor \`${ORPHAN}\` — the export has no rule for this node yet`);
    expect(lines[1]).toContain(`(${ORPHAN_TYPE}) has no translation in this slice — it is not in the generated app`);
  });

  it('says it once, not once per pass — a node the report already names gains no second line', () => {
    /*
     * The discriminating half. A sweep that pushed for every deferred node regardless would
     * double every line the dropped-wire notes already carry, and the report would read as twice
     * the damage. `puppy-test-3` unmutated is the population that would show it.
     */
    const source = cloneIr();
    const report = reportOf(source);
    const bullets = report.split('\n').filter((l) => l.startsWith('- '));
    const duplicated = bullets.filter((l, i) => bullets.indexOf(l) !== i);
    expect(duplicated).toEqual([]);
  });

  it('does not stutter the reason back at the author', () => {
    /*
     * `logic node (<type>)` is the catch-all's own reason and restates the type; rendered through
     * the generic format it would read "node … (<type>) deferred: logic node (<type>)". The author
     * needs the fact, which is that it is not in the app.
     */
    const source = cloneIr();
    addOrphanLogic(source);
    expect(reportOf(source)).not.toContain(`deferred: logic node (${ORPHAN_TYPE})`);
  });

  it('a gate with a real sentence keeps that sentence — the generic format is for the rest', () => {
    /*
     * The other arm of the wording branch. A type the catch-all does not produce its stock reason
     * for must arrive with the reason its own gate computed, verbatim.
     */
    // `net.noodl.WebSocket` stood here until EXP-011 §65 translated it (an unwired one now registers and collapses, so it
    // is not deferred at all); an unwired `Run Tasks` has its own gate's sentence — "nothing fires its Do".
    const source = cloneIr();
    addOrphanLogic(source, 'RunTasks', 'orphan-tasks');
    const plan = planOf(source, CARD);
    const reason = (plan.dispositions['orphan-tasks'] as { reason: string }).reason;
    const report = reportOf(source);
    expect(report).toContain(`node orphan-tasks (RunTasks)`);
    // Whatever the gate said, the report says — this row does not hard-code which gate wins.
    if (reason !== 'logic node (RunTasks)') expect(report).toContain(reason);
  });

  it('reaches the logic-only early return too, not just the bottom of the function', () => {
    /*
     * §17's hole one construct over: `planComponent` returns early for a component with no visual
     * root, and a sweep called only at the bottom would never run for it. That component emits no
     * file, so this row asserts the plan's notes rather than the report — the one place in this
     * file where that is the honest target, because the report has nowhere to put the line.
     */
    const source = cloneIr();
    const logicOnly = planProject(source, index).plans.find((p) => p.skipKind === 'deferred');
    expect(logicOnly).toBeDefined();
    const deferredIds = Object.entries(logicOnly!.dispositions)
      .filter(([, d]) => d.kind === 'deferred')
      .map(([id]) => id);
    expect(deferredIds.length).toBeGreaterThan(0);
    const said = logicOnly!.notes.join('\n');
    expect(deferredIds.filter((id) => !said.includes(id))).toEqual([]);
  });
});
