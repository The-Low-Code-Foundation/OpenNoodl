/**
 * FLD-015 — charts that export.
 *
 * ## What was reported
 *
 * [#39](https://github.com/The-Low-Code-Foundation/NodeGX/issues/39): *"the parts of my dashboard
 * that were actually charts were the parts that did not survive export."* There is no chart node,
 * so a chart is assembled out of Groups whose `width` is wired — and a wired structure port is
 * what the React export refuses, because the rendered shape is then not static.
 *
 * **R2, answered 2026-09-11: a kit.** A kit node is `role: 'custom'`, dispatched before any visual
 * role, so it never reaches `visualDeferReason` and never touches `STRUCTURE_PORTS`; its wired
 * inputs are emitted as ordinary props and its own script is copied into the exported repo. The
 * deliverable is `library/modules/nodegx-charts` — **Bar Chart** and **Sparkline**.
 *
 * ## 🔴 What the task file was wrong about, and what that cost
 *
 * FLD-015 §2 said the kit route needed no export work: *"`renderCustom` walks
 * `plan.bindings[node.id]` and emits wired inputs as props"*. It does. **Nothing put a binding
 * there.** Measured on the fixture below before a line of the fix was written, the emitted chart
 * was `<BarChart valueKey="revenue" />` — every literal parameter, and no `series` at all, with
 * the report saying *"has no deterministic translation in step 5"*. Two independent holes, and
 * either alone is enough to make a data-driven kit node impossible:
 *
 * 1. **`Static Data.items` had exactly one destination.** The wire was matched on its TARGET
 *    (`toNode.type === 'For Each'`), so an array read into anything else reached no branch —
 *    about rows already hoisted, already typed and already printed in the emitted file.
 * 2. **Every `bindable` gate in `plan.ts` enumerates DOM sinks, and a kit node has none.**
 *    `CONTENT_PARAMS` is keyed by core node type and `styleSinkOf` consults the catalog; a kit
 *    node is in neither. So *every* read arriving for a kit port failed the gate, whatever its
 *    source — the hole was never about Static Data.
 *
 * The third was only visible from the built app: `readonly Row[]` is not assignable to
 * `unknown[]`, so the first version that bound anything emitted a page the exported app's own
 * `tsc` rejected with **TS4104**. `tests/typecheck-emitted.test.ts` is what caught it, on the
 * fixture this file adds, which is what that suite's auto-discovery is for.
 *
 * ## What this file grades, and what it cannot
 *
 * AC2, AC3 and the kit's own contract. **AC1 and AC4 are a drive** — `npm run build` on the
 * emitted app and the bar heights in a browser — and live in
 * `FLD-015-WHAT-WAS-BUILT.md`, because no assertion here can see a rendered pixel.
 * **AC5 does not apply**: it was conditional on R2 choosing core nodes, and R2 chose a kit, which
 * is the whole point — there is one implementation of the geometry and it is in the kit.
 */
import * as fs from 'fs';
import * as path from 'path';

import { Catalog, loadCatalog } from '../src/catalog';
import { emitApp } from '../src/emit/emitApp';
import { parseProject } from '../src/parse/parseProject';

const REPO = path.join(__dirname, '..', '..', '..');
const SHIPPED = path.join(REPO, 'library', 'modules', 'nodegx-charts', 'project', 'noodl_modules', 'nodegx-charts');
const FIXTURE = path.join(__dirname, 'fixtures', 'charts');

const catalog: Catalog = loadCatalog();
const ir = parseProject(FIXTURE, catalog);
const app = emitApp(ir, catalog);

const home = app.files['src/pages/Home.tsx'];
const kitFile = app.files['src/kits/NodegxCharts.tsx'];
const homeNotes = app.report.components.find((component) => component.path === 'Pages/Home')!.notes;

/** One JSX element from the emitted page, from its open tag to its `/>`. */
const elementOf = (symbol: string): string => {
  const start = home.indexOf(`<${symbol}`);
  expect(start).toBeGreaterThan(-1);
  const end = home.indexOf('/>', start);
  expect(end).toBeGreaterThan(start);
  return home.slice(start, end + 2);
};

