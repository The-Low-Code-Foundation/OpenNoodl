# Phase 61 — The code editor teaches, or nobody learns the notation (Track FUN)

**Created:** 2026-08-09
**Status:** 📋 specced, not started. Tasks are **[TASKS.md](TASKS.md)** (FUN-001…009).
**Origin:** Richard, 2026-08-09, watching a new user build their first Function node:

> *"They created a function node, seem to understand a LITTLE BIT about javascript, added some input
> and output ports on the function props, went into the function and wrote `var Output_1 = Input_1`.
> …there was never any tutorial for this, you just had to read the docs (which this user, as lazy as
> most users are, won't do and will just continue playing and getting frustrated)."*

**Every claim about existing code in this phase's files was read in source on 2026-08-09.** Keep that
rule for anything added. The phase's own premise was wrong in two places before a line was written,
and both corrections are below.

## The premise, in one sentence

The user was **eight characters** from working code, was **already being warned**, and the affordance
that would have taught them the answer is **invisible while the one they found teaches nothing**.

## What is actually on disk

| The moment | What the product does | Where |
|---|---|---|
| They create a Function node and open the Script | **A completely blank editor.** `functionScript` declares no `default` | [`simplejavascript.ts:161`](../../../packages/noodl-runtime/src/nodes/std-library/simplejavascript.ts) |
| They add ports in the property panel | `scriptInputs` / `scriptOutputs` proplists. Nothing about them reaches the code editor | [`simplejavascript.ts:139-160`](../../../packages/noodl-runtime/src/nodes/std-library/simplejavascript.ts) |
| They type `var Output_1 = Input_1` | `no-undef` fires as a **warning**: *"'Input_1' is not defined"*. It does not know `Input_1` is a port | [`esLintDiagnostics.ts:141`](../../../packages/noodl-core-ui/src/components/code-editor/utils/esLintDiagnostics.ts) |
| They run it | ~~`Outputs` is never written. The node reports nothing, because a function that assigns to a local is a function that ran fine~~ 🔴 **false — see premise correction 3.** That body **throws**, every time | — |
| What would have worked | Typing `Inputs.` — which **creates the port as a side effect of mentioning it** | [`javascriptnodeparser.js:294-387`](../../../packages/noodl-runtime/src/javascriptnodeparser.js) |

## ⚠️ Premise correction 1 — the notation in the brief is the legacy alias

The originating conversation named `Noodl.Inputs.inputName`. **That is the back-compat alias, not the
current notation.** A Function body is compiled as

```js
new AsyncFunction('Inputs', 'Outputs', 'Noodl', 'Component', script)
```

([`simplejavascript.ts:447`](../../../packages/noodl-runtime/src/nodes/std-library/simplejavascript.ts),
validated again at `:558`), and `Noodl.Inputs` / `Noodl.Outputs` are assigned afterwards at
[`:359-360`](../../../packages/noodl-runtime/src/nodes/std-library/simplejavascript.ts) under a
comment that says so in as many words:

```
// Legacy code used: Noodl.Outputs.foo = 'bar'
// New code uses: Outputs.foo = 'bar' (direct parameter)
```

The correct line for the user's case is therefore **`Outputs.Output_1 = Inputs.Input_1;`** — their
code plus two prefixes.

This matters beyond pedantry, because FUN-002, FUN-004, FUN-005 and FUN-006 all **write the sentence
a beginner reads first**, and until now no such sentence existed anywhere. Which is the second
correction.

## ⚠️ Premise correction 2 — there is no documentation to have read

The brief assumed the user could have read the docs and didn't. Checked:

- `Noodl.Inputs` appears **nowhere** in the product outside the runtime alias itself and one built
  deploy artifact. Nothing teaches it, so nothing taught the wrong thing either.
- The **enriched catalog entry for `Function` contains exactly two fields** — `typeName` and
  `displayName` ([`node-catalog-enriched.json`](../../../packages/noodl-types/src/node-catalog-enriched.json)).
  No summary, no example, no guidance. The AI authoring path, the docs site and the node picker all
  read from there.
- The one place the notation *is* written down is the `functionScript` port description —
  *"JavaScript run when Run fires, reading Inputs.name and writing Outputs.name"*
  ([`:163`](../../../packages/noodl-runtime/src/nodes/std-library/simplejavascript.ts)) — which is a
  tooltip on the row the user clicked **through** to reach the editor.

So this is not a "user wouldn't read the docs" problem. **The sentence does not exist to be read.**
FUN-001 writes it once, and every other task consumes it.

## ⚠️ Premise correction 3 — the observed code does not run silently. It throws

**Measured 2026-08-12, twice and independently** (the FUN-007 lane, then again in the primary
checkout by compiling the body the runtime compiles):

```
var Output_1 = Input_1;      → ReferenceError: Input_1 is not defined
Output_1 = Inputs.Input_1;   → runs clean, writes nothing, Success fires
```

Reading an undeclared identifier throws in sloppy mode as readily as in strict, and the runtime
injects only `Inputs`, `Outputs`, `Noodl` and `Component` — never the port names. So the exact body
in the originating observation has **always** thrown, always fired `Failure`, and always put its
message on `Error`. FUN-007's register carried this as *"✅ verified by reading the compile and run
path"*; reading cannot answer that question, and compiling the body answers it in one second.

**The silence is real, and it belongs to the other half of the same mistake.** Drop the `var` — which
is what a user does the moment they see the ReferenceError — and `Output_1 = Inputs.Input_1` lands on
an implicit global: nothing throws, `Success` fires, no port moves. That is the body FUN-007 §1
catches, and it is why §1 rather than §3 is the load-bearing half.

**What this changes, and what it does not.** The phase is *not* weakened; the diagnosis moves. The
user was not unwarned — they were warned **twice**, by a linter that did not know `Input_1` was a
port and by a runtime failure delivered to `Error` and `Failure` ports that nothing on the canvas
draws attention to. Neither report names the port, and that is exactly FUN-004's subject. What dies
is only the sentence *"a function that ran fine"*: the first failure is loud in a place nobody looks,
and the second is silent everywhere.

⚠️ And a trap for FUN-004's acceptance, which promises to reproduce the observed bug verbatim: a
`ReferenceError` and an implicit-global write are **different rows** and must be driven separately.
Worse, implicit globals are shared between Function nodes in a project — the first node to write a
bare `Output_1` permanently disarms the ReferenceError for every node that later reads one, so any
drive of this pair needs a **fresh project**.

## The inversion this phase exists to fix

`parseAndAddPortsFromScript` mines the source for `Inputs.x`, `Inputs["x"]`, `Outputs.y`,
`Outputs["y"]` and `Outputs.Done()`, and adds a port per unique name
([`javascriptnodeparser.js:294-387`](../../../packages/noodl-runtime/src/javascriptnodeparser.js);
the Function node calling it is `simplejavascript.ts:568`). The node's own source comment at
[`:701-705`](../../../packages/noodl-runtime/src/nodes/std-library/simplejavascript.ts) states the
consequence plainly: a Function's inputs *"arrive by two routes — the proplist and
`parseAndAddPortsFromScript` reading `Inputs.x` out of the script"*.

**Code-first authoring already works. It is completely invisible.** Meanwhile the proplist is in the
property panel, where the user already was, and it hands them a named port with no hint of how to
name it in code.

The discoverable route teaches nothing. The route that teaches is undiscoverable. Every task here is
a way of closing that gap, and they are cheap because the mechanism is already built.

## What already exists, and is closer than it looks

| Piece | State | Consequence for this phase |
|---|---|---|
| ESLint diagnostics with `no-undef` as a **warning** in `function` and `script` modes, off in `expression` | shipped, FH-017 | FUN-004 does not add detection. It adds a **fix** |
| `minePorts()` — the six runtime regexes, re-implemented client-side | shipped, FH-019 slice 2 | The editor already knows the ports **you wrote**. It does not know the ports you **declared** |
| `CodeAuthoringContext` — a registry, read per keystroke by completion sources | shipped, FH-019 slice 1 | FUN-003 adds one field. It does not build a seam |
| `validationTypeForEditType` → `'function'` for the Function node's Script port | shipped | Every task can target the Function editor precisely, without touching CSS/JSON/text modes |
| `nodeDoubleClickAction: { focusPort: 'Script' }` | shipped | Double-clicking the node **is** the entry point. Whatever we put in the editor is what a beginner meets |
| An AI chat per code port (`AiChat.tsx`, a fourth `JavaScriptEditor` call site) | shipped | The "ask the AI" answer already exists. It is not the answer this phase gives |

## The one thing the editor cannot currently see

`CodeAuthoringContext` carries `libraries`, `variables`, `objects`, `arrays`
([`authoringContext.ts`](../../../packages/noodl-core-ui/src/components/code-editor/authoringContext.ts))
— everything about the *project*, and nothing about **the node whose code is open**.

`CodeEditorType.onLaunchClicked` has `nodeId` in hand at
[`:146`](../../../packages/noodl-editor/src/editor/src/views/panels/propertyeditor/CodeEditor/CodeEditorType.ts)
and passes it to nothing.

That single missing field — this node's declared ports, with plug and type — is what FUN-004,
FUN-005, FUN-006, FUN-007 and FUN-008 all stand on. **FUN-003 is the structural task and everything
else is downstream of it.**

## The seam this phase builds

Three affordances, each answering a different failure:

| | fails when | answer |
|---|---|---|
| **Nothing to imitate** | the editor opens blank | FUN-002 seeds a working body |
| **A guess that looks fine** | `var Output_1 = Input_1` lints as a generic warning | FUN-004 names the port and offers the edit |
| **Nothing to click** | the notation must be recalled, not recognised | FUN-005 puts the ports in the editor, clickable |

FUN-006 narrates them, FUN-007 closes the loop after a run, FUN-008 catches the wrong instinct at the
keystroke, and FUN-009 handles the node with the **opposite** rule.

## Relationship to phases 59 and 60

**Three phases were specced on 2026-08-09 from the same test-user session**, and the boundaries are
worth stating because they are easy to blur:

| | covers | in one line |
|---|---|---|
| [**59 — the logic seam**](../phase-59-logic-seam/README.md) (LGC) | *choosing* between Expression, Function and Visual Function | the picker, and the Blockly workspace nobody finds |
| [**60 — values flow, signals fire**](../phase-60-values-and-signals/README.md) (SIG) | the **graph** vocabulary — what a wire carries, what a signal does | "'Done' should send the value with the signal" |
| **61 — the editor teaches** (FUN) | the ten minutes **after** someone chooses text | "I added ports, so why doesn't `Output_1 = Input_1` work?" |

⚠️ **One genuine overlap with phase 60, and it must not be built twice.** SIG's subject is the
value/signal distinction on the canvas; FUN-001 §1 and FUN-005 §1 need the *same* distinction
expressed **in code** — a signal output is `Outputs.Done()`, a value output is `Outputs.x = `. If
phase 60 writes the copy that explains what a signal is, FUN-001's module should cite it rather than
paraphrase it. Two phases explaining signals in different words is precisely the failure both were
opened to fix.

The boundary is worth stating because it is easy to blur: LGC-001 makes the Function node findable
and explains what it is *for*. FUN-001…009 assume the user is already inside it. Neither phase blocks
the other, and one honest reading is that phase 59's whole Blockly bet gets weaker if phase 61 lands
— which is an argument for doing phase 61 first, not for cancelling either.

## What this phase is not

- **Not a tutorial.** The originating observation is that this user will not read one. Every task
  here delivers help *at the point of the mistake*, in the editor, in their own port names. A
  walkthrough is the thing that was already tried by being absent.
- **Not Blockly.** See phase 59. Nothing here adds a visual grammar, and nothing here waits for one.
- **Not a language change — yet.** The tempting swing is making bare names *work*: rewrite the source
  so `var Output_1 = Input_1` compiles into port reads and writes. **Filed, not scheduled**, and the
  argument is in [TASKS.md](TASKS.md#what-is-deliberately-not-here). It is the only option where the
  naive code just runs, and it is also magic that breaks copy-paste equivalence with every example we
  will ever write.
- **Not "ask the AI".** `AiChat.tsx` already offers it. A beginner who does not know the notation
  cannot check the answer, and the phase's job is to make them able to.

## The exit test

A person who has never opened NodeGX, told only *"make this node pass its input through to its
output"*, with nobody explaining ports or notation:

1. double-clicks a fresh Function node and finds **a body that already works**, with two ports on the
   node to prove it (FUN-002);
2. renames the ports to what they want by editing the code, and the node follows (already true —
   FUN-005 makes it visible);
3. or, having added ports in the panel first, types `Output_1 = Input_1` and is told **"Output_1 is
   an output port — write `Outputs.Output_1`"**, with a click that does it (FUN-004);
4. runs it, and if nothing was written to an output, **the node says so** rather than succeeding
   silently (FUN-007).

Then the honest measurement: **run it both ways.** Half the testers get today's blank editor, half
get the seeded one. Time to first working Function node is the number. If it does not move, we built
an affordance, not an improvement — and the standing rule is to verify the **consequence**, not the
mechanism: run it both ways and diff, rather than confirming the seed appears.
