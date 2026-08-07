---
title: "Parent Component Object"
---
:::warning Deprecated
This node is deprecated and kept only so existing projects keep working. It is not offered in the node picker for new use.
:::

Deprecated access to the parent component's instance state. Use Parent Component Object (net.noodl.ParentComponentObject).

The legacy Parent Component State node read and wrote the enclosing parent component's instance-scoped state — the role now filled by Parent Component Object and Set Parent Component Object Properties. Deprecated and hidden from the picker.

## When to use it

Do not use in new graphs — use net.noodl.ParentComponentObject (with Set Parent Component Object Properties) instead.

## At a glance

| | |
|---|---|
| Category | Component Utilities |
| Type name | `Parent Component State` |
| Available in | browser |
| SSR compatibility | safe |
| Provided by | `noodl-viewer-react` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `properties` | Stringlist | — | Names of the parent values to expose, each becoming a matching input and output |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `fetch` | Signal | — | Republishes every property from the parent; connecting this stops the outputs updating on their own |
| `store` | Signal | — | Writes the supplied property values into the parent component object |

## Outputs

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `changed` | Signal | — | Fires when a property on the resolved parent is written, unless Fetch is connected |
| `fetched` | Signal | — | Fires once Fetch has republished every property |
| `stored` | Signal | — | Fires once Set has written every property |

## Dynamic ports

_This node's port list changes at runtime (runtime-discovered); the tables above may be incomplete for a given instance._

Some ports are discovered at runtime from user code, parameters or connected components, and are pushed to the editor per instance; the static port list below is incomplete for such instances.

## Ports at runtime

Property ports are generated from the per-instance `properties` list (runtime-discovered).

## Related nodes

[Parent Component Object](./net-noodl-parent-component-object.md), [Set Parent Component Object Properties](./net-noodl-set-parent-component-object-properties.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
