import * as fs from 'fs';
import * as path from 'path';

import * as ts from 'typescript';

import { Catalog, CatalogIndex } from '../src/catalog';
import { ComponentPlan, STREAM_NODES, SUBSCRIBE_TO_CHANGES_TYPE, planProject } from '../src/analyze/plan';
import { emitApp } from '../src/emit/emitApp';
import { ERRORS_LIB_PATH } from '../src/emit/errorsLib';
import { REALTIME_LIB_PATH, realtimeLibSource } from '../src/emit/realtimeLib';
import { SSE_LIB_PATH } from '../src/emit/sseLib';
import { STREAMING_LIB_PATH } from '../src/emit/streamingLib';
import { WEBSOCKET_LIB_PATH } from '../src/emit/websocketLib';
import { exportBadgeOf, ledgerEntryOf } from '../src/ledger';
import { parseProject } from '../src/parse/parseProject';
import { ComponentIR, ConnectionIR, ExportIR, NodeIR, ParamValue } from '../src/ir/types';

/**
 * EXP-011 §66 — `Subscribe To Changes` (`SubscribeToChanges`), Tier 3.11's third transport and the last scheduled node.
 *
 * The sixth member of the streaming table (§58, §64, §65): no data port and no Actions, the Class (a runtime-discovered
 * `collectionName` parameter) and Enabled as the options, the five signal outputs as listeners, every Realtime output a
 * live getter. `src/lib/realtime.ts` transcribes the node (`subscribetochanges.ts`: reconfigure on every setter, the
 * `!== false` reading of Enabled, the four value writes then the pulses, the Failure pulse then the raise) and the
 * runtime's realtime layer for the built-in backend — `RealtimeSubscription.ts` (one reconnection funnel per socket, the
 * confirmation deadline, fatal-as-data, the 1s→30s backoff), `SseTransport.ts` (the NodeGX dialect: GET /realtime with
 * the session token, the `connected` hello, POST /realtime/subscriptions read by its BODY, `change` and `resync`) and
 * `SseConnectionPool.ts` (one EventSource per backend shared by every unfiltered subscription, the union re-POSTed on
 * every membership change and every hello). It imports `../api/client` (EXP-009's endpoint and session) and `./errors`.
 *
 * Measured before the build (probe-reverted.log, HEAD c58c2430): 22 refusals — the node `logic node (SubscribeToChanges)`,
 * the five Set Variables `trigger feed.created is not a rendered element event or a receiver`, their five Strings behind
 * them, every wire out of the node dropped. Built: 17 files, 0 refusals, the shell note and the connected-backend note.
 *
 * §A the plan and the emitted page · §B the refused shapes, by mutation · §C the lib's text and the module earning ·
 * §D the pure cores under node · §E the hook under a hook harness with a scripted EventSource, a scripted fetch and the
 * runtime's own timer seam · §F the ledger.
 */

const FIXTURE = path.join(__dirname, 'fixtures', 'live-desk');
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
const addNode = (component: ComponentIR, node: Partial<NodeIR> & { id: string; type: string }) => {
  component.nodes.push({ parameters: [], declaredPorts: [], children: [], ...node } as NodeIR);
};
const refusalOf = (source: ExportIR, componentPath: string, id: string) =>
  emitApp(source, catalog).report.components.find((c) => c.path === componentPath)?.refusals?.find((r) => r.nodeId === id);
const sentence = (id: string, mutate: (ir: ExportIR) => void): string | undefined => {
  const ir = cloneIr();
  mutate(ir);
  return refusalOf(ir, HOME, id)?.reason;
};

const HOOK_LINE =
  "  const feed = useSubscribeToChanges({ label: 'Feed', nodeId: 'feed', componentName: '/Pages/Home' }, { collection: 'Contact' }, {\n" +
  "    realtimeFailure: () => last.set('failed'),\n" +
  "    created: () => last.set('created'),\n" +
  "    updated: () => last.set('updated'),\n" +
  "    deleted: () => last.set('deleted'),\n" +
  "    changed: () => pulse.set('changed')\n" +
  '  });';

