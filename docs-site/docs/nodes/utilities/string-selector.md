---
title: "Index To String"
---
:::warning Deprecated
This node is deprecated and kept only so existing projects keep working. It is not offered in the node picker for new use.
:::

Deprecated 'Index To String' lookup: outputs one of a numbered list of author-defined strings selected by a number index.

String Selector (shown as 'Index To String') holds a numbered series of author-entered strings and outputs the one at the current `index` on `currentValue`, firing `indexChanged` when the index changes. It is deprecated; a States node (mapping each state to arbitrary values) or an Expression covers the same need with more flexibility.

## When to use it

Do not use in new graphs — use States or an Expression instead.

## At a glance

| | |
|---|---|
| Category | Utilities |
| Type name | `String Selector` |
| Available in | browser |
| SSR compatibility | safe |
| Provided by | `noodl-viewer-react` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `index` | Number | `0` | Which of the numbered strings to publish, counting from zero and truncated to a whole number |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `currentValue` | String | — | The numbered string sitting at Index, or nothing when there is none |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `indexChanged` | Signal | — | Fires when Index changes, after Current Value has been updated |

## Dynamic ports

_This node's port list changes at runtime (numbered-inputs); the tables above may be incomplete for a given instance._

Accepts an unbounded numbered series of inputs (see numberedInputs); ports are named "<base> <N>" counting from 0.

## Ports at runtime

Inputs are a numbered series: ports named 'input 0', 'input 1', … (displayed 'String for N') are added by the editor as each is used; there is no static bound on the count.


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
