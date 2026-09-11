---
title: "Delete Record"
---
Delete Record: permanently removes one record from the cloud database by id when its store signal fires.

Delete Record removes the record identified by `modelId` (or, per `idSource`, the enclosing repeater item) from its class when `store` fires. `done` confirms and `completed` follows it; `failure`/`error` carry access-control or missing-record problems, with `completed` after those too. Query Records nodes observing the class see the record leave their results automatically.

## When to use it

Destructive removal of cloud records. If the product needs undo or soft delete, model an 'archived' flag with Update Record instead — deletion is final.

## At a glance

| | |
|---|---|
| Category | Data |
| Type name | `DeleteDbModelProperties` |
| Available in | browser, cloud |
| SSR compatibility | safe |
| Provided by | `noodl-runtime` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `idSource` | Enum (`explicit`, `foreach`) | `explicit` | Whether the record comes from the Id input or from the record the surrounding Repeater is on |
| `modelId` | String (ModelName id) | — | Id of the record this node acts on; a record itself is accepted here as well as its Id |
| `repeaterComponent` | Component | — | Names which Repeater supplies the current record when Id Source is From repeater; leave blank to use the nearest enclosing one |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `store` | Signal | — | Deletes the record named by Id from its Class in the backend |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `id` | String | — | Id of the record this node last acted on, which on Create Record is the Id the backend assigned |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires once the backend has deleted the record and everything bound to it has been told that it is gone |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `error` | String | — | Why the most recent attempt failed, kept after a later attempt succeeds |
| `failure` | Signal | — | Fires when the backend refused the operation or the node had nothing valid to send, with the reason on Error |

## Dynamic ports

_This node's port list changes at runtime (declared-port-groups, runtime-discovered); the tables above may be incomplete for a given instance._

Declares conditional/expandable port groups whose visibility depends on parameter values (see declaredPortGroups). Some ports are discovered at runtime from user code, parameters or connected components, and are pushed to the editor per instance; the static port list below is incomplete for such instances.

| Condition | Inputs shown | Outputs shown |
|---|---|---|
| idSource = explicit OR idSource NOT SET | `modelId` | — |
| idSource = foreach | `repeaterComponent` | — |

## Ports at runtime

Class choice and id sourcing are schema/editor-driven (declared-port-groups + runtime-discovered); the port set follows the configured class, and `idSource` can bind the id to the enclosing repeater item instead of the input.

## Watch out for

- Wiring a click straight to `store` with no confirmation step for user-facing deletes.

## Examples

**Add and remove a relation between records; delete a record**

Relations link records without embedding them: Add Record Relation points `modelId` (the owner) at `targetId` (the related record) on a named relation field, Remove Record Relation severs the same pair, and Delete Record removes a record entirely. All three act on ids delivered by wires — here from the enclosing component's inputs — and fire `done` on success or `failure` with `error`, with `completed` after either.

**Records on a REST backend: query, create, update, delete**

One Record family serves every backend. Query Records fetches on demand into `items` (re-trigger `storageFetch` to refresh — a query with realtime off does not re-query itself), Create/Update/Delete Record each act on a `store` signal and answer `done` (or `failure`) followed by `completed`, and Update and Delete take the record's `modelId`. After any write the query's `storageFetch` is re-triggered to refresh the list. No node here names a backend, so all five resolve the project's selected one; set the `Backend` input to point a single node somewhere else. Rename and Delete live on the row, not on the page, because the row is the only thing that knows which record it is: it publishes them as `signal` ports on its `Component Outputs`, and the Repeater re-publishes each one as `itemOutputSignal-rename` / `itemOutputSignal-delete` alongside `itemActionItemId`, the id of the row that fired, and the edited title as `itemOutput-title`. The value and the trigger leave the SAME node, so they always describe the same row. Wiring the signal is what makes both arrive — the Repeater only tracks an item output that something is connected to.

## Related nodes

[Update Record](./set-db-model-properties.md), [Create Record](./new-db-model-properties.md), [Query Records](../cloud-services/db-collection2.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
