# Advanced Columns

A Columns node with as many breakpoints as you want, and a different layout **and**
gaps at each one.

The Columns node itself has two bands — Medium and Small — and they swap the layout
string, nothing else. This is the other answer to that, and it is the one
[#22](https://github.com/The-Low-Code-Foundation/NodeGX/issues/22) asked for: not a
hundred more ports on the node, but a component that drives the ports it already has
from a **States node** you can open and edit.

Drop your content straight into it — the instance takes children like a Group.

| Where | What to change |
|---|---|
| On the instance | `Large Below`, `Medium Below`, `Small Below` — the widths the bands change at. Leave one empty and its shipped default stands (1200 / 900 / 600). |
| `Which band` (Expression) | Those same defaults, and the order the bands are tested in. Edit here to add a band. |
| `Breakpoint settings` (States) | What each band looks like: `Layout`, `Horizontal Gap`, `Vertical Gap`. |
| Output `Breakpoint` | Which band the instance is in now, as a string — wire it out if you want to react to it. |

Shipped set up as four bands:

| Band | Container width | Layout | Gaps |
|---|---|---|---|
| Default | 1200px and up | `1 1 1 1` | 24 |
| Large | 900–1199px | `1 1 1` | 20 |
| Medium | 600–899px | `1 1` | 16 |
| Small | below 600px | `1` | 12 |

**Retuning is an instance port; adding a band is an edit inside.** Moving a width is the
common change and does not need the component opened at all — the three ports on the
instance override the defaults, and an empty one is not an override.

## Adding a band

Two edits, and they have to agree:

1. In `Breakpoint settings`, add the name to **States** — say `Tiny` — and fill in its
   `Layout`, `Horizontal Gap` and `Vertical Gap`.
2. In `Which band`, add the step to the expression and its width to the ports beside it:
   `width < tiny ? 'Tiny' : width < small ? 'Small' : …`. To let instances retune it too, add a
   port to `Component Inputs` and wire it to the new argument — the same pair the other three use.

A name in the expression that the States node does not have is the one mistake worth
knowing about: `goToState` refuses it out loud rather than moving the layout somewhere
odd, so check the runtime warnings if a band stops changing anything.

## Decisions worth knowing before you change it

**It measures the Columns node's own box, not the window.** That is the whole reason
this is not built on the Media Query prefab, which is keyed on `window.matchMedia`:
a viewport query cannot see that the same component is inside a 320px sidebar on a
1600px screen. Everything here is container-keyed, like the Columns node's own
breakpoints.

**The width it reads is one gutter wider than its parent.** A Columns node renders
`width: calc(100% + Horizontal Gap)` with a matching negative margin — that is how the
gutters land on the outer edges — so `Breakpoint` flips a few pixels earlier than the
round number in the expression. It is stable, not oscillating: the gap only changes
after the band has, and the new width lands well inside the new band.

**The breakpoint widths live in the Expression, not in the States node**, and they
cannot live there. A States node publishes only the values of the state it is *in*,
so a list of thresholds — which has to be readable all at once to decide which band
you are in — has nowhere to sit in it. Everything that varies *per band* is in the
States node; the one thing that has to be known *about every band* is beside it.

**The node's own Medium/Small ports are deliberately left empty.** Two mechanisms
picking the layout string is one too many; this component is the one that decides.
If you would rather use the node's own bands, you do not need this prefab at all.
