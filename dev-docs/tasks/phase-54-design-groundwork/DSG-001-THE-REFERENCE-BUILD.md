# DSG-001 — The reference build

**Status:** ✅ **done** 2026-08-08 · **Track A** · the evidence every other task is distilled from ·
**and the exhibit phase 55 opened on**

## Why a build, and not a specification

A design-only template proves the wrong thing, and reasoning about a graph proves nothing at all.
Every mechanical defect this phase names — the missing `fontWeight` port, the inert `sizeMode`-gated
`width`, the padded container overflowing by exactly its padding, the wrapped flex row that will not
shrink its children — came from **measuring a rendered DOM**. None came from reading a node
definition.

So track A is not the deliverable. **It is the instrument.** The rule the phase runs on: a doctrine
line, a recipe or a gate may only be written after the thing it describes has been built once and
looked at.

## What was built

`ecommerce-example` — *Kiln & Co.*, small-batch ceramics — in
`~/vscode_projects/NodeGX test projects/ecommerce-example`, v2 format, `react19` runtime.

| Component | Nodes | What it carries |
|---|---|---|
| `App` | 2 | root Group + Router |
| `Pages/Home` | **66** | Page, bands, `DbCollection2` → `For Each` → `ProductCard`, header/footer instances |
| `Components/ProductCard` | 22 | the repeated item, driven per record |
| `Components/SiteHeader` | 15 | |
| `Components/SiteFooter` | 27 | |

**132 nodes across 5 components.** Bespoke tokens, not Modern blue —
`metadata.designTokens.customTokens` carries the project's own palette, and
`metadata.cloudservices` binds it to a provisioned local backend
(`backend_msk1w1ujnckt4`, port 8582) with real collections behind the `DbCollection2` query.
It is data-driven, not a mockup.

Measured with `scripts/devtools/render-from-disk.js` — screenshots **and** computed styles per page.
Two of the phase's six register findings (F4, F5) are defects **in that instrument**, both found by
disbelieving a rendered page, and both fixed before its output was trusted.

## §1 — What it proved, and paid for

Everything downstream of it exists because this build hit something:

- **DSG-002 §7** — the mechanics that silently undo layout — is a list of DOM measurements from this
  project. The cards measured **1152px each** before the wrapped-flex-row fix; there were **13 empty
  boxes** on the page before falsiness was wired into `visible`, counted rather than estimated.
- **DSG-003's six recipes** were each lifted from a component here *after* it was measured, which is
  why they are layouts known to render rather than layouts known to validate.
- **The enriched catalog was stale** (README F1) — `Text.fontWeight`, `Text.fontStyle` and
  `Group.boxSizing` were `UnknownParameter` to the gate. The fixes that unblocked the whole phase
  were invisible to the authoring gate, and only a real build touched enough surface to notice.
- **DSG-007** (F2) — a backend that could never be reused — was hit here first, and worked around by
  hand rather than fixed.

## §2 — ⚠️ It failed its own brief, and that is the more useful result

The README's track A asks for *"a decomposed component set rather than one enormous page graph"*.

**`Pages/Home` is 66 nodes**, with its section heads and trust items hand-duplicated and its
category cards written out three times. `SiteFooter` carries three identical link columns. The
decomposition doctrine had told both clients "two or more structurally identical siblings become one
component" since AAQ-008, and it was ignored **by the author of the design doctrine, three commits
after shipping it** (`ef945bdc`).

That is the single most valuable line of evidence this phase produced, and it points in an
uncomfortable direction:

> Prose loses. A page can be the first AI-authored NodeGX page anyone thought was pretty *and* be
> architecturally wrong, and no instrument in the system said so.

It is the argument for [DSG-004](DSG-004-THE-GATES-BEHIND-THE-DOCTRINE.md), the origin of the
`repeated-sibling-subtree` and `oversized-page` rules — both of which fire on this project by
construction — and the reason [phase 55](../phase-55-llm-authoring-support/README.md) exists at all.

## §3 — What it does not contain

Recorded so nobody cites this build as broader evidence than it is. The README describes track A as
full-stack with *"working admin CRUD, cart state"*. On disk there is **one page**. There is no
product detail page, no cart, no admin CRUD, no checkout, no auth.

So: the storefront home page is measured and real; **the full-stack claim is not evidenced by this
project**. If a fuller reference build is wanted — and DSG-006's cold benchmark would be sharper
against one — it is new work, and it should be built against the gates that now exist rather than
before them.

## Acceptance — as met

- ✅ A real project, on disk, in v2 format, with a provisioned backend and real records.
- ✅ Bespoke design tokens, not the shipped preset.
- ✅ Rendered and **measured** — screenshots plus computed styles — not merely validated.
- ✅ Every doctrine rule and every recipe traceable to something observed here.
- ❌ **Decomposed.** 66-node page; see §2. Left as-is deliberately: it is the fixture the two
  architecture rules were calibrated against.
- ❌ Full-stack across several pages; see §3.

## Register

| # | Finding | State |
|---|---|---|
| F7 | **The reference build breaks the doctrine it was built to produce.** 66-node `Pages/Home`, three hand-duplicated trust items, three section heads, three category cards; `SiteFooter` three identical columns | ✅ verified on disk 2026-08-10 — and deliberately preserved as the calibration fixture |
| F8 | **The project has no `id`**, so the backend it is bound to can never be matched back to it | 🔴 open — [DSG-007](DSG-007-A-PROJECT-THAT-CAN-OWN-ITS-BACKEND.md) |
| F9 | **The measuring instrument lied twice** before its output was trusted (serif everything; stock palette on a bespoke project) | ✅ both fixed — README F4, F5 |
| F10 | The full-stack scope in the README (cart, admin CRUD) **was not built** | ✅ verified — one page, four components |
</content>
