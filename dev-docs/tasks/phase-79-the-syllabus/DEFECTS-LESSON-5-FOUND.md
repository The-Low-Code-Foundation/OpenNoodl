# Defects building spine lesson 5 found

**Opened 2026-09-05 while building [SYL-008](SYL-008-LESSON-5-SHOW-WHAT-IT-FEELS.md).** Every row is
a finding about the *product or the lesson tooling*, not about lesson 5 — lesson 5 works around each
one and ships. Rows carry an **owner or `NONE`**; `NONE` means nobody is doing this and it will be
rediscovered at full price by whoever writes lesson 6.

⚠️ None of these blocked an acceptance criterion, so none was fixed here. The standing rule is build
the tasks, not farm the defects. The earlier registers are
[DEFECTS-LESSON-2-FOUND.md](DEFECTS-LESSON-2-FOUND.md) (5 rows) and
[DEFECTS-LESSON-3-FOUND.md](DEFECTS-LESSON-3-FOUND.md) (4 rows); **all nine are still open**.

| # | severity | owner | one line |
|---|---|---|---|
| G1 | 🔴 high | ✅ **FIXED 2026-09-05 (s9)** | an **Expression**'s `As Number` / `As String` / `As Boolean` outputs never update |
| G2 | ⚠️ medium | `NONE` | the render report's `distinctAccents` reads `0` for a page drawing a `--primary` circle |
| G3 | ⚠️ medium | `NONE` | `derive_starter` reports a wrong port name and a benign cascade with the *same* sentence |
| G4 | low | `NONE` | nothing checks that a spine lesson's outro promises something the next lesson can deliver |

---

## G1 🔴 — an Expression's As Number / As String / As Boolean outputs never update

**The shape.** `Expression` declares fourteen ports. After every evaluation it flags exactly three
outputs dirty:

```ts
// packages/noodl-runtime/src/nodes/std-library/expression.ts:238-240
this.flagOutputDirty('result');
this.flagOutputDirty('isTrue');
this.flagOutputDirty('isFalse');
```

