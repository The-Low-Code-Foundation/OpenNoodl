/**
 * HLS-005 — the report does not say "nothing left over" when something was.
 *
 * ## The defect, and the rule that caused it
 *
 * [#23](https://github.com/The-Low-Code-Foundation/NodeGX/issues/23): 7 of 25 component inputs
 * emitted as props that are declared and never read, five of them in components the report filed
 * under *"Translated with nothing left over"*. The authored wire is gone, the value evaporates,
 * and the one surface that could have said so said the opposite.
 *
 * 🔴 **The rule that decided whether a binding was emitted was "some builder happened to look at
 * it", and it was written down nowhere.** `planComponent` records `plan.bindings[node][port]` for
 * *every* Component Inputs wire into a rendered node, without asking whether anything downstream
 * can render one. The emitter's builders then divide into two shapes and both leak:
 *
 * - `styleAttrs` iterates the **rule table** (`WIRED_STYLE_SINKS`, which is three ports wide:
 *   `opacity`, `color`, `backgroundColor`) and looks bindings up. A binding on any other port is
 *   never visited, so it is never reported.
 * - `contentAttrs` iterates the **bindings** but `continue`s on any port with no `attr:` role.
 *
 * A property in neither table falls through both in silence. That is the whole defect, and it is
 * why #23's table has one input reaching three sinks of which two survive: the difference between
 * the survivors and the casualty is not the input, it is whether the *sink* is in a table.
 *
 * 🔴 **Neither end of the chain could see it.** The plan's count of bindings is right. The
 * emitter's count of attributes is right. Nothing compared them, and two gates covering the ends
 * of a chain read as coverage. `emitComponent` now closes that with a claim ledger written at the
 * point each binding is consumed — never re-derived from the rule tables, because a second copy of
 * "which ports can render a binding" is a copy that drifts silently in exactly this direction.
 *
 * ## What was measured before anything was built (2026-09-09, `cline-dev`)
 *
 * The corpus already carried the shape, so nothing here rests on the reconstruction alone:
 *
 * - **9 props declared and never read**, across 4 of the 21 generated components that declare a
 *   `Props` interface (50 props declared in total).
 * - **6 of the 9 were already named** by a note. **3 were silent.**
 * - **1 component was the lie itself**: `batch-desk/Notify`, in *"Translated with nothing left
 *   over"* with zero notes and zero refusals while carrying an unread prop.
 * - `puppy-test-3/Components/BenchProbe` is #23's table one construct over: `Title`→`text` and
 *   `Accent`→`color` survived, and **`Align`→`textAlignX` vanished with nothing said.**
 *
 * ⚠️ **The first instrument was blind and its zero meant nothing.** Checking "declared in the
 * interface but not destructured in the signature" reported 0 of 50 — because `emitComponent`
 * builds the interface and the destructure from the *same* `plan.props` list, so that reading is
 * impossible by construction. The defect is a prop destructured and never used in the body. A
 * measurement that cannot fire is not evidence of absence, and this one is recorded because the
 * zero it produced was persuasive.
 */

import * as fs from 'fs';
import * as path from 'path';

import * as ts from 'typescript';

import { Catalog, loadCatalog } from '../src/catalog';
import { EmittedApp, emitApp } from '../src/emit/emitApp';
import { summarizePreflight } from '../src/emit/preflight';
import { parseProject } from '../src/parse/parseProject';

const catalog: Catalog = loadCatalog();
const FIXTURES = path.join(__dirname, 'fixtures');

const RECONSTRUCTION = 'status-rail';

/** Every corpus project. `kits` last only so a parse failure there is legible on its own. */
const corpus = (): string[] =>
  fs
    .readdirSync(FIXTURES)
    .filter((name) => fs.statSync(path.join(FIXTURES, name)).isDirectory())
    .sort();

const irOf = (fixture: string) => parseProject(path.join(FIXTURES, fixture), catalog);
const appOf = (fixture: string): EmittedApp => emitApp(irOf(fixture), catalog);

