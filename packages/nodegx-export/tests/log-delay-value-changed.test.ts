import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

import { Catalog, loadCatalog } from '../src/catalog';
import { emitApp } from '../src/emit/emitApp';
import { parseProject } from '../src/parse/parseProject';
import { utilLibSource } from '../src/emit/utilLib';
import { timerLibSource } from '../src/emit/timerLib';
import { typecheckEmittedApp } from './helpers/typecheckApp';
import { ExportIR, ComponentIR, ConnectionIR, NodeIR, ParamValue } from '../src/ir/types';

/**
 * EXP-011 §39 — the three small non-pure nodes: `Log` (an action), `Delay` (a timer with state)
 * and `Value Changed` (an effect).
 *
 * §A grades the two emitted helpers against the interpreter's own code, loaded from source:
 * `log()` against `log.ts`'s `_write` with the console captured, and the timer verbs against
 * `timerscheduler.ts` driven frame by frame at the same instants. Both comparisons are proved able
 * to fail by a deliberately broken copy (`date-family.test.ts`'s rule).
 *
 * §B grades the translation — graphs in, emitted code out — with every deferral asserted **by its
 * named reason**, and one row for the order-dependence the fixture found: a chain wire listed
 * before the wire that fires its node must not be reported dropped.
 *
 * §C is the picker-exercising project `tests/fixtures/tick-desk` (AC3), typechecked whole. It was
 * also built and driven headlessly — EXP-011 §39.5 has the readings.
 */

const FIXTURE = path.join(__dirname, 'fixtures', 'cheer');
const TICK_DESK = path.join(__dirname, 'fixtures', 'tick-desk');
const RUNTIME_SRC = path.join(__dirname, '..', '..', 'noodl-runtime', 'src');

const catalog: Catalog = loadCatalog();
const baseIr = parseProject(FIXTURE, catalog);

// ---- §A the emitted modules, against the interpreter they have to agree with ----------------

const loadModule = (source: string, require: (id: string) => unknown = () => ({})): Record<string, unknown> => {
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  }).outputText;
  const exported: Record<string, unknown> = {};
  const module = { exports: exported };
  // eslint-disable-next-line no-new-func
  new Function('exports', 'module', 'require', js)(exported, module, require);
  return module.exports;
};

type Level = 'debug' | 'info' | 'warn' | 'error';
interface UtilLib {
  log(level: Level, message: unknown, data?: unknown): void;
}
const loadUtilLib = (source = utilLibSource()): UtilLib => loadModule(source) as unknown as UtilLib;

/**
 * The interpreter's `Log` node, transpiled from `noodl-runtime/src`. `export =` becomes
 * `module.exports`; the one runtime import (`outcomeOutputs`) is stubbed — it only shapes the
 * outputs table, which `_write` never reads.
 */
interface LogNodeModule {
  node: {
    initialize(this: unknown): void;
    methods: { _write(this: unknown, token?: unknown): void };
  };
}
const runtimeLog = loadModule(fs.readFileSync(path.join(RUNTIME_SRC, 'nodes', 'std-library', 'log.ts'), 'utf8'), (id) =>
  id.includes('outcome') ? { outcomeOutputs: () => ({}) } : {}
) as unknown as LogNodeModule;

type Captured = Array<[string, unknown[]]>;
/** Runs `fn` with the four console methods (and `log`) capturing, then puts them back. */
const captureConsole = (fn: () => void): Captured => {
  const captured: Captured = [];
  const names: Array<keyof Console> = ['debug', 'info', 'warn', 'error', 'log'];
  const real = names.map((n) => console[n]);
  for (const n of names) (console as unknown as Record<string, unknown>)[n] = (...args: unknown[]) => captured.push([n, args]);
  try {
    fn();
  } finally {
    names.forEach((n, i) => ((console as unknown as Record<string, unknown>)[n] = real[i]));
  }
  return captured;
};

/** The node's `_write`, called on a bag shaped like a node instance with no sink attached. */
const interpreterWrite = (level: unknown, message: unknown, data: unknown): Captured =>
  captureConsole(() => {
    const instance = {
      id: 'n1',
      _internal: { level, message, data },
      nodeScope: undefined,
      reportOutcome: () => undefined
    };
    runtimeLog.node.methods._write.call(instance);
  });

