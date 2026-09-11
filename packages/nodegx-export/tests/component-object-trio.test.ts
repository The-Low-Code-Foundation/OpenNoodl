import * as fs from 'fs';
import * as path from 'path';

import * as ts from 'typescript';

import { Catalog, CatalogIndex, loadCatalog } from '../src/catalog';
import { ComponentPlan, planProject } from '../src/analyze/plan';
import { emitApp } from '../src/emit/emitApp';
import { summarizePreflight } from '../src/emit/preflight';
import { COMPONENT_OBJECT_LIB_PATH, componentObjectLibSource } from '../src/emit/componentObjectLib';
import { ERRORS_LIB_PATH } from '../src/emit/errorsLib';
import { parseProject } from '../src/parse/parseProject';
import { typecheckEmittedApp } from './helpers/typecheckApp';
import { ComponentIR, ConnectionIR, ExportIR, NodeIR, ParamValue } from '../src/ir/types';

/**
 * EXP-011 §60 — the component-object trio, Tier 2.8 row 10: `Set Component Object Properties`
 * (`net.noodl.SetComponentObjectProperties`), `Parent Component Object` (`net.noodl.ParentComponentObject`) and
 * `Set Parent Component Object Properties` (`net.noodl.SetParentComponentObjectProperties`). Own record = local state
 * (`useComponentObject`, a Provider); the parent pair = context (`useParentComponentObject`).
 *
 * Built on `tests/fixtures/panel-desk`: a page owns a Component Object (title, count, note); a text input and a Rename
 * button write `title` and a literal `note` through the Set, whose Done remembers a status; a Variable mirrors into
 * `note`; three Texts read the record; a `Panel` instance and a repeated `PanelRow` read it from below, and the Panel
 * bumps `count` through the parent Set with Done and Failure chains. Every refused shape lives here by mutation
 * (§52.4.2's rule) and asserts the NAMED sentence.
 *
 * 🔴 The reverted arm (`probe-reverted.log`, HEAD 2a2dd4fa): `panelState` deferred with the old gate-3 sentence, the
 * three parent-family nodes `logic node (…)`, 14 refusals, no pathway. §F pins what building it found: the mirror
 * effect's first emit closed over the STORE OBJECT (`set({ note: note })`, the hooks-walker trap's twelfth instance),
 * and a non-string key folded twice (`String(x ?? '') ?? ''`).
 */

const FIXTURE = path.join(__dirname, 'fixtures', 'panel-desk');
const catalog: Catalog = loadCatalog();
const index = new CatalogIndex(catalog);
const baseIr = parseProject(FIXTURE, catalog);
const app = emitApp(baseIr, catalog);
const project = planProject(baseIr, index);

const HOME = 'Pages/Home';
const PANEL = 'Components/Panel';
const ROW = 'Components/PanelRow';
const HOME_FILE = 'src/pages/Home.tsx';
const PANEL_FILE = 'src/components/Panel.tsx';
const ROW_FILE = 'src/components/PanelRow.tsx';

const SET_TYPE = 'net.noodl.SetComponentObjectProperties';
const PARENT_TYPE = 'net.noodl.ParentComponentObject';
const SET_PARENT_TYPE = 'net.noodl.SetParentComponentObjectProperties';

const cloneIr = (): ExportIR => structuredClone(baseIr);
const componentOf = (source: ExportIR, componentPath: string): ComponentIR => source.components.find((c) => c.path === componentPath)!;
const nodeOf = (source: ExportIR, componentPath: string, id: string): NodeIR => componentOf(source, componentPath).nodes.find((n) => n.id === id)!;
const planOf = (source: ExportIR, componentPath: string): ComponentPlan => planProject(source, index).plans.find((p) => p.path === componentPath)!;
const setParam = (node: NodeIR, name: string, value: ParamValue) => {
  const existing = node.parameters.find((p) => p.name === name);
  if (existing) existing.value = value;
  else {
    node.parameters.push({ name, value });
    node.parameters.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  }
};
const dropParam = (node: NodeIR, name: string) => {
  node.parameters = node.parameters.filter((p) => p.name !== name);
};
const connect = (component: ComponentIR, fromId: string, fromProperty: string, toId: string, toProperty: string, kind: ConnectionIR['kind'] = 'signal') => {
  component.connections.push({ key: `${fromId}:${fromProperty}->${toId}:${toProperty}`, fromId, fromProperty, toId, toProperty, kind });
};
const disconnect = (component: ComponentIR, predicate: (c: ConnectionIR) => boolean) => {
  component.connections = component.connections.filter((c) => !predicate(c));
};
const addNode = (component: ComponentIR, node: Partial<NodeIR> & { id: string; type: string }): NodeIR => {
  const full: NodeIR = { catalogRef: node.type.startsWith('/') ? null : node.type, parameters: [], declaredPorts: [], portKnowledge: 'complete', ...node } as NodeIR;
  component.nodes.push(full);
  return full;
};
const notesOf = (source: ExportIR): string => emitApp(source, catalog).notes.join('\n');
const fileOf = (a: { files: Record<string, string> }, name: string): string => a.files[name];
const refusalOf = (source: ExportIR, componentPath: string, nodeId: string): string | undefined =>
  planOf(source, componentPath).refusals.find((r) => r.nodeId === nodeId)?.reason;
const dispositionOf = (source: ExportIR, componentPath: string, nodeId: string) => planOf(source, componentPath).dispositions[nodeId] as { kind: string; reason?: string };

const BUMP_RAISE =
  "raiseAppError({ code: 'set-parent-component-object-properties/no-ancestor', message: 'No ancestor component has a Component Object node — nothing was written', nodeId: 'bump', nodeType: 'net.noodl.SetParentComponentObjectProperties', componentName: '/Components/Panel' });";

