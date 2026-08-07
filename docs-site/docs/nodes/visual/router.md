---
title: "Page Router"
---
Page Router: a visual region that shows one page component at a time, driven by the browser URL and Navigate nodes.

Router (Page Router) renders exactly one of its configured page components inside its own bounds. Its `pages` parameter is `{ routes: [component names], startPage: component name }`; each page component is rooted by a Page node whose `urlPath` defines the page's URL pattern, which may contain `{param}` placeholders. On mount the Router matches the current browser URL (hash-based by default, or real paths depending on the project's `navigationPathType` setting) and shows the matching page, falling back to `startPage`; a RouterNavigate node or a URL change switches pages, updates the browser URL and the document title, and delivers path/query parameters to Page Inputs (PageInputs) nodes inside the mounted page. Several Routers can coexist if given different `name`s; Navigate nodes address a router by that name (default "Main").

## When to use it

The standard top-level navigation of an app: distinct pages with URLs, deep-linkable and back-button friendly. For push/pop sub-flows with transitions (wizards, drill-in) use Page Stack instead; a Router can nest inside another Router's page via its `urlPath` base-path input.

## At a glance

| | |
|---|---|
| Category | Visual |
| Type name | `Router` |
| Available in | browser |
| SSR compatibility | safe |
| Provided by | `noodl-viewer-react` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `backgroundColor` | Color | `transparent` | Fill colour behind whichever page is showing |
| `clip` | Enum (`contentHeight`, `scroll`, `clip`) | `contentHeight` | What happens when a page is taller than the router: grow to fit it, scroll it, or clip it |
| `cssClassName` | String | `` | Extra CSS class names to put on this element, for styling from a stylesheet you supply |
| `mounted` | Boolean | `true` | Removes the element from the page entirely when false, unlike Visible which leaves its space behind |
| `name` | String | — | Name the Navigate nodes address this router by; leave it blank if there is only one |
| `pages` | Pages | — | The components this router can show, and which of them is the start page |
| `styleCss` | String | `/* background-color: red; */` | Raw CSS declarations applied to this element, overriding the styling ports above |
| `urlPath` | String | — | Path segment prefixed to every page of this router, for nesting one router inside another |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `reset` | Signal | — | Re-reads the URL and rebuilds the current page from scratch |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `boundingHeight` | Number | — | Height this element actually ended up with after layout, in pixels |
| `boundingWidth` | Number | — | Width this element actually ended up with after layout, in pixels |
| `childIndex` | Number | — | This element's position among its parent's children, counting from 0 |
| `childrenCount` | Number | — | How many child elements are currently mounted inside this one |
| `currentPageComponent` | String | — | Component name of the page currently showing |
| `currentPageTitle` | String | — | Title of the page currently showing, taken from the Pages list |
| `screenPositionX` | Number | — | Distance in pixels from the left edge of the window to this element's left edge |
| `screenPositionY` | Number | — | Distance in pixels from the top edge of the window to this element's top edge |
| `this` | Reference | — | A reference to this node itself, for ports that take a node rather than a value |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `didMount` | Signal | — | Fires once this element has been added to the page and can be measured |
| `done` | Signal | — | Fires once the page has been rebuilt, or its Page Inputs updated with new parameters |
| `unchanged` | Signal | — | Fires when the Router is already showing that page with those parameters, so nothing needed rebuilding |
| `willUnmount` | Signal | — | Fires just before this element is removed from the page, while it still exists |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `failure` | Signal | — | Fires when the Router has no Pages, no start page, a start page it does not serve, or a routed component that is not a page |

## Dynamic ports

_This node's port list changes at runtime (runtime-discovered, editor-adapter); the tables above may be incomplete for a given instance._

The "pages" parameter determines which pages exist; the editor (RouterAdapter) derives ports and navigation metadata from the page components.

## Ports at runtime

Runtime-determined ports (runtime-discovered + editor-adapter, RouterAdapter): the `pages` parameter decides which page components exist, and the editor derives navigation metadata — page titles, URL patterns, parameters — from each page component's Page node. An authoring tool should set `name` and `pages` on the Router and declare titles/paths on the Page node inside each page component; it cannot enumerate page-dependent ports statically.

## Patterns

- One Router named "Main" at the app root, with RouterNavigate nodes anywhere in the app switching it by name.
- Declare `urlPath` with `{param}` placeholders on a page's Page node, then read the values with a Page Inputs node inside that page.

## Watch out for

- Adding a Router per app section when one Router plus pages suffices — multiple routers are for genuinely independent regions (e.g. a main area and a side panel).

## Examples

**Router page navigation from a button**

URL-style navigation: a Router hosts the app's pages (each page is a component, configured in the Router's `pages` parameter), and a Navigate node (RouterNavigate) switches it. The Button's `onClick` signal triggers `navigate`; which page to go to, and any path parameters, are set on the Navigate node's parameters — those ports are created from the Router's page configuration at edit time, which is why they are runtime-determined in the catalog.

**URL-driven detail page: Router, Page Inputs, Navigate To Path and External Link**

URL-style navigation end to end. A Router named 'Main' hosts /Home and /Product (its `pages` parameter is `{ routes, startPage }`); each page component is rooted by a Page node whose `urlPath` defines its URL pattern — /Product uses 'product/{productId}', so the id lives in the URL. On /Home, a Navigate To Path node (PageStackNavigateToPath) builds the URL from its `path` parameter: the '{productId}' placeholder becomes the `p-productId` input, set here as a parameter, and clicking the button pushes the compiled path into browser history, which the Router picks up. On /Product, a Page Inputs node declares `pathParams: "productId"` so the value parsed from the URL is exposed as its `pm-productId` output, wired into a Text. An External Link node (net.noodl.externallink) opens an outside URL in a new tab — external URLs never go through the Router.

## Related nodes

[Navigate](../navigation/router-navigate.md), [Page](./page.md), [Page Inputs](../navigation/page-inputs.md), [Navigate To Path](../navigation/page-stack-navigate-to-path.md), [Component Stack](./page-stack.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
