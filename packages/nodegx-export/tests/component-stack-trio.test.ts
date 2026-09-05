import * as fs from 'fs';
import * as path from 'path';

import * as ts from 'typescript';

import { Catalog, CatalogIndex } from '../src/catalog';
import { ComponentPlan, planProject } from '../src/analyze/plan';
import { emitApp } from '../src/emit/emitApp';
import { summarizePreflight } from '../src/emit/preflight';
import { PAGE_STACK_LIB_PATH, pageStackLibSource } from '../src/emit/pageStackLib';
import { exportBadgeOf, ledgerEntryOf } from '../src/ledger';
import { parseProject } from '../src/parse/parseProject';
import { typecheckEmittedApp } from './helpers/typecheckApp';
import { ComponentIR, ConnectionIR, ExportIR, NodeIR, ParamValue } from '../src/ir/types';

/**
 * EXP-011 §61 — the component-stack trio: `Page Stack` (display "Component Stack"), `PageStackNavigate`
 * ("Push Component To Stack") and `PageStackNavigateBack` ("Pop Component Stack"), Tier 2.8 row 11.
 *
 * Built on `tests/fixtures/wizard-desk`: a tab bar drives a stack "Tabs" in Replace mode; a wizard stack "Main"
 * starts on StepIntro, whose Next pushes StepDetails with the draft email (a Variable — a text input's live text
 * rides one, the standing rule); StepDetails' Confirm / Cancel pop under two back actions with the email as a
 * result; the pusher's confirm chain remembers it in a Variable the page shows, and a Text on StepIntro shows the
 * back result; the page shows the wizard's Top Component Name and Stack Depth and resets it on a button.
 *
 * 🔴 The reverted arm (`probe-reverted.log`, HEAD 2a2dd4fa): the two stacks `visual child of shell with no
 * deterministic generator (Page Stack)`, the four pushers and the Pop `logic node (…)`, the Set Variable behind the
 * back action silenced with the value-side sentence, 15 refusals, verdict null. Built: 0 refusals, 23 files.
 */

const FIXTURE = path.join(__dirname, 'fixtures', 'wizard-desk');
const CATALOG_PATH = path.join(__dirname, '..', '..', 'noodl-types', 'src', 'node-catalog.json');
const NAV_DIR = path.join(__dirname, '..', '..', 'noodl-viewer-react', 'src', 'nodes', 'navigation');
const catalog: Catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
const index = new CatalogIndex(catalog);
const baseIr = parseProject(FIXTURE, catalog);
const app = emitApp(baseIr, catalog);
const project = planProject(baseIr, index);

const HOME = 'Pages/Home';
const INTRO = 'Components/StepIntro';
const DETAILS = 'Components/StepDetails';
const HOME_FILE = 'src/pages/Home.tsx';
const INTRO_FILE = 'src/components/StepIntro.tsx';
const DETAILS_FILE = 'src/components/StepDetails.tsx';

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
  const full: NodeIR = { catalogRef: node.type, parameters: [], declaredPorts: [], portKnowledge: 'complete', ...node } as NodeIR;
  component.nodes.push(full);
  return full;
};
/** A Set Variable fed by a value wire — the fixtures' own shape for "something to hang a chain on" (its value never authors). */
const addSetVariable = (component: ComponentIR, id: string, name: string, fromId: string, fromProperty: string): NodeIR => {
  const node = addNode(component, { id, type: 'Set Variable', parameters: [{ name: 'name', value: { kind: 'literal', value: name } }] });
  connect(component, fromId, fromProperty, id, 'value', 'value');
  return node;
};
const notesOf = (source: ExportIR): string => emitApp(source, catalog).notes.join('\n');
const fileOf = (a: { files: Record<string, string> }, file: string): string => a.files[file];
/** The reason a node did not translate — a logic node's refusal, or a visual node's disposition. */
const reasonOf = (source: ExportIR, componentPath: string, nodeId: string): string | undefined => {
  const plan = planOf(source, componentPath);
  return plan.refusals.find((r) => r.nodeId === nodeId)?.reason ?? (plan.dispositions[nodeId] as { reason?: string } | undefined)?.reason;
};

const NO_STACK_IN_SCOPE = 'No Component Stack to pop — this node only works inside a component that a Component Stack pushed';
const COMPLETED = 'its Completed output is consumed — it fires after every outcome, and this slice emits the outcome arms rather than a join beneath them';
const POP_RAISE = "raiseAppError({ code: 'pop-component-stack/no-stack-in-scope', message: popResult.message, nodeId: 'pop', nodeType: 'PageStackNavigateBack', componentName: '/Components/StepDetails' });";

