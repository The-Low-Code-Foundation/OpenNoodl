---
title: "Global Store"
---
Declares a named observable store and outputs its state, so any component can read shared state without prop drilling.

Creates (or attaches to) a named store and keeps `state` in step with it. A store is backed by the runtime's own Model, keyed `--ndl--global-store--<name>`, which is the same mechanism Variables already use — so a store is visible to Function nodes and `Noodl.Object`, and a write made directly to the backing Model notifies store subscribers exactly as Set Global Store does. Any number of Global Store nodes may name the same store; they all observe one shared object rather than each holding a copy. Notifications fire once per commit, not once per key: writes inside a batch collapse into a single `stateChanged`, and `changedKeys` lists only keys whose value actually differs — setting a key to the value it already held reports nothing. Re-entrant writes made from a subscriber are queued and applied rather than recursed, so a subscriber that writes cannot deepen the stack. Deleting the node releases its subscription.

## When to use it

State more than one component needs: the signed-in user, a theme, a cart, an agent conversation, the open panel. Reach for it instead of threading Component Inputs down a tree or wiring a Send Event to every interested component. For state that belongs to one component, Variables and Component Object are simpler and stay local. For a value that must survive a reload, turn on Persist rather than writing your own storage step.

## At a glance

| | |
|---|---|
| Category | Data |
| Type name | `net.noodl.GlobalStore` |
| Available in | browser |
| SSR compatibility | safe |
| Provided by | `noodl-runtime` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `initialState` | Object | — | Keys to fill in on stores that do not already have them, as an object or as JSON text; live values are never overwritten |
| `persist` | Boolean | `false` | Keeps the store in browser storage so it survives a reload; under SSR and cloud functions there is no storage and Error says so |
| `storageKey` | String | — | Name to store the persisted copy under, defaulting to Store Name; ignored unless Persist is on |
| `storeName` | String | `app` | Names the store this node reads; several nodes may share a name and every one of them sees the same state |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `changedKeys` | String | — | Comma-separated keys that changed in the notification that fired State Changed |
| `state` | Object | — | The whole store as a live object; write through Set Global Store rather than mutating it |
| `storeId` | String | — | The id of the Model backing this store, so a Function node can reach the same state through Noodl.Object |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `ready` | Signal | — | Fires once the store has been created and configured, so a graph can sequence its first read |
| `stateChanged` | Signal | — | Fires once per commit to the store, however many keys that commit touched |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `error` | String | — | What the store could not do, prefixed by the phase it happened in: persist, load, clone or subscriber |

## Patterns

- One Global Store node per component that needs to read shared state; there is no 'owner' node to place first, because naming the store creates it.
- `changedKeys` → a condition, rather than watching `state` and diffing by hand, when only one key matters.
- Set Global Store with Batch With Others turned on for several related writes, so the UI updates once rather than flickering through intermediate states.
- Wait on `ready` before reading a persisted store, instead of reading on the first frame and getting a store that has not loaded yet.

## Watch out for

- Using a store for state only one component reads — Variables and Component Object are simpler and do not outlive the component.
- Setting Initial State from several components expecting the last one to win: it fills gaps only and never overwrites, by design.
- Treating `state` as a snapshot to hold on to. It is the live object; use the State History node if you need to keep earlier values.

## Examples

**Shared state: one store read by two unrelated components**

Two components that are not parent and child, sharing state through a named store instead of prop drilling or a Send/Receive Event pair. Sign In writes `user` with Set Global Store; Header declares the same store by name and renders `state` — no wiring runs between the two components, because naming the store is what connects them. Header also subscribes to just the `user` key, so a write to any other key does not wake it, and uses `previousValue` against `value` to fire only on the signed-out → signed-in transition rather than on every change. Initial State fills gaps without overwriting live state, so Header remounting cannot reset a store Sign In is already using.

## Related nodes

[Set Global Store](./net-noodl-global-store-set.md), [Subscribe to Store](./net-noodl-global-store-subscribe.md), [Variable](./variable2.md), [Set Variable](./set-variable.md), [Component Object](../component-utilities/net-noodl-component-object.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
