# Phase 79 — next session

**Written 2026-08-28, end of session 3.** Read [README](README.md) and
[RICHARD-RULINGS-2026-08-28.md](RICHARD-RULINGS-2026-08-28.md) first; this file is the working
state, not the phase.

---

## 1. Where this actually stands

**Lesson 1 is built.** Session 3 got the brief out of Richard and built against it the same day.

> `project-examples/lessons/your-creature-on-screen` — committed, F1–F4 all pass, `lessons:check`
> green over both bundles, and **driven in the editor with a control pair**.
> Full write-up: [SYL-004](SYL-004-LESSON-1-YOUR-CREATURE-ON-SCREEN.md).

**SYL-001 is finished** (slice A + B, driven). **SYL-002 is still blocked** — it needs *two* spine
lessons and there is one. **[SYL-003](SYL-003-THE-CREATURE-YOU-CHOSE.md) is new and open**: the
avatar picker Richard asked for.

🔴 **The syllabus is still 15 lessons of which 14 are titles.** One built lesson is a shape to
copy, not progress against the spine.

## 2. 🔴 The two things waiting on Richard

**(a) The step prose for lesson 1.** Six bodies and four `detail` blocks are drafted and shipping
in the bundle. They are *mine*, and the workshop's own split says the words that ship are his.
This is an edit pass over working text, not a blank page. Also his: the `description`, the badge
(`First Light`), and whether the creature gets eyes.

**(b) The `description` for `it-breaks-on-a-phone`** — R2's new spine lesson at position 2. Its
mechanics are fully pre-cleared (§4a) and it is a two-line data edit the moment the wording lands.

## 3. 🔴 What his stuck-list said about the curriculum

Asked where beginners get stuck, Richard named five things. Mapped against the spine, **only one is
lesson 1's**. The other four are the finding:

| what he named | where the spine teaches it |
|---|---|
| 1. Component system, values/signals across canvases | **lesson 10 of 12** — `build-your-own-node` |
| 2. How signals work | lesson 2 — `poke-it` |
| 3. Groups, placement, dimensions | lesson 1 + the new `it-breaks-on-a-phone` |
| 4. Page router and navigating | lesson 9 — `more-than-one-room` |
| 5. States, Variable | lesson 3 (`Counter`) and lesson 5 (`States`) |

- 🔴 **The thing he named first is taught tenth.** He described it with more difficulty than
  anything else on the list ("the psychological abstraction"). The spine *earns* the position —
  you cannot motivate encapsulation before there is something worth encapsulating — but a learner
  hits that wall in real work long before lesson 10. **Richard's call, not an engineering one.**
- 🔴 **`Variable` appears in no lesson at all.** It exists (`displayNodeName: 'Variable'`,
  `noodl-runtime/src/nodes/std-library/data/variablenode2.ts:45`) and he named it in his top five.
  The syllabus never shows it.

## 4. The order to take it

1. **Richard's edit pass on lesson 1's prose.** Nothing blocks on it — the bundle ships and gates
   today — but it should not reach a learner in my words.
2. **R2's curriculum edit**, when its `description` lands. Two edits: the new entry, and `poke-it`'s
   `needs` moving onto it. Spine 12 → 13.
3. **Lesson 2** (`it-breaks-on-a-phone` or `poke-it`, depending on 2). ⚠️ `poke-it` uses **Button**,
   whose type name is **`net.noodl.controls.button`** — the display name `Button` is the
   *deprecated* node and a condition using it passes while matching nothing.
4. **[SYL-002](SYL-002-THE-CHAIN-THAT-CANNOT-DRIFT.md)**, the moment two lessons exist.
5. **[SYL-003](SYL-003-THE-CREATURE-YOU-CHOSE.md)** whenever — it is independent, and lesson 1 is
   deliberately built so it upgrades rather than depends.

## 4a. Session 3 — checked, so nobody re-derives it

- ✅ **R2's insert is mechanically pre-cleared and is still exactly two edits.** Nothing hardcodes
  the spine order (the only spine slug outside `curriculum.json` is a doc comment in
  `api/v1/me/path/project/route.ts:14`). No spec breaks on 12 → 13: `uni022-syllabus.test.ts` uses
  `toBeGreaterThanOrEqual(12)` and derives its totals from the file. The draft entry's key set
  matches every unconditional spine lesson. Both node names are real — ⚠️ `Columns` is keyed
  **`displayName`**, not `displayNodeName`, so the narrower grep reads as "no such node". And
  `omitLesson` repairs the chain **by `needs`, never array position**, which is also the live code
  confirming SYL-002 AC4 was specified right.
- ✅ **Lesson 1's measurements** are in [SYL-004](SYL-004-LESSON-1-YOUR-CREATURE-ON-SCREEN.md).
  Do not re-run them to "confirm"; re-run them if you change the bundle.

## 5. 🔴 A product defect the drive found — this is work

**Pressing "Check my work" on an incomplete step removes the instructions.** The popup, body and
`detail` disclosure together, is taken out of the DOM (`details: 0`, `[data-template=popup]: 0`);
the only way back is knowing to click the step in the timeline. And the check produces **no new
visible feedback** — the "Looking for…" line was already on screen. So pressing the button loses
your instructions and tells you nothing.

It is the **runner's** behaviour, not lesson 1's, so `log-a-thing` has it too. ⬜ Unfixed.

## 6. Traps carried out of this session

- 🔴 **`create_lesson` refuses on an *unchecked* class, not only a failed one.** The first call
  returned `F4: not-checked` and wrote nothing — that server could not find the render harness.
  Running it from the server bound to a **source checkout** answered F4 and it wrote.
  ✅ **Do not reach for `allow_unrendered`**: it converts "unanswered" into "unanswerable", and F4
  is the class most likely to reach a learner.
- 🔴 **`in-writing` gates nothing.** `/university` (`page.tsx:71`) renders `lesson.description` for
  every lesson whatever its state; the state only tints a badge. **A placeholder written by anyone
  but Richard is live prose on a public page the day it lands.** This is why R2 waits on wording
  and not merely on tidiness.
- 🔴 **Prose uses display names; conditions use type names.** `Button`, `Variable`, `Text Input`,
  `Checkbox`, `Radio Button` and `Cloud Function` are all real type names **of the deprecated
  node**, so the condition passes while the node the learner drags out is `net.noodl.controls.button`
  or `Variable2`. Lesson 1 dodged this entirely — `Group`, `Text` and `Circle` are identical in both
  vocabularies — **lesson 2 will not.**
- ⚠️ **`${PIPESTATUS[0]}` is empty in zsh.** `npm run lessons:check | tail` reports no exit code at
  all. Redirect to a file and read `$?`.
- ⚠️ **The lesson installer cannot be CDP-driven** — it goes through a native file dialog. Install
  by copying into `~/Library/Application Support/NodeGX/Learning/<id>/` and adding an entry to
  `learning_folder.json`, then `cdp reload` (which lands on the launcher, where Learning lives).
  That path is already specced by `tut-004/the-real-bundle-installs.test.ts`.
- ⚠️ **The header comment on `tut-004/the-real-bundle-installs.test.ts` says `log-a-thing` "is the
  only" bundle.** No longer true. Left alone — another task's file — but it will mislead.
- 🔴 **A field is not shipped until something reads it.** Still live in this format:
  `suggestedNodes` → `data-suggested-nodes` → `getCurrentSuggestedNodes`, no callers. Lesson 1 uses
  `detail` (which renders) and not `suggestedNodes` (which does not).
