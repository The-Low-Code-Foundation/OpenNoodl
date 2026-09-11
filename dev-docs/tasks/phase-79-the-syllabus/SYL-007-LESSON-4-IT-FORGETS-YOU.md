# SYL-007 — lesson 4, "It forgets you"

| Field | Value |
|---|---|
| **Prefix** | `SYL` |
| **Effort** | M |
| **Surface** | `project-examples/lessons/it-forgets-you` |
| **Rules** | [R1](RICHARD-RULINGS-2026-08-28.md#r1--the-pet-spine-stands-as-written) (the chain), R3 via [SYL-001](SYL-001-THE-HAND-HOLDING-HALF.md) (`detail`), [LESSON-VOICE.md](LESSON-VOICE.md) |
| **State** | 🟢 **Built, gated and DRIVEN 2026-09-05** — control pair in a running editor, see [DRIVE-2026-09-05-THE-LESSON-RUNNER.md](DRIVE-2026-09-05-THE-LESSON-RUNNER.md). ⬜ **The prose is a draft awaiting Richard.** |

## What it is

Spine lesson 4, the first lesson in which the app keeps anything. A `Counter` holding the number of
pokes, a `Score` text showing it, and a second button that puts it back to zero. **Four graded
steps** between an intro and an outro popup.

```
Card                                     lesson 1
  ├ Creature / Name / Reaction           lessons 1, 3
  └ Score   (Text)                       ← step 4 — NO text parameter
Board                                    lesson 2
  ├ Care / Poke                          lessons 2, 3
  └ Rest    (Button)                     ← step 5
Pokes       (Counter)                    ← step 2, wired in steps 3, 4 and 5
```

## 🔴 The lesson ends on TWO events, and that is the design

A Counter driven by one button shows a number going up, which is arithmetic. The `Rest` button is
what makes it *state*: **one remembered value, two events acting on it, neither of them holding it,
and neither knowing the other exists.** That sentence is the lesson, and it is why step 5 exists at
all when the count already worked at step 4.

It also gives the app a second observation worth having: pressing `Rest` returns the count to zero
and **leaves the reaction exactly as it was**, because the `Switch` is separate state. Pointed at in
step 5's `detail` rather than fixed — fixing it needs a `Condition`, which belongs to `moods`.

## 🔴 The chain now joins four lessons

`starter(4)` == `solution(3)`, all four graph files byte-identical, and `lessons:check` prints the
whole spine as one sequence:

```
✔ your-creature-on-screen  — clean (starter 2c/3n,  solution 2c/6n)
✔ it-breaks-on-a-phone     — clean (starter 2c/6n,  solution 2c/11n)
✔ poke-it                  — clean (starter 2c/11n, solution 2c/15n)
✔ it-forgets-you           — clean (starter 2c/15n, solution 2c/18n)
                                    3n → 6n → 11n → 15n → 18n
```

### 🔴 And the chain broke first, on ENCODING, with nothing semantically wrong

The first `derive_starter` produced a starter that was **semantically identical** to lesson 3's
solution and **byte-different** in two ways:

| | mine | the tools' |
|---|---|---|
| non-ASCII | `—` | a literal `—` |
| file end | trailing `\n` | none |

Both came from writing lesson 3's solution by hand with Python's `json.dump`, whose `ensure_ascii`
defaults to **True**. `derive_starter` and `create_lesson` write literal UTF-8 with no trailing
newline.

✅ **Fixed by re-serialising lesson 3's shipped solution to the tools' convention**, measured off
lesson 2's solution rather than assumed, and re-verified in both directions: `starter(3)` is still
byte-identical to `solution(2)` afterwards.

🔴 **This is the failure mode [SYL-002](SYL-002-THE-CHAIN-THAT-CANNOT-DRIFT.md) has to survive.** A
chain check that compares bytes will fire on a difference that changes nothing, and the fix a tired
person reaches for is to loosen the check. The right answer is the one taken here — make the writer
match — and it now has a rule in the bundle's `CLAUDE.md` so the next hand-edit does not re-earn it.
⚠️ The `nodegx` MCP server was bound to another session's directory, which is why lesson 3 was
hand-authored at all.

## 🔴 What the render found, and what it protects

**`Score` carries no `text` parameter, deliberately, and that is load-bearing.** With the port
unset, a wire that ever stops delivering falls through to the catalog default string `Text` — which
**F4's placeholder check sees**. Setting `text: "0"` so it reads nicely before wiring would swallow
exactly the failure the gate exists to catch.

✅ **Measured, not predicted**: `measure-from-disk.js` at 1280x900 reports `placeholders: 0`,
`consoleErrors: []`, 8 text elements, and the card renders `0` under the name. That single reading
answers two questions that were both open — the wire delivers at load, and `number → string` on a
`Text.text` port is coerced rather than refused.

## ⚠️ The curriculum's second node has no job

The entry lists `nodes: ["Counter", "Value Changed"]`. **`Counter` already emits `countChanged`**, a
signal that fires whenever the count moves, so a `Value Changed` watching the count duplicates a port
the node has. `Value Changed` is for values that do not announce themselves.

⬜ **The `nodes` line needs correcting** — the same correction lesson 3 owed for `Switch`, and the
third curriculum edit the spine is now carrying. See "the curriculum edits owed" in
[NEXT-SESSION-PROMPT](NEXT-SESSION-PROMPT.md).

## Measurements — do not re-derive

| gate | reading |
|---|---|
| `create_lesson` | **F1 pass, F2 pass, F3 pass, F4 pass.** 4 graded steps. 🔴 **`allow_unrendered` NOT used** |
| `check_lesson` (re-score after the docs rewrite) | F1–F4 pass, 4 graded steps |
| `lessons:check` | **exit 0**, 5 bundles, 10 projects, 22 components, 113 nodes |
| the chain | 4 of 4 graph files byte-identical to lesson 3's solution, **after** the encoding fix above |
| the subtraction, arithmetically | solution **18** nodes − starter **15** = the three the learner builds: `Pokes`, `Score`, `Rest` |
| `measure-from-disk` @ `1280x900` | `placeholders: 0`, `overflowingCount: 0`, `consoleErrors: []`, 8 texts, the card reads `0` |
| `tests-unit/rel-012` + `tests-unit/tut-004` | **109 passed, 7 suites, exit 0** |
| ⚠️ `typecheck` / `test:ci` | **not run, and not needed** — no TypeScript changed |

⚠️ **`paramsEqual: {label: "Rest"}` is a plain string port** — checked against
[D1](DEFECTS-LESSON-2-FOUND.md#d1--create_lesson-cannot-catch-a-condition-a-learner-can-never-satisfy)
like every graded value since lesson 2. No number-with-units parameter is graded anywhere in this
lesson.

## ⬜ What was NOT done

🔴 **Not driven.** A peer session held the dev stack for REL-012 and then REL-016 for the whole of
this session. **Three of the four spine lessons that ship are now undriven**, and they share one
unexercised mechanism: `connection` conditions. Lessons 1 and 2 have no wires at all; lessons 3 and 4
have six graded ones between them, and **not one has been observed being graded on screen.**

That is now the single highest-value thing a drive would answer, and it is worth more than it was
one lesson ago because it is load-bearing for every remaining lesson in the spine.

| | answered? |
|---|---|
| does the solution render, with no placeholder and the count showing? | ✅ **yes, measured** |
| does the bundle install through the real model? | ✅ **yes** — `tut-004` + `rel-012`, 109 green |
| **does the runner grade a `connection` condition in a live editor?** | ⬜ **NO** — 6 graded connections across lessons 3 and 4, none observed |
| **does the runner resolve a 5-segment node path?** | ⬜ **NO** — inherited, still open from lesson 2 |
| **the negative control** — does the untouched starter refuse to tick? | ⚠️ **only structurally** |

## What is Richard's

1. 🔴 **The step prose.** Six bodies and four `detail` blocks, drafted to
   [LESSON-VOICE.md](LESSON-VOICE.md).
2. **The `description`** — his curriculum sentence, extended to name the two-events idea.
3. **The badge**, currently `It Remembers`.
4. **The second button's caption**, currently `Rest`. It is graded with `paramsEqual`, so changing
   the word is a `body` **and** `completeWhen` edit — the one prose change that costs a re-derive.

## ✅ Driven 2026-09-05

Full method and caveats: [DRIVE-2026-09-05-THE-LESSON-RUNNER.md](DRIVE-2026-09-05-THE-LESSON-RUNNER.md).

| question | answer |
|---|---|
| **a runtime-minted SIGNAL input** | ✅ **YES** — `Counter.increase` and `Counter.reset` both grade as connection targets |
| **a runtime-minted OUTPUT** | ✅ **YES** — `Counter.currentCount` into `…:#Card:#Score .text` |
| **the negative control** | ✅ **YES** — the untouched starter holds at *"Looking for a Counter called “Pokes” on Home."* and refuses |

🔴 **This lesson's negative arm is one of the two sharpest in the drive.** Its starter already
contains lessons 1–3's finished work, so a runner that simply ticked what it was shown would have
completed it. It refused on exactly the step this lesson adds.
