# FUN-008 — Completion meets the wrong instinct

**Status:** 📋 open · **Track: the keystroke** · depends on FUN-003 · **smallest task in the phase**

## The observation

Completion cannot help someone who never types the trigger. `Inputs.` offers the right names — that
is FH-019 slice 2, shipped, backed by `minePorts`
([`scriptPorts.ts`](../../../packages/noodl-core-ui/src/components/code-editor/utils/scriptPorts.ts)).
But the originating user typed **`Input_1`**, and nothing was listening for that.

The instinct is not wrong, it is *unprefixed*. So meet it where it happens.

## §1 — A bare port name completes to its notation

Typing a word at a position where an expression is expected, where that word is a prefix of a
declared or mined port name, offers the notation as the **top** completion:

| Typed | Offered |
|---|---|
| `Inp` | `Inputs.Input_1` — *"input port"* |
| `Out` | `Outputs.Output_1 = ` — *"output port (value)"* |
| `Don` | `Outputs.Done()` — *"output port (signal)"* |

Built with FUN-001's expression builders, so bracket notation and the value/signal shape are correct
without this task knowing anything about either.

The whole feature is a completion source over the union of the two port lists, with `apply` producing
the full replacement rather than the bare name. It is small, and it converts the exact keystroke the
originating user made into the correct code before they finish the word.

## §2 — ⚠️ The guard that killed this before

FH-017 found it and it is worth repeating because it typechecks and reads correctly while doing
nothing:

> **A completion guard of `word.from === word.to && !context.explicit` kills every member position**,
> because the word after a `.` is always zero-length. That is why `Noodl.` offered nothing while
> `Noodl.V` worked — and why the original QA missed it.

This task is the mirror image: it fires at a **non**-member position, on a partial word. Do not
copy the member sources' guards wholesale; write the position test for this case and **drive it**,
because a completion source that never fires is indistinguishable from one that is not installed.

## §3 — Where it must not fire

⚠️ Three exclusions:

- **Not in `'expression'` mode.** A bare identifier there is already correct — it *becomes* the input
  port ([`expression.ts:399`](../../../packages/noodl-runtime/src/nodes/std-library/expression.ts)) —
  so offering `Inputs.foo` would be actively wrong. Same gate as FUN-004 §3.
- **Not after a dot.** `foo.Inp` must not offer `foo.Inputs.Input_1`.
- **Not in a declaration position.** `var Inp…` is someone naming a local. Offering a port expression
  where an identifier is being *bound* produces a syntax error, and FUN-004's message 2 is the right
  answer for that line anyway.

## §4 — Ranking

The offer must sort **above** ESLint's and CodeMirror's generic word completions, or it will be
buried under every identifier already in the document. It is the highest-value completion in the
mode and should be boosted explicitly.

⚠️ `scopeCompletionSource(globalThis)` enumerates the **editor's** globals, not the user's runtime —
a known trap in this file. Nothing here should reach for it.

## Acceptance

- In a Function node with a declared `Input_1`, typing `Inp` offers `Inputs.Input_1` as the **first**
  completion, and accepting it inserts the full expression.
- A signal output completes to a call; a value output completes to an assignment with the caret after
  the `=`.
- The same keystrokes in `'expression'` mode offer **nothing** of the sort.
- `foo.Inp` and `var Inp` offer nothing.
- ⚠️ **Driven in the real editor, not asserted in a unit test.** A completion source that silently
  never fires is this file's documented failure mode, and it has shipped here before.

## What was built, 2026-08-12 (late)

| File | What |
|---|---|
| `noodl-completions.ts` | `barePortCompletions`, merged into the top-level branch with `filter: false` |
| `utils/completionPosition.ts` | `isDeclarationPosition` |
| `tests/code-editor/noodl-completions.test.ts` | +19 specs |

20 suites / 314 tests green in `noodl-core-ui`, three consecutive runs.

### The label is the expression, and that decides the filtering

`Outputs.Done()` does not begin with the `Don` that should match it, so CodeMirror's own filter would
drop the very completion this task exists to offer. The result therefore sets **`filter: false`** and
prefix-matches on the *port name* by hand — which the top-level branch was already doing for globals,
so it is one convention rather than two. Showing the notation as the label is the point: the user sees
`Inputs.Input_1` having typed `Inp`.

### 🔴 A gap this task found next door: `Inputs.` withheld an answer it had

A spec asserting the member branch was undisturbed came back `null`. `scriptPortCompletions` read
`minePorts` **alone**, so a port declared in the property panel and not yet mentioned in the code did
not complete after `Inputs.` — the exact position a beginner is in one second after adding a port, and
the one place completion knew the right answer and withheld it. It now reads the union, and the `info`
still distinguishes the two, because *why* a port exists is the thing this editor is teaching.

Not in this task's plan; found by writing a test for something else.

### ⚠️ Not driven, and the task says that is not enough

**"A completion source that silently never fires is indistinguishable from one that is not
installed"** — and it has shipped broken in this exact file before (F29). The unit rows are green and
prove nothing about the running editor. The mechanics are in the handover: `startCompletion(view)` +
`currentCompletions(view.state)` off the webpack registry, because `cdp type` cannot open the menu.

## Register

| # | Finding | State |
|---|---|---|
| F28 | Completion already lists the right names behind `Inputs.` — the gap is that a beginner never types the trigger | ✅ verified, `scriptPorts.ts` / FH-019 slice 2 |
| F29 | The zero-length-word guard silently disables a source; this exact bug shipped in this exact file | ✅ documented in FH-017's findings |
| F30 | `scopeCompletionSource(globalThis)` enumerates editor globals, not the runtime's | ✅ standing trap, noted in FH-019 |