// ---------------------------------------------------------------------------------------------------
describe('§A the fixture, whole — two stacks, a tab bar in Replace mode, a wizard with a push and two pops', () => {
  test('A1 nothing refused: the only note is the router shell, 23 files, the lib among them', () => {
    expect(app.notes).toEqual(['App: router shell — emitted as src/App.tsx by the scaffold']);
    for (const p of [HOME, INTRO, DETAILS]) expect(project.plans.find((x) => x.path === p)!.refusals).toEqual([]);
    expect(summarizePreflight(app).refusals).toBe(0);
    expect(summarizePreflight(app).verdict).toBeNull();
    expect(Object.keys(app.files)).toHaveLength(23);
    expect(app.files[PAGE_STACK_LIB_PATH]).toContain('export function usePageStack(');
    expect(app.files[PAGE_STACK_LIB_PATH]).toContain('export function pushComponent(');
    expect(app.files[PAGE_STACK_LIB_PATH]).toContain('export function popComponent(');
    for (const f of [HOME_FILE, INTRO_FILE, DETAILS_FILE]) expect(fileOf(app, f)).not.toContain('TODO(export)');
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

  test('A4 the page: two hook lines in walk order, each with its pages and start page; the imports earned', () => {
    const src = fileOf(app, HOME_FILE);
    expect(src).toContain("import { replaceComponent, usePageStack } from '../lib/pageStack';");
    expect(src).toContain("import { StepDetails, StepDetailsProps } from '../components/StepDetails';");
    expect(src).toContain("import { StepIntro } from '../components/StepIntro';");
    expect(src).toContain("const tabs = usePageStack({ name: 'Tabs', pages: [{ id: 'overview', label: 'Overview' }, { id: 'settings', label: 'Settings' }], startPage: 'overview' });");
    expect(src).toContain("const wizard = usePageStack({ name: 'Main', pages: [{ id: 'intro', label: 'Intro' }, { id: 'details', label: 'Details' }], startPage: 'intro' });");
    expect(src.indexOf('const tabs = usePageStack(')).toBeLessThan(src.indexOf('const wizard = usePageStack('));
    expect(src.indexOf("from '../lib/pageStack'")).toBeLessThan(src.indexOf('export function HomePage'));
  });

  test('A5 the tab bar: Replace mode is replaceComponent, by the stack\'s name, with no callback', () => {
    const src = fileOf(app, HOME_FILE);
    expect(src).toContain(["          onClick={() => {", "            replaceComponent('Tabs', {", "              target: 'overview'", '            });', '          }}'].join('\n'));
    expect(src).toContain("replaceComponent('Tabs', {\n              target: 'settings'\n            });");
    expect(src).not.toContain("pushComponent('Tabs'");
  });

  test('A6 the two rows: EVERY entry in a wrapper hidden below the top (session 87 — the runtime keeps the pages under the top alive), one line per page, the params cast to the page\'s own Props, the reserved prop where a Pop lives', () => {
    const src = fileOf(app, HOME_FILE);
    expect(src).toContain('{tabs.entries.map((entry) => (');
    expect(src).toContain("<div key={entry.key} style={{ display: entry === tabs.top ? 'contents' : 'none' }}>");
    expect(src).toContain("{entry.pageId === 'overview' && <TabOverview />}");
    expect(src).toContain("{entry.pageId === 'settings' && <TabSettings />}");
    expect(src).toContain('{wizard.entries.map((entry) => (');
    expect(src).toContain("<div key={entry.key} style={{ display: entry === wizard.top ? 'contents' : 'none' }}>");
    expect(src).toContain("{entry.pageId === 'intro' && <StepIntro />}");
    expect(src).toContain("{entry.pageId === 'details' && <StepDetails {...(entry.params as StepDetailsProps)} pageStackEntry={entry.handle} />}");
    // The top-only row of the first build is gone: nothing keys a page component on `top.key`.
    expect(src).not.toContain('top?.pageId ===');
    expect(src).not.toContain('top.key');
    // StepIntro declares no inputs and keeps no Pop: no spread, no reserved prop.
    expect(src).not.toContain('StepIntroProps');
  });

  test('A7 the reads and the reset: the two outputs off the handle, bare; Reset is the call', () => {
    const src = fileOf(app, HOME_FILE);
    expect(src).toContain('{wizard.topPageName}');
    expect(src).toContain('{wizard.stackDepth}');
    expect(src).toContain('onClick={() => wizard.reset()}');
  });

  test('A8 the stack\'s class carries navigation-stack.tsx\'s defaultCss: a relative flex column that fills and clips', () => {
    const css = fileOf(app, 'src/pages/Home.module.css');
    const block = css.slice(css.indexOf('.wizard {'), css.indexOf('}', css.indexOf('.wizard {')));
    for (const decl of ['width: 100%;', 'flex: 1 1 100%;', 'position: relative;', 'display: flex;', 'flex-direction: column;', 'overflow: hidden;']) expect(block).toContain(decl);
    // The structure ports are the plan's, not "unmapped parameters".
    expect(app.notes.join('\n')).not.toContain('pageComp-');
    expect(app.notes.join('\n')).not.toContain('parameter pages on');
  });

  test('A9 the pusher, printed as navigate.ts\'s own call: target, params by the target\'s prop, the callback writes the row THEN tests the action', () => {
    const src = fileOf(app, INTRO_FILE);
    expect(src).toContain("import { pushComponent } from '../lib/pageStack';");
    expect(src).toContain('const [pushDetailsBackResults, setPushDetailsBackResults] = useState<Record<string, unknown>>({});');
    expect(src).toContain(
      [
        '        onClick={() => {',
        "          pushComponent('Main', {",
        "            target: 'details',",
        '            params: { email: draftEmail.get() },',
        '            backCallback: (action, pushDetailsResults) => {',
        '              setPushDetailsBackResults(pushDetailsResults);',
        "              if (action === 'confirm') {",
        '                confirmedEmail.set(pushDetailsResults.email);',
        '              }',
        '            }',
        '          });',
        '        }}'
      ].join('\n')
    );
    // The row's render read folds as an untyped Variable's (the port is `*`).
    expect(src).toContain("{String(pushDetailsBackResults.email ?? '')}");
  });

  test('A10 the popper: the reserved prop on the interface, one call per trigger port, the Failure arm raises the runtime\'s code', () => {
    const src = fileOf(app, DETAILS_FILE);
    expect(src).toContain("import { PageStackEntryHandle, popComponent } from '../lib/pageStack';");
    expect(src).toContain("import { raiseAppError } from '../lib/errors';");
    expect(src).toContain(['export interface StepDetailsProps {', '  email?: string;', "  /** The Component Stack that pushed this component — its Pop Component Stack's way back. */", '  pageStackEntry?: PageStackEntryHandle;', '}'].join('\n'));
    expect(src).toContain('export function StepDetails({ email, pageStackEntry }: StepDetailsProps) {');
    expect(src).toContain(
      [
        '        onClick={() => {',
        "          const popResult = popComponent(pageStackEntry, { backAction: 'confirm', results: { email } });",
        "          if (!popResult.ok && 'code' in popResult) {",
        `            ${POP_RAISE}`,
        '          }',
        '        }}'
      ].join('\n')
    );
    expect(src).toContain("popComponent(pageStackEntry, { backAction: 'cancel', results: { email } });");
  });

  test('A11 the ledger rows moved, so the three picker cards carry no badge; the floor is 114 after the merge (108 on its own branch)', () => {
    for (const type of ['Page Stack', 'PageStackNavigate', 'PageStackNavigateBack']) {
      expect(ledgerEntryOf(type)?.status).toBe('translated');
      expect(exportBadgeOf(type)).toBeUndefined();
    }
    const ledger = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'coverage-ledger.json'), 'utf8'));
    expect(ledger.pickerCoverageFloor).toBe(114); // §61 the component-stack trio beside §60 + §62 + §63 (session 86)
    expect(String(ledger.$pickerCoverageFloorComment)).toContain('114 after Tier 2.8 row 11');
  });
});

