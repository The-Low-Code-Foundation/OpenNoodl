# NodeGX Charts

Two visual nodes — **Bar Chart** and **Sparkline** — that draw from an array.

## Wire it up in ninety seconds

1. Drop a **Static Data** node on the canvas and put an array in it:

   ```json
   [
     { "month": "Jan", "revenue": 32 },
     { "month": "Feb", "revenue": 48 },
     { "month": "Mar", "revenue": 41 },
     { "month": "Apr", "revenue": 67 }
   ]
   ```

2. Drop a **Bar Chart** and wire `Static Data → Items` into `Bar Chart → Series`.
3. Set **Value Key** to `revenue` and **Label Key** to `month`.

That is the whole chart. The same three steps work with an **Array** node, with a
query result, or with anything else that publishes an array.

If the rows are plain numbers (`[3, 1, 4, 1, 5]`), leave **Value Key** empty.

## The ports that are decisions, and the ones that are not

Everything you would want to change from the graph is a port: the colours, the
gaps, the radius, the baseline, the ceiling, whether labels show. They default to
your project's design tokens (`var(--primary)`, `var(--space-2)`,
`var(--radius-sm)`), so a chart looks like the rest of your app without being
told to.

What is deliberately **not** a port is any rule about what the numbers mean. There
is no "red when negative" and no number formatting. Those are decisions, they
belong in the graph where they are visible, and an **Expression** or **Function**
node makes them there — then wires the answer into `Bar Colour` or into the row
data itself.

### Scale

**Auto Scale** is on by default: the tallest bar is the largest number. Turn it
off and set **Baseline** and **Ceiling** by hand when two charts have to be read
against each other — with Auto Scale on, two charts of different data have two
different ceilings and comparing their bar heights means nothing.

With Auto Scale on, Baseline and Ceiling are still honoured as a floor and a
ceiling the data may widen, never narrow.

### Gaps

A row whose value is not a finite number draws **nothing** at that position, not
a zero. A zero is a claim about the data; a gap is a claim about our reading of
it. The sparkline joins the line straight across a gap.

## What the Bar Chart sends back

| Output | What it is |
|---|---|
| **Bar Selected** | A signal, when somebody clicks a bar |
| **Selected Index** | Which bar, from 0 |
| **Selected Value** | The number that bar was drawn from |
| **Selected Label** | The label under it |

The three values are published before the signal fires, so a graph that reads
Selected Value off the signal finds the new value already there.

## It exports

A chart built out of Groups with a wired `width` does not survive a React export:
a wired structure port means the rendered shape is not static, and the export
refuses the node rather than emit something that would be wrong. That is
[issue #39](https://github.com/The-Low-Code-Foundation/NodeGX/issues/39), and it
is why this kit exists.

These nodes are not subject to that refusal. A kit node's wired inputs become
ordinary React props and this file is copied into the exported repo and run
there — so the chart you see in the editor preview, in a deploy and in an
exported Next.js app is the *same source*, not three implementations kept in
step by hand.

⚠️ **The cost, stated plainly:** a kit is not in the node picker until somebody
installs it. If you have not installed this one, there is still no chart node.

## Editing it

`index.js` is hand-written, in one file, with no build step. Open it and change
it — it is yours after install. `types/node-kit.d.ts` sits next to it, so any
editor that speaks TypeScript autocompletes the port definitions with no npm
install and no tsconfig.

Two things in there are load-bearing and easy to undo by accident:

- **No `frame:` and no `inputCss`.** Both would give the node the editor's shared
  Layout ports — which the React export does not read. A size set through one
  would apply in the editor and be absent from the export. Size arrives on
  `Chart Height` / `Chart Width`, which are ordinary `inputProps`, so the two
  renders cannot disagree.
- **Nothing measures itself.** No bounding boxes, no `ResizeObserver`. The bars
  are percentage heights and the sparkline is a stretched `viewBox` with
  `vector-effect: non-scaling-stroke`, so both are correct on the first frame at
  whatever width the box happens to be — including in a server-rendered page,
  where there is no box to measure yet.
