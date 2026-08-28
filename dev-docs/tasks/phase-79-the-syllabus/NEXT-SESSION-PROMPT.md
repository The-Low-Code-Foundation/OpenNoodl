# Phase 79 — next session

**Written 2026-08-28, end of session 2.** Read [README](README.md) and
[RICHARD-RULINGS-2026-08-28.md](RICHARD-RULINGS-2026-08-28.md) first; this file is the working
state, not the phase.

---

## 1. Where this actually stands

**T0 is closed.** The phase opened believing the syllabus had to be scraped off production. It is a
checked-in file:

> `src/lib/curriculum.json` in **`~/vscode_projects/nodegx-community`** — a *separate checkout*.

🔴 **It is not fifteen tutorials.** A **12-lesson spine that builds one app (a virtual creature)**,
plus *Data & backends* (2) and *Custom nodes* (1). ~9¼ hours. Every spine lesson `needs` the one
before it and they **share one project**.

**Richard ruled all three open questions** (R1/R2/R3 in the rulings file). **SYL-001 is finished —
slice A and slice B, both built, gated and committed.** **SYL-002 is written and deliberately
blocked.**

🔴 **Nothing on this phase's list is engineerable any more.** Every remaining item waits on
Richard's words. Session 2 closed the last one that did not.

## 2. 🔴 The one thing everything else waits on

**Richard's brief for lesson 1, `your-creature-on-screen`.** No amount of engineering substitutes
for it — the phase's own standing fact is that the prose is his. The form is in
[TUTORIAL-WORKSHOP.md](../phase-75-0.2.1-the-feedback/TUTORIAL-WORKSHOP.md):

```
WHO IT'S FOR:
WHAT THEY'LL HAVE BUILT BY THE END:
THE 3-6 THINGS THEY MUST UNDERSTAND:
WHERE YOU'VE SEEN PEOPLE GET STUCK:
ANYTHING IT SHOULD DELIBERATELY NOT COVER:
```

⚠️ **Do not start building lesson 1's app before this arrives.** R1 committed the series to the
creature, but not to any particular first screen.

## 3. What is ready and needs no more thought

### `detail` is live, and so is the preference behind it — author into it from lesson 1

`body` says what to do; `detail` says where the button is, as a disclosure open by default — and
since slice B, **the learner collapsing one is remembered**, so every later step comes up the way
they last left it. That is Richard's R3 ruling ("*don't need to explain to an intermediate user how
to access the node picker*") as far as it can go without the platform's `experience` answer being
able to reach the editor. 🔴 **Nothing about the authored prose changes when that day comes** — the
answer only seeds the same key.
Documented in [LESSON-FORMAT.md §4a](../phase-17-noodl-learn/LESSON-FORMAT.md) and in `noodl-mcp`'s
authoring brief. 🔴 **This is why the field was built first**: lesson 1 is the most beginner-facing
lesson in the curriculum, and splitting one `body` later is a re-cut of Richard's words.

### The measurements — do not re-derive them

| gate | reading |
|---|---|
| `test:ci` | **2889 specs, 4 failures @ seed 86276** — all four **AIX-006 style vocabulary**, the recorded floor, **by name**. ⚠️ The floor is 4; the suite size has moved **2863 → 2875 → 2887 → 2889**. |
| slice A / slice B / the drive's fix | **+12 / +12 / +2**, each named in the run's `[spec-start]` lines |
| 🔴 two mutants, both killed what they aimed at | echo guard removed → 5 failures @ seed 47904, the fifth the negative control. Re-apply removed (the pre-drive behaviour) → 6 @ seed 01422, the floor **plus both new specs**. |
| `test:main` | **375 suites / 6254 tests / 0 failures, exit 0.** ⚠️ An earlier run in session 2 had 1 red — `BLD-004 reasoningChannel`, a timing spec under load from a peer's editor stack. Green alone and green here. |
| `typecheck:editor`, `typecheck:editor-tests`, `typecheck:mcp` | exit 0 |
| `lessons:check` | exit 0, `log-a-thing` clean |

⚠️ **`test-results.json` records failures ONLY.** Grepping it for a new spec's name returns 0
whether the spec passed or never ran. The `[spec-start]` lines in the run log and the total-count
delta are the evidence that a spec executed; that file is not.

⚠️ **`typecheck:editor` does NOT cover `packages/noodl-editor/tests/`.** `typecheck:editor-tests`
is the gate that grades a spec there, and `tests/` is the **Electron/jasmine** suite (`test:ci`) —
it does **not** use jest matchers. `toHaveLength` and `toContainEqual` do not exist there; use
`.length).toBe(n)`.

## 4. The order to take it

1. **Lesson 1**, when the brief lands. Build the app, draft steps into `body` + `detail`, hand the
   prose back to Richard.
2. **R2's curriculum edit** — the responsive lesson, `it-breaks-on-a-phone`, at spine position 2.
   ⬜ **Richard has not written its `description` yet**; a draft is in the rulings file. ⚠️ It is
   **two edits**: the new entry, and `poke-it`'s `needs` moving onto it. Spine 12 → 13.
3. **Lesson 2.**
4. **[SYL-002](SYL-002-THE-CHAIN-THAT-CANNOT-DRIFT.md)**, the moment two lessons exist — not
   before, and not after lesson 12.

✅ **Slice B was driven at the end of session 2, and the drive found a defect eleven green specs
had not.** The preference was being applied *per step at parse time*, and a lesson parses every
step in one pass — so a learner who collapsed on step 3 still met step 4 expanded until they
reopened the lesson. Fixed, and graded by two new specs that both fail on the old behaviour.
🔴 **The shape worth carrying: the round-trip spec re-rendered between the cause and the effect,
which is exactly what the app does not do.** A spec that rebuilds the world in the middle cannot
see a staleness bug.

## 5. Traps carried out of this session

- 🔴 **A field is not shipped until something reads it.** This format contains a live example:
  `suggestedNodes` → `data-suggested-nodes` → `LessonModel.getCurrentSuggestedNodes`, **no callers**,
  and the MCP brief has to warn models off it. SYL-001 ships a native `<details>` for exactly this
  reason — no runner, no preference, works the day it lands.
- 🔴 **The verifier and the sink are a PAIR.** `safeLessonUrl` drops an unsafe scheme; the verifier
  *tells the author*. A field added to one half has half the protection, and the half that goes
  missing is the one nobody notices — a link that silently stopped working.
- 🔴 **`log-a-thing` does not fit the spine.** It is clean and shipped, but it is a log app teaching
  the Visual-Function/async rule; the spine's data lesson is a snack cupboard. It is a standalone
  **article**, not spine lesson 8. Do not retrofit it.
- ⚠️ **The Markdown link grammar truncates a URL at the first `)`.** `javascript:alert(1)` reads as
  `javascript:alert(1`. A scheme fixture with parens grades the link parser, not the refusal.
- ⚠️ **`experience` is answered on the platform, rendered by the editor, and nothing crosses that
  gap.** Do not close it by shipping the answer inside a bundle — D17 requires a lesson stay
  installable from a local directory with no origin.
- ⚠️ **`timeout` does not exist on macOS.** `timeout 900 npm run …` exits **127**, which reads
  exactly like a failing suite.
