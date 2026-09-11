---
title: "Page"
---
:::note
This node is not offered directly in the node picker.
:::

The root visual node of a Router page component: declares the page's title, URL pattern and meta tags.

Page is the mandatory root of every page component shown by a Router (Page Router) — a Router only mounts components whose graph contains exactly one Page node. It is not in the node picker because the editor creates it automatically when a page is added to a Router; there is no replacement node, you configure the existing one. Its `title` sets the document title and the Router's `currentPageTitle`; its `urlPath` is the page's URL pattern and may contain `{param}` placeholders that Page Inputs (PageInputs) nodes read; the remaining inputs are SEO meta tags (description, robots, og:*, twitter:*, sitemap hints) plus padding and CSS styling for the page surface.

## When to use it

Do not add Page from the node picker or use it outside a Router page component — it is created automatically as the root when a page is added to a Router. Edit that existing node to set the page's title, `urlPath` and meta tags.

## At a glance

| | |
|---|---|
| Category | Visual |
| Type name | `Page` |
| Available in | browser |
| SSR compatibility | safe |
| Provided by | `noodl-viewer-react` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `boxSizing` | Enum (`border-box`, `content-box`) | `border-box` | Whether Width and Height include this element's padding and border, or only its content |
| `cssClassName` | String | `` | Extra CSS class names to put on this element, for styling from a stylesheet you supply |
| `description` | String | — | Summary search engines show under the page title in results, usually kept under about 160 characters |
| `og:description` | String | — | Summary shown beneath the title when this page is shared |
| `og:image` | String | — | Image shown in the share preview; it must be an absolute URL, not a project path |
| `og:image:height` | String | — | Height of the share image in pixels |
| `og:image:width` | String | — | Width of the share image in pixels, which lets a preview reserve space before the image loads |
| `og:title` | String | — | Title shown when this page is shared on Facebook, LinkedIn and most chat apps; falls back to the page title |
| `og:type` | Enum (`website`, `article`, `book`, `profile`, `video.movie`, `video.episode`, `video.tv_show`, `video.other`, `music.song`, `music.album`, `music.playlist`, `music.radio_station`) | — | What kind of thing this page is, which changes how the preview is laid out. The legal values are fixed by the Open Graph protocol, so this is a closed list rather than free text. |
| `og:url` | String | — | Canonical address of this page, so shares of different URLs are counted as the same page |
| `paddingBottom` | Number | `0` | Space inside the element's bottom edge, between it and its content |
| `paddingLeft` | Number | `0` | Space inside the element's left edge, between it and its content |
| `paddingRight` | Number | `0` | Space inside the element's right edge, between it and its content |
| `paddingTop` | Number | `0` | Space inside the element's top edge, between it and its content |
| `robots` | String | — | Instructions for search-engine crawlers, e.g. "noindex, nofollow" to keep this page out of results |
| `sitemapChangefreq` | Enum (`always`, `hourly`, `daily`, `weekly`, `monthly`, `yearly`, `never`) | `weekly` | How often this page changes, as a hint to search-engine crawlers in the sitemap |
| `sitemapIncluded` | Boolean | `true` | Lists this page in the generated sitemap |
| `sitemapPriority` | Number | `0.5` | This page's importance relative to the rest of the site, from 0 to 1, in the sitemap |
| `styleCss` | String | `/* background-color: red; */` | Raw CSS declarations applied to this element, overriding the styling ports above |
| `title` | String | — | The page's title, used as the document title while this page is showing; defaults to the component name |
| `twitter:card` | Enum (`summary`, `summary_large_image`, `app`, `player`) | — | Shape of the preview on X/Twitter. A closed list: anything else is ignored and the card falls back to a small summary. |
| `twitter:description` | String | — | Summary shown when this page is shared on X/Twitter |
| `twitter:image` | String | — | Image shown in the X/Twitter preview; it must be an absolute URL |
| `twitter:title` | String | — | Title shown when this page is shared on X/Twitter; falls back to the Open Graph title |
| `urlPath` | String | — | The URL pattern that routes to this page, e.g. "product/{productId}" — placeholders become path parameters a Page Inputs node reads |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `onPageReady` | Signal | — | Pulse this once the page has the data it needs; the SSR server holds the rendered HTML until it fires. Unconnected pages render as soon as the runtime settles |

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
| `this` | Reference | — | A reference to this node itself, for ports that take a node rather than a value |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `completed` | Signal | — | Fires after every invocation. This node has no other outcome — no Unchanged and no Failure — so it always fires together with Done, and wiring either one does the same thing. It is here on every action so that reaching for it is never a per-node decision |
| `didMount` | Signal | — | Fires once this element has been added to the page and can be measured |
| `done` | Signal | — | Fires once the page has announced that it is ready to render |
| `willUnmount` | Signal | — | Fires just before this element is removed from the page, while it still exists |

## Dynamic ports

_This node's port list changes at runtime (runtime-discovered); the tables above may be incomplete for a given instance._

Some ports are discovered at runtime from user code, parameters or connected components, and are pushed to the editor per instance; the static port list below is incomplete for such instances.

## Ports at runtime

Runtime-determined inputs (runtime-discovered): an editor connection re-sends `title` and `urlPath` per instance so the property panel can offer defaults derived from the component name. Both are ordinary declared inputs and are settable as parameters with no editor attached: the exporter reads them off the node into the router index, so a headlessly authored page carries its own title and URL. Nothing else on this node is runtime-determined.

## Examples

**Page spine: full-bleed bands, a centred max-width shell, an announced section**

The structure every designed page shares, and the one an unstyled page is missing. Three levels: a BAND is full width and owns a background (sections alternate --background and --surface so the page reads as parts, not a scroll); inside it exactly one SHELL, width 100% with maxWidth 1200px and --space-6 side padding, centred by alignItems "center" on the band; content lives in the shell. Content that touches the viewport edge is the loudest signal nobody designed the page. A section opens with an eyebrow, a heading and one optional sub-line capped at ~560px so it wraps at a readable measure, then --space-10 of air. Band padding is --space-20.

**Card grid: Query Records into a Repeater, in a Columns node that reflows on its own**

The canonical data grid, and the layout decision most often got wrong. Use a Columns node with sizing "autoFit" and a minWidth of 260-320px: it fits as many columns as the CONTAINER holds and reflows by itself, with no breakpoints to maintain. Columns handles a Repeater child correctly — the Repeater draws nothing and adds its items as siblings, so Columns skips it and gives each real item a column box. The card component is width 100% and lets the column size it, which is what makes the SAME card work in this grid, in a 2-up related row, and in a sidebar. Do NOT reach for a Group with flexWrap: a wrapped flex row does not shrink its children, so each item needs a hardcoded percentage track, and — the part that matters — no Group anywhere in the runtime has a breakpoint, so that layout can never collapse on a narrow screen. Record fields reach the item through Component Inputs whose names match the record properties, and wiring a field straight into a Group's visible port is conditional rendering with no logic node.

## Related nodes

[Page Router](./router.md), [Navigate](../navigation/router-navigate.md), [Page Inputs](../navigation/page-inputs.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
