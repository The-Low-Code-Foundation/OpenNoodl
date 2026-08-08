# Phase 54 — Design Groundwork (Track D: pages that look designed)

**Created:** 2026-08-08
**Status:** 🚧 In progress — reference build first, library distilled from it.
**Origin:** not the roadmap. A community member asked to see NodeGX handle an ecommerce site, and
Richard's framing of the problem with everything the AI stack currently produces:

> *"basic bitch shit from a W3 Schools beginner tutorial"*

The goal is a groundwork library the authoring AI can **build from**, instead of a node reference it
has to reverse-engineer taste out of.

## Why this phase is now, and not during phase 40

Phase 40 opened on the same complaint and reached the right diagnosis: **the model's output was
better than what rendered**, and five separate mechanisms discarded the styling it did emit. Chasing
taste while the seams ate the styling would have been chasing a ghost.

Those seams closed on 2026-08-07/08, all in 0.1.4:

| Fix | Commit | What it unblocks |
|---|---|---|
| `fontWeight` port (there was **none**, on any node) | `3a0446d8` | Type *hierarchy*. Every word previously rendered at 400 |
| `fontStyle` port + no orphaned styles left | `14815f1e` | The vocabulary can only teach styles a port can carry |
| `alignItems: Stretch` | `14815f1e` | Equal-height card rows — previously unauthorable |
| `boxSizing`, defaulting to `border-box` | `8d47b54a` | A padded full-width container |
| `var(--token)` on a dimension port no longer deletes the property | `cfea975c` | Radius, borders, shadows |
| The style vocabulary stops teaching parameters with no port | `f62877b9` | The docs stop being wrong |

**So this is the first time a design effort here will survive to the DOM.** That is the precondition
this phase was waiting on, and it is met.

## The gap, measured rather than asserted

There is no design knowledge anywhere in the AI stack. Not thin — absent:

| Seam where design knowledge could live | What is in it today |
|---|---|
| `authoring/prompts/authoring.ts`, 455 lines | **Zero** occurrences of composition, hierarchy, rhythm, whitespace, grid, imagery. Pure mechanics. |
| `authoring/prompts/decomposition.ts` | AAQ-008's doctrine, **shipped** — but it is about *factoring*, not about what the result looks like |
| `docs/node-catalog/examples/` — 51 validated fragments | Logic, data, cloud, navigation. **One** (`vis-columns-media-cards`) is visual composition |
| `get_style_vocabulary` | Tokens and per-element variants — **atoms**, never an arrangement of them |

⚠️ **Correction to the phase-40 handover, which lists AAQ-008 as "not started".** It is built:
`decomposition.ts` exports `DECOMPOSITION_DOCTRINE_MD` and `DECOMPOSITION_PLANNING`, consumed by
`planning.ts` and returned to external agents as `get_project_info.authoringDoctrine` (write mode
only). **This is the template for track B2** — a doctrine module, wired into both clients through one
export, is a shape that has already shipped once. Do not invent a second one.

The agent is handed a paint set, 19 visual node types, and no worked example of what a page looks
like. It then does exactly what anyone would do: stacks Groups and Texts in a column. The output is
not a failure of effort or of model capability. **It is the predictable result of the only worked
examples in the system being about wiring.**

## The constraint that shapes the whole phase

Richard's decision of 2026-08-08 (settled, do not re-litigate):

> **NodeGX stays primitive-only.** *No* opinionated composite library (Container/Section/Card/Hero).
> Invest instead in better primitive defaults, machine-checkable design gates, and a
> render→screenshot→critique loop.

So the groundwork library is **knowledge, not node types**, and it ships through seams that already
exist and are already gated:

- `docs/node-catalog/examples/*.json` — reachable from `list_examples` / `get_example`, cited by
  `get_node_type`, and gated by `npm run catalog:examples`, which rejects any example that is not
  error- **and** warning-free. An example that does not validate is worse than no example.
- the authoring and planning prompts — reaches the embedded editor agent
- `StyleVocabulary` — reaches both clients

## The three tracks

### A — the reference build (`ecommerce-example`)

Full-stack, because a design-only template proves the wrong thing. A provisioned backend with
declared columns, real `Record` / `For Each` data, working admin CRUD, cart state. Bespoke tokens,
not Modern blue. A decomposed component set rather than one enormous page graph.

**A is not the deliverable. A is the evidence the deliverable is distilled from** — the same method
that found the missing `fontWeight` port, the inert `sizeMode`-gated `width`, and the padded
container overflowing by exactly its padding. All three came from measuring a DOM, none from
reasoning about a graph.

