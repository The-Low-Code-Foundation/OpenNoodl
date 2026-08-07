---
title: "Text Accumulator"
---
Text Accumulator: collects stream fragments into growing text, and splits complete messages off a delimiter.

Each `add` appends the current `chunk` to a buffer. With an empty delimiter nothing is ever split and `accumulated` is simply the text so far — the mode a token stream wants. With a delimiter (newline by default) every complete piece moves to `messages` and only the unfinished tail stays in `accumulated`, so a message split across chunk boundaries reassembles correctly. Both stores are bounded: `maxLength` caps the pending buffer and `maxMessages` caps the retained list, dropping the oldest first and reporting the loss on `droppedCharacters` / `droppedMessages` plus an `overflowed` signal rather than growing without limit in a long-lived session. An empty chunk appends nothing, so a stream's keep-alive frames do not fire `changed` — the Add reports `unchanged` rather than nothing at all.

## When to use it

Assembling anything that arrives in pieces: AI tokens into a displayable answer, log lines out of a chunked feed, NDJSON lines before parsing them. Pair it with Server-Sent Events or any node that emits fragments. Not needed when each event is already a whole value — wire that straight to its consumer.

## At a glance

| | |
|---|---|
| Category | Data |
| Type name | `net.noodl.TextAccumulator` |
| Available in | browser, cloud |
| SSR compatibility | safe |
| Provided by | `noodl-runtime` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `chunk` | String | — | The next fragment of text to append; wire a stream Text output, not its Data output, which is JSON-parsed and is usually an object |
| `delimiter` | String | `
` | Message boundary to split complete messages off; leave empty to accumulate everything, which is what a token stream wants |
| `maxLength` | Number | `1048576` | Cap on the pending buffer in characters; overflow drops the oldest and is counted on Dropped Characters |
| `maxMessages` | Number | `1000` | Cap on retained complete messages, oldest dropped first; 0 keeps them all, which grows forever |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `add` | Signal | — | Appends the current Chunk, which is retained between pulses, so a second Add with no new chunk appends it again |
| `clear` | Signal | — | Empties the buffer, the messages and both dropped counts |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `accumulated` | String | — | Everything appended since the last Clear that has not yet been split off as a complete message |
| `byteCount` | Number | — | Length of Accumulated in UTF-8 bytes, which differs from Character Count for anything outside ASCII |
| `characterCount` | Number | — | Length of Accumulated in characters |
| `droppedCharacters` | Number | — | How many characters Max Length has discarded from the front since the last Clear |
| `droppedMessages` | Number | — | How many complete messages Max Messages has discarded since the last Clear |
| `lastMessage` | String | — | The most recent complete message, which is what a chat surface usually wants |
| `messageCount` | Number | — | How many complete messages are being retained, which is not how many have arrived |
| `messages` | Array | — | Complete messages split off the delimiter, oldest first, capped at Max Messages |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `changed` | Signal | — | Fires whenever an Add appended something, which is the cue to redraw |
| `cleared` | Signal | — | Fires once the buffer and the messages have been emptied |
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires once an Add or Clear you triggered has changed the buffer |
| `messageReceived` | Signal | — | Fires once per Add that completed at least one message, not once per message |
| `overflowed` | Signal | — | Fires when Max Length or Max Messages has just discarded something |
| `unchanged` | Signal | — | Fires when an Add had no text to append — an empty chunk, or one already refused — or a Clear found nothing to discard |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `error` | String | — | Why the last chunk was refused; blank once a chunk of text arrives |
| `failure` | Signal | — | Fires when a chunk was not text and nothing was appended, which usually means the wrong stream output is wired |

## Patterns

- Server-Sent Events `text` → `chunk`, `onMessage` → `add`, delimiter empty, `accumulated` → Text `text`: an answer that types itself out.
- Delimiter `\n` with `messages` → For Each renders a growing log without re-parsing the whole buffer each time.
- The stream's `onOpen` → `clear` resets the accumulator when a new response starts.

## Watch out for

- Wiring a stream's `data` output into `chunk`. `data` is JSON-parsed and is an object for an OpenAI-style payload; wire `text` (with the stream's `textPath` set) or a Function node that picks out the string field.
- Leaving `maxMessages` at 0 in a session that runs for hours — the array grows until the tab does.
- Wiring `add` from a signal that fires before `chunk` is set (a Function's own output, say) — the last chunk gets appended twice and the newest not at all.

## Examples

**Agent chat: stream an AI answer token by token**

The core agentic-UI wiring. Server-Sent Events POSTs the prompt with an Authorization header — which needs the Fetch transport, since EventSource can neither POST nor set headers — and each streamed token lands on `text`. `text` and not `data`: `data` is JSON-parsed, so for an OpenAI-compatible endpoint it is an object, and `textPath` here (`choices.0.delta.content`) is what turns that envelope into the token. For an endpoint that streams bare text, leave `textPath` blank and `text` is the payload as sent. Text Accumulator collects the tokens with an empty delimiter, so `accumulated` is the answer as it is being written, and `changed` repaints the Text node. `connectionState` drives a status label, so a reconnection is visible rather than looking like a stalled answer, and `onOpen` clears the accumulator when a new response starts.

## Related nodes

[Server-Sent Events](./net-noodl-sse.md), [JSON Stream Parser](./net-noodl-jsonstream-parser.md), [Stream Buffer](./net-noodl-stream-buffer.md), [String Format](../string-manipulation/string-format.md), [Substring](../string-manipulation/substring.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
