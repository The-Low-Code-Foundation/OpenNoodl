/**
 * FIX-007 — a wire to the name the script uses, on a node that does not use it.
 *
 * ## The failure this exists to catch
 *
 * A Function node's connectable port **name** is prefixed and its script name is
 * not: `simplejavascript.ts` mints ports through `JavascriptNodeParser` with
 * `inputPrefix: 'in-'` / `outputPrefix: 'out-'`, and the parser stores
 * `{ name: prefix + p, displayName: p }`. So a script reading `Inputs.amount`
 * gives a port **named** `in-amount` and **labelled** `amount`.
 *
 * The panel shows the label. Both catalogs used to document the label as if it
 * were the name, and all three worked examples wired it. A connection written
 * `toProperty: "amount"` then passes every gate we own — MCP's zod (four plain
 * strings), the semantic validator's port rule (which skips `runtime-discovered`
 * types **by design**, and must keep doing so), the structural schema — and
 * fails only later, on the canvas, as the health warning `con-no-target-port`
 * ("Target port doesn't exist"). The user redraws what looks like the identical
 * connection by hand, gets `in-amount` because the drag reads the port not the
 * label, and it works. The AI looks broken and nothing can say why.
 *
 * ## Why it is safe to error where the port rule must not
 *
 * The port rule sees a node type whose ports are runtime-determined and stops,
 * correctly. This check does not guess either — it reads the **same parameter
 * the runtime reads** (`functionScript`) with the **same regexes**, and speaks
 * only when the mined set proves the intent: the bare name is a port this very
 * script creates, so the author meant that port and wrote its label. Anything
 * else — a name the script does not mention, a correctly prefixed name, a name
 * that is also one of the node's declared ports — falls through silently.
 *
 * That last exclusion matters more than it looks. `Outputs.done()` mines `done`,
 * and `done` is *also* a declared signal output of the node (as are `success`,
 * `failure`, `completed`, `unchanged`, `error`, and the `run` input). Wiring
 * `done` is legitimate — it is the built-in — so the mined-name test alone would
 * report working graphs. The declared-port test is what keeps this at zero false
 * positives, and it is the reason the prefix exists at all: `out-done` and
 * `done` are two different ports on one node.
 *
 * ## Calibration
 *
 * Measured over the 44-project test corpus: **124 endpoints on 71 Function
 * nodes, 80 of them correctly prefixed, and 12 hits** — every one a dead wire,
 * and every one in a graph an agent wrote. Not a single hand-drawn or prefab
 * connection is affected, which is the split the mechanism predicts: a drag
 * reads the port, only a writer reads the label. The canonical hit is `Puppy
 * test 3`'s "Format Puppy List" — script reads `Inputs.items`, writes
 * `Outputs.text`, wired `items` → `text`, `ports: []`, so the page's list has
 * never rendered under a clean report.
 *
 * ## The duplicated regexes
 *
 * The families below are copied from `@noodl/runtime`'s `javascriptnodeparser.js`
 * rather than imported, for the reason `CatalogIndex`'s `runOnChange-` prefix is
 * copied: this layer runs in the editor, in the MCP server and in a CLI, and must
 * not pull the runtime in. Unlike that one-string copy, these are five regexes
 * that can drift — so `tests-unit/fix-007/function-ports.test.ts` runs both
 * implementations over a corpus and fails when they disagree. Change them there
 * first.
 *
 * Note the parser does **not** strip comments before mining (the commented-out
 * `scriptWithoutComments` line in its source is the record of that decision), so
 * a commented `Inputs.x` really does create a port. This mirrors it.
 *
 * Pure — the caller supplies the nodes, the wires and the catalog.
 *
 * @module noodl-editor/validation/functionPorts
 */

import type { CatalogIndex } from './CatalogIndex';
import { DiagnosticCode, type Diagnostic, type Severity } from './diagnostics';

/** The Function node. `Javascript2` (Script) declares its ports and does not prefix them. */
export const FUNCTION_NODE_TYPE = 'JavaScriptFunction';

/** The Script node, whose ports are runtime-discovered by parsing its `code`. */
export const SCRIPT_NODE_TYPE = 'Javascript2';

/**
 * The members of the injected `Node` object the parser actually reads back.
 *
 * ⚠️ **Hand-kept against `javascriptnodeparser.js`, like the regexes above**, and
 * the line references are there so drift is checkable rather than assumed:
 * `Inputs`/`Outputs` `:165-166`, `setOutputs` `:171`, `OnInit` `:178`,
 * `OnDestroy` `:181`, `Setters` `:184`, `OnInputsChanged` `:189`,
 * `Signals` `:203`. Touching one of those lines should bring you here.
 */
export const SCRIPT_NODE_API_MEMBERS = [
  'Inputs',
  'Outputs',
  'Signals',
  'Setters',
  'OnInputsChanged',
  'OnInit',
  'OnDestroy',
  'setOutputs'
] as const;

