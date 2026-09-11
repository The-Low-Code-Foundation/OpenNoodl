# Architecture

## Page map

- **Home** (`Pages/Home`) — The only page. Five logic nodes now sit on the canvas beside the visual tree: lesson 3's `Poked` and `Ease the poke`, lesson 4's `Pokes`, and this lesson's `Caption` and `Excitement`.

## The tree this lesson adds

```
Page shell  (Group)                      lessons 1-2, untouched
  ├ Card    (Group)                       lesson 1, untouched
  │   ├ Creature (Circle)                 lesson 1 — its Size now arrives on a wire
  │   ├ Name     (Text)
  │   ├ Reaction (Text)                   lesson 3
  │   ├ Score    (Text)                   lesson 4, untouched — still the raw number
  │   └ Story    (Text)                   ← step 3 — NO text parameter
  └ Board   (Group)                       lesson 2, untouched

Poked          (Switch)                   lesson 3
Ease the poke  (Animate To Value)         lesson 3
Pokes          (Counter)                  lesson 4 — currentCount now feeds THREE nodes
Caption        (String Format)            ← step 2:  format "Nibbles has been poked {count} times"
                                          ← step 3:  formatted     → Story.text
                                          ← step 4:  currentCount  → count
Excitement     (Expression)               ← step 5:  "min(96 + pokes * 8, 200)", currentCount → pokes
                                          ← step 6:  result        → Creature.size
```

## 🔴 1. The wire from `Excitement` leaves `Result`, and it CANNOT leave `As Number`

This is the single thing about this lesson that will not be re-derived from reading the graph, and it
cost four renders to find.

**`Expression`'s `asNumber`, `asString` and `asBoolean` outputs are never flagged dirty.** The
evaluation in `expression.ts:238-240` flags `result`, `isTrue` and `isFalse` and nothing else, so a
wire leaving any of the three `as*` ports delivers whatever the getter happened to return when the
connection was made — and then never updates again.

For a number port that value is `NaN`, because an `Expression` seeds unarrived inputs to `undefined`
deliberately (NDA-017 §2, `expression.ts:173-186`) so that a node with nothing to answer with
abstains rather than answering a plausible `0`.

**What that looks like on screen: the creature disappears completely.** `Circle.size` receives `NaN`,
the wire takes precedence over the `size: 96` parameter, and the circle renders at zero pixels — with
`placeholders: 0`, `consoleErrors: []` and every other number in the render report unchanged. Nothing
in the graph, the scorecard or the report says anything is wrong.

⚠️ **`distinctAccents` did not see it either.** The render report showed `accents: 0` for lesson 4's
*correct* solution, which draws a `--primary` circle 96px across — so the one metric that looks like
it would catch a missing coloured shape reads the same whether the shape is there or not. **The
screenshot is what caught this**, and it is the reason step 6's `detail` names **Result** explicitly.

Registered as `DEFECTS-LESSON-5-FOUND.md` row **G1**.

## 🔴 2. `Story` carries no `text` parameter, and that is load-bearing

Same rule as `Score` in lesson 4, and for the same reason: with the port unset, a node whose wire
stops delivering falls back to the catalog default string `Text`, which **F4's placeholder check
sees**. A parameter there would swallow the failure the gate exists to catch.

✅ **Measured with a control pair, not predicted.** Rendering the solution alone cannot tell a live
wire from a dead one when the value happens to be `0`, so a second arm was rendered with
`Pokes.startValue = 5`:

| arm | the card says | the circle |
|---|---|---|
| shipped (`startValue` default) | `Nibbles has been poked 0 times` | 96px |
| control (`startValue: 5`) | `Nibbles has been poked 5 times` | **136px** = 96 + 5×8 |

Both numbers move, both by the right amount. That is what proves the two chains are live and
reactive; the shipped arm on its own proves neither.

## ⚠️ 3. Both new nodes mint their input ports from text the author types

`Caption`'s **count** port exists only because `{count}` appears in its `format`
(`stringformat.ts:80`), and `Excitement`'s **pokes** port exists only because `pokes` appears in its
`expression` (`expression.ts:727`). Two consequences worth holding:

- **Order matters when authoring.** The parameter must be set before anything can be wired to the
  port it creates. Step 2 sets the format and step 4 draws the wire, which is why they are two steps.
- **`min` does NOT become a port.** It is one of the preamble aliases in `portsToIgnore`
  (`expression.ts:687-716`), along with `max`, `round`, `floor`, `abs` and `Math` itself. An
  expression using `Math.min` would work equally well; `min` is used because it is shorter and is
  what the node's own preamble provides.

## ⚠️ 4. An unset `{tag}` is replaced by nothing, not by "undefined"

`stringformat.ts:92` substitutes `''` for an unset placeholder. This is why step 3 is worth doing
before step 4 rather than merging them: the learner sees *"Nibbles has been poked  times"* with a
visible hole, and then fills it. The hole is the clearest picture of a template waiting for a value
that the lesson can offer, and it exists for free.

## Data model

No records. Spine lesson 5 is still purely in-memory.
