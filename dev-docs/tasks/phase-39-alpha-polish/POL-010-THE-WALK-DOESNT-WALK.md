# POL-010 — The provenance walk shows one hop and stops

Covers the second half of reported item **12**. (The first half — black text on a dark background —
is [POL-004](POL-004-TOKENS-USED-AS-WHAT-THEY-ARE-NOT.md), and must land first so the output is
readable while this is diagnosed.)

## What was reported

> It doesn't seem to show the real 'hops'. I asked why an input was empty and it doesn't mention the
> 'QueryMessages' node that feeds the items input, so it's not really showing the 'walking back from
> the node' theory it's supposed to.

The screenshot shows:

```
No recording. Showing each hop's current value; press Record to see which one never fired.
1 row · declared wires

·  filterCollection.items
     Node      filterCollection
     Port      items (input)
     Node id   filterCollection
     Current   –
```

And on the canvas, plainly visible: `Query Messages` → `Items` output, wired to
`Filter Messages By Conversation` → `Items` input. The wire the walk should have followed is drawn
two inches to the right of the panel saying there is one row.

## Status: DIAGNOSED — 2026-08-04

**It is candidate (1), and candidate (2) is wrong.** The walk engine is correct, the ids join fine,
and the topology it is handed genuinely does not contain the wire. Evidence below; slices rewritten
accordingly.

### Candidate (2) is a false lead, and so is the signal that suggested it

The spec reasoned from *"Editor node ids are UUIDs"*. They are not. Richard's chat project —
`components/Pages/Chat/nodes.json` — has fifteen nodes and every id is human-readable:

```
page, headerGroup, titleText, messagesGroup, messagesText, composerGroup,
messageInput, sendButton, pageInputs, messagesQuery, filterCollection,
currentUser, formatMessages, nowFn, createMessage
```

An agent-authored project names its nodes; the QA fixture does too (`btn`, `t1`, `c1`, `filt`). So
`Node id: filterCollection` was never suspicious — it is simply the id, and it matches the runtime's
id exactly. Nothing was failing to join.

What the *repeated* value means is different and is the real tell: when a node is **absent from the
topology**, the panel has no dictionary entry to read a name from, so it falls back to the id for
both `Node` and `Node id`. Two identical readable strings is the signature of a node the topology
never heard of — not of a mismatch.

### The engine walks, on real runtime ids

Run live against the erg-rig topology captured verbatim from a running viewer (real ids, real edges,
not a hand-written fixture):

| Target | Rows |
|---|---|
| `t1.text` — fed by `c1.currentCount` | **4** — `t1.text ← c1.currentCount ← … ← btn.onClick` |
| `filt.items` — nothing wired to it | **1** |

Four hops from one declared edge. The engine is not the defect, and `walkEngine.ts` needs no change.
`explainTerminus` returned `undefined` for the unwired root, so the panel has nothing to print about
why it stopped — that is slice 3's gap, now confirmed rather than assumed.

### The topology only contains what the preview has *instantiated*

Measured on Richard's chat project, opened live with a preview running:

- `TraceSession.instance` reported `isPreviewRunning: true`, `hasTopology: true`, **12 nodes / 10
  edges** — all of them `component: /erg-rig`, from the **previous project I had open**. The
  singleton has no reset path: `grep` for one finds none, `hasTopology` is set `true` once and never
  back, and `topology` is only ever replaced by a newly arrived dictionary. Switching projects leaves
  the old graph in place and claims it is current.
- `refreshTopology()` against the new project's own viewer returned **1 node, 0 edges** — the `App`
  component's `Router` alone. Its `startPage` is `/Pages/Signup` and the preview rendered blank, so
  no page mounted and **not one node of the Chat page existed in the runtime**.
- `components/Pages/Chat/connections.json` declares the wire Richard was looking at:
  `{"fromId":"messagesQuery","fromProperty":"items","toId":"filterCollection","toProperty":"items"}`.

So the editor knew the wire, the canvas drew it two inches from the panel, and the runtime dictionary
never carried it — because `buildSessionDictionary` walks
`rootComponent.nodeScope.getAllNodesRecursive()` and collects edges from `node._outputList[].connections`
(`nodecontext.ts:732`). A node that was never instantiated has no `_outputList`, so its wires do not
exist as far as the walk is concerned. The walk was truthful and useless, exactly as this file
predicted.

**"Preview live" means a viewer is attached. It does not mean the component you are looking at is
mounted in it.** That gap is the whole defect.

## What is known about the design

[`walkEngine.ts`](../../../packages/noodl-editor/src/editor/src/utils/provenance/walkEngine.ts) is a
pure function over two inputs — a **topology** and a **trace** — and its header states the rule that
makes it correct: *only declared edges are ever followed*, where the topology is the runtime's own
edge list built from `_outputList[].connections`. A port with no wire is not a step. This is the
explicit fix for the retired Data Lineage panel, which enumerated ports and produced 40+ noise steps.

