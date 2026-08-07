---
title: "Show Popup"
---
Show Popup: overlays a component on top of the app when triggered; the popup closes itself and can hand back results.

Show Popup instantiates `target` (a component) as an overlay above everything else when `show` fires. The popup component owns its dismissal: a Close Popup node inside it removes the overlay, fires this node's `Closed` signal, and delivers any declared result values as outputs here — plus one signal output per close action, so 'confirmed' and 'dismissed' can be told apart at the call site. `Closed` is a *later* event about a popup that opened — `done` is the one that says the `show` itself finished, and it fires the moment the popup is on screen.

## When to use it

Dialogs, sheets, confirmations — transient UI that must sit above the page and return an answer. For a persistent section of the page, conditional `mounted` on a Group is lighter; for full pages use Router or Component Stack.

## At a glance

| | |
|---|---|
| Category | Navigation |
| Type name | `NavigationShowPopup` |
| Available in | browser |
| SSR compatibility | safe |
| Provided by | `noodl-viewer-react` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `stackPolicy` | Enum (`replace`, `stack`) | `replace` | Replace It closes the popup already showing, Show On Top opens this one over it |
| `target` | Component | — | Component to open as a popup; its Component Inputs become input ports on this node |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `show` | Signal | — | Opens Target as a popup |

## Outputs

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `Closed` | Signal | — | Fires when the popup was closed without a close action, after Close Results are up to date |
| `Dismissed` | Signal | — | Fires when another popup replaced this one before the user closed it, so there are no Close Results |
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires once the popup has been opened. Closed and Dismissed are later events about the same popup, not this signal |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `error` | String | — | Why the popup did not open, set just before Failure fires |
| `failure` | Signal | — | Fires when no Target is set, or the component could not be opened |

## Dynamic ports

_This node's port list changes at runtime (runtime-discovered); the tables above may be incomplete for a given instance._

Input ports mirror the component inputs of the target popup component; close-result outputs mirror its Component Outputs.

## Ports at runtime

Result-value outputs and per-close-action signals are generated from the Close Popup configuration inside the target component; the target's Component Inputs also surface as inputs here. All of it is project-content-determined.

## Patterns

- Confirmation dialog: show → popup's confirm/cancel close actions → distinct signals at the caller.

## Watch out for

- Closing a popup from outside it — dismissal belongs inside the popup component, where Close Popup works.

## Examples

**Show a popup and close it from inside with a close action**

The popup pair: a Show Popup node (NavigationShowPopup) opens the /Confirm Delete Dialog component as an overlay when the Delete-account button is clicked. The Close Popup node (NavigationClosePopup) lives INSIDE the popup component — it is the only way the popup ends itself. Its `closeActions` parameter declares 'confirm,cancel', which registers `closeAction-confirm` and `closeAction-cancel` signal inputs on Close Popup and matching signal outputs on the Show Popup node that opened it: the host reacts to `closeAction-confirm` without knowing anything about the dialog's internals. A close action both closes the popup and routes the outcome; plain `close` (not used here) would fire Show Popup's generic `Closed` output instead.

## Related nodes

[Close Popup](./navigation-close-popup.md), [Component Stack](../visual/page-stack.md), [Group](../visual/group.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
