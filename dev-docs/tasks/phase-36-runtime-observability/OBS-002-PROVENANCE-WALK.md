# OBS-002: The provenance walk

## Metadata

| Field | Value |
|-------|-------|
| **ID** | OBS-002 |
| **Phase** | Phase 36 (Track U) |
| **Tier** | 1 |
| **Priority** | 🔴 Critical — this is the product |
| **Difficulty** | 🔴 Hard — not technically, but the UX is the whole risk |
| **Prerequisites** | OBS-001 for layers 2–3. **Layer 1 ships without it** |
| **Retires** | the `experimental: true` Trigger Chain Debugger, or absorbs it — see open question 3 |

## Objective

Answer *"where did the data I'm tracing stop?"* with a walk the user reads in one glance, instead of
a log the user has to search.

## The design in one paragraph

The user always knows the **symptom** (this repeater is empty) and never knows the **middle**. We have
the graph, so what *should* be connected is knowable statically; we have the trace, so what *actually*
fired is knowable. Right-click the symptom, walk backwards through the connections, annotate each hop
with whatever we know. **The ✓/✕ boundary is the bug.** Nothing is searched.

## Primary surface — "Why is this empty?"

Right-click a port → **Why is this empty?** / **Where does this come from?**

```
Repeater.Items                    ✕ never received a value
 └ Variable "cart".Value          ✓ emitted []           14:02:11
    └ Array Push.Items            ✕ never fired
       └ Set Cart Item.Do         ✓ fired                14:02:10
```

`Array Push` was reached and emitted nothing. That is the answer, and it is four rows.

**This is the primary surface because the user can always point at the symptom.** They can always say
"this repeater is empty". They cannot always say which of six buttons was the relevant cause.

### Three annotation layers on one walk

| Layer | Annotation | Source | Works when |
|---|---|---|---|
| **1 — Provenance** | each hop's **current** value | [`getConnectionValue`](../../../packages/noodl-runtime/src/editorconnection.ts#L212) — already exists, gated `isRunningLocally()` | **Cold editor, nothing fired** |
| **2 — Temporality** | *changed at T* / *never fired* / *fired, value unchanged* | OBS-001 trace | A trace exists |
| **3 — Diagnosis** | ⚠ invariant violations | OBS-003 warnings | Checks authored for that node type |

⚠️ **Layer 1 is not a degraded mode.** It answers a whole question class on its own — *"why is this
label X?"*, *"why is padding 10px?"* — which are **state provenance** questions, not causal ones. They
need nothing to have fired. This resolves the obvious objection that the feature only works after
you have already reproduced the bug: **it doesn't. Open the editor, touch nothing, ask.**

Layer 1 is therefore a legitimate early stopping point if OBS-001 slips.

### "Has this hop fired yet, and why not?"

Answered by the same recursion: keep walking backwards until you hit something that *did* fire. The
boundary is the answer. No separate mechanism.

## Companion surface — "Where did my click go?"

The forward walk, for when the user cannot name a symptom — *"I clicked the thing and something is
wrong."*

Record → click → stop. The panel lists only **root** events (actual user interactions — a handful,
not thousands). Pick one, get the causal tree from OBS-001's `cause` chain. **The tree terminates
somewhere, and the terminus is the answer.**

The system can say why the terminus is suspicious by checking it against the topology:
*"`Array Push.Do` fired. Its `Items` output has 2 connections. Neither carried a value."*

## Why this scales

Both walks are bounded by **graph topology, not event volume**. Four hundred unrelated nodes firing
continuously are not upstream of `Repeater.Items` and never appear. This is the property a filtered
list does not have, and it is the reason the shelved panel failed at scale.

**Component boundaries stop hurting.** Richard's cascade "into a cascade of different well organised
components" is just a path with component names on it. The walk crosses boundaries without the user
navigating anything — strictly better than the messy-single-canvas alternative, which is the opposite
of how it feels today.

## The canvas is the destination, not the search tool

Following glowing connectors is harder than it looks, and hopeless across hundreds of nodes in
separate components. So don't. Once the walk **names** the failing node, clicking the row jumps to it
via [`switchToComponent`](../../../packages/noodl-editor/src/editor/src/contexts/NodeGraphContext/NodeGraphContext.tsx#L26)
with that step's values pinned.

"Just go here, look at this" is a click at the end, not a hunt.

⚠️ **Pinned values come from the recorded event, not a live query.** This is why dropping breakpoints
made the feature easier rather than harder — the panel renders a recording; nothing is asked of the
runtime.

## Scope

1. **The backward walk engine** — pure, testable, no UI. Input: a port + the dictionary + the trace.
   Output: an annotated tree. Shared with OBS-004; must not depend on editor singletons.
2. **The walk panel** — lift the list-plus-detail shape from
   [ExecutionHistoryPanel](../../../packages/noodl-editor/src/editor/src/views/panels/ExecutionHistoryPanel/)
   (`ExecutionList` / `ExecutionDetail` / `ExecutionFilters`), which WFA-002 built for workflow runs
   and which never got real data to draw.
3. **Right-click entry points** — on a port in the property editor, and on a node's port on canvas.
4. **Click-to-reveal** — `switchToComponent` + focus + pin the recorded values.
5. **The forward walk** — root-event list, causal tree.
6. **Node ids in the property editor** — a footer row with the id and a copy button. Small, and see
   the note below on who it is for.
7. **Aggregation** — a repeater over 100 rows fires one edge 100 times. Default to *"fired 100×, last
   value …"*, expand on demand. ⚠️ Design this deliberately; it is the one case that otherwise
   reintroduces the wall of rows.

## Filters

Secondary to the walk, but needed once a trace is large. Search by node name or id; filter by
component, by port, by signals-only vs values-only.

⚠️ **The one that matters is filter-by-cause** — pick any event, show only its causal descendants.
Since OBS-001 already stamps a cause id, this is a tree walk and comes essentially free. **One click
on "add to cart" collapses the whole app's firehose to that chain.** Build this one first and treat
the rest as refinement.

## Node ids — who they are for

The panel's rows are click-to-reveal, so a human rarely needs to type an id. The real value is that
it **gives the user a handle to pass to Claude Code** — *"check node `abc123` for me"*. That makes it
a deliberate part of the agent story (OBS-004), not just a debug affordance.

## Acceptance

- [ ] On a cold editor with nothing fired, right-clicking a text node's `Text` input produces a
      backward walk with real current values at each hop.
- [ ] After a trace, the same walk shows the ✓/✕ boundary at the node that failed to emit.
- [ ] The add-to-cart scenario resolves in ≤10 rows on a project with 300+ nodes.
- [ ] Clicking a row opens the correct component and focuses the node with values pinned.
- [ ] A walk crossing three component boundaries reads as one path.
- [ ] Filter-by-cause reduces a busy trace to a single chain in one click.
- [ ] An edge that fired 100× renders as one aggregated row by default.
- [ ] The walk engine has unit tests with no editor or Electron dependency.

## Open

See [README](./README.md) open question 3 — whether this replaces the shelved panel or takes over its
identity. The forward walk is a genuine companion surface and the old panel's name still fits it.
