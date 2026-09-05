# Brief

## What this app is

The solution project for University spine lesson 5, "Show what it feels". Lesson 4's app, plus the first two things in it that *transform* a value on its way to the screen: a `Caption` (**String Format**) turning the poke count into a sentence, and an `Excitement` (**Expression**) turning the same count into a diameter for the creature.

🔴 **The starter of this lesson is the solution of lesson 4.** `starter(N)` must equal `solution(N-1)`, byte for byte on `nodes.json` and `connections.json`. Two rules follow:

- **This lesson may only ADD.** A step grading a parameter lesson 4 set would have `derive_starter` retract it, and the learner would open lesson 5 to find lesson 4's work undone.
- **Ungraded furniture may only be added to nodes this lesson creates.** Anything set on `Card`, `Score`, `Pokes` or the other inherited nodes and not graded stays in the derived starter, appearing in a project the learner never built it in.

## Who uses it

Somebody who has finished lesson 4 and has an app that remembers a number and says almost nothing about it. The card reads a bare digit; the creature looks identical after fifty pokes and before the first.

## 🔴 The one idea

**A value can be transformed on its way to the screen, and the transformation re-runs by itself whenever the value moves.**

The lesson builds two transformations from the *same* number, which is the half that makes the idea generalise: `Caption` and `Excitement` both read `Pokes.currentCount`, neither knows the other exists, and neither stores anything. The Counter is still the only thing in the app that remembers.

## 🔴 `Score` stays, and the bare number stays with it

The card ends this lesson showing **both** the raw `0` and the sentence. That is forced, not chosen: a spine lesson may only add, so `Score` and its wire cannot be removed without breaking `starter(6) == solution(5)`. It is turned to advantage in the outro — one value feeding three different consumers is the clearest picture of fan-out the spine gets — but it means **lesson 4's outro promises more than this lesson can deliver**. See `docs/decisions/000-initial-scope.md`.

## Deliberately out of scope

- **Deciding anything about the number.** The sentence reads *"poked 1 times"* at one poke, and it is left wrong on purpose: choosing between two wordings based on a value is `moods`, and the outro hands that deficiency forward as the next lesson's opening problem.
- **`Expression`'s comparison and boolean outputs.** `isTrue`, `isFalse` and their signal twins are real and belong to `moods`.
- **Anything time-based.** `it-gets-demanding` owns timers.
