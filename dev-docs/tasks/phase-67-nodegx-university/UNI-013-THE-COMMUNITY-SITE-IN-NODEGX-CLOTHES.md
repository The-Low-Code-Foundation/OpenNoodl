# UNI-013 — the community site, in NodeGX clothes

**Surface:** platform · **Tier 1** (it is cheap, it is unblocked, and it gets dearer after launch) ·
**Effort:** M · 🟢 **SLICES 1–3 BUILT 2026-08-17 (session 24), pushed `f64f138` + `d205b47`.**
**Only slice 4 (the badge artworks, Richard's) remains.** D18 ruled: **azure**.

## ✅ Slices 2 and 3 — DONE, `d205b47`. The visible half

⚠️ **Sequencing lesson, recorded because it was a real misjudgement.** Slice 1 was scoped as
*"most of the win"* and is nearly invisible — it swaps the plumbing so colours resolve from real
tokens. Richard's reaction on seeing it was *"I thought the style was redone??"*, and he was right:
**the complaint was explicitly about appearance, and the invisible half was landed first.** The
ordering was defensible on engineering grounds and wrong on the grounds that mattered. **When an ask
is about how something looks, ship something that looks different in the same session.**

- **Slice 2 — the display face is served.** 🔴 `--font-family-display` named Bricolage Grotesque all
  along and **silently resolved to the system fallback**, because the editor loads the woff2 from its
  own assets folder and there is no web equivalent. The OFL 600 weight is vendored to
  `public/fonts/`. ⚠️ Slice 1 deliberately did not reach for the token for exactly this reason —
  using it would have looked right in the source and rendered the fallback.
  `.meta` is now mono + `tabular-nums` (the editor's treatment for values, ports, versions, counts),
  and that is most of what makes a page read as NodeGX. ⚠️ **Mono but NOT uppercase** — `.meta`
  carries sentence fragments (*"posted by @nia-new · room for 4 more"*); uppercase is reserved for
  chips, filter pills and badge tiers. `h3` stays in the UI face: Bricolage at 16px is mannered.
- **Slice 3 — the card and the row are one component in two shapes**, resting on `bg-1` and lifting
  to `bg-2` under the pointer — the editor's elevation ladder rather than a colour change. Profile
  header takes the editor's avatar gradient and a mono handle; badge marks are larger and
  display-face; chips and pills are mono uppercase.

### 🔴 Two defects AC2's arithmetic caught that rendering could not

1. **`--theme-color-on-primary` FLIPS per theme** (`#071627` dark, `#ffffff` light) **while
   `--theme-color-avatar-gradient` does not.** Using it as the avatar ink painted **white on azure
   in the light theme — 2.63:1**, the exact defect the dark value exists to avoid. ✅ **A constant
   ground needs constant ink**: `--site-avatar-ink` is a *base* token (7.59:1 azure end, 4.59:1
   violet end). ⚠️ The editor's own `--theme-color-avatar-fg` is white and is **rejected by a test
   here**, so the divergence is a measurement rather than a preference.
2. **The sticky header sat on `bg-page` for about ten minutes**, putting nav links at **4.47:1** in
   light — three hundredths under AA, because light `bg-page` (`#e7ebf1`) is *darker* than the body's
   `bg-0`. It sits on `bg-1` now.

✅ **Every new foreground/ground pair slice 3 introduced is in `PAIRS`, including the hover
surfaces** — a hover state nobody listed is a surface nobody graded.

**Gates:** **532 specs / 21 files** (the 462 predating UNI-013 unchanged), `tsc` clean,
`next build` clean at 21 routes, `check:css` clean over **751** built declarations.

## ✅ Slice 1 — DONE. AC1, AC2, AC3 and AC5 met

| | |
|---|---|
| **Vendored** | `scripts/sync-tokens.mjs` → `src/styles/tokens/{colors,fonts,spacing}.css`, byte-identical, with a `source-sha256` header. ⚠️ **`spacing.css` was added to slice 1's list** — AC1 covers spacing values, and without it every padding would have been a raw px |
| **Drift test** | `tests/uni013-token-drift.test.ts`, 22 specs |
| **Contrast test** | `tests/uni013-contrast.test.ts`, 32 specs — **not in the original scope; see below for why it had to exist** |
| **AC1 sweep** | `scripts/check-built-css.mjs` (`npm run check:css`) — **713 built declarations**, zero components declaring a colour, zero raw px font sizes |
| **Gates** | **516 specs / 21 files** (462 unchanged + 54 new), `tsc` clean, `next build` clean at **21 routes**, both themes screenshotted complete |
| **`globals.css`** | declares **no colour of its own**. Seven hand-made tokens → zero |

### 🔴 AC2 was the criterion that found a real defect, and screenshots could not have

The first draft pointed every piece of secondary copy — the lede, card copy, every `.meta`, the
footer — at **`--theme-color-fg-muted`**. That is the obvious token by name, it looks entirely
reasonable in a diff, and it is **a de-emphasised LABEL colour for editor chrome**. Measured against
the grounds this site actually uses:

| | dark / bg-0 | dark / bg-1 | light / bg-0 | light / bg-1 |
|---|---|---|---|---|
| `--theme-color-fg-muted` | 4.18 | 3.93 | **3.19** | 3.62 |
| `--theme-color-fg-default-shy` | 6.37 | 5.98 | 4.72 | 5.34 |

**Every one of the four is below WCAG AA's 4.5:1 for normal-size text**, on the lede of every page.
🔴 **Two screenshots of the two themes said the site was fine. The arithmetic said it was not** —
which is the whole argument for AC2 being a computed criterion rather than a look.

Also: **`--theme-color-primary` is 7.37:1 on the dark ground and 4.03:1 on the light one**, so accent
*text* — links, `.flag` chips, `.filters a.on` — passes AA in dark and fails in light. The light
theme takes `primary-highlight` (5.20:1). ⚠️ The chip **border** may stay `primary`; it is a
non-text element and its bar is 3:1.

**Consequence — the site now owns a thin ROLE layer** (`--site-fg-secondary`, `--site-fg-accent`,
`--site-fg-accent-hover`). Every value is a `var()`, never a literal, so the site names *which token
plays a role* and the editor still owns *what colour that token is*. AC1 stays clean.
🔴 **The two themes are pinned to distinct resolved values in the test**, because every ratio passes
in dark — a light arm that silently returned the dark palette would have gone green while measuring
one theme twice.

### 🔴 Three things that were not in the scoping and cost time

1. **The theme stamp is load-bearing, not decoration.** The canonical file gates its light palette on
   `:root[data-theme='light']`, stamped by the editor's ThemeManager. This site has none, so
   *vendoring the tokens without stamping anything would have silently deleted the light theme the
   site already had* — a regression dressed as a refactor. Four lines in `layout.tsx`. ⚠️ The
   alternative, re-declaring light values under a media query, is both a second hand-made copy and
   AC2's own named bug.
2. **A Map-based diff collapses a repeated key silently.** The first rename probe renamed
   `--theme-color-primary` → `--theme-color-accent`, which turned out to be **a real token thirty
   lines further down**; the rename became a duplicate, the duplicate collapsed, and one of the two
   declarations stopped being checked *at all*. Zero duplicates today — now asserted, so tomorrow is
   loud. ⚠️ **A probe that lands on an occupied name measures the collision, not the mutation.**
3. **Type sizes are deliberately NOT vendored,** and the file says so. The editor's `--font-size-*`
   runs 10px → 24px because it is chrome at forearm distance; consuming `--font-size-base: 12.5px`
   for body copy *looks exactly right in a diff* and is unreadable on a phone. Families, weights,
   line heights and letter spacings — which carry no implied viewing distance — do come from the
   vendored `fonts.css`.

⚠️ **`--site-tier-bronze` is the one literal colour left on the site**, allow-listed with a reason in
the sweep: the editor palette has no bronze, while silver and gold reach for `neutral-700` and
`amber-300`. It retires with slice 4.

### 🔴 A trap for anyone driving the site

`pkill -f "next start"` **matches nothing** — Next renames the process to `next-server (v15.x)`. A
stale server keeps port 3111, the new one fails to bind *silently in the background*, and the old
process serves HTML referencing a **CSS hash that no longer exists on disk** → a 404 stylesheet and a
completely unstyled page. ⚠️ **Every gate stayed green through this**: build clean, sweep clean, 516
specs green. ✅ **Kill by port (`lsof -nP -iTCP:<port> -sTCP:LISTEN -t`), and check the served HTML's
CSS href against `ls .next/static/css/` before believing a screenshot.**

---

📋 **Original scoping below, unchanged.**

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

1. ✅ **DONE — the token substrate.** Sync script, vendored `colors.css` + `fonts.css` **+
   `spacing.css`**, drift test with its control, `globals.css` rewritten to consume them.
   ⚠️ **"No markup touched" did not survive**: `layout.tsx` gained the theme stamp, which is what
   makes the vendored light palette reachable at all. **Most of the win.**
2. ✅ **DONE — type and rhythm.** Mono `.meta` with `tabular-nums`, uppercase mono for chips, pills
   and badge tiers, display face on the wordmark and large headings. **The woff2 is served from
   `public/fonts/`** — it was the one asset that does not travel as a token, and the token had been
   resolving to its fallback in silence.
3. ✅ **DONE — the six components.** Card/row unified with a `bg-1` → `bg-2` hover lift, gradient
   avatar, mono handle, larger display-face badge marks, mono uppercase pills.
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
