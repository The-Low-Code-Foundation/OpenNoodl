---
title: "State Snapshot"
---
Saves a named snapshot of a store and restores it later — a checkpoint, rather than the moving history State History keeps.

Save captures the store as it is now; Restore writes it back as a single commit that subscribers see as an ordinary change. A snapshot is copied in on restore, so **the same snapshot can be restored any number of times** — which is what makes it usable as a reset point rather than a one-shot. `snapshot` outputs the captured value, and `snapshotData` accepts one back, so a snapshot can be round-tripped through JSON: persisted, sent to a server, or restored in another session. As with State History, values that could only be captured by reference are not deep-copied, and `fullyRestorable` / `byReferenceKeys` name them rather than letting the checkpoint quietly under-deliver. Errors are reported on the Error output instead of thrown out of a signal handler.

## When to use it

A discrete checkpoint: 'reset this form', 'revert to the last saved version', 'restore the state I shipped this bug report with'. Use State History instead when you want undo/redo over every change; use this when you want one or two named points you return to deliberately. The `snapshot`/`snapshotData` pair is also the straightforward way to persist state across sessions or attach it to a bug report.

## At a glance

| | |
|---|---|
| Category | Data |
| Type name | `net.noodl.StateSnapshot` |
| Available in | browser |
| SSR compatibility | safe |
| Provided by | `noodl-runtime` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `snapshotData` | Object | — | A previously exported Snapshot to restore instead of the named one; leave blank to restore by name |
| `snapshotName` | String | — | Name to save this checkpoint under, and the name Restore looks up; required to save |
| `storeName` | String | `app` | Names the store to snapshot or restore into |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `restore` | Signal | — | Puts a checkpoint back as an ordinary write, so it appears in the history and can itself be undone |
| `save` | Signal | — | Copies the store as it is now and keeps it under Snapshot Name |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `byReferenceKeys` | String | — | Comma-separated keys the checkpoint holds as live objects, so restoring will not undo changes made to them since |
| `fullyRestorable` | Boolean | — | False when the checkpoint holds a Collection, a Model or a function, which it can only keep by reference |
| `snapshot` | Object | — | The checkpoint just saved or restored, as plain data that can be written to a file and fed back into Snapshot Data |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires once a Save or Restore you triggered has finished, whichever of the two it was |
| `restored` | Signal | — | Fires once the store holds the checkpoint again |
| `saved` | Signal | — | Fires once the checkpoint has been taken and Snapshot holds it |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `error` | String | — | Why the last save or restore failed; blank once one succeeds |
| `failure` | Signal | — | Fires when the checkpoint could not be saved or put back, most often an unnamed or unknown checkpoint |

## Patterns

- Save when a form opens, Restore on the Cancel button — a reset that needs no knowledge of the form's fields.
- `snapshot` → JSON → persisted, then back through `snapshotData` on the next load, for state that survives a reload without a live store.
- Attach a snapshot to a bug report so the state is reproducible rather than described.

## Watch out for

- Using it for undo. It is a checkpoint, not a stack — State History keeps the ordered history.
- Assuming a restore is total when `fullyRestorable` is false: keys in `byReferenceKeys` share their object with the snapshot.
- Saving on every change. That is a history with extra steps, and unbounded — State History bounds itself.

## Examples

**Shared state: one store read by two unrelated components**

Two components that are not parent and child, sharing state through a named store instead of prop drilling or a Send/Receive Event pair. Sign In writes `user` with Set Global Store; Header declares the same store by name and renders `state` — no wiring runs between the two components, because naming the store is what connects them. Header also subscribes to just the `user` key, so a write to any other key does not wake it, and uses `previousValue` against `value` to fire only on the signed-out → signed-in transition rather than on every change. Initial State fills gaps without overwriting live state, so Header remounting cannot reset a store Sign In is already using.

## Related nodes

[State History](./net-noodl-state-history.md), [Undo / Redo](./net-noodl-state-history-undo.md), [Global Store](./net-noodl-global-store.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
