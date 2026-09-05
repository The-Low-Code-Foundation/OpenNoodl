import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

import { Catalog, CatalogIndex } from '../src/catalog';
import { planProject } from '../src/analyze/plan';
import { emitApp } from '../src/emit/emitApp';
import { parseProject } from '../src/parse/parseProject';
import { animateLibSource } from '../src/emit/animateLib';
import { statesLibSource } from '../src/emit/statesLib';
import { typecheckEmittedApp } from './helpers/typecheckApp';
import { ComponentIR, ExportIR, NodeIR, ParamValue } from '../src/ir/types';

/**
 * EXP-011 §49 — the animation pair: `States` and `Animate To Value` (Tier 3.8), and the wired
 * style sink (`opacity`, `color`, `backgroundColor`) both exist to drive.
 *
 * §A grades the two emitted modules against the interpreter's own code, loaded from source and
 * driven frame by frame at the same instants: the run engine against `timerscheduler.ts`, the
 * tween against `animate-to-value.ts`, the state machine against `states.ts` — the whole node,
 * booted through a harness that stands in for `Node` (register/flag/schedule/report) and drained
 * as the runtime drains it. Every comparison has a deliberately broken copy that must disagree
 * (`date-family.test.ts`'s rule), and the two hooks have a `renderToString` presence control.
 *
 * §B grades the translation — graphs in, emitted code out — with every deferral asserted **by its
 * named reason**. §C is the picker-exercising project `tests/fixtures/glow-desk` (AC3), typechecked
 * whole; EXP-011 §49.5 has the drive.
 */

const FIXTURE = path.join(__dirname, 'fixtures', 'glow-desk');
const CATALOG_PATH = path.join(__dirname, '..', '..', 'noodl-types', 'src', 'node-catalog.json');
const RUNTIME_SRC = path.join(__dirname, '..', '..', 'noodl-runtime', 'src');
const VIEWER_SRC = path.join(__dirname, '..', '..', 'noodl-viewer-react', 'src');

const catalog: Catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
const baseIr = parseProject(FIXTURE, catalog);
const app = emitApp(baseIr, catalog);

const GLOW = 'Pages/Glow';
const GLOW_FILE = 'src/pages/Glow.tsx';
const cloneIr = (): ExportIR => structuredClone(baseIr);
const componentOf = (source: ExportIR, componentPath: string): ComponentIR => source.components.find((c) => c.path === componentPath)!;
const nodeOf = (source: ExportIR, componentPath: string, id: string): NodeIR => componentOf(source, componentPath).nodes.find((n) => n.id === id)!;
const setParam = (node: NodeIR, name: string, value: ParamValue) => {
  const existing = node.parameters.find((p) => p.name === name);
  if (existing) existing.value = value;
  else node.parameters.push({ name, value });
};
const dropParam = (node: NodeIR, name: string) => {
  node.parameters = node.parameters.filter((p) => p.name !== name);
};
const lit = (value: string | number | boolean): ParamValue => ({ kind: 'literal', value });
const wire = (source: ExportIR, componentPath: string, fromId: string, fromProperty: string, toId: string, toProperty: string, kind: 'value' | 'signal' = 'value') => {
  componentOf(source, componentPath).connections.push({ key: `${fromId}:${fromProperty}->${toId}:${toProperty}`, fromId, fromProperty, toId, toProperty, kind });
};
const unwire = (source: ExportIR, componentPath: string, predicate: (c: { fromId: string; fromProperty: string; toId: string; toProperty: string }) => boolean) => {
  const component = componentOf(source, componentPath);
  component.connections = component.connections.filter((c) => !predicate(c));
};
const dropNode = (source: ExportIR, componentPath: string, id: string) => {
  const component = componentOf(source, componentPath);
  component.nodes = component.nodes.filter((n) => n.id !== id);
  unwire(source, componentPath, (c) => c.fromId === id || c.toId === id);
};
const glow = (built: ReturnType<typeof emitApp>): string => built.files[GLOW_FILE];
const dispositionOf = (source: ExportIR, nodeId: string): { kind: string; into?: string; reason?: string } | undefined => {
  const project = planProject(source, new CatalogIndex(catalog));
  return project.plans.find((p) => p.path === GLOW)!.dispositions[nodeId] as { kind: string; into?: string; reason?: string } | undefined;
};

// ---- §A the emitted modules, against the interpreter they have to agree with ----------------

const loadModule = (source: string, require: (id: string) => unknown = () => ({})): Record<string, unknown> => {
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true }
  }).outputText;
  const exported: Record<string, unknown> = {};
  const module = { exports: exported };
  // eslint-disable-next-line no-new-func
  new Function('exports', 'module', 'require', js)(exported, module, require);
  return module.exports;
};
const loadFile = (file: string, require?: (id: string) => unknown) => loadModule(fs.readFileSync(file, 'utf8'), require);

// The interpreter's files, loaded from source. `@noodl/types` is type-only everywhere and erases.
const easeCurvesModule = loadFile(path.join(VIEWER_SRC, 'easecurves.ts'));
const edgeTriggeredInput = loadFile(path.join(RUNTIME_SRC, 'edgetriggeredinput.ts'));
const diagnosticsModule = loadFile(path.join(RUNTIME_SRC, 'diagnostics.ts'));
const outcomeModule = loadFile(path.join(RUNTIME_SRC, 'outcome.ts'));
const runtimeRequire = (id: string): unknown => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  if (id === 'bezier-easing') return require('bezier-easing');
  if (id === '@noodl/runtime') return { EdgeTriggeredInput: edgeTriggeredInput };
  if (id === '@noodl/runtime/src/diagnostics') return diagnosticsModule;
  if (id === '@noodl/runtime/src/outcome') return outcomeModule;
  if (id === '../../easecurves') return easeCurvesModule;
  throw new Error(`unexpected import ${id}`);
};
type NodeDef = {
  initialize: (this: unknown) => void;
  inputs: Record<string, { set?: (this: unknown, value: unknown) => void; valueChangedToTrue?: (this: unknown) => void }>;
  outputs: Record<string, { getter?: (this: unknown) => unknown }>;
  prototypeExtensions?: Record<string, unknown>;
};
const StatesNode = (loadFile(path.join(VIEWER_SRC, 'nodes', 'std-library', 'states.ts'), runtimeRequire).default as { node: NodeDef }).node;
const AnimateNode = (loadFile(path.join(VIEWER_SRC, 'nodes', 'std-library', 'animate-to-value.ts'), runtimeRequire).default as { node: NodeDef }).node;

