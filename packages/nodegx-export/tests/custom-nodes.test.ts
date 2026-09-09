/**
 * EXP-010 — custom nodes, modules and prefabs.
 *
 * The defect these grade is an **absence**: `parseProject` never opened `noodl_modules/`, so a
 * node from a project's own kit resolved to no catalog entry, fell out of the render tree, and
 * left the emitted JSX with a hole and nothing in the file to say a node had been there. Every
 * assertion below is therefore paired — the shape that works, and the shape that fails — because
 * a test that only sees the working half would pass again if the failing half went silent, which
 * is exactly the state this task found.
 *
 * The `kits` fixture is built for this and carries one of each module the export has to survive:
 * a kit that loads (`gauge-kit`, with a visual node, a container node and a logic node), one that
 * throws, one whose `index.js` is missing, an ES-module build, a plain library that never calls
 * `defineModule`, and an icon set with a binary font beside its stylesheet.
 */
import * as fs from 'fs';
import * as path from 'path';

import { Catalog, loadCatalog } from '../src/catalog';
import { emitApp } from '../src/emit/emitApp';
import { parseProject } from '../src/parse/parseProject';
import { runKitSource } from '../src/parse/kitSource';
import { ExportIR } from '../src/ir/types';

const FIXTURE = path.join(__dirname, 'fixtures', 'kits');

const catalog: Catalog = loadCatalog();
const ir: ExportIR = parseProject(FIXTURE, catalog);
const app = emitApp(ir, catalog);

const home = app.files['src/pages/Home.tsx'];
const kitFile = app.files['src/kits/GaugeKit.tsx'];
const runtime = app.files['src/kits/runtime.tsx'];
const moduleOf = (dirName: string) => ir.project.modules.find((m) => m.dirName === dirName)!;

describe('parse: the directory that was never opened (§1)', () => {
  test('every module folder is a row, whatever became of it', () => {
    expect(ir.project.modules.map((m) => m.dirName)).toEqual([
      'dots-icons',
      'esm-kit',
      'gauge-kit',
      'gone-kit',
      'plain-lib',
      'thrower-kit'
    ]);
  });

  test('a kit that loads reports its node types; one that throws reports none, with a reason', () => {
    expect(moduleOf('gauge-kit').status).toBe('loaded');
    expect(moduleOf('gauge-kit').nodes.map((n) => n.type)).toEqual([
      'qa.gauge.Ticker',
      'qa.gauge.Dial',
      'qa.gauge.Tray'
    ]);

    // 🔴 The pair. A `nodes: []` that means "this kit is empty" and one that means "this kit
    // exploded" are the same array; `status` and `message` are what tell them apart, and without
    // this half the assertion above is satisfied by a parser that returns nothing for everything.
    expect(moduleOf('thrower-kit').status).toBe('threw');
    expect(moduleOf('thrower-kit').nodes).toEqual([]);
    expect(moduleOf('thrower-kit').message).toContain("Cannot read properties of null");
  });

  test('each way a kit can fail keeps its own status', () => {
    expect(moduleOf('gone-kit').status).toBe('unreadable');
    expect(moduleOf('esm-kit').status).toBe('es-module');
    expect(moduleOf('plain-lib').status).toBe('no-define-module');
    // An icon set is not a failure: it has no code and declares no nodes, which is the complete
    // and correct answer rather than a failure to find any.
    expect(moduleOf('dots-icons').status).toBe('no-nodes-declared');
    expect(moduleOf('dots-icons').kind).toBe('iconset');
  });

  test('ports come off the definition, both places a definition declares them', () => {
    const dial = moduleOf('gauge-kit').nodes.find((n) => n.type === 'qa.gauge.Dial')!;

    expect(dial.visual).toBe(true);
    expect(dial.inputs.map((i) => i.name)).toEqual(['label', 'reading', 'maxReading', 'dialSize', 'showNeedle']);
    expect(dial.inputs.find((i) => i.name === 'dialSize')).toMatchObject({ defaultUnit: 'px', default: 96 });

    // 🔴 `settled` exists ONLY in `outputs` and is fired by `sendSignalOnOutput` from `initialize`
    // — there is no `outputProps` entry for it. A reader that consulted `outputProps` alone would
    // report this node as having one signal, and the wire out of `settled` would translate as a
    // value read of a port that never carries a value.
    expect(dial.outputs).toEqual([
      { name: 'onPress', type: 'signal', displayName: 'Pressed', group: 'Events', kind: 'signal', via: 'prop' },
      { name: 'liveReading', type: 'number', displayName: 'Live Reading', group: 'Values', kind: 'value', via: 'node' },
      { name: 'settled', type: 'signal', displayName: 'Settled', group: 'Events', kind: 'signal', via: 'node' }
    ]);
  });

  test("a kit's logic node is read too, and is marked non-visual", () => {
    const ticker = moduleOf('gauge-kit').nodes.find((n) => n.type === 'qa.gauge.Ticker')!;
    expect(ticker.visual).toBe(false);
    // Declared under `inputs:` with a `set`, not under `inputProps` — the shape a logic node uses,
    // and the one that reads as "this node has no ports" if only `inputProps` is consulted.
    expect(ticker.inputs).toEqual([
      { name: 'seed', type: 'number', displayName: 'Seed', default: 0, via: 'node' }
    ]);
    expect(ticker.outputs.map((o) => `${o.name}:${o.kind}`)).toEqual(['tick:value']);
  });

  test('nothing from the sandbox realm reaches the IR', () => {
    // The definitions live in a `vm` context and hold functions closed over it. Everything the IR
    // carries is rebuilt from primitives, so the whole module list survives a JSON round trip.
    expect(() => JSON.stringify(ir.project.modules)).not.toThrow();
    const roundTripped = JSON.parse(JSON.stringify(ir.project.modules));
    expect(roundTripped).toEqual(ir.project.modules);
  });
});

