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
