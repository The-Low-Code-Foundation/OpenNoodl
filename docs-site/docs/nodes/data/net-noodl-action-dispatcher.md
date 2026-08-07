---
title: "Action Dispatcher"
---
Action Dispatcher: executes actions a backend sent, restricted to a vocabulary this graph explicitly registered.

Turns messages like `{ "type": "OPEN_SESSION", "sessionId": "123" }` into things that actually happen in the app, so a server-side agent can drive the UI instead of only sending data to display. The vocabulary is **closed**: an action runs only if an Action Handler node registered its type, or it is one of the four built-in store actions (`SET_STORE`, `MERGE_STORE`, `DELETE_STORE_KEY`, `CLEAR_STORE`) and the author listed that name in `builtIns`, which is empty by default. Everything else is refused with a reason on `refusalReason` and a `refused` signal — never silently ignored, and never executed. Actions run strictly one at a time in arrival order, so an array of actions is a multi-step flow; the queue is bounded and overflow refuses the newest rather than reordering what was accepted. An action whose handler has not mounted yet waits up to `waitForHandler` milliseconds rather than losing a mount race, and `waitingFor` names it while it waits.

## When to use it

Whenever a backend needs to cause something rather than just report something: an AI agent that says "let me open that for you", a guided tour driven from the server, a workflow whose steps arrive over a stream. Wire a Server-Sent Events or WebSocket node's `data` to `action` and its `onMessage` to `dispatch`. Do not use it as a general message router for data you are simply going to display — wire that straight to its consumer.

## At a glance

| | |
|---|---|
| Category | Data |
| Type name | `net.noodl.ActionDispatcher` |
| Available in | browser |
| SSR compatibility | safe |
| Provided by | `noodl-runtime` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `action` | * | — | An action object, an array of them to run in order, or JSON text holding either |
| `allowedKeys` | String | — | Comma-separated keys the built-in store actions may write; blank means any key, and setting any key also refuses CLEAR_STORE |
| `builtIns` | String | — | Comma-separated built-in action names this dispatcher may execute; empty, the default, means a server cannot write to the store at all |
| `channel` | String | `default` | Names the handler registry this dispatcher draws on; leave it as default unless two independent flows must not see each other |
| `handlerTimeout` | Number | `30000` | Milliseconds a handler has to signal Complete or Fail before the action is failed; 0 waits forever |
| `maxQueueSize` | Number | `100` | Bound on queued actions; overflow refuses the newest so accepted actions keep their order; 0 is unbounded |
| `rateLimit` | Number | `0` | Actions executed per window before the rest are refused rather than delayed; 0 is unlimited |
| `rateLimitWindow` | Number | `60000` | Length of the rate-limit window in milliseconds; ignored unless Rate Limit is set |
| `storeName` | String | `app` | The only store the built-in actions can write; a store named inside an incoming action is ignored |
| `waitForHandler` | Number | `2000` | Milliseconds an action waits for its handler to appear before being refused as unknown; everything behind it waits too |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `cancel` | Signal | — | Discards everything queued and abandons anything in flight, reporting how many were dropped |
| `dispatch` | Signal | — | Admits whatever is on Action and runs it, or refuses it with a reason |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `actionId` | String | — | Id of the action currently being executed, taken from the message when it carried one |
| `actionType` | String | — | Type of the action currently being executed |
| `cancelledCount` | Number | — | How many actions Cancel All has discarded since the page loaded |
| `completedCount` | Number | — | How many actions have completed since the page loaded |
| `failedCount` | Number | — | How many accepted actions have failed since the page loaded |
| `isExecuting` | Boolean | — | True while an action is running, which is the cue for a busy indicator |
| `payload` | * | — | The data the current action carried, taken from its payload or data field, or the whole action when it has neither |
| `queueSize` | Number | — | How many actions are waiting behind the one being executed |
| `refusalMessage` | String | — | The refusal in a sentence an app author can show or log |
| `refusalReason` | String | — | Why it was refused, as one of invalid, unknown, not-allowed, rate-limited or queue-full |
| `refusedCount` | Number | — | How many actions have been refused since the page loaded |
| `refusedType` | String | — | Type of the refused action, or blank when the message was too malformed to have one |
| `result` | * | — | What the handler or built-in returned for the action that just completed |
| `waitingFor` | String | — | Action type holding the head of the queue because its handler has not registered yet; blank when nothing is waiting |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `actionCompleted` | Signal | — | Fires once *one action* has finished and Result holds its answer — one Dispatch of an array fires this once per member, which is why it is not the node’s Completed |
| `cancelled` | Signal | — | Fires once Cancel All has emptied the queue |
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `dispatched` | Signal | — | Fires when an action has been accepted and is about to run |
| `done` | Signal | — | Fires when the invocation did something: Dispatch admitted at least one action, or Cancel All dropped at least one |
| `failed` | Signal | — | Fires when an accepted action ran and did not succeed, whether the handler said so or the deadline passed |
| `idle` | Signal | — | Fires when the queue has drained after doing at least one thing |
| `refused` | Signal | — | Fires when an action was not run at all, which is the output to watch for anything a server can talk to |
| `unchanged` | Signal | — | Fires when there was nothing to do — a Cancel All with an empty queue. Not a failure: the queue is empty, which is what was asked for |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `failure` | Signal | — | Fires when a Dispatch admitted nothing at all, because every action in it was refused |
| `lastError` | String | — | The most recent failure or refusal, whichever happened last |

