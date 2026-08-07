---
title: "Close Popup"
---
Close Popup: dismisses the popup this node lives in, sending named results and a close action back to the opener.

Close Popup works only inside a component shown via Show Popup: when `close` fires it removes the overlay. The `results` list declares values handed back (each becomes an input here and an output on the Show Popup node), and `closeActions` declares named reasons, each surfacing as its own signal at the opener — the mechanism for confirm/cancel semantics.

## When to use it

Every dismissal affordance inside a popup: confirm buttons, cancel crosses, backdrop clicks (via the backdrop Group's onClick). It has no effect outside a popup.

## At a glance

| | |
|---|---|
| Category | Navigation |
| Type name | `NavigationClosePopup` |
| Available in | browser |
| SSR compatibility | safe |
| Provided by | `noodl-viewer-react` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `closeActions` | Stringlist | — | Names of the ways this popup can be closed, one signal input each; the matching signal fires on the Show Popup node |
| `results` | Stringlist | — | Names of values to hand back to the Show Popup node that opened this popup, one input port each |
| `targetComponent` | Component | — | Which popup to close when popups are nested; leave blank to close the nearest enclosing one |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `close` | Signal | — | Closes the popup and hands back any Results |

## Outputs

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires once the popup has been closed and any Results have been handed back |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `error` | String | — | Why the popup was not closed, set just before Failure fires |
| `failure` | Signal | — | Fires when this node is not inside an open popup, or Popup names one it is not inside |

## Dynamic ports

_This node's port list changes at runtime (runtime-discovered); the tables above may be incomplete for a given instance._

Output ports mirror the close-result values declared by the popup being closed.

## Ports at runtime

The result-value inputs are generated from the `results` list on the instance — configuration-determined.

## Examples

**Show a popup and close it from inside with a close action**

The popup pair: a Show Popup node (NavigationShowPopup) opens the /Confirm Delete Dialog component as an overlay when the Delete-account button is clicked. The Close Popup node (NavigationClosePopup) lives INSIDE the popup component — it is the only way the popup ends itself. Its `closeActions` parameter declares 'confirm,cancel', which registers `closeAction-confirm` and `closeAction-cancel` signal inputs on Close Popup and matching signal outputs on the Show Popup node that opened it: the host reacts to `closeAction-confirm` without knowing anything about the dialog's internals. A close action both closes the popup and routes the outcome; plain `close` (not used here) would fire Show Popup's generic `Closed` output instead.

## Related nodes

[Show Popup](./navigation-show-popup.md), [Pop Component Stack](./page-stack-navigate-back.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
