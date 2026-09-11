# FUN-007 — The loop closes after the run

**Status:** 🟡 **runtime half built 2026-08-12** on branch `fun-007-lane`; §1, §2's mapping and §3
are in and specced, §2's *gutter rendering* is blocked on FUN-003's file. **The live drive that
closes the acceptance has not been run.** · **Track: the consequence** · independent of FUN-003, so
it can be worked in parallel

## The silence this ends

`var Output_1 = Input_1` does not merely lint weakly. **It runs successfully.**

> 🔴 **The sentence above is false — see F24 and F28 in the register.** That exact body *throws*.
> The silent shape is `Output_1 = Inputs.Input_1`. The section is left as written because it is the
> premise the task was accepted under, and because a premise corrected in place stops being
> evidence of how the task went wrong.

The function is compiled and invoked, the local is assigned, no exception is thrown, no output is
written, and the node reports nothing wrong — because from the runtime's point of view nothing *was*
wrong. The user wires the node up, sees nothing come out, and has no thread to pull.

That is the deepest layer of the originating failure. FUN-004 catches it statically; this task
catches it when the truth is unambiguous, which is at run time.

## §1 — "This node wrote no output"

After a run in which the body completed normally and **no output port was written**, say so:

- on the node, through the existing warning-dot mechanism;
- in the editor, as an information line, if the editor is open.

⚠️ **A function with no outputs at all is not a defect.** A Function node used purely for a side
effect — writing a variable, calling an API — is legitimate and common. The condition is therefore
narrower than "wrote nothing":

> the node **has** output ports, and **none** of them was written during the run.

That is a shape with no innocent reading: ports exist, so something was meant to come out, and
nothing did.

The mechanism exists to detect it. Output writes go through `outputValuesProxy`, a `Proxy` whose
`set` trap is the point where an assignment in user code becomes a port write
([`simplejavascript.ts:99-110`](../../../packages/noodl-runtime/src/nodes/std-library/simplejavascript.ts)).
Counting sets during a run is a counter in a trap that already runs.

## §2 — The error reaches the code, not the console

When user code throws, the node already records it: `_internal.parseError` for a compile failure,
`function/script-threw` at [`:404`](../../../packages/noodl-runtime/src/nodes/std-library/simplejavascript.ts)
and `function/script-not-compiled` at [`:320`](../../../packages/noodl-runtime/src/nodes/std-library/simplejavascript.ts)
for the runtime cases, plus a built-in `Error` output.

**Route it to the gutter of the editor holding that node's code**, at the mapped line.

⚠️ **Line mapping is the work, and it is where this task will go wrong.** The body is compiled inside
`new AsyncFunction(...)` with a **code prefix** prepended
([`:447`](../../../packages/noodl-runtime/src/nodes/std-library/simplejavascript.ts); the prefix is
what declares `Script` from `Node`, per
[`javascriptnodeparser.js:492-494`](../../../packages/noodl-runtime/src/javascriptnodeparser.js)).
A stack line number is therefore **offset from the document the user is looking at**, and an error
anchored one or two lines off is worse than an error anchored nowhere — it accuses innocent code.
Compute the offset from the prefix rather than hardcoding it, and test it against a body whose first
line throws.

⚠️ A second, previously-filed trap: **an expression error can outlive the expression**. A stale error
from a previous body must be cleared when the text changes, exactly as
[`:171-176`](../../../packages/noodl-runtime/src/nodes/std-library/simplejavascript.ts) already clears
`parseError` when the script is unset — *"a stale `parseError` left here would make the next `Run`
report a syntax error the author has already deleted."* The same reasoning covers a runtime error.

## §3 — A `ReferenceError` on a name that is a port

The single most diagnosable error the product can produce. In strict-mode user code, reading an
undeclared `Input_1` throws `ReferenceError: Input_1 is not defined`, and we know — from FUN-003's
declared list — that `Input_1` is a port.

The runtime error message becomes FUN-004's message 1, at the line that threw, with the same fix-it:

> **`Input_1` is an input port on this node.** Read it with `Inputs.Input_1`.

Static and runtime paths converge on one sentence. ⚠️ Build the message in **one** place and have
both call it, or the two will drift and a user will be told two things about one mistake.

## §4 — What the node shows

The warning dot already exists and is the right surface: it is on the canvas, where the user is when
they wonder why nothing came out.

⚠️ Do not add a second badge, and do not make "wrote no output" an **error**. It is a warning. A node
that is deliberately side-effect-only will occasionally trip the §1 condition through a code path
that legitimately writes nothing on some runs, and an error state for that would train people to
ignore the dot — which costs more than this task gains.

