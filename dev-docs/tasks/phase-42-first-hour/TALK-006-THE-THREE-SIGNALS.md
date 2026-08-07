# TALK-006 — Done / Completed / Unchanged: the semantics are fine, the surface is missing

Covers reported item **0**. A brainstorm doc, because the fix is partly a vocabulary decision.

## What was reported

> The new 'Done' and 'Completed' signals being on all logic nodes is great, but the semantics aren't
> clear at all. Sometimes you see 'Done', 'Completed', 'Unchanged' which I think is doubling up
> because I thought Done meant the node ran and it outputs a signal no matter if it changed or not?
> And Completed is only when the node took some action?

## First: the actual semantics, as decided and as built

Your own decision record (`dev-docs/reference/OUTCOME-CONTRACT.md`, decided 2026-08-01) — and the
guess above is **backwards**:

| Port | Means | Enforced at |
|---|---|---|
| **Done** | The action happened **and changed something** | `node.ts:882-883` |
| **Unchanged** | The action was valid and the post-condition already held — nothing needed doing | explicit no-op guards, e.g. `switch.ts:119-122`, `counter.ts:51-53` |
| **Failure** | Could not be performed; reason on the error channel | `node.ts:868-880` |
| **Completed** | Fires after **every** invocation, whatever the outcome — "carry on regardless" | `node.ts:894-895`, unconditional, single emit site |

Exactly one of Done/Unchanged/Failure per invocation (duplicate-report raises at `node.ts:856-865`),
then Completed, always. There is a `Treat Unchanged as` advanced input on the four Variables nodes.
The contract exists because of your own words in it: *"the workflow breaks at the point that one of
the nodes doesn't output anything because of a duplicate you didn't plan for, where you'd actually
like it to carry on running regardless"* — Completed is that carry-on wire.

So no, it is not doubling up **where Unchanged exists** — the three are cleanly disjoint there.

## Why it reads as unclear anyway — three real findings

**1. The descriptions exist and render nowhere.** Every one of the 82 adopting nodes has a bespoke,
correct `Done` description in the catalog — and signal ports have no property row by design, and the
canvas port hover renders nothing. `ERG-004-NOTES.md:596-598` already names this: *"a signal port's
description now exists, is correct, and still has nowhere to appear."* You are guessing at three
unexplained pulse ports because the editor gives you literally zero words about any of them.

**2. On 48 of the 82 nodes the distinction genuinely collapses.** Only 34 nodes have an `Unchanged`
port (they're the ones with a real no-op guard). On the other 48, `Done` degenerates into "it
worked" and adds nothing over `Completed` except excluding Failure. On **8 nodes** — including
`Condition`, a Logic node — there is no Unchanged *and* no Failure, so `Done` and `Completed` are
literally the same pulse: `Collection2`, `CollectionNew`, `Condition`, `NewModel`, `Page`,
`Unique Id`, `ComponentObject`, `SetComponentObjectProperties`.

**3. `Condition` is a semantic outlier by design.** Its `Done` means "an Evaluate you triggered
finished", not "something changed" (`condition.ts:136-145` argues this deliberately — testing a
condition always needs doing). The contract's headline sentence does not describe it. Also noted in
passing: `Counter.Reset` has a kept-verbatim defect (`counter.ts:84-98` reads `this.currentValue`
instead of `_internal`) so Reset can never report Unchanged.

## The conversation

**Q1 — Do the 8 double-pulse nodes keep both ports?** Options:

- **(a) Keep both everywhere (status quo).** Uniformity: an author can always wire Completed without
  checking whether this node has failure modes. Cost: on 8 nodes the two ports fire identically and
  invite exactly your confusion.
- **(b) Drop `Done` where a node has neither Unchanged nor Failure.** Honest per-node, but breaks
  the "every action has Done" regularity the AI vocabulary and docs now assume, and ERG-001 already
  measured that universality itself destroyed a validator rule's information value — pruning would
  partially restore it.
- My lean: **(a)**, and fix the comprehension problem with words (Q2) rather than port surgery —
  the contract's value is that wiring Completed is *never* a per-node decision. But this is your
  vocabulary, hence the talk.

