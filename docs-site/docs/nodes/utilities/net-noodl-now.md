---
title: "Now"
---
The current date and time, as a Date, a millisecond timestamp and an ISO string. Re-read on demand.

Now reads the wall clock when the node is created and again on every Read, and publishes the same instant in three shapes: a Date for the other date nodes, a millisecond timestamp for arithmetic and storage, and an ISO-8601 UTC string for a JSON body. The outputs hold the instant of the last Read — they are not a live clock, so a graph that wants a ticking value pairs this with a Timer. It reads Date.now(), which is the same clock in the browser, on the SSR server and in a cloud function.

## When to use it

Stamping when something happened, comparing a stored date against the present, or computing a deadline together with Date Add. In a cloud function it is the server's clock, which is the one you want for anything a client should not be able to lie about.

## At a glance

| | |
|---|---|
| Category | Utilities |
| Type name | `net.noodl.Now` |
| Available in | browser, cloud |
| SSR compatibility | safe |
| Provided by | `noodl-runtime` |

## Inputs

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `read` | Signal | — | Re-reads the clock. The outputs hold the instant of the last Read, not a live value |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `date` | Date | — | The instant of the last Read, for the other date nodes |
| `iso` | String | — | The same instant as an ISO-8601 string in UTC — the shape to put in a JSON body |
| `timestamp` | Number | — | The same instant as milliseconds since 1 January 1970 UTC |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation. This node has no other outcome — no Unchanged and no Failure — so it always fires together with Done, and wiring either one does the same thing. It is here on every action so that reaching for it is never a per-node decision |
| `done` | Signal | — | Fires once the outputs hold the freshly-read instant |

## Patterns

- Request receive → Now Read, then Date → Date Compare: 'is this due date in the past', answered on the server's clock.
- Now Date → Date Add (+30 days) → Date To String: a deadline, rendered.

## Watch out for

- Expecting the outputs to advance on their own. They hold the last Read; wire a Timer if you want them to tick.

## Examples

**Is this due date in the past?**

Bubble writes this as `Date1 is after Current date & time`, and the literal translation is the thing that goes wrong. Date Compare answers before, after and same together, as booleans and as signals, so you do not need three nodes or an Expression — but Granularity decides whether the answer means anything. Left at Millisecond a due date is essentially never `Same` as now, so an invoice due today reports as overdue the moment the clock passes midnight-plus-one-millisecond. Set Granularity to Day and the three answers become the three a person means: `Before` is overdue, `Same` is due today, `After` is still to come. Now is not a live clock — it reads the wall clock when it is created and again on every `Read`, so a card rendered at 23:59 and left open keeps yesterday's answer until something re-reads it. Truncation to the chosen granularity happens in the host's local zone, which on a server is whatever the container's zone is; if 'today' must mean the user's today, compare on values you have already normalised. The due date arrives as a `date` — a Date Compare fed an ISO string that will not parse fires `failure` rather than silently answering `After`, which is the outcome worth wiring when the date comes from a record someone else filled in. Here it goes to a Log at warning level, because a row that silently renders as 'Upcoming' because its date was a malformed string is the kind of bug nobody reports.

**How many days are left on this trial?**

Bubble's `<-range->` gives a range whose duration you then read; here the duration is the whole question, and Date Difference answers it directly as To minus From. Two things about that subtraction decide whether the banner is right. It is SIGNED — an expired trial reports a negative number, and that is the useful behaviour, because Absolute would turn 'three days overdue' into 'three days left'. And for fixed units it is NOT rounded: a trial with 36 hours to run reports 1.5 days, so a banner wired straight to Difference says '1.5 days left'. That is why the Expression is here rather than as an afterthought — `Math.max(0, Math.ceil(d))` rounds up (a trial with any part of a day left has a day left, which is what a person counting means), and clamps the expired case to zero so the banner never counts downward past the end. Date Add supplies the end date from the signup date, and its clamping rule matters if you ever change Unit to Months: 31 January plus one month is 28 February, not 2 March. The end date is rendered through Date To String rather than pasted in as a number, because Difference is a number and a date is not.

**Group these records by month**

Bubble spells this `Date1 rounded down to month`, and it is really two different questions wearing one phrase. If you want a KEY to group by, that is Date To String — and it must be Date To String rather than Date Parts, because of a difference this example exists to show: Date Parts gives Month as a NUMBER 1-12, so `{year}-{month}` through String Format renders September as `2026-9`, which sorts after `2026-10` as text and quietly scrambles a grouped list. Date To String's `{month}` token is the zero-padded one, so the same key comes out `2026-09` and sorts correctly. The unpadded tokens there are `{m}` and `{d}`; the padded ones are `{month}` and `{date}`. If instead you want to COMPARE two dates rounded down — Bubble's `equals rounded down to month` — do not round at all: Date Compare's Granularity does the truncation internally, so setting it to Month answers 'same month' directly and there is no intermediate value to get wrong. Date Parts is still the right node when you want the fields themselves, and this shows that too: Day Name and ISO Week come off it, and ISO Week is genuinely ISO-8601, so 1 January 2027 is week 53 of 2026 rather than week 1 of 2027. Every field here is read in the host's local zone — on a server, whatever the container's TZ says — so when the zone is part of the answer, format through Date To String's Timezone input instead. The month key is published because grouping happens in the parent: the row can compute its own bucket, but only the list above it can put rows into buckets.

**Dates a person would read, without a Function node**

One instant from Now, rendered three ways by three Date To String nodes — no JavaScript anywhere. The headline uses the weekday and the full month name ({dayName}, {d} {monthName} {year} → "Thursday, 10 September 2026"); the time uses the 12-hour clock and a meridiem ({h12}:{minutes} {ampm} → "3:05 pm"); the third is the same headline with Locale set to fr-FR, which translates the month and day NAMES and nothing else. Tokens are the whole vocabulary: {d} {m} {h} {min} {s} are the unpadded numbers, {date} {month} {hours} {minutes} {seconds} the padded ones, and anything the node does not recognise is copied through unchanged — which is why a moment/date-fns pattern like HH:mm:ss renders as the literal text HH:mm:ss rather than a time.

## Related nodes

[Date Add](./net-noodl-date-add.md), [Date Compare](./net-noodl-date-compare.md), [Date To String](./date-to-string.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
