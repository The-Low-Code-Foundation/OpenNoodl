/**
 * The one place the Function/Script/Expression notation is written down.
 *
 * FUN-001. Four surfaces in phase 61 put a sentence in front of a beginner at
 * the worst possible moment — the seeded body (FUN-002), the fix-it message
 * (FUN-004), the ports rail (FUN-005) and the help bar (FUN-006). **If those
 * four disagree about the notation, the phase makes things worse than blank.**
 * So the strings and the two expression builders live here, and every surface
 * imports them rather than writing its own.
 *
 * ## The decision (FUN-001 §2)
 *
 * **`Inputs.` / `Outputs.` is the notation. `Noodl.Inputs` is a legacy alias we
 * support forever and never write.** Taken 2026-08-12 on the spec's own
 * recommendation, and recorded in the task file rather than only here.
 *
 * ✅ **Signed by Richard, 2026-08-12.** It stood unsigned through two sessions
 * while four surfaces were built on it; it is settled now and does not need
 * re-litigating.
 *
 * The runtime injects `Inputs` and `Outputs` as direct parameters —
 * `new AsyncFunction('Inputs', 'Outputs', 'Noodl', 'Component', script)`
 * (`noodl-runtime/src/nodes/std-library/simplejavascript.ts:447`) — and assigns
 * `Noodl.Inputs` / `Noodl.Outputs` afterwards at `:356-360`, under a comment
 * that calls them legacy in as many words. `minePorts` and the ESLint globals
 * already assume the short form. Nothing in this module emits the alias, and
 * nothing downstream may flag a user's existing `Noodl.Inputs` code as wrong —
 * it works, and it is theirs.
 *
 * ## Why these are functions and not template strings
 *
 * A port's display name comes from a proplist a human typed into, so `My Value`
 * is reachable and `Inputs.My Value` is a syntax error. Worse, three of the
 * runtime's six mining patterns disagree about which characters are legal, and
 * the disagreements are silent: a name is either mined as the port you meant,
 * mined as a *different* port, or not mined at all. Measured against
 * `JavascriptNodeParser.parseAndAddPortsFromScript` on 2026-08-12:
 *
 * | Written | Mined as |
 * |---|---|
 * | `Outputs.Done()` | `Done`, type **signal** |
 * | `Outputs.Done_1()` | `Done_1`, type **`*`** — a value port, silently the wrong kind |
 * | `Outputs["Done_1"]()` | `Done_1`, type **signal** |
 *
 * The signal-by-dot pattern is `/Outputs\.([A-Za-z0-9]+)\s*\(\s*\)/` — **no
 * underscore in the class** — so an underscored signal name falls through to
 * the regular-output pattern and becomes a value. {@link writeExpression} is
 * where that asymmetry is handled once. Concatenate a dot at a call site and
 * you reintroduce it.
 *
 * @module code-editor/utils
 */

/**
 * The modes this module has a rule for.
 *
 * A deliberate subset of {@link ValidationType}: `json`, `text`, `css` and
 * `html` reach the same editor from the property panel and have nothing to do
 * with ports.
 */
export type NotationMode = 'function' | 'script' | 'expression';

/**
 * One line per mode, in the second person, naming the mechanism rather than
 * describing it.
 *
 * ⚠️ The three modes have **three different rules**, and the differences are
 * the reason a reasonable beginner guesses wrong. Expression has no `Inputs.`
 * at all — a bare identifier there *becomes* an input port
 * (`expression.ts:399`) — so a hint that leaked `Inputs.foo` into expression
 * mode would create a port named `Inputs`. Every consumer gates on the mode.
 *
 * The expression line therefore does not name either prefix, not even to deny
 * it: the one string a surface is most likely to offer as an insertion is the
 * one string that must not be insertable here. Explaining the contrast *to*
 * someone arriving from a Function node is FUN-009's copy — see
 * {@link expressionPortNote}, which does it by naming their actual ports rather
 * than by writing the other notation on screen.
 *
 * ⚠️ **These are not the only sentences the product has about these nodes.**
 * Phase 59's `NodePicker.chooser.ts` describes Expression, Visual Function and
 * Function to somebody who has not picked one yet. FUN-009 §4 planned for the
 * two to share one string; they should not, and that file's header says why —
 * a comparative card and an in-editor rule are different documents. **They must
 * still agree**, and the fact they share is the Expression rule below. Edit one,
 * read the other.
 */
