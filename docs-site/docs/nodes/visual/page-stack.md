---
title: "Component Stack"
---
Component Stack: push/pop navigation container — pages stack on top of each other with transitions, ideal for wizards and drill-in flows.

The Component Stack is the second navigation model, alongside Router. It holds a configured set of pages (components) and shows one at a time, but keeps history as a stack: Push Component To Stack adds a page on top (with a transition), Pop Component Stack returns to the one beneath, optionally handing back result values. `stackDepth` and `topPageName` expose the current state; `reset` unwinds to the start page. Unlike Router it is not URL-driven by default (`useRoutes` opts pages into routing).

## When to use it

Flows with a natural back relationship: wizards, mobile-style master→detail drill-ins, modal sequences that return results. For top-level app sections addressed by URL, use Router + Page.

## At a glance

| | |
|---|---|
| Category | Visual |
| Type name | `Page Stack` |
| Available in | browser |
| SSR compatibility | partial — The initial stack renders server-side; browser URL/history sync only runs in the browser. |
| Provided by | `noodl-viewer-react` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `backgroundColor` | Color | `transparent` | Fill colour behind whichever component is showing |
| `clip` | Boolean | `true` | Clips a pushed component that is bigger than the stack |
| `cssClassName` | String | `` | Extra CSS class names to put on this element, for styling from a stylesheet you supply |
| `mounted` | Boolean | `true` | Removes the element from the page entirely when false, unlike Visible which leaves its space behind |
| `name` | String (PackStack id) | `Main` | Name the Push and Pop nodes address this stack by; leave it as Main if there is only one |
| `pages` | Proplist | — | The components this stack can show, and which of them it starts on |
| `styleCss` | String | `/* background-color: red; */` | Raw CSS declarations applied to this element, overriding the styling ports above |
| `useRoutes` | Boolean | `false` | Puts the top component in the browser URL, so back and forward move through the stack |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `reset` | Signal | — | Empties the stack and rebuilds the start component |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `boundingHeight` | Number | — | Height this element actually ended up with after layout, in pixels |
| `boundingWidth` | Number | — | Width this element actually ended up with after layout, in pixels |
| `childIndex` | Number | — | This element's position among its parent's children, counting from 0 |
| `childrenCount` | Number | — | How many child elements are currently mounted inside this one |
| `screenPositionX` | Number | — | Distance in pixels from the left edge of the window to this element's left edge |
| `screenPositionY` | Number | — | Distance in pixels from the top edge of the window to this element's top edge |
| `stackDepth` | Number | — | How many components are on the stack, so 1 means only the start component |
| `this` | Reference | — | A reference to this node itself, for ports that take a node rather than a value |
| `topPageName` | String | — | Name of the component currently on top of the stack |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `didMount` | Signal | — | Fires once this element has been added to the page and can be measured |
| `done` | Signal | — | Fires once the stack has been emptied and the start component rebuilt |
| `willUnmount` | Signal | — | Fires just before this element is removed from the page, while it still exists |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `failure` | Signal | — | Fires when the stack has no components configured, or its start component does not resolve |

## Dynamic ports

_This node's port list changes at runtime (runtime-discovered); the tables above may be incomplete for a given instance._

Per-page signal outputs and transition parameters are generated from the "pages" parameter.

## Ports at runtime

Runtime-determined ports follow the configured pages: page components' inputs surface where relevant, and the pages list itself is a proplist the editor manages. Navigation nodes reference the stack by its `name`.

## Patterns

- `stackDepth` → an Expression (`depth > 1`) → the back button's `visible`: back affordance only when back exists.

## Watch out for

- Using a stack for top-level sections users expect to deep-link — that is Router territory.

## Examples

**Push and pop a Component Stack (wizard flow)**

Stack-style navigation: a Page Stack (Component Stack) named 'Checkout' hosts two components, defined in its `pages` parameter with `pageComp-<id>` entries mapping each page to a component in this file. Inside /Cart, a Push Component To Stack node (PageStackNavigate) pushes /Confirm with a transition when the Continue button is clicked. Inside /Confirm, a Pop Component Stack node (PageStackNavigateBack) pops back: the Back button triggers its plain `navigate` signal, while the Place-order button triggers the `backAction-confirmed` signal input declared via the `backActions` parameter — that same action surfaces as the `backAction-confirmed` signal output on the Push node in /Cart, where it fires an Event Sender. This is the round-trip: back actions are declared on the Pop node inside the pushed component and consumed on the Push node that pushed it.

## Related nodes

[Push Component To Stack](../navigation/page-stack-navigate.md), [Pop Component Stack](../navigation/page-stack-navigate-back.md), [Page Router](./router.md), [Show Popup](../navigation/navigation-show-popup.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
