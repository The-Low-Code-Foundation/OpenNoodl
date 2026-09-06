# SYL-005 — lesson 2, "It breaks on a phone"

| Field | Value |
|---|---|
| **Prefix** | `SYL` |
| **Effort** | M |
| **Surface** | `project-examples/lessons/it-breaks-on-a-phone` |
| **Rules** | [R1](RICHARD-RULINGS-2026-08-28.md#r1--the-pet-spine-stands-as-written) (the chain), [R2](RICHARD-RULINGS-2026-08-28.md#r2--responsive-layout-becomes-a-new-spine-lesson) (this lesson exists), R3 via [SYL-001](SYL-001-THE-HAND-HOLDING-HALF.md) (`detail`) |
| **Commit** | `d656b714` |
| **State** | 🟢 **Built, gated and DRIVEN 2026-09-05** — control pair in a running editor, see [DRIVE-2026-09-05-THE-LESSON-RUNNER.md](DRIVE-2026-09-05-THE-LESSON-RUNNER.md). ⬜ **The prose is a draft awaiting Richard.** |

## What it is

Spine lesson 2, the lesson R2 ruled into existence. A strip underneath lesson 1's creature card
holding three words in a **Columns** node: three across on a laptop, one above the other on a phone,
with no second layout written by hand. Five graded steps between an intro and an outro popup.

```
Page shell  (Group)                      lesson 1's furniture, untouched
  ├ Card    (Group, contentSize)         lesson 1, untouched
  │   ├ Creature (Circle)
  │   └ Name     (Text)
  └ Board   (Group)                      ← step 2: contentHeight, maxWidth 560px, padding
      └ Care  (Columns)                  ← step 3; steps 5 and 6 set its layout
          ├ Feed  (Text)                 ← step 4
          ├ Play  (Text)
          └ Sleep (Text)
```

## 🔴 The chain is a build constraint, and it constrained this lesson twice

R1's consequence — `starter(N)` must equal `solution(N-1)` — stopped being a description the moment
there were two spine lessons. It is met, and it is met **exactly**:

> `components/Pages/Home/nodes.json` and `connections.json` in this lesson's derived starter are
> **byte-identical** to lesson 1's solution. Only timestamps differ (and `_registry.json`, which is
> [D4](DEFECTS-LESSON-2-FOUND.md#d4-low--derive_starter-ships-a-_registryjson-that-counts-the-solution)).

`lessons:check` prints the join in its own numbers, which is the cheapest place to notice it break:

```
✔ it-breaks-on-a-phone     — clean (starter 2c/6n, solution 2c/11n)
✔ your-creature-on-screen  — clean (starter 2c/3n, solution 2c/6n)
                                                            ^^^ 6n == 6n
```

**Two design rules fall out of it, and neither is obvious until you hit them:**

1. 🔴 **A spine lesson may only ADD.** A step grading a parameter the previous lesson set would have
   `derive_starter` retract it, and the learner would open lesson 2 to find lesson 1's work undone.
   This killed the most natural way to teach the subject — revising `Card`'s `sizeMode` from
   `contentSize` to `contentHeight`. The lesson adds a second box instead.
2. 🔴 **Ungraded parameters may only go on nodes this lesson creates.** An ungraded parameter on
   `Page shell` survives the subtraction into the starter, so it appears in a project the learner
   never built it in. That is why the gap between card and strip is `marginTop` on `Board` rather
   than `rowGap` on `Page shell`, which is where it belongs stylistically.

⚠️ **Neither rule is checked by anything.** `derive_starter` verifies a within-lesson invariant; the
join between lessons is verified by the diff above, run by hand.
[SYL-002](SYL-002-THE-CHAIN-THAT-CANNOT-DRIFT.md) is now unblocked — it needed two spine lessons and
there are two.

## 🔴 Three things the render found that reasoning had got wrong

All three were **measured**, and each one would have shipped a lesson that does not teach what it
says. They are in the bundle's own `docs/ARCHITECTURE.md` so the next person to touch this lesson
reads them without finding this file.

| | what I assumed | what the instrument said |
|---|---|---|
| **the breakpoint** | `smallBreakpoint` compares against the **viewport** | it compares against **the Columns node's own container** — [`Columns.tsx:205`](../../../packages/noodl-viewer-react/src/components/visual/Columns/Columns.tsx#L205), NDA-006 §3. The first draft used a viewport-shaped `600`; inside a 560-wide Board that is *always* true, so the columns folded at **every** width, laptop included, and `render_report` reported `columns: 1` at 1440px |
| **the gutters** | a Columns node fits inside its parent | it overflows by `marginX` — **4 elements at 406px inside a 390px viewport**, clipped. That is what `Board`'s padding is for ([D3](DEFECTS-LESSON-2-FOUND.md#d3-️--a-columns-node-overflows-its-parent-by-marginx-silently)) |
| **the unit** | typing `560` into **Max Width** gives 560px | `Group.maxWidth`'s `defaultUnit` is **`%`**. A learner typing `560` commits **560 per cent**, and the step would have refused work they had done correctly ([D1](DEFECTS-LESSON-2-FOUND.md#d1--create_lesson-cannot-catch-a-condition-a-learner-can-never-satisfy)) |

🔴 **The third one is the one to carry forward, because no gate can see it.** F1–F4 all read `pass`
with the wrong unit in place: F2 replays conditions against the *solution*, and the solution had
`px` because the authoring tool wrote it. The learner is the only one who would ever have found out.
The step's `body` names the unit now — in `body`, not `detail`, because `detail` is collapsible.

## ✅ A step that was designed, measured, and then deleted

Richard's R2 entry says `teaches: layout, responsive sizing, alignment`. The alignment step was
going to be *"set `Care`'s **Justify Content** to Center"*.

**It changed nothing.** Two `render_report` runs either side of it, same two viewports, identical
pixels and identical numbers. It is `align-items` on the cross axis and the column items are
auto-height, so there is nothing for it to centre
([D5](DEFECTS-LESSON-2-FOUND.md#d5-low--columnsjustifycontent-is-inert-for-auto-height-items)).

The step was deleted rather than shipped. ⬜ **So `teaches` in the curriculum entry needs correcting
when it is added** — this lesson teaches layout, responsive sizing and breakpoints, and does not
teach alignment.

## Measurements — do not re-derive

| gate | reading |
|---|---|
| `create_lesson` | **F1 pass, F2 pass, F3 pass, F4 pass.** 5 graded steps. 🔴 **`allow_unrendered` NOT used** |
| `check_lesson` (re-score after a hand edit to `lesson.json`) | F1–F4 pass, 5 graded steps |
| `lessons:check` | **exit 0**, 3 bundles, 6 projects, 14 components, 54 nodes |
| the subtraction, arithmetically | solution **11** nodes − starter **6** = the five the learner builds: `Board`, `Care`, `Feed`, `Play`, `Sleep` |
| `render_report` @ `1440x900` | `columns: 3, rows: 1`, `overflowingCount: 0` |
| `render_report` @ `390x844` | `columns: 1, rows: 3`, `overflowingCount: 0` |
| `tests-unit/rel-012` + `tests-unit/tut-004` | **109 passed, 7 suites, exit 0** — including AC2's *"seeds EVERY shipped bundle"*, which enumerates the directory and therefore graded this one |
| ⚠️ `typecheck` / `test:ci` | **not run, and not needed** — no TypeScript changed |

⚠️ **One spec failed first, correctly**: `rel-012/shipped-lessons-reach-the-artefact` asserts nothing
under `project-examples/lessons` is untracked, and the new bundle was a "stowaway" until `git add`.
A bundle that is not in git reaches a local build and no clone. Worth knowing before the next lesson.

## 6. ⬜ What was NOT done, and what it costs

🔴 **The lesson has not been driven in a running editor.** Lesson 1 was
([SYL-004](SYL-004-LESSON-1-YOUR-CREATURE-ON-SCREEN.md)), so this is a gap against the standard that
task set, and it is stated rather than implied.

**Why:** the box was at **load average 8.32** with `simdiskimaged` pegged at 100%, against a standing
instruction not to pile heavy work onto a shared machine, and four peer sessions were live on this
checkout. A dev stack is three webpack watchers plus Electron.

**What the drive would still add, honestly scoped** — the two risks it was wanted for were both
answered from source instead, which is why this is a gap rather than a blocker:

| | answered? |
|---|---|
| does a learner typing `560` produce `{value:560,unit:'px'}`? | ✅ **yes, from source** — `NumberWithUnits.updateValue` commits `{value, unit ?? defaultUnit}`, and the fix is in the prose |
| how does the condition render as prose? | ✅ **yes, from source** — `describeCondition` prints the raw type name ([D2](DEFECTS-LESSON-2-FOUND.md#d2-️--the-learner-is-shown-a-raw-type-name)) |
| does the bundle install through the real model? | ✅ **yes** — `tut-004/the-real-bundle-installs` + `rel-012` AC2, 109 green |
| **does the runner grade a 5-deep node path in a live project?** | ⬜ **NO.** Lesson 1's deepest path is 4 segments; this lesson's is 5 (`…:#Board:#Care:#Feed`). Nothing has resolved one against a live editor |
| **the negative control** — does the untouched starter refuse to tick? | ⚠️ **only structurally.** `derive_starter` replays every graded step and refuses to write if any still holds, and F2 checks it again. Not observed on screen |

**The drive to run**, in one line: install the bundle, open step 2, check the untouched starter reads
*not complete*, add `Board`, check again, and read step 3's condition prose to confirm D2.

## What is Richard's

1. 🔴 **The step prose.** Seven bodies and five `detail` blocks, drafted so he is editing rather than
   staring at a blank page.
2. **The `description`** — his R2 draft with *"size gets negotiated by groups, direction and
   alignment"* changed to *"width gets negotiated with a limit, a share and a breakpoint"*, because
   the lesson does not teach alignment.
3. **The badge**, currently `Holds Its Shape`.
4. ⬜ **[LESSON-VOICE.md](LESSON-VOICE.md)** §3 (em dash — lesson 1 is the outlier, not the standard)
   and §6 ("do we say node?").

## ⬜ The curriculum entry does not exist yet

`curriculum.json` lives in the **separate `nodegx-community` checkout**
(`~/vscode_projects/nodegx-community/src/lib/curriculum.json`) and still has `poke-it` at spine
position 2. R2's insert is **two edits, not one**: the new entry, and `poke-it`'s `needs` moving from
`your-creature-on-screen` to `it-breaks-on-a-phone`. Spine 12 → 13; curriculum 15 → 16.

⚠️ **Not done here on purpose** — it is another repo, the `description` is Richard's, and the
`teaches` line needs the correction above. **The editor's Learning shelf does not depend on it**: the
seed enumerates `project-examples/lessons` directories, so this lesson already ships. `curriculum.json`
is what puts it on the served `/university` page.

## Traps carried out

- 🔴 **A defect the render finds is worth three defects reasoning finds.** All three wrong
  assumptions above were confidently held and each survived until `render_report` disagreed. The
  breakpoint one is the sharpest: the *graph was valid*, every gate passed, and the lesson taught the
  opposite of its own title.
- 🔴 **`grep` skipped `lessonseed.ts` silently.** A plain `grep -n SHIPPED_LESSONS_REPO_PATH` over it
  returned nothing; `grep -an` returned seven hits. The absence read as "the seed has no path
  constant", which would have led to inventing an allowlist that already existed.
- ⚠️ **A corpus grep answered the wrong question.** Sampling real projects for `maxWidth` value
  shapes returned 60+ hits, all `{value,unit:'px'}` — and every one was written by an MCP server or
  an export fixture. It is the wrong population for "what does the *panel* write", and it would have
  confirmed the bug rather than finding it.
- ⚠️ **`cd` persists between tool calls**, and a later relative path silently resolved inside the
  lesson directory rather than the repo root. It happened to be correct; verify with `git status`
  rather than assuming.

## ✅ Driven 2026-09-05 — §6's open rows are now closed

Full method and caveats: [DRIVE-2026-09-05-THE-LESSON-RUNNER.md](DRIVE-2026-09-05-THE-LESSON-RUNNER.md).

| §6 asked | answer |
|---|---|
| **does the runner grade a 6-deep node path in a live project?** | ✅ **YES.** Step 3 grades `…:#Home:#Page shell:#Board:#Care:#Feed` (and `#Play`, `#Sleep`) and the solved copy completes |
| **the negative control** — does the untouched starter refuse to tick? | ✅ **YES, observed on screen.** Five empty circles, no completion |
| **`paramsEqual` against a `{value, unit}` object** | ✅ **YES** — `maxWidth 560px` and `smallBreakpoint 480px` both grade |

⚠️ **A defect this lesson's step 1 surfaced**: the condition prose names the parameters it grades but
not the values they must equal — [J4](DEFECTS-THE-RUNNER-DRIVE-FOUND.md#j4--a-condition-names-the-parameters-it-grades-but-not-the-values).
