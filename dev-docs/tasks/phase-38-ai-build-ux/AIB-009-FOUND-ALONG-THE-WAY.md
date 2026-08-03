# AIB-009 — Found along the way

| Field | Value |
|---|---|
| **Phase** | 38 — The AI Build Experience |
| **Priority** | mixed — see each entry |
| **Difficulty** | mixed |
| **Recommended executor** | 🟢 Sonnet for most; the marked ones need judgement |
| **Prerequisites** | none |

A register, not a task. Items found while diagnosing the nine reports, each with its evidence and
its confidence. Worked opportunistically alongside the rest of the phase; anything that grows past
a slice gets promoted to its own AIB.

**Confidence is stated per item and means what it says.** *Verified* = a file was read or a script
was run. *Observed* = seen in the running app this session, cause not traced. *Suspected* = reasoned
from the code, not confirmed.

---

## F1 — A failed operation's model output is unrecoverable

**✅ Closed 2026-08-03 (AIB-002 pass) · was: Verified · 🔴 High**

The recovery half is built: a failed operation now offers **Retry** in the panel once the run is
done, calling the `PlanRun.retryOperation` AIB-001 slice 4 already built and tested, with the gate's
own error as repair context. Nothing had to be added to the model — the panel was only ever offering
that path for an *apply* failure, which is the rarer of the two.

**One stated mechanism here is wrong, and checking it is why the fix stayed small.** The entry says
the run "keeps **nothing** — no partial candidate". True, but not because anything is discarded:
within a single `run()`, `AuthoringSession` returns `authored` the moment a submission passes the
gate (including the AIX-006 style-pass fallbacks at lines 673, 679, 727 and 743, all of which finish
`authored` on `stylePassBaseline`). So an `exhausted` outcome in a plan run means *nothing ever
passed the gate*, and `session.stagedFiles` is genuinely empty. A "keep the last valid candidate"
fix would have had nothing to keep. It only becomes reachable through `refine()`, which `PlanRun`
never calls.

Original entry follows.

**Verified · 🔴 High · related to [AIB-001](AIB-001-PARAMETER-VALUE-CONTRACT.md) slice 4**

