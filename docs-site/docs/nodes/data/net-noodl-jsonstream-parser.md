---
title: "JSON Stream Parser"
---
JSON Stream Parser: turns stream fragments into JSON values as NDJSON, concatenated values, or one whole document.

Each `parse` appends the current `chunk` to a buffer and extracts whatever is now complete. 'NDJSON' takes one value per line and reports a line that does not parse rather than skipping it silently. 'Stream' accepts any concatenation of complete top-level values — whitespace-separated objects, or a JSON array whose elements are emitted as they close — and is safe at every chunk boundary, including one that falls inside a string. 'Single document' holds everything back until the whole buffer is one complete value, then emits it. Text that is not yet a complete value stays in the buffer and shows on `pendingCharacters`; `maxLength` stops a malformed stream from growing without bound by clearing the buffer and reporting it. `values` carries everything the last parse completed, `parsed` the last of them.

## When to use it

A stream whose payloads are JSON but do not arrive one-per-event: NDJSON logs, a chunked HTTP body, an array streamed element by element. Not needed for Server-Sent Events with one JSON object per event — that node already parses each payload onto its Data output.

## At a glance

| | |
|---|---|
| Category | Data |
| Type name | `net.noodl.JSONStreamParser` |
| Available in | browser, cloud |
| SSR compatibility | safe |
| Provided by | `noodl-runtime` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `chunk` | String | — | The next fragment of the stream; boundaries may fall anywhere, including inside a string |
| `format` | Enum (`ndjson`, `stream`, `single`) | `ndjson` | How values are framed on this stream: one per line, any concatenation of complete values, or one whole document |
| `maxLength` | Number | `1048576` | Cap on unparsed text held while a value completes; exceeding it clears the buffer and reports an error rather than growing forever |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `clear` | Signal | — | Discards the pending text, the parsed values and the error counter |
| `parse` | Signal | — | Appends the current Chunk and emits every value that is now complete; the chunk is retained between pulses |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `isComplete` | Boolean | — | True when the last Parse left nothing pending, so every value so far was whole |
| `parsed` | * | — | The last complete value the most recent Parse produced |
| `pendingCharacters` | Number | — | Text held back because a value is not complete yet; persistently non-zero means Format does not match the stream |
| `valueCount` | Number | — | How many values have been parsed since the last Clear, across every Parse |
| `values` | Array | — | Every value completed by the most recent Parse, in order |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `cleared` | Signal | — | Fires once the pending text and the values have been discarded |
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires when a Parse consumed text or a Clear discarded something; Success is narrower and fires only when values came out |
| `success` | Signal | — | Fires when a Parse yielded at least one value, so a chunk that merely advanced an incomplete value stays quiet |
| `unchanged` | Signal | — | Fires when there was nothing pending to parse, or nothing to clear — a valid action with nothing to do |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `error` | String | — | Why the last value or line would not parse; kept until the next failure or a Clear |
| `errorCount` | Number | — | How many values have failed to parse since the last Clear |
| `failure` | Signal | — | Fires once when a Parse could not read part of its input, or when the pending text exceeded Max Pending; Error Count says how many |

## Patterns

- Server-Sent Events `data` → `chunk`, `onMessage` → `parse`, format NDJSON: a log stream that arrives several lines per event.
- `values` → For Each `items` renders everything a chunk completed, instead of only the last value.
- `pendingCharacters` on a debug Text output makes a format mismatch obvious instead of looking like a dead stream.

## Watch out for

- Using 'Single document' on a never-ending stream — the buffer grows until Max Pending trips.
- Reading only `parsed` when a chunk can complete several values; the earlier ones are then silently ignored.
- Adding this after Server-Sent Events when each event is already one JSON object — the SSE node's Data output has parsed it.

## Examples

**Long-running task monitor: progress, batched log lines, and a visible connection**

A backend job streams two kinds of frame on one connection. Pattern Extractor pulls the percentage out of human-readable status text, so a progress bar tracks it without a Function node. JSON Stream Parser turns NDJSON log payloads into values — several may complete in one frame, so `values` rather than `parsed` is what feeds downstream. Stream Buffer batches those into a flush every 250 ms, which keeps a busy log from repainting the list hundreds of times a second, and the stream's `onClose` flushes the tail that never reached a full batch.

## Related nodes

[Server-Sent Events](./net-noodl-sse.md), [Text Accumulator](./net-noodl-text-accumulator.md), [Stream Buffer](./net-noodl-stream-buffer.md), [REST](./rest2.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
