# AIB-003 — The build survives navigation

| Field | Value |
|---|---|
| **Phase** | 38 — The AI Build Experience |
| **Priority** | 🔴 Critical — alpha blocker |
| **Difficulty** | 🟠 Medium-hard (a lifetime change, not a bug fix) |
| **Recommended executor** | 🔵 Fable for the lifetime decision, 🟠 Opus to build it |
| **Prerequisites** | none |
| **Status** | ✅ **COMPLETE 2026-08-03** — all four slices. Criteria 1–6 met, criterion 6 live twice (scripted and by accident). Slice 4 closes phase-38 exit criterion 7. |

## What was built

**Slice 1 — the lifetime decision: B, as recommended.** `PlanSessionStore`, a
`Model` singleton keyed by project id, the same shape as `ProjectReviewStore`.

Criteria 3 and 4 pull against each other — a plan must survive switching projects
and back, and a run must not leak past a project close — and they resolve once
the two things a run *is* are separated. On `ProjectModel.instanceWillChange` the
departing run is **cancelled** (nothing keeps authoring against a project nobody
has open) and its staged output is **kept** (it is expensive, it is valid, and
the user did not ask to lose it). A cancelled `PlanRun` keeps everything it
already staged, so this is the phase's own rule applied to its machinery.

**Slice 2 — the state moved.** `plan`, `note`, `excluded`, `applied`,
`applyFailure`, the description and the `PlanRun` live in the store;
`ProjectAuthoringView` subscribes. The unmount cleanup no longer disposes the
run — disposal is now the user's explicit Abandon or a successful apply, and
nothing else. Transient UI (which dialog is open, whether a button says
"Re-authoring…") stays local on purpose.

**Slice 3 — the plan is read back off disk.** `renderScopeRecord` appends the
plan as a fenced block tagged `nodegx-plan`; `recoverScopePlan` parses it, and
recovers the **transcript** by parsing the rendered form — which is the
conversation history the report asked for and which had been written to disk and
never shown. Offered, never adopted: the plan may be weeks old.

Two judgement calls worth recording:

- **A tag, not a bare ` ```json ` fence.** The record is a document a person
  edits, and documents acquire code samples. A user's own JSON must never be
  mistaken for the plan.
- **"Was it already applied?" is asked of the graph, not of a flag.** The record
  is written once and never updated — deliberately: it is a decision document,
  not a status file. So the plan is re-offered only while at least one `create`
  it proposes does not yet exist.

## Objective

A plan, its run, and every authored candidate survive switching scope tabs, switching panels,
closing the panel, and — for the plan itself — restarting the editor. Nothing the model produced is
destroyed except by the user saying so.

## What happened

> *"I went away from the build panel, after creating the docs in the build panel, I went to the docs
> panel, then when I came back to the build panel, switched the tab to project, my conversation and
> all the AI created pages were gone and I don't see any conversation history."*

Three components' worth of authored, validated, staged output — gone to a tab click.

## The mechanism, verified

**All plan state is component-local `useState`.**
[`ProjectAuthoringView.tsx:125-143`](../../../packages/noodl-editor/src/editor/src/views/panels/AiAuthoringPanel/ProjectAuthoringView.tsx#L125-L143) —
`plan`, `runState`, `excluded`, `applied`, `note`, and `runRef` (which holds the `PlanRun`, and with
it every staged `ComponentFiles`). Plus:

```tsx
useEffect(() => () => runRef.current?.dispose(), []);
```

— unmount **disposes the run**.

**The panel conditionally renders it.**
[`AiAuthoringPanel.tsx:471-472`](../../../packages/noodl-editor/src/editor/src/views/panels/AiAuthoringPanel/AiAuthoringPanel.tsx#L471-L472):

```tsx
) : scope === 'project' ? (
  <ProjectAuthoringView isConfigured={isConfigured} hasProject={hasProject} />
```

Switching the scope toggle to *This component* or *Docs* unmounts it. The cleanup fires. Everything
is gone. Switching back mounts a fresh one with `plan = null`.

**And it cannot be recovered**, because the launcher handover was consumed destructively on first
mount:
[`pendingPlan.ts:57`](../../../packages/noodl-editor/src/editor/src/models/AiAssistant/scoping/pendingPlan.ts#L57)
`takePendingScopePlan` sets `pending = undefined` before returning. The reasoning given is sound —
a plan that survives being consumed reappears against the wrong project — but it makes the *first*
consumption final, and the consumer is a component that unmounts on a tab click.

**There is no conversation history because there is no conversation.** The Project scope is a single
`TextArea` → `PlanningSession` → plan. The launcher's scoping conversation is a different surface in
a different package and its transcript is never shown in the editor. Richard's expectation ("I don't
see any conversation history") is reasonable and currently unmet by design rather than by defect.

## The thing that makes this worse — and easier

The plan **is already durable on disk.** `pendingPlan.ts`'s own module comment says so:

> *NOTE for whoever wires the review UI: the plan is also written into
> `docs/decisions/000-initial-scope.md` at creation, so it is durable and readable without this
> seam. This is the fast path, not the only path.*

Verified — `ai-test/docs/decisions/000-initial-scope.md` exists and contains the plan and the full
transcript. **Nothing reads it back.** The recovery path was designed, documented, and never built.

## Scope

### Slice 1 — decide the lifetime

The decision to record before writing code, because it determines everything else:

| Option | Survives tab switch | Survives panel close | Survives restart | Cost |
|---|---|---|---|---|
| **A** — hoist state into `AiAuthoringPanel` | ✅ | ❌ | ❌ | trivial |
| **B** — a module-level session store keyed by project id | ✅ | ✅ | ❌ | small |
| **C** — B, plus staged candidates persisted under the project | ✅ | ✅ | ✅ | real |

**Recommendation: B now, C as slice 4.** B is a `PlanSessionStore` singleton — the same shape as the
existing `ProjectReviewStore` in `AiAssistant/review/`, which already solves this exact problem for
project review and is the precedent to copy rather than a new mechanism to invent.

C matters because a validated candidate is expensive model output and the editor can be closed by a
crash, an HMR reload, or the 1-second-quit path. But B removes 100% of what Richard hit.

### Slice 2 — move the state

`plan`, `runState`, `excluded`, `applied`, `note`, the `PlanRun` instance and the abort controllers
move into the store, keyed by `ProjectModel.instance.id`. `ProjectAuthoringView` becomes a
subscriber. The unmount cleanup **stops disposing the run** — disposal becomes explicit
(Abandon, Apply, project close).

Getting this wrong leaks a running `PlanRun` across a project switch. The store must drop entries on
project close, and `PlanRun.cancel()` must be called then.

### Slice 3 — recover the launcher plan from disk

Read `docs/decisions/000-initial-scope.md` when there is no in-memory plan and the file records one
that was never applied. This turns `takePendingScopePlan`'s destructiveness from a hazard into what
it was meant to be: a fast path with a slow path behind it.

Needs a machine-readable plan in that file — either a fenced JSON block appended by
`renderScopeRecord`, or a sidecar. **Prefer a fenced ```json block inside the existing markdown**:
the file stays one human-readable document (which is its whole point), and the parser looks for one
fence.

Also surface the **transcript** from that file as the conversation history Richard expected. It is
already written there in full.

### Slice 4 (optional, decide after 1-3) — persist staged candidates

Candidates under `.nodegx/plan/<planId>/` in the project folder, gitignored. Restores the
authored-but-unapplied set across a restart.

> **✅ Built 2026-08-03.** Not optional after all: it is phase 38's **exit criterion 7**, and no
> other task was going to deliver it.
>
> **The design in one sentence: a restart is a stop.** A restored run comes back in exactly the
> state `cancel()` leaves — staged candidates intact, anything mid-flight `failed` with AIB-001's
> Retry beside it, an unwritten doc `skippedByCancel` so AIB-009 F4's doc-pass button appears. No new
> affordance, and no branch in the panel for "this one came from disk".
>
> Resuming was the tempting alternative and it is wrong. The model session died with the process, so
> "resume" means silently re-running an operation — spending money the user did not ask to spend, on
> a screen they have just opened. Stopping is the honest report, and the two ways forward from a stop
> already exist.
>
> **One file, not a directory per plan.** `.nodegx/plan/session.json`. The task sketched
> `<planId>/` and there is no plan id anywhere in the model; inventing one buys a directory per plan
> for a store that can only ever hold the newest. That is the seventh stated mechanism in this phase
> to move under the task that built it.
>
> **Where the pieces went, and why they are split that way.** `PlanRun` imports `AuthoringSession`,
> which reaches an `AiClient`, so it cannot be constructed in the plain-Node runner where the rest of
> AIB-003 is tested. The *decisions* — which operation comes back retryable, what a hand-edited file
> may introduce, what the panel says — are pure functions in `planSessionSnapshot.ts`; `PlanRun`
> keeps only `snapshot()` and `restore()`, which assign fields. `PlanSessionSidecar` is the only
> thing that touches a filesystem, and `PlanSessionStore` reaches it through an injected seam that is
> `null` by default — which is what keeps slices 1–2's tests free of Electron.
>
> **The store subscribes to the run, and that is the whole trick.** A `PlanRun` publishes to its own
> listeners, never through the store, so a hook on `update()` would have persisted the plan, the
> exclusions and the description — everything except the authored output slice 4 exists for — and
> would have looked completely correct until someone closed the window mid-build. The store
> subscribes because it is the only thing that outlives a mount; the view unsubscribes on a tab
> click, which is where this task started.
>
> **`.nodegx/` gained a second resident**, so "create it and make sure git ignores it" moved out of
> `CodeHistoryStore` into `utils/nodegxSidecar`. A second copy of that rule is one that eventually
> disagrees with the first, and disagreeing means a scratch directory committed to somebody's
> repository.

## Acceptance criteria

1. Author a plan, switch to *This component*, switch back — plan, run state, staged candidates and
   exclusions all intact.
2. Close the Build panel entirely, reopen — same.
3. Switch to a different project and back — the first project's plan is intact and the second
   project shows no plan.
4. `PlanRun` instances do not leak: a project close cancels and drops the run.
5. A project created by the scoping wizard, opened *after* an editor restart, offers its plan and
   shows the scoping transcript.
6. **Live**: the exact navigation Richard performed, with three staged components in flight.

### Where each landed

1–3. ✅ `tests-unit/aib-003/planSessionStore.test.ts`. The view is React and the
   plain-Node runner has no DOM, so what is asserted is the thing the view was
   getting wrong — **who owns the state and what may destroy it**. Once the answer
   is "not the component", mount and unmount are structural.
4. ✅ Same file: firing `ProjectModel.instanceWillChange` cancels the run and
   keeps its staged output.
5. ✅ `tests-unit/aib-003/recoverPlan.test.ts`, round-tripped through the **real**
   `renderScopeRecord` rather than a fixture — the transcript is recovered by
   parsing the rendered form, and a fixture would let the two drift while the
   parser kept passing.
7. *(slice 4, added)* ✅ **Live, 2026-08-03**, via `scripts/aib38-live/scripted-restart.js` — two
   phases with a real `dev:stop` between them. Operation 1 staged and operation 2 held in flight at
   the moment of the kill; after the relaunch the plan is back unprompted, the staged candidate
   still has its nodes, the interrupted operation reads *"The editor closed while this was being
   authored"* with a **Retry** beside it, the unreached doc offers **Write the documentation (1)**,
   and the panel offers **Apply 1 of 3 to project**. Ten checks, all green — including the two that
   only exist because the first run failed one of them (below).
6. ✅ **Live, 2026-08-03**, via `scripts/aib38-live/scripted-stop.js`. With operation 1 staged and
   operation 2 still authoring: scope tab to *This component* and back, then the Build panel closed
   (switched to Docs) and reopened — the plan, the run and the staged candidate all intact each
   time, and the panel came back reading `Building 2 of 3 · 13s · $0.01` rather than an empty
   panel with the candidates still in memory behind it. The driver holds each turn on a promise it
   resolves over CDP, so "navigate away mid-run" is a step rather than a race.

## What slice 4's live QA found

**`Discard plan` did nothing.** Discarding empties the session; the panel's restore effect watches
for exactly that emptiness; it read the file straight back in and restored the whole build — same
plan, same note, same staged candidate. The discard's own debounced removal then deleted the file,
so disk and memory disagreed and the next keystroke wrote it back out. A user pressing Discard saw
the plan stay.

Fixed with a promise per project in the store (`consultSavedBuild`) rather than a ref in the view,
for the reason everything else in this task moved to the store: the view unmounts on a tab click and
a decision the user made has to outlive that. It is deliberately **not** cleared by `discard`, and
not cleared when a project closes.

**The driver hid it, and looked green doing so.** It clicked `Abandon` — which is what the code
calls the handler — where the button reads **Discard plan**, which is AIB-004's one vocabulary. The
miss was swallowed by a `.catch`, so a check that never ran reported the absence of a defect. Two
lessons, both cheap: assert on the label the user sees, and never let a driver's click failure be
non-fatal.

**Slice 4 was paid for by an accident before its own test ran.** Editing a source file during the
AIB-001 live run hot-swapped `PlanSessionStore` and emptied it — the trap listed below, sprung for
real — with four operations already staged against the real provider. 96KB of candidates were in
`.nodegx/plan/session.json`; reopening the project brought the whole build back and it applied
clean. The trap note below is now *"this is what slice 4 is for"* rather than *"this will waste a
live-QA session"*.

## Traps

- **Sidebar panels are hidden, not unmounted** (WFA-002, OBS-003) — so the panel-level lifetime is
  longer than it looks, and the *scope toggle* is the real unmount boundary. Do not assume a fix at
  the panel level covers the tab.
- The `arrivedWithPlan` ref uses `'unread'` as a sentinel and reads during render. Moving to a store
  must not reintroduce a double-`take` race — the comment at line 110-118 explains why two consumers
  of a destructive take silently lose.
- `ProjectReviewStore` is the precedent. Read it before designing a new store.
- HMR will hot-swap the store module and drop its contents. Since slice 4 this is survivable rather
  than fatal — the sidecar is on disk and reopening the project brings the build back — but the
  in-memory session still goes, so a run in flight is still lost. **Do not edit source while a live
  run is going.**
