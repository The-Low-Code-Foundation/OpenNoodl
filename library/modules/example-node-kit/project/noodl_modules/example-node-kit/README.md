# Example Node Kit

A NodeGX node kit: custom nodes written in plain JavaScript, living in this
project, usable exactly like built-in nodes.

There is no build step. No npm install, no bundler, no SDK. `index.js` is
loaded by the runtime as-is, and React arrives as a global before it runs — on a
server render as well as in a browser.

## Try it

1. Reload the preview (the kit is loaded when the project's runtime starts).
2. Open the node picker and search for **Stat Tile**.
3. Drop it on a canvas. Every port below is already on it, already on the
   project's design tokens.

## The rule this kit is written to

> **Ports are the product. JavaScript is the escape hatch.**

Every decision an app builder should own is a port. Colour, spacing, radius,
font size — and, the one that is easy to get wrong, **every threshold**.

`Stat Tile` has a `Highlighted` input and no opinion whatsoever about when
it should be true. That is deliberate. The obvious shortcut is:

```js
// DON'T. This is the mistake this kit exists to not teach.
color: props.value > 1000 ? 'red' : 'inherit'
```

Now the number `1000` and the colour `red` live in a JavaScript file. They are
invisible on the canvas, they cannot be changed per instance, they cannot be
driven by data, and changing either means editing code and reloading.

Wire it in the graph instead:

```
  Static Data / Record  ──value──▶  Expression                 Stat Tile
                                    "value > threshold"  ──▶  Highlighted
                                                              Highlight Colour ← var(--destructive)
```

Now the threshold is a port on a node anybody can see, the colour is a token,
and both are editable without opening an editor. That is the whole argument.

**The same rule applies to formatting.** `Value` is a string: turn 1234.5 into
"£1,234.50" in a Function or Expression node, where the format is visible and
reusable, rather than inside `getReactComponent`.

## Design tokens, not hex

Every colour and spacing port defaults to a `var(--token)` from the project's
design system, so a node from this kit matches the app it is dropped into and
follows the theme when it changes. Raw hex and px still work — brand colours
and data-viz palettes are legitimate — but the default is the system.

## Ports

| Port | Where | Type | Default | Notes |
|---|---|---|---|---|
| `label` | inputProps | string | `'Revenue'` | The tile’s caption. |
| `value` | inputProps | string | `'—'` | The figure to show. Format it in the graph, not here. |
| `highlighted` | inputProps | boolean | `false` | Whether to draw the value in the highlight colour. **The rule that decides this belongs in the graph** — see the README. |
| `backgroundColor` | inputCss | color | `var(--surface-raised)` | The tile’s background. |
| `color` | inputCss | color | `var(--foreground)` | Default text colour, inherited by both lines. |
| `borderColor` | inputCss | color | `var(--border)` | Border colour. |
| `borderWidth` | inputCss | length | `var(--border-1)` | Border width. |
| `borderRadius` | inputCss | length | `var(--radius-md)` | Corner radius. |
| `padding` | inputCss | length | `var(--space-4)` | Inner padding. |
| `gap` | inputProps | length | `var(--space-1)` | Space between the label and the value. |
| `labelSize` | inputProps | length | `var(--text-sm)` | Label font size. |
| `valueSize` | inputProps | length | `var(--text-2xl)` | Value font size. |
| `labelColor` | inputProps | color | `var(--muted-foreground)` | Label colour. |
| `highlightColor` | inputProps | color | `var(--primary)` | Colour the value takes when `Highlighted` is true. |
| `onClick` | outputProps | signal | — | Sent when the tile is clicked. |

**`inputProps` vs `inputCss`** is a real distinction, not bookkeeping:
`inputCss` styles *this node's own box* and the runtime writes it to the DOM;
`inputProps` hands a value to the React component for the elements it draws
itself. Inner text colour has to be an `inputProp` — there is no other route
to it.

## Adding a node

1. Write a second definition object in `index.js`, annotated the same way.
2. Give it a `name` under this kit's prefix — `example-node-kit.YourNode` — so two
   kits in one project can never collide.
3. Add it to `kit.reactNodes`.
4. Reload the preview.

## Autocomplete

`types/node-kit.d.ts` is a copy of `@nodegx/node-kit-types` (version
1.0.0), written here by the scaffold. The `@type` annotations in
`index.js` reach it by relative path, which is what makes autocomplete work with
no `node_modules` and no `tsconfig.json`.

It is a copy because it has to be: a bare package specifier does not resolve
inside a folder with no `node_modules`, and adding one would mean an install
step this kit is specifically designed not to need.

Editing that file changes nothing the runtime enforces — it describes the shape
the runtime already expects, it does not check it.

## Files

| File | What it is |
|---|---|
| `manifest.json` | How the runtime finds the kit. `main` points at `index.js`. |
| `index.js` | The node definitions. Loaded as-is. |
| `types/node-kit.d.ts` | The definition types, for autocomplete only. |

The node type this kit registers is `example-node-kit.StatTile`.