// ---------------------------------------------------------------------------------------------------
describe('§A the plan and the emitted page — the sixth member of the streaming table, riding the client', () => {
  const page = app.files[HOME_FILE];
  const home = project.plans.find((p) => p.path === HOME)!;

  test('A1 the fixture translates whole: 0 refusals, the shell + connected notes alone, the node collapsed into the file; realtime.ts + errors.ts + client.ts shipped, the three other stream modules NOT', () => {
    const report = app.report.components.find((c) => c.path === HOME)!;
    expect(report.refusals ?? []).toEqual([]);
    expect(app.notes.filter((n) => n.startsWith('Pages/Home'))).toEqual([]);
    expect(app.notes).toContain("api modules connect to the project's NodeGX backend at http://localhost:8584 (src/api/client.ts; .env.example overrides the endpoint)");
    expect(home.dispositions['feed']).toEqual({ kind: 'collapsed', into: HOME_FILE });
    expect(Object.keys(app.files).sort()).toEqual(expect.arrayContaining([REALTIME_LIB_PATH, ERRORS_LIB_PATH, 'src/api/client.ts', '.env.example', HOME_FILE, 'src/stores/variables.ts']));
    expect(app.files[STREAMING_LIB_PATH]).toBeUndefined();
    expect(app.files[SSE_LIB_PATH]).toBeUndefined();
    expect(app.files[WEBSOCKET_LIB_PATH]).toBeUndefined();
    // No collection module: a subscription is not a query, and the class needs no typed api file of its own.
    expect(Object.keys(app.files).filter((f) => f.startsWith('src/api/'))).toEqual(['src/api/client.ts']);
  });

  test('A2 the plan: one stream of kind subscription, no data, the Class its one config (read off the collectionName parameter), the five listeners in declaration order', () => {
    const feed = home.streams.find((s) => s.nodeId === 'feed')!;
    expect(feed).toMatchObject({ type: SUBSCRIBE_TO_CHANGES_TYPE, kind: 'subscription', label: 'Feed', local: 'feed' });
    expect(feed.data).toBeUndefined();
    expect(feed.config).toEqual([{ port: 'collection', expr: { kind: 'literal', value: 'Contact' } }]);
    expect(Object.keys(feed.listeners)).toEqual(['realtimeFailure', 'created', 'updated', 'deleted', 'changed']);
    expect(feed.listeners.changed).toEqual([{ kind: 'store-set', variableName: 'pulse', expr: { kind: 'literal', value: 'changed' } }]);
    expect(feed.comment).toBe('Feed — a Subscribe To Changes (subscribetochanges.ts), hosted by realtime.ts; its value outputs read live off the handle.');
  });

  test('A3 the page: one import line from ../lib/realtime and none from the other stream modules, the hook line with the listeners in declaration order', () => {
    expect(page).toContain("import { useSubscribeToChanges } from '../lib/realtime';");
    expect(page).not.toContain("from '../lib/streaming'");
    expect(page).not.toContain("from '../lib/sse'");
    expect(page).not.toContain("from '../lib/websocket'");
    expect(page).toContain('  // Feed — a Subscribe To Changes (subscribetochanges.ts), hosted by realtime.ts; its value outputs read live off the handle.\n' + HOOK_LINE);
  });

  test('A4 every Realtime output reads live off the handle, cast by its DECLARED type: the boolean and the two objects through String, the array as JSON, the strings bare', () => {
    expect(page).toContain('<p className={styles.text}>{String(feed.subscribed)}</p>');
    expect(page).toContain('<p className={styles.text}>{feed.realtimeStatus}</p>');
    expect(page).toContain('<p className={styles.text}>{feed.changedEvent}</p>');
    expect(page).toContain('<p className={styles.text}>{feed.changedRecordId}</p>');
    // `object` ports: null before anything happened (never undefined) — the unknown cast with the blank fallback.
    expect(page).toContain("<p className={styles.text}>{String(feed.changedRecord ?? '')}</p>");
    expect(page).toContain('<p className={styles.text}>{JSON.stringify(feed.changedRecords)}</p>');
    expect(page).toContain("<p className={styles.text}>{String(feed.realtimeError ?? '')}</p>");
    expect(page).toContain('<p className={styles.text}>{lastValue}</p>');
    expect(page).toContain('<p className={styles.text}>{pulseValue}</p>');
    // Nothing of the node prints anywhere else: no useEffect for it, no state row, no store of its own, no verb (it has no Actions).
    expect(page).not.toContain('useEffect');
    expect(page).not.toContain('useState');
    // The seven reads are the ONLY reads of the handle: no verb (the node has no Actions), nothing else off it.
    expect(page.match(/feed\.[a-zA-Z]+/g)).toEqual(['feed.subscribed', 'feed.realtimeStatus', 'feed.changedEvent', 'feed.changedRecordId', 'feed.changedRecord', 'feed.changedRecords', 'feed.realtimeError']);
  });

  test('A5 the table row is the catalog’s port set for SubscribeToChanges: the one declared input (Enabled) + the discovered Class in, 5 signals + 7 values out; no data, no Actions', () => {
    const spec = STREAM_NODES[SUBSCRIBE_TO_CHANGES_TYPE];
    const node = catalog.nodes.find((n) => n.typeName === SUBSCRIBE_TO_CHANGES_TYPE)!;
    expect(spec.data).toBeUndefined();
    expect(spec.actions).toEqual({});
    expect(spec.config).toEqual([
      { port: 'collection', displayName: 'Class', param: 'collectionName' },
      { port: 'enabled', displayName: 'Enabled' }
    ]);
    // The catalog declares Enabled alone; the Class is discovered at runtime (`dynamicPorts.mechanisms: runtime-discovered`).
    expect((node.inputs ?? []).map((p) => p.name)).toEqual(['enabled']);
    expect([...spec.signals, ...Object.keys(spec.values)].sort()).toEqual((node.outputs ?? []).map((p) => p.name).sort());
    expect(spec.signals).toEqual(['realtimeFailure', 'created', 'updated', 'deleted', 'changed']);
    expect(spec.values.realtimeError).toEqual({ tsType: '{ message: string; code: string; kind: string } | null', cast: 'unknown', maybeUndefined: false });
    expect(spec.values.changedRecords).toEqual({ tsType: 'Record<string, unknown>[]', cast: 'array', maybeUndefined: false });
    expect(spec).toMatchObject({ kind: 'subscription', hook: 'useSubscribeToChanges', localStem: 'Subscription', lib: 'realtime', sourceFile: 'subscribetochanges.ts' });
  });

  test('A6 Enabled: an authored false prints as a literal; a wire from a Variable prints its render read; absent prints nothing (the hook reads absent as ON)', () => {
    const authored = cloneIr();
    setParam(nodeOf(authored, HOME, 'feed'), 'enabled', { kind: 'literal', value: false });
    expect(emitApp(authored, catalog).files[HOME_FILE]).toContain("{ collection: 'Contact', enabled: false }, {");

    const wired = cloneIr();
    addNode(componentOf(wired, HOME), { id: 'enabledVar', type: 'Variable2', authoredLabel: 'Enabled', parameters: [{ name: 'name', value: { kind: 'literal', value: 'enabled' } }] });
    connect(componentOf(wired, HOME), 'enabledVar', 'value', 'feed', 'enabled', 'value');
    const wiredPage = emitApp(wired, catalog).files[HOME_FILE];
    expect(wiredPage).toContain("{ collection: 'Contact', enabled: enabledValue }, {");
    expect(wiredPage).toContain('const enabledValue = useValue(enabled);');
    expect(refusalOf(wired, HOME, 'feed')).toBeUndefined();

    expect(page).toContain("{ collection: 'Contact' }, {");
  });

  test('A7 no Class authored: the node still translates with an empty options object — the hook never subscribes, as the runtime never does (reconfigure returns on an empty name)', () => {
    const ir = cloneIr();
    nodeOf(ir, HOME, 'feed').parameters = [];
    expect(refusalOf(ir, HOME, 'feed')).toBeUndefined();
    expect(emitApp(ir, catalog).files[HOME_FILE]).toContain("useSubscribeToChanges({ label: 'Feed', nodeId: 'feed', componentName: '/Pages/Home' }, {}, {");
  });

  test('A8 the client ships for a subscription alone (hasApi counts it), and exports the ENDPOINT realtime.ts reads; every other connected fixture’s client is byte-identical bar the two defaults', () => {
    const client = app.files['src/api/client.ts'];
    expect(client).toContain("export const ENDPOINT: string = import.meta.env.VITE_NODEGX_ENDPOINT ?? 'http://localhost:8584';");
    expect(client).toContain('export function readSession(): WireSession | undefined {');
    expect(app.files['.env.example']).toContain('VITE_NODEGX_ENDPOINT=http://localhost:8584');
    const search = emitApp(parseProject(path.join(__dirname, 'fixtures', 'search-desk'), catalog), catalog);
    expect(search.files['src/api/client.ts'].replace(/8590/g, '8584').replace(/backend_searchdesk/g, 'backend_livedesk')).toBe(client);
  });
});

