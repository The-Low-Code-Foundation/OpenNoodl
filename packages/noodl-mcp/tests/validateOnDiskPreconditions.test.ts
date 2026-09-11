/**
 * DEF-002 AC6 — `validate_project` is no longer weaker than the door.
 *
 * `validateOnDisk` ran the `SemanticValidator` and stopped, so the thirteen
 * precondition checks `validateCandidate` composes were invisible to
 * `validate_component` and `validate_project`. **An agent calling
 * `validate_project` to check its own work got a strictly weaker answer than the
 * gate that accepted it.**
 *
 * Every case below writes its defect to disk *directly*, and that is not a
 * shortcut — it is forced. The write gate rejects all of these, which is the
 * whole point: the only way a project acquires one is a hand edit, an import, or
 * a graph authored before the check existed, and those are exactly the projects
 * this door reports on.
 *
 * ⚠️ Each defect is asserted **beside a control that differs only in the
 * defect** — a wire named `in-items` instead of `items`, a Repeater with a
 * template instead of without. A test that only shows the diagnostic firing
 * cannot tell "the check works" from "the check fires on everything", and this
 * is the layer where that distinction decides whether the door is usable.
 */

import * as fs from 'fs';
import * as path from 'path';

import type { NodeV2 } from '../src/editor-deps';
import type { ComponentFiles } from '../src/graph';
import { validateCandidate, validateOnDisk } from '../src/validate';
import { connect, copyFixture } from './helpers';
import type { TestSession } from './helpers';

const HOME_KEY = 'Pages/Home';
const HOME_NAME = '/Pages/Home';

interface Connection {
  fromId: string;
  fromProperty: string;
  toId: string;
  toProperty: string;
}

/** Overwrite a component's nodes and connections on disk, before the store reads them. */
function writeComponent(projectDir: string, key: string, nodes: NodeV2[], connections: Connection[]): void {
  const dir = path.join(projectDir, 'components', key);
  const nodesFile = path.join(dir, 'nodes.json');
  const connectionsFile = path.join(dir, 'connections.json');
  const existingNodes = JSON.parse(fs.readFileSync(nodesFile, 'utf8'));
  const existingConnections = JSON.parse(fs.readFileSync(connectionsFile, 'utf8'));
  fs.writeFileSync(nodesFile, JSON.stringify({ ...existingNodes, nodes }, null, 2));
  fs.writeFileSync(connectionsFile, JSON.stringify({ ...existingConnections, connections }, null, 2));
}

/**
 * A page whose Function node is wired by the name its *script* uses.
 *
 * The defect FIX-007 named and nothing on this door could see: a Function node's
 * ports are prefixed (`in-items`, `out-text`) and its script names are not, so a
 * wire to `items` reaches nothing. `nonexistentPort` is right to skip it — those
 * ports are mined from the script rather than declared — which is precisely why
 * only `checkFunctionNodePorts` can find it, and it is a precondition.
 */
function functionPage(wiredPortIn: string, wiredPortOut: string): { nodes: NodeV2[]; connections: Connection[] } {
  const nodes = [
    { id: 'page', type: 'Page', label: 'Home', parameters: { title: 'Home' }, children: ['layout'] },
    { id: 'layout', type: 'Group', label: 'Layout', parent: 'page', children: ['out'] },
    { id: 'out', type: 'Text', label: 'Output', parent: 'layout' },
    {
      id: 'fn',
      type: 'JavaScriptFunction',
      label: 'Format List',
      parameters: { functionScript: 'Outputs.text = (Inputs.items || []).join(", ");' }
    },
    // Ports derived from the target router and the selected page's path
    // parameters, so `checkParameterValues` cannot check them and says so —
    // which is what makes this page a source of skip notes as well as findings.
    { id: 'nav', type: 'RouterNavigate', label: 'Go', parameters: { router: 'Main', target: '/Pages/Home' } }
  ] as unknown as NodeV2[];
  return {
    nodes,
    connections: [{ fromId: 'fn', fromProperty: wiredPortOut, toId: 'out', toProperty: 'text' }].concat(
      wiredPortIn ? [{ fromId: 'out', fromProperty: 'text', toId: 'fn', toProperty: wiredPortIn }] : []
    )
  };
}

function codesOf(diagnostics: readonly { code: string }[]): string[] {
  return diagnostics.map((d) => d.code);
}