describe('AC1: the nodes render', () => {
  test('a kit node is an ordinary React element at the call site', () => {
    expect(home).toContain(`import { Dial, Tray } from '../kits/GaugeKit';`);
    expect(home).toContain('<Dial');
    expect(home).toContain('<Tray trayTitle="Instruments">');
  });

  test('a container node takes its children', () => {
    expect(home).toContain('<Tray trayTitle="Instruments">\n        <p className={styles.trayText}>inside the tray</p>\n      </Tray>');
  });

  test('only the kits whose nodes are used are bundled; every module still ships', () => {
    // `gauge-kit`'s script is imported by the app, so it lands in `src/` where the bundle can
    // reach it. Every other module folder — including the kits that failed — is copied verbatim.
    expect(app.copies).toContainEqual({
      from: 'noodl_modules/gauge-kit/index.js',
      to: 'src/kits/modules/gauge-kit/index.js'
    });
    expect(app.copies).toContainEqual({
      from: 'noodl_modules/thrower-kit/index.js',
      to: 'public/noodl_modules/thrower-kit/index.js'
    });
    // 🔴 The file that reached NEITHER destination is the bug this pair guards: a kit whose nodes
    // this project does not use gets no wrapper, and if its script were also excluded from the
    // verbatim copy it would be silently absent from the author's exported repo.
    const sources = new Set(app.copies.map((c) => c.from));
    const everyAsset = ir.project.modules.flatMap((m) => m.assets);
    expect(everyAsset.filter((a) => !sources.has(a))).toEqual([]);
    // Exactly one home each — a file copied to both `src/` and `public/` would be two divergent
    // copies of the author's code the first time anyone edited one.
    expect(app.copies.length).toBe(everyAsset.length);
  });
});

describe('AC2: ports work in both directions', () => {
  test('an input parameter reaches the component as a prop', () => {
    expect(home).toContain('label="Pressure"');
    expect(home).toContain('reading={42}');
    expect(home).toContain('showNeedle');
  });

  test('a signal output fires the parent handler — from outputProps AND from outputs', () => {
    // `onPress` is an `outputProps` entry; `settled` is an `outputs` entry with no `outputProps`
    // twin. Both must arrive, and the second is the one a partial reader loses.
    // 🔴 Two different popups, not one. The fixture wires them to distinct sinks so the drive can
    // tell which signal arrived — with one shared sink, the second to fire would satisfy the
    // assertion whether or not the first ever ran.
    expect(home).toContain("onPress={() => setOpenPopup('Pressed')}");
    expect(home).toContain("onSettled={() => setOpenPopup('Settled')}");
  });

  test('a value output updates a binding through local state', () => {
    expect(home).toContain(
      '// Lifted from qa.gauge.Dial\'s value output "liveReading" — undefined until the kit node first publishes it.'
    );
    expect(home).toContain('const [liveReading, setLiveReading] = useState<number | undefined>();');
    expect(home).toContain('onLiveReadingChanged={setLiveReading}');
    expect(home).toContain('<p className={styles.readout}>{liveReading ?? \'\'}</p>');
  });

  test('the wrapper types every port from the kit\'s own declarations', () => {
    expect(kitFile).toContain('reading?: number;');
    expect(kitFile).toContain('showNeedle?: boolean;');
    // A units-typed port is `number | string`: the runtime turns `96` into `"96px"` before the
    // component sees it, and the graph may equally set a `var(--token)`.
    expect(kitFile).toContain('dialSize?: number | string;');
    expect(kitFile).toContain('onPress?: () => void;');
    expect(kitFile).toContain('onLiveReadingChanged?: (value: number) => void;');
  });

  test('a kit node earns no CSS class — the kit owns its own styling', () => {
    // 🔴 The pair for `isStyledRole`. Running the style tables over a kit node matches nothing and
    // reports every one of its ports as an unmapped parameter; the sibling Text below proves the
    // tables still run for the roles they are about.
    expect(app.files['src/pages/Home.module.css']).not.toContain('.gauge');
    expect(app.files['src/pages/Home.module.css']).toContain('.readout');
    expect(app.notes.filter((n) => n.includes('on gauge has no style/content mapping'))).toEqual([]);
  });
});