// ---------------------------------------------------------------------------------------------------
describe('§B the refused shapes, by mutation — each named, each before the table’s own “not a port” sentence', () => {
  test('B1 a project with no backend: refused by name, and neither realtime.ts nor client.ts ships (the stub arm is never entered)', () => {
    const ir = cloneIr();
    delete ir.project.cloudservices;
    expect(refusalOf(ir, HOME, 'feed')?.reason).toBe('the project declares no backend (metadata.cloudservices is absent) — there is no /realtime stream to subscribe to');
    const built = emitApp(ir, catalog);
    expect(built.files[REALTIME_LIB_PATH]).toBeUndefined();
    expect(built.files['src/api/client.ts']).toBeUndefined();
    expect(built.notes.some((n) => n.includes('emitted as stubs'))).toBe(false);
    expect(planOf(ir, HOME).streams).toEqual([]);
  });

  test('B2 a Backend other than the project’s active one — authored or wired — is the record verbs’ sentence; _active_ and the empty string are the default', () => {
    expect(sentence('feed', (ir) => setParam(nodeOf(ir, HOME, 'feed'), 'backendId', { kind: 'literal', value: 'directus_1' }))).toBe(
      'it subscribes on the backend "directus_1" rather than the project\'s active one — a second backend is not in this slice'
    );
    expect(
      sentence('feed', (ir) => {
        addNode(componentOf(ir, HOME), { id: 'which', type: 'String', parameters: [{ name: 'value', value: { kind: 'literal', value: 'x' } }] });
        connect(componentOf(ir, HOME), 'which', 'savedValue', 'feed', 'backendId', 'value');
      })
    ).toBe('it subscribes on the backend "(wired)" rather than the project\'s active one — a second backend is not in this slice');
    expect(sentence('feed', (ir) => setParam(nodeOf(ir, HOME, 'feed'), 'backendId', { kind: 'literal', value: '_active_' }))).toBeUndefined();
    expect(sentence('feed', (ir) => setParam(nodeOf(ir, HOME, 'feed'), 'backendId', { kind: 'literal', value: '' }))).toBeUndefined();
  });

  test('B3 an authored Filter, or a qp- value port, is refused by name — the server evaluates it and dropping it would deliver every change', () => {
    const FILTER = 'its Filter is authored — a subscription filter is evaluated by the server and this slice does not translate the filter tree; dropping it would deliver every change in the class';
    expect(sentence('feed', (ir) => setParam(nodeOf(ir, HOME, 'feed'), 'visualFilter', { kind: 'json', value: { combinator: 'and', rules: [] } } as unknown as ParamValue))).toBe(FILTER);
    expect(
      sentence('feed', (ir) => {
        addNode(componentOf(ir, HOME), { id: 'city', type: 'String', parameters: [{ name: 'value', value: { kind: 'literal', value: 'Oslo' } }] });
        connect(componentOf(ir, HOME), 'city', 'savedValue', 'feed', 'qp-city', 'value');
      })
    ).toBe(FILTER);
  });

  test('B4 two wires on Enabled; Enabled fed by a text input’s own value (handler-only); a signal consumed as a value; an output or input the node has not got', () => {
    expect(
      sentence('feed', (ir) => {
        addNode(componentOf(ir, HOME), { id: 'a', type: 'Boolean', parameters: [{ name: 'value', value: { kind: 'literal', value: true } }] });
        addNode(componentOf(ir, HOME), { id: 'b', type: 'Boolean', parameters: [{ name: 'value', value: { kind: 'literal', value: false } }] });
        connect(componentOf(ir, HOME), 'a', 'savedValue', 'feed', 'enabled', 'value');
        connect(componentOf(ir, HOME), 'b', 'savedValue', 'feed', 'enabled', 'value');
      })
    ).toBe('two wires feed its Enabled input — last-writer-wins is not statically ordered');
    expect(
      sentence('feed', (ir) => {
        addNode(componentOf(ir, HOME), { id: 'box', type: 'net.noodl.controls.textinput', parent: 'shell', parameters: [{ name: 'placeholder', value: { kind: 'literal', value: 'x' } }] });
        const shell = componentOf(ir, HOME).nodes.find((n) => n.id === 'shell')!;
        shell.children = [...(shell.children ?? []), 'box'];
        connect(componentOf(ir, HOME), 'box', 'onTextChanged', 'feed', 'enabled', 'value');
      })
    ).toBe('its Enabled input reads a value that only exists inside a handler');
    expect(sentence('feed', (ir) => connect(componentOf(ir, HOME), 'feed', 'created', 'headline', 'text', 'value'))).toBe(
      'its created output is consumed as a value — a pulse carries nothing to read'
    );
    expect(sentence('feed', (ir) => connect(componentOf(ir, HOME), 'feed', 'foo', 'headline', 'text', 'value'))).toBe('its foo output is consumed, and this node has no such port');
    expect(sentence('feed', (ir) => connect(componentOf(ir, HOME), 'createdStr', 'savedValue', 'feed', 'bar', 'value'))).toBe('its bar input is not a port this node has');
  });

  test('B5 the refusal cascades as the table’s does: the five Set Variables and their Strings fall with the node, every wire out of it dropped — the reverted arm’s 22', () => {
    const ir = cloneIr();
    delete ir.project.cloudservices;
    const report = emitApp(ir, catalog).report.components.find((c) => c.path === HOME)!;
    const ids = (report.refusals ?? []).map((r) => r.nodeId).sort();
    expect(ids).toEqual(['changedStr', 'createdStr', 'deletedStr', 'failedStr', 'feed', 'setCreated', 'setDeleted', 'setFailed', 'setPulse', 'setUpdated', 'updatedStr'].sort());
    // §64.4's finding, again: a Set Variable behind a node REFUSED IN THE TABLE reads the registration pass's sentence
    // (`logic node (Set Variable)`); the attach pass's `trigger feed.created is not a rendered element event or a receiver` is
    // what the reverted arm read, where the type was unknown to the table altogether (probe-reverted.log).
    expect((report.refusals ?? []).find((r) => r.nodeId === 'setCreated')?.reason).toBe('logic node (Set Variable)');
  });
});

// ---------------------------------------------------------------------------------------------------
describe('§C the lib’s text, and what earns it', () => {
  test('C1 the module lands at src/lib/realtime.ts, imports the client and the channel, and carries the node’s own error code', () => {
    expect(REALTIME_LIB_PATH).toBe('src/lib/realtime.ts');
    const lib = app.files[REALTIME_LIB_PATH];
    expect(lib).toBe('// @nodegx:generated (api module — provenance markers complete in EXP-007)\n' + realtimeLibSource());
    expect(lib).toContain("import { ENDPOINT, readSession } from '../api/client';");
    expect(lib).toContain("import { raiseAppError } from './errors';");
    expect(lib).not.toContain("from './streaming'");
    expect(lib).toContain("export const SUBSCRIBE_ERROR_CODE = 'subscribe-to-changes/realtime-failed';");
    expect(lib).toContain('export function useSubscribeToChanges(');
    const parsed = ts.createSourceFile('realtime.ts', lib, ts.ScriptTarget.ES2020, true, ts.ScriptKind.TS);
    expect((parsed as unknown as { parseDiagnostics: Array<{ messageText: unknown }> }).parseDiagnostics.map((d) => d.messageText)).toEqual([]);
  });

  test('C2 only the NodeGX dialect ships — no PocketBase, Directus or Parse transport; the export’s backend is the built-in one', () => {
    const lib = app.files[REALTIME_LIB_PATH];
    expect(lib).toContain("export const NODEGX_SSE: SseDialect = {");
    expect(lib).not.toContain('POCKETBASE_SSE');
    expect(lib).not.toContain('DirectusWebSocketTransport');
    expect(lib).not.toContain('ParseLiveQueryTransport');
    expect(lib).not.toContain('UnavailableTransport');
    expect(lib.match(/class \w+ extends RealtimeSubscription/g)).toEqual(['class SseTransport extends RealtimeSubscription']);
  });

  test('C3 a project without a Subscribe To Changes ships no realtime.ts (search-desk: a query alone); one with it earns errors.ts too', () => {
    const search = emitApp(parseProject(path.join(__dirname, 'fixtures', 'search-desk'), catalog), catalog);
    expect(search.files[REALTIME_LIB_PATH]).toBeUndefined();
    expect(app.files[ERRORS_LIB_PATH]).toBeDefined();
  });
});