## Acceptance

- A Function node with an output port that runs to completion **without writing any output** shows a
  warning on the node, with a message naming the ports that stayed empty.
- The same node after the output is written correctly shows nothing.
- A Function node whose code has no output ports at all **never** warns.
- A body whose **first line** throws anchors the gutter error to line 1 of the document the user
  sees — this is the prefix-offset check and it must be explicit.
- Editing the code clears a stale runtime error; the next run reports only what that run did.
- `ReferenceError` on a name that is a declared port produces FUN-004's wording, from the shared
  builder, with the fix-it attached.
- ⚠️ **Verify the consequence:** reproduce the originating user's exact node, run it, and confirm the
  product now tells them something. Reading the code path is not the check.

## What was built, 2026-08-12

Branch `fun-007-lane`. Three files:

| File | What |
|---|---|
| `packages/noodl-runtime/src/nodes/std-library/functionDiagnostics.ts` | **new.** The notation builders (`portReference`/`portUsage`), the measured stack-line offset, the `ReferenceError`-to-port reading, and the two sentences |
| `packages/noodl-runtime/src/nodes/std-library/simplejavascript.ts` | the write counter in the proxy trap and in the signal stub, `reportOutputSilence`, `clearRunDiagnostics`, the mapped line and hint on the throw path |
| `packages/noodl-runtime/test/nodes/fun-007-run-diagnostics.test.ts` | **new.** 22 specs, including the prefix-offset check and the Expression-mode control |

### Verified by specs, in this worktree

- 22/22 in the new file; `packages/noodl-runtime` **128 suites / 2349 tests, 0 failures**;
  `packages/noodl-viewer-react` **67 suites / 892 tests, 0 failures**; `tsc -p` adds no error.
- The line-1 anchoring was proved **red first**: an off-by-one deliberately injected into
  `stackLineOffset()` fails 3 specs, including "reported at line 1".

### ⚠️ Not verified, and only a live drive can close it

- **The warning dot and its tooltip on the canvas.** Everything here ends at
  `editorConnection.sendWarning`; that the dot renders, and that the sentence is legible in the
  tooltip, is unproven. The drive recipe is in the handover.
- **§2's gutter.** The mapped line is *emitted* (`line`, `column`, `hint` on the warning payload and
  on the raised error's `detail`), but nothing renders it in the code editor: that needs
  `CodeEditorType.ts`, which is FUN-003's file and was owned by another lane this wave. **FUN-003's
  consumer should read those three fields; they are already there.**

## §2's editor half, built 2026-08-12 (late)

The runtime had emitted `line`, `column` and `hint` since the morning and **nothing rendered them**.
That is now the whole of what changed:

| File | What |
|---|---|
| `noodl-core-ui/.../utils/runtimeDiagnostic.ts` | **new.** A `StateField` holding the last run's error, a linter source that positions it, and `setRuntimeDiagnostic(view, …)` |
| `noodl-core-ui/.../codemirror-extensions.ts` | the field installed, and its diagnostics concatenated onto the existing linter |
| `noodl-core-ui/.../JavaScriptEditor.tsx` + `utils/types.ts` | a `runtimeDiagnostic` prop and the effect that pushes it |
| `noodl-editor/.../CodeEditorType.ts` | `runtimeDiagnosticFromWarnings`, a `WarningsModel` subscription, and a re-render path |
| `noodl-core-ui/tests/code-editor/runtimeDiagnostic.test.ts` | **new.** 18 specs |
| `noodl-editor/tests/utils/codeeditor-mode.test.ts` | +9 specs for the reader |

### Two decisions worth not re-litigating

- **It matches on the shape, not the warning key.** `js-function-run-waring` is a literal in
  `simplejavascript.ts`, which `noodl-editor` does not import. Copying it would be F32's problem
  again — two copies of a constant that must agree, with nothing to notice when they stop. The reader
  takes *a warning that names a line*, which is narrower and self-describing.
- **The field clears itself on `docChanged`.** The producer clears too, but this is a floor rather
  than a courtesy: given F31 — a warning that stranded and never cleared — an editor that can only be
  cleared by a message it may never receive is the wrong shape. A runtime diagnostic describes an
  execution, and the text changing makes it false regardless of who noticed.

### ⚠️ Proved red, and one of the two attempts was decoration

Both guards were inverted before being believed:

