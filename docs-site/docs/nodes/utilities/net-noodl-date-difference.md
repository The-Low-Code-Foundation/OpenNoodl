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

## Examples

**How many days are left on this trial?**

Bubble's `<-range->` gives a range whose duration you then read; here the duration is the whole question, and Date Difference answers it directly as To minus From. Two things about that subtraction decide whether the banner is right. It is SIGNED — an expired trial reports a negative number, and that is the useful behaviour, because Absolute would turn 'three days overdue' into 'three days left'. And for fixed units it is NOT rounded: a trial with 36 hours to run reports 1.5 days, so a banner wired straight to Difference says '1.5 days left'. That is why the Expression is here rather than as an afterthought — `Math.max(0, Math.ceil(d))` rounds up (a trial with any part of a day left has a day left, which is what a person counting means), and clamps the expired case to zero so the banner never counts downward past the end. Date Add supplies the end date from the signup date, and its clamping rule matters if you ever change Unit to Months: 31 January plus one month is 28 February, not 2 March. The end date is rendered through Date To String rather than pasted in as a number, because Difference is a number and a date is not.

## Related nodes

[Date Add](./net-noodl-date-add.md), [Now](./net-noodl-now.md), [Date Compare](./net-noodl-date-compare.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
