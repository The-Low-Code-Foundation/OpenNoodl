# SBR-004 — The public site wears the theme

**Fixes finding 4 for the visitor-facing half.** Screen 1 of the screens artifact. The
one-component-renders-any-slug architecture stays; what changes is that the page has a shape —
nav, reading measure, rhythm, footer — and every visual value comes from a token.

## 1. The person sentence

**A visitor on a phone or a laptop sees a site they would believe a real studio published —
a navigation bar, readable text at a sane width, and a footer — not a column of raw controls.**

## 2. Scope (from the screens artifact, no trimming — ruled s1)

- **Navigation**: brand from `SiteSettings`, links from published pages (derivation already
  exists), a current-page state (`--primary`, weight), laid out as a bar with a bottom rule.
- **Reading measure**: the page content constrained by the measure token; sections separated by
  multiples of the spacing scale.
- **Footer**: site name and a link back to home — new; today the page just stops.
- **The not-found / unclaimed / no-backend states** (SBR-002's panels) styled as centred cards.
- Every colour, radius, gap, face and size in `/Pages/Site`, `/Site/*` is a `var(--token)` —
  zero raw values; SBR-012 is the gate that holds it.

## 3. Acceptance criteria

1. **(person)** The published demo page renders with nav, measure, rhythm and footer, in the
   Studio look, for an anonymous visitor.
2. Current page is visibly distinct in the nav (measured: the aria-current link resolves a
   different colour/weight than its siblings).
3. Zero raw style values in the touched components — SBR-012's gate green, and the *planted*
   raw value reds it (the gate must be shown able to fail).
4. Narrow viewport (~375px) neither overflows horizontally nor collapses the nav into overlap —
   measured with `scrollLeft` probing, not `scrollWidth` (integer rounding lies).

## 4. Traps

- 🔴 Component sets vs artefact: regenerate after every edit; id count and connection totals move.
- 🔴 Assert wires by node **label** (door remaps ids).
- Text nodes must keep standing values (s19's rule) — a styled heading that renders the word
  "Text" while loading is the same defect in better clothes.

---

## 5. Built (s5) — what landed, and what the build measured

All of §2's scope is authored in `packages/noodl-mcp/tests/sb006Components.ts` (the five SB-006
component sets are the template's source; the shipped `site-builder.content.json` is generated
from them through the real MCP door). **47 specs green in `sb006PublicSite.test.ts`** (was 34);
the four MCP sb00x suites are **105/105** (was 91/91).

- **Nav**: a bar with a bottom rule (`--border-1`/`--border`), `flexWrap: wrap`, token padding.
- **Current page** (AC2): `Site/NavLink` gained a `Variable2` reading `siteCurrentSlug` and a
  state function that compares it with the record's own slug, owning both `color` and
  `fontWeight` on the link.
- **Measure**: `/Pages/Site` is now `frame` (the ground) → `shell` (the measure).
  `maxWidth: 'var(--site-measure)'` replaces `{ value: 960, unit: 'px' }`.
- **Footer**: new — site name from the same settings read the header uses, and a home link
  carrying `SiteSettings.homeSlug`.
- **State panels**: the not-found text now sits in a centred `--surface` card that owns the
  `visible` wire.
- **Tokens**: every colour, radius, gap, face and size in the five components is a
  `var(--token)`; four dimensions are named in `RAW_DIMENSION_EXEMPTIONS` with a reason each.

### 🔴 AC2 deviates from its own parenthetical, and the reason is a platform gap

AC2 says *"measured: the aria-current link resolves a different colour/weight than its
siblings"*. **The platform cannot author `aria-current`, or any ARIA attribute at all.** No
visual node declares an aria or arbitrary-attribute port — `addTextStyleInputs`,
`addSharedVisualInputs`, `addBorderInputs`, `addAlignInputs` and the rest define none, and the
only ARIA anywhere in `noodl-viewer-react` is a hard-coded `aria-hidden="true"` on `IconGlyph`'s
svg (`IconGlyph.tsx:41`). So no NodeGX app can emit `aria-current`, `aria-label` or `role`.

This is a **platform** gap, not a template one, and it is bigger than this task: it is the
runtime-accessibility hole that blocks four of the adjacent markets. Recorded here as found;
not fixed here, and not ours to scope.

What was built instead keeps AC2's substance: the current link is identified by its record slug
matching the app-wide current slug, and the distinction is carried in **two channels** — colour
(`--primary` vs `--muted-foreground`) *and* weight (`--font-semibold` vs `--font-normal`).
`MUTANT: a current state that changes colour and not weight reddens AC2` holds the second
channel, because colour alone is not a distinction every reader can see.

### Traps this build measured

- 🔴 **A `For Each` cannot carry a constant.** It sets `id` and *the model's own fields* and
  nothing else (`foreach.tsx:586-597`), so "which page is current" — one value, the same for
  every link — cannot arrive as a component input on a repeated component. This is the same
  limit that put the contact form outside the section list. The platform's answer is an app-wide
  variable: `Noodl.Variables` is a `Noodl.Object` proxy over `'--ndl--global-variables'`
  (`noodl-js-api.ts:28`), so a write goes through `Model.set` and every `Variable` node reading
  the name is notified. The link reads it **twice over** — `changed` covers "the link existed
  before the page resolved", a direct read covers "the link was created after". Neither alone is
  both.
- 🔴 **Nothing consumed `--background` or `--foreground` before this task.**
  `TokenResolver.generateCss` stamps `:root { …tokens }` and `body { font-family:
  var(--font-sans) }` and **nothing else** (`TokenResolver.ts:137`). So a Theme record could set
  `colorBackground` and the page stayed white — the token was declared and read by no element.
  The `frame` node is what makes the theme visible; without a node consuming them, "every
  surface changes" is unachievable however correct the record is.
- 🔴 **A wrapped row around a Repeater WITH a gutter is refused.**
  `uncollapsible-multi-column` arm B (`responsiveArrangement.ts:238-256`) fires on
  `flexDirection: row` + `flexWrap: wrap` + a Repeater child + `columnGap` — and the gutter is
  the whole discriminator (the rule's corpus found 3 of 45 such rows and all three were the
  defect). Dropping `columnGap` and putting the spacing on the link is the fix; the link's
  `marginTop`/`marginBottom` is also what separates the rows once the bar wraps.
- ⚠️ **`Text` has no padding ports and `Group` has no text `color` port.** `Text` gets
  `addMarginInputs` and not `addPaddingInputs` (`text.ts:149-158`); `Group` gets
  `addBorderInputs` but not `addTextStyleInputs` (`group.ts:492-500`). So the vertical step on a
  nav link is a margin, and `--foreground` is named on every leaf rather than once at the top.
  Both were authored wrong first and caught by the door.
- ✅ **A units-typed port takes `var(--token)` first-class.** `isTokenReference`
  (`react-component-node.ts:586`, AIB-001) and the validator asks for exactly this form
  (`parameterValues.ts:199`, and its own message says a CSS string like `"16px"` is *dropped
  silently*). This is the source-side half of SBR-003's carried probe.

### Still owed

1. **The drive** — AC1 (the person sentence), AC4's measured half (375px, `scrollLeft` probing),
   and SBR-003's carried `var(--token)` dimension probe: that `maxWidth: var(--site-measure)`
   actually constrains a rendered box, paired with an unknown-token control that does not.
2. AC3's "SBR-012's gate green" reads on **SBR-012's** gate. What SBR-004 ships is the seed:
   a scan over the five component sets with the exemption list and three planted-value mutants.
   SBR-012 widens it to the generated artefact, the other two component sets, and the
   "every consumed token resolves" arm (a `var(--tpyo)` renders as *nothing*, which no
   raw-colour check can see).

---

## 6. Driven (s5) — what a browser answered

Two fresh projects created through the real wizard (`SBR-004 Theme Drive`,
`SBR-004 Mounted Drive`), measured in the editor preview over CDP. Both sites are
**unclaimed** — that matters, and §7 says what it costs.

### ✅ SBR-003's carried probe: a `var(--token)` on a dimension port constrains a real box

The probe SBR-003 §2 deferred to "the first task that puts a measure on a real box".

| arm | inline style | computed | rendered width | viewport |
|---|---|---|---|---|
| **known token** | `max-width: var(--site-measure)` | `704px` | **704px** | 988px |
| **unknown token (control)** | `max-width: var(--site-measure-typo)` | `none` | **940px** | 988px |

Same element, same viewport, only the token name varied — so the pair proves what
it varied. `44rem → 704px` is the Studio value resolving through the project's
`designTokens` floor. **AC5's last row is answered, positively, with a
discriminating control.**

⚠️ And the control is also SBR-012's arm 3 in miniature: a typo'd token computes
to `none` and renders as *nothing at all*. No raw-colour check can see that,
which is exactly why SBR-012 owes the "every consumed token resolves" arm.

### ✅ The theme is actually worn

`--site-measure: 44rem`, `--background: #fbfaf8`, `--radius-md: 6px` — the last
one is the project's Studio override, not the shipped `8px` default, so what is
live is this project's `designTokens` block and not the platform floor. The
`frame` node's computed `background-color` is `rgb(251, 250, 248)`. Before
SBR-004 no element consumed either token.

### ✅ AC4's measured half: no horizontal overflow at a phone width

Preview set to **Mobile, common (360 × 800)** — narrower than AC4's ~375px, so a
pass here implies a pass there.

| probe | `document.documentElement.scrollLeft` after `= 9999` |
|---|---|
| the page as built | **0** |
| **control:** a 2000px element planted in `body` | **1640** |
| after removing the control | **0** |

The absence is asserted beside a known-firing signal, so the `0` means "nothing
overflows" rather than "the probe cannot fire". ⚠️ `body.scrollLeft` read `0` in
*both* arms — the `html` element is the scroller here, and a reading taken only
from `body` would have been uninformative in exactly the same shape as a pass.

### ✅ The shape is there, and the 365px hole is gone

`NAV`, `HEADER`, `H1`, `SECTION`, `FOOTER` all present as real elements. After the
`mounted` fix, the shell's children are NAV / HEADER / the card / FOOTER and
nothing else — the hidden wrapper is not in the DOM. See the commit for the
measurement that found it.

## 7. 🔴 Still owed after s5 — and it is AC1 and AC2 themselves

**Both drives were of an *unclaimed* site.** Claiming needs a `SITE_SETUP_TOKEN`
provisioned through the backend's Secrets panel and the setup flow run, which s5
did not reach. So:

- **AC1's person sentence is NOT verified.** What was verified is the ground, the
  measure, the rhythm, the footer and the semantic structure — on a page whose
  only content is "This site has not been set up yet." A visitor's actual first
  impression of a *published* page has not been seen by anyone.
- **AC2 is NOT verified in a browser.** The nav renders zero links on an unclaimed
  site, so "the current link resolves a different colour and weight than its
  siblings" has been asserted in specs and never observed. The `Variable2` →
  state-function path in particular has an **ordering** question that only a
  running nav can answer: whether a link created *after* the page resolved its
  slug gets the value from the direct read (the spec cannot see this).
- ⚠️ **An unexplained observation, recorded rather than guessed at.** On the
  unclaimed page at 360px the `nav` measured **151px** tall and the `header`
  **150px**, against ~33px and ~36px of apparent content. Setting `flex-grow: 0`
  on the shell's children changed neither, so it is not the parent distributing
  space. Every `Group` computes `flex: 100 1 auto` (Noodl's default). Not
  diagnosed; it is what makes the unclaimed page look sparse in the screenshot.
  **Measure it on a claimed page before treating it as a defect** — a page with a
  title and sections may absorb it entirely.

**The next session should claim a site and re-drive AC1 and AC2.** That is one
session's work and it is the half of this task a spec cannot reach.