// ---------------------------------------------------------------------------------------------------
// The lib under node: transpiled once, `react` replaced by a hook harness, `../api/client` and `./errors` by stubs.
type Source = { label: string; nodeId: string; componentName: string };
type AppError = { code: string; message: string; nodeId: string; componentName: string; nodeType: string; detail?: unknown };
type Handle = {
  readonly subscribed: boolean;
  readonly realtimeStatus: string;
  readonly realtimeError: { message: string; code: string; kind: string } | null;
  readonly changedEvent: string;
  readonly changedRecord: Record<string, unknown> | null;
  readonly changedRecords: Record<string, unknown>[];
  readonly changedRecordId: string;
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
  publishes: number;
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
    publishes: 0,
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
            harness.publishes++;
            dirty = true;
          }
        ];
      },
      useEffect,
      useLayoutEffect: useEffect
    },
    render<T>(component: () => T): T {
      let out!: T;
      let settle = 0;
      do {
        // A hook that re-renders itself on every render never settles — React's "Maximum update depth exceeded"; graded as a failure here.
        if (++settle > 100) throw new Error('render loop: the hook never settles');
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
const compile = (source: string, requireImpl: (name: string) => unknown): any => {
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const module = { exports: {} as any };
  // eslint-disable-next-line no-new-func
  new Function('require', 'module', 'exports', js)(requireImpl, module, module.exports);
  return module.exports;
};
/**
 * The compiled module binds `react` ONCE, at load — so a lib shared by two mounts (the pool rows) would run the second hook
 * against the first harness's slots. `react` is therefore a dispatcher onto whichever harness `use()` named last; every
 * mount's `render` names its own before rendering. (The WebSocket spec never mounted two hooks on one lib.)
 */
const loadLib = (session: { current: { sessionToken?: string } | undefined } = { current: undefined }, endpoint = 'http://be') => {
  const harness = makeHarness();
  const current = { harness };
  const use = (h: Harness) => {
    current.harness = h;
  };
  const React = {
    useRef: (v: unknown) => current.harness.React.useRef(v),
    useReducer: (r: (s: any, a: any) => any, init: any) => current.harness.React.useReducer(r, init),
    useEffect: (fn: () => void | (() => void), deps?: unknown[]) => current.harness.React.useEffect(fn, deps),
    useLayoutEffect: (fn: () => void | (() => void), deps?: unknown[]) => current.harness.React.useLayoutEffect(fn, deps)
  };
  const raised: AppError[] = [];
  const errors = { raiseAppError: (error: AppError) => raised.push(error) };
  const client = { ENDPOINT: endpoint, readSession: () => session.current };
  const lib = compile(realtimeLibSource(), (name) => {
    if (name === 'react') return React;
    if (name === './errors') return errors;
    if (name === '../api/client') return client;
    throw new Error(`unexpected import ${name}`);
  });
  return { lib, harness, raised, session, use };
};
const SRC: Source = { label: 'Feed', nodeId: 'feed', componentName: '/Pages/Home' };

/** The runtime's own fake: an EventSource that records its URL and listeners, and fires what the test says. */
class FakeEventSource {
  static instances: FakeEventSource[] = [];
  listeners = new Map<string, Array<(event: { data: string }) => void>>();
  onerror: ((...args: unknown[]) => void) | null = null;
  closes = 0;
  constructor(public url: string) {
    FakeEventSource.instances.push(this);
  }
  addEventListener(type: string, listener: (event: { data: string }) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  close(): void {
    this.closes++;
  }
  fire(event: string, data: unknown): void {
    for (const l of this.listeners.get(event) ?? []) l({ data: typeof data === 'string' ? data : JSON.stringify(data) });
  }
  fireError(): void {
    this.onerror && this.onerror({});
  }
  events(): string[] {
    return [...this.listeners.keys()];
  }
}

type FetchCall = { url: string; init: { method: string; headers: Record<string, string>; body: string } };
/** A scripted fetch: every call recorded; the answer decided per call by `respond`, default "accept every collection asked for". */
function makeFetch() {
  const calls: FetchCall[] = [];
  const state = {
    respond: (call: FetchCall): { status: number; body: unknown } | Error => {
      const subs = (JSON.parse(call.init.body) as { subscriptions: Array<{ collection: string }> }).subscriptions;
      return { status: 200, body: { accepted: subs.map((s) => ({ collection: s.collection })), rejected: [] } };
    }
  };
  const fetchImpl = (url: string, init: unknown) => {
    const call = { url, init: init as FetchCall['init'] };
    calls.push(call);
    const answer = state.respond(call);
    if (answer instanceof Error) return Promise.reject(answer);
    return Promise.resolve({ status: answer.status, ok: answer.status < 300, json: () => Promise.resolve(answer.body) });
  };
  return { calls, state, fetchImpl, bodies: () => calls.map((c) => JSON.parse(c.init.body)) };
}

/** The timer seam: timers collected and fired by hand. A fired timer is not pending (§65.4 #4). */
function makeTimers() {
  const timers: Array<{ fn: () => void; ms: number; cleared: boolean }> = [];
  return {
    timers,
    setTimeoutImpl: (fn: () => void, ms: number) => {
      timers.push({ fn, ms, cleared: false });
      return timers.length;
    },
    clearTimeoutImpl: (h: unknown) => {
      timers[(h as number) - 1].cleared = true;
    },
    fire(i: number) {
      const t = timers[i];
      if (t.cleared) return;
      t.cleared = true;
      t.fn();
    },
    pending: () => timers.map((t, i) => ({ i, ms: t.ms, cleared: t.cleared })).filter((t) => !t.cleared).map((t) => t.ms),
    pendingIndex: () => timers.findIndex((t) => !t.cleared)
  };
}

/** Let the registration POST's promise chain run: three thens and a catch between the fetch and the settle. */
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};

describe('§D the pure cores run the way the contract and SseTransport.ts do (under node)', () => {
  const { lib } = loadLib();

  test('D1 nextReconnectDelay doubles from 1s to the 30s ceiling; a non-positive or non-finite attempt is the base; the exponent is clamped; the shipped timing is 1000/30000/15000', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map((n) => lib.nextReconnectDelay(n))).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000]);
    expect([-1, NaN, Infinity].map((n) => lib.nextReconnectDelay(n))).toEqual([1000, 1000, 1000]);
    expect(lib.nextReconnectDelay(2.9, { reconnectBaseMs: 10, reconnectMaxMs: 1e12, connectTimeoutMs: 1 })).toBe(40);
    expect(lib.nextReconnectDelay(400, { reconnectBaseMs: 1, reconnectMaxMs: 1e12, connectTimeoutMs: 1 })).toBe(1073741824);
    expect(lib.REALTIME_TIMING).toEqual({ reconnectBaseMs: 1000, reconnectMaxMs: 30000, connectTimeoutMs: 15000 });
  });

  test('D2 the failure classification is the contract’s: two fatal codes, five retryable', () => {
    expect(lib.REALTIME_FAILURE_KINDS).toEqual({
      TRANSPORT_UNAVAILABLE: 'fatal',
      CONNECT_FAILED: 'retryable',
      CONNECT_TIMEOUT: 'retryable',
      AUTH_FAILED: 'fatal',
      SUBSCRIPTION_REJECTED: 'retryable',
      HEARTBEAT_MISSED: 'retryable',
      CAPABILITY_UNAVAILABLE: 'fatal'
    });
  });

  test('D3 the NodeGX dialect: the stream URL carries the token in the query (encoded) and nothing without one; the POST is one union body with a Bearer header only with a token, a filter field only with a where', () => {
    const d = lib.NODEGX_SSE;
    expect(d.name).toBe('nodegx');
    expect(d.helloEvent).toBe('connected');
    expect(d.changeEvents('Contact')).toEqual(['change']);
    expect(d.resyncEvent).toBe('resync');
    expect(d.streamUrl('http://be', '')).toBe('http://be/realtime');
    expect(d.streamUrl('http://be', 'a b&c')).toBe('http://be/realtime?token=a%20b%26c');
    const anon = d.subscribeRequest('http://be', '', 'c1', [{ collection: 'Contact' }, { collection: 'Order', where: { city: { $eq: 'Oslo' } } }]);
    expect(anon.url).toBe('http://be/realtime/subscriptions');
    expect(anon.init).toEqual({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ clientId: 'c1', subscriptions: [{ collection: 'Contact' }, { collection: 'Order', filter: { city: { $eq: 'Oslo' } } }] })
    });
    expect(d.subscribeRequest('http://be', 'tok', 'c1', [{ collection: 'Contact' }]).init.headers).toEqual({ 'content-type': 'application/json', authorization: 'Bearer tok' });
  });

  test('D4 readVerdict reads the BODY, not the status: an accepted entry naming the collection (or naming nothing) confirms; a rejection carries its reason; an empty body is a rejection with none', () => {
    const d = lib.NODEGX_SSE;
    expect(d.readVerdict(200, { accepted: [{ collection: 'Contact' }], rejected: [] }, 'Contact')).toEqual({ ok: true });
    expect(d.readVerdict(200, { accepted: ['anything'] }, 'Contact')).toEqual({ ok: true });
    expect(d.readVerdict(200, { accepted: [{ collection: 'Order' }], rejected: [{ collection: 'Contact', reason: 'no read access' }] }, 'Contact')).toEqual({ ok: false, reason: 'no read access' });
    expect(d.readVerdict(200, { accepted: [], rejected: [] }, 'Contact')).toEqual({ ok: false, reason: undefined });
    expect(d.readVerdict(200, null, 'Contact')).toEqual({ ok: false, reason: undefined });
  });

  test('D5 parseChange: the three actions normalised with objectId first (then the primary key), a delete carrying the whole record; another collection, another action, no record — each as the runtime answers', () => {
    const d = lib.NODEGX_SSE;
    const record = { objectId: 'r1', name: 'Ada' };
    expect(d.parseChange('Contact', 'objectId', { action: 'create', collection: 'Contact', record })).toEqual({ type: 'create', collection: 'Contact', ids: ['r1'], records: [record], recordsComplete: true });
    expect(d.parseChange('Contact', 'objectId', { action: 'delete', collection: 'Contact', record })).toMatchObject({ type: 'delete', ids: ['r1'], recordsComplete: true });
    expect(d.parseChange('Contact', 'id', { action: 'update', record: { id: 7 } })).toMatchObject({ type: 'update', ids: ['7'] });
    expect(d.parseChange('Contact', 'objectId', { action: 'update', collection: 'Order', record })).toBeNull();
    expect(d.parseChange('Contact', 'objectId', { action: 'init', record })).toBeNull();
    expect(d.parseChange('Contact', 'objectId', { action: 'update', collection: 'Contact' })).toEqual({ type: 'update', collection: 'Contact', ids: [], records: [], recordsComplete: false });
  });

  test('D6 normalizedHttpBase, filterKey and connectionKey — the pool’s identity', () => {
    expect(lib.normalizedHttpBase('http://be///')).toBe('http://be');
    expect(lib.normalizedHttpBase(' HTTPS://be/api/ ')).toBe('HTTPS://be/api');
    expect(lib.normalizedHttpBase('ws://be')).toBeNull();
    expect(lib.normalizedHttpBase(undefined)).toBeNull();
    expect(lib.filterKey(undefined)).toBe('');
    expect(lib.filterKey({ a: 1 })).toBe('{"a":1}');
    expect(lib.connectionKey('nodegx', 'http://be', 'tok', undefined)).toBe('nodegx http://be tok');
    expect(lib.connectionKey('nodegx', 'http://be', '', { a: 1 })).toBe('nodegx http://be  #{"a":1}');
  });
});

