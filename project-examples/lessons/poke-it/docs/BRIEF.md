# Brief

## What this app is

The solution project for University spine lesson 3, "Poke it". Lesson 2's creature card and care strip, plus the first thing in the app that answers back: a **Poke** button whose click fades a reaction in and out. It is the finished state the learner reaches, and the starter is derived from it by subtraction.

🔴 **The starter of this lesson is the solution of lesson 2, and that is a build constraint rather than a description.** Every spine lesson `needs` the one before it and they share one app, so `starter(N)` must equal `solution(N-1)`. Two rules follow, and neither is obvious:

- **This lesson may only ADD.** A step that graded a parameter lesson 2 already set — `Care`'s `layoutString`, say — would have `derive_starter` retract it, and the learner would open lesson 3 to find lesson 2's work undone.
- **Ungraded furniture may only be added to nodes this lesson creates.** A parameter set on `Board` or `Card` and not graded stays in the derived starter, so it appears in a project the learner never built it in. This is why `Poke` is not centred: the alignment would have to live on `Board`, which belongs to lesson 2.

## Who uses it

Somebody who has finished lessons 1 and 2 and has an app that cannot be interacted with at all. They have three words — `Feed`, `Play`, `Sleep` — that lesson 2 deliberately left inert.

## 🔴 The one idea

**An event is a pulse, and a pulse is not a value.** Everything else in the lesson exists to make that concrete: the reason four nodes are needed rather than one is that **no visual node in the catalog has a signal input**, so a click cannot reach the screen without something in between that holds a value.

That is a fact about the runtime, not a stylistic choice — see `docs/ARCHITECTURE.md` §1.

## Deliberately out of scope

- Counting, accumulating and remembering — spine lesson `it-forgets-you`. This lesson ends on a toggle **on purpose**: poke twice and you are back where you started, which is the deficiency lesson 4 opens by complaining about.
- Conditions and branching — spine lesson `moods`. The `Switch` here is used as a pulse-to-value converter, not as a boolean being tested.
- Styling the button. `Poke` carries no colour, and the black it renders is the product's own default — see `docs/ARCHITECTURE.md` §3.
