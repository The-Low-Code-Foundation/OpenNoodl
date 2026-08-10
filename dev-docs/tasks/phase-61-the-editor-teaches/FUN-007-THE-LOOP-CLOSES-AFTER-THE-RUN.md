# FUN-007 — The loop closes after the run

**Status:** 📋 open · **Track: the consequence** · independent of FUN-003, so it can be worked in
parallel

## The silence this ends

`var Output_1 = Input_1` does not merely lint weakly. **It runs successfully.**

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

## Register

| # | Finding | State |
|---|---|---|
| F24 | `var Output_1 = Input_1` **runs successfully** and reports nothing — the silence beneath the lint gap | ✅ verified by reading the compile and run path |
| F25 | `outputValuesProxy`'s `set` trap is where a write becomes a port write, so counting writes per run is nearly free | ✅ verified, `simplejavascript.ts:99-110` |
| F26 | The body is compiled with a **prefix**, so stack line numbers are offset from the user's document | ✅ verified, `:447` + `javascriptnodeparser.js:492-494`; offset ours to compute |
| F27 | Stale errors outliving their code is a filed defect in this exact node; the runtime error path needs the same clearing the parse error got | ✅ verified, `:171-176` |
