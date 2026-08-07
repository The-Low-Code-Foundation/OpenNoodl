---
title: "Set Component Object Properties"
---
Set Component Object Properties: writes declared values onto this component instance's own object when store fires.

The writing half of Component Object: property values set on this node's declared inputs are committed to the enclosing component instance's object when `store` fires, and every Component Object / Parent Component Object reader of that instance sees the change immediately. `done` confirms the write, and `completed` follows it on every invocation.

## When to use it

Mutating instance-scoped state: resetting a wizard, recording a selection local to this instance. For state shared across instances or screens use Objects (Model2) or Variables instead.

## At a glance

| | |
|---|---|
| Category | Component Utilities |
| Type name | `net.noodl.SetComponentObjectProperties` |
| Available in | browser, cloud |
| SSR compatibility | safe |
| Provided by | `noodl-runtime` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `properties` | Stringlist | — | Names of the values this node writes, each becoming an input to supply it |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `store` | Signal | — | Writes every supplied property value into the component object |

## Outputs

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation. This node has no other outcome — no Unchanged and no Failure — so it always fires together with Done, and wiring either one does the same thing. It is here on every action so that reaching for it is never a per-node decision |
| `done` | Signal | — | Fires once every property has been written |

## Dynamic ports

_This node's port list changes at runtime (runtime-discovered); the tables above may be incomplete for a given instance._

Property input ports follow the "properties" parameter.

## Ports at runtime

Property inputs are generated from the per-instance `properties` list (runtime-discovered).

## Examples

**Wizard step state shared via Component Object**

Component Object is per-component-instance shared state: every node in the same component instance — and, via the Parent variants, in its child components — reads and writes the same object without wires between them. The wizard holds `step` in its Component Object; the embedded controls component advances it with Set Parent Component Object Properties and reads it with Parent Component Object. Two wizard instances on one page would each have their own independent `step`, which is exactly what plain shared Objects would not give you.

## Related nodes

[Component Object](./net-noodl-component-object.md), [Set Parent Component Object Properties](./net-noodl-set-parent-component-object-properties.md), [Set Object Properties](../data/set-model-properties.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
