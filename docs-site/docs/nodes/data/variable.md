---
title: "Variable"
---
:::warning Deprecated
This node is deprecated and kept only so existing projects keep working. It is not offered in the node picker for new use.
:::

Deprecated first-generation named app-wide variable node; superseded by Variable2 and Set Variable.

The original read/write node for the named app-wide variable store, with an explicit `store` (Set) signal to commit its `value` input. It is superseded by Variable2 (shown as 'Variable' in the picker), which writes whenever its value input receives data, together with Set Variable for explicit signal-driven writes with type control. Both read and write the same underlying store as this node.

## When to use it

Do not use in new graphs — use Variable2 to read and write a named variable, and Set Variable for explicit signal-driven writes.

## At a glance

| | |
|---|---|
| Category | Data |
| Type name | `Variable` |
| Available in | browser |
| SSR compatibility | safe |
| Provided by | `noodl-viewer-react` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `name` | String (VariableName id) | — | — |
| `value` | * | — | — |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `fetch` | Signal | — | — |
| `store` | Signal | — | — |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `name` | String | — | — |
| `value` | * | — | — |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `changed` | Signal | — | — |
| `fetched` | Signal | — | — |
| `stored` | Signal | — | — |


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
