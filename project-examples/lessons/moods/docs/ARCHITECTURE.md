# Architecture

## Page map

- **Home** (`Pages/Home`) — The only page. Eight logic nodes now sit on the canvas beside the visual tree: lesson 3's `Poked` and `Ease the poke`, lesson 4's `Pokes`, lesson 5's `Caption` and `Excitement`, and this lesson's `Is Happy`, `Mood Check` and `Mood`.

## The tree this lesson adds

```
Page shell  (Group)                      lessons 1-2, untouched
  ├ Card    (Group)                       lesson 1, untouched
  │   ├ Creature (Circle)                 lesson 1 — Size arrives on lesson 5's wire
  │   ├ Name     (Text)
  │   ├ Reaction (Text)                   lesson 3
  │   ├ Score    (Text)                   lesson 4, untouched
  │   ├ Story    (Text)                   lesson 5, untouched
  │   └ Mood Line (Text)                  ← step 6 — NO text parameter
  └ Board   (Group)                       lesson 2, untouched

Poked          (Switch)                   lesson 3
Ease the poke  (Animate To Value)         lesson 3
Pokes          (Counter)                  lesson 4 — currentCount now feeds FOUR nodes
Caption        (String Format)            lesson 5
Excitement     (Expression)               lesson 5
Is Happy       (Expression)               ← step 2:  "pokes > 4", currentCount → pokes
Mood Check     (Condition)                ← step 3:  isTrue        → condition
Mood           (States)                   ← step 4:  Bored,Happy / word / the two sentences
                                          ← step 5:  ontrue        → to-Happy
                                          ← step 5:  onfalse       → to-Bored
                                          ← step 6:  word          → Mood Line.text
```

## 🔴 1. Three nodes, and each of the two joins is forced

The obvious question about this graph is why the comparison does not drive the states directly. Both
joins are constrained by the ports that exist, and neither is a stylistic choice.

**Why a `Condition` and not the `Expression` alone.** A `States` node is moved by **signals**:
`to-<state>` is a signal input and there is no port that accepts "the state as a boolean". An
`Expression` does carry `On True` and `On False` signal outputs of its own, so the graph *could* be
two nodes — but `Condition` is the node whose entire job is the fork, it is where a reader looks for
one, and it publishes `Is True` and `Is False` as readable booleans for anything downstream that
wants the answer as a value rather than as a moment. The redundancy is real and it is spent
deliberately, on the node the next lesson builds on.

**Why an `Expression` and not the `Condition` alone.** `Condition.condition` takes a boolean and
does no comparing of its own. There is no comparison node in the catalog — `Logic` holds **And**,
**Or**, **Inverter**, **Condition**, **Switch** and **Value Changed**, and not one of them compares
two numbers. An expression is the only way to get from a count to a boolean.

## 🔴 2. `type-word` must be `string`, and the failure if it is not is silent

Every port on `Mood` after `states` and `values` is minted from those two lists. `word` becomes an
output, `Bored` and `Happy` become `to-Bored` and `to-Happy` signal inputs, and each pair becomes a
`value-<state>-<word>` input.

**A value with no `type-<value>` is treated as a number** (`states.ts:161`: the test is
`=== 'number' || === undefined`). On a state change the node then tries to *tween* between the two
settings, and a sentence has no midpoint. Only `string`, `boolean` and `textStyle` take the
jump-straight-to-it path (`states.ts`, `goToState`).

⚠️ The first jump is not affected — `jumpToState` assigns `stateParameters[prefix + v] || 0`
whatever the type — so a lesson graded only on its opening frame would pass with the type unset and
break on the first poke. This is why step 4 grades `type-word` explicitly and why the control arms
below start at a count that has already crossed the threshold.

⚠️ **State and value names are split on `-`** (`states.ts`, `registerInputIfNeeded`), so neither may
contain a hyphen, and a value may not be called `failure`, `stateChanged`, `done`, `unchanged` or
`completed` (`RESERVED_OUTPUTS`, `states.ts:119`) — the name would silently resolve to the node's own
port and the author's output would simply not exist.

## 🔴 3. Measured with four arms, because one arm cannot see a dead branch

The shipped solution renders `Nibbles is dozing`. So would a graph in which the `Condition` wires
were never drawn at all, because `Mood` starts in the first state in its list either way. One arm
proves nothing about the branch, so the threshold was measured on both sides of itself:

| arm | the card's last line | what it proves |
|---|---|---|
| shipped (`startValue` default `0`) | `Nibbles is dozing` | the states node reaches the card |
| `startValue: 4` | `Nibbles is dozing` | `> 4` is exclusive — the fourth poke does nothing |
| `startValue: 5` | **`Nibbles is delighted`** | the branch is live, and fires on the fifth |
| `startValue: 6` | `Nibbles is delighted` | it stays over the threshold |

All four at `1280x900`: `placeholders: 0`, `overflowingCount: 0`, `consoleErrors: []`, 10 texts,
5 of them stacked in the card.

`Mood Line` carries no `text` parameter, the same rule as `Score` and `Story`: with the port unset, a
node whose wire stops delivering falls back to the catalog default string `Text`, which **F4's
placeholder check sees**. A parameter there would swallow the failure the gate exists to catch.

## ⚠️ 4. `paramsEqual` on a `stringlist` is order-independent, and the order matters

`states` is a `stringlist`, and the lesson runner compares those as sorted comma lists
(`lessonevalconditions.ts:550`). So a learner who writes `Happy,Bored` satisfies step 4 exactly as
one who writes `Bored,Happy` does, even though the node starts in whichever state is written first.

It does not break this lesson — the `Condition` fires on its first evaluation and pushes the node to
the correct state before the first frame a learner sees — but the condition cannot say what the step
body says, and a lesson where the start state mattered would ship a hole. Registered as a row in
`DEFECTS-LESSON-6-FOUND.md`.

## Data model

No records. Spine lesson 6 is still purely in-memory.