describe('EXP-011 §39 §A — log(), against log.ts', () => {
  const lib = loadUtilLib();
  const levels: Level[] = ['debug', 'info', 'warn', 'error'];
  const messages: unknown[] = [undefined, null, '', 'hello', 42, false, { a: 1 }, ['x']];
  const datas: unknown[] = [undefined, null, { k: 1 }, 'text', 0, []];

  it('prints the same method with the same arguments for every level × message × data', () => {
    let rows = 0;
    for (const level of levels) {
      for (const message of messages) {
        for (const data of datas) {
          const mine = captureConsole(() => lib.log(level, message, data));
          const theirs = interpreterWrite(level, message, data);
          expect(mine).toStrictEqual(theirs);
          rows++;
        }
      }
    }
    expect(rows).toBe(levels.length * messages.length * datas.length);
  });

  it('an absent message prints the empty string, and absent data prints no second argument', () => {
    expect(captureConsole(() => lib.log('info', undefined))).toEqual([['info', ['']]]);
    expect(captureConsole(() => lib.log('warn', 'x', null))).toEqual([['warn', ['x']]]);
    expect(captureConsole(() => lib.log('error', 'x', { k: 1 }))).toEqual([['error', ['x', { k: 1 }]]]);
  });

  /** 🔴 The control: a copy that always passes `data` must disagree with the interpreter. */
  it('a broken copy of the emitted helper disagrees, so the comparison can fail', () => {
    const broken = loadUtilLib(
      utilLibSource().replace('  if (data !== undefined && data !== null) write.call(console, text, data);\n  else write.call(console, text);', '  write.call(console, text, data);')
    );
    // ⚠️ `toStrictEqual`: `toEqual` reads `['x', undefined]` as `['x']`, which is the very difference this row is about.
    expect(captureConsole(() => broken.log('info', 'x'))).not.toStrictEqual(interpreterWrite('info', 'x', undefined));
  });
});

// The timer: the emitted verbs under fake timers, against the scheduler driven at the same instants.

interface TimerLib {
  startDelay(ref: { current: unknown }, startDelay: unknown, duration: unknown, onStart?: () => void, onFinish?: () => void): boolean;
  restartDelay(ref: { current: unknown }, startDelay: unknown, duration: unknown, onStart?: () => void, onFinish?: () => void): void;
  stopDelay(ref: { current: unknown }): boolean;
}
const loadTimerLib = (source = timerLibSource()): TimerLib => loadModule(source) as unknown as TimerLib;

interface SchedulerTimer {
  start(): void;
  stop(): void;
  _isRunning: boolean;
}
interface Scheduler {
  createTimer(args: { duration: number; delay: number; onStart(): void; onFinish(): void }): SchedulerTimer;
  runTimers(t: number): void;
}
const SchedulerCtor = loadModule(fs.readFileSync(path.join(RUNTIME_SRC, 'timerscheduler.ts'), 'utf8')) as unknown as new (
  requestFrame: () => void
) => Scheduler;

type Event = [string, number];
/** A script: the instants at which a frame runs, and the verb (if any) to apply at each. */
type Script = Array<{ at: number; verb?: 'start' | 'restart' | 'stop' }>;

/** The interpreter's answer: `timer.ts`'s verbs over the scheduler, frames at the script's instants. */
const interpreterEvents = (startDelay: number, duration: number, script: Script): Event[] => {
  const events: Event[] = [];
  let now = 0;
  const scheduler = new SchedulerCtor(() => undefined);
  const timer = scheduler.createTimer({
    duration,
    delay: startDelay,
    onStart: () => events.push(['started', now]),
    onFinish: () => events.push(['finished', now])
  });
  for (const step of script) {
    now = step.at;
    // timer.ts: Start only when `_isRunning === false`; Restart always; Stop always.
    if (step.verb === 'start' && timer._isRunning === false) timer.start();
    if (step.verb === 'restart') timer.start();
    if (step.verb === 'stop') timer.stop();
    scheduler.runTimers(now);
  }
  return events;
};

/** The emitted helpers' answer, under fake timers advanced to the same instants. */
const emittedEvents = (lib: TimerLib, startDelay: number, duration: number, script: Script): Event[] => {
  const events: Event[] = [];
  const ref = { current: null as unknown };
  let last = 0;
  for (const step of script) {
    jest.advanceTimersByTime(step.at - last);
    last = step.at;
    const onStart = () => events.push(['started', Date.now()]);
    const onFinish = () => events.push(['finished', Date.now()]);
    if (step.verb === 'start') lib.startDelay(ref, startDelay, duration, onStart, onFinish);
    if (step.verb === 'restart') lib.restartDelay(ref, startDelay, duration, onStart, onFinish);
    if (step.verb === 'stop') lib.stopDelay(ref);
  }
  return events;
};

