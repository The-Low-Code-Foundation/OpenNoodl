---
title: "Set Object Properties"
---
Set Object Properties: writes declared property values onto an existing client-side object, chosen by id or from the repeater item.

Set Object Properties mutates an object in the client-side object store. The target is chosen by `idSource` (Id Source): with 'Specify explicitly' (the default) the `modelId` (Id) input names the object — it accepts either an id string or an object value directly; with 'From repeater' the node walks up the component tree and targets the item object of the closest enclosing Repeater (For Each) item, which is the idiomatic way to edit "this row's" data from inside an item component. When `store` (Do) fires, every property declared in `properties` is written from its input, then `done` (Done) fires, followed by `completed`. Because everything bound to the same object shares it, the change immediately propagates to Object nodes, repeater item bindings and Component Inputs reading that object.

## When to use it

Use it to change one or more properties of an existing client-side object in a single action — especially from inside a repeater item with Id Source 'From repeater'. To create the object first use Create New Object (NewModel); to write a single property continuously prefer an Object (Model2) node's property inputs; for cloud records use Update Record (SetDbModelProperties) plus a save to persist.

## At a glance

| | |
|---|---|
| Category | Data |
| Type name | `SetModelProperties` |
| Available in | browser, cloud |
| SSR compatibility | safe |
| Provided by | `noodl-runtime` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `idSource` | Enum (`explicit`, `foreach`) | `explicit` | Where the object comes from: the Id input, or the item of the Repeater this node sits inside |
| `modelId` | String (ModelName id) | — | Id of the object to act on, which is created the first time it is named; an Object may be wired here instead, and null or blank binds nothing so Do fails |
| `properties` | Stringlist | — | Names the properties to write; each name listed here gets a value input and a type selector |
| `repeaterComponent` | Component | — | Which Repeater to take the item from when several are nested; leave blank to use the nearest one, and ignored unless Id Source is From repeater |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `store` | Signal | — | Writes the property values currently on the inputs onto the object named by Id |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `id` | String | — | Id of the object this node acted on, which is how a newly created one is picked up downstream |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires once the properties have been written onto the object and anything watching it has been told |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `error` | String | — | Why no object was bound, and what to set so that one is |
| `failure` | Signal | — | Fires when there was no object to act on, so nothing was written, after the reason has been put on Error |

## Dynamic ports

_This node's port list changes at runtime (declared-port-groups, runtime-discovered); the tables above may be incomplete for a given instance._

Property input ports are created from the "properties" parameter of the object schema being written.

| Condition | Inputs shown | Outputs shown |
|---|---|---|
| idSource = explicit OR idSource NOT SET | `modelId` | — |
| idSource = foreach | `repeaterComponent` | — |

## Ports at runtime

Property inputs are runtime-discovered from the `properties` parameter: each declared name p produces a value input `prop-<p>` (group Property Values) and an edit-only enum `type-<p>` (String/Boolean/Number/Date/Array/Object/Any, default Any). Only names present in `properties` are written on store. Additionally a declared port group hides `modelId` unless `idSource` is 'explicit' (or unset). Static values can be supplied as `prop-<p>` parameters instead of connections. NDA-012: an empty Id (null or an empty string) binds nothing, so `Do` fires `failure` with `set-object-properties/no-object` rather than writing into a process-wide shared record and reporting Done.

## Patterns

- Inside a repeater item component: `idSource` = 'foreach', a button's click → `store`: edit the current row's object without passing ids around.
- Create New Object `id` → `modelId`: set further properties on a just-created object.

## Watch out for

- Using it on cloud record objects and expecting the database to change — writes are client-side only; follow with a Save Record action to persist.

## Examples

**Repeater item writes back to its own record object**

Inside a Repeater item component, Repeater Item (For Each Actions) exposes `itemId` — the id of this row's object. Wiring it into Set Object Properties (SetModelProperties) `modelId` makes the write target exactly this row: toggling the checkbox stores `done` on the row's object, and every other node bound to that object updates. The row never needs to know which list it belongs to.

## Related nodes

[Create New Object](./new-model.md), [Object](./model2.md), [Update Record](./set-db-model-properties.md), [Repeater](../visual/for-each.md), [Variable](./variable2.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
