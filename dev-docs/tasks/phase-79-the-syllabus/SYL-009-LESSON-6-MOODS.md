# SYL-009 — lesson 6, "Moods"

| Field | Value |
|---|---|
| **Prefix** | `SYL` |
| **Effort** | M |
| **Surface** | `project-examples/lessons/moods` |
| **Rules** | [R1](RICHARD-RULINGS-2026-08-28.md#r1--the-pet-spine-stands-as-written) (the chain), R3 via [SYL-001](SYL-001-THE-HAND-HOLDING-HALF.md) (`detail`), [LESSON-VOICE.md](LESSON-VOICE.md) |
| **State** | 🟢 **Built, gated and DRIVEN 2026-09-05.** ⬜ **The prose is a draft awaiting Richard.** |

## What it is

Spine lesson 6, the first lesson in which the app **decides** something. A comparison turns the poke
count into a boolean, a branch turns the boolean into two signals, and a pair of named states holds
the two sentences one of which reaches the card. **Five graded steps** between an intro and an outro
popup.

```
Card                                     lessons 1-5
  └ Mood Line (Text)                      ← step 6 — NO text parameter

Is Happy    (Expression)                  ← step 2 — "pokes > 4", currentCount → pokes
Mood Check  (Condition)                   ← step 3 — isTrue → condition
Mood        (States)                      ← step 4 — Bored,Happy / word / two sentences
                                          ← step 5 — ontrue → to-Happy, onfalse → to-Bored
                                          ← step 6 — word → Mood Line.text
```

## 🟢 This is the first spine lesson whose behaviour was DRIVEN, not just rendered

Every earlier spine lesson was measured by rendering one frame of its solution. That cannot tell a
live branch from a dead one, because `Mood` starts in the first state in its list whether or not the
`Condition` wires exist. So the solution was **served and clicked**, in a real browser, through
`render-from-disk.js` and `drive-page.js`:

| what was clicked | the card's last line | the count |
|---|---|---|
| nothing | `Nibbles is dozing` | `0` |
| **Poke** ×4 | `Nibbles is dozing` | `4` |
| **Poke** ×5 | **`Nibbles is delighted`** | `5` |
| **Rest** | `Nibbles is dozing` | `0` |

`errors: []`. The threshold fires on the fifth poke and not the fourth, exactly as step 6's body
claims, and `Rest` puts it back — which also proves the branch re-tests downwards and not only up.

⚠️ **This is the app being driven, not the lesson runner.** The ten-and-now-fifteen graded
`connection` conditions across lessons 3-6 are still unexercised in a running editor; that job is
unchanged and is still the phase's first job. What this drive removes is the *other* doubt: that the
graph these lessons ship might not do what the prose says.

## Measurements — do not re-derive

| gate | reading |
|---|---|
| `create_lesson` | **F1 pass, F2 pass, F3 pass, F4 pass.** 5 graded steps, 11 conditions. 🔴 **`allow_unrendered` NOT used** |
| `lessons:check` | **exit 0**, 7 bundles, 14 projects, 30 components, 198 nodes |
| the chain | **4 of 4 graph files byte-identical** to lesson 5's solution, first attempt |
| the chain, in the checker's numbers | `3n → 6n → 11n → 15n → 18n → 21n → 25n` |
| the subtraction, arithmetically | solution **25** nodes − starter **21** = the four the learner builds |
| `measure-from-disk` @ `1280x900` | `placeholders: 0`, `overflowingCount: 0`, `consoleErrors: []`, 10 texts, 5 stacked in the card |
| **four static arms** | `startValue` 0 → dozing, **4 → dozing**, **5 → delighted**, 6 → delighted |
| **the live drive** | the table above, `errors: []` |
| voice | 1563 words, **12 em dashes, 0 hyphen-dashes, 0 contractions** |
| ⚠️ `typecheck` / `test:ci` | **not run, and not needed** — no TypeScript changed |

**The boundary arms are the point.** `> 4` is exclusive, and an arm at 4 and an arm at 5 are what
make that a measurement rather than a reading of the source. The prose says *"on the fifth poke and
not the fourth"*, and that sentence is now checked.

## 🔴 The curriculum entry named three nodes and one of them cannot do the job

`moods` lists `Condition`, `Switch`, `States`.

- **`Condition`** ✅ real, display name matches, does exactly what the description implies.
- **`States`** ✅ same.
- **`Switch`** 🔴 **cannot.** It is a remembered on/off boolean driven by On / Off / Flip signals —
  the one-bit memory lesson 3 already ships as `Poked`. It has no way to hold two sentences or to
  choose between them. It is in the entry because "switch" reads like a branch in most languages,
  and in this product it is not one.

**`Expression` is missing from the entry and is unavoidable.** Nothing in the `Logic` category
compares two numbers — the whole category is `And`, `Or`, `Inverter`, `Condition`, `Switch` and
`Value Changed` — so the only route from a count to a boolean is an expression.

⬜ **Curriculum correction owed**: `moods`' `nodes` should read `Expression`, `Condition`, `States`.
That makes **three** spine entries corrected out of six built (`poke-it` gains `Switch`,
`it-forgets-you` loses `Value Changed`, `moods` loses `Switch` and gains `Expression`), which is a
strong enough rate to be worth saying out loud: **checking the entry's node names with
`get_node_type` before designing is now paying for itself every time.**

## 🔴 The plural is NOT fixed, and no spine lesson can fix it

Lesson 5 ends on *"Nibbles has been poked 1 times"*. What its outro promises is the **move** —
*"choosing between two answers based on a value is the one move your app cannot yet make"* — and
this lesson delivers exactly that. It does not repair the sentence.

It cannot. The words live in `Caption`'s `format`, lesson 5 grades that parameter with `paramsEqual`,
and grading it again here would make `derive_starter` retract it: `starter(6)` would carry a
`Caption` with no format and the chain would break. Same rule that stopped lesson 5 removing `Score`.

✅ **Handled by saying so in the intro**, which names the plural, explains precisely why no wire can
reach those words, and moves the machinery onto something more visible. That is the honest version of
rule 3, and it is the first time a lesson has had to write around a hook rather than answer it.

## What a `States` node costs to author, and what nearly went wrong

**Every port after `states` and `values` is minted from those two lists.** `word` becomes an output,
each state becomes a `to-<state>` signal input, each pair becomes `value-<state>-<word>`.

🔴 **`type-word` must be set to `string`.** A value with no `type-<value>` is treated as a number
(`states.ts:161` tests `=== 'number' || === undefined`) and a state change tries to *tween* it. The
first jump is unaffected — `jumpToState` assigns the raw parameter whatever the type — so **a lesson
graded on its opening frame would pass with the type unset and break on the first poke.** Registered
as [H2](DEFECTS-LESSON-6-FOUND.md#h2--a-states-value-with-no-type-is-a-number-and-the-first-jump-hides-it).

⚠️ Names are split on `-`, so no state or value name may contain a hyphen, and `failure`,
`stateChanged`, `done`, `unchanged` and `completed` are reserved (`RESERVED_OUTPUTS`,
`states.ts:119`) — a value with one of those names silently resolves to the node's own port.

## 🔴 The design this lesson nearly shipped, and the port that killed it

The first design had no `States` node at all: two Texts in the card, one reading *dozing* and one
reading *delighted*, with `Condition`'s **Is True** and **Is False** driving their **Visible** inputs.
Two nodes instead of four, every port static, and nothing runtime-minted to grade.

**`Visible` sets `visibility: hidden`** (`node-shared-port-definitions.ts:346`). It keeps the space.
The card would have carried a permanent blank line, and the lesson would have taught a hide/show
pattern that leaves a hole in every layout it is used in.

✅ **Caught by reading the port definition before authoring, not by rendering it afterwards.** The
catalog summary — *"hides/shows without removing layout logic elsewhere"* — is not wrong but does not
say it plainly; the port's own `description` does. Registered as
[H4](DEFECTS-LESSON-6-FOUND.md#h4-low--the-catalogs-one-line-summary-of-visible-does-not-say-it-keeps-the-space).

## ⬜ What was NOT done

- **The lesson runner is still unexercised.** Fifteen graded `connection` conditions now ship across
  lessons 3-6 and not one has been observed being graded in a running editor. Lesson 6 adds two more
  first-of-their-kind cases: a condition on a **runtime-minted signal input** (`to-Happy`,
  `to-Bored`) and one on a **runtime-minted output** (`word`).
- **The curriculum entry.** Four edits are now owed in `nodegx-community`, none of them blocking.
- **`Or` and `Inverter`.** Named by `it-gets-demanding`, not by this lesson.

## What is Richard's

1. 🔴 **The step prose.** Seven bodies and five `detail` blocks, drafted to
   [LESSON-VOICE.md](LESSON-VOICE.md).
2. **The `description`** — currently his curriculum sentence verbatim.
3. **The badge**, currently `Made Its Mind Up`.
4. 🔴 **The two sentences**, currently `Nibbles is dozing` and `Nibbles is delighted`. Both are graded
   with `paramsEqual`, so changing either costs a `derive_starter` → `create_lesson` → re-drive.
5. 🔴 **The threshold**, currently `pokes > 4`. Same coupling, and the step body names the number.
6. **The two state names**, `Bored` and `Happy`. They are port names as well as prose.
