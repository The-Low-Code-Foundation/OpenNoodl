# UIX-001: Design Tokens & Typography Foundation

## Metadata

| Field | Value |
|-------|-------|
| **ID** | UIX-001 |
| **Phase** | Phase 23 — Visual Refresh (Track I) |
| **Tier** | 1 — foundation |
| **Priority** | 🔴 Critical (everything else in the phase consumes this vocabulary) |
| **Difficulty** | 🟡 Medium (small diff, high blast radius) |
| **Estimated Time** | 3–5 days |
| **Prerequisites** | none |
| **Branch** | `task/uix-001-design-tokens` |
| **Recommended executor** | 🔵 **Fable 5** — the diff is small but every judgment call (accent hue on both grounds, elevation step sizes, which red call sites are truly destructive) propagates phase-wide. |

## Objective

Replace the palette inside the existing two-tier token system with the phase's new one — elevation-scaled neutrals, an azure action accent, red demoted to danger-only — collapse the duplicated `colors.css`, and settle typography tokens; without restyling any individual surface.

## Background

The editor already has the right architecture: `packages/noodl-core-ui/src/styles/custom-properties/colors.css` (~341 lines) defines raw scales (`--base-color-*`) and semantic tokens (`--theme-color-bg-0..5`, `--theme-color-fg-*`, `--theme-color-primary`, node/connection tokens, borders, focus ring), and ~119 editor stylesheets plus nearly all of core-ui consume them. The problems are palette-level: the `bg-0..5` steps are too close to distinguish (no visible elevation), the fg grays fail contrast in places, and `--theme-color-primary` is `#d21f3c` — a red that call sites use for CTAs, active states, *and* de-facto danger, which is the single largest cause of the "permanently alarmed" look.

There is also a structural landmine: a **near-identical duplicate** of `colors.css` at `packages/noodl-editor/src/editor/src/styles/custom-properties/colors.css` (~343 lines, diffs by a couple of lines). Two files each claiming to be THE palette is exactly the convergence trap documented in the shared-secrets memory — collapse it first or every downstream task edits the wrong copy.

## Current State

- Two `colors.css` copies (core-ui + editor), out of sync by a few lines; whichever loads last wins silently.
- `--theme-color-primary: #d21f3c` serves CTA, brand, active-tab, and error duty. No separate danger token.
- `bg-0` is `#000` and the neutral steps compress; borders barely read.
- Sibling token files exist and are sane: `spacing.css`, `fonts.css`, `animations.css` (same folder, both packages — same duplication).
- A commented-out `.theme-light` block sits at the bottom of both copies (UIX-008 territory — do not activate it here, but structure the new tokens so it can be filled in).
- Legacy aliases (`--base-color-grey-*`, `--base-color-teal-*`, `--base-color-yellow-*`) remap onto the palette — call sites depend on them.

## Desired State

One canonical token file, one palette, semantic roles that can't collide. The reference values (from the approved mocks — see [mocks/](./mocks/); dark theme first, light values recorded now for UIX-008):

**Neutrals / elevation (dark):** page `#07090C` (behind-everything), `bg-0 #0B0E12` (canvas ground), `bg-1 #12161B` (panels), `bg-2 #181D24` (cards/inputs), `bg-3 #222933` (hover/active), `border-1 #232A33`, `border-2 #37404C`. Steps must be visibly distinct on a mid-quality display — that is the point.
**Text (dark):** `fg-1 #EEF2F6` (highlight), `fg-2 #A6B0BB` (default), `fg-3 #6B7682` (muted — large/secondary text only; must not be used below AA on bg-1).
**Accent (dark):** `accent #4DA3FF`, hover `#74B8FF`, on-accent text `#071627`, soft fill `rgba(77,163,255,.13)`.
**Semantic (dark):** success `#3CCB7F`, warning `#FDB022` (+ soft bg `rgba(253,176,34,.12)`), danger `#F97066` (+ soft bg `rgba(249,112,102,.12)`).
**Brand:** coral `#FF6A5F` (dark) / `#FF5A50` (light) — wordmark dot ONLY.
**Light-theme counterparts** (recorded in the token file behind the inert `.theme-light` block, activated by UIX-008): page `#E7EBF1`, `bg-0 #EEF1F5`, `bg-1 #FFFFFF`, `bg-2 #F7F9FB`, `bg-3 #ECF0F4`, borders `#E0E5EB`/`#C9D2DC`, fg `#18212B`/`#4A5663`/`#7C8894`, accent `#1570EF` (hover `#0E5FD0`, on-accent `#FFFFFF`), success `#12915B`, warning `#B54708`, danger `#D92D20`.
**Node-category tokens** (consumed by UIX-005; define here so there is one source): visual azure `#5CA9FF`/`#2E7CD6`, data emerald `#45D08A`/`#1E9E63`, logic amber `#F5B843`/`#B87E14`, function pink `#F776C4`/`#D6479A`, component violet `#A78BFA`/`#7C5CE0`; wire-signal cyan `#35C3E8`/`#0E9CC4`, wire-data = data emerald. (dark/light pairs)

