# Richard's rulings — 2026-08-28

Captured in conversation, at the opening of this phase. **None of these is built.** Each records
what he decided, and — where the ruling costs something that is not obvious — what it costs.

---

## R1 — The pet spine stands as written

> *"All good."*

Asked whether the twelve-lesson spine in `curriculum.json` (a virtual creature, each lesson
motivated by the problem the last one left) should stand or be rewritten before we build against it.

✅ **It stands.** Building lesson 1 commits the series to the creature, and that is accepted.

**Consequence — the chain is now a build constraint, not a description.** Every spine lesson `needs`
the one before it and they share one app, so:

> `starter(N)` must equal `solution(N-1)`.

`derive_starter` subtracts a lesson's own steps from its own solution, which is compatible with
that — but nothing asserts the join, and a spine that drifts apart at lesson 6 fails silently and
late. 🔴 **Build the equality check before lesson 3, not after lesson 12.**

---

## R2 — Responsive layout becomes a new spine lesson

> *"new spine lesson"*

The workshop's flagship idea (*"basic CSS … help people understand responsive UI design"*) had **no
home in the syllabus at all** — layout is taught in none of the fifteen lessons. Asked whether it
should be a new spine lesson or its own short track alongside Data and Custom nodes.

✅ **New spine lesson.**

**Proposed slot: position 2**, between `your-creature-on-screen` and `poke-it` — "a UI is a tree of
things with properties" is the sentence that "…and here is why your fixed widths break" answers.

⬜ **Draft entry, awaiting Richard's words.** The `description` is learner-facing prose on a
**served** page, so the wording is his; this is a shape to edit, not a decision to re-take.

```json
{
  "slug": "it-breaks-on-a-phone",
  "title": "It breaks on a phone",
  "description": "The card looks right on your screen and wrong on a phone. A fixed width is a promise you cannot keep — size gets negotiated by groups, direction and alignment instead.",
  "teaches": "layout, responsive sizing, alignment",
  "estimatedMinutes": 30,
  "nodes": ["Group", "Columns"],
  "needs": "your-creature-on-screen",
  "state": "in-writing"
}
```

⚠️ **The insert is two edits, not one**: the new entry, and `poke-it`'s `needs` moving from
`your-creature-on-screen` to `it-breaks-on-a-phone`. Spine 12 → 13; curriculum 15 → 16.

---

## R3 — `experience` changes the voice, not the lesson set

> *"Change the voice and level of hand holding throughout the tutorial, don't need to explain to an
> intermediate user how to access the node picker."*

The intake asks three questions. Two of them (`logic`, `building`) are used by `requires` fields in
`curriculum.json`. **`experience` (none / some / fluent) is used by nothing** — zero occurrences in
the curriculum file — so a third of the intake currently changes nothing a learner can see.

✅ **It must not add or remove lessons.** It changes how much hand-holding the step prose does.

### 🔴 This is not expressible in the lesson format today

[`lessonformat.ts`](../../../packages/noodl-editor/src/editor/src/models/lessonformat.ts) —
`LessonStepDef` has **one `body`**, a single Markdown string. No audience, no variant, no verbosity.
Grepped: `experience`, `verbosity`, `audience`, `variant` appear in neither `lessonformat.ts` nor
`lessonbundleread.ts`. So R3 needs a format change, and there are three ways to take it:

| | approach | verdict |
|---|---|---|
| (a) | two whole bundles per lesson | 🔴 **no** — doubles authoring and the two drift; the spine already has a drift problem (R1) |
| (b) | per-step `body` keyed by answer | ⚠️ workable, but every step is authored 2–3 times |
| (c) | **one `body` plus an optional `detail`** — the hand-holding half, rendered collapsed or expanded | ✅ **recommended** |

(c) is one authored text, no drift, and the learner can always open the detail regardless of what
they answered. *"Open the node picker with the + button, top left"* lives in `detail`; the step's
actual instruction lives in `body`.

### 🔴 And the answer has to cross a process boundary it currently cannot

`experience` is answered on the **platform** (intake). The hand-holding is rendered by the
**editor's** lesson runner. Nothing carries the answer between them.

Do **not** solve this by shipping the answer inside the bundle. `curriculum.ts` records D17's
invariant — *a lesson stays installable from a local directory with no origin* — and a bundle that
carries a particular learner's preference breaks it.

> ✅ **The editor holds the preference; the bundle carries both halves.** The runner picks which to
> expand. A bundle installed from a local directory with no origin still works, and still contains
> everything.

⬜ **Open:** whether the editor asks once, or reads the platform answer when the learner is signed
in and treats it as a default they can change. Not ruled.

---

## What this unblocks, and what it does not

- **T0 is closed** — see [README](README.md). The list was never on production only.
- **T1 is partly ruled**: the shape is agreed, the split of prose-only vs built-artefact is not.
- **T3 is half-answered**: `experience` is ruled (above). A `level` tag is still unwritten —
  🔴 note that the spine's **order already encodes difficulty**, so a per-lesson `level` may be
  redundant on the spine and only meaningful on the tracks. Do not add the field before deciding
  what reads it.
- 🔴 **Still needed from Richard before lesson 1 can be built**: the workshop brief for
  `your-creature-on-screen` (who it's for / what they'll have built / the 3–6 things they must
  understand / where people get stuck / what it deliberately will not cover).