/**
 * The props a generated component declares and its body never reads — **off the emitted `.tsx`,
 * never off the plan that produced it.**
 *
 * 🔴 A check fed by its own producer cannot bootstrap: the report is generated from the same
 * analysis that decided the drop, so asking the plan whether it dropped anything is asking the
 * defendant. This parses the artefact.
 *
 * "Read" is deliberately the loosest defensible test — *the identifier appears anywhere in the
 * function body*. It over-counts reads, so every prop it reports as unread really is unread, and
 * the population below is a floor rather than a guess.
 */
function unreadProps(file: string, content: string): string[] {
  const source = ts.createSourceFile(file, content, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TSX);
  const interfaces = new Map<string, string[]>();
  source.forEachChild((node) => {
    if (ts.isInterfaceDeclaration(node) && node.name.text.endsWith('Props')) {
      interfaces.set(
        node.name.text,
        node.members.filter(ts.isPropertySignature).map((member) => (member.name as ts.Identifier).text)
      );
    }
  });
  const unread: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isFunctionDeclaration(node) && node.parameters.length === 1 && node.body !== undefined) {
      const parameter = node.parameters[0];
      const typeName =
        parameter.type !== undefined && ts.isTypeReferenceNode(parameter.type) ? parameter.type.typeName.getText() : undefined;
      const declared = typeName === undefined ? undefined : interfaces.get(typeName);
      if (declared !== undefined) {
        const seen = new Set<string>();
        const walk = (child: ts.Node): void => {
          if (ts.isIdentifier(child)) seen.add(child.text);
          child.forEachChild(walk);
        };
        walk(node.body);
        unread.push(...declared.filter((name) => !seen.has(name)));
      }
    }
    node.forEachChild(visit);
  };
  source.forEachChild(visit);
  return unread;
}

/**
 * Component Inputs ports that the author actually wired somewhere in that component.
 *
 * ⚠️ **The distinction this draws is the whole reason the gate below is not simply "no unread
 * prop".** A port declared on a `Component Inputs` node and wired to nothing is an *honest* unread
 * prop: the interface is what the author declared, the emitted app delivers exactly as much as the
 * running app does, and there is nothing to report. `puppy-test-3`'s `Ghost` is that, and a gate
 * that reddened on it would be a gate that rejects the correct answer.
 */
function wiredInputPorts(component: { nodes: Array<{ id: string; type: string }>; connections: Array<{ fromId: string; fromProperty: string }> }): Set<string> {
  const inputNodeIds = new Set(component.nodes.filter((node) => node.type === 'Component Inputs').map((node) => node.id));
  const wired = new Set<string>();
  for (const connection of component.connections) {
    if (inputNodeIds.has(connection.fromId)) wired.add(connection.fromProperty);
  }
  return wired;
}

/** Everything the report says about one component, as one searchable string. */
function reportText(app: EmittedApp, componentPath: string): string {
  const entry = app.report.components.find((component) => component.path === componentPath);
  if (entry === undefined) return '';
  return [...entry.notes, ...(entry.refusals ?? []).map((refusal) => `${refusal.reason} ${refusal.nodeId} ${refusal.label ?? ''}`)].join(' | ');
}

/**
 * Does the report name this prop — under the prop identifier, or under the port name it came from?
 *
 * `on`-prefixed output props are `on` + Capitalised port (`rowRemoved` → `onRowRemoved`), and the
 * notes are written in the graph's vocabulary. Matching both is the **loose** direction on
 * purpose: a false "named" understates the defect, which is the safe way for this gate to be
 * wrong.
 */
function namedInReport(text: string, prop: string): boolean {
  const port = /^on[A-Z]/.test(prop) ? `${prop.slice(2, 3).toLowerCase()}${prop.slice(3)}` : prop;
  return new RegExp(`\\b(${prop}|${port})\\b`, 'i').test(text);
}

type Silent = { fixture: string; component: string; prop: string; inWhole: boolean };

/** Every wired-but-unread prop the report does not name, over the whole corpus. */
function silentDrops(): Silent[] {
  const found: Silent[] = [];
  for (const fixture of corpus()) {
    const ir = irOf(fixture);
    const app = emitApp(ir, catalog);
    const summary = summarizePreflight(app);
    for (const component of app.report.components) {
      if (component.file === null) continue;
      const content = app.files[component.file];
      if (content === undefined) continue;
      const source = ir.components.find((candidate) => candidate.path === component.path);
      const wired = source === undefined ? new Set<string>() : wiredInputPorts(source);
      const text = reportText(app, component.path);
      for (const prop of unreadProps(component.file, content)) {
        if (!wired.has(prop)) continue;
        if (namedInReport(text, prop)) continue;
        found.push({ fixture, component: component.path, prop, inWhole: summary.whole.includes(component.path) });
      }
    }
  }
  return found;
}

