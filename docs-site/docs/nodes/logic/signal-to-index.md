---
title: "Signal To Index"
---
:::warning Deprecated
This node is deprecated and kept only so existing projects keep working. It is not offered in the node picker for new use.
:::

Deprecated: outputs the index of the most recently triggered numbered signal input.

Signal To Index accepts a numbered series of signal inputs and outputs the index of the one that fired most recently on `index`, firing `signalTriggered` on every trigger. It is deprecated and hidden from the node picker: the States node covers the same need — mapping several triggers to one of a set of values — with named states and per-state values instead of bare indices.

## When to use it

Do not use in new graphs — use States instead.

## At a glance

| | |
|---|---|
| Category | Logic |
| Type name | `Signal To Index` |
| Available in | browser |
| SSR compatibility | safe |
| Provided by | `noodl-viewer-react` |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `index` | Number | — | Number of the signal input that last fired, counting from zero |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `signalTriggered` | Signal | — | Fires when any signal input fires, once Index holds the number of the input that fired |

## Dynamic ports

_This node's port list changes at runtime (numbered-inputs); the tables above may be incomplete for a given instance._

Accepts an unbounded numbered series of inputs (see numberedInputs); ports are named "<base> <N>" counting from 0.

## Ports at runtime

Inputs are numbered ports named "input 0", "input 1", … counting from 0 (displayed as "Signal 0", "Signal 1"); each is edge-triggered, and a per-port "Start Index" selector sets the initial index. Deprecated — an authoring tool should not create this node.

## Related nodes

[States](../animation/states.md), [Switch](./switch.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
