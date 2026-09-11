---
title: "Log"
---
Writes a line to the log — the structured backend log inside a cloud function, the browser console in an app.

Log writes a message, at a level, when its Log signal fires. Where the line goes is chosen by the runtime, not by you: inside a cloud function it goes to the backend's structured log — one JSON line per event on stdout, carrying the run's request id and the id of this node — and a copy is recorded as a step in the run's execution record, so the History panel shows it beside the rest of the run. In a browser app the same node writes to the console at the matching level. Value passes straight through, so the node can sit inline on a wire without breaking the chain. The important difference from a Function node's console.log is redaction: in a cloud function every property of Data whose name says it holds a credential is replaced before the line is written, and the values of the backend's own stored secrets are scrubbed out of the message text as well — so wiring a Secret node's Value into a Log message writes [REDACTED], not the credential.

## When to use it

Tracing what a cloud function actually did with a real request, and leaving a breadcrumb for the next person who has to answer 'what happened at 3am'. Use the Data object for anything you might want to filter on later: the backend's log is JSON, so `jq 'select(.orderId==7)'` works on structured fields and does not work on a sentence.

## At a glance

| | |
|---|---|
| Category | Utilities |
| Type name | `net.noodl.Log` |
| Available in | browser, cloud |
| SSR compatibility | safe |
| Provided by | `noodl-runtime` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `data` | Object | — | An optional object written alongside the message as structured fields. In a cloud function every property whose NAME says it holds a credential is redacted on the way out |
| `level` | Enum (`debug`, `info`, `warn`, `error`) | `info` | How loud this line is. In a cloud function the backend drops anything below its configured level, so Debug lines cost nothing in production unless someone turns them on |
| `message` | String | — | The line to write. Free text, so keep credentials out of it by habit — the backend does scrub the values of its own stored secrets out of this before it is written, but that cannot cover a credential it never issued |
| `value` | * | — | Passed straight through to the Value output, so this node can sit inline on a wire |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `log` | Signal | — | Writes the line. Nothing is written until this fires |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `value` | * | — | Whatever arrived on the Value input, unchanged — this node never alters what passes through it |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation. This node has no other outcome — no Unchanged and no Failure — so it always fires together with Done, and wiring either one does the same thing. It is here on every action so that reaching for it is never a per-node decision |
| `done` | Signal | — | Fires once the line has been written |

## Patterns

- Splice it onto an existing wire: value in, value out, and the Log signal taken from whatever outcome you want to record. The graph behaves identically with the node removed.
- Log at `error` on a Failure branch, with the failing record's id in Data. That line carries the request id, so it lines up with the access log and the execution record.

## Watch out for

- A Log node inside a Run Tasks loop over thousands of items. That is thousands of stdout lines and thousands of execution-record steps; the backend caps the copies it records per run, but the volume is still yours to think about.
- Putting a credential in Message on purpose, on the assumption it will be scrubbed. The backend scrubs the values it issued; a token that arrived in a request body is not one of them.

## Examples

**Is this due date in the past?**

Bubble writes this as `Date1 is after Current date & time`, and the literal translation is the thing that goes wrong. Date Compare answers before, after and same together, as booleans and as signals, so you do not need three nodes or an Expression — but Granularity decides whether the answer means anything. Left at Millisecond a due date is essentially never `Same` as now, so an invoice due today reports as overdue the moment the clock passes midnight-plus-one-millisecond. Set Granularity to Day and the three answers become the three a person means: `Before` is overdue, `Same` is due today, `After` is still to come. Now is not a live clock — it reads the wall clock when it is created and again on every `Read`, so a card rendered at 23:59 and left open keeps yesterday's answer until something re-reads it. Truncation to the chosen granularity happens in the host's local zone, which on a server is whatever the container's zone is; if 'today' must mean the user's today, compare on values you have already normalised. The due date arrives as a `date` — a Date Compare fed an ISO string that will not parse fires `failure` rather than silently answering `After`, which is the outcome worth wiring when the date comes from a record someone else filled in. Here it goes to a Log at warning level, because a row that silently renders as 'Upcoming' because its date was a malformed string is the kind of bug nobody reports.

