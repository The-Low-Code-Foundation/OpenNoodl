---
title: "Aggregate Records"
---
Aggregate Records: computes min/max/sum/avg/distinct over a database class server-side, inside a cloud function.

Aggregate Records runs an aggregation query against a cloud database class without transferring the records. It only exists in the cloud runtime, so it is used inside cloud function components. Pick the class in `collectionName` (Class), optionally narrow the records with a visual or JavaScript filter, then declare named aggregates in the `aggregates` list: for each name you choose a property and an operation — Min/Max/Sum/Avg for number properties, Distinct for string properties — and get an output carrying the computed value. `fetched` (Success, signal) fires when results arrive; `failure` (signal) fires and `error` (string value) is set on failure. The node also fetches automatically when its configuration inputs change, unless an explicit fetch signal is connected.

## When to use it

Use it for counts, sums, averages and distinct-value lists over many records — computing these server-side is the point. To read the records themselves use DbCollection2 (Query Records); browser logic must reach this node through a cloud function called via CloudFunction2.

## At a glance

| | |
|---|---|
| Category | Cloud Services |
| Type name | `noodl.cloud.aggregate` |
| Available in | cloud |
| SSR compatibility | — |
| Provided by | `noodl-viewer-cloud` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `aggregates` | Stringlist | — | Names of the aggregates to compute, each of which gets its own property and operation inputs |

## Outputs

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `fetched` | Signal | — | Fires once the aggregation has returned and the aggregate outputs are up to date |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `error` | String | — | Why the last aggregation failed; empty until one does |
| `failure` | Signal | — | Fires when the aggregation could not be run, after the reason has been reported on the error channel |

## Dynamic ports

_This node's port list changes at runtime (runtime-discovered); the tables above may be incomplete for a given instance._

Group/aggregate output ports are generated from the aggregation definition in the node parameters.

## Ports at runtime

Ports are generated from the node's parameters and the database schema: `collectionName` (edit-only class enum), a filter port set that mirrors Query Records (visual `visualFilter` with `qp-<name>` query-parameter inputs, or a JavaScript filter with `storageFilterValue-<name>` inputs), a `storageFetch` ('Do', signal) action input, and per aggregate name `aggprop-<name>`/`aggop-<name>` edit-only inputs plus an `agg-<name>` output typed number (Min/Max/Sum/Avg) or string (Distinct). When `storageFetch` is not connected, any change to class, filter or query parameters schedules a fetch automatically.

## Patterns

- Request `receive` → `storageFetch`, `agg-<name>` → Response result inputs, `fetched` → Response `send`: a stats endpoint the browser calls with CloudFunction2.

## Watch out for

- Querying all records with DbCollection2 and summing them in graph logic — aggregate server-side instead and return only the numbers.

## Examples

**Server-side aggregation exposed as a cloud function**

Aggregate Records runs count/sum/min/max/average over a database class without transferring the records — it exists only in the cloud runtime, so the idiomatic shape is a small cloud function around it: Request triggers the aggregate's fetch, `fetched` sends the Response, and the aggregate results (outputs generated from the `aggregates` configuration) are returned as response params. The browser calls it like any cloud function and renders the statistic.

## Related nodes

[Request](../cloud/noodl-cloud-request.md), [Response](../cloud/noodl-cloud-response.md), [Cloud Function](./cloud-function2.md), [Query Records](./db-collection2.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
