# Seeing phase 36 work — a walkthrough

**Project:** `~/vscode_projects/NodeGX test projects/nodegx-debug-demo`
**Built:** 2026-08-02, for this purpose and no other. Safe to break — `build-demo.py` sits beside
`project.json` and puts it back.

The whole project exists to tell the one story phase 36 was created to answer:

> *"I clicked Add To Cart and nothing appeared in the list. Where did it stop?"*

---

## The graph, and where the bugs are

```
   ▶ ADD TO CART ──onClick──▶ Counter ──currentCount──▶ Text        ← this chain works
                                  │
                                  └──currentCount──▶ Variable "cart" ──value──▶ Repeater.items
                                                                                    ▲
                                                                    ⚠ a count, not a list

   States ──currentState──▶ Text
      ▲
      ⚠ set to "Clicked"; the states are "clicked, hover"
```

**Two chains leave the button, and that is deliberate.** One puts a number on screen, so *"the
button is broken"* is visibly false before you open anything. The other looks identically wired and
renders nothing.

**Why the bug goes through a Variable rather than straight into the Repeater.** A Variable's
`value` is `*` on both plugs, so the editor's *static* connection check has nothing to object to.
Wiring `Counter.currentCount` directly into `Items` would raise `con-type-mismatch` as well, and
the demo would be showing you the check that already existed. This is the class static checking
cannot see — which is the whole reason a runtime diagnostic earns its place.

---

## 1. Open it

Launcher → **NodeGX Debug Demo**. It opens on `/App`, and the preview starts with it.

Two nodes take a **danger ring** as soon as the preview has run once — no recording, nothing
clicked. Open the **Problems** panel and you should see:

⚠️ *An earlier draft of this file said "no preview, nothing running", and that was wrong.* A
diagnostic is a predicate a **node** evaluates, so a node has to exist to evaluate it, and nodes
exist in the running preview. What is true — and is the point — is that nothing has to have
*fired*: no recording, no interaction, no reproduction.

> **Repeater** — Items expects an array, received a number (0). Nothing will render — a Repeater
> indexes its input by position, and this value has no length.

> **States** — Cannot go to state "Clicked" — this node has no such state. Its states are: clicked,
> hover. **Did you mean "clicked"?**

That second one is the phase's original worked example, end to end: one capital letter, named.

## 2. Ask the question you would actually ask

Right-click the **Repeater** → **Why is "items" empty?**

The Provenance panel opens with the walk already in it:

```
Repeater.items          /App   0
cart.value              /App   0
cart.value              /App   0
Counter.currentCount    /App   0
Counter.increase        /App   undefined
▶ ADD TO CART.onClick   /App   undefined
```

Six hops, from the symptom back to the button, **with nothing having fired**. That is layer 1 —
current values on a cold editor — and it is why the panel is not gated behind Record.

*(`cart.value` appears twice because a Variable's input and its output are both called `value`.
Two ports, two rows.)*

The top row carries a small **⚠**. That is the only row here that has a diagnosis, and the marker
is how you can tell without clicking six rows to find out.

**Click it.** It expands in place, under the row:

> Node **Repeater** · Type For Each · Port **items (input)** · Current **0**
> ⚠ Items expects an array, received a number (0). Nothing will render…

That is layer 3 — and it is the difference between a walk that says *"it stopped here"* and one
that says *"it stopped here, **and this is why**"*.

**A click expands; the ↗ at the end of the row jumps to the node.** Two gestures, because they
are two different things and the second one replaces the panel with the property editor. (In the
first build a click did both, so the detail was never readable — the panel was gone before you
could look at it. Found by Richard on the first drive of this demo, 2026-08-02.)

## 3. Now do it with the app running

Start the preview, press **Record** in the Provenance panel, click **▶ ADD TO CART**, then walk
again. The panel changes shape:

```
Traced back 1 hop to a root event.
2 rows · cause chain

✓  Repeater.items   /App   1   fired   01:00:42
✓  cart.value       /App   1   fired   01:00:42
```

⚠️ **The row set changes, not just the glyphs.** Without a trace the walk follows *declared wires*
and shows everything upstream — six rows. With one it follows `cause`, which names the single edge
that actually delivered the value, so it **prunes to the chain that really ran**. Two rows, not six
annotated ones. That is the design's "layer 2 prunes the tree, it does not merely annotate it".

And note what those two ✓ actually tell you: **the data arrived.** The click fired, the counter
incremented, the value reached `Repeater.items` — and the list is still empty. Layer 2 has
eliminated the entire chain as a suspect and told you the bug is *at* the Repeater. Layer 3, one
click away on that row, is the only thing that says why.