describe('§E the hook under the harness — the stream, the registration, the frames, the failures, the pool', () => {
  const ALL = ['realtimeFailure', 'created', 'updated', 'deleted', 'changed'];
  type Mounted = {
    lib: any;
    harness: Harness;
    raised: AppError[];
    session: { current: { sessionToken?: string } | undefined };
    use: (h: Harness) => void;
    fetch: ReturnType<typeof makeFetch>;
    timers: ReturnType<typeof makeTimers>;
    deps: Record<string, unknown>;
    log: string[];
    current: { options: Record<string, unknown> };
    render: () => Handle;
    handle: () => Handle;
    es: (i?: number) => FakeEventSource;
    streams: () => number;
  };
  /** One hook mounted on its own host (its own pool) unless `shared` hands it another mount's seams. */
  const mount = (
    options: Record<string, unknown>,
    extra: { listenerNames?: string[]; shared?: Mounted; session?: { sessionToken?: string }; endpoint?: string; timing?: Record<string, number> } = {}
  ): Mounted => {
    const loaded = extra.shared ? { lib: extra.shared.lib, harness: makeHarness(), raised: extra.shared.raised, session: extra.shared.session, use: extra.shared.use } : loadLib({ current: extra.session }, extra.endpoint);
    const { lib, harness, raised, session, use } = loaded;
    const fetch = extra.shared ? extra.shared.fetch : makeFetch();
    const timers = extra.shared ? extra.shared.timers : makeTimers();
    const deps = extra.shared ? extra.shared.deps : { EventSourceImpl: FakeEventSource, fetchImpl: fetch.fetchImpl, setTimeoutImpl: timers.setTimeoutImpl, clearTimeoutImpl: timers.clearTimeoutImpl };
    const log: string[] = [];
    const current = { options };
    let handle!: Handle;
    const listeners = Object.fromEntries((extra.listenerNames ?? ALL).map((name) => [name, () => log.push(name)]));
    const env = { deps, ...(extra.timing ? { timing: extra.timing } : {}) };
    const base = FakeEventSource.instances.length;
    const render = () => {
      use(harness);
      return harness.render(() => (handle = lib.useSubscribeToChanges(SRC, current.options, listeners, env)));
    };
    render();
    // `streams()` counts the streams opened since THIS mount; `es(i)` indexes every stream of the test (a shared mount reads its host's).
    return { lib, harness, raised, session, use, fetch, timers, deps, log, current, render, handle: () => handle, es: (i = -1) => FakeEventSource.instances.at(i)!, streams: () => FakeEventSource.instances.length - base };
  };
  beforeEach(() => {
    FakeEventSource.instances = [];
  });

  test('E1 a Class alone subscribes at mount: one stream at /realtime (anonymous — no token), status connecting; the hello ⇒ ONE POST with the union body; accepted ⇒ subscribed, no pulse, the deadline cleared', async () => {
    const m = mount({ collection: 'Contact' });
    const h = m.handle();
    expect(m.streams()).toBe(1);
    expect(m.es().url).toBe('http://be/realtime');
    expect(m.es().events()).toEqual(expect.arrayContaining(['change', 'connected', 'resync']));
    expect([h.subscribed, h.realtimeStatus, h.realtimeError, h.changedEvent, h.changedRecord, h.changedRecords, h.changedRecordId]).toEqual([false, 'connecting', null, '', null, [], '']);
    expect(m.timers.pending()).toEqual([15000]);
    expect(m.fetch.calls).toHaveLength(0);
    m.es().fire('connected', { clientId: 'c1' });
    expect(m.fetch.calls).toHaveLength(1);
    expect(m.fetch.calls[0].url).toBe('http://be/realtime/subscriptions');
    expect(m.fetch.calls[0].init.headers).toEqual({ 'content-type': 'application/json' });
    expect(m.fetch.bodies()).toEqual([{ clientId: 'c1', subscriptions: [{ collection: 'Contact' }] }]);
    expect(h.subscribed).toBe(false);
    await flush();
    expect([h.subscribed, h.realtimeStatus]).toEqual([true, 'subscribed']);
    expect(m.log).toEqual([]);
    expect(m.raised).toEqual([]);
    expect(m.timers.pending()).toEqual([]);
    expect(m.harness.publishes).toBeGreaterThanOrEqual(2);
  });

  test('E2 a signed-in session: the token rides the stream URL (encoded) and the POST’s Bearer header — the client’s session, read when the subscription opens', () => {
    const m = mount({ collection: 'Contact' }, { session: { sessionToken: 'r:ab c' } });
    expect(m.es().url).toBe('http://be/realtime?token=r%3Aab%20c');
    m.es().fire('connected', { clientId: 'c1' });
    expect(m.fetch.calls[0].init.headers).toEqual({ 'content-type': 'application/json', authorization: 'Bearer r:ab c' });
  });

  test('E3 the frames: create / update / delete each write the four values BEFORE their pulse and then Records Changed; a foreign collection, a foreign action and a bad JSON frame deliver nothing', async () => {
    const m = mount({ collection: 'Contact' });
    const h = m.handle();
    m.es().fire('connected', { clientId: 'c1' });
    await flush();
    const ada = { objectId: 'r1', name: 'Ada' };
    m.es().fire('change', { action: 'create', collection: 'Contact', record: ada });
    expect([h.changedEvent, h.changedRecord, h.changedRecords, h.changedRecordId]).toEqual(['create', ada, [ada], 'r1']);
    expect(m.log).toEqual(['created', 'changed']);
    m.es().fire('change', { action: 'update', collection: 'Contact', record: { ...ada, name: 'Ada L' } });
    expect([h.changedEvent, h.changedRecord?.name]).toEqual(['update', 'Ada L']);
    m.es().fire('change', { action: 'delete', collection: 'Contact', record: ada });
    expect([h.changedEvent, h.changedRecordId, h.changedRecords]).toEqual(['delete', 'r1', [ada]]);
    expect(m.log).toEqual(['created', 'changed', 'updated', 'changed', 'deleted', 'changed']);
    m.es().fire('change', { action: 'update', collection: 'Order', record: ada });
    m.es().fire('change', { action: 'init', collection: 'Contact', record: ada });
    m.es().fire('change', 'not json');
    expect(m.log).toHaveLength(6);
    expect(h.changedEvent).toBe('delete');
    // The Parse wire's key is objectId (the runtime's realtimePrimaryKey fallback): a frame whose record carries `id` and no
    // objectId has no id to publish — a storage-shaped NodeGX record always carries objectId, so this is the fallback's edge, pinned.
    m.es().fire('change', { action: 'update', collection: 'Contact', record: { id: 7, name: 'no objectId' } });
    expect([h.changedEvent, h.changedRecordId, h.changedRecord?.name]).toEqual(['update', '', 'no objectId']);
    expect(m.raised).toEqual([]);
  });

  test('E4 resync: Change Type resync, the record outputs cleared, Records Changed alone — the one frame that says the view is stale', async () => {
    const m = mount({ collection: 'Contact' });
    const h = m.handle();
    m.es().fire('connected', { clientId: 'c1' });
    await flush();
    m.es().fire('change', { action: 'create', collection: 'Contact', record: { objectId: 'r1' } });
    m.log.length = 0;
    m.es().fire('resync', { reason: 'reconnect' });
    expect([h.changedEvent, h.changedRecord, h.changedRecords, h.changedRecordId]).toEqual(['resync', null, [], '']);
    expect(m.log).toEqual(['changed']);
  });

  test('E5 a rejected registration: SUBSCRIPTION_REJECTED (retryable) in Realtime Error, the Failure pulse THEN the raise under the node’s own code, status interrupted, the stream closed, a 1s retry; the retry’s acceptance clears the error', async () => {
    const m = mount({ collection: 'Contact' });
    const h = m.handle();
    m.fetch.state.respond = () => ({ status: 200, body: { accepted: [], rejected: [{ collection: 'Contact', reason: 'no read access' }] } });
    m.es().fire('connected', { clientId: 'c1' });
    await flush();
    expect(h.realtimeError).toEqual({ code: 'SUBSCRIPTION_REJECTED', kind: 'retryable', message: 'The subscription to "Contact" was rejected: no read access' });
    expect([h.subscribed, h.realtimeStatus]).toEqual([false, 'interrupted']);
    expect(m.log).toEqual(['realtimeFailure']);
    expect(m.raised).toEqual([
      { code: 'subscribe-to-changes/realtime-failed', message: 'The subscription to "Contact" was rejected: no read access', nodeId: 'feed', nodeType: 'SubscribeToChanges', componentName: '/Pages/Home', detail: h.realtimeError }
    ]);
    // The member left, it was the last, so the stream closed; the backoff is armed at the base.
    expect(m.es(0).closes).toBe(1);
    expect(m.timers.pending()).toEqual([1000]);
    m.fetch.state.respond = () => ({ status: 200, body: { accepted: [{ collection: 'Contact' }], rejected: [] } });
    m.timers.fire(m.timers.pendingIndex());
    expect(m.streams()).toBe(2);
    expect(h.realtimeStatus).toBe('interrupted');
    m.es().fire('connected', { clientId: 'c2' });
    await flush();
    expect(m.fetch.bodies().at(-1)).toEqual({ clientId: 'c2', subscriptions: [{ collection: 'Contact' }] });
    expect([h.subscribed, h.realtimeStatus, h.realtimeError]).toEqual([true, 'subscribed', null]);
    expect(m.log).toEqual(['realtimeFailure']);
  });

  test('E6 the confirmation deadline: no hello in 15s ⇒ CONNECT_TIMEOUT, the Failure, a retry at 1s; a second silence doubles to 2s; a confirmation resets the counter', async () => {
    const m = mount({ collection: 'Contact' });
    const h = m.handle();
    m.timers.fire(m.timers.pendingIndex());
    expect(h.realtimeError).toMatchObject({ code: 'CONNECT_TIMEOUT', kind: 'retryable', message: 'The realtime subscription to "Contact" was not confirmed within 15000ms.' });
    expect(m.log).toEqual(['realtimeFailure']);
    expect(m.timers.pending()).toEqual([1000]);
    m.timers.fire(m.timers.pendingIndex());
    expect(m.streams()).toBe(2);
    expect(m.timers.pending()).toEqual([15000]);
    m.timers.fire(m.timers.pendingIndex());
    expect(m.timers.pending()).toEqual([2000]);
    m.timers.fire(m.timers.pendingIndex());
    expect(m.streams()).toBe(3);
    m.es().fire('connected', { clientId: 'c3' });
    await flush();
    expect([h.subscribed, h.realtimeError]).toEqual([true, null]);
    // After a confirmation the next outage starts the backoff over.
    m.timers.timers.length = 0;
    m.es().fireError();
    expect(m.timers.pending()).toEqual([15000]);
    m.timers.fire(0);
    expect(m.timers.pending()).toEqual([1000]);
    expect(m.raised).toHaveLength(3);
  });

  test('E7 a stream error while subscribed is NOT a failure: status interrupted, no error, the deadline re-armed ONCE; the browser’s own reconnect brings a fresh hello ⇒ re-POST under the new clientId ⇒ subscribed again', async () => {
    const m = mount({ collection: 'Contact' });
    const h = m.handle();
    m.es().fire('connected', { clientId: 'c1' });
    await flush();
    expect(m.timers.pending()).toEqual([]);
    m.es().fireError();
    expect([h.subscribed, h.realtimeStatus, h.realtimeError]).toEqual([false, 'interrupted', null]);
    expect(m.log).toEqual([]);
    expect(m.timers.pending()).toEqual([15000]);
    const armed = m.timers.timers.length;
    m.es().fireError();
    // ONCE: the second error neither adds nor replaces a timer — re-arming would let a stream that errors every 3s postpone the funnel forever.
    expect([m.timers.pending(), m.timers.timers.length]).toEqual([[15000], armed]);
    expect(m.streams()).toBe(1);
    m.es().fire('connected', { clientId: 'c2' });
    expect(m.fetch.bodies()).toEqual([
      { clientId: 'c1', subscriptions: [{ collection: 'Contact' }] },
      { clientId: 'c2', subscriptions: [{ collection: 'Contact' }] }
    ]);
    await flush();
    expect([h.subscribed, h.realtimeStatus]).toEqual([true, 'subscribed']);
    expect(m.timers.pending()).toEqual([]);
  });

  test('E8 Enabled: false at mount opens nothing (status blank); true on a later render subscribes; false again disposes — the stream closed, status blank, Subscribed false; absent means on', async () => {
    const m = mount({ collection: 'Contact', enabled: false });
    const h = m.handle();
    expect(m.streams()).toBe(0);
    expect([h.subscribed, h.realtimeStatus]).toEqual([false, '']);
    m.current.options = { collection: 'Contact', enabled: true };
    m.render();
    expect(m.streams()).toBe(1);
    m.es().fire('connected', { clientId: 'c1' });
    await flush();
    expect(h.subscribed).toBe(true);
    m.current.options = { collection: 'Contact', enabled: false };
    m.render();
    expect([h.subscribed, h.realtimeStatus, m.es().closes]).toEqual([false, '', 1]);
    expect(m.timers.pending()).toEqual([]);
    // A re-render that changed nothing does nothing.
    m.render();
    expect(m.streams()).toBe(1);
    const untouched = mount({ collection: 'Contact' });
    expect(untouched.streams()).toBe(1);
  });

  test('E9 a Class change re-subscribes: the old member leaves (its stream closes, it was alone), a fresh stream opens and registers the new class; an empty Class opens nothing', async () => {
    const m = mount({ collection: 'Contact' });
    m.es().fire('connected', { clientId: 'c1' });
    await flush();
    m.current.options = { collection: 'Order' };
    m.render();
    expect([m.streams(), m.es(0).closes]).toEqual([2, 1]);
    m.es().fire('connected', { clientId: 'c2' });
    expect(m.fetch.bodies().at(-1)).toEqual({ clientId: 'c2', subscriptions: [{ collection: 'Order' }] });
    m.current.options = { collection: '' };
    m.render();
    expect([m.streams(), m.es().closes, m.handle().realtimeStatus]).toEqual([2, 1, '']);
    const none = mount({});
    expect([none.streams(), none.handle().realtimeStatus]).toEqual([0, '']);
  });

  test('E10 unmount disposes: the stream closed, no timer pending, nothing reported; a late frame reaches nobody', async () => {
    const m = mount({ collection: 'Contact' });
    m.es().fire('connected', { clientId: 'c1' });
    await flush();
    m.harness.unmount();
    expect(m.es().closes).toBe(1);
    expect(m.timers.pending()).toEqual([]);
    m.es().fire('change', { action: 'create', collection: 'Contact', record: { objectId: 'r1' } });
    expect(m.log).toEqual([]);
    expect(m.handle().changedEvent).toBe('');
  });

  test('E11 the pool: two subscriptions on one host share ONE stream and ONE union POST; a frame reaches its own class only; the first leaving re-POSTs the union without it and the stream stays up', async () => {
    const a = mount({ collection: 'Contact' });
    const b = mount({ collection: 'Order' }, { shared: a });
    expect(a.streams()).toBe(1);
    expect(a.lib.openConnectionCount(a.deps)).toBe(1);
    expect(a.es().events()).toEqual(expect.arrayContaining(['change', 'connected', 'resync']));
    a.es().fire('connected', { clientId: 'c1' });
    expect(a.fetch.bodies()).toEqual([{ clientId: 'c1', subscriptions: [{ collection: 'Contact' }, { collection: 'Order' }] }]);
    await flush();
    expect([a.handle().subscribed, b.handle().subscribed]).toEqual([true, true]);
    a.es().fire('change', { action: 'create', collection: 'Order', record: { objectId: 'o1' } });
    expect([a.log, b.log]).toEqual([[], ['created', 'changed']]);
    expect([a.handle().changedRecordId, b.handle().changedRecordId]).toEqual(['', 'o1']);
    a.harness.unmount();
    expect(a.es().closes).toBe(0);
    expect(a.fetch.bodies().at(-1)).toEqual({ clientId: 'c1', subscriptions: [{ collection: 'Order' }] });
    await flush();
    expect(b.handle().subscribed).toBe(true);
    b.harness.unmount();
    expect([a.es().closes, a.lib.openConnectionCount(a.deps)]).toEqual([1, 0]);
  });

  test('E12 a member joining while the union POST is in flight is not settled by that answer: it gets its own POST after', async () => {
    const a = mount({ collection: 'Contact' });
    a.es().fire('connected', { clientId: 'c1' });
    expect(a.fetch.calls).toHaveLength(1);
    const b = mount({ collection: 'Order' }, { shared: a });
    expect(a.fetch.calls).toHaveLength(1);
    await flush();
    expect(a.fetch.bodies()).toEqual([
      { clientId: 'c1', subscriptions: [{ collection: 'Contact' }] },
      { clientId: 'c1', subscriptions: [{ collection: 'Contact' }, { collection: 'Order' }] }
    ]);
    expect([a.handle().subscribed, b.handle().subscribed]).toEqual([true, true]);
  });

  test('E13 a registration that cannot be made (the fetch rejects): CONNECT_FAILED retryable with the transport’s sentence, the Failure, a retry', async () => {
    const m = mount({ collection: 'Contact' });
    m.fetch.state.respond = () => new Error('boom');
    m.es().fire('connected', { clientId: 'c1' });
    await flush();
    expect(m.handle().realtimeError).toEqual({ code: 'CONNECT_FAILED', kind: 'retryable', message: 'Could not register the realtime subscription: boom' });
    expect(m.log).toEqual(['realtimeFailure']);
    expect(m.timers.pending()).toEqual([1000]);
  });

  test('E14 the two fatal arms stop for good: no EventSource in the host (TRANSPORT_UNAVAILABLE), a backend URL that is not http(s) (CONNECT_FAILED, fatal by the transport’s own proof) — status stopped, no timer', () => {
    const noEs = mount({ collection: 'Contact' });
    noEs.harness.unmount();
    const host = { EventSourceImpl: null, fetchImpl: noEs.fetch.fetchImpl, setTimeoutImpl: noEs.timers.setTimeoutImpl, clearTimeoutImpl: noEs.timers.clearTimeoutImpl };
    const log: string[] = [];
    let h!: Handle;
    const harness = makeHarness();
    noEs.use(harness);
    harness.render(() => (h = noEs.lib.useSubscribeToChanges(SRC, { collection: 'Contact' }, { realtimeFailure: () => log.push('realtimeFailure') }, { deps: host })));
    expect(h.realtimeError).toEqual({ code: 'TRANSPORT_UNAVAILABLE', kind: 'fatal', message: 'EventSource is not available in this environment.' });
    expect([h.realtimeStatus, log, noEs.timers.pending()]).toEqual(['stopped', ['realtimeFailure'], []]);

    const badUrl = mount({ collection: 'Contact' }, { endpoint: 'ws://be' });
    expect(badUrl.handle().realtimeError).toEqual({ code: 'CONNECT_FAILED', kind: 'fatal', message: 'Backend URL is not a valid http(s) URL: ws://be' });
    expect([badUrl.handle().realtimeStatus, badUrl.streams(), badUrl.timers.pending()]).toEqual(['stopped', 0, []]);
  });

  test('E15 a listener that throws is contained (console.error) and the transport is unaffected: the next frame still lands', async () => {
    const m = mount({ collection: 'Contact' }, { listenerNames: [] });
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      m.es().fire('connected', { clientId: 'c1' });
      await flush();
      let calls = 0;
      // Swap the listeners by re-rendering with a throwing one (the hook keeps the latest listeners passed).
      m.harness.render(() => m.lib.useSubscribeToChanges(SRC, m.current.options, { created: () => { calls++; throw new Error('handler'); } }, { deps: m.deps }));
      m.es().fire('change', { action: 'create', collection: 'Contact', record: { objectId: 'r1' } });
      m.es().fire('change', { action: 'create', collection: 'Contact', record: { objectId: 'r2' } });
      expect(calls).toBe(2);
      expect(m.handle().changedRecordId).toBe('r2');
      expect(spy).toHaveBeenCalledTimes(2);
      expect(String(spy.mock.calls[0][0])).toContain('[realtime] a onEvent handler for "Contact" threw; the subscription is unaffected.');
    } finally {
      spy.mockRestore();
    }
  });

  test('E17 the Failure pulse runs BEFORE the raise (the node’s order: outputs, signal, then raiseRuntimeError) — a chain off Realtime Failure sees no boundary error yet', async () => {
    const m = mount({ collection: 'Contact' }, { listenerNames: [] });
    const seen: number[] = [];
    m.harness.render(() => m.lib.useSubscribeToChanges(SRC, m.current.options, { realtimeFailure: () => seen.push(m.raised.length) }, { deps: m.deps }));
    m.fetch.state.respond = () => ({ status: 200, body: { accepted: [], rejected: [{ collection: 'Contact', reason: 'nope' }] } });
    m.es().fire('connected', { clientId: 'c1' });
    await flush();
    expect(seen).toEqual([0]);
    expect(m.raised).toHaveLength(1);
  });

  test('E16 the timing seam: a custom table drives the deadline and the backoff (the runtime’s own `timing` option)', () => {
    const m = mount({ collection: 'Contact' }, { timing: { reconnectBaseMs: 50, reconnectMaxMs: 200, connectTimeoutMs: 500 } });
    expect(m.timers.pending()).toEqual([500]);
    m.timers.fire(m.timers.pendingIndex());
    expect(m.timers.pending()).toEqual([50]);
  });
});

