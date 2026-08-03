# AIB-003 — The build survives navigation

| Field | Value |
|---|---|
| **Phase** | 38 — The AI Build Experience |
| **Priority** | 🔴 Critical — alpha blocker |
| **Difficulty** | 🟠 Medium-hard (a lifetime change, not a bug fix) |
| **Recommended executor** | 🔵 Fable for the lifetime decision, 🟠 Opus to build it |
| **Prerequisites** | none |
| **Status** | ✅ **BUILT 2026-08-03** — slices 1–3. Slice 4 (persist candidates to disk) not done. Criteria 1–5 covered; criterion 6 (live) owed. |

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
6. ⏳ **Owed.**

## Traps

- **Sidebar panels are hidden, not unmounted** (WFA-002, OBS-003) — so the panel-level lifetime is
  longer than it looks, and the *scope toggle* is the real unmount boundary. Do not assume a fix at
  the panel level covers the tab.
- The `arrivedWithPlan` ref uses `'unread'` as a sentinel and reads during render. Moving to a store
  must not reintroduce a double-`take` race — the comment at line 110-118 explains why two consumers
  of a destructive take silently lose.
- `ProjectReviewStore` is the precedent. Read it before designing a new store.
- HMR will hot-swap the store module and drop its contents. That is not a real-world failure but it
  will waste a live-QA session if unexpected.
