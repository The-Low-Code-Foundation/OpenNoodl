---
title: "Navigate"
---
Navigate: tells a named Router to switch to a target page, passing typed path parameters, when its navigate signal fires.

Navigate drives a Router. When `navigate` is triggered it switches the router named in its `router` parameter to the page chosen in `target`, updating the URL if the router does. Path/query parameters declared by the target page become input ports on this node, so per-page data (an id, a tab name) is wired like any other value. `done` fires when the transition completes, `unchanged` when the router is already showing that page with those parameters, and `failure` when the target is not a page of that router; `completed` fires after all three. `openInNewTab` opens the target in a new browser tab instead of transitioning in place.

## When to use it

All URL-style page switching with a Router. For stack-style flows (push/pop with transitions, e.g. wizards or mobile-style drill-in) use Page Stack with PageStackNavigate instead; for external URLs use net.noodl.externallink.

## At a glance

| | |
|---|---|
| Category | Navigation |
| Type name | `RouterNavigate` |
| Available in | browser |
| SSR compatibility | safe |
| Provided by | `noodl-viewer-react` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `openInNewTab` | Boolean | `false` | Opens the target page in a new browser tab instead of navigating this one |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `navigate` | Signal | — | Navigates the Router to Target Page |

## Outputs

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires once the Router has switched to the target page. ⚠️ If this node lives on the page being left it is destroyed with that page, so sequence anything that must survive the navigation from a node outside the Router |
| `unchanged` | Signal | — | Fires when the Router is already showing that page with those parameters, so it was not rebuilt |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `error` | String | — | Why the navigation did not happen, set just before Failure fires |
| `failure` | Signal | — | Fires when no Target Page is set, or the Router does not serve that page |

## Dynamic ports

_This node's port list changes at runtime (runtime-discovered, editor-adapter); the tables above may be incomplete for a given instance._

Ports are derived from the target router and the path parameters of the selected page component (RouterNavigateAdapter).

## Ports at runtime

Runtime-determined inputs (runtime-discovered + editor-adapter): the `router` and `target` choices come from the routers and pages that exist in the project, and each parameter declared by the chosen target page is registered as an input port on demand. The port set therefore depends on project content, not the node type.

## Patterns

- Button `onClick` → `navigate` with `target` set on the node: the standard menu/link wiring.
- Record id from a list item → the page-parameter input, so the detail page can query its record from the URL.

## Watch out for

- Encoding app state in many routers when one router plus page parameters suffices; multiple routers are for genuinely independent regions.

## Examples

**Router page navigation from a button**

URL-style navigation: a Router hosts the app's pages (each page is a component, configured in the Router's `pages` parameter), and a Navigate node (RouterNavigate) switches it. The Button's `onClick` signal triggers `navigate`; which page to go to, and any path parameters, are set on the Navigate node's parameters — those ports are created from the Router's page configuration at edit time, which is why they are runtime-determined in the catalog.

## Related nodes

[Page Router](../visual/router.md), [Page Inputs](./page-inputs.md), [Page](../visual/page.md), [Push Component To Stack](./page-stack-navigate.md), [External Link](./net-noodl-externallink.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