interface SchedulerTimer {
  start(): void;
  stop(): void;
  _isRunning: boolean;
}
interface Scheduler {
  createTimer(args: Record<string, unknown>): SchedulerTimer;
  runTimers(t: number): void;
}
const SchedulerCtor = loadFile(path.join(RUNTIME_SRC, 'timerscheduler.ts')) as unknown as new (requestFrame: () => void) => Scheduler;

// The emitted modules. `states.ts` requires `./animate` — the same loaded instance, so a run it
// creates is one `runFrame` from that instance drives. React is required by the hooks only.
type Run = { duration: number; delay: number; onStart?: () => void; onRunning?: (t: number) => void; onFinish?: () => void };
interface AnimateLib {
  eases: Record<string, (s: number, e: number, t: number) => number>;
  cubicBezier(points: number[]): (x: number) => number;
  createRun(duration: number, delay: number): Run;
  startRun(run: Run): void;
  stopRun(run: Run): void;
  runFrame(run: Run, now: number): void;
  createAnimatedValue(target: unknown, duration?: number, delay?: number, ease?: unknown): { run: Run; current: number };
  animateTo(anim: { run: Run; current: number }, target: unknown, publish: (v: number) => void, onArrive?: () => void): void;
  useAnimatedValue: unknown;
}
type Listeners = { stateChanged?: () => void; reached?: Record<string, () => void>; done?: () => void; unchanged?: () => void; failure?: () => void };
interface StatesMachine {
  state: string | undefined;
  values: Record<string, unknown>;
  error: string | undefined;
  run: Run;
}
interface StatesLib {
  createStatesMachine(def: unknown, start: string | undefined, listeners: () => Listeners, publish?: () => void): StatesMachine;
  scheduleGoToState(m: StatesMachine, state: unknown, invoked: boolean): void;
  drainQueue(m: StatesMachine): void;
  toggleState(m: StatesMachine): void;
  resolveColor(color: string): string;
  defineStates<T>(def: T): T;
  useStates: unknown;
}
// eslint-disable-next-line @typescript-eslint/no-var-requires
const react = require('react');
const loadAnimateLib = (source = animateLibSource()): AnimateLib => loadModule(source, (id) => (id === 'react' ? react : {})) as unknown as AnimateLib;
const loadStatesLib = (animate: AnimateLib, source = statesLibSource()): StatesLib =>
  loadModule(source, (id) => (id === 'react' ? react : id === './animate' ? animate : {})) as unknown as StatesLib;
const animateLib = loadAnimateLib();
const statesLib = loadStatesLib(animateLib);

type Event = [string, number];
/** Frames every `step` ms from 0 to `until`, inclusive. */
const frames = (until: number, step = 50): number[] => Array.from({ length: Math.floor(until / step) + 1 }, (_, i) => i * step);

describe('§A the run engine against timerscheduler.ts, frame by frame', () => {
  type Verb = 'start' | 'stop';
  type Script = Array<{ at: number; verb?: Verb }>;
  const script = (verbs: Record<number, Verb>, until = 1000): Script => frames(until).map((at) => ({ at, ...(verbs[at] !== undefined ? { verb: verbs[at] } : {}) }));

  /** The interpreter: one timer over the scheduler; events and every `t` passed to onRunning, by instant. */
  const interpreter = (delay: number, duration: number, steps: Script): { events: Event[]; ts: Array<[number, number]> } => {
    const events: Event[] = [];
    const ts: Array<[number, number]> = [];
    let now = 0;
    const scheduler = new SchedulerCtor(() => undefined);
    const timer = scheduler.createTimer({
      duration,
      delay,
      onStart: () => events.push(['start', now]),
      onRunning: (t: number) => ts.push([now, t]),
      onFinish: () => events.push(['finish', now])
    });
    for (const step of steps) {
      now = step.at;
      if (step.verb === 'start') timer.start();
      if (step.verb === 'stop') timer.stop();
      scheduler.runTimers(now);
    }
    return { events, ts };
  };
  /** The emitted engine: `startRun`/`stopRun` at the verbs, `runFrame` at every instant. */
  const emitted = (lib: AnimateLib, delay: number, duration: number, steps: Script): { events: Event[]; ts: Array<[number, number]> } => {
    const events: Event[] = [];
    const ts: Array<[number, number]> = [];
    let now = 0;
    const run = lib.createRun(duration, delay);
    run.onStart = () => events.push(['start', now]);
    run.onRunning = (t) => ts.push([now, t]);
    run.onFinish = () => events.push(['finish', now]);
    for (const step of steps) {
      now = step.at;
      if (step.verb === 'start') lib.startRun(run);
      if (step.verb === 'stop') lib.stopRun(run);
      lib.runFrame(run, now);
    }
    return { events, ts };
  };
  const SCRIPTS: Array<[string, number, number, Script]> = [
    ['no delay, 400 ms', 0, 400, script({ 0: 'start' })],
    ['100 ms delay', 100, 400, script({ 0: 'start' })],
    ['zero duration', 0, 0, script({ 0: 'start' })],
    ['stopped mid-run', 0, 400, script({ 0: 'start', 200: 'stop' })],
    ['restarted mid-run', 0, 400, script({ 0: 'start', 200: 'start' })],
    ['started twice from idle', 0, 300, script({ 0: 'start', 600: 'start' })],
    ['started off a frame', 0, 400, [{ at: 0 }, { at: 30, verb: 'start' }, ...frames(1000).slice(1).map((at) => ({ at }))]]
  ];

  beforeAll(() => jest.useFakeTimers());
  afterAll(() => jest.useRealTimers());

  test.each(SCRIPTS)('A1 %s: the same start/finish instants and the same t on every frame', (_name, delay, duration, steps) => {
    const want = interpreter(delay, duration, steps);
    const got = emitted(animateLib, delay, duration, steps);
    expect(got.events).toEqual(want.events);
    expect(got.ts).toEqual(want.ts);
    expect(want.ts.length).toBeGreaterThan(0);
  });

  test('A1 CONTROL — an engine that joins with the delay-0 first frame removed disagrees', () => {
    const broken = loadAnimateLib(
      animateLibSource().replace(
        "    if (run.delay === 0) {\n      run.onStart?.();\n      run.started = true;\n      run.onRunning?.(0);\n    }\n",
        ''
      )
    );
    const steps = script({ 0: 'start' });
    expect(emitted(broken, 0, 400, steps).ts).not.toEqual(interpreter(0, 400, steps).ts);
  });

  test('A2 the frame loop advances on its own under requestAnimationFrame (presence control)', () => {
    const g = globalThis as unknown as { requestAnimationFrame?: unknown; cancelAnimationFrame?: unknown };
    const saved = [g.requestAnimationFrame, g.cancelAnimationFrame];
    let clock = 0;
    g.requestAnimationFrame = (cb: (t: number) => void) => setTimeout(() => cb((clock += 16)), 16);
    g.cancelAnimationFrame = (id: ReturnType<typeof setTimeout>) => clearTimeout(id);
    try {
      const lib = loadAnimateLib();
      const seen: number[] = [];
      const run = lib.createRun(64, 0);
      run.onRunning = (t) => seen.push(t);
      let finished = false;
      run.onFinish = () => (finished = true);
      lib.startRun(run);
      jest.advanceTimersByTime(16 * 8);
      expect(seen[0]).toBe(0);
      expect(seen[seen.length - 1]).toBe(1);
      expect(finished).toBe(true);
    } finally {
      [g.requestAnimationFrame, g.cancelAnimationFrame] = saved;
    }
  });

  test('A3 the ease table and the bezier solver agree with easecurves.ts and bezier-easing 1.1.1', () => {
    const EaseCurves = easeCurvesModule.default as Record<string, (s: number, e: number, t: number) => number>;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const BezierEasing = require('bezier-easing') as (points: number[]) => { get(x: number): number };
    const points = [0.25, 0.1, 0.25, 1.0];
    const spline = BezierEasing(points);
    const ours = animateLib.cubicBezier(points);
    for (let i = 0; i <= 100; i++) {
      const t = i / 100;
      for (const name of ['linear', 'easeIn', 'easeOut', 'easeInOut']) expect(animateLib.eases[name](3, 11, t)).toBe(EaseCurves[name](3, 11, t));
      expect(ours(t)).toBe(spline.get(t));
    }
    // The linear short-cut, and the interpreter's own default transition.
    expect(animateLib.cubicBezier([0, 0, 1, 1])(0.3)).toBe(BezierEasing([0, 0, 1, 1]).get(0.3));
    expect(animateLib.cubicBezier([0, 0, 0.58, 1])(0.42)).toBe(BezierEasing([0, 0, 0.58, 1]).get(0.42));
  });
});

