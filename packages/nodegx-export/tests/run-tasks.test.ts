import * as fs from 'fs';
import * as path from 'path';

import * as ts from 'typescript';

import { Catalog, CatalogIndex } from '../src/catalog';
import { ComponentPlan, planProject, RUN_TASKS_OUTPUTS } from '../src/analyze/plan';
import { emitApp } from '../src/emit/emitApp';
import { summarizePreflight } from '../src/emit/preflight';
import { RUN_TASKS_LIB_PATH, runTasksLibSource } from '../src/emit/runTasksLib';
import { exportBadgeOf, ledgerEntryOf } from '../src/ledger';
import { parseProject } from '../src/parse/parseProject';
import { typecheckEmittedApp } from './helpers/typecheckApp';
import { ComponentIR, ConnectionIR, ExportIR, NodeIR, ParamValue } from '../src/ir/types';

/**
 * EXP-011 §53 — `Run Tasks` (`RunTasks`, Tier 2.8 row 3).
 *
 * The runtime runs a project component once per item of a list, with bounded concurrency, and reads the
 * template's completion off two outputs matched BY NAME (`runtasks.ts`: `createTaskComponent` makes a
 * component instance with the item as its model, `startTask` pulses the template's start input once,
 * `creatorCallbacks.onOutputChanged` watches for the success / failure edge; there is no wire between
 * host and template). So the export hosts both sides the way the runtime does: `src/lib/runTasks.ts`
 * transcribes the state machine, the host renders one template element per task in flight, and the
 * template — a logic-only component that emitted nothing before this row — becomes a null-rendering
 * component whose start chain is a mount effect.
 *
 * Measured before the build (probe16-reverted.log, HEAD 7d651798): the Run Tasks fell to
 * `logic node (RunTasks)`, its two click wires and its three chains were dropped, eight nodes were
 * silenced behind it, and the template was skipped as "no visual root — logic-only components defer".
 *
 * §A the host plan · §B the template plan · §C the emitted page · §D the emitted template · §E the host
 * library, run under node through a hook harness · §F the refused shapes, by mutation (the corpus stays
 * clean) · §G the report and the pre-flight · §H the ledger · §I every variant typechecks · §J the controls.
 */

const FIXTURE = path.join(__dirname, 'fixtures', 'batch-desk');
const CATALOG_PATH = path.join(__dirname, '..', '..', 'noodl-types', 'src', 'node-catalog.json');
const catalog: Catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
const index = new CatalogIndex(catalog);
const baseIr = parseProject(FIXTURE, catalog);
const app = emitApp(baseIr, catalog);
const project = planProject(baseIr, index);

const HOME = 'Pages/Home';
const NOTIFY = 'Notify';
const HOME_FILE = 'src/pages/Home.tsx';
const NOTIFY_FILE = 'src/components/Notify.tsx';

const cloneIr = (): ExportIR => structuredClone(baseIr);
const componentOf = (source: ExportIR, componentPath: string): ComponentIR =>
  source.components.find((c) => c.path === componentPath)!;
const nodeOf = (source: ExportIR, componentPath: string, id: string): NodeIR =>
  componentOf(source, componentPath).nodes.find((n) => n.id === id)!;
const planOf = (source: ExportIR, componentPath: string): ComponentPlan =>
  planProject(source, index).plans.find((p) => p.path === componentPath)!;
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
const logicNode = (id: string, type: string, parameters: Array<{ name: string; value: ParamValue }> = []): NodeIR => ({
  id,
  type,
  catalogRef: type,
  parameters,
  declaredPorts: [],
  portKnowledge: 'complete'
});
const refusalOf = (source: ExportIR, componentPath: string, id: string) =>
  emitApp(source, catalog).report.components.find((c) => c.path === componentPath)?.refusals?.find((r) => r.nodeId === id);
const hostSentence = (mutate: (ir: ExportIR) => void): string | undefined => {
  const ir = cloneIr();
  mutate(ir);
  return refusalOf(ir, HOME, 'sendAll')?.reason;
};

