# UNI-007 — the lesson beamed into the editor

**Surface:** all three · **Tier 2 (the differentiator)** · **Effort:** L · **Blocked on:** D5 (Learning
folder shape); ~~D12~~ 🔴 **struck 2026-08-14 — already ruled**

> **Corrections from [PRIOR-ART-RECONCILIATION.md](PRIOR-ART-RECONCILIATION.md) (2026-08-14):**
>
> **The spine is ruled, not pending.** LEARN-002's D1–D9 were answered **2026-08-09**
> ([CURRICULUM-DESIGN §10](../phase-17-noodl-learn/CURRICULUM-DESIGN.md)): 12 lessons, ~30 min each,
> the **pet** theme, adults *and* teenagers, Counter before Variable (Variable revealed at L6),
> code-mapping in the spine, badges in, capstone = menu with free choice, L8 on the **built-in
> backend**, Logic Builder as an optional visual track.
>
> **What actually blocks authoring** is [CURRICULUM-DESIGN §11](../phase-17-noodl-learn/CURRICULUM-DESIGN.md)'s
> three items, none a design question: (1) the two-vocabulary rule — see below; (2) **phase 60 must
> land its "signal" wording first**, or L2 is authored against a sentence already known false;
> (3) **L11 must not be authored until phase 61 lands**. Confirm phases 59/60/61 status before
> claiming a spine to project from.
>
> **Tier-1 AI projection is off by default for org-minor accounts** (D10, ruled 2026-08-14) — or
> runs on pathing metadata only, never pupil project content. LEARN-005's "verified zero external
> data transmission" is a network-level claim and no account ruling relaxes it.

## Premise

The pedagogy ruling (R8): Loom-*style* — an intake conversation works out what the learner
already knows (dev background, internet fluency, which NodeGX route they chose: visual logic vs
function nodes) and builds a personalised path — but the practical is **not text**: it is a real
project **beamed into the real editor**, because the Noodl/Backendless magic was hands-in-the-app.
"Beamed" is a pull (README, bridge constraint): the signed-in editor fetches the lesson project
from the platform and installs it in the **Learning folder** (R9/D5), where it carries metadata
normal projects don't have — completion, score, feedback — fed by MCP grading or by a human
(UNI-006).

## The lesson format is an OPEN CONTRACT — design it that way

🔴 Two producers write this format from day one: the platform's lesson generator, and — per
UNI-010 — **the user's own Claude through a local MCP**. So the format, not the platform, is the
source of truth. One versioned bundle: project files + `lesson.json` (steps, instructions,
per-step machine-checkable completion conditions, solution reference) + provenance (curated /
org / AI-generated-locally). Anything that writes a valid, verified bundle is a lesson source.
(LEARN-001's non-programmer `lesson.json` format work is the starting point — revive, don't
reinvent.)

**More of it exists than this task assumed** (verified 2026-08-14): a declarative manifest +
compiler in [`models/lessonformat.ts`](../../../packages/noodl-editor/src/editor/src/models/lessonformat.ts)
(+18 tests), a completion evaluator that is a **pure function of (conditions, context)** with
`eval()` removed in [`views/lessons/lessonevalconditions.ts`](../../../packages/noodl-editor/src/editor/src/views/lessons/lessonevalconditions.ts)
(+33 tests), a **closed 11-verb condition vocabulary**, semantic addressing (component/label/type —
never node id or DOM), progress persistence and a Learn-tab entry UI, all verified in the running
editor 2026-07-25.

### 🔴 The trap the open contract must carry

[LESSON-FORMAT.md §3](../phase-17-noodl-learn/LESSON-FORMAT.md): every lesson carries **two
vocabularies**. Prose (`title`, `body`) uses a node's **display name**; conditions (`%Type`,
`hasType`) use its **type name** — and nine differ: `Repeater`→`For Each`,
`Repeater Item`→`For Each Actions`, `Static Array`→`Static Data`, `Delay`→`Timer`,
`Array`→`Collection`, `Insert Object Into Array`→`CollectionInsert`, `Object`→`Model2`,
`Record`→`DbModel2`, `Page Router`→`Router`.

*"The failure is silent: a condition naming a display name matches nothing, and the learner is told
they have not done a step they have in fact done."* An open contract with two producers doubles the
exposure. **The format spec must state the rule and the verifier must enforce it statically**
against `node-catalog.json` — neither currently does.

## Scope (v1)

- **Platform: intake + pathing.** A short conversational intake → a path of lessons from the
  D12-ruled spine, with tier-0 personalisation first (branching: the visual-logic learner never
  meets the function-node lesson) and tier-1 AI projection (Loom's generate-once-cache pattern:
  Sonnet projects a spine concept onto this learner's context, cached per (learner, concept) —
  cents, once, forever) where branching isn't enough.
- **Editor: the Learning folder** (per D5's ruling): a launcher section the *editor process*
  writes — 🔴 never a sidecar; the launcher store is read-only to external processes (the
  electron-store lesson). Lesson projects show lesson metadata (progress, score, feedback) on
  their cards; "immutable" per D5 = platform-managed (freely editable inside — that IS the
  lesson — but not renamed/detached; reset = re-pull fresh).
- **Editor: the grading runner.** ⚠️ **Two jobs, two engines — this task conflated them.** Per-step
  completion already exists as the tested 11-verb pure evaluator (`lessonevalconditions.ts`) and is
  what the lesson runtime uses to advance a step; building a second per-step grader on MCP
  primitives would fork the very contract this task exists to keep single. So:
  - **per-step completion** → the existing evaluator. No MCP call, no model call.
  - **whole-solution validity + "did anything actually render"** → the MCP tooling
    (`validate_component`, `validate_project`, `render_report`). 🔴 Assert *drawn output*, not
    absence of errors — "clean" can mean EMPTY.

  Runs locally, on demand ("check my work"); on finish, produces the evidence bundle (consumed by
  UNI-002 bridge-events and UNI-006 submissions).
- **Feedback loop:** score + feedback (machine or human) flow back onto the Learning-folder card.

## Acceptance criteria

1. Intake → path: two learners with different intakes (visual-logic vs function-node) receive
   visibly different paths from the same spine; the projection for one (learner, concept) pair
   makes exactly one model call ever (the cache spec — Loom's proven guarantee, re-proven here).
2. A lesson pulled into the Learning folder appears in the launcher's Learning section with its
   metadata, absent from the normal picker flow per D5; reset re-pulls a clean copy.
3. "Check my work" grades a deliberately-wrong and a correct attempt differently, per step, with
   **no model call** — per-step via the existing 11-verb evaluator, whole-solution via local MCP
   tooling. (The "no model call" half is already true today; the criterion is that the two engines
   stay separate and neither is reimplemented.)
4. The format round-trips: a bundle authored by hand (no platform) installs and grades
   identically — proving the open contract before UNI-010 leans on it.
5. The full loop: completion → evidence → score+feedback on the card → UNI-002 points event.

## Not in v1

Tier-2 live AI tutoring inside lessons (the phase-17 tutor overlay work remains its own track),
certification, community-authored lessons on the platform (the format allows it; the publishing
surface waits), chaptered replay links from nodes.