describe('§A Animate To Value against animate-to-value.ts, frame by frame', () => {
  type Step = { at: number; target?: unknown; duration?: number; delay?: number; ease?: string };
  type Trace = { values: Array<[number, number]>; arrived: number[] };
  const interpreter = (steps: Step[]): Trace => {
    const trace: Trace = { values: [], arrived: [] };
    let now = 0;
    const scheduler = new SchedulerCtor(() => undefined);
    const inst: Record<string, unknown> = {
      _internal: {},
      context: { timerScheduler: scheduler },
      flagOutputDirty: () => undefined,
      sendSignalOnOutput: (name: string) => {
        if (name === 'atTargetValue') trace.arrived.push(now);
      },
      addDeleteListener: () => undefined
    };
    AnimateNode.initialize.call(inst);
    for (const step of steps) {
      now = step.at;
      if (step.duration !== undefined) AnimateNode.inputs.duration.set!.call(inst, step.duration);
      if (step.delay !== undefined) AnimateNode.inputs.delay.set!.call(inst, step.delay);
      if (step.ease !== undefined) AnimateNode.inputs.easingCurve.set!.call(inst, step.ease);
      if ('target' in step) AnimateNode.inputs.targetValue.set!.call(inst, step.target);
      scheduler.runTimers(now);
      trace.values.push([now, AnimateNode.outputs.currentValue.getter!.call(inst) as number]);
    }
    return trace;
  };
  const emitted = (lib: AnimateLib, steps: Step[]): Trace => {
    const trace: Trace = { values: [], arrived: [] };
    let now = 0;
    const anim = lib.createAnimatedValue(undefined);
    for (const step of steps) {
      now = step.at;
      if (step.duration !== undefined) anim.run.duration = step.duration;
      if (step.delay !== undefined) anim.run.delay = step.delay;
      if (step.ease !== undefined) (anim as unknown as { ease: unknown }).ease = lib.eases[step.ease];
      if ('target' in step) lib.animateTo(anim, step.target, () => undefined, () => trace.arrived.push(now));
      lib.runFrame(anim.run, now);
      trace.values.push([now, anim.current]);
    }
    return trace;
  };
  const withFrames = (marks: Record<number, Omit<Step, 'at'>>, until = 1200): Step[] => frames(until).map((at) => ({ at, ...(marks[at] ?? {}) }));
  const SCRIPTS: Array<[string, Step[]]> = [
    ['the first target is adopted outright, the second tweens (easeOut, 500 ms)', withFrames({ 0: { target: 10, duration: 500, ease: 'easeOut' }, 100: { target: 20 } })],
    ['a target equal to the current end is ignored', withFrames({ 0: { target: 10, duration: 500, ease: 'easeOut' }, 100: { target: 10 }, 200: { target: 10 } })],
    ['retargeted mid-run: from wherever it is, no arrival for the interrupted run', withFrames({ 0: { target: 0, duration: 500, ease: 'easeOut' }, 50: { target: 100 }, 300: { target: 5 } })],
    ['booleans are 1 and 0', withFrames({ 0: { target: false, duration: 300, ease: 'linear' }, 50: { target: true } })],
    ['a NaN is ignored, a numeric string is a number', withFrames({ 0: { target: 'x', duration: 300, ease: 'linear' }, 50: { target: '4' }, 100: { target: 'nope' }, 150: { target: 8 } })],
    ['a delay before the move, easeInOut', withFrames({ 0: { target: 1, duration: 400, delay: 150, ease: 'easeInOut' }, 50: { target: 2 } })],
    ['a zero duration settles on the first frame', withFrames({ 0: { target: 1, duration: 0, ease: 'easeIn' }, 50: { target: 2 } })]
  ];
  beforeAll(() => jest.useFakeTimers());
  afterAll(() => jest.useRealTimers());

  test.each(SCRIPTS)('A4 %s', (_name, steps) => {
    const want = interpreter(steps);
    const got = emitted(animateLib, steps);
    expect(got.values).toEqual(want.values);
    expect(got.arrived).toEqual(want.arrived);
  });

  test('A4 the tween is a tween: strictly between the endpoints mid-run, at the target after', () => {
    const trace = emitted(animateLib, withFrames({ 0: { target: 10, duration: 500, ease: 'easeOut' }, 100: { target: 20 } }));
    const at = (t: number) => trace.values.find(([now]) => now === t)![1];
    expect(at(100)).toBe(10);
    expect(at(350)).toBeGreaterThan(10);
    expect(at(350)).toBeLessThan(20);
    expect(at(700)).toBe(20);
    // The target arrived at the 100 ms frame and the run joined on that same frame, so it settles
    // at 600 — the interpreter's own instant (A4 above), not the 650 a "next frame" guess gives.
    expect(trace.arrived).toEqual([600]);
  });

  test('A4 CONTROL — a copy that does not skip an unchanged target restarts the tween and disagrees', () => {
    const broken = loadAnimateLib(animateLibSource().replace('  if (numeric === anim.end) return;\n', ''));
    const steps = withFrames({ 0: { target: 10, duration: 500, ease: 'easeOut' }, 100: { target: 20 }, 200: { target: 20 } });
    expect(emitted(broken, steps).values).not.toEqual(interpreter(steps).values);
  });
});

