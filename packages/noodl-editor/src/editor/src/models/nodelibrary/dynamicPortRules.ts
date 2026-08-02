/**
 * Value-derived port rules — WFA-009.
 *
 * A node library entry can say "for each name in this string-list parameter,
 * offer a port built from this template". The editor evaluates it locally, so
 * the ports exist with nothing running — which is the whole point: the cloud
 * runtime that used to push them over `sendDynamicPorts` has had no editor
 * connection since WF-007, and WFA-001 replaced it with a generated library
 * that never executes node code (see WFA-009-ASSESSMENT.md §1).
 *
 * ```jsonc
 * {
 *   "name": "namedports/list",
 *   "condition": "status = success OR status NOT SET",   // optional
 *   "parameter": "params",
 *   "port": { "name": "pm-{{*}}", "displayName": "{{*}}", "type": "*",
 *             "plug": "input", "group": "Parameters" }
 * }
 * ```
 *
 * **Where the line is.** A rule may ask a *question* about parameters (the
 * `condition`, evaluated by the same code `conditionalports/*` uses) and expand
 * *one list parameter* into one port per name. It may not compute anything. A
 * node whose ports depend on a database schema, on another component, or on a
 * parsed script writes a `NodeTypeAdapters` class instead — which is what
 * `PageInputs`, `RouterNavigate` and `Router` already do. Growing this rule an
 * escape hatch until it is code in JSON is the failure mode to avoid.
 *
 * **Not related to the four commented-out managers** at `nodelibrary.ts:117`
 * (`numbered`, `portchannel`, `conditionalports`, `expand`) — their classes no
 * longer exist in the repo and reviving them is explicitly out of WFA-009's
 * scope. `conditionalports/*` in particular is a FILTER over statically declared
 * ports and cannot express `pm-<name>`; this is a generator and does not filter.
 *
 * This module has **no imports on purpose**: it is reached from `tests-unit/`
 * (plain Node, no renderer, no Electron, no editor singletons), which is the
 * only place the editor can test this kind of logic without starting Electron.
 *
 * @module models/nodelibrary/dynamicPortRules
 */

/** A port as the node library, `getPorts()` and `setDynamicPorts()` all speak it. */
export interface GeneratedPort {
  name: string;
  displayName?: string;
  plug?: string;
  type?: unknown;
  group?: string;
  index?: number;
  [extra: string]: unknown;
}

/**
 * The slice of a node this module reads. Structural rather than
 * `NodeGraphNode`, so nothing here imports the renderer — a `ModelProxy` and a
 * plain test double satisfy it just as well.
 */
export interface RuleNodeLike {
  type?: { dynamicports?: unknown[] };
  parameters?: Record<string, unknown>;
  getParameter(name: string, args?: unknown): unknown;
}

/** One `namedports/list` entry, after it has been recognised. */
interface NamedPortsListRule {
  name: string;
  parameter: string;
  condition?: string;
  port: GeneratedPort;
}

/** The only rule name this module answers to. Unknown names are left alone. */
export const NAMED_PORTS_LIST = 'namedports/list';

/** The placeholder a template substitutes each name into. Already this codebase's idiom. */
const PLACEHOLDER = '{{*}}';

const _condFuncCache: Record<string, (params: unknown) => unknown> = {};

/**
 * Evaluate a `dynamicports` condition against a node's parameters.
 *
 * Moved here verbatim from `nodelibrary.ts` so `conditionalports/*` and
 * `namedports/list` cannot drift into two dialects of the same tiny language —
 * `NodeLibrary` now imports it from this module. Two forms:
 *
 *   - `#js <expression>` — evaluated with `params` bound to a proxy that reads
 *     through `getParameter`.
 *   - `<param> <op> <value> [AND|OR …]`, where `op` is `=`, `!=`, or
 *     `NOT SET`. Whitespace-separated, single quotes respected.
 */