## Patterns

- Server-Sent Events `data` → `action`, `onMessage` → `dispatch`: an agent stream that drives the UI.
- One Action Handler per thing the server may do, each wired to the nodes that do it — that set of handlers *is* the permission list, visible on the canvas.
- `refusalReason` and `refusalMessage` → a Text node in a debug group: the fastest way to find out that the server is sending `OPEN_VIEW` while the graph registered `OPEN_SESSION`.
- Send an array of actions for a guided tour; set `autoComplete` off on the handlers that must finish before the next step starts, and wire `idle` to whatever runs at the end.
- Enable `SET_STORE` with `allowedKeys` naming just the view keys the agent may steer, so a store write cannot reach an auth token that happens to live in the same store.
- A built-in's own fields may sit on the envelope (`{type:'SET_STORE', key, value}`) or inside `payload` (`{type:'SET_STORE', payload:{key, value}}`) — the same resolution a handler's `payload` output uses, envelope first on a collision. `MERGE_STORE` wants `values` either way. A `storeName` in the message is always ignored in favour of the node's own.

## Watch out for

- Enabling built-ins with `allowedKeys` blank on a store that also holds credentials or ids — a server can then overwrite any key in it.
- Registering a catch-all handler that reads `payload.command` and switches on it: that re-opens the open vocabulary this node exists to close. One handler per action type.
- Leaving `refused` unwired. A dispatcher that refuses everything looks identical to a dead stream if nothing shows the refusals.
- Wiring `dispatch` from a signal that fires before `action` is set — the previous action runs again.
- Setting `maxQueueSize` to 0 on a stream you do not control.

## Examples

**Agent actions: let a backend drive the UI, but only where you allowed it**

The idiomatic shape for a backend that sends commands rather than data. Server-Sent Events delivers action objects; Action Dispatcher decides whether each one may run. The vocabulary is closed: `OPEN_SESSION` runs because the Action Handler registered it, `SET_STORE` runs because it is named in `builtIns` and its key is in `allowedKeys`, and anything else is refused with a reason on `refusalReason` — which is wired to a Text node, because a refusal nobody can see is the failure mode this whole design exists to avoid. The handler has `autoComplete` off and completes only once its Set Global Store finished, so an array of actions runs as an ordered flow rather than all at once.

## Related nodes

[Action Handler](./net-noodl-action-handler.md), [Server-Sent Events](./net-noodl-sse.md), [WebSocket](./net-noodl-web-socket.md), [Global Store](./net-noodl-global-store.md), [Set Global Store](./net-noodl-global-store-set.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
