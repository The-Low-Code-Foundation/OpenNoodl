---
title: "External Link"
---
External Link: opens a URL outside the app — same tab or new tab — when its signal fires.

External Link leaves the app: when `do` fires, the browser navigates to `link`, in a new tab when `openInNewTab` is true. It performs no in-app routing. It reports `done` once the link has been handed to the browser, `failure` when there is no Link or a popup blocker refused the new tab, and `unchanged` during a server-side render where there is no browser to open anything in — with Open In New Tab off the page is replaced, so nothing downstream of `done` may still exist.

## When to use it

Documentation links, third-party checkout, mailto/tel URLs. For anything inside the app use Navigate or Navigate To Path, which keep SPA state alive.

## At a glance

| | |
|---|---|
| Category | Navigation |
| Type name | `net.noodl.externallink` |
| Available in | browser |
| SSR compatibility | safe |
| Provided by | `noodl-viewer-react` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `link` | String | — | Web address to open; one with no scheme is resolved relative to the page the app is served from |
| `openInNewTab` | Boolean | `true` | Opens the link in a new tab; when off the current page is replaced and the app unloads |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `do` | Signal | — | Opens Link, or fires Failure if there is no Link or the link was opened outside a user action |

## Outputs

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires once the link has been handed to the browser. It does not promise a tab appeared — nothing readable in the page does, once Open In New Tab is on. With it off the page is replaced, so nothing downstream of this may still exist |
| `unchanged` | Signal | — | Fires when there is no browser to open a link in — a server-side render, where there is nothing to do and nothing to fail at |

### Failure outputs

| Name | Type | Default | Description |
|---|---|---|---|
| `error` | String | — | Why the link could not be opened, set just before Failure fires |
| `failure` | Signal | — | Fires when no Link was set, or when the link was opened outside a user action — the case a browser refuses a new tab for. A tab blocked for any other reason still reports Done |

## Watch out for

- Pointing External Link at the app's own routes — the full page reload throws away application state that Navigate would keep.

## Examples

**URL-driven detail page: Router, Page Inputs, Navigate To Path and External Link**

URL-style navigation end to end. A Router named 'Main' hosts /Home and /Product (its `pages` parameter is `{ routes, startPage }`); each page component is rooted by a Page node whose `urlPath` defines its URL pattern — /Product uses 'product/{productId}', so the id lives in the URL. On /Home, a Navigate To Path node (PageStackNavigateToPath) builds the URL from its `path` parameter: the '{productId}' placeholder becomes the `p-productId` input, set here as a parameter, and clicking the button pushes the compiled path into browser history, which the Router picks up. On /Product, a Page Inputs node declares `pathParams: "productId"` so the value parsed from the URL is exposed as its `pm-productId` output, wired into a Text. An External Link node (net.noodl.externallink) opens an outside URL in a new tab — external URLs never go through the Router.

## Related nodes

[Navigate](./router-navigate.md), [Navigate To Path](./page-stack-navigate-to-path.md), [Cloud File](../cloud-services/cloud-file.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
