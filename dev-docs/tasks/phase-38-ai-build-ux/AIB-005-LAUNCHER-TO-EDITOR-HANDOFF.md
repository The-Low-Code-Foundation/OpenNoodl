# AIB-005 — The launcher → editor handoff

| Field | Value |
|---|---|
| **Phase** | 38 — The AI Build Experience |
| **Priority** | 🟠 High |
| **Difficulty** | 🟢 Easy-medium |
| **Recommended executor** | 🟢 Sonnet |
| **Prerequisites** | [AIB-003](AIB-003-THE-BUILD-SURVIVES-NAVIGATION.md) slice 1 (lifetime decision) |

## Objective

A user who has just spent ten minutes agreeing an app with the assistant lands in an editor that
**tells them, unprompted, that their plan is waiting and where it is** — rather than in an unexplained
hello-world page.

## What happened

> *"When I finished and clicked to build, it took me into the hello world app and didn't show
> anything about it building the app I'd asked for and the AI had defined. I went into the 'build'
> tab manually and saw that the plan was in there."*

He found it. Nobody else will.

## The mechanism, verified

The handover itself is built and works. `setPendingScopePlan` → module state →
`takePendingScopePlan` in `ProjectAuthoringView`, with a project-id check and a written note
explaining the plan came from the scoping conversation
([ProjectAuthoringView.tsx:128-139](../../../packages/noodl-editor/src/editor/src/views/panels/AiAuthoringPanel/ProjectAuthoringView.tsx#L128-L139)).

What is missing is any **announcement**. The only other consumer is
[`AiAuthoringPanel.tsx:178`](../../../packages/noodl-editor/src/editor/src/views/panels/AiAuthoringPanel/AiAuthoringPanel.tsx#L178):

```ts
scopePlanWaiting.current = Boolean(peekPendingScopePlan(ProjectModel.instance?.id));
```

used solely to choose which scope tab is preselected — **and only if the user opens the panel
themselves.** Nothing opens the panel, nothing marks it, nothing on the canvas mentions it. A grep
of `EditorPage` for `peekPendingScopePlan` returns nothing.

Meanwhile the project the user lands in genuinely is hello-world. Verified on disk:
`ai-test/project.json` contains exactly two components, `/#__page__/Home` and `App`.

The wizard's own copy sets the expectation correctly —
*"The plan is saved with them and waits for you — nothing is built now"*
([ReviewStep.tsx:133-136](../../../packages/noodl-core-ui/src/preview/launcher/Launcher/components/ProjectCreationWizard/steps/ReviewStep.tsx#L133-L136))
— and then the editor never mentions it again. The gap is entirely between those two screens.

## The design position

**Do not auto-build.** The wizard promises nothing is built until the user chooses, that promise is
good, and breaking it would be worse than the current gap. AIX-012's reasoning (a conversation you
cannot leave becomes an interrogation) applies equally to a build you did not start.

**Do auto-open, and do announce.** Arriving with a waiting plan is not a normal project open — it is
the continuation of something the user was in the middle of thirty seconds ago.

## Scope

### Slice 1 — open the Build panel on arrival

When `peekPendingScopePlan(project.id)` is set at editor mount, open the Build panel on the Project
scope. Not a modal — the panel, already showing the plan, with the note that is already written.

### Slice 2 — say it on the canvas

The user's eye is on the canvas, not the sidebar. A dismissible strip above the canvas:

> **Your plan is ready — 3 pages to build.** Nothing has been built yet. → *Open the plan*

`ProjectReviewBanner` in the same panel folder is the precedent for the component and its dismissal
behaviour; reuse it rather than inventing a second banner.

### Slice 3 — make the wizard's last screen land the expectation

The Review step's final button currently reads as "create the project". Given the plan is shown on
that same screen, it should say what happens next in the editor:
**Create project — the plan waits in Build.**

### Slice 4 — the empty project should not look like a mistake

A project created from a scoping conversation that agreed three pages, showing an empty Home page,
reads as a failure. Either the Home page carries a placeholder that names the plan, or the canvas
strip in slice 2 is non-dismissible until the plan is started or discarded.

**Prefer the strip.** Writing content into Home creates a component the plan may then want to
replace, which is a collision AIB-001's preflight would refuse.

## Acceptance criteria

1. Finishing the AI wizard opens the editor with the Build panel open on the Project scope, plan
   visible, nothing built.
2. A canvas-level announcement names the plan and the number of operations, and can be dismissed.
3. Dismissing it does not discard the plan.
4. Opening a project with no pending plan shows none of this.
5. Opening a *different* project while a plan is pending for the first shows no announcement, and
   does not consume the plan (the project-id check already exists — assert it).
6. **Live**: wizard → editor, without touching the sidebar, and the plan is discoverable.

## Traps

- The take is destructive and races with the panel's peek — see AIB-003. Land AIB-003's lifetime
  decision first or this task will make the race easier to hit, not harder.
- Auto-opening a panel fights the user's saved sidebar layout. Restore their layout after the plan
  is started or discarded.
- `DialogLayer` does not centre; `CoreBaseDialog` does — relevant if slice 2 becomes a dialog after
  all (it should not).

---

## What was built (2026-08-03)

All four slices, with slice 4 answered by slice 2 as the task recommends. Criteria 1–5 are built
and 2–5 are tested; criterion 6 is the live replay.

### AIB-003 moved the fact this task announces

The task's mechanism section is accurate about AIX-012 and stale about where the plan *is*. After
AIB-003, `ProjectAuthoringView` takes the handover into `PlanSessionStore` on its first mount —
so the plan lives in **two places at different times**: the launcher's module state until the Build
panel has mounted once, the store afterwards. An announcement written against `peekPendingScopePlan`
alone would have gone dark the instant slice 1 opened the panel, which is the moment it is most
needed.

`scopePlanAnnouncement(projectId)` is the single predicate over both, exported from `ScopePlanStrip`
and specced without mounting React (the split `ProjectReviewBanner` already uses). Callers do not
choose a source.

### `takePendingScopePlan` was destroying other projects' handovers

Criterion 5 asks the id check to be asserted, on the understanding that it already holds. Half of
it did not: `takePendingScopePlan` cleared module state **before** checking the project id, on the
documented reasoning that *"a stale plan that keeps offering itself is a bug that presents as a
feature"*. But the id check is what stops a plan reaching the wrong project; clearing protected
nothing, and cost everything — opening any other project first silently destroyed the handover for
the one just scoped. The clear now happens only on a match. Still window-lifetime, still consumed
exactly once, by its own project.

### Where the announcement earns its place on the canvas

`ProjectReviewBanner`'s header rules the canvas out for itself — *"Two surfaces only… never the
canvas, never a modal, never on project open"* — and that rule is right for an unsolicited offer to
a user who asked for nothing. This is the other case: the continuation of something the user agreed
to thirty seconds ago in the previous screen, landing in an otherwise-empty hello-world page. The
empty canvas is exactly what read as failure, so the canvas is where the correction has to be. Same
neutral treatment (accent rule, no colour of its own), same never-runs-anything rule.

Dismissal lives in the plan session, not component state: switching to a review document unmounts
the canvas, and an announcement that returned every time the user looked at their own work would be
worse than never showing it. It is not the plan (criterion 3, tested) — abandon and apply remain the
only two things that destroy a session.

### Slice 1 and the layout trap

`SidebarModel.instance.switch(AiAuthoringPanel_ID)` at editor mount, peeked and never taken — the
panel still owns consumption, so no second consumer races AIB-003's take. The trap says to restore
the user's layout afterwards; that is not built, deliberately. Switching the active panel is a
visible, one-click-reversible action, and forcibly switching *back* at some later moment — after the
user has navigated somewhere else on purpose — is the more surprising behaviour. Panel *width* is
already per panel per project (PNL-003) and is untouched.

### Criterion 6 — the live replay, and the two defects it found

Driven by `packages/noodl-editor/scripts/aib38-live/scripted-handoff.js`. It does not run the wizard
— that would need a real scoping conversation, and would prove the *conversation* works rather than
the *handoff*. It drives the seam the wizard hands to (`setPendingScopePlan`, exactly what the
wizard's confirm path calls) and then opens the project for real, because `peekPendingScopePlan` is
read in a **mount** effect. The project is opened once first, only to learn the id
`LocalProjectsModel` assigns on first open — project.json does not carry one.

```
ok  AIB-005 §4: a project with no pending plan shows none of this   {"strip":false,"panel":"components"}
ok  AIB-005 §5: another project's plan neither announces nor is consumed   {"strip":false,"survived":true}
ok  AIB-005 §1: the editor opens on the Build panel, plan visible, nothing built
      {"panel":"ai-authoring","strip":"Your plan is ready — 3 operations to build.",
       "planRows":true,"authorButton":"Author plan (3)","builtAnything":false}
ok  AIB-005 §2: a canvas-level announcement names the plan and its size
ok  AIB-005 §3: dismissing the announcement does not discard the plan   {"strip":false,"operations":3}
```

Both defects it found are the kind only a mount can produce.

**1. The panel switch was overwritten within the same mount.** It was in `EditorPage`'s own effect,
and `useSetupSettings` — a *later* effect — restores the saved panel unconditionally, so the sidebar
ended on `components` every time. Patching `SidebarModel.switch` to log a stack answered it in one
call (the "who closed my document" trick from the CDP notes) and named both callers, in order. The
decision now lives in `useSetupSettings`, which is the one owner of "which panel is active on open".

That placement also answers the task's own trap — *"auto-opening a panel fights the user's saved
sidebar layout; restore it afterwards"* — by never disturbing it. The `activeChanged` listener that
persists the active panel is subscribed *after* the initial switch, so an auto-open is never written
back, and no restore is needed.

**2. "Not now" meant "not ever".** Dismissing wrote `announcementDismissed` and stopped. On the path
that matters — land, read the strip, dismiss, never open the Build panel — the plan was still in the
launcher's module state, which dies with the window, so the one control whose entire promise is that
it loses nothing was the control that lost it. Dismiss now takes the handover into `PlanSessionStore`
first. Caught because criterion 3's check reads the *store*, not the strip.

**Not tested live:** the wizard's own last screen (slice 3, the button label). It is a one-line change
in `ProjectCreationWizard` gated on the plan being non-empty, and reaching it live costs a real
scoping conversation.
