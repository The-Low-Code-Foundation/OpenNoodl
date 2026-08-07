# HUD-003 — expand → the interactions → the walk

Out of [TALK-003](TALK-003-A-RECORDING-HUD.md), talked 2026-08-05. Follows
[HUD-002](HUD-002-NODE-BADGES.md).

**Status: ✅ shipped 2026-08-06.** All four slices, plus one filed-not-fixed defect on the
surface it touched. Five of this doc's line references were wrong when the work started — they
were written before FH-011 and HUD-001/002 landed on the same files — and are corrected below.
Two were wrong about *which mechanism* they pointed at, not merely by how many lines.

This is the join between the two halves of the product split: **watch it run, then ask why**. The
HUD says *that* something happened; the Provenance panel is the only thing that says *why*.

## What to build

**Expand the header** → a list of root interactions, live while recording. Roots are already
computed and already short by construction: `rootEvents(index)` returns the events with no cause —
actual clicks, timers, boot — with the size of each one's causal tree
([walkEngine.ts:725-728](../../../packages/noodl-editor/src/editor/src/utils/provenance/walkEngine.ts#L725-L728)).
A click makes **one** root and a cascade of hundreds of descendants, which is exactly why the
surface lists roots instead of events.

**Click a root** → the Provenance panel opens on the forward walk of that root.

## The handoff, and the trap it has to avoid

The panel's forward walk is driven by its own `focusedRoot` state, set only by clicking a row in
its `EmptyState` (`ProvenancePanel.tsx`, `onPick` at the `EmptyState` call site and the row at
`EmptyState`'s `roots.slice(0, 20).map(...)`).
There is no way in from outside — `provenance:walk` carries an `EdgeRef` and starts a *backward*
walk.

⚠️ **Do not emit-then-switch.** `provenanceRequest.ts` exists because that exact pair loses the
first request of every session: the panel does not subscribe until it mounts, and it does not
mount until the sidebar switches to it — and reversing the lines does not help, because React
mounts on a later tick.
This handoff is *more* exposed to it than the canvas right-click was: with Record on the canvas
(HUD-001), a whole recording session can happen without the panel ever having been constructed
([SidePanel.tsx:40-75](../../../packages/noodl-editor/src/editor/src/views/SidePanel/SidePanel.tsx#L40-L75)),
so the first click on a root is *always* the losing case rather than merely the first of a session.

So: extend `provenanceRequest` with a second request kind — stash, emit, switch; the panel claims
a pending root on mount exactly as it claims a pending walk. One module, one pattern, two request
types.

## Slices

**Slice 1 — the expanded list.** ✅ A `▴` disclosure in the recording pill; the list sits above it
in a new bottom-centre `Dock`. Roots newest first, each with `labelFor(index, root.event.from)`
and `N events`, live while recording.

**Slice 2 — `requestProvenanceRootWalk(root)`** ✅ in `provenanceRequest.ts`, with
`takePendingProvenanceRoot()` and `clearPendingProvenanceRoot()`; the panel sets `focusedRoot`
from it on mount and on the `provenance:root` event.

**Slice 3 — the panel keeps its own list.** ✅ Unchanged: the "Recorded interactions" section stays
where it is (it is the after-the-fact surface, and the HUD is gone once you stop). Both are fed by
the same `TraceSession` and both call the same `rootEvents`; neither computes anything.

**Slice 4 — a jasmine spec** ✅ `tests/utils/provenancerequest.spec.ts`: stash-then-claim, claimed
once only, a live listener consumes it so a later remount does not replay it, and one pending
request at a time. Plus `interactionList`, which is what the HUD draws.

## What actually shipped, beyond the slices

- **`interactionList` is a pure function**, in `recordingHud.ts` beside the fold and the fade —
  newest-first, capped at 12, and honest about the rest (`N earlier interactions not shown`).
  `rootEvents` returns *oldest* first, so on a live HUD the thing the user just did would have
  arrived at the bottom of a capped list, i.e. never.
- **The index is built only while the list is open.** `buildIndex` walks the whole buffer and the
  overlay re-renders on every pan, every zoom and every poll. A collapsed HUD costs exactly what
  it cost before this task.
- **The three bottom-centre boxes became one flex column.** The note and the list were both "above
  the pill" and both would have been `bottom: 90px`.
- **`TraceSession` announces `bufferReset`** (renumber on preview reload, a new arm, a project
  change) and the panel drops `focusedRoot` on it. See the corrected trap below — this is a bigger
  hole than the one the doc named.
- **Filed and fixed: `timeOf()` printed nonsense.** `TraceEvent.t` is `performance.now()` from the
  preview page's load, and the panel rendered `new Date(t)` — the first few seconds of 1970 in the
  editor's timezone. Every row of every walk read `01:00:04`. Now `+4.1s`, which is what `t`
  actually is and is comparable between rows, which is all a walk asks of it.

## Deliberately not done

**The badges are still `pointer-events: none`.** HUD-002 left "make the badge a click target" to
this task on the grounds that the click would now have somewhere to go, and the destination does
now exist — but the objection HUD-002 raised is untouched by it. A badge is canvas-space, appears
on a 1.5s poll and fades after three seconds; making it clickable puts a live click target under
the user's cursor, at unpredictable moments, during the exact interaction they are recording. The
canvas has no port hit-testing to fall back on, so what it would eat is the drag, the marquee and
the right-click. The interactions list is the same destination reached from a stationary,
screen-space panel that only exists while the user has explicitly opened it. Revisit if and when
the canvas grows hit-testing.

## Criteria

1. ✅ Record, click the app, expand the HUD → the interactions list grows live.
2. ✅ Click a root with the Provenance panel **never opened this session** → the panel opens on
   that root's forward walk, first time, no second click.
3. ✅ Click a root with the panel already open → same, and the previous walk is replaced rather
   than layered (`walk` prefers `focusedRoot` over `target`).
4. ✅ "Back to walk" still returns to the backward walk when there was one — and now says "Back to
   interactions" when there was not, which is the case a HUD click creates.
5. Live-QA recipe below; not driven in the editor by this session (a dev launch rewrites the
   example project and the checkout is shared).

## Traps

- A root's identity is its `seq`, and `seq` **restarts at 1 on a preview reload** — the session
  handles this by detecting a batch numbered below what it holds
  ([TraceSession.ts:209-222](../../../packages/noodl-editor/src/editor/src/utils/provenance/TraceSession.ts#L209-L222)).
  A pending root claimed after a reload can therefore point at a different event.
  ⚠️ **And the pending stash is the *small* half of this.** It lives for the milliseconds between
  the click and the panel mounting. `focusedRoot` lives for minutes, and `forwardWalk` finds a
  root's descendants **by `seq`** — so a forward walk left on screen across a preview reload does
  not go blank, it silently re-points at whatever the new session numbered the same and renders it
  under the old heading. Both are cleared off one `bufferReset` announcement.
- Clicking a row must not select the node: selecting a node switches the sidebar to the property
  editor, which is how the panel's own row detail became unreachable by the only gesture anyone
  tries (`ProvenancePanel.tsx`, the `reveal` callback's header).

## Corrections to this doc's own references

Every one of these pointed at a real mechanism; five pointed at the wrong lines because FH-011,
HUD-001 and HUD-002 all landed on these files the same day.

| Was | Is | Notes |
|---|---|---|
| `walkEngine.ts:712-728` — `rootEvents` | `725-728` | 712 is the `RootEvent` interface. |
| `ProvenancePanel.tsx:341` — `onPick` | 342 at the time, and moved again here | Off by one. |
| `ProvenancePanel.tsx:649-661` — the clickable root row | 688-695 | 649 is `EmptyState`'s `return (`; the rows are ~40 lines further down. **Wrong mechanism, not just wrong line.** |
| `TraceSession.ts:150-156` — the renumber detection | 209-222 | 150-156 is where the listeners are registered. **Wrong mechanism.** |
| `ProvenancePanel.tsx:277-292` — "selecting a node switches the sidebar" | 280-302 | The `reveal` callback and its header. |
| `SidePanel.tsx:57-68` — a panel is constructed on first open | 40-75 | 57-68 is the `activeChanged` listener; the *initial* construction is at 40-56 and is half the claim. |

`provenanceRequest.ts:6-36` was correct.

## Live QA

Two windows: the editor and the preview. **Both themes** — the dock, the list and the disclosure
are all tokens, and `--theme-color-bg-1` behind `--shadow-popup` is the pairing that has gone
invisible before.

1. Open a project with a button wired to something. **Do not open the Provenance panel** — this is
   criterion 2 and opening it first destroys the test.
2. Press **Record** on the pill at the bottom of the node graph. It goes red and starts counting.
3. Click the button in the preview a few times. Badges appear beside the nodes; the counter climbs.
4. Press **▴** on the pill. The interactions list opens above it, newest first, each row naming
   what you did (`Add To Cart.click`) and the size of what it caused (`14 events`). Click the
   button again with the list open — a new row appears at the top within ~1.5s.
5. **Click the top row.** The sidebar switches to Provenance and it opens on that click's forward
   walk — *first time, one click*. If it takes two clicks, `provenanceRequest` is not being used.
6. Press **Back to interactions**. (It says "Back to walk" instead only if you also had a backward
   walk open, which is criterion 4 — right-click a port → *Why is this empty?* first, then repeat
   from step 5 and confirm the backward walk is what you come back to.)
7. In the walk's rows, check the right-hand column reads `fired · +12.4s`, not `fired · 01:00:12`.
   The `+` is the fix; a wall-clock-looking time is the bug back.
8. Press **Stop**. The list closes with the pill; the panel's own "Recorded interactions" section
   still has every root.
9. **The reload case.** Record, click the app, expand, then reload the preview page and click the
   app again. The list must renumber from the new session rather than mixing the two, and a
   forward walk left on screen must clear rather than re-point.
10. **The gesture case.** With a recording running and badges on screen, drag a node and drag a
    marquee across the canvas. Neither must be interrupted — badges take no clicks by design.
