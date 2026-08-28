# Phase 77 — The Site Builder Rescue

**Scoped:** 2026-08-28, from Richard's ruling after driving the template for the first time.
**Status: OPEN, not started.** **Prefix: `SBR`.** Ships with **0.2.1** (ruled).

Phase 76 built the hardest template we ship and did its stated job — eighteen tasks, real
platform defects flushed continuously. What it never produced is an application anyone would
use, because **every task asked "does the graph do the correct thing?" and none asked "would a
person get anywhere?"** This phase exists to close that distance, and to fix the process hole
that produced it.

> "I'm pretty amazed that we've spent 18 tasks creating an app that has a front end with
> basically one page and no actual usefulness." — Richard, 2026-08-28

> "I don't want to take any 'short paths'. I want to get this template right so it blows
> people's minds about what can be achieved with Claude Code and NodeGX." — Richard, 2026-08-28

## 1. Rulings (all taken 2026-08-28 — do not re-litigate)

- 🧭 **New phase, not the tail of 76.** Acceptance criteria here are about usability; 76 keeps
  meaning what it meant.
- 🧭 **Ships with 0.2.1** — Richard's call, made against a recommendation to hold it back.
- 🔴 **DO NOT SCOPE BY TIME.** Explicit: *"what you think takes 3 weeks takes 3 hours; don't do
  ANYTHING related to a time limit."* Scope by dependency only. No estimates, no "quick wins".
- 🧭 **Design direction: opinionated but quiet, default preset = Studio** (warm off-white, deep
  blue primary, serif display, 6px radius). Press and Night ship as presets in the theme editor
  so a client never faces an empty colour picker.
- 🧭 **Messages screen is in scope**, as its own task (SBR-010).
- 🧭 **Deploy fix = SB-017 §11.4 option 1**: derive `prop-<field>` ports in the runtime from the
  node's own wires. A fourth adapter is not it; the exporter keeps meaning what it says.
- 🧭 **Live preview gets BUILT, not struck** (SBR-011) — ruled against the assessment artifact's
  recommendation. The README's promise becomes true instead of deleted.
- 🧭 **No short paths.** The full six screens in the screens artifact are the scope — drag
  reorder, image drop targets, presets, the live theme preview panel, footer, success states.
- 🧭 **Every task carries at least one acceptance criterion written as a person's sentence**
  alongside the graph-level ones. That absence is the root cause of the whole situation, and
  SBR-013 writes the rule into the task template and the MCP authoring doctrine.

## 2. The two artifacts this phase is drawn from

1. **Assessment** — https://claude.ai/code/artifact/f4b2077a-7a78-4c33-8bf7-8b7f343f0b0b
   ("Site Builder Rescue"): seven measured findings, five workstreams (A–E).
2. **Screens** — https://claude.ai/code/artifact/f1986b40-e827-4770-abb8-1dc8f17e1810
   ("Site Builder Screens"): six screens, all styled from theme tokens, switchable live.
   The switcher is the argument: change the record, change the site.

## 3. What the scoping sweep corrected in the artifacts

The artifacts were a proposal; this is what challenging them found (2026-08-28 sweep):

- 🔴 **The proposed token table would have minted a second palette.** The screens artifact
  proposes `--bg`, `--ink`, `--ink-soft`, `--line`, `--maxw`… — but the platform already ships a
  **182-token default vocabulary** (`StyleTokensModel/DefaultTokens.ts`): `--background`,
  `--foreground`, `--muted-foreground`, `--primary`/`--primary-foreground`, `--surface`,
  `--border`, `--space-0…32` (+ xs–3xl aliases), `--radius-none…full`, `--font-sans/serif/mono`,
  `--text-xs…6xl`, `--destructive`, `--accent`, shadows. A parallel namespace is the
  second-copy-drifts trap. **The contract is the shipped vocabulary** (SBR-003); the only
  genuinely new token is a reading-measure width.
- ✅ **The load-bearing "defaults with no Theme row" question is already answered by the
  platform.** Project-level token overrides persist in project metadata
  (`designTokens` key) and `generateProjectTokenCss` stamps defaults+overrides as `:root {}`
  **into the deployed index.html** (`ProjectTokenCss.ts`). So the Studio look ships as project
  token overrides inside the template; an unclaimed site renders Studio with zero records. The
  `Theme` record overlays the same names at runtime (element style beats the `:root` rule).
- ✅ **Workstream B really is one job — more than the artifact knew.** The theme editor already
  writes `--primary`, `--background`, `--foreground`, which are *real vocabulary names*: the
  moment components consume tokens, the existing theme editor starts working with almost no
  change to its own writer.
