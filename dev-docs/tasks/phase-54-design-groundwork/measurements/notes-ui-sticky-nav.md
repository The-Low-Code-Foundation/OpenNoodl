# `ui-sticky-nav` — what was built, and what the render said

**DSG-003 §3, recipe 1 of 5.** Authored 2026-08-11. One file:
`docs/node-catalog/examples/ui-sticky-nav.json` — 23 nodes, 0 connections, 0 interface ports.

## The question that had to be answered first

The spec's named trap is *"position/stacking on a canvas with no CSS positioning ports — check what
is actually authorable before specifying it."* It is authorable, and the seam is smaller than it
looks.

| Fact | Source |
|---|---|
| Every visual node has a `position` port with **`relative` / `absolute` / `sticky` / `fixed`** | [`node-shared-port-definitions.ts:536-558`](../../../../packages/noodl-viewer-react/src/node-shared-port-definitions.ts) (`addAlignInputs`), applied to Group at [`group.ts:497`](../../../../packages/noodl-viewer-react/src/nodes/visual/group.ts) |
| There is **no `top`/`left`/`right`/`bottom` port anywhere.** The inset is written by `alignX`/`alignY`: for any position that is not `relative` they *default* to `left`/`top`, and that is what emits `left: 0` / `top: 0` | [`layout.ts:112-206`](../../../../packages/noodl-viewer-react/src/layout.ts) — `align()`, lines 119-122 and 128-136, 166-174 |
| `zIndex` is a first-class port | [`node-shared-port-definitions.ts:230-244`](../../../../packages/noodl-viewer-react/src/node-shared-port-definitions.ts) |
| A Group can be a scroll container — `scrollEnabled` + `nativeScroll` → `overflowY: auto`; `clip` → `overflow: hidden` | [`group.ts:191-246`](../../../../packages/noodl-viewer-react/src/nodes/visual/group.ts), applied at [`Group.tsx:311-326`](../../../../packages/noodl-viewer-react/src/components/visual/Group/Group.tsx) |
| The page itself scrolls when `settings.bodyScroll` is on; the wrappers are unclipped flex columns | [`viewer.jsx:333-350`](../../../../packages/noodl-viewer-react/src/viewer.jsx) |

So the answer is **yes, and the recipe stands** — but the vocabulary is `position` + `alignY` +
`zIndex`, and *nothing else*. Anything a designer would reach for next (a gap above a stuck band, a
nav that hides its links on a phone) is either not expressible or needs the one breakpoint the
runtime owns, `net.noodl.visual.columns`.

## The arrangement

`/Pages/Example`: `Page` → page column (`sizeMode: contentHeight`, so the document scrolls) →
`[nav, band_a, band_b, band_c]`.

The nav is a `Group` with `as: "header"`, `position: "sticky"`, `alignY: "top"`, `zIndex: 10`,
`sizeMode: "contentHeight"`, an opaque `--surface` fill and a `--border-1` hairline underneath. It
holds one shell (`width: 100%`, `maxWidth: 1200px`, `flexWrap: "wrap"`,
`justifyContent: "space-between"`) carrying brand / three links / a `Sign in` button. The three
bands below it are the thing that scrolls, and each one's body copy states one of the measured
rules, so the render *is* the documentation.

## The measurement

Harness: `example-to-project.js` → `npm run render:report`, plus a scratch CDP probe
(`probe.js`, kept in the session scratchpad) that scrolls the document and re-reads the band's
viewport rect. **`render:report` alone cannot decide this recipe** — it reads the page at
scrollTop 0, where a stuck band and a not-stuck band are pixel-identical.

`render:report -- <proj> --viewports desktop,phone` on the shipped file:

```
ui-sticky-nav — Rendered clean: desktop 1280×1205px, 12 texts, 10 on screen, 0 images;
                                phone   390×1655px, 12 texts,  9 on screen, 0 images.
  desktop 1280px → layout 1280px, page 1205px, 12 texts / 6 sizes / weights 400+500+600, 0 placeholders
  phone    390px → layout  390px, page 1655px, 12 texts / 6 sizes / weights 400+500+600, 0 placeholders
```