- Injecting `+ 1` into the line maths fails the two anchoring specs. **It did not, the first time.**
  The specs were written the obvious way — a one-line body for line 1, a three-line body for line 3 —
  and the clamp to `doc.lines` puts both answers back, so both specs passed *with the defect
  present*. They were decoration for as long as they existed. Rewritten with lines below the reported
  one, they now fail. This is the recorded trap in a new place: an off-by-one is only observable when
  the wrong line is a line the document has.
- Removing the `docChanged` clear fails the three stale-error specs.

### Still not driven

Drive steps **8 and 9** are unblocked by this and remain unrun. §2's own acceptance — a first-line
throw reading `Line 1:` in a real editor — is proved at the unit boundary but not on screen, and
"nothing renders it" was this task's entire §2 problem, so the drive is the check that matters.

## Register

| # | Finding | State |
|---|---|---|
| F24 | ~~`var Output_1 = Input_1` **runs successfully** and reports nothing~~ | 🔴 **FALSE, corrected 2026-08-12.** It **throws** `ReferenceError: Input_1 is not defined` — reading an undeclared identifier throws in sloppy mode too, so that body has always fired `Failure` and always put its message on `Error`. The claim was verified *by reading*, and reading cannot answer it. Measured by compiling the body |
| F28 | The genuinely silent shape is the **other half** of the same mistake: `Output_1 = Inputs.Input_1`. The read is correct, the write lands on an implicit global, nothing throws, `Success` fires | ✅ measured 2026-08-12. This is what §1 catches, and it is why §1 rather than §3 is this task's load-bearing half |
| F25 | `outputValuesProxy`'s `set` trap is where a write becomes a port write, so counting writes per run is nearly free | ✅ verified, `simplejavascript.ts:99-110` — with **two** corrections: the count must be taken **before** the "only send when they change" early return, or re-writing an unchanged value reads as no write; and `Outputs.Done()` is a *call* that never reaches the trap at all, so the signal stub counts separately |
| F26 | The body is compiled with a **prefix**, so stack line numbers are offset from the user's document | ✅ verified, and **measured: the offset is 3** — one line of `getCodePrefix()` plus two of `async function anonymous(…)\n) {\n`. Only the first is derivable from our own inputs, so `stackLineOffset()` compiles a probe and asks the engine instead |
| F27 | Stale errors outliving their code is a filed defect in this exact node; the runtime error path needs the same clearing the parse error got | ✅ verified, `:171-176`; now cleared from **three** places — the `functionScript` setter, a run that succeeds, and the editor-side `_parseScriptForErrorsAndPorts` |
| F30 | 🔴 **An implicit global written by one Function body is visible to every other one.** Bodies are compiled non-strict against one global object, so the first node in a project to write `Output_1 = …` permanently disarms the `ReferenceError` for every node that later *reads* a bare `Output_1` — the read silently returns the other node's value | ✅ measured 2026-08-12, by this task's own spec file failing on test order. **§3's hint is therefore best-effort**: it fires on the first offender and not the second. §1 is unaffected and catches both |
| F31 | 🔴 **A user's `"use strict"` is inert.** The prefix is prepended *before* the author's first line, so their directive is never in the directive prologue. The source comment at `simplejavascript.ts:104-110` — "the throw only reaches authors who opt in" — describes something an author **cannot** do | ✅ measured 2026-08-12 (same body throws without the prefix, does not throw with it). Not fixed here: making bodies strict is a language change and belongs with the "bare identifiers work" question TASKS.md files as out of scope |
| F32 | §3 asks for the message to be built in **one** place. It cannot be, today: `noodl-core-ui` — where FUN-001's `notation.ts` and FUN-004's diagnostics live — has **no dependency on `@noodl/runtime`**, and a runtime node cannot import a React package | ✅ verified in both `package.json`s. The runtime's builders are in `functionDiagnostics.ts` with the constraint written at the top; keeping the two copies saying the same words is a **review** obligation until someone adds a shared package |
| F33 | ⚠️ `scripts/devtools/make-worktree.sh` links `packages/nodegx-backend/dist` but **not** `packages/noodl-runtime/dist-types`. Without it, 5 runtime suites fail to *run* in a worktree and the total silently drops 2303 ← 2349 | ✅ measured 2026-08-12 — the recorded "a gitignored artifact makes tests vanish" trap, in a new place. Symlinked by hand for this lane; the script is not this task's territory |

## The drive that closes the acceptance

⚠️ Run this **in the primary checkout after merge**, not in a worktree — `lerna exec` resolves the
package root to primary, so `npm run dev:*` there would launch primary's code either way.