// ---------------------------------------------------------------------------------------------------
describe('§A the host plan — the Run Tasks node, registered once with its contract, its list and its listeners', () => {
  const home = project.plans.find((p) => p.path === HOME)!;
  const run = home.runTasks[0];

  test('one registration, the authored label as the local, the template by legacy path, the contract defaults', () => {
    expect(home.runTasks).toHaveLength(1);
    expect(run).toMatchObject({ nodeId: 'sendAll', label: 'Send all', local: 'sendAll', templateLegacy: '/Notify' });
    expect(run.contract).toEqual({ start: 'Do', success: 'Success', failure: 'Failure', error: 'Error' });
  });

  test('the list is the Function output, read at the pulse; the config is the authored pair', () => {
    expect(run.items).toEqual({ kind: 'jsfun-out', nodeId: 'toGuests', output: 'guests' });
    expect(run.maxRunningTasks).toEqual({ kind: 'literal', value: 2 });
    expect(run.stopOnFailure).toEqual({ kind: 'literal', value: true });
  });

  test('the template’s value inputs by identity, the callback props by the contract’s names', () => {
    expect(run.inputs).toEqual([{ port: 'name', field: 'name' }]);
    expect(run.idInputs).toEqual([]);
    expect(run.onSuccess).toBe('onSuccess');
    expect(run.onFailure).toBe('onFailure');
  });

  test('the three wired outputs are listeners; the two unwired ones are absent', () => {
    expect(Object.keys(run.listeners).sort()).toEqual(['aborted', 'done', 'failure']);
    expect(run.listeners.done).toEqual([{ kind: 'store-set', variableName: 'status', expr: { kind: 'literal', value: 'all sent' } }]);
    expect(run.listeners.failure![0]).toMatchObject({ kind: 'store-set', expr: { kind: 'literal', value: 'some failed' } });
    expect(run.listeners.aborted![0]).toMatchObject({ kind: 'store-set', expr: { kind: 'literal', value: 'stopped' } });
    expect(RUN_TASKS_OUTPUTS).toEqual(['done', 'failure', 'unchanged', 'completed', 'aborted']);
  });

  test('Do and Abort are the two button handlers', () => {
    expect(home.handlers.runBtn.onClick).toEqual([
      { kind: 'runtasks-run', nodeId: 'sendAll', local: 'sendAll', items: { kind: 'jsfun-out', nodeId: 'toGuests', output: 'guests' } }
    ]);
    expect(home.handlers.abortBtn.onClick).toEqual([{ kind: 'runtasks-abort', nodeId: 'sendAll', local: 'sendAll' }]);
  });

  test('every node behind it is collapsed into the page; nothing is refused', () => {
    for (const id of ['setDone', 'setFailed', 'setStopped', 'toGuests', 'namesConst', 'doneStr', 'failedStr', 'stoppedStr']) {
      expect(home.dispositions[id]).toEqual({ kind: 'collapsed', into: HOME_FILE });
    }
    expect(home.dispositions.sendAll.kind).toBe('collapsed');
    expect(home.refusals).toEqual([]);
    expect(home.notes).toEqual([]);
  });
});

