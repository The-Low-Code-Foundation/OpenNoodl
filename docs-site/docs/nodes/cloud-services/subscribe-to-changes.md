---
title: "Subscribe To Changes"
---
Fires signals when another client creates, updates or deletes a record in a backend class.

Subscribe To Changes holds a live connection to the selected backend and reports what changes in one class. It does not query and it holds no list: when the server pushes a change it publishes the row on `changedRecord`, its key on `changedRecordId` and the kind on `changedEvent`, then fires `created`, `updated` or `deleted` and always `changed`. The transport is chosen from the backend's type and hidden — Server-Sent Events on the built-in NodeGX backend and on PocketBase, a WebSocket on Directus, Parse LiveQuery where one is running — so the ports mean the same thing whichever backend the project uses. It is on as soon as you pick a class: `enabled` defaults to true and the Backend picker defaults to the project's active backend (and is hidden entirely when there is only one). When a backend cannot push at all, the node does not go quiet — `realtimeError` carries a sentence saying why and `realtimeFailure` fires.

## When to use it

When something in the app should react to a change another user made, without owning a query — 'any change to orders, refresh the badge', 'a new message arrived, play a sound'. If you already have a Query Records node and want its `items` to stay current, turn on that node's own Subscribe To Changes checkbox instead of adding this one: it re-runs the query, which this node deliberately does not. For a socket you control yourself — a third-party feed, device telemetry, an LLM stream from someone else's API — use the WebSocket or SSE node; those are raw transports with no backend awareness. This node is client-only: it is inert during server-side rendering and subscribes in the browser after hydration, and it is not available in cloud functions at all (a function is one request and is torn down when it answers).

## At a glance

| | |
|---|---|
| Category | Cloud Services |
| Type name | `SubscribeToChanges` |
| Available in | browser |
| SSR compatibility | client-only — A realtime subscription cannot be opened during a server render and would hold one connection per request; the node subscribes in the browser after hydration. |
| Provided by | `noodl-runtime` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `enabled` | Boolean | `true` | Hold the subscription open. Turn it off to stop receiving changes without deleting the node — the connection is closed and Subscribed goes false. On by default: this node has nothing else to do |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `changedEvent` | String | — | create, update, delete, init or resync |
| `changedRecord` | Object | — | The record the change was about. ⚠️ Null on a delete against Directus, which sends only the key — use Changed Record Id, which every backend fills |
| `changedRecordId` | String | — | The id of the changed record, always a string — even where the backend's primary key is an integer |
| `changedRecords` | Array | — | Every record in the change frame; some backends batch |
| `realtimeStatus` | String | — | connecting, subscribed, interrupted or stopped. Four states rather than a boolean, because "connecting for the first time" and "dropped and retrying" want different things on screen |
| `subscribed` | Boolean | — | True while the backend has confirmed the subscription and is delivering changes |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `changed` | Signal | — | Any of the three, and also the backend saying the view may be stale after a reconnect — the one to react to if you do not care which happened |
| `created` | Signal | — | Another client created a record in this collection |
| `deleted` | Signal | — | Another client deleted a record from this collection |
| `updated` | Signal | — | Another client updated a record in this collection |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `realtimeError` | Object | — | The last realtime failure, with a code and whether retrying can help; null until one happens |
| `realtimeFailure` | Signal | — | Fires when a subscription cannot connect, is rejected, or has been given up on |

## Dynamic ports

_This node's port list changes at runtime (runtime-discovered); the tables above may be incomplete for a given instance._

Every input but "enabled" is discovered at runtime. "backendId" is a dropdown of the project's backends, defaulting to "_active_" and omitted entirely when the project has only one; "collectionName" is a dropdown of the selected backend's introspected classes; "visualFilter" is a query-filter editor built from that class's schema, and each filter value bound to a port mints one "qp-<name>" input. An authoring tool should set "collectionName" (and "backendId" only when the project has more than one backend); the outputs are all static.

## Ports at runtime

Only `enabled` is a static input. `backendId`, `collectionName`, `visualFilter` and one `qp-<name>` port per filter value bound to a port are all generated from the project's backend metadata and the selected class's schema, and are pushed to the editor per instance. An authoring tool should set `collectionName`, and `backendId` only when the project has more than one backend. Every output is static and always present — the Realtime ports are never gated on whether the selected backend can push, because a capability that disappears from the panel when the picker moves is worse than one that says why it cannot connect.

## Patterns

- `changed` → a Query Records node's `Do`: the same live-list effect as that node's own checkbox, but with the subscription visible on the canvas as a thing that exists.
- `created` → a notification or a sound, without re-fetching anything — this node publishes the new row on `changedRecord` already.
- `changedRecordId` → a Delete Record or a Set Variable: the one output that is filled on every backend and every event type.
- `subscribed` → an indicator's visibility, and `realtimeError` → an error Text: an outage becomes something a user can see rather than a screen that has quietly stopped updating.

## Watch out for

- Adding this beside a Query Records node whose `items` you want kept current. Turn on that node's Subscribe To Changes instead — it re-runs the query, which this node does not.
- Reading `changedRecord` on a delete. Directus sends the key only, so it is null there; use `changedRecordId`.
- Expecting the Filter to narrow anything on PocketBase, Directus or Parse. It reaches a server on the built-in NodeGX backend only, and is deliberately not applied on the client.
- Polling with a Timer on a backend that can push. Subscribe and react to `changed`.
- Assuming silence means 'no changes'. Read `realtimeStatus` and `realtimeError` — Supabase has no transport at all and says so.

## Examples

**Reacting to what another user changed, without owning the query**

**Subscribe To Changes** watches one class on the selected backend and fires signals when anything in it changes — no query, no list, no configuration beyond the class. Here it does the two things it is for at once: `changed` re-runs a Query Records node so the list on screen stays current, and `created` drives a 'new order' notice off `changedRecord`, which the subscription already carries so nothing has to be fetched to show it. `subscribed` drives a live indicator, so a dropped connection is visible rather than a screen that has quietly stopped updating. Against the built-in backend this needs no Backend setting at all: the picker defaults to the project's active backend and is not even shown when there is only one.

## Related nodes

[Query Records](./db-collection2.md), [WebSocket](../data/net-noodl-web-socket.md), [Server-Sent Events](../data/net-noodl-sse.md), [Record](./db-model2.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
