# 000 — Initial scope

_Recorded 2026-09-05, from the scoping conversation held before this project was authored._

## What was asked for

> Build spine lesson 7, "It gets demanding", from Richard's curriculum entry: "One condition is not
> enough — hungry AND bored. Combining logic, and time as a source of events." Teaches boolean
> operators, timers. Nodes: Timer, And, Or, Inverter. 30 minutes.

## What was decided

**The app.** Lesson 6's app plus a clock and a compound condition: `Patience` (**Delay**, 5 seconds,
started by the page and restarted by every poke), `Ignored` (**Switch**), `Demanding` (**And**, over
`Ignored` and `Mood Check`'s **Is False**), `Fade the nag` (**Animate To Value**) and `Nag`, the Text
that asks to be fed.

**Two ideas in one lesson, because they compose exactly once.** *Time is an event source* and
*conditions combine* are each thin on their own. Together they give the `And` its two inputs from
opposite ends of the app — one from a countdown, one from a comparison on a counter — which is the
whole point of the second idea and impossible to show with one condition.

**Five seconds, not thirty.** The number is arbitrary and the lesson says so. It exists so the
learner does not have to wait long enough to lose interest, and it is graded because the step names
it.

**Started from `Did Mount`, restarted from the poke.** A clock that only starts once the learner has
clicked something would undercut the lesson's own claim that time is independent of the mouse.

## 🔴 The curriculum entry named four nodes; two are built and two are named in prose

- **`Timer`** ⚠️ real type name, but **the picker shows it as `Delay`**, and it is a one-shot
  countdown — no repeat, no `isRunning`. The step body says **Delay**; the `detail` says the type
  name once.
- **`And`** ✅ exactly right.
- **`Or`** ⬜ named beside **And** in step 4's `detail` and in the outro, not built. There is nothing
  in this app that is true when *either* of two things holds.
- **`Inverter`** ⬜ same, and for a sharper reason: **it would be the wrong node here.** `Mood Check`
  already publishes **Is False**, so an `Inverter` on **Is True** would be a second node saying what
  one wire already says. Teaching it as the way to negate would be teaching a habit this product's
  own port sets exist to make unnecessary.

⬜ **Curriculum correction owed**: `it-gets-demanding`'s `nodes` should read `Timer`, `Switch`, `And`,
`Animate To Value`. `Switch` is the addition and it is unavoidable — an `And` cannot read a signal.

## 🔴 What could not be measured the usual way

**A static render cannot see this lesson.** The delay has not finished when the harness screenshots,
so the shipped solution renders exactly as a solution with none of this lesson's wires would.

The measurement had to be a **drive**, and the first attempt was nearly a false pass: shots at t≈0
and t≈8s both showed the nag, because starting the browser takes longer than five seconds. The arm
that separates the hypotheses is a second project with `duration: 60000`, which stays clear at t≈12s.
See `docs/ARCHITECTURE.md` §3 for the full table, including the arm where the two `And` inputs
disagree — the only one that can catch a wire dropped from `input 1`.

## What was deliberately not done

- **A repeating tick.** There is no repeating timer node, and *after you stop* wants a debounce
  rather than a tick.
- **Making `Feed` do anything.** It is still a word, and it is lesson 8's opening problem — the outro
  points at it, and at the fact that all three words on the board were typed by hand.
- **Reacting to the nag.** Nothing acknowledges it but a poke. A dismiss button would be a third
  event source and this lesson already has two.