// The fixture's Panel, as the runtime's parameters and as the emitted definition.
const PANEL_PARAMS: Record<string, unknown> = {
  states: 'dim,bright',
  values: 'opacity,tint,label',
  'type-opacity': 'number',
  'type-tint': 'color',
  'type-label': 'string',
  'value-dim-opacity': 0.2,
  'value-bright-opacity': 1,
  'value-dim-tint': '#334455',
  'value-bright-tint': '#ffcc00',
  'value-dim-label': 'Dim',
  'value-bright-label': 'Bright',
  'transitiondef-dim': { curve: [0, 0, 0.58, 1], dur: 600, delay: 0 },
  'transitiondef-bright': { curve: [0, 0, 0.58, 1], dur: 600, delay: 0 },
  'transition-bright-opacity': { curve: [0, 0, 0.58, 1], dur: 400, delay: 200 }
};
const PANEL_DEF = {
  states: ['dim', 'bright'],
  values: {
    opacity: { type: 'number', byState: { dim: 0.2, bright: 1 }, transitions: { bright: { curve: [0, 0, 0.58, 1], dur: 400, delay: 200 } } },
    tint: { type: 'color', byState: { dim: '#334455', bright: '#ffcc00' } },
    label: { type: 'string', byState: { dim: 'Dim', bright: 'Bright' } }
  },
  transitions: { dim: { curve: [0, 0, 0.58, 1], dur: 600, delay: 0 }, bright: { curve: [0, 0, 0.58, 1], dur: 600, delay: 0 } },
  useTransitions: true
};

