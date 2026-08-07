---
title: "Receive Event"
---
Receive Event: fires when a Send Event broadcasts on the same channel, delivering the event's payload values as outputs.

Event Receiver listens on `channelName` and fires its `eventReceived` signal each time an Event Sender sends on that channel, from anywhere in the app. Payload values declared by the sender appear as value outputs holding the payload of the most recent event. `enabled` mutes the receiver; `consume` controls whether this receiver swallows the event or lets other receivers on the channel also fire.

## When to use it

The reacting end of decoupled notifications: refresh triggers, toasts, logout cleanup. For parent↔child flow use Component Inputs/Outputs; for continuously-shared state use Variables/Objects.

## At a glance

| | |
|---|---|
| Category | Events |
| Type name | `Event Receiver` |
| Available in | browser |
| SSR compatibility | safe |
| Provided by | `noodl-viewer-react` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `channelName` | String (EventChannelName id) | — | Name to listen on, which must match a Send Event exactly; nothing reports a name no sender uses |
| `consume` | Enum (`never`, `always`) | `never` | Whether receiving an event stops it reaching other receivers on the same channel |
| `enabled` | Boolean | `true` | Whether events on this channel are acted on; while off they are ignored and not passed to another receiver either |

## Outputs

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `eventReceived` | Signal | — | Fires when an event arrives on Channel, once the payload outputs carry that event's values |

## Dynamic ports

_This node's port list changes at runtime (runtime-discovered); the tables above may be incomplete for a given instance._

Payload output ports mirror the payload schema of the channel selected via the "channelName" parameter (as defined by matching Event Sender nodes).

## Ports at runtime

Payload value outputs are runtime-registered from the channel's payload declaration on the sending side; only `eventReceived` is static. A tool authoring a receiver should mirror the sender's payload names.

## Patterns

- `eventReceived` → a query's fetch input: app-wide refresh without wiring panels together.

## Watch out for

- Reading payload outputs outside the moment of the event as if they were state — they hold only the last event's values; use a Variable/Object for state.

## Examples

**Decoupled communication with Send Event / Receive Event**

Events carry a signal (and optional payload values) between components with no wire between them: every Receive Event listening on the same `channelName` fires when a Send Event on that channel sends. Here a toolbar button broadcasts 'RefreshRequested', and a separate component re-runs its data fetch when it receives the event. Use events when the sender must not know who reacts; for parent↔child data flow prefer Component Inputs/Outputs.

## Related nodes

[Send Event](./event-sender.md), [Component Outputs](../component-utilities/component-outputs.md), [Variable](../data/variable2.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
