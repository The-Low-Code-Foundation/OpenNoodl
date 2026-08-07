---
title: "Create New Object"
---
Create New Object: creates a new client-side object with the declared properties set and outputs the new object's id.

Create New Object makes a new object in the app's client-side object store when the `new` (Do) signal fires. Objects are in-memory key/value records addressable by id from anywhere in the app — Object (Model2) nodes, Set Object Properties, repeaters and Component Inputs all bind to the same store. Which properties the new object gets is declared in the `properties` parameter; each declared name becomes a value input whose current value is written onto the object at creation time. After creation the object's id is available on the `id` output and `done` (Done) fires, followed by `completed` — creation is deferred until all inputs updated in the same cycle have settled, so payload values wired alongside the trigger are included.

## When to use it

Use it to mint new client-side state records: items added to a local list, draft objects before saving, per-session working data. Objects are in-memory only — for persistent cloud data use the record nodes (e.g. Create Record / NewDbModelProperties) instead; for a single named value a Variable (Variable2) is simpler.

## At a glance

| | |
|---|---|
| Category | Data |
| Type name | `NewModel` |
| Available in | browser, cloud |
| SSR compatibility | safe |
| Provided by | `noodl-runtime` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `properties` | Stringlist | — | Names the properties to write; each name listed here gets a value input and a type selector |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `new` | Signal | — | Creates a new object with a generated id and writes the property values currently on the inputs |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `id` | String | — | Id of the object this node acted on, which is how a newly created one is picked up downstream |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation. This node has no other outcome — no Unchanged and no Failure — so it always fires together with Done, and wiring either one does the same thing. It is here on every action so that reaching for it is never a per-node decision |
| `done` | Signal | — | Fires once the new object exists, its properties are written and Id names it |

## Dynamic ports

_This node's port list changes at runtime (runtime-discovered); the tables above may be incomplete for a given instance._

Property input ports are created from the "properties" parameter.

## Ports at runtime

Property inputs are runtime-discovered from the `properties` parameter: each declared name p produces a value input `prop-<p>` (group Property Values) and an edit-only enum `type-<p>` (String/Boolean/Number/Date/Array/Object/Any, default Any). At creation each declared property receives its input value, or a type-based default (false, empty string, 0, current date) when no value was provided. Array-typed values given as strings are evaluated as JavaScript literals; object-typed values given as strings are resolved as object ids. An authoring tool must set `properties` first — the `prop-`/`type-` ports do not exist without it.

## Patterns

- Receive Event payload outputs → `prop-` inputs, `eventReceived` → `new`: create an object from an event's payload.
- `id` → Set Object Properties `modelId`: continue mutating the object you just created.

## Watch out for

- Expecting created objects to persist — the object store is client-side and in-memory; reloading the app clears it. Use cloud record nodes for persistence.

## Examples

**Create a client-side object and bind to it by id**

Create New Object (NewModel) makes a fresh client-side object with the property values on its schema-declared inputs and outputs the new `id`. An Object node (Model2) bound to that id then exposes the object's properties reactively — the create node acts, the Object node observes. This id-handoff is the core client-data shape: writers and readers connect through ids, not direct wires.

## Related nodes

[Object](./model2.md), [Set Object Properties](./set-model-properties.md), [Create Record](./new-db-model-properties.md), [Variable](./variable2.md), [Create New Array](./collection-new.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