/**
 * Does this body declare anything the runtime can call after load?
 *
 * Three generations, all live, and the third is the one the shipped library
 * actually uses — see {@link DiagnosticCode.UnrunnableScriptNode} for the census
 * that made counting all three non-optional. `Script` is the parser's own alias
 * for `Node` (`getCodePrefix`), so both spellings count; the lowercase `script(`
 * is the unrelated 2nd-generation call, and the distinction is case-sensitive.
 */
const SCRIPT_DECLARATION = new RegExp(
  ['\\bdefine\\s*\\(', '\\bscript\\s*\\(', `\\b(?:Node|Script)\\s*\\.\\s*(?:${SCRIPT_NODE_API_MEMBERS.join('|')})\\b`].join(
    '|'
  )
);

/**
 * Whether a Script node's body declares a surface the runtime can re-enter.
 *
 * Exported for the specs and for anything else that needs the question without
 * the diagnostic — the predicate is the interesting half of this rule.
 */
export function scriptDeclaresRunnableSurface(code: unknown): boolean {
  if (typeof code !== 'string' || code.trim().length === 0) return false;
  return SCRIPT_DECLARATION.test(code);
}

export interface CheckScriptNodeRunnableOptions {
  /** Component identifier for the diagnostic's location. */
  component: string;
  /** Severity for these findings. Defaults to `warning` — see the code's note. */
  severity?: Severity;
}

/**
 * FIX-006 §3 — a Script node whose body runs once and can never be triggered.
 *
 * The shape the report described: Function-shaped code in a `Javascript2` node.
 * It mints ports from its `Inputs.`/`Outputs.` mentions, so the graph looks
 * wired, and it has no `run` signal to wire, so nothing can ever re-enter it.
 */
export function checkScriptNodeRunnable(
  nodes: readonly ScriptCarryingNode[],
  options: CheckScriptNodeRunnableOptions
): Diagnostic[] {
  const { component, severity = 'warning' } = options;
  const diagnostics: Diagnostic[] = [];

  for (const node of nodes) {
    if (node.type !== SCRIPT_NODE_TYPE) continue;
    const parameters = node.parameters ?? {};
    // The body is elsewhere, so `code` is not evidence of anything.
    if (parameters['useExternalFile'] === 'yes') continue;
    const code = parameters['code'];
    // Unfinished, not wrong.
    if (typeof code !== 'string' || code.trim().length === 0) continue;
    if (scriptDeclaresRunnableSurface(code)) continue;

    const label = node.label ? `"${node.label}"` : node.type;
    diagnostics.push({
      code: DiagnosticCode.UnrunnableScriptNode,
      severity,
      message:
        `The Script node ${label} declares nothing the runtime can call. Its body runs once, when ` +
        'the project loads, and never again — a Script node has no `run` signal and no static ' +
        'outputs, so there is no port that could re-enter it. Any ports it appears to have were ' +
        'mined from its `Inputs.`/`Outputs.` mentions, which is what makes the graph look wired.',
      location: { component, nodeId: node.id, nodeType: SCRIPT_NODE_TYPE },
      suggestion:
        'If this is one-off code that should run on a signal, use a Function node ' +
        `(\`${FUNCTION_NODE_TYPE}\`) instead — it has a \`run\` input and declares outputs you can ` +
        'wire. If it belongs in a Script node, declare a surface the runtime can re-enter: ' +
        '`Node.Signals.Go = function () { … }` for a signal input, `Node.Inputs` / `Node.Outputs` ' +
        'for typed ports, or `Node.OnInit` for load-time setup you meant to be load-time.'
    });
  }

  return diagnostics;
}

/** `simplejavascript.ts:736-739`. */
export const FUNCTION_INPUT_PREFIX = 'in-';
export const FUNCTION_OUTPUT_PREFIX = 'out-';

