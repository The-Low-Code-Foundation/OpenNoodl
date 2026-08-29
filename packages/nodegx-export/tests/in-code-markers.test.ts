import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

import { Catalog, CatalogIndex } from '../src/catalog';
import { planProject } from '../src/analyze/plan';
import { emitApp } from '../src/emit/emitApp';
import { parseProject } from '../src/parse/parseProject';
import { ComponentIR, ConnectionIR, ExportIR, NodeIR, ParamValue } from '../src/ir/types';

/**
 * EXP-004's in-code markers — the half EXP-011 §19.5 measured and did not build.
 *
 * A refusal that could not emit an element has left a `TODO(export)` where the element would have
 * been since EXP-010 AC3. A refusal that dropped **a wire from an element which still renders**
 * left nothing at all: the element sat in the file with the right tag and one attribute missing,
 * looking correct and doing nothing. `puppy-test-3` emitted no marker at all while its report
 * listed nine refusals — so the grep the report itself recommends returned nothing, and a reader
 * could read that as an all-clear.
 *
 * The rows here are about the three things that pass could get wrong: marking the wrong end of a
 * wire, losing a marker on the way out, and emitting one that does not parse.
 */

const CATALOG_PATH = path.join(__dirname, '..', '..', 'noodl-types', 'src', 'node-catalog.json');
const catalog: Catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
const index = new CatalogIndex(catalog);

/** The plans behind an emitted app — the emitter does not hand them back, so they are re-derived. */
const plansOf = (ir: ExportIR) => [...planProject(ir, index).byLegacyPath.values()];

const FIXTURES = fs
  .readdirSync(path.join(__dirname, 'fixtures'), { withFileTypes: true })
  .filter((e) => e.isDirectory() && fs.existsSync(path.join(__dirname, 'fixtures', e.name, 'nodegx.project.json')))
  .map((e) => e.name)
  .sort();

const exportOf = (fixture: string) => emitApp(parseProject(path.join(__dirname, 'fixtures', fixture), catalog), catalog);

const sourcesOf = (app: ReturnType<typeof emitApp>) =>
  Object.entries(app.files).filter(([name]) => name.endsWith('.ts') || name.endsWith('.tsx'));

const markedNodesIn = (app: ReturnType<typeof emitApp>): Set<string> =>
  new Set(
    sourcesOf(app).flatMap(([, content]) =>
      [...content.matchAll(/TODO\(export\): node (\S+) renders/g)].map((m) => m[1])
    )
  );

