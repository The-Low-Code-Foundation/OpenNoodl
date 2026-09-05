# Brief

## What this app is

The solution project for University spine lesson 6, "Moods". Lesson 5's app, plus the first thing in it that *decides* something: `Is Happy` (**Expression**) compares the poke count against a threshold, `Mood Check` (**Condition**) forks on the answer, and `Mood` (**States**) holds the two sentences. One of them reaches the card on a wire.

🔴 **The starter of this lesson is the solution of lesson 5.** `starter(N)` must equal `solution(N-1)`, byte for byte on `nodes.json` and `connections.json`. Two rules follow:

- **This lesson may only ADD.** A step grading a parameter lesson 5 set would have `derive_starter` retract it, and the learner would open lesson 6 to find lesson 5's work undone.
- **Ungraded furniture may only be added to nodes this lesson creates.** Anything set on `Card`, `Caption`, `Pokes` or the other inherited nodes and not graded stays in the derived starter, appearing in a project the learner never built it in.

## Who uses it

Somebody who has finished lesson 5 and has an app in which every value on screen is a direct restatement of one number. It can reshape that number three ways. It cannot choose between two things.

## 🔴 The one idea

**A comparison turns a value into true or false. A branch turns true or false into two different outcomes.**

The three nodes are deliberately three and not one. `Is Happy` knows arithmetic and nothing about moods; `Mood` knows two sentences and nothing about counting; `Mood Check` sits between them and knows only which road is which. That separation is the transferable part — it is what makes the threshold, the wording and the branch each editable without touching the other two.

## 🔴 The plural is NOT fixed here, and it cannot be

Lesson 5 ends on *"Nibbles has been poked 1 times"*. Its outro promises the **move** — *"choosing between two answers based on a value is the one move your app cannot yet make"* — and this lesson delivers exactly that. It does not repair that sentence, and no spine lesson can: the words live in `Caption`'s `format`, lesson 5 grades that parameter, and re-grading it here would make `derive_starter` retract it from the starter. The intro says so in as many words rather than hoping nobody notices.

## Deliberately out of scope

- **Combining conditions.** One comparison, one fork. `hungry AND bored` is `it-gets-demanding`, along with **And**, **Or** and **Inverter**.
- **Time.** Nothing in this app happens unless something is clicked, and that is the deficiency the outro hands forward.
- **Transitions.** `Mood` uses **States** as a state machine and leaves `useTransitions` off. Animating between states is real and is not this lesson's idea.
- **A third mood.** Two states is the smallest set that shows a branch, and a third would need a comparison shape the lesson has not taught.
