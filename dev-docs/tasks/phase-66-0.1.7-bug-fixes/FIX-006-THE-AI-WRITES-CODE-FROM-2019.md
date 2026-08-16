# FIX-006 — The AI writes code from 2019

**Report 4 (a, b — node choice and code style)** · Tier 2 · Effort **S + S + M**

> *"It made a Script node inside a component for this, which is overkill but it also didn't add
> any input or output signals, which means the Script can't be run … it used like `var foo = "bar"`
> type code instead of more modern const / let, and used a complex regex function instead of a
> simple splice."*

## Mechanism — pinned: these are prompt ABSENCES, not prompt failures

1. **Nothing in any prompt compares Function / Script / Expression.** Grepped across
   `authoring/prompts/*` and MCP `instructions.ts`/`toolGroups.ts`: zero comparative guidance. The
   only comparative copy in the product is the node picker's chooser
   (`NodePicker.chooser.ts:85-113`) — which the AI never sees, and whose triad **excludes the
   Script node entirely**, so nothing anywhere says when *not* to use Script. The enriched
   catalog's `Javascript2.whenToUse` is correct and would have prevented the choice — but it is
   **pull, not push**: the model only sees it after already fetching that type.
2. **The Script node the AI wrote genuinely cannot run — and it's worse than the report says.**
   `Javascript2` has **no `run` signal and no static outputs**; only signals declared inside
   `define({…})`/`script({…})` run anything, and top-level statements execute **exactly once at
   parse time** (`javascriptnodeparser.js:19-38` — the code is wrapped in `new Function(…)` and
   invoked once). Function-shaped code in a Script node ran once at import and can never run again
   — while still minting ports, so the graph *looks* wired.
3. **No code-style guidance exists anywhere** — no prompt, tool description, catalog field or
   convention template mentions `const`/`let`, or preferring string methods over regex.
   `AUTHORING_TRAPS` is 7 items, all visual. The model falls back to its training-era Noodl bias.
4. The planner's "logic cluster → component" rule (`decomposition.ts:64-66`) plausibly over-applied
   to a one-node transformation; its own counter-rule (`:117-121`) names "a single node" but was
   not decisive.

## Fix direction — structure > gate > docs (phase 58's own ordering)

1. **Push the chooser (S).** Add a "THREE WAYS TO COMPUTE" block to `traps.ts` (already shared by
   both clients via `editor-deps.ts:319` and surfaced through `get_project_info`), sourcing the
   copy from `NodePicker.chooser.ts`'s `CHOOSER_NOTES` — that module is deliberately import-free so
   picker and prompt cannot disagree. Include the Script node's true nature ("no run signal; body
   runs once at parse; use only for lifecycle/`define` shapes") and when Expression suffices.
2. **`CODE_STYLE` clause (S)** in `authoring.ts` beside the authoring contract: `const`/`let`,
   never `var`; string/array methods over regex where either works; `Outputs.X = …` for values,
   `Outputs.X()` for signals; small readable bodies — *the user is meant to learn from the code*.
3. **Validator rule (M).** A `Javascript2` node whose `code` contains no `define(`/`script(` call
   — or any code node with no incoming connection on any declared input and no signal-in — is a
   warning. This shape currently escapes every gate.

## Rulings needed

- **Demote Script from the AI-authorable set?** It is the rarest correct answer and the most
  expensive wrong one. (Recommend: keep authorable, but the traps block says "reach for it last".)
- Should the planner now **prefer the Visual Function (Logic Builder)** for beginner-profile
  requests, given phases 59/64's investment? This interacts with Report 16's preference doc.

## Acceptance criteria

1. The exact reported request ("take a string, cut first char, convert to number, multiply by
   0.9") produces a **Function node** (or Expression), not a Script-in-a-component — measured on
   the live build loop, not asserted from the prompt text.
2. Generated Function code uses `const`/`let` and `slice`, not `var` and regex, for that request.
3. A deliberately-authored Script node with Function-shaped code trips the new validator warning;
   a correct `define({…})` Script does not (negative control).
4. The traps block renders in both clients' context (editor `get_project_info` equivalent and MCP)
   — verify on the wire, not in source.


## Fixes 1 + 2 — what shipped (2026-08-16, session 34, `28310bc8`)

- **`THREE_WAYS_TO_COMPUTE`** — generated from `NodePicker.chooser.ts`'s own `chooserNotes()`, not
  retyped, so the picker's comparative copy and the prompt's cannot become two hand-maintained
  descriptions of the same three nodes. Each line **leads with the type name**: the picker can omit
  it because its card carries the title beside the copy, but a prompt has no such frame, and a
  comparison whose options are unnamed is not a comparison. Appended to it is the one thing the
  chooser deliberately does not carry — the **Script node**, which it excludes entirely, stated as
  the mechanism section measured it (no run signal, no static outputs, body runs once at parse,
  mints ports while doing so).
- **`CODE_STYLE`** — const/let never var; string and array methods over regex where either does;
  short bodies; `Outputs.X = value` for a value and `Outputs.X()` for a signal. The closing clause
  is the load-bearing one: *the user reads this code, and often learns JavaScript from it.*
- **Script demotion ruled as recommended:** keep it authorable, and say *reach for it last*.

## 🔴 A false premise in this task's own §1, found by wiring it up

§1 says the traps block is *"already shared by both clients via `editor-deps.ts:319` and surfaced
through `get_project_info`"*. That is true about the module being **reachable** from the MCP bundle
and false about it being **used** by the editor. Measured: `AUTHORING_TRAPS` has exactly **two**
consumers, `noodl-mcp/src/editor-deps.ts` and `noodl-mcp/src/tools/read.ts`. **No prompt under
`prompts/` imports it.**

⚠️ **So a trap added only to `traps.ts` would have fixed the report for external agents and left the
in-editor AI untouched — and the in-editor AI is the likelier author of the reported node**, since
the reporter was working in the editor. Both blocks are therefore exported and wired into
`prompts/authoring.ts`'s system prompt as well. The prompt stays byte-identical across calls (the
block is computed once from a frozen array), which `tests/ai/project-docs.test.ts` asserts.