describe('DEF-002 AC6 — validateOnDisk composes the precondition layer', () => {
  let session: TestSession | undefined;

  afterEach(async () => {
    await session?.close();
    session = undefined;
  });

  async function open(mutate: (dir: string) => void): Promise<TestSession> {
    const dir = copyFixture();
    mutate(dir);
    session = await connect(dir);
    return session;
  }

  it('reports a Function node wired by its script name — and not one wired by its port name', async () => {
    const broken = await open((dir) => {
      const { nodes, connections } = functionPage('items', 'text');
      writeComponent(dir, HOME_KEY, nodes, connections);
    });
    const brokenReport = validateOnDisk(broken.store, { component: HOME_NAME }).report;
    expect(codesOf(brokenReport.diagnostics)).toContain('unprefixed-function-port');
    await broken.close();
    session = undefined;

    // The control: the same graph, the same script, the prefixed port names.
    const clean = await open((dir) => {
      const { nodes, connections } = functionPage('in-items', 'out-text');
      writeComponent(dir, HOME_KEY, nodes, connections);
    });
    const cleanReport = validateOnDisk(clean.store, { component: HOME_NAME }).report;
    expect(codesOf(cleanReport.diagnostics)).not.toContain('unprefixed-function-port');
  });

  it('reports a Repeater with no template — and not one that has it', async () => {
    const broken = await open((dir) =>
      writeComponent(
        dir,
        HOME_KEY,
        [
          { id: 'page', type: 'Page', label: 'Home', parameters: { title: 'Home' }, children: ['rep'] },
          { id: 'rep', type: 'For Each', label: 'List', parent: 'page' }
        ] as unknown as NodeV2[],
        []
      )
    );
    expect(codesOf(validateOnDisk(broken.store, { component: HOME_NAME }).report.diagnostics)).toContain(
      'repeater-without-template'
    );
    await broken.close();
    session = undefined;

    const clean = await open((dir) =>
      writeComponent(
        dir,
        HOME_KEY,
        [
          { id: 'page', type: 'Page', label: 'Home', parameters: { title: 'Home' }, children: ['rep'] },
          { id: 'rep', type: 'For Each', label: 'List', parent: 'page', parameters: { template: '/Card' } }
        ] as unknown as NodeV2[],
        []
      )
    );
    expect(codesOf(validateOnDisk(clean.store, { component: HOME_NAME }).report.diagnostics)).not.toContain(
      'repeater-without-template'
    );
  });

  /**
   * 🔴 The acceptance criterion itself, as a comparison rather than a list.
   *
   * A hand-written list of codes to expect is an exclusion list: it passes on
   * whatever it happens to name and says nothing about the checks it forgot.
   * This asks the question AC6 actually poses — **is the reader still weaker
   * than the door?** — by running both gates over the same component and
   * requiring the door's blocking findings to appear in the reader's report.
   */
  it('reports every blocking finding the write gate would reject the same component for', async () => {
    const { nodes, connections } = functionPage('items', 'text');
    const s = await open((dir) => writeComponent(dir, HOME_KEY, nodes, connections));

    const files: ComponentFiles = s.store.readComponent(HOME_NAME).files;
    const gate = validateCandidate(s.store, HOME_KEY, files, undefined);
    const blocking = gate.diagnostics.filter((d) => d.severity === 'error');
    // A control on the control: if the write gate found nothing to block on,
    // the comparison below is vacuous and would pass over a door that reports
    // nothing at all.
    expect(blocking.length).toBeGreaterThan(0);

    const reported = new Set(codesOf(validateOnDisk(s.store, { component: HOME_NAME }).report.diagnostics));
    for (const diagnostic of blocking) {
      expect(reported.has(diagnostic.code)).toBe(true);
    }
  });

  it('filters the "did not run" skip notes by default, and returns them on request', async () => {
    const { nodes, connections } = functionPage('items', 'text');
    const s = await open((dir) => writeComponent(dir, HOME_KEY, nodes, connections));

    const withNotes = validateOnDisk(s.store, { emitSkipNotes: true }).report;
    const noteCount = codesOf(withNotes.diagnostics).filter(
      (c) => c === 'dynamic-port-skipped' || c === 'unknown-type-check-skipped'
    ).length;
    // 🔴 Read the known-firing signal first. Asserting the notes are absent by
    // default proves nothing unless something was there to filter.
    expect(noteCount).toBeGreaterThan(0);

    const byDefault = validateOnDisk(s.store, {}).report;
    expect(codesOf(byDefault.diagnostics)).not.toContain('dynamic-port-skipped');
    expect(codesOf(byDefault.diagnostics)).not.toContain('unknown-type-check-skipped');
    expect(byDefault.summary.infos).toBe(withNotes.summary.infos - noteCount);
  });

  /**
   * ⚠️ The filter is by **code**, not by severity, and this is the control that
   * says so. `MonotoneTypography` is an `info` and a finding — a page rendering
   * every word at one weight — not a note about a check that did not run. The
   * severity filter `rules/parameterValue` uses is correct there, because
   * `checkParameterValues` emits no other info; here it would drop this.
   */
  it('keeps info-severity findings that are not skip notes', async () => {
    const texts = Array.from({ length: 9 }, (_, i) => ({
      id: `t${i}`,
      type: 'Text',
      label: `Line ${i}`,
      parent: 'page',
      parameters: { text: `Line ${i}` }
    }));
    const s = await open((dir) =>
      writeComponent(
        dir,
        HOME_KEY,
        [
          { id: 'page', type: 'Page', label: 'Home', parameters: { title: 'Home' }, children: texts.map((t) => t.id) },
          ...texts
        ] as unknown as NodeV2[],
        []
      )
    );
    const report = validateOnDisk(s.store, { component: HOME_NAME }).report;
    expect(codesOf(report.diagnostics)).toContain('monotone-typography');
  });

  /**
   * 🔴 The two sources overlap on purpose since D13: `rules/parameterValue` runs
   * the same `checkParameterValues` the precondition set runs. A naive merge
   * reports every parameter-value finding twice — in the readable list and in
   * `summary`, where a rejection naming one mistake twice reads as two mistakes.
   */
  it('reports a finding both sources produce exactly once, in the list and in the summary', async () => {
    const s = await open((dir) =>
      writeComponent(
        dir,
        HOME_KEY,
        [
          { id: 'page', type: 'Page', label: 'Home', parameters: { title: 'Home' }, children: ['t'] },
          { id: 't', type: 'Text', label: 'Title', parent: 'page', parameters: { text: 'Hi', fontSize: 'not-a-size' } }
        ] as unknown as NodeV2[],
        []
      )
    );
    const report = validateOnDisk(s.store, { component: HOME_NAME }).report;
    const parameterFindings = report.diagnostics.filter((d) => d.location.nodeId === 't' && d.location.port === 'fontSize');
    // Known-firing first: the overlap is only observable if the check fired.
    expect(parameterFindings.length).toBeGreaterThan(0);
    expect(parameterFindings).toHaveLength(1);
    expect(report.summary.errors + report.summary.warnings + report.summary.infos).toBe(report.diagnostics.length);
  });
});
