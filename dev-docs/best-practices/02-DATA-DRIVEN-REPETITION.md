# 02 — Data-driven repetition: a Repeater over JSON, never siblings

## The rule

> **You never have three components as siblings. You have a Repeater and a Columns, and that is it.**

Three menu items, three info cards, four footer links, six category tiles — none of these are three
things. They are one thing and a list. The list is data, and it belongs in a data node, not in the
shape of the graph.

## The mechanism, which is easy to miss

The piece most people never find is **`Static Data` (displayed as "Static Array")**: a node that
holds inline JSON authored right there in the editor and emits it as an array of objects. That is
the whole "define the repeater items as JSON" pattern, and it needs no backend, no fetch and no code.

```
Static Data  ──items──▶  For Each (template: /Components/MenuItem)
```

The `For Each` instantiates its template once per row, and each row's properties arrive at the item
component through **Component Inputs whose names match the JSON keys**. So a JSON row of

```json
{ "label": "Ceramics", "icon": "cup-soda", "destination": "/Pages/Ceramics", "badge": "" }
```

drives a `MenuItem` component with inputs named `label`, `icon`, `destination` and `badge`. Adding a
fifth menu item is one line of JSON. Adding it as a fourth sibling is a subtree, a set of
connections, and a promise to remember this place next time the styling changes.

Where the data legitimately lives elsewhere, the same shape holds with a different source:
`DbCollection2` (Query Records) for a backend collection, `Variable` for something app-wide, an
`Array` node for something built at runtime. **The item component does not know or care which.**

## Put everything the item needs in the row

The row is not just the label. It is every decision that varies:

- the words, and any secondary words
- the icon name
- the navigation destination
- whether an optional part is drawn at all
- which of the project's colour tokens this instance uses

This is the difference between a Repeater that saves duplication and one that only saves *some* of
it. If the third card is meant to be the accent colour, that belongs in the row, not in a fork.

## Optional content: falsiness is free conditional rendering

Real data has holes. A product with no reviews, no discount, no badge, no tagline. If the component
draws those unconditionally you get an empty pill on every card and a bare `£` where a price should
be — which is exactly what the reference storefront did, thirteen empty boxes, until it was measured.

**Wire the field straight into a Group's `visible` port.** An empty string and a `0` are both falsy,
so the chrome hides itself:

```
Component Inputs ──badge──▶ Badge group . visible
Component Inputs ──badge──▶ Badge label . text
Component Inputs ──compareAtPrice──▶ Was-price group . visible
```

No logic node, no branch, no expression. Where the element should be removed from the tree entirely
rather than merely hidden, use `mounted` instead of `visible`.

## Counts, and the numbers that come from queries

A category tile showing "14 pieces" should not carry a hardcoded 14. Give the tile a `count` input,
feed it from a query filtered by that row's own value, and hide the label when the count is 0 —
falsiness again. Then check the thing everyone forgets: **that the tile still looks right at three
digits.** A number that is fine at "9" and breaks the layout at "148" is a bug that ships, because
the seed data was small.

## Why this matters more in NodeGX than in code

In React, three copies of a component are three lines that a reviewer sees at once. In a node graph
they are three subtrees that look, on a canvas, like the page you were trying to build — so the
duplication is invisible at exactly the moment it is being created. That is why this rule is
enforced by a check (`repeated-sibling-subtree`) rather than left to judgement.

## The shape to reach for, every time

```
Section component
  └ Columns  (folds 4 → 2 → 1; see 04)
      └ For Each  (template: the leaf component)
            ▲
        Static Data / Query Records / Variable
```

One leaf component. One list. One layout node that reflows. Nothing to duplicate, nothing to keep in
sync, and one place to change when the design does.
