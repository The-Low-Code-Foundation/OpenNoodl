# LAS-012 — The repeater contract gate

**Status:** ✅ **DONE** (2026-08-08, session 7) · **Track 1 (gates)** · out of LAS-011's session-6
runs (**F38**, with **F41** as a small rider)

> ## What shipped, and the premise that was wrong
>
> Three commits: `ebfa578d` (§1–2, the gate), `85a39388` (§3, the render report), `00c59ceb`
> (§4/F41).
>
> **⚠️ The premise correction, found by reading the project off disk in the first ten minutes.**
> This document — and session 6's handover — records haiku as omitting `template` and qwen as
> nesting the item component as a child: *"the same joint, failed from opposite directions"*.
> Read off disk, **haiku did both**. All three of its repeaters nest their item content as a
> child (`/Components/ProductCard`, `/Components/CategoryCard`, and a bare `Group`). The two
> models made the *same* mistake; qwen's was caught only because its child id dangled, on an
> `invalid-argument` path that carries no recipe. That changed which code is the load-bearing one
> and made the fixture produce three `repeater-with-visual-children` errors rather than the three
> `repeater-without-template` predicted in Acceptance below.
>
> **The mechanism, verified rather than assumed.** A Repeater is not a container: `addItem` calls
> `internal.target.addChild(itemNode, index)` where `target` is the node's **parent**
> (`updateTarget(nodeModel.parent.id)`), so items are inserted as its later siblings. The `For
> Each` has no React component of its own, so anything nested under it never reaches the DOM.
> Confirmed by consequence, not by reading: `npm run render:report` on the fixture counts **0
> images** on a page whose three repeaters all carry product photography.
>
> | § | Outcome |
> |---|---|
> | §1 the check | ✅ three codes, off `authoredPreconditionDiagnostics`. `repeater-without-template` and `repeater-with-visual-children` (no template) are **errors**; `repeater-template-unresolved` and `repeater-with-visual-children` (template set) are warnings, both authored-blocking |
> | §2 the recipe | ✅ `data-static-array-filter-repeater` + `ui-card-grid-repeater` on all three codes; the `invalid-argument` hierarchy door carries the knowledge **in its message**, since that path is string errors rather than diagnostics |
> | §3 the render report | ✅ `empty-list`, **scoped** — see below. Not split out |
> | §4 F41 | ✅ fixed: a create aimed at the untouched skeleton is coerced to an update and reported |
>
> **Calibration** (`measurements/scan-repeaters.js`, both corpora, 107 legacy + 15 v2): **89 `For
> Each` in 32 projects.** 8 without a template (3 haiku's, 5 hand-built QA fixtures, **0 in the
> repo**), **0** fed by a connection into `template`, 2 unresolved in one legacy merge fixture, 3
> with children (all haiku's). **0 of the recipe library's 12 repeaters trip anything** — no F23
> repeat; the examples all teach the shape the gate wants.
>
> **§3's honest scope.** Relating a DOM element to the node that produced it is impossible today:
> the viewer stamps no node id on anything it renders and `window.Noodl` exposes only
> `_viewerReact.renderDeployed`. Both routes are viewer changes plus a bundle rebuild — a bigger
> and riskier task, and the general check ("this `For Each` produced zero children") waits for it.
> So `empty-list` relates by **content**: the graph declares a list's rows, and none of those
> strings is on the page. It probes only where the rows are knowable and unconditional — inline
> `items`, or a `Static Data` node wired **straight** in. Through a `Filter`/`Map` it abstains: a
> filter matching nothing is a legitimately empty list.
>
> Two measurements changed that design, neither predictable from the mechanism:
>
> 1. The first version found all six of haiku's missing strings on a page showing none of them.
>    `render-from-disk` injects the whole project as `window.projectData` in a `<script>` inside
>    `<body>`, so `body.textContent` contains every `items` array verbatim. It now reads the
>    visible leaf text elements only.
> 2. Matching any readable value found `"Ceramics"`/`"Coffee"` in the section's own copy and
>    `"Home"`/`"Shop"` in the nav, reporting two genuinely empty lists as rendered. A probe string
>    must now be multi-word or long, and a list with nothing distinctive **abstains**. So 1 of
>    haiku's 3 dead lists is caught here and the gate catches all three.
>
> Measured after: s6-haiku `0 errors, 1 warning` → **`2 errors`**. No false positive on
> `phase55-s6-sonnet`, `phase55-replay-sonnet` or `ecommerce-example`.
>
> **A defect the specs caught in this task's own first version:** `store.resolve` answers
> `{ key, entry }`, not a row with `.path` (that is `listComponents()`), so §4's lookup threw
> inside its `catch` and every plan silently kept its rejection. A broad catch turning a
> programming error into a negative answer — [[verify-the-consequence-not-just-the-mechanism]].
>
> **Watched failing before trusted.** The check unwired → 10/17 unit specs and 4/6 gate specs
> caught it. §3 broken both ways → 4 specs caught it. The two gate specs that stayed green are
> the accept case and the hierarchy door, which is a different mechanism.
>
> **Still open, deliberately:** `validate:project` runs `rules/` only, so **no precondition check
> reaches it** (F14) — including these three. They gate authored output at both write doors and
> the plan gate; they do not add errors to a corpus run. The fixture is pinned through the
> precondition path directly (`tests-unit/phase-55/repeaterTemplate.test.ts`), which is the only
> path that computes them.

## The defect, measured

Session 6 replayed the storefront brief cold on three models against the full LAS-001…008 stack.
Haiku's run came out **architecturally correct on every axis the phase measures** — 10 components,
7 of them declaring `Component Inputs` (15 ports), 3 repeaters, 32 connections, 3 `Columns`, zero
instance parameters with nowhere to land. And the page renders as a header, a hero, an info strip,
and then **nothing**: no featured products, no category browser, no footer links.

All three of its `For Each` nodes carry a correct inline `items` array and **no `template`
parameter**. `For Each` needs `template` (a component name beginning with `/`) or it instantiates
nothing — the node's own `failure` output documents this exactly: *"the Repeater could not rebuild —
no Items bound, no Template set, or nothing to render into."* Nothing else in the product says it
at a moment that matters.

**Three instruments, three passes, half a page:**

| Instrument | What it said |
|---|---|
| `npm run validate:project` | `0 error(s), 0 warning(s), 0 info — 88 nodes` |
| `render_report` / `npm run render:report` | `0 errors, 1 warning` (the warning is an unrelated 643px layout floor) |
| a node census | `For Each: 3` — indistinguishable from a pass |

The render report is blind here **by construction**: it checks for dead *placeholder* text and
*broken* images — content that is present and wrong. An empty repeater emits no elements at all, so
there is nothing to count. Qwen's run makes the point brutally: a page with **one** text element on
it also reported *"Rendered clean"*.

### The same joint, failed from the other direction

Qwen's transcript hit the identical contract from the opposite side — it tried to nest the item
template as a **child** of the repeater node, twice, and got:

```
Node "products-repeater" lists unknown child "product-card"
```

That is an `invalid-argument` hierarchy error, not a validation diagnostic, so it goes down a path
that carries **no LAS-007 recipe** and says nothing about what a repeater's template actually is.
Sonnet, the only model that got this right, set `template: "/Components/ProductCard"` and fed it
from a `Static Data` node.

**Both mid-tier models failed at the repeater's template contract, from opposite directions, in the
same session.** That is the single clearest signal the acceptance runs produced.

## Build

### 1. The check — a precondition, not a `rules/` rule

Verified again before writing this: `NormNode` (`validation/model.ts`) carries `id`, `type`,
`label`, `parent`, `children`, `instancePorts`, `metadata` — and **no `parameters`**. A check that
reads `parameters.template` therefore cannot be a `rules/` rule, for exactly the reason LAS-001
gives in `componentInterface.ts`'s header. It belongs beside the other precondition checks, reached
from `authoredPreconditionDiagnostics()` (`validation/authoredCandidate.ts:286`).

Proposed codes:

1. **`repeater-without-template`** — a `For Each` whose `templateType` is absent or `explicit` and
   whose `template` is unset. **Error, authored-blocking.** This is not a style opinion: the node
   cannot render, and the current silence is the whole finding.
2. **`repeater-template-unresolved`** — `template` is set but names no component in the project.
   Same class as `unresolved-component-ref`, and the same fix shape.
3. **`repeater-with-visual-children`** — a `For Each` given visual children directly. **Warning**,
   with the recipe attached: this is the mental model qwen brought, and the message must say that
   the template is a *separate component named on the `template` port*, not a child.

Calibrate every one of them against the ~95-project corpus before settling severity, per the
`repeated-sibling-subtree` precedent. ⚠️ Expect corpus hits: check the catalog examples and
`ecommerce-example` first, and if a shipped example trips this, that is F23 repeating itself — the
library teaching the shape the gate refuses — and it gets fixed in the same slice.

### 2. Attach the recipe

`data-static-array-filter-repeater` already exists and already shows the whole shape. Wire it to all
three codes through the LAS-007 attachment path, and — the part that is new — make sure the
`invalid-argument` hierarchy rejection can carry an attachment too, since that is the door qwen
actually hit.

### 3. The render report should be able to see an empty list (F38's second half)

A check that a `For Each` present in the graph produced zero DOM children, reported as an error.
This needs the report to relate DOM to graph, which it does not do today — scope it honestly, and
if it is too big for this task, split it out rather than quietly dropping it. Without it, "renders
clean" keeps meaning "renders nothing" and the eyes stay half-shut.

### 4. Rider — F41, the on-ramp that rejects its own output

`create_project` mints a `Pages/Home` skeleton; `create_plan` then rejects a plan that contains an
operation creating `Pages/Home`. Haiku and qwen both burned a turn on it (sonnet did not). The
`create_project` result *does* say a Home skeleton was made, so this is knowledge given and dropped
rather than knowledge withheld — but "structure > gate" says the door should absorb it: a create
targeting an existing **empty skeleton** component is an update, and can simply be treated as one.

## Acceptance

- The three codes land, calibrated against the corpus, each **watched failing before being trusted**.
- Haiku's session-6 project (`NodeGX test projects/phase55-s6-haiku`) is a ready-made fixture: it
  must produce three `repeater-without-template` errors. Pin it as a test.
- A cold replay on a mid-tier model produces a page with its lists drawn — the measurement, not the
  mechanism, is the acceptance.
- F41 either fixed or accepted with a written reason.

## Register

| # | Finding | State |
|---|---|---|
| F38 | A `For Each` with no `template` renders nothing; `validate:project`, `render_report` and a node census all report a pass | ✅ FIXED — `ebfa578d` (gate), `85a39388` (report) |
| F41 | `create_project` creates `Pages/Home`; `create_plan` rejects the model for planning it. 2 of 3 models, 1 turn each | ✅ FIXED — `00c59ceb` |
| F42 | **The measured defect was misattributed.** Session 6 recorded haiku as omitting `template` and qwen as nesting a child. Off disk, haiku did **both** — all three repeaters nest their item content. Two models, one mistake; qwen's was visible only because its child id dangled | ✅ CLOSED by the correction above; the gate covers both faces |
| F43 | **The render report's own harness makes the page look complete.** `render-from-disk` injects the project as `window.projectData` inside `<body>`, so `document.body.textContent` contains every authored string — including content that never rendered. Any future check reading page text must read the visible leaf elements | ✅ FIXED in `85a39388`; worth knowing for the next one |
| F44 | **`store.resolve` returns `{ key, entry }`, `listComponents()` returns rows with `.path`.** Two shapes, one mental model; a broad `catch` turned the resulting TypeError into a silent negative answer | ✅ FIXED in `00c59ceb`, caught by its own specs |

## What §3 still cannot do — the successor, if anyone wants it

A general "this `For Each` produced zero DOM children" needs the render to relate to the graph, and
nothing today can: the viewer stamps **no node id** on any element it renders, and `window.Noodl`
exposes only `_viewerReact.renderDeployed`. The two routes are a `data-` attribute on every visual
node's render, or a runtime handle on `window` — both viewer changes plus a bundle rebuild, and the
second is much the smaller. Worth a task of its own if the content probe's abstentions ever start
mattering; today the gate covers everything the probe abstains on.