## Fix 3 — what shipped (2026-08-16, session 36)

**`DiagnosticCode.UnrunnableScriptNode`** (`unrunnable-script-node`), a **warning**, deliberately
**not** in `AUTHORED_BLOCKING_WARNINGS`: it advises and never rejects a write. `checkScriptNodeRunnable`
lives in `functionPorts.ts` beside the FIX-007 check that already owns the code-node domain, and is
wired into `authoredPreconditionDiagnostics` — the composition **both** clients call, which is what
makes it true of the editor and the MCP server rather than of one file.

### 🔴 This task's proposed predicate was wrong, and the corpus is what said so

§3 above asks for *"a `Javascript2` node whose `code` contains no `define(`/`script(` call"*.
**Measured against the repo's 88 Script nodes, that predicate fires on 13 — every one a working
library prefab or module.** The parser injects four parameters (`javascriptnodeparser.js:22`) and
aliases a fifth (`getCodePrefix`: `const Script = Node`), so there are **three** generations of
declaration API, and the third is the one the shipped library actually uses:

| Generation | Surface | Parser |
|---|---|---|
| 1st | `define({…})` | `:44` |
| 2nd | `script({…})` | `:57` |
| 3rd | `Node.*` / `Script.*` — `Inputs`/`Outputs` `:165-166`, `OnInit` `:178`, `OnDestroy` `:181`, `Setters` `:184`, `OnInputsChanged` `:189`, `Signals` `:203` | — |

Counting all three: **0 of 88**. The narrowing went 13 → 1 → 0, and the last one to fall was
`library/prefabs/media-query`, which declares *only* `Node.OnInit` + `Node.OnDestroy` — no ports at
all. ⚠️ **Two skips are decisions, not oversights:** `useExternalFile: "yes"` (the body is a file
this check cannot read, so `code` is not evidence) and an absent/blank `code` (unfinished ≠ wrong).

### The instrument was checked in both directions

🔴 **0 of 88 is also what a dead predicate scores.** So: the four known-bad shapes (the reported
node, a bare expression, a console-only body, an IIFE) all fire, and the seven known-good ones all
stay silent — the two arms **disagree**, which is the only thing that makes the silence mean
anything. Mutating the predicate to always-true and to always-false each kills **5 of 18** specs;
removing the one wiring line kills **exactly 1**, the wiring spec.

⚠️ **`SCRIPT_NODE_API_MEMBERS` is a hand-kept copy of runtime internals**, the same copy-not-import
constraint (and drift risk) as the regexes beside it. So the spec **loads and runs the real parser**
and requires every member on the list to produce an observable effect in it — plus a control that an
invented member produces none, because a list graded only by "the bodies work" would pass with
anything on it.

## Acceptance criteria — status

| AC | Status | Evidence |
|---|---|---|
| **1** — the request produces a Function/Expression, not a Script-in-a-component | 🔴 **not driven** | Needs a live authoring run; prompt-only change, no spec can grade it |
| **2** — generated code uses `const`/`let` and `slice` | 🔴 **not driven** | Same run as AC1 |
| **3** — bad Script warns, `define({…})` Script does not | ✅ **DRIVEN** | Over real MCP stdio into a scratch copy: bad ⇒ `warnings: 1`, `unrunnable-script-node`; `define({…})` ⇒ `warnings: 0`. Both `errors: 0` and `"created"`, so it advises without blocking |
| **4** — the block renders in both clients' context, on the wire | ◐ **MCP half DRIVEN** | `get_project_info` over real stdio: read-write carries `THREE WAYS TO COMPUTE` + `CODE STYLE` (16,213 chars), read-only omits them (667). Control pair on one variable. **Editor half still source-only** |

✅ **AC4's leading type names were checked against `list_node_types`, not assumed**: `Expression`,
`Logic Builder`, `JavaScriptFunction` and `Javascript2` are all real `typeName`s (displayName
"Visual Function", "Function", "Script"), so the block really does name the ids an agent must write.

⚠️ **`authoringTraps` is gated on `--allow-writes`** (`read.ts:116`). A read-only probe omits it *by
design* — a first pass here read that absence as a defect. Measure the read-write arm.

🔴 **AC1 and AC2 remain the undriven half**, and they are the reason fixes 1+2 are still ungraded:
both are prompt changes, so the honest grade is a re-run of the authoring measurements on the live
build loop.
