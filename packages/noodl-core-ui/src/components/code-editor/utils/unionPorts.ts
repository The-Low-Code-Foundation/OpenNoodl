/**
 * Every port a Function or Script node has, from **both** routes at once.
 *
 * Phase 61's shared prelude. Four tasks need the same list and none of them owns
 * it: FUN-004's diagnostics, FUN-005's rail, FUN-006's bar and FUN-008's
 * completions. Each inventing its own union would mean four answers to *"is
 * `Done` a signal?"* — and that question has a non-obvious answer (see
 * **Collisions** below), so four answers means three defects.
 *
 * ## This composes; it does not replace
 *
 * `collectDeclaredPorts` (`declaredPorts.ts`) reads the proplist an author filled
 * in. `minePorts` (`scriptPorts.ts`) reads the `Inputs.x` / `Outputs.y` in the
 * document. They are deliberately separate, and `authoringContext.ts:69-77` says
 * why: *"you declared this port and have not used it"* is a sentence that needs
 * both lists apart, and is impossible from either alone — or from a merged one.
 *
 * So this adds a third function rather than merging the two. `declared` and
 * `mined` stay on the row as flags for exactly that reason: a consumer that wants
 * "declared but never read" filters `p.declared && !p.mined`, and one that wants
 * "used in code but not declared" filters the mirror. A plain merged list can
 * express neither.
 *
 * ## Collisions: the declared row wins, and that is the runtime's answer
 *
 * When a name appears in both places, the **declared type is the effective one**,
 * even where the code says otherwise. This is not a preference; it is what the
 * node does. `_updatePorts` (`simplejavascript.ts:786-849`) pushes the proplist's
 * ports first and only then calls `parseAndAddPortsFromScript`, whose `_exists`
 * guard (`javascriptnodeparser.js:296-300`) drops any push whose name and plug
 * are already present. The mined row never lands.
 *
 * The consequence is the trap worth naming: a port declared with `outtype-` set
 * to `String` but written `Outputs.Done()` in the body is a **value** port. It
 * looks like a signal in the code, the author calls it like a signal, and no wire
 * they can draw from it will fire. A consumer that mined the text and believed it
 * would tell them the opposite of the truth.
 *
 * ## Inputs are never signals
 *
 * No `intype-` an author can choose says otherwise: the enum
 * (`simplejavascript.ts:742-770`) lists seven value types, and the `signal` entry
 * is concatenated on for `outtype-` only. Nor can the body make one — only the
 * two `Outputs` signal patterns produce `type: 'signal'`, so a mined input is
 * `'*'` however it is written, `Inputs.Go()` included.
 *
 * `kind` is still derived from `type` for inputs rather than pinned to `'value'`,
 * because the runtime does not pin it either: `registerInputIfNeeded`
 * (`simplejavascript.ts:648-655`) hands `intype-` straight to the port. A
 * hand-edited project carrying `intype-Go: signal` therefore reads as a signal
 * here exactly as it would behave there. Through the UI the case is unreachable,
 * and a consumer branching on an input's kind is branching on a constant.
 *
 * ## ⚠️ The order is by pattern, not by document position
 *
 * `minePorts` runs each of its six patterns over the whole document in turn, so
 * every `Inputs.x` comes before every `Inputs["x"]` whatever order they are
 * written in. Declared rows still lead, and the result is stable — but a rail or
 * a bar that promised "in the order they appear in your code" would be wrong on
 * the first body that mixed the two notations.
 *
 * ## ⚠️ Gate on the mode, not on the result
 *
 * Nothing here knows what kind of editor is open, and the mining half will
 * happily read `Inputs.foo` out of an **Expression** node's text — where it is
 * not a port at all, and where inserting that notation would create a port called
 * `Inputs` (`declaredPorts.ts:126-136`). An empty result cannot be used as the
 * gate: it is also what a Function node nobody has touched looks like.
 *
 * 🔴 **This paragraph used to name `modeHasDeclaredPorts` as the gate, and that
 * was wrong — FIX-016.** Three consumers followed it, and all three were wrong in
 * the same way, because a **Script node has declared ports but mines nothing**.
 * Its `scriptInputs`/`scriptOutputs` proplists are real, so that predicate says
 * yes; its ports otherwise come from `parser.getPorts()` — `define({ inputs,
 * outputs })`, `Node.Inputs`, `Node.Signals` — and never from a regex over the
 * document, so the `mined` half of every row below is fabricated there. The help
 * bar consequently told a correct Script node to *"Read price with
 * `Inputs.price`"*, and completion offered to insert that same notation, while
 * FIX-016's message 6 underlined it as throwing.
 *
 * ✅ **The gate is `modeUsesPortNotation(validationType)`** — the question this
 * module's mining half actually turns on. `modeHasDeclaredPorts` remains the
 * right gate for anything asking about the *declared* half alone (message 6 is
 * gated on it and must stay that way).
 *
 * Plain data in, plain data out — no DOM, no node model — so this runs in the
 * package's `testEnvironment: 'node'` runner (CED-001).
 *
 * @module code-editor/utils
 */

