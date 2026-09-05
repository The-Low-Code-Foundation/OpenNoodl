import * as fs from 'fs';
import * as path from 'path';

import * as ts from 'typescript';

import { Catalog, CatalogIndex } from '../src/catalog';
import { ComponentPlan, DRAG_OPTION_PORTS, planProject } from '../src/analyze/plan';
import { emitApp } from '../src/emit/emitApp';
import { summarizePreflight } from '../src/emit/preflight';
import { ANIMATE_LIB_PATH, animateLibSource } from '../src/emit/animateLib';
import { DRAG_LIB_PATH, dragLibSource } from '../src/emit/dragLib';
import { ERRORS_LIB_PATH, errorsLibSource } from '../src/emit/errorsLib';
import { DRAG_OWN_PORTS } from '../src/emit/style';
import { exportBadgeOf, ledgerEntryOf } from '../src/ledger';
import { parseProject } from '../src/parse/parseProject';
import { typecheckEmittedApp } from './helpers/typecheckApp';
import { ComponentIR, ConnectionIR, ExportIR, NodeIR, ParamValue } from '../src/ir/types';

/**
 * EXP-011 §63 — `Drag`, Tier 2.8 row 13: a visual node that renders no element of its own and drags its first child
 * through react-draggable. The export drags a wrapper `<div>` bound to a `useDrag` handle (`src/lib/drag.ts`).
 *
 * Built on `tests/fixtures/board-desk`: a Card Group inside a Drag inside a bounded 320×200 Board; Drag X/Y and Delta
 * X/Y in four Texts; Drag Started / Drag Ended / Done write a status Variable through three String nodes; a text input
 * feeds a Variable that feeds Snap To Position X — Value (arrival semantics); a button fires both snap Dos.
 *
 * 🔴 The reverted arm (`probe-reverted.log`, HEAD 2a2dd4fa): `node drag (Drag) is in the visual tree but has no
 * generator yet`, the card subtree "has no translation in this slice", the three Set Variables silenced from the
 * value side ("the value wire has no statically known source"), 6 silenced, `pathway: false`. Building found the
 * fixture's own trap first: a `String` node's output port is `savedValue`, not `value` (§F).
 */

const FIXTURE = path.join(__dirname, 'fixtures', 'board-desk');
const CATALOG_PATH = path.join(__dirname, '..', '..', 'noodl-types', 'src', 'node-catalog.json');
const catalog: Catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
const index = new CatalogIndex(catalog);
const baseIr = parseProject(FIXTURE, catalog);
const app = emitApp(baseIr, catalog);
const project = planProject(baseIr, index);

const HOME = 'Pages/Home';
const HOME_FILE = 'src/pages/Home.tsx';

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
const addNode = (component: ComponentIR, node: Partial<NodeIR> & { id: string; type: string }): NodeIR => {
  const full: NodeIR = { catalogRef: node.type, parameters: [], declaredPorts: [], portKnowledge: 'complete', ...node } as NodeIR;
  component.nodes.push(full);
  return full;
};
const notesOf = (source: ExportIR): string => emitApp(source, catalog).notes.join('\n');
const home = (a: { files: Record<string, string> }): string => a.files[HOME_FILE];
const dispositionOf = (source: ExportIR, nodeId: string): string => JSON.stringify(planOf(source, HOME).dispositions[nodeId]);

const HOOK_LINE =
  "const card = useDrag({ label: 'Card', nodeId: 'drag', componentName: '/Pages/Home' }, { axis: 'both', startX: 20, startY: 20, snapX: x, snapXDuration: 200, snapY: 0 }, {";
const WRAPPER = '<div ref={card.ref} style={card.style} {...card.handlers}>';
/** The handle's style: the transform, and the fit-content pair that keeps the wrapper the child's box (§63.6 — the drive found a stretched wrapper pinning the X bound). */
const wrapperStyle = (transform: string) => ({ width: 'fit-content', height: 'fit-content', transform });

// ---------------------------------------------------------------------------------------------------
describe('§A the fixture, whole — a card in a bounded board, four live reads, three listeners, two snaps', () => {
  const page = home(app);

  test('A1 nothing refused: the only note is the router shell, 16 files, the drag lib and the two it leans on among them', () => {
    expect(app.notes).toEqual(['App: router shell — emitted as src/App.tsx by the scaffold']);
    expect(Object.keys(app.files)).toHaveLength(16);
    expect(app.files[DRAG_LIB_PATH]).toContain('export function useDrag(');
    // drag.ts runs its tween on animate.ts and raises on errors.ts — both ship with it, though nothing else here earns them.
    expect(app.files[ANIMATE_LIB_PATH]).toContain('export function startRun(');
    expect(app.files[ERRORS_LIB_PATH]).toContain('export function raiseAppError(');
    const plan = project.plans.find((p) => p.path === HOME)!;
    expect(plan.refusals).toEqual([]);
    expect(plan.drags).toHaveLength(1);
    expect(plan.drags[0].drops).toEqual([]);
    expect(summarizePreflight(app).refusals).toBe(0);
  });

  test('A2 the emitted app typechecks as a real program', () => {
    expect(typecheckEmittedApp(app)).toEqual([]);
  });

  test('A3 every emitted file parses', () => {
    for (const [name, source] of Object.entries(app.files)) {
      if (!/\.tsx?$/.test(name)) continue;
      const parsed = ts.createSourceFile(name, source, ts.ScriptTarget.ES2020, true, name.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
      const diagnostics = (parsed as unknown as { parseDiagnostics: ts.DiagnosticWithLocation[] }).parseDiagnostics;
      expect(diagnostics.map((d) => `${name}: ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`)).toEqual([]);
    }
  });

  test('A4 the hook line: provenance, the options in port order (a wire is the Variable\'s render local, an authored value a literal, an unset port absent), the three listeners inline', () => {
    expect(page).toContain("import { useDrag } from '../lib/drag';");
    expect(page).toContain(HOOK_LINE);
    expect(page).toContain("    onStart: () => status.set('dragging'),\n    onEnd: () => status.set('released'),\n    done: () => status.set('snapped')\n  });");
    // `enabled`, `useParentBounds`, `scale` and both Y-side snap ports were never set: absent, so the lib applies the declared defaults.
    expect(page).not.toContain('enabled:');
    expect(page).not.toContain('useParentBounds:');
    expect(page).not.toContain('scale:');
    expect(page).not.toContain('snapYDuration');
  });

  test('A5 the wrapper where the Drag sits, the card inside it, nothing else on it', () => {
    expect(page).toContain(`        ${WRAPPER}\n          <div className={styles.card}>\n            <p className={styles.text}>Card</p>\n          </div>\n        </div>`);
    // The wrapper is a plain div: no class (the Drag has no style ports), no DOM event attrs (the pulses are listeners).
    expect(page).not.toContain('onMouseDown=');
    expect(page).not.toContain('className={styles.drag');
  });

  test('A6 the four value reads print bare off the handle — numbers, never undefined, no fold', () => {
    expect(page).toContain('<p className={styles.text}>{card.x}</p>');
    expect(page).toContain('<p className={styles.text}>{card.y}</p>');
    expect(page).toContain('<p className={styles.text}>{card.deltaX}</p>');
    expect(page).toContain('<p className={styles.text}>{card.deltaY}</p>');
    expect(page).not.toContain("{card.x ?? ''}");
  });

  test('A7 the button fires both snaps as calls on the handle; the input writes the Variable the snap reads on arrival', () => {
    expect(page).toContain("<button onClick={() => { card.snapTo('x'); card.snapTo('y'); }}>Snap home</button>");
    expect(page).toContain('<input placeholder="Snap target X" onChange={(event) => homeX.set(event.target.value)} />');
    expect(page).toContain('const x = useValue(homeX);');
  });

  test('A8 the ledger row moved, so the picker card carries no badge; the floor is 111', () => {
    expect(ledgerEntryOf('Drag')?.status).toBe('translated');
    expect(exportBadgeOf('Drag')).toBeUndefined();
    const ledger = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'coverage-ledger.json'), 'utf8'));
    expect(ledger.pickerCoverageFloor).toBe(114); // §63 Drag + §61 the component-stack trio (session 86) on top of §57 + §58 + §59 (session 85)
  });

  test('A9 style.ts\'s own port list names exactly the option ports plan.ts prints (the two files cannot import each other)', () => {
    expect([...DRAG_OWN_PORTS].sort()).toEqual(DRAG_OPTION_PORTS.map((o) => o.port).sort());
  });
});