- ✅ **The raw-colour gate half-exists**: `DiagnosticCode.RawColorLiteral`
  (`validation/parameterValues.ts:976`) already warns on a colour literal in a color-typed port
  (553 in the corpus, warning by design). SBR-012 promotes it to a failing, template-scoped gate
  over both populations — and narrows the screens artifact's unenforceable "no raw value" to the
  enforceable "no raw colour, plus a named-exemption audit for the rest".
- ⚠️ **"It's basically one page" is half right in a way that matters**: the public site is one
  component rendering any slug from a record — correct architecture, stays. What was missing is
  that nothing ever authored pages for it, and one rendering for five section kinds.

## 4. The measured findings (2026-08-28, running editor + shipped artefact)

| # | finding | fixed by |
|---|---|---|
| 1 | Wizard never attaches a backend; template ships `devOpen: false` and can do nothing | SBR-001 |
| 2 | No backend ⇒ white void (`visibleText: 0`), not an error — F27 covers "no rows", nothing covers "no answer" | SBR-002 |
| 3 | Theme editor writes 3 tokens, consumed **0** times | SBR-003/004/006/007/009 |
| 4 | 27/78 visual nodes carry any style; colour/border/radius **0**; design never scoped | SBR-004..009 |
| 5 | Five section kinds, one rendering (1 Image + 1 Text) | SBR-005 |
| 6 | Live preview promised twice (README §2, SB-005), occurrences in template: **0** | SBR-011 |
| 7 | Deployed admin panel drops all 19 record-field wires — saves nothing | SBR-008 |
| 8 | 🔴 **The NDA-017 back-compat migration fires on projects created today** — 37 nodes silenced in a project the template minted that morning, zero `true`s. One of them left the site's root URL rendering no page. **A platform defect, not a template one; needs a task** | SBR-004 §10.3 fixed the template's instance and gated the artefact; the product half is unowned |

## 5. Tasks

| id | task | depends on |
|---|---|---|
| SBR-001 | **The wizard attaches the backend** — template declares its need (derived, not hand-written), creation attaches+starts+binds, policy applies, cloud functions deploy | — |
| SBR-002 | **The first run lands somewhere** — project opens on `Pages/Setup` (must change `useSwitchToDefaultComponent` itself); no-backend and unclaimed states say so on screen | SBR-001 to drive |
| SBR-003 | **The token contract** — shipped vocabulary is the contract; Studio defaults as project token overrides (deploys in `:root`); `Theme` record overlays a chosen subset; presets as data | — |
| SBR-004 | **The public site wears the theme** — nav from published pages with current state, footer, reading measure, spacing rhythm, everything from tokens | SBR-003 |
| SBR-005 | **Sections worth having** — hero / gallery / cta / richText render as four different things; contact form with labels and a success state | SBR-003, SBR-004 |
| SBR-006 | **The admin shell** — sidebar (Pages · Theme & settings · Messages · View site), pages list as a content table with status pills and an overflow menu, create in a dialog | SBR-003 |
| SBR-007 | **The page editor** — labelled grouped fields, readable section list, add/drag-reorder sections, image drop target with thumbnail, publish state + preview in view | SBR-006 (deployed save needs SBR-008) |
| SBR-008 | **The deploy keeps the panel's wires** — §11.4 option 1: runtime derives `prop-<field>` from the node's own wires; census 19 → 0 | — |
| SBR-009 | **The theme editor demos itself** — grouped fields, three presets, live preview beside the fields; save writes the record and the site changes | SBR-003, SBR-006 |
| SBR-010 | **Messages** — the admin reads what the contact form stores; the loop the product left open closes | SBR-006 |
| SBR-011 | **Live preview over the realtime hub** — `Subscribe to Changes` (SSE) into the site's query chains; an admin edit updates an open site without reload | SBR-001, SBR-004, SBR-005 |
| SBR-012 | **The raw-colour gate** — promote `RawColorLiteral` to a failing template gate over component sets AND generated artefact; unresolvable `var(--x)` also fails | SBR-003 |
| SBR-013 | **The doctrine rule** — MCP authoring guidance requires a token set and screens before components; the task template requires a person-sentence AC | — |
| SBR-014 | **The drive** — the whole story end-to-end through the panel's own UI with a backend attached: the half SB-008 never did | everything |

**Build order:** SBR-001 → SBR-002 · SBR-003 → {SBR-004, SBR-006} → {SBR-005, SBR-007,
SBR-009} → SBR-010 · SBR-008 whenever (it unblocks SBR-007's deployed half) · SBR-011 after
004/005 · SBR-012 after 003 · SBR-013 any time · SBR-014 last.

## 6. The one thing not to lose

The reason phase 76 ended where it did is not bad work — it is that **"correct" and "usable"
were never the same acceptance criterion, and only one was ever written down**. If this phase
produces a beautiful template and does not land SBR-013, it happens again on the next template.
