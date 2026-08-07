---
title: "Date Add"
---
A date shifted by an amount of a unit. Months and years CLAMP: 31 January plus one month is 28 February.

Date Add takes a date and produces the date that many units later, recomputing whenever Date, Amount or Unit changes. A negative amount subtracts. Milliseconds through weeks are fixed durations and are exact. Months and years are calendar steps and CLAMP to the end of the target month: 31 January plus one month is 28 February (29 in a leap year), never 2 or 3 March, and 29 February plus one year is 28 February. Both answers are defensible; the classic date bug is not knowing which one you have, so this one is written down. Date accepts a Date, an ISO string or a millisecond timestamp, because a JSON round trip through a Request or Response node turns a date into one of the latter two.

## When to use it

Deadlines, trial expiry, renewal dates, 'thirty days from now', 'the same day next month'.

## At a glance

| | |
|---|---|
| Category | Utilities |
| Type name | `net.noodl.DateAdd` |
| Available in | browser, cloud |
| SSR compatibility | safe |
| Provided by | `noodl-runtime` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `amount` | Number | `0` | How much to add. Negative subtracts. Months and years use whole steps |
| `input` | Date | — | The instant to shift. A string or a millisecond timestamp arriving here is read as a date |
| `unit` | Enum (`milliseconds`, `seconds`, `minutes`, `hours`, `days`, `weeks`, `months`, `years`) | `days` | What Amount counts. Months and years are calendar steps and CLAMP: 31 January plus one month is 28 (or 29) February, never 2 March |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `result` | Date | — | Date shifted by Amount of Unit, or unset when Date could not be read |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `changed` | Signal | — | Fires after Result has been recomputed, whichever input caused it |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `failure` | Signal | — | Fires when Date could not be read, leaving Result unset |

## Patterns

- Now Date → Date Add (+14 days) → Create Record: a trial end date computed on the server.

## Watch out for

- Using Days where Months was meant, to avoid thinking about clamping. 30 days and 1 month are different dates in eleven months of the year.

## Related nodes

[Now](./net-noodl-now.md), [Date Difference](./net-noodl-date-difference.md), [Date To String](./date-to-string.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
