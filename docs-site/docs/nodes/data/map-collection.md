---
title: "Array Map"
---
Array Map: transforms each element of an input array with a map script, emitting a new array and leaving the source untouched.

Array Map runs its `mapScript` once per element of `items` — the script calls `map(...)` with the reshaped object, with the current element available as `object` — and outputs the resulting new array. The transformation is non-destructive and re-runs when the input array changes, so it behaves like a live derived view.

## When to use it

Reshaping list data between its source and the UI: computing display labels, renaming properties, deriving fields. For narrowing a list use Array Filter; for arbitrary multi-array logic a Function node is clearer than a chain of maps.

## At a glance

| | |
|---|---|
| Category | Data |
| Type name | `Map Collection` |
| Available in | browser, cloud |
| SSR compatibility | safe |
| Provided by | `noodl-runtime` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `items` | Array | — | Array to map; the node re-runs whenever this array reports a change |
| `mapScript` | String | `map({
	// Here you add mappings between the input object and the mapped output object.
	//myOutputProp: 'inputProp',
	//anotherProperty: function(object) { return object.get('someProperty') + ' ' + object.get('otherProp') }
})
` | Script run once per record, declaring the output properties through map({ … }); each entry is either a source property name or a function of the record |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `refresh` | Signal | — | Re-runs the mapping now, for a source array that changed without notifying |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `count` | Number | — | How many records the last successful mapping produced |
| `items` | Array | — | A new array of records built by the script; the source array is never modified |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires once a Refresh you triggered has run and Items is up to date |
| `modified` | Signal | — | Fires once the mapping has run and Items is up to date, whether an author asked for the run or an input changed; wire Done instead for the outcome of a Refresh you triggered |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `error` | String | — | Why the last mapping failed, in one sentence; empty until something fails |
| `failure` | Signal | — | Fires when the script could not be compiled, or threw while mapping a record |

## Patterns

- Source array → Array Filter → Array Map → Repeater: narrow first, then shape for display.

## Watch out for

- Mutating `object` inside the map script — emit a new shape via map(); mutation writes through to the shared source objects.

## Examples

**Static array filtered and mapped into a list**

Local data without a backend: Static Array holds inline JSON, Array Filter narrows it with a per-item filter script, Array Map reshapes each element with a map script, and the result drives a Repeater. Filter and Map are non-destructive — they emit new arrays and leave the source untouched, so several differently-filtered views can share one source.

## Related nodes

[Array Filter](./filter-collection.md), [Array](./collection2.md), [Static Array](./static-data.md), [Function](../custom-code/java-script-function.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