describe('EXP-011 §39 §A — the timer verbs, against timerscheduler.ts', () => {
  const lib = loadTimerLib();
  beforeEach(() => jest.useFakeTimers({ now: 0 }));
  afterEach(() => jest.useRealTimers());

  const frames = (verbs: Record<number, 'start' | 'restart' | 'stop'>, until = 2000, step = 50): Script =>
    Array.from({ length: until / step + 1 }, (_, i) => ({ at: i * step, ...(verbs[i * step] ? { verb: verbs[i * step] } : {}) }));

  const cases: Array<[string, number, number, Script]> = [
    ['start, run to the end', 100, 400, frames({ 0: 'start' })],
    ['start twice — the second is ignored while one runs', 100, 400, frames({ 0: 'start', 200: 'start' })],
    ['stop mid-run — Finished never fires', 100, 400, frames({ 0: 'start', 300: 'stop' })],
    ['stop after the finish — nothing to stop', 100, 400, frames({ 0: 'start', 700: 'stop' })],
    ['restart mid-run — the old Finished is suppressed', 100, 400, frames({ 0: 'start', 300: 'restart' })],
    ['restart from idle', 100, 400, frames({ 200: 'restart' })],
    ['start after a finished run begins again', 100, 400, frames({ 0: 'start', 800: 'start' })],
    ['no start delay', 0, 300, frames({ 50: 'start' })]
  ];
  for (const [name, startDelay, duration, script] of cases) {
    it(`${name}: same events at the same instants`, () => {
      const theirs = interpreterEvents(startDelay, duration, script);
      const mine = emittedEvents(lib, startDelay, duration, script);
      expect(mine).toEqual(theirs);
      expect(theirs.length).toBeGreaterThan(0);
    });
  }

  it('answers Done/Unchanged as the node does: start twice, stop twice', () => {
    const ref = { current: null as unknown };
    expect(lib.startDelay(ref, 100, 400)).toBe(true);
    expect(lib.startDelay(ref, 100, 400)).toBe(false);
    expect(lib.stopDelay(ref)).toBe(true);
    expect(lib.stopDelay(ref)).toBe(false);
    jest.advanceTimersByTime(1000);
    expect(ref.current).toBeNull();
  });

  it('a zero-length countdown fires Started then Finished, in order and asynchronously', () => {
    const ref = { current: null as unknown };
    const events: string[] = [];
    lib.startDelay(ref, 0, 0, () => events.push('started'), () => events.push('finished'));
    expect(events).toEqual([]);
    jest.advanceTimersByTime(0);
    // Started on the first tick; Finished on the next — the scheduler's own shape, where a timer
    // queued in one frame starts in it and finishes in the frame after.
    expect(events).toEqual(['started']);
    jest.runOnlyPendingTimers();
    expect(events).toEqual(['started', 'finished']);
    expect(ref.current).toBeNull();
  });

  it('coerces what arrived as the scheduler does — strings count, negatives are zero', () => {
    const ref = { current: null as unknown };
    const events: Event[] = [];
    lib.startDelay(ref, '250', -5, () => events.push(['started', Date.now()]), () => events.push(['finished', Date.now()]));
    jest.advanceTimersByTime(249);
    expect(events).toEqual([]);
    jest.advanceTimersByTime(1);
    expect(events).toEqual([['started', 250]]);
    jest.runOnlyPendingTimers();
    // A zero-length finish is the next task after Started — the scheduler's next frame — and its
    // exact instant is the fake clock's business, not this contract's.
    expect(events.map(([name]) => name)).toEqual(['started', 'finished']);
    expect(events[1][1]).toBeGreaterThanOrEqual(250);
  });

  /**
   * 🔴 The control: a copy whose Start ignores a running countdown must disagree — a second Start
   * then begins a second countdown, and the extra Started/Finished pair is the disagreement.
   *
   * ⚠️ Removing `clearTimeout` from Stop was the first mutation tried, and it SURVIVES: the
   * finish callback's `ref.current !== handle` guard makes the cleared timeout a no-op anyway.
   * A survivor that is a deliberate redundancy, not a hole — recorded here so nobody retries it.
   */
  it('a broken copy of the emitted module disagrees, so the comparison can fail', () => {
    const broken = loadTimerLib(timerLibSource().replace('  if (ref.current !== null) return false;\n', ''));
    const script = frames({ 0: 'start', 200: 'start' });
    expect(emittedEvents(broken, 100, 400, script)).not.toEqual(interpreterEvents(100, 400, script));
  });
});

