---
title: "Globals"
---
:::warning Deprecated
This node is deprecated and kept only so existing projects keep working. It is not offered in the node picker for new use.
:::

Deprecated global value bus with user-named ports; superseded by Variable2/Set Variable (and Model2 for objects).

Globals exposed an open-ended set of user-named, untyped ports where every Globals node in the project shared one value per port name: setting an input on any instance updated the same-named output on all instances. It is deprecated; Variable2 and Set Variable provide the same app-wide shared values with clearer naming, and Model2 covers shared structured objects.

## When to use it

Do not use in new graphs — use Variable2 and Set Variable instead (Model2 for shared objects).

## At a glance

| | |
|---|---|
| Category | Utilities |
| Type name | `Globals` |
| Available in | browser |
| SSR compatibility | safe |
| Provided by | `noodl-viewer-react` |

## Dynamic ports

_This node's port list changes at runtime (runtime-discovered); the tables above may be incomplete for a given instance._

Some ports are discovered at runtime from user code, parameters or connected components, and are pushed to the editor per instance; the static port list below is incomplete for such instances.

## Ports at runtime

All ports are user-defined per instance through the editor's port editor: any name can be added as an untyped input or output, and the runtime registers them on demand. No static port list exists.

## Related nodes

[Variable](../data/variable2.md), [Set Variable](../data/set-variable.md), [Object](../data/model2.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