export function evaluateDynamicPortsCondition(cond: string, node: RuleNodeLike): boolean {
  if (cond.startsWith('#js')) {
    // This is a JS expression
    if (_condFuncCache[cond] === undefined)
      // eslint-disable-next-line no-new-func
      _condFuncCache[cond] = new Function('params', 'return ' + cond.substring('#js'.length)) as (
        params: unknown
      ) => unknown;

    return !!_condFuncCache[cond](
      new Proxy(node.parameters || {}, {
        get: (_target, prop) => {
          return node.getParameter(prop as string);
        }
      })
    );
  }

  const tokens = cond.match(/(?:[^\s']+|'[^']*')+/g); // Split on whitespace but respect single qoutes

  function evalCond(i: number) {
    if (tokens.length < i + 3) return true;

    const paramName = tokens[i + 0].replace(/'/g, ''); // Trim any quotes
    const op = tokens[i + 1];
    const value = tokens[i + 2].replace(/'/g, '');

    let res;
    switch (op) {
      case '=':
        res = '' + node.getParameter(paramName) === value;
        break;
      case '!=':
        res = '' + node.getParameter(paramName) !== value;
        break;
      case 'NOT':
        res = node.getParameter(paramName) === undefined;
        break;
    }

    if (tokens.length > i + 3) {
      const logic = tokens[i + 3];
      switch (logic) {
        case 'AND':
          return res && evalCond(i + 4);
        case 'OR':
          return res || evalCond(i + 4);
      }
    }

    return res;
  }

  return evalCond(0);
}

/**
 * The names held by a `stringlist` parameter.
 *
 * Deliberately identical to `decodeStringList` in core-ui's `listValueCodec` —
 * ERG-003's single definition of the format — without importing it: this module
 * stays import-free (see the header), and the runtime's own `setup()` functions,
 * which must agree with this one port for port, cannot reach core-ui at all.
 * `split(',').filter(Boolean)`: no trimming (a name may legitimately contain
 * spaces, and the property panel refuses commas), and empty entries dropped so
 * an emptied list does not mint a port with a blank label.
 */
export function namesFromListParameter(value: unknown): string[] {
  if (value === undefined || value === null || value === '') return [];
  if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean);
  if (typeof value !== 'string') return [];
  return value.split(',').filter(Boolean);
}

/** `{{*}}` → `name`, in every string-valued field of a port template. */
function instantiate(template: GeneratedPort, name: string): GeneratedPort {
  const port: GeneratedPort = {} as GeneratedPort;
  for (const key of Object.keys(template)) {
    const value = template[key];
    port[key] = typeof value === 'string' ? value.split(PLACEHOLDER).join(name) : value;
  }
  return port;
}

function namedPortsRules(type: RuleNodeLike['type']): NamedPortsListRule[] {
  const entries = type && type.dynamicports;
  if (!Array.isArray(entries)) return [];

  const rules: NamedPortsListRule[] = [];
  for (const entry of entries) {
    const rule = entry as Partial<NamedPortsListRule>;
    if (!rule || rule.name !== NAMED_PORTS_LIST) continue;
    if (typeof rule.parameter !== 'string' || !rule.port || typeof rule.port.name !== 'string') continue;
    rules.push(rule as NamedPortsListRule);
  }
  return rules;
}

/**
 * Does this node type generate ports from its parameter values?
 *
 * The adapter asks this of every node it hears about, so it is a cheap array
 * scan and nothing more.
 */
export function typeGeneratesNamedPorts(type: RuleNodeLike['type']): boolean {
  return namedPortsRules(type).length > 0;
}

/**
 * The ports a node's current parameter values imply.
 *
 * Order is declaration order, then list order — the same order the runtime's
 * `setup()` pushes them in, which matters because `getPorts()` assigns an index
 * by position when a port does not carry one. A name that appears twice yields
 * one port (the runtime would register the input once either way).
 */
export function generatedPortsForNode(node: RuleNodeLike): GeneratedPort[] {
  const ports: GeneratedPort[] = [];
  const taken: Record<string, boolean> = {};

  for (const rule of namedPortsRules(node.type)) {
    if (rule.condition !== undefined && !evaluateDynamicPortsCondition(rule.condition, node)) continue;

    for (const name of namesFromListParameter(node.getParameter(rule.parameter))) {
      const port = instantiate(rule.port, name);
      if (taken[port.name]) continue;
      taken[port.name] = true;
      ports.push(port);
    }
  }

  return ports;
}