✅ **The `✕` row does reproduce here** — an earlier draft of this file said it did not, and that
was a mistake about *ordering*, not about the feature. Press **Record** and walk **before**
clicking anything: all six rows come up `✕ never fired`, because with a recording in effect a
silent edge is known to be silent rather than merely unobserved. Then click the button and the
same walk collapses to the two-row causal chain above. The `✓`/`✕` boundary is visible in one
session, both ways round.

⚠️ **The panel now keeps itself current while recording** (a 1.5s pull, only while Record is on
and a walk is on screen). Before that it did not, which meant pressing Record put six `✕ never
fired` rows on screen and *left them there* through the interaction you were recording — the
panel said "never fired" about a chain you had just watched run, until you pressed Refresh. A `✕`
you have to remember to re-check is a `✕` you cannot believe.

## 4. Fix one and watch it clear

Right-click the **States** node first. It offers *"Why is "currentState" not working?"* — and it
only does so because the node is currently complaining.

⚠️ **A wire is not the only way a port gets a value, and the first build assumed it was.** The
menu was built from a node's *connections*, so `States` — broken by a parameter, with nothing
wired into it at all — offered nothing whatsoever. The walk was unreachable from the node wearing
the ring. It now also offers the inputs the author has typed into, on a node that is reporting
something. The walk is one row long, and that row carries the diagnosis, which is the whole of
what is wanted here.

Then set the States node's **State** input to `clicked` (lower case). The ring and the Problems
entry disappear.

⚠️ Worth knowing what that is proving. A failure raised on the runtime error bus has **no path back
to the editor** — `createEditorWarningSubscriber` only ever sends. Before this phase the node would
have stayed red for the rest of the session after you fixed it. `states.ts` now withdraws the claim
explicitly. Most other nodes in the library still do not; that is open question 5 in the
[README](./README.md).

Then set the Repeater's **Items** to `[{"a":1},{"a":2}]`. Its warning clears too — and is replaced
by the *next* real problem, `repeater/no-template-for-item`, which is what a working Problems panel
does.

## 5. The agent path, if you want it

```bash
cd packages/nodegx-observe && npm run build
node bin/nodegx-observe.js --help
```

It attaches to the running editor's relay, needs no access to the project on disk, and exposes the
same walk as MCP tools. It reads the relay token from `<userData>/relay-token` automatically.

⚠️ **The token changes on every editor launch.** Anything holding one across a restart is refused
with close code 4401.

---

## What to look at critically

Honest list, because the point of you seeing it is to find what I could not.

- **Is the walk readable at 6 rows, and would it be at 60?** The design claims scale comes from
  topology rather than filtering. This project is far too small to test that claim.
- **Is "Why is *X* empty?" the phrasing you would look for?** It is on the node menu per connected
  input, and on any wire as "Where does this come from?".
- **The Repeater's message names a consequence** ("Nothing will render — a Repeater indexes its
  input by position"). Every diagnostic in the batch tries to. Is that useful or is it noise?
- **Two rows for a Variable** (`cart.value` twice) is correct and looks like a duplicate.
- **The panel's status line describes the walk, not the session.** It can read "No recording" while
  the Record button reads "Stop", because the sentence is about how the *rendered walk* was built.
  Momentarily confusing.
- **A broken node's menu can be long.** Right-clicking `States` offers one question per input the
  author has typed a value into — five of them — because nothing tells the editor *which* input
  the diagnosis is about. Every one of them reaches the same diagnosis; only the `Current` value
  on the row differs. Whether the diagnostic channel should carry a port name is the open
  question underneath that.
- **A deep row's value is ellipsised to almost nothing** when the label is long (hover it, or
  expand the row). The label is kept whole in preference to the value, on the grounds that the
  value is one click away and the port name is not.

Two items that were on this list have been closed by the first live pass: the list now marks rows
that carry a diagnosis with a **⚠**, and the `✕ never fired` case reproduces (see step 3).

## Regenerating the project

`build-demo.py` sits **inside the project directory**, next to `project.json`. Re-running it
rewrites `project.json` in place and touches nothing else — the fastest way back to a known state
after breaking things deliberately:

```bash
python3 "~/vscode_projects/NodeGX test projects/nodegx-debug-demo/build-demo.py"
```

It lives with the fixture rather than in the repo because it *is* the fixture — one component, nine
nodes, five wires — not a fixture framework.
