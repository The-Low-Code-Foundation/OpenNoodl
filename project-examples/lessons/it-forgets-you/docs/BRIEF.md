# Brief

## What this app is

The solution project for University spine lesson 4, "It forgets you". Lesson 3's app, plus the first thing in it that survives an event: a `Counter` holding the number of pokes, a `Score` text showing it, and a `Rest` button that returns it to zero.

🔴 **The starter of this lesson is the solution of lesson 3.** `starter(N)` must equal `solution(N-1)`, byte for byte on `nodes.json` and `connections.json`. Two rules follow:

- **This lesson may only ADD.** A step grading a parameter lesson 3 set — `Ease the poke`'s `duration`, say — would have `derive_starter` retract it, and the learner would open lesson 4 to find lesson 3's work undone.
- **Ungraded furniture may only be added to nodes this lesson creates.** Anything set on `Card`, `Board` or the existing logic nodes and not graded stays in the derived starter, appearing in a project the learner never built it in.

## Who uses it

Somebody who has finished lesson 3 and has an app that reacts but does not accumulate. Poking twice returns them to where they began, which is the deficiency lesson 3 was built to end on.

## 🔴 The one idea

**State is a value the app keeps between events. Events do not carry it — they change it.**

The lesson makes that concrete in the last step rather than the first: **two** buttons act on **one** number, neither holds it, and neither knows the other exists. A counter alone would only have shown a value going up; one value with two events acting on it is what makes it state.

## Deliberately out of scope

- **Formatting the number.** The card ends the lesson saying `3` and nothing else, on purpose — spine lesson `show-what-it-feels` opens with *"the number is stored and the screen says nothing useful"*, and this lesson has to leave it that way.
- **Deciding anything about the number.** Comparisons, thresholds and "hungry versus fine" are spine lesson `moods`.
- **`Counter`'s limits.** `limitsEnabled`, `limitsMin` and `limitsMax` are real ports and are left alone; a step setting them would teach a knob rather than the idea.
