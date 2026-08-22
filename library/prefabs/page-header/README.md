# Page Header

A standard page header in one component: an `<h1>` title, an optional
subtitle, a data-driven breadcrumb trail and a right-aligned **actions slot**
for page-level buttons.

## How to use it

1. Place the **Page Header** component at the top of a page.
2. Wire (or type) the **Title**. That is the whole minimum setup.
3. Optionally feed **Breadcrumbs** an array and **Subtitle** a string, and
   drop your action buttons inside the instance (see *The actions slot*).

## Inputs

| Port | Type | Meaning |
|---|---|---|
| `Title` | string | Page heading, rendered as an `<h1>`. Defaults to "Page title" |
| `Subtitle` | string | Secondary line under the title. Hidden entirely until a non-empty string arrives |
| `Breadcrumbs` | array | Array of `{label, target}` objects, first-to-last. Empty or unconnected hides the breadcrumb row |

### Breadcrumb data shape

Each item is an object with two string properties:

- `label` — the text shown for the crumb
- `target` — an opaque value **you** choose (a page path, a component name, an
  id). The prefab never interprets it; it only hands it back on click.

Feed it from a **Static Array** node, a Function node, or any array output:

```json
[
  { "label": "Home",     "target": "/Pages/Home" },
  { "label": "Projects", "target": "/Pages/Projects" },
  { "label": "Settings", "target": "/Pages/Project Settings" }
]
```

Separators (`/`) are drawn between crumbs automatically. The **last crumb is
inert**: it renders in the foreground colour, gets no separator after it, and
clicking it does nothing — it is the page you are already on.

## Outputs

| Port | Type | Fires when |
|---|---|---|
| `Crumb Clicked` | signal | The user clicked any crumb **except the last** |
| `Crumb Target` | string | That crumb's `target` value; set before `Crumb Clicked` fires |

Wire `Crumb Clicked` into a Navigate node (or your own routing logic) and read
`Crumb Target` to decide where to go. Internally the click travels from the
repeated crumb item to the header on a parent-propagated event channel named
`Page Header Crumb`, so multiple Page Header instances do not cross-talk.

## The actions slot

The right side of the header is a **slot**: the component contains a
*Component Children* node inside the right-aligned "Actions slot" group, so
whatever you place **as children of the Page Header instance** in your own
page tree renders there. In the editor, just drag your buttons onto the placed
Page Header node so they nest under it — they will lay out in a horizontal
row, vertically centred, at the right edge of the header. No children, no
slot: the group collapses and the title keeps the full width.

## Styling

All colours are design-token references, so the header follows the project's
theme: `var(--foreground)` for the title and the inert last crumb,
`var(--muted-foreground)` for the subtitle, clickable crumbs and separators.
The title uses the shipped Inter Medium font (text style "Title Large",
24px); the subtitle and crumbs use the project's default text settings. To
change the separator glyph (e.g. to `›`), edit the *Separator* Text node
inside `/Page Header/Breadcrumb`.
