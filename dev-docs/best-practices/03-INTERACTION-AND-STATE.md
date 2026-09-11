# 03 — Interaction and state: hover, disabled, transitions, signals

A page with no hover, no pressed state and no transitions reads as a mockup even when every colour
and space is right. This is the layer that makes it feel built.

## Two different mechanisms, and the rule for choosing

NodeGX has two ways to change how something looks in response to something happening, and picking
the wrong one is the usual cause of "I could not make the hover work".

### 1. Visual states — per node, per port

Most visual nodes carry **visual states**, and most styling ports can hold a different value per
state. Set the hover colour on the node itself; the runtime handles the rest, with transitions.

**Know the limits, because they are asymmetric:**

| Node | States available |
|---|---|
| `net.noodl.controls.button` | neutral, **hover, pressed, focused, disabled** |
| `Group`, `Text`, `Image` | neutral, **hover** only |

So a Group has no pressed or disabled state. If you need a disabled treatment on something that is
not a Button, you need mechanism 2 — or an input that switches the values.

### 2. The `States` node — one state, many nodes, together

A `States` node is a named state machine: you declare the states, declare values per state, and its
outputs switch or tween when the state changes.

**Use it whenever one interaction must change more than one node at once.** The canonical case:

> A basket button is an icon *and* a counter. On hover the icon colour and the text style both have
> to change, together, with the same transition. Two independent per-node hover states will not stay
> in step, and cannot share a duration.

That is what the `States` node is for. Feed it the hover/pressed signal, take its outputs into the
icon's colour and the text's colour, and both animate as one thing. The same applies to a card whose
image scales while its title colour shifts, or a nav item whose underline and label move together.

**Rule of thumb:** one node changing → visual state on that node. Two or more nodes changing together
→ a `States` node.

## Every interactive component reports upward with a signal

A leaf component should not know what it means to be clicked. `MenuItem` does not navigate; it emits
`clicked` and carries a `destination` input, and its parent decides what a click does. That is what
makes the same component usable in a top bar, a footer and a mobile drawer.

- Expose the outcome as a **Component Output signal** (`clicked`, `submitted`, `dismissed`).
- Pass the *data* the parent needs alongside it as an output value (`destination`, `id`).
- The parent wires the signal into `RouterNavigate` (Navigate), `PageStackNavigate` (Push Component
  To Stack) or whatever the action is.

The alternative — a navigation node inside the leaf — welds the component to one destination and one
navigation style, and is the reason a component gets copied instead of reused.

## Navigation, and the two flavours of "page"

- **`Router` + `RouterNavigate`** — screens that deserve URLs. Aim navigation at a component's
  legacy name (`/Pages/Home`), never at an invented URL path, and remember a page is only reachable
  once the Router lists it.
- **`Page Stack` (Component Stack) + `PageStackNavigate` / `PageStackNavigateBack`** — screens that
  are steps in a flow. These hold ordinary **visual components**, not `Page` components, and are the
  natural home for a fade between screens, a drill-down, or a modal stack.

Both take a transition, and a menu whose items cross-fade rather than cut is most of what separates
"a website" from "an app".

## Empty, loading and error are states you design

A list with no rows should say what it is and what to do. A designed empty state is small: an icon in
a muted disc, one heading, one line, one action. Wire the collection's count into the empty state's
`visible` and the inverse into the list — falsiness does the switching, no logic node needed.

It is worth being blunt about why this matters: **first run is the only moment every user is
guaranteed to see**, and it is the moment a list is empty.

## Checklist for an interactive component

- Does it have a hover treatment? (If it can be clicked, it must.)
- If more than one node changes on hover, is that a `States` node rather than two independent ones?
- If it can be unavailable, does it have a disabled treatment — and is it a Button, which is the only
  thing with a disabled visual state?
- Does it report what happened as a signal, rather than acting on its own?
- Does it have a focus treatment? Keyboard users are not a later phase.