When an operation's session ends `failed` or `exhausted`,
[`PlanRun`](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/authoring/PlanRun.ts#L331-L338)
records `status: 'failed'` and an error string, and keeps **nothing** — no partial candidate, no
transcript. `acceptedOperations` then closes the failure over the dependency graph, dropping every
operation that depended on it.

So one failed operation in a three-operation plan can silently invalidate the other two, and the
user's only options are Abandon or apply what survived. There is no *"retry this one"*, and the
tokens spent on the failed attempt bought nothing that is still on the machine.

AIB-001 slice 4 adds retry for an **apply** failure. This is the **authoring** failure, and it is
the more common one. Same shape, same fix: keep the last candidate even when it failed the gate,
show why, and offer to re-run that operation alone with the diagnostics as repair context.

## F2 — Model-authored HTML reaches `dangerouslySetInnerHTML`

**Verified · 🟠 High · security**

[`Markdown.tsx`](../../../packages/noodl-core-ui/src/components/common/Markdown/Markdown.tsx)
constructs Remarkable with `html: true` and injects the result with `dangerouslySetInnerHTML`, with
no sanitiser.

That was defensible when doc bodies were written by the user. Since AIX-011 criterion 7, `DocSession`
authors them — and since AIX-009 the Docs panel renders them. A prompt-injected or simply careless
model can emit `<img onerror=…>` into `docs/ARCHITECTURE.md` and it executes in the editor renderer,
which has the editor's privileges.

Not hypothetical enough to hold the phase, but it should not ship to alpha. Add a sanitiser (or the
comment-stripping pass from [AIB-006](AIB-006-MARKDOWN-RENDERING.md) extended to a full allow-list).
Note the precedent: OBS-004 shipped a relay readable by any web page and it was caught late.

## F3 — `PageInputsAdapter` propagates a bad value before it throws

**Verified · 🟡 Medium · fold into AIB-001 slice 3**

[`nodeAdded`](../../../packages/noodl-editor/src/editor/src/models/NodeTypeAdapters/PageInputsAdapter.ts#L47-L63)
copies `queryParams` and `pathParams` from a sibling `PageInputs` node onto the new one — then calls
`updatePortsForNode`, which is where the `.split` throws. And `parametersChanged` does the same in
reverse, writing the value to every sibling via `setParameter`.

So a malformed value is *spread across the component* before anything notices. Inside the apply
transaction the rollback covers it; outside one (an import, an MCP write, a hand-edited file) it
would not.

## F4 — Cancelling a run strands the components it already built

**Verified · 🟡 Medium**

`cancel()` sets `this.cancelled`, which the doc pass then honours by marking every doc operation
`skipped` ([PlanRun.ts:350-353](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/authoring/PlanRun.ts#L350-L353)).
Staged components survive, which is right — but the plan then has components with no documentation
recorded, and no way to run just the doc pass afterwards.

Either allow the doc pass to be re-run against staged components, or say in the UI that stopping
skips the documentation. Currently it does neither.

## F5 — The Settings dialog opens over the launcher at startup

**Observed · 🟡 Medium · cause not traced**

On a clean `npm run dev:debug` launch this session, the launcher rendered with the app-wide Settings
dialog already open on the AI section — see
[`launcher-settings-open-at-startup.png`](launcher-settings-open-at-startup.png), captured via CDP
immediately after mount. No user action preceded it.

Could be persisted UI state from a previous session rather than an auto-open. Worth ten minutes:
launch with a fresh `userData` and see whether it reproduces. If it does, it is a first-run defect on
the very first screen of the product.

## F6 — GitHub repo probing logs an error per repo on every launch

**Verified from `.logs/dev.log` · 🟢 Low · noise**

The launcher probes every repo in the user's GitHub account for a `project.json` to decide which are
NodeGX projects. Each miss produces two log lines — a `renderer:error` for the 404 and an
`❌ [getFileContent] Error … status: 404`.

The behaviour is correct; the logging is not. A 404 from a probe is the expected answer, not an
error, and it currently buries real errors in a launch log. Demote to debug, or probe with a request
whose miss is not an error.

## F7 — The scoping conversation does not stream

**Verified · 🟡 Medium · folded into [AIB-006](AIB-006-MARKDOWN-RENDERING.md)**

`ScopingStep` shows a static `Thinking…`
([line 80](../../../packages/noodl-core-ui/src/preview/launcher/Launcher/components/ProjectCreationWizard/steps/ScopingStep.tsx#L80))
for the whole turn. This is the first AI interaction any new user has with the product and it is the
one with no feedback at all. Listed separately from AIB-006 because it may need work in
`ScopingSession` rather than the step.

## F8 — Mid-run partial accepts are invisible to later operations

**✅ Closed 2026-08-03 — the mechanism had already changed · was: Verified · 🟠 High**

Not true by the time AIB-002 was built, and not because of AIB-002. AIB-003's rewrite made
`workingGraph()` a method that recomputes from `filesById` at the point each session starts, so a
mid-run `setOperationFiles` *is* what the remaining operations author against. What this pass added
is the spec that pins it (`authoring-plan.test.ts`, "hands a later operation the candidate as the
user edited it mid-run"). Worth noting for anyone reading the entry as written: a test aimed at the
**gate** would have passed either way — `validateCandidateComponent` gives the semantic validator
only `components.map(c => c.name)`, so a sibling candidate's *shape* reaches the prompt and never
the gate.

Original entry follows.

**Verified · 🟠 High · folded into [AIB-002](AIB-002-THE-RUN-IS-LEGIBLE.md) slice 1**

Only reachable once AIB-002 lets you review during a run, which is why it is filed here rather than
as a live defect. `workingGraph` is extended from `outcome.files` at stage time
([PlanRun.ts:325-327](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/authoring/PlanRun.ts#L325-L327));
a later `setOperationFiles` replaces `filesById` but **not** the working graph. So an operation the
user pruned mid-run is still what operation 3 authors against, and the mismatch surfaces at apply as
a validation refusal on a component the user thought they had fixed.

## F9 — `contextNote` is the only thing explaining the plan/project boundary

**✅ Closed 2026-08-03 by AIB-004 · was: Verified · 🟡 Medium**

The buttons carry the meaning now — `Keep all in plan` / `Drop from plan` against the single
`Apply to project (N)` — and the plan context is a persistent chip rather than a title suffix. The
note is kept, unshortened for the moment: it is the only place that states *why* the levels differ,
and shortening it is a judgement worth making against the live surface rather than the source.

Original entry follows.

**Verified · 🟡 Medium · folded into [AIB-004](AIB-004-ONE-VOCABULARY-AND-A-REAL-PREVIEW.md)**

The sentence *"Keeping a selection updates the plan — nothing reaches your project until you apply
the whole plan"* is the entire explanation of the model that confused Richard, and it is prose in a
panel next to a full-screen canvas. Structural affordances beat prose here; AIB-004 is where that
gets fixed, but the note is worth keeping in a shorter form once the buttons carry the meaning.

## F10 — State is mutated during render in `ProjectAuthoringView`

**✅ Closed by [AIB-003](AIB-003-THE-BUILD-SURVIVES-NAVIGATION.md) · was: Verified · 🟢 Low**

The take moved into the `useState` initialiser, which runs before anything is subscribed and at most
once per mount, and the guard is now the store's own content rather than a ref sentinel.

Original entry follows.

**Verified · 🟢 Low · correctness hazard**

[Lines 119-122](../../../packages/noodl-editor/src/editor/src/views/panels/AiAuthoringPanel/ProjectAuthoringView.tsx#L119-L122)
perform a destructive `takePendingScopePlan()` in the render body, guarded by a ref sentinel. The
guard works for one component instance, but writing to a module-level store during render is a
StrictMode and concurrent-rendering hazard, and the codebase is on React 19.

[AIB-003](AIB-003-THE-BUILD-SURVIVES-NAVIGATION.md) rewrites this seam anyway. Flagged so it is not
faithfully reproduced in the new store.

## F11 — Nothing anywhere ends a turn that never returns

**Verified 2026-08-03 (AIB-002 live QA) · 🟠 High**

Found by accident and worth keeping. During the AIB-002 live replay two operations reported 3m21s
and 4m25s for turns whose scripted work is seven seconds — Chromium throttling `setTimeout` in an
occluded window, so the *cause* was the harness. The *screen* was not: the panel read
`Writing — 3 nodes so far` and nothing else, indefinitely, and there was no way from inside the
editor to tell a throttled timer from a provider that had stopped answering.

Neither `AuthoringSession.run()` nor `PlanRun` has a deadline. The budget they enforce is turns and
submissions, both of which require the model to *reply*. A provider that accepts the request and
never responds leaves the run `busy` forever, the Stop button as the only exit, and — because
`PlanRun.cancel()` marks the remaining operations `skipped` — the rest of the plan unbuilt.

The fix is a per-turn deadline with a clear message, not a global one: a long turn is normal, a
silent one is not. AIB-002 now shows elapsed per operation, which makes the symptom *visible*; it
does not make it *end*.

---

## How to work this register

Items folded into another task (F3, F7, F8, F9) are cross-referenced there and should be closed by
that task, not separately. F1, F2, F5 and F6 are standalone. F4 and F10 are one slice each.

**Closed so far:** F1 (AIB-002 pass), F8 and F9 (AIB-002/AIB-004 pass), F10 (AIB-003).
**Open:** F2 (the XSS surface — the one that must not ship to alpha), F4, F5, F6, F7, F11.

**F5 did not reproduce.** Two clean `npm run dev:debug` launches on 2026-08-03 rendered the launcher
with no Settings dialog over it. Persisted UI state from the session that filed it remains the best
explanation; left open rather than closed, since "did not reproduce twice" is not "cannot happen".

**F3 is half closed and the half that remains is now harmless.** AIB-001 replaced the raw
`.split(',')` in `updatePortsForNode` with `readNameList`, so nothing throws. But `nodeAdded` still
copies `queryParams`/`pathParams` verbatim from a sibling, and `parametersChanged` still writes them
to every sibling with `setParameter` — the *spread* the entry describes is unchanged. It no longer
rolls back a transaction, because every reader now tolerates any shape; what it still does is carry a
malformed value to nodes the user never touched, where the next reader to be written without
`readNameList` will find it. Left as written rather than closed.

Anything that turns out to be larger than described gets promoted to AIB-010+, with the finding kept
here as a pointer rather than deleted — the register is the record of what one real session
surfaced, and that is worth keeping intact.
