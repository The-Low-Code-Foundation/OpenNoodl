---
title: "Optimistic Update"
---
Writes a store key immediately, then commits or rolls it back when the server answers — so the UI responds now, not after the round trip.

Applies `optimisticValue` to `key` the moment Apply fires, and holds the change open until Commit or Rollback resolves it. A rollback restores what was there before, and restores *absence as absence* — a key the update introduced is deleted rather than left holding `undefined`. Several updates can be open at once, each with its own transaction id and its own deadline. Two behaviours are worth knowing before relying on it. First, if a plain write changes the same key while an update is open, rollback **keeps the newer value**: `rolledBack` still fires so the failure branch runs, and `error` explains that the value was left alone, because silently reverting a write the user made after the fact is worse than a stale optimistic value. A newer *optimistic* update is not treated as supersession — the store's own newest-writer rule already resolves that correctly. Second, disposal resolves rather than leaks: a node deleted with updates still open rolls them back by default (or commits them, under On Dispose), clears its timers, and fires nothing into the dead node. All three actions also report an outcome: `done` for an Apply, Commit or Rollback that did its work, `unchanged` for the superseded rollback above — the value this update wrote was already gone, so there was nothing to undo — and `failure` when the node refused to act, with `completed` after any of them. The deadline is the one route that reports no outcome, because nobody invoked it: it announces itself on `rolledBack` and `timedOut` alone.

## When to use it

Any action where waiting on the network makes the UI feel slow and the write is very likely to succeed: toggling a like, accepting an invite, checking off a task, reordering a list. Do not use it where a wrong-then-corrected value would mislead — a bank balance, a booking confirmation, a payment state. There, a pending indicator is the honest option.

## At a glance

| | |
|---|---|
| Category | Data |
| Type name | `net.noodl.OptimisticUpdate` |
| Available in | browser |
| SSR compatibility | safe |
| Provided by | `noodl-runtime` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `key` | String | — | Key to write optimistically; an Apply with no key is refused rather than dropped |
| `onDispose` | Enum (`rollback`, `commit`) | `rollback` | What happens to updates still in flight when this node is removed: put the old value back, or keep the value that was shown |
| `optimisticValue` | * | — | Value to show immediately, before the server has confirmed anything |
| `storeName` | String | `app` | Names the store holding the key this update writes |
| `timeout` | Number | `30000` | Milliseconds to wait for an answer before rolling back on its own; 0 waits forever |
| `transactionId` | String | — | Names the update to commit or roll back when several are in flight; leave blank to generate one and resolve to the oldest |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `apply` | Signal | — | Writes Optimistic Value at Key now and opens a transaction the server response will resolve |
| `commit` | Signal | — | Confirms the update, so the optimistic value becomes the truth |
| `rollback` | Signal | — | Puts the old value back, unless something else has written the key since |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `errorMessage` | String | — | Reason reported on Error when this update is rolled back; wire the server error here |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `isCommitted` | Boolean | — | True when the last update to resolve was confirmed |
| `isPending` | Boolean | — | True while at least one update is waiting for an answer |
| `isRolledBack` | Boolean | — | True when the last update to resolve was undone, whether by Rollback, by the deadline, or by disposal |
| `pendingCount` | Number | — | How many updates are open at once, which can be more than one when responses come back out of order |
| `previousValue` | * | — | What the key held immediately before the most recent Apply; blank when the key did not exist |
| `transactionId` | String | — | Id of the most recent Apply; carry it through the request and hand it back to resolve that update specifically |
| `value` | * | — | What the key holds right now, following writes made by anything, not only by this node |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `applied` | Signal | — | Fires once the optimistic value is in the store and the transaction is open |
| `committed` | Signal | — | Fires once an update has been confirmed and its value is the truth |
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires when the action did its work: an Apply that opened a transaction, a Commit that confirmed one, or a Rollback that put the old value back |
| `rolledBack` | Signal | — | Fires once an update has been undone, including when the value was left alone because something newer had written the key |
| `timedOut` | Signal | — | Fires alongside Rolled Back when it was the deadline rather than the graph that ended the update |
| `unchanged` | Signal | — | Fires when a Rollback resolved its transaction without restoring anything, because something else had already written the key — the value this update wrote was gone already, so there was nothing to undo. Rolled Back fires too, and Error says why |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `error` | String | — | Why the last update failed or was undone; blank once an Apply succeeds |
| `failure` | Signal | — | Fires when the node refused to act: no Key, a transaction id already open, or no such update to resolve |

## Patterns

- Apply on the click, Commit on the request's success, Rollback on its failure — with `errorMessage` wired from the server's reason so the message the user sees is the real one.
- `pendingCount` → a subtle 'saving' indicator, rather than a blocking spinner: the point of the pattern is that the UI already moved.
- Leave `transactionId` empty and read the output when several updates can be in flight, instead of inventing ids by hand.

## Watch out for

- Using it for state where being briefly wrong misleads — money, confirmations, availability. Optimism is a UX choice about likely-successful writes, not a way to avoid showing pending state.
- Setting `timeout` to 0 on a network call: a request that never answers then leaves the optimistic value on screen permanently.
- Expecting Rollback to always restore the old value. If the user changed the key in the meantime, their write is kept and `error` says so.

## Examples

**Shared state: one store read by two unrelated components**

Two components that are not parent and child, sharing state through a named store instead of prop drilling or a Send/Receive Event pair. Sign In writes `user` with Set Global Store; Header declares the same store by name and renders `state` — no wiring runs between the two components, because naming the store is what connects them. Header also subscribes to just the `user` key, so a write to any other key does not wake it, and uses `previousValue` against `value` to fire only on the signed-out → signed-in transition rather than on every change. Initial State fills gaps without overwriting live state, so Header remounting cannot reset a store Sign In is already using.

## Related nodes

[Global Store](./net-noodl-global-store.md), [Set Global Store](./net-noodl-global-store-set.md), [State History](./net-noodl-state-history.md), [REST](./rest2.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
