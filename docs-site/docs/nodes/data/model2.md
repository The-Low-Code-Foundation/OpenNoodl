---
title: "Object"
---
Object: binds to one client-side object by id and exposes its properties reactively; the shared store behind repeater items and app state.

Object (Model2) is a window onto one object in the client-side object store. Bind it via `modelId` (or, per `idSource`, the enclosing repeater item) and the properties declared on the node become value outputs that update whenever anything writes the object — Set Object Properties, cloud-data nodes, scripts. `changed` fires on each such write. Objects are shared by id: every Object node with the same id sees the same data, which is how unconnected parts of a graph stay in sync.

## When to use it

Read client-side objects: repeater items, records fetched from the cloud (records are objects whose id is the record id), and structured app state. To write, pair with Set Object Properties or New Object; for lists use Array (Collection2); for scalar state use Variable.

## At a glance

| | |
|---|---|
| Category | Data |
| Type name | `Model2` |
| Available in | browser, cloud |
| SSR compatibility | safe |
| Provided by | `noodl-runtime` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `idSource` | Enum (`explicit`, `foreach`) | `explicit` | Where the object comes from: the Id input, or the item of the Repeater this node sits inside |
| `modelId` | String (ModelName id) | — | Id of the object to bind to, which is created the first time it is named; an Object or a plain JS object may be wired here instead, and null or blank binds nothing |
| `properties` | Stringlist | — | Names the properties to read and write; each name listed here gets an input, an output and a Changed signal |
| `repeaterComponent` | Component | — | Which Repeater to take the item from when several are nested; leave blank to use the nearest one, and ignored unless Get Id from is From repeater |
| `runOnChange-modelId` | Boolean | `true` | Whether a new value on Id re-runs this node. On by default; untick to make this input passive so only the control signal runs it |
| `runOnChange-object` | Boolean | `true` | Whether a new value on Object properties re-runs this node. On by default; untick to make this input passive so only the control signal runs it |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `fetch` | Signal | — | Re-reads the object named by Id now. This is additional to Id rebinding on change and to changes being announced; untick either under Run On Value Change to stop it |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `id` | String | — | Id of the object this node is bound to, whether that came from the Id input or from a repeater item. This names the object; the Object output carries the object itself, which is what a node that watches or reads it wants |
| `object` | Object | — | The bound object itself, for Object Changed or anything else that reads or watches the object rather than naming it; empty while nothing is bound |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `changed` | Signal | — | Fires whenever any property of the bound object changes, from this node or from anywhere else |
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires when a Fetch finished and the property outputs are up to date |
| `fetched` | Signal | — | Fires once a new object has been bound and its property outputs are up to date |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `failure` | Signal | — | Fires when Fetch was pressed with no Id to bind to, with the reason on the error channel |

## Dynamic ports

_This node's port list changes at runtime (declared-port-groups, runtime-discovered); the tables above may be incomplete for a given instance._

Property input/output ports are created from the "properties" parameter (the schema of the object being read/written).

| Condition | Inputs shown | Outputs shown |
|---|---|---|
| idSource = explicit OR idSource NOT SET | `modelId` | — |
| idSource = foreach | `repeaterComponent` | — |

## Ports at runtime

Property ports are generated from the `properties` list on the node instance (and the connected schema where one exists) — they are per-instance, not in the catalog. `idSource` swaps the id between an explicit input and the enclosing repeater item (declared-port-groups). NDA-012: an empty Id (null or an empty string) binds nothing and does not fire `fetched`, rather than minting a throwaway object; a real id still springs into existence on first use. Property values that arrive before the Id are held and written the moment an object is bound.

## Patterns

- Repeater row: item id → Object → property outputs into the row's visuals.
- Ids travel over wires; Objects resolve them where the data is needed.

## Watch out for

- Duplicating object data into Variables 'for convenience' — bind another Object node to the same id instead; the store already shares it.

## Examples

**Create a client-side object and bind to it by id**

Create New Object (NewModel) makes a fresh client-side object with the property values on its schema-declared inputs and outputs the new `id`. An Object node (Model2) bound to that id then exposes the object's properties reactively — the create node acts, the Object node observes. This id-handoff is the core client-data shape: writers and readers connect through ids, not direct wires.

**Repeater item writes back to its own record object**

Inside a Repeater item component, Repeater Item (For Each Actions) exposes `itemId` — the id of this row's object. Wiring it into Set Object Properties (SetModelProperties) `modelId` makes the write target exactly this row: toggling the checkbox stores `done` on the row's object, and every other node bound to that object updates. The row never needs to know which list it belongs to.

## Related nodes

[Create New Object](./new-model.md), [Set Object Properties](./set-model-properties.md), [Array](./collection2.md), [Record](../cloud-services/db-model2.md), [Component Object](../component-utilities/net-noodl-component-object.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
