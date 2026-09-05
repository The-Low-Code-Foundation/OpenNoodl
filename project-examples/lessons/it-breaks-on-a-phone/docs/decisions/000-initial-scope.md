# 000 — Initial scope

_Recorded 2026-09-05, from the scoping conversation held before this project was authored._

## What was asked for

> Build spine lesson 2, "It breaks on a phone" — the new spine lesson Richard ruled in at
> [R2](../../../../dev-docs/tasks/phase-79-the-syllabus/RICHARD-RULINGS-2026-08-28.md). His draft entry:
> "The card looks right on your screen and wrong on a phone. A fixed width is a promise you cannot
> keep — size gets negotiated by groups, direction and alignment instead." Teaches layout,
> responsive sizing, alignment. Nodes: Group, Columns. 30 minutes.

## What was decided

**The app.** Lesson 1's creature card, plus a strip underneath it holding three words in a Columns
node. Three columns across on a laptop, one column on a phone, with no second layout written by
hand.

**Who it is for.** Somebody who has finished lesson 1 and has never thought about layout.

**Pages.** Home — the only page, and the same one lesson 1 ends on.

**Backend.** None.

**Rules for this project.** See `docs/CONVENTIONS.md`. The load-bearing one is that this lesson may
only *add*, because its starter has to equal lesson 1's solution.

## What was considered and rejected

- **Teach `sizing: autoFit` + `minWidth` rather than a breakpoint** — rejected: the better habit,
  but the lesson's own title asks for an explicit *"below this width, use that layout"*. Left as a
  follow-up.
- **Grade `Care`'s Justify Content, to cover "alignment"** — rejected on a measurement: setting it
  to `center` changed nothing on screen at either viewport. It is inert for auto-height column
  items, and a step that sets an inert control teaches a lie.
- **Revise `Card`'s `sizeMode` to `contentHeight`** — rejected: a revision, not an addition.
  `derive_starter` would clear the parameter lesson 1 graded, and the learner would open lesson 2
  to find lesson 1's work undone.
- **A step that sets a deliberately wrong fixed width so the learner can watch it break** — good
  pedagogy, structurally impossible: every graded condition is replayed against the solution, and
  the solution holds one final value per parameter. A step that asks for a value a later step
  changes cannot pass F2. The breakage is described in the opening popup instead.
- **Style the three tiles** — rejected: every parameter would be one no step asks for, so the
  learner's result would not match the answer.

## Deliberately out of scope

- Events and clicking — `poke-it`, the next lesson. This lesson deliberately ends with three words
  that do nothing, which is that lesson's opening problem.
- State and variables — `it-forgets-you`.
- Absolute positioning. This lesson is an argument against placing things by coordinate.
- `autoFit` reflow. One reflow mechanism per lesson.

## Still open

> TODO: The learner-facing step prose is drafted by Claude and must be edited by Richard before it
> ships, along with the `description` and the `Holds Its Shape` badge.
> TODO: This lesson has no entry in `curriculum.json` yet — that file lives in the separate
> `nodegx-community` checkout, and adding it is two edits, not one: the new entry, and `poke-it`'s
> `needs` moving from `your-creature-on-screen` to `it-breaks-on-a-phone`.
> TODO: `teaches` in Richard's draft entry says "alignment", which this lesson does not teach.