// ---------------------------------------------------------------------------------------------------
describe('§A the fixture, whole — a page owns a record, a Set writes it, a Panel and a repeated row read it from below', () => {
  test('A1 nothing refused: the only note is the router shell, 19 files, the lib and errors.ts among them', () => {
    expect(app.notes).toEqual(['App: router shell — emitted as src/App.tsx by the scaffold']);
    for (const p of [HOME, PANEL, ROW]) expect(project.plans.find((x) => x.path === p)!.refusals).toEqual([]);
    expect(summarizePreflight(app).refusals).toBe(0);
    expect(summarizePreflight(app).whole.sort()).toEqual([PANEL, ROW, HOME].sort());
    expect(Object.keys(app.files)).toHaveLength(19);
    expect(app.files[COMPONENT_OBJECT_LIB_PATH]).toContain('export function useComponentObject<');
    expect(app.files[COMPONENT_OBJECT_LIB_PATH]).toContain('export function useParentComponentObject<');
    // The lib raises on the channel, so it earns errors.ts even though no boundary is placed.
    expect(app.files[ERRORS_LIB_PATH]).toBeDefined();
    for (const f of [HOME_FILE, PANEL_FILE, ROW_FILE]) expect(fileOf(app, f)).not.toContain('TODO(export)');
  });

  test('A2 the emitted app typechecks as a real program', () => {
    expect(typecheckEmittedApp(app)).toEqual([]);
  });

  test('A3 every emitted file parses', () => {
    for (const [name, source] of Object.entries(app.files)) {
      if (!/\.(ts|tsx)$/.test(name)) continue;
      const parsed = ts.createSourceFile(name, source, ts.ScriptTarget.ES2022, true, name.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
      const diagnostics = (parsed as unknown as { parseDiagnostics: ts.Diagnostic[] }).parseDiagnostics;
      expect(diagnostics.map((d) => `${name}: ${d.messageText}`)).toEqual([]);
    }
  });

  test('A4 the five nodes collapse into their files; the record plan carries the typed keys and the one mirror', () => {
    const home = project.plans.find((p) => p.path === HOME)!;
    const panel = project.plans.find((p) => p.path === PANEL)!;
    const row = project.plans.find((p) => p.path === ROW)!;
    // A click-attached sink records the trigger it collapsed into (the attach pass's norm); a read-registered node its file.
    expect(home.dispositions['panelState']).toEqual({ kind: 'collapsed', into: HOME_FILE });
    expect(home.dispositions['setTitle']).toEqual({ kind: 'collapsed', into: 'renameBtn' });
    expect(panel.dispositions['parentState']).toEqual({ kind: 'collapsed', into: PANEL_FILE });
    expect(panel.dispositions['bump']).toEqual({ kind: 'collapsed', into: 'bumpBtn' });
    expect(row.dispositions['rowParent']).toEqual({ kind: 'collapsed', into: ROW_FILE });
    expect(home.componentObject).toMatchObject({ nodeId: 'panelState', local: 'panelState', typeName: 'PanelStateRecord' });
    // title ← a text input (string); note ← a Set literal and a Variable mirror (string); count ← nothing here (a descendant writes it): unknown.
    expect(home.componentObject!.keys).toEqual([
      { key: 'title', tsType: 'string' },
      { key: 'count', tsType: 'unknown' },
      { key: 'note', tsType: 'string' }
    ]);
    expect(home.componentObject!.mirrors.map((m) => m.key)).toEqual(['note']);
    expect(home.parentObject).toBeUndefined();
    expect(panel.componentObject).toBeUndefined();
    expect(panel.parentObject).toMatchObject({ local: 'parentObject', typeName: 'PanelParentRecord' });
    expect(panel.parentObject!.readers).toEqual([{ nodeId: 'parentState', label: 'Parent panel state' }]);
    expect(panel.parentObject!.keys.map((k) => k.key).sort()).toEqual(['count', 'note', 'title']);
    expect(row.parentObject!.readers).toEqual([{ nodeId: 'rowParent', label: 'Parent page state' }]);
  });

  test('A5 Home: the lib import, the record type, the hook after the state rows, the Provider around the root', () => {
    const src = fileOf(app, HOME_FILE);
    expect(src).toContain("import { ParentComponentObjectContext, useComponentObject } from '../lib/componentObject';");
    expect(src).toContain("import { useEffect, useState } from 'react';");
    expect(src).toContain('type PanelStateRecord = { title?: string; count?: unknown; note?: string };');
    expect(src).toContain('const panelState = useComponentObject<PanelStateRecord>();');
    expect(src.indexOf("useState<string>('')")).toBeLessThan(src.indexOf('useComponentObject<PanelStateRecord>()'));
    expect(src).toContain('  return (\n    <ParentComponentObjectContext.Provider value={panelState}>\n      <div className={styles.page}>');
    expect(src).toContain('      </div>\n    </ParentComponentObjectContext.Provider>\n  );');
    // The wrap indents elements, never blank lines — the first emit left nine whitespace-only lines between them.
    expect(src).not.toMatch(/^ +$/m);
    // The import block prints before the body: the imports are earned in the walkers, not in exprCode.
    expect(src.indexOf("from '../lib/componentObject'")).toBeLessThan(src.indexOf('export function HomePage'));
  });

  test("A6 Home: the Rename button — the text input's state read in the handler, the literal note, the Done chain following", () => {
    const src = fileOf(app, HOME_FILE);
    // The input earns its state row through the outputRead clause (s19's rule, tenth family) — read from the BUTTON's handler.
    expect(src).toContain("const [title, setTitle] = useState<string>('');");
    expect(src).toContain("onClick={() => { panelState.set({ title: title, note: 'renamed' }); status.set('Renamed.'); }}");
  });

  test("A7 Home: the three reads — a string key folded bare, the unknown key through the runtime's String(), the mirror as an effect on the hook local", () => {
    const src = fileOf(app, HOME_FILE);
    expect(src).toContain("<p className={styles.text}>{panelState.value.title ?? ''}</p>");
    expect(src).toContain("<p className={styles.text}>{String(panelState.value.count ?? '')}</p>");
    expect(src).toContain("<p className={styles.text}>{panelState.value.note ?? ''}</p>");
    expect(src).toContain('const noteValue = useValue(note);');
    expect(src).toContain('  useEffect(() => {\n    panelState.set({ note: noteValue });\n  }, [noteValue]);');
    expect(src).toContain("import { note, status } from '../stores/variables';");
  });

  test('A8 Panel: the parent hook with its reader site, the `?.` reads coerced, and the Bump in the block form — the raise before the Failure chain', () => {
    const src = fileOf(app, PANEL_FILE);
    expect(src).toContain("import { useParentComponentObject } from '../lib/componentObject';");
    expect(src).toContain("import { raiseAppError } from '../lib/errors';");
    expect(src).toContain('type PanelParentRecord = { title?: unknown; note?: unknown; count?: unknown };');
    expect(src).toContain(
      "const parentObject = useParentComponentObject<PanelParentRecord>([{ nodeId: 'parentState', nodeType: 'net.noodl.ParentComponentObject', componentName: '/Components/Panel' }]);"
    );
    expect(src).toContain("<p className={styles.panelTitle}>{String(parentObject?.value.title ?? '')}</p>");
    expect(src).toContain(
      [
        '        onClick={() => {',
        '          if (parentObject === undefined) {',
        `            ${BUMP_RAISE}`,
        "            bumpStatus.set('No parent panel.');",
        '          } else {',
        '            parentObject.set({ count: 1 });',
        "            bumpStatus.set('Bumped.');",
        '          }',
        '        }}'
      ].join('\n')
    );
    expect(src).not.toContain('ParentComponentObjectContext');
    expect(src).not.toContain('useComponentObject<');
  });

  test('A9 PanelRow: a For Each template row reads the parent record through the same hook — the context reaches a repeated row', () => {
    const src = fileOf(app, ROW_FILE);
    expect(src).toContain("const parentObject = useParentComponentObject<PanelRowParentRecord>([{ nodeId: 'rowParent', nodeType: 'net.noodl.ParentComponentObject', componentName: '/Components/PanelRow' }]);");
    expect(src).toContain("<p className={styles.rowTitle}>{String(parentObject?.value.title ?? '')}</p>");
    expect(fileOf(app, HOME_FILE)).toContain('<PanelRow key={item.id} name={item.name} />');
  });

  test('A11 a record read from a handler is the live `.get()`, not the render snapshot — a Done chain reads what the same handler wrote', () => {
    const ir = cloneIr();
    const home = componentOf(ir, HOME);
    disconnect(home, (c) => c.toId === 'setStatus' && c.toProperty === 'value');
    connect(home, 'panelState', 'value-title', 'setStatus', 'value', 'value');
    const src = fileOf(emitApp(ir, catalog), HOME_FILE);
    expect(src).toContain("onClick={() => { panelState.set({ title: title, note: 'renamed' }); status.set(panelState.get().title); }}");
    expect(src).toContain("{panelState.value.title ?? ''}");
  });

  test('A10 deterministic: a second emit is byte-identical', () => {
    expect(emitApp(baseIr, catalog).files).toEqual(app.files);
  });
});

// ---------------------------------------------------------------------------------------------------
// §B — the lib under node: a fake React (useState / useRef / useCallback / useMemo / useContext / createContext /
// useEffect, the effect run after the render that declared it) and a fake errors module that records raises.
// ---------------------------------------------------------------------------------------------------
type Handle<T extends object> = { value: T; get(): T; set(patch: Partial<T>): void };
interface Lib {
  useComponentObject<T extends object>(): Handle<T>;
  useParentComponentObject<T extends object>(readers?: Array<{ nodeId: string; nodeType: string; componentName: string }>): Handle<T> | undefined;
  ParentComponentObjectContext: { _default: unknown };
  NO_ANCESTOR_MESSAGE: string;
}
interface Harness<R> {
  render(): R;
  /** Re-run every effect as React StrictMode does on mount: cleanup, then the effect again. */
  strictRemount(): void;
  renders: number;
  raised: Array<Record<string, unknown>>;
}
const loadLib = <R,>(body: (lib: Lib) => R, contextValue: unknown = undefined): Harness<R> => {
  const slots: unknown[] = [];
  const effects: Array<{ deps?: unknown[]; cleanup?: () => void; fn?: () => void | (() => void) }> = [];
  let cursor = 0;
  let pending: Array<{ slot: number; fn: () => void | (() => void); deps?: unknown[] }> = [];
  let dirty = false;
  const raised: Array<Record<string, unknown>> = [];
  const same = (a?: unknown[], b?: unknown[]) => a !== undefined && b !== undefined && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const React = {
    useState: (init: unknown) => {
      const i = cursor++;
      if (slots[i] === undefined) slots[i] = { value: typeof init === 'function' ? (init as () => unknown)() : init };
      const slot = slots[i] as { value: unknown };
      return [
        slot.value,
        (next: unknown) => {
          slot.value = next;
          dirty = true;
        }
      ];
    },
    useRef: (init: unknown) => {
      const i = cursor++;
      if (slots[i] === undefined) slots[i] = { current: init };
      return slots[i];
    },
    useCallback: (fn: unknown, deps: unknown[]) => {
      const i = cursor++;
      const slot = slots[i] as { deps: unknown[]; fn: unknown } | undefined;
      if (slot !== undefined && same(slot.deps, deps)) return slot.fn;
      slots[i] = { deps, fn };
      return fn;
    },
    useMemo: (compute: () => unknown, deps: unknown[]) => {
      const i = cursor++;
      const slot = slots[i] as { deps: unknown[]; value: unknown } | undefined;
      if (slot !== undefined && same(slot.deps, deps)) return slot.value;
      const value = compute();
      slots[i] = { deps, value };
      return value;
    },
    useEffect: (fn: () => void | (() => void), deps?: unknown[]) => {
      pending.push({ slot: cursor++, fn, deps });
    },
    createContext: (defaultValue: unknown) => ({ _default: defaultValue }),
    useContext: () => contextValue
  };
  const js = ts.transpileModule(componentObjectLibSource(), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const module = { exports: {} as Lib };
  // eslint-disable-next-line no-new-func
  new Function('require', 'module', 'exports', js)(
    (name: string) => {
      if (name === 'react') return React;
      if (name === './errors') return { raiseAppError: (e: Record<string, unknown>) => raised.push(e) };
      throw new Error(`unexpected import ${name}`);
    },
    module,
    module.exports
  );
  const harness: Harness<R> = {
    renders: 0,
    raised,
    render() {
      let out!: R;
      do {
        dirty = false;
        cursor = 0;
        pending = [];
        harness.renders++;
        out = body(module.exports);
        for (const e of pending) {
          const prev = effects[e.slot];
          if (prev !== undefined && same(prev.deps, e.deps)) continue;
          prev?.cleanup?.();
          const cleanup = e.fn();
          effects[e.slot] = { deps: e.deps, cleanup: typeof cleanup === 'function' ? cleanup : undefined, fn: e.fn };
        }
      } while (dirty);
      return out;
    },
    strictRemount() {
      for (const e of effects) {
        if (e === undefined) continue;
        e.cleanup?.();
        const cleanup = e.fn?.();
        e.cleanup = typeof cleanup === 'function' ? cleanup : undefined;
      }
    }
  };
  return harness;
};

describe('§B the lib runs the way componentobject.ts / base.ts / parentcomponentobject.ts do (hook harness under node)', () => {
  type Rec = { a?: number; b?: string };

  test('B1 the record boots empty, and a set writes the key and re-renders once', () => {
    const h = loadLib((lib) => lib.useComponentObject<Rec>());
    const first = h.render();
    expect(first.value).toEqual({});
    expect(first.get()).toEqual({});
    first.set({ a: 1 });
    const second = h.render();
    expect(second.value).toEqual({ a: 1 });
    expect(h.renders).toBe(2);
  });

  test("B2 the same value again is no change — Model.set notifies only when oldValue !== value, so no re-render", () => {
    const h = loadLib((lib) => lib.useComponentObject<Rec>());
    const handle = h.render();
    handle.set({ a: 1 });
    const after = h.render();
    const renders = h.renders;
    after.set({ a: 1 });
    expect(h.render()).toBe(after);
    expect(h.renders).toBe(renders + 1); // the harness's own render call, no dirty loop
  });

  test('B3 undefined is a value here (base.ts writes every delivered key) — a key set to undefined is written and re-renders', () => {
    const h = loadLib((lib) => lib.useComponentObject<Rec>());
    const handle = h.render();
    handle.set({ a: 1 });
    h.render().set({ a: undefined });
    const after = h.render();
    expect(Object.prototype.hasOwnProperty.call(after.value, 'a')).toBe(true);
    expect(after.value.a).toBeUndefined();
  });

  test('B4 an empty patch writes nothing; a key the patch does not carry is left alone', () => {
    const h = loadLib((lib) => lib.useComponentObject<Rec>());
    h.render().set({ a: 1, b: 'x' });
    const before = h.render();
    before.set({});
    expect(h.render()).toBe(before);
    before.set({ b: 'y' });
    expect(h.render().value).toEqual({ a: 1, b: 'y' });
  });

  test('B5 get() is live: a write earlier in the same tick is visible before any re-render (model.get after model.set)', () => {
    const h = loadLib((lib) => lib.useComponentObject<Rec>());
    const handle = h.render();
    handle.set({ a: 7 });
    expect(handle.get()).toEqual({ a: 7 });
    expect(handle.value).toEqual({}); // the render snapshot is the old one until React re-renders
  });

  test('B6 the parent hook: undefined without a provider, and each reader site raises no-ancestor once at mount', () => {
    const readers = [
      { nodeId: 'r1', nodeType: 'net.noodl.ParentComponentObject', componentName: '/Components/A' },
      { nodeId: 'r2', nodeType: 'net.noodl.ParentComponentObject', componentName: '/Components/A' }
    ];
    const h = loadLib((lib) => lib.useParentComponentObject<Rec>(readers));
    expect(h.render()).toBeUndefined();
    expect(h.raised).toEqual([
      { code: 'parent-component-object/no-ancestor', message: 'No ancestor component has a Component Object node', nodeId: 'r1', nodeType: 'net.noodl.ParentComponentObject', componentName: '/Components/A' },
      { code: 'parent-component-object/no-ancestor', message: 'No ancestor component has a Component Object node', nodeId: 'r2', nodeType: 'net.noodl.ParentComponentObject', componentName: '/Components/A' }
    ]);
    // StrictMode mounts twice: the guard ref keeps it at once per reader, as lastMissCode dedups the runtime's repeat.
    h.strictRemount();
    h.render();
    expect(h.raised).toHaveLength(2);
  });

  test('B7 the parent hook with a provider answers the provider\'s handle and raises nothing', () => {
    const provided = { value: { a: 3 }, get: () => ({ a: 3 }), set: () => undefined };
    const h = loadLib((lib) => lib.useParentComponentObject<Rec>([{ nodeId: 'r1', nodeType: 'x', componentName: '/A' }]), provided);
    expect(h.render()).toBe(provided);
    expect(h.raised).toEqual([]);
  });

  test('B8 a parent Set with no readers raises nothing at mount — its miss is raised at Do, in the handler', () => {
    const h = loadLib((lib) => lib.useParentComponentObject<Rec>());
    expect(h.render()).toBeUndefined();
    expect(h.raised).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------
describe('§C refusals, each by its sentence — the own Set', () => {
  test('C1 no Component Object in the component: the record it writes is read by nothing translatable', () => {
    const ir = cloneIr();
    const home = componentOf(ir, HOME);
    home.nodes = home.nodes.filter((n) => n.id !== 'panelState');
    disconnect(home, (c) => c.fromId === 'panelState' || c.toId === 'panelState');
    expect(refusalOf(ir, HOME, 'setTitle')).toBe("its component has no Component Object node — the record it writes is read by nothing statically translatable (a Function's Component.Object is deferred)");
  });

  test('C2 an empty Properties list: Do writes nothing', () => {
    const ir = cloneIr();
    setParam(nodeOf(ir, HOME, 'setTitle'), 'properties', { kind: 'literal', value: '' });
    expect(refusalOf(ir, HOME, 'setTitle')).toBe('its Properties list is empty, so Do writes nothing');
  });

  test('C3 nothing fed into any listed key: Do writes nothing (an unfed key abstains by absence)', () => {
    const ir = cloneIr();
    disconnect(componentOf(ir, HOME), (c) => c.toId === 'setTitle' && c.toProperty === 'prop-title');
    dropParam(nodeOf(ir, HOME, 'setTitle'), 'prop-note');
    expect(refusalOf(ir, HOME, 'setTitle')).toBe('nothing is wired into any of its properties, so Do writes nothing');
  });

  test('C4 two wires on one key: last-writer-wins is not statically ordered', () => {
    const ir = cloneIr();
    connect(componentOf(ir, HOME), 'renamedLabel', 'savedValue', 'setTitle', 'prop-title', 'value');
    expect(refusalOf(ir, HOME, 'setTitle')).toBe('two wires feed its "title" — last-writer-wins is not statically ordered');
  });

  test("C5 the Component Object's own gate refuses the Set with it: a consumed changed signal is named on both", () => {
    const ir = cloneIr();
    const home = componentOf(ir, HOME);
    connect(home, 'panelState', 'changed', 'setStatus', 'do');
    expect(refusalOf(ir, HOME, 'panelState')).toBe("its changed signal is consumed — signal-on-write is not translated in this slice; the record's readers re-render on every write instead");
    expect(refusalOf(ir, HOME, 'setTitle')).toBe("its Component Object node is refused — its changed signal is consumed — signal-on-write is not translated in this slice; the record's readers re-render on every write instead");
  });

  test("C6 a wired prop the list does not name is dropped with the runtime's reason; the Set still translates", () => {
    const ir = cloneIr();
    connect(componentOf(ir, HOME), 'renamedLabel', 'savedValue', 'setTitle', 'prop-extra', 'value');
    const notes = notesOf(ir);
    expect(notes).toContain('"extra" is not in the node\'s Properties list, so the runtime never writes it (keysToSet filters by the list) — dropped');
    expect(dispositionOf(ir, HOME, 'setTitle').kind).toBe('collapsed');
  });

  test('C7 a Done into a value sink drives no translatable action', () => {
    const ir = cloneIr();
    const home = componentOf(ir, HOME);
    disconnect(home, (c) => c.fromId === 'setTitle' && c.fromProperty === 'done');
    connect(home, 'setTitle', 'done', 'headline', 'text', 'value');
    expect(refusalOf(ir, HOME, 'setTitle')).toBe('its Done output is consumed as a value — a pulse carries nothing to read');
    // A Done into a node that is neither a trigger nor a value port — a Text's own Group child slot — is the chain compiler's sentence.
    const ir2 = cloneIr();
    const home2 = componentOf(ir2, HOME);
    disconnect(home2, (c) => c.fromId === 'setTitle' && c.fromProperty === 'done');
    connect(home2, 'setTitle', 'done', 'people', 'items');
    expect(refusalOf(ir2, HOME, 'setTitle')).toBe('its done output drives no translatable action');
  });

  test('C8 a Set nothing fires is named for that; one fired by a refused trigger is named for that', () => {
    const ir = cloneIr();
    disconnect(componentOf(ir, HOME), (c) => c.toId === 'setTitle' && c.toProperty === 'store');
    expect(refusalOf(ir, HOME, 'setTitle')).toBe('nothing fires its Do, so no write could ever happen');
    const ir2 = cloneIr();
    const home2 = componentOf(ir2, HOME);
    disconnect(home2, (c) => c.toId === 'setTitle' && c.toProperty === 'store');
    addNode(home2, { id: 'idle', type: 'Delay' });
    connect(home2, 'idle', 'finished', 'setTitle', 'store');
    expect(refusalOf(ir2, HOME, 'setTitle')).toBeDefined();
    expect(dispositionOf(ir2, HOME, 'setTitle').kind).toBe('deferred');
  });

  test('C9 a Completed wired into a value sink: a pulse carries nothing to read — decided from the port kind before the chain compiles', () => {
    const ir = cloneIr();
    connect(componentOf(ir, HOME), 'setTitle', 'completed', 'headline', 'text', 'value');
    expect(refusalOf(ir, HOME, 'setTitle')).toBe('its Completed output is consumed as a value — a pulse carries nothing to read');
  });

  test('C10 Completed on the own Set is a chain of its own, after Done', () => {
    const ir = cloneIr();
    const home = componentOf(ir, HOME);
    addNode(home, { id: 'setDone', type: 'Set Variable', parameters: [{ name: 'name', value: { kind: 'literal', value: 'status' } }] });
    connect(home, 'setTitle', 'completed', 'setDone', 'do');
    connect(home, 'renamedLabel', 'savedValue', 'setDone', 'value', 'value');
    const src = fileOf(emitApp(ir, catalog), HOME_FILE);
    expect(src).toContain("panelState.set({ title: title, note: 'renamed' }); status.set('Renamed.'); status.set('Renamed.'); }}");
  });
});

describe('§D refusals, each by its sentence — the parent Set', () => {
  test('D1 a named Parent Component: this slice resolves the nearest ancestor only', () => {
    const ir = cloneIr();
    setParam(nodeOf(ir, PANEL, 'bump'), 'targetComponent', { kind: 'literal', value: '/Pages/Home' });
    expect(refusalOf(ir, PANEL, 'bump')).toBe('its Parent Component names "/Pages/Home" — this slice resolves the nearest ancestor record only; a named ancestor is not translated');
  });

  test('D2 a wired Parent Component', () => {
    const ir = cloneIr();
    connect(componentOf(ir, PANEL), 'bumpedLabel', 'savedValue', 'bump', 'targetComponent', 'value');
    expect(refusalOf(ir, PANEL, 'bump')).toBe('its Parent Component is wired — which ancestor it writes is not statically knowable');
  });

  test('D3 a consumed Error: the miss message is raised on the channel, not exposed as a row', () => {
    const ir = cloneIr();
    connect(componentOf(ir, PANEL), 'bump', 'error', 'bumpText', 'text', 'value');
    expect(refusalOf(ir, PANEL, 'bump')).toBe('its Error output is consumed — the miss message is raised on the error channel (set-parent-component-object-properties/no-ancestor) rather than exposed as a row in this slice');
  });

  test("D4 a consumed Completed: UUID's sentence — the arms are emitted, not a join beneath them", () => {
    const ir = cloneIr();
    connect(componentOf(ir, PANEL), 'bump', 'completed', 'setBumped', 'do');
    expect(refusalOf(ir, PANEL, 'bump')).toBe('its Completed output is consumed — it fires after every outcome, and this slice emits the outcome arms rather than a join beneath them');
  });

  test('D5 a Failure into a value sink drives no translatable action', () => {
    const ir = cloneIr();
    const panel = componentOf(ir, PANEL);
    disconnect(panel, (c) => c.fromId === 'bump' && c.fromProperty === 'failure');
    connect(panel, 'bump', 'failure', 'panelNote', 'text', 'value');
    expect(refusalOf(ir, PANEL, 'bump')).toBe('its Failure output is consumed as a value — a pulse carries nothing to read');
  });

  test('D6 no Failure chain: the miss arm still raises, and the Done arm still follows the patch', () => {
    const ir = cloneIr();
    const panel = componentOf(ir, PANEL);
    disconnect(panel, (c) => c.fromId === 'bump' && c.fromProperty === 'failure');
    const src = fileOf(emitApp(ir, catalog), PANEL_FILE);
    expect(src).toContain(`          if (parentObject === undefined) {\n            ${BUMP_RAISE}\n          } else {\n            parentObject.set({ count: 1 });\n            bumpStatus.set('Bumped.');\n          }`);
  });

  test('D7 a parent Set alone (no reader in the component) prints the hook without reader sites and no mount raise', () => {
    const ir = cloneIr();
    const panel = componentOf(ir, PANEL);
    panel.nodes = panel.nodes.filter((n) => n.id !== 'parentState');
    disconnect(panel, (c) => c.fromId === 'parentState' || c.toId === 'parentState');
    const src = fileOf(emitApp(ir, catalog), PANEL_FILE);
    expect(src).toContain('const parentObject = useParentComponentObject<PanelParentRecord>();');
    expect(src).toContain('type PanelParentRecord = { count?: unknown };');
  });
});

describe('§E refusals, each by its sentence — the parent reader', () => {
  const readerRefusal = (mutate: (ir: ExportIR) => void): string | undefined => {
    const ir = cloneIr();
    mutate(ir);
    return refusalOf(ir, PANEL, 'parentState');
  };

  test('E1 a named Parent Component', () => {
    expect(readerRefusal((ir) => setParam(nodeOf(ir, PANEL, 'parentState'), 'targetComponent', { kind: 'literal', value: '/Pages/Home' }))).toBe(
      'its Parent Component names "/Pages/Home" — this slice resolves the nearest ancestor record only; a named ancestor is not translated'
    );
  });

  test('E2 a wired Parent Component', () => {
    expect(readerRefusal((ir) => connect(componentOf(ir, PANEL), 'bumpedLabel', 'savedValue', 'parentState', 'targetComponent', 'value'))).toBe(
      'its Parent Component is wired — which ancestor it reads is not statically knowable'
    );
  });

  test('E3 a wired Fetch: batch republish is signal work', () => {
    expect(readerRefusal((ir) => connect(componentOf(ir, PANEL), 'bumpBtn', 'onClick', 'parentState', 'fetch'))).toBe(
      'its Fetch is wired — a batch republish with Fetched/Done ordering is signal work this slice does not translate'
    );
  });

  test('E4 Parent object unticked under Run On Value Change: the outputs freeze', () => {
    expect(readerRefusal((ir) => setParam(nodeOf(ir, PANEL, 'parentState'), 'runOnChange-object', { kind: 'literal', value: false }))).toBe(
      'Parent object is unticked under Run On Value Change — its outputs freeze between Fetch pulses'
    );
  });

  test('E5 a consumed changed-<p> signal: signal-on-write is not translated, the readers re-render instead', () => {
    expect(readerRefusal((ir) => connect(componentOf(ir, PANEL), 'parentState', 'changed-title', 'setBumped', 'do'))).toBe(
      "its changed-title signal is consumed — signal-on-write is not translated in this slice; the record's readers re-render on every write instead"
    );
  });

  test('E6 a consumed Failure: the miss is raised once at mount, not branched on', () => {
    expect(readerRefusal((ir) => connect(componentOf(ir, PANEL), 'parentState', 'failure', 'setBumpFailed', 'do'))).toBe(
      'its Failure signal is consumed — a missing ancestor is raised on the error channel once at mount (parent-component-object/no-ancestor) and not branched on in this slice'
    );
  });

  test('E7 a consumed Error', () => {
    expect(readerRefusal((ir) => connect(componentOf(ir, PANEL), 'parentState', 'error', 'panelNote', 'text', 'value'))).toBe(
      'its Error output is consumed — the miss message is raised on the error channel (parent-component-object/no-ancestor) rather than exposed as a row in this slice'
    );
  });

  test('E8 a wired value-* INPUT is a write through the reader node itself', () => {
    expect(readerRefusal((ir) => connect(componentOf(ir, PANEL), 'bumpedLabel', 'savedValue', 'parentState', 'value-title', 'value'))).toBe(
      'its "title" property input is wired — a write through the Parent Component Object node itself is not translated in this slice; a Set Parent Component Object Properties is'
    );
  });

  test('E9 a dotted key would path-resolve through nested models', () => {
    expect(
      readerRefusal((ir) => {
        const panel = componentOf(ir, PANEL);
        setParam(nodeOf(ir, PANEL, 'parentState'), 'properties', { kind: 'literal', value: 'title,note,user.name' });
        disconnect(panel, (c) => c.fromId === 'parentState' && c.fromProperty === 'value-note');
        connect(panel, 'parentState', 'value-user.name', 'panelNote', 'text', 'value');
      })
    ).toBe('property "user.name" is a dotted path the record would resolve through nested models');
  });

  test('E10 a reader nothing reads is named; a signal read as a value is named by the whole-node gate first', () => {
    expect(readerRefusal((ir) => disconnect(componentOf(ir, PANEL), (c) => c.fromId === 'parentState'))).toBe('its properties feed nothing statically translatable');
    // The gate speaks before the read does: a signal wired anywhere — even into a value sink — is the gate's sentence.
    expect(readerRefusal((ir) => connect(componentOf(ir, PANEL), 'parentState', 'fetched', 'panelNote', 'text', 'value'))).toBe(
      "its fetched signal is consumed — signal-on-write is not translated in this slice; the record's readers re-render on every write instead"
    );
  });

  test("E11 a read into an out-of-vocabulary sink is the WIRE's refusal — the record is real state, the node still collapses", () => {
    const ir = cloneIr();
    connect(componentOf(ir, PANEL), 'parentState', 'value-title', 'panelRoot', 'marginLeft', 'value');
    expect(dispositionOf(ir, PANEL, 'parentState').kind).toBe('collapsed');
    expect(notesOf(ir)).toContain('its value-title feeds Group.marginLeft, which has no static binding in this slice');
  });
});

describe('§F the Component Object in record mode — what changed against COMPONENT-OBJECT-TARGET §3, and the alias mode kept', () => {
  test('F1 a mirror whose source has no static translation refuses the node BEFORE any read binds (the key would read a lie)', () => {
    const ir = cloneIr();
    const home = componentOf(ir, HOME);
    addNode(home, { id: 'fn', type: 'net.noodl.PatternExtractor' });
    connect(home, 'fn', 'out', 'panelState', 'value-count', 'value');
    const disposition = dispositionOf(ir, HOME, 'panelState');
    expect(disposition.kind).toBe('deferred');
    expect(disposition.reason).toContain('count');
    const src = fileOf(emitApp(ir, catalog), HOME_FILE);
    expect(src).not.toContain('useComponentObject');
    expect(src).not.toContain('panelState.value');
    // The Set and the descendants are refused / left with the reason named, never silently.
    expect(refusalOf(ir, HOME, 'setTitle')).toContain('its Component Object node is refused');
  });

  test("F2 a record-mode read into an out-of-vocabulary sink is the wire's refusal, not the node's (alias mode defers the node — the existing spec pins that)", () => {
    const ir = cloneIr();
    connect(componentOf(ir, HOME), 'panelState', 'value-title', 'shell', 'marginLeft', 'value');
    expect(dispositionOf(ir, HOME, 'panelState').kind).toBe('collapsed');
    expect(notesOf(ir)).toContain('its value-title feeds Group.marginLeft, which has no static binding in this slice');
  });

  test('F3 two Component Object nodes still share one record and both defer (gate 1 stands)', () => {
    const ir = cloneIr();
    addNode(componentOf(ir, HOME), { id: 'panelState2', type: 'net.noodl.ComponentObject', parameters: [{ name: 'properties', value: { kind: 'literal', value: 'x' } }] });
    expect(refusalOf(ir, HOME, 'panelState')).toBe('two Component Object nodes share one record — not translated in this slice');
  });

  test('F4 a descendant reach alone (no Set) is record mode: the host prints the hook and the Provider though it reads nothing itself', () => {
    const ir = cloneIr();
    const home = componentOf(ir, HOME);
    home.nodes = home.nodes.filter((n) => n.id !== 'setTitle');
    disconnect(home, (c) => c.fromId === 'setTitle' || c.toId === 'setTitle' || (c.fromId === 'panelState' && c.fromProperty.startsWith('value-')));
    const src = fileOf(emitApp(ir, catalog), HOME_FILE);
    expect(dispositionOf(ir, HOME, 'panelState').kind).toBe('collapsed');
    expect(src).toContain('const panelState = useComponentObject<PanelStateRecord>();');
    expect(src).toContain('<ParentComponentObjectContext.Provider value={panelState}>');
    expect(src).toContain('panelState.set({ note: noteValue });');
  });

  test('F5 the alias mode is untouched: cheer ships no lib, no hook, no Provider', () => {
    const other = emitApp(parseProject(path.join(__dirname, 'fixtures', 'cheer'), catalog), catalog);
    expect(other.files[COMPONENT_OBJECT_LIB_PATH]).toBeUndefined();
    expect(other.files['src/components/GreetingCard.tsx']).not.toContain('useComponentObject');
    expect(other.files['src/components/GreetingCard.tsx']).not.toContain('Provider');
  });

  test('F6 a key with a number literal writer types number and binds a number sink bare; a string key at a text sink folds bare', () => {
    const ir = cloneIr();
    const home = componentOf(ir, HOME);
    setParam(nodeOf(ir, HOME, 'setTitle'), 'properties', { kind: 'literal', value: 'title,note,count' });
    setParam(nodeOf(ir, HOME, 'setTitle'), 'prop-count', { kind: 'literal', value: 3 });
    const plan = planOf(ir, HOME);
    expect(plan.componentObject!.keys.find((k) => k.key === 'count')).toEqual({ key: 'count', tsType: 'number' });
    const src = fileOf(emitApp(ir, catalog), HOME_FILE);
    expect(src).toContain("panelState.set({ title: title, note: 'renamed', count: 3 });");
    expect(src).toContain("{String(panelState.value.count ?? '')}");
    void home;
  });

  test('F7 a mirror wire and a Set on the same key: both write it — the effect and the patch, as the runtime races them', () => {
    const src = fileOf(app, HOME_FILE);
    expect(src).toContain('panelState.set({ note: noteValue });');
    expect(src).toContain("note: 'renamed'");
  });
});

describe('§G what building it found, pinned', () => {
  test("G1 the mirror effect reads the Variable's hook local, never the store object (the hooks-walker trap, twelfth instance)", () => {
    const src = fileOf(app, HOME_FILE);
    expect(src).toContain('panelState.set({ note: noteValue });');
    expect(src).not.toContain('panelState.set({ note: note });');
    expect(src).toContain('const noteValue = useValue(note);');
  });

  test('G2 a non-string key folds ONCE at a text sink', () => {
    const src = fileOf(app, HOME_FILE);
    expect(src).toContain("{String(panelState.value.count ?? '')}</p>");
    expect(src).not.toContain("?? '') ?? ''");
    expect(fileOf(app, PANEL_FILE)).not.toContain("?? '') ?? ''");
  });

  test('G3 an authored prop literal is written (base.ts delivers parameters into inputValues), not skipped as §47 skips it', () => {
    expect(fileOf(app, HOME_FILE)).toContain("note: 'renamed'");
  });

  test('G4 the ledger: three rows translated with notes, floor 111', () => {
    const ledger = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'coverage-ledger.json'), 'utf8')) as {
      pickerCoverageFloor: number;
      entries: Array<{ typeName: string; status: string; note?: string }>;
    };
    for (const type of [SET_TYPE, PARENT_TYPE, SET_PARENT_TYPE]) {
      const entry = ledger.entries.find((e) => e.typeName === type)!;
      expect(entry.status).toBe('translated');
      expect((entry.note ?? '').length).toBeGreaterThan(40);
    }
    expect(ledger.pickerCoverageFloor).toBe(117); // §66 Subscribe To Changes (session 90) on top of §65 WebSocket (session 89) on top of §64 Server-Sent Events (session 88) on top of §60 the component-object trio + §61 the component-stack trio + §62 + §63 (session 86)
  });

  test('G6 readers alone (no parent Set, no other raiser) still ship errors.ts — the lib imports it, and the emitted app typechecks', () => {
    const ir = cloneIr();
    const panel = componentOf(ir, PANEL);
    panel.nodes = panel.nodes.filter((n) => !['bump', 'setBumped', 'setBumpFailed', 'bumpedLabel', 'missedLabel'].includes(n.id));
    disconnect(panel, (c) => ['bump', 'setBumped', 'setBumpFailed', 'bumpedLabel', 'missedLabel'].includes(c.fromId) || ['bump', 'setBumped', 'setBumpFailed'].includes(c.toId));
    const built = emitApp(ir, catalog);
    expect(fileOf(built, PANEL_FILE)).not.toContain('raiseAppError');
    expect(built.files[ERRORS_LIB_PATH]).toBeDefined();
    expect(typecheckEmittedApp(built)).toEqual([]);
  });

  test('G5 the lib exports the two hooks, the context, the two verbatim messages — and nothing that throws', () => {
    const lib = componentObjectLibSource();
    expect(lib).toContain('export function useComponentObject<');
    expect(lib).toContain('export function useParentComponentObject<');
    expect(lib).toContain('export const ParentComponentObjectContext = createContext<');
    expect(lib).toContain("export const NO_ANCESTOR_MESSAGE = 'No ancestor component has a Component Object node';");
    expect(lib).toContain("export const NO_ANCESTOR_WRITE_MESSAGE = 'No ancestor component has a Component Object node — nothing was written';");
    expect(lib).toContain("import { raiseAppError } from './errors';");
  });
});
