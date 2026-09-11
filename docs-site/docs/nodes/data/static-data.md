---
title: "Static Array"
---
Static Array: inline JSON or CSV authored in the editor, emitted as an array of objects.

Static Array turns literal data typed into the node — JSON (an array of objects) or CSV with a header row — into an `items` array plus a `count`. Each element becomes a client-side object, so downstream nodes treat the items exactly like query results or shared-array elements.

## When to use it

Fixtures, menus, option lists, demo content — any list that ships with the app rather than coming from a backend or user input. For runtime-mutable lists feed an Array (Collection2); for remote data use Query Records or REST.

## At a glance

| | |
|---|---|
| Category | Data |
| Type name | `Static Data` |
| Available in | browser, cloud |
| SSR compatibility | safe |
| Provided by | `noodl-runtime` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `csv` | String | — | Rows of comma-separated values whose first row names the properties; every cell is read as a string, so use JSON if numbers must stay numbers — ignored unless Type is CSV |
| `json` | String | — | An array of objects authored inline; unlike CSV it keeps numbers and booleans as they are — ignored unless Type is JSON |
| `type` | Enum (`csv`, `json`) | `csv` | Which of the two authoring formats below is read |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `count` | Number | — | How many rows the last successful parse produced |
| `items` | Array | — | The authored rows, as an array of records; unchanged while the JSON cannot be parsed |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `error` | String | — | Why the JSON could not be parsed, in one sentence; empty until a parse fails |
| `failure` | Signal | — | Fires when the authored JSON could not be parsed, leaving Items as it was |

## Dynamic ports

_This node's port list changes at runtime (declared-port-groups); the tables above may be incomplete for a given instance._

Output ports are derived from the columns/fields of the data entered in the "data" parameter.

| Condition | Inputs shown | Outputs shown |
|---|---|---|
| type = csv OR type NOT SET | `csv` | — |
| type = json | `json` | — |

## Ports at runtime

Declared-port-groups only: the `json` and `csv` text inputs swap in based on `type`. No ports depend on the data itself.

## Patterns

- Static Array → Array Filter/Array Map → Repeater: fixture-driven UI with real list plumbing.

## Watch out for

- Editing Static Array content from logic at runtime — it is authoring-time data; use an Array for mutable lists.

## Examples

**Named shared array with insert, remove and clear**

A client-side list without a backend: an Array node (Collection2) binds to the named shared array 'todos' and feeds a Repeater. Add Item (CollectionInsert), Remove Item (CollectionRemove) and Clear (CollectionClear) mutate the same array by its `collectionId`; every node bound to that id — including the Array feeding the list — sees the change immediately. Ids on wires tie the writers to the store. Remove is the row’s to raise: `/Todo Row` publishes a `remove` signal on its `Component Outputs`, and the Repeater re-publishes it as `itemOutputSignal-remove` while setting `itemActionItemId` to the row that fired — the trigger and the id both leave the Repeater, so they always describe the same row.

**Static array filtered and mapped into a list**

Local data without a backend: Static Array holds inline JSON, Array Filter narrows it with a per-item filter script, Array Map reshapes each element with a map script, and the result drives a Repeater. Filter and Map are non-destructive — they emit new arrays and leave the source untouched, so several differently-filtered views can share one source.

**Repeater item writes back to its own record object**

Inside a Repeater item component, Repeater Item (For Each Actions) exposes `itemId` — the id of this row's object. Wiring it into Set Object Properties (SetModelProperties) `modelId` makes the write target exactly this row: toggling the checkbox stores `done` on the row's object, and every other node bound to that object updates. The row never needs to know which list it belongs to. The title rides the checkbox's own `label` port (`useLabel` on) rather than a sibling Text, so the words are a real click target that toggles the box.

**A rich-text editor with a toolbar and local drafts**

The larger companion to the single-button component: a `Static Data` node holds the list of toolbar commands, a `For Each` draws one button per entry, and the editor itself is mounted by a `JavaScriptFunction` onto a `Group`'s element. Two details are worth more than the editor. The draft is saved to `localStorage` on a `Timer` and read back on mount, which is the whole of 'don't lose my work' and costs two function nodes. And `Model2` plus `SetModelProperties` keep the document in the project's own data model rather than only inside the third-party editor, so something other than the editor can read what was typed. ⚠️ The toolbar is driven by data, so adding a command is a row in the `Static Data` node — not a new button.

## Related nodes

[Array](./collection2.md), [Array Filter](./filter-collection.md), [Array Map](./map-collection.md), [Repeater](../visual/for-each.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