export const NOTATION_RULES: Record<NotationMode, string> = {
  function:
    'Read an input with Inputs.Name, write an output with Outputs.Name = value, ' +
    'and fire a signal with Outputs.Name(). Mentioning a name in the code is what creates the port.',
  script:
    'Declare ports with define({ inputs: { … }, outputs: { … } }); your handlers receive ' +
    '(inputs, outputs). A name that is not declared never becomes a port.',
  expression:
    'Every name in the expression becomes an input port — write price * quantity and the node ' +
    'grows price and quantity. The value of the expression is the result; there is nothing to assign.'
};

/**
 * What the Expression editor says about the text that is in it right now
 * (FUN-009 §1).
 *
 * ## Why this is a function of the current names and not a constant
 *
 * The Expression node's rule is the **inverse** of the Function node's, and the
 * confusion FUN-009 exists to end is not ignorance — it is correct transfer from
 * the sibling node. Somebody who met a Function five minutes ago writes
 * `var Output_1 = Input_1` in an Expression because that is what worked. A
 * constant line stating the rule is the version that gets skimmed; naming the
 * ports *this* expression has grown is the version that is checkable against
 * what is on screen, and it is the same discipline FUN-006 §1 imposes on the
 * Function bar.
 *
 * ⚠️ **The deletion half is the one that matters, and it is the half nobody
 * expects.** Removing a name from the text removes the port — `inputsToRemove`
 * in the `expression` setter — and with it whatever was wired to that port. A
 * text edit that silently disconnects a wire is not a thing text editors do, so
 * the sentence is only shown in the state where it is about to happen: when the
 * expression currently references at least one name, i.e. when there is a port
 * with something to lose.
 *
 * ⚠️ **Nothing here may name `Inputs.` or `Outputs.`, not even to deny them.**
 * The one string a help surface is most likely to make insertable is the one
 * string that must not be inserted here: `Inputs.foo` in an expression mints a
 * port called `Inputs`. See {@link NOTATION_RULES}. That constraint is also why
 * this is not written as "unlike a Function node, …" — a contrast sentence puts
 * the wrong notation on screen in the editor where it is destructive.
 *
 * The caller owns rendering; this owns the words. `names` is the identifiers the
 * expression currently references, in document order — the runtime's own
 * `parsePorts` result, which is what actually became ports.
 */
export interface ExpressionPortNote {
  /** Always shown. The rule, in the second person. */
  rule: string;
  /** The current names as ports, or `undefined` when the expression has none. */
  current?: string;
  /** The deletion warning, or `undefined` when there is no port to lose. */
  onDelete?: string;
}

export function expressionPortNote(names: readonly string[]): ExpressionPortNote {
  const rule = 'Every name you use here becomes an input port on this node.';

  if (names.length === 0) {
    return { rule };
  }

  const count = names.length === 1 ? '1 input port' : `${names.length} input ports`;

  return {
    rule,
    current: `${names.join(', ')} → ${count}.`,
    onDelete: 'Delete a name and its port goes too, along with anything wired to it.'
  };
}

/**
 * What a port carries, in the only two shapes the runtime types differently.
 *
 * A value output is an assignment and a signal output is a call
 * (`javascriptnodeparser.js:353-366`). There is no third option, and getting it
 * wrong does not fail — it creates the other kind of port.
 */
export type PortKind = 'value' | 'signal';

/** The `in-` / `out-` prefixes internal port names carry. */
const PORT_NAME_PREFIX = /^(?:in|out)-/;

/**
 * Turn an **assembled** port name into the display name the code refers to.
 *
 * ⚠️ Internal names are prefixed (`simplejavascript.ts:711-714`) and the
 * prefixed form is *valid JavaScript*: insert `Inputs.in-Value` and it parses
 * as `Inputs.in - Value`, mints a port called `in`, and reports nothing.
 *
 * ⚠️ **Call this only when you know you are holding an assembled name, and
 * never inside the builders.** FUN-001 §1 said to strip once, here, and FUN-003
 * measured why that would have been a defect: the prefix is applied when the
 * port list is *assembled* (`'in-' + p.label`), so a proplist row's `label` —
 * which is what FUN-003's declared-port facts carry — is already the display
 * name. An author may legitimately label a row `in-Value`, which becomes the
 * port `in-in-Value` displayed as `in-Value`; blanket-stripping that writes
 * `Inputs.Value`, a port which does not exist. The Script node (`Javascript2`)
 * applies no prefix at all.
 *
 * So the two kinds of name stay distinct at the call site: consumers holding
 * **display** names (FUN-004's diagnostic, from the declared-port facts) pass
 * them straight to the builders, and consumers holding **assembled** names
 * (FUN-005's rail, which reads the node's real ports) call this first.
 */
export function stripPortPrefix(portName: string): string {
  return portName.replace(PORT_NAME_PREFIX, '');
}

