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
