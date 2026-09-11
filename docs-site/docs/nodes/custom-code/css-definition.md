---
title: "CSS Definition"
---
Injects a raw CSS stylesheet into the app; visual nodes opt in via their cssClassName input.

CSS Definition adds the stylesheet in its `style` parameter to the running app. It has no outputs and needs no connections — its presence is its effect. Selectors take effect wherever visual nodes carry the matching `cssClassName`, unlocking what node parameters cannot express: pseudo-classes, keyframe animations, media queries, child selectors.

## When to use it

The escape hatch for real CSS. Prefer node style parameters wherever they suffice — the editor can inspect and vary those, while CSS effects are invisible to it. Keep one or few definition nodes per project rather than scattering fragments.

## At a glance

| | |
|---|---|
| Category | CustomCode |
| Type name | `CSS Definition` |
| Available in | browser |
| SSR compatibility | safe |
| Provided by | `noodl-viewer-react` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `style` | String | `` | CSS added to the page for as long as this node exists, and removed with it |

## Watch out for

- Recreating per-node styling (colors, margins) in CSS — you lose variants, visual states and editor visibility for no gain.

## Examples

**CSS Definition: project stylesheet applied via class names**

CSS Definition injects the stylesheet in its `style` parameter into the page — it has no output ports; its presence is its effect. Visual nodes opt in through their `cssClassName` input. Use it for what node parameters cannot express (pseudo-selectors, keyframe animations, media queries); prefer node style parameters for everything they can express, since the editor cannot inspect CSS effects.

**Markdown with a stylesheet of your own**

The Markdown module renders a string as a document, and this wraps it in the two things the raw node leaves to you: a `CSS Definition` scoped to the surrounding `Group`, so headings and lists inherit the project's type scale instead of the browser's defaults, and a `Component Inputs`/`Component Outputs` pair that makes the whole thing one reusable part rather than a node you re-style at every call site. The `States` node switches the stylesheet — that is how a light and a dark rendering of the same document stay one component.

**Load a rich-text editor from a CDN at runtime**

The interesting node here is the one that loads nothing visual: a `JavaScriptFunction` that injects a `<script>` tag and resolves once it has loaded, so the editor library arrives at run time rather than being bundled. That is the pattern to take away — it is how any large third-party library gets into a NodeGX app without inflating the build. The `Javascript2` node then mounts TinyMCE onto a `Group`'s element, a `CSS Definition` reconciles the editor's chrome with the project's tokens, and `Cloud File` plus `NewDbModelProperties` give pasted images somewhere to live. ⚠️ `tinymce-api-key` is a `String` node holding an empty value — TinyMCE's CDN build wants your own key, and this graph deliberately does not carry one.

## Related nodes

[Group](../visual/group.md), [Text](../visual/text.md), [Button](../visual/net-noodl-controls-button.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
