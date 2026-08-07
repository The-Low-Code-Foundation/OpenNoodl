---
title: "Add Record Relation"
---
Add Record Relation: links a target record onto a named relation field of an owner record in the cloud database.

Add Record Relation writes a relation — a typed link between database records — rather than a property value: when `store` fires, the record identified by `targetId` is added to the configured relation field of the record identified by `modelId`. `done` confirms and `completed` follows it; `failure`/`error` report rejection (missing ids, access control, or a target record whose class is unknown because nothing has loaded it). The reverse operation is Remove Record Relation with identical wiring.

## When to use it

Many-to-many and one-to-many links the schema models as relations: project members, favourites, tags. For plain foreign-key style references stored as a string property, Update Record on an id property is simpler.

## At a glance

| | |
|---|---|
| Category | Data |
| Type name | `AddDbModelRelation` |
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
| `store` | Signal | — | Adds the record named by Target Record Id to the chosen Relation on the record named by Id |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `id` | String | — | Id of the record this node last acted on, which on Create Record is the Id the backend assigned |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires once the relation has been written and the record has been refreshed from the response |

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

The class and relation-name choices come from the project's database schema (declared-port-groups + runtime-discovered): the editor generates the pickers and any per-class ports from the schema, so the port set depends on the configured backend, not the node type.

## Patterns

- Ids arrive over wires (component inputs, query outputs); the relation nodes only act on them.

## Examples

**Add and remove a relation between records; delete a record**

Relations link records without embedding them: Add Record Relation points `modelId` (the owner) at `targetId` (the related record) on a named relation field, Remove Record Relation severs the same pair, and Delete Record removes a record entirely. All three act on ids delivered by wires — here from the enclosing component's inputs — and fire `done` on success or `failure` with `error`, with `completed` after either.

## Related nodes

[Remove Record Relation](./remove-db-model-relation.md), [Update Record](./set-db-model-properties.md), [Record](../cloud-services/db-model2.md), [Query Records](../cloud-services/db-collection2.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