describe('the fixture grades the SHIPPED kit, not a copy of it', () => {
  /**
   * 🔴 A second copy of a thing drifts silently, and the drift is invisible precisely when it
   * matters — the day somebody edits the library entry and every row below goes on passing about
   * the version that is not shipped. This is the row that reddens instead.
   */
  test.each(['index.js', 'manifest.json'])('%s is byte-identical to the library entry', (file) => {
    const shipped = fs.readFileSync(path.join(SHIPPED, file));
    const infixture = fs.readFileSync(path.join(FIXTURE, 'noodl_modules', 'nodegx-charts', file));
    expect(infixture.equals(shipped)).toBe(true);
  });

  /**
   * ⚠️ **A source-text check, and it guards a convention rather than a behaviour** — so it is
   * armed with the positive half, which is what says the file was read at all.
   *
   * The convention: neither node declares `frame:` or `inputCss`. Both put ports in the editor's
   * shared Layout group, which lives in `inputCss` — and `parse/kitSource.ts`'s `readDefinition`
   * reads `inputProps` and `inputs` and **not** `inputCss`. A size set through a Layout port
   * would therefore apply in the editor and be absent from the export: the same chart, two
   * sizes, with nothing in the report to say so. Size arrives on `chartHeight`/`chartWidth`,
   * which are ordinary `inputProps`, and AC4 is the assertion that the two renders agree.
   */
  test('neither node takes the Layout ports the export cannot see', () => {
    const source = fs.readFileSync(path.join(SHIPPED, 'index.js'), 'utf8');
    expect(source).toContain('inputProps:'); // the positive half: this is the file we think it is
    expect(source).not.toMatch(/^\s*inputCss:/m);
    expect(source).not.toMatch(/^\s*frame:/m);
  });
});

describe('the kit parses into two visual nodes with the ports the graph sets', () => {
  const module = ir.project.modules.find((m) => m.dirName === 'nodegx-charts')!;

  test('it loads, and both nodes are visual', () => {
    expect(module.status).toBe('loaded');
    expect(module.nodes.map((n) => `${n.type} visual=${n.visual}`)).toEqual([
      'nodegx.charts.BarChart visual=true',
      'nodegx.charts.Sparkline visual=true'
    ]);
  });

  test("the Bar Chart's data ports and its three-value selection are all declared", () => {
    const bar = module.nodes.find((n) => n.type === 'nodegx.charts.BarChart')!;
    expect(bar.inputs.find((i) => i.name === 'series')!.type).toBe('array');
    expect(bar.inputs.map((i) => i.name)).toEqual(expect.arrayContaining(['series', 'valueKey', 'labelKey', 'autoScale']));
    // 🔴 The pair that `kitSource`'s own comment is about: `barSelected` is declared `signal`
    // with no getter and the three readings have `get`s, so a value read and a pulse are told
    // apart by the definition rather than by the wire's parsed kind.
    expect(bar.outputs.map((o) => `${o.name}:${o.kind}`)).toEqual([
      'selectedIndex:value',
      'selectedValue:value',
      'selectedLabel:value',
      'barSelected:signal'
    ]);
  });
});

describe('AC2 — the data arrives as a PROP in the emitted JSX, not merely in the interface', () => {
  /**
   * 🔴 **The declaration is not the assertion, and the task file says why**: a declared-and-never
   * -read prop is exactly the defect #23 reports, so asserting `series?:` in the Props interface
   * would pass on the broken output this task started from. The element is what is graded.
   */
  test('the Bar Chart element is handed the hoisted rows', () => {
    expect(elementOf('BarChart')).toContain('series={MONTHLY_REVENUE}');
  });

  test('and so is the Sparkline — the same array into a second node, so it is not one lucky wire', () => {
    expect(elementOf('Sparkline')).toContain('series={MONTHLY_REVENUE}');
  });

  test('the constant it names is declared in the same file, frozen, with the authored rows', () => {
    expect(home).toContain('const MONTHLY_REVENUE: readonly MonthlyRevenue[] = Object.freeze([');
    expect(home).toContain('revenue: 67');
    // The row type the hoist derived, carried through to the prop — `any[]` would have compiled
    // too, and would have thrown away a type the file is already printing.
    expect(home).toContain('type MonthlyRevenue = {');
  });

  test('the wrapper types the port `readonly`, which is what lets a frozen constant through', () => {
    expect(kitFile).toContain('series?: readonly unknown[];');
  });

  test('nothing about the data wire is reported as dropped', () => {
    expect(homeNotes.filter((note) => /revenue:items/.test(note))).toEqual([]);
  });
});

