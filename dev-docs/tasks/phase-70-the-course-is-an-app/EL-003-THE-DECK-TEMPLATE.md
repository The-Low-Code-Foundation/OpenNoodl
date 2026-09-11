# EL-003 — The deck template

| Field | Value |
|---|---|
| **Tier** | 2 |
| **Effort** | M/L |
| **Surface** | `templates`, `editor` |
| **Rulings** | **D2** (vocabulary — blocks all copy) · **D4** |
| **Depends on** | EL-002 (the kit its logic wires to), EL-001 (the door it's reached through), EL-009 (per-slide verification) |

## The job

The PowerPoint-shaped on-ramp: `embedded://elearning-deck`, a starter an Articulate refugee can
open and understand **without learning the graph first**. It is one of two equal front doors (P3)
— familiar, deliberately, but wired to the kit so that even a click-next course reports real data.

Contents:

- A **course shell**: title page, slide sequence with next/back, progress indicator, summary page
  with score — navigation and progress wired to `nodegx.learn.*` nodes once, in the shell, so
  slide authors never touch them.
- **Slide prefab components** (template-local, meant to be copied and reshaped, per P2): title
  slide, content + media slide, question activity (rendering EL-002's bank rows), summary. Every
  colour/spacing on style-vocabulary tokens.
- **The authoring loop the template teaches by its own shape**: add a slide = duplicate a slide
  component, edit its content, add it to the sequence. The sequence is data (a list the shell
  iterates), not N hand-wired connections — so adding slide 12 does not mean wiring slide 12.

## Premises to measure before building (state the reading in this file)

1. 🔴 **The navigation substrate.** "Component Stacks for next/back" is the inherited Noodl
   pattern, and **nobody has measured it in this product for this purpose**. Establish: does the
   Component Stack node exist in the current runtime, does it survive deploy, and does it play
   well with a data-driven sequence? The alternative is page-router navigation with a `urlPath`
   per slide — which changes EL-005's packaging assumptions (deep links inside an LMS iframe) and
   leans on EL-009. **Pick from measurement, and record the loser and why.**
2. Embedded templates are authored as v1 `project.json` content and converted by
   `_adoptV2Format()` on first load — verify the template survives the round-trip with all
   components intact before authoring the real content on top.
3. `StylePresetStep` runs in the same wizard — establish whether a style preset composes with a
   template or fights it (two writers of the same tokens), before both are offered together.

## Acceptance criteria

1. **The Storyline-refugee drive, performed literally**: from the wizard, create a deck project;
   as someone who has never seen a node graph, add a new content slide (duplicate, edit text,
   extend the sequence data) and a new question (add a bank row) — **without opening a logic
   graph**. This is driven by a person or an agent role-playing the constraint, and the steps are
   the tutorial script for EL-008.
2. Next/back and the progress indicator work across ≥5 slides; the slide count and progress derive
   from the sequence data (adding a slide updates both with no other edit).
3. Completion and score reach `Report Progress` — asserted at the transport harness from EL-002,
   so the deck is proven to *report*, not just to navigate.
4. Question slides render bank rows and grade through the kit's Score node — no scoring logic in
   any template component (P2 audit, as a review step against the shipped template).
5. Every page renders clean under EL-009's page sweep; no raw hex in any template component
   (tokens throughout, the D8 spirit).
6. `validate:project` on a fresh deck project is clean, and the P66 lesson applies: **drive the
   consequence** — a slide deliberately broken (missing component reference) must make the sweep
   or validation go red, or the green means nothing.

## Traps

- 🔴 **P3 is at stake in this task's framing**: the deck must not be the "default" with the
  scenario as an afterthought. The wizard copy, template descriptions and tutorial order present
  them as two equal shapes for two jobs.
- ⚠️ Template components **fork into projects** — a fix to the shipped template reaches only new
  projects. Anything that must be fixable later belongs in the kit (P2); re-audit the split before
  shipping.
- ⚠️ Vocabulary (D2) in every visible string — "slide" is fine as an activity kind; "lesson" never
  appears.
- ⚠️ The template registers in `EmbeddedTemplateProvider`'s map with a distinguishing `category`
  so the wizard can filter — today `list()` has no filtering because there's one template.

## Out of scope

- Narrated/timeline slides — deliberately refused in v1 (README §4); an audio-per-slide port is
  acceptable, a synced timeline is not this phase.
- The scenario mode — EL-004.
- A slide-sorter / outline UI in the editor — the sequence-as-data pattern is the v1 answer.
