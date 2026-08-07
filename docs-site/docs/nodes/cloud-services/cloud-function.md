---
title: "Cloud Function"
---
:::warning Deprecated
This node is deprecated and kept only so existing projects keep working. It is not offered in the node picker for new use.
:::

Deprecated v1 caller of named server functions. Superseded by CloudFunction2 (also displayed as 'Cloud Function').

The original cloud-function caller: it POSTs the values of its `params` list to a server function addressed by the `functionName` string input and exposes the raw reply on `result`. It is deprecated and hidden from the node picker; CloudFunction2 supersedes it, targeting a cloud function component built with `noodl.cloud.request`/`noodl.cloud.response` and mirroring that component's declared parameters and results as typed ports instead of a free-form name and result blob.

## When to use it

Do not use in new graphs — use CloudFunction2 instead.

## At a glance

| | |
|---|---|
| Category | Cloud Services |
| Type name | `Cloud Function` |
| Available in | browser |
| SSR compatibility | safe |
| Provided by | `noodl-viewer-react` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `functionName` | String | — | Name of the cloud function to run |
| `params` | Stringlist | — | Names of the parameters to send, each of which becomes an input port |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `call` | Signal | — | Runs the named cloud function with the current parameter values |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `result` | * | — | Whatever the function returned, with records and arrays deserialised where they can be |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `success` | Signal | — | Fires once the function has returned and Result is up to date |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `failure` | Signal | — | Fires when the call failed, and also when it succeeded without returning a result; this node carries no reason for either |

## Dynamic ports

_This node's port list changes at runtime (runtime-discovered); the tables above may be incomplete for a given instance._

Some ports are discovered at runtime from user code, parameters or connected components, and are pushed to the editor per instance; the static port list below is incomplete for such instances.

## Ports at runtime

Each name in the `params` stringlist becomes a `pm-<name>` input; the reply is exposed on the static `result` output. Ports are runtime-discovered per instance; only existing projects should still contain this node.


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
