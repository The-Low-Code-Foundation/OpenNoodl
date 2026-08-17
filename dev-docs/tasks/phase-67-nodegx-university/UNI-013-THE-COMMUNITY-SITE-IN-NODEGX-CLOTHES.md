# UNI-013 — the community site, in NodeGX clothes

**Surface:** platform · **Tier 1** (it is cheap, it is unblocked, and it gets dearer after launch) ·
**Effort:** M · 📋 **SCOPED 2026-08-17, not built.** D18 ruled the same day: **azure**.

> **Added 2026-08-17 out of Richard's own read of the running site:** *"it's a bit simple and sad
> right now … I don't think it fits our sleek new NodeGX style in the editor."*

## Premise — it is not sad, it was never styled

🔴 **The site does not have a weak design. It has no design system at all**, and that is a different
problem with a different fix. `src/app/globals.css` declares **seven** custom properties — `--bg`,
`--panel`, `--border`, `--text`, `--muted`, `--accent`, `--accent-ink` — and every one of the
fourteen pages is built against them. It was written before NodeGX had a visual language, and
nothing has revisited it since.

The language exists. It is canonical, documented, and shipping:
[`noodl-core-ui/src/styles/custom-properties/`](../../../packages/noodl-core-ui/src/styles/custom-properties/)
— `colors.css`, `fonts.css`, `spacing.css`, `animations.css`. `colors.css`'s own header calls itself
*"the only definition of colour tokens"* and documents the theming convention (dark values in
`:root`, light in `[data-theme='light']`, never a hardcoded colour a light surface would need to
override).

**Measured 2026-08-17, from the three stylesheets rather than from memory:**

| | community site | landing page | editor |
|---|---|---|---|
| tokens | **7** | 24 | two-tier, `--base-color-*` → `--theme-color-*` |
| surface steps | 2 | 4 | **5** (`bg-0`…`bg-4`) |
| text hierarchy | 2 | 3 | 4+ |
| accent | `#4b9fff` | `#0b8f81` | `#4da3ff` |
| mono face | **none** | yes | yes |
| display face | none | none | **Bricolage Grotesque 600**, bundled woff2, OFL |
| light theme | media-query only | yes | `[data-theme='light']`, stamped by `ThemeManager` |

### 🔴 The detail that diagnoses it

The community site's accent is **`#4b9fff`**. The editor's is **`#4da3ff`**. Four hex digits apart —
**close enough that someone was aiming at the editor, far enough that they were doing it by eye.**
Nothing was imported, so nothing stayed in sync, and the near-miss is the evidence that a copy made
by hand is the failure mode here rather than a hypothetical.

⚠️ **That is also the argument against fixing this by pasting better values in.** A second hand-made
copy drifts exactly as the first one did.

## ✅ D18 — RULED 2026-08-17 by Richard: **azure**

The two shipping systems disagreed and the overhaul had to pick: the landing page is teal
(`#0b8f81` / `#2dd4bf`), the editor is azure (`#4da3ff`). **Ruled: azure.** One hue across both
*products* — the editor and the community site — which is the pair a user moves between, and the
pair UNI-011 puts inside one window.

⚠️ **The consequence, recorded because it inverts the recommendation that was made:** the pitch
argued *teal*, on the grounds that the landing page is what a stranger meets first and the community
site sits directly behind it. Choosing azure accepts that **the landing page becomes the odd one
out**, not the editor. That is defensible — the two products agree and the marketing page keeps its
own voice — but it was **chosen, not inherited**, and if the landing page is ever brought into line
this ruling is the reason it moves rather than the community site.

🔴 **What is NOT ruled:** whether `nodegx-web` follows. Out of scope here; UNI-013 touches the
community platform only.

## The load-bearing question: how do two repos share one token set?

The editor is this checkout; the platform is a **sibling repo**. There is no build step between them
and no package registry in play. Three options, and the phase has already paid for the wrong one:

| | How | Cost |
|---|---|---|
| **A. Copy the values** | paste the resolved hexes into `globals.css` | 🔴 **This is what produced `#4b9fff`.** It drifts silently and nothing catches it |
| **B. Publish `@nodegx/tokens`** | a real package, consumed by both | Correct, and the most infrastructure: cross-repo publishing, versioning, a release step for a colour change |
| **C. Vendor + sync script + drift test** | `colors.css`/`fonts.css` copied in by a script, with a test that **fails when they diverge** | A copy, but an *honest* one — the drift is detected rather than hoped against |

