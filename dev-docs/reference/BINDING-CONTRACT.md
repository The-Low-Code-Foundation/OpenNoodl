# The Binding Contract

**Status:** Normative. Decided 2026-07-29 (phase 30, NDA-015 §1).
**Applies to:** every node that resolves another node, component, or scope as its target without a
wire — today `Parent Component Object` and `Close Popup`; plus whatever the §2 sweep
(`getNodesWithType` / `parentNodeScope` / `getVisualParentNode` / `componentOwner` walks) turns up.

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
- Surface: reuse the phase 28 canvas label mechanism (CAN-001/002 connector-label plumbing) before
  inventing a new one — check whether the node-card subtitle path it uses can carry a resolved
  name that updates at runtime.
- Implicit resolution that *changed* (e.g. because the visual tree changed) is a change worth
  showing; the label must track the live binding, not the first one.

### (c) Loud failure

- Resolving nothing — no ancestor with a Component Object, no popup in scope to close, an explicit
  target that doesn't exist — raises through the runtime error channel (Failure Contract), with a
  code naming the node type and the miss (`parent-component-object/no-ancestor`). Never a silent
  no-op.

## Resolution timing

Implicit resolution must run when the answer can actually exist. The one-frame deferral hack at
`parentcomponentobject.ts:88` exists because resolution runs before the parent's node scope does;
the contract-level requirement is: **resolve at a defined scope-ready point, or observe scope
readiness — never sleep and hope**. If a deferral turns out to be genuinely load-bearing, the code
must say why, so it survives the next cleanup (NDA-015 §3).

## Litmus test for new nodes

Before shipping a node that finds anything by walking: could an author with two nested instances
of the same component predict, from the canvas alone, which one this node affects? If not, the
node violates the contract.
