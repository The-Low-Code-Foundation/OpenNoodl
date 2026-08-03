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

## Status: not diagnosed

This is the one item in the phase whose mechanism is **not** established. The first slice is finding
it, not fixing it.

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

**Slice 1 — diagnose.** Drive the editor live against a project with a known wired input (Richard's
chat project reproduces it), with the preview running. Determine which of the two above it is —
or a third — and write the answer into this file before writing any fix.

**Slice 2 — fix it.** Unknown until slice 1 lands.

**Slice 3 — the panel must not lie about why.** Whatever the cause, the failure mode is the same
shape: the walk truthfully reports the topology it was given, and the user reads it as a claim about
their graph. Those are different statements and the panel currently cannot tell them apart.

Add the distinction:

- no viewer / no topology → *"Not connected to a running preview — nothing to walk."*
- topology present but the queried port has no incoming edge → *"`items` has no incoming
  connection"*, which is a real and useful answer.
- topology present, edge present, walk proceeds.

Today all three render as "1 row · declared wires", and only the third is honest.

**Slice 4 — a test with a real edge.** A walk over a two-node topology with one wire must produce
two rows. If such a test exists and passes, it is using ids that match by construction, which is
precisely what candidate (2) says production does not do — so the test needs to be built from a real
project's ids, not from hand-written fixtures.

## Criteria

1. The mechanism is named in this file with the evidence for it.
2. Asking why `Filter Messages By Conversation.items` is empty walks back to `Query Messages` and
   reports what that node emitted, or truthfully says why it cannot.
3. The three states in slice 3 are distinguishable in the panel.
4. A test covering a multi-hop walk built from real ids.
5. Verified live with the preview running, on Richard's chat project.

## Traps

- **The engine is probably not the defect.** Its rules are deliberate and documented, and "only
  declared edges" is the fix for a previous panel that got this wrong by being clever. Resist
  loosening it — a walk that enumerates ports is how we got 40 noise steps last time.
- `cause` **prunes** the tree when a trace exists; a recorded walk is a chain, not a search. Do not
  read a short recorded walk as the same defect as a short structural one.
- OBS-004 runs this same engine inside the MCP server with no renderer. Any fix must keep
  `walkEngine.ts` import-free.
- The provenance rail icon changes in POL-003 and the panel's colours in POL-004. Take those first;
  diagnosing a walk you cannot read is wasted effort.
