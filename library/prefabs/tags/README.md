# Tags

A wrapping row of pills. Labels, categories, the chips left behind by a filter.

```
( Design ) ( Engineering ) ( Research )
( Marketing ) ( Onboarding ) ( Beta )
```

Out of the box it renders those six sample tags, so you see what it is the
moment you drop it on a page.

## Feeding it your tags

Tags are plain data — an array of objects with a `Label`:

```json
[{ "Label": "Design" }, { "Label": "Engineering" }]
```

Two ways to supply it:

1. **Connect the `Items` input** to any array — records from a query, a
   Function output, your own Static Data node. A non-empty connected array wins
   over the built-in samples.
2. **Edit the samples**: inside the **Tags** component, the **Sample tags**
   Static Data node holds the demo JSON.

## Inputs and outputs

| Input | What it does |
|---|---|
| `Items` | Your array of `{ Label }`. |
| `Generate colors` | Give each tag a colour derived from its own text, so the same label is always the same colour across the app. Off by default, and the samples show the plain pill. |
| `Default color` | The pill colour when colours are not generated. |
| `Removable` | Show an × on each pill. |
| `Clickable` | Make the whole pill a hit target with a hover. |
| `Direction` | `row` (default, wrapping) or `column`. |

| Output | When |
|---|---|
| `Tag clicked` | A pill was clicked — only fires when `Clickable` is on. |
| `Remove clicked` | The × was pressed. |
| `Tag Id` | The repeater item id of whichever tag the signal was about. Pair it with your source array to look the record up. |

Neither signal removes anything on its own: the list is yours, and the Tags
component reports rather than edits. Wire `Remove clicked` at whatever holds
the array.

## Things worth knowing before you change it

**The fallback is a Function, not a default.** `Choose items` takes the
connected array and the samples and picks: a connected array with anything in
it wins, an empty or absent one falls through. That is what makes the samples
vanish the instant your data arrives rather than fighting it.

**The colour is a hash of the label, not a position.** Two lists containing
"Research" give it the same colour, and re-ordering a list does not repaint it.

**The hover is a separate sheet, and the pill passes pointer events through
to it.** The pill declares `Pointer Events Mode: Explicit` with events off,
and the full-bleed `bg to hover` Group above it declares them on. Without the
mode the "off" is a parameter the runtime shows in the panel and the checker
reads as dead — the two have to be set together or the intent does not survive
a re-read.