describe('AC3: nothing is dropped in silence', () => {
  test('a node whose kit did not load is marked in the emitted file, not omitted', () => {
    // 🔴 **The criterion.** `qa.thrower.Stamp` and `qa.gone.Ghost` are children of the rendered
    // tree whose kits failed. Before EXP-010 the JSX closed over them and a reader of the exported
    // repo had nothing to search for.
    expect(home).toContain('{/* TODO(export): qa.thrower.Stamp — node stamp sits here in the');
    expect(home).toContain('{/* TODO(export): qa.gone.Ghost — node ghost sits here in the');
    expect(home).toContain('No catalog entry, and no kit in noodl_modules registered this type');
  });

  test('a parameter for a port the kit no longer declares is named', () => {
    expect(app.notes).toContain(
      'Pages/Home: parameter retired on gauge names no input port on qa.gauge.Dial — the kit declares no such port, so the running app ignores it too'
    );
  });

  test('a wire to a port the kit no longer declares says the app never delivered it either', () => {
    // ⚠️ Not "deferred to EXP-003". A later slice will never make this wire work — the port does
    // not exist — and telling an author to wait would be false.
    expect(app.notes).toContain(
      'Pages/Home: wire gauge:retiredOutput->readout:text dropped: qa.gauge.Dial declares no output "retiredOutput" — the kit\'s definition has no such port, so the running app delivers nothing either'
    );
  });

  test("a kit's logic node is named as out of scope, not as an unknown type", () => {
    // Before EXP-010 this read `type qa.gauge.Ticker is not in the catalog`, which says "we do not
    // know what this is". We do: the kit said. What is true is that this export does not run it.
    expect(app.notes).toContain(
      'Pages/Home: node counter (qa.gauge.Ticker) deferred: custom logic node (qa.gauge.Ticker) from the kit in noodl_modules/gauge-kit — this export renders a kit\'s visual nodes and does not run its logic nodes'
    );
    expect(app.notes.join('\n')).not.toContain('qa.gauge.Ticker is not in the catalog');
  });
});

describe('AC4: a broken kit does not take the app down', () => {
  test('every failing module is named once, and no working one is', () => {
    const moduleReport = app.notes.filter((n) => n.startsWith('noodl_modules/'));
    expect(moduleReport.map((n) => n.split(':')[0])).toEqual([
      'noodl_modules/esm-kit',
      'noodl_modules/gone-kit',
      'noodl_modules/plain-lib',
      'noodl_modules/thrower-kit'
    ]);
    // 🔴 The absence half: a module that loaded and one that has nothing to load must NOT appear,
    // or the report buries the four that need attention under the two that do not.
    expect(moduleReport.join('\n')).not.toContain('gauge-kit');
    expect(moduleReport.join('\n')).not.toContain('dots-icons');
  });

  test('the rest of the app exports around the failures', () => {
    // The whole point: five of six modules could not contribute a node, and the page still has
    // its built-ins, its working kit nodes and its state.
    expect(home).toContain('<p className={styles.readout}>');
    expect(home).toContain('<Dial');
    expect(app.files['src/kits/GaugeKit.tsx']).toBeDefined();
  });

  test('a failing module still ships its files and says so', () => {
    expect(app.notes.join('\n')).toContain('Its files still ship with the app.');
  });
});

