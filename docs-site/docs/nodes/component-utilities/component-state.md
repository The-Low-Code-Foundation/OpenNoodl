---
title: "Component Object"
---
:::warning Deprecated
This node is deprecated and kept only so existing projects keep working. It is not offered in the node picker for new use.
:::

Deprecated per-component-instance state store. Use Component Object (net.noodl.ComponentObject).

The legacy Component State node held named values scoped to the component instance — the role now filled by Component Object, which shares the same instance-scoped store semantics with a clearer read/write split. Deprecated and hidden from the picker.

## When to use it

Do not use in new graphs — use net.noodl.ComponentObject (with Set Component Object Properties) instead.

## At a glance

| | |
|---|---|
| Category | Component Utilities |
| Type name | `Component State` |
| Available in | browser |
| SSR compatibility | safe |
| Provided by | `noodl-viewer-react` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `properties` | Stringlist | — | Names of the values this component keeps, each becoming a matching input and output |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `fetch` | Signal | — | Republishes every property; connecting this stops the outputs updating on their own |
| `store` | Signal | — | Writes the supplied property values into the component object |

## Outputs

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `changed` | Signal | — | Fires when any property is written, unless Fetch is connected |
| `fetched` | Signal | — | Fires once Fetch has republished every property |
| `stored` | Signal | — | Fires once Set has written every property |

## Dynamic ports

_This node's port list changes at runtime (runtime-discovered); the tables above may be incomplete for a given instance._

Some ports are discovered at runtime from user code, parameters or connected components, and are pushed to the editor per instance; the static port list below is incomplete for such instances.

## Ports at runtime

Property ports are generated from the per-instance `properties` list (runtime-discovered).

## Related nodes

[Component Object](./net-noodl-component-object.md), [Set Component Object Properties](./net-noodl-set-component-object-properties.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