// ---- §B the translation ---------------------------------------------------------------------

const literal = (value: string | number | boolean): ParamValue => ({ kind: 'literal', value });

const connect = (
  component: ComponentIR,
  from: string,
  fromProperty: string,
  to: string,
  toProperty: string,
  kind: ConnectionIR['kind'] = 'value'
) => {
  component.connections.push({
    key: `${from}:${fromProperty}->${to}:${toProperty}`,
    fromId: from,
    fromProperty,
    toId: to,
    toProperty,
    kind
  });
};

const addNode = (component: ComponentIR, node: Partial<NodeIR> & { id: string; type: string }): NodeIR => {
  const full: NodeIR = {
    catalogRef: node.type,
    parameters: [],
    declaredPorts: [],
    portKnowledge: 'complete',
    ...node
  } as NodeIR;
  component.nodes.push(full);
  return full;
};

const emit = (ir: ExportIR) => emitApp(ir, catalog);
const notesOf = (ir: ExportIR) => ir.components.find((c) => c.path === 'Pages/Notes')!;
const notesFile = (app: ReturnType<typeof emitApp>) =>
  app.files[Object.keys(app.files).find((k) => k.endsWith('Notes.tsx'))!];

const expectParses = (app: ReturnType<typeof emitApp>) => {
  for (const [file, source] of Object.entries(app.files)) {
    if (!file.endsWith('.ts') && !file.endsWith('.tsx')) continue;
    const sf = ts.createSourceFile(file, source, ts.ScriptTarget.ESNext, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const diagnostics = (sf as unknown as { parseDiagnostics: ts.Diagnostic[] }).parseDiagnostics ?? [];
    expect(diagnostics.map((d) => `${file}: ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`).join('\n')).toBe('');
  }
};

const withGraph = (build: (ir: ExportIR, notes: ComponentIR) => void): { ir: ExportIR; app: ReturnType<typeof emitApp> } => {
  const ir: ExportIR = JSON.parse(JSON.stringify(baseIr));
  const notes = notesOf(ir);
  build(ir, notes);
  return { ir, app: emit(ir) };
};

/** The `deferred:` note for one node, or every note joined so a failing row shows what was said. */
const deferralFor = (app: ReturnType<typeof emitApp>, nodeId: string): string =>
  app.notes.find((n) => n.includes(`node ${nodeId}`) && n.includes('deferred')) ?? app.notes.join('\n');

/**
 * A second rendered button, so a handler can hold ONE action. The page's Add button already
 * carries the note-adding chain, and two actions take the block form whatever the second is.
 * ⚠️ In the render tree by its parent's `children`, not just by `parent` (s66's trap).
 */
const addLoneButton = (notes: ComponentIR, id: string, label: string) => {
  addNode(notes, { id, type: 'net.noodl.controls.button', parent: 'notesShell', parameters: [{ name: 'label', value: literal(label) }] } as never);
  const shell = notes.nodes.find((n) => n.id === 'notesShell') as NodeIR & { children?: string[] };
  shell.children = [...(shell.children ?? []), id];
};

/** A `Set Variable` the chains can fire, fed from the page's draft variable. */
const addSetter = (notes: ComponentIR, id: string, variable: string) => {
  addNode(notes, { id, type: 'Set Variable', parameters: [{ name: 'name', value: literal(variable) }] });
  connect(notes, 'noteDraftVar', 'value', id, 'value');
};

describe('EXP-011 §39 §B — Log', () => {
  it('a button that logs a literal is one call, imported from src/lib/util.ts', () => {
    const { app } = withGraph((_ir, notes) => {
      addNode(notes, {
        id: 'pressLog',
        type: 'net.noodl.Log',
        parameters: [{ name: 'message', value: literal('Pressed') }, { name: 'level', value: literal('warn') }]
      });
      connect(notes, 'addButton', 'onClick', 'pressLog', 'log', 'signal');
    });
    expectParses(app);
    const page = notesFile(app);
    expect(page).toContain("log('warn', 'Pressed')");
    expect(page).toContain("import { log } from '../lib/util';");
    expect(app.files['src/lib/util.ts']).toContain('export function log(');
    expect(deferralFor(app, 'pressLog')).not.toContain('deferred');
    expect(typecheckEmittedApp(app)).toEqual([]);
  });

  it('an unset or cleared Level is info, as the setter falls back', () => {
    for (const parameters of [[], [{ name: 'level', value: literal('') }], [{ name: 'level', value: literal('shout') }]]) {
      const { app } = withGraph((_ir, notes) => {
        addNode(notes, { id: 'pressLog', type: 'net.noodl.Log', parameters: [{ name: 'message', value: literal('x') }, ...parameters] });
        connect(notes, 'addButton', 'onClick', 'pressLog', 'log', 'signal');
      });
      expect(notesFile(app)).toContain("log('info', 'x')");
    }
  });

  it('a wired message and data print as arguments; an unset message is undefined; unset data is absent', () => {
    const { app } = withGraph((_ir, notes) => {
      addNode(notes, { id: 'pressLog', type: 'net.noodl.Log' });
      connect(notes, 'addButton', 'onClick', 'pressLog', 'log', 'signal');
      connect(notes, 'noteDraftVar', 'value', 'pressLog', 'data');
    });
    expect(notesFile(app)).toContain("log('info', undefined, noteDraft.get())");
    const wired = withGraph((_ir, notes) => {
      addNode(notes, { id: 'pressLog', type: 'net.noodl.Log' });
      connect(notes, 'addButton', 'onClick', 'pressLog', 'log', 'signal');
      connect(notes, 'noteDraftVar', 'value', 'pressLog', 'message');
    }).app;
    expect(notesFile(wired)).toContain("log('info', noteDraft.get())");
    expect(notesFile(wired)).not.toContain('undefined)');
  });

  it('the Done chain is following statements, and the call is the expression body when alone', () => {
    const { app } = withGraph((_ir, notes) => {
      addNode(notes, { id: 'pressLog', type: 'net.noodl.Log', parameters: [{ name: 'message', value: literal('x') }] });
      connect(notes, 'addButton', 'onClick', 'pressLog', 'log', 'signal');
      addSetter(notes, 'afterLog', 'logged');
      connect(notes, 'pressLog', 'done', 'afterLog', 'do', 'signal');
    });
    const page = notesFile(app);
    expect(page).toContain("log('info', 'x');");
    expect(page).toContain('logged.set(noteDraft.get())');
    expect(page.indexOf("log('info', 'x')")).toBeLessThan(page.indexOf('logged.set('));
    const alone = withGraph((_ir, notes) => {
      addLoneButton(notes, 'logButton', 'Log it');
      addNode(notes, { id: 'pressLog', type: 'net.noodl.Log', parameters: [{ name: 'message', value: literal('x') }] });
      connect(notes, 'logButton', 'onClick', 'pressLog', 'log', 'signal');
    }).app;
    expect(notesFile(alone)).toContain("onClick={() => log('info', 'x')}");
  });

  it('Value passes straight through — a Text reading it reads what feeds the input', () => {
    const { app } = withGraph((_ir, notes) => {
      addNode(notes, { id: 'echo', type: 'net.noodl.Log', parameters: [{ name: 'message', value: literal('x') }] });
      connect(notes, 'noteDraftVar', 'value', 'echo', 'value');
      connect(notes, 'echo', 'value', 'notesHeading', 'text');
    });
    expect(notesFile(app)).toContain('>{draft}</p>');
    expect(deferralFor(app, 'echo')).not.toContain('deferred');
    expect(app.notes.join('\n')).not.toContain('echo:value');
  });

  it('defers a wired Level, a consumed Completed and any other output, each by name', () => {
    const level = withGraph((_ir, notes) => {
      addNode(notes, { id: 'pressLog', type: 'net.noodl.Log' });
      connect(notes, 'addButton', 'onClick', 'pressLog', 'log', 'signal');
      connect(notes, 'noteDraftVar', 'value', 'pressLog', 'level');
    }).app;
    expect(deferralFor(level, 'pressLog')).toContain('its Level is wired');
    const completed = withGraph((_ir, notes) => {
      addNode(notes, { id: 'pressLog', type: 'net.noodl.Log' });
      connect(notes, 'addButton', 'onClick', 'pressLog', 'log', 'signal');
      addSetter(notes, 'afterLog', 'logged');
      connect(notes, 'pressLog', 'completed', 'afterLog', 'do', 'signal');
    }).app;
    expect(deferralFor(completed, 'pressLog')).toContain('wire the chain to Done instead');
    const stray = withGraph((_ir, notes) => {
      addNode(notes, { id: 'pressLog', type: 'net.noodl.Log' });
      connect(notes, 'addButton', 'onClick', 'pressLog', 'log', 'signal');
      addSetter(notes, 'afterLog', 'logged');
      connect(notes, 'pressLog', 'failure', 'afterLog', 'do', 'signal');
    }).app;
    expect(deferralFor(stray, 'pressLog')).toContain('publishes only Done, Completed and Value');
  });

  it('a Log nothing fires is named as such, not as a translated node', () => {
    const { app } = withGraph((_ir, notes) => {
      addNode(notes, { id: 'idleLog', type: 'net.noodl.Log', parameters: [{ name: 'message', value: literal('x') }] });
    });
    expect(deferralFor(app, 'idleLog')).toContain('its Log is never fired');
    expect(notesFile(app)).not.toContain('log(');
    expect(app.files['src/lib/util.ts']).toBeUndefined();
  });
});

describe('EXP-011 §39 §B — Delay', () => {
  /** A Delay started by the Add button, with Started and Finished chains. */
  const delayGraph = (notes: ComponentIR, verbs: Array<'start' | 'restart' | 'stop'> = ['start']) => {
    addNode(notes, {
      id: 'poll',
      type: 'Timer',
      authoredLabel: 'Poll',
      parameters: [{ name: 'startDelay', value: literal(100) }, { name: 'duration', value: literal(400) }]
    });
    for (const verb of verbs) connect(notes, 'addButton', 'onClick', 'poll', verb, 'signal');
    addSetter(notes, 'onStarted', 'pollStarted');
    connect(notes, 'poll', 'timerStarted', 'onStarted', 'do', 'signal');
    addSetter(notes, 'onFinished', 'pollFinished');
    connect(notes, 'poll', 'timerFinished', 'onFinished', 'do', 'signal');
  };

  it('Start is startDelay over a useRef, with the two chains as callbacks and an unmount cleanup', () => {
    const { app } = withGraph((_ir, notes) => delayGraph(notes));
    expectParses(app);
    const page = notesFile(app);
    expect(page).toContain('const pollTimer = useRef<DelayHandle | null>(null);');
    expect(page).toContain("startDelay(pollTimer, 100, 400, () => pollStarted.set(noteDraft.get()), () => pollFinished.set(noteDraft.get()))");
    expect(page).toContain("import { startDelay, stopDelay, type DelayHandle } from '../lib/timer';");
    expect(page).toContain("import { useEffect, useRef } from 'react';");
    expect(page).toContain('useEffect(() => () => {\n    stopDelay(pollTimer);\n  }, []);');
    expect(app.files['src/lib/timer.ts']).toContain('export function startDelay(');
    expect(deferralFor(app, 'poll')).not.toContain('deferred');
    expect(typecheckEmittedApp(app)).toEqual([]);
  });

  it('a Start with no outcome chains is the bare call as the expression body', () => {
    const { app } = withGraph((_ir, notes) => {
      addLoneButton(notes, 'startButton', 'Start');
      addNode(notes, { id: 'poll', type: 'Timer', authoredLabel: 'Poll' });
      connect(notes, 'startButton', 'onClick', 'poll', 'start', 'signal');
    });
    expect(notesFile(app)).toContain('onClick={() => startDelay(pollTimer, 0, 0)}');
    expect(notesFile(app)).toContain("import { startDelay, stopDelay, type DelayHandle } from '../lib/timer';");
  });

  it('Done and Unchanged are the two arms of an if over the answer; Unchanged alone inverts the test', () => {
    const both = withGraph((_ir, notes) => {
      delayGraph(notes);
      addSetter(notes, 'onDone', 'pollDone');
      connect(notes, 'poll', 'done', 'onDone', 'do', 'signal');
      addSetter(notes, 'onUnchanged', 'pollUnchanged');
      connect(notes, 'poll', 'unchanged', 'onUnchanged', 'do', 'signal');
    }).app;
    const page = notesFile(both);
    expect(page).toContain('if (startDelay(pollTimer, 100, 400,');
    expect(page).toContain('pollDone.set(noteDraft.get());\n          } else {\n            pollUnchanged.set(noteDraft.get());');
    const unchangedOnly = withGraph((_ir, notes) => {
      delayGraph(notes);
      addSetter(notes, 'onUnchanged', 'pollUnchanged');
      connect(notes, 'poll', 'unchanged', 'onUnchanged', 'do', 'signal');
    }).app;
    expect(notesFile(unchangedOnly)).toContain('if (!startDelay(pollTimer, 100, 400,');
    expect(notesFile(unchangedOnly)).not.toContain('} else {');
  });

  it('Stop passes no callbacks and branches on its own answer; Restart never branches and drops its Unchanged with a note', () => {
    const stop = withGraph((_ir, notes) => {
      delayGraph(notes, ['start', 'stop']);
      addSetter(notes, 'onDone', 'pollDone');
      connect(notes, 'poll', 'done', 'onDone', 'do', 'signal');
    }).app;
    const page = notesFile(stop);
    expect(page).toContain('if (stopDelay(pollTimer)) {');
    expect(page).toContain("import { startDelay, stopDelay, type DelayHandle } from '../lib/timer';");
    const restart = withGraph((_ir, notes) => {
      delayGraph(notes, ['restart']);
      addSetter(notes, 'onDone', 'pollDone');
      connect(notes, 'poll', 'done', 'onDone', 'do', 'signal');
      addSetter(notes, 'onUnchanged', 'pollUnchanged');
      connect(notes, 'poll', 'unchanged', 'onUnchanged', 'do', 'signal');
    }).app;
    const restartPage = notesFile(restart);
    expect(restartPage).toContain('restartDelay(pollTimer, 100, 400,');
    expect(restartPage).toContain('pollDone.set(noteDraft.get())');
    expect(restartPage).not.toContain('pollUnchanged');
    expect(restartPage).not.toContain('if (restartDelay');
    expect(restart.notes.join('\n')).toContain('never reports Unchanged');
    expect(typecheckEmittedApp(restart)).toEqual([]);
  });

  it('wired Start Delay and Duration are read at the call', () => {
    const { app } = withGraph((_ir, notes) => {
      addNode(notes, { id: 'poll', type: 'Timer', authoredLabel: 'Poll' });
      connect(notes, 'addButton', 'onClick', 'poll', 'start', 'signal');
      connect(notes, 'noteDraftVar', 'value', 'poll', 'duration');
    });
    expect(notesFile(app)).toContain('startDelay(pollTimer, 0, noteDraft.get())');
  });

  it('defers a consumed Completed and an unknown output by name, and names a timer nothing drives', () => {
    const completed = withGraph((_ir, notes) => {
      delayGraph(notes);
      addSetter(notes, 'after', 'pollDone');
      connect(notes, 'poll', 'completed', 'after', 'do', 'signal');
    }).app;
    expect(deferralFor(completed, 'poll')).toContain('fires after every outcome');
    const stray = withGraph((_ir, notes) => {
      delayGraph(notes);
      addSetter(notes, 'after', 'pollDone');
      connect(notes, 'poll', 'failure', 'after', 'do', 'signal');
    }).app;
    expect(deferralFor(stray, 'poll')).toContain('publishes only Started, Finished, Done, Unchanged and Completed');
    const idle = withGraph((_ir, notes) => {
      addNode(notes, { id: 'poll', type: 'Timer' });
      addSetter(notes, 'onStarted', 'pollStarted');
      connect(notes, 'poll', 'timerStarted', 'onStarted', 'do', 'signal');
    }).app;
    expect(deferralFor(idle, 'poll')).toContain('hangs off a node nothing fires');
    expect(notesFile(idle)).not.toContain('useRef');
    expect(idle.files['src/lib/timer.ts']).toBeUndefined();
  });

  /**
   * 🔴 The row the fixture found. The attach pass walks wires in file order, and a chain wire
   * listed *before* the wire that fires its node was reported dropped and then emitted anyway —
   * a false note about working code. The skip that fixes it is the popup done-chain's.
   */
  it('a chain wire listed before its trigger wire is not reported dropped', () => {
    const { app } = withGraph((_ir, notes) => {
      addNode(notes, { id: 'poll', type: 'Timer', authoredLabel: 'Poll' });
      addSetter(notes, 'onStarted', 'pollStarted');
      connect(notes, 'poll', 'timerStarted', 'onStarted', 'do', 'signal');
      addNode(notes, { id: 'pressLog', type: 'net.noodl.Log', parameters: [{ name: 'message', value: literal('x') }] });
      addSetter(notes, 'afterLog', 'logged');
      connect(notes, 'pressLog', 'done', 'afterLog', 'do', 'signal');
      // The trigger wires last.
      connect(notes, 'addButton', 'onClick', 'poll', 'start', 'signal');
      connect(notes, 'addButton', 'onClick', 'pressLog', 'log', 'signal');
    });
    const said = app.notes.filter((n) => n.startsWith('Pages/Notes'));
    expect(said).toEqual([]);
    expect(notesFile(app)).toContain('startDelay(pollTimer, 0, 0, () => pollStarted.set(noteDraft.get()))');
    expect(notesFile(app)).toContain('logged.set(noteDraft.get())');
  });
});

describe('EXP-011 §39 §B — Value Changed', () => {
  it('watching a Variable is a useEffect over its hook local, with the last value in a ref', () => {
    const { app } = withGraph((_ir, notes) => {
      addNode(notes, { id: 'watch', type: 'Value Changed', authoredLabel: 'Draft watch' });
      connect(notes, 'noteDraftVar', 'value', 'watch', 'value');
      addNode(notes, { id: 'watchLog', type: 'net.noodl.Log', parameters: [{ name: 'message', value: literal('draft changed') }] });
      connect(notes, 'watch', 'valueChanged', 'watchLog', 'log', 'signal');
    });
    expectParses(app);
    const page = notesFile(app);
    expect(page).toContain('const draftWatchLast = useRef<unknown>(undefined);');
    expect(page).toContain(
      '  useEffect(() => {\n    const arrival = draft;\n    if (draftWatchLast.current === arrival) return;\n    draftWatchLast.current = arrival;\n    log(\'info\', \'draft changed\');\n  }, [draft]);'
    );
    expect(page).toContain("import { useEffect, useRef } from 'react';");
    expect(deferralFor(app, 'watch')).not.toContain('deferred');
    expect(app.notes.filter((n) => n.startsWith('Pages/Notes'))).toEqual([]);
    expect(typecheckEmittedApp(app)).toEqual([]);
  });

  it('defers with the reason: no Input, no consumer, a stray output, or an Input that only exists in a handler', () => {
    const noInput = withGraph((_ir, notes) => {
      addNode(notes, { id: 'watch', type: 'Value Changed' });
      addSetter(notes, 'after', 'changed');
      connect(notes, 'watch', 'valueChanged', 'after', 'do', 'signal');
    }).app;
    expect(deferralFor(noInput, 'watch')).toContain('nothing is wired into Input');
    const noConsumer = withGraph((_ir, notes) => {
      addNode(notes, { id: 'watch', type: 'Value Changed' });
      connect(notes, 'noteDraftVar', 'value', 'watch', 'value');
    }).app;
    expect(deferralFor(noConsumer, 'watch')).toContain('drives nothing');
    const stray = withGraph((_ir, notes) => {
      addNode(notes, { id: 'watch', type: 'Value Changed' });
      connect(notes, 'noteDraftVar', 'value', 'watch', 'value');
      connect(notes, 'watch', 'somethingElse', 'notesHeading', 'text');
    }).app;
    expect(deferralFor(stray, 'watch')).toContain('publishes only Value Changed');
    const handlerOnly = withGraph((_ir, notes) => {
      addNode(notes, { id: 'watch', type: 'Value Changed' });
      connect(notes, 'entryInput', 'onTextChanged', 'watch', 'value');
      addSetter(notes, 'after', 'changed');
      connect(notes, 'watch', 'valueChanged', 'after', 'do', 'signal');
    }).app;
    expect(deferralFor(handlerOnly, 'watch')).toContain('only exists inside a handler');
  });
});

// ---- §C the picker-exercising project (EXP-011 AC3) ------------------------------------------

describe('EXP-011 §39 §C — tests/fixtures/tick-desk', () => {
  const ir = parseProject(TICK_DESK, catalog);
  const app = emitApp(ir, catalog);
  const page = app.files['src/pages/Tick.tsx'];

  it('exports whole — the scaffold note, and the one Restart note the graph earns', () => {
    const notes = app.notes.filter((n) => !n.startsWith('App:'));
    expect(notes).toHaveLength(1);
    expect(notes[0]).toContain('never reports Unchanged');
  });

  it('carries all three nodes and both libraries', () => {
    expect(page).toContain("startDelay(pollTimer, 100, 400, () => status.set('Running'), () => status.set('Finished'))");
    expect(page).toContain('if (stopDelay(pollTimer)) {');
    expect(page).toContain('restartDelay(pollTimer, 100, 400,');
    expect(page).toContain("log('info', 'Status changed')");
    expect(page).toContain('if (statusWatchLast.current === arrival) return;');
    expect(app.files['src/lib/timer.ts']).toBeDefined();
    expect(app.files['src/lib/util.ts']).toBeDefined();
  });

  it('typechecks', () => {
    expect(typecheckEmittedApp(app)).toEqual([]);
  });
});
