---
title: "State History"
---
Records a bounded history of a store's state so it can be undone, redone or stepped through, and reports what it cannot fully restore.

Watches a store and records an entry per commit, keeping `entries[currentIndex]` always equal to live state. History is bounded by `maxHistory` (default 50): the oldest entry is dropped first, never the current one, and lowering the bound while you are mid-travel drops the redo tail instead. A new write truncates the redo stack, as undo/redo everywhere does. An undo is an ordinary store commit — every other subscriber sees it as a normal change, not a special replay — so nothing in the graph needs to know time travel exists. Where it is honest rather than magical: values that can only be captured by reference (Models, Collections, functions, cyclic objects) are *not* deep-copied, so undoing does not restore their internal state. `fullyRestorable` and `byReferenceKeys` say exactly which keys those are, rather than letting the feature quietly under-deliver. Coalescing (`coalesceMs`, off by default) folds rapid same-key writes into one entry so undo steps match user intent instead of keystrokes — and never folds into the entry a navigation just landed on, which would destroy the state you had just undone to.

## When to use it

Undo/redo over shared state — a form, an editor, a builder, a drawing surface — and stepping back through state while debugging. Place one per store you want tracked; wire the Undo / Redo node to the buttons. For a single named checkpoint rather than a moving history, use State Snapshot. Check `fullyRestorable` before advertising undo over state that holds Collections or Models.

## At a glance

| | |
|---|---|
| Category | Data |
| Type name | `net.noodl.StateHistory` |
| Available in | browser |
| SSR compatibility | safe |
| Provided by | `noodl-runtime` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `coalesceMs` | Number | `0` | Window in milliseconds within which successive changes to the same keys fold into one undo step; 0 records every change separately |
| `enabled` | Boolean | `true` | Turning this off pauses recording and keeps the entries already collected |
| `maxHistory` | Number | `50` | How many entries to keep before the oldest is dropped, never below two and never dropping the current one |
| `storeName` | String | `app` | Names the global store to record; one tracker per store is enough, and two on the same store share one history |
| `trackKeys` | String | — | Comma-separated keys to record; leave blank to record the whole store, and note that changing this clears the history |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `clearHistory` | Signal | — | Throws the history away and starts again from the live state |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `byReferenceKeys` | String | — | Comma-separated keys an undo cannot fully restore because they hold live objects rather than data |
| `canRedo` | Boolean | — | True when an undo has been made and there is a later entry to step forward to |
| `canUndo` | Boolean | — | True when there is an earlier entry to step back to |
| `currentIndex` | Number | — | Where in the history the store is sitting; -1 when nothing is being tracked |
| `fullyRestorable` | Boolean | — | False when some entry holds a Collection, a Model or a function, which a snapshot can only keep by reference |
| `history` | Array | — | One entry per recorded change, each with its index, timestamp, description and changed keys, but not its state |
| `historySize` | Number | — | How many entries the history holds, including the baseline it started from |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires once the history has been thrown away and re-baselined from the live state |
| `historyChanged` | Signal | — | Fires whenever an entry is added, the position moves, or the history is cleared |
| `unchanged` | Signal | — | Fires when there was nothing to throw away, because the history was already just its baseline |

## Patterns

- `canUndo`/`canRedo` → the buttons' enabled state, so the affordance matches reality.
- `coalesceMs` around 300–500 for text input, so an undo removes a word rather than a letter.
- `history` → a Repeater for a visible timeline, with `currentIndex` marking where you are.
- Surface `byReferenceKeys` in a developer-facing view when the store holds Collections, instead of discovering the limit through a confusing undo.

## Watch out for

- Leaving `maxHistory` unbounded-by-intent in a long-running app: every entry is retained state.
- Assuming undo restores everything. A key listed in `byReferenceKeys` shares its object with the entry, so its internal state was never copied.
- Tracking the whole store when only a form's keys need undoing — unrelated writes then become undo steps the user did not make.

## Examples

**Shared state: one store read by two unrelated components**

Two components that are not parent and child, sharing state through a named store instead of prop drilling or a Send/Receive Event pair. Sign In writes `user` with Set Global Store; Header declares the same store by name and renders `state` — no wiring runs between the two components, because naming the store is what connects them. Header also subscribes to just the `user` key, so a write to any other key does not wake it, and uses `previousValue` against `value` to fire only on the signed-out → signed-in transition rather than on every change. Initial State fills gaps without overwriting live state, so Header remounting cannot reset a store Sign In is already using.

## Related nodes

[Undo / Redo](./net-noodl-state-history-undo.md), [State Snapshot](./net-noodl-state-snapshot.md), [Global Store](./net-noodl-global-store.md), [Optimistic Update](./net-noodl-optimistic-update.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
