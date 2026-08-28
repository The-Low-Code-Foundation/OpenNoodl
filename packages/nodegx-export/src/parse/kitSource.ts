/**
 * Reading a custom node kit's `index.js` for what it *declares* — EXP-010's parse half.
 *
 * A kit is a plain `<script>`-shaped file that calls `Noodl.defineModule({ reactNodes: [...] })`.
 * Its node definitions are the only statement anywhere of a custom node's ports: there is no
 * catalog entry, no manifest field, nothing on disk beside the code. `projectmodules.ts` says the
 * same thing from the other side — "what a kit registers is known only once its `index.js` has
 * executed". So the export runs it.
 *
 * 🔴 **This is the fourth evaluator of kit source in the repo, and that is deliberate rather than
 * missed.** The other three cannot answer this question, which was checked rather than assumed:
 *
 * - `noodl-editor/src/shared/utils/projectmodules.ts` → `verifyKitSource` returns node *names* and
 *   a pass/fail outcome. EXP-010 needs the ports — `inputProps`, `outputProps`, `outputs` — which
 *   that function reads past and discards. It is also TypeScript inside the editor package.
 * - `noodl-mcp/src/kitExtract/entry.js` is an esbuild entry point for a child process; there is no
 *   function to import.
 * - `noodl-viewer-react/static/ssr/kit-modules.js` takes a *deploy's `index.html`* and reads script
 *   tags out of it. There is no deploy at export time.
 *
 * What is reused is the shape of the question and the shim: the recursive-noop `Proxy` on `Noodl`
 * with a collecting `defineModule` is `kitExtract/entry.js`'s, adopted rather than reinvented,
 * because kit code touches other members of the `Noodl` global at module scope.
 *
 * ⚠️ **`React` is a recursive noop here, so this reads declarations and not behaviour.** A kit's
 * components are *values* the export never calls — Route B renders them by running the kit's own
 * code in the browser (`src/kits/`), and what this file extracts is the port map that decides how
 * the graph's parameters and wires reach them. A kit that computed its `inputProps` from a React
 * call at module scope would come back with fewer ports than it has; no kit on this machine does,
 * and a kit that registers *no* usable ports is reported by name rather than assumed empty.
 *
 * ⚠️ **This is a shape read, not a security boundary.** A `vm` context is not a sandbox in the
 * security sense — `vm`'s own documentation says so. Exporting a project already means running the
 * project's own code on the machine that authored it, but no caller may describe a kit that
 * survives this as safe.
 *
 * 🔴 **Nothing from the sandbox escapes.** Every value returned is rebuilt as plain JSON-shaped
 * data by `plainValue`; the definitions hold functions closed over the vm realm and handing one
 * back would put a foreign-realm callable in the IR, which is supposed to be serialisable.
 */

import * as vm from 'vm';

/**
 * What running a kit's source turned out to be.
 *
 * Named after `projectmodules.ts`'s `KitVerifyOutcome` and carrying the same distinctions, because
 * the two are read by people looking at the same kit — the Kits panel and the export report must
 * not disagree about why a kit produced nothing.
 *
 * ⚠️ `'unreadable'` is the caller's to report: this function is handed source, so "there is no
 * code" is a fact about the file read, not about the run.
 */
export type KitRunOutcome =
  /** Ran, called `Noodl.defineModule`, and defined at least one named node. */
  | 'defines-nodes'
  /** Ran cleanly and never called `Noodl.defineModule` — a library, not a kit. */
  | 'no-define-module'
  /** Called `defineModule` with no `nodes` and no `reactNodes` carrying a name. */
  | 'defines-no-nodes'
  /** An ES-module build; a `<script>` tag cannot load it, so neither can the exported app. */
  | 'es-module'
  /** A CommonJS (Node) build; same. */
  | 'commonjs'
  /** Threw while running. It would register nothing in the running app either. */
  | 'threw';

/** One port a kit node declares. Plain data — no sandbox values, no functions. */
export interface KitPort {
  name: string;
  /** Declared port type name ("string", "number", "color", "signal", …) or undefined. */
  type?: string;
  /** The port type's `defaultUnit` ("px"), when the type is a units type. */
  defaultUnit?: string;
  displayName?: string;
  group?: string;
  /** Present only when the definition declares one. JSON-shaped. */
  default?: unknown;
}

