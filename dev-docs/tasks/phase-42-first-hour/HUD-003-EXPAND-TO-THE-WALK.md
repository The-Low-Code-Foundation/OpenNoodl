# HUD-003 — expand → the interactions → the walk

Out of [TALK-003](TALK-003-A-RECORDING-HUD.md), talked 2026-08-05. Follows
[HUD-002](HUD-002-NODE-BADGES.md).

This is the join between the two halves of the product split: **watch it run, then ask why**. The
HUD says *that* something happened; the Provenance panel is the only thing that says *why*.

## What to build

**Expand the header** → a list of root interactions, live while recording. Roots are already
computed and already short by construction: `rootEvents(index)` returns the events with no cause —
actual clicks, timers, boot — with the size of each one's causal tree
([walkEngine.ts:712-728](../../../packages/noodl-editor/src/editor/src/utils/provenance/walkEngine.ts#L712-L728)).
A click makes **one** root and a cascade of hundreds of descendants, which is exactly why the
surface lists roots instead of events.

**Click a root** → the Provenance panel opens on the forward walk of that root.

## The handoff, and the trap it has to avoid

The panel's forward walk is driven by its own `focusedRoot` state, set only by clicking a row in
its `EmptyState` ([ProvenancePanel.tsx:341](../../../packages/noodl-editor/src/editor/src/views/panels/ProvenancePanel/ProvenancePanel.tsx#L341),
[:649-661](../../../packages/noodl-editor/src/editor/src/views/panels/ProvenancePanel/ProvenancePanel.tsx#L649-L661)).
There is no way in from outside — `provenance:walk` carries an `EdgeRef` and starts a *backward*
walk.

⚠️ **Do not emit-then-switch.** `provenanceRequest.ts` exists because that exact pair loses the
first request of every session: the panel does not subscribe until it mounts, and it does not
mount until the sidebar switches to it — and reversing the lines does not help, because React
mounts on a later tick
([provenanceRequest.ts:6-36](../../../packages/noodl-editor/src/editor/src/utils/provenance/provenanceRequest.ts#L6-L36)).
This handoff is *more* exposed to it than the canvas right-click was: with Record on the canvas
(HUD-001), a whole recording session can happen without the panel ever having been constructed
([SidePanel.tsx:57-68](../../../packages/noodl-editor/src/editor/src/views/SidePanel/SidePanel.tsx#L57-L68)),
so the first click on a root is *always* the losing case rather than merely the first of a session.

So: extend `provenanceRequest` with a second request kind — stash, emit, switch; the panel claims
a pending root on mount exactly as it claims a pending walk. One module, one pattern, two request
types.

## Slices

**Slice 1 — the expanded list.** Roots in the HUD, newest first, each showing its label
(`labelFor(index, root.event.from)`) and `N events`. Live while recording.

**Slice 2 — `requestProvenanceRootWalk(root)`** in `provenanceRequest.ts`, with the matching
`takePendingProvenanceRoot()`; the panel sets `focusedRoot` from it on mount and on the event.

**Slice 3 — the panel keeps its own list.** The "Recorded interactions" section stays where it is
(it is the after-the-fact surface, and the HUD is gone once you stop). Both are fed by the same
`TraceSession`; neither computes anything.

**Slice 4 — a jasmine spec** for the request module: stash-then-claim, claimed once only, a live
listener consumes it so a later remount does not replay it. That is the existing walk contract;
the root request must not be the one that gets it wrong.

## Criteria

1. Record, click the app, expand the HUD → the interactions list grows live.
2. Click a root with the Provenance panel **never opened this session** → the panel opens on that
   root's forward walk, first time, no second click.
3. Click a root with the panel already open → same, and the previous walk is replaced rather than
   layered.
4. "Back to walk" still returns to the backward walk when there was one.
5. Verified in the running editor.

## Traps

- A root's identity is its `seq`, and `seq` **restarts at 1 on a preview reload** — the session
  handles this by detecting a batch numbered below what it holds
  ([TraceSession.ts:150-156](../../../packages/noodl-editor/src/editor/src/utils/provenance/TraceSession.ts#L150-L156)).
  A pending root claimed after a reload can therefore point at a different event. Clear pending
  requests when the buffer resets.
- Clicking a row must not select the node: selecting a node switches the sidebar to the property
  editor, which is how the panel's own row detail became unreachable by the only gesture anyone
  tries ([ProvenancePanel.tsx:277-292](../../../packages/noodl-editor/src/editor/src/views/panels/ProvenancePanel/ProvenancePanel.tsx#L277-L292)).
