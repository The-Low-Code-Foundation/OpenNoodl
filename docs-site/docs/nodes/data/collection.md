---
title: "Array"
---
:::warning Deprecated
This node is deprecated and kept only so existing projects keep working. It is not offered in the node picker for new use.
:::

Deprecated all-in-one shared array node. Use Collection2 (Array) plus the CollectionInsert/Remove/Clear/New action nodes.

The legacy Collection node bundled the shared-list store and all its mutations (add/remove/clear/new/store/fetch) into one node. Its replacement splits reading (Array/Collection2) from the individual mutation nodes, keeping graphs legible. The underlying shared-by-id array store is the same, so legacy and current nodes interoperate on the same `collectionId`s.

## When to use it

Do not use in new graphs — use Collection2 with CollectionInsert/CollectionRemove/CollectionClear/CollectionNew instead.

## At a glance

| | |
|---|---|
| Category | Data |
| Type name | `Collection` |
| Available in | browser |
| SSR compatibility | safe |
| Provided by | `noodl-viewer-react` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `collectionId` | String (CollectionName id) | — | — |
| `items` | Array | — | — |
| `modifyId` | String | — | — |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `add` | Signal | — | — |
| `clear` | Signal | — | — |
| `fetch` | Signal | — | — |
| `new` | Signal | — | — |
| `remove` | Signal | — | — |
| `store` | Signal | — | — |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `count` | Number | — | — |
| `id` | String | — | — |
| `items` | Array | — | — |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `changed` | Signal | — | — |
| `created` | Signal | — | — |
| `fetched` | Signal | — | — |
| `modified` | Signal | — | — |
| `stored` | Signal | — | — |

## Related nodes

[Array](./collection2.md), [Insert Object Into Array](./collection-insert.md), [Remove Object From Array](./collection-remove.md), [Clear Array](./collection-clear.md), [Create New Array](./collection-new.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
