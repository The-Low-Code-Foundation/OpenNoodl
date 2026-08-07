---
title: "WebSocket"
---
Two-way WebSocket connection: send and receive text, JSON or binary, with connection state as graph outputs.

A bidirectional transport for agent chat, collaboration, telemetry and any other stream where the client also talks back. `url` plus `autoConnect` opens the socket; `Connect`/`Disconnect` do it by hand. `Send` transmits whatever is on `message` — a string goes as text, an object is JSON-serialized, an ArrayBuffer or typed array goes as a binary frame, and `messageType: binary` UTF-8 encodes text first. Received text is JSON-parsed onto `received` with the original on `receivedRaw`; binary arrives on `received` as an ArrayBuffer with `receivedIsBinary` true. Everything about the connection's health is an output rather than a console message: `connectionState` moves through idle → connecting → open → reconnecting → closed/error, `retryCount` counts attempts within the current outage, `lastError` says what went wrong, `closeCode`/`closeReason` carry the server's own explanation, and `queueSize`/`droppedCount` account for every message that has not reached the wire. Reconnection is exponential backoff from `reconnectDelay`, doubling to `maxReconnectDelay`, with jitter, stopping after `maxRetries` — or immediately for close codes where retrying is futile (1002, 1003, 1007–1010, 1015). Giving up sets `connectionState` to error and fires `onError`; it is never silent.

## When to use it

When the client needs to send as well as receive — chat with an agent, collaborative editing, live cursors, device control, order placement. If the server only pushes and the client never sends, Server-Sent Events is simpler and more firewall-friendly. This node is transport only: point it at your own endpoint, and use ordinary Object/Array/Function nodes to shape what flows through it. It is client-only, so it stays inert during server-side rendering and connects in the browser after hydration. ⚠️ **It is not the node for your project's own backend data.** NodeGX's built-in backend has no WebSocket server at all — realtime there is Server-Sent Events — and PocketBase, Parse and Supabase each speak something different again, so there is no URL to point this node at. Use **Subscribe To Changes**, which picks the transport from the backend's type and hides it.

## At a glance

