/**
 * EXP-003's purity gate (EXP-003-JS-TARGET-OUTPUT.md §3) — the per-body half: does this
 * Function/Expression body qualify for the re-host slice at all. Everything graph-shaped
 * (input sourcing, output landing, run-model fit) lives in plan.ts; this module only ever
 * looks at the script text, exactly the way the runtime's own parsers do.
 *
 * The mining regexes are verbatim clones of the runtime's (javascriptnodeparser.js
 * `parseAndAddPortsFromScript`, expression.ts `parsePorts`) — the port set the runtime mints
 * is the port set this gate reasons about, so the two must not drift.
 */

import { NodeIR } from '../ir/types';

export const JS_FUNCTION = 'JavaScriptFunction';
export const JS_EXPRESSION = 'Expression';

export type JsNodeKind = 'function' | 'expression';

export function jsNodeKindOf(type: string): JsNodeKind | null {
  if (type === JS_FUNCTION) return 'function';
  if (type === JS_EXPRESSION) return 'expression';
  return null;
}

/** The node's verbatim script text, from the parameter the runtime compiles. */
export function jsBodyOf(node: NodeIR, kind: JsNodeKind): string | undefined {
  const name = kind === 'function' ? 'functionScript' : 'expression';
  const value = node.parameters.find((p) => p.name === name)?.value;
  if (value?.kind === 'script') return value.source;
  if (value?.kind === 'literal' && typeof value.value === 'string') return value.value;
  return undefined;
}

/**
 * The Expression preamble's Math aliases (expression.ts `functionPreamble`). A referenced name
 * emits as a destructured alias above the return; `pi` is the one non-member spelling.
 */
export const EXPRESSION_MATH_ALIASES: ReadonlySet<string> = new Set([
  'min', 'max', 'cos', 'sin', 'tan', 'sqrt', 'pi', 'round', 'floor', 'ceil', 'abs', 'random', 'pow', 'log', 'exp'
]);

/** expression.ts `portsToIgnore`, verbatim — identifiers that never become input ports. */
const EXPRESSION_IGNORED: ReadonlySet<string> = new Set([
  'min', 'max', 'cos', 'sin', 'tan', 'sqrt', 'pi', 'round', 'floor', 'ceil', 'abs', 'random', 'pow', 'log', 'exp',
  'Math', 'window', 'document', 'undefined', 'Vars', 'Variables', 'Objects', 'Arrays', 'Noodl', 'NoodlContext',
  'true', 'false', 'null', 'Boolean'
]);

export interface ExpressionIdentifiers {
  /** Identifiers that become input ports, in first-appearance order (parsePorts). */
  ports: string[];
  /** Preamble Math aliases the expression references — destructured in the wrapper. */
  mathAliases: string[];
  /** Every mined identifier root, ignore list included — the Noodl-globals check reads this. */
  raw: Set<string>;
}

