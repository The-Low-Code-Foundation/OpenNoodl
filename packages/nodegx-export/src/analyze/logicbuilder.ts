/**
 * Visual Function (`Logic Builder`) — the per-node gate, and the reason it reads the workspace
 * rather than the generated text.
 *
 * EXP-002-LOGIC-BUILDER-TARGET-OUTPUT.md is the design; §1 is the part that decides this file's
 * shape. The runtime compiles `generatedCode` — the block editor's JavaScript projection — and
 * never compiles the workspace (`logic-builder.ts` `_compileFunction` says so in as many words).
 * So the *body* is re-hosted verbatim, exactly as EXP-003 re-hosts a Function body.
 *
 * 🔴 **But the gate is on the workspace's block types, not on regexes over the body**, and that
 * is the whole design. A Visual Function body is *generated*, from a closed vocabulary
 * (`NoodlGenerators.ts`), and every port and variable key it writes is a literal read out of a
 * block field:
 *
 *   noodl_get_input    →  Inputs["<literal>"]
 *   noodl_set_output   →  Outputs["<literal>"] = <expr>;
 *   noodl_send_signal  →  sendSignalOnOutput("<literal>");
 *   noodl_get_variable →  Noodl.Variables["<literal>"]
 *   noodl_set_variable →  Noodl.Variables["<literal>"] = <expr>;
 *   noodl_get_object   →  Noodl.Objects[<expr>]        ← NOT literal, hence gated out
 *
 * That is why this slice may bind `Noodl.Variables` to the export's variables store where
 * EXP-003's `jsPurityDefer` must refuse the whole body on `\bNoodl\s*[.\[]`. That refusal is
 * right for a hand-written Function, where the key can be anything; it is wrong for generated
 * code, where the generator guarantees the literal. Reading the workspace is what earns the
 * distinction — and it is the same source of truth `detectIO` rests on, not a second one.
 *
 * Default-closed: a block type this file has not heard of defers the node by name. The block
 * library grows, and an unknown block is exactly the case where the idiom table above stops
 * being a complete description of the body.
 */

import { detectIO, type DetectedIO } from '@nodegx/project-contract/logic-builder-io';
import { NodeIR } from '../ir/types';

export const LOGIC_BUILDER = 'Logic Builder';

/** The label the node shows on the canvas (LGC-001 §3) — what a note should call it. */
export const VISUAL_FUNCTION_LABEL = 'Visual Function';

export function isVisualFunction(type: string): boolean {
  return type === LOGIC_BUILDER;
}

/**
 * The node's two parameters. Both are plain `literal` strings — `logic-builder-workspace` and
 * `logic-builder-hidden` are not `codeeditor` editor types, so `classifyParam` does not make
 * them `script`.
 *
 * ⚠️ Verified against the corpus artefact, not assumed. Session 18 lost a run to the opposite
 * mistake (a `codeeditor` port classifying as `script` where `literal` was expected), so the
 * direction is checked here rather than inferred in either direction.
 */
function literalString(node: NodeIR, name: string): string | undefined {
  const value = node.parameters.find((p) => p.name === name)?.value;
  if (value?.kind === 'literal' && typeof value.value === 'string') return value.value;
  if (value?.kind === 'script' || value?.kind === 'expression') return value.source;
  return undefined;
}

export function workspaceOf(node: NodeIR): string | undefined {
  return literalString(node, 'workspace');
}

export function generatedCodeOf(node: NodeIR): string | undefined {
  return literalString(node, 'generatedCode');
}

/** The port set the runtime registers, from the runtime's own detector. Never mined from code. */
export function visualIoOf(node: NodeIR): DetectedIO {
  return detectIO(workspaceOf(node) ?? '');
}

/**
 * Port names the node itself owns (`logic-builder-io.ts` RESERVED_*), re-stated as the export's
 * own concern: a body writing one of these makes the runtime *fail the whole run*, and a graph
 * consuming one is reading the outcome contract rather than the program.
 */
export const RESERVED_OUTPUT_NAMES: ReadonlySet<string> = new Set([
  'error',
  'success',
  'failure',
  'done',
  'unchanged',
  'completed'
]);

/**
 * The admitted block vocabulary — every type whose generated idiom this slice can account for.
 *
 * Blockly's own built-ins (`controls_*`, `logic_*`, `math_*`, `text*`, `lists_*`, `variables_*`)
 * generate plain JavaScript over locals and literals and touch nothing of Noodl's, so they are
 * admitted wholesale by prefix in `isAdmittedBlock`. Named here are the Noodl blocks, which are
 * the ones that reach the host.
 */
