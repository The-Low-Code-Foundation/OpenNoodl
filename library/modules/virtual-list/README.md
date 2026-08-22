# Virtual List

Windowed rendering for big arrays. A `Repeater` builds a DOM element per item,
which becomes a real ceiling around ten thousand rows; the **Virtual List**
node keeps only the rows that intersect its viewport (plus an overscan margin)
in the DOM — an absolutely-positioned window over a full-height spacer, so the
scrollbar range is honest while the element count stays tiny.

The module registers one visual node, **Virtual List** (`nodegx.virtuallist`),
and ships a demo component (`Virtual List Demo`) wired to 10,000 generated
rows.

## Inputs

| Port | Meaning |
|---|---|
| **Items** | The array to render. Plain JS arrays and Noodl arrays both work. |
| **Row Template** | Text template for each row — see the contract below. Default `{{value}}`. |
| **Item Height** | Fixed row height in px (default 40). Every row is this tall — the windowing math depends on it. Variable-height rows are out of scope. |
| **Overscan** | Extra rows rendered above and below the viewport (default 6) so fast scrolling does not flash blank rows. |
| **Use Container Size** | When on, the list fills its parent's height (put it in a group with a set height). When off, **Height** applies. |
| **Height** | List height in px (default 400) when Use Container Size is off. |

## Outputs

| Port | Meaning |
|---|---|
| **First Visible Index** | Index of the first row intersecting the viewport (overscan not counted). |
| **Visible Count** | Number of rows intersecting the viewport. |

Scrolling reads `scrollTop` directly off the element in the scroll event — no
smooth-scroll animation — so the outputs and the rendered window always match
the real scroll position.

## The row contract — a template string, deliberately

Each row renders **one line of text**, produced from the Row Template by
`{{field}}` substitution:

- `{{name}}` — the item's `name` property (dotted paths work: `{{user.email}}`;
  Noodl Objects are read through their data).
- `{{index}}` — the row's absolute index in Items.
- `{{value}}` — the item itself, when Items holds primitives (strings, numbers).
- A missing field substitutes as empty text. Output is plain text, never HTML.
- An empty template falls back to showing the item itself.

Example, for `{ name, email }` items:

```
#{{index}}  {{name}} — {{email}}
```

This is the simplest honest contract for a windowed list: rows are text, so
the node never pretends to host arbitrary content. A full **component-per-row**
contract (each visible row instantiating a project component, like Repeater
does) is a known follow-up, not something this version half-does.

## Post-install

No keys, no setup. Drop the **Virtual List** node into a visual tree, connect
an array to **Items**, set **Item Height** to your row height, and write a
**Row Template**. Row separators use `var(--border)` and text inherits the
surrounding color, so the list follows your project's theme tokens.
