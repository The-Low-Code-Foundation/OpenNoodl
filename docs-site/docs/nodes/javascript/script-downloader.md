---
title: "Script Downloader"
---
:::warning Deprecated
This node is deprecated and kept only so existing projects keep working. It is not offered in the node picker for new use.
:::

Deprecated loader for external script URLs. Use project modules or a Function node injecting a script tag.

The legacy Script Downloader fetches the JavaScript files listed on its numbered inputs and fires `loaded` when they are available. Deprecated and hidden from the picker.

## When to use it

Do not use in new graphs — prefer bundled project modules; where a runtime script tag is unavoidable, inject it from a Function node and gate downstream work on its load event.

## At a glance

| | |
|---|---|
| Category | Javascript |
| Type name | `Script Downloader` |
| Available in | browser |
| SSR compatibility | client-only — Scripts are injected into the browser DOM; they load after hydration. |
| Provided by | `noodl-viewer-react` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `startLoad` | Boolean | `true` | Whether the scripts are fetched as soon as the node appears, rather than waiting for Load |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `load` | Signal | — | Fetches every script that is not already in the page |

## Outputs

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `loaded` | Signal | — | Fires once every script has finished loading; a script that fails to load reports nothing and this never fires |

## Dynamic ports

_This node's port list changes at runtime (numbered-inputs); the tables above may be incomplete for a given instance._

Accepts an unbounded numbered series of inputs (see numberedInputs); ports are named "<base> <N>" counting from 0.

## Ports at runtime

Script-URL inputs are generated from the configured count (numbered-inputs mechanism).

## Related nodes

[Function](../custom-code/java-script-function.md), [Script](../custom-code/javascript2.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
