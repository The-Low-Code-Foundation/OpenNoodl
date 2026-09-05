import * as fs from 'fs';
import * as path from 'path';

import * as ts from 'typescript';

import { Catalog, CatalogIndex } from '../src/catalog';
import { ComponentPlan, ON_APP_ERROR_VALUE_OUTPUTS, planProject } from '../src/analyze/plan';
import { emitApp } from '../src/emit/emitApp';
import { ERRORS_LIB_PATH, errorsLibSource } from '../src/emit/errorsLib';
import { summarizePreflight } from '../src/emit/preflight';
import { exportBadgeOf, ledgerEntryOf } from '../src/ledger';
import { parseProject } from '../src/parse/parseProject';
import { typecheckEmittedApp } from './helpers/typecheckApp';
import { ComponentIR, ConnectionIR, ExportIR, NodeIR, ParamValue } from '../src/ir/types';

/**
 * EXP-011 §54 — `On App Error` (Tier 2.8 row 4). The type id is the display name.
 *
 * The runtime's boundary (`onapperror.ts`) subscribes to the error channel (`runtimeerror.ts`) at creation,
 * accepts an event when its code starts with the Filter (empty: everything), updates its six value outputs
 * and THEN pulses Error; every instance fires. So the export hosts the channel — `src/lib/errors.ts`, the
 * bus transcribed with its depth guard, its throwing-subscriber isolation and the console default that makes
 * a failure never fully silent — and the boundary as `useAppError({ filter }, listener)`, armed in a layout
 * effect. The channel is fed where the runtime raises: every request verb's failure arm, the Run Tasks host,
 * a Script's load failure, each with the node's graph id, its type id and its component (`Node.raiseRuntimeError`).
 *
 * A boundary beside the Router — the app-wide placement — needs a file the router shell never had: the shell
 * keeps one (`components/AppShell.tsx`, null-rendering), and the scaffold's `App.tsx` renders it inside the
 * router, before the routes, for the app's life.
 *
 * Measured before the build (probe17-reverted.log, HEAD d4d3400c): both boundaries refused — the shell's as
 * "node beside the router shell", the page's as "logic node (On App Error)" — two pathway roots, three silenced
 * setters, and the verdict "Without them, the app has no error pathway"; the cloud call's failure wrote its
 * row and told nobody.
 *
 * §A the plan · §B the shell · §C the page · §D the channel's text · §E the channel under a hook harness ·
 * §F the refused shapes, by mutation · §G the report and the pre-flight · §H the ledger · §I every variant
 * typechecks · §J the controls.
 */

const FIXTURE = path.join(__dirname, 'fixtures', 'alarm-desk');
const CATALOG_PATH = path.join(__dirname, '..', '..', 'noodl-types', 'src', 'node-catalog.json');
const catalog: Catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
const index = new CatalogIndex(catalog);
const baseIr = parseProject(FIXTURE, catalog);
const app = emitApp(baseIr, catalog);
const project = planProject(baseIr, index);

const APP = 'App';
const HOME = 'Pages/Home';
const SHELL_FILE = 'src/components/AppShell.tsx';
const HOME_FILE = 'src/pages/Home.tsx';
const ROUTER_FILE = 'src/App.tsx';

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
const connect = (component: ComponentIR, fromId: string, fromProperty: string, toId: string, toProperty: string, kind: ConnectionIR['kind'] = 'signal') => {
  component.connections.push({ key: `${fromId}:${fromProperty}->${toId}:${toProperty}`, fromId, fromProperty, toId, toProperty, kind });
};
const disconnect = (component: ComponentIR, predicate: (c: ConnectionIR) => boolean) => {
  component.connections = component.connections.filter((c) => !predicate(c));
};
const refusalOf = (source: ExportIR, componentPath: string, id: string) =>
  emitApp(source, catalog).report.components.find((c) => c.path === componentPath)?.refusals?.find((r) => r.nodeId === id);
const homeSentence = (mutate: (ir: ExportIR) => void): string | undefined => {
  const ir = cloneIr();
  mutate(ir);
  return refusalOf(ir, HOME, 'cloudOnly')?.reason;
};