1. `npm run dev:stop -- --list`, then `npm run dev:stop` if anything is listed. Launch the editor.
2. New project. Drop a **Function** node. Nothing should be on it yet — no dot.
3. In the property panel, add **one output** under Script Outputs named `Output_1`, and **one input**
   under Script Inputs named `Input_1`. Still no dot: the node has not run.
4. Double-click the node (this focuses `Script`) and type exactly the originating user's line:
   `Output_1 = Inputs.Input_1;` — **not** `var Output_1 = Input_1`, which throws and is a different
   row. Close the popout so the parameter is written.
5. **This is the acceptance.** The node runs at load because `Run` is unconnected, and a warning dot
   must appear. Hover it. It must read:
   *"The script ran but produced no output: "Output_1" stayed empty. Write it in the script with
   `Outputs.Output_1 = ...` — assigning to a plain variable of the same name does not reach the
   port."*
   Verify the **consequence**, not the dot: a person who has never seen the notation must be able to
   act on that sentence without opening anything else.
6. Re-open the Script, change the line to `Outputs.Output_1 = Inputs.Input_1;`, close. **The dot must
   go.** If it does not, the clear path is wrong, and a warning that cannot be cleared is worse than
   none.
7. Delete both ports in the panel, put back a side-effect-only body (`Noodl.Variables.hits = 1;`),
   run. **No dot, ever** — the "a Function with no outputs is not a defect" case.
8. §2's line anchoring, which no unit test can prove *in the editor*: set the body to
   `throw new Error("first line");` and hover the dot. It must say **`Line 1:`**. Then put two blank
   lines above it and confirm it says `Line 3:`.
9. §3: set the body to `var Output_1 = Input_1;` on a node that declares `Input_1`, in a **fresh
   project** (F30 — an earlier node's implicit global disarms the `ReferenceError`). The dot must
   read *"Line 1: Input_1 is not defined — Input_1 is an input port on this node. Read it with
   `Inputs.Input_1`."*
10. The mode control: drop an **Expression** node, type `Output_1 = Input_1` into it, and confirm
    nothing from this task appears on it and its ports behave exactly as before.

## The drive, as run — 2026-08-12, primary checkout

§1's acceptance is **closed**. §2's steps are still open because §2 is not built.

Warnings were read from the live `WarningsModel.instance` over CDP, so this is what the editor
actually holds, not what the runtime intended to send.

| Step | Measured | |
|---|---|---|
| 2–4 — node with `Input_1`/`Output_1` and body `Output_1 = Inputs.Input_1;` | warning key `js-function-no-output-written` present on the node | ✅ |
| **5 — the sentence** | verbatim: *"The script ran but produced no output: "Output_1" stayed empty. Write it in the script with `Outputs.Output_1 = ...` — assigning to a plain variable of the same name does not reach the port."* — `level: 'warning'`, `showGlobally: false`, exactly as §4 argues | ✅ |
| 6 — correct the body, **the dot must go** | body → `Outputs.Output_1 = Inputs.Input_1;` → warning keys `[]` | ✅ |
| 7 — no ports, side-effect-only body, **no dot ever** | a **clean** node with `Noodl.Variables.hits = 1;` and no declared ports raises nothing | ✅ |
| 8 — `Line 1:` anchoring | **not driven — §2 is not built**, nothing renders the mapped line | ⏳ |
| 9 — `ReferenceError` naming the port | **not driven** — same reason; also needs a fresh project (F30) | ⏳ |
| 10 — Expression control | see **FUN-003 F17**: the Expression editor does not run in `'expression'` mode at all, which makes this control unmeasurable until that is fixed | 🔴 |

### 🔴 F31 — a stranded warning never clears

Found while driving step 7. Setting `scriptInputs`, `scriptOutputs` and `functionScript` in one rapid
batch left the node carrying:

```
message:        …"Output_1" stayed empty…      ← names a port that no longer exists
scriptOutputs:  []
functionScript: "Noodl.Variables.hits = 1;"
```

**It was still there minutes later.** It is not a rendering lag; the entry sits in `WarningsModel`.

⚠️ **Rare, but permanent once it happens.** It did **not** reproduce on a second node given the
identical batch, and each individual transition clears correctly — removing only the port clears it,
and changing only the script clears it. So it is a race between the clear and a re-run scheduled
against the previous script, not a plain missing-clear.

This is the failure §2 filed in advance — *"a stale error can outlive the expression"* — and it
breaks step 6's own principle: **a warning that cannot be cleared is worse than none.** The user-facing
form is a Function node permanently dotted about a port it does not have.

**Fix belongs with §2's lane**, which is already the one that owns clearing.
