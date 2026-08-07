---
title: "Set Parent Component Object Properties"
---
Set Parent Component Object Properties: writes declared values onto the enclosing parent component's object from a child.

The child-side writer for a parent's instance state: values on the declared property inputs are committed to the nearest ancestor component instance's object when `store` fires, updating every reader of that object (the parent's Component Object, sibling children's Parent Component Object). `done` confirms, and `completed` follows on every invocation — including the failure path.

## When to use it

Child components that advance or edit their host's state — 'next step' controls, embedded editors. Keep writes coarse (one store per user action); each store fans out to all readers.

## At a glance

| | |
|---|---|
| Category | Component Utilities |
| Type name | `net.noodl.SetParentComponentObjectProperties` |
| Available in | browser |
| SSR compatibility | safe |
| Provided by | `noodl-viewer-react` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `properties` | Stringlist | — | Names of the values this node writes, each becoming an input to supply it |
| `targetComponent` | Component | — | Which ancestor to write to; leave blank for the nearest one that has a Component Object |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `store` | Signal | — | Writes every supplied property value into the component object |

## Outputs

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires once every property has been written |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `error` | String | — | Which ancestor was looked for and why it was not found |
| `failure` | Signal | — | Fires when no parent Component Object could be found, so nothing was written |

## Dynamic ports

_This node's port list changes at runtime (runtime-discovered); the tables above may be incomplete for a given instance._

Property input ports follow the "properties" parameter.

## Ports at runtime

Property inputs are generated from the per-instance `properties` list (runtime-discovered); resolution targets the nearest ancestor component instance.

## Examples

**Wizard step state shared via Component Object**

Component Object is per-component-instance shared state: every node in the same component instance — and, via the Parent variants, in its child components — reads and writes the same object without wires between them. The wizard holds `step` in its Component Object; the embedded controls component advances it with Set Parent Component Object Properties and reads it with Parent Component Object. Two wizard instances on one page would each have their own independent `step`, which is exactly what plain shared Objects would not give you.

## Related nodes

[Parent Component Object](./net-noodl-parent-component-object.md), [Component Object](./net-noodl-component-object.md), [Set Component Object Properties](./net-noodl-set-component-object-properties.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
