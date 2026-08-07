---
title: "Model"
---
:::warning Deprecated
This node is deprecated and kept only so existing projects keep working. It is not offered in the node picker for new use.
:::

Deprecated cloud record node that mixed reading, writing and deleting in one node; superseded by DbModel2 and the dedicated write nodes.

DbModel (Model) is the original cloud-record node: one node that fetched, created, saved and deleted a database record via `fetch`, `new`, `insert`, `save` and `delete` signal inputs. It is deprecated and hidden from the node picker. Reading a record is now done with DbModel2 (Record); writing is split into NewDbModelProperties (Create Record), SetDbModelProperties (Update Record) and DeleteDbModelProperties (Delete Record), which are simpler to reason about because each node performs exactly one operation.

## When to use it

Do not use in new graphs — use DbModel2 (Record) for reading and Create Record / Update Record / Delete Record for writing instead.

## At a glance

| | |
|---|---|
| Category | Cloud Services |
| Type name | `DbModel` |
| Available in | browser |
| SSR compatibility | safe |
| Provided by | `noodl-viewer-react` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `modelId` | String | — | Id of the record to read and write |
| `properties` | Stringlist | — | Names of the record properties to expose, each of which becomes an input and an output port |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `delete` | Signal | — | Deletes the record from the backend |
| `fetch` | Signal | — | Re-reads the record from the backend, replacing the copy held in memory |
| `insert` | Signal | — | Creates the record in the backend from the property inputs |
| `new` | Signal | — | Creates a record in memory from the property inputs, without saving it |
| `save` | Signal | — | Writes the record's current values to the backend |
| `store` | Signal | — | Copies the property inputs onto the record held in memory without saving it |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `id` | String | — | Id of the record this node is bound to, whether or not it has been read yet |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `changed` | Signal | — | Fires when a property of the bound record changes, including a change another node made |
| `created` | Signal | — | Fires once a new record has been created in the backend |
| `deleted` | Signal | — | Fires once the record has been deleted from the backend |
| `fetched` | Signal | — | Fires once the record has been read and the property outputs are up to date |
| `saved` | Signal | — | Fires once the record has been written to the backend |
| `stored` | Signal | — | Fires once the property inputs have been copied onto the record held in memory |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `error` | String | — | Why the last action failed; empty until one does |
| `failure` | Signal | — | Fires when the last action could not be completed, after the reason has been reported on the error channel |

## Dynamic ports

_This node's port list changes at runtime (runtime-discovered); the tables above may be incomplete for a given instance._

Some ports are discovered at runtime from user code, parameters or connected components, and are pushed to the editor per instance; the static port list below is incomplete for such instances.

## Ports at runtime

Ports are runtime-determined: property inputs/outputs were generated per instance from the selected cloud database class schema and pushed to the editor. An authoring tool should not place this node at all; the static port list is incomplete by design.

## Related nodes

[Record](./db-model2.md), [Create Record](../data/new-db-model-properties.md), [Update Record](../data/set-db-model-properties.md), [Delete Record](../data/delete-db-model-properties.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
