---
title: "Object Changed"
---
:::note
This node is not offered directly in the node picker.
:::

Reports what changed inside an Object: which key was added or edited, its new value and its old one.

Object Changed watches one Noodl Object and reports its changes as they happen, rather than only noticing that a different Object arrived. `keyAdded` (Key Added) fires when a key that did not exist now does; `keyChanged` (Key Changed) fires when an existing key is given a different value; `objectReplaced` (Object Replaced) fires when a different Object arrives on the input, including the very first one. Each signal is accompanied by `key` (Key), `value` (Value) and `previousValue` (Previous Value), written before the signal is sent so a downstream node reading them on the signal sees the change the signal is about. Writing a key the value it already holds reports nothing — the runtime itself suppresses it. Only Noodl Objects broadcast their edits; a plain JavaScript object is accepted but only its replacement can be reported, and an Array is declined outright because Array Changed is the node for it.

## When to use it

Use it when a graph must react to *what* changed inside an Object rather than merely that it changed — logging an audit trail, saving only the field that was edited, or driving a different branch for a newly added key than for an edited one. Value Changed is the right node when only the fact of a change matters, or when the input is not an Object: it compares identity, so an Object edited in place is not a change there. Reach for Array Changed when the input is an Array.

## At a glance

| | |
|---|---|
| Category | Logic |
| Type name | `net.noodl.ObjectChanged` |
| Available in | browser |
| SSR compatibility | safe |
| Provided by | `noodl-viewer-react` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `object` | Object | — | The Object to watch. Changes to its keys are reported as they happen; sending a different Object reports Object Replaced. A plain JavaScript object that is not a Noodl Object cannot be watched key-by-key — only its replacement is reported |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `key` | String | — | The key the last Key Added or Key Changed was about; empty after Object Replaced, which is about no single key |
| `previousValue` | * | — | The value that key held before — empty when the key has just been added — or, after Object Replaced, the Object that was being watched before |
| `value` | * | — | The new value of that key — or, after Object Replaced, the Object that just arrived |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `keyAdded` | Signal | — | Fires when a key that did not exist on the watched Object now does |
| `keyChanged` | Signal | — | Fires when a key that already existed on the watched Object is given a different value |
| `objectReplaced` | Signal | — | Fires when a different Object arrives on the input, including the first one and including an explicit clear; Key is empty and Value / Previous Value carry the Objects themselves |

## Patterns

- An Object's `keyChanged` → a Function's `do`, with `key` and `value` wired in: react to one edited field without re-reading the whole Object.
- `keyAdded` and `keyChanged` into separate branches: treat a first-time value differently from a correction.

## Watch out for

- Wiring an Array to Object. The node declines it, because an array's change event carries no key; use Array Changed.
- Expecting it to report edits to a plain JavaScript object. Only Noodl Objects broadcast their writes — build the value as an Object node if you need per-key reporting.

## Related nodes

[Value Changed](./value-changed.md), [Array Changed](./net-noodl-array-changed.md), [Object](../data/model2.md), [Set Object Properties](../data/set-model-properties.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
