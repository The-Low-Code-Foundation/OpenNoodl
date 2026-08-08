# 01 — Think in components first

## The failure this prevents

Given "build me an ecommerce home page", a model does the natural thing: it starts at the top of the
page, creates a header, then a hero, then a product grid, deciding each section's nodes as it reaches
it. The result renders. It is also one enormous graph with nothing reusable in it, where the same
card exists three times, where changing the footer link style means editing it in four places, and
where the second page cannot share a single thing with the first.

That is not a NodeGX problem. It is what happens in any framework when you write markup before you
decide components. The difference is that in React the file boundary nags you into factoring, and in
a node graph nothing does — a 400-node canvas looks the same as a 40-node one until you try to change
it.

## The method

**Before creating any node, write the component tree.**

1. **Name the sections as a developer would.** Top bar, hero, info cards, product grid, category
   browser, footer. If you would give it a name out loud, it is a component.
2. **Inside each section, name the repeating unit.** Menu item, info card, product card, footer link.
   These are the leaf components, and they are the ones that matter most — everything else assembles
   them.
3. **For each leaf, decide what varies per instance.** That list *is* the component's input
   interface. Label, icon name, destination, price, whether the rating is shown. Anything that
   varies goes in; anything constant stays inside the component.
4. **Decide what each component reports upward.** A click, a submitted value, a selection. These are
   the component's outputs — usually signals.
5. **Only now** work out which nodes go inside each component.

Build order follows: **leaves first, then sections, then the page.** A page assembled from finished
components is a short list of instances. A page built the other way round is a column of nodes with
no seams in it.

## What a finished page component looks like

Roughly this, and roughly this size:

```
/Pages/Home            (Page)
  └ Page canvas        (Group)
      ├ /Components/SiteHeader
      ├ /Components/Hero
      ├ /Components/InfoCardRow
      ├ /Components/FeaturedProducts
      ├ /Components/CategoryBrowser
      └ /Components/SiteFooter
```

Eight nodes. Every one of the interesting decisions lives one level down, where it can be changed
once and be right everywhere. If your page component is past ~25 nodes it wanted to be several; the
storefront that prompted this folder reached **66**.

## The interface is the design work

The temptation is to make a component that hardcodes its content and then copy it. The discipline is
to decide what varies and expose exactly that:

- **Text is an input, not a literal.** A `Title` component takes its words through a Component Input,
  so the same component sets every title on the site and the type ramp is defined once.
- **Style is an input where it legitimately varies.** A colour chosen from the project's tokens,
  passed in, beats a second near-identical component.
- **Optional content is an input too.** A product card should take `showRating`, because a product
  with no reviews yet must not render an empty row of stars. Anything that can be absent in the data
  — a tagline, a tag list, a discount, a badge — needs a way to not be drawn. See
  [02](02-DATA-DRIVEN-REPETITION.md) for the mechanism, which costs no logic nodes.
- **Mounting is an input.** `mounted` lets a parent remove a component entirely rather than hide it.

A component whose interface says nothing about what varies is a component that will be copied.

## When something is NOT a component

The rule cuts both ways, and over-factoring is its own mess:

- A single node is not a component.
- An unnamed wrapper Group used once is not a component — it is a file and a hop that bought nothing.
- A two-node group used once is not a component.

The signal is repetition or naming: **if it repeats, or if you would say its name out loud, factor
it.** Otherwise leave it inline.

## Pages, and the other kind of page

A page component is only reachable if a `Router` (Page Router) lists it in its `pages` parameter, and
it renders blank without a `Page` node at its root.

There is a second pattern worth knowing, because it is often the better one for an app-like flow: a
`Page Stack` (Component Stack) holds ordinary **visual components**, pushed with
`PageStackNavigate` and popped with `PageStackNavigateBack`. These are not `Page` components and do
not need routes. Use the Router when the screens deserve URLs (a storefront, a docs site); use a
Component Stack when they are steps in a flow (a wizard, a drill-down, a modal stack), where a fade
between pushes is part of the design.

## The checks behind this document

- `repeated-sibling-subtree` — three structurally identical siblings is a **validation warning**.
  Make one component and instantiate it, or drive a Repeater.
- `PageWithoutPageNode`, and the Router registration rules — a page nothing can reach is not a page.

Prose is not the enforcement. If you find yourself arguing with one of these warnings, the argument
is almost always "but it was faster to duplicate it", which is the thing the warning exists to catch.