const ADMITTED_NOODL_BLOCKS: ReadonlySet<string> = new Set([
  // Interface declarations — all four generate '' (I/O detection only).
  'noodl_define_input',
  'noodl_define_output',
  'noodl_define_signal_input',
  'noodl_define_signal_output',
  'noodl_when_signal', // the hat; generates '' — see gateOf's note on hats not gating
  // The literal-keyed idiom set.
  'noodl_get_input',
  'noodl_set_output',
  'noodl_send_signal',
  'noodl_get_variable',
  'noodl_set_variable',
  /**
   * Pure helpers — every one of these generates plain JavaScript over an expression plugged
   * into its socket, and reaches nothing of the host's.
   *
   * 🔴 **The object and array operations are admitted; only the object and array *sources* are
   * refused.** `noodl_get_object_property` generates `object["prop"]` and
   * `noodl_array_add` generates `array.push(item)` — neither says anything about where the
   * object came from. If it came from `noodl_get_object` (`Noodl.Objects[…]`) or
   * `noodl_get_array` (`Noodl.Arrays[…]`) then *that* block is in the census and refuses the
   * node; if it came from a local, a JSON parse or `noodl_new_object` (`({})`), the operation
   * is honest plain JavaScript and there is nothing to defer. Gating the operations too would
   * refuse programs that never touch the model store.
   */
  'noodl_convert',
  'noodl_log', // → `console.log(value)`; in a browser the runtime's block console IS this one
  'noodl_json_parse',
  'noodl_json_stringify',
  'noodl_new_object',
  'noodl_get_object_property',
  'noodl_set_object_property',
  'noodl_get_object_property_expr',
  'noodl_set_object_property_expr',
  'noodl_object_members',
  'noodl_object_has_property',
  'noodl_array_length',
  'noodl_array_add',
  // A saved-block call site: its body is inlined into `generatedCode` before we ever see it
  // (`generateWithMyBlocks` → `expandWorkspace`), and the inlined blocks are themselves
  // serialised into this workspace, so they are gated on their own account.
  'myblocks_call_value',
  'myblocks_call_statement'
]);

/**
 * The four blocks that actually reach the host, each refused with the reason the node defers on.
 *
 * These are the only generators in `NoodlGenerators.ts` that emit a `Noodl.*` read the export
 * has no vocabulary for, or a browser global. Everything else in the Noodl families is an
 * operation over a plugged-in expression and is admitted above.
 *
 * ⚠️ Type ids are the editor's own exported constants (`appConfig.ts` APP_CONFIG_BLOCK_TYPE,
 * `appLibraries.ts` LIBRARY_GLOBAL_BLOCK_TYPE, `windowAccess.ts` WINDOW_BLOCK_TYPE), copied
 * rather than imported: they are serialised into `project.json` and frozen in the same sense
 * `HAT_BLOCK_TYPE` is, and reaching into the editor package for three string constants would
 * couple the export to the editor's window-only module graph.
 */
const REFUSED_BLOCKS: ReadonlyMap<string, string> = new Map([
  ['noodl_get_object', 'reads the Noodl Objects model store — the runtime-coupled tier (EXP-003 Tier B)'],
  ['noodl_get_array', 'reads the Noodl Arrays model store — the runtime-coupled tier (EXP-003 Tier B)'],
  ['noodl_get_config', 'reads Noodl.Config — the export has no app-config vocabulary'],
  ['noodl_library_global', 'reaches a library global on window — not translatable in this slice'],
  ['noodl_window', 'reaches the browser window — not translatable in this slice']
]);

/** Blockly's own block families: plain JavaScript over locals, nothing host-coupled. */
const ADMITTED_PREFIXES = ['controls_', 'logic_', 'math_', 'text', 'lists_', 'variables_', 'procedures_'];

function isAdmittedBlock(type: string): boolean {
  if (ADMITTED_NOODL_BLOCKS.has(type)) return true;
  return ADMITTED_PREFIXES.some((prefix) => type.startsWith(prefix));
}

/** One block in the serialised workspace, with the two fields this file reads. */
interface RawBlock {
  type?: string;
  fields?: Record<string, unknown>;
  inputs?: Record<string, { block?: RawBlock; shadow?: RawBlock } | undefined>;
  next?: { block?: RawBlock };
}