/** One node a kit defines. */
export interface KitNodeDefinition {
  /** The node type name the graph stores — `nodegx.cashflow.Pill`. */
  type: string;
  displayName?: string;
  docs?: string;
  /** `allowChildren` — whether the node accepts visual children. */
  allowChildren: boolean;
  /**
   * True when the definition has a `getReactComponent`. A kit may also define non-visual nodes
   * (`nodes:` rather than `reactNodes:`); those are logic and this export does not render them.
   */
  visual: boolean;
  /**
   * Every input the node declares, from **both** places a definition declares them, tagged with
   * how the runtime delivers it.
   *
   * - `via: 'prop'` — an `inputProps` entry. The value becomes a React prop of that name
   *   (`react-component-node.ts:945`), which is the only shape a visual kit node normally uses.
   * - `via: 'node'` — an `inputs` entry, whose `set` function the node runs. `rename-kit`'s
   *   logic node `Source` declares its only input this way, and reading `inputProps` alone
   *   reports it as having none — which then reads as "the author set a parameter no port
   *   accepts" for a port that exists and works.
   */
  inputs: Array<KitPort & { via: 'prop' | 'node' }>;
  /**
   * Every output the node publishes, from **both** places a definition declares them, tagged with
   * which one — the two are wired differently and collapsing them loses the difference.
   *
   * - `via: 'prop'` — an `outputProps` entry. The runtime *gives the component a callback prop*
   *   of this name (`react-component-node.ts:addPrimitiveOutputPropHandler`), and the component
   *   calling it is what fires the port. A `Money Pill` fires `onClick` this way.
   * - `via: 'node'` — an `outputs` entry. The node itself publishes it: a value output through
   *   `get()` after `flagOutputDirty(name)`, a signal through `sendSignalOnOutput(name)`. `Money
   *   Pill`'s `liveDay`, `dropped` and `dragStarted` are all this shape, and `dropped` is fired
   *   from `initialize` with no `outputProps` entry at all — read only `outputProps` and it
   *   disappears.
   */
  outputs: Array<KitPort & { kind: 'value' | 'signal'; via: 'prop' | 'node' }>;
}

export interface KitRunResult {
  outcome: KitRunOutcome;
  /** Human-facing, and on failure it names the likely cause. Never a bare "false". */
  message: string;
  /** Definition order across every `defineModule` call. Empty on every failure. */
  nodes: KitNodeDefinition[];
}

/**
 * The browser-shaped context a kit's `<script>` would run in.
 *
 * Modelled on `projectmodules.ts`'s `createBrowserSandbox` and kept deliberately close to it: a
 * kit that runs there and not here (or the reverse) would make the Kits panel and the export
 * report disagree about the same file. It is not imported — that file is TypeScript inside the
 * editor package, reaching into an Electron-side module from the export pipeline, and its sandbox
 * is a private function. If a third caller ever needs this, extracting it is the fix.
 */