// ---------------------------------------------------------------------------------------------------
describe('§F the ledger', () => {
  const ledger = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'coverage-ledger.json'), 'utf8')) as {
    pickerCoverageFloor: number;
    $pickerCoverageFloorComment: string;
    entries: Array<{ typeName: string; status: string; note?: string; exemption?: string }>;
  };

  test('F1 the row moved to translated with a note; the card carries no badge; the floor is 117 with its sentence', () => {
    expect(ledgerEntryOf(SUBSCRIBE_TO_CHANGES_TYPE)?.status).toBe('translated');
    expect(exportBadgeOf(SUBSCRIBE_TO_CHANGES_TYPE)).toBeUndefined();
    const row = ledger.entries.find((e) => e.typeName === SUBSCRIBE_TO_CHANGES_TYPE)!;
    expect(row.exemption).toBeUndefined();
    expect(String(row.note)).toContain('useSubscribeToChanges');
    expect(ledger.pickerCoverageFloor).toBe(117); // §66 Subscribe To Changes (session 90) on top of §65 WebSocket (session 89)
    expect(ledger.$pickerCoverageFloorComment).toContain('117 after Tier 3.11 row 3 Subscribe To Changes');
  });

  test('F2 no scheduled row remains: every deferred entry is a decision (deliberately out of scope), and there is at least one — the badge’s out-of-scope kind still has a population', () => {
    const deferred = ledger.entries.filter((e) => e.status === 'deferred');
    expect(deferred.length).toBeGreaterThan(0);
    expect(deferred.filter((e) => !(e.exemption ?? '').startsWith('deliberately out of scope — ')).map((e) => e.typeName)).toEqual([]);
    expect(deferred.every((e) => exportBadgeOf(e.typeName)?.kind === 'out-of-scope')).toBe(true);
  });
});
