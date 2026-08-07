---
title: "Push Component To Stack"
---
Push Component To Stack: pushes a chosen page onto a named Component Stack with a transition when triggered.

When `navigate` fires, the page selected on this node is pushed onto the Component Stack named in `stack`, animating per the chosen transition. Inputs declared by the target page's Component Inputs appear on this node, so per-page data travels with the push. `done` fires when the transition completes, `unchanged` when the stack is already showing that component with those parameters, and `failure` when the push was dropped; `completed` fires after all three. `mode` controls push-vs-replace behaviour.

## When to use it

Advancing stack flows: next wizard step, opening a detail page over a list. To go back, use Pop Component Stack — never push the previous page again.

## At a glance

| | |
|---|---|
| Category | Navigation |
| Type name | `PageStackNavigate` |
| Available in | browser |
| SSR compatibility | safe |
| Provided by | `noodl-viewer-react` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `mode` | Enum (`push`, `replace`) | `push` | Push adds the target on top of the stack, Replace swaps it for the component currently showing |
| `stack` | String (PackStack id) | `Main` | Name of the Component Stack to navigate; leave blank for the one named Main |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `navigate` | Signal | — | Navigates the Component Stack to Target Page |

## Outputs

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires once the stack has switched to the target component. ⚠️ If this node lives on the component being replaced it is destroyed with it, so sequence anything that must survive the navigation from a node outside the stack |
| `unchanged` | Signal | — | Fires when the stack is already showing that component with those parameters, so it was not pushed again |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `error` | String | — | Why the navigation did not happen, set just before Failure fires |
| `failure` | Signal | — | Fires when no Target Page is set, the stack has no components configured, or a navigation is still animating |

## Dynamic ports

_This node's port list changes at runtime (runtime-discovered); the tables above may be incomplete for a given instance._

Input ports for target-page parameters are derived from the target page component of the containing Page Stack.

## Ports at runtime

The target-page choice, its transition options, and one input port per Component Input of the chosen page are runtime-determined from project content.

## Patterns

- List row click → push detail page with the row's id wired into the page's input.

## Examples

**Push and pop a Component Stack (wizard flow)**

Stack-style navigation: a Page Stack (Component Stack) named 'Checkout' hosts two components, defined in its `pages` parameter with `pageComp-<id>` entries mapping each page to a component in this file. Inside /Cart, a Push Component To Stack node (PageStackNavigate) pushes /Confirm with a transition when the Continue button is clicked. Inside /Confirm, a Pop Component Stack node (PageStackNavigateBack) pops back: the Back button triggers its plain `navigate` signal, while the Place-order button triggers the `backAction-confirmed` signal input declared via the `backActions` parameter — that same action surfaces as the `backAction-confirmed` signal output on the Push node in /Cart, where it fires an Event Sender. This is the round-trip: back actions are declared on the Pop node inside the pushed component and consumed on the Push node that pushed it.

## Related nodes

[Component Stack](../visual/page-stack.md), [Pop Component Stack](./page-stack-navigate-back.md), [Navigate](./router-navigate.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