/** expression.ts `parsePorts`, with the ignore-list split out so the gate can see behind it. */
export function expressionIdentifiersOf(expression: string): ExpressionIdentifiers {
  const stripped = expression.replace(/\"([^\"]*)\"/g, '').replace(/\'([^\']*)\'/g, '');
  const ports: string[] = [];
  const mathAliases: string[] = [];
  const raw = new Set<string>();
  for (const match of stripped.matchAll(/[a-zA-Z\_\$][a-zA-Z0-9\.\_\$]*/g)) {
    let name = match[0];
    if (name.indexOf('.') !== -1) name = name.split('.')[0];
    raw.add(name);
    if (EXPRESSION_MATH_ALIASES.has(name) && !mathAliases.includes(name)) mathAliases.push(name);
    if (EXPRESSION_IGNORED.has(name)) continue;
    if (!ports.includes(name)) ports.push(name);
  }
  return { ports, mathAliases, raw };
}

export interface FunctionMinedPorts {
  /** Names read as `Inputs.x` / `Inputs["x"]` — the runtime mints `in-x` for each. */
  inputs: string[];
  /** Names assigned as `Outputs.x` / `Outputs["x"]` — the runtime mints `out-x`. */
  outputs: string[];
  /** Names called as `Outputs.x()` / `Outputs["x"]()` / `Outputs.x.send()` — signal ports. */
  signals: string[];
}

/** javascriptnodeparser.js `parseAndAddPortsFromScript`, as data. Signals win over values. */
export function functionMinedPortsOf(body: string): FunctionMinedPorts {
  const collect = (patterns: RegExp[]): string[] => {
    const names: string[] = [];
    for (const pattern of patterns) {
      for (const match of body.matchAll(pattern)) {
        if (match[1] !== undefined && !names.includes(match[1])) names.push(match[1]);
      }
    }
    return names;
  };
  const signals = collect([
    /Outputs\.([A-Za-z0-9]+)\s*\(\s*\)/g,
    /Outputs\s*\[\s*(?:'|")(.*)(?:'|")\s*\]\(\s*\)/g,
    // Not in the runtime's miner, but `Outputs.x.send()` is the documented second spelling
    // (simplejavascript.ts attaches `.send` to every signal value) — seeded so it cannot throw.
    /Outputs\.([A-Za-z0-9_]+)\.send\s*\(/g
  ]);
  const outputs = collect([/Outputs\.([A-Za-z0-9_]+)/g, /Outputs\s*\[\s*\"([^\"]*)\"\s*\]/g]).filter(
    (name) => !signals.includes(name) && name !== 'send'
  );
  const inputs = collect([/Inputs\.([A-Za-z0-9_]+)/g, /Inputs\s*\[\s*(?:'|")(.*)(?:'|")\s*\]/g]);
  return { inputs, outputs, signals };
}

/**
 * expression.ts `functionPreamble`, verbatim — the compile checks must accept exactly what the
 * runtime's compile accepts (an expression shadowing `round` compiles there, so it must here).
 */
const EXPRESSION_PREAMBLE =
  'var min = Math.min,' +
  '    max = Math.max,' +
  '    cos = Math.cos,' +
  '    sin = Math.sin,' +
  '    tan = Math.tan,' +
  '    sqrt = Math.sqrt,' +
  '    pi = Math.PI,' +
  '    round = Math.round,' +
  '    floor = Math.floor,' +
  '    ceil = Math.ceil,' +
  '    abs = Math.abs,' +
  '    random = Math.random,' +
  '    pow = Math.pow,' +
  '    log = Math.log,' +
  '    exp = Math.exp;' +
  'try {' +
  '  var NoodlContext = (typeof Noodl !== "undefined") ? Noodl : (typeof global !== "undefined" && global.Noodl) || {};' +
  '  var Variables = NoodlContext.Variables || {};' +
  '  var Objects = NoodlContext.Objects || {};' +
  '  var Arrays = NoodlContext.Arrays || {};' +
  '} catch (e) {' +
  '  var Variables = {}, Objects = {}, Arrays = {};' +
  '}';

/**
 * §3.2/§3.3/§3.4 — the marker gates, each with its named defer. Scanned over the body with
 * comments and single/double-quoted strings stripped (the design's "after comment stripping";
 * template literals stay, their interpolations are code). Over-deferring on a marker inside an
 * odd string is the safe direction; certifying a body that reaches the network is not.
 */
const MARKER_GATES: ReadonlyArray<{ pattern: RegExp; reason: string }> = [
  {
    pattern: /\bComponent\s*[.\[]/,
    reason: 'reads the Component scope — the component-record tier (controlled-state slice + EXP-003 Tier B)'
  },
  { pattern: /\bScript\s*[.\[]/, reason: 'uses the Script-node DSL (Script.*) — a hand-written node, not a function' },
  {
    pattern: /\bthis\s*[.\[]/,
    reason: "keeps state on `this` across runs — cross-run state is EXP-003 Tier B"
  },
  { pattern: /\bnew\s+Date\b|\bDate\s*[.(]/, reason: 'reads the clock (Date) — not deterministic' },
  { pattern: /\bMath\.random\b/, reason: 'draws randomness (Math.random) — not deterministic' },
  { pattern: /\bfetch\s*\(|\bXMLHttpRequest\b/, reason: 'reaches the network — not translatable in this slice' },
  { pattern: /\bsetTimeout\b|\bsetInterval\b/, reason: 'schedules timers — invocation timing is real semantics' },
  {
    pattern: /\bwindow\b|\bdocument\b|\blocalStorage\b|\bsessionStorage\b|\bnavigator\b/,
    reason: 'touches the browser environment — not translatable in this slice'
  },
  { pattern: /\bimport\s*\(/, reason: 'loads code dynamically (import()) — not translatable in this slice' },
  {
    pattern: /\basync\b|\bawait\b|\.then\s*\(/,
    reason: 'is asynchronous — completion ordering joins the invocation tier when the trace harness exists'
  },
  { pattern: /\barguments\b/, reason: "reads the compiled function's arguments object — a host detail this wrapper does not carry" }
];

/** Comment + quoted-string stripping for the marker scan (LOGIC-TARGET's parse discipline). */
function strippedForScan(body: string): string {
  return body
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\"([^\"\n]*)\"/g, '""')
    .replace(/\'([^\'\n]*)\'/g, "''");
}

/**
 * §3.1–§3.4 for one body. Returns the named defer, or null when the body passes. The compile
 * checks use the same constructors the runtime uses (`AsyncFunction` for Function — an `await`
 * must reach the async gate's named reason, not a compile failure), then recompile strict:
 * the emitted module is strict-mode TS and the runtime compiles non-strict, so a body that only
 * compiles sloppy would fail the emitted app's own build.
 */
export function jsPurityDefer(kind: JsNodeKind, body: string): string | null {
  if (kind === 'function') {
    const AsyncFunction = Object.getPrototypeOf(async function () {
      /* prototype probe */
    }).constructor as new (...args: string[]) => unknown;
    try {
      new AsyncFunction('Inputs', 'Outputs', 'Noodl', 'Component', body);
    } catch (e) {
      return `does not compile: ${(e as Error).message}`;
    }
    try {
      new AsyncFunction('Inputs', 'Outputs', 'Noodl', 'Component', `'use strict';\n${body}`);
    } catch (e) {
      return `compiles only in sloppy mode (${(e as Error).message}) — the emitted module is strict TS`;
    }
  } else {
    const ids = expressionIdentifiersOf(body).ports;
    try {
      // eslint-disable-next-line no-new-func
      new Function(...ids, 'Noodl', `${EXPRESSION_PREAMBLE}return (${body});`);
    } catch (e) {
      return `does not compile: ${(e as Error).message}`;
    }
    try {
      // eslint-disable-next-line no-new-func
      new Function(...ids, 'Noodl', `'use strict';return (${body});`);
    } catch (e) {
      return `compiles only in sloppy mode (${(e as Error).message}) — the emitted module is strict TS`;
    }
  }

  const scanned = strippedForScan(body);
  // Function bodies name the Noodl API explicitly; Expression reaches the same globals bare
  // (Variables/Objects/Arrays land via the preamble, detected as reactive dependencies).
  if (/\bNoodl\s*[.\[]/.test(scanned)) {
    return 'reads the Noodl API — the runtime-coupled tier (EXP-003 Tier B)';
  }
  if (kind === 'expression') {
    const raw = expressionIdentifiersOf(body).raw;
    for (const globalName of ['Variables', 'Objects', 'Arrays', 'Vars']) {
      if (raw.has(globalName)) {
        return `reads the Noodl ${globalName} global — reactively subscribed at runtime (EXP-003 Tier B)`;
      }
    }
    if (raw.has('random')) return 'draws randomness (random) — not deterministic';
  }
  for (const gate of MARKER_GATES) {
    if (gate.pattern.test(scanned)) return gate.reason;
  }
  return null;
}