The stuck/not-stuck reading, which is the one that matters:

| Viewport | scrollTop | band rect top | band height | computed |
|---|---|---|---|---|
| 1280×900 | 0 | 0 | 57px | `position: sticky`, `top: 0px`, `z-index: 10` |
| 1280×900 | **305** of 1205 | **0** | 57px | same |
| 390×844 | 0 | 0 | 85px | same |
| 390×844 | **811** of 1655 | **0** | 85px | same |

`elementFromPoint` at the band's centre returns a node *inside* the `<header>` at every scroll
position, so it is on top as well as in place. No clipping ancestor exists between the band and the
document (`overflow` is `visible` the whole way up).

## The counter-builds — nine variants, each rendered and scrolled

Every claim in the recipe's `description` is one of these rows. All at 1280×900 unless noted.

| # | Change | Result | Verdict |
|---|---|---|---|
| **B** | `clip: true` on the page column | at scroll 305, band top **−305** — scrolls away, one `overflow: hidden` ancestor, **no error anywhere** | ✅ claim holds |
| **C** | nav wrapped in a Group only as tall as the nav | band top **−305** — sticks inside its *parent's* box, and that box has already gone | ✅ claim holds |
| **D** | `alignY: "center"` | computed `top: **450px**` (50% of the 900px viewport); band parks at 422px down the screen and **never reaches the edge** | ✅ the sharpest one |
| **E** | `alignY` removed entirely | identical to the shipped file — top 0 | ⚠️ `alignY` is **redundant**; it is declared as documentation, not necessity |
| **F** | `zIndex` removed | geometry still perfect (top 0) but `elementFromPoint` at the band's centre returns a node **outside** the header — the section text draws through the band and takes the clicks. Screenshot: two paragraphs overprinted | ✅ and it is *invisible to geometry* |
| **G** | `marginTop: var(--space-4)` added | resting top **16**, stuck top **0** — the margin moves where it sits, not where it sticks | 🔴 **refutes** the first draft |
| **H** | `position: "fixed"` | page **1148px** vs 1205px — exactly one band (57px) shorter, first section starts under the nav | ✅ claim holds |
| **I** | `flexWrap` removed | phone layout viewport forced to **463px** for a 390px request; `render:report` reports `minimum-layout-width` | ✅ the wrap is load-bearing |
| **J** | `sizeMode: "contentHeight"` removed from the band | **no change at all** — still 57px | 🔴 **refutes** the first draft |

## What did NOT work — two claims I wrote before I measured them

Both were in the first draft of the `description`, both were plausible, and both were **false**.
They are the whole reason §2's first rule exists.

1. **"Without `sizeMode: contentHeight` the sticky band renders full-page-tall — 1420px instead of
   57px."** I reasoned it from [`layout.ts:102-109`](../../../../packages/noodl-viewer-react/src/layout.ts): a
   non-relative node skips the percentage→`flexGrow` conversion, so the port default of
   `height: 100%` ([`node-shared-port-definitions.ts:831-847`](../../../../packages/noodl-viewer-react/src/node-shared-port-definitions.ts))
   should be taken literally. **Variant J measured 57px.** The reasoning was right and the
   conclusion was wrong: the page column is `sizeMode: contentHeight`, so its height is indefinite,
   and a percentage height against an indefinite parent resolves to `auto`. The number 1420 was
   invented. *It would* bite under a page column with a definite height — but that is not this
   recipe, and the recipe does not claim it.
2. **"A margin on the same edge is what moves the band off the edge."** True for `absolute` — it is
   how `ui-card-grid-repeater` insets its badge — and **false for `sticky`**. Variant G: resting top
   16, stuck top 0. The inset positions the border box; the margin only moves the resting place. So
   **a sticky band with a gap above it is not expressible in this vocabulary at all.** The recipe
   now says that, and says to put the gap inside the band.

Also rejected on measurement rather than taste:

- **Three nav links plus brand plus a CTA does not fit 390px** — 463px of content in a 390px
  viewport. Fixed by `flexWrap: "wrap"` on the shell, which puts the CTA on a second line and grows
  the band 57 → 85px. The alternatives were dropping a link (fits at ~350px, but teaches "keep your
  nav short") and rebuilding the shell as a `Columns` with a `smallBreakpoint` (the only real
  breakpoint in the runtime — `ui-icon-feature-strip` established that no Group has one), which
  collapses the nav to three stacked rows. Wrap is the smaller, more general answer.
- **`alignX: "right"` on the CTA** would right-align it on the wrapped phone line, because
  [`layout.ts:146-148`](../../../../packages/noodl-viewer-react/src/layout.ts) turns it into
  `marginLeft: auto`. Rejected: the auto margin eats all the free space on the desktop line too, and
  the centred link row (measured at 523–749px in a 1200px shell, centre 636 of 640) is worth more
  than tidying a single wrapped button.

## Deliberate omissions

- **No `Component Inputs`, no connections.** This is an arrangement recipe, like
  `ui-page-shell-bands` and `ui-empty-state`. Making the nav a reusable component with a
  `currentPage` input would add an interface the recipe does not exist to teach and risk the
  `interfaceless-instance` finding. Consequently the §2 port-direction trap has no surface here and
  `component-port-direction` is trivially clean on this file.
- **No navigation wiring.** `navigate-on-click`, `nav-url-product-page` and `nav-page-stack-push-pop`
  already own that; duplicating it would break the "no recipe duplicates a wiring example" rule.
  `ui-card-grid-repeater` already demonstrates `position: "absolute"` (its badge); this file is the
  only one that touches `sticky`.
- `demonstrates` stays a list of **node type names**, because
  [`catalog.ts:422`](../../../../packages/noodl-mcp/src/catalog.ts) matches it exactly against a type
  name to cite examples from `get_node_type`. The trap wording lives in the `title` and
  `description`, which `catalog.ts:501` folds into the free-text search haystack — so a search for
  "sticky", "position", "zIndex" or "clip" finds this recipe.

## Gates

```
validate-examples.ts --dir <isolated>   1/1 examples validate clean (strict, warnings-as-errors)
validate-token-references.ts            505 references across 68 files all resolve (182 tokens)
render:report                           Rendered clean, both viewports, 0 placeholders, 0 broken images
```

## Findings for the phase

1. 🔴 **`render:report` cannot decide a scroll-dependent recipe.** It reads at scrollTop 0. A sticky
   band and a static one are byte-identical there, and the report would have said *Rendered clean*
   for variants B, C, D and F — three of which are dead and one of which is illegible. Any future
   recipe about scroll, sticky, `visible`-on-scroll or a scroll container needs a scrolled read.
   The scratch probe is ~140 lines and reuses `render-report.js`'s exported `checkPrerequisites` /
   `freePort` / `RENDER_SCRIPT`; it is worth promoting into `scripts/devtools/` if a second recipe
   needs it. **Not filed as a defect** — it is a gap in the harness's reach, not a bug.
2. 🔴 **A correct geometry can still be an invisible defect.** Variant F's band is at top 0, full
   width, opaque, and computed `position: sticky` — and unreadable, because the sibling bands are
   `position: relative` (Group's `defaultCss`, [`group.ts:30-34`](../../../../packages/noodl-viewer-react/src/nodes/visual/group.ts))
   and later in DOM order, so they paint over it without a `zIndex`. Every rect-based measurement
   passes. Only `elementFromPoint` or a human eye catches it. **`zIndex` on a sticky band is
   structural, and an AI author that treats it as styling will ship variant F.**
3. ⚠️ **Two of my own pre-measurement claims were false** (variants G and J), both derived by
   reading the runtime source correctly and then reasoning one step too far. §2's rule caught both.
   The second one — margins do not offset a *stuck* position — is a genuine hole in the vocabulary
   worth knowing: **there is no way to author a sticky band that floats below the top edge.**
4. ⚠️ **The corpus has no way to say "hide this below 700px".** `Columns`'s `smallBreakpoint` is the
   runtime's only breakpoint, and it collapses columns; it cannot hide a child. Every nav on a phone
   therefore either wraps, stacks, or overflows. If phase 54 wants real mobile navs, that is a node
   library gap to file, not a recipe to write.