function createBrowserSandbox(): Record<string, unknown> {
  const sandbox: Record<string, unknown> = {
    console,
    navigator: { userAgent: 'node' },
    document: {
      createElement: () => ({ setAttribute() {}, appendChild() {}, style: {} }),
      createElementNS: () => ({ setAttribute() {}, appendChild() {}, style: {} }),
      getElementsByTagName: () => [],
      head: { appendChild() {} },
      currentScript: null,
      addEventListener() {},
      removeEventListener() {}
    },
    location: { href: '', protocol: 'https:', host: '' },
    addEventListener() {},
    removeEventListener() {},
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  return sandbox;
}

/**
 * Run a kit's source and read every node definition it registers.
 *
 * Never throws. Every failure mode is an outcome with a message, because a project with one broken
 * kit must still export the rest of itself (AC4) — an exception here would take the whole app down
 * over a folder the author may not even remember adding.
 */
export function runKitSource(code: string): KitRunResult {
  const sandbox = createBrowserSandbox();

  // `kitExtract/entry.js`'s shim, adopted: everything on `Noodl` answers with a recursive noop
  // except `defineModule`, which collects.
  const collected: unknown[] = [];
  const noop: unknown = new Proxy(function () {}, { get: () => noop, apply: () => noop });
  const base: Record<string, unknown> = { deployed: false, defineModule: (m: unknown) => collected.push(m) };
  sandbox.Noodl = new Proxy(base, { get: (t, k) => (k in t ? t[k as string] : noop) });
  sandbox.React = noop;

  const context = vm.createContext(sandbox);
  try {
    new vm.Script(code, { filename: 'kit-index.js' }).runInContext(context, { timeout: 5000 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const looksLikeEsm =
      /Unexpected token ['"`]?export['"`]?/i.test(message) ||
      /Cannot use import statement outside a module/i.test(message) ||
      /Unexpected token ['"`]?import['"`]?/i.test(message);
    const looksLikeCjs = /(module|exports) is not defined/i.test(message);

    if (looksLikeEsm) {
      return {
        outcome: 'es-module',
        message: `The kit could not be loaded (${message}). It looks like an ES-module build — a kit is loaded by a plain <script> tag, so it needs a browser (UMD/IIFE) build.`,
        nodes: []
      };
    }
    if (looksLikeCjs) {
      return {
        outcome: 'commonjs',
        message: `The kit could not be loaded (${message}). It looks like a CommonJS (Node) build — a plain <script> tag has no "module"/"exports".`,
        nodes: []
      };
    }
    return {
      outcome: 'threw',
      message: `The kit threw while loading: ${message}. It registers no nodes in the running app either.`,
      nodes: []
    };
  }

  if (collected.length === 0) {
    return {
      outcome: 'no-define-module',
      message:
        'This script ran but never called Noodl.defineModule, so it defines no nodes. It may be a plain library rather than a node kit.',
      nodes: []
    };
  }

  const nodes: KitNodeDefinition[] = [];
  for (const module of collected) {
    if (!module || typeof module !== 'object') continue;
    const record = module as Record<string, unknown>;
    // Both lists, in this order, matching `verifyKitSource`. `nodes` is the non-visual half and
    // `reactNodes` the visual one; a kit may declare either or both.
    for (const list of [record.nodes, record.reactNodes]) {
      if (!Array.isArray(list)) continue;
      for (const raw of list) {
        const definition = readDefinition(raw);
        if (definition) nodes.push(definition);
      }
    }
  }

  if (nodes.length === 0) {
    return {
      outcome: 'defines-no-nodes',
      message: 'This kit called Noodl.defineModule but defined no named nodes, so it registers nothing.',
      nodes: []
    };
  }

  return {
    outcome: 'defines-nodes',
    message: `Defines ${nodes.length} node${nodes.length === 1 ? '' : 's'}: ${nodes.map((n) => n.type).join(', ')}.`,
    nodes
  };
}

/**
 * One definition object → plain data, or null when it is not a definition at all.
 *
 * ⚠️ **Both wrapper shapes, and a function is refused rather than read** — `verifyKitSource`'s
 * two measured traps, carried over. The runtime's signature is
 * `nodes?: Array<NodeDefinitionOptions | { node: NodeDefinitionOptions }>`, so `{ node: {…} }` is
 * as valid as the bare object and most of the shipped library uses it; and one shipped kit puts a
 * bare function in `reactNodes`, whose `Function.prototype.name` is a string that would be
 * promoted into a node type name by a naive check.
 */
function readDefinition(raw: unknown): KitNodeDefinition | null {
  if (!raw || typeof raw !== 'object') return null;
  const outer = raw as Record<string, unknown>;
  const wrapped = outer.node;
  const target = (wrapped && typeof wrapped === 'object' ? wrapped : outer) as Record<string, unknown>;

  const type = target.name;
  if (typeof type !== 'string' || !type) return null;

  const inputs: KitNodeDefinition['inputs'] = [];
  for (const [name, spec] of entriesOf(target.inputProps)) {
    inputs.push({ ...readPort(name, spec), via: 'prop' });
  }
  for (const [name, spec] of entriesOf(target.inputs)) {
    // A definition may declare both; the prop form wins because that is the one the component
    // actually reads, and two entries for one port name would make the emit side pick arbitrarily.
    if (inputs.some((i) => i.name === name)) continue;
    inputs.push({ ...readPort(name, spec), via: 'node' });
  }

  const outputs: KitNodeDefinition['outputs'] = [];
  for (const [name, spec] of entriesOf(target.outputProps)) {
    const port = readPort(name, spec);
    outputs.push({ ...port, kind: port.type === 'signal' ? 'signal' : 'value', via: 'prop' });
  }
  for (const [name, spec] of entriesOf(target.outputs)) {
    const port = readPort(name, spec);
    // A `get` is what makes an output readable as a value; a declared `signal` type with no getter
    // is fired by `sendSignalOnOutput`. Reading the type alone would call `Money Pill`'s `dropped`
    // a value port and emit a binding for something that never has one.
    const hasGetter = typeof (spec as Record<string, unknown> | undefined)?.get === 'function';
    outputs.push({ ...port, kind: port.type === 'signal' && !hasGetter ? 'signal' : 'value', via: 'node' });
  }

  return {
    type,
    ...(typeof target.displayNodeName === 'string' ? { displayName: target.displayNodeName } : {}),
    ...(typeof target.docs === 'string' ? { docs: target.docs } : {}),
    allowChildren: target.allowChildren === true,
    visual: typeof target.getReactComponent === 'function',
    inputs,
    outputs
  };
}

/** `Object.entries` over a value that may be anything, in declaration order. Non-objects yield none. */
function entriesOf(value: unknown): Array<[string, Record<string, unknown> | undefined]> {
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value as Record<string, unknown>).map(([name, spec]) => [
    name,
    spec && typeof spec === 'object' ? (spec as Record<string, unknown>) : undefined
  ]);
}

function readPort(name: string, spec: Record<string, unknown> | undefined): KitPort {
  const rawType = spec?.type;
  // A port type is either a bare name or `{ name, units, defaultUnit }`. Only the object form
  // carries units, and `defaultUnit` is what the runtime appends to a default before it becomes a
  // prop (`react-component-node.ts:962`) — dropping it here would emit `24` where the running app
  // shows `24px`.
  const typeName =
    typeof rawType === 'string'
      ? rawType
      : rawType && typeof rawType === 'object' && typeof (rawType as Record<string, unknown>).name === 'string'
        ? ((rawType as Record<string, unknown>).name as string)
        : undefined;
  const defaultUnit =
    rawType && typeof rawType === 'object' && typeof (rawType as Record<string, unknown>).defaultUnit === 'string'
      ? ((rawType as Record<string, unknown>).defaultUnit as string)
      : undefined;

  return {
    name,
    ...(typeName !== undefined ? { type: typeName } : {}),
    ...(defaultUnit !== undefined ? { defaultUnit } : {}),
    ...(typeof spec?.displayName === 'string' ? { displayName: spec.displayName } : {}),
    ...(typeof spec?.group === 'string' ? { group: spec.group } : {}),
    // `in` rather than `!== undefined`: a port whose default is explicitly `undefined` declares no
    // default, and one whose default is `0`, `false` or `''` declares a real one.
    ...(spec && 'default' in spec ? { default: plainValue(spec.default) } : {})
  };
}

/**
 * A sandbox value → an equivalent built from this realm's primitives, or `null` where it cannot be.
 *
 * 🔴 The definitions live in the vm context, so their arrays and objects have *that* realm's
 * prototypes. Passing one through would put a cross-realm object in the IR, where `Array.isArray`
 * still works but `instanceof` does not and JSON round-tripping is the only safe operation anyway.
 * Functions become `null` rather than being dropped, so an authored default that is a function is
 * visibly wrong instead of silently absent.
 */
function plainValue(value: unknown, depth = 0): unknown {
  if (depth > 8) return null;
  if (value === null) return null;
  const kind = typeof value;
  if (kind === 'string' || kind === 'number' || kind === 'boolean') return value;
  if (kind !== 'object') return null;
  if (Array.isArray(value)) return value.map((v) => plainValue(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === 'function') continue;
    out[k] = plainValue(v, depth + 1);
  }
  return out;
}
