# LAS-012 — The repeater contract gate

**Status:** 📋 open · **Track 1 (gates)** · out of LAS-011's session-6 runs (**F38**, with **F41**
as a small rider) · ⭐ **the highest-value gate the phase can still add**

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
| F38 | A `For Each` with no `template` renders nothing; `validate:project`, `render_report` and a node census all report a pass | 🔴 OPEN — this task |
| F41 | `create_project` creates `Pages/Home`; `create_plan` rejects the model for planning it. 2 of 3 models, 1 turn each | 🔴 OPEN — §4 |