describe('§A States against states.ts, the whole node, frame by frame', () => {
  type Pass = { at: number; sets?: Record<string, unknown>; pulses?: string[] };
  type Trace = { events: Event[]; frames: Array<[number, Record<string, unknown>]> };
  const VALUE_PORTS = ['opacity', 'tint', 'label'];

  /** The interpreter: `states.ts` booted through a stand-in for Node, parameters queued then drained as one pass. */
  const interpreter = (params: Record<string, unknown>, passes: Pass[], reads: string[] = VALUE_PORTS): Trace => {
    const trace: Trace = { events: [], frames: [] };
    let now = 0;
    const scheduler = new SchedulerCtor(() => undefined);
    let tokens = 0;
    const inst: Record<string, any> = {
      _internal: {},
      _inputs: {},
      _outputs: {},
      _after: [] as Array<() => void>,
      context: { timerScheduler: scheduler, styles: { resolveColor: (c: string) => c } },
      registerInput(name: string, def: unknown) {
        this._inputs[name] = def;
      },
      hasInput(name: string) {
        return name in this._inputs;
      },
      registerOutput(name: string, def: unknown) {
        this._outputs[name] = def;
      },
      hasOutput(name: string) {
        return name in this._outputs;
      },
      flagOutputDirty: () => undefined,
      sendSignalOnOutput(name: string) {
        trace.events.push([name, now]);
      },
      scheduleAfterInputsHaveUpdated(fn: () => void) {
        this._after.push(fn);
      },
      addDeleteListener: () => undefined,
      beginOutcome: () => ({ id: ++tokens }),
      reportOutcome(_token: unknown, kind: string) {
        trace.events.push([kind, now]);
      },
      setDiagnostic: () => undefined,
      raiseRuntimeError: () => undefined
    };
    Object.assign(inst, StatesNode.prototypeExtensions);
    StatesNode.initialize.call(inst);
    const set = (name: string, value: unknown) => {
      if (StatesNode.inputs[name]?.set) StatesNode.inputs[name].set!.call(inst, value);
      else {
        inst.registerInputIfNeeded(name);
        inst._inputs[name].set.call(inst, value);
      }
    };
    const pulse = (name: string) => {
      if (name === 'toggle') StatesNode.inputs.toggle.valueChangedToTrue!.call(inst);
      else {
        inst.registerInputIfNeeded(name);
        inst._inputs[name].set.call(inst, true);
        inst._inputs[name].set.call(inst, false);
      }
    };
    const drain = () => {
      while (inst._after.length > 0) for (const fn of inst._after.splice(0)) fn.call(inst);
    };
    // The reached/at ports exist only where wired; "wire" every one the reads name.
    for (const state of String(params.states).split(',')) {
      inst.registerOutputIfNeeded(`reached-${state}`);
      inst.registerOutputIfNeeded(`at-${state}`);
    }
    for (const [name, value] of Object.entries(params)) set(name, value);
    drain();
    const read = (port: string): unknown => {
      if (port === 'currentState' || port === 'error') return StatesNode.outputs[port].getter!.call(inst);
      if (port.startsWith('at-')) return inst._internal.currentValues[port];
      return inst._outputs[port].getter.call(inst);
    };
    for (const pass of passes) {
      now = pass.at;
      for (const [name, value] of Object.entries(pass.sets ?? {})) set(name, value);
      for (const name of pass.pulses ?? []) pulse(name);
      drain();
      scheduler.runTimers(now);
      trace.frames.push([now, Object.fromEntries(reads.map((port) => [port, read(port)]))]);
    }
    return trace;
  };
  /** The emitted machine: `scheduleGoToState`/`toggleState` at the pulses, `drainQueue` per pass, `runFrame` per instant. */
  const emitted = (lib: StatesLib, animate: AnimateLib, def: unknown, start: string | undefined, passes: Pass[], reads: string[] = VALUE_PORTS): Trace => {
    const trace: Trace = { events: [], frames: [] };
    let now = 0;
    const states = (def as { states: string[] }).states;
    const listeners: Listeners = {
      stateChanged: () => trace.events.push(['stateChanged', now]),
      reached: Object.fromEntries(states.map((s) => [s, () => trace.events.push([`reached-${s}`, now])])),
      done: () => trace.events.push(['done', now]),
      unchanged: () => trace.events.push(['unchanged', now]),
      failure: () => trace.events.push(['failure', now])
    };
    const m = lib.createStatesMachine(def, start, () => listeners);
    lib.drainQueue(m);
    const read = (port: string): unknown => {
      if (port === 'currentState') return m.state;
      if (port === 'error') return m.error;
      if (port.startsWith('at-')) return m.state === port.slice('at-'.length);
      return m.values[port];
    };
    for (const pass of passes) {
      now = pass.at;
      for (const [name, value] of Object.entries(pass.sets ?? {})) {
        if (name === 'currentState') lib.scheduleGoToState(m, value, false);
        else throw new Error(`the emitted machine takes its parameters from the definition; ${name} is not a runtime input`);
      }
      for (const name of pass.pulses ?? []) {
        if (name === 'toggle') lib.toggleState(m);
        else lib.scheduleGoToState(m, name.slice('to-'.length), true);
      }
      lib.drainQueue(m);
      animate.runFrame(m.run, now);
      trace.frames.push([now, Object.fromEntries(reads.map((port) => [port, read(port)]))]);
    }
    return trace;
  };
  const passes = (marks: Record<number, Omit<Pass, 'at'>>, until = 1200): Pass[] => frames(until).map((at) => ({ at, ...(marks[at] ?? {}) }));
  const READS = [...VALUE_PORTS, 'currentState', 'at-dim', 'at-bright', 'error'];
  const SCRIPTS: Array<[string, Pass[]]> = [
    ['To bright: the label jumps, the tint tweens over 600 ms, the opacity waits 200 ms then tweens over 400', passes({ 0: { pulses: ['to-bright'] } })],
    ['To bright then To dim after 300 ms: a tween retargeted from mid-flight', passes({ 0: { pulses: ['to-bright'] }, 300: { pulses: ['to-dim'] } })],
    ['To dim while dim: Unchanged, nothing moves', passes({ 0: { pulses: ['to-dim'] } })],
    ['Toggle twice: wraps round, the second from mid-flight', passes({ 0: { pulses: ['toggle'] }, 350: { pulses: ['toggle'] } })],
    ['an unknown state: Failure, the Error text, nothing moves', passes({ 0: { pulses: ['to-blight'] } })],
    ['To bright and To dim in one pass: bright settles at once, dim animates', passes({ 0: { pulses: ['to-bright', 'to-dim'] } })],
    // The one road to goToState's own Unchanged: the queue's last request differs from the current
    // state (so scheduleGoToState does not answer), then the first request fails and leaves the node
    // where it was, so the second asks for the state it is already in. Arm A's earner.
    ['an unknown state then the current state in one pass: Failure, then Unchanged from the drain', passes({ 0: { pulses: ['to-blight', 'to-dim'] } }, 100)],
    ['the State input: no outcome, State Changed and Has Reached still fire', passes({ 0: { sets: { currentState: 'bright' } } })],
    ['the State input asking for the current state: nothing', passes({ 0: { sets: { currentState: 'dim' } } })],
    ['the State input asking for a state the node has not got: Failure, the Error text', passes({ 0: { sets: { currentState: 'Dim ' } } })]
  ];
  beforeAll(() => jest.useFakeTimers());
  afterAll(() => jest.useRealTimers());

  test.each(SCRIPTS)('A5 %s', (_name, script) => {
    const want = interpreter(PANEL_PARAMS, script, READS);
    const got = emitted(statesLib, animateLib, PANEL_DEF, undefined, script, READS);
    expect(got.events).toEqual(want.events);
    expect(got.frames).toEqual(want.frames);
  });

  test('A5 the drain\'s own Unchanged is reachable, and both worlds report it after the Failure', () => {
    const script = passes({ 0: { pulses: ['to-blight', 'to-dim'] } }, 50);
    const want = interpreter(PANEL_PARAMS, script, READS);
    expect(want.events).toEqual([
      ['failure', 0],
      ['unchanged', 0]
    ]);
    expect(emitted(statesLib, animateLib, PANEL_DEF, undefined, script, READS).events).toEqual(want.events);
  });

  test('A5 the tween is a tween, with the per-value delay: opacity holds for 200 ms, then moves, both settle', () => {
    const trace = emitted(statesLib, animateLib, PANEL_DEF, undefined, passes({ 0: { pulses: ['to-bright'] } }), READS);
    const at = (t: number) => trace.frames.find(([now]) => now === t)![1];
    expect(at(0)).toMatchObject({ opacity: 0.2, label: 'Bright', currentState: 'bright', 'at-bright': true, 'at-dim': false });
    expect(at(150).opacity).toBe(0.2);
    expect(at(150).tint).not.toBe('#334455ff');
    expect(at(400).opacity).toBeGreaterThan(0.2);
    expect(at(400).opacity).toBeLessThan(1);
    expect(at(700)).toMatchObject({ opacity: 1, tint: '#ffcc00ff' });
    expect(trace.events).toEqual([
      ['stateChanged', 0],
      ['done', 0],
      ['reached-bright', 600]
    ]);
  });

  test('A5 Use Transitions off, and a zero transition: values jump and Has Reached fires at the request', () => {
    const script = passes({ 0: { pulses: ['to-bright'] } }, 200);
    const off = { ...PANEL_DEF, useTransitions: false };
    const want = interpreter({ ...PANEL_PARAMS, useTransitions: false }, script, READS);
    const got = emitted(statesLib, animateLib, off, undefined, script, READS);
    expect(got.events).toEqual(want.events);
    expect(got.frames).toEqual(want.frames);
    expect(got.events).toEqual([
      ['stateChanged', 0],
      ['reached-bright', 0],
      ['done', 0]
    ]);
  });

  test('A5 an authored State that is not the first: the node boots in the first state and animates to it, State Changed and all', () => {
    const script = passes({}, 800);
    const want = interpreter({ ...PANEL_PARAMS, currentState: 'bright' }, script, READS);
    const got = emitted(statesLib, animateLib, PANEL_DEF, 'bright', script, READS);
    expect(got.events).toEqual(want.events);
    expect(got.frames).toEqual(want.frames);
    expect(want.events[0]).toEqual(['stateChanged', 0]);
    expect(want.frames[0][1].opacity).toBe(0.2);
  });

  test('A5 an authored State that is not a state at all: the interpreter refuses it at boot and stays in the first state', () => {
    const script = passes({}, 100);
    const want = interpreter({ ...PANEL_PARAMS, currentState: 'nope' }, script, READS);
    expect(want.events).toEqual([['failure', 0]]);
    expect(want.frames[0][1]).toMatchObject({ currentState: 'dim', opacity: 0.2 });
    expect(String(want.frames[0][1].error)).toContain('Cannot go to state "nope"');
  });

  test('A5 the Error text is the node\'s own, "Did you mean" included', () => {
    const want = interpreter(PANEL_PARAMS, passes({ 0: { pulses: ['to-Bright'] } }, 50), READS);
    const got = emitted(statesLib, animateLib, PANEL_DEF, undefined, passes({ 0: { pulses: ['to-Bright'] } }, 50), READS);
    expect(got.frames[0][1].error).toBe(want.frames[0][1].error);
    expect(want.frames[0][1].error).toBe('Cannot go to state "Bright" — this node has no such state. Its states are: dim, bright. Did you mean "bright"?');
  });

  test('A5 MEASURED — a var(--token) colour: the interpreter tweens through a NaN hex, and with no document the export answers the same', () => {
    const params = { ...PANEL_PARAMS, 'value-bright-tint': 'var(--primary)' };
    const def = { ...PANEL_DEF, values: { ...PANEL_DEF.values, tint: { type: 'color', byState: { dim: '#334455', bright: 'var(--primary)' } } } };
    const script = passes({ 0: { pulses: ['to-bright'] } }, 700);
    const want = interpreter(params, script, ['tint']);
    const got = emitted(statesLib, animateLib, def, undefined, script, ['tint']);
    // Measured, not predicted: `setRGBA` reads `var(--primary)` two characters at a time, so the
    // first channel is `parseInt('ar', 16)` = 10 and tweens to a real byte; the other three are NaN.
    expect(want.frames.find(([now]) => now === 300)![1].tint).toMatch(/^#[0-9a-f]{2}NaNNaNNaN$/);
    expect(got.frames).toEqual(want.frames);
    // 🔴 Measured: the tween ENDS on `rgbaToHex(targetValues)` — the parsed garbage, not the authored
    // string — so a token-coloured value never reaches its colour in the interpreter while
    // transitions are on. Registered in EXP-011 §49.3. The export resolves the token in a browser.
    expect(want.frames[want.frames.length - 1][1].tint).toBe('#0aNaNNaNNaN');
  });

  test('A5 CONTROL — a machine that animates every queued state rather than settling the intermediates disagrees on the one-pass script', () => {
    const broken = loadStatesLib(
      animateLib,
      statesLibSource().replace(
        '    goToState(m, requested[i].state, i < requested.length - 1, requested[i].invoked);',
        '    goToState(m, requested[i].state, false, requested[i].invoked);'
      )
    );
    const script = passes({ 0: { pulses: ['to-bright', 'to-dim'] } });
    const want = interpreter(PANEL_PARAMS, script, READS);
    expect(emitted(broken, animateLib, PANEL_DEF, undefined, script, READS).events).not.toEqual(want.events);
    expect(emitted(statesLib, animateLib, PANEL_DEF, undefined, script, READS).events).toEqual(want.events);
  });

  test('A6 the two hooks boot the right snapshot (renderToString presence control)', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { renderToString } = require('react-dom/server');
    const useStates = statesLib.useStates as (def: unknown, start?: string) => { state: string; values: Record<string, unknown> };
    const useAnimatedValue = animateLib.useAnimatedValue as (target: unknown, options: unknown) => number;
    const Page = () => {
      const panel = useStates(PANEL_DEF, 'dim');
      const fade = useAnimatedValue(0.4, { duration: 500, delay: 0, ease: 'easeOut' });
      const idle = useAnimatedValue(undefined, { duration: 500, delay: 0, ease: 'easeOut' });
      return react.createElement('p', null, `${panel.state}|${panel.values.opacity}|${panel.values.label}|${fade}|${idle}`);
    };
    expect(renderToString(react.createElement(Page))).toContain('dim|0.2|Dim|0.4|0');
  });
});

