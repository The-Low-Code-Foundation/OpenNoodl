---
title: "Server-Sent Events"
---
Server-Sent Events: consumes a streaming HTTP endpoint, with connection state, retries and errors as graph outputs.

Opens a `text/event-stream` connection and turns each event into outputs plus an `onMessage` signal. Two transports: Fetch (the default under 'Auto') can send headers, a method and a body, receives every event type, resumes with an explicit `Last-Event-ID`, and can tell a finished stream from a dropped one; EventSource is the browser's own client, which cannot set headers or POST, needs named event types declared up front on `eventTypes`, and reconnects on its own schedule. Failures never disappear: `connectionState` moves through idle/connecting/open/reconnecting/closed/error, `retryCount` counts consecutive failures, `lastError` carries the message and `onError` fires. Retries use exponential backoff from `reconnectDelay` up to `maxReconnectDelay`, honouring a server `retry:` field when one arrives. A 4xx is terminal (retrying cannot help); 5xx, 408 and 429 are retried. Deleting the node or navigating away aborts the request and clears every timer.

## When to use it

Any server-push stream: AI/agent responses streamed token by token, progress on a long-running job, live notifications, dashboard metrics. Use the Fetch transport whenever the endpoint needs an Authorization header or a request body — the usual shape for an AI backend. Use REST2 or HTTP Request for ordinary request/response, and a WebSocket node when the client must also send on the same connection. Client-only: the node stays inert during server-side rendering and connects after hydration.

## At a glance

| | |
|---|---|
| Category | Data |
| Type name | `net.noodl.SSE` |
| Available in | browser, cloud |
| SSR compatibility | client-only — An event stream cannot be consumed during a server render; the node connects in the browser after hydration. |
| Provided by | `noodl-runtime` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `autoConnect` | Boolean | `false` | Opens the stream as soon as a URL is available, without waiting for a Connect signal |
| `autoReconnect` | Boolean | `true` | Retries after a failure with a growing backoff; turning it off reports the failure and stops |
| `body` | * | — | Request body, sent as JSON unless it is already a string; ignored for GET and HEAD |
| `dedupeById` | Boolean | `true` | Drops events whose id has already been seen, so a reconnect that resumes cannot re-deliver messages |
| `eventTypes` | String | — | Comma-separated named event types to subscribe to; only needed for the EventSource transport, as Fetch delivers every type |
| `headers` | Object | — | Request headers as an object, for bearer tokens and the like; ignored by the EventSource transport, which cannot set them |
| `maxReconnectDelay` | Number | `30000` | Ceiling on the backoff in milliseconds, however many failures there have been |
| `maxRetries` | Number | `0` | Consecutive failures allowed before the connection gives up and reports an error; 0 keeps retrying |
| `method` | Enum (`GET`, `POST`, `PUT`, `PATCH`) | `GET` | HTTP method for the request; anything other than GET needs the Fetch transport |
| `reconnectDelay` | Number | `1000` | First retry delay in milliseconds, doubling per consecutive failure up to Max Reconnect Delay |
| `reconnectOnStreamEnd` | Boolean | `false` | Reconnects when the server closes the stream cleanly; off by default because reconnecting an agent stream re-issues the request |
| `textPath` | String | — | Where the text lives inside a JSON payload, as a dot path such as choices.0.delta.content; leave blank for a stream of bare text |
| `transport` | Enum (`auto`, `fetch`, `eventsource`) | `auto` | How the stream is fetched: Fetch carries headers and a body, EventSource lets the browser handle reconnection, Auto prefers Fetch |
| `url` | String | — | Endpoint to stream from; changing it while connected reconnects to the new one |
| `withCredentials` | Boolean | `false` | Sends cookies and HTTP auth to a cross-origin endpoint, which the server must also allow |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `connect` | Signal | — | Opens the stream, replacing any connection already open and resetting the retry count |
| `disconnect` | Signal | — | Closes the stream and stops retrying |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `connected` | Boolean | — | True only while the stream is open and frames may arrive |
| `connectionState` | String | — | Where the connection is: idle, connecting, open, reconnecting, closed or error |
| `data` | * | — | The event payload, parsed as JSON when it is JSON and handed over as text when it is not |
| `deliverySemantics` | String | — | What this stream actually guarantees, derived from whether the server sends ids: at-most-once, at-least-once or at-least-once-deduped |
| `duplicatesSuppressed` | Number | — | How many replayed events Dedupe By Id has dropped on this connection |
| `eventType` | String | — | The event name the server sent, or message when it sent none |
| `lastEventId` | String | — | The furthest id the server has reported, which is the point a reconnect resumes from |
| `lastMessageTime` | Number | — | When the last event arrived, as milliseconds since the epoch; useful for spotting a stalled stream |
| `messageCount` | Number | — | How many events have been delivered on this connection, not counting suppressed duplicates |
| `raw` | String | — | The event payload exactly as it arrived, before any parsing |
| `retryCount` | Number | — | Consecutive failed attempts in the current outage; back to zero once the stream opens |
| `text` | String | — | The one data output guaranteed to be a string: Raw when no Text Path is set, the field at that path when one is, blank when it does not resolve |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires when the action finished: a Connect whose stream opened, or a Disconnect that stopped one |
| `onClose` | Signal | — | Fires when the stream has stopped for good, whether it ended cleanly or gave up |
| `onMessage` | Signal | — | Fires once per event, after Data, Raw and Text already hold it |
| `onOpen` | Signal | — | Fires when the stream has been established |
| `unchanged` | Signal | — | Fires when there was nothing to do: a Disconnect with no stream running, or a Connect a later Connect or Disconnect superseded before it opened |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `failure` | Signal | — | Fires when the stream could not be opened, or gave up retrying. Last Error carries the reason |
| `lastError` | String | — | What went wrong most recently, including the reason a retry was scheduled |
| `onError` | Signal | — | Fires when the stream failed or dropped, whether or not a retry is going to follow |