import type { OpenNodeFact, PortFact } from '../authoringContext';
import type { PortKind } from './notation';
import { minePorts } from './scriptPorts';

/**
 * One port, seen from both routes.
 *
 * `name` is the display name — never prefixed with `in-`/`out-`. Neither source
 * carries the prefix: the proplist stores the author's label, and the parser
 * captures the text after `Inputs.` (the runtime applies the prefix afterwards,
 * on its way into the port list).
 */
export interface UnionPort {
  /** Display name — what goes between the quotes of `Inputs["…"]`. */
  readonly name: string;
  /**
   * The effective port type, as the node will register it: the declared
   * `intype-`/`outtype-` value where there is one, otherwise what the parser
   * assigns (`'*'`, or `'signal'` for a called output).
   */
  readonly type: string;
  /** Present in the `scriptInputs` / `scriptOutputs` proplist. */
  readonly declared: boolean;
  /** Written as `Inputs.x` / `Outputs.y` somewhere in the document. */
  readonly mined: boolean;
  /**
   * How the port is written: `Outputs.Done()` versus `Outputs.x = `. Derived
   * from {@link UnionPort.type}, so a declared type overrides how the body reads
   * — see the module note on collisions. Always `'value'` for an input.
   */
  readonly kind: PortKind;
}

/** Both directions, each in the order the runtime assembles them. */
export interface UnionPorts {
  readonly inputs: UnionPort[];
  readonly outputs: UnionPort[];
}

/** `javascriptnodeparser.js:335` / `:376` — a mined port with no declared type. */
const MINED_TYPE = '*';
/** `javascriptnodeparser.js:355` / `:365` — the only two patterns that type a port. */
const SIGNAL_TYPE = 'signal';

function kindOf(type: string): PortKind {
  return type === SIGNAL_TYPE ? 'signal' : 'value';
}

/**
 * Merge one direction: declared rows first, then the mined names none of them
 * claimed.
 *
 * The order matches `_updatePorts`, which is also the order the property panel
 * shows — a rail or a bar that lists these reads in the same order as the ports
 * beside it.
 */
function mergeDirection(
  declared: readonly PortFact[],
  minedNames: readonly string[],
  minedType: (name: string) => string
): UnionPort[] {
  const rows: UnionPort[] = [];
  const byName = new Map<string, number>();

  for (const fact of declared) {
    // `collectDeclaredPorts` already dropped blanks and repeats, so a second row
    // for a name here would mean that contract broke; skip rather than shadow.
    if (byName.has(fact.name)) continue;

    byName.set(fact.name, rows.length);
    rows.push({
      name: fact.name,
      type: fact.type,
      declared: true,
      // Filled in below — a declared port is very often also written in the body,
      // and "declared but never read" is the whole point of tracking it.
      mined: false,
      kind: kindOf(fact.type)
    });
  }

  for (const name of minedNames) {
    const existing = byName.get(name);

    if (existing !== undefined) {
      // The declared row keeps its type. Only the flag changes.
      rows[existing] = { ...rows[existing], mined: true };
      continue;
    }

    const type = minedType(name);
    byName.set(name, rows.length);
    rows.push({ name, type, declared: false, mined: true, kind: kindOf(type) });
  }

  return rows;
}

/**
 * The union of a node's declared ports and the ports its code mines.
 *
 * `node` is the `openNode` slot from the authoring context — `null`/`undefined`
 * when no node is open, which is not the same as a node with no declared ports
 * and is why the parameter is nullable rather than defaulted.
 */
export function unionPorts(node: OpenNodeFact | null | undefined, code: string): UnionPorts {
  const mined = minePorts(code);

  return {
    inputs: mergeDirection(node ? node.declaredInputs : [], mined.inputs, () => MINED_TYPE),
    outputs: mergeDirection(node ? node.declaredOutputs : [], mined.outputs, (name) =>
      mined.signals.has(name) ? SIGNAL_TYPE : MINED_TYPE
    )
  };
}