// ---------------------------------------------------------------------------------------------------
// §B the lib under node — a hook harness (fake useState / useEffect, functional updates honoured), the way
// §59's graded useScreenResolution. One `loadLib()` per test: the registry is module-level, as the runtime's is.
interface Lib {
  usePageStack(config: { name: string; pages: Array<{ id: string; label: string }>; startPage?: string }): {
    top: { key: number; pageId: string; label: string; params: Record<string, unknown>; handle?: { back(a: { backAction?: string; results?: Record<string, unknown> }): unknown } } | undefined;
    topPageName: string;
    stackDepth: number;
    reset(): void;
  };
  pushComponent(name: string, args: Record<string, unknown>): void;
  replaceComponent(name: string, args: Record<string, unknown>): void;
  popComponent(handle: unknown, args: Record<string, unknown>): { ok: boolean; unchanged?: true; code?: string; message?: string };
}
type Handle = ReturnType<Lib['usePageStack']>;
interface Mount {
  render(): Handle;
  unmount(): void;
  renders: number;
}
const loadLib = (): { lib: Lib; mount(config: Parameters<Lib['usePageStack']>[0]): Mount } => {
  const js = ts.transpileModule(pageStackLibSource(), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  // One fake React per module load; each mount owns its own slots, as each component instance does.
  let current: { slots: unknown[]; cursor: number; pending: Array<{ slot: number; fn: () => void | (() => void); deps?: unknown[] }>; dirty: () => void } | null = null;
  const React = {
    useState: (init: unknown) => {
      const owner = current!;
      const i = owner.cursor++;
      if (owner.slots[i] === undefined) owner.slots[i] = { value: typeof init === 'function' ? (init as () => unknown)() : init };
      const slot = owner.slots[i] as { value: unknown };
      return [
        slot.value,
        (next: unknown) => {
          slot.value = typeof next === 'function' ? (next as (v: unknown) => unknown)(slot.value) : next;
          owner.dirty();
        }
      ];
    },
    useEffect: (fn: () => void | (() => void), deps?: unknown[]) => {
      current!.pending.push({ slot: current!.cursor++, fn, deps });
    }
  };
  const module = { exports: {} as Lib };
  // eslint-disable-next-line no-new-func
  new Function('require', 'module', 'exports', js)(
    (name: string) => {
      if (name !== 'react') throw new Error(`unexpected import ${name}`);
      return React;
    },
    module,
    module.exports
  );
  const same = (a?: unknown[], b?: unknown[]) => a !== undefined && b !== undefined && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const mount = (config: Parameters<Lib['usePageStack']>[0]): Mount => {
    const slots: unknown[] = [];
    const effects: Array<{ deps?: unknown[]; cleanup?: () => void }> = [];
    let dirty = false;
    const owner = { slots, cursor: 0, pending: [] as typeof current extends null ? never : NonNullable<typeof current>['pending'], dirty: () => { dirty = true; } };
    const m: Mount = {
      renders: 0,
      render() {
        let out!: Handle;
        do {
          dirty = false;
          owner.cursor = 0;
          owner.pending = [];
          current = owner;
          m.renders++;
          out = module.exports.usePageStack(config);
          for (const e of owner.pending) {
            const prev = effects[e.slot];
            if (prev !== undefined && same(prev.deps, e.deps)) continue;
            prev?.cleanup?.();
            const cleanup = e.fn();
            effects[e.slot] = { deps: e.deps, cleanup: typeof cleanup === 'function' ? cleanup : undefined };
          }
          current = null;
        } while (dirty);
        return out;
      },
      unmount() {
        for (const e of effects) e?.cleanup?.();
      }
    };
    return m;
  };
  return { lib: module.exports, mount };
};
const MAIN = { name: 'Main', pages: [{ id: 'intro', label: 'Intro' }, { id: 'details', label: 'Details' }], startPage: 'intro' };

describe('§B the lib runs the way navigation-handler.ts / navigation-stack.tsx / navigate-back.ts do (hook harness under node)', () => {
  test('B1 the first render shows nothing — the runtime paints an empty stack before its async reset too; the mount effect registers and resets', () => {
    const { mount } = loadLib();
    const m = mount(MAIN);
    const h = m.render();
    expect(h.top?.pageId).toBe('intro');
    expect(h.topPageName).toBe('Intro');
    expect(h.stackDepth).toBe(1);
    // Two renders: the empty one, then the one the registration's reset asked for.
    expect(m.renders).toBe(2);
  });

  test('B2 a push: the entry with its params and a way back, the outputs, hasNavigated — and a fresh key per push', () => {
    const { lib, mount } = loadLib();
    const m = mount(MAIN);
    const first = m.render();
    const events: string[] = [];
    lib.pushComponent('Main', { target: 'details', params: { email: 'a@b' }, hasNavigated: () => events.push('navigated'), hasUnchanged: () => events.push('unchanged') });
    const h = m.render();
    expect(events).toEqual(['navigated']);
    expect(h.top?.pageId).toBe('details');
    expect(h.top?.params).toEqual({ email: 'a@b' });
    expect(h.top?.handle).toBeDefined();
    expect(h.topPageName).toBe('Details');
    expect(h.stackDepth).toBe(2);
    expect(h.top?.key).not.toBe(first.top?.key);
  });

  test('B3 the return: back() fires the pusher\'s callback with the action and the results, then pops — the outputs describe the entry below', () => {
    const { lib, mount } = loadLib();
    const m = mount(MAIN);
    m.render();
    const calls: unknown[] = [];
    lib.pushComponent('Main', { target: 'details', params: { email: 'a@b' }, backCallback: (action: string | undefined, results: unknown) => calls.push([action, results]) });
    const pushed = m.render();
    expect(lib.popComponent(pushed.top!.handle, { backAction: 'confirm', results: { email: 'c@d' } })).toEqual({ ok: true });
    expect(calls).toEqual([['confirm', { email: 'c@d' }]]);
    const h = m.render();
    expect(h.top?.pageId).toBe('intro');
    expect(h.stackDepth).toBe(1);
    expect(h.topPageName).toBe('Intro');
  });

  test('B4 no way back → the runtime\'s own failure, code and sentence; the start component has none, a pushed one has', () => {
    const { lib, mount } = loadLib();
    const m = mount(MAIN);
    const start = m.render();
    expect(start.top?.handle).toBeUndefined();
    expect(lib.popComponent(start.top?.handle, {})).toEqual({ ok: false, code: 'pop-component-stack/no-stack-in-scope', message: NO_STACK_IN_SCOPE });
  });

  test('B5 _isAlreadyShowing: the same page with the same params is Unchanged and pushes nothing; different params push', () => {
    const { lib, mount } = loadLib();
    const m = mount(MAIN);
    m.render();
    const events: string[] = [];
    const push = (params: Record<string, unknown>) => lib.pushComponent('Main', { target: 'details', params, hasNavigated: () => events.push('navigated'), hasUnchanged: () => events.push('unchanged') });
    push({ email: 'a@b' });
    push({ email: 'a@b' });
    expect(m.render().stackDepth).toBe(2);
    push({ email: 'x@y' });
    expect(m.render().stackDepth).toBe(3);
    expect(events).toEqual(['navigated', 'unchanged', 'navigated']);
  });

  test('B6 replace: one entry, no way back (replaceAsync installs no callback); at depth 1 the same page is Unchanged', () => {
    const { lib, mount } = loadLib();
    const m = mount(MAIN);
    m.render();
    lib.pushComponent('Main', { target: 'details', params: { email: 'a@b' } });
    expect(m.render().stackDepth).toBe(2);
    const events: string[] = [];
    lib.replaceComponent('Main', { target: 'details', params: { email: 'a@b' }, hasNavigated: () => events.push('navigated'), hasUnchanged: () => events.push('unchanged') });
    const h = m.render();
    expect(h.stackDepth).toBe(1);
    expect(h.top?.pageId).toBe('details');
    expect(h.top?.handle).toBeUndefined();
    lib.replaceComponent('Main', { target: 'details', params: { email: 'a@b' }, hasNavigated: () => events.push('navigated'), hasUnchanged: () => events.push('unchanged') });
    expect(events).toEqual(['navigated', 'unchanged']);
  });

  test('B7 the end-stop: back() at the root is Unchanged, not a Failure (ERG-001 §4)', () => {
    const { lib, mount } = loadLib();
    const m = mount(MAIN);
    m.render();
    lib.pushComponent('Main', { target: 'details', params: {} });
    const handle = m.render().top!.handle;
    expect(lib.popComponent(handle, {})).toEqual({ ok: true });
    expect(lib.popComponent(handle, {})).toEqual({ ok: false, unchanged: true });
  });

  test('B8 the queue: a push before any stack mounts waits, and registration resets then replays it', () => {
    const { lib, mount } = loadLib();
    const events: string[] = [];
    lib.pushComponent('Main', { target: 'details', params: { email: 'q' }, hasNavigated: () => events.push('navigated') });
    expect(events).toEqual([]);
    const h = mount(MAIN).render();
    expect(events).toEqual(['navigated']);
    expect(h.stackDepth).toBe(2);
    expect(h.top?.params).toEqual({ email: 'q' });
  });

  test('B9 two stacks under one name both take the push, and the press reports once (navigate.ts settle)', () => {
    const { lib, mount } = loadLib();
    const a = mount(MAIN);
    const b = mount(MAIN);
    a.render();
    b.render();
    const events: string[] = [];
    lib.pushComponent('Main', { target: 'details', params: {}, hasNavigated: () => events.push('navigated') });
    expect(a.render().stackDepth).toBe(2);
    expect(b.render().stackDepth).toBe(2);
    expect(events).toEqual(['navigated']);
  });

  test('B10 the failures the stack answers, with navigateAsync\'s sentences: a target not in the list, by id or label; an empty list', () => {
    const { lib, mount } = loadLib();
    mount(MAIN).render();
    const failed: unknown[] = [];
    lib.pushComponent('Main', { target: 'nowhere', params: {}, hasFailed: (code: string, message: string) => failed.push([code, message]) });
    expect(failed).toEqual([['push-component-stack/component-not-found', 'The Component Stack "Main" has no component "nowhere" — check the Target Page against its Components list']]);
    // `_findPage` accepts the label too.
    const events: string[] = [];
    lib.pushComponent('Main', { target: 'Details', params: {}, hasNavigated: () => events.push('navigated') });
    expect(events).toEqual(['navigated']);
    const empty = mount({ name: 'Empty', pages: [] });
    expect(empty.render().stackDepth).toBe(0);
    lib.pushComponent('Empty', { target: 'x', params: {}, hasFailed: (code: string, message: string) => failed.push([code, message]) });
    expect(failed[1]).toEqual(['push-component-stack/stack-has-no-components', 'The Component Stack "Empty" has no components to show — its Components list is empty']);
  });

  test('B11 reset rebuilds the start component with a fresh key; unmount deregisters, so a later push queues for the next mount', () => {
    const { lib, mount } = loadLib();
    const m = mount(MAIN);
    const first = m.render();
    lib.pushComponent('Main', { target: 'details', params: {} });
    expect(m.render().stackDepth).toBe(2);
    m.render().reset();
    const after = m.render();
    expect(after.stackDepth).toBe(1);
    expect(after.top?.pageId).toBe('intro');
    expect(after.top?.key).not.toBe(first.top?.key);
    m.unmount();
    const events: string[] = [];
    lib.pushComponent('Main', { target: 'details', params: {}, hasNavigated: () => events.push('navigated') });
    expect(events).toEqual([]);
    expect(mount(MAIN).render().stackDepth).toBe(2);
    expect(events).toEqual(['navigated']);
  });

  test('B12 the runtime\'s registry key: an empty name is Main', () => {
    const { lib, mount } = loadLib();
    const m = mount({ ...MAIN, name: '' });
    m.render();
    lib.pushComponent('', { target: 'details', params: {} });
    expect(m.render().stackDepth).toBe(2);
  });
});

// ---------------------------------------------------------------------------------------------------
describe('§D the refused shapes, by mutation — each sentence exact', () => {
  test('D1 Use Routes ticked refuses the stack whole, and the pusher onto it by the stack\'s reason', () => {
    const ir = cloneIr();
    setParam(nodeOf(ir, HOME, 'wizard'), 'useRoutes', { kind: 'literal', value: true });
    const stackReason = 'its Use Routes is ticked — the stack then writes the browser url (history.pushState) and reads its start component back from it, which this slice does not translate; untick it, or route the pages';
    expect(reasonOf(ir, HOME, 'wizard')).toBe(stackReason);
    expect(reasonOf(ir, INTRO, 'pushDetails')).toBe(`it pushes onto the Component Stack "Main", which did not translate — ${stackReason}`);
    // Nothing renders where it sat: the marker, not a div.
    const home = fileOf(emitApp(ir, catalog), HOME_FILE);
    expect(home).not.toContain('usePageStack({ name: \'Main\'');
    expect(home).toContain('TODO(export): Page Stack — node wizard');
  });

  test('D2 a wired Name / Components list / Start Page — the structure ports', () => {
    for (const [port, sentence] of [
      ['name', 'its Name is wired — a pusher finds its stack by name statically, and a name that arrives on a wire has no pusher this export can bind'],
      ['pages', 'its Components list is wired — the pages it can show are its structure'],
      ['startPage', 'its Start Page is wired — which component the stack starts on is its structure']
    ]) {
      const ir = cloneIr();
      connect(componentOf(ir, HOME), 'confirmedVar', 'value', 'wizard', port, 'value');
      expect(reasonOf(ir, HOME, 'wizard')).toBe(sentence);
    }
  });

  test('D3 an empty Components list; a page naming no component; a routed page; a component not in the project; a Start Page off the list', () => {
    const cases: Array<[(n: NodeIR) => void, string]> = [
      [(n) => setParam(n, 'pages', { kind: 'json', value: [] }), 'its Components list is empty — the runtime reports component-stack/no-components at mount and shows nothing'],
      [(n) => dropParam(n, 'pageComp-details'), 'its component "Details" names no component — the runtime cannot show it (component-stack/component-not-found)'],
      [(n) => setParam(n, 'pageComp-details', { kind: 'literal', value: '/Pages/Home' }), 'its component "Details" is /Pages/Home, a routed page — a Component Stack shows components; a page has a url of its own'],
      [(n) => setParam(n, 'pageComp-details', { kind: 'literal', value: '/Components/Nowhere' }), 'its component "Details" is /Components/Nowhere, which is not in the project'],
      [(n) => setParam(n, 'startPage', { kind: 'literal', value: 'nowhere' }), 'its Start Page "nowhere" is not in its Components list — the runtime reports component-stack/component-not-found at mount']
    ];
    for (const [mutate, sentence] of cases) {
      const ir = cloneIr();
      mutate(nodeOf(ir, HOME, 'wizard'));
      expect(reasonOf(ir, HOME, 'wizard')).toBe(sentence);
    }
  });

  test('D4 the stack\'s Completed: UUID\'s sentence; a Done with no Reset wired and a Failure are dropped with notes', () => {
    const ir = cloneIr();
    const home = componentOf(ir, HOME);
    connect(home, 'wizard', 'completed', 'goOverview', 'navigate');
    expect(reasonOf(ir, HOME, 'wizard')).toBe(COMPLETED);
    const ir2 = cloneIr();
    const home2 = componentOf(ir2, HOME);
    addSetVariable(home2, 'setNote', 'note', 'confirmedVar', 'value');
    connect(home2, 'tabs', 'done', 'setNote', 'do');
    connect(home2, 'tabs', 'failure', 'setNote', 'do');
    const notes = notesOf(ir2);
    expect(notes).toContain("Component Stack's Done fires only after a Reset it was asked for, and nothing fires its Reset — the mount-path reset reports nothing (navigation-stack.tsx _reportReset)");
    expect(notes).toContain("Component Stack's Failure chain is dead — its two causes (no components, a start component that does not resolve) are both excluded statically");
    expect(reasonOf(ir2, HOME, 'tabs')).toBeUndefined();
  });

  test('D5 the pusher\'s wired Stack / Mode / Target Page / Transition / tr-*', () => {
    for (const [port, sentence] of [
      ['stack', 'its Stack is wired — which Component Stack it pushes onto is a runtime value; this slice binds a pusher to a stack by its authored name'],
      ['mode', 'its Mode is wired — push and replace are two different calls'],
      ['target', 'its Target Page is wired — which component it pushes is a runtime value'],
      ['transition', 'its Transition is wired — the export switches components without animation, and a wire choosing one would be a wire into nothing'],
      ['tr-duration', 'its transition parameter "duration" is wired — the export switches components without animation, and a wire choosing one would be a wire into nothing']
    ]) {
      const ir = cloneIr();
      connect(componentOf(ir, HOME), 'confirmedVar', 'value', 'goOverview', port, 'value');
      expect(reasonOf(ir, HOME, 'goOverview')).toBe(sentence);
    }
  });

  test('D6 no stack of that name; a target off the list; a mode that is neither', () => {
    const ir = cloneIr();
    setParam(nodeOf(ir, HOME, 'goOverview'), 'stack', { kind: 'literal', value: 'Nope' });
    expect(reasonOf(ir, HOME, 'goOverview')).toBe('no Component Stack in the project is named "Nope" — the runtime queues the push until one mounts, and none ever will');
    const ir2 = cloneIr();
    setParam(nodeOf(ir2, HOME, 'goOverview'), 'target', { kind: 'literal', value: 'nope' });
    expect(reasonOf(ir2, HOME, 'goOverview')).toBe('its Target Page "nope" is not in the Components list of the stack "Tabs" — the runtime reports push-component-stack/component-not-found');
    const ir3 = cloneIr();
    setParam(nodeOf(ir3, HOME, 'goOverview'), 'mode', { kind: 'literal', value: 'swap' });
    expect(reasonOf(ir3, HOME, 'goOverview')).toBe("its Mode \"swap\" is neither push nor replace — the runtime's navigate() does nothing for it");
  });

  test('D7 a parameter typed against the target\'s own interface: a number into a string input refuses; an undeclared input is dropped with a note', () => {
    const ir = cloneIr();
    const intro = componentOf(ir, INTRO);
    disconnect(intro, (c) => c.toProperty === 'pm-email');
    setParam(nodeOf(ir, INTRO, 'pushDetails'), 'pm-email', { kind: 'literal', value: 42 });
    expect(reasonOf(ir, INTRO, 'pushDetails')).toBe('its "email" parameter is fed a number where /Components/StepDetails declares "email" as string');
    const ir2 = cloneIr();
    setParam(nodeOf(ir2, INTRO, 'pushDetails'), 'pm-nope', { kind: 'literal', value: 'x' });
    const app2 = emitApp(ir2, catalog);
    expect(app2.notes.join('\n')).toContain("Push Component To Stack pushDetails sets \"nope\" on /Components/StepDetails, which declares no such input — the runtime's setInputValue on an undeclared input reaches nothing; dropped, reported");
    expect(fileOf(app2, INTRO_FILE)).toContain('params: { email: draftEmail.get() },');
    expect(fileOf(app2, INTRO_FILE)).not.toContain('nope');
  });

  test('D8 the back channel in Replace mode — no callback is ever installed, so a back action or result is refused by name', () => {
    const ir = cloneIr();
    setParam(nodeOf(ir, INTRO, 'pushDetails'), 'mode', { kind: 'literal', value: 'replace' });
    expect(reasonOf(ir, INTRO, 'pushDetails')).toBe('its Back Action "confirm" is wired, but in Replace mode the stack installs no back callback (navigation-stack.tsx replaceAsync) — the chain would never fire');
    const ir2 = cloneIr();
    setParam(nodeOf(ir2, INTRO, 'pushDetails'), 'mode', { kind: 'literal', value: 'replace' });
    disconnect(componentOf(ir2, INTRO), (c) => c.fromProperty === 'backAction-confirm');
    expect(reasonOf(ir2, INTRO, 'pushDetails')).toBe('its Back Result "email" is read, but in Replace mode the stack installs no back callback (navigation-stack.tsx replaceAsync) — nothing ever writes it');
  });

  test('D9 a back action or result the target\'s Pop does not declare', () => {
    const ir = cloneIr();
    for (const c of componentOf(ir, INTRO).connections) if (c.fromProperty === 'backAction-confirm') c.fromProperty = 'backAction-nope';
    expect(reasonOf(ir, INTRO, 'pushDetails')).toBe('its Back Action "nope" is not one the target\'s Pop Component Stack declares');
    const ir2 = cloneIr();
    for (const c of componentOf(ir2, INTRO).connections) if (c.fromProperty === 'backResult-email') c.fromProperty = 'backResult-nope';
    expect(reasonOf(ir2, INTRO, 'pushDetails')).toBe('its Back Result "nope" is not one the target\'s Pop Component Stack declares');
  });

  test('D10 the pusher\'s Error, Completed, and a Done consumed as a value; a Failure wire is dropped with a note', () => {
    const ir = cloneIr();
    connect(componentOf(ir, INTRO), 'pushDetails', 'error', 'cameBackText', 'text', 'value');
    expect(reasonOf(ir, INTRO, 'pushDetails')).toBe("its Error is read, and with a literal Target inside the stack's Components list none of the pusher's three failures can fire (no components, component not found, still animating) — the row would be a string nothing ever writes");
    const ir2 = cloneIr();
    connect(componentOf(ir2, INTRO), 'pushDetails', 'completed', 'setConfirmed', 'do');
    expect(reasonOf(ir2, INTRO, 'pushDetails')).toBe(COMPLETED);
    const ir3 = cloneIr();
    connect(componentOf(ir3, INTRO), 'pushDetails', 'done', 'cameBackText', 'text', 'value');
    expect(reasonOf(ir3, INTRO, 'pushDetails')).toBe('its Done output is consumed as a value — a pulse carries nothing to read');
    const ir4 = cloneIr();
    connect(componentOf(ir4, INTRO), 'pushDetails', 'failure', 'setConfirmed', 'do');
    const app4 = emitApp(ir4, catalog);
    expect(app4.notes.join('\n')).toContain("Push Component To Stack's Failure chain is dead — a literal Target inside the stack's Components list, and no transition, leave none of the node's three failures reachable (navigation-stack.tsx navigateAsync)");
    expect(fileOf(app4, INTRO_FILE)).toContain("pushComponent('Main', {");
  });

  test('D11 a Pop in a component no stack lists — nothing ever pushes it', () => {
    const ir = cloneIr();
    const wizard = nodeOf(ir, HOME, 'wizard');
    setParam(wizard, 'pages', { kind: 'json', value: [{ id: 'intro', label: 'Intro' }] });
    dropParam(wizard, 'pageComp-details');
    expect(reasonOf(ir, DETAILS, 'pop')).toBe('no Component Stack lists /Components/StepDetails among its Components, so nothing ever pushes it — its Navigate answers Failure ("No Component Stack to pop") every time');
    // And the interface loses the reserved prop with it.
    expect(fileOf(emitApp(ir, catalog), DETAILS_FILE)).not.toContain('pageStackEntry');
  });

  test('D12 the reserved prop\'s name claimed by a declared port', () => {
    const ir = cloneIr();
    nodeOf(ir, DETAILS, 'detailsInputs').declaredPorts.push({ name: 'pageStackEntry', plug: 'output', type: 'string', kind: 'value' } as NodeIR['declaredPorts'][number]);
    expect(reasonOf(ir, DETAILS, 'pop')).toBe('a declared port already claims the reserved prop "pageStackEntry" — rename the port');
  });

  test('D13 the Pop\'s Unchanged, Completed, and an Error read outside its Failure chain', () => {
    const ir = cloneIr();
    const details = componentOf(ir, DETAILS);
    addSetVariable(details, 'setNote', 'note', 'detailsInputs', 'email');
    connect(details, 'pop', 'unchanged', 'setNote', 'do');
    expect(reasonOf(ir, DETAILS, 'pop')).toBe("its Unchanged output is consumed — it fires when the stack is already at its first component, which a pushed component's Pop cannot reach (only a pushed component receives the back callback; the start component's Pop answers Failure instead)");
    const ir2 = cloneIr();
    const details2 = componentOf(ir2, DETAILS);
    addSetVariable(details2, 'setNote', 'note', 'detailsInputs', 'email');
    connect(details2, 'pop', 'completed', 'setNote', 'do');
    expect(reasonOf(ir2, DETAILS, 'pop')).toBe(COMPLETED);
    const ir3 = cloneIr();
    connect(componentOf(ir3, DETAILS), 'pop', 'error', 'emailText', 'text', 'value');
    expect(notesOf(ir3)).toContain('its Error is read outside its Failure chain — this slice reads the message only inside the arm that writes it');
  });

  test('D14 a Back Result read while nothing fires the pusher\'s Navigate: no push, no row', () => {
    const ir = cloneIr();
    disconnect(componentOf(ir, INTRO), (c) => c.toProperty === 'navigate');
    const app2 = emitApp(ir, catalog);
    expect(app2.notes.join('\n')).toContain('its Back Result "email" is read, but nothing fires its Navigate — no component is ever pushed, and nothing ever comes back');
    expect(fileOf(app2, INTRO_FILE)).not.toContain('pushDetailsBackResults');
  });

  test('D15 two same-named stacks showing different components for the target', () => {
    const ir = cloneIr();
    const home = componentOf(ir, HOME);
    const twin = addNode(home, {
      id: 'wizard2',
      type: 'Page Stack',
      parent: 'shell',
      parameters: [
        { name: 'name', value: { kind: 'literal', value: 'Main' } },
        { name: 'pages', value: { kind: 'json', value: [{ id: 'intro', label: 'Intro' }, { id: 'details', label: 'Details' }] } },
        { name: 'pageComp-intro', value: { kind: 'literal', value: '/Components/StepIntro' } },
        { name: 'pageComp-details', value: { kind: 'literal', value: '/Components/TabOverview' } }
      ]
    });
    nodeOf(ir, HOME, 'shell').children!.push(twin.id);
    expect(reasonOf(ir, HOME, 'wizard2')).toBeUndefined();
    expect(reasonOf(ir, INTRO, 'pushDetails')).toBe('two Component Stacks are named "Main" and show different components for "details" — the pusher\'s parameters are minted from one of them');
  });

  test('D16 an authored non-default Transition is a note, not a refusal — the recorded divergence', () => {
    const ir = cloneIr();
    setParam(nodeOf(ir, INTRO, 'pushDetails'), 'transition', { kind: 'literal', value: 'Fade' });
    const app2 = emitApp(ir, catalog);
    expect(app2.notes.join('\n')).toContain('Push Component To Stack pushDetails: its Transition "Fade" is authored — the export switches components without animation (EXP-011 §61\'s recorded divergence)');
    expect(reasonOf(ir, INTRO, 'pushDetails')).toBeUndefined();
    expect(fileOf(app2, INTRO_FILE)).toContain("pushComponent('Main', {");
  });
});

// ---------------------------------------------------------------------------------------------------
describe('§E the shapes a wire changes — typechecked as one real program', () => {
  const wired = (): ExportIR => {
    const ir = cloneIr();
    const home = componentOf(ir, HOME);
    addSetVariable(home, 'setTab', 'lastTab', 'confirmedVar', 'value');
    connect(home, 'goOverview', 'done', 'setTab', 'do');
    addSetVariable(home, 'setSame', 'sameTab', 'confirmedVar', 'value');
    connect(home, 'goOverview', 'unchanged', 'setSame', 'do');
    addSetVariable(home, 'setReset', 'resetNote', 'confirmedVar', 'value');
    connect(home, 'wizard', 'done', 'setReset', 'do');
    const details = componentOf(ir, DETAILS);
    addSetVariable(details, 'setPopped', 'popNote', 'detailsInputs', 'email');
    connect(details, 'pop', 'done', 'setPopped', 'do');
    addNode(details, { id: 'setPopErr', type: 'Set Variable', parameters: [{ name: 'name', value: { kind: 'literal', value: 'popError' } }] });
    connect(details, 'pop', 'failure', 'setPopErr', 'do');
    connect(details, 'pop', 'error', 'setPopErr', 'value', 'value');
    return ir;
  };
  const wiredApp = emitApp(wired(), catalog);

  test('E1 the pusher\'s Done and Unchanged print as the runtime\'s two callbacks', () => {
    const src = fileOf(wiredApp, HOME_FILE);
    expect(src).toContain(["            replaceComponent('Tabs', {", "              target: 'overview',", '              hasNavigated: () => lastTab.set(confirmedEmail.get()),', '              hasUnchanged: () => sameTab.set(confirmedEmail.get())', '            });'].join('\n'));
  });

  test('E2 the Pop\'s Done arm, and its Failure arm reading Error as the result\'s message after the raise', () => {
    const src = fileOf(wiredApp, DETAILS_FILE);
    expect(src).toContain(
      [
        "          const popResult = popComponent(pageStackEntry, { backAction: 'confirm', results: { email } });",
        '          if (popResult.ok) {',
        '            popNote.set(email);',
        "          } else if ('code' in popResult) {",
        `            ${POP_RAISE}`,
        '            popError.set(popResult.message);',
        '          }'
      ].join('\n')
    );
  });

  test('E3 the stack\'s Reset then its Done chain', () => {
    const src = fileOf(wiredApp, HOME_FILE);
    expect(src).toContain(['        onClick={() => {', '          wizard.reset();', '          resetNote.set(confirmedEmail.get());', '        }}'].join('\n'));
  });

  test('E4 the wired program typechecks, and nothing in it was refused', () => {
    expect(summarizePreflight(wiredApp).refusals).toBe(0);
    expect(typecheckEmittedApp(wiredApp)).toEqual([]);
  });

  test('E5 a Back Result read from a SIBLING handler compiled before the attach pass takes §59.5\'s residual sentence', () => {
    // The residual, pinned so it is a fact and not folklore: a render read (Pass 4c) sees the attach pass's
    // answer; a handler compiled earlier cannot, and is refused with the id nodes' sentence.
    const ir = cloneIr();
    const intro = componentOf(ir, INTRO);
    addNode(intro, { id: 'setSibling', type: 'Set Variable', parameters: [{ name: 'name', value: { kind: 'literal', value: 'sibling' } }] });
    addNode(intro, { id: 'siblingBtn', type: 'net.noodl.controls.button', parent: 'introRoot', parameters: [{ name: 'label', value: { kind: 'literal', value: 'Copy' } }] });
    nodeOf(ir, INTRO, 'introRoot').children!.push('siblingBtn');
    connect(intro, 'siblingBtn', 'onClick', 'setSibling', 'do');
    connect(intro, 'pushDetails', 'backResult-email', 'setSibling', 'value', 'value');
    expect(notesOf(ir)).toContain('its Back Result "email" is read, but its Navigate is never fired by a translatable trigger');
    // The push itself, the render read and the back chain are untouched.
    const src = fileOf(emitApp(ir, catalog), INTRO_FILE);
    expect(src).toContain("pushComponent('Main', {");
    expect(src).toContain("{String(pushDetailsBackResults.email ?? '')}");
  });
});

// ---------------------------------------------------------------------------------------------------
describe('§F what building it found, pinned', () => {
  test('F1 a text input\'s value port is `onTextChanged` (display "Value"), not `text` — the fixture\'s first wire was to a port that does not exist', () => {
    const input = (catalog as unknown as { nodes: Array<{ typeName: string; outputs: Array<{ name: string; displayName?: string; isSignal?: boolean }> }> }).nodes.find((n) => n.typeName === 'net.noodl.controls.textinput')!;
    expect(input.outputs.find((o) => o.name === 'onTextChanged')?.displayName).toBe('Value');
    expect(input.outputs.find((o) => o.name === 'onTextChanged')?.isSignal).toBe(false);
    expect(input.outputs.find((o) => o.name === 'text')).toBeUndefined();
  });

  test('F2 a Back Result row printed for a push that compiled but never attached — closed: the row is gone and the read is named', () => {
    // The dead artefact the first built probe showed: the pusher refused at ATTACH ("reads values that only exist
    // in another handler" — a text input's live text in a button's handler) while the render read had already
    // allocated the row. The attach registry answers the render read now.
    const ir = cloneIr();
    const intro = componentOf(ir, INTRO);
    disconnect(intro, (c) => c.toProperty === 'pm-email' || c.toId === 'draftVar');
    connect(intro, 'emailInput', 'onTextChanged', 'pushDetails', 'pm-email', 'value');
    const app2 = emitApp(ir, catalog);
    expect(app2.notes.join('\n')).toContain('the action reads values that only exist in another handler');
    expect(app2.notes.join('\n')).toContain('its Back Result "email" is read, but its Navigate is never fired by a translatable trigger');
    expect(fileOf(app2, INTRO_FILE)).not.toContain('useState<Record<string, unknown>>');
  });

  test('F3 the stack\'s number prints bare at a text position, as the viewport\'s do; the row\'s unknown folds', () => {
    expect(fileOf(app, HOME_FILE)).toContain('<p className={styles.text}>{wizard.stackDepth}</p>');
    expect(fileOf(app, INTRO_FILE)).toContain("String(pushDetailsBackResults.email ?? '')");
  });
});

// ---------------------------------------------------------------------------------------------------
describe('§G the runtime facts the lib transcribes, pinned against the files', () => {
  const read = (file: string) => fs.readFileSync(path.join(NAV_DIR, file), 'utf8');

  test('G1 navigate.ts: the results are flagged BEFORE the back action signal — so the emitted callback writes the row first', () => {
    const src = read('navigate.ts');
    const flag = src.indexOf("this.flagOutputDirty('backResult-' + key)");
    const signal = src.indexOf('if (action !== undefined) this.sendSignalOnOutput(action)');
    expect(flag).toBeGreaterThan(0);
    expect(signal).toBeGreaterThan(flag);
    expect(fileOf(app, INTRO_FILE).indexOf('setPushDetailsBackResults(pushDetailsResults)')).toBeLessThan(fileOf(app, INTRO_FILE).indexOf("if (action === 'confirm')"));
  });

  test('G2 the three sentences the lib answers are the runtime\'s own', () => {
    const stack = read('navigation-stack.tsx');
    const back = read('navigate-back.ts');
    const lib = pageStackLibSource();
    for (const s of ['has no components to show — its Components list is empty', '— check the Target Page against its Components list']) {
      expect(stack).toContain(s);
      expect(lib).toContain(s);
    }
    expect(back).toContain(NO_STACK_IN_SCOPE);
    expect(lib).toContain(NO_STACK_IN_SCOPE);
    // The registry key and the queue are navigation-handler.ts's.
    const handler = read('navigation-handler.ts');
    expect(handler).toContain("name = name || 'Main';");
    expect(lib).toContain("performNavigation(name || 'Main', settledOnce(args), 'navigate');");
    expect(lib).toContain('navigationQueue.push({ name, args, type });');
  });

  test('G3 the recorded divergence is in the ledger note, and the runtime does animate by default', () => {
    const ledger = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'coverage-ledger.json'), 'utf8')) as { entries: Array<{ typeName: string; note?: string }> };
    expect(String(ledger.entries.find((e) => e.typeName === 'Page Stack')?.note)).toContain('no transition');
    expect(read('navigate.ts')).toContain("const defaultTransition = isReplace ? 'None' : 'Push';");
    expect(pageStackLibSource()).not.toContain('Transitions');
  });
});
