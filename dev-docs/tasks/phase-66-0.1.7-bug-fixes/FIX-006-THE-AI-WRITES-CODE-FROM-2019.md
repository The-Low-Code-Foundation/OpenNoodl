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
| **1** — the request produces a Function/Expression, not a Script-in-a-component | ✅ **DRIVEN** | s39, 20 live sessions. **0/10 Script nodes** in the shipped arm; every run authored a `Expression`, `JavaScriptFunction` or `Substring`+`Expression` graph. ⚠️ The control arm scores the same — see below |
| **2** — generated code uses `const`/`let` and `slice` | ✅ **DRIVEN** | Same 20 sessions. **0/10 `var`, 0/10 regex** in the shipped arm; the bodies are `const` + `.slice(1)`/`.substring(1)` or a bare `Expression`. ⚠️ Same caveat |
| **3** — bad Script warns, `define({…})` Script does not | ✅ **DRIVEN** | Over real MCP stdio into a scratch copy: bad ⇒ `warnings: 1`, `unrunnable-script-node`; `define({…})` ⇒ `warnings: 0`. Both `errors: 0` and `"created"`, so it advises without blocking |
| **4** — the block renders in both clients' context, on the wire | ✅ **BOTH HALVES DRIVEN** | MCP (s36): `get_project_info` over real stdio — read-write carries `THREE WAYS TO COMPUTE` + `CODE STYLE` (16,213 chars), read-only omits them (667). **Editor (s38): `systemPrompt()` called live in the renderer** — `create` 14,505 chars and `update` 14,755 chars, both carrying `THREE WAYS TO COMPUTE` **and** `CODE STYLE`, with an absent-string control returning `false` so `includes` is discriminating |

✅ **AC4's leading type names were checked against `list_node_types`, not assumed**: `Expression`,
`Logic Builder`, `JavaScriptFunction` and `Javascript2` are all real `typeName`s (displayName
"Visual Function", "Function", "Script").

🔴 **CORRECTED s38 — the conclusion that followed that check is half wrong.** *"so the block really
does name the ids an agent must write"* is true of **three** ids, not four. Read off the live
`THREE_WAYS_TO_COMPUTE` in the renderer: `Expression`, `Logic Builder` and `JavaScriptFunction`
each lead a line in backticks, but the fourth item is prose — *"Reach for the **Script** node
LAST"* — and the string `Javascript2` **does not appear in the prompt at all** (measured:
`systemPrompt('create').includes('Javascript2') === false`, same for `'update'`, beside an
absent-string control).

⚠️ **Whether that is a defect is a judgement, and the honest reading is "probably not".** The Script
paragraph exists to tell the model *not* to reach for that node, and an id is less load-bearing in a
prohibition than in a recommendation. But `traps.ts:61-63` states the principle as *"the type name
leads every line … it is also the id the agent must actually write"*, and the fourth item does not
follow it. **Either the block should name `Javascript2`, or that comment should say the rule applies
to the three recommendations only.** Cheap either way; noted rather than changed, because it is a
copy decision.

⚠️ **`authoringTraps` is gated on `--allow-writes`** (`read.ts:116`). A read-only probe omits it *by
design* — a first pass here read that absence as a defect. Measure the read-write arm.

## AC1 + AC2 — driven (2026-08-16, session 39)

**Instrument:** `packages/noodl-editor/scripts/aix002-measure` — the real `AuthoringSession`, the real
context builder and the real validation gate, against the real 44-component `git-repo-utf8` project,
with a directly-constructed Anthropic provider. No Electron, no UI. The request was added to the
corpus as `fix006-string-math` and **names no node type and no JavaScript**: a request saying "with a
Function node" or "use slice" would have answered both criteria in the question.

**Design: 2 models × 2 arms × n=5 = 20 sessions.** All 20 authored, all valid on first submit.

| model | arm | n | Script node | `var` | regex | `Substring` node | inline `.slice`/`.substring` |
|---|---|---|---|---|---|---|---|
| `claude-sonnet-5` | guidance **ON** | 5 | **0** | **0** | **0** | 1 | 4 |
| `claude-sonnet-5` | guidance OFF | 5 | 0 | 0 | 0 | 5 | 0 |
| `claude-haiku-4-5` | guidance **ON** | 5 | **0** | **0** | **0** | 2 | 3 |
| `claude-haiku-4-5` | guidance OFF | 5 | 0 | 0 | 0 | 5 | 0 |

