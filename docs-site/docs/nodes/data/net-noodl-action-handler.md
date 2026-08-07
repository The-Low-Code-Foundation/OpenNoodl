---
title: "Action Handler"
---
Action Handler: declares one action type a backend is allowed to trigger, and what happens when it does.

Registers a single action type with the Action Dispatcher's registry, and fires `trigger` with the action's `payload` whenever a matching action is dispatched. That registration is what makes the action executable at all — there is no separate permission list to keep in step, so an action a graph does not handle simply cannot happen. Registration follows the inputs automatically: no Register signal to remember, and an action that arrives just before the component mounts waits for it rather than being refused. By default the action is reported complete as soon as `trigger` has been sent and everything wired to it has run; turn `autoComplete` off and wire `complete` or `fail` yourself when a later step must wait for this one, or when the step can genuinely fail. Built-in action names (`SET_STORE`, `MERGE_STORE`, `DELETE_STORE_KEY`, `CLEAR_STORE`) are reserved and cannot be claimed here — attempting it reports on `error` and registers nothing.

## When to use it

For every action a backend should be able to trigger, one node each. This is also the only way to grant capabilities the dispatcher has no built-in for — navigation, opening a panel, scrolling, showing a toast, refreshing a query — by wiring `trigger` to the nodes that already do those jobs. Be deliberate: whatever is downstream of `trigger` is something a remote server can cause.

## At a glance

| | |
|---|---|
| Category | Data |
| Type name | `net.noodl.ActionHandler` |
| Available in | browser |
| SSR compatibility | safe |
| Provided by | `noodl-runtime` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `actionType` | String | — | The exact action type this handler accepts; registering it is what makes it executable at all |
| `autoComplete` | Boolean | `true` | Reports the action complete as soon as Trigger has been sent; turn it off when a later step must finish first |
| `channel` | String | `default` | Must match the Channel on the Action Dispatcher that should be able to reach this handler |
| `enabled` | Boolean | `true` | Turning this off unregisters the handler, so the action is refused as unknown rather than quietly ignored |
| `result` | * | — | Handed back to the dispatcher as the Result of this action when it completes |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `complete` | Signal | — | Reports the action finished, so the dispatcher runs whatever is queued behind it; ignored unless Auto Complete is off |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `errorMessage` | String | — | Reason handed back to the dispatcher when Fail is signalled; a generic one is used when this is blank |
| `fail` | Signal | — | Reports the action failed, so the dispatcher fires Failed with Error Message as the reason |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `actionId` | String | — | Id of the action currently being handled, so a later Complete can be matched to it |
| `payload` | * | — | The data the action carried, taken from its payload or data field, or the whole action when it has neither |
| `registered` | Boolean | — | True while this handler is in the allow-list, which needs both an Action Type and Enabled |
| `triggeredCount` | Number | — | How many actions this handler has been asked to run since the page loaded |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires when Complete or Fail acted on the action in flight — including a Fail, which succeeds by reporting the failure |
| `trigger` | Signal | — | Fires when a dispatcher has an action of this type to run; whatever is wired downstream is the capability this grants |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `error` | String | — | Why the handler could not register, or why the last Complete or Fail had nothing to act on |
| `failure` | Signal | — | Fires when Complete or Fail was signalled with no action in flight |

## Patterns

- `trigger` → Navigate, `payload` → Set Variable: the server can open a screen. A real capability, granted visibly by this one wire.
- `autoComplete` off, `trigger` → a cloud function call, its Success → `complete` and Failure → `fail`: the dispatcher then holds the rest of the flow until the call returns, and reports the failure if it does not.
- `enabled` driven from a signed-in flag, so an action becomes reachable only once the user is authenticated.
- Two handlers with the same `actionType` both run, in registration order — useful for a shared side effect such as logging every occurrence of one action.

## Watch out for

- One handler with a generic type such as `RUN`, switching on a field of the payload. That rebuilds the open vocabulary the dispatcher closed; the refusal path then never fires for anything.
- Leaving `autoComplete` on for a step a later step depends on — the flow moves to the next action while this one is still working.
- Turning `autoComplete` off and forgetting to wire `complete`: the action sits until the dispatcher's `handlerTimeout` and fails.
- Wiring `trigger` to something destructive without any confirmation in between.

## Examples

**Agent actions: let a backend drive the UI, but only where you allowed it**

The idiomatic shape for a backend that sends commands rather than data. Server-Sent Events delivers action objects; Action Dispatcher decides whether each one may run. The vocabulary is closed: `OPEN_SESSION` runs because the Action Handler registered it, `SET_STORE` runs because it is named in `builtIns` and its key is in `allowedKeys`, and anything else is refused with a reason on `refusalReason` — which is wired to a Text node, because a refusal nobody can see is the failure mode this whole design exists to avoid. The handler has `autoComplete` off and completes only once its Set Global Store finished, so an array of actions runs as an ordered flow rather than all at once.

## Related nodes

[Action Dispatcher](./net-noodl-action-dispatcher.md), [Set Global Store](./net-noodl-global-store-set.md), [Server-Sent Events](./net-noodl-sse.md), [WebSocket](./net-noodl-web-socket.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