describe('AC3 — the refusal control: the same chart built the old way is REPORTED, never silent', () => {
  /**
   * The old way, and it is #39's own shape: a Group whose `width` is the data
   * (`revenue.count → oldWayFill.width`). A wire into a dimension port has no rendered sink —
   * `WIRED_STYLE_SINKS` is `opacity` and the two colours — so the export cannot draw it.
   *
   * 🔴 **`WIRED_STYLE_SINKS` is not widened to `width`, and the reason is measured rather than
   * assumed.** FLD-015 §3 called that "a handful of lines". `Layout.size`
   * (`noodl-viewer-react/src/layout.ts`) is four branches on `sizeMode` and then a fifth decision
   * on the parent's layout, under which a percentage width in a row parent becomes **`flexGrow`**
   * and not a width at all, with the node's own margins subtracted through `calc()` across the
   * other axis. An inline `style={{ width: expr }}` would be the wrong value in the commonest
   * case a meter is built in, and wrong silently. A refusal an author can read beats a number
   * nobody can check.
   *
   * 🔴 **What DID change is the refusal, and this fixture is how the gap was found.** Measured
   * here first: the wire was reported as *"no deterministic translation in step 5 (deferred to
   * EXP-003)"* — one line in the export report, and **nothing at all in the emitted page**. The
   * author reading `Home.tsx` saw a plain `<div>` where their data-driven bar had been. HLS-005
   * closed that silence for wires that BOUND; a wire no pass would bind never reached its sweep.
   * Binding a dimension port (Pass 4f, `dimensionSink`) is what puts this one in front of it.
   *
   * ⚠️ The corpus measured the blast radius: **`charts` alone**. None of the other 44 fixtures
   * has a wire into a dimension port from a source this pass reads, which is why the hole lasted.
   */
  test('the fixture carries the shape: a data-driven width on a Group, beside the kit charts', () => {
    const page = ir.components.find((component) => component.path === 'Pages/Home')!;
    expect(page.connections.map((c) => `${c.fromId}.${c.fromProperty}->${c.toId}.${c.toProperty}`)).toEqual(
      expect.arrayContaining(['revenue.count->oldWayFill.width'])
    );
  });

  test('🔴 it is refused by name — in the report AND in the emitted file', () => {
    expect(homeNotes).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          'wire into oldWayFill.width has no rendered sink on Group — the property renders from its authored parameter only, so the wire is dropped, reported'
        )
      ])
    );
    // 🔴 The half that was missing: a marker in the FILE, naming the node, so the sentence in the
    // report has something to search for. It rides `preReturnMarkers` — a node whose element was
    // already emitted when the late sweep filed the defer — which is why it is a line comment
    // above the `return` rather than a sibling of the div.
    expect(home).toContain('TODO(export): node oldWayFill renders, and part of what the graph');
    expect(home).toContain('the wire into "width" has no rendered sink on Group');
  });

  test('and no width reaches the element, so the refusal is not describing a wire that survived', () => {
    // The complement. Without this the row above passes on an output that both reports the drop
    // and quietly emits something — which is the state "reported" is supposed to rule out. The
    // element carries its authored parameter through the module class and nothing else.
    expect(home).not.toMatch(/oldWayFill[^\n]*style=\{\{/);
    expect(home).toContain('<div className={styles.oldWayFill} />');
    expect(app.files['src/pages/Home.module.css']).toContain('width: 10%');
  });
});

describe('the negative arm — binding a kit port is not "everything binds now"', () => {
  /**
   * 🔴 The control on the `bindable` widening. It admits a port the kit **declares**; a wire into
   * a name the kit does not carry still refuses, and refuses with the sentence that is true of
   * the *running app* rather than of the export. Without this row, "the chart got its data" is
   * equally consistent with a gate that stopped asking anything.
   */
  test('a wire into a port the kit does not declare is still dropped, and says why', () => {
    expect(homeNotes).toEqual(
      expect.arrayContaining([
        expect.stringContaining('nodegx.charts.BarChart declares no input "barCount"')
      ])
    );
    expect(elementOf('BarChart')).not.toContain('barCount');
  });

  test('the Static Data node is kept because a read landed, not because everything is kept', () => {
    // The rows survive the disposition pass only because `staticRowsReadIds` names the node. The
    // complement of that is the note that used to be filed here, and it must be gone.
    expect(homeNotes.filter((note) => /not consumed by a rendered repeater/.test(note))).toEqual([]);
    expect(home).toContain('MONTHLY_REVENUE');
  });
});

describe("the selection outputs — the chart talks back to the graph", () => {
  test('a value output is lifted to state and a signal output runs the handler', () => {
    const element = elementOf('BarChart');
    expect(element).toContain('onSelectedLabelChanged={setSelectedLabel}');
    expect(element).toContain("onBarSelected={() => setOpenPopup('Picked')}");
    expect(home).toContain('const [selectedLabel, setSelectedLabel] = useState<string | undefined>();');
  });
});
