# 000 — Initial scope

_Recorded 2026-09-05, from the scoping conversation held before this project was authored._

## What was asked for

> Build spine lesson 6, "Moods", from Richard's curriculum entry: "'Hungry' versus 'fine' is a
> decision the app has to make. Conditions and branching." Teaches if / else, booleans, comparison.
> Nodes: Condition, Switch, States. 30 minutes.

## What was decided

**The app.** Lesson 5's app plus three logic nodes and one Text: `Is Happy` (**Expression**,
`pokes > 4`), `Mood Check` (**Condition**), `Mood` (**States**, holding two sentences), and
`Mood Line`, the Text on the card that the chosen sentence reaches on a wire.

**The three nodes are three on purpose.** `Is Happy` knows arithmetic and nothing about moods; `Mood`
knows two sentences and nothing about counting; `Mood Check` knows only which road is which. The
threshold, the wording and the branch are then each editable without touching the other two, and that
separation is the part that transfers to any app the learner goes on to build.

**Two states, not three.** Two is the smallest set that shows a branch. A third mood would need a
comparison shape — a range, or a chain of conditions — that this lesson has not taught and that
`it-gets-demanding` is the right place for.

**No transitions.** `useTransitions` is left off. **States** is used here as a state machine, which is
what it is; animating between states is real and belongs to a lesson about animation.

## 🔴 The curriculum entry named three nodes and one of them cannot do this job

`Condition` and `States` are both real type names whose display names match, and both do exactly what
the description implies. **`Switch` does not.** It is a remembered on/off boolean driven by On / Off /
Flip signals — the one-bit memory lesson 3 already uses as `Poked` — and it has no way to hold two
sentences or to choose between them. It is in the entry because "switch" reads like a branch in most
languages, and in this product it is not one.

⬜ **A curriculum correction is owed**: `moods`' `nodes` should read `Expression`, `Condition`,
`States`. `Expression` is the addition — a comparison is the only route from a number to a boolean,
because nothing in the `Logic` category compares anything.

## 🔴 What could not be done, and what it costs

**The plural cannot be fixed, and lesson 5's outro uses it as the example.**

Lesson 5 ends on *"Nibbles has been poked 1 times"* and says, correctly, that no rewording of that
sentence will fix it. What it promises is the **move** — *"choosing between two answers based on a
value is the one move your app cannot yet make"* — and this lesson delivers exactly that move.

It cannot deliver the repair. The words live in `Caption`'s `format`; lesson 5 grades that parameter
with `paramsEqual`; and a step here that graded it again would make `derive_starter` retract it, so
`starter(6)` would carry a `Caption` with no format at all and the chain would break. This is the
same rule that stopped lesson 5 removing `Score`.

**Handled by saying so.** The intro names the plural, explains precisely why a wire cannot reach
those words, and moves the idea onto the mood — which is a bigger and more visible use of the same
machinery. That is honest, and it is better than a silent substitution the learner notices.

## What was deliberately not done

- **Combining conditions.** One comparison, one fork. **And**, **Or** and **Inverter** are
  `it-gets-demanding`, and the outro hands them their opening problem.
- **Anything time-based.** The outro's hook is that Nibbles never changes unless it is clicked.
- **A `Switch`.** See above; it is in the curriculum entry and it cannot do this job.
- **Wiring `Condition`'s `Evaluate`.** It is additive to testing on change rather than a replacement
  for it (NDA-017 §2), and wiring it here would teach the trap that port's description exists to
  correct.
