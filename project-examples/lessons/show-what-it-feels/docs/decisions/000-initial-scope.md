# 000 — Initial scope

_Recorded 2026-09-05, from the scoping conversation held before this project was authored._

## What was asked for

> Build spine lesson 5, "Show what it feels", from Richard's curriculum entry: "The number is stored
> and the screen says nothing useful. Values travel from state through transforms to what you see,
> and update themselves." Teaches expressions and reactive data flow. Nodes: Expression, String
> Format. 30 minutes.

## What was decided

**The app.** Lesson 4's app plus a `Caption` (**String Format**) that turns the poke count into a
sentence, a `Story` text that displays it, and an `Excitement` (**Expression**) that turns the same
count into the creature's diameter.

**Two transformations, not one, and both from the same value.** One transformation would have shown
a value being reshaped. Two, reading the same `currentCount` and knowing nothing about each other,
is what shows that the count is a *source* rather than a thing being passed along — and it is the
observation the outro generalises from.

**The expression is arithmetic and deliberately NOT a ternary.** `min(96 + pokes * 8, 200)` could
just as easily have been `pokes < 3 ? "sleepy" : "curious"`, which would have been a better fit for
the lesson's title. It was rejected: choosing between two answers based on a value is exactly what
`moods` teaches next, with a `Condition` node, and spending it here inside an expression would take
the following lesson's idea and teach it in the wrong vocabulary.

**Both curriculum node names checked out.** `Expression` and `String Format` are both real type
names whose display names match, so this lesson has no display-name/type-name trap. That is worth
recording because it is the first spine lesson of which it is true — lessons 3 and 4 each named a
pairing that could not be built.

## 🔴 What could not be done, and what it costs

**The bare number cannot be removed, and lesson 4's outro promises that it will be.**

Lesson 4 ends by pointing at the card and saying *"It says `3`… That is the next lesson."* This
lesson cannot make it stop saying `3`. `starter(N)` must equal `solution(N-1)` byte for byte, and
`derive_starter` only ever *subtracts* a lesson's own graded steps from its own solution — it cannot
put back something the solution does not contain. So a spine lesson can add `Story` beside `Score`,
and it can never delete `Score`, re-parent it, or hide it.

**The general rule, which nothing checks and which the spine has now hit once:** a spine lesson's
outro may promise that the app will gain something, and may never promise that anything already on
screen will change or go away.

⬜ **A prose edit to lesson 4's outro is owed** — it is a popup with no `completeWhen`, so it is free
to change. Recorded in `SYL-008` and in the phase's next-session prompt.

**Turned to account rather than papered over.** The outro's second and third bullets use the
surviving raw number as the example of one value feeding three consumers, which is a better
illustration of fan-out than the lesson would otherwise have had.

## What was deliberately not done

- **Formatting the plural.** The sentence says *"poked 1 times"* after one poke and is left wrong on
  purpose, as `moods`' opening problem. `LESSON-VOICE.md` §7 requires a hook that names a concrete
  deficiency in the thing the learner just built, and this is one they can see.
- **Styling `Story` or `Score`.** Every parameter on a node this lesson creates is one a step asks
  for; `Score` belongs to lesson 4 and is not this lesson's to touch.
- **`Expression`'s boolean outputs.** `isTrue`/`isFalse` are real and belong to `moods`.