## Patterns

- SSE `text` → Text Accumulator `chunk` and SSE `onMessage` → Text Accumulator `add`, with an empty delimiter, renders an AI response as it is written. Set `textPath` to `choices.0.delta.content` for an OpenAI-compatible endpoint and leave it blank for a stream of bare tokens; either way `text` is a string.
- `data` is for the payloads that are meant to be objects: a JSON Stream Parser, or an Action Dispatcher's `action` input.
- SSE `connectionState` → String Mapper → a status label makes reconnection visible instead of leaving the UI apparently frozen.
- POST the prompt in `body` with an Authorization header rather than putting a token in the query string, which the EventSource-only approach forces.

## Watch out for

- Turning on Reconnect On Stream End for a finite agent response — the request is re-issued and the answer regenerates in a loop.
- Ignoring `connectionState` and wiring only the data outputs: a silently failing reconnection then looks identical to a slow server.
- Wiring `data` into anything that expects text. `data` is JSON-parsed, so for the commonest agent shape (`data: {"delta":"Hi"}`) it is an object; a Text Accumulator refuses it and reports the mis-wiring rather than appending `[object Object]`. Use `text`.
- Leaving `textPath` blank on a JSON-envelope stream and wiring `raw` instead — the answer then reads as a run of JSON fragments.
- Using the EventSource transport when the endpoint needs an Authorization header, then smuggling the token through the URL.

## Examples

**Agent chat: stream an AI answer token by token**

The core agentic-UI wiring. Server-Sent Events POSTs the prompt with an Authorization header — which needs the Fetch transport, since EventSource can neither POST nor set headers — and each streamed token lands on `text`. `text` and not `data`: `data` is JSON-parsed, so for an OpenAI-compatible endpoint it is an object, and `textPath` here (`choices.0.delta.content`) is what turns that envelope into the token. For an endpoint that streams bare text, leave `textPath` blank and `text` is the payload as sent. Text Accumulator collects the tokens with an empty delimiter, so `accumulated` is the answer as it is being written, and `changed` repaints the Text node. `connectionState` drives a status label, so a reconnection is visible rather than looking like a stalled answer, and `onOpen` clears the accumulator when a new response starts.

**Long-running task monitor: progress, batched log lines, and a visible connection**

A backend job streams two kinds of frame on one connection. Pattern Extractor pulls the percentage out of human-readable status text, so a progress bar tracks it without a Function node. JSON Stream Parser turns NDJSON log payloads into values — several may complete in one frame, so `values` rather than `parsed` is what feeds downstream. Stream Buffer batches those into a flush every 250 ms, which keeps a busy log from repainting the list hundreds of times a second, and the stream's `onClose` flushes the tail that never reached a full batch.

## Related nodes

[Text Accumulator](./net-noodl-text-accumulator.md), [JSON Stream Parser](./net-noodl-jsonstream-parser.md), [Stream Buffer](./net-noodl-stream-buffer.md), [HTTP Request](./net-noodl-http.md), [REST](./rest2.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
