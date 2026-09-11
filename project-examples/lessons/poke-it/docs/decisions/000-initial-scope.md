# 000 — Initial scope

_Recorded 2026-09-05, from the scoping conversation held before this project was authored._

## What was asked for

> Build spine lesson 3, "Poke it", from Richard's curriculum entry: "The card ignores you. Events
> are the pulses that say something just happened, and they are not the same thing as a value."
> Teaches events and event handlers. Nodes: Button, Animate To Value. 30 minutes.

## What was decided

**The app.** Lesson 2's card and care strip, plus a `Poke` button under the strip and a `Reaction`
text inside the card. Clicking the button fades the reaction in; clicking again fades it out.

**The chain is four nodes, and the curriculum's two-node list was not enough.** The entry names
`Button` and `Animate To Value`. Those two cannot be connected: `Click` is a signal and
`Target Value` is a number, and nothing in the catalog bridges them for free. A `Switch` was added
as the converter. ⬜ **The curriculum's `nodes` line therefore needs a third entry** when the entry
is written.

**`Flip`, not `On`/`Off`.** One button fires one signal, so `Flip` is the only input that makes each
click do something. It also produces the toggle that `it-forgets-you` opens by complaining about —
poke twice and nothing has accumulated — which is a forward hook the spine's lede requires.

**Opacity, not size or colour.** `Animate To Value` emits 0→1, and `opacity` is the only visual port
that takes that range with no arithmetic. `Color Blend` was considered and rejected: it `parseInt`s
a 6-digit hex (`colorblend.ts:20-25`) and its own port description says any other notation yields
nonsense, so it cannot take the `var(--token)` colours this project is built from.

**The reaction word is the learner's.** Graded `hasParams: ["text"]`, and the body says the word
does not matter and the node's **name** does. The same rule as lesson 2's three care words.

## What was deliberately not done

- **The button was not styled.** It renders black, which is the product's own default and a defect
  worth surfacing rather than papering over — see `docs/ARCHITECTURE.md` §3.
- **The button was not centred.** The only node the alignment could live on is `Board`, which
  belongs to lesson 2 and cannot take an ungraded parameter without breaking the chain.