| | |
|---|---|
| Category | Data |
| Type name | `net.noodl.WebSocket` |
| Available in | browser, cloud |
| SSR compatibility | client-only — A WebSocket cannot be meaningfully opened during a server render and would leak a socket per request; the node connects in the browser after hydration. |
| Provided by | `noodl-runtime` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `autoConnect` | Boolean | `true` | Connect as soon as a URL is available, without waiting for a Connect signal |
| `autoReconnect` | Boolean | `true` | Retries after an unsolicited close with a growing backoff; turning it off reports the close as an error |
| `heartbeatInterval` | Number | `0` | Milliseconds between heartbeats while the socket is open; 0 disables it, and only enable it if your server expects the message |
| `heartbeatMessage` | String | `ping` | Application text sent as the heartbeat; it is not a protocol ping frame |
| `heartbeatReply` | String | `pong` | Exact text the server answers a heartbeat with; it is measured as Latency, hidden from On Message, and its absence is treated as a dead connection |
| `jitter` | Boolean | `true` | Spreads reconnect attempts randomly across the second half of each backoff window, so a fleet does not return in lockstep |
| `maxQueueSize` | Number | `100` | Messages the queue holds before further Sends are refused and counted as dropped; 0 or less is unlimited and can grow during a long outage |
| `maxReconnectDelay` | Number | `30000` | Ceiling on the backoff in milliseconds, however many attempts there have been |
| `maxRetries` | Number | `10` | Reconnect attempts allowed per outage; 0 disables retrying and a negative value means unlimited |
| `message` | * | — | Value to send; objects are JSON-serialised, and ArrayBuffers and typed arrays go as binary frames |
| `messageType` | Enum (`auto`, `text`, `binary`) | `auto` | Auto sends binary values as binary and everything else as text; Binary encodes text and objects as UTF-8 first |
| `protocols` | String | — | Comma-separated WebSocket subprotocols to offer during the handshake |
| `reconnectDelay` | Number | `1000` | First backoff delay in milliseconds; each further attempt doubles it up to Max Reconnect Delay |
| `url` | String | — | Endpoint to connect to, which must start with ws:// or wss://; changing it reconnects to the new one |
| `whenDisconnected` | Enum (`queue`, `drop`, `error`) | `queue` | What a Send does while the socket is not open: hold it in order, discard and count it, or also report an error |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `connect` | Signal | — | Opens the socket, replacing one already open without reporting a close |
| `disconnect` | Signal | — | Closes the socket and cancels any pending reconnect |
| `send` | Signal | — | Hands the current Message to the socket, or applies the When Disconnected policy |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `closeCode` | Number | — | WebSocket close code from the last close, or 1006 when the socket died without one |
| `closeReason` | String | — | Reason the server gave for closing, which is often blank |
| `connected` | Boolean | — | True only while the socket is open and messages can be sent without queueing |
| `connectionState` | String | — | Where the connection is: idle, connecting, open, reconnecting, closed or error |
| `droppedCount` | Number | — | Messages that will never be sent, whether discarded by policy, by a full queue, or by the node being removed |
| `latency` | Number | — | Round trip of the last heartbeat in milliseconds; 0 until one has been measured |
| `queueSize` | Number | — | Messages held because the socket was not open when Send ran |
| `received` | * | — | The last message, parsed as JSON when it is JSON and handed over as text when it is not |
| `receivedIsBinary` | Boolean | — | True when the last message was a binary frame, in which case Received holds the buffer |
| `receivedRaw` | String | — | The last text message exactly as it arrived; blank for a binary frame |
| `retryCount` | Number | — | Attempts made during the current outage; back to zero once the socket opens |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires when the action finished: a Connect whose socket opened, a Send accepted for delivery (sent, or queued for the next open), or a Disconnect that closed something |
| `onClose` | Signal | — | Fires whenever the socket goes down, whether or not a reconnect is going to follow |
| `onMessage` | Signal | — | Fires once per message, after Received already holds it; heartbeat replies are not messages |
| `onMessageSent` | Signal | — | Fires when a message has been handed to the socket, including a queued one flushed on reopen; not for heartbeats |
| `onOpen` | Signal | — | Fires every time the socket opens, including after a reconnect |
| `onReconnect` | Signal | — | Fires on every open after the first; a WebSocket cannot resume, so this is the cue to re-fetch rather than assume continuity |
| `unchanged` | Signal | — | Fires when there was nothing to do: a Disconnect with nothing open, a Send discarded by the Drop policy, or a Connect a later Connect or Disconnect superseded before it opened |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `failure` | Signal | — | Fires when the action could not be performed — no URL, a URL that is not ws:// or wss://, a connection that gave up, or a refused Send. Last Error carries the reason |
| `lastError` | String | — | What went wrong most recently, including why a reconnect was scheduled or abandoned |
| `onError` | Signal | — | Fires when something went wrong: a failed connect, a refused send, a dead heartbeat, or a give-up |

## Patterns

- `connectionState` → a status Text, and `lastError` → an error Text: an outage becomes something the user can see rather than a UI that has quietly stopped answering.
- Leave `whenDisconnected` on Queue so a message typed during a reconnect is held in order and sent on reopen instead of lost.
- `onOpen` → send an auth or subscribe frame: the queue is flushed after On Open, so the handshake always precedes the backlog.
- `onReconnect` → re-fetch history or re-subscribe, since the new session replays nothing.
- `droppedCount` → a Condition → a 'messages were lost' notice, for apps where silent loss is not acceptable.

## Watch out for

- Assuming a message handed to Send arrived. `socket.send` only buffers, and a connection that dies before the frame leaves loses it with no way to say which — add application-level acknowledgements if that matters.
- Turning on the heartbeat against a server that does not expect it: the message is ordinary application data and most servers will either ignore it or close the connection.
- Using this where the client only listens — Server-Sent Events reconnects natively and passes through more firewalls.
- Setting Max Queue Size to 0 on a long-lived page: an outage then grows the queue without bound.
- Putting a long-lived secret in the URL. Browsers cannot set WebSocket headers, but a query-string token ends up in server logs; prefer a short-lived ticket, or authenticate with a first message from On Open.

## Examples

**Agent chat over a WebSocket, with the connection visible**

A minimal two-way agent surface: the WebSocket node connects on load, the prompt field feeds `message`, the Send button fires `send`, and each reply arrives on `receivedRaw`. The two status texts are the point of the example rather than decoration — `connectionState` reads idle/connecting/open/reconnecting/closed/error, and `lastError` says why whenever it lands on the last of those, so an outage is something the user can see instead of a screen that has quietly stopped answering. `whenDisconnected` is left on Queue, so a message typed during a reconnect is held in order and sent once the socket is back rather than lost.

## Related nodes

[Subscribe To Changes](../cloud-services/subscribe-to-changes.md), [REST](./rest2.md), [HTTP Request](./net-noodl-http.md), [Query Records](../cloud-services/db-collection2.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