`claude-sonnet-5` is the shipped Anthropic default and carries `recommendedFor: ['act']`, so the ON
arm is what a real user gets; `claude-haiku-4-5` is the mid-tier model whose behaviour motivated the
pushed-channel design in this module's own header. Effort `low` — `AUTHORING_EFFORT`, as shipped.

✅ **Both criteria pass in the shipped configuration.** Zero Script nodes, zero `var`, zero regex
across 10 treatment sessions on two models. A representative body: `const numeric =
Inputs.Price.slice(1); const value = Number(numeric); Outputs.Discounted = value * 0.9;`

### 🔴 The control arm passes identically, so the blocks are NOT what makes it pass

The control subtracts `THREE_WAYS_TO_COMPUTE` and `CODE_STYLE` — and nothing else — from the system
prompt on the wire, and scores **0 Script nodes, 0 `var`, 0 regex in 10 sessions too**. The reported
2019-shaped output does not reproduce on this request on either model, with or without the fix.

⚠️ **This is the "a guard is not proven by a run where the hazard was absent" shape.** The honest
grade is: *the criteria are met, and the fix's contribution to meeting them is unmeasured.* A
treatment arm alone would have read as proof and been worth nothing — a current model writes `const`
and `slice` unprompted, so a clean result was always equally consistent with the blocks doing nothing.

### ✅ The arms are not identical, which is what makes the null result readable

The obvious boring explanation for two arms scoring the same is that the subtraction silently failed.
Ruled out three ways:

1. **The system prompt differs on the wire** — 14,505 chars ON, 13,003 OFF, recorded per session.
   The ON figure is byte-for-byte s38's live-renderer reading for `create`, so the treatment arm is
   the editor's real prompt and not a harness approximation.
2. **The strip throws rather than degrades.** It removes the imported constants by exact string
   match and then re-checks four distinctive markers (`THREE WAYS TO COMPUTE`, `CODE STYLE`,
   `never var`, `Reach for the Script node LAST`); any of them surviving, a missing block, or a
   non-string system message aborts the run. A no-op control cannot complete.
3. 🔴 **The arms produce visibly different graphs.** Guidance OFF reached for the dedicated
   `Substring` node **10/10**; guidance ON did so **3/10**, doing the string surgery inline in the
   Expression or Function body instead (**7/10** vs **0/10**). The blocks measurably change
   behaviour — just not along the axis the criteria measure.

⚠️ **And the direction of that difference is worth a ruling.** The blocks' one measured effect here
is to move work *out* of a purpose-built node and *into* code. `THREE_WAYS_TO_COMPUTE` opens
"reaching past them costs the user a node that cannot run", and the control arm — with the block
removed — is the arm that consistently found `Substring`. Whether that is a regression depends on
whether a `Substring` node or an inline `.slice(1)` is the better thing to hand a beginner; this
task should not decide that silently. **Ruling added to the phase's list.**

### What this instrument cannot say

⚠️ **The decomposition half of the report is out of reach here.** The reporter's complaint was a
Script node *inside a component that should not have existed*, and `AuthoringSession` is handed its
`componentPath` up front — the "should this be a component at all" decision belongs to
`decomposition.ts` and the planner (§4 of the mechanism). This run grades **node choice and code
style**, which is what AC1 and AC2 are worded to ask, and says nothing about the over-decomposition.

⚠️ Two models is not every model, and the reporter's model is unknown. The result is "does not
reproduce on the shipped default or on the mid-tier probe", not "cannot happen".

**Cost:** $0.53 across 22 sessions (20 grid + 2 pilot).

### 🔴 The harness was dead, and nothing anywhere would have said so

The first run failed with `Cannot read properties of undefined (reading 'getActiveProvider')`.
`packages/noodl-editor/scripts/aix002-measure` last changed **2026-07-26**; `AuthoringSession` began
calling `AiClient.roleRequestFields` on **2026-08-08** (`5af9fde6`, LAS-009 roles), which put
`AiConfigStore` on the authoring path for the first time. **The harness has been broken for eight
days** — and it is in no `tsconfig` `include`, no jest project and no jasmine suite, so its only
gate is a human choosing to run it.

