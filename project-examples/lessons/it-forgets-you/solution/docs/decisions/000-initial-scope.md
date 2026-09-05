# 000 — Initial scope

_Recorded 2026-09-05, from the scoping conversation held before this project was authored._

## What was asked for

> Build spine lesson 4, "It forgets you", from Richard's curriculum entry: "Poke it twice and
> nothing accumulates. State is a remembered value that events change." Teaches variables and state.
> Nodes: Counter, Value Changed. 30 minutes.

## What was decided

**The app.** Lesson 3's app plus a `Counter` named `Pokes`, a `Score` text inside the card, and a
second button `Rest` that resets the count.

**The lesson ends on two events, not one.** A Counter driven by a single button would have shown a
number going up, which is arithmetic rather than state. The `Rest` button is what makes the point:
one remembered value, two events acting on it, neither of them holding it.

**`Value Changed` was dropped.** `Counter` already emits `countChanged`, so a Value Changed watching
the count duplicates a port the node has. ⬜ The curriculum entry's `nodes` line needs correcting —
the same correction lesson 3 owed for `Switch`.

**`Score` carries no `text` parameter**, so that a wire which stops delivering falls through to the
catalog placeholder and is caught by F4 rather than hidden. See `docs/ARCHITECTURE.md` §1.

**The bare number is the ending, on purpose.** `show-what-it-feels` opens with *"the number is
stored and the screen says nothing useful"*, so this lesson must not format it. The outro popup
names the deficiency explicitly, as `LESSON-VOICE.md` §7 requires.

## What was deliberately not done

- **`Counter`'s limits and start value** — real ports, left at defaults. A step setting them would
  teach a knob rather than the idea.
- **Resetting the reaction along with the count.** Pressing `Rest` leaves `Ouch!` as it was. That is
  a true observation about state living in two places and it is pointed at in step 5's `detail`;
  fixing it needs a `Condition`, which belongs to `moods`.
