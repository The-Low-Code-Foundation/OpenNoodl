---
title: "Undo / Redo"
---
Moves a store backwards, forwards, or to a specific point in the history recorded by a State History node.

Drives the history that a State History node on the same store is recording; it records nothing itself, so a store with no State History node has nothing to undo and says so on Error rather than failing quietly. Undo and Redo step one entry; Jump To moves straight to `targetIndex`, which is what a timeline UI needs. Each move is an ordinary store commit, so subscribers and bindings update exactly as they do for any other change. After every move, `fullyRestorable` and `byReferenceKeys` describe *the restore that just happened* — not the whole history — so an author can tell the user when a particular step could not be fully reversed instead of leaving them to notice.

## When to use it

Wire it to Undo and Redo buttons, a keyboard shortcut, or a timeline UI. One node can serve all three: Undo, Redo and Jump To are separate signals on the same node. Take the buttons' enabled state from the State History node's `canUndo`/`canRedo` rather than from here.

## At a glance

| | |
|---|---|
| Category | Data |
| Type name | `net.noodl.StateHistory.Undo` |
| Available in | browser |
| SSR compatibility | safe |
| Provided by | `noodl-runtime` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `storeName` | String | `app` | Names the store to step through; a State History node must already be tracking it |
| `targetIndex` | Number | `0` | Entry to move to when Jump To is signalled, counting from zero; ignored by Undo and Redo |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `jumpTo` | Signal | — | Moves the store to the entry named by Target Index |
| `redo` | Signal | — | Steps the store forward one entry, or fires Unchanged when it is already at the end |
| `undo` | Signal | — | Steps the store back one entry, or fires Unchanged when it is already at the beginning |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `byReferenceKeys` | String | — | Comma-separated keys the restored entry put back as the same live object rather than as a copy |
| `fullyRestorable` | Boolean | — | False when the entry just restored held live objects a snapshot could only keep by reference |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires when the step actually moved the store |
| `jumped` | Signal | — | Fires once the store holds the entry Target Index named |
| `redone` | Signal | — | Fires when a step forward actually happened, and not when the history was already at its end |
| `unchanged` | Signal | — | Fires when the history had nowhere to go — an Undo at the beginning or a Redo at the end. Not a failure: this is an ordinary end-stop, and it used to be silent |
| `undone` | Signal | — | Fires when a step back actually happened, and not when the history was already at its beginning |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `error` | String | — | Why the last step failed; blank once one succeeds |
| `failure` | Signal | — | Fires when the step could not be made, because nothing is tracking the store or Target Index is outside the history |

## Patterns

- State History `canUndo` → the Undo button's enabled state, and this node's `undo` → its click. The recording node owns the availability; this one owns the action.
- `jumpTo` with `targetIndex` from a Repeater index, for a clickable timeline.
- Show `byReferenceKeys` after a move where `fullyRestorable` is false, rather than leaving the user to discover the gap.

## Watch out for

- Expecting it to work without a State History node on the same store — it drives a history, it does not keep one.
- Wiring Undo to a button whose enabled state ignores `canUndo`: the button then does nothing at the end of the history.
- Treating a failed move as impossible. Read `error` — out-of-range jumps and truncated redo tails are both normal.

## Examples

**Shared state: one store read by two unrelated components**

Two components that are not parent and child, sharing state through a named store instead of prop drilling or a Send/Receive Event pair. Sign In writes `user` with Set Global Store; Header declares the same store by name and renders `state` — no wiring runs between the two components, because naming the store is what connects them. Header also subscribes to just the `user` key, so a write to any other key does not wake it, and uses `previousValue` against `value` to fire only on the signed-out → signed-in transition rather than on every change. Initial State fills gaps without overwriting live state, so Header remounting cannot reset a store Sign In is already using.

## Related nodes

[State History](./net-noodl-state-history.md), [State Snapshot](./net-noodl-state-snapshot.md), [Global Store](./net-noodl-global-store.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
