/**
 * The `Script` node (`Javascript2`) — EXP-011 §52, Tier 2.8 row 2. The plan-time half that looks
 * only at the node: what its code may reach, which ports it has, and the type each port carries
 * into the emitted hook. Everything graph-shaped (input sourcing, output reads, signal chains)
 * lives in plan.ts beside the `States` node it is modelled on.
 *
 * ## Why this is not the Function node's gate
 *
 * `jsfun.ts` admits a body only when it is *pure*, because the Function wrapper is a render-time
 * computation — a timer or a DOM read inside it would run on every render. A Script node is the
 * opposite kind of thing: `javascriptnodeparser.js` runs its code **once**, when the node is
 * created, and the code declares an object with a lifecycle (setup, change, destroy) and signal
 * functions the runtime calls later. The corpus confirms what the node is for — every real body
 * on disk keeps state in module-level `let`s and reaches `setInterval`, `navigator.mediaDevices`,
 * a DOM element or a CDN script. So the export **hosts** the code (`src/lib/script.ts` transcribes
 * the runtime's parser and lifecycle) rather than re-hosting it as a function, and the only things
 * it refuses are the ones the exported app cannot supply: the Noodl API, the Component scope, the
 * node graph (`createComponent`), a dynamic `import()`, and code fetched from a URL at runtime.
 *
 * ## The port set is the one on disk
 *
 * The deployed runtime registers a Script node's outputs from `model.outputPorts`
 * (`javascript.ts` `_onCodeParsed`), and `nodemodel.ts` `createFromExportData` builds those from
 * the node's `ports` — the set the editor persisted after running the code (`dynamicports`, which
 * `parseProject` merges into `declaredPorts`). This module never runs the code to discover ports:
 * it reads the same set the running app reads. A node with no persisted ports whose code names
 * some is a node the editor has not opened yet, and it defers by name rather than being hosted
 * with no ports, because the running app has none either and the author has to be told why.
 */

import { NodeIR, PortIR } from '../ir/types';
import { strippedForScan } from './jsfun';

export const SCRIPT_TYPE = 'Javascript2';

/** javascriptnodeparser.js `getCodePrefix()`, verbatim — `Script` is the runtime's own alias for `Node`. */
export const SCRIPT_CODE_PREFIX = "const Script = (typeof Node !== 'undefined')?Node:undefined;";

/** The node's own static inputs (`javascript.ts` `inputs`) — never ports the script declares. */
const STATIC_INPUTS: ReadonlySet<string> = new Set(['code', 'externalFile', 'scriptInputs', 'scriptOutputs', 'useExternalFile']);

/** Whether `port` is one of the node's own inputs rather than a port its script declares. */
export function isStaticScriptInput(port: string): boolean {
  return STATIC_INPUTS.has(port) || port.startsWith('intype-') || port.startsWith('outtype-');
}

export interface ScriptPorts {
  /** Value inputs, in declaration order. */
  inputs: PortIR[];
  /** Signal inputs — each is a function the code declares (`Node.Signals.x`, `signals: { x }`, or a `define` key). */
  signalInputs: string[];
  /** Value outputs, in declaration order. */
  outputs: PortIR[];
  /** Signal outputs — `Outputs.x()` in the code pulses these. */
  signalOutputs: string[];
}

/** The node's declared ports, split the way the hook needs them; static inputs and the type rows excluded. */
export function scriptPortsOf(node: NodeIR): ScriptPorts {
  const ports: ScriptPorts = { inputs: [], signalInputs: [], outputs: [], signalOutputs: [] };
  const seen = new Set<string>();
  for (const port of node.declaredPorts) {
    if (isStaticScriptInput(port.name)) continue;
    const key = `${port.plug}:${port.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (port.plug === 'input') {
      if (port.kind === 'signal') ports.signalInputs.push(port.name);
      else ports.inputs.push(port);
    } else if (port.kind === 'signal') ports.signalOutputs.push(port.name);
    else ports.outputs.push(port);
  }
  return ports;
}

/** The node's verbatim code, from the parameter the runtime compiles. */
export function scriptCodeOf(node: NodeIR): string | undefined {
  const value = node.parameters.find((p) => p.name === 'code')?.value;
  if (value?.kind === 'script') return value.source;
  if (value?.kind === 'literal' && typeof value.value === 'string') return value.value;
  return undefined;
}

/**
 * The TypeScript type a declared port carries into the hook. `*`, `object`, `cloudfile` and any
 * spelling the editor's type enums do not offer are `any` — EXP-003 §4's ruling that an untyped
 * runtime delivery's honest type is `any`, not `unknown`, because the code was written against it.
 */
export function scriptPortTsType(type: string | undefined): string {
  switch (type) {
    case 'string':
    case 'color':
      return 'string';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'array':
      return 'any[]';
    default:
      return 'any';
  }
}

/** Whether the code declares or reads ports at all — the test for "the editor has not discovered them yet". */
export function scriptNamesPorts(code: string): boolean {
  return /\b(Inputs|Outputs|Signals|Setters)\b|\bdefine\s*\(|\bscript\s*\(/.test(strippedForScan(code));
}

/**
 * The markers the exported app cannot supply, scanned over the body with comments and quoted
 * strings stripped (jsfun.ts's discipline). Deliberately **not** here: timers, `window`, the DOM,
 * `fetch`, `async`, `this`, `Date`, `Math.random` — a Script node's code runs inside effects and
 * handlers the host owns, never in render, and those are what the node exists to reach.
 */
const MARKER_GATES: ReadonlyArray<{ pattern: RegExp; reason: string }> = [
  { pattern: /\bNoodl\s*[.\[]/, reason: 'reads the Noodl API — the runtime-coupled tier (EXP-003 Tier B)' },
  {
    pattern: /\bComponent\s*[.\[]/,
    reason: 'reads the Component scope — the component-record tier (controlled-state slice + EXP-003 Tier B)'
  },
  {
    pattern: /\bcreateComponent\s*\(|\bdeleteComponent\s*\(/,
    reason: 'creates or deletes nodes at runtime (createComponent) — the exported app has no node graph to add to'
  },
  { pattern: /\bimport\s*\(/, reason: 'loads code dynamically (import()) — not translatable in this slice' }
];

/**
 * What the code itself rules out, or null when it can be hosted. The compile checks use the
 * constructor the runtime uses (`new Function` over the prefixed code, non-strict), then recompile
 * strict: the emitted file is an ES module, and a body that only compiles sloppy would fail the
 * exported app's own build (the Function gate's rule, unchanged here).
 */
export function scriptBodyDefer(code: string): string | null {
  try {
    // eslint-disable-next-line no-new-func
    new Function('define', 'script', 'Node', 'Component', `${SCRIPT_CODE_PREFIX}\n${code}`);
  } catch (e) {
    return `does not compile: ${(e as Error).message}`;
  }
  try {
    // eslint-disable-next-line no-new-func
    new Function('define', 'script', 'Node', 'Component', `'use strict';\n${SCRIPT_CODE_PREFIX}\n${code}`);
  } catch (e) {
    return `compiles only in sloppy mode (${(e as Error).message}) — the emitted module is strict TS`;
  }
  const scanned = strippedForScan(code);
  for (const gate of MARKER_GATES) {
    if (gate.pattern.test(scanned)) return gate.reason;
  }
  return null;
}
