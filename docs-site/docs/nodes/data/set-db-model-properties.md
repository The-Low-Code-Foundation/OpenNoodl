---
title: "Update Record"
---
Update Record: writes property values to an existing cloud database record when Do is triggered.

SetDbModelProperties (Update Record) updates the record identified by `modelId` in the class chosen with the `collectionName` (Class) parameter. Each class property becomes a value input; triggering `store` (Do) applies the connected inputs to the local record and saves them to the server, firing `done` (Done) on confirmation or `failure` with `error` on problems, and `completed` after either. `storeType` (Store to) can switch the node to 'Local only', which updates the in-memory record without any server call — useful for optimistic UI or scratch state. By default only the properties you actually supply are sent (`storeProperties` = 'Only specified'); 'All' sends the record's entire current data. Because the shared local record is updated, every bound Record node and live query in the app sees the change immediately.

## When to use it

The save half of every edit form, and the way to flip a single field ('mark done') from a list row. To create a record use NewDbModelProperties; to remove one use DeleteDbModelProperties; for BYOB backends use noodl.byob.UpdateRecord.

## At a glance

| | |
|---|---|
| Category | Data |
| Type name | `SetDbModelProperties` |
| Available in | browser, cloud |
| SSR compatibility | safe |
| Provided by | `noodl-runtime` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `accessControl` | Proplist | — | Read and write rules stored on the record as it is written, each rule adding its own Target, Read and Write ports; backends that have no per-record access control ignore them |
| `idSource` | Enum (`explicit`, `foreach`) | `explicit` | Whether the record comes from the Id input or from the record the surrounding Repeater is on |
| `modelId` | String (ModelName id) | — | Id of the record this node acts on; a record itself is accepted here as well as its Id |
| `repeaterComponent` | Component | — | Names which Repeater supplies the current record when Id Source is From repeater; leave blank to use the nearest enclosing one |
| `storeProperties` | Enum (`specified`, `all`) | `specified` | Whether to send only the properties wired on this node or every property the record holds; not offered when Store to is Local only |
| `storeType` | Enum (`cloud`, `local`) | `cloud` | Whether the change is sent to the backend as well as applied to the in-memory record, or only held locally |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `store` | Signal | — | Writes the property inputs onto the record named by Id, and on to the backend unless Store to is Local only |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `id` | String | — | Id of the record this node last acted on, which on Create Record is the Id the backend assigned |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires once the record has been updated, waiting for the backend to answer unless Store to is Local only |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `error` | String | — | Why the most recent attempt failed, kept after a later attempt succeeds |
| `failure` | Signal | — | Fires when the backend refused the operation or the node had nothing valid to send, with the reason on Error |

## Dynamic ports

_This node's port list changes at runtime (declared-port-groups, runtime-discovered); the tables above may be incomplete for a given instance._

Property input ports follow the selected cloud database class schema.

| Condition | Inputs shown | Outputs shown |
|---|---|---|
| storeType = cloud OR storeType NOT SET | `storeProperties` | — |
| idSource = explicit OR idSource NOT SET | `modelId` | — |
| idSource = foreach | `repeaterComponent` | — |

## Ports at runtime

Ports are runtime-determined: `collectionName` (Class) is registered as an edit-only enum of the project's classes plus _User/_Role, and each schema property of the chosen class becomes a value input `prop-<name>` typed from the schema. Access Control rules spawn `acl-<ruleId>-*` inputs like on Create Record. An authoring tool should set `collectionName` in parameters and drive the `prop-<name>` inputs it intends to change.

## Patterns

- DbModel2 `prop-<name>` → Text Input `startValue`, edited `text` → `prop-<name>`, Button `onClick` → `store`: prefill, edit, save.
- 'From repeater' `idSource` inside a list row: one node updates whichever record the row represents.

## Watch out for

- Setting `storeProperties` to 'All' to 'be safe' — it uploads the record's entire local data and can overwrite fields other users changed; send only what the form edits.

## Examples

**Load, edit and save a single record**

The record-detail flow: a Record node (DbModel2) binds to one database object by `modelId` and exposes its properties as schema-generated outputs. The edit field is initialised from the record, and Save (SetDbModelProperties) writes the changed property back on click, targeting the same id. `done` confirms the round trip, and `completed` fires after it whatever the outcome. Property ports on both nodes come from the database schema — they are runtime-determined, wired here exactly as the editor would write them.

**Records on a REST backend: query, create, update, delete**

One Record family serves every backend. Query Records fetches on demand into `items` (re-trigger `storageFetch` to refresh — a query with realtime off does not re-query itself), Create/Update/Delete Record each act on a `store` signal and answer `done` (or `failure`) followed by `completed`, and Update and Delete take the record's `modelId`. After any write the query's `storageFetch` is re-triggered to refresh the list. No node here names a backend, so all five resolve the project's selected one; set the `Backend` input to point a single node somewhere else.

## Related nodes

[Record](../cloud-services/db-model2.md), [Create Record](./new-db-model-properties.md), [Delete Record](./delete-db-model-properties.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