// ---------------------------------------------------------------------------------------------------
// §B — the hook under node: a fake React (useRef / useState / useEffect, effects run after the render that declared
// them), a fake DOM (an element with an offsetParent, computed styles, listeners; a document; a window with Node and
// HTMLElement), and a fake frame clock the test advances by hand. The three emitted libs are transpiled and loaded
// with a `require` shim, so `./animate` and `./errors` are the real emitted modules.
// ---------------------------------------------------------------------------------------------------
class FakeNode {}
class FakeElement extends FakeNode {
  ownerDocument: FakeDocument;
  parentNode: FakeElement | null = null;
  offsetParent: FakeElement | null = null;
  offsetLeft = 0;
  offsetTop = 0;
  clientWidth = 0;
  clientHeight = 0;
  scrollLeft = 0;
  scrollTop = 0;
  rect = { left: 0, top: 0 };
  computed: Record<string, string> = {};
  id = '';
  innerHTML = '';
  classes = new Set<string>();
  children: FakeElement[] = [];
  listeners = new Map<string, Set<(event: unknown) => void>>();
  listenerOptions = new Map<string, unknown>();
  classList = {
    add: (name: string) => this.classes.add(name),
    remove: (name: string) => this.classes.delete(name),
    contains: (name: string) => this.classes.has(name)
  };
  constructor(doc: FakeDocument) {
    super();
    this.ownerDocument = doc;
  }
  getBoundingClientRect() {
    return this.rect;
  }
  addEventListener(name: string, fn: (event: unknown) => void, options?: unknown) {
    if (!this.listeners.has(name)) this.listeners.set(name, new Set());
    this.listeners.get(name)!.add(fn);
    this.listenerOptions.set(name, options);
  }
  removeEventListener(name: string, fn: (event: unknown) => void) {
    this.listeners.get(name)?.delete(fn);
  }
  dispatch(name: string, event: Record<string, unknown>) {
    for (const fn of [...(this.listeners.get(name) ?? [])]) fn({ type: name, target: this, preventDefault: () => {}, ...event });
  }
  appendChild(el: FakeElement) {
    this.children.push(el);
    el.parentNode = this;
  }
  count(name: string): number {
    return this.listeners.get(name)?.size ?? 0;
  }
}
class FakeWindow {
  Node = FakeNode;
  HTMLElement = FakeElement;
  rangesCleared = 0;
  getComputedStyle(el: FakeElement) {
    return new Proxy(el.computed, { get: (target, key: string) => target[key] ?? '0px' });
  }
  getSelection() {
    return { type: 'Range', removeAllRanges: () => this.rangesCleared++ };
  }
}
class FakeDocument {
  defaultView = new FakeWindow();
  body = new FakeElement(this);
  head = new FakeElement(this);
  listeners = new Map<string, Set<(event: unknown) => void>>();
  getElementById(id: string) {
    return this.head.children.find((c) => c.id === id) ?? null;
  }
  createElement() {
    return new FakeElement(this);
  }
  getElementsByTagName(tag: string) {
    return tag === 'head' ? [this.head] : [];
  }
  addEventListener(name: string, fn: (event: unknown) => void) {
    if (!this.listeners.has(name)) this.listeners.set(name, new Set());
    this.listeners.get(name)!.add(fn);
  }
  removeEventListener(name: string, fn: (event: unknown) => void) {
    this.listeners.get(name)?.delete(fn);
  }
  dispatch(name: string, event: Record<string, unknown>) {
    for (const fn of [...(this.listeners.get(name) ?? [])]) fn({ type: name, preventDefault: () => {}, ...event });
  }
  count(name: string): number {
    return this.listeners.get(name)?.size ?? 0;
  }
}

type Handle = {
  ref: { current: FakeElement | null };
  style: { width: string; height: string; transform: string };
  handlers: { onMouseDown: (e: unknown) => void; onMouseUp: (e: unknown) => void; onTouchEnd: (e: unknown) => void };
  readonly x: number;
  readonly y: number;
  readonly deltaX: number;
  readonly deltaY: number;
  snapTo: (axis: 'x' | 'y') => void;
};
type Listeners = { onStart?: () => void; onMove?: () => void; onEnd?: () => void; done?: () => void };
type DragLib = { useDrag: (source: unknown, options: Record<string, unknown>, listeners?: Listeners) => Handle };
type ErrorsLib = { subscribeAppErrors: (fn: (error: unknown) => void) => () => void };
const SOURCE = { label: 'Card', nodeId: 'drag', componentName: '/Pages/Home' };

