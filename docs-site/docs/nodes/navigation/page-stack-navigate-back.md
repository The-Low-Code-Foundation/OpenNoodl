---
title: "Pop Component Stack"
---
Pop Component Stack: returns to the previous page on the stack, optionally handing result values back to the popper's caller.

When `navigate` fires, the top page is popped and the one beneath becomes visible with the reverse transition. The `results` list declares named values to pass back: they become inputs on this node, and the corresponding Push node that opened the page exposes them as outputs plus one signal per `backActions` entry — a lightweight way for a pushed page to answer the page that opened it.

## When to use it

The back/cancel/done affordance inside any pushed page. Pair result values with distinct back actions ('save' vs 'cancel') when the opener must react differently.

## At a glance

| | |
|---|---|
| Category | Navigation |
| Type name | `PageStackNavigateBack` |
| Available in | browser |
| SSR compatibility | safe |
| Provided by | `noodl-viewer-react` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `backActions` | Stringlist | — | Names of the ways this component can be closed, one signal input each; the matching signal fires on the node that pushed it |
| `results` | Stringlist | — | Names of values to hand back to the node that pushed this component, one input port each |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `navigate` | Signal | — | Pops the enclosing Component Stack back to the component underneath |

## Outputs

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires once the stack has popped this component. ⚠️ This node is destroyed with the component it pops, so sequence anything that must survive the pop from the node that pushed it |
| `unchanged` | Signal | — | Fires when the Component Stack is already showing its first component, so there was nothing to pop |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `error` | String | — | Why the stack did not pop, set just before Failure fires |
| `failure` | Signal | — | Fires when this node is not inside a pushed component, or a navigation is still animating |

## Dynamic ports

_This node's port list changes at runtime (runtime-discovered); the tables above may be incomplete for a given instance._

Result ports depend on the "backActions" style parameters of the containing Page Stack.

## Ports at runtime

The result-value inputs are generated from the `results`/`backActions` lists on the node instance — runtime-determined by configuration.

## Examples

**Push and pop a Component Stack (wizard flow)**

Stack-style navigation: a Page Stack (Component Stack) named 'Checkout' hosts two components, defined in its `pages` parameter with `pageComp-<id>` entries mapping each page to a component in this file. Inside /Cart, a Push Component To Stack node (PageStackNavigate) pushes /Confirm with a transition when the Continue button is clicked. Inside /Confirm, a Pop Component Stack node (PageStackNavigateBack) pops back: the Back button triggers its plain `navigate` signal, while the Place-order button triggers the `backAction-confirmed` signal input declared via the `backActions` parameter — that same action surfaces as the `backAction-confirmed` signal output on the Push node in /Cart, where it fires an Event Sender. This is the round-trip: back actions are declared on the Pop node inside the pushed component and consumed on the Push node that pushed it.

## Related nodes

[Component Stack](../visual/page-stack.md), [Push Component To Stack](./page-stack-navigate.md), [Close Popup](./navigation-close-popup.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
