# The storefront brief — the calibration fixture

**Why this file exists:** phase 54's reference build was driven interactively through a persistent
MCP session and nobody recorded the prompt. "Replay the brief cold" was therefore an instruction
with no brief. This is the canonical text; every phase-55 replay uses it verbatim, so runs are
comparable across models and across time.

It is written in the voice of a user, deliberately says nothing about components, repeaters,
`Columns` or any other mechanism, and does not enumerate an architecture — deciding that is the
thing under test. It is calibrated against
`dev-docs/best-practices/05-WORKED-EXAMPLE-STOREFRONT.md`, which is the reference answer: every
section named below corresponds to a piece of Richard's own decomposition.

---

## The brief (give this to the model verbatim)

> Build the home page for **Kiln & Co.**, a small independent shop selling small-batch ceramics,
> coffee and home goods.
>
> The page needs:
>
> - A top menu bar with the shop's name, links to the main sections (Shop, Ceramics, Coffee,
>   About), a search control and a basket icon with an item count.
> - A hero introducing the shop, with a photo, a headline, a line of supporting text and a couple
>   of calls to action.
> - A strip of short info items — free delivery over £40, 30-day returns, secure checkout — that
>   sort of thing.
> - A featured products section showing a handful of products: photo, name, short description,
>   price. Some products are discounted from a higher price, some are best sellers, and some have
>   no reviews yet.
> - A browse-by-category section — Ceramics, Coffee, Home — where each category shows how many
>   pieces are in it.
> - A footer with Shop / Company / Help link columns and a copyright line.
>
> It should look properly designed — real shop, not a template — and it must work on a phone as
> well as a desktop. When something is clicked it should go somewhere sensible or say what it
> would do.

## Protocol for a cold replay

1. Mint a fresh project with `create_project` (name "Kiln & Co.", the brief as `request`, nothing
   else — no pages, no objects, no conventions; scoping is part of what is under test).
2. Serve it: `node packages/noodl-mcp/bin/noodl-mcp.js <project-dir> --allow-writes`.
3. Give the model the brief plus only: *"Build this in the NodeGX project using the NodeGX MCP
   tools. The project is already created and the server is connected."* No architecture hints, no
   tool walkthrough, no operator corrections mid-run.
4. Let it finish or stall. Do not rescue it; a stall is data.
5. Score the artefact, not the transcript (see below).

## Scoring — architecture first, taste second

Mechanical checks (run them, do not eyeball):

| Check | Instrument | The reference answer's value |
|---|---|---|
| Components created, and the page's own node count | `components/_registry.json` + node census | ~20 components; page ≈ 6–8 instances (best-practices 01) |
| Repeated sibling subtrees | `npm run validate:project` | 0 warnings |
| Data-driven repetition | count of `For Each` + `Static Data`/`DbCollection2` vs hand-laid trios | every list is a Repeater |
| Anything multi-column that can collapse | count of `net.noodl.visual.columns` vs multi-child row Groups | every grid/row that must reflow is a `Columns` |
| Interaction | hover states / `States` nodes on clickable things; click signals as Component Outputs | per best-practices 03 |
| Optional data has a "not drawn" path | `visible`/`mounted` wired from data (discount, badge, zero count) | per best-practices 02 |
| Renders, and survives 390px | `render-from-disk.js` + headless Chrome: `scrollWidth <= innerWidth`, fontWeight set > 1, grid items narrower than container | all pass |

Then classify every failure as **knowledge / ordering / capability / seam** (README §A). A model
that never called `list_examples` did not fail to know `Static Data` — it failed to be told the
tool existed at the moment it mattered; read the transcript before classifying.
