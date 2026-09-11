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

## Examples

**Is this due date in the past?**

Bubble writes this as `Date1 is after Current date & time`, and the literal translation is the thing that goes wrong. Date Compare answers before, after and same together, as booleans and as signals, so you do not need three nodes or an Expression — but Granularity decides whether the answer means anything. Left at Millisecond a due date is essentially never `Same` as now, so an invoice due today reports as overdue the moment the clock passes midnight-plus-one-millisecond. Set Granularity to Day and the three answers become the three a person means: `Before` is overdue, `Same` is due today, `After` is still to come. Now is not a live clock — it reads the wall clock when it is created and again on every `Read`, so a card rendered at 23:59 and left open keeps yesterday's answer until something re-reads it. Truncation to the chosen granularity happens in the host's local zone, which on a server is whatever the container's zone is; if 'today' must mean the user's today, compare on values you have already normalised. The due date arrives as a `date` — a Date Compare fed an ISO string that will not parse fires `failure` rather than silently answering `After`, which is the outcome worth wiring when the date comes from a record someone else filled in. Here it goes to a Log at warning level, because a row that silently renders as 'Upcoming' because its date was a malformed string is the kind of bug nobody reports.

**Do these two bookings overlap?**

Bubble has a date range as a first-class type, so it can write `DateRange1 overlaps with DateRange2` and be done. NodeGX has no range type, and the honest translation is not a missing feature — it is two Date Compares and one line of boolean. Two intervals overlap exactly when each one starts before the other ends, so `requestStart < bookedEnd AND bookedStart < requestEnd`; that single identity also answers Bubble's `contains point` (a point is a range of zero length), `is contained by`, `is after` and `is before` on ranges, which is why one worked example covers a dozen dictionary rows. Note what is deliberately NOT here: no test for `requestStart < requestEnd`. Comparing the two ends of one range is what `<-min->` and `<-max->` are for in Bubble, and a range whose end precedes its start makes this expression answer `false` — no clash — which is the wrong answer to a malformed request rather than the right answer to a valid one. Validate the range before you ask this question. Granularity is set to Minute rather than left at Millisecond because bookings are made in minutes: at Millisecond, a slot ending at 10:00:00.000 and one starting at 10:00:00.000 are already non-overlapping, which is correct and also not what anyone booking a room means by back-to-back. Both comparisons share one failure Log — a date that will not parse makes `Before` false on that node, and false here reads as 'no clash', so an unreported failure is an accepted double booking. The answer is published on a Component Outputs port rather than only lighting a Text, because the caller that placed this row is the thing that has to decide whether to let the booking through — a component that computes the answer and keeps it to itself forces every caller to recompute it.

**Group these records by month**

Bubble spells this `Date1 rounded down to month`, and it is really two different questions wearing one phrase. If you want a KEY to group by, that is Date To String — and it must be Date To String rather than Date Parts, because of a difference this example exists to show: Date Parts gives Month as a NUMBER 1-12, so `{year}-{month}` through String Format renders September as `2026-9`, which sorts after `2026-10` as text and quietly scrambles a grouped list. Date To String's `{month}` token is the zero-padded one, so the same key comes out `2026-09` and sorts correctly. The unpadded tokens there are `{m}` and `{d}`; the padded ones are `{month}` and `{date}`. If instead you want to COMPARE two dates rounded down — Bubble's `equals rounded down to month` — do not round at all: Date Compare's Granularity does the truncation internally, so setting it to Month answers 'same month' directly and there is no intermediate value to get wrong. Date Parts is still the right node when you want the fields themselves, and this shows that too: Day Name and ISO Week come off it, and ISO Week is genuinely ISO-8601, so 1 January 2027 is week 53 of 2026 rather than week 1 of 2027. Every field here is read in the host's local zone — on a server, whatever the container's TZ says — so when the zone is part of the answer, format through Date To String's Timezone input instead. The month key is published because grouping happens in the parent: the row can compute its own bucket, but only the list above it can put rows into buckets.

## Related nodes

[Now](./net-noodl-now.md), [Date Difference](./net-noodl-date-difference.md), [Date Parts](./net-noodl-date-parts.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
