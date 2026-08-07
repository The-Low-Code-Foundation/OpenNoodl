---
title: "Send Event"
---
Send Event: broadcasts a named event, with optional payload values, to every Receive Event listening on the same channel.

Event Sender fires an app-wide (or scoped) event when its `sendEvent` signal triggers. The event is identified by `channelName`; every Event Receiver with the same channel fires in response, wherever it lives in the component tree — no wires between them. Payload values are declared on the `payload` parameter (a list of names); each declared name becomes an input port whose current value travels with the event and appears as an output on the receivers. `propagation` narrows delivery (e.g. to parent components only) instead of broadcasting globally.

## When to use it

Cross-cutting notifications where sender and receivers must stay decoupled: 'refresh now', 'user logged out', toast requests. For parent↔child communication prefer Component Inputs/Outputs; for shared state prefer Variables/Objects — events are moments, not state.

## At a glance

| | |
|---|---|
| Category | Events |
| Type name | `Event Sender` |
| Available in | browser |
| SSR compatibility | safe |
| Provided by | `noodl-viewer-react` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `channelName` | String (EventChannelName id) | `` | Name every Receive Event must match to hear this; nothing reports a name no receiver listens on |
| `payload` | Stringlist | — | Names of the values to carry with the event; each becomes an input here and an output on every matching Receive Event |
| `propagation` | Enum (`global`, `parent`, `children`, `siblings`) | `global` | How far the event travels: the whole app, or only the receivers above, below or beside this node |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `sendEvent` | Signal | — | Sends one event on Channel Name, after every payload input has settled |

## Outputs

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires once the event has been dispatched to every matching receiver |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `error` | String | — | Why the last send failed, empty when the last send succeeded |
| `failure` | Signal | — | Fires when the event could not be sent, which today means Channel Name was left empty |

## Dynamic ports

_This node's port list changes at runtime (runtime-discovered); the tables above may be incomplete for a given instance._

Payload input ports are defined by the "ports" parameter (the payload schema of the channel being sent on).

## Ports at runtime

Runtime-discovered inputs: each name listed in `payload` is registered as an input port on demand. The payload port set is defined entirely by that parameter and cannot be known without it.

## Patterns

- Toolbar button → Send Event('RefreshRequested'); data panels each hold a Receive Event that re-runs their query.
- Payload-carrying events for 'open item X' style requests, received where the detail view lives.

## Watch out for

- Using events as a data bus for continuously-changing values — receivers only see values at event time; use a Variable/Object for state.
- Free-typing slightly different channel names at each end; channel matching is exact.

## Examples

**Decoupled communication with Send Event / Receive Event**

Events carry a signal (and optional payload values) between components with no wire between them: every Receive Event listening on the same `channelName` fires when a Send Event on that channel sends. Here a toolbar button broadcasts 'RefreshRequested', and a separate component re-runs its data fetch when it receives the event. Use events when the sender must not know who reacts; for parent↔child data flow prefer Component Inputs/Outputs.

## Related nodes

[Receive Event](./event-receiver.md), [Component Outputs](../component-utilities/component-outputs.md), [Variable](../data/variable2.md), [Object](../data/model2.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