The stub in `build.mjs` was wrong twice over, and the second one is the one that matters:

1. **Nothing reached the importers.** esbuild's `__toESM` builds a namespace from the module's OWN
   KEYS; a Proxy carrying only a `get` trap has none, so every named import from the stubbed store
   resolved to `undefined`. A `get` trap cannot survive CJS→ESM interop.
2. 🔴 **Had the interop worked, the stub would have corrupted every request.** A catch-all returning
   a callable noop makes `getActiveProvider()` **truthy**, which sends `resolveRole` down its
   override branch (`client/roles.ts:110-138`) and spreads a noop `provider` *and* `model` onto every
   request. The harness builds its own provider from `.env`, so the correct stub is the one that says
   **AI is off** — `getActiveProvider: () => null` — the branch that contributes only the role tag.

⚠️ **`--model` is now effectively required.** The header's *"omit to use the provider's registry
default"* was only ever true through `AiConfigStore.getModel()`, which the stub cannot supply;
omitting it now fails fast with *"No model specified for the Anthropic provider"* rather than
silently measuring some other model.

✅ **Sampling was checked, not assumed:** `AuthoringSession` sets no temperature and `claudeFrontier`
declares `sampling: false`, so none is sent and the API default applies. The five runs per cell are
independent samples, not one result printed five times.

✅ **The grader was checked in both directions** — the reported defect, reconstructed as a
`Javascript2` node containing `var` and `s.replace(/[^0-9.]/g, '')`, fails both criteria; the real
runs pass both. A grader that cannot fail grades nothing. It also scores a run that wrote **no** code
as `n/a` rather than `pass`, so an arm that dodged AC2 cannot borrow credit for answering it.

## ✅ RULED 2026-08-16 (session 42)

**AC4 `Javascript2` → add the id to the Script line.** `traps.ts:61-63`'s principle — *"the type name
is what matters"* — is right; the prompt was simply incomplete. Rejected: narrowing the comment.

**`Substring` vs inline code → WEIGHT THE BUILT-IN NODES HEAVIER, with one exception.** Richard:
*"Let's add a heavier weight to the in built nodes, unless the operation requires more complexity
which could be easily rolled into a Function, otherwise you end up with function nodes connected to
substring nodes connected to functions etc."*

🔴 **The exception is the load-bearing half, and the rule is NOT simply "prefer nodes".** The failure
mode being ruled against is **alternation** — `Function → Substring → Function` chains:

- simple operation ⇒ the **built-in node**;
- operation complex enough to need a Function ⇒ do **all** of it inside that one Function, rather
  than splitting it across a node and two code blocks.

⚠️ **Measure any prompt edit on BOTH axes** — node choice *and* chain shape. A rule that only pushes
"use the node" will manufacture exactly the alternation this ruling exists to prevent, and the
current criteria would score that as a win. ⚠️ The n=5 cells (`Substring` 10/10 OFF vs 3/10 ON) are
**not** a floor to build on — re-run at n=10 first, per s41's finding.

## ✅ AC4 BUILT 2026-08-16 (session 43) — the id is in the prompt

`traps.ts`'s Script paragraph now opens with the id: *"`Javascript2`, the Script node — reach for it
LAST…"*, so all four items of `THREE WAYS TO COMPUTE` lead with the type name the agent must write,
which is what the block's own comment claims of itself. The paragraph stays a paragraph rather than
becoming a fourth `-` bullet: it is a prohibition, and bulleting it beside the three recommendations
would read as a fourth way to compute.

⚠️ **Not re-measured on the wire.** s38's reading — `systemPrompt('create').includes('Javascript2')
=== false` — was taken live in the renderer, and the equivalent positive has **not** been taken. The
string is in the source that both clients assemble from (`traps.ts` → `authoring.ts` for the editor,
→ `read.ts` for MCP, both already driven at s36/s38 as carrying this block), so the claim here is
*"the source now contains it"*, not *"the wire now carries it"*.

⚠️ **Nothing grades this string.** No spec anywhere asserts the Script line — checked, including
`noodl-mcp`'s `rejectionExamples.test.ts`, which asserts four other `authoringTraps` substrings.
An edit that dropped the id again would be caught by nothing.

🔴 **Still open in this task: the Substring weighting**, which is the one most likely to be got
wrong. Read the ruling above before touching it.
