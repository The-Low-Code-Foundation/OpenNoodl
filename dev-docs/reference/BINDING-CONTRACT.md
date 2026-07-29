# The Binding Contract

**Status:** Normative. Decided 2026-07-29 (phase 30, NDA-015 §1); applied the same day (§2, §3).
**Applies to:** every node that resolves another node, component, or scope as its target without a
wire.

| Node | State |
|---|---|
| `Parent Component Object` | ✅ obeys all three clauses |
| `Close Popup` | ✅ obeys all three clauses |
| `Set Parent Component Object Properties` | ⚠️ shares the walk, has no explicit target yet |
| "current Repeater item" (`_forEachModel`, 5 sites) | ❌ same class, unfixed — see FINDINGS F-ii |

## How to obey it

Do not hand-roll the walk. `noodl-runtime/src/componentwalk.ts` is the one implementation —
`parentComponentOf`, `componentAncestors`, `findComponentAncestor`, `findAncestorWithNodeType`,
`findAncestorWithName`, `findAncestorWithProperty`. It exists because the same recursive walk had
been copied four times and had already drifted: one copy accepted a node type the others did not, so
two nodes in the same place resolved to different ancestors and nothing said so.

Clause (b) goes through `noodl-runtime/src/resolvedtarget.ts`'s `ResolvedTargetReporter` — one
instance per node *module*, `report()` on every resolution, `forget()` in `_onNodeDeleted`. It
aggregates a graph node's live instances before sending, which matters: one node on the canvas is
many at runtime, and reporting them one at a time would flicker between answers. When instances
genuinely disagree it says so ("→ 2 targets: A, B"), which is not a fallback — it is the most useful
thing the canvas can say, and it is the litmus test at the bottom of this file answered honestly.

Clause (c) goes through `Node.raiseRuntimeError` (Failure Contract). Gate it: raise only once the
node has had a fair chance to resolve, and only once per distinct miss. Both guards are load-bearing
— see the note on resolution timing below.

## The rule

> **A node that resolves a target implicitly must (a) accept an explicit target, (b) show what it
> resolved, and (c) warn when it resolves nothing — rather than doing nothing quietly.**

The class this outlaws: a node that walks scope, binds to whatever it finds first, and keeps the
answer to itself. `Parent Component Object` binding to the *nearest* ancestor with a Component
Object is deterministic, but with no way to name the intended ancestor and no visible record of
what was found, deterministic reads as random — especially when one resolution branch walks the
*visual* tree (`parentcomponentobject.ts:159`), so the binding can change when the layout does.

### (a) Explicit target

- An optional input (`Target`/`Component`) naming the intended target. **The default stays the
  current implicit resolution** — existing projects must not change behaviour.
- The explicit form names something stable (component name/path), not a positional hop count.
  "Two levels up" breaks on refactor; "the component named X" survives it.
- When the explicit target cannot be found, that is a **failure** (clause c), not a fallback to
  implicit resolution. Falling back would reintroduce the silent-wrong-target bug behind an input
  that claims to prevent it.

### (b) Visible resolution

- What the node actually bound to is shown **on the canvas**, not only in `getInspectInfo`. An
  author seeing "→ CardList" on the node card diagnoses the nested-component case in seconds;
  inspect-only information requires already suspecting the node.
- Surface: the node card's **sub-label**, fed by the `nodesublabel` message from the viewer. ~~Reuse
  the phase 28 CAN-001/002 label mechanism~~ — checked and it does not apply: those are *connector*
  labels, text on a wire, carrying nothing about a node. The sub-label slot the painter already draws
  (`NodeGraphEditorNode.typeDisplayName`) is the right one, and had no runtime writer before this.
- Deliberately **not** `metadata.typeLabelOverride`, the other writer of that slot: metadata is
  persisted, so a runtime value written there would dirty `project.json` on every preview. The
  runtime value lives on `NodeGraphNode.runtimeSubLabel`, which is not in `toJSON` and must stay out.
- Deliberately **not** a warning either. A binding that worked is not a problem, and routing it
  through `sendWarning` would draw the danger ring and file a Problems-panel entry against a node
  behaving perfectly.
- Implicit resolution that *changed* (e.g. because the visual tree changed) is a change worth
  showing; the label must track the live binding, not the first one.

### (c) Loud failure

- Resolving nothing — no ancestor with a Component Object, no popup in scope to close, an explicit
  target that doesn't exist — raises through the runtime error channel (Failure Contract), with a
  code naming the node type and the miss (`parent-component-object/no-ancestor`). Never a silent
  no-op.

## Resolution timing

Implicit resolution must run when the answer can actually exist. The requirement is: **resolve at a
defined scope-ready point, or observe scope readiness — never sleep and hope**.

The defined point in this runtime is `context.scheduleAfterUpdate`. It is *not* a timer: it pushes
onto `callbacksAfterUpdate`, which `NodeContext.updateDirtyNodes` drains after the dirty-node loop
**within the same update pass**, re-looping until both queues are empty. By the time it runs, the
whole node tree for that pass exists. `nodeScopeDidInitialize` on its own is too early — it fires
from the *child's* `NodeScope.setComponentModel`, part-way through the parent's node-creation loop,
so the parent's later nodes do not exist yet.

That is what NDA-015 §3 resolved: the standing `//FIXME: temporary hack` at
`parentcomponentobject.ts:88` was load-bearing, and the fix its own comment proposed was a
description of what `scheduleAfterUpdate` already did. The cost it named is real and inherent —
outputs propagate one pass later than the rest of the graph — and removing it would need `NodeScope`
to announce readiness upwards.

**Tie clause (c) to the same point.** Before it, a miss is expected and must stay silent; after it, a
miss is a genuine failure. Raising during the early attempt would report a failure on every
correctly-wired graph in the project on load — worse than the silence this contract exists to fix.

## Litmus test for new nodes

Before shipping a node that finds anything by walking: could an author with two nested instances
of the same component predict, from the canvas alone, which one this node affects? If not, the
node violates the contract.
