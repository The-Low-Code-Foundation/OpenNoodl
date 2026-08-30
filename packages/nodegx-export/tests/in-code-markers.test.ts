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

/** Parse diagnostics for every emitted TS/TSX file — the control every marker row leans on. */
const parseErrorsIn = (app: ReturnType<typeof emitApp>): string[] =>
  sourcesOf(app).flatMap(([file, source]) => {
    const sf = ts.createSourceFile(file, source, ts.ScriptTarget.ESNext, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const diagnostics = (sf as unknown as { parseDiagnostics: ts.Diagnostic[] }).parseDiagnostics ?? [];
    return diagnostics.map((d) => `${file}: ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`);
  });

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

describe("a refused script node's own source is preserved (EXP-004)", () => {
  /*
   * EXP-004 asks for markers "with the original node source preserved in comments so a developer
   * can see what the code is meant to do". The markers above name the node and the reason; this
   * is the source half.
   *
   * 🔴 **The half that was missing was the half that matters.** A wrapper prints only when
   * something that survived references it. A Function whose translation *worked* therefore has
   * its body in the file as code — and a Function this export **refused** had its body dropped
   * with the wrapper, which is exactly the case where the body is the only statement of what the
   * developer now has to write. On `puppy-test-3` the marker beside the empty `<p>` named
   * `formatList.text` and `formatList` existed nowhere in the exported repo.
   *
   * Measured on the corpus before building: 4 of 332 nodes carry `sourceText`, 3 reach a
   * `jsFunctions` definition, and exactly 1 of those never prints its body. The corpus number is
   * small; the product surface is not, because a Function whose outputs feed nothing statically
   * translatable is an ordinary thing to author.
   */
  const CHEER = path.join(__dirname, 'fixtures', 'cheer');
  const cheerIr = parseProject(CHEER, catalog);
  const cloneCheer = (): ExportIR => JSON.parse(JSON.stringify(cheerIr));
  const homeOf = (ir: ExportIR): ComponentIR => ir.components.find((c) => c.path === 'Pages/Home')!;
  const homeSourceOf = (ir: ExportIR): string => String(emitApp(ir, catalog).files['src/pages/Home.tsx']);
  /** The body of cheer's `formatShout`, which the fixture wires and this suite un-wires. */
  const SHOUT_BODY = "name.toUpperCase() + '!'";

  it("preserves the body of the corpus Function whose wrapper never prints, and names the node the marker names", () => {
    const admin = exportOf('puppy-test-3').files['src/pages/Admin.tsx'];
    // The inline marker points the reader at `formatList` — this is what it points them to.
    expect(admin).toContain('the wire into "text", from JavaScriptFunction formatList.text');
    expect(admin).toContain('TODO(export): the Function "Format Puppy List" (node formatList)');
    expect(admin).toContain('//   const list = Inputs.items || [];');
    expect(admin).toContain("//   Outputs.text = list.map(p =>");
  });

  it('a referenced Function prints its wrapper and gets no preserved-source comment', () => {
    /*
     * The control half of the pair below. One wire is the only difference between the two rows,
     * and it is the wire that decides whether anything reads the node's outputs.
     */
    const home = homeSourceOf(cloneCheer());
    expect(home).toContain('function formatShout(');
    expect(home).toContain(SHOUT_BODY);
    expect(home).not.toContain('TODO(export): the Function');
  });

  it('cutting the one wire that reads it drops the wrapper and keeps the body as a comment', () => {
    const ir = cloneCheer();
    const home = homeOf(ir);
    const before = home.connections.length;
    home.connections = home.connections.filter((c) => c.fromId !== 'formatShout');
    // The variable is one wire, and it is asserted rather than assumed.
    expect(before - home.connections.length).toBe(1);

    const source = homeSourceOf(ir);
    expect(source).not.toContain('function formatShout(');
    expect(source).toContain('TODO(export): the Function "formatShout" (node formatShout)');
    // 🔴 The point of the whole row: the author's code survives the refusal.
    expect(source).toContain(`//   Outputs.text = ${SHOUT_BODY};`);
  });

  it('a Function with no wires at all still leaves its source behind', () => {
    /*
     * The orphan is the case a reader would expect to fall through the gap, because nothing
     * reads it *and* nothing feeds it. The definition is still registered, so it is still
     * carried. This row is here because "it happened to work" and "it is guaranteed" are
     * different claims, and only a row makes it the second one.
     */
    const ir = cloneCheer();
    const home = homeOf(ir);
    home.connections = home.connections.filter((c) => c.fromId !== 'formatShout' && c.toId !== 'formatShout');
    const source = homeSourceOf(ir);
    expect(source).toContain('TODO(export): the Function');
    expect(source).toContain(SHOUT_BODY);
  });

  it('a body carrying U+2028 does not end the comment that carries it', () => {
    /*
     * 🔴 **U+2028 and U+2029 are JS line terminators**, so they close a `//` comment exactly as a
     * newline does and spill the rest of the line into the module as code. Confirmed against all
     * three parsers the exported app meets — TypeScript, esbuild and V8 — each of which reports
     * *Unterminated string literal* on the naive rendering. A body carrying one inside a string
     * literal is author content the corpus will never produce, which is the reason to write it.
     *
     * ⚠️ **The escape, never the literal.** A literal U+2028 in this file would end *this*
     * string too, and the file would not compile — which is how the hazard was confirmed.
     */
    const ir = cloneCheer();
    const home = homeOf(ir);
    home.connections = home.connections.filter((c) => c.fromId !== 'formatShout');
    const script = home.nodes.find((n) => n.id === 'formatShout')!.parameters.find((p) => p.name === 'functionScript')!;
    script.value = { kind: 'script', source: "const sep = '\u2028';\nOutputs.text = 'a' + sep + 'b';" } as ParamValue;

    const app = emitApp(ir, catalog);
    const source = String(app.files['src/pages/Home.tsx']);
    // The terminator is spent as a line break inside the comment block, so none reaches the file.
    expect(source).not.toContain('\u2028');
    expect(source).toContain("//   const sep = '");
    expect(source).toContain("//   Outputs.text = 'a' + sep + 'b';");
    expect(parseErrorsIn(app)).toEqual([]);
  });
});

describe("a refused script on a node that is not a Function is preserved too (EXP-004)", () => {
  /*
   * The same loss one node-family over, and it was silent until it was measured.
   *
   * `refusedSourceLines` covers Function / Expression / Visual Function, because those three are
   * `jsFunctions` and have a wrapper to withhold. Every other script-bearing node carries its
   * JavaScript as a **parameter** of a node doing something else — a Map Collection's mapping, a
   * Repeater's template, a Script node's code. A `Map Collection` whose mapping the export
   * refuses is deferred with a reason and an in-code marker naming it, and its script appeared
   * **nowhere in the exported repo** — the exact case §20 built the Function half for, where the
   * authored text is the only statement of what the developer now has to write.
   *
   * 🔴 The refusal arm alone proves nothing, so the control is the first row: a Map Collection
   * whose mapping *does* translate must get no comment, or "a comment appeared" is equally
   * consistent with a comment appearing always.
   *
   * ⚠️ These rows re-parse a patched copy on disk rather than editing a parsed `ExportIR`. The
   * emitted comment prints `NodeIR.sourceText`, which the **parser** writes from the same
   * parameter the refusal reads — so an in-memory edit to the parameter alone leaves the two
   * disagreeing and the row measures a state production never reaches. Found by writing it the
   * other way first, and watching the original mapping come back in the comment.
   */
  const SHELF = path.join(__dirname, 'fixtures', 'reading-shelf');
  /** The fixture re-parsed from a temp copy whose `Pages/Home` node doc `patch` has edited. */
  const shelfPatched = (
    patch: (doc: { nodes: Array<Record<string, unknown>> }) => void,
    alsoPatch?: (dir: string) => void
  ): ReturnType<typeof emitApp> => {
    const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'nodegx-refused-script-'));
    try {
      fs.cpSync(SHELF, dir, { recursive: true });
      const nodesPath = path.join(dir, 'components', 'Pages', 'Home', 'nodes.json');
      const doc = JSON.parse(fs.readFileSync(nodesPath, 'utf8'));
      patch(doc);
      fs.writeFileSync(nodesPath, JSON.stringify(doc));
      alsoPatch?.(dir);
      return emitApp(parseProject(dir, catalog), catalog);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  };

  /**
   * A component written into the temp copy carrying `nodes`, and nothing else.
   *
   * A component with no node that renders takes `planComponent`'s **logic-only** early return, so
   * this is how §27.6's population is reached at all: the seven fixtures contain 36 components,
   * 8 of which emit no file, and **none** of those 8 carries a script. The corpus is this rule's
   * zero control, not its subject — measured before these rows were written, because a checker
   * whose population is empty passes for the wrong reason.
   */
  const addComponent = (dir: string, name: string, nodes: Array<Record<string, unknown>>): void => {
    const compDir = path.join(dir, 'components', 'Components', name);
    fs.mkdirSync(compDir, { recursive: true });
    fs.writeFileSync(
      path.join(compDir, 'component.json'),
      JSON.stringify({ id: `id-${name}`, name, path: `/Components/${name}`, type: 'visual' })
    );
    fs.writeFileSync(path.join(compDir, 'nodes.json'), JSON.stringify({ nodes }));
    fs.writeFileSync(path.join(compDir, 'connections.json'), JSON.stringify({ connections: [] }));
  };

  const TALLY = { id: 'tallyNode', type: 'Javascript2', label: 'Tally', parameters: { code: 'define({\n  run() { this.setOutputs({ total: 2 }); }\n})\n' }, x: 100, y: 100 };
  const reportOf = (app: ReturnType<typeof emitApp>): string => String(app.files['EXPORT-REPORT.md']);
  const shelfWithMapping = (mapScript: string): ReturnType<typeof emitApp> =>
    shelfPatched((doc) => {
      const toRow = doc.nodes.find((n) => (n as { id: string }).id === 'toRow') as { type: string; parameters: Record<string, unknown> };
      expect(toRow.type).toBe('Map Collection');
      toRow.parameters.mapScript = mapScript;
    });

  it('CONTROL: a Map Collection whose mapping translates gets no preserved-source comment', () => {
    const home = String(exportOf('reading-shelf').files['src/pages/Home.tsx']);
    expect(home).not.toContain('has an authored script that');
    // ...and the reason it needs none: the mapping is in the file, as the thing it means.
    expect(home).toContain('badge:');
  });

  it('a Map Collection whose Script is refused keeps that script in the emitted file', () => {
    // A function-valued mapping — `parseIdentityMapping` refuses it, which is the whole premise.
    const app = shelfWithMapping("map({\n  title: 'title',\n  badge: function (r) { return r.shelf.toUpperCase(); }\n})\n");
    const home = String(app.files['src/pages/Home.tsx']);
    expect(home).toContain('TODO(export): the Map Collection "To row" (node toRow) has an authored script that');
    // 🔴 The point of the row: the author's code survives the refusal, **verbatim** — the
    // author's own two-space indent is still there under the comment prefix, because "never
    // trimmed, never reformatted" is the contract and a re-indented record is a rewritten one.
    expect(home).toContain('//   map({');
    expect(home).toContain("//     title: 'title',");
    expect(home).toContain('//     badge: function (r) { return r.shelf.toUpperCase(); }');
    expect(home).toContain('//   })');
    expect(parseErrorsIn(app)).toEqual([]);
  });

  it('reaches a Script node, whose entire content is the code that was being dropped', () => {
    /*
     * 🔴 The population claim, measured rather than argued. `Map Collection` refuses at a named
     * site; `Javascript2` has no site at all — it is a deferred *type*, and falls through the
     * generic path. If the rule were quietly Map-Collection-shaped this row is where that shows,
     * and this is the case that costs the most: a Script node is nothing **but** its code, so
     * before this the whole node left the export without a trace of what it did.
     */
    const app = shelfPatched((doc) => {
      doc.nodes.push({
        id: 'scriptNode',
        type: 'Javascript2',
        label: 'Tally',
        parameters: { code: 'define({\n  run() { this.setOutputs({ total: 2 }); }\n})\n' },
        x: 900,
        y: 200
      });
    });
    const home = String(app.files['src/pages/Home.tsx']);
    expect(home).toContain('TODO(export): the Javascript2 "Tally" (node scriptNode) has an authored script that');
    expect(home).toContain('//     run() { this.setOutputs({ total: 2 }); }');
    expect(parseErrorsIn(app)).toEqual([]);
  });

  it('the whole unmutated corpus emits no preserved-script comment at all', () => {
    /*
     * The false-positive half. This block prints for any script-bearing node the plan did not
     * record as translated, and the population is every node in every component — a rule one
     * predicate too wide would decorate the corpus with comments claiming code was lost when it
     * was not. Seven fixtures, zero comments.
     */
    for (const fixture of FIXTURES) {
      const files = exportOf(fixture).files as Record<string, string>;
      for (const [name, body] of Object.entries(files)) {
        expect(`${fixture}/${name}: ${String(body).includes('has an authored script that')}`).toBe(`${fixture}/${name}: false`);
      }
    }
  });

  /*
   * ── §27.6: the components that emit no file ───────────────────────────────────────────────
   *
   * §27 preserved a refused script as a comment in the module its component emitted, and said so
   * about the components that emit none: the router shell and a logic-only component return
   * before the sweep, so a `Script` node in one still lost its code entirely. There is no module
   * for a comment to live in, so the **report** carries it — the same choice the record-neighbour
   * sweep already had to make at the same early return.
   *
   * 🔴 Which carrier holds a script is decided by whether a file exists, never by a filter:
   * `emitApp` fills `preservedScripts` in its skip branch and only there. The duplicate row below
   * is what holds that, because "the report also prints it" is the failure that looks like
   * success.
   */
  it('a logic-only component keeps its Script in the report, which is the only place it can be', () => {
    const app = shelfPatched(
      () => {},
      (dir) => addComponent(dir, 'Tally', [TALLY])
    );
    const report = reportOf(app);
    expect(report).toContain('### Code from `Components/Tally` that is only in this file');
    // Verbatim, per the IR's contract for `sourceText` — the author's own two-space indent.
    expect(report).toContain('  run() { this.setOutputs({ total: 2 }); }');
    // 🔴 And the reason the report has to carry it: the component emitted nothing to carry it.
    expect(Object.keys(app.files).some((f) => f.includes('Tally'))).toBe(false);
  });

  it('names the node and its type, so the reader knows what the code was doing', () => {
    const report = reportOf(shelfPatched(() => {}, (dir) => addComponent(dir, 'Tally', [TALLY])));
    expect(report).toContain('Javascript2 "Tally" (node `tallyNode`)');
  });

  it('a script beside the router shell is preserved too, and stops the report saying "Nothing"', () => {
    /*
     * 🔴 The scaffolded arm, which is not a duplicate of the logic-only one. A router-shell
     * refusal lands in the report's "what worked" half and in none of the three terms that used
     * to decide `nothingToReport` — so before the gate counted preserved scripts, this export
     * could tell the reader that **nothing** needed their attention while an authored script had
     * vanished from it. That is the precise sentence this rule exists to stop.
     */
    const app = shelfPatched(
      () => {},
      (dir) => {
        const nodesPath = path.join(dir, 'components', 'App', 'nodes.json');
        const doc = JSON.parse(fs.readFileSync(nodesPath, 'utf8'));
        doc.nodes.push(TALLY);
        fs.writeFileSync(nodesPath, JSON.stringify(doc));
      }
    );
    const report = reportOf(app);
    expect(report).toContain('### Code from `App` that is only in this file');
    expect(report).toContain('  run() { this.setOutputs({ total: 2 }); }');
  });

  it('CONTROL: a component that DOES emit a file keeps its script in the file and not twice', () => {
    /*
     * The duplicate half. Both carriers read the same `plan.refusedScripts`, so a rule that ran
     * them both would put the identical script in the module *and* the report — two records of
     * one thing, and the reader with no way to tell whether they are the same loss or two.
     */
    const app = shelfPatched((doc) => {
      doc.nodes.push({ id: 'scriptNode', type: 'Javascript2', label: 'Tally', parameters: { code: 'define({ run() {} })' }, x: 900, y: 200 });
    });
    expect(String(app.files['src/pages/Home.tsx'])).toContain('has an authored script that');
    expect(reportOf(app)).not.toContain('that is only in this file');
  });

  it('CONTROL: the unmutated corpus prints no preserved-script section in any report', () => {
    /*
     * The false-positive half, on the report this time. Every one of the 8 components across the
     * seven fixtures that emits no file is a candidate for this section, and none of them should
     * draw it.
     */
    for (const fixture of FIXTURES) {
      const report = String((exportOf(fixture).files as Record<string, string>)['EXPORT-REPORT.md'] ?? '');
      expect(`${fixture}: ${report.includes('that is only in this file')}`).toBe(`${fixture}: false`);
    }
  });

  it('a U+2028 inside a refused script does not end the comment that carries it', () => {
    /*
     * The hazard `commentSafeLines` exists for, on this second population. A literal U+2028 here
     * would end this file's string too — hence the escape.
     */
    const app = shelfWithMapping("map({ title: function (r) { return 'a\u2028b'; } })");
    const home = String(app.files['src/pages/Home.tsx']);
    expect(home).toContain('has an authored script that');
    expect(home).not.toContain('\u2028');
    expect(parseErrorsIn(app)).toEqual([]);
  });
});