const CATCH_ALL_LINE = "  const catchAll = useAppError({}, () => { lastError.set(catchAll.last?.message); lastCode.set(catchAll.last?.code); });";
const CLOUD_ONLY_LINE = "  const cloudOnly = useAppError({ filter: 'cloud-function' }, () => cloudType.set(cloudOnly.last?.nodeType));";
const PING_RAISE =
  "raiseAppError({ code: 'cloud-function/call-failed', message: pingMessage, nodeId: 'ping', nodeType: 'CloudFunction2', componentName: '/Pages/Home' });";

// ---------------------------------------------------------------------------------------------------
describe('§A the plan — two boundaries, one beside the Router and one in a page', () => {
  const shell = project.plans.find((p) => p.path === APP)!;
  const home = project.plans.find((p) => p.path === HOME)!;

  test('the router shell keeps a file for the boundary beside its Router, and no root', () => {
    expect(shell.shell).toBe(true);
    expect(shell.file).toEqual({ dir: 'components', fileBase: 'AppShell', symbol: 'AppShell' });
    expect(shell.rootId).toBeNull();
    expect(shell.skipReason).toBeUndefined();
    expect(shell.skipKind).toBeUndefined();
    expect(shell.dispositions.router).toEqual({ kind: 'collapsed', into: 'src/App.tsx' });
  });

  test('the app-wide boundary: no filter, the Error chain is the two store writes reading its Message and Code', () => {
    expect(shell.appErrors).toHaveLength(1);
    const boundary = shell.appErrors[0];
    expect(boundary).toMatchObject({ nodeId: 'catchAll', label: 'Catch all', local: 'catchAll' });
    expect(boundary.filter).toBeUndefined();
    expect(boundary.listener).toEqual([
      { kind: 'store-set', variableName: 'lastError', expr: { kind: 'app-error-out', nodeId: 'catchAll', local: 'catchAll', field: 'message', tsType: 'string' } },
      { kind: 'store-set', variableName: 'lastCode', expr: { kind: 'app-error-out', nodeId: 'catchAll', local: 'catchAll', field: 'code', tsType: 'string' } }
    ]);
    expect(shell.dispositions.catchAll).toEqual({ kind: 'collapsed', into: SHELL_FILE });
    expect(shell.dispositions.setLastError).toEqual({ kind: 'collapsed', into: SHELL_FILE });
    expect(shell.dispositions.setLastCode).toEqual({ kind: 'collapsed', into: SHELL_FILE });
    expect(shell.refusals).toEqual([]);
  });

  test('the page boundary: an authored Filter is a literal, the chain reads Node Type, the direct read is a binding', () => {
    expect(home.appErrors).toHaveLength(1);
    const boundary = home.appErrors[0];
    expect(boundary).toMatchObject({ nodeId: 'cloudOnly', label: 'Cloud only', local: 'cloudOnly', filter: { kind: 'literal', value: 'cloud-function' } });
    expect(boundary.listener).toEqual([
      { kind: 'store-set', variableName: 'cloudType', expr: { kind: 'app-error-out', nodeId: 'cloudOnly', local: 'cloudOnly', field: 'nodeType', tsType: 'string' } }
    ]);
    expect(home.bindings.directText?.text).toEqual({
      kind: 'computed',
      expr: { kind: 'app-error-out', nodeId: 'cloudOnly', local: 'cloudOnly', field: 'message', tsType: 'string' }
    });
    expect(home.dispositions.cloudOnly).toEqual({ kind: 'collapsed', into: HOME_FILE });
    expect(home.dispositions.setCloudCount).toEqual({ kind: 'collapsed', into: HOME_FILE });
    expect(home.refusals).toEqual([]);
  });

  test('the six value outputs, and the Error Object typed structurally so a store row needs no import', () => {
    expect(ON_APP_ERROR_VALUE_OUTPUTS).toEqual(['message', 'code', 'nodeId', 'componentName', 'nodeType', 'errorObject']);
    const ir = cloneIr();
    const home = componentOf(ir, HOME);
    disconnect(home, (c) => c.fromId === 'cloudOnly' && c.fromProperty === 'nodeType');
    connect(home, 'cloudOnly', 'errorObject', 'setCloudCount', 'value', 'value');
    const plan = planOf(ir, HOME);
    expect(plan.appErrors[0].listener?.[0]).toMatchObject({
      kind: 'store-set',
      expr: { kind: 'app-error-out', field: 'errorObject', tsType: '{ code: string; message: string; nodeId: string; componentName: string; nodeType: string; detail?: unknown }' }
    });
  });
});