`asString`, `asNumber` and `asBoolean` are declared as outputs with getters
([`expression.ts:616,626,636`](../../../packages/noodl-runtime/src/nodes/std-library/expression.ts#L616))
and **are never flagged anywhere in the file** — the only other `flagOutputDirty` call in it is for
`error`. A wire leaving one of those three therefore delivers whatever the getter returned at the
moment the connection was made, and never delivers again.

**What the first value is, and why it is worse than stale.** An `Expression` seeds every discovered
input to `undefined` rather than `0`, deliberately, so that a node with nothing to answer with
abstains instead of publishing a plausible number (NDA-017 §2, `expression.ts:173-186`). So the
getter's first reading is computed over `undefined` — `NaN` for `asNumber`, `''` for `asString`.

**Measured, four renders, with the hypothesis split each time.**

| arm | wire | what drew |
|---|---|---|
| lesson 4 baseline (untouched) | none | blue circle, **96px** |
| lesson 5, first build | `asNumber → Creature.size` | **no circle at all** |
| probe A | `Expression("150").asNumber → Creature.size` | **no circle** — so not the input |
| probe B | `Expression("150").asString → Story.text` | **empty string**, not `150` |
| probe C | real expression + real Counter wire, `asString → Story.text` | **empty string** |
| the fix | `result → Creature.size` | circle **96px**; control at `startValue: 5` → **136px** |

🔴 **Every gate stayed green through all of it.** `create_lesson` scored F1–F4 `pass` on the build
with the vanished creature; the render report gave `placeholders: 0`, `consoleErrors: []`,
`overflowingCount: 0`, and the same text counts as the working arm.

**Why this is high.** `Expression` is a core node — it is one of the three sanctioned ways to compute
in this product, named in `authoringTraps` §9 — and three of its fourteen ports are dead for wiring
with no warning anywhere. `As Number` is the port an author reaches for when the target is a number
input, which is exactly when the failure is silent and total: `NaN` into a dimension port renders
nothing, and the parameter that would have saved it is overridden by the wire.

**Two candidate fixes, and they are not equivalent.** Flag the three ports alongside `result` (one
line, and the ports start working); or delete them and let `result` carry everything (smaller
surface, but it breaks any existing project wired to them). ⚠️ **Whichever is chosen, build the
reverted arm** — a check that does not go red on today's runtime is measuring nothing.

**Worked around in lesson 5** by wiring `result`, with the rule written into the bundle's
`CLAUDE.md` and `docs/CONVENTIONS.md`, and named explicitly in step 6's `detail` so a learner does
not pick `As Number` and get a blank card with a green tick.

---

## G2 ⚠️ — the render report's `distinctAccents` reads 0 for a page drawing a --primary circle

**The shape.** `measure-from-disk.js` over lesson 4's **correct** solution — which draws a
`--primary` blue `Circle` 96 pixels across, occupying about 7,000 px² of a 1,152,000 px² viewport —
reports:

```json
"colors": { "distinctAccents": 0, "accents": [], "distinctNeutrals": 3 }
```

It reads the same for lesson 5's broken arm, in which the circle is not on the screen at all.

**Why it matters.** This is the metric a reader reaches for to answer *"is the accent colour actually
being used on this page?"*, and it is the one that looked like it had confirmed the absence during
this session's debugging — an absence it cannot see either way. The finding was made by **looking at
the screenshot**; had the numbers been trusted, the conclusion would have been "the circle was never
there in lesson 4 either", which is false and would have shipped a broken creature into the spine.

⚠️ Same family as
[[a-css-background-is-invisible-to-both-instruments]] — recorded here because the instrument is the
one the whole lesson programme measures with.

**Not diagnosed further.** Whether `Circle` paints through a route the accent scan does not walk, or
whether the scan's area threshold excludes it, is unmeasured. The row is the reading, not the cause.

---

## G3 ⚠️ — derive_starter reports a wrong port name and a benign cascade identically

**The shape.** Lesson 5's `derive_starter` run reported four retractions of kind `unsupported`:

```
no formatted → text wire exists between those nodes in the solution.
no currentCount → count wire exists between those nodes in the solution.
no currentCount → pokes wire exists between those nodes in the solution.
no result → size wire exists between those nodes in the solution.
```

All four wires **do** exist in the solution. The sentence is true only at the moment it is evaluated:
an earlier step in the same run removed the node with `hasType`, and its wires went with it.

**Why it matters.** A step whose `connection` condition has a **typo'd port name** produces the
*identical* sentence. So the one diagnostic that would catch the most common `connection` mistake is
indistinguishable from the most common benign case, and a reader who has seen the benign one twice
will skim past the real one.

**How this session avoided being caught by it.** Not by reading the message — by having already
proved each of the four wires live in a render. That is a control the next author may not happen to
have run first.

**The fix is a sentence, not a mechanism**: say *"the node was already removed by step N, and its
wires with it"* when the endpoint is gone, and keep *"no such wire"* for when both endpoints are
present.

---

## G4 low — nothing checks that a spine lesson's outro promises something deliverable

**The shape.** Lesson 4's outro ends: *"Now look at what your card actually says. It says `3`… That
is the next lesson."* Lesson 5 **cannot** make it stop saying `3`. `derive_starter` only subtracts a
lesson's own graded steps from its own solution, so `solution(5)` must still contain lesson 4's
`Score` node and its wire, and a spine lesson can never delete, re-parent or hide anything an earlier
lesson built.

`LESSON-VOICE.md` §7 makes the forward hook **mandatory** and requires it to name *"a concrete
deficiency in the thing the learner just built"*. It does not say the deficiency has to be one the
next lesson can remove — and with the chain rule in force, only *additive* deficiencies ever are.

**The rule that follows**, and it belongs beside the two already recorded:

> An outro may promise the app will GAIN something. It may never promise that anything already on
> screen will change or go away.

⬜ **A prose edit to lesson 4's outro is owed.** It is a popup with no `completeWhen`, so it is free
to change — no `derive_starter`, no re-drive. Lesson 5 meanwhile turns the surviving raw number into
its outro's illustration of one value feeding three consumers.

**Why it is low rather than medium.** It has bitten once, the cost was a paragraph, and the fix is
prose. It is registered because the next author will hit it the moment they write lesson 6's outro,
and because `LESSON-VOICE.md` §7 currently reads as though any deficiency will do.


---

## ✅ G1 — FIXED 2026-09-05 (session 9)

Option 1 of the two the row offered: the three ports are flagged alongside `result`, so nothing
already built moves and the ports start working. `expression.ts` now flags `asString`, `asNumber`
and `asBoolean` **inside** the existing `!hadEvaluated || lastValue !== cachedValue` guard — all
three are pure functions of `cachedValue`, so a result that has not moved must not wake their
consumers either. That is a control row, not a detail.

🔴 **The gate had to measure a WIRE, not a getter.** `getOutput('asNumber').value` calls the getter
directly and is therefore correct at HEAD, defect and all — a spec written that way passes against
the broken runtime and grades nothing. Every row drives a real graph through the corpus harness with
a **sink node recording what it actually received**. Built as the reverted arm first: at HEAD the
four typed-output rows are red and the `result` control is green.

`packages/noodl-runtime/test/corpus/syl-g1-expression-typed-outputs.test.ts`, 6 rows including the
lesson-5 shape (`96 + pokes * 8`, 0 → 96 and 5 → 136) and two controls. Full `noodl-runtime` suite
after the fix: **2662 passed, 0 failed** across 154 suites.

⚠️ **One number in the row above is stale and is corrected rather than quietly dropped.** It
recorded the first `asNumber` reading as `NaN`; the getter now ends `Number(val) || 0`, so an
unevaluated expression reads **0**. The port was equally dead either way, and `0` into a dimension
is exactly as invisible as `NaN`, so the row's conclusion is untouched — but the mechanism sentence
was written against an older getter.

🆕 **Found while fixing, not part of the row: the code export did not share the defect.**
`nodegx-export`'s `plan.ts` lists all six in `EXPRESSION_VALUE_OUTPUTS` and derives the typed ones
from the expression's value (`asNumber` → `Number(x) || 0`, verbatim). Read from source, not driven.
So an **exported** app would have animated the creature that the editor's own runtime could not —
the two implementations of one node had disagreed, and the shipped one was the one that was wrong.
Worth a thought for whoever owns the export/runtime parity question; not registered as a row,
because after this fix they agree.