export interface WorkspaceCensus {
  /** Every block type present, in first-encounter order. */
  types: string[];
  /** Names read by `noodl_get_variable`, first-mention order. */
  variableReads: string[];
  /** Names written by `noodl_set_variable`, first-mention order. */
  variableWrites: string[];
  /** Names sent by `noodl_send_signal`. */
  signalSends: string[];
  /** Names written by `noodl_set_output`. */
  outputWrites: string[];
  /**
   * Names written by a `noodl_set_output` whose **value socket is empty** — the subset of
   * `outputWrites` whose generated statement is `Outputs["name"] = null;`.
   *
   * 🔴 This is the block editor's own rule, not an inference:
   * `NoodlGenerators.ts` emits `valueToCode(block, 'VALUE', …) || 'null'`, so an unplugged
   * socket generates the literal `null` — and the runtime stores it verbatim
   * (`logic-builder.ts`: `internal.outputValues[name] = context.Outputs[name]`), with no
   * coercion against the port's declared type on either side of the wire. A `number` output
   * really does deliver `null`, so the emitted wrapper's field type has to admit it.
   *
   * Read here off the workspace rather than mined out of `generatedCode`, for the reason
   * `variables` is: the workspace is the authored artefact and the code is its projection.
   *
   * ⚠️ **An under-approximation, deliberately.** A *filled* socket can still evaluate to null at
   * runtime (`get variable` on an unset variable is the corpus case). Those paths reach the
   * field through `any`-typed shims, so they neither typecheck wrong nor widen anything; this
   * list is the set that is null by construction, which is the set that needs the type.
   */
  emptyOutputWrites: string[];
  /** True when the workspace held no blocks at all (or would not parse). */
  empty: boolean;
}

/**
 * Walk the workspace once and report what it contains.
 *
 * Deliberately a separate traversal from `detectIO`'s rather than an extension of it: that one
 * is the runtime's, published as the port set's single source of truth, and this one asks a
 * different question (which blocks are here, and which variable names do they name). Reaching
 * into it for a second purpose would make the export a second reader of a function whose
 * contract is about ports.
 *
 * Never throws — an unreadable workspace reports `empty`, and the caller defers on it.
 */
export function censusOf(workspaceJson: string | undefined): WorkspaceCensus {
  const census: WorkspaceCensus = {
    types: [],
    variableReads: [],
    variableWrites: [],
    signalSends: [],
    outputWrites: [],
    emptyOutputWrites: [],
    empty: true
  };
  if (workspaceJson === undefined || workspaceJson.trim().length === 0) return census;

  let parsed: { blocks?: { blocks?: RawBlock[] } };
  try {
    parsed = JSON.parse(workspaceJson);
  } catch {
    return census;
  }
  const roots = parsed?.blocks?.blocks;
  if (!Array.isArray(roots)) return census;

  const push = (list: string[], name: unknown) => {
    if (typeof name === 'string' && name !== '' && !list.includes(name)) list.push(name);
  };

  const walk = (block: RawBlock | undefined): void => {
    if (!block || typeof block.type !== 'string') return;
    census.empty = false;
    if (!census.types.includes(block.type)) census.types.push(block.type);

    const name = block.fields?.NAME;
    switch (block.type) {
      case 'noodl_get_variable':
        push(census.variableReads, name);
        break;
      case 'noodl_set_variable':
        push(census.variableWrites, name);
        break;
      case 'noodl_send_signal':
        push(census.signalSends, name);
        break;
      case 'noodl_set_output': {
        push(census.outputWrites, name);
        // Blockly's `valueToCode` resolves the socket's *target* block, which is the shadow when
        // only a shadow is attached — so a shadow counts as plugged in, exactly as it does in
        // the editor. Empty means no socket entry at all, or one holding neither.
        const socket = block.inputs?.VALUE;
        if (socket === undefined || (socket.block === undefined && socket.shadow === undefined)) {
          push(census.emptyOutputWrites, name);
        }
        break;
      }
    }

    for (const key of Object.keys(block.inputs ?? {})) {
      const input = block.inputs![key];
      if (!input) continue;
      walk(input.block);
      walk(input.shadow);
    }
    walk(block.next?.block);
  };

  for (const root of roots) walk(root);
  return census;
}