// ---- §B the translation -------------------------------------------------------------------

describe('§B the translation — the fixture, then graphs mutated one fact at a time', () => {
  test('B1 a States is a defineStates constant above the component and a useStates handle inside it, listeners passed once', () => {
    const page = glow(app);
    expect(page).toContain(
      [
        '/** Panel — a state machine whose values move between states (states.ts); starts in "dim". */',
        'const PANEL_STATES = defineStates({',
        "  states: ['dim', 'bright'],",
        '  values: {',
        "    opacity: { type: 'number', byState: { dim: 0.2, bright: 1 }, transitions: { bright: { curve: [0, 0, 0.58, 1], dur: 400, delay: 200 } } },",
        "    tint: { type: 'color', byState: { dim: '#334455', bright: '#ffcc00' } },",
        "    label: { type: 'string', byState: { dim: 'Dim', bright: 'Bright' } }",
        '  },',
        '  transitions: { dim: { curve: [0, 0, 0.58, 1], dur: 600, delay: 0 }, bright: { curve: [0, 0, 0.58, 1], dur: 600, delay: 0 } },',
        '  useTransitions: true',
        '});'
      ].join('\n')
    );
    expect(page).toContain(
      [
        "  const panel = useStates(PANEL_STATES, 'dim', {",
        '    stateChanged: () => setChanges((v) => v + 1),',
        "    reached: { dim: () => reached.set('dim reached'), bright: () => reached.set('bright reached') },",
        "    done: () => outcome.set('done'),",
        "    unchanged: () => outcome.set('unchanged')",
        '  });'
      ].join('\n')
    );
    expect(page).toContain("import { defineStates, useStates } from '../lib/states';");
  });

  test('B2 a wired State input is an effect keyed on the read; no listeners and no authored State print a one-argument hook', () => {
    const page = glow(app);
    expect(page).toContain('  const follower = useStates(FOLLOWER_STATES);');
    // The render local, never the store object — a `Value<string>` handed to `follow` would ask for a state named "[object Object]".
    expect(page).toContain('  const wantedValue = useValue(wanted);');
    expect(page).toContain(['  useEffect(() => {', '    follower.follow(wantedValue);', '  }, [wantedValue]);'].join('\n'));
    expect(page).toContain("import { useEffect, useState } from 'react';");
  });

  test('B3 Toggle and To <state> are one call each on the handle, expressions in the click handler', () => {
    const page = glow(app);
    expect(page).toContain('<button onClick={() => panel.toggle()}>Toggle</button>');
    expect(page).toContain("<button onClick={() => panel.goTo('bright')}>Bright</button>");
    expect(page).toContain("<button onClick={() => panel.goTo('dim')}>Dim</button>");
  });

  test('B4 the reads: State bare, At as the comparison through String(), a number value through String(), a string value bare, the Error with ?? \'\'', () => {
    const page = glow(app);
    expect(page).toContain('<p className={styles.text}>{panel.state}</p>');
    expect(page).toContain("<p className={styles.text}>{String(panel.state === 'bright')}</p>");
    expect(page).toContain('<p className={styles.panelLabel}>{panel.values.label}</p>');
    expect(page).toContain('<p className={styles.text}>{String(follower.values.level)}</p>');
    expect(page).toContain("<p className={styles.ferrorText}>{follower.error ?? ''}</p>");
  });

  test('B5 a value into opacity and a colour into backgroundColor land as one inline style after the class', () => {
    const page = glow(app);
    expect(page).toContain(
      ['      <div', '        className={styles.panelBox}', '        style={{ opacity: panel.values.opacity, backgroundColor: panel.values.tint }}', '      >'].join('\n')
    );
    expect(page).toContain('<div className={styles.fadeBox} style={{ opacity: fade }} />');
  });

  test('B6 an Animate To Value is a useAnimatedValue hook with its options and its At Target Value chain; Current Value reads as a number', () => {
    const page = glow(app);
    // The render local, never the store object — `Number(store)` is NaN and the tween would never start.
    expect(page).toContain('  const levelValue = useValue(level);');
    expect(page).toContain("  const fade = useAnimatedValue(levelValue, { duration: 500, delay: 0, ease: 'easeOut' }, () => arrived.set('arrived'));");
    expect(page).toContain('<p className={styles.text}>{String(fade)}</p>');
    expect(page).toContain("import { useAnimatedValue } from '../lib/animate';");
  });

  test('B7 both nodes collapse into the page, every wire off them is consumed, and the listener wires listed before the trigger wires are not reported', () => {
    for (const id of ['panel', 'follower', 'fade']) expect(dispositionOf(baseIr, id)).toEqual({ kind: 'collapsed', into: GLOW_FILE });
    const notes = app.notes.join('\n');
    for (const id of ['panel', 'follower', 'fade']) expect(notes).not.toContain(`${id}:`);
    expect(notes).not.toContain('the trigger is not a rendered element event or a receiver');
    expect(notes).not.toContain('no deterministic translation');
    // The fixture lists panel:stateChanged->changes:increase before toggleBtn:onClick->panel:toggle.
    const wires = componentOf(baseIr, GLOW).connections;
    expect(wires.findIndex((c) => c.fromProperty === 'stateChanged')).toBeLessThan(wires.findIndex((c) => c.toProperty === 'toggle'));
  });

  test('B8 the two modules ship with the pair; an Animate alone ships animate.ts only; a States alone ships both', () => {
    expect(Object.keys(app.files)).toEqual(expect.arrayContaining(['src/lib/animate.ts', 'src/lib/states.ts']));
    expect(app.files['src/lib/animate.ts']).toContain(animateLibSource());
    expect(app.files['src/lib/states.ts']).toContain(statesLibSource());
    const animateOnly = cloneIr();
    dropNode(animateOnly, GLOW, 'panel');
    dropNode(animateOnly, GLOW, 'follower');
    const builtA = emitApp(animateOnly, catalog);
    expect(builtA.files['src/lib/animate.ts']).toBeDefined();
    expect(builtA.files['src/lib/states.ts']).toBeUndefined();
    const statesOnly = cloneIr();
    dropNode(statesOnly, GLOW, 'fade');
    const builtS = emitApp(statesOnly, catalog);
    expect(builtS.files['src/lib/animate.ts']).toBeDefined();
    expect(builtS.files['src/lib/states.ts']).toBeDefined();
    expect(glow(builtS)).not.toContain('useAnimatedValue');
  });

  test('B9 refusals by name — the States gates', () => {
    const wiredStates = cloneIr();
    wire(wiredStates, GLOW, 'onStr', 'savedValue', 'panel', 'states');
    // The reason reaches the report through whichever side asked first — here the trigger wires,
    // which the attach pass drops with the compile's own sentence and marks the node deferred with.
    expect(emitApp(wiredStates, catalog).notes.join('\n')).toContain('its States list is wired — the port set is not statically knowable');
    expect(dispositionOf(wiredStates, 'panel')).toMatchObject({ kind: 'deferred', reason: 'its States list is wired — the port set is not statically knowable' });
    expect(glow(emitApp(wiredStates, catalog))).not.toContain('useStates(PANEL_STATES');

    const textStyle = cloneIr();
    setParam(nodeOf(textStyle, GLOW, 'panel'), 'type-label', lit('textStyle'));
    expect(emitApp(textStyle, catalog).notes.join('\n')).toContain('its value "label" is a Text Style — a style preset name has no sink in this slice');

    const missing = cloneIr();
    dropParam(nodeOf(missing, GLOW, 'panel'), 'value-bright-label');
    expect(emitApp(missing, catalog).notes.join('\n')).toContain('its value "label" has no authored value in state "bright"');

    const noStates = cloneIr();
    setParam(nodeOf(noStates, GLOW, 'panel'), 'states', lit(''));
    expect(emitApp(noStates, catalog).notes.join('\n')).toContain('its States list is empty — the node has nowhere to go');

    const completed = cloneIr();
    wire(completed, GLOW, 'panel', 'completed', 'setOutcomeDone', 'do', 'signal');
    expect(emitApp(completed, catalog).notes.join('\n')).toContain('its Completed output is consumed — it fires after every outcome');

    const strayOutput = cloneIr();
    wire(strayOutput, GLOW, 'panel', 'at-blight', 'atText', 'text');
    expect(emitApp(strayOutput, catalog).notes.join('\n')).toContain('its at-blight output names a state this node does not have');

    const wiredValue = cloneIr();
    wire(wiredValue, GLOW, 'oneNum', 'savedValue', 'panel', 'value-bright-opacity');
    expect(emitApp(wiredValue, catalog).notes.join('\n')).toContain('its value-bright-opacity is wired — only authored state values translate in this slice');
  });

  test('B10 a To naming a state the node has not got refuses that trigger by name; the node itself still translates', () => {
    const ir = cloneIr();
    unwire(ir, GLOW, (c) => c.toProperty === 'to-dim');
    wire(ir, GLOW, 'dimBtn', 'onClick', 'panel', 'to-dusk', 'signal');
    const built = emitApp(ir, catalog);
    expect(built.notes.join('\n')).toContain('its To "dusk" names a state this node does not have');
    expect(glow(built)).toContain("panel.goTo('bright')");
    // The dropped wire leaves EXP-004's marker naming the state; no call carries it.
    expect(glow(built)).not.toContain("goTo('dusk')");
    expect(glow(built)).toContain('TODO(export)');
    expect(dispositionOf(ir, 'panel')?.kind).toBe('collapsed');
  });

  test('B11 an authored State naming no state: a note, the first state, and the listeners keep their position', () => {
    const ir = cloneIr();
    setParam(nodeOf(ir, GLOW, 'panel'), 'currentState', lit('nope'));
    const built = emitApp(ir, catalog);
    expect(built.notes.join('\n')).toContain('its State parameter names "nope", which is not one of its states — the interpreter refuses it at boot and stays in the first state; the export starts there too');
    expect(glow(built)).toContain('  const panel = useStates(PANEL_STATES, undefined, {');
    expect(typecheckEmittedApp(built)).toEqual([]);
  });

  test('B12 a value name with a space is a quoted key in the definition and a bracket read', () => {
    const ir = cloneIr();
    const panel = nodeOf(ir, GLOW, 'panel');
    setParam(panel, 'values', lit('opacity,tint,bg label'));
    dropParam(panel, 'type-label');
    dropParam(panel, 'value-dim-label');
    dropParam(panel, 'value-bright-label');
    setParam(panel, 'type-bg label', lit('string'));
    setParam(panel, 'value-dim-bg label', lit('Dim'));
    setParam(panel, 'value-bright-bg label', lit('Bright'));
    unwire(ir, GLOW, (c) => c.fromProperty === 'label');
    wire(ir, GLOW, 'panel', 'bg label', 'panelLabel', 'text');
    const built = emitApp(ir, catalog);
    expect(glow(built)).toContain('    "bg label": { type: \'string\', byState: { dim: \'Dim\', bright: \'Bright\' } }');
    expect(glow(built)).toContain('{panel.values["bg label"]}');
    expect(typecheckEmittedApp(built)).toEqual([]);
  });

  test('B13 refusals by name — the Animate To Value gates; a wired Duration is read where the hook is', () => {
    const unknownEase = cloneIr();
    setParam(nodeOf(unknownEase, GLOW, 'fade'), 'easingCurve', lit('bounce'));
    expect(emitApp(unknownEase, catalog).notes.join('\n')).toContain('its Easing Curve "bounce" is not a curve the node knows');

    const wiredEase = cloneIr();
    wire(wiredEase, GLOW, 'onStr', 'savedValue', 'fade', 'easingCurve');
    expect(emitApp(wiredEase, catalog).notes.join('\n')).toContain('its Easing Curve is wired — the node indexes its curve table by the name');

    const stray = cloneIr();
    wire(stray, GLOW, 'fade', 'progress', 'fadeText', 'text');
    expect(emitApp(stray, catalog).notes.join('\n')).toContain('its progress output is consumed, and this node publishes only Current Value and At Target Value');

    // The Counter's count is a number-typed row (the fixture's Variables are untyped — a Set
    // Variable's value is not a typed writer, EXP-011 §10), so it is the source that typechecks.
    const wiredDuration = cloneIr();
    wire(wiredDuration, GLOW, 'changes', 'currentCount', 'fade', 'duration');
    const built = emitApp(wiredDuration, catalog);
    expect(glow(built)).toContain("useAnimatedValue(levelValue, { duration: changes, delay: 0, ease: 'easeOut' }");
    expect(typecheckEmittedApp(built)).toEqual([]);
  });

  test('B14 an Animate whose At Target Value drives nothing prints no callback; an authored target is the literal', () => {
    const ir = cloneIr();
    unwire(ir, GLOW, (c) => c.fromProperty === 'atTargetValue');
    unwire(ir, GLOW, (c) => c.toProperty === 'targetValue');
    setParam(nodeOf(ir, GLOW, 'fade'), 'targetValue', lit(0.5));
    const built = emitApp(ir, catalog);
    expect(glow(built)).toContain("  const fade = useAnimatedValue(0.5, { duration: 500, delay: 0, ease: 'easeOut' });");
    expect(typecheckEmittedApp(built)).toEqual([]);
  });

  test('B15 CONTROL — the wired style sink is general: a number-typed Variable into opacity binds; an untyped one is refused by name', () => {
    const typed = cloneIr();
    unwire(typed, GLOW, (c) => c.toId === 'fadeBox');
    wire(typed, GLOW, 'changes', 'currentCount', 'fadeBox', 'opacity');
    const built = emitApp(typed, catalog);
    expect(glow(built)).toContain('<div className={styles.fadeBox} style={{ opacity: changes }} />');
    expect(typecheckEmittedApp(built)).toEqual([]);

    // `level` is written by two Number constants and is nonetheless `value<unknown>` (only a String
    // constant types its Variable here — registered in §49.3); `unknown` into a number sink refuses.
    const untyped = cloneIr();
    unwire(untyped, GLOW, (c) => c.toId === 'fadeBox');
    wire(untyped, GLOW, 'levelVar', 'value', 'fadeBox', 'opacity');
    const builtU = emitApp(untyped, catalog);
    expect(glow(builtU)).not.toContain('style={{ opacity: level');
    expect(builtU.notes.join('\n')).toContain('wire into fadeBox.opacity reads variable "level", which has no statically-typed writer, into a sink this slice cannot coerce it to');
  });

  test('B16 a wired style parameter the table does not name stays reported, as before', () => {
    const ir = cloneIr();
    wire(ir, GLOW, 'fade', 'currentValue', 'fadeBox', 'transformX');
    const built = emitApp(ir, catalog);
    expect(glow(built)).not.toContain('transformX');
    expect(built.notes.join('\n')).toContain('fade:currentValue->fadeBox:transformX');
  });

  test('B17 an At <state> into a truthiness sink prints bare — it is a boolean', () => {
    const ir = cloneIr();
    unwire(ir, GLOW, (c) => c.fromProperty === 'at-bright');
    wire(ir, GLOW, 'panel', 'at-bright', 'atText', 'visible');
    const built = emitApp(ir, catalog);
    expect(glow(built)).toContain("panel.state === 'bright'");
    expect(glow(built)).not.toContain("!!(panel.state === 'bright')");
    expect(typecheckEmittedApp(built)).toEqual([]);
  });

  test('B18 the ledger: both nodes translated, the floor raised to 92 (96 since §54)', () => {
    const ledger = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'coverage-ledger.json'), 'utf8')) as {
      pickerCoverageFloor: number;
      entries: Array<{ typeName: string; status: string; note?: string }>;
    };
    for (const typeName of ['States', 'net.noodl.animatetovalue']) {
      const entry = ledger.entries.find((e) => e.typeName === typeName)!;
      expect(entry.status).toBe('translated');
      expect(entry.note).toContain('EXP-011 §49');
    }
    expect(ledger.pickerCoverageFloor).toBe(115); // §64 Server-Sent Events (session 88) on top of §61 the component-stack trio + §60 the component-object trio + §62 the relation pair + §63 Drag (session 86); §57 + §58 + §59 (session 85) // §51 added Component Children (session 79); §52 Script (session 80); §53 Run Tasks (session 81); §54 On App Error (session 82) §56 Filter Records
  });
});

describe('§C — the fixture whole', () => {
  test('C1 typechecks', () => {
    expect(typecheckEmittedApp(app)).toEqual([]);
  });
});