**Do these two bookings overlap?**

Bubble has a date range as a first-class type, so it can write `DateRange1 overlaps with DateRange2` and be done. NodeGX has no range type, and the honest translation is not a missing feature — it is two Date Compares and one line of boolean. Two intervals overlap exactly when each one starts before the other ends, so `requestStart < bookedEnd AND bookedStart < requestEnd`; that single identity also answers Bubble's `contains point` (a point is a range of zero length), `is contained by`, `is after` and `is before` on ranges, which is why one worked example covers a dozen dictionary rows. Note what is deliberately NOT here: no test for `requestStart < requestEnd`. Comparing the two ends of one range is what `<-min->` and `<-max->` are for in Bubble, and a range whose end precedes its start makes this expression answer `false` — no clash — which is the wrong answer to a malformed request rather than the right answer to a valid one. Validate the range before you ask this question. Granularity is set to Minute rather than left at Millisecond because bookings are made in minutes: at Millisecond, a slot ending at 10:00:00.000 and one starting at 10:00:00.000 are already non-overlapping, which is correct and also not what anyone booking a room means by back-to-back. Both comparisons share one failure Log — a date that will not parse makes `Before` false on that node, and false here reads as 'no clash', so an unreported failure is an accepted double booking. The answer is published on a Component Outputs port rather than only lighting a Text, because the caller that placed this row is the thing that has to decide whether to let the booking through — a component that computes the answer and keeps it to itself forces every caller to recompute it.

**Turn an email address into a stable fingerprint**

The dictionary asks for `:formatted as MD5 hash` and `:formatted as SHA1 Hash`, and the honest answer is that this node offers neither — SHA-256, SHA-384 and SHA-512 only. That is a decision, not a gap: WebCrypto, which Hash runs on in both the browser and a cloud function, does not implement MD5 or SHA-1 for digesting, and hand-rolling one would mean shipping a hash that is broken for every purpose either was ever used for. If you are migrating a Bubble app that stored MD5 fingerprints, they will not reproduce here and no setting will make them; treat that as a re-hash of the source data, not a translation. Two details decide whether this works. Hash is ASYNCHRONOUS — the digest is computed off a later turn than the `Do` that started it — so Digest is wired to the Text and the button is wired to `Do`; reading Digest in the same pass as the click would read the previous answer. And hashing is exact, so the normalisation in front of it is doing real work: `Foo@Example.com ` and `foo@example.com` are different bytes and therefore entirely different digests, which is how a 'stable fingerprint' quietly stops matching. Trim and lower-case first, deliberately, and write down that you did. Failure fires only when WebCrypto is unavailable, which in a browser means the page is not on a secure origin — worth a Log, because the symptom is a blank fingerprint rather than an error. The digest is published as well as rendered: a fingerprint that only ever reaches a Text is a fingerprint nothing can be compared against.

**Let someone paste a CSV and read it into records**

Parse CSV is the node for CSV that ARRIVES at runtime — pasted, uploaded or fetched — as opposed to Static Data, which is for CSV you type into the graph while building. With Has Header ticked the first row names the properties and Items is an array of records; untick it and Items is an array of rows, each an array of cells. The one thing to plan for is that every cell comes out a STRING: there is no type inference, so a column that looks numeric gives you "42" and not 42, and a comparison against a number will be false everywhere until you convert. That is a deliberate choice rather than an omission — guessing types is how a column of postcodes loses its leading zeros. Two more behaviours that save a support ticket each: a leading byte-order mark, which is exactly what Excel writes when it saves UTF-8, is stripped so the first column keeps its name rather than becoming a field nothing matches; and Delimiter needs changing to `;` for many European exports, where a comma is the decimal separator. Failure leaves Items and Count holding what they held before, which is why the error is logged rather than ignored — without that wire, a paste that fails to parse looks exactly like a paste that did nothing, and the person tries again with the same file.

## Related nodes

[Secret](../cloud/noodl-cloud-secret.md), [Request](../cloud/noodl-cloud-request.md), [On App Error](./on-app-error.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
