# CWF-011 — Date maths, in both runtimes

**From:** [TALK-007](TALK-007-WHAT-CLOUD-FUNCTIONS-SHOULD-HAVE.md) §6 row 4, approved 2026-08-05.
**Status:** open, unowned. Independent of every other CWF task.

## What exists, and what it doesn't do

**`Date To String`** is the whole date vocabulary, in both runtimes. It takes a date and a format
string of `{year}-{month}-{date}` placeholders and emits a string
([datetostring.ts](../../../packages/noodl-runtime/src/nodes/std-library/datetostring.ts)). It
already uses `Intl.DateTimeFormat` internally for month names, and it reports an **Invalid Date**
output — so the failure shape is set by precedent, not by us.

There is **no** node that answers: what time is it, what is this plus 30 days, how far apart are
these two, what is the start of this month, is this before that. Every one of those is written as an
Expression or a Function today — in the browser as much as in the cloud. This is a shared-runtime
task that happens to have been surfaced by the cloud audit.

## Slices

### Slice 1 — Now

Current time as a date, plus a Tick/Refresh input so a graph can re-read it. ⚠️ The runtime has a
platform hook for this: `platform.getCurrentTime()` — the cloud runner passes
`() => new Date().getTime()` ([index.ts:26](../../../packages/noodl-viewer-cloud/src/index.ts#L26))
and the test harnesses pass `() => 0`. **Use the hook, not `Date.now()`** — that is what makes the
node testable and what keeps the SSR/deterministic paths honest.

### Slice 2 — Date Add / Date Difference

- Add: date + amount + unit (ms, s, min, h, day, week, month, year) → date.
- Difference: two dates + unit → number, plus a sign or an absolute flag.
- ⚠️ Months and years are **not** fixed durations. Decide and document: "add 1 month to 31 Jan"
  either clamps to 28/29 Feb or overflows to 2/3 Mar. Pick one, write it on the node page, and test
  that exact case. Getting this silently wrong is the classic date bug.

### Slice 3 — Date Compare / Date Parts

- Compare: before / after / same, with an optional granularity (same *day*, not same millisecond).
- Parts: year, month, date, hours, minutes, day-of-week, ISO week — as outputs off one node rather
  than seven nodes.

### Slice 4 — timezone in Date To String

The existing node formats in the host's local zone. On a server that is whatever the container says,
which is the classic "works locally, off by an hour in production" defect. Add a timezone input
(IANA name, default local) and pass it to `Intl.DateTimeFormat`, which already takes it.

⚠️ **This is a change to an existing shipped node.** Default must preserve today's behaviour
exactly, and a declared default does not run its setter — apply it in `initialize`.

## Done when

- Each node driven in **both** runtimes: a browser preview and a real cloud function.
- The month-arithmetic edge case has a test with the chosen answer written into the test's name.
- `Date To String` with no timezone input set produces byte-identical output to today's, proven by a
  test that predates the change.

## Traps

- ⚠️ **Which date type crosses a port?** The runtime has a `date` port type and a `date → string`
  typecast ([nodelibraryexport.ts typecasts](../../../packages/noodl-runtime/src/nodelibraryexport.ts)).
  Establish what a `date` port actually carries — a `Date`, a number, an ISO string — before
  designing four nodes that pass one to each other. Check `Date To String`'s input setter first.
- ⚠️ A JSON round trip through a Request or Response node turns a `Date` into a string. A date
  family that only works when the value never leaves the graph is half a family.
- ⚠️ These belong in the **shared** runtime — no `type !== 'cloud'` guard. The browser wants them
  just as much.