Crucially: **the topology comes from a running viewer.**
[`TraceSession.ts:67-68`](../../../packages/noodl-editor/src/editor/src/utils/provenance/TraceSession.ts#L67-L68)
says *"Empty until a viewer answers"*, and `refreshTopology()` returns the last-known topology
immediately if there is no `clientId`.

So a walk with no edges is what you get when the topology is empty or does not match — and the
engine, correctly, will not invent hops the topology does not contain.

## Two candidate mechanisms

Neither is confirmed. The slice-1 job is to determine which, or find a third.

### (1) The topology is empty or partial

"Preview live" was showing in Richard's screenshot, so a viewer was connected — but connected is not
the same as *answered*. If `refreshTopology()` resolved from cache, or the dictionary arrived before
the component in question was mounted, the edge list would be missing the wire. The walk would then
be truthful and useless.

**Check:** log `session.topology.edges.length` and look for an edge whose `to` is the queried port,
at the moment the panel renders one row.

### (2) The ids do not match

This is the more suspicious one. The detail block reports:

```
Node      filterCollection
Node id   filterCollection
```

Node **id** equal to node **name** equal to what looks like a **type** name. Editor node ids are
UUIDs. If the ids in the topology are not the ids the editor knows, then `withEditorLabels`
(`TraceSession.ts:107`) has nothing to join on, the labels fall back to the id, and — far more
importantly — **edge lookup by node id cannot match**, so the walk finds no incoming edge and
terminates at the root.

That would produce exactly one row with a plausible-looking label, which is what the screenshot
shows.

**Check:** compare a node id in `session.topology.nodes` against
`ProjectModel.instance.findNodeWithId(...)` for the same node. If the topology's keys are not editor
ids, that is the defect, and it is upstream of the walk engine entirely.

## What to build

**Slice 1 — diagnose.** ✅ Done, above.

**Slice 2 — the structure should come from the project, not from the preview.**

The walk makes a claim about *the user's graph*. The graph is the editor's artefact and the editor
has all of it, mounted or not: every component, every declared connection, at all times. The runtime
has only what it happens to have instantiated, which depends on which page the router landed on.
Sourcing structure from the runtime makes the answer depend on something the user is not thinking
about and cannot see.

So: **build the topology from `ProjectModel`, and keep the runtime for what only it can answer** —
current port values (layer 1) and trace events (layer 2). `walkEngine` takes a `Topology`; where it
comes from is `TraceSession`'s business, so this is a change to one producer, not to the engine, and
`walkEngine.ts` stays import-free for OBS-004.

What it costs, and why it is still right: a project-sourced topology contains nodes the runtime has
never instantiated, so their current values are unknown. That is a *better* answer than silence —
"`messagesQuery.items` feeds this, and it has not run" is the sentence Richard wanted. It also needs
component-scoping (a walk should not cross into an unrelated component's identically-named node) and
a decision about component instances, which the runtime dictionary got for free. Both are tractable;
neither is a reason to keep answering from the wrong source.

If that is judged too large for this phase, the honest fallback is slice 3 alone — the panel says it
cannot answer, and does not pretend one row is a result.

**Slice 2b — `TraceSession` must be reset when the project changes.** Independent of the above, and
smaller: the singleton holds the previous project's topology with `hasTopology: true` across a
project switch. Observed live — the panel would happily walk `/erg-rig` while the editor showed a
different project. There is no reset path in the file at all.

**Slice 3 — the panel must not lie about why.** Whatever the cause, the failure mode is the same
shape: the walk truthfully reports the topology it was given, and the user reads it as a claim about
their graph. Those are different statements and the panel currently cannot tell them apart.

Add the distinction:

- no viewer / no topology → *"Not connected to a running preview — nothing to walk."*
- topology present but the queried port has no incoming edge → *"`items` has no incoming
  connection"*, which is a real and useful answer.
- topology present, edge present, walk proceeds.

Today all three render as "1 row · declared wires", and only the third is honest. Diagnosis adds a
**fourth**, which is the one Richard actually hit and the most misleading of the lot:

- the queried **node is not in the topology at all** → *"`filterCollection` is not running in the
  preview — the preview is on `/Pages/Signup`."* Distinguishable for free: the panel already knows
  the node id it was asked about, and `topology.nodes[id]` is either there or it is not. It is also
  the only state where `Node` and `Node id` print the same string, so it is currently *visible* and
  unexplained.

`explainTerminus` returns `undefined` for an unwired root today, so there is nowhere for any of this
to render yet — that, not the wording, is the work.

**Slice 4 — a test with a real edge.** A walk over a two-node topology with one wire must produce
two rows. If such a test exists and passes, it is using ids that match by construction, which is
precisely what candidate (2) says production does not do — so the test needs to be built from a real
project's ids, not from hand-written fixtures.

## Criteria

1. ✅ The mechanism is named in this file with the evidence for it.
2. Asking why `Filter Messages By Conversation.items` is empty walks back to `Query Messages` and
   reports what that node emitted, or truthfully says why it cannot.
3. The three states in slice 3 are distinguishable in the panel.
4. A test covering a multi-hop walk built from real ids.
5. Verified live with the preview running, on Richard's chat project.

## Traps

- **The engine is not the defect** — measured, four hops from one edge on real runtime ids. Its
  rules are deliberate and documented, and "only declared edges" is the fix for a previous panel
  that got this wrong by being clever. Resist loosening it — a walk that enumerates ports is how we
  got 40 noise steps last time.
- **Node ids in a NodeGX project are not UUIDs.** Agent-authored and fixture projects both use
  readable ids. Do not read a readable id as a broken one; it cost this spec a whole candidate.
- **The preview on Richard's chat project renders blank and mounts no page** (`Router.startPage` is
  `/Pages/Signup`). That is its own question and may be a backend the copy cannot reach — but it is
  why the topology had one node, so do not try to reproduce this defect by fixing the preview first.
- `cause` **prunes** the tree when a trace exists; a recorded walk is a chain, not a search. Do not
  read a short recorded walk as the same defect as a short structural one.
- OBS-004 runs this same engine inside the MCP server with no renderer. Any fix must keep
  `walkEngine.ts` import-free.
- The provenance rail icon changes in POL-003 and the panel's colours in POL-004. Take those first;
  diagnosing a walk you cannot read is wasted effort.