describe('a dropped wire marks the end of it that renders', () => {
  /*
   * 🔴 **Both ends are answers, and which one is right differs per wire.** A wire *into* a rendered
   * node leaves that node showing a stale value, so the sink is where a reader looks. A wire *out
   * of* one — a button's `onClick` into a Record verb that refused — leaves a control that looks
   * live and does nothing, and its sink is a logic node that emits no element to mark at all. A
   * pass that only marked sinks would miss the more visible of the two.
   */
  const app = exportOf('puppy-test-3');
  const marked = markedNodesIn(app);

  it('marks the sink when the wire lands on a rendered element', () => {
    // `formatList` registers no output named "text", so `listText` renders as an empty <p/>.
    expect(marked).toContain('listText');
    const admin = app.files['src/pages/Admin.tsx'];
    expect(admin).toContain('JavaScriptFunction registers no output named "text"');
  });

  it('marks the source when the sink is a logic node that renders nothing', () => {
    // `deleteBtn`'s click feeds a Record verb naming no class: the button renders and does nothing.
    expect(marked).toContain('deleteBtn');
    expect(app.files['src/pages/Admin.tsx']).toContain('the wire out of "onClick"');
  });

  it('names the graph end a reader has to go back to, not only the port', () => {
    // The marker is only actionable if it says where in the graph to look (EXP-004).
    expect(app.files['src/pages/Admin.tsx']).toContain('DeleteDbModelProperties deleteRecord.store');
  });

  it('gathers every loss on one node into a single marker', () => {
    // `statusText.text` is fed by three verbs' Error ports; two are dropped as unordered.
    const admin = app.files['src/pages/Admin.tsx'];
    const statusMarkers = [...admin.matchAll(/TODO\(export\): node statusText renders/g)];
    expect(statusMarkers).toHaveLength(1);
    const block = admin.slice(admin.indexOf('TODO(export): node statusText renders'));
    expect(block.slice(0, block.indexOf('*/')).match(/already shows another node's Error/g)).toHaveLength(2);
  });

  it('leaves logic-to-logic refusals unmarked, which is why the report stays the list', () => {
    /*
     * The control for the rows above: this pass must NOT mark everything. `bp-ci:Ping` into a
     * Counter is a wire between two nodes that render nothing, and there is no element it could
     * sit on — a marker there would have to be invented, and the report is what carries it.
     */
    expect(marked).not.toContain('bp-counter');
    expect(app.report.components.flatMap((c) => c.notes).join('\n')).toContain('bp-ci:Ping->bp-counter:increase');
  });
});

describe('no marker is lost on the way out of the emitter', () => {
  /*
   * 🔴 **The failure this guards is the one the whole task is about.** A marker is recorded against
   * a node id and flushed where that node's element is placed. A node whose element some *other*
   * render path emits — popup slots go through `popupJsx`, not through `renderChildBlocks` — would
   * record a marker that nothing ever wrote out. The report would list the refusal, the grep it
   * recommends would find nothing, and the suite would stay green: exactly the shape of §19.5.
   *
   * So the invariant is asserted directly, over every fixture: a refusal on a node that renders
   * reaches the file. `preReturnMarkers` is the mechanism that makes it hold for paths the tree
   * walk does not reach.
   *
   * ⚠️ **The sweep's distinctive population is currently empty, and that is recorded rather than
   * claimed shut.** Removing it survives the suite today, because every node now carrying a marker
   * is either the root or somewhere in the render tree. It stays load-bearing for a shape the
   * corpus does not hold — a node with a role that no parent places, or a future render path like
   * `popupJsx` that builds its element without going through `renderChildBlocks` — and this
   * `it.each` is what would redden if such a node appeared and the sweep were gone. A guard whose
   * population is empty is worth keeping and not worth overstating.
   */
  it.each(FIXTURES)('%s — every refusal on a rendered node reaches the emitted code', (fixture) => {
    const ir = parseProject(path.join(__dirname, 'fixtures', fixture), catalog);
    const app = emitApp(ir, catalog);
    const marked = markedNodesIn(app);

    const owed = new Set<string>();
    for (const plan of plansOf(ir)) {
      if (!plan.file) continue;
      for (const wire of plan.droppedWires) {
        if (plan.roleOf[wire.toId] !== undefined) owed.add(wire.toId);
        else if (plan.roleOf[wire.fromId] !== undefined) owed.add(wire.fromId);
      }
    }
    expect([...owed].filter((id) => !marked.has(id))).toEqual([]);
  });

  it('the invariant is checked against a population that is not empty', () => {
    // A sweep over nothing passes on an emitter that writes no markers at all.
    const ir = parseProject(path.join(__dirname, 'fixtures', 'puppy-test-3'), catalog);
    const owed = plansOf(ir).flatMap((p) =>
      p.file ? p.droppedWires.filter((w) => p.roleOf[w.toId] !== undefined || p.roleOf[w.fromId] !== undefined) : []
    );
    expect(owed.length).toBeGreaterThan(0);
  });
});

describe('the marker survives the places JSX will not take a comment', () => {
  const FIXTURE = path.join(__dirname, 'fixtures', 'cheer');
  const baseIr = parseProject(FIXTURE, catalog);
  const literal = (value: string | number | boolean): ParamValue => ({ kind: 'literal', value }) as ParamValue;
  const componentOf = (ir: ExportIR, p: string): ComponentIR => ir.components.find((c) => c.path === p)!;
  const connect = (
    component: ComponentIR,
    from: string,
    fromProperty: string,
    to: string,
    toProperty: string,
    kind: ConnectionIR['kind'] = 'value'
  ) => {
    component.connections.push({ key: `${from}:${fromProperty}->${to}:${toProperty}`, fromId: from, fromProperty, toId: to, toProperty, kind });
  };
  const addNode = (component: ComponentIR, node: Partial<NodeIR> & { id: string; type: string }): NodeIR => {
    const full = { catalogRef: node.type, parameters: [], declaredPorts: [], portKnowledge: 'complete', ...node } as NodeIR;
    component.nodes.push(full);
    return full;
  };
  const parseErrorsIn = (app: ReturnType<typeof emitApp>): string[] =>
    sourcesOf(app).flatMap(([file, source]) => {
      const sf = ts.createSourceFile(file, source, ts.ScriptTarget.ESNext, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
      const diagnostics = (sf as unknown as { parseDiagnostics: ts.Diagnostic[] }).parseDiagnostics ?? [];
      return diagnostics.map((d) => `${file}: ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`);
    });

  it('a port name carrying a comment terminator does not end the comment early', () => {
    /*
     * 🔴 **No fixture produces this and the corpus never will — which is the reason to write it.**
     * A port name is author content, and a marker is a block comment: a `*` `/` inside one closes
     * it, and the rest of the marker becomes code. The emitted file then fails to parse, or worse
     * parses as something else. `commentSafe` neutralises the sequence; this row is what says so.
     */
    const ir: ExportIR = JSON.parse(JSON.stringify(baseIr));
    const mood = componentOf(ir, 'Pages/Mood');
    const ghost = addNode(mood, {
      id: 'subGhost',
      type: 'net.noodl.GlobalStore.Subscribe',
      parameters: [
        { name: 'storeName', value: literal('mood') },
        { name: 'keys', value: literal('no*/suchkey') }
      ]
    });
    connect(mood, ghost.id, 'value', 'noteEcho', 'text');
    const app = emitApp(ir, catalog);

    expect(parseErrorsIn(app)).toEqual([]);
    const mooded = app.files[Object.keys(app.files).find((k) => k.endsWith('Mood.tsx'))!];
    expect(mooded).toContain('TODO(export)');
    // The name still reads, and the terminator is broken up rather than dropped in silence.
    expect(mooded).toContain('no* /suchkey');
  });

  it('the root element is marked with line comments, because JSX has no sibling position there', () => {
    /*
     * `return ( … )` holds exactly one expression, as does the body of `{cond && ( … )}`. A comment
     * prepended to the root would be a second one and would not parse — so the root's markers go
     * above the `return` as `//` lines. The parse sweep is the control; this row names the shape.
     *
     * ⚠️ **This row kills only the conjunction, and that is a fact about the code, not a hole.**
     * Mutating away the explicit root call survives, and so does mutating away the leftover sweep
     * below — because they are two entry points to one mechanism: drop the explicit call and the
     * root simply stops being flushed, so the sweep collects it instead. Removing **both** reddens
     * this row. The explicit call is kept for what it says (the root cannot be a sibling) and for
     * putting the root's own losses first; the redundancy is deliberate and is written down here
     * rather than left for the next reader to rediscover from a surviving mutant.
     */
    const admin = exportOf('puppy-test-3').files['src/pages/AdminLogin.tsx'];
    expect(admin).toMatch(/\/\/ TODO\(export\): node \S+ renders/);
    expect(admin.slice(0, admin.indexOf('return ('))).toContain('TODO(export)');
  });

  it('every emitted file in every fixture still parses with markers in it', () => {
    for (const fixture of FIXTURES) expect(parseErrorsIn(exportOf(fixture))).toEqual([]);
  });
});