/**
 * The one wired-but-unread prop the corpus still carries, and why it is allowed.
 *
 * 🔴 **Pinned as a population, not waived as a class.** Any *new* silent drop reddens the gate,
 * which is the property that makes this list worth keeping rather than replacing with a rule.
 *
 * `batch-desk/Notify` is a **Run Tasks template**: its `Do` chain was not dropped, it was
 * *relocated*. The emitted component runs the chain in a mount effect, because mounting is when
 * `startTask` pulses it. The behaviour survives, the prop is vestigial, and the row below asserts
 * the artefact says so — so this pin stops being justified the moment the relocation stops
 * happening, rather than quietly outliving its reason.
 */
const ALLOWED_UNREAD = [{ fixture: 'batch-desk', component: 'Notify', prop: 'Do' }];

describe('HLS-005 AC2 — no generated component drops a wired input without the report naming it', () => {
  test('the corpus is one this gate can actually fail on', () => {
    // 🔴 An absence assertion beside a known-firing signal. If the corpus stopped emitting props
    // at all, every row below would pass by having nothing to look at.
    let componentsWithProps = 0;
    let propsDeclared = 0;
    for (const fixture of corpus()) {
      const app = appOf(fixture);
      for (const [file, content] of Object.entries(app.files)) {
        if (!file.endsWith('.tsx') || !/interface \w*Props \{/.test(content)) continue;
        componentsWithProps += 1;
        propsDeclared += (content.match(/^ {2}\w+\??:/gm) ?? []).length;
      }
    }
    expect(componentsWithProps).toBeGreaterThanOrEqual(20);
    expect(propsDeclared).toBeGreaterThanOrEqual(40);
  });

  test('every wired component input is emitted, or named in the report', () => {
    const silent = silentDrops().map(({ fixture, component, prop }) => ({ fixture, component, prop }));
    expect(silent).toEqual(ALLOWED_UNREAD);
  });

  test('the one pinned exception is justified by the artefact, not by this file', () => {
    const app = appOf('batch-desk');
    const notify = app.files['src/components/Notify.tsx'];
    // The relocation, in the emitted component's own words. `Do` is unread because mounting is
    // the pulse — not because a wire was lost.
    expect(notify).toContain('Run Tasks template');
    expect(notify).toContain("its \"Do\" chain runs once on mount");
    expect(notify).toContain('useEffect');
  });
});

describe('HLS-005 AC3 — "nothing left over" cannot contradict itself', () => {
  test('no component in the list carries a note or a refusal row', () => {
    for (const fixture of corpus()) {
      const app = appOf(fixture);
      const summary = summarizePreflight(app);
      for (const componentPath of summary.whole) {
        const entry = app.report.components.find((component) => component.path === componentPath)!;
        expect({ componentPath, notes: entry.notes, refusals: entry.refusals ?? [] }).toEqual({
          componentPath,
          notes: [],
          refusals: []
        });
      }
    }
  });

  test('no component in the list carries a silently dropped input wire', () => {
    const lying = silentDrops()
      .filter((drop) => drop.inWhole)
      .map(({ fixture, component, prop }) => ({ fixture, component, prop }));
    // Measured before the fix: `batch-desk/Notify` was the only component in the corpus filed
    // under "nothing left over" while carrying an unread prop, and it is the pinned relocation.
    expect(lying).toEqual(ALLOWED_UNREAD);
  });
});

describe('HLS-005 AC4 — issue #23\'s table, reconstructed and accounted for by name', () => {
  /**
   * ⚠️ **A reconstruction, and labelled as one.** #23's project was never shared, so
   * `tests/fixtures/status-rail` is built from the four rows in the issue's own table, keeping its
   * node ids (`sr_fill`, `sr_ptext`, `sr_pdot`) so the two can be read side by side:
   *
   * ```
   * statusColor -> sr_fill.backgroundColor   translated (inline style)
   * statusColor -> sr_ptext.color            translated (inline style)
   * statusColor -> sr_pdot.backgroundColor   DROPPED, unreported
   * load        -> sr_fill.width             DROPPED, unreported
   * ```
   */
  const app = appOf(RECONSTRUCTION);
  const file = 'src/components/StatusRail.tsx';
  const source = app.files[file];
  const railNotes = app.report.components.find((component) => component.path === 'Components/StatusRail')!.notes;

  test('the fixture carries the shape: one input to three sinks, and a second to a dimension port', () => {
    // Named rather than assumed — if the fixture drifts, this says so before the rows below stop
    // meaning anything.
    const rail = irOf(RECONSTRUCTION).components.find((component) => component.path === 'Components/StatusRail')!;
    expect(rail.connections.map((connection) => `${connection.fromProperty}->${connection.toId}.${connection.toProperty}`).sort()).toEqual([
      'load->sr_fill.width',
      'statusColor->sr_fill.backgroundColor',
      'statusColor->sr_pdot.backgroundColor',
      'statusColor->sr_ptext.color'
    ]);
  });

  test('rows 1 and 2 translate — the prop reaches the style, not merely the file', () => {
    // 🔴 The consequence, not the mechanism: the binding has to be the *source expression* of the
    // style property, which a `toContain` on the prop name alone would pass on dead code.
    expect(source).toContain('<div className={styles.srFill} style={{ backgroundColor: statusColor }} />');
    expect(source).toContain('<p className={styles.srPtext} style={{ color: statusColor }}>Load</p>');
  });

  test('🔴 row 4 is refused loudly — named by input and by sink, in the report and in the code', () => {
    // The author arrives with the name `load`, which is the name #23's table is written in. A note
    // that named only `sr_fill.width` would be unsearchable by the only name they have.
    expect(railNotes).toEqual([
      'wire into sr_fill.width from component input "load" has no rendered sink on Group — the property renders from its authored parameter only, so the wire is dropped, reported'
    ]);
    expect(source).toContain('the wire into "width" from component input "load" has no rendered sink on Group');
    expect(source).toContain('TODO(export)');
  });

  test('and `load` reaches no style, so the refusal is not describing a wire that survived', () => {
    // The complement of the row above: the prop is declared and destructured, and the only places
    // it appears are the interface, the destructure and the marker. Nothing binds it.
    expect(source).toContain('load?: number;');
    expect(unreadProps(file, source)).toEqual(['load']);
  });

  test('the component is NOT filed under "nothing left over"', () => {
    expect(summarizePreflight(app).whole).not.toContain('Components/StatusRail');
  });

  test('⚠️ row 3 does not reproduce on this exporter, and that is recorded rather than engineered away', () => {
    // #23 measured `sr_pdot.backgroundColor` DROPPED while `sr_fill.backgroundColor` beside it
    // translated. Here both translate: `backgroundColor` is in `WIRED_STYLE_SINKS` and both nodes
    // are Groups, so nothing distinguishes them. Whatever made the reporter's third row differ is
    // a property of their project this table does not carry — most likely the sink node was not a
    // plain visual node. Left as a measurement, because inventing a fixture that reproduces a row
    // by a mechanism nobody has measured would be a gate testing its author's guess.
    expect(source).toContain('<div className={styles.srPdot} style={{ backgroundColor: statusColor }} />');
  });
});

/**
 * 🔴 **The reverted arm: the defect restored, not the repair removed.**
 *
 * The sweep's whole contribution to an export is (a) one note per unaccounted binding and (b) the
 * `TODO(export)` marker `defer` puts above the `return`. Taking both back out of an *emitted* app
 * reproduces byte for byte what the pre-HLS-005 emitter wrote — verified against the real thing on
 * `puppy-test-3` before the golden was regenerated: the diff over 840 corpus hashes was exactly
 * one note, one report line, one refusal count (7 → 8) and one marker, in one project.
 *
 * It is a transform on the **output**, never a second copy of the emitter, so it cannot drift away
 * from what it claims to reproduce. The rows assert it actually fired, because a mutant that
 * changed nothing grades nothing.
 */
const SWEEP_NOTE = 'has no rendered sink on';

function revertToPreHls005(app: EmittedApp): EmittedApp {
  const withoutSweep = (notes: string[]): string[] => notes.filter((note) => !note.includes(SWEEP_NOTE));
  const files: Record<string, string> = {};
  for (const [file, content] of Object.entries(app.files)) {
    files[file] = content
      .split('\n')
      .filter((line) => !line.includes(SWEEP_NOTE))
      // The marker's other three lines are dead once its only bullet is gone.
      .filter((line, index, lines) => !(/TODO\(export\)/.test(line) && !lines.slice(index).some((rest) => /^\s*\/\/\s+- /.test(rest))))
      .join('\n');
  }
  return {
    ...app,
    files,
    notes: withoutSweep(app.notes),
    report: {
      ...app.report,
      components: app.report.components.map((component) => ({ ...component, notes: withoutSweep(component.notes) }))
    }
  };
}

describe('HLS-005 — the reverted arm restores #23, and the gates above see it', () => {
  const app = appOf(RECONSTRUCTION);
  const reverted = revertToPreHls005(app);
  const file = 'src/components/StatusRail.tsx';

  test('the mutant fired — it is not a no-op transform making the rows below vacuous', () => {
    expect(reverted.files[file]).not.toBe(app.files[file]);
    expect(reverted.notes).not.toEqual(app.notes);
  });

  test('⚠️ the reverted arm is still a program — its failure is the defect, not a broken edit', () => {
    // A mutant that no longer parses would fail every assertion for the wrong reason.
    const parsed = ts.createSourceFile(file, reverted.files[file], ts.ScriptTarget.ESNext, true, ts.ScriptKind.TSX);
    expect((parsed as unknown as { parseDiagnostics: unknown[] }).parseDiagnostics).toHaveLength(0);
    expect(reverted.files[file]).toContain('export function StatusRail');
  });

  test('🔴 reverted, the wire vanishes in silence — nothing names `load` or `width` anywhere', () => {
    expect(reverted.files[file]).not.toContain('TODO(export)');
    expect(reverted.notes.filter((note) => /width|load/i.test(note))).toEqual([]);
    expect(reverted.report.components.find((component) => component.path === 'Components/StatusRail')!.notes).toEqual([]);
  });

  test('🔴 reverted, the report tells the lie: the component is "translated with nothing left over"', () => {
    // This is #23's actual complaint, reproduced: the component is in the reassuring list while an
    // authored wire is gone. It is the one thing the exporter should not be able to state.
    expect(summarizePreflight(reverted).whole).toContain('Components/StatusRail');
    // And it is still the same export otherwise — the rail renders, the two survivors survive.
    expect(reverted.files[file]).toContain('style={{ backgroundColor: statusColor }}');
  });
});

/**
 * Register row C42 — the exporting machine's filesystem, out of an artefact a CI job publishes.
 *
 * Measured 2026-09-09: the `kits` corpus project put
 * `/Users/<somebody>/…/tests/fixtures/kits/noodl_modules/gone-kit/index.js` into
 * `EXPORT-REPORT.md`, from the absolute path Node writes into an `ENOENT`. It was the only
 * absolute path anywhere in the corpus's emitted output.
 */
describe('HLS-005 / C42 — no machine path in a published artefact', () => {
  test('no emitted file names a path outside the project', () => {
    const offenders: string[] = [];
    for (const fixture of corpus()) {
      const app = appOf(fixture);
      for (const [file, content] of Object.entries(app.files)) {
        for (const line of content.split('\n')) {
          if (/['"( ]\/(Users|home|private|tmp|var)\//.test(line)) offenders.push(`${fixture} ${file}: ${line.trim()}`);
        }
      }
      for (const note of app.notes) {
        if (/['"( ]\/(Users|home|private|tmp|var)\//.test(note)) offenders.push(`${fixture} @notes: ${note}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  test('the fix removed the machine and kept the diagnostic', () => {
    // 🔴 A gate that only asserted the absence would pass just as well on a message that had been
    // emptied. What an author needs is still there, and named in the vocabulary they would type.
    const note = appOf('kits').notes.find((candidate) => candidate.includes('gone-kit'))!;
    expect(note).toContain('ENOENT: no such file or directory');
    expect(note).toContain("open 'noodl_modules/gone-kit/index.js'");
    expect(note).not.toContain(path.join(FIXTURES, 'kits'));
  });
});