// ---------------------------------------------------------------------------------------------------
describe('§B the shell — App.tsx renders it inside the router; it hosts the hook and draws nothing', () => {
  const routerFile = app.files[ROUTER_FILE];
  const shellFile = app.files[SHELL_FILE];

  test('App.tsx imports the shell and renders it as the first child of BrowserRouter, before the routes', () => {
    expect(routerFile).toContain("import { AppShell } from './components/AppShell';");
    expect(routerFile).toContain('    <BrowserRouter>\n      <AppShell />\n      <Routes>');
    // The import sorts with the page imports, components before pages.
    expect(routerFile.indexOf("from './components/AppShell'")).toBeLessThan(routerFile.indexOf("from './pages/Home'"));
  });

  test('the shell file: the hook and the two stores imported, the boundary line, return null', () => {
    expect(shellFile).toContain("import { useAppError } from '../lib/errors';");
    expect(shellFile).toContain("import { lastCode, lastError } from '../stores/variables';");
    expect(shellFile).toContain("/** App — the logic beside the Router, hosted for the app's life (src/App.tsx renders it inside the router). */");
    expect(shellFile).toContain('export function AppShell() {');
    expect(shellFile).toContain('  // Catch all — an On App Error boundary (onapperror.ts): hears every error raised anywhere in the app while this component is mounted; its value outputs describe the latest one.');
    expect(shellFile).toContain(CATCH_ALL_LINE);
    expect(shellFile).toContain('  return null;\n}');
    expect(shellFile).not.toContain('raiseAppError');
  });

  test('the report lists the shell as an emitted component, not a scaffolded skip', () => {
    const row = app.report.components.find((c) => c.path === APP)!;
    expect(row.file).toBe(SHELL_FILE);
    expect(row.skipped).toBeUndefined();
    expect(row.refusals).toEqual([]);
    expect(app.notes.some((n) => n.includes('router shell — emitted as src/App.tsx'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------------
describe('§C the page — the filtered boundary, the direct read, and the raise in the failure arm', () => {
  const page = app.files[HOME_FILE];

  test('imports both halves of the channel from one specifier', () => {
    expect(page).toContain("import { raiseAppError, useAppError } from '../lib/errors';");
  });

  test('the hook line: the authored Filter as a literal, the listener inline', () => {
    expect(page).toContain(CLOUD_ONLY_LINE);
    // After the state rows and the render locals, before the return.
    expect(page.indexOf('const [pingError, setPingError]')).toBeLessThan(page.indexOf(CLOUD_ONLY_LINE));
    expect(page.indexOf(CLOUD_ONLY_LINE)).toBeLessThan(page.indexOf('  return ('));
  });

  test('the direct read: Message off the handle, bare — undefined renders nothing, as the Text node does', () => {
    expect(page).toContain('<p className={styles.text}>{cloudOnly.last?.message}</p>');
  });

  test("the cloud call's failure arm raises after the Error row and before the chain, with the node's provenance", () => {
    expect(page).toContain(
      '          } catch (error) {\n' +
        '            const pingMessage = error instanceof Error ? error.message : String(error);\n' +
        '            setPingError(pingMessage);\n' +
        `            ${PING_RAISE}\n` +
        "            pings.set('failed');\n" +
        '          }'
    );
  });

  test('the Error Object at a text position takes the JSON cast; a boolean sink coerces; a number sink refuses', () => {
    const ir = cloneIr();
    const home = componentOf(ir, HOME);
    disconnect(home, (c) => c.fromId === 'cloudOnly' && c.toId === 'directText');
    connect(home, 'cloudOnly', 'errorObject', 'directText', 'text', 'value');
    connect(home, 'cloudOnly', 'errorObject', 'pingsText', 'visible', 'value');
    const built = emitApp(ir, catalog);
    expect(built.files[HOME_FILE]).toContain('{JSON.stringify(cloudOnly.last)}');
    // The truthiness sink (`visible`) takes the bare object: present is true, absent is false.
    expect(built.files[HOME_FILE]).toContain('!cloudOnly.last && styles.hiddenKeepSpace');
    expect(typecheckEmittedApp(built)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------
describe("§D the channel's text — src/lib/errors.ts, shipped and transcribed", () => {
  const lib = app.files[ERRORS_LIB_PATH];

  test('shipped exactly as the generator writes it, with the module header', () => {
    expect(ERRORS_LIB_PATH).toBe('src/lib/errors.ts');
    expect(lib.endsWith(errorsLibSource())).toBe(true);
    expect(lib.startsWith('// @nodegx:generated')).toBe(true);
  });

  test('the bus: a cloned subscriber list, the depth guard at 2 with the runtime sentence, a throwing subscriber isolated', () => {
    expect(lib).toContain('const MAX_DELIVERY_DEPTH = 2;');
    expect(lib).toContain('const current = subscribers.slice();');
    expect(lib).toContain("console.error('runtime error raised while delivering another; dropped', error);");
    expect(lib).toContain("console.error('a runtime-error subscriber threw', e);");
  });

  test('the deployed default: one structured console line per failure, installed at module load', () => {
    // Spelled by concatenation, as createConsoleErrorSubscriber spells it — and logic.test.ts's corpus control forbids a template literal in generated code.
    expect(lib).toContain("subscribeAppErrors((error) => {\n  console.error(error.nodeType + ' (' + error.componentName + '): ' + error.message + ' [' + error.code + ']', error);\n});");
  });

  test('the boundary: a layout effect, the code-prefix filter coerced and matched as the node spells it, values before the signal', () => {
    expect(lib).toContain("import { useLayoutEffect, useReducer, useRef } from 'react';");
    expect(lib).toContain('export function useAppError(options: AppErrorOptions = {}, onError?: (error: AppError) => void): AppErrorHandle {');
    expect(lib).toContain('const filter = raw === undefined || raw === null ? undefined : String(raw);');
    expect(lib).toContain('if (filter && error.code.indexOf(filter) !== 0) return;');
    const accept = lib.indexOf('last.current = error;');
    expect(accept).toBeGreaterThan(0);
    expect(lib.indexOf('publish();', accept)).toBeLessThan(lib.indexOf('onRef.current?.(error);', accept));
  });
});

// ---------------------------------------------------------------------------------------------------
// §E — the channel under node. The Run Tasks spec's hook harness, with useLayoutEffect standing beside
// useEffect (both run after the render that declared them; this spec grades delivery, not effect phase).
// ---------------------------------------------------------------------------------------------------
type AppError = { code: string; message: string; nodeId: string; nodeType: string; componentName: string; detail?: unknown };
type Lib = {
  raiseAppError: (error: AppError) => void;
  subscribeAppErrors: (s: (error: AppError) => void) => () => void;
  useAppError: (options?: { filter?: string }, onError?: (error: AppError) => void) => { readonly last: AppError | undefined };
};
interface Harness {
  React: {
    useRef: (v: unknown) => { current: unknown };
    useReducer: (r: (s: any, a: any) => any, init: any) => [any, (a: any) => void];
    useEffect: (fn: () => void | (() => void), deps?: unknown[]) => void;
    useLayoutEffect: (fn: () => void | (() => void), deps?: unknown[]) => void;
  };
  render<T>(component: () => T): T;
  unmount(): void;
  renders: number;
}
function makeHarness(): Harness {
  const slots: any[] = [];
  const effects: Array<{ deps?: unknown[]; cleanup?: () => void }> = [];
  let cursor = 0;
  let pendingEffects: Array<{ slot: number; fn: () => void | (() => void); deps?: unknown[] }> = [];
  let dirty = false;
  const same = (a?: unknown[], b?: unknown[]) => a !== undefined && b !== undefined && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const useEffect = (fn: () => void | (() => void), deps?: unknown[]) => {
    const i = cursor++;
    pendingEffects.push({ slot: i, fn, deps });
  };
  const harness: Harness = {
    renders: 0,
    React: {
      useRef: (v) => {
        const i = cursor++;
        if (slots[i] === undefined) slots[i] = { current: v };
        return slots[i];
      },
      useReducer: (r, init) => {
        const i = cursor++;
        if (slots[i] === undefined) slots[i] = { state: init };
        const slot = slots[i];
        return [
          slot.state,
          (a: any) => {
            slot.state = r(slot.state, a);
            dirty = true;
          }
        ];
      },
      useEffect,
      useLayoutEffect: useEffect
    },
    render<T>(component: () => T): T {
      let out!: T;
      do {
        dirty = false;
        cursor = 0;
        pendingEffects = [];
        harness.renders++;
        out = component();
        for (const e of pendingEffects) {
          const prev = effects[e.slot];
          if (prev !== undefined && same(prev.deps, e.deps)) continue;
          prev?.cleanup?.();
          const cleanup = e.fn();
          effects[e.slot] = { deps: e.deps, cleanup: typeof cleanup === 'function' ? cleanup : undefined };
        }
      } while (dirty);
      return out;
    },
    unmount() {
      for (const e of effects) e?.cleanup?.();
    }
  };
  return harness;
}
/** A fresh module per call: the console default is installed at load, and the subscriber list is module state. */
const loadLib = (): { lib: Lib; harness: Harness } => {
  const harness = makeHarness();
  const js = ts.transpileModule(errorsLibSource(), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const module = { exports: {} as Lib };
  // eslint-disable-next-line no-new-func
  new Function('require', 'module', 'exports', js)(
    (name: string) => {
      if (name !== 'react') throw new Error(`unexpected import ${name}`);
      return harness.React;
    },
    module,
    module.exports
  );
  return { lib: module.exports, harness };
};
const event = (code: string, message = 'it went wrong'): AppError => ({ code, message, nodeId: 'n1', nodeType: 'CloudFunction2', componentName: '/Pages/Home' });

describe('§E the channel runs the way runtimeerror.ts and onapperror.ts do (hook harness under node)', () => {
  let errors: jest.SpyInstance;
  beforeEach(() => {
    errors = jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => errors.mockRestore());

  test('with nothing wired, a raise is one structured console line — never fully silent', () => {
    const { lib } = loadLib();
    lib.raiseAppError(event('cloud-function/call-failed', 'No cloud services defined in this project.'));
    expect(errors).toHaveBeenCalledTimes(1);
    expect(errors).toHaveBeenCalledWith('CloudFunction2 (/Pages/Home): No cloud services defined in this project. [cloud-function/call-failed]', expect.objectContaining({ code: 'cloud-function/call-failed' }));
  });

  test('a boundary hears the event; `last` describes it BEFORE the listener runs, and the host re-renders', () => {
    const { lib, harness } = loadLib();
    const seen: Array<string | undefined> = [];
    let handle!: { readonly last: AppError | undefined };
    const render = () => harness.render(() => (handle = lib.useAppError({}, () => seen.push(handle.last?.message))));
    render();
    expect(handle.last).toBeUndefined();
    const before = harness.renders;
    lib.raiseAppError(event('run-tasks/task-failed', 'Task 1 of 3 failed'));
    expect(seen).toEqual(['Task 1 of 3 failed']);
    expect(handle.last).toMatchObject({ code: 'run-tasks/task-failed', nodeType: 'CloudFunction2' });
    render();
    expect(harness.renders).toBeGreaterThan(before);
  });

  test('the Filter is a code prefix: `run-tasks` takes every run-tasks/* code and nothing else; empty takes everything', () => {
    const { lib, harness } = loadLib();
    const filtered: string[] = [];
    const all: string[] = [];
    harness.render(() => {
      lib.useAppError({ filter: 'run-tasks' }, (e) => filtered.push(e.code));
      lib.useAppError({ filter: '' }, (e) => all.push(e.code));
    });
    for (const code of ['run-tasks/task-failed', 'cloud-function/call-failed', 'run-tasks/no-items', 'runtime/cyclic-loop']) lib.raiseAppError(event(code));
    expect(filtered).toEqual(['run-tasks/task-failed', 'run-tasks/no-items']);
    expect(all).toEqual(['run-tasks/task-failed', 'cloud-function/call-failed', 'run-tasks/no-items', 'runtime/cyclic-loop']);
  });

  test('every boundary fires — no claiming, no consumption — and the console default still prints', () => {
    const { lib, harness } = loadLib();
    const log: string[] = [];
    harness.render(() => {
      lib.useAppError({}, () => log.push('first'));
      lib.useAppError({}, () => log.push('second'));
    });
    lib.raiseAppError(event('http/timeout'));
    expect(log).toEqual(['first', 'second']);
    expect(errors).toHaveBeenCalledTimes(1);
  });

  test('a boundary whose host unmounts hears nothing more (the delete listener unsubscribes)', () => {
    const { lib, harness } = loadLib();
    const log: string[] = [];
    harness.render(() => lib.useAppError({}, (e) => log.push(e.code)));
    lib.raiseAppError(event('a/one'));
    harness.unmount();
    lib.raiseAppError(event('a/two'));
    expect(log).toEqual(['a/one']);
  });

  test('a listener that throws does not stop the next boundary; the throw is logged', () => {
    const { lib, harness } = loadLib();
    const log: string[] = [];
    harness.render(() => {
      lib.useAppError({}, () => {
        throw new Error('the handler broke');
      });
      lib.useAppError({}, (e) => log.push(e.code));
    });
    lib.raiseAppError(event('a/one'));
    expect(log).toEqual(['a/one']);
    expect(errors).toHaveBeenCalledWith('a runtime-error subscriber threw', expect.any(Error));
  });

  test('a listener that raises: one level of re-entry is delivered, the second is dropped with the runtime sentence', () => {
    const { lib, harness } = loadLib();
    const log: string[] = [];
    harness.render(() =>
      lib.useAppError({}, (e) => {
        log.push(e.code);
        lib.raiseAppError(event(`${e.code}+`));
      })
    );
    lib.raiseAppError(event('a'));
    expect(log).toEqual(['a', 'a+']);
    expect(errors).toHaveBeenCalledWith('runtime error raised while delivering another; dropped', expect.objectContaining({ code: 'a++' }));
  });

  test('unsubscribing during delivery skips no neighbour (the list is cloned before the loop)', () => {
    const { lib } = loadLib();
    const log: string[] = [];
    let off = () => {};
    off = lib.subscribeAppErrors(() => {
      log.push('one');
      off();
    });
    lib.subscribeAppErrors(() => log.push('two'));
    lib.raiseAppError(event('a'));
    lib.raiseAppError(event('b'));
    expect(log).toEqual(['one', 'two', 'two']);
  });

  test('the Filter is read live: the latest render decides, as the node reads its input at delivery', () => {
    const { lib, harness } = loadLib();
    const log: string[] = [];
    let filter = 'http';
    const render = () => harness.render(() => lib.useAppError({ filter }, (e) => log.push(e.code)));
    render();
    lib.raiseAppError(event('run-tasks/no-items'));
    filter = 'run-tasks';
    render();
    lib.raiseAppError(event('run-tasks/no-items'));
    expect(log).toEqual(['run-tasks/no-items']);
  });
});

// ---------------------------------------------------------------------------------------------------
describe('§F the refused shapes, by mutation — each sentence exact, and the corpus stays clean', () => {
  test('Error consumed as a value: the sentence names the mistake, decided before the chain compiles', () => {
    expect(
      homeSentence((ir) => {
        const home = componentOf(ir, HOME);
        disconnect(home, (c) => c.fromId === 'cloudOnly' && c.toId === 'directText');
        connect(home, 'cloudOnly', 'error', 'directText', 'text', 'value');
      })
    ).toBe('its Error output is consumed as a value — a pulse carries nothing to read');
  });

  test('two wires on Filter', () => {
    expect(
      homeSentence((ir) => {
        const home = componentOf(ir, HOME);
        connect(home, 'lastErrorVar', 'value', 'cloudOnly', 'filter', 'value');
        connect(home, 'lastCodeVar', 'value', 'cloudOnly', 'filter', 'value');
      })
    ).toBe('two wires feed its Filter input — last-writer-wins is not statically ordered');
  });

  test('an input the node has not got, and an output it has not got', () => {
    expect(homeSentence((ir) => connect(componentOf(ir, HOME), 'lastErrorVar', 'value', 'cloudOnly', 'severity', 'value'))).toBe('its severity input is not a port this node has');
    expect(homeSentence((ir) => connect(componentOf(ir, HOME), 'cloudOnly', 'stack', 'directText', 'text', 'value'))).toBe('its stack output is consumed, and this node has no such port');
  });

  test('a Filter fed by a text input is refused — with the fallback sentence, not the precise one (registered §54.7)', () => {
    // The boundary registers in the early trigger loop, before the controlled-state seam that hosts a hook
    // argument fed by a text input (files.test.ts B13) has minted a row — so the read answers null with no
    // reason of its own. The refusal is right; the sentence and the seam are a residual with an owner.
    expect(
      homeSentence((ir) => {
        const home = componentOf(ir, HOME);
        home.nodes.push({ id: 'filterInput', type: 'net.noodl.controls.textinput', catalogRef: 'net.noodl.controls.textinput', authoredLabel: 'Filter', parent: 'shell', parameters: [{ name: 'placeholder', value: { kind: 'literal', value: 'Filter' } }], declaredPorts: [], portKnowledge: 'complete' });
        nodeOf(ir, HOME, 'shell').children!.push('filterInput');
        connect(home, 'filterInput', 'text', 'cloudOnly', 'filter', 'value');
      })
    ).toBe('its Filter input has no statically known source');
  });

  test('a wired Filter from a Variable is a render read, printed into the options and read live by the hook', () => {
    const ir = cloneIr();
    const home = componentOf(ir, HOME);
    connect(home, 'lastCodeVar', 'value', 'cloudOnly', 'filter', 'value');
    const built = emitApp(ir, catalog);
    expect(planOf(ir, HOME).appErrors[0].filter).toEqual({ kind: 'store-get', variableName: 'lastCode' });
    expect(built.files[HOME_FILE]).toContain("const cloudOnly = useAppError({ filter: code }, () => cloudType.set(cloudOnly.last?.nodeType));");
    expect(typecheckEmittedApp(built)).toEqual([]);
  });

  test('a boundary in a logic-only component nothing mounts: no file to host it', () => {
    const ir = cloneIr();
    ir.components.push({
      ...structuredClone(componentOf(ir, APP)),
      path: 'Watcher',
      legacyPath: '/Watcher',
      role: 'component',
      nodes: [{ id: 'lonely', type: 'On App Error', catalogRef: 'On App Error', parameters: [], declaredPorts: [], portKnowledge: 'complete' }],
      connections: [],
      visualRoots: []
    } as ComponentIR);
    expect(refusalOf(ir, 'Watcher', 'lonely')?.reason).toBe('component emits no file to host the boundary');
  });

  test('a refused boundary is a pathway root; a chain node behind it is silenced and attributed', () => {
    const ir = cloneIr();
    const home = componentOf(ir, HOME);
    disconnect(home, (c) => c.fromId === 'cloudOnly' && c.toId === 'directText');
    connect(home, 'cloudOnly', 'error', 'directText', 'text', 'value');
    const built = emitApp(ir, catalog);
    const pre = summarizePreflight(built);
    expect(pre.cascade.roots.map((r) => r.node.nodeId)).toEqual(['cloudOnly']);
    expect(pre.cascade.roots[0].node.pathway).toBe(true);
    expect(pre.cascade.roots[0].silences.map((s) => s.node.nodeId)).toEqual(['setCloudCount']);
    expect(pre.verdict).toBe(
      'This export would be missing a pathway, not a node: "Cloud only" (On App Error) in `Pages/Home`. Without it, the app has no error pathway. Replace it or wait for a release that translates it.'
    );
    // The other boundary, and the raise, are untouched: the shell still exports and the page still raises.
    expect(built.files[SHELL_FILE]).toContain(CATCH_ALL_LINE);
    expect(built.files[HOME_FILE]).toContain(PING_RAISE);
    expect(built.files[HOME_FILE]).not.toContain('useAppError(');
  });
});

// ---------------------------------------------------------------------------------------------------
describe('§G the report and the pre-flight', () => {
  test('nothing refused, no cascade, no verdict; 16 files', () => {
    const pre = summarizePreflight(app);
    expect(pre.cascade).toEqual({ roots: [], unsilenced: 0, silenced: 0, pathway: [] });
    expect(pre.verdict).toBeNull();
    expect(pre.generatedFiles).toBe(16);
    expect(Object.keys(app.files).filter((f) => f.startsWith('src/')).sort()).toEqual([
      'src/App.tsx',
      'src/api/functions.ts',
      'src/components/AppShell.tsx',
      'src/lib/errors.ts',
      'src/main.tsx',
      'src/pages/Home.module.css',
      'src/pages/Home.tsx',
      'src/stores/variables.ts',
      'src/styles/base.css',
      'src/styles/tokens.css'
    ]);
  });

  test('every node is placed: no deferred disposition anywhere', () => {
    for (const plan of project.plans) {
      const deferred = Object.entries(plan.dispositions).filter(([, d]) => d.kind === 'deferred');
      expect({ path: plan.path, deferred }).toEqual({ path: plan.path, deferred: [] });
    }
  });
});

// ---------------------------------------------------------------------------------------------------
describe('§H the ledger', () => {
  test('On App Error is translated, carries no badge, and the floor is 96', () => {
    expect(ledgerEntryOf('On App Error')?.status).toBe('translated');
    expect(exportBadgeOf('On App Error')).toBeUndefined();
    const ledger = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'coverage-ledger.json'), 'utf8'));
    expect(ledger.pickerCoverageFloor).toBe(105); // §57 Repeater Item, §58 the streaming trio, §59 Hash / Random Bytes / Screen Resolution (session 85) // §56 Filter Records (session 84)
  });
});

// ---------------------------------------------------------------------------------------------------
describe('§I every variant typechecks as a real ts.Program', () => {
  test('the fixture', () => {
    expect(typecheckEmittedApp(app)).toEqual([]);
  });

  test('the shell without a boundary is the scaffold shell again — the control for §B', () => {
    const ir = cloneIr();
    const shell = componentOf(ir, APP);
    shell.nodes = shell.nodes.filter((n) => n.id === 'router');
    shell.connections = [];
    const built = emitApp(ir, catalog);
    expect(built.files[SHELL_FILE]).toBeUndefined();
    expect(built.files[ROUTER_FILE]).not.toContain('AppShell');
    expect(built.report.components.find((c) => c.path === APP)?.skipped).toEqual({ kind: 'scaffolded', reason: 'router shell — emitted as src/App.tsx by the scaffold' });
    expect(typecheckEmittedApp(built)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------
describe('§J the controls — who ships the channel, and who does not', () => {
  const load = (fixture: string) => emitApp(parseProject(path.join(__dirname, 'fixtures', fixture), catalog), catalog);

  test('a project with no boundary, no request verb, no Run Tasks and no Script ships no errors.ts and no import of it', () => {
    const quiet = load('slot-desk');
    expect(quiet.files[ERRORS_LIB_PATH]).toBeUndefined();
    for (const [name, source] of Object.entries(quiet.files)) {
      if (name.startsWith('src/')) expect({ name, imports: source.includes('lib/errors') }).toEqual({ name, imports: false });
    }
  });

  test('a Run Tasks host ships the channel (runTasks.ts raises on it), and a Script host does too', () => {
    const batch = load('batch-desk');
    expect(batch.files[ERRORS_LIB_PATH]).toBeDefined();
    expect(batch.files['src/lib/runTasks.ts']).toContain("import { raiseAppError } from './errors';");
    expect(batch.files['src/pages/Home.tsx']).toContain("useRunTasks({ label: 'Send all', nodeId: 'sendAll', componentName: '/Pages/Home' }, ");
    const script = load('script-desk');
    expect(script.files[ERRORS_LIB_PATH]).toBeDefined();
    expect(script.files['src/lib/script.ts']).toContain("import { raiseAppError } from './errors';");
  });

  test("an HTTP Request's module throws HttpError with the node's codes; the failure arms raise the status and the thrown code", () => {
    const quote = load('quote-desk');
    const http = quote.files['src/api/http.ts'];
    expect(http).toContain('export class HttpError extends Error {');
    expect(http).toContain("timedOut ? 'http/timeout' : 'http/network-error'");
    const page = Object.entries(quote.files).find(([name, source]) => name.startsWith('src/pages/') && source.includes('raiseAppError('))!;
    expect(page).toBeDefined();
    expect(page[1]).toContain("code: 'http/error-status'");
    expect(page[1]).toContain("code: (error as { code?: string }).code ?? 'http/network-error'");
    expect(typecheckEmittedApp(quote)).toEqual([]);
  });

  test('the recorded divergence: a Function node’s throw reaches the console, not the channel', () => {
    const batch = load('batch-desk');
    expect(batch.files['src/pages/Home.tsx']).toContain("console.error('Function node To_guests threw:', e);");
    expect(batch.files['src/pages/Home.tsx'].split('raiseAppError(').length - 1).toBe(0);
  });
});
