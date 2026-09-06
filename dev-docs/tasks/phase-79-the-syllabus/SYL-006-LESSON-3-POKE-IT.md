# SYL-006 — lesson 3, "Poke it"

| Field | Value |
|---|---|
| **Prefix** | `SYL` |
| **Effort** | M |
| **Surface** | `project-examples/lessons/poke-it` |
| **Rules** | [R1](RICHARD-RULINGS-2026-08-28.md#r1--the-pet-spine-stands-as-written) (the chain), R3 via [SYL-001](SYL-001-THE-HAND-HOLDING-HALF.md) (`detail`), [LESSON-VOICE.md](LESSON-VOICE.md) |
| **State** | 🟢 **Built, gated and DRIVEN 2026-09-05** — control pair in a running editor, see [DRIVE-2026-09-05-THE-LESSON-RUNNER.md](DRIVE-2026-09-05-THE-LESSON-RUNNER.md). ⬜ **The prose is a draft awaiting Richard.** |

## What it is

Spine lesson 3, the first lesson in which the app does anything. A `Poke` button under lesson 2's
care strip and a `Reaction` text inside lesson 1's card, joined by the two logic nodes that stand
between a pulse and a pixel. Five graded steps between an intro and an outro popup.

```
Page shell  (Group)                      lessons 1-2, untouched
  ├ Card    (Group)                       lesson 1, untouched
  │   ├ Creature (Circle)
  │   ├ Name     (Text)
  │   └ Reaction (Text)                   ← step 3
  └ Board   (Group)                       lesson 2, untouched
      ├ Care  (Columns)                   lesson 2
      │   ├ Feed / Play / Sleep
      └ Poke  (Button)                    ← step 2

Poked          (Switch)                   ← step 4:  Poke.onClick → flip
Ease the poke  (Animate To Value)         ← step 5:  Poked.state → targetValue
                                          ← step 6:  currentValue → Reaction.opacity
```

## 🔴 The curriculum's two-node list is not buildable, and finding out is the lesson

Richard's entry names `Button` and `Animate To Value`. **Those two cannot be connected.** `Click` is
a signal; `Target Value` is a number; and the catalog was searched rather than guessed:

- **Every pointer port on every visual node is an OUTPUT** — `onClick`, `pointerDown`, `hoverStart`
  and the rest (`node-shared-port-definitions.ts:801-880`). **No visual node has a signal input at
  all.** So a click has nowhere on screen to go without something in between.
- The only signal-to-value converters in the catalog are **`Switch`**, **`States`** and the variable
  nodes — and each is a later spine lesson's named subject.
- ⚠️ **`Timer` is not one of them**: display name **Delay**, category **Utilities**, and no value
  output whatsoever ([E4](DEFECTS-LESSON-3-FOUND.md#e4-low--the-curriculum-names-a-node-the-product-does-not-have)).

✅ **That gap is not an obstacle to the lesson — it *is* the lesson**, and it is what Richard's own
sentence says: *"events are the pulses that say something just happened, and they are not the same
thing as a value."* The lesson names the joint explicitly in its outro.

⬜ **So the curriculum entry's `nodes` line needs a third name, `Switch`**, when the entry is
written — the same correction lesson 2 owed its `teaches` line.

## 🔴 The chain holds, and it now joins three lessons

`starter(3)` must equal `solution(2)`. **Measured, all four graph files byte-identical:**

```
components/Pages/Home/nodes.json        32dc0135fd4f06dd71734fe5564eddbe
components/Pages/Home/connections.json  2fcc3d1640d9556af4f6f05675b23051
components/App/nodes.json               d3879c5d820d78850703509ddc40a16e
components/App/connections.json         3df566acec8d974b2744359482badf95
```

and `lessons:check` prints the join in its own numbers, twice over:

```
✔ your-creature-on-screen  — clean (starter 2c/3n,  solution 2c/6n)
✔ it-breaks-on-a-phone     — clean (starter 2c/6n,  solution 2c/11n)
                                            ^^^ 6n                ^^^
✔ poke-it                  — clean (starter 2c/11n, solution 2c/15n)
                                            ^^^ 11n
```

**It constrained the build in one visible place.** `Poke` is left-aligned under a centred card
because the only node the centring could live on is `Board` — lesson 2's — and an ungraded parameter
there would survive `derive_starter` into this lesson's starter and break the join. `Button` has no
`alignSelf` port. Recorded in the bundle's `docs/ARCHITECTURE.md` §4 so it is not "fixed" later by
someone who does not know why.

## 🔴 Two things the render found that reasoning had not settled

| | what was assumed | what the instrument said |
|---|---|---|
| **the start state** | `Reaction` is invisible at load because the wire delivers `0` | ✅ **true, but not for the reason assumed.** `connectInput` reads a **cached** port value and sends nothing if it is `undefined` (`node.ts:544`) — a wire does not pull. It works here through a three-link initialisation chain, and F4 passes either way ([E3](DEFECTS-LESSON-3-FOUND.md#e3-️--a-new-wire-does-not-pull-its-sources-value)) |
| **the button** | a Button picks up the design system like every other node | 🔴 **it renders raw `#000000`.** Its `variant` port — the one that would paint `--primary` — is `allowConnectionsOnly`, so the on-token route is unreachable from the panel ([E1](DEFECTS-LESSON-3-FOUND.md#e1--a-button-cannot-be-put-on-the-design-system-from-the-properties-panel)) |

🔴 **The first row is the one to carry forward.** The prediction was right and the mechanism was
wrong, and the prose in step 6's `detail` explains the behaviour to the learner — so a runtime change
that broke the initialisation chain would turn a shipped explanation into a lie with every gate
still green. F4 renders the solution and a visible word draws perfectly well.

## ✅ A design measured and rejected before it was built

The corpus's own idiom for a smooth interaction is `anim-hover-highlight`:
`Switch → Animate To Value → Color Blend → backgroundColor`. It was the first design.

**`Color Blend` cannot take a design token.** It `parseInt`s a 6-digit hex three times
(`colorblend.ts:20-25`), so `var(--primary)` parses as `NaN` and the node outputs the string
`#NaNNaNNaN` — silently ([E2](DEFECTS-LESSON-3-FOUND.md#e2-️--color-blend-yields-nanannanan-for-every-token-colour-silently)).
The lesson animates `opacity` instead, which takes `Animate To Value`'s 0→1 with no arithmetic
anywhere — a better fit than the idiom it replaced.

## 🔴 `Flip`, not `On`/`Off` — the forward hook is a build constraint

[LESSON-VOICE.md §7](LESSON-VOICE.md) makes the closing hook structural: it must name a concrete
deficiency in the thing the learner just built. Lesson 4 is `it-forgets-you`, whose opening line is
*"Poke it twice and nothing accumulates."*

So lesson 3 **must not accumulate**, and `Flip` is what guarantees it: poke twice and you are exactly
back where you started. A `Counter` or a `Variable` here would take lesson 4's opening problem away.
Written into the bundle's `docs/CONVENTIONS.md` as a rule rather than left as an intention.

## Measurements — do not re-derive

| gate | reading |
|---|---|
| `create_lesson` | **F1 pass, F2 pass, F3 pass, F4 pass.** 5 graded steps. 🔴 **`allow_unrendered` NOT used** |
| `check_lesson` (re-score after the docs rewrite) | F1–F4 pass, 5 graded steps |
| `lessons:check` | **exit 0**, 4 bundles, 8 projects, 18 components, 80 nodes |
| the chain | 4 of 4 graph files byte-identical to lesson 2's solution (md5s above) |
| the subtraction, arithmetically | solution **15** nodes − starter **11** = the four the learner builds: `Poke`, `Reaction`, `Poked`, `Ease the poke` |
| `measure-from-disk` @ `1280x900` | 6 text elements, `overflowingCount: 0`, `consoleErrors: []`, `placeholders: 0`; **the reaction does not appear in the picture** |
| `tests-unit/rel-012` + `tests-unit/tut-004` | **109 passed, 7 suites, exit 0** — including AC2's *"seeds EVERY shipped bundle"*, which enumerates the directory and therefore graded this one |
| ⚠️ `typecheck` / `test:ci` | **not run, and not needed** — no TypeScript changed |

⚠️ **`paramsEqual: {duration: 200}` was checked against
[D1](DEFECTS-LESSON-2-FOUND.md#d1--create_lesson-cannot-catch-a-condition-a-learner-can-never-satisfy)
before it was written.** `Animate To Value.duration` is a bare `number` port with no `defaultUnit`
and no unit dropdown, so the unit trap that nearly shipped in lesson 2 does not apply here. That was
a `get_node_type` call, not an assumption — which is what D1 asks of every lesson until it is fixed.

## 6. ⬜ What was NOT done, and what it costs

🔴 **The lesson has not been driven in a running editor.** A peer session held the dev stack for a
REL-012 drive for most of this session and released it at the end; driving was not started rather
than being judged unnecessary.

**What a drive would still add, honestly scoped:**

| | answered? |
|---|---|
| does the solution render, and is the reaction invisible at rest? | ✅ **yes, measured** — `measure-from-disk.js`, and the screenshot was looked at |
| is `duration` free of the unit trap? | ✅ **yes, from the catalog** |
| does the bundle install through the real model? | ✅ **yes** — `tut-004` + `rel-012`, 109 green |
| **does the runner resolve a 5-segment node path?** | ⬜ **still no.** Inherited from lesson 2, which has a 6-segment path and was also never driven. This lesson's deepest is 5 (`…:#Page shell:#Card:#Reaction`) |
| **can a learner actually draw a signal wire to `flip`?** | ⬜ **NO, and this is new.** Lessons 1 and 2 have no connections at all. Three of this lesson's five steps grade a `connection`, and no spine lesson has ever had one observed on screen |
| **the negative control** — does the untouched starter refuse to tick? | ⚠️ **only structurally**, via `derive_starter`'s replay and F2 |

🔴 **The second row is the one that makes a drive worth more here than it was for lesson 2.** Signal
wiring is this lesson's entire subject and it is the one mechanism the bundle gate cannot exercise.

## What is Richard's

1. 🔴 **The step prose.** Seven bodies and five `detail` blocks, drafted so he is editing rather than
   staring at a blank page. Written to [LESSON-VOICE.md](LESSON-VOICE.md): em dashes, no
   contractions, British prose, node types bold, typed values in backticks.
2. **The `description`** — his curriculum sentence, extended to name why the gap matters.
3. **The badge**, currently `First Contact`.
4. **The reaction word**, currently `Ouch!` — ungraded, and the body says the word is the learner's.
5. ⬜ **Does the `Poke` button get a colour?** It is black today, which is the product's default and
   [E1](DEFECTS-LESSON-3-FOUND.md#e1--a-button-cannot-be-put-on-the-design-system-from-the-properties-panel).
   Fixing E1 fixes the lesson for free; styling the lesson around it does not.

## ⬜ The curriculum entry

`poke-it` **already exists** in `curriculum.json` (spine position 2, in the separate
`nodegx-community` checkout) — so unlike lesson 2 this lesson needs no new entry. It needs **two
edits** when R2's insert is made: `needs` moves from `your-creature-on-screen` to
`it-breaks-on-a-phone`, and `nodes` gains `Switch`. Neither gates shipping; the editor's Learning
shelf seeds from the repo directory, so this lesson already reaches every install.

## ✅ Driven 2026-09-05 — including the row this lesson existed to answer

Full method and caveats: [DRIVE-2026-09-05-THE-LESSON-RUNNER.md](DRIVE-2026-09-05-THE-LESSON-RUNNER.md).

| §6 asked | answer |
|---|---|
| 🔴 **can a learner actually draw a signal wire to `flip`?** | ✅ **the runner grades one.** All three of this lesson's `connection` conditions evaluate true on the solved copy and it completes — `onClick → flip` among them. ⚠️ That a **person** can produce the wire by dragging is a separate question this drive did not ask |
| **does the runner resolve a 5-segment node path?** | ✅ **YES** — `…:#Home:#Page shell:#Board:#Poke` |
| **the negative control** | ✅ **YES, observed on screen** — the untouched starter does not tick |

🔴 **This lesson is where the five-session-old question was settled: the runner grades a `connection`.**

**Two defects it surfaced**, both the runner's rather than this lesson's:
[J1](DEFECTS-THE-RUNNER-DRIVE-FOUND.md#j1--a-blockquote-renders-as-a-literal--in-the-line-carrying-the-lessons-whole-idea)
(the intro's blockquote renders as a literal `>`) and
[J2](DEFECTS-THE-RUNNER-DRIVE-FOUND.md#j2--check-my-work-on-an-incomplete-step-removes-the-instructions).
It also gave [D2](DEFECTS-LESSON-2-FOUND.md) its first on-screen sighting: step 1 says
*"Looking for a **net.noodl.controls.button**"*.