export interface VisualGateResult {
  /** The named defer reason, or null when the node passes. */
  defer: string | null;
}

/**
 * The gates (design §4). Any hit defers the node with a reason the tests assert by name.
 *
 * ⚠️ The body is *not* scanned for markers here. The vocabulary gate is stronger: a workspace
 * inside the admitted set cannot have generated a `fetch`, a `Date` or a `this`, because no
 * admitted block generates one. `procedures_*` and the My Blocks call blocks inline bodies —
 * but those bodies serialise into this same workspace, so their blocks are censused too.
 */
export function visualGateOf(node: NodeIR): VisualGateResult {
  const workspace = workspaceOf(node);
  const code = generatedCodeOf(node);
  const census = censusOf(workspace);

  // §3.5 — a node with no blocks is not a failure. The runtime answers `Unchanged` and does
  // nothing; the faithful translation is nothing. This is NOT a defer.
  const noWorkspace = workspace === undefined || workspace.trim().length === 0;
  const noCode = code === undefined || code.trim().length === 0;
  if (noWorkspace && noCode) return { defer: null };

  // Gate 5 — the two parameters must agree. A workspace with no projection is an editor that
  // never flushed, and a projection with no workspace has no port set to register.
  if (noCode) return { defer: 'the block program has no generated code — the editor never flushed it' };
  if (noWorkspace) return { defer: 'the node has generated code but no block workspace to read its ports from' };
  if (census.empty) return { defer: 'the block workspace could not be read' };

  // Gate 1/2/3/4 — the vocabulary, default-closed.
  for (const type of census.types) {
    const refused = REFUSED_BLOCKS.get(type);
    if (refused !== undefined) return { defer: `a block in the program ${refused}` };
    if (!isAdmittedBlock(type)) {
      return { defer: `the program uses the block "${type}", which this slice does not translate` };
    }
  }

  /**
   * A block-declared signal input other than the built-in `run`.
   *
   * ⚠️ `run` appearing in `signalInputs` is **not** one of these: it is `DEFAULT_HAT_SIGNAL`, and
   * a hat carrying that name deliberately publishes no new port — it names the port the node
   * already has (`logic-builder-io.ts` says so). Every corpus node is either that or nothing.
   *
   * A second signal input is a second entry point into the same body, and because hats do not
   * gate (§1.6) both entry points run the *whole* program. Translating that needs a trigger
   * parameter threaded through every caller, which no corpus node would exercise — so it is
   * refused rather than built untested.
   */
  const io = detectIO(workspace);
  for (const name of io.signalInputs) {
    if (name === 'run') continue;
    return { defer: `the program declares the signal input "${name}" — this slice runs only the built-in Run` };
  }

  // Gate 7 — a write to one of the node's own port names. The runtime fails the entire run on
  // this (`logic-builder/reserved-port-name`), which is not worth reproducing.
  for (const name of [...census.outputWrites, ...census.signalSends]) {
    if (RESERVED_OUTPUT_NAMES.has(name)) {
      return { defer: `the program writes "${name}", which is one of the node's own output ports` };
    }
  }

  // Gate 6 — the body must compile, and compile strict: the emitted module is strict TS while
  // the runtime compiles sloppy, so a body that only compiles sloppy would fail the emitted
  // app's own build. Same rule and same reason as EXP-003's (jsfun.ts).
  const params = [
    'Inputs',
    'Outputs',
    'Noodl',
    'Variables',
    'Objects',
    'Arrays',
    'sendSignalOnOutput',
    '__triggerSignal__',
    '__p',
    '__s',
    'console'
  ];
  try {
    // eslint-disable-next-line no-new-func
    new Function(...params, code!);
  } catch (e) {
    return { defer: `the block program does not compile: ${(e as Error).message}` };
  }
  try {
    // eslint-disable-next-line no-new-func
    new Function(...params, `'use strict';\n${code!}`);
  } catch (e) {
    return {
      defer: `the block program compiles only in sloppy mode (${(e as Error).message}) — the emitted module is strict TS`
    };
  }

  return { defer: null };
}

/**
 * Does this node have a program to run at all? A Visual Function with no blocks answers
 * `Unchanged` at runtime, so it translates to nothing rather than deferring (§3.5).
 */
export function hasProgram(node: NodeIR): boolean {
  const code = generatedCodeOf(node);
  return code !== undefined && code.trim().length > 0;
}
