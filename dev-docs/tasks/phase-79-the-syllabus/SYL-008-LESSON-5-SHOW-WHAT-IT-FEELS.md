# SYL-008 — lesson 5, "Show what it feels"

| Field | Value |
|---|---|
| **Prefix** | `SYL` |
| **Effort** | M |
| **Surface** | `project-examples/lessons/show-what-it-feels` |
| **Rules** | [R1](RICHARD-RULINGS-2026-08-28.md#r1--the-pet-spine-stands-as-written) (the chain), R3 via [SYL-001](SYL-001-THE-HAND-HOLDING-HALF.md) (`detail`), [LESSON-VOICE.md](LESSON-VOICE.md) |
| **State** | 🟢 **Built, gated and DRIVEN 2026-09-05** — control pair in a running editor, see [DRIVE-2026-09-05-THE-LESSON-RUNNER.md](DRIVE-2026-09-05-THE-LESSON-RUNNER.md). ⬜ **The prose is a draft awaiting Richard.** |

## What it is

Spine lesson 5, the first lesson in which a value is *transformed* on its way to the screen. A
`Caption` (**String Format**) turning the poke count into a sentence, a `Story` text showing it, and
an `Excitement` (**Expression**) turning the same count into the creature's diameter. **Five graded
steps** between an intro and an outro popup.

```
Card                                     lesson 1
  ├ Creature (Circle)                     lesson 1 — Size now arrives on a wire   ← step 6
  ├ Name / Reaction / Score               lessons 1, 3, 4 — untouched
  └ Story    (Text)                       ← step 3 — NO text parameter
Caption      (String Format)              ← steps 2, 3, 4
Excitement   (Expression)                 ← steps 5, 6
```

## 🔴 The finding: `Expression`'s `As Number` / `As String` / `As Boolean` are dead for wiring

The lesson's first build put `Excitement.asNumber` into `Creature.size`. **The creature vanished
completely** — and every gate stayed green: `create_lesson` F1–F4 all passed, `placeholders: 0`,
`consoleErrors: []`, `overflowingCount: 0`.

`expression.ts:238-240` flags exactly three outputs dirty after an evaluation — `result`, `isTrue`,
`isFalse`. The three `as*` ports are declared with getters and **are never flagged**, so a wire from
one of them delivers whatever the getter returned when the connection was made and never updates
again. For a number port that first value is `NaN`, because unarrived inputs are seeded `undefined`
on purpose (NDA-017 §2) so a node with nothing to answer with abstains instead of answering `0`. The
wire takes precedence over the `size: 96` parameter, so the circle renders at zero pixels.

✅ **Fixed in the lesson by wiring `result`**, and written into the bundle's `CLAUDE.md` and
`docs/CONVENTIONS.md` so the next author does not re-earn it. 📋 **Registered as
[G1](DEFECTS-LESSON-5-FOUND.md#g1--an-expressions-as-number--as-string--as-boolean-outputs-never-update), owner `NONE`** — this is a product defect on a core node, not a lesson defect.

### 🔴 And the instrument that looked like it would catch it does not

The render report's `colors.distinctAccents` read **0 for lesson 4's correct solution**, which draws
a `--primary` circle 96px across. So the one metric that looks like "is there a coloured shape on
screen" reads identically whether the creature is there or not. **The screenshot is what caught
this.** Four renders were spent splitting the hypothesis space, and the numbers were the same in
every one of them. [[a-css-background-is-invisible-to-both-instruments]]

## 🔴 The chain held byte-exact on the first attempt, because the writer was checked first

Session 5 lost time to `json.dump`'s `ensure_ascii=True`. This session ran the control **before**
authoring: round-trip lesson 4's shipped `nodes.json` through the intended serialiser and compare
bytes.

```
round-trip identical: True        json.dumps(d, indent=2, ensure_ascii=False), no trailing newline
```

`starter(5)` is byte-identical to `solution(4)` on **all four** graph files, and `lessons:check`
prints the whole spine as one sequence:

```
3n → 6n → 11n → 15n → 18n → 21n
```

✅ **The general shape: when a previous session recorded a writer mismatch, test the writer against
the artefact before producing anything, not after.** It cost one command.

## 🔴 A spine lesson may only ADD, so an outro may not promise a subtraction

Lesson 4 ends by pointing at the card and saying *"It says `3`… That is the next lesson."*
**Lesson 5 cannot make it stop saying `3`.** `derive_starter` only subtracts a lesson's own graded
steps from its own solution; it cannot restore something the solution does not contain. So
`solution(5)` must still contain `Score` and its wire, and a spine lesson can never delete,
re-parent or hide anything an earlier lesson built.

This is the **third** design rule in the family, and the first one to bite a lesson that was already
written:

1. A spine lesson may only ADD.
2. Ungraded parameters may only go on nodes THIS lesson creates.
3. 🆕 **An outro may promise the app will GAIN something, and may never promise that anything
   already on screen will change or go away.**

⬜ **A prose edit to lesson 4's outro is owed.** It is a popup with no `completeWhen`, so it is free
to change — no `derive_starter`, no re-drive. Turned to account meanwhile: lesson 5's outro uses the
surviving raw number as its example of one value feeding three consumers.

## Measurements — do not re-derive

| gate | reading |
|---|---|
| `create_lesson` | **F1 pass, F2 pass, F3 pass, F4 pass.** 5 graded steps, 9 conditions. 🔴 **`allow_unrendered` NOT used** |
| `lessons:check` | **exit 0**, 6 bundles, 12 projects, 26 components, 152 nodes |
| the chain | **4 of 4 graph files byte-identical** to lesson 4's solution, first attempt |
| the subtraction, arithmetically | solution **21** nodes − starter **18** = the three the learner builds: `Caption`, `Story`, `Excitement` |
| `measure-from-disk` @ `1280x900` | `placeholders: 0`, `overflowingCount: 0`, `consoleErrors: []`, 9 texts, card reads `Nibbles has been poked 0 times`, circle 96px |
| **the control arm** (`Pokes.startValue: 5`) | card reads **`5 times`**, circle **136px** = 96 + 5×8 — both chains live and reactive |
| `tests-unit/rel-012` + `tests-unit/tut-004` | **109 passed, 7 suites, exit 0** |
| voice | 1305 words, **12 em dashes, 0 hyphen-dashes, 0 contractions** |
| ⚠️ `typecheck` / `test:ci` | **not run, and not needed** — no TypeScript changed |

⚠️ **No number-with-units parameter is graded anywhere in this lesson** — `format` and `expression`
are both plain strings, checked against
[D1](DEFECTS-LESSON-2-FOUND.md#d1--create_lesson-cannot-catch-a-condition-a-learner-can-never-satisfy).

## ✅ Why the expression is arithmetic and not a ternary

`min(96 + pokes * 8, 200)` could have been `pokes < 3 ? "sleepy" : "curious"`, which fits the
lesson's *title* better. It was rejected: choosing between two answers based on a value is exactly
what `moods` teaches next, with a `Condition` node. Spending it here, inside an expression, would
teach the following lesson's idea in the wrong vocabulary and leave `moods` with no opening problem.

The lesson instead ends on one it can hand forward: the sentence reads **"poked 1 times"** after one
poke, and no rewording fixes it, because the right words depend on the number.

## ✅ Both curriculum node names checked out — the first spine lesson of which that is true

`Expression` and `String Format` are both real type names whose display names match. Lessons 3 and 4
each named a pairing that could not be built; this entry named two nodes that do exactly the job the
description implies. **The check is still worth running** — it cost two `get_node_type` calls.

## ⬜ What was NOT done

🔴 **Not driven.** The box rebooted mid-session under a fleet-wide load spike (load average 218), and
a peer held the dev stack before and after. **Four of the five spine lessons that ship are now
undriven**, and lesson 5 adds **four** more graded `connection` conditions to the six already
unexercised — ten in total, none ever observed being graded in a running editor.

Lesson 5 also introduces two things a drive would answer that no earlier lesson could:

| | answered? |
|---|---|
| does the solution render, both chains live? | ✅ **yes — control pair** |
| does the bundle install through the real model? | ✅ **yes** — 109 green |
| does the runner grade a `connection` condition at all? | ⬜ **NO** — now 10 across lessons 3–5 |
| 🆕 **does the runner grade a condition on a RUNTIME-MINTED port** (`count`, `pokes`)? | ⬜ **NO** — the ports do not exist until the learner types the parameter |
| 🆕 **does `paramsEqual` on a string containing `{braces}` round-trip?** | ⬜ **NO** |
| does it resolve a 5-segment node path? | ⬜ **NO** — inherited, still open since lesson 2 |

## What is Richard's

1. 🔴 **The step prose.** Seven bodies and five `detail` blocks, drafted to
   [LESSON-VOICE.md](LESSON-VOICE.md).
2. **The `description`** — currently his curriculum sentence verbatim.
3. **The badge**, currently `Makes Sense Now`.
4. 🔴 **The sentence itself**, currently `Nibbles has been poked {count} times`. It is graded with
   `paramsEqual`, so changing it costs a `derive_starter` → `create_lesson` → re-drive — the same
   coupling lesson 4 has on `Rest`'s caption.
5. **The expression**, currently `min(96 + pokes * 8, 200)`. Same coupling.
6. ⬜ **Lesson 4's outro**, per the rule above. Free to change.

## ✅ Driven 2026-09-05 — both of §6's "no earlier lesson could answer this" rows

Full method and caveats: [DRIVE-2026-09-05-THE-LESSON-RUNNER.md](DRIVE-2026-09-05-THE-LESSON-RUNNER.md).

| question | answer |
|---|---|
| **a port minted by what the learner TYPED** | ✅ **YES, both kinds** — `{count}` in a `String Format`'s format string, and `pokes` in an `Expression`, each grade as a `connection` target |
| **`paramsEqual` round-tripping a string with `{braces}`** | ✅ **YES** — `format: "Nibbles has been poked {count} times"` grades, and the condition prose renders the braces intact |
| **`Expression.result`** | ✅ **YES** — step 5's wire into `…:#Card:#Creature .size` |
| **the negative control** | ✅ **YES** — the untouched starter holds at step 1's format condition and refuses |

⚠️ **[G1](DEFECTS-LESSON-5-FOUND.md) is untouched by this.** The drive confirms `result` is graded
correctly; it says nothing about the `As Number` / `As String` outputs that never update, because
this lesson deliberately does not use them.
