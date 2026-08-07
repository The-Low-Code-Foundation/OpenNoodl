---
title: "Date Difference"
---
How far apart two dates are, in a unit you choose. Signed, and unrounded for fixed units.

Date Difference answers To minus From, counted in the chosen unit. It is signed — positive when To is later — so 'days until' and 'days since' are the same node read two ways, and Absolute drops the sign when only the distance matters. Fixed units divide exactly and are NOT rounded: 36 hours is 1.5 days. Months and years are counted in whole calendar steps, because a fractional month is not a quantity anyone can check; the answer is how many whole steps Date Add could take without overshooting, so 31 January to 28 February is 1 month and 31 January to 27 February is 0.

## When to use it

Age, elapsed time, 'days remaining', SLA windows, deciding whether something is stale.

## At a glance

| | |
|---|---|
| Category | Utilities |
| Type name | `net.noodl.DateDifference` |
| Available in | browser, cloud |
| SSR compatibility | safe |
| Provided by | `noodl-runtime` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `absolute` | Boolean | `false` | Drop the sign, so the output is a distance rather than a direction |
| `from` | Date | — | The earlier instant, in the reading that makes Difference positive |
| `to` | Date | — | The later instant. Difference is negative when this is actually earlier than From |
| `unit` | Enum (`milliseconds`, `seconds`, `minutes`, `hours`, `days`, `weeks`, `months`, `years`) | `days` | What Difference counts. Fixed units are exact and fractional (36 hours is 1.5 days); months and years are whole calendar steps |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `difference` | Number | — | To minus From, counted in Unit. Unset while either date is missing or unreadable |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `changed` | Signal | — | Fires after Difference has been recomputed |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `failure` | Signal | — | Fires when a date arrived that could not be read, leaving Difference unset |

## Patterns

- Record date → From, Now Date → To, unit Days: how old this record is.

## Watch out for

- Assuming the result is a whole number. Fixed units are deliberately fractional; round it downstream if you need to.

## Related nodes

[Date Add](./net-noodl-date-add.md), [Now](./net-noodl-now.md), [Date Compare](./net-noodl-date-compare.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