Semantic layer changes:
- `--theme-color-primary` becomes the azure accent. A new `--theme-color-danger` (+ `-danger-bg`) carries red. `--theme-color-warning`/`-success` (+ soft bgs) added or normalized.
- Every call site of the old red primary is audited and classified: **action** (keep `primary`, now azure) vs. **destructive/error** (switch to `danger`). Grep is the tool; the Deploy button, active tabs, selection highlights, and "Create new project" are actions; delete confirmations, error toasts/badges are danger.
- Focus-ring token verified visible on both grounds.

Typography:
- Tokens in `fonts.css`: UI face = native system stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif`); mono face = `ui-monospace, 'SF Mono', Menlo, monospace` for values/ports/versions; display face for wordmark + large headings — **decide here**: ship Bricolage Grotesque 600 as a bundled woff2 (the mocks use it; license is OFL) or stay all-system. Either is acceptable; record the decision and the rationale in this task's notes. No CDN fonts (Electron, offline).
- A minimal type-scale + weight token set (11/12.5/13/14.5/17/24 in the mocks) so later tasks stop hardcoding sizes.

Structural:
- The editor's duplicate `custom-properties/` files are deleted; the editor imports core-ui's (match how other core-ui styles already reach the editor — webpack alias or direct import). One file. Verify the couple of diverged lines are reconciled, not dropped.
- A short `dev-docs/guidelines/DESIGN-TOKENS.md` documenting the roles ("danger is never a CTA", elevation usage, when to use fg-3) so agents in later tasks converge.

## Scope

### In Scope
- [ ] Collapse duplicate `colors.css` / `spacing.css` / `fonts.css` / `animations.css` (editor copies deleted, single import path)
- [ ] New palette + semantic split (`primary` azure, new `danger`/`warning`/`success` + soft bgs) in the canonical file
- [ ] Node-category + wire tokens defined (inert until UIX-005 consumes them)
- [ ] Light values recorded in the inert `.theme-light` block
- [ ] Audit + convert every `--theme-color-primary` call site: action stays primary, destructive/error moves to danger (this includes raw uses of `--base-color-red-*` for non-error purposes)
- [ ] Typography tokens + display-face decision (bundled woff2 or system)
- [ ] `DESIGN-TOKENS.md` guideline
- [ ] Contrast check: every fg token on every bg token it's documented for meets AA; record the matrix in the guideline
- [ ] Live-verify in the editor (run-editor skill): launcher + editor open, nothing unreadable, screenshots taken for UIX-009's "after tier 1" set

### Out of Scope
- Restyling any component (UIX-003/004/006) — this task changes token *values* and call-site *token names* only
- Canvas painter (UIX-005) — canvas will still look old after this task; expected
- Activating light theme (UIX-008)
- Legacy hardcoded-hex cleanup (UIX-002)

## Implementation Steps

1. Reconcile + collapse the duplicated token files; single canonical source in core-ui; editor imports it. Build + launch to prove nothing 404s.
2. Land the new palette in `--base-color-*` scales, keeping legacy alias names mapped onto new values so un-touched call sites shift automatically.
3. Add the semantic split; grep-audit primary/red call sites and classify (produce the classification list in NOTES.md before converting — it's the review artifact).
4. Typography tokens + display-face decision.
5. Contrast matrix; adjust values if any documented pairing fails AA.
6. Guideline doc; live-verify; screenshots.

## Success Criteria

- [ ] `git grep -l "custom-properties/colors.css"` resolves to exactly one definition file
- [ ] Deploy / Create-new-project / active tabs render azure; error toast and delete actions render red; no other red chrome in the app
- [ ] Elevation: panels, cards, and canvas ground are distinguishable in a screenshot without edge-hunting
- [ ] Contrast matrix documented, all AA
- [ ] Editor + launcher live-verified; no visual regression that blocks daily use (old-looking controls are fine — that's later tasks)
- [ ] `DESIGN-TOKENS.md` exists and states the danger-is-never-CTA rule

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| The two colors.css copies diverged meaningfully and collapse breaks a surface | Diff them first; reconcile line-by-line into the survivor before deleting |
| A "primary" call site is semantically ambiguous (e.g. record-delete button styled primary) | The classification list in NOTES.md is reviewed before conversion; ambiguous → danger if destructive, else primary |
| Legacy alias remap shifts a color somewhere unexpected | Aliases are remapped to *nearest new* values deliberately; UIX-009's screenshot corpus is the safety net — capture "before" first |
| Bundled font bloats the app or fails to load offline | It's one 40KB woff2 or nothing; system-stack fallback in the token either way |
| Contrast fixes make muted text too loud | fg-3 is allowed to fail AA only where the guideline documents it as decorative; everything readable gets AA |

## References

- [mocks/](./mocks/) — palette source of truth
- `packages/noodl-core-ui/src/styles/custom-properties/colors.css` + editor duplicate — the files
- Shared-SecretsStore convergence memory — why full values live in this spec's prose
- [PLAT-004](../phase-14-editor-platform-health/) — precedent for guideline-doc + gate discipline

## Checklist

- [ ] Token files collapsed to one source
- [ ] New palette + semantic split landed; call sites classified & converted
- [ ] Node/wire tokens + light values recorded (inert)
- [ ] Typography tokens + display decision
- [ ] Contrast matrix AA; guideline doc
- [ ] Live verify + screenshots; CHANGELOG
