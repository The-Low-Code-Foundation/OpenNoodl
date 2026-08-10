# FUN-004 — The diagnostic that names the port

**Status:** 📋 open · ⭐ **the flagship** · **Track: the mistake itself** · depends on FUN-003
(declared ports) and FUN-001 (the strings)

## This is the observed bug, exactly

The user typed:

```js
var Output_1 = Input_1
```

and the correct code is:

```js
Outputs.Output_1 = Inputs.Input_1
```

**They were already being told something was wrong.** `no-undef` runs as a warning in `function` and
`script` modes ([`esLintDiagnostics.ts:141`](../../../packages/noodl-core-ui/src/components/code-editor/utils/esLintDiagnostics.ts)),
against the globals read off the runtime — `Inputs`, `Outputs`, `Noodl`, `Component`, `Script`,
`Node` ([`:69-76`](../../../packages/noodl-core-ui/src/components/code-editor/utils/esLintDiagnostics.ts)).
So `Input_1` carries *"'Input_1' is not defined"* today.

**That message is true, generic, and useless.** It describes a JavaScript fact. The user's problem is
a NodeGX fact: `Input_1` is a **port they created ninety seconds ago in the panel next door**.

⚠️ **The half of the line the linter cannot see at all is worse.** `var Output_1 = …` is perfectly
valid JavaScript that declares a local. No rule fires. The output port is never written, the node
runs "successfully", and nothing anywhere says otherwise — see FUN-007 for the runtime half of that.

**So this task adds no detection. It adds knowledge and a fix.**

## §1 — The four messages

All four need the union of declared (FUN-003) and mined (`minePorts`) ports, and all four build their
replacement text with FUN-001's `readExpression` / `writeExpression`.

**1. An undefined identifier that is a declared input** — the user's exact case.

> **`Input_1` is an input port on this node.** Read it with `Inputs.Input_1`.
> — *fix: replace `Input_1` with `Inputs.Input_1`*

**2. An assignment to a local whose name is a declared output** — the half that lints clean today.

> **`Output_1` is an output port. This writes a local variable instead, so the port stays empty.**
> Write `Outputs.Output_1 = …`.
> — *fix: rewrite the declaration as an assignment to the port*

⚠️ This one is **not** a `no-undef` extension; it is a new rule over the syntax tree, looking for
`VariableDeclarator` and bare `AssignmentExpression` whose target name matches a declared output. Get
the scope right: a genuine local called `Output_1` inside a helper function is legal and this must be
a **warning**, never an error, exactly as `no-undef` is — the file's own reasoning about honest
severity applies.

**3. An undefined identifier that is not any port** — the offer that closes the loop backwards.

> **No port named `total`.** Create an input port by reading it: `Inputs.total`.
> — *fix: replace `total` with `Inputs.total`*

This is the one that teaches the inversion. The port genuinely appears the moment the text changes,
because mentioning it is what creating it means
([`javascriptnodeparser.js:294-387`](../../../packages/noodl-runtime/src/javascriptnodeparser.js)).
⚠️ Offer it only for identifiers that look like a port and not like a typo of something in scope —
a fix-it that turns a misspelled local into a phantom input port is a worse outcome than the warning.

**4. A declared port never mentioned in the code** — the reverse blind spot.

> **`Input_1` is declared on this node but never read.** Insert `Inputs.Input_1`.

Reported once, at the top of the document, as **information, not a warning**. It is a completely
legitimate state mid-edit, and a squiggle for it would be noise. This is the message the originating
user would have seen *before* typing anything wrong, and it is only expressible because FUN-003 keeps
the declared and mined lists separate.

## §2 — Fix-its, not just prose

CodeMirror's lint `Diagnostic` carries `actions` — a label and a function that applies a change.
Every message above ships one. A beginner who does not know the notation cannot be expected to type
the correction from a description; **the click is the teaching**, because it shows the shape in their
own code with their own names.

The existing pipeline already builds `Diagnostic`s with rule ids attached
([`esLintDiagnostics.ts:251-254`](../../../packages/noodl-core-ui/src/components/code-editor/utils/esLintDiagnostics.ts)),
so this is a post-processing pass over the messages that pipeline already produces, plus one new
syntax-tree rule for message 2.

## §3 — ⚠️ Not in expression mode

`no-undef` is off for expressions on purpose: every undeclared identifier in an Expression **becomes
an input port**, so the rule would underline every input the author just created
([`esLintDiagnostics.ts:26-32`](../../../packages/noodl-core-ui/src/components/code-editor/utils/esLintDiagnostics.ts),
[`expression.ts:399`](../../../packages/noodl-runtime/src/nodes/std-library/expression.ts)).

**None of the four messages may leak into `'expression'`.** Suggesting `Inputs.total` inside an
Expression node would be actively destructive: it mints a port literally named `Inputs` plus a
property access that is not what the author meant. Gate on `validationType`, per FUN-003 §4, and
prove it with a test that lints the same text in both modes and asserts the difference.

## §4 — Legacy code the user did not write

A saved project may contain `Noodl.Inputs.foo` — supported forever
([`simplejavascript.ts:359-360`](../../../packages/noodl-runtime/src/nodes/std-library/simplejavascript.ts)).

- It must **never** be flagged. It works.
- ⚠️ It is **not mined as a port**: the regexes match `Inputs\.` and would match the `Inputs.foo`
  inside `Noodl.Inputs.foo` — verify which, because the answer decides whether legacy code shows a
  false "declared but never read" on message 4. **Test it; do not reason about it.** The six patterns
  are copied verbatim in [`scriptPorts.ts`](../../../packages/noodl-core-ui/src/components/code-editor/utils/scriptPorts.ts)
  and the answer is a two-line unit test.
- An **optional** offer to modernise it is out of scope. Rewriting code a user did not ask about is
  not what a lint panel is for.

## Acceptance

- Typing `var Output_1 = Input_1` into a Function node with ports `Input_1` and `Output_1` declared in
  the panel produces **two** actionable messages, and applying both yields
  `Outputs.Output_1 = Inputs.Input_1`, which runs.
- ⚠️ **Verify the consequence, not the mechanism:** after applying the fixes, wire the node and
  confirm a value actually arrives at the output. A green lint panel is not the outcome; a working
  node is.
- An identifier matching no port offers "create it by reading it", and after applying, **the port
  appears on the node**.
- A declared, unused port is reported as information exactly once, never as a squiggle.
- The same text in `'expression'` mode produces **none** of the four.
- `Noodl.Inputs.foo` is never flagged, and its effect on message 4 is covered by a test either way.
- A local variable inside a nested function that happens to share an output's name is a warning at
  most, and is never auto-rewritten without a click.

## Register

| # | Finding | State |
|---|---|---|
| F12 | The user **was already warned** — `no-undef` fires in function mode. The gap is actionability, not detection | ✅ verified, `esLintDiagnostics.ts:141` |
| F13 | `var Output_1 = …` is valid JavaScript and lints **clean**; the silent half needs a new syntax-tree rule | ✅ verified by inspection of the enabled rule set |
| F14 | `no-undef` is off in expression mode for a real reason, and every message here would be destructive there | ✅ verified, `esLintDiagnostics.ts:26-32` |
| F15 | Whether `Noodl.Inputs.foo` is mined as port `foo` by the shared regexes | ⚠️ **unverified — test before implementing message 4** |