/** Verbatim from `javascriptnodeparser.js`'s `parseAndAddPortsFromScript`. */
const INPUT_PATTERNS = [/Inputs\.([A-Za-z0-9_]+)/g, /Inputs\s*\[\s*(?:'|")(.*)(?:'|")\s*\]/g];
const OUTPUT_PATTERNS = [
  /Outputs\.([A-Za-z0-9]+)\s*\(\s*\)/g, // signal, Outputs.Done()
  /Outputs\s*\[\s*(?:'|")(.*)(?:'|")\s*\]\(\s*\)/g,
  /Outputs\.([A-Za-z0-9_]+)/g,
  /Outputs\s*\[\s*"([^"]*)"\s*\]/g
];

/** The *display* names a Function script creates — unprefixed, as the panel shows them. */
export interface MinedFunctionPorts {
  inputs: Set<string>;
  outputs: Set<string>;
}

function mineWith(script: string, patterns: readonly RegExp[]): Set<string> {
  const found = new Set<string>();
  for (const pattern of patterns) {
    // Each use gets a fresh lastIndex; the module-level literals are /g.
    pattern.lastIndex = 0;
    for (const match of script.matchAll(pattern)) {
      const name = match[1];
      if (typeof name === 'string' && name.length > 0) found.add(name);
    }
  }
  return found;
}

/**
 * The ports a Function script creates, by display name.
 *
 * Returns empty sets for a script that is not a string, so a node whose
 * `functionScript` is absent or wrongly shaped simply produces no findings.
 */
export function mineFunctionScriptPorts(script: unknown): MinedFunctionPorts {
  if (typeof script !== 'string' || script.length === 0) {
    return { inputs: new Set(), outputs: new Set() };
  }
  return { inputs: mineWith(script, INPUT_PATTERNS), outputs: mineWith(script, OUTPUT_PATTERNS) };
}

/** A connection as this check reads it. */
export interface FunctionWireLike {
  fromId: string;
  fromProperty: string;
  toId: string;
  toProperty: string;
}

/** The nodes this check reads — the same shape the other value checks take. */
export interface ScriptCarryingNode {
  id: string;
  type: string;
  label?: string;
  parameters?: Record<string, unknown> | null;
  ports?: readonly { name?: unknown }[] | null;
}

export interface CheckFunctionNodePortsOptions {
  /** Component identifier for the diagnostic's location. */
  component: string;
  /**
   * The candidate's connections. **Omitted means "do not check"** — the same
   * convention `urlPaths`, `backend` and `interfaces` follow in this layer. A
   * caller that cannot supply wires has nothing for this check to read.
   */
  wires?: readonly FunctionWireLike[];
  /** Read to tell a mined name that is also a declared port from one that is not. */
  catalog: CatalogIndex;
  /** Severity for these findings. Defaults to `error` — see the module note above. */
  severity?: Severity;
}

/**
 * Connections that name a Function node's port by its display label instead of
 * its name.
 */
export function checkFunctionNodePorts(
  nodes: readonly ScriptCarryingNode[],
  options: CheckFunctionNodePortsOptions
): Diagnostic[] {
  const { component, wires, catalog, severity = 'error' } = options;
  if (!wires || wires.length === 0) return [];

  const mined = new Map<string, MinedFunctionPorts>();
  const declared = new Map<string, Set<string>>();
  const labels = new Map<string, string>();
  for (const node of nodes) {
    if (node.type !== FUNCTION_NODE_TYPE) continue;
    mined.set(node.id, mineFunctionScriptPorts(node.parameters?.['functionScript']));
    labels.set(node.id, node.label ? `"${node.label}"` : node.type);
    const own = new Set<string>();
    if (Array.isArray(node.ports)) {
      for (const port of node.ports) {
        if (port && typeof port === 'object' && typeof port.name === 'string') own.add(port.name);
      }
    }
    declared.set(node.id, own);
  }
  if (mined.size === 0) return [];

  const diagnostics: Diagnostic[] = [];

  for (const wire of wires) {
    const endpoints = [
      { id: wire.toId, port: wire.toProperty, plug: 'input' as const, prefix: FUNCTION_INPUT_PREFIX },
      { id: wire.fromId, port: wire.fromProperty, plug: 'output' as const, prefix: FUNCTION_OUTPUT_PREFIX }
    ];

    for (const { id, port, plug, prefix } of endpoints) {
      const ports = mined.get(id);
      if (!ports) continue; // not a Function node in this candidate
      if (typeof port !== 'string' || port.length === 0) continue;
      if (port.startsWith(prefix)) continue; // already the port name
      if (!(plug === 'input' ? ports.inputs : ports.outputs).has(port)) continue; // not a name we can prove
      // A declared port of the node, or one the instance serialises, really is
      // connectable under this exact name — `done` beside `Outputs.done()`.
      if (catalog.hasPort(FUNCTION_NODE_TYPE, plug, port)) continue;
      if (declared.get(id)?.has(port)) continue;

      const correct = prefix + port;
      const reference = plug === 'input' ? `Inputs.${port}` : `Outputs.${port}`;
      diagnostics.push({
        code: DiagnosticCode.UnprefixedFunctionPort,
        severity,
        message:
          `Connection names ${plug === 'input' ? 'input' : 'output'} "${port}" on the Function node ` +
          `${labels.get(id)}, but that port is named "${correct}". A Function node's ports are prefixed ` +
          `and its script names are not — \`${reference}\` creates the port "${correct}", displayed as ` +
          `"${port}". A wire to the display name connects to nothing and the canvas reports ` +
          `"Target port doesn't exist".`,
        location: {
          component,
          nodeId: id,
          nodeType: FUNCTION_NODE_TYPE,
          port,
          plug,
          connection: {
            fromId: wire.fromId,
            fromProperty: wire.fromProperty,
            toId: wire.toId,
            toProperty: wire.toProperty
          }
        },
        suggestion:
          `Write ${plug === 'input' ? 'toProperty' : 'fromProperty'}: "${correct}". The node's own declared ` +
          'ports — run, done, success, failure, completed, unchanged, error — are not prefixed; only the ' +
          'ports mined from the script are.'
      });
    }
  }

  return diagnostics;
}
