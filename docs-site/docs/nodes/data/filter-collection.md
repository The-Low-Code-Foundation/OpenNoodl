---
title: "Array Filter"
---
Array Filter: filters, sorts and limits an input array into a new output array, re-running automatically when the source changes.

Takes an array on `items`, applies the filter, sort and limit configured in its parameters, and outputs the result as a new array on `items` — the input array is never mutated, and each run produces a fresh array object. It re-runs automatically whenever `items`, `enabled`, the filter settings or the source array's contents change; each of those is a Run On Value Change tick-box, ticked by default, and connecting the `filter` signal does not turn any of them off. With `enabled` false the input passes through unfiltered (still as a copy). After each run `modified` (Filtered) fires and `count`/`firstItemId` describe the output; a run you triggered with `filter` or `refresh` also reports `done`/`failure` and then `completed`. Filter operators: eq/neq for all types, lt/gt/lte/gte for numbers, regex (with optional case sensitivity) for strings.

## When to use it

Client-side filtering, searching and sorting of arrays already in memory — e.g. a live search box over a Static Array or shared Array. For server data prefer filtering in the Query Records node so the database does the work; for reshaping item properties use Array Map.

## At a glance

| | |
|---|---|
| Category | Data |
| Type name | `Filter Collection` |
| Available in | browser, cloud |
| SSR compatibility | safe |
| Provided by | `noodl-runtime` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `enabled` | Boolean | `true` | When false the input array passes straight through — unfiltered, unsorted and unlimited |
| `items` | Array | — | Array to filter; the node re-runs whenever this array changes, unless you untick it under Run On Value Change |
| `runOnChange-array` | Boolean | `true` | Whether a new value on Array contents re-runs this node. On by default; untick to make this input passive so only the control signal runs it |
| `runOnChange-enabled` | Boolean | `true` | Whether a new value on Enabled re-runs this node. On by default; untick to make this input passive so only the control signal runs it |
| `runOnChange-filterSettings` | Boolean | `true` | Whether a new value on Filter settings re-runs this node. On by default; untick to make this input passive so only the control signal runs it |
| `runOnChange-items` | Boolean | `true` | Whether a new value on Items re-runs this node. On by default; untick to make this input passive so only the control signal runs it |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `filter` | Signal | — | Runs the filter now and replaces Items with the result. This is additional to it re-running when Items, Enabled, the filter settings or the array contents change; untick any of those under Run On Value Change to stop it |
| `refresh` | Signal | — | Runs the filter now — the same action as Filter, under the name the rest of the Array family uses |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `count` | Number | — | How many records passed the filter, after Skip and Limit have been applied |
| `firstItemId` | String | — | Id of the first record that passed, or empty when nothing matched |
| `items` | Array | — | A new array holding the records that passed, in sort order; the input array is never modified |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires once a Filter or Refresh you triggered has run and Items is up to date |
| `modified` | Signal | — | Fires once the filter has run and Items is up to date, whether an author asked for the run or an input changed; wire Done instead for the outcome of a Filter you triggered |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `error` | String | — | Why the last run failed, in one sentence; empty until something fails |
| `failure` | Signal | — | Fires when the filter could not be applied — a pattern that will not compile, or a Filter pulse with no array connected |

## Dynamic ports

_This node's port list changes at runtime (runtime-discovered); the tables above may be incomplete for a given instance._

Some ports are discovered at runtime from user code, parameters or connected components, and are pushed to the editor per instance; the static port list below is incomplete for such instances.

## Ports at runtime

The filter/sort/limit configuration creates its own input ports, pushed to the editor per instance: `filterFilter` (a stringlist of property names) generates, per property <p>, `filterFilterType-<p>` (string/number/boolean), `filterFilterOp-<p>` (eq, neq, regex for strings; eq, neq, lt, gt, gte, lte for numbers), `filterFilterValue-<p>` (a connectable value — wire a text input here for live search) and, for regex, `filterFilterOption-case-<p>`. `filterSort` (stringlist) generates `filterSort-<p>` (ascending/descending) per property. `filterEnableLimit` (boolean) reveals `filterLimit` (default 10) and `filterSkip` (default 0). An authoring tool must set `filterFilter`/`filterSort` first and use exactly these generated names.

## Patterns

- Static Array or Array `items` → Array Filter `items` → Repeater `items`: a filtered local list.
- Text Input `text` → `filterFilterValue-<prop>` with op regex: live search-as-you-type.

## Watch out for

- Filtering large cloud datasets client-side — put the filter in Query Records instead so only matching records are fetched.

## Examples

**Static array filtered and mapped into a list**

Local data without a backend: Static Array holds inline JSON, Array Filter narrows it with a per-item filter script, Array Map reshapes each element with a map script, and the result drives a Repeater. Filter and Map are non-destructive — they emit new arrays and leave the source untouched, so several differently-filtered views can share one source.

## Related nodes

[Array](./collection2.md), [Static Array](./static-data.md), [Array Map](./map-collection.md), [Repeater](../visual/for-each.md), [Query Records](../cloud-services/db-collection2.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
