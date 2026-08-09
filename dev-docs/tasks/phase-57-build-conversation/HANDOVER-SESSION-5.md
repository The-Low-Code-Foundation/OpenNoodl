# Phase 57 — handover after session 5 (2026-08-09)

**What ran:** **BLD-003 built, driven and closed. D2 and D3 are closed.** The duplicated decision
bars are gone — measured, not asserted. A third duplicate surface the task's own defect table had
missed was found and fixed, and one defect belonging to BLD-001 was found on screen and filed.

Phase 57 is **4 of 16 built** (BLD-001 ✅, **BLD-003 ✅**, BLD-007, BLD-012). ⚠️ **BLD-007 and
BLD-012 are still undriven**, and BLD-012's is the one with a bill attached to getting it wrong.

## The one thing worth carrying

> **A document sits *beside* the sidebar, not over it.**

That is why BLD-003's defect table was wrong. It listed two surfaces rendering Accept; there are
**three**. `ChangeReviewDocument` is reached from the Build card's *own* "Review changes" button and
carries its own Accept — so scoping the ownership rule to the preview document alone would have meant
**this task's own control opened the duplicate it exists to remove**. The rule now takes *every
document that shows the candidate*, never a preview flag.

The second half, which generalises further:

> **The bug was two components each guessing. A boolean prop threaded to both is the same bug with
> more wiring** — they can still disagree about what it means. `decisionOwner(currentDocumentId,
> candidateDocumentIds)` is a **total function over the one fact that decides it**, so "both render"
> and "neither renders" are unrepresentable rather than merely unlikely.

## What is on the branch

| Commit | What |
|---|---|
| `b2432761` | BLD-003 driven and closed; C5 filed on BLD-002 |
| `eb23291c` | a doc card must not offer Accept for a draft it did not write |
| `49d06961` | **BLD-003** — one surface owns a decision; the docs are decided in the thread |
| `1377828f` | session 4's handover |
| `458e189f` | BLD-001 B9 + B10 |

## What was measured

Driven in `ai-test` from a thread **asserted** empty first, with a scripted provider. Counted from
the DOM in all three states:

| State | Accept | Review changes | Discard |
|---|---|---|---|
| Preview document open | **1** (`Add to project`) | **1** | **1** |
| Preview closed | **1** | **1** | **1** |
| Review diff open | **1** (`Accept all`) | — | **1** |

B5 had measured **2 and 2**, with the two copies disagreeing on wording. No `Reject` in any state.

⚠️ **The control count, honestly.** 3 decision controls on one surface — but **5 interactive controls
in the panel**, once `Send` and BLD-001's `Show me the plan first` override are counted. The ≤4
criterion counts down from the duplicated *decision bars*; those are gone. The other two duplicate
nothing. Do not report this as "≤4" without the sentence after it.

## Gates

| Gate | Result |
|---|---|
| `typecheck:editor` | clean |
| `typecheck:editor-tests` | clean |
| `test:main` | **87 suites, 1186 tests** — +16 over 1170, exactly the new spec |
| `test:ci` | **2582 specs, 6 failures** — the inherited AIX-006 (4) + model-registry (2). **Re-run and read, not predicted.** |

⚠️ **Never `tail` a `test:ci` run you intend to read a verdict from** — redirect to a file and grep
`^Jasmine:`. It takes ~20 minutes; wait on `until ! ps aux | grep -q "[e]lectron/dist"`.

## What to do next

1. 🔴 **BLD-002, and start with C5.** BLD-001's `Show me the plan first` override is **96px tall and
   paints 52px over the first turn's text** — it is in *both* of session 5's screenshots, overlapping
   the request and striking a line through the agent's sentence. ⚠️ **The register entry's mechanism
   is a hypothesis, and says so**: the button's box is `top 151 → bottom 247` while its `Header` ends
   at `195` and `overflow` is `visible`, but the numbers do not fully close (it also starts 60px
   below its own parent's top). **Re-measure; do not trust the sentence.**
2. **BLD-002 proper** — five message kinds, five treatments. ⚠️ Keep the README correction:
   **contrast is not the legibility problem, type scale is.** No colour tokens.
3. **Drive BLD-007 and BLD-012.** Both merged, neither driven.
4. **BLD-005** is still nearly free — `BuildThread` already has a header row outside the scroll area.
5. **BLD-006** inherits a smaller job: the thread accumulates within a session already, so what is
   left is persistence across a restart, plus the switcher.

⚠️ **The docs route of BLD-003 has never been on screen.** Each draft's Accept / Review changes /
Discard is built, typechecked and gated — and undriven, because this drive scripted the component
route only. **BLD-010 owns it, and it should not be assumed to work.**

## Driving this panel with no provider — the recipe, extended

The seam is **`AiClient.chatStream` + `AiClient.isConfigured`**: two temporary lines hooked on a
global, then `git checkout --` the file. Everything else is installed from `cdp eval` with no
rebuild. Branch on `request.tools`, never on prose — `submit_plan` present → return **one** `create`
operation (one component operation *is* the `component` route); `submit_component` present → return
`{ nodes: [{ id: 'g1', type: 'Group', parameters: {} }], connections: [], visual_roots: ['g1'] }`.

⚠️ Four things that cost time this session:

- **`stopReason` is `'tool_calls'`**, not `'tool_use'`. The response also needs `text`, `usage`,
  `model`.
- **`[class*=BuildThread-module__Turn]` also matches the `Turns` container**, so an empty thread
  reports `1`. **Assert an empty thread by counting Accept buttons, not Turn elements.**
- **`cdp click` has no `:has-text`.** Tag from `eval` with `setAttribute('data-drive', …)`, then
  click the attribute selector — and one click per `eval`.
- **The planning turn fired twice** before authoring (the LAS-006 advisory turn). **Count sends by
  request, never by provider call.**

## A technique worth reusing

BLD-003's acceptance included *"`grep -rn "PrimaryButtonVariant.Danger"` in these surfaces returns
nothing"* — an instruction a human is trusted to run. It is now a **spec that reads the three source
files**, and I **reintroduced the defect to confirm it fails** (2 failed, 14 passed) before trusting
it. A pure spec on the copy module would have passed throughout the original defect: the module was
right and one of its consumers had a hard-coded string.

## Concurrency

A sibling session was live at start (its jasmine run notified into this session's task channel) and
`ai-test` showed *"Edited 38 minutes ago"* on open — **provenance I could not establish**. I avoided
the ambiguity rather than resolving it: the drive **never accepted anything**, so the fixture was
never written. Every commit was pathspec-scoped; `git log` was re-checked immediately before each.
No sibling touched phase 57.

## Fixture and cleanup

`ai-test` opened, one candidate staged and then **discarded** — nothing written. The temporary
`AiClient` hook is reverted (`grep` returns 0). Dev stack stopped (`dev:stop`, 25 processes, nothing
left running). Screenshots are in the session scratchpad, not the repo. No worktree created.
