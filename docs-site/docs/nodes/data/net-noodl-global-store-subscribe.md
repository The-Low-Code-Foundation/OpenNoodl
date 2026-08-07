---
title: "Subscribe to Store"
---
Watches specific keys in a named global store and signals when they change, with the previous value alongside the new one.

Subscribes to a store and fires only for the keys named in Keys, so a component that cares about one field is not woken by every unrelated write. Leaving Keys empty watches the whole store. Both Value and Previous Value update before `changed` fires, so a handler can compare them. Notifications arrive once per commit in subscriber registration order; a write that sets a key to the value it already held is not a change and fires nothing. Changing Store Name or Keys moves the subscription rather than adding a second one, and deleting the node removes it — a disposed node leaves no subscriber behind, which matters because a store outlives the components that read it.

## When to use it

Reacting to shared state changing, rather than rendering it. To display a value, wire Global Store's `state` straight into the UI; use Subscribe when something must *happen* on a change — refetch, animate, navigate, log. Prefer naming Keys over watching everything, so unrelated writes do not trigger work.

## At a glance

| | |
|---|---|
| Category | Data |
| Type name | `net.noodl.GlobalStore.Subscribe` |
| Available in | browser |
| SSR compatibility | safe |
| Provided by | `noodl-runtime` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `keys` | String | — | Comma-separated keys to watch; leave blank to react to every change in the store |
| `storeName` | String | `app` | Names the store to watch; must match the Store Name of the Global Store node that owns it |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `changedKeys` | String | — | Comma-separated keys that changed in the notification that fired Changed |
| `previousValue` | * | — | The same projection as Value, as it was immediately before the change that fired Changed |
| `value` | * | — | The watched value: one key gives that key, several give an object of just those keys, none gives the whole store |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `changed` | Signal | — | Fires when one of the watched keys changed, and not for a commit that touched only other keys |

## Patterns

- Name the keys you care about instead of leaving Keys empty, so a busy store does not wake every component on every write.
- Compare `previousValue` with `value` to react to a specific transition — signed-out to signed-in — rather than to any change at all.
- Global Store `state` for rendering; Subscribe `changed` for side effects. Using Subscribe to drive display work is usually a sign the state should simply be wired in.

## Watch out for

- Watching the whole store to react to one key: every unrelated write then does that component's work again.
- Expecting one notification per key when several were written in a batch — a batch is one commit, and `changedKeys` names all of them.
- Holding `previousValue` as a history. It is only the value immediately before this change; the State History node keeps a real history.

## Examples

**Shared state: one store read by two unrelated components**

Two components that are not parent and child, sharing state through a named store instead of prop drilling or a Send/Receive Event pair. Sign In writes `user` with Set Global Store; Header declares the same store by name and renders `state` — no wiring runs between the two components, because naming the store is what connects them. Header also subscribes to just the `user` key, so a write to any other key does not wake it, and uses `previousValue` against `value` to fire only on the signed-out → signed-in transition rather than on every change. Initial State fills gaps without overwriting live state, so Header remounting cannot reset a store Sign In is already using.

## Related nodes

[Global Store](./net-noodl-global-store.md), [Set Global Store](./net-noodl-global-store-set.md), [Variable](./variable2.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
