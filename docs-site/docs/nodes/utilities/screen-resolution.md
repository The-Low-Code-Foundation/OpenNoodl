---
title: "Screen Resolution"
---
Outputs the browser viewport's width, height and aspect ratio, updating live on every window resize.

Screen Resolution reports the size of the browser viewport — despite the name it reads window.innerWidth/innerHeight, not the physical screen. `width` and `height` are levels in CSS pixels, `aspectRatio` is width divided by height, and all three update automatically whenever the window resizes (including device rotation). The node has no inputs.

## When to use it

Use it to drive responsive logic in the graph: feed `width` into an Expression or Condition to produce breakpoint booleans ('narrow layout?') that control visibility or layout inputs. For purely visual responsiveness, prefer the built-in sizing/variants of visual nodes; reach for this node when logic must know the viewport size.

## At a glance

| | |
|---|---|
| Category | Utilities |
| Type name | `Screen Resolution` |
| Available in | browser |
| SSR compatibility | client-only — The viewport size is unknowable server-side; width/height stay unset until the browser runs. |
| Provided by | `noodl-viewer-react` |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `aspectRatio` | Number | — | Width divided by Height, so anything wider than it is tall is greater than one |
| `height` | Number | — | Height of the browser viewport, in pixels |
| `width` | Number | — | Width of the browser viewport, in pixels |

## Patterns

- `width` → Expression `width < 600` → a Group's or Text's `visible`: show compact-layout elements only on narrow viewports.

## Examples

**File picker with a shared accent color and a viewport-aware hint**

Three utility shapes in one small screen. A Color node is the single source of truth for the accent: its savedValue fans out to the title's text color and the button's background, so one edit restyles both. The Button's onClick fires Open File Picker's open — the dialog must come from a user gesture — and after a pick the file's name flows into a Text while `done` latches a Boolean (value pinned true) that reveals the result row as a level; closing the dialog with nothing chosen reports `unchanged` instead. Screen Resolution's width feeds an Expression (width < 600) whose boolean drives the compact hint's visibility, updating live as the window resizes.

## Related nodes

[Expression](../custom-code/expression.md), [Condition](../logic/condition.md), [States](../animation/states.md), [Group](../visual/group.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