### ✅ CHOSEN: **C**, and the drift test is the whole of why

A vendored copy with no check is option A wearing a hat. What makes C different is that the
divergence becomes **a failing test rather than a slow surprise** — which is the pattern this phase
already runs on the platform's schema, where `src/db/schema.ts` is a mirror and a drift spec pins it
to the SQL. ⚠️ **And it inherits that spec's known hole:** the schema drift test compares tables and
columns *and not enum names*, so a half-done rename passed it. The token drift test must compare
**every declared custom property and its value**, not a count and not a subset — a check that
compares how many tokens exist would pass on two files with the same number of different colours.

🔴 **Non-vacuity floor: the drift test must be shown to fail.** Change one hex in the vendored copy
and it goes red, in the same commit that adds it.

## Acceptance criteria

1. **No component declares a colour.** Every colour, type size, weight and spacing value on the
   fourteen pages resolves from a NodeGX token. Proved by **a sweep over the built CSS for hex
   literals and raw `px` font sizes**, not by inspection — with a known-bad probe so a pass means
   something.
2. **The accent is azure and both themes work.** Light and dark each resolve as a complete set,
   following the editor's convention rather than inventing a second one. 🔴 A token defined *only*
   inside a media query is the specific bug to test for — it renders one theme's text on the other
   theme's ground.
3. **Divergence from the editor's canonical files fails a test.** Every declared property and value
   compared, not a count; proved to fail by a one-hex control.
4. **The six components that carry identity are restyled** — profile header, badge, people card,
   replay row, RFP row, org shelf item. These are what make the site look like a bootstrap template
   or like NodeGX; the other pages inherit from the tokens.
5. **Nothing about behaviour changes.** 🔴 Proved by **the existing 462 specs passing unchanged** —
   this is presentation only, and a suite that moves means the task did something it should not have.

## Slices

1. **The token substrate.** Sync script, vendored `colors.css` + `fonts.css`, drift test with its
   control, `globals.css` rewritten to consume them. No markup touched. **Most of the win.**
2. **Type and rhythm.** The mono/sans pairing, a real scale, uppercase mono for labels, handles,
   versions and counts. `font-variant-numeric: tabular-nums` wherever points and counts align.
   ⚠️ **The display face is `Bricolage Grotesque 600`, a bundled woff2** — on the web it needs
   serving and a fallback, and it is the one asset that does not travel as a token.
3. **The six components.** Where the site stops looking generic.
4. **The twelve badges.** 🔴 **Still undrawn** — D4 ruled ~12 flat SVGs in the editor's idiom, and
   the profile currently renders a family mark and a tier colour rather than a broken image, which
   was deliberate. **Richard's to draw or delegate; it is the one slice that is not code.**

## Not in v1

- **No new pages, routes, or schema.** Presentation only — AC5 is the guard.
- **No component library.** Fourteen pages do not need one, and building one here outlives its use.
- **Not the editor.** Its tokens are already systematic and are not the problem.
- **Not `nodegx-web`.** The landing page keeps teal until somebody rules otherwise (D18).
- **No logo or wordmark work.**

## Why it is Tier 1 despite being cosmetic

🔴 **Nobody has seen this site.** It is deployed nowhere, so there is no audience to re-teach and no
screenshots in circulation. Restyling costs the least it will ever cost, and every page built against
seven tokens adds to the bill.

⚠️ **And there is a sequencing argument that is not about aesthetics.** Deployment is this phase's
real gap and no task owns it (measured 2026-08-17: no Dockerfile, no CI workflow, no `ops/`, and zero
mentions of deploying the platform across all twelve task files). Whenever that lands, whatever is on
the site is what the world sees first.

## Dependencies

| Needs | Why |
|---|---|
| nothing | 🔴 **This task is blocked on no ruling, no purchase and no domain** — which makes it rare in this phase |
| **D4** (soft) | the badge taxonomy the twelve SVGs are drawn from |
| **UNI-011** (soft) | the mirror renders community content inside the editor; one hue is one fewer seam |
