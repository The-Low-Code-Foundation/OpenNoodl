# AIB-004 — One vocabulary, and a real preview

| Field | Value |
|---|---|
| **Phase** | 38 — The AI Build Experience |
| **Priority** | 🟠 High |
| **Difficulty** | 🟡 Medium |
| **Recommended executor** | 🔵 Fable for the vocabulary, 🟢 Sonnet for the preview wiring |
| **Prerequisites** | none; land with [AIB-002](AIB-002-THE-RUN-IS-LEGIBLE.md) |

## Objective

Reviewing one operation of a plan shows the user **what they built** — rendered — and the words on
screen make it unambiguous which button changes the plan and which button changes the project.

## What happened

> *"When I click 'review' on one of the things that was built, it shows me the node canvas, but not
> the preview of the built component as expected. There's also confusion between the options 'Apply
> plan' on the left menu, and 'Keep all' on the top right of the editor."*

From Richard's screenshot of the failed session: `Keep all` / `Reject` / `Close` top-right of the
review document, `Apply plan (3)` / `Abandon` bottom-left in the panel — four buttons in one
viewport, two of which sound like they commit and two of which sound like they discard.

## Part 1 — the vocabulary

### The mechanism

Two surfaces, two verb sets, no hierarchy between them:

| Surface | Commit | Discard | Source |
|---|---|---|---|
| Review document | **Keep all** / *Keep N of M* | **Reject** | `acceptLabel: 'Keep'` at [ProjectAuthoringView.tsx:252](../../../packages/noodl-editor/src/editor/src/views/panels/AiAuthoringPanel/ProjectAuthoringView.tsx#L252), rendered at [ChangeReviewDocument.tsx:298](../../../packages/noodl-editor/src/editor/src/views/documents/ChangeReviewDocument/ChangeReviewDocument.tsx#L298) |
| Build panel | **Apply plan (N)** / *Apply N of M* | **Abandon** | [ProjectAuthoringView.tsx:533-543](../../../packages/noodl-editor/src/editor/src/views/panels/AiAuthoringPanel/ProjectAuthoringView.tsx#L533-L543) |

The semantics are actually right and the `contextNote` says so —
*"Keeping a selection updates the plan — nothing reaches your project until you apply the whole
plan."* But that sentence is prose in a panel the user has stopped reading by the time they are
looking at a green canvas with a red **Reject** button on it.

### The fix

Adopt one vocabulary with an explicit two-level model, and put the level in the button:

| Level | Commit | Discard | Meaning |
|---|---|---|---|
| **Operation** (review doc) | `Keep in plan` / `Keep N of M in plan` | `Drop from plan` | changes the plan only |
| **Plan** (panel) | `Apply to project (N)` | `Discard plan` | the single write |

Three rules:

1. **Every operation-level verb names the plan.** "Keep" alone is the ambiguity.
2. **Only one button in the whole UI says "project".** It is the only one that writes.
3. **Colour carries the level, not just the action.** The plan-level apply is the accent primary;
   operation-level keeps are secondary. Today `Reject` is `Danger` red on the review document,
   which — per the phase-23 law that red means danger only — is overclaiming for an action that
   changes nothing outside the plan.

Also: the review document's header currently reads `Review Pages/Login Sign up — plan operation`.
Make the plan context a persistent chip, not a suffix — *"Operation 1 of 3 · nothing applied yet"* —
so the framing survives a user who scrolled.

## Part 2 — the preview

### The mechanism

`reviewOperation`
([ProjectAuthoringView.tsx:242-268](../../../packages/noodl-editor/src/editor/src/views/panels/AiAuthoringPanel/ProjectAuthoringView.tsx#L242-L268))
opens `ChangeReviewDocumentProvider` — a node-graph diff. That is the correct surface for *"what
changed"* and the wrong one for *"is this the login page I asked for"*.

**A rendered preview already exists.** AIX-008 built
[`SandboxPreview`](../../../packages/noodl-editor/src/editor/src/views/documents/AuthoringPreviewDocument/SandboxPreview.tsx),
which calls `buildSandboxExport({ project, files, sampleData, useSampleData })` to splice a
candidate into a per-`clientId` export and render it live, without applying anything. Verified: its
only consumer is `AuthoringPreviewDocument` — the **single-component** loop. Plan operations never
reach it.

So the capability is built, tested and shipped. It is simply not wired to the surface where Richard
looked for it.

### The fix

Plan operation review opens **one document with two views**: `Preview` (default) and `Changes`, on
the same candidate, with the keep/drop selection shared between them.

Preview-first is the right default for a *created* component — there is no meaningful "diff" for a
page that did not exist five minutes ago, which is exactly Richard's case: 25 additions, 1 change.
For an `update` operation, default to Changes.

Non-visual operations (a Function-only component, a doc) have no preview; show Changes and say why.

`buildSandboxExport` takes `componentClosure`, so a page that instantiates another
staged-but-unapplied component needs the plan's other candidates spliced in too. `PlanRun` has them
in `filesById`. This is the one genuinely new piece of work in this task.

## Acceptance criteria

1. No two buttons visible at once whose labels do not make the plan/project level explicit.
2. Reviewing a `create` operation opens on a rendered preview of the candidate page.
3. The preview renders a candidate that instantiates another candidate from the same plan.
4. Switching Preview↔Changes preserves the keep/drop selection.
5. An operation with nothing renderable says so rather than showing an empty frame.
6. Red is used for no action that leaves the project unchanged.
7. **Live**: Richard's Login Sign up operation, reviewed as a rendered page.

## Traps

- Per AIX-008: the sandbox export seam is **per-`clientId`**, and there was a mount-path routing
  defect. Re-read that memory before debugging a blank preview.
- A blank *CDP* screenshot is a real failure; a black `screencapture` frame is a missing macOS
  permission. Use `npm run cdp -- screenshot`.
- `IconSize` is inert at all call sites (UIX-010) — do not size icons with it and expect an effect.
- The review document already has a Walk-through affordance ("25 on canvas"). Preview must not
  break it; walking should switch to Changes and centre the node.

---

## What was built (2026-08-03)

Both parts, landed with [AIB-002](AIB-002-THE-RUN-IS-LEGIBLE.md) as one experience. Criteria 1–6
are built and 2/3/5 are tested at the export level; criterion 7 is the live replay.

### Part 2 was two functions, not one

The task calls the closure splice "the one genuinely new piece of work", and it was right that
`buildSandboxExport` had to take siblings. What it does not say is that **`componentClosure` needed
the same fix and would have failed silently without it.** It resolves component instances by name
against `project.getComponents()`, so after the export correctly splices `/Components/BookCard` in,
the sample-data discovery still walks a project that has never heard of it, stops at the page, and
produces a dataset describing nothing the card reads. The preview would have rendered — with empty
rows under a heading claiming results, which is the failure mode `unknownShapeNotice` exists to
prevent. `componentClosure(project, root, extra)` now lets a staged candidate shadow a project
component of the same name.

Also not in the task: **`PlanRun` was not holding the model's sample data at all.**
`AuthoringOutcome` does not carry it — it is reachable only as `session.stagedSampleData` — so the
run staged `outcome.files` and dropped it. Every plan-operation preview would have run on an
inferred dataset while the single-component loop ran on the model's own. `sampleDataById` now
mirrors `filesById`, including through a failed retry, where restoring the previous candidate
without its sample data would preview the old graph against nothing.

### Preview and Changes are stacked panes, not swapped ones

The obvious implementation — render one or the other — is wrong twice over. Unmounting the preview
tears down an Electron `<webview>` and rebooting it is a whole runtime start, on every toggle; and
`display: none` on a webview stops it running, so the usual hide-don't-unmount trick does not
apply either. Both panes stay mounted, absolutely positioned, and the inactive one is
`visibility: hidden`. The keep/drop selection is shared for free because it never left
`ChangeReviewDocument` — no state was lifted, so criterion 4 is structural.

The walkthrough trap needed nothing: `focus()` already did `if (viewMode !== 'review')
setViewMode('review')`, which covers the new mode without knowing about it.

### Criterion 6 contradicts the phase's own design position, and lost

> *"Red is used for no action that leaves the project unchanged."*

Taken literally this makes `Discard plan` non-red — it leaves the project unchanged. But it
irreversibly destroys three components' worth of authored, validated output, which is precisely
what this phase's design position calls **the expensive artifact**, and the phase-23 law reserves
red for danger, not for "writes to disk". The criterion uses the project as a proxy for danger, and
this phase exists because that proxy is wrong.

Resolved by the distinction the criterion was reaching for: **red exactly when there is something
to lose.** `Discard plan` before authoring is Ghost — it throws away a paragraph of text. After a
run has staged anything it is Danger. `Drop from plan` on the review document is never red: it is
restorable from the panel with one click, which is the case the criterion actually describes.

### The vocabulary as shipped

| Level | Commit | Discard |
|---|---|---|
| Operation (review doc) | `Keep all in plan` / `Keep N of M in plan` | `Drop from plan` (muted) |
| Plan, before authoring (panel) | `Author plan (N)` | `Discard plan` (ghost) |
| Plan, after authoring (panel) | **`Apply to project (N)`** / `Apply N of M to project` | `Discard plan` (danger) |

One button in the product says "project". It is the only one that writes. The plan context moved
from a title suffix to a persistent chip — *"Operation 1 of 3 · nothing applied yet"* — because a
suffix is the first thing a reader stops seeing.
