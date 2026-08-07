---
title: "Date Compare"
---
Is this date before, after or the same as that one — at a granularity you choose, including 'the same day'.

Date Compare answers all three questions at once, as booleans and as signals, and fires exactly one signal per comparison. Granularity is the point: two instants are almost never the same millisecond, so comparing raw dates answers 'no' to the question people are actually asking. Set Granularity to Day and 09:00 and 17:00 on the same date are Same. Truncation happens in the host's local zone, because 'the same day' is a question about a calendar somebody is looking at — on a server that calendar is whatever the container says, which is worth knowing before you rely on it.

## When to use it

'Is this overdue', 'is this today', 'did these two things happen in the same month'. Wire the booleans into a Condition or the signals into a flow.

## At a glance

| | |
|---|---|
| Category | Utilities |
| Type name | `net.noodl.DateCompare` |
| Available in | browser, cloud |
| SSR compatibility | safe |
| Provided by | `noodl-runtime` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `a` | Date | — | The instant being asked about |
| `b` | Date | — | The instant it is compared against |
| `granularity` | Enum (`millisecond`, `second`, `minute`, `hour`, `day`, `month`, `year`) | `millisecond` | How coarsely to compare. Day answers "is this the same day", which is almost always the question — two instants are hardly ever the same millisecond |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `after` | Boolean | — | True when Date is later than Compare To, at this Granularity |
| `before` | Boolean | — | True when Date is earlier than Compare To, at this Granularity |
| `same` | Boolean | — | True when the two land in the same Granularity bucket — the same day, month or year |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `isAfter` | Signal | — | Fires after a comparison that came out After |
| `isBefore` | Signal | — | Fires after a comparison that came out Before |
| `isSame` | Signal | — | Fires after a comparison that came out Same |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `failure` | Signal | — | Fires when a date arrived that could not be read, leaving all three answers unset |

## Patterns

- Due date → Date, Now Date → Compare To, then On Before → the overdue branch.

## Watch out for

- Leaving Granularity at Millisecond and expecting Is Same to mean 'the same day'. It will essentially never be true.

## Related nodes

[Now](./net-noodl-now.md), [Date Difference](./net-noodl-date-difference.md), [Date Parts](./net-noodl-date-parts.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
