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
 *
 * ## FIX-016 §3 — `Run` is the Function's only trigger, by ruling
 *
 * Signal inputs beyond `Run` were costed for the Function node and **ruled
 * out**: the Script node is the one you reach for when you want several
 * triggers. So the two rules below state opposite things about triggering on
 * purpose, and the difference is measurable rather than stylistic:
 *
 *  - `simplejavascript.ts:609-619` compiles a Function body as
 *    `AsyncFunction('Inputs', 'Outputs', 'Noodl', 'Component', …)`. `Node` is
 *    not a parameter, so `Node.Signals.X = …` written in a Function mints no
 *    port at all — in a browser it assigns to the DOM `Node` constructor and
 *    reports nothing. Its one signal input is the built-in `Run`
 *    (`simplejavascript.ts:251-265`).
 *  - `javascriptnodeparser.js:203-211` turns each `Node.Signals` handler into a
 *    signal input, unlimited — but that path is reached only by `Javascript2`,
 *    the Script node, which in exchange has **no** built-in `Run` port.
 *
 * ⚠️ Neither node has both, which is why a sentence about "the built-in Run"
 * and a sentence about `Node.Signals` must never end up describing the same
 * node.
 */
export const NOTATION_RULES: Record<NotationMode, string> = {
  function:
    'Read an input with Inputs.Name, write an output with Outputs.Name = value, ' +
    'and fire a signal with Outputs.Name(). Mentioning a name in the code is what creates the port. ' +
    'It runs when you signal Run — the only signal input this node has, and one it cannot be given ' +
    'a second of.',
  script:
    'Declare ports with define({ inputs: { … }, outputs: { … } }); your handlers receive ' +
    '(inputs, outputs). A name that is not declared never becomes a port. Each function declared ' +
    'under signals becomes a signal input, which is how a node takes more than one trigger.',
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

/* ------------------------------------------------------------------ *
 * FUN-004 (messages 1-4) and FIX-016 §2 (message 5) — the sentences a
 * port diagnostic says
 * ------------------------------------------------------------------ */

/**
 * The four messages, in one place, because three of them put `Inputs.`/`Outputs.`
 * in front of a beginner and this module is where that notation is written down.
 *
 * ⚠️ **Message 1 is duplicated in the runtime and the two must agree.** FUN-007's
 * F32 records why it cannot be shared: `noodl-core-ui` has no dependency on
 * `@noodl/runtime`, and a runtime node cannot import a React package. The twin is
 * `functionDiagnostics.ts#undeclaredPortNameMessage`, reached when the *run*
 * throws a `ReferenceError` rather than when the linter sees the name. Static and
 * runtime paths converge on one sentence (FUN-007 §3), and keeping them
 * converged is a review obligation until someone adds a shared package.
 * `notation.test.ts` pins the wording on this side; the runtime's own spec pins
 * the other.
 */

/**
 * **Message 1** — an undefined identifier that *is* a declared or mined input.
 * The originating user's exact case.
 */
export function undefinedNameIsInputMessage(name: string): string {
  return `${name} is an input port on this node. Read it with ${readExpression(name)}.`;
}

/**
 * **Message 2** — a local declared, or an implicit global assigned, under an
 * output's name. The half that lints clean today.
 *
 * ⚠️ Says *"the port stays empty"* rather than *"this is wrong"*: `var Output_1 = 1`
 * is valid JavaScript doing exactly what it says. What makes it a defect is a
 * NodeGX fact the language cannot see.
 */
export function localShadowsOutputMessage(name: string, kind: PortKind): string {
  return (
    `${name} is an output port. This writes a local variable instead, so the port stays empty. ` +
    `Write ${writeExpression(name, kind).trimEnd()}${kind === 'signal' ? '' : ' …'}.`
  );
}

/**
 * **Message 3** — an undefined identifier that is not any port. The offer that
 * teaches the inversion: the port appears *because* you mentioned it.
 */
export function undefinedNameIsNoPortMessage(name: string): string {
  return `No port named ${name}. Create an input port by reading it: ${readExpression(name)}.`;
}

/**
 * **Message 4** — a declared port the code never mentions.
 *
 * ⚠️ Information, not a warning, and reported once at the top of the document.
 * A declared-but-unread port is a completely legitimate state mid-edit; a squiggle
 * for it would be noise on every port between creating it and using it. This is
 * the sentence the originating user would have seen *before* typing anything
 * wrong, and it is only expressible because the declared and mined lists are kept
 * apart (`authoringContext.ts:69-77`).
 */
export function declaredButUnreadMessage(names: readonly string[]): string {
  if (names.length === 0) return '';

  if (names.length === 1) {
    return `${names[0]} is declared on this node but never read. Insert ${readExpression(names[0])}.`;
  }

  const listed = names.join(', ');
  return `${listed} are declared on this node but never read. Insert ${readExpression(names[0])} to use the first.`;
}

/**
 * `'*'` — the type an output declared in the panel carries until somebody opens
 * its **Type** row (`simplejavascript.ts:816`, `declaredPorts.ts:73`).
 *
 * ⚠️ **Not `'string'`, and the difference is the whole reason this is a
 * constant.** The `outtype-<label>` proplist port declares `default: 'string'`
 * (`:806`), which is what the enum *widget* shows — but the parameter itself
 * stays absent until it is changed, and both the runtime's port registration and
 * the editor's port list fall back to `'*'`. So the commonest instance of the
 * defect below is a port with no type at all, and a message hard-coding "String"
 * would name a type the author never chose.
 */
const UNTYPED_OUTPUT = '*';

/**
 * How to name an output's declared type in a sentence.
 *
 * ⚠️ The seven labels the panel shows are exactly `value` with its first letter
 * capitalised (`simplejavascript.ts:742-771`), so this **derives** the label
 * rather than copying the table — a copy in this package could not be shared
 * with the runtime (F32: `noodl-core-ui` has no dependency on `@noodl/runtime`)
 * and would drift silently. A future enum entry whose label is not simply
 * capitalised would read slightly differently here, but never wrongly: the word
 * is always the author's own stored type value.
 *
 * ## ⚠️ `'*'` is called **String**, and that is deliberate — measured, not assumed
 *
 * An untouched output stores no `outtype-` at all, so {@link UNTYPED_OUTPUT} is
 * its effective type. The obvious sentence for it — *"a value output with no Type
 * set"* — was written first and **driven, and the drive killed it**: the property
 * panel renders the `outtype-` enum's `default: 'string'`, so the author is
 * looking at a dropdown that reads **String** while being told nothing is set.
 * Measured 2026-08-15 in the running editor: an output with no stored `outtype-`
 * displays `String`, identically to one explicitly set to it.
 *
 * The message's job is to be checkable against what is on screen (FUN-006's
 * discipline: name *their* ports, in *their* words). A sentence contradicting the
 * visible dropdown reads as being about some other port, which is worse than
 * slightly over-claiming what is stored — and the stored/absent distinction is
 * invisible to the author and changes nothing about the defect either way.
 */
function outputTypeDescription(type: string): string {
  const displayed = !type || type === UNTYPED_OUTPUT ? 'string' : type;

  return `a ${displayed.charAt(0).toUpperCase()}${displayed.slice(1)} output`;
}

/**
 * **Message 5** (FIX-016 §2) — an output declared in the panel as a value, and
 * called in the body as though it were a signal.
 *
 * The trap `unionPorts.ts:24-37` names, said out loud at the call site. The
 * declared row wins over the mined one, so `Outputs.Done()` against a panel row
 * that is not `Signal` does not fire anything: only ports whose assembled type
 * is literally `'signal'` are given a callable
 * (`simplejavascript.ts:400-415`, reached via `node.outputPorts` at `:863-867`),
 * so the name holds `undefined` and the call throws.
 *
 * ⚠️ **Two routes, and they are different programs — which is why this message
 * names both and ships no fix-it.** Setting Type to Signal keeps the author's
 * trigger; rewriting the call as an assignment keeps the port and abandons the
 * trigger. Every other message here corrects a *spelling* of one intent, and a
 * one-click choice between two intents is not the same offer.
 *
 * ⚠️ Says *"throws when the node runs"* rather than "is wrong": the failure is
 * not visible until Run, which is exactly why the author has not noticed it.
 */
export function outputCalledButNotSignalMessage(name: string, declaredType: string): string {
  return (
    `${name} is ${outputTypeDescription(declaredType)}, not a Signal, so calling it throws when the node runs. ` +
    `Set its Type to Signal in the property panel, or write ${writeExpression(name, 'value').trimEnd()} … instead.`
  );
}

/**
 * **Message 6** (FIX-016 ruling 1) — the Function node's API written in a Script
 * node.
 *
 * ## The two nodes compile with different parameters, and only one of them has `Inputs`
 *
 * | node | compiled as |
 * |---|---|
 * | Function (`JavaScriptFunction`) | `AsyncFunction('Inputs', 'Outputs', 'Noodl', 'Component', prefix + script)` — `simplejavascript.ts:609-619` |
 * | Script (`Javascript2`) | `Function('define', 'script', 'Node', 'Component', prefix + code)` — `javascriptnodeparser.js:22` |
 *
 * So `Outputs.Done()` in a Script node is not a port that fails to appear — it
 * is a `ReferenceError`, and the surrounding `try` turns it into a parse warning
 * on the node rather than anything the author sees while typing.
 *
 * ⚠️ **Richard's ruling is that the strictness stays** (*"a Script node has
 * always been strict AF, keep it that way … and the node should teach"*). So this
 * says what is in scope instead, and the parser is not loosened to accept the
 * other node's notation.
 *
 * ⚠️ **No fix-it, for message 5's reason and one more.** The repair is not a
 * spelling change: `Outputs.Done()` becomes an `outputs.Done` write inside a
 * handler that has to exist first, which is a different program. Offering to
 * write half of it would leave a body that still throws.
 */
export function functionApiInScriptNodeMessage(name: string): string {
  return (
    `${name} is the Function node's API and is not in scope here, so this line throws when it runs. ` +
    `A Script node declares its ports: define({ inputs: { … }, outputs: { … }, ` +
    `run: function (inputs, outputs) { … } }).`
  );
}

/* ------------------------------------------------------------------ *
 * FUN-006 — what the bar says, if it says anything
 * ------------------------------------------------------------------ */

/**
 * **Row 1** — nothing declared, nothing written. The node is blank.
 *
 * ⚠️ Names the mechanism rather than pointing at documentation: the fact worth
 * knowing is that *mentioning a name is what creates the port*, and that is one
 * sentence, not a link.
 */
export function barNoPortsMessage(): string {
  return 'This node has no ports yet. Type Inputs. — the name you use becomes an input port.';
}

/**
 * **Row 2** — ports exist and the code mentions none of them.
 *
 * The sentence that would have saved the originating session, and the reason the
 * bar is built in its stateful form at all: it names **their** ports. A version
 * of this that said "use Inputs.name" would be the version that gets dismissed
 * on day one and never helps anyone twice.
 */
export function barUnusedPortsMessage(inputs: readonly string[], outputs: readonly { name: string; kind: PortKind }[]): string {
  const parts: string[] = [];

  if (inputs.length > 0) {
    parts.push(`Read ${inputs[0]} with ${readExpression(inputs[0])}`);
  }

  if (outputs.length > 0) {
    const output = outputs[0];
    const written = output.kind === 'signal' ? writeExpression(output.name, 'signal') : `${writeExpression(output.name, 'value')}…`;
    parts.push(`write ${output.name} with ${written}`);
  }

  if (parts.length === 0) return '';

  // Sentence case: the second clause is a continuation, not a new sentence.
  return `${parts.join(', ')}.`;
}

/**
 * **Row 3** — inputs are being read and nothing is being written.
 *
 * ⚠️ States the consequence, not the rule. "This node produces nothing when it
 * runs" is checkable against what the author is about to see happen; "you should
 * write an output" is advice, and advice is what gets skimmed.
 */
export function barNoOutputMessage(): string {
  return 'Nothing is written to an output, so this node produces nothing when it runs.';
}
