---
title: "Device Orientation"
---
:::warning Deprecated
This node is deprecated and kept only so existing projects keep working. It is not offered in the node picker for new use.
:::

Deprecated device-orientation sensor exposing rotation X/Y/Z. No direct successor; use a Function node over the DeviceOrientation API.

The legacy Device Orientation node streams the device's rotation on three number outputs. It is deprecated and hidden from the picker; modern browsers gate the underlying API behind permission prompts the node predates.

## When to use it

Do not use in new graphs — read the DeviceOrientation API from a Function node, handling the permission request explicitly.

## At a glance

| | |
|---|---|
| Category | Sensors |
| Type name | `Gyroscope` |
| Available in | browser |
| SSR compatibility | client-only — Device sensors only exist in the browser. |
| Provided by | `noodl-viewer-react` |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `rotationX` | Number | — | Front-to-back tilt in degrees; it never updates on iOS, which requires a permission this node does not request |
| `rotationY` | Number | — | Left-to-right tilt in degrees; it never updates on iOS, which requires a permission this node does not request |
| `rotationZ` | Number | — | Compass heading in degrees; it never updates on iOS, which requires a permission this node does not request |

## Related nodes

[Function](../custom-code/java-script-function.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
