---
title: "Array Changed"
---
:::note
This node is not offered directly in the node picker.
:::

Reports what changed inside an Array: items arriving and leaving with their index, and edits to the Objects within it.

Array Changed watches one Array and reports its changes as they happen. `itemAdded` (Item Added) and `itemRemoved` (Item Removed) fire per item with `index` (Index) and `item` (Item); `itemChanged` (Item Changed) fires when one of the Objects *inside* the Array is edited in place, with `key` (Key) naming the property that changed; `arrayReplaced` (Array Replaced) fires when a different Array arrives, including the first one. `count` (Count) always holds the current length. Every value port is written before its signal is sent. A wholesale replacement of an Array's contents is reported item by item, not as one opaque event, because the runtime emits the individual arrivals and departures. A pure reorder — sort, reverse, or writing `length` — sends no signal, because nothing was added or removed; Count is still kept accurate through it.

## When to use it

Use it when a graph must react to *what* moved in an Array rather than that it changed — animating a row as it arrives, saving a record the moment a field inside it is edited, or keeping a running total. Value Changed is the right node when only the fact of a change matters: it compares identity, so an Array mutated in place is not a change there. Use Object Changed when the input is a single Object.

## At a glance

| | |
|---|---|
| Category | Logic |
| Type name | `net.noodl.ArrayChanged` |
| Available in | browser |
| SSR compatibility | safe |
| Provided by | `noodl-viewer-react` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `array` | Array | — | The Array to watch. Items arriving and leaving are reported as they happen, and edits to the Objects inside it are reported as Item Changed; sending a different Array reports Array Replaced |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `count` | Number | — | How many items the watched Array holds now. Kept accurate through reordering and length changes, which send no signal because they add and remove nothing |
| `index` | Number | — | The position the last signal was about; empty after Array Replaced, which is about no single item |
| `item` | * | — | The item the last signal was about; empty after Array Replaced |
| `key` | String | — | The property of Item that changed, after Item Changed; empty after the other signals, which are about the item as a whole |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `arrayReplaced` | Signal | — | Fires when a different Array arrives on the input, including the first one and including an explicit clear; Index, Item and Key are empty and Count is the new length |
| `itemAdded` | Signal | — | Fires when an item is added to the watched Array; Index and Item describe it |
| `itemChanged` | Signal | — | Fires when one of the Objects inside the watched Array is edited in place; Key names the property that changed. Items that are not Noodl Objects cannot be watched |
| `itemRemoved` | Signal | — | Fires when an item is removed from the watched Array; Index is the position it occupied |

## Patterns

- `itemAdded` → a Function's `do` with `item` wired in: run per-item work as rows arrive, without re-walking the whole Array.
- `itemChanged` with `item` and `key` → Set Record Properties: persist exactly the field an author edited.
- `count` → a Text node: a live item count that survives reordering.

## Watch out for

- Expecting Item Changed for members that are not Noodl Objects. A plain object in the Array broadcasts nothing, so only its arrival and departure can be reported.
- Expecting a signal from sorting or reversing. Nothing was added or removed, so only Count is refreshed — watch the Array's own order downstream instead.
- Mutating a raw array with `push` and expecting a report. Use the Array node's own actions, or `items`, so the mutation goes through the reactive path.

## Related nodes

[Value Changed](./value-changed.md), [Object Changed](./net-noodl-object-changed.md), [Array](../data/collection2.md), [Repeater](../visual/for-each.md), [Array Filter](../data/filter-collection.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