interface Harness {
  handle: Handle;
  render(options?: Record<string, unknown>, listeners?: Listeners): Handle;
  strictRemount(): void;
  unmount(): void;
  frame(now: number): void;
  pendingFrames(): number;
  dirty(): boolean;
  renders: number;
  doc: FakeDocument;
  board: FakeElement;
  el: FakeElement;
  errors: unknown[];
}

const transpile = (source: string): string =>
  ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;

const makeHarness = (options: Record<string, unknown> = {}, listeners: Listeners = {}): Harness => {
  const doc = new FakeDocument();
  doc.body.appendChild(doc.head); // any parent will do; getElementsByTagName answers the head directly
  const board = new FakeElement(doc);
  board.clientWidth = 320;
  board.clientHeight = 200;
  const el = new FakeElement(doc);
  el.clientWidth = 80;
  el.clientHeight = 80;
  el.offsetParent = board;
  board.appendChild(el);

  let frames: Array<((now: number) => void) | null> = [];
  const requestAnimationFrame = (cb: (now: number) => void): number => {
    frames.push(cb);
    return frames.length;
  };
  const cancelAnimationFrame = (id: number): void => {
    frames[id - 1] = null;
  };

  const slots: unknown[] = [];
  const effects: Array<{ deps?: unknown[]; cleanup?: () => void; fn: () => void | (() => void) }> = [];
  let cursor = 0;
  let pending: Array<{ slot: number; fn: () => void | (() => void); deps?: unknown[] }> = [];
  let isDirty = false;
  const same = (a?: unknown[], b?: unknown[]) => a !== undefined && b !== undefined && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const React = {
    useRef: (init: unknown) => {
      const i = cursor++;
      if (slots[i] === undefined) slots[i] = { current: init };
      return slots[i];
    },
    useState: (init: unknown) => {
      const i = cursor++;
      if (slots[i] === undefined) slots[i] = { value: typeof init === 'function' ? (init as () => unknown)() : init };
      const slot = slots[i] as { value: unknown };
      return [
        slot.value,
        (next: unknown) => {
          slot.value = typeof next === 'function' ? (next as (v: unknown) => unknown)(slot.value) : next;
          isDirty = true;
        }
      ];
    },
    useEffect: (fn: () => void | (() => void), deps?: unknown[]) => {
      pending.push({ slot: cursor++, fn, deps });
    }
  };

  const modules: Record<string, { exports: Record<string, unknown> }> = {};
  const load = (name: string, source: string) => {
    const module = { exports: {} as Record<string, unknown> };
    modules[name] = module;
    // eslint-disable-next-line no-new-func
    new Function('require', 'module', 'exports', 'window', 'document', 'requestAnimationFrame', 'cancelAnimationFrame', transpile(source))(
      (specifier: string) => {
        if (specifier === 'react') return React;
        const found = modules[specifier.replace(/^\.\//, '')];
        if (found === undefined) throw new Error(`unexpected import ${specifier}`);
        return found.exports;
      },
      module,
      module.exports,
      doc.defaultView,
      doc,
      requestAnimationFrame,
      cancelAnimationFrame
    );
    return module.exports;
  };
  const errorsLib = load('errors', errorsLibSource()) as unknown as ErrorsLib;
  load('animate', animateLibSource());
  const drag = load('drag', dragLibSource()) as unknown as DragLib;
  const errors: unknown[] = [];
  errorsLib.subscribeAppErrors((error) => errors.push(error));

  let currentOptions = options;
  let currentListeners = listeners;
  const harness: Harness = {
    handle: undefined as unknown as Handle,
    renders: 0,
    doc,
    board,
    el,
    errors,
    render(nextOptions, nextListeners) {
      if (nextOptions !== undefined) currentOptions = nextOptions;
      if (nextListeners !== undefined) currentListeners = nextListeners;
      let out!: Handle;
      do {
        isDirty = false;
        cursor = 0;
        pending = [];
        harness.renders++;
        out = drag.useDrag(SOURCE, currentOptions, currentListeners);
        if (out.ref.current === null) out.ref.current = el; // React attaches the ref before the effects run
        for (const e of pending) {
          const prev = effects[e.slot];
          if (prev !== undefined && same(prev.deps, e.deps)) continue;
          prev?.cleanup?.();
          const cleanup = e.fn();
          effects[e.slot] = { deps: e.deps, fn: e.fn, cleanup: typeof cleanup === 'function' ? cleanup : undefined };
        }
      } while (isDirty);
      harness.handle = out;
      return out;
    },
    strictRemount() {
      // StrictMode: every effect's cleanup, then every effect again, with no render between.
      for (const e of effects) e?.cleanup?.();
      for (const e of effects) {
        if (e === undefined) continue;
        const cleanup = e.fn();
        e.cleanup = typeof cleanup === 'function' ? cleanup : undefined;
      }
    },
    unmount() {
      for (const e of effects) e?.cleanup?.();
    },
    frame(now) {
      const due = frames;
      frames = [];
      for (const cb of due) if (cb !== null) cb(now);
    },
    pendingFrames: () => frames.filter((f) => f !== null).length,
    dirty: () => isDirty
  };
  harness.render();
  return harness;
};

const mouse = (clientX: number, clientY: number, button = 0) => ({ button, clientX, clientY });
const down = (h: Harness, x: number, y: number, button = 0) => h.handle.handlers.onMouseDown({ nativeEvent: { type: 'mousedown', target: h.el, preventDefault: () => {}, ...mouse(x, y, button) } });
const move = (h: Harness, x: number, y: number) => h.doc.dispatch('mousemove', mouse(x, y));
const up = (h: Harness, x: number, y: number) => h.doc.dispatch('mouseup', mouse(x, y));
const values = (h: Harness) => ({ x: h.handle.x, y: h.handle.y, deltaX: h.handle.deltaX, deltaY: h.handle.deltaY });

describe('§B useDrag runs the way Drag.tsx and react-draggable run (hook harness under node)', () => {
  test('B1 mount: Start Drag X/Y as the position, deltas 0, the transform, one native touchstart (passive: false)', () => {
    const h = makeHarness({ axis: 'both', startX: 20, startY: 20 });
    expect(values(h)).toEqual({ x: 20, y: 20, deltaX: 0, deltaY: 0 });
    expect(h.handle.style).toEqual(wrapperStyle('translate(20px,20px)'));
    expect(h.el.count('touchstart')).toBe(1);
    expect(h.el.listenerOptions.get('touchstart')).toEqual({ passive: false });
    expect(h.doc.count('mousemove')).toBe(0);
  });

  test('B2 a falsy Start Drag is 0 (`inputPositionX ? inputPositionX : 0`)', () => {
    const h = makeHarness({ startX: '', startY: null });
    expect(values(h)).toEqual({ x: 0, y: 0, deltaX: 0, deltaY: 0 });
  });

  test('B3 Drag Started: the outputs (position, deltas 0) are written BEFORE the pulse, the document listeners go on, the selection hack goes on', () => {
    const seen: unknown[] = [];
    const h = makeHarness({ axis: 'both', startX: 20, startY: 20 }, { onStart: () => seen.push(values(h)) });
    down(h, 100, 100);
    expect(seen).toEqual([{ x: 20, y: 20, deltaX: 0, deltaY: 0 }]);
    expect(h.doc.count('mousemove')).toBe(1);
    expect(h.doc.count('mouseup')).toBe(1);
    expect(h.doc.body.classes.has('react-draggable-transparent-selection')).toBe(true);
    expect(h.doc.getElementById('react-draggable-style-el')?.innerHTML).toContain('*::selection {all: inherit;}');
    expect(h.dirty()).toBe(true);
  });

  test('B4 Drag Moved: position = live + delta / scale, the outputs written before the pulse, a re-render moves the transform', () => {
    const seen: unknown[] = [];
    const h = makeHarness({ axis: 'both', startX: 20, startY: 20 }, { onMove: () => seen.push(values(h)) });
    down(h, 100, 100);
    move(h, 130, 110);
    expect(seen).toEqual([{ x: 50, y: 30, deltaX: 30, deltaY: 10 }]);
    expect(h.handle.style).toEqual(wrapperStyle('translate(20px,20px)')); // the last render's
    h.render();
    expect(h.handle.style).toEqual(wrapperStyle('translate(50px,30px)'));
  });

  test('B5 bounds "parent" clamp against the parent\'s inner box and keep the overshoot as slack, so the element does not lag on the way back', () => {
    const h = makeHarness({ axis: 'both', startX: 20, startY: 20 });
    down(h, 100, 100);
    move(h, 130, 110);
    move(h, 400, 400); // 350/320 wanted; the box allows 320−80 = 240 and 200−80 = 120
    expect(values(h)).toEqual({ x: 240, y: 120, deltaX: 190, deltaY: 90 });
    move(h, 380, 380); // still past the edge: the slack absorbs it, nothing moves
    expect(values(h)).toEqual({ x: 240, y: 120, deltaX: 0, deltaY: 0 });
    // back: the slack is paid down first. Slack after (400,400): x 320−240 = 80, y 320−120 = 200; after (380,380):
    // x 80+(220−240) = 60, y 200+(100−120) = 180. So x 240−180+60 = 120, y 120−180+180 = 120 — the library's own sums
    // (the first prediction here said 150; the lib was right and the arithmetic was mine).
    move(h, 200, 200);
    expect(values(h)).toEqual({ x: 120, y: 120, deltaX: -120, deltaY: 0 });
  });

  test('B6 Constrain to parent false: no clamp, no slack', () => {
    const h = makeHarness({ axis: 'both', startX: 20, startY: 20, useParentBounds: false });
    down(h, 100, 100);
    move(h, 400, 400);
    expect(values(h)).toEqual({ x: 320, y: 320, deltaX: 300, deltaY: 300 });
  });

  test('B7 Drag Ended: the commit, positionX/Y written (no deltas) before the pulse, listeners off, the selection hack off a frame later', () => {
    const seen: unknown[] = [];
    const h = makeHarness({ axis: 'both', startX: 20, startY: 20 }, { onEnd: () => seen.push(values(h)) });
    down(h, 100, 100);
    move(h, 130, 110);
    up(h, 130, 110);
    expect(seen).toEqual([{ x: 50, y: 30, deltaX: 30, deltaY: 10 }]);
    expect(h.doc.count('mousemove')).toBe(0);
    expect(h.doc.count('mouseup')).toBe(0);
    h.render();
    expect(h.handle.style).toEqual(wrapperStyle('translate(50px,30px)'));
    expect(h.doc.body.classes.has('react-draggable-transparent-selection')).toBe(true);
    h.frame(1);
    expect(h.doc.body.classes.has('react-draggable-transparent-selection')).toBe(false);
    expect(h.doc.defaultView.rangesCleared).toBe(1);
    // A second mouseup (the element's own after the document's) is a no-op.
    h.handle.handlers.onMouseUp({ nativeEvent: { type: 'mouseup', target: h.el, ...mouse(130, 110) } });
    expect(seen).toHaveLength(1);
  });

  test('B8 axis "x": the element moves on X only, the outputs report both axes, and on release Drag Y is the pointer\'s Y while the element stays — the runtime\'s own answer', () => {
    const h = makeHarness({ axis: 'x', startX: 20, startY: 20 });
    down(h, 100, 100);
    move(h, 130, 110);
    h.render();
    expect(h.handle.style).toEqual(wrapperStyle('translate(50px,20px)'));
    expect(values(h)).toEqual({ x: 50, y: 30, deltaX: 30, deltaY: 10 });
    up(h, 130, 110);
    h.render();
    expect(h.handle.style).toEqual(wrapperStyle('translate(50px,20px)'));
    expect(h.handle.y).toBe(30);
  });

  test('B9 the axis default is "x" (the node\'s, not the library\'s "both"); an unknown axis drags on neither', () => {
    const h = makeHarness({ startX: 20, startY: 20 });
    down(h, 100, 100);
    move(h, 130, 110);
    up(h, 130, 110);
    h.render();
    expect(h.handle.style).toEqual(wrapperStyle('translate(50px,20px)'));
    const odd = makeHarness({ axis: 'diagonal', startX: 20, startY: 20 });
    down(odd, 100, 100);
    move(odd, 130, 110);
    odd.render();
    expect(odd.handle.style).toEqual(wrapperStyle('translate(20px,20px)'));
    expect(values(odd)).toEqual({ x: 50, y: 30, deltaX: 30, deltaY: 10 });
  });

  test('B10 Scale divides the pointer delta; 0 and a non-number are 1 (NDA-012\'s `|| 1`)', () => {
    const h = makeHarness({ axis: 'both', startX: 20, startY: 20, scale: 2 });
    down(h, 100, 100);
    move(h, 130, 110);
    expect(values(h)).toEqual({ x: 35, y: 25, deltaX: 15, deltaY: 5 });
    const zero = makeHarness({ axis: 'both', startX: 20, startY: 20, scale: 0 });
    down(zero, 100, 100);
    move(zero, 130, 110);
    expect(values(zero)).toEqual({ x: 50, y: 30, deltaX: 30, deltaY: 10 });
  });

  test('B11 Enabled false: a press starts nothing; a secondary button starts nothing', () => {
    const seen: string[] = [];
    const h = makeHarness({ axis: 'both', enabled: false }, { onStart: () => seen.push('start') });
    down(h, 100, 100);
    expect(seen).toEqual([]);
    expect(h.doc.count('mousemove')).toBe(0);
    const right = makeHarness({ axis: 'both' }, { onStart: () => seen.push('start') });
    down(right, 100, 100, 2);
    expect(seen).toEqual([]);
  });

  test('B12 touch: the finger that started the drag is the one followed; another finger\'s move is ignored; touchend ends it', () => {
    const seen: string[] = [];
    const h = makeHarness({ axis: 'both', startX: 20, startY: 20 }, { onStart: () => seen.push('start'), onMove: () => seen.push('move'), onEnd: () => seen.push('end') });
    let prevented = 0;
    h.el.dispatch('touchstart', { targetTouches: [{ identifier: 7, clientX: 100, clientY: 100 }], changedTouches: [], preventDefault: () => prevented++ });
    expect(prevented).toBe(1);
    expect(h.doc.count('touchmove')).toBe(1);
    h.doc.dispatch('touchmove', { targetTouches: [{ identifier: 9, clientX: 900, clientY: 900 }], changedTouches: [] });
    expect(values(h)).toEqual({ x: 20, y: 20, deltaX: 0, deltaY: 0 });
    h.doc.dispatch('touchmove', { targetTouches: [], changedTouches: [{ identifier: 7, clientX: 130, clientY: 110 }] });
    expect(values(h)).toEqual({ x: 50, y: 30, deltaX: 30, deltaY: 10 });
    h.doc.dispatch('touchend', { targetTouches: [], changedTouches: [{ identifier: 7, clientX: 130, clientY: 110 }] });
    expect(seen).toEqual(['start', 'move', 'end']);
    expect(h.doc.count('touchmove')).toBe(0);
  });

  test('B13 snapTo: Done fires at the call; the tween joins on the next frame, eases out over Duration, writes Drag X every frame and no delta', () => {
    const seen: string[] = [];
    const h = makeHarness({ axis: 'both', startX: 20, startY: 20, snapX: 100, snapXDuration: 200 }, { done: () => seen.push('done'), onMove: () => seen.push('move') });
    h.handle.snapTo('x');
    expect(seen).toEqual(['done']);
    expect(h.handle.x).toBe(20);
    expect(h.pendingFrames()).toBe(1);
    h.frame(1000); // joins: onRunning(0) — the start value
    expect(h.handle.x).toBe(20);
    h.frame(1100); // t = 0.5 → easeOutCubic: 80 × 0.875 + 20
    expect(h.handle.x).toBe(90);
    expect(h.handle.deltaX).toBe(0);
    h.frame(1200);
    expect(h.handle.x).toBe(100);
    expect(h.pendingFrames()).toBe(0);
    h.render();
    expect(h.handle.style).toEqual(wrapperStyle('translate(100px,20px)'));
    expect(seen).toEqual(['done']);
  });

  test('B14 a snap to where it already is starts nothing and still reports Done (the method returns nothing, so the outcome is done)', () => {
    const seen: string[] = [];
    const h = makeHarness({ axis: 'both', startX: 20, startY: 20, snapX: 20 }, { done: () => seen.push('done') });
    h.handle.snapTo('x');
    expect(seen).toEqual(['done']);
    expect(h.pendingFrames()).toBe(0);
  });

  test('B15 the snap Value arrives through readSnapCoordinate: a numeric string is a number, an empty value abstains, a non-number raises and abstains', () => {
    const h = makeHarness({ axis: 'both', startX: 20, startY: 20, snapX: '150', snapXDuration: 0 });
    h.handle.snapTo('x');
    h.frame(1);
    h.frame(2);
    expect(h.handle.x).toBe(150);
    h.render({ axis: 'both', startX: 20, startY: 20, snapX: '', snapXDuration: 0 });
    h.handle.snapTo('x'); // the register still says 150 — a no-op, not a jump to 0
    h.frame(7);
    h.frame(8);
    expect(h.handle.x).toBe(150);
    h.render({ axis: 'both', startX: 20, startY: 20, snapX: 'abc', snapXDuration: 0 });
    expect(h.errors).toEqual([
      {
        code: 'drag/snap-position-not-a-number',
        message: 'Snap To Position X — Value cannot be read as a number (got "abc"), so the snap position is unchanged.',
        nodeId: 'drag',
        componentName: '/Pages/Home',
        nodeType: 'Drag'
      }
    ]);
    h.render({ axis: 'both', startX: 20, startY: 20, snapX: 40, snapXDuration: 0 });
    h.handle.snapTo('x');
    h.frame(3);
    h.frame(4);
    expect(h.handle.x).toBe(40); // the last accepted value; '' and 'abc' left the register alone
    // Y never set: the register is 0 — the node's initialize seeds it.
    h.handle.snapTo('y');
    h.frame(5);
    h.frame(6);
    expect(h.handle.y).toBeCloseTo(19.80066, 4); // duration Y unset → 300: one frame at +1 ms eases 20 → 0 by a hair
  });

  test('B16 Duration: unset is 300; 0 jumps on the first running frame; a numeric string counts', () => {
    const h = makeHarness({ axis: 'both', startX: 20, startY: 20, snapX: 100 });
    h.handle.snapTo('x');
    h.frame(1000);
    h.frame(1150); // t = 0.5 of 300
    expect(h.handle.x).toBe(90);
    const jump = makeHarness({ axis: 'both', startX: 20, startY: 20, snapX: 100, snapXDuration: 0 });
    jump.handle.snapTo('x');
    jump.frame(1);
    expect(jump.handle.x).toBe(20);
    jump.frame(2);
    expect(jump.handle.x).toBe(100);
    const str = makeHarness({ axis: 'both', startX: 20, startY: 20, snapX: 100, snapXDuration: '400' });
    str.handle.snapTo('x');
    str.frame(1000);
    str.frame(1200);
    expect(str.handle.x).toBe(90);
  });

  test('B17 a drag that starts mid-snap stops the tween where it is (Drag.tsx onStart stops both timers)', () => {
    const h = makeHarness({ axis: 'both', startX: 20, startY: 20, snapX: 100, snapXDuration: 200 });
    h.handle.snapTo('x');
    h.frame(1000);
    h.frame(1050); // t = 0.25 → 80 × 0.578125 + 20
    expect(h.handle.x).toBe(66.25);
    down(h, 100, 100);
    expect(h.handle.x).toBe(66.25);
    h.frame(1200);
    expect(h.handle.x).toBe(66.25);
    expect(h.pendingFrames()).toBe(0);
  });

  test('B18 a changed Start Drag X is adopted raw, reported, and Delta X is the difference (componentDidUpdate)', () => {
    const h = makeHarness({ axis: 'both', startX: 20, startY: 20 });
    h.render({ axis: 'both', startX: 60, startY: 20 });
    expect(values(h)).toEqual({ x: 60, y: 20, deltaX: 40, deltaY: 0 });
    expect(h.handle.style).toEqual(wrapperStyle('translate(60px,20px)'));
  });

  test('B19 unmount: every listener off, a running snap stopped (NDA-012 H1)', () => {
    const h = makeHarness({ axis: 'both', startX: 20, startY: 20, snapX: 100, snapXDuration: 200 });
    down(h, 100, 100);
    up(h, 100, 100);
    h.handle.snapTo('x');
    h.frame(1000);
    h.unmount();
    expect(h.el.count('touchstart')).toBe(0);
    expect(h.doc.count('mousemove')).toBe(0);
    h.frame(1100);
    expect(h.handle.x).toBe(20);
  });

  test('B20 StrictMode\'s double mount leaves one touchstart listener and moves nothing', () => {
    const h = makeHarness({ axis: 'both', startX: 20, startY: 20 });
    h.strictRemount();
    expect(h.el.count('touchstart')).toBe(1);
    expect(values(h)).toEqual({ x: 20, y: 20, deltaX: 0, deltaY: 0 });
  });

  test('B21 🔴 the getters are live: a Drag Moved chain reads THIS frame\'s value, not the render it closed over', () => {
    const seen: number[] = [];
    const h = makeHarness({ axis: 'both', startX: 20, startY: 20 });
    const handle = h.handle; // the render's handle, as a listener closes over it
    h.render(undefined, { onMove: () => seen.push(handle.x) });
    down(h, 100, 100);
    move(h, 130, 110);
    move(h, 160, 110);
    expect(seen).toEqual([50, 80]);
  });
});

// ---------------------------------------------------------------------------------------------------
describe('§C the refused shapes, by mutation — each sentence exact', () => {
  test('C1 no child: refused whole, the marker where it sat, no hook, no lib', () => {
    const ir = cloneIr();
    nodeOf(ir, HOME, 'drag').children = [];
    disconnect(componentOf(ir, HOME), (c) => c.fromId === 'card' || c.toId === 'card');
    const reason = 'it has no child to drag — a Drag with no child renders nothing (Drag.tsx returns null)';
    expect(notesOf(ir)).toContain(`node drag (Drag) deferred: ${reason}`);
    const out = emitApp(ir, catalog);
    expect(home(out)).toContain(reason);
    expect(home(out)).not.toContain('useDrag(');
    expect(out.files[DRAG_LIB_PATH]).toBeUndefined();
  });

  test('C2 Completed consumed: UUID\'s sentence, and the node is refused whole', () => {
    const ir = cloneIr();
    connect(componentOf(ir, HOME), 'drag', 'completed', 'setSnapped', 'do');
    expect(notesOf(ir)).toContain(
      'node drag (Drag) deferred: its Completed output is consumed — it fires after every outcome, and this slice emits the outcome arms rather than a join beneath them'
    );
    expect(home(emitApp(ir, catalog))).not.toContain('useDrag(');
  });

  test('C3 a pulse into a value sink: a pulse carries nothing to read', () => {
    const ir = cloneIr();
    connect(componentOf(ir, HOME), 'drag', 'onDrag', 'xText', 'text', 'value');
    expect(notesOf(ir)).toContain('node drag (Drag) deferred: its Drag Moved output is consumed as a value — a pulse carries nothing to read');
  });

  test('C4 an output the node has not got; an input the node has not got', () => {
    const outIr = cloneIr();
    connect(componentOf(outIr, HOME), 'drag', 'momentum', 'xText', 'text', 'value');
    expect(notesOf(outIr)).toContain('node drag (Drag) deferred: its momentum output is not a port this node has');
    const inIr = cloneIr();
    connect(componentOf(inIr, HOME), 'homeX', 'value', 'drag', 'friction', 'value');
    expect(notesOf(inIr)).toContain('node drag (Drag) deferred: its friction input is not a port this node has');
  });

  test('C5 two wires on one option port — last-writer-wins is not statically ordered', () => {
    const ir = cloneIr();
    connect(componentOf(ir, HOME), 'status', 'value', 'drag', 'snapToPositionX.value', 'value');
    expect(notesOf(ir)).toContain(
      'node drag (Drag) deferred: two wires feed its Snap To Position X — Value input — last-writer-wins is not statically ordered'
    );
  });

  test('C6 an option fed a received event\'s payload (a handler-only value): dropped by name with a marker, the hook prints without it, the wrapper still drags', () => {
    const ir = cloneIr();
    const component = componentOf(ir, HOME);
    addNode(component, { id: 'nudgeSend', type: 'Event Sender', parameters: [{ name: 'channelName', value: { kind: 'literal', value: 'nudge' } }, { name: 'payload', value: { kind: 'literal', value: 'amount' } }] });
    addNode(component, { id: 'onNudge', type: 'Event Receiver', parameters: [{ name: 'channelName', value: { kind: 'literal', value: 'nudge' } }], portKnowledge: 'partial' });
    connect(component, 'onNudge', 'amount', 'drag', 'scale', 'value');
    const out = emitApp(ir, catalog);
    expect(out.notes).toContain('Pages/Home: wire onNudge:amount->drag:scale dropped: Drag drag: its Scale input is dropped — it reads a value that only exists inside a handler');
    expect(home(out)).toContain(HOOK_LINE);
    expect(home(out)).not.toContain('scale:');
    expect(home(out)).toContain('the wire into "scale"');
    expect(home(out)).toContain(WRAPPER);
    expect(planOf(ir, HOME).drags[0].drops).toEqual([{ subject: 'the wire into "scale"', reason: 'it reads a value that only exists inside a handler' }]);
  });

  test('C6b ⚠️ a text input\'s live text into an option is NOT handler-only: the controlled-state slice mints a state row for a control read outside its own onChange (§57.4\'s trap, again), and the option is that row', () => {
    const ir = cloneIr();
    connect(componentOf(ir, HOME), 'targetInput', 'onTextChanged', 'drag', 'scale', 'value');
    const out = emitApp(ir, catalog);
    expect(out.notes).toEqual(['App: router shell — emitted as src/App.tsx by the scaffold']);
    expect(home(out)).toContain('scale: snapTarget,');
    expect(home(out)).toContain('const [snapTarget, setSnapTarget] = useState');
    expect(planOf(ir, HOME).drags[0].options.find((o) => o.key === 'scale')?.expr).toEqual({ kind: 'state-get', name: 'snapTarget' });
  });

  test('C7 an option fed by a node with no rule: dropped with that node\'s own sentence', () => {
    const ir = cloneIr();
    const component = componentOf(ir, HOME);
    addNode(component, { id: 'extractor', type: 'net.noodl.PatternExtractor' });
    connect(component, 'extractor', 'result', 'drag', 'scale', 'value');
    const out = emitApp(ir, catalog);
    const note = out.notes.find((n) => n.includes('drag:scale dropped'));
    expect(note).toContain('Drag drag: its Scale input is dropped — ');
    expect(home(out)).not.toContain('scale:');
    expect(home(out)).toContain(WRAPPER);
  });

  test('C8 a listener chain that does not translate: §57\'s sentence, the marker, the other listeners kept', () => {
    const ir = cloneIr();
    const component = componentOf(ir, HOME);
    addNode(component, { id: 'go', type: 'RouterNavigate' });
    connect(component, 'drag', 'onDrag', 'go', 'navigate');
    const out = emitApp(ir, catalog);
    expect(out.notes).toContain(
      'Pages/Home: wire drag:onDrag->go:navigate dropped: Drag drag: its Drag Moved chain did not translate — navigation target undefined is not a routed page; the wrapper still drags'
    );
    expect(home(out)).toContain("    onStart: () => status.set('dragging'),\n    onEnd: () => status.set('released'),\n    done: () => status.set('snapped')\n  });");
    expect(home(out)).not.toContain('onMove:');
    expect(home(out)).toContain('the "onDrag" signal');
    expect(summarizePreflight(out).refusals).toBe(1);
  });

  test('C9 Failure consumed: dropped with the note that it cannot fire here; nothing else changes', () => {
    const ir = cloneIr();
    connect(componentOf(ir, HOME), 'drag', 'failure', 'setSnapped', 'do');
    const out = emitApp(ir, catalog);
    expect(out.notes).toContain(
      'Pages/Home: wire drag:failure->setSnapped:do dropped: Drag drag: its Failure chain is not emitted — Failure fires only when a snap reaches a Drag that has not mounted (drag.ts outcomeOnInnerComponent), and the emitted element is mounted whenever a handler in this component can run'
    );
    expect(home(out)).toContain("    done: () => status.set('snapped')\n  });");
    expect(home(out)).not.toContain('failure:');
  });

  test('C10 a second child: the runtime draws only the first — the rest named, not drawn', () => {
    const ir = cloneIr();
    const component = componentOf(ir, HOME);
    addNode(component, { id: 'ghost', type: 'Text', parent: 'drag', parameters: [{ name: 'text', value: { kind: 'literal', value: 'ghost' } }] });
    nodeOf(ir, HOME, 'drag').children = ['card', 'ghost'];
    const reason = 'the runtime draws only the first child of a Drag (Drag.tsx renders React.Children.toArray(children)[0])';
    expect(notesOf(ir)).toContain(`node ghost (Text) deferred: ${reason}`);
    const page = home(emitApp(ir, catalog));
    expect(page).toContain(WRAPPER);
    expect(page).toContain('<p className={styles.text}>Card</p>');
    expect(page).not.toContain('>ghost<');
    expect(page).toContain(reason);
  });

  test('C11 a snap Do from a trigger the attach pass cannot take: the attach pass\'s sentence — and the wrapper still prints', () => {
    const ir = cloneIr();
    const component = componentOf(ir, HOME);
    disconnect(component, (c) => c.toProperty === 'snapToPositionX.do');
    addNode(component, { id: 'idle', type: 'Delay' });
    connect(component, 'idle', 'timerFinished', 'drag', 'snapToPositionX.do');
    const out = emitApp(ir, catalog);
    expect(out.notes).toContain('Pages/Home: wire idle:timerFinished->drag:snapToPositionX.do dropped: the trigger is not a rendered element event or a receiver');
    expect(home(out)).toContain(WRAPPER);
    expect(home(out)).toContain("<button onClick={() => card.snapTo('y')}>Snap home</button>");
  });

  test('C12 the generic visual ports are not this row\'s: a Bounding Box read and a Did Mount pulse take the sentences a Group\'s take', () => {
    const boxIr = cloneIr();
    connect(componentOf(boxIr, HOME), 'drag', 'boundingWidth', 'xText', 'text', 'value');
    const boxNotes = notesOf(boxIr);
    expect(boxNotes).toContain('wire drag:boundingWidth->xText:text has no deterministic translation in step 5 (deferred to EXP-003)');
    expect(home(emitApp(boxIr, catalog))).toContain(WRAPPER);
    const mountIr = cloneIr();
    connect(componentOf(mountIr, HOME), 'drag', 'didMount', 'setSnapped', 'do');
    expect(notesOf(mountIr)).toContain('signal drag.didMount has no DOM event equivalent — dropped, reported');
  });

  test('C13 a wired Mounted on the Drag wraps the wrapper, as it wraps any rendered node', () => {
    const ir = cloneIr();
    const component = componentOf(ir, HOME);
    addNode(component, { id: 'shown', type: 'Variable2', parameters: [{ name: 'name', value: { kind: 'literal', value: 'shown' } }] });
    connect(component, 'shown', 'value', 'drag', 'mounted', 'value');
    const page = home(emitApp(ir, catalog));
    // An untyped Variable at a truthiness sink coerces `!!` — the rule every rendered node's mounted takes.
    expect(page).toContain(`{!!shownValue && (\n          ${WRAPPER}`);
  });

  test('C14 a Drag X read into a signal port: the attach pass\'s sentence, the node kept', () => {
    const ir = cloneIr();
    connect(componentOf(ir, HOME), 'drag', 'positionX', 'setSnapped', 'do', 'value');
    const out = emitApp(ir, catalog);
    expect(out.notes).toContain('Pages/Home: wire drag:positionX->setSnapped:do dropped: the trigger is not a rendered element event or a receiver');
    expect(home(out)).toContain(WRAPPER);
  });

  test('C15 the corpus stays clean: no marker, no TODO on the fixture', () => {
    expect(home(app)).not.toContain('TODO(export)');
  });
});

// ---------------------------------------------------------------------------------------------------
describe('§D the shapes a wire changes — the options read where the props are read', () => {
  test('D1 a wired Scale off a Variable prints the render local; authored Enabled / Constrain to parent print as literals', () => {
    const ir = cloneIr();
    const drag = nodeOf(ir, HOME, 'drag');
    setParam(drag, 'enabled', { kind: 'literal', value: false });
    setParam(drag, 'useParentBounds', { kind: 'literal', value: false });
    connect(componentOf(ir, HOME), 'homeX', 'value', 'drag', 'scale', 'value');
    const out = emitApp(ir, catalog);
    expect(home(out)).toContain("{ axis: 'both', enabled: false, useParentBounds: false, scale: x, startX: 20, startY: 20, snapX: x, snapXDuration: 200, snapY: 0 }");
    expect(typecheckEmittedApp(out)).toEqual([]);
  });

  test('D2 a Drag with nothing read, nothing wired, no snap: the hook still prints (the wrapper needs it), with no listeners argument', () => {
    const ir = cloneIr();
    const component = componentOf(ir, HOME);
    disconnect(component, (c) => c.fromId === 'drag' || c.toId === 'drag');
    const drag = nodeOf(ir, HOME, 'drag');
    drag.parameters = [];
    const out = emitApp(ir, catalog);
    expect(home(out)).toContain("const card = useDrag({ label: 'Card', nodeId: 'drag', componentName: '/Pages/Home' }, {});");
    expect(home(out)).toContain(WRAPPER);
    expect(typecheckEmittedApp(out)).toEqual([]);
  });

  test('D3 a Drag X read as a Condition\'s input is the getter as the effect\'s dependency, never the handle', () => {
    const ir = cloneIr();
    const component = componentOf(ir, HOME);
    addNode(component, { id: 'farRight', type: 'Condition', parameters: [{ name: 'operator', value: { kind: 'literal', value: 'greater' } }, { name: 'valueB', value: { kind: 'literal', value: 100 } }] });
    // The Condition's input port is `condition` (the catalog, not the panel: §59's E7 again) — a number is its truthiness.
    connect(component, 'drag', 'positionX', 'farRight', 'condition', 'value');
    connect(component, 'farRight', 'ontrue', 'setSnapped', 'do');
    const page = home(emitApp(ir, catalog));
    expect(page).toContain("  useEffect(() => {\n    if (card.x) status.set('snapped');\n  }, [card.x]);");
    expect(page).not.toContain('}, [card]);');
  });
});

// ---------------------------------------------------------------------------------------------------
describe('§F the findings pinned', () => {
  test('F1 a String node\'s output port is `savedValue` — the fixture wires it so, and the three chains translate', () => {
    const wires = componentOf(baseIr, HOME).connections.filter((c) => c.toProperty === 'value' && c.toId.startsWith('set'));
    expect(wires.map((w) => w.fromProperty)).toEqual(['savedValue', 'savedValue', 'savedValue']);
    expect(planOf(baseIr, HOME).drags[0].listeners).toEqual({
      onStart: [expect.objectContaining({ kind: 'store-set', variableName: 'status' })],
      onEnd: [expect.objectContaining({ kind: 'store-set', variableName: 'status' })],
      done: [expect.objectContaining({ kind: 'store-set', variableName: 'status' })]
    });
  });

  test('F2 🔴 the Drag stays `static` in its own report — the attach pass had written "collapsed into snapBtn" over a rendered sink (the Checkbox precedent); the chains collapse into the Drag', () => {
    const plan = project.plans.find((p) => p.path === HOME)!;
    expect(plan.dispositions['drag']).toEqual({ kind: 'static' });
    expect(plan.dispositions['snapBtn']).toEqual({ kind: 'static' });
    expect(plan.dispositions['setDragging']).toEqual({ kind: 'collapsed', into: 'drag' });
    expect(plan.dispositions['draggingLabel']?.kind).toBe('collapsed');
    expect(dispositionOf(baseIr, 'homeX')).toBeDefined();
  });

  test('F3 🔴 the wrapper is the child\'s box — `width`/`height: fit-content` (the §63.6 drive: an unstyled flex item stretched to the board\'s 320 px, so `bounds: \'parent\'` measured 320 − 320 and pinned x at −offsetLeft; the interpreter drags the 80 px card itself)', () => {
    const lib = app.files['src/lib/drag.ts'];
    expect(lib).toContain("style: { width: 'fit-content', height: 'fit-content', transform: `translate(${transformX}px,${transformY}px)` }");
    expect(lib).toContain('an unstyled flex item would STRETCH');
    // The page prints the handle's style verbatim — nothing else sizes the wrapper (no class, no inline width).
    expect(app.files['src/pages/Home.tsx']).toContain(WRAPPER);
    expect(app.files['src/pages/Home.tsx']).not.toMatch(/style=\{\{[^}]*width/);
  });
});
