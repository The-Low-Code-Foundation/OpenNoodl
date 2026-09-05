# SYL-010 — lesson 7, "It gets demanding"

| Field | Value |
|---|---|
| **Prefix** | `SYL` |
| **Effort** | M |
| **Surface** | `project-examples/lessons/it-gets-demanding` |
| **Rules** | [R1](RICHARD-RULINGS-2026-08-28.md#r1--the-pet-spine-stands-as-written) (the chain), R3 via [SYL-001](SYL-001-THE-HAND-HOLDING-HALF.md) (`detail`), [LESSON-VOICE.md](LESSON-VOICE.md) |
| **State** | 🟢 **Built, gated and DRIVEN 2026-09-05.** ⬜ **The prose is a draft awaiting Richard.** |

## What it is

Spine lesson 7, the first lesson in which the app does something **nobody clicked**. A **Delay**
started by the page itself, a **Switch** that remembers it ran out, an **And** that requires that
*and* a bad mood, and a line on the card that fades in to ask to be fed. **Five graded steps**
between an intro and an outro popup.

```
Card                                     lessons 1-6
  └ Nag (Text)                            ← step 6 — "Feed me.", Opacity on a wire

Home (Page)                               ← step 2 — didMount → Patience.start
Patience     (Delay, type `Timer`)        ← step 2 — duration 5000; Poke.onClick → restart
Ignored      (Switch)                     ← step 3 — timerFinished → on; Poke.onClick → off
Demanding    (And)                        ← step 4 — Ignored.state → input 0
                                          ← step 4 — Mood Check.isfalse → input 1
Fade the nag (Animate To Value)           ← step 5 — duration 400; result → targetValue
                                          ← step 6 — currentValue → Nag.opacity
```

## 🔴 A static render cannot see this lesson at all

The delay has not finished when the harness screenshots, so the shipped solution renders **exactly as
a solution with none of this lesson's wires would**: the nag sits at opacity 0 either way. The static
arm answers one question — the page still loads clean, `placeholders: 0`, `consoleErrors: []`,
11 texts — and cannot answer any other.

🔴 **And the first drive nearly produced a false pass.** Screenshots at t≈0 and t≈8s **both** showed
`Feed me.` visible, which reads like a working timer and is equally consistent with *visible at load*.
Starting Chrome and settling the page takes longer than five seconds, so there was never an
observation before the deadline. [[a-reading-that-fits-is-not-one-that-excludes]]

**The control that separates them** is a second project with `Patience.duration: 60000`:

| arm | at t≈12s | what it proves |
|---|---|---|
| shipped, `duration: 5000` | **`Feed me.` visible** | something reveals the nag |
| control, `duration: 60000` | **absent** | it is the *delay*, not the load |

## 🟢 Then the whole loop, clicked in a real browser

`render-from-disk.js` + `drive-page.js`, `errors: []` throughout:

| what was done | the card reads | what it proves |
|---|---|---|
| **Poke** ×5, wait 8s | `delighted`, count `5`, **no nag** | the delay fired and the `And` still refused |
| **Rest** | `dozing`, count `0`, **nag appears** | the `And` re-evaluates when *either* input moves |
| **Poke** | count `1`, **nag fades out** | `off` beats the standing `on`; the countdown restarts |

🔴 **The first row is the only arm in which the two `And` inputs disagree**, and it is the only thing
that can catch a lesson whose `input 1` wire was never drawn. Everything else in this lesson passes
with `Demanding` reading `Ignored` alone.

## Measurements — do not re-derive

| gate | reading |
|---|---|
| `create_lesson` | **F1 pass, F2 pass, F3 pass, F4 pass.** 5 graded steps, 16 conditions. 🔴 **`allow_unrendered` NOT used** |
| `lessons:check` | **exit 0**, 8 bundles, 16 projects, 34 components, 253 nodes |
| the chain | **4 of 4 graph files byte-identical** to lesson 6's solution, first attempt |
| the chain, in the checker's numbers | `3n → 6n → 11n → 15n → 18n → 21n → 25n → 30n` |
| the subtraction | solution **30** nodes − starter **25** = the five the learner builds |
| `measure-from-disk` @ `1280x900` | `placeholders: 0`, `overflowingCount: 0`, `consoleErrors: []`, 11 texts |
| the delay control | `5000` → visible at t≈12s; **`60000` → absent** |
| the live drive | the three rows above, `errors: []` |
| voice | 1618 words, **16 em dashes, 0 hyphen-dashes, 0 contractions** |
| ⚠️ `typecheck` / `test:ci` | **not run, and not needed** — no TypeScript changed |

## 🔴 The curriculum named four nodes; two are built, one is renamed, one would be wrong

- **`Timer`** ⚠️ the type name is right and **the picker shows `Delay`**. It is a one-shot countdown:
  no repeat, no `isRunning` boolean, only `timerStarted` and `timerFinished`. Both absences shaped
  the graph — see below. Found while scoping, registered as
  [H3](DEFECTS-LESSON-6-FOUND.md#h3--timers-display-name-is-delay-and-the-curriculum-calls-it-timer).
- **`And`** ✅ exactly right, and the lesson's centre.
- **`Or`** ⬜ named beside **And** in step 4's `detail` and in the outro, not built. Nothing in this
  app is true when *either* of two things holds.
- **`Inverter`** ⬜ named, not built, and **it would have been the wrong node.** `Mood Check` has
  published **Is False** since lesson 6, so an `Inverter` on **Is True** is a second node saying what
  one wire already says. Building it would teach a habit this product's port sets exist to remove.

⬜ **Curriculum correction owed**: `it-gets-demanding`'s `nodes` should read `Timer`, `Switch`, `And`,
`Animate To Value`. **`Switch` is unavoidable and is the lesson's real hinge** — an `And` cannot read
a signal, and there is no port anywhere on the delay that answers *has it finished?*. That is now
**four** corrected entries out of seven built.

## 🔴 The design constraint that produced the graph: a moment is not a fact

`timerFinished` fires and is gone. `And` takes booleans. Nothing in the catalog reads a past signal.
So the `Switch` is not a stylistic choice — it is the only bridge, and it is the same node lesson 3
ships as `Poked`, doing the same job for a different event. What is new is that **two different
events drive it in opposite directions**, so it takes `on`/`off` rather than `flip`.

That constraint is worth more than the lesson's nominal subject: almost every graph that gets
complicated gets complicated at that boundary.

## ⬜ What was NOT done

- **The lesson runner is still unexercised.** Lesson 7 adds **eleven** graded `connection` conditions,
  taking the spine to **twenty-six** across lessons 3-7, none ever observed being graded in a running
  editor. It also adds a first: a condition on a wire leaving the **Page** node (`didMount`).
- **`tests-unit/rel-012` + `tut-004`.** A peer held the box with a 30-minute browser drive for the
  whole session and the standing rule is one heavy job at a time. **This is the next session's first
  five minutes**, and the bundle is committed so `shipped-lessons-reach-the-artefact` can see it.
- **The curriculum edits.** Five are now owed in `nodegx-community`, none blocking.

## What is Richard's

1. 🔴 **The step prose.** Seven bodies and five `detail` blocks.
2. **The `description`** — his curriculum sentence verbatim.
3. **The badge**, currently `Two Things At Once`.
4. 🔴 **The nag itself**, currently `Feed me.` — graded with `paramsEqual`.
5. 🔴 **The five seconds** (`duration: 5000`) and **the fade** (`400`). Both graded, both named in the
   step body, and both arbitrary.
6. **Whether `Rest` should also silence the nag.** It does not today: `Rest` clears the count, which
   makes Nibbles bored, which makes it *start* asking. That is defensible and it is a design call.
