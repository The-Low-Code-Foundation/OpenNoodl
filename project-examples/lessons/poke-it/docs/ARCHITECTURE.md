# Architecture

## Page map

- **Home** (`Pages/Home`) — The only page. `Page shell` holds `Card` (the creature, now with a reaction in it) and `Board` (the care strip, now with a button under it). Two logic nodes sit on the canvas beside them with no parent.

## The tree this lesson adds

```
Page shell  (Group)                      lessons 1-2, untouched
  ├ Card    (Group, contentSize)         lesson 1, untouched
  │   ├ Creature (Circle)
  │   ├ Name     (Text)
  │   └ Reaction (Text)                  step 3 — text only; its opacity arrives on a wire
  └ Board   (Group)                      lesson 2, untouched
      ├ Care  (Columns)                  lesson 2
      │   ├ Feed / Play / Sleep (Text)
      └ Poke  (Button)                   step 2 — label only

Poked          (Switch)                  step 4 — Poke.onClick → flip
Ease the poke  (Animate To Value)        step 5 — Poked.state → targetValue, duration 200
                                         step 6 — currentValue → Reaction.opacity
```

## 🔴 1. Why the chain is four nodes long, and why it cannot be shorter

**No visual node in this catalog has a signal input.** Every port on a `Text`, a `Group` or a
`Circle` is a value — `visible`, `opacity`, `text`, a colour. The pointer ports
(`node-shared-port-definitions.ts:801-880`) are all **outputs**. So a `Click` has nowhere on screen
to go, and every interaction in this product has the same joint in the middle: something that
catches a pulse and holds a value where the screen can read it.

That is the lesson's subject, and it is also the reason a shorter draft does not exist. It was
checked against the catalog rather than assumed: the only nodes that convert a signal into a value
are `Switch`, `States` and the variable nodes, and each of those is a later spine lesson's subject.
`Switch` is used here in its **converter** role, not its boolean-test role, and the step prose says
so.

⚠️ **`Timer` is not one of them.** Its display name is **Delay**, it lives under **Utilities**, and
it has no value output at all — only signals. A draft of this lesson that reached for a progress
number would have found none.

## 🔴 2. The one behaviour that was rendered rather than reasoned about

**`Reaction` is invisible when the page loads, and no parameter says so.**

This was a prediction until it was measured, and the mechanism is not obvious. `connectInput`
(`packages/noodl-runtime/src/node.ts:544`) reads `sourcePort.value` — the port's **cached** value —
and sends nothing if it is `undefined`. So a wire does *not* automatically pull its source. What
makes it work here is a chain of initialisations that each happen to push:

`Switch.onFromStart` has a default of `false`, and its setter calls `flagOutputDirty('state')` →
`state` caches `false` → `Animate To Value.targetValue` casts it to `0` and, because
`numberInitialized` is still false, **adopts it outright rather than animating to it**
(`animate-to-value.ts:110-116`) → `currentValue` caches `0` → `Reaction.opacity` receives `0`.

✅ **Measured**: `measure-from-disk.js` at 1280x900 draws the circle and `Nibbles` and no reaction.
🔴 **If any link in that chain stops pushing at init, the lesson ships with `Ouch!` visible on load
and step 6's `detail` becomes a lie.** A gate cannot see this — F4 passes either way, because a
visible word draws perfectly well.

## ⚠️ 3. `Poke` renders black, and that is the product's default, not a choice

`net.noodl.controls.button`'s `backgroundColor` port defaults to a raw `#000000`
(`nodes/controls/button.ts:41-46`), and its `variant` port — the one whose `primary` value would
paint a `--primary` ground — is **`allowConnectionsOnly`**, so it cannot be set from the properties
panel at all. The first button a learner adds to a token-based project is therefore off-palette,
and the on-system route is not offered to them.

**Left as it renders, deliberately.** Every parameter on a node this lesson creates is one a step
asks for, so the learner's result matches the answer; painting the answer's button and not theirs
would be worse than the wart. Registered as a defect instead.

## ⚠️ 4. `Poke` is left-aligned under a centred card

`Board` has no `alignItems`, and `Button` has no `alignSelf` port, so the only place the centring
could live is `Board` — which belongs to lesson 2, and an ungraded parameter there would leak into
this lesson's starter and break the chain. The button aligns with the left edge of the `Care` strip,
which is a coherent layout rather than a broken one.

## Data model

No records. Lesson 3 is still purely visual and reactive. The database arrives at spine lesson 8.