/**
 * `/Inputs\.([A-Za-z0-9_]+)/` and `/Outputs\.([A-Za-z0-9_]+)/` — the character
 * class shared by the two dot-notation value patterns.
 */
const MINEABLE_BY_DOT = /^[A-Za-z0-9_]+$/;

/**
 * `/Outputs\.([A-Za-z0-9]+)\s*\(\s*\)/` — the signal pattern, which does **not**
 * accept `_`. Narrower than {@link MINEABLE_BY_DOT} on purpose; see the module
 * comment for what the difference costs.
 */
const MINEABLE_BY_DOT_AS_SIGNAL = /^[A-Za-z0-9]+$/;

/**
 * Whether this display name can be expressed at all.
 *
 * The regular-output bracket pattern is `/Outputs\s*\[\s*"([^"]*)"\s*\]/` —
 * double quotes only, and no escape. A display name containing a `"` therefore
 * has **no** form that mines back to itself, and a caller that inserts one
 * anyway writes code that either fails to parse or mints a different port. Ask
 * before inserting; the honest answer for such a name is to rename the port.
 */
export function canExpressPort(displayName: string): boolean {
  return displayName.length > 0 && !displayName.includes('"');
}

/** `Foo` → `"Foo"`, for the bracket forms. Callers gate on {@link canExpressPort}. */
function quoted(name: string): string {
  return `["${name}"]`;
}

/**
 * The expression that **reads** a port: `Inputs.Foo`, or `Inputs["My Value"]`
 * when the name is not something the dot pattern would mine.
 *
 * ⚠️ Two bracket reads on one line do not round-trip. The runtime's bracket
 * pattern captures with a greedy `(.*)`, so
 * `Inputs["My Value"] + Inputs["Other"]` mines a single port literally named
 * `My Value"] + Inputs["Other` — measured 2026-08-12, and the same defect is
 * faithfully reproduced by `minePorts`. Anything that inserts at a cursor
 * (FUN-005's rail) must keep two bracket-form insertions off one line. Names
 * that take the dot form are unaffected.
 */
export function readExpression(displayName: string): string {
  return MINEABLE_BY_DOT.test(displayName) ? `Inputs.${displayName}` : `Inputs${quoted(displayName)}`;
}

/**
 * The expression that **writes** a port: `Outputs.Foo = ` for a value,
 * `Outputs.Foo()` for a signal.
 *
 * The returned value-form ends in `= ` — with the trailing space — because
 * every caller is placing a cursor after it.
 *
 * ⚠️ A signal name containing `_` is forced into bracket form. `Outputs.Done_1()`
 * mines as a **value** port; `Outputs["Done_1"]()` mines as a signal. This is
 * the one case where the shorter form is not merely uglier but wrong.
 */
export function writeExpression(displayName: string, kind: PortKind): string {
  const name = displayName;

  if (kind === 'signal') {
    return MINEABLE_BY_DOT_AS_SIGNAL.test(name) ? `Outputs.${name}()` : `Outputs${quoted(name)}()`;
  }

  return MINEABLE_BY_DOT.test(name) ? `Outputs.${name} = ` : `Outputs${quoted(name)} = `;
}

/**
 * The body a newly created Function node arrives with (FUN-002).
 *
 * Three things at once: something to imitate, a node that **works** before
 * anything is typed, and — because `parseAndAddPortsFromScript` mines this text
 * — two visible ports on the node, which demonstrates rather than explains that
 * the code is where ports come from.
 *
 * ⚠️ **The comment is mined too.** The runtime's comment-stripping line is
 * commented out (`javascriptnodeparser.js`, above the first pattern), so every
 * `Inputs.x` in a comment mints a port. FUN-002 specced this body with a
 * comment reading *"Read an input with Inputs.Name, write an output with
 * Outputs.Name"*, and measured on 2026-08-12 that seed arrives with **four**
 * ports — `Value` and `Result`, plus an input `Name` and an output `Name` that
 * come from the sentence explaining it, do nothing, and cannot be explained to
 * a beginner. The phase's exit test says *"with two ports on the node to prove
 * it"*, so the comment states the rule without spelling either prefix followed
 * by a name. Verified: this body mines exactly `input:Value`, `output:Result`.
 *
 * ⚠️ Seeded as a real parameter write at node-creation time, never as a port
 * `default` — a declared default never runs its setter, and the node would look
 * complete while doing nothing on Run.
 */
export const SEED_FUNCTION_BODY = [
  '// The ports come from this code: rename Value or Result and the node follows.',
  'Outputs.Result = Inputs.Value;',
  ''
].join('\n');
