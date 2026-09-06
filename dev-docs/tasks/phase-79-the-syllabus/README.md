# Phase 79 — the syllabus

**Opened 2026-08-28**, at Richard's request: *"Let's make a phase to fill in the syllabus."*

## Why this phase exists

The University syllabus has **15 lessons that exist as titles with no words in them**. They are all
marked `in-writing`, and P67b recorded the prose as Richard's. The route, the data model and the
surfaces are built; the lessons are empty.

## What "filling it in" means

Each lesson needs: what it teaches, who it is for, the words a learner reads, and — where the lesson
has a practical half — a bundle that the lesson-check gate accepts.

⚠️ **This phase overlaps [phase-78](../phase-78-the-templates/) and the P75 tutorial workshop, and
the overlap is deliberate**: a syllabus lesson and a tutorial are the same shape of artefact from
different doors. Where a lesson wants a hands-on half, reuse the workshop's flow
([TUTORIAL-WORKSHOP.md](../phase-75-0.2.1-the-feedback/TUTORIAL-WORKSHOP.md)) rather than inventing a
second authoring path.

## Scope

- ✅ **T0 — closed 2026-08-28. The list is a checked-in file, not deployed data.**
  `src/lib/curriculum.json` in the **`nodegx-community`** repo (`~/vscode_projects/nodegx-community`)
  — hand-edited by design; its own note says adding a lesson changes `/university` and touches no
  `.ts`. 🔴 The 15 are **not fifteen tutorials**: a **12-lesson spine that builds one app (a virtual
  creature)**, plus *Data & backends* (2) and *Custom nodes* (1). ~9¼ hours end to end. Every spine
  lesson `needs` the one before it, so they **share one project** — see
  [RICHARD-RULINGS-2026-08-28.md](RICHARD-RULINGS-2026-08-28.md) R1 for what that costs.
- 🟡 **T1** — agree the split with Richard: which lessons are prose-only, which need a built artefact.
  **Partly ruled**: the spine stands as written (R1) and gains a responsive lesson at position 2
  (R2). The prose-only / built-artefact split itself is **not** agreed.
- ⬜ **T2** — the writing loop, per lesson: Richard supplies the substance and the voice, I build any
  artefact, check it against the gate, and publish.
- 🟡 **T3** — tag each lesson with a **level** (beginner / intermediate / advanced) and a **function
  style** (visual functions ↔ code functions). ⚠️ **Half of this already exists**: `requires` fields
  carry `logic` and `building` today. 🔴 **`experience` is used by nothing** — 0 occurrences in
  `curriculum.json` — so one of the three intake questions changes nothing a learner can see.
  ✅ **Ruled (R3): `experience` changes the voice and hand-holding *inside* a lesson, never the
  lesson set** — which the lesson format cannot express today. 🔴 **These two tags are the input to
  FIX-027 item 22**
  — Richard ruled that the three intake questions should change what a learner is recommended, and
  the recommender cannot be built until the content carries the tags. See
  [RICHARD-RULINGS-2026-08-28.md](../phase-75-0.2.1-the-feedback/RICHARD-RULINGS-2026-08-28.md) §6.

## The board — re-derived from the task files, 2026-09-06

| task | state |
|---|---|
| [SYL-001](SYL-001-THE-HAND-HOLDING-HALF.md) — the hand-holding half | ✅ **done**, slices A+B, driven |
| [SYL-002](SYL-002-THE-CHAIN-THAT-CANNOT-DRIFT.md) — `starter(N)` == `solution(N-1)` | 🟢 **BUILT 2026-09-05 (session 10), all five ACs.** `npm run lessons:chain` + `:self-test`, both in CI. **6 adjacent pairs compared and holding; 12 mutations, 0 uncaught.** 🔴 Its first run found the drift it was written to catch — in `curriculum.json`, which had never gained `it-breaks-on-a-phone`; fixed in the community repo the same session |
| [SYL-003](SYL-003-THE-CREATURE-YOU-CHOSE.md) — the avatar picker | ⬜ open, independent |
| [SYL-004](SYL-004-LESSON-1-YOUR-CREATURE-ON-SCREEN.md) — lesson 1 | 🟢 built, gated, **driven**. Prose awaits Richard |
| [SYL-005](SYL-005-LESSON-2-IT-BREAKS-ON-A-PHONE.md) — lesson 2 | 🟢 built, gated (`d656b714`). ⬜ **not driven**. Prose awaits Richard |
| [SYL-006](SYL-006-LESSON-3-POKE-IT.md) … [SYL-010](SYL-010-LESSON-7-IT-GETS-DEMANDING.md) — lessons 3–7 | 🟢 built, gated, driven (session 8). Prose awaits Richard |
| [SYL-011](SYL-011-LESSON-8-SNACKS.md) — lesson 8, `snacks` | 🟢 **BUILT, gated and DRIVEN 2026-09-06 (session 13).** First lesson with a second component; six steps, 15 conditions; both runner arms cold-opened. ⬜ Prose awaits Richard. Register: [DEFECTS-LESSON-8-FOUND.md](DEFECTS-LESSON-8-FOUND.md), 4 rows, all `NONE` |
| [LESSON-VOICE.md](LESSON-VOICE.md) | 🟡 written and **measured** across all three bundles; two calls are ⬜ Richard's |
| [DEFECTS-LESSON-2-FOUND.md](DEFECTS-LESSON-2-FOUND.md) | 5 rows, **all owner `NONE`**. D1 is the one that matters |

**Eight of thirteen spine lessons ship** (R2 made it thirteen; lesson 8 landed 2026-09-06). All are seeded onto the Learning shelf automatically — the
seed enumerates `project-examples/lessons` directories and is ledgered per folder, so a new bundle
reaches existing installs on their next launch with no allowlist to edit.

## Standing facts

- 🔴 The prose is **Richard's**, and this phase cannot proceed without him — that is its nature, not
  a blocker to work around. **Rulings so far: [RICHARD-RULINGS-2026-08-28.md](RICHARD-RULINGS-2026-08-28.md).**
- ⚠️ **`log-a-thing` still does not fit the spine.** It is built and validates clean, but it is a log
  app teaching the Visual-Function/async rule; the spine's data lesson is a snack cupboard. It is a
  good **standalone article**, not spine lesson 8. It ships on the shelf alongside the two spine
  lessons, which is fine and is not the same as being in the spine.
- 🔴 **A spine lesson may only ADD to the one before it**, and ungraded parameters may only go on
  nodes it creates. Both fall out of R1's chain. ✅ **The first is now gated** (`lessons:chain`, SYL-002);
  the second still is not —
  [SYL-005](SYL-005-LESSON-2-IT-BREAKS-ON-A-PHONE.md) explains what each one cost.
- ⚠️ Lessons are **served**, like tutorials and templates: published content reaches every existing
  install with no update.
