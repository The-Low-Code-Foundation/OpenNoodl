---
title: "Repeater"
---
Repeater: instantiates a template component once per item of an input array, inserting the instances as children at its position.

The Repeater consumes an array on `items` and creates one instance of its template component per item, placed into the visual tree where the Repeater sits (it must therefore be a child of a visual container). With `templateType` explicit (the default) the template is one component chosen on the `template` input; with `templateType` dynamic, a `templateScript` chooses a component per item at runtime. Item data flows into each instance through the instance's Component Inputs whose names match the item object's property names. The repeater diffs changes to the array, adding/removing instances rather than rebuilding everything.

## When to use it

Any repeated UI: lists, grids, menus, table rows. Its idiomatic partner is Query Records for cloud data or a Static Data/Variable2 array for local data. Not for repeating pure logic without visuals — see For Each Actions.

## At a glance

| | |
|---|---|
| Category | Visual |
| Type name | `For Each` |
| Available in | browser |
| SSR compatibility | safe |
| Provided by | `noodl-viewer-react` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `items` | Array | — | The array or query result to repeat over; an empty value clears the list, including null and an empty array |
| `template` | Component | — | Component to create once per item, with the item available to it as its Component Object |
| `templateScript` | String | `// Set the 'component' variable to the name of the desired component for this item.
// Component name must start with a '/'.
// A component in a sheet is referred to by '/#Sheet Name/Comopnent Name'.
// The data for each item is available in a variable called 'item'
component = '/MyComponent';` | JavaScript run per item that sets `component` to a component path; the item is available as `item` |
| `templateType` | Enum (`explicit`, `dynamic`) | `explicit` | Explicit uses one component for every item; Dynamic picks one per item by running Script |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `refresh` | Signal | — | Rebuilds every item from the current Items, discarding any state the item components held |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `itemActionItemId` | String | — | Id of the item whose Repeater Item node last raised an action |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires once a Refresh has torn the list down and rebuilt it from the current Items, including when that leaves the list empty |
| `itemsRendered` | Signal | — | Fires once every item component exists and has been added; item creation is spread across frames, so this is the only honest moment to measure or scroll the list |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `failure` | Signal | — | Fires when the Repeater could not rebuild: no Items bound, no Template set, or nothing to render into |

## Dynamic ports

_This node's port list changes at runtime (declared-port-groups, runtime-discovered); the tables above may be incomplete for a given instance._

The "Template Type"/template component determines dynamic input ports: inputs of the item template component are exposed so static values can be fed to each created item.

| Condition | Inputs shown | Outputs shown |
|---|---|---|
| templateType = explicit OR templateType NOT SET | `template` | — |
| templateType = dynamic | `templateScript` | — |

## Ports at runtime

Two dynamic mechanisms: `template`/`templateScript` swap in and out based on `templateType` (declared-port-groups), and outputs named after signals sent by item components are registered on demand (runtime-discovered) — an item component's Component Outputs signal appears as an output port here so a list can bubble events up.

## Patterns

- Query Records `items` → Repeater `items`: the canonical data-driven list.
- Item component declares Component Inputs matching record property names — no explicit per-field wiring at the list level.

## Watch out for

- Triggering `refresh` whenever data changes: the repeater already diffs `items`; refresh forces a full rebuild and loses instance state.
- Binding huge unpaged query results into a repeater; page or limit the query instead.

## Examples

**List page: Repeater fed by Query Records**

The canonical data-list shape. Query Records (DbCollection2) fetches a database class and exposes the result on its `items` array output; the Repeater (For Each) consumes that array and instantiates its `template` component once per record. Each record's properties are delivered to the item component through Component Inputs whose names match the record's property names — the item component reads them like any other input. The Repeater and its item template component are separate components by design.

**Card grid: Query Records into a Repeater, in a Columns node that reflows on its own**

The canonical data grid, and the layout decision most often got wrong. Use a Columns node with sizing "autoFit" and a minWidth of 260-320px: it fits as many columns as the CONTAINER holds and reflows by itself, with no breakpoints to maintain. Columns handles a Repeater child correctly — the Repeater draws nothing and adds its items as siblings, so Columns skips it and gives each real item a column box. The card component is width 100% and lets the column size it, which is what makes the SAME card work in this grid, in a 2-up related row, and in a sidebar. Do NOT reach for a Group with flexWrap: a wrapped flex row does not shrink its children, so each item needs a hardcoded percentage track, and — the part that matters — no Group anywhere in the runtime has a breakpoint, so that layout can never collapse on a narrow screen. Record fields reach the item through Component Inputs whose names match the record properties, and wiring a field straight into a Group's visible port is conditional rendering with no logic node.

## Related nodes

[Query Records](../cloud-services/db-collection2.md), [Component Inputs](../component-utilities/component-inputs.md), [Component Outputs](../component-utilities/component-outputs.md), [Repeater Item](../data/for-each-actions.md), [Static Array](../data/static-data.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
