---
title: "Date Parts"
---
The fields of a date — year, month, day, time, weekday and ISO week — as outputs off one node.

Date Parts takes a date apart into eleven outputs. Month is 1-12, not JavaScript's 0-11: nobody reading a port called Month expects January to be 0. Day of Week keeps JavaScript's numbering (0 is Sunday) and Day Name gives the English name beside it. ISO Week is ISO-8601 — weeks start Monday and week 1 is the one holding the first Thursday, so 1 January 2027 is week 53 of 2026. All fields are read in the host's local zone, which on a server is whatever the container's TZ says; when the zone matters, format through Date To String's Timezone input instead of reading parts here.

## When to use it

Grouping by month or year, branching on the weekday, building a custom label from pieces, or feeding a chart axis. One node rather than seven, so every field comes from the same instant.

## At a glance

| | |
|---|---|
| Category | Utilities |
| Type name | `net.noodl.DateParts` |
| Available in | browser, cloud |
| SSR compatibility | safe |
| Provided by | `noodl-runtime` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `input` | Date | — | The instant to take apart. A string or a millisecond timestamp here is read as a date |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `date` | Number | — | Day of the month, 1-31 |
| `dayName` | String | — | The English name of the weekday. For a localised name, format through Date To String |
| `dayOfWeek` | Number | — | Day of the week as 0-6, Sunday first — JavaScript s own numbering |
| `hours` | Number | — | Hour of the day, 0-23 |
| `isoWeek` | Number | — | ISO-8601 week number, 1-53: weeks start on Monday and week 1 holds the first Thursday |
| `milliseconds` | Number | — | Milliseconds past the second, 0-999 |
| `minutes` | Number | — | Minutes past the hour, 0-59 |
| `month` | Number | — | Month as 1-12 — January is 1, not 0 |
| `seconds` | Number | — | Seconds past the minute, 0-59 |
| `timestamp` | Number | — | The instant as milliseconds since 1 January 1970 UTC |
| `year` | Number | — | Four-digit year, in the host s local zone |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `changed` | Signal | — | Fires after a new Date has been taken apart and every part output is up to date |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `failure` | Signal | — | Fires when a date arrived that could not be read, leaving every part unset |

## Patterns

- Date Parts Month → String Mapper: a month name in your own wording, without a formatter.

## Watch out for

- Reading parts here to render a date for a user in another timezone. Use Date To String with a Timezone; these fields are always local.

## Related nodes

[Date To String](./date-to-string.md), [Date Compare](./net-noodl-date-compare.md), [Now](./net-noodl-now.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