describe('§B the template plan — a logic-only component with a file, no root, and a start chain', () => {
  const notify = project.plans.find((p) => p.path === NOTIFY)!;

  test('a file in components/, no root, no skip', () => {
    expect(notify.file).toEqual({ dir: 'components', fileBase: 'Notify', symbol: 'Notify' });
    expect(notify.rootId).toBeNull();
    expect(notify.skipReason).toBeUndefined();
    expect(notify.taskRefusal).toBeUndefined();
  });

  test('the start chain: the cloud call, Success and the store write on Done, Failure on failure', () => {
    expect(notify.task).toBeDefined();
    expect(notify.task!.startPort).toBe('Do');
    expect(notify.task!.hosts).toEqual([{ componentPath: HOME, nodeId: 'sendAll' }]);
    expect(notify.task!.actions).toHaveLength(1);
    expect(notify.task!.actions[0]).toMatchObject({
      kind: 'cloud-call',
      nodeId: 'notify',
      args: [{ param: 'name', expr: { kind: 'prop', name: 'name' } }],
      then: [
        { kind: 'output-signal', prop: 'onSuccess' },
        { kind: 'store-set', variableName: 'lastSent', expr: { kind: 'prop', name: 'name' } }
      ],
      failThen: [{ kind: 'output-signal', prop: 'onFailure' }]
    });
  });

  test('the interface is what it declares: the two props, the two callbacks', () => {
    expect(notify.props.map((p) => p.name)).toEqual(['Do', 'name']);
    expect(notify.outputProps).toEqual([
      { port: 'Success', prop: 'onSuccess' },
      { port: 'Failure', prop: 'onFailure' }
    ]);
  });

  test('the chain’s nodes collapse into the Component Inputs node; the interface nodes are static; nothing is refused', () => {
    expect(notify.dispositions.inputs).toEqual({ kind: 'static' });
    expect(notify.dispositions.outputs).toEqual({ kind: 'static' });
    expect(notify.dispositions.notify).toEqual({ kind: 'collapsed', into: 'inputs' });
    expect(notify.dispositions.setLast).toEqual({ kind: 'collapsed', into: 'inputs' });
    expect(notify.refusals).toEqual([]);
    // The attachment sweep saw the start chain: the cloud call keeps its export and its Error row.
    expect(notify.cloudCalls.map((c) => c.nodeId)).toEqual(['notify']);
    expect(notify.stateVars.some((v) => v.origin === 'cloud-error' && v.originNodeId === 'notify')).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------------
describe('§C the emitted page — the hook, the two handlers, the tasks rendered last', () => {
  const page = app.files[HOME_FILE];

  test('imports: the template, the host library, the two stores', () => {
    expect(page).toContain("import { Notify } from '../components/Notify';");
    expect(page).toContain("import { useRunTasks } from '../lib/runTasks';");
    expect(page).toContain("import { lastSent, status } from '../stores/variables';");
  });

  test('the hook line carries the label, the config and the three listeners', () => {
    // EXP-011 §54. The first argument is the node's provenance — what every raise on the error channel carries.
    expect(page).toContain("const sendAll = useRunTasks({ label: 'Send all', nodeId: 'sendAll', componentName: '/Pages/Home' }, { maxRunningTasks: 2, stopOnFailure: true }, {");
    expect(page).toContain("    done: () => status.set('all sent'),");
    expect(page).toContain("    failure: () => status.set('some failed'),");
    expect(page).toContain("    aborted: () => status.set('stopped')");
    expect(page).toContain('  // Send all — a Run Tasks node, hosted by runTasks.ts');
  });

  test('Do runs the list read at the pulse; Abort aborts', () => {
    expect(page).toContain("<button onClick={() => sendAll.run(To_guests({ names: 'Ada,Grace,Linus' }).guests)}>");
    expect(page).toContain('<button onClick={() => sendAll.abort()}>Stop</button>');
  });

  test('the tasks in flight render as the last child of the root, one template element each', () => {
    const block = ['      {sendAll.tasks.map((task) => (', '        <Notify', '          key={task.key}', '          name={task.item.name}', '          onSuccess={task.succeed}', '          onFailure={task.fail}', '        />', '      ))}'].join('\n');
    expect(page).toContain(block);
    const lastChild = page.lastIndexOf('<p className={styles.text}>{sent}</p>');
    expect(page.indexOf('{sendAll.tasks.map')).toBeGreaterThan(lastChild);
    expect(page.indexOf('{sendAll.tasks.map')).toBeLessThan(page.lastIndexOf('</div>'));
  });

  test('no marker, no preserved source: everything the graph held translated', () => {
    expect(page).not.toContain('TODO(export)');
  });
});

describe('§D the emitted template — renders null, runs its start chain once on mount', () => {
  const template = app.files[NOTIFY_FILE];

  test('the file exists, imports the cloud call and the store, declares the interface', () => {
    expect(template).toBeDefined();
    expect(template).toContain("import { useEffect, useRef, useState } from 'react';");
    expect(template).toContain("import { callNotifyGuest } from '../api/functions';");
    expect(template).toContain("import { lastSent } from '../stores/variables';");
    expect(template).toContain('export interface NotifyProps {\n  Do?: () => void;\n  name?: string;\n  onSuccess?: () => void;\n  onFailure?: () => void;\n}');
    expect(template).toContain('export function Notify({ Do, name, onSuccess, onFailure }: NotifyProps) {');
  });

  test('the mount effect: a ref guards the second mount, the chain is the try/catch, the deps are empty', () => {
    expect(template).toContain('  const started = useRef(false);');
    expect(template).toContain('  useEffect(() => {\n    if (started.current) return;\n    started.current = true;\n    void (async () => {\n      try {\n        const notifyGuestAnswer = await callNotifyGuest({ name });\n        onSuccess?.();\n        lastSent.set(name);\n      } catch (error) {');
    // EXP-011 §54. The raise sits between the Error row and the failure chain — where reportOutcome raises, before the pulse.
    expect(template).toContain('        setNotifyGuestError(notifyGuestMessage);\n        raiseAppError({ code: \'cloud-function/call-failed\', message: notifyGuestMessage, nodeId: \'notify\', nodeType: \'CloudFunction2\', componentName: \'/Notify\' });\n        onFailure?.();\n      }\n    })();\n    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, like the task\'s own start pulse\n  }, []);');
    expect(template).toContain('  // A Run Tasks template (run by Pages/Home › sendAll): draws nothing; its "Do" chain runs once on mount');
  });

  test('draws nothing: return null, no JSX, no CSS module', () => {
    expect(template).toContain('\n  return null;\n}');
    expect(template).not.toContain('return (');
    expect(template).not.toContain('className');
    expect(app.files['src/components/Notify.module.css']).toBeUndefined();
  });

  test('the Error row the cloud call writes is declared', () => {
    expect(template).toContain('const [notifyGuestError, setNotifyGuestError] = useState<string | undefined>();');
  });

  test('the cloud function is exported for it', () => {
    expect(app.files['src/api/functions.ts']).toContain('export async function callNotifyGuest(params: { name?: string })');
  });
});

// ---------------------------------------------------------------------------------------------------
type Listeners = Partial<Record<'done' | 'failure' | 'unchanged' | 'completed' | 'aborted', () => void>>;
type Task = { key: string; id: string; index: number; item: any; succeed: () => void; fail: () => void };
type Handle = { run: (items: unknown) => void; abort: () => void; tasks: ReadonlyArray<Task> };
type Source = { label: string; nodeId: string; componentName: string };
type Lib = { useRunTasks: (source: Source, config?: { maxRunningTasks?: number; stopOnFailure?: boolean }, on?: Listeners) => Handle };
/** EXP-011 §54. What the lib raises on `./errors` — recorded by the loader's stub, one entry per raise. */
type AppError = { code: string; message: string; nodeId: string; nodeType: string; componentName: string; detail?: unknown };
const raised: AppError[] = [];
const BATCH: Source = { label: 'Batch', nodeId: 'batch', componentName: '/Pages/Home' };

interface Harness {
  React: {
    useRef: (v: unknown) => { current: unknown };
    useReducer: (r: (s: any, a: any) => any, init: any) => [any, (a: any) => void];
    useEffect: (fn: () => void | (() => void), deps?: unknown[]) => void;
  };
  render<T>(component: () => T): T;
  dirty(): boolean;
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
      useEffect: (fn, deps) => {
        const i = cursor++;
        pendingEffects.push({ slot: i, fn, deps });
      }
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
    dirty: () => dirty,
    unmount() {
      for (const e of effects) e?.cleanup?.();
    }
  };
  return harness;
}
const loadLib = (): { lib: Lib; harness: Harness } => {
  const harness = makeHarness();
  const js = ts.transpileModule(runTasksLibSource(), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const module = { exports: {} as Lib };
  // eslint-disable-next-line no-new-func
  new Function('require', 'module', 'exports', js)(
    (name: string) => {
      if (name === 'react') return harness.React;
      // EXP-011 §54. The error channel the four diagnostics are raised on: a stub that records every raise.
      if (name === './errors') return { raiseAppError: (error: AppError) => raised.push(error) };
      throw new Error(`unexpected import ${name}`);
    },
    module,
    module.exports
  );
  return { lib: module.exports, harness };
};
/** A host with a recording listener set; `render()` re-renders and reads the tasks as the host component would. */
const host = (config: { maxRunningTasks?: number; stopOnFailure?: boolean } = {}) => {
  const { lib, harness } = loadLib();
  const log: string[] = [];
  const on: Listeners = {};
  for (const name of ['done', 'failure', 'unchanged', 'completed', 'aborted'] as const) on[name] = () => log.push(name);
  const render = () => harness.render(() => lib.useRunTasks(BATCH, config, on));
  const handle = render();
  return { handle, log, render, harness };
};

describe('§E the host library runs the way runtasks.ts does (hook harness under node)', () => {
  beforeEach(() => {
    raised.length = 0;
  });

  test('a run of three with two at a time: two mount, the third when one finishes, Done then Completed at the end', () => {
    const { handle, log, render } = host({ maxRunningTasks: 2 });
    handle.run([{ name: 'Ada' }, { name: 'Grace' }, { name: 'Linus' }]);
    let tasks = render().tasks;
    expect(tasks.map((t) => t.item.name)).toEqual(['Ada', 'Grace']);
    expect(tasks.map((t) => t.index)).toEqual([0, 1]);
    expect(log).toEqual([]);
    tasks[0].succeed();
    tasks = render().tasks;
    expect(tasks.map((t) => t.item.name)).toEqual(['Grace', 'Linus']);
    expect(log).toEqual([]);
    tasks[0].succeed();
    tasks[1].succeed();
    expect(render().tasks).toEqual([]);
    expect(log).toEqual(['done', 'completed']);
  });

  test('keys are unique across a run; the id is the item’s own id, else a generated one (Model.create)', () => {
    const { handle, render } = host();
    handle.run([{ id: 'g1', name: 'Ada' }, { name: 'Grace' }]);
    const tasks = render().tasks;
    expect(tasks[0].id).toBe('g1');
    expect(tasks[1].id).toMatch(/^task-/);
    expect(new Set(tasks.map((t) => t.key)).size).toBe(2);
  });

  test('a Do while a run is in progress is Unchanged (and Completed), and starts nothing', () => {
    const { handle, log, render } = host({ maxRunningTasks: 1 });
    handle.run([{ name: 'Ada' }, { name: 'Grace' }]);
    handle.run([{ name: 'Linus' }]);
    expect(log).toEqual(['unchanged', 'completed']);
    expect(render().tasks.map((t) => t.item.name)).toEqual(['Ada']);
    // EXP-011 §54. Raised on the channel with the runtime's code, message and the node's provenance — exactly one.
    expect(raised).toEqual([{ code: 'run-tasks/already-running', message: 'Do was triggered while a run was still in progress, so it was ignored', nodeId: 'batch', nodeType: 'RunTasks', componentName: '/Pages/Home', detail: undefined }]);
  });

  test('an empty list is a completed run: Done, Completed, nothing mounted', () => {
    const { handle, log, render } = host();
    handle.run([]);
    expect(log).toEqual(['done', 'completed']);
    expect(render().tasks).toEqual([]);
  });

  test('no list is a Failure; null clears; any other falsy value leaves the previous list in place (the items setter)', () => {
    const { handle, log, render } = host();
    handle.run(undefined);
    expect(log).toEqual(['failure', 'completed']);
    expect(raised).toEqual([expect.objectContaining({ code: 'run-tasks/no-items', message: 'No Items list was provided, so there is nothing to run', nodeType: 'RunTasks' })]);
    log.length = 0;
    handle.run([{ name: 'Ada' }]);
    expect(render().tasks).toHaveLength(1);
    render().tasks[0].succeed();
    expect(log).toEqual(['done', 'completed']);
    log.length = 0;
    // undefined abstains: the previous list runs again.
    handle.run(undefined);
    expect(render().tasks.map((t) => t.item.name)).toEqual(['Ada']);
    render().tasks[0].succeed();
    expect(log).toEqual(['done', 'completed']);
    log.length = 0;
    // null clears: nothing to run.
    handle.run(null);
    expect(log).toEqual(['failure', 'completed']);
    expect(render().tasks).toEqual([]);
  });

  test('Max Running Tasks below 1 is a Failure before anything starts', () => {
    const { handle, log, render } = host({ maxRunningTasks: 0 });
    handle.run([{ name: 'Ada' }]);
    expect(log).toEqual(['failure', 'completed']);
    expect(render().tasks).toEqual([]);
    expect(raised).toEqual([expect.objectContaining({ code: 'run-tasks/invalid-concurrency', message: 'Max Running Tasks is 0, so no task could ever start' })]);
  });

  test('a failed task with Stop On Failure: the queue is dropped, Aborted first, then Failure, then Completed', () => {
    const { handle, log, render } = host({ maxRunningTasks: 1, stopOnFailure: true });
    handle.run([{ name: 'Ada' }, { name: 'Grace' }, { name: 'Linus' }]);
    render().tasks[0].fail();
    expect(log).toEqual(['aborted', 'failure', 'completed']);
    expect(render().tasks).toEqual([]);
    expect(raised).toEqual([expect.objectContaining({ code: 'run-tasks/task-failed', message: 'Task 1 of 3 failed', detail: { itemIndex: 0 } })]);
  });

  test('a failed task without Stop On Failure: the run goes on and ends in Failure', () => {
    const { handle, log, render } = host({ maxRunningTasks: 1 });
    handle.run([{ name: 'Ada' }, { name: 'Grace' }]);
    render().tasks[0].fail();
    expect(render().tasks.map((t) => t.item.name)).toEqual(['Grace']);
    render().tasks[0].succeed();
    expect(log).toEqual(['failure', 'completed']);
  });

  test('an Abort while nothing runs is Unchanged (and Completed) — and never Aborted', () => {
    const { handle, log } = host();
    handle.abort();
    expect(log).toEqual(['unchanged', 'completed']);
  });

  test('an Abort with tasks in flight waits for them: then Aborted, Done, and Completed twice (the Do and the Abort)', () => {
    const { handle, log, render } = host({ maxRunningTasks: 1 });
    handle.run([{ name: 'Ada' }, { name: 'Grace' }, { name: 'Linus' }]);
    handle.abort();
    expect(log).toEqual([]);
    expect(render().tasks.map((t) => t.item.name)).toEqual(['Ada']);
    render().tasks[0].succeed();
    // _endRun: the outcome then Completed per token — the run's Do (Done, Completed), then the Abort it honoured (Done, Completed).
    expect(log).toEqual(['aborted', 'done', 'completed', 'done', 'completed']);
    expect(render().tasks).toEqual([]);
    // A second Abort now finds nothing running.
    log.length = 0;
    handle.abort();
    expect(log).toEqual(['unchanged', 'completed']);
  });

  test('an Abort while aborting is Unchanged; a second Do during the wait is Unchanged too', () => {
    const { handle, log, render } = host({ maxRunningTasks: 1 });
    handle.run([{ name: 'Ada' }, { name: 'Grace' }]);
    handle.abort();
    handle.abort();
    expect(log).toEqual(['unchanged', 'completed']);
    handle.run([{ name: 'Linus' }]);
    expect(log).toEqual(['unchanged', 'completed', 'unchanged', 'completed']);
    log.length = 0;
    render().tasks[0].succeed();
    expect(log).toEqual(['aborted', 'done', 'completed', 'done', 'completed']);
  });

  test('a task reporting twice, or after the run ended, is ignored (itemOutputSignalTriggered’s idle guard)', () => {
    const { handle, log, render } = host();
    handle.run([{ name: 'Ada' }]);
    const task = render().tasks[0];
    task.succeed();
    task.succeed();
    task.fail();
    expect(log).toEqual(['done', 'completed']);
    expect(render().tasks).toEqual([]);
  });

  test('the config is read live: a later render’s Stop On Failure decides the next failure', () => {
    const { lib, harness } = loadLib();
    const log: string[] = [];
    let config = { maxRunningTasks: 1, stopOnFailure: false };
    const render = () => harness.render(() => lib.useRunTasks(BATCH, config, { aborted: () => log.push('aborted'), failure: () => log.push('failure') }));
    const handle = render();
    handle.run([{ name: 'Ada' }, { name: 'Grace' }]);
    config = { maxRunningTasks: 1, stopOnFailure: true };
    render().tasks[0].fail();
    expect(log).toEqual(['aborted', 'failure']);
  });

  test('unmount kills the run: the tasks are gone and a late callback or a new Do does nothing', () => {
    const { handle, log, render, harness } = host();
    handle.run([{ name: 'Ada' }]);
    const task = render().tasks[0];
    harness.unmount();
    task.succeed();
    handle.run([{ name: 'Grace' }]);
    expect(log).toEqual([]);
  });

  test('the handle is stable across renders; a change of tasks asks for a re-render', () => {
    const { handle, render, harness } = host();
    const again = render();
    expect(again).toBe(handle);
    const before = harness.renders;
    handle.run([{ name: 'Ada' }]);
    expect(harness.dirty()).toBe(true);
    render();
    expect(harness.renders).toBeGreaterThan(before);
  });
});

// ---------------------------------------------------------------------------------------------------
describe('§F the refused shapes, by mutation — the sentence names the first thing run() would have failed on', () => {
  test('no Template: the runtime’s own no-template failure, named', () => {
    expect(hostSentence((ir) => dropParam(nodeOf(ir, HOME, 'sendAll'), 'taskTemplate'))).toBe(
      'it names no Template component, so every Do answers Failure with "No task template is selected" and never runs a task'
    );
  });

  test('a wired Template', () => {
    expect(
      hostSentence((ir) => {
        componentOf(ir, HOME).nodes.push(logicNode('tplName', 'String', [{ name: 'value', value: { kind: 'literal', value: '/Notify' } }]));
        connect(componentOf(ir, HOME), 'tplName', 'savedValue', 'sendAll', 'taskTemplate', 'value');
      })
    ).toBe('its Template is wired — which component runs per item is not statically knowable');
  });

  test('a Template that is not in the project', () => {
    expect(hostSentence((ir) => setParam(nodeOf(ir, HOME, 'sendAll'), 'taskTemplate', { kind: 'literal', value: '/Gone' }))).toBe(
      'its Template /Gone is not in the project'
    );
  });

  test('a Template with a visual root: the runtime never draws it, and this slice hosts logic-only templates only', () => {
    expect(hostSentence((ir) => componentOf(ir, NOTIFY).nodes.push(logicNode('box', 'Group')))).toBe(
      'its Template /Notify has a visual root — Run Tasks runs a template without drawing it, and this slice hosts logic-only templates only'
    );
  });

  test('a template that runs itself, at any depth', () => {
    expect(
      hostSentence((ir) => {
        componentOf(ir, NOTIFY).nodes.push(logicNode('again', 'RunTasks', [{ name: 'taskTemplate', value: { kind: 'literal', value: '/Notify' } }]));
      })
    ).toBe('its Template /Notify runs a template that leads back to this component — a task that runs itself never finishes');
  });

  test('a wired contract name', () => {
    expect(
      hostSentence((ir) => {
        componentOf(ir, HOME).nodes.push(logicNode('startName', 'String', [{ name: 'value', value: { kind: 'literal', value: 'Go' } }]));
        connect(componentOf(ir, HOME), 'startName', 'savedValue', 'sendAll', 'taskStartInput', 'value');
      })
    ).toBe('its taskStartInput is wired — the template contract is authored, never wired (the port is allowEditOnly)');
  });

  test('a Start Input the template does not declare: the run would hang', () => {
    expect(hostSentence((ir) => setParam(nodeOf(ir, HOME, 'sendAll'), 'taskStartInput', { kind: 'literal', value: 'Go' }))).toBe(
      'its Template /Notify declares no "Go" input on Component Inputs, so no task would ever start — the run hangs'
    );
  });

  test('a start port typed * (the MCP’s spelling): the export cannot tell a pulse from a value, and says what to set', () => {
    expect(
      hostSentence((ir) => {
        const port = nodeOf(ir, NOTIFY, 'inputs').declaredPorts.find((p) => p.name === 'Do')!;
        port.kind = 'value';
        port.type = '*';
      })
    ).toBe(
      'its Template /Notify declares "Do" as untyped (*) rather than signal — set the port type to signal so the export can tell a pulse from a value'
    );
  });

  test('neither Success nor Failure declared: the runtime’s no-completion-output failure, named', () => {
    expect(
      hostSentence((ir) => {
        for (const port of nodeOf(ir, NOTIFY, 'outputs').declaredPorts) port.name = `${port.name}d`;
        for (const c of componentOf(ir, NOTIFY).connections) if (c.toId === 'outputs') c.toProperty = `${c.toProperty}d`;
      })
    ).toBe('its Template /Notify has no "Success" or "Failure" output, so a task can never report completion (the runtime\'s run-tasks/no-completion-output)');
  });

  test('a Success output typed * rather than signal', () => {
    expect(
      hostSentence((ir) => {
        const port = nodeOf(ir, NOTIFY, 'outputs').declaredPorts.find((p) => p.name === 'Success')!;
        port.kind = 'value';
        port.type = '*';
      })
    ).toBe('its Template /Notify declares "Success" as untyped (*) rather than signal — set the port type to signal so the export can tell a pulse from a value');
  });

  test('a start chain that did not translate: the template keeps no file, and the host repeats the reason', () => {
    const ir = cloneIr();
    setParam(nodeOf(ir, NOTIFY, 'notify'), 'function', { kind: 'literal', value: '' });
    const notify = planOf(ir, NOTIFY);
    expect(notify.file).toBeNull();
    expect(notify.task).toBeUndefined();
    expect(notify.taskRefusal).toBe(
      'its "Do" chain did not translate — it names no function, so every Call answers Failure with "No function specified" and never sends a request'
    );
    expect(notify.skipReason).toBe(`no visual root — named as a Run Tasks template, but ${notify.taskRefusal}`);
    expect(refusalOf(ir, HOME, 'sendAll')?.reason).toBe(`its Template /Notify exports no task component — ${notify.taskRefusal}`);
    expect(emitApp(ir, catalog).files[NOTIFY_FILE]).toBeUndefined();
  });

  test('a start input that drives nothing: a task would never report completion', () => {
    const ir = cloneIr();
    disconnect(componentOf(ir, NOTIFY), (c) => c.fromId === 'inputs' && c.fromProperty === 'Do');
    expect(planOf(ir, NOTIFY).taskRefusal).toBe('its "Do" input drives nothing, so a task never reports completion');
    expect(refusalOf(ir, HOME, 'sendAll')?.reason).toContain('exports no task component — its "Do" input drives nothing');
  });

  test('two hosts naming the template with different Start Inputs: one template has one start', () => {
    const ir = cloneIr();
    componentOf(ir, HOME).nodes.push(logicNode('sendSome', 'RunTasks', [
      { name: 'taskTemplate', value: { kind: 'literal', value: '/Notify' } },
      { name: 'taskStartInput', value: { kind: 'literal', value: 'Go' } }
    ]));
    expect(planOf(ir, NOTIFY).taskRefusal).toBe('it is named by Run Tasks nodes with different Start Inputs ("Do", "Go") — one template has one start');
    expect(refusalOf(ir, HOME, 'sendAll')?.reason).toBe(
      'its Template /Notify exports no task component — it is named by Run Tasks nodes with different Start Inputs ("Do", "Go") — one template has one start'
    );
  });

  test('Items unwired: the runtime’s no-items failure, named', () => {
    expect(hostSentence((ir) => disconnect(componentOf(ir, HOME), (c) => c.toId === 'sendAll' && c.toProperty === 'items'))).toBe(
      'nothing is wired into Items, so every Do answers Failure with "No Items list was provided"'
    );
  });

  test('two wires into Items', () => {
    expect(hostSentence((ir) => connect(componentOf(ir, HOME), 'doneStr', 'savedValue', 'sendAll', 'items', 'value'))).toBe(
      'two wires feed Items — last-writer-wins is not statically ordered'
    );
  });

  test('Items fed by a string: not a list', () => {
    expect(
      hostSentence((ir) => {
        disconnect(componentOf(ir, HOME), (c) => c.toId === 'sendAll' && c.toProperty === 'items');
        connect(componentOf(ir, HOME), 'doneStr', 'savedValue', 'sendAll', 'items', 'value');
      })
    ).toBe('its Items input is fed by a source not statically typed as a list (string)');
  });

  test('Max Running Tasks below 1: the runtime’s invalid-concurrency failure, named', () => {
    expect(hostSentence((ir) => setParam(nodeOf(ir, HOME, 'sendAll'), 'maxRunningTasks', { kind: 'literal', value: 0 }))).toBe(
      'Max Running Tasks is 0, so no task could ever start (the runtime\'s run-tasks/invalid-concurrency)'
    );
  });

  test('an output the node does not have', () => {
    expect(hostSentence((ir) => connect(componentOf(ir, HOME), 'sendAll', 'progress', 'setDone', 'do', 'value'))).toBe(
      'its progress output is consumed, and this node publishes only Done, Failure, Unchanged, Completed and Aborted'
    );
  });

  test('an output consumed as a value: a pulse carries nothing to read', () => {
    expect(hostSentence((ir) => connect(componentOf(ir, HOME), 'sendAll', 'done', 'statusText', 'text'))).toBe(
      'its done output is consumed as a value — a pulse carries nothing to read'
    );
  });

  test('a listener chain that does not translate: the chain’s own sentence', () => {
    expect(
      hostSentence((ir) => {
        componentOf(ir, HOME).nodes.push(logicNode('after', 'CloudFunction2'));
        connect(componentOf(ir, HOME), 'sendAll', 'done', 'after', 'call');
      })
    ).toBe('it names no function, so every Call answers Failure with "No function specified" and never sends a request');
  });

  test('only Abort wired: nothing fires its Do', () => {
    expect(hostSentence((ir) => disconnect(componentOf(ir, HOME), (c) => c.toId === 'sendAll' && c.toProperty === 'run'))).toBe(
      'nothing fires its Do, so no run could ever start'
    );
  });

  test('a refused Run Tasks is the root its silenced nodes name, and the template stays a logic-only skip', () => {
    const ir = cloneIr();
    dropParam(nodeOf(ir, HOME, 'sendAll'), 'taskTemplate');
    const report = emitApp(ir, catalog).report;
    const home = report.components.find((c) => c.path === HOME)!;
    for (const id of ['setDone', 'setFailed', 'setStopped', 'toGuests', 'namesConst']) {
      expect(home.refusals?.find((r) => r.nodeId === id)?.causedBy).toEqual(['sendAll']);
    }
    const notify = report.components.find((c) => c.path === NOTIFY)!;
    expect(notify.file).toBeNull();
    expect(notify.skipped?.reason).toBe('no visual root — logic-only components defer to EXP-003');
  });

  test('an unfired Run Tasks with a chain is named by the verdict sweep, as a Cloud Function nothing calls is', () => {
    const ir = cloneIr();
    disconnect(componentOf(ir, HOME), (c) => c.toId === 'sendAll' && (c.toProperty === 'run' || c.toProperty === 'abort'));
    expect(refusalOf(ir, HOME, 'sendAll')?.reason).toBe('its done chain hangs off a node nothing fires');
    // And it is NOT hosted: no hook, no library, no template file — nothing reached the rule.
    const built = emitApp(ir, catalog);
    expect(built.files[HOME_FILE]).not.toContain('useRunTasks(');
    expect(built.files[RUN_TASKS_LIB_PATH]).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------------------------------
describe('§G the report and the pre-flight', () => {
  test('the clean fixture: nothing left out, no cascade, no verdict', () => {
    const pre = summarizePreflight(app);
    expect(pre.cascade.unsilenced).toBe(0);
    expect(pre.cascade.silenced).toBe(0);
    expect(pre.verdict).toBeNull();
    expect(app.files['EXPORT-REPORT.md']).not.toContain('Run Tasks');
  });

  test('the refused shape: the root named with its sentence, its silenced nodes counted, the verdict about the skipped template', () => {
    const ir = cloneIr();
    dropParam(nodeOf(ir, HOME, 'sendAll'), 'taskTemplate');
    const built = emitApp(ir, catalog);
    const pre = summarizePreflight(built);
    // Two roots across the project: the Run Tasks, and the now-skipped template's Component Inputs (its three nodes hang off it).
    expect(pre.cascade.unsilenced).toBe(2);
    expect(pre.cascade.silenced).toBe(11);
    expect(pre.cascade.roots.map((r) => r.node.nodeId).sort()).toEqual(['inputs', 'sendAll']);
    expect(pre.cascade.roots.find((r) => r.node.nodeId === 'sendAll')!.node).toMatchObject({ type: 'RunTasks', displayName: 'Run Tasks', label: 'Send all' });
    expect(pre.cascade.roots.find((r) => r.node.nodeId === 'sendAll')!.silences).toHaveLength(8);
    // The verdict is about the skipped template: its Cloud Function is a pathway, and nothing runs it now.
    expect(pre.verdict).toContain('"Notify guest" (Cloud Function) never runs');
    expect(built.files['EXPORT-REPORT.md']).toContain(
      '- "Send all" (Run Tasks) — it names no Template component, so every Do answers Failure with "No task template is selected" and never runs a task'
    );
  });
});

describe('§H the ledger', () => {
  test('RunTasks is translated, carries no badge, and the floor is 96 (since §54)', () => {
    expect(ledgerEntryOf('RunTasks')?.status).toBe('translated');
    expect(exportBadgeOf('RunTasks')).toBeUndefined();
    const ledger = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'coverage-ledger.json'), 'utf8'));
    expect(ledger.pickerCoverageFloor).toBe(96);
  });
});

describe('§I every variant typechecks as a real ts.Program', () => {
  test('the fixture app', () => {
    expect(typecheckEmittedApp(app)).toEqual([]);
  });

  test('a template with Id and id inputs, fed the task’s id; a wired Max Running Tasks', () => {
    const ir = cloneIr();
    const inputs = nodeOf(ir, NOTIFY, 'inputs');
    inputs.declaredPorts.push({ name: 'Id', plug: 'output', kind: 'value', type: 'string' }, { name: 'id', plug: 'output', kind: 'value', type: 'string' });
    componentOf(ir, HOME).nodes.push(logicNode('maxConst', 'Number', [{ name: 'value', value: { kind: 'literal', value: 3 } }]));
    connect(componentOf(ir, HOME), 'maxConst', 'savedValue', 'sendAll', 'maxRunningTasks', 'value');
    const built = emitApp(ir, catalog);
    const page = built.files[HOME_FILE];
    expect(page).toContain('Id={task.id}');
    expect(page).toContain('id={task.id}');
    expect(page).toContain('{ maxRunningTasks: 3, stopOnFailure: true }');
    expect(planOf(ir, HOME).runTasks[0].idInputs).toEqual(['Id', 'id']);
    expect(typecheckEmittedApp(built)).toEqual([]);
  });

  test('the refused shape (no template) still typechecks: the buttons are handler-less, the template is absent', () => {
    const ir = cloneIr();
    dropParam(nodeOf(ir, HOME, 'sendAll'), 'taskTemplate');
    const built = emitApp(ir, catalog);
    expect(built.files[NOTIFY_FILE]).toBeUndefined();
    expect(built.files[RUN_TASKS_LIB_PATH]).toBeUndefined();
    expect(typecheckEmittedApp(built)).toEqual([]);
  });
});

describe('§J the controls — fixtures with no Run Tasks ship no host, and a logic-only component nobody names stays skipped', () => {
  test('script-desk and slot-desk emit no runTasks.ts and no template file', () => {
    for (const fixture of ['script-desk', 'slot-desk']) {
      const built = emitApp(parseProject(path.join(__dirname, 'fixtures', fixture), catalog), catalog);
      expect(built.files[RUN_TASKS_LIB_PATH]).toBeUndefined();
      expect(Object.keys(built.files).some((f) => f.includes('runTasks'))).toBe(false);
    }
  });

  test('task-desk: the Run Tasks with no template is refused by name, and the cascade is unchanged (1 + 5)', () => {
    const built = emitApp(parseProject(path.join(__dirname, 'fixtures', 'task-desk'), catalog), catalog);
    const pre = summarizePreflight(built);
    expect(pre.cascade.unsilenced).toBe(1);
    expect(pre.cascade.silenced).toBe(5);
    expect(built.files[RUN_TASKS_LIB_PATH]).toBeUndefined();
  });

  test('a logic-only component no Run Tasks names is skipped exactly as before', () => {
    const ir = cloneIr();
    dropParam(nodeOf(ir, HOME, 'sendAll'), 'taskTemplate');
    const notify = planOf(ir, NOTIFY);
    expect(notify.file).toBeNull();
    expect(notify.task).toBeUndefined();
    expect(notify.skipReason).toBe('no visual root — logic-only components defer to EXP-003');
    expect(notify.dispositions.notify).toEqual({ kind: 'deferred', to: 'EXP-003', reason: 'logic node (CloudFunction2)' });
  });
});