**Q2 — Where do signal descriptions render?** This is the actual missing feature. Candidates:
canvas port hover tooltip (the surface `ERG-004` says renders nothing today — build it), and/or a
small legend row in the ports section of the property panel for signal outputs. Making port hover
work fixes this for all 153 nodes at once, not just the outcome trio. This becomes a task doc the
moment you pick a surface.

**Q3 — Rename?** If `Done` keeps confusing (it reads like "finished", i.e. what Completed means),
the honest names might be `Changed` / `Unchanged` / `Failed` / `Completed`. That's a big rename
across 82 nodes, docs, and the AI vocabulary — probably not worth it — but it's cheaper *now* than
it will ever be again, so it deserves one explicit yes/no from you.

## Related

Item 0.1 (array watchers) is answered in the README — `Array Changed`/`Object Changed` exist and
are richer than remembered. The `Condition`/`Counter.Reset` oddities above can ride along with
whatever Q1 decides.

---

## HAD — 2026-08-05

Every count above was re-derived from the **generated catalog** rather than from the prose that
produced it, and every mechanism re-read in the code. The numbers all hold: **82** nodes carry
`completed`, **all 82** carry `done`, **34** carry `unchanged`, **63** carry `failure`, **8** carry
neither, and they are exactly the eight named. `Treat Unchanged as` is on exactly 4 nodes (Boolean,
Color, Number, String). Zero nodes have `done` without `completed`. The semantics table matches
[`node.ts:825-903`](../../../packages/noodl-runtime/src/node.ts#L825-L903).

Three things in the doc were wrong, and each one changed an answer.

### Correction 1 — the argument for pruning `Done` does not work

The doc claims that dropping `Done` from the 8 degenerate nodes would "partially restore" the
information value ERG-001 destroyed. It would restore nothing. The proxy that died read *"publishes
a completion signal"*, and the set it reads is
[`CatalogIndex.ts:53`](../../../packages/noodl-editor/src/editor/src/validation/CatalogIndex.ts#L53):

```js
const COMPLETION_SIGNAL_NAMES = new Set(['success', 'done', 'completed', 'fetched', 'stored', 'saved']);
```

`completed` is in it, and `completed` is the one port with **no exemption**. Those 8 nodes stay in
the set whatever happens to their `Done`. Option (b) had a cost and, on inspection, no upside.

### Correction 2 — "build the canvas port hover" was the wrong surface, twice over

**There is no per-port hit-testing on the canvas at all.** The only canvas hover is node-level —
annotation, then health, then comment, in that priority order
([`NodeGraphEditorNode.ts:220-249`](../../../packages/noodl-editor/src/editor/src/views/nodegrapheditor/NodeGraphEditorNode.ts#L220-L249)).
The mouse handler knows about the node body, the border, and the connection-drag corner. Nothing
else. "Make port hover work" begins with building port hit-testing, which ERG-004's note
(*"the only surface it could use is the canvas port hover, which renders nothing"*) reads as a
rendering gap and is actually a missing model.

Meanwhile the **connection popup already has a per-port hover and a docs popup**
([`PortItem.tsx:21-65`](../../../packages/noodl-editor/src/editor/src/views/ConnectionPopup/components/PortItem.tsx#L21-L65)).
It sources its text from the *remote docs site's* HTML, keyed by lowercased display name, and only
when the node type has a `docs` URL — so for a port added since the docs were written, it shows
nothing. And one layer up,
[`ConnectionBar.tsx:33-42`](../../../packages/noodl-editor/src/editor/src/views/ConnectionPopup/components/ConnectionBar.tsx#L33-L42)
hand-copies eight fields off each port into the popup's own model, and **`description` is not one
of them**. The text ERG-004 restored into `NodeLibrary` is dropped one function before the
component that could render it.

### Correction 3 — Q3 was two questions, and the cheap half is one line

`displayName: 'Done'` is set in exactly one place,
[`outcome.ts:82`](../../../packages/noodl-runtime/src/outcome.ts#L82). All 82 nodes agree; zero
override it. A **display-only** rename is one line plus docs plus a catalog regen. The expensive
rename is the internal name `done`, which is written into every saved project's connections as
`fromProperty`. The doc priced them as one thing and got the expensive number.

### What the catalog says about the descriptions themselves

Measured, because it decides whether words alone can fix this:

| Port | Distinct descriptions across its nodes |
|---|---|
| `done` | **77** across 82 — bespoke and per-node, as claimed |
| `unchanged` | 31 across 34 |
| `completed` | **1** across 82 — the generic one, everywhere |

So a description surface fixes the confusion on the 74 nodes where the ports genuinely differ, and
**does not fix the 8**, where the two would read differently and still fire identically. That is
what Q1's answer had to cover, and the status quo did not.

### Decisions

| # | Decision | Consequence |
|---|---|---|
| 1 | **Keep both ports on all 82 — and make the generated `Completed` description say when it is redundant.** Wiring `Completed` stays a decision an author never has to make per node. | [FH-022](FH-022-WHEN-COMPLETED-IS-DONE.md). One branch in `outcomeOutputs`, generated, zero call sites edited, no port surgery, no saved project touched. It is also the only option that reaches the 8 nodes at all. |
| 2 | **The surface is a read-only `Ports` tab in the property panel** — every input and output, its type, what it accepts, its description, and whether it is connected, with the connected-source chip made clickable both ways. Not the connection popup, and not a canvas hover. | [FH-020](FH-020-THE-PORTS-TAB.md). Richard's reasoning is the deciding argument and is quoted in full there: **the connection popup filters by what you dragged from, which is right for wiring and useless for discovery** — you never learn a node's full output surface unless you happen to drag at a Function node. A port explorer, an explainer, and a navigation aid in one tab. |
| 3 | **No rename.** `Done` / `Unchanged` / `Failure` / `Completed` stand. | Comprehension is fixed with words and a surface (1 and 2), not with a vocabulary change that would have to propagate through the shipped docs, the AI vocabulary, the validator and 82 catalog entries. Reversing this needs a new argument. |

### Richard's argument for decision 2, verbatim

> I like the idea of having a way to see ALL inputs and outputs without dragging a connection, with
> annotations of what the port can connect to. For example when you drag and connect node A to node
> B where node B only has string inputs, it filters and limits what you see of the output ports on
> node A. This is right behaviour for the connection popups, but doesn't help the user know the
> potential of Node A if they never drag and connect to a Script node or something that would
> reveal all the possible outputs. […] I actually loved seeing on the State node when I hooked up a
> string node to the state node 'state' input, that it showed in the left props panel that the
> state was defined by another node, and clicking that pill takes you to the connected node, super
> cool. I'm picturing in my head a separate tab in every node props panel where you see all the
> ports (read only) and also if they're connected to anything, same pill system when you click the
> pill to get taken to that connected node. it doubles up as a port explorer, explainer and pathway
> helper.

Both halves of that already exist in the code and neither is where it needs to be — the chip is on
5 of ~29 row classes and reads inputs only; the tab strip exists in this panel but only on the AI
path. FH-020 is mostly promotion, not invention.

### The two oddities, rehomed

- **`Condition`** needs no separate fix. Decision 1 covers it: it is one of the 8, its bespoke
  `Done` description already says *"Fires once an Evaluate you triggered has tested Condition"*,
  and the appended sentence supplies the rest.
- **`Counter.Reset`** is a real defect and rides along in FH-021 slice 3 — with a warning the
  original note did not carry: **the obvious repair is also wrong.** The guard reads
  `currentValue === 0` ([`counter.ts:95`](../../../packages/noodl-runtime/src/nodes/std-library/counter.ts#L95)),
  but `Reset` sets the count to `startValue`, so simply pointing it at `_internal` would report
  `Unchanged` for the wrong condition. The correct guard compares against `startValue`, and that
  changes when `Count Changed` fires — which is why ERG-001 left it alone and why it gets its own
  slice rather than a one-word edit.
