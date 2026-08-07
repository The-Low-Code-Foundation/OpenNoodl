---
title: "Remove Record Relation"
---
Remove Record Relation: severs a link between a target record and a named relation field of an owner record.

The inverse of Add Record Relation: when `store` fires, the record in `targetId` is removed from the configured relation field of the record in `modelId`. `done` confirms the server accepted it — including when the relation was not there to begin with, which this node cannot tell apart from a real unlink — and `completed` follows it; `failure`/`error` report problems. Removing a relation never deletes either record — it only unlinks them.

## When to use it

Undoing relation links: leaving a project, unfavouriting, untagging. To delete the record itself use Delete Record.

## At a glance

| | |
|---|---|
| Category | Data |
| Type name | `RemoveDbModelRelation` |
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
| `targetId` | String | — | Id of the record at the other end of the relation, which must come from a Query Records or Record output so that its class is known |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `store` | Signal | — | Removes the record named by Target Record Id from the chosen Relation on the record named by Id |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `id` | String | — | Id of the record this node last acted on, which on Create Record is the Id the backend assigned |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires once the backend has accepted the removal, which is also what happens when the relation was not there to begin with |

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

Class and relation-name configuration is schema-driven exactly as on Add Record Relation (declared-port-groups + runtime-discovered); ports depend on the project's database schema.

## Examples

**Add and remove a relation between records; delete a record**

Relations link records without embedding them: Add Record Relation points `modelId` (the owner) at `targetId` (the related record) on a named relation field, Remove Record Relation severs the same pair, and Delete Record removes a record entirely. All three act on ids delivered by wires — here from the enclosing component's inputs — and fire `done` on success or `failure` with `error`, with `completed` after either.

## Related nodes

[Add Record Relation](./add-db-model-relation.md), [Delete Record](./delete-db-model-properties.md), [Record](../cloud-services/db-model2.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
