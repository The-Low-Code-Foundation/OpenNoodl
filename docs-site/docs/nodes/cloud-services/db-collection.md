---
title: "Query Collection"
---
:::warning Deprecated
This node is deprecated and kept only so existing projects keep working. It is not offered in the node picker for new use.
:::

Deprecated query node for cloud database classes; superseded by DbCollection2 (Query Records).

DbCollection (Query Collection) is the original node for fetching the records of a cloud database class. It is deprecated and hidden from the node picker. DbCollection2 (Query Records) replaces it with the visual filter builder, JavaScript filters, sorting, pagination and live result updates.

## When to use it

Do not use in new graphs — use DbCollection2 (Query Records) instead.

## At a glance

| | |
|---|---|
| Category | Cloud Services |
| Type name | `DbCollection` |
| Available in | browser |
| SSR compatibility | safe |
| Provided by | `noodl-viewer-react` |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `count` | Number | — | How many records are in Result |
| `firstItemId` | String | — | Id of the first matched record |
| `id` | String | — | Name of the class being queried |
| `items` | Array | — | Records the query matched; empty before the first query has run |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `fetched` | Signal | — | Fires once the query has returned and Result is up to date |
| `modified` | Signal | — | Fires when a record joins or leaves Result after the query has run |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `error` | String | — | Why the last query failed; empty until one does |
| `failure` | Signal | — | Fires when the query could not be run, after the reason has been reported on the error channel |

## Dynamic ports

_This node's port list changes at runtime (runtime-discovered); the tables above may be incomplete for a given instance._

Some ports are discovered at runtime from user code, parameters or connected components, and are pushed to the editor per instance; the static port list below is incomplete for such instances.

## Ports at runtime

Ports are runtime-determined: the class choice and filter inputs were generated per instance and pushed to the editor. An authoring tool should not place this node at all; the static port list is incomplete by design.

## Related nodes

[Query Records](./db-collection2.md), [Filter Records](../data/filter-dbmodels.md), [Record](./db-model2.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
