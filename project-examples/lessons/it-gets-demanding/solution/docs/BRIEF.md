# Brief

## What this app is

The solution project for University spine lesson 7, "It gets demanding". Lesson 6's app, plus the first behaviour in it that no click causes: `Patience` (**Delay**) counts five seconds from the page appearing, `Ignored` (**Switch**) remembers that it ran out, `Demanding` (**And**) is true only while that *and* a bad mood hold together, and `Nag` fades in on the card to ask to be fed.

🔴 **The starter of this lesson is the solution of lesson 6.** `starter(N)` must equal `solution(N-1)`, byte for byte on `nodes.json` and `connections.json`. Two rules follow:

- **This lesson may only ADD.** A step grading a parameter lesson 6 set would have `derive_starter` retract it, and the learner would open lesson 7 to find lesson 6's work undone.
- **Ungraded furniture may only be added to nodes this lesson creates.** Anything set on `Card`, `Mood`, `Pokes` or the other inherited nodes and not graded stays in the derived starter, appearing in a project the learner never built it in.

## Who uses it

Somebody who has finished lesson 6 and has an app that decides one thing, from one value, in reply to a click. Everything in it is downstream of the mouse, and every condition in it is a single condition.

## 🔴 The one idea

**Time is an event source like any other, and a need is usually more than one condition at once.**

The two halves are deliberately in one lesson because each is thin alone and they compose exactly once: the clock produces the first input to the `And`, the counter that lesson 6 already reads produces the second, and neither knows the other exists.

## 🔴 The join that makes the lesson work: a moment is not a fact

`Patience` fires **Finished** and there is no port anywhere on it that answers *has the countdown already run out?* An `And` cannot read a signal. So a `Switch` sits between them, pushed **On** by the delay and **Off** by the poke, and it is the smallest possible demonstration of the boundary every non-trivial graph eventually crosses.

That the node is lesson 3's `Poked` doing the same job for a different event is a feature: the learner has met it, and it now has a name for what it is *for*.

## Deliberately out of scope

- **`Or` and `Inverter`.** Both are named in the curriculum entry and neither is built. The lesson names them in the step prose beside **And** because they are one family with one shape; wiring one in without a job for it would teach padding. `Mood Check` already publishes **Is False**, so the negation this lesson needs costs nothing.
- **A repeating timer.** There is not one. The **Delay** is one-shot and restartable, which is what debouncing is made of and is a better fit for *after you stop* than a tick would be.
- **Anything the nag can act on.** `Feed` is still a word. That is lesson 8's opening problem and the outro hands it over.
- **Data.** No records, no queries.
