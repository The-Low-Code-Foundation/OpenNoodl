---
title: "Stream Buffer"
---
Stream Buffer: batches items arriving faster than the UI wants to react, flushing on a count, an interval, or on demand.

Each `add` appends the current `data` to a buffer. The buffer empties when `flushSize` items have collected, when `flushInterval` milliseconds have passed since the first item after the last flush, or when `flush` fires — whichever comes first. `flushedData` is a detached array, so a later Add cannot mutate what a downstream node is already rendering. The interval timer is armed only while items are waiting, is re-armed rather than left stale when the interval changes, and is cleared on a manual flush and when the node is deleted. `maxSize` caps the buffer, dropping the oldest and reporting it on `droppedItems` with an `overflowed` signal. A `flush` that finds nothing, and a `clear` with nothing to discard, report `unchanged` — an idle buffer doing exactly what it should, not a failure.

## When to use it

Any producer that outruns the UI: a token stream driving a Repeater, high-rate telemetry, a log feed. Batching turns hundreds of small graph updates a second into a few. Not needed when updates are already infrequent, and not a substitute for Text Accumulator when the thing being batched is text that should be concatenated rather than listed.

## At a glance

| | |
|---|---|
| Category | Data |
| Type name | `net.noodl.StreamBuffer` |
| Available in | browser, cloud |
| SSR compatibility | partial — Interval-based flushing needs a running timer, so it only happens in the browser. Add, Flush and size-based flushing behave normally. |
| Provided by | `noodl-runtime` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `data` | * | — | The next item to buffer, of any type; its value is retained between pulses of Add |
| `flushInterval` | Number | `0` | Flush automatically this often in milliseconds while items are buffered; 0 disables interval flushing |
| `flushSize` | Number | `0` | Flush automatically once this many items are buffered; 0 disables size-based flushing |
| `maxSize` | Number | `10000` | Hard cap on buffered items; overflow drops the oldest and is counted on Dropped Items; 0 means no cap |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `add` | Signal | — | Buffers the current Data, flushing straight away if that reaches Flush Size |
| `clear` | Signal | — | Discards the buffer and resets both counters without flushing |
| `flush` | Signal | — | Hands the whole buffer to Flushed Data now; an empty buffer is a legitimate no-op |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `buffer` | Array | — | Items waiting to be flushed, oldest first |
| `bufferSize` | Number | — | How many items are waiting, which is what Flush Size is compared against |
| `droppedItems` | Number | — | How many items Max Size has discarded from the front since the last Clear |
| `flushCount` | Number | — | How many flushes have happened since the last Clear |
| `flushedData` | Array | — | The batch handed over by the most recent flush; a stable array that later Adds do not mutate |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `cleared` | Signal | — | Fires once the buffer has been discarded |
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires once an Add, Flush or Clear you triggered has changed the buffer |
| `flushed` | Signal | — | Fires once Flushed Data holds a new batch, and not for a flush that found nothing |
| `overflowed` | Signal | — | Fires when Max Size has just discarded something |
| `unchanged` | Signal | — | Fires when a Flush found nothing to send, or a Clear found nothing to discard — an idle buffer doing exactly what it should |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `error` | String | — | Why the last Add was refused; blank until one is |
| `failure` | Signal | — | Fires when Add ran before any value had arrived on Data, so nothing was buffered |

## Patterns

- Server-Sent Events `onMessage` → `add` with `flushInterval` 250 and `flushedData` → For Each: a live list that repaints four times a second instead of hundreds.
- `flushSize` and `flushInterval` together give 'whichever comes first', which keeps both a burst and a trickle responsive.
- The stream's `onClose` → `flush` releases the tail of a batch that never reached the flush size.

## Watch out for

- Relying on Flush Interval during server-side rendering — timers never advance there, so only Add, Flush and size-based flushing work.
- Using this to concatenate streamed text; Text Accumulator is the node for that.
- Setting Flush Size to 1, which is the same as no buffer at all plus an extra hop.

## Examples

**Long-running task monitor: progress, batched log lines, and a visible connection**

A backend job streams two kinds of frame on one connection. Pattern Extractor pulls the percentage out of human-readable status text, so a progress bar tracks it without a Function node. JSON Stream Parser turns NDJSON log payloads into values — several may complete in one frame, so `values` rather than `parsed` is what feeds downstream. Stream Buffer batches those into a flush every 250 ms, which keeps a busy log from repainting the list hundreds of times a second, and the stream's `onClose` flushes the tail that never reached a full batch.

## Related nodes

[Server-Sent Events](./net-noodl-sse.md), [Text Accumulator](./net-noodl-text-accumulator.md), [JSON Stream Parser](./net-noodl-jsonstream-parser.md), [Repeater](../visual/for-each.md), [Array](./collection2.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
