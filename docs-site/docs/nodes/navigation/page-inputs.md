---
title: "Page Inputs"
---
Page Inputs: exposes the URL path and query parameters of the containing page as value outputs.

Page Inputs receives the navigation parameters delivered to the page component it sits in and republishes them as value outputs. Declare the expected names in the edit-only `pathParams` and `queryParams` string lists; each declared name becomes an output `pm-<name>` holding the value parsed from the URL (path placeholders like `{productId}` on the page's `urlPath`, or query-string entries) or passed by the Navigate node that opened the page. The Router pushes new values into these outputs on every navigation, including when only the parameters change while the page stays mounted.

## When to use it

Inside a Router page component, whenever the page needs data that lives in the URL — a record id, a tab name, a search term. It only receives values pushed by the navigation system, so it does nothing outside a page component; for values passed to ordinary component instances use Component Inputs.

## At a glance

| | |
|---|---|
| Category | Navigation |
| Type name | `PageInputs` |
| Available in | browser |
| SSR compatibility | safe |
| Provided by | `noodl-viewer-react` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `pathParams` | Stringlist | — | Names of the braced segments in this page’s route, one output port each |
| `queryParams` | Stringlist | — | Names of query-string parameters to read from the URL, one output port each |

## Dynamic ports

_This node's port list changes at runtime (runtime-discovered, editor-adapter); the tables above may be incomplete for a given instance._

Output ports are the path/query parameters declared on the containing page component (PageInputsAdapter).

## Ports at runtime

All outputs are runtime-determined (runtime-discovered + editor-adapter, PageInputsAdapter): declaring a name in `pathParams`/`queryParams` registers an untyped `pm-<name>` output on demand. The values themselves arrive when the Router (or a route-enabled Component Stack) navigates to the containing page and calls into this node; a generator can only rely on the names it declared itself.

## Patterns

- `pm-<id>` → a Query Records filter input: the canonical detail page, where the record to show is chosen by the URL.

## Watch out for

- Using Page Inputs to receive values from a normal component instance — that is what Component Inputs is for; Page Inputs is only fed by navigation.

## Examples

**URL-driven detail page: Router, Page Inputs, Navigate To Path and External Link**

URL-style navigation end to end. A Router named 'Main' hosts /Home and /Product (its `pages` parameter is `{ routes, startPage }`); each page component is rooted by a Page node whose `urlPath` defines its URL pattern — /Product uses 'product/{productId}', so the id lives in the URL. On /Home, a Navigate To Path node (PageStackNavigateToPath) builds the URL from its `path` parameter: the '{productId}' placeholder becomes the `p-productId` input, set here as a parameter, and clicking the button pushes the compiled path into browser history, which the Router picks up. On /Product, a Page Inputs node declares `pathParams: "productId"` so the value parsed from the URL is exposed as its `pm-productId` output, wired into a Text. An External Link node (net.noodl.externallink) opens an outside URL in a new tab — external URLs never go through the Router.

## Related nodes

[Page](../visual/page.md), [Page Router](../visual/router.md), [Navigate](./router-navigate.md), [Navigate To Path](./page-stack-navigate-to-path.md), [Component Inputs](../component-utilities/component-inputs.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
