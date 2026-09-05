# Architecture

## Page map

- **Home** (`Pages/Home`) — The only page. Eleven logic nodes now sit beside the visual tree. This lesson adds four of them, and it is the first lesson to wire anything to the **Page** node itself.

## The tree this lesson adds

```
Card    (Group)                          lessons 1-6
  └ Nag (Text)                            ← step 6 — "Feed me.", Opacity on a wire

Home    (Page)                            ← step 2 — didMount → Patience.start
Patience      (Delay, type `Timer`)       ← step 2 — duration 5000
                                          ← step 2 — Poke.onClick → restart
Ignored       (Switch)                    ← step 3 — timerFinished → on
                                          ← step 3 — Poke.onClick   → off
Demanding     (And)                       ← step 4 — Ignored.state       → input 0
                                          ← step 4 — Mood Check.isfalse  → input 1
Fade the nag  (Animate To Value)          ← step 5 — duration 400, result → targetValue
                                          ← step 6 — currentValue → Nag.opacity
```

## 🔴 1. The node called `Timer` is called **Delay**, and it is a one-shot

`get_node_type("Timer")` returns `displayName: "Delay"`. The curriculum entry for this lesson says
`Timer`. A learner told to add a **Timer** will not find one in the picker, so the step body says
**Delay** and the `detail` says the type name once, to defuse it rather than hide it.

**Its ports are not what the name suggests either.** In: `start`, `restart`, `stop`, `duration`,
`startDelay`. Out: `timerStarted`, `timerFinished`. **There is no repeat and no `isRunning`
boolean.** Both facts shaped this graph:

- No repeat, so the clock is started from the page's **Did Mount** and restarted by the poke. That
  turns out to be the better design anyway — *five seconds after you stop* is a debounce, which is
  what `restart` exists for, and a tick would have needed suppressing.
- No `isRunning`, so nothing downstream can ask whether the countdown has run out. Hence §2.

Registered as row **H3** in `DEFECTS-LESSON-6-FOUND.md`, where it was found while scoping this
lesson from lesson 6.

## 🔴 2. A moment is not a fact, and the Switch is the only bridge

`timerFinished` is a signal. `And`'s inputs are booleans. There is no port on `Patience` that holds
*the countdown has already finished*, and there is no node that reads a past signal. So `Ignored`
sits between them as one bit of memory: **On** from the delay, **Off** from the poke.

This is `Poked`'s node from lesson 3, and using it again is the point. What is new is that **two
different events drive it in opposite directions**, which is why it takes `on`/`off` rather than
`flip` — a `flip` would make a second poke undo the first.

## 🔴 3. Measured with a control that could go red, then DRIVEN end to end

⚠️ **A static render cannot see this lesson at all.** The delay has not finished when the harness
screenshots, so the shipped solution renders with the nag at opacity 0 — which is also exactly what a
graph with every one of this lesson's wires missing would render. The static arm is worth one thing
only: that the page still loads clean (`placeholders: 0`, `consoleErrors: []`, 11 texts).

🔴 **And the first drive nearly proved nothing.** A screenshot taken at t≈0 and another at t≈8s both
showed the nag *visible* — because starting the browser and settling the page takes longer than five
seconds, so the delay had already fired before the first shot. That reading fits "the timer works"
and does not exclude "it was visible at load". The control that separates them is a second arm with
`Patience.duration: 60000`:

| arm | at t≈12s | what it proves |
|---|---|---|
| shipped (`duration: 5000`) | **`Feed me.` visible** | something reveals the nag |
| control (`duration: 60000`) | **absent** | it is the *delay* that reveals it, not the load |

Then the whole loop, clicked in a real browser (`render-from-disk` + `drive-page`):

| what was done | the card | what it proves |
|---|---|---|
| **Poke** ×5, then wait 8s | `delighted`, **no nag** | the delay fired and the `And` still refused — input 1 is load-bearing |
| **Rest** | `dozing`, **nag appears** | the `And` re-evaluates when either input moves |
| **Poke** | **nag fades out**, count `1` | `off` beats the standing `on`, and the countdown restarts |

`errors: []` throughout. The middle row is the one that matters: it is the only arm in which the two
inputs disagree, and without it an `And` wired to input 0 alone would pass every other check.

## ⚠️ 4. `And`'s inputs are `input 0` and `input 1`, with a space

The family is `numbered-inputs`: the port name is the family name, a space, and the index
(`nodedefinition.ts:144`), displayed as **Input 0** and **Input 1**. An authoring tool must write
consecutive indices from `0`; the editor always offers one more port than is connected.

`And` caches its answer and only flags `result` dirty when the *answer* changes rather than when an
input does (`and.ts:44`), so a graph that sets the same input twice costs nothing downstream.

## ⚠️ 5. `Nag` carries its `text`, and that is the exception

`Score`, `Story` and `Mood Line` all deliberately carry no `text`, so a broken wire falls back to the
catalog default and F4's placeholder check sees it. `Nag` is different: its words never change, and
the only thing the app decides about it is whether it is on screen. Its **opacity** is the port with
no parameter, and the same argument applies there — at load the `Animate To Value` adopts its first
value outright, so `0` arrives without anything being set.

⚠️ **Not `visible`.** That port sets `visibility: hidden` and keeps the space
(`node-shared-port-definitions.ts:346`), so the card would carry a permanent gap. The step's `detail`
says so, because it is the port immediately below **Opacity** in the same panel group.

## Data model

No records. Spine lesson 7 is still purely in-memory.