describe('AC5: assets ship', () => {
  test('a binary font is a copy, never a string in files', () => {
    // 🔴 `files` is `Record<string, string>`. Reading a `.woff2` into a UTF-8 string to put it
    // there corrupts it, and the corruption renders as blank glyphs rather than as an error.
    expect(app.copies).toContainEqual({
      from: 'noodl_modules/dots-icons/dots.woff2',
      to: 'public/noodl_modules/dots-icons/dots.woff2'
    });
    expect(Object.keys(app.files)).not.toContain('public/noodl_modules/dots-icons/dots.woff2');
  });

  test('a declared stylesheet is linked from the page', () => {
    expect(app.files['index.html']).toContain('<link rel="stylesheet" href="/noodl_modules/dots-icons/styles.css" />');
  });

  test('the stylesheet travels verbatim, so its own url() still resolves', () => {
    // The font is referenced as `url(dots.woff2)`, relative to the stylesheet and invisible to
    // the manifest. Both land under the same directory in `public/`, unrewritten.
    expect(app.copies).toContainEqual({
      from: 'noodl_modules/dots-icons/styles.css',
      to: 'public/noodl_modules/dots-icons/styles.css'
    });
  });
});

describe('the shim (Route B)', () => {
  test('the kit script is imported after the globals, and the file says why', () => {
    expect(kitFile).toContain("import { KitNode } from './runtime';\nimport './modules/gauge-kit/index.js';");
    expect(kitFile).toContain('Import order is load-bearing');
  });

  test('the runtime installs the two globals a kit reads at module scope', () => {
    expect(runtime).toContain('window.React = React;');
    expect(runtime).toContain('defineModule(module: any)');
  });

  test('the shim reproduces the runtime\'s initialize order', () => {
    // `react-component-node.ts`: defaults, then the outputProps callbacks, then
    // `getReactComponent`, then the kit's own `initialize` — which installs callbacks onto
    // `this.props` and expects the defaults to already be there.
    const defaults = runtime.indexOf('def.inputProps ?? {}');
    const outputs = runtime.indexOf('def.outputProps ?? {}');
    const component = runtime.indexOf('def.getReactComponent?.call(node)');
    const initialize = runtime.indexOf('def.initialize?.call(node)');
    expect(defaults).toBeGreaterThan(-1);
    expect(outputs).toBeGreaterThan(defaults);
    expect(component).toBeGreaterThan(outputs);
    expect(initialize).toBeGreaterThan(component);
  });

  test('a type no kit registered renders a findable marker rather than nothing', () => {
    expect(runtime).toContain('data-nodegx-missing-kit-node={type}');
  });

  test('the exported app gains no dependency for any of this', () => {
    expect(JSON.parse(app.files['package.json']).dependencies).not.toHaveProperty('@nodegx/module-inject');
  });
});

describe('a project with no modules is untouched', () => {
  test('no kit files, no copies, no notes', () => {
    // The control. Every change above is conditional on a project having modules, and a pipeline
    // that emitted a runtime shim into every export would be a regression for the 28 projects on
    // this machine that have no kits at all.
    const cheer = emitApp(parseProject(path.join(__dirname, 'fixtures', 'cheer'), catalog), catalog);
    expect(Object.keys(cheer.files).filter((f) => f.startsWith('src/kits/'))).toEqual([]);
    expect(cheer.copies).toEqual([]);
    expect(cheer.files['index.html']).not.toContain('<link rel="stylesheet"');
  });
});

describe('runKitSource: how a kit can fail', () => {
  test('a kit with no name on a definition is not counted as a node', () => {
    const result = runKitSource(`Noodl.defineModule({ reactNodes: [{ getReactComponent: function () {} }] });`);
    expect(result.outcome).toBe('defines-no-nodes');
    expect(result.nodes).toEqual([]);
  });

  test('a bare function in reactNodes does not become a node named after the function', () => {
    // ⚠️ One shipped kit does this. `Function.prototype.name` is a string, so a naive
    // `typeof d.name === 'string'` promotes a minified component's function name to a node type.
    const result = runKitSource(`
      function MyComponent() {}
      Noodl.defineModule({ reactNodes: [MyComponent] });
    `);
    expect(result.nodes.map((n) => n.type)).toEqual([]);
  });

  test('the { node: {…} } wrapper is read, because most of the shipped library uses it', () => {
    const result = runKitSource(`Noodl.defineModule({ nodes: [{ node: { name: 'a.b.C' } }] });`);
    expect(result.nodes.map((n) => n.type)).toEqual(['a.b.C']);
  });

  test('a kit touching other members of the Noodl global at module scope still loads', () => {
    // The recursive-noop Proxy, adopted from `kitExtract/entry.js`. Kit code reads
    // `Noodl.getProjectSettings()` and similar at module scope and a bare object would throw.
    const result = runKitSource(`
      var deployed = Noodl.deployed;
      var x = Noodl.anything.at.all();
      Noodl.defineModule({ reactNodes: [{ name: 'a.b.C', getReactComponent: function () {} }] });
    `);
    expect(result.outcome).toBe('defines-nodes');
  });
});
