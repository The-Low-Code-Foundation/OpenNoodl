# FUN-004 — The diagnostic that names the port

**Status:** 📋 open · ⭐ **the flagship** · **Track: the mistake itself** · depends on FUN-003
(declared ports) and FUN-001 (the strings)

⚠️ **Start with FUN-007 §2, not with this file.** FUN-007 shipped its mapped `line`, `column` and
`hint` onto the warning payload and the raised error's `detail`, but **nothing renders them** — that
half needs `CodeEditorType.ts`, which is this task's own territory. Same file, same knowledge, and it
makes the lane's first commit a small one.

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
valid JavaScript that declares a local. No rule fires, and the output port is never written.

🔴 **But do not describe that line as running silently — it does not.** Per **premise correction 3**
in the [README](README.md#-premise-correction-3--the-observed-code-does-not-run-silently-it-throws),
measured twice by compiling the body the runtime compiles:

```
var Output_1 = Input_1;      → ReferenceError: Input_1 is not defined   (Failure fires, Error carries it)
Output_1 = Inputs.Input_1;   → runs clean, writes nothing, Success fires
```

The runtime injects only `Inputs`, `Outputs`, `Noodl` and `Component` — never the port names — so
reading a bare `Input_1` throws. **The observed body has always thrown.** The silence is real but it
belongs to the *next* thing the user types: drop the `var` once you see the ReferenceError, and
`Output_1 = …` lands on an implicit global. Nothing throws, `Success` fires, no port moves. That is
FUN-007 §1's subject.

**What this does not change:** the user was warned twice — by a linter that did not know `Input_1`
was a port, and by a runtime failure delivered to `Error` and `Failure` ports that nothing on the
canvas draws attention to. Neither report names the port. That gap is this task, undiminished.

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

✅ **The blocker is CLEARED — fixed by FUN-009 (`ace5232f`) and driven 2026-08-12 evening.**
`validationTypeForEditType` now reads the port's declared `type.codenotation`, and the drive measured
three different popouts rendering **EXPRESSION / FUNCTION / SCRIPT**, `no-undef` off in expression
mode and on in the other two, and `Inputs.` completing to `[]` in an Expression but `["Value"]` in a
Function. **Gating on `validationType` is now safe and this task is unblocked.**

<details><summary>The blocker as it stood, for the record</summary>

🔴 **BLOCKER, measured 2026-08-12 — the gate does not currently work. Fix it first or this task ships
the destruction it is trying to prevent.** `validationTypeForEditType` can never return `'expression'`:
it tests `type?.name`, which is `'string'` for every JS code port, where its own comment says the
**port** name is the signal. Function, Script and Expression ports all open as `'function'`. Measured
live — see **FUN-003 F17**, which carries the table and the reproduction.

The consequence is already shipped and visible without any of FUN-004's code: typing `total * 2` into
an Expression node warns `'total' is not defined. eslint:no-undef`, and then mints the port `total`
anyway. Note the fix is **not** a swap to `this.name` — the Function node's port is `functionScript`
and the Script node's is `code`, so the port names invert those two. It needs deciding, with FUN-009.

</details>

⚠️ **Still test both modes anyway.** The gate works, but §3's acceptance is that the same text
produces none of the four messages in `'expression'` — that is about *this task's* code, not
FUN-009's, and it is now genuinely reachable for the first time.

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

🔴 **How to drive that first criterion — it is two rows, not one.** Premise correction 3 splits the
observed body into two distinct runtime failures, and they must be driven separately:

| Body | Runtime | What the drive proves |
|---|---|---|
| `var Output_1 = Input_1` | **throws** — `ReferenceError`, `Failure` fires, `Error` carries the message | Message 1 (undefined identifier is an input port) and message 2 (assignment to a local named for an output) both fire, and the failure is loud in a place nobody looks |
| `Output_1 = Inputs.Input_1` | **silent** — implicit global, `Success` fires, no port moves | Message 2 alone fires; this is the row FUN-007 §1 also catches |

⚠️ **Use a fresh project for each row.** Implicit globals are shared between Function nodes in a
project, so the first node to write a bare `Output_1` permanently disarms the `ReferenceError` for
every node that later reads one — the second run of the same test lies.
- An identifier matching no port offers "create it by reading it", and after applying, **the port
  appears on the node**.
- A declared, unused port is reported as information exactly once, never as a squiggle.
- The same text in `'expression'` mode produces **none** of the four.
- `Noodl.Inputs.foo` is never flagged, and its effect on message 4 is covered by a test either way.
- A local variable inside a nested function that happens to share an output's name is a warning at
  most, and is never auto-rewritten without a click.

## What was built, 2026-08-12 (late)

| File | What |
|---|---|
| `noodl-core-ui/.../utils/portDiagnostics.ts` | **new.** The four messages, their fix-its, the syntax-tree rule and the expression gate |
| `noodl-core-ui/.../utils/notation.ts` | +4 sentence builders, beside the notation they use |
| `noodl-core-ui/.../utils/esLintDiagnostics.ts` | one call — the port pass over what ESLint produced |
| `noodl-core-ui/tests/code-editor/portDiagnostics.test.ts` | **new.** 35 specs |

20 suites / 298 tests green in `noodl-core-ui`. `ts-jest` runs diagnostics on, so the suite typechecks
every module it imports.

### Three things the specs decided, not the plan

- **Message 4 must not repeat message 1.** `var Output_1 = Input_1` produced *three* messages, because
  `Input_1` is declared and — reading a bare name rather than the port — genuinely never read. Literally
  true, and noise: the user is already being told about that exact name on that exact line, better.
  Message 4 now skips ports message 1 has claimed, and the acceptance's "two actionable messages" is
  what actually comes out.
- **The typo guard is real, and an existing spec found it.** §1's *"offer it only for identifiers that
  look like a port and not like a typo of something in scope"* was implemented as a length check, which
  is not that. `esLintDiagnostics.test.ts`'s `const total = 1; … totl` row went red and named the
  hole. Now: one edit's distance from any `VariableDefinition` in the document, or from any port name,
  declines the offer. One edit, not two — at two, `sum` and `num` are typos of each other and a real
  new port stops being offerable.
- **Message 2's two forms are different bugs.** `var Output_1 = …` is a genuine local and legal inside
  a helper, so it is reported at top level only. `Output_1 = …` undeclared is an implicit global at any
  depth and is reported at any depth. One rule for both gets one of them wrong.

### ⚠️ Proved red — and one §3 row is defence in depth, not a gate test

Replacing `modeHasDeclaredPorts` with `false` in `portsFor` fails **four** of the five expression rows.
The fifth — "offers no port for an undefined name in an expression" — stays green, because `no-undef`
is already off in expression mode so there is no diagnostic for messages 1 and 3 to enrich. It is worth
keeping and it is worth knowing it does not test the gate. **Messages 2 and 4 have no second mechanism
behind them at all**, which is what makes the gate load-bearing rather than belt-and-braces.

### Still not driven

Both acceptance rows. The first — apply both fixes, **wire the node, confirm a value arrives** — is
explicitly *"verify the consequence, not the mechanism"*, and a green lint panel is not the outcome.
⚠️ Fresh project per row (F13c).

## Register

| # | Finding | State |
|---|---|---|
| F12 | The user **was already warned** — `no-undef` fires in function mode. The gap is actionability, not detection | ✅ verified, `esLintDiagnostics.ts:141` |
| F13 | `var Output_1 = …` is valid JavaScript and lints **clean**; the silent half needs a new syntax-tree rule | ✅ verified by inspection of the enabled rule set |
| F13b | 🔴 `var Output_1 = Input_1` **throws** at runtime (`ReferenceError`) — it never ran silently. The silent body is `Output_1 = Inputs.Input_1`, an implicit global | ✅ verified 2026-08-12, twice, by compiling the body the runtime compiles — README premise correction 3 |
| F13c | Implicit globals are shared across Function nodes, so one bare-`Output_1` write disarms the ReferenceError project-wide | ✅ verified with F13b; **every drive of this pair needs a fresh project** |
| F14 | `no-undef` is off in expression mode for a real reason, and every message here would be destructive there | ✅ verified, `esLintDiagnostics.ts:26-32` |
| F15 | Whether `Noodl.Inputs.foo` is mined as port `foo` by the shared regexes | ✅ **measured 2026-08-12 — yes, and the reason is blunter than the question.** The patterns have **no left boundary at all**, so `MyInputs.foo` mints `foo` too. Legacy code is therefore never falsely accused by message 4. Pinned in `scriptPorts.test.ts` |
| F16 | Message 3's "not a typo of something in scope" needs an actual scope reading, not a length heuristic | ✅ found by an **existing** spec going red, not by design. One edit's distance from any in-scope name or port declines the offer |
