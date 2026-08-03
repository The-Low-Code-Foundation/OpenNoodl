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

**Verified · 🟠 High · folded into [AIB-002](AIB-002-THE-RUN-IS-LEGIBLE.md) slice 1**

Only reachable once AIB-002 lets you review during a run, which is why it is filed here rather than
as a live defect. `workingGraph` is extended from `outcome.files` at stage time
([PlanRun.ts:325-327](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/authoring/PlanRun.ts#L325-L327));
a later `setOperationFiles` replaces `filesById` but **not** the working graph. So an operation the
user pruned mid-run is still what operation 3 authors against, and the mismatch surfaces at apply as
a validation refusal on a component the user thought they had fixed.

## F9 — `contextNote` is the only thing explaining the plan/project boundary

**Verified · 🟡 Medium · folded into [AIB-004](AIB-004-ONE-VOCABULARY-AND-A-REAL-PREVIEW.md)**

The sentence *"Keeping a selection updates the plan — nothing reaches your project until you apply
the whole plan"* is the entire explanation of the model that confused Richard, and it is prose in a
panel next to a full-screen canvas. Structural affordances beat prose here; AIB-004 is where that
gets fixed, but the note is worth keeping in a shorter form once the buttons carry the meaning.

## F10 — State is mutated during render in `ProjectAuthoringView`

**Verified · 🟢 Low · correctness hazard**

[Lines 119-122](../../../packages/noodl-editor/src/editor/src/views/panels/AiAuthoringPanel/ProjectAuthoringView.tsx#L119-L122)
perform a destructive `takePendingScopePlan()` in the render body, guarded by a ref sentinel. The
guard works for one component instance, but writing to a module-level store during render is a
StrictMode and concurrent-rendering hazard, and the codebase is on React 19.

[AIB-003](AIB-003-THE-BUILD-SURVIVES-NAVIGATION.md) rewrites this seam anyway. Flagged so it is not
faithfully reproduced in the new store.

---

## How to work this register

Items folded into another task (F3, F7, F8, F9) are cross-referenced there and should be closed by
that task, not separately. F1, F2, F5 and F6 are standalone. F4 and F10 are one slice each.

Anything that turns out to be larger than described gets promoted to AIB-010+, with the finding kept
here as a pointer rather than deleted — the register is the record of what one real session
surfaced, and that is worth keeping intact.