Proven with `scripts/devtools/render-from-disk.js`: screenshots **and** computed styles, per page.

### B — the groundwork library, distilled from A

1. `ui-*` composition recipes as validated catalog examples — page shell, card grid, hero split,
   sticky nav, data table, form field, stat row, slide-over, empty state, footer.
2. A design-doctrine block in `authoring.ts` / `planning.ts`, carrying both halves: the taste rules
   (hierarchy, rhythm, one accent, imagery is mandatory, empty states are designed too) and the trap
   list (`sizeMode: explicit`, which ports take a token, stretch, box-sizing).
3. `StyleVocabulary` teaching compositions, not only atoms.

### C — the gate, and the cold benchmark

Machine-checkable design rules in the validator, because a doctrine nothing enforces is a doctrine
the next agent skips. Then the only honest proof: wipe a copy, hand the same brief to a **cold**
agent with the library and nothing else, and judge it side by side against A.

## Register

Findings that are filed rather than fixed get a row here. **Grep this table before believing a row
is still true** — registers outlive their fixes.

| # | Finding | State |
|---|---|---|
| F1 | **The enriched catalog knew nothing of the ports that fixed the styling.** `node-catalog.json` was regenerated with the 0.1.4 runtime fixes; `node-catalog-enriched.json` — the file the MCP server inlines and the validator indexes — was not. So `Text.fontWeight`, `Text.fontStyle`, `Group.boxSizing` were `UnknownParameter` and `alignItems` had no `stretch`. **The fixes that unblocked this phase were invisible to the authoring gate.** | ✅ **FIXED** `d2b5a7f4` — regenerated, +782 lines, no deletions, three catalog gates green |
| F2 | **`provision_backend` can never reuse a backend for any v2 project.** `findReusableBackend` matches on name **and** `projectIds.includes(projectId)`, where `projectId` comes from `nodegx.project.json → id`. **No v2 project on this machine has an `id`** (checked all six), and nothing in the v2 creation path writes one, though `project-v2.schema.json:19` defines it. So `projectIds` is stamped `[]` at creation and never matches: every MCP server restart reaps the backend, then provisions a **second, empty** one and silently strands the first one's data. The ownership half of the rule is right; its failure mode when `projectId` is undefined should be "fall back", not "never reuse". | 🔴 **OPEN** — worked around by hand for `ecommerce-example` (wrote `id`, stamped `projectIds`). Needs a real fix: write an `id` on project creation, and/or degrade the match |
| F4 | **The disk renderer rendered every page in Times, and the product was fine.** Its fallback token block is a *reconstruction* of `TokenResolver.generateCss`, and drifted from it twice: (a) it emitted only the `:root` block, never the `body { font-family: var(--font-sans) }` floor the real one also emits; (b) its regex matched single-quoted values only, so every token whose value **contains an apostrophe** — i.e. all three font stacks, `--font-sans` is `"Inter, …, 'Apple Color Emoji', …"` — was dropped silently. Net effect: a serif single column, **the exact signature of "the styling was discarded"**, produced entirely by the measuring instrument. | ✅ **FIXED** — both halves, with a comment naming `TokenResolver.generateCss` as the thing to keep in step |
| F5 | **The disk renderer ignored the project's own design tokens.** It read them from a running editor or fell back to shipped defaults, never from `metadata.designTokens` — which it already has in hand. A bespoke palette rendered in stock blue, which *looks deliberate*, so you measure it and believe it. | ✅ **FIXED** — overrides overlaid after the defaults, reported in the startup line |
| F6 | **`stage_plan_operation` reports a warning COUNT and no way to see the warnings.** `{"staged":"op-4","warnings":1}` is all an agent gets; there is no diagnostics array and no tool that reads a *staged* candidate. The agent must apply the plan and then call `validate_component` to find out what it was warned about — which defeats the point of staging. (Here, the warning did not reproduce post-apply at all.) | ✅ **FIXED** 2026-08-08 by phase-55 LAS-002 — `stage_plan_operation` and `apply_plan` now return the diagnostic objects. |
| F3 | **`pr.yml` runs on push to `cline-dev` and has been failing there.** `Node catalog freshness`, `Lint` and `Test (editor)` are all red on the 0.1.6 push (run `31245057933`). F1 sat undetected for a day underneath a gate that was working correctly and unread. | 🟠 Catalog job fixed by F1. **`Lint` and `Test (editor)` still red — not investigated here** |
