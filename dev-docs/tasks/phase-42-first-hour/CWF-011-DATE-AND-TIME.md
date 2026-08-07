# CWF-011 — Date maths, in both runtimes

**From:** [TALK-007](TALK-007-WHAT-CLOUD-FUNCTIONS-SHOULD-HAVE.md) §6 row 4, approved 2026-08-05.
**Status:** ✅ **shipped 2026-08-06** — five new nodes in the **shared** runtime, plus a Timezone
input on `Date To String`. One live-QA item outstanding (a browser preview; see Done when).

## What shipped

`Now` · `Date Add` · `Date Difference` · `Date Compare` · `Date Parts` — all
`net.noodl.*`, all registered in `@noodl/runtime`'s own list, so the browser gets them and no
`type !== 'cloud'` guard exists anywhere near them. Plus `Date To String`'s **Timezone** input.

## ⚠️ The doc's own mechanism for slice 1 was wrong, and following it would have shipped 1970

> *"the runtime has a platform hook for this: `platform.getCurrentTime()` … **Use the hook, not
> `Date.now()`** — that is what makes the node testable"*

`platform.getCurrentTime` is **not a wall clock**. In the browser it is
**`window.performance.now()`** ([noodl-viewer-react.js:42](../../../packages/noodl-viewer-react/noodl-viewer-react.js#L42))
— milliseconds since the page loaded — so `new Date(getCurrentTime())` is an instant in January
1970 that creeps forward while the tab stays open. On the SSR server and in both catalog generators
it is `() => 0`. Only the cloud runner happens to pass epoch milliseconds, which is why the claim
survived: it is true in exactly the one runtime the task was written from. The hook is the **frame**
clock — `currentFrameTime`, animation timing and the editor-connection send throttle are its
callers.

`Now` therefore uses `Date.now()`, which is the same clock in all three runtimes. It is written as
`new Date(Date.now())` rather than `new Date()` **so that it stays testable**: the bare constructor
reads the clock internally and ignores a substituted `Date.now`. The determinism the task wanted,
from the mechanism that actually has it.

## The two decisions the task asked to have made

1. **Months and years CLAMP.** 31 January + 1 month = **28 February** (29 in a leap year), never
   2/3 March. 29 February + 1 year = 28 February. Written in `datemath.ts`, on both node pages, and
   in the *name* of the test that holds it.
2. **`Date Difference` in months follows from that**, and the invariant is the useful part:
   `Add(from, Difference(from, to)) never lands past to`. So 31 January → 28 February is **1**
   month (the clamp lands exactly there) and 31 January → 27 February is **0** (one month would
   overshoot). Both cases have their answer in the test name.

## Traps confirmed, and one new one

- **What a `date` port carries: a `Date`** — `Date To String`'s setter has always parsed a string
  into one. `toDate` keeps that and adds *number* (epoch ms), because a JSON round trip through a
  Request or Response node turns a `Date` into a string and a timestamp column turns it into a
  number. That is the ordinary path in a cloud function, not an edge case, and it is what the
  integration spec drives.
- ⚠️ **New, and it will cost the next person an hour:** a node whose graph **id** is `add` fails the
  entire bundle load with *"Cannot assign to read only property 'add' of object '[object Array]'"* —
  `Collection` patches `Array.prototype.add` as read-only and the loader assigns ids onto an array.
  Every function in that bundle then answers 500 with *"Can't find component model"*, which points
  nowhere near the real cause.

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
  - ✅ **Cloud:** [`cloud-date-family.test.ts`](../../../packages/nodegx-backend/tests/cloud-date-family.test.ts)
    drives all five through `POST /functions/:name` against the real service.
  - ✅ **Shared runtime:** [`cwf-011-date.test.ts`](../../../packages/noodl-runtime/test/nodes/cwf-011-date.test.ts)
    exercises the same modules through the same registration path the browser viewer uses.
  - ⚠️ **Outstanding: a browser preview.** Nothing here has been placed on a real canvas or seen in
    a running preview, so the *editor* half — the picker rows under Logic & Utilities → Date & Time
    and Crypto, the property-panel enums, the `date` port colouring — is unverified. That is the
    live-QA item, and it is the only one.
- The month-arithmetic edge case has a test with the chosen answer written into the test's name. ✅
  Four of them, plus the two `Date Difference` cases.
- `Date To String` with no timezone input set produces byte-identical output to today's, proven by a
  test that predates the change. ⚠️ **Not possible as written: `Date To String` had no test at all,
  in either package.** So the proof is the closest honest thing — the expectations are the
  *original* algorithm's output, computed from the same `Date` fields the untouched branch reads,
  with the Timezone input never set; and the no-zone branch in `_format` is the original code
  verbatim rather than a re-derivation.

## Traps

- ⚠️ **Which date type crosses a port?** The runtime has a `date` port type and a `date → string`
  typecast ([nodelibraryexport.ts typecasts](../../../packages/noodl-runtime/src/nodelibraryexport.ts)).
  Establish what a `date` port actually carries — a `Date`, a number, an ISO string — before
  designing four nodes that pass one to each other. Check `Date To String`'s input setter first.
- ⚠️ A JSON round trip through a Request or Response node turns a `Date` into a string. A date
  family that only works when the value never leaves the graph is half a family.
- ⚠️ These belong in the **shared** runtime — no `type !== 'cloud'` guard. The browser wants them
  just as much.
