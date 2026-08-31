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

---

## 8. Driven on a CLAIMED site (s6) — AC1 and AC2 both FAIL, and why

s5 left §7 owing "claim a site and re-drive AC1 and AC2". Done. The site is claimed,
three pages are published, and **the nav renders links for the first time**. Both ACs
fail, each for a reason a spec could not have reached, and each is now pinned with a
control pair taken on the same page load.

**How the site was claimed** (the recipe works, unchanged from §7's plan):
`SITE_SETUP_TOKEN` written through the backend card's **···  → Secrets** panel — it
landed in `~/.noodl/backends/backend_mtd6grazfqnxl/secrets.json` under the `functions`
namespace, which is the namespace `resolveFunctionSecret` reads (`service.ts:793`).
Then `/admin/setup` with an email, a password and that token. `claimSite` granted the
role and wrote the `SiteSettings` and `Theme` singletons. ✅ **The Secrets panel path
works; s5's note that provisioning by hand was "blocked" was about the file, not the panel.**

### 8.1 🔴 AC2 FAILS on every real page load — the mechanism is right and never runs

| arm (same page, same code, one thing varied) | Home | About | Studio |
|---|---|---|---|
| **as loaded** (`/home`, fresh) | `rgb(0,0,0)` / 400 | `rgb(0,0,0)` / 400 | `rgb(0,0,0)` / 400 |
| **after `Noodl.Variables.siteCurrentSlug` is poked** | **`rgb(30,77,140)` / 600** | `rgb(86,83,76)` / 400 | `rgb(86,83,76)` / 400 |

`rgb(30,77,140)` is `--primary`, `rgb(86,83,76)` is `--muted-foreground`, 600 is
`--font-semibold`. **So both channels §5 built are correct** — colour *and* weight, exactly
as `MUTANT: a current state that changes colour and not weight reddens AC2` demands. What
is wrong is that on a real load the state function **never executes**, so the `Text` keeps
its unstyled defaults and all three links render identically black.

🔴 **The cause is the one §5 predicted and the mitigation does not cover.**
`Site/NavLink`'s `Is this the page being read` carries `runOnChange-in-slug: false` and
`runOnChange-in-current: false`, so its only trigger is the `run` signal from
`Which slug the page is showing.changed`. `/Pages/Site` writes `siteCurrentSlug` *before*
the nav's `For Each` builds the links, so `changed` has already fired by the time a link
exists — and it never fires again. §5's second channel, the direct
`Noodl.Variables["siteCurrentSlug"]` read, is **inside the function body**, so it cannot
help: the body never runs. *A fallback inside a function does not cover the case where the
function is never called.*

⚠️ **And in-app navigation does not rescue it.** Clicking `About` reaches `/about` with
`siteCurrentSlug === 'about'` and the links still measure black/400 — the page component
re-mounts on navigation, so the links are again created after the write. **There is no
path through the running app on which the current-page state appears.** The one arm that
produced it had to write the variable while the links stayed mounted.

✅ **The fix is one parameter, and the table above is its acceptance test**:
`runOnChange-in-current: true` (or `-in-slug`) makes the function run when its inputs
arrive instead of only on a signal that has already passed. Not applied here — it belongs
in `sb006Components.ts`, the template's source, not in a drive project.

> 🔴 **s7 correction — this section's account of WHERE the `false` comes from is wrong,
> and the correct answer is a product defect rather than a template one.**
> `sb006Components.ts` does not author `runOnChange-in-slug`/`-in-current` at all, and
> never did; a reader who went looking for them there would have found nothing. They are
> written on **project load** by the NDA-017 back-compat migration
> (`applypatches.js:71` → `runOnValueChangeMigration.ts`), whose rule is: for any node in
> the fifteen families **whose control signal is connected**, write
> `runOnChange-<input>: false` for the value inputs that signal used to silence. This node
> wires `run`, so it qualifies. See §9.2 — it is not one node, it is 37.

### 8.2 🔴 AC1 FAILS — the nav is a column, and three sections split the viewport

`/home` at 1024×768, claimed, three published pages. The Studio look **is** worn: ground
`#fbfaf8`, serif display face on the `h1`, `--primary` on the footer link, rules under the
nav and above the footer, and the 704px measure. The *shape* is not a site a studio published.

**Two independent defects, each with a control pair on the same load:**

| | as built | control | what varied |
|---|---|---|---|
| **A — nav is a column** | nav **219px**, links at y=37/99/161 (three lines) | nav **68px**, all three links at y=24 in one row | `width: auto; flex-grow: 0` on the links |
| **B — sections split the page** | nav **219** / header **218** / footer **219** | **138** / **98** / **74** | `height: auto` on the three |

🔴 **Both are the platform's own defaults, not something this task authored.** The template
sets only `flexDirection` on these Groups and no size at all.
- `addDimensions` gives every node `width: 100`, `height: 100`, **defaultUnit `%`**
  (`node-shared-port-definitions.ts:813-846`), and `Group`'s `defaultSizeMode` is
  `explicit`, so **an unstyled `Group` is `width:100%; height:100%`** — three stacked
  sections each demand the whole page and end up with a third of it each.
- `Text` is `defaultSizeMode: 'contentHeight'` (`text.ts:149-152`), so it still takes
  `width: 100%`; and `Layout.size` turns a percentage *along* the parent's direction into
  `flexGrow` (`layout.ts:83-88`), which is the measured `flex: 100 1 auto`. **In a
  `flex-wrap: wrap` row every `Text` claims the entire line, so a "bar" renders as a stack.**

⚠️ **This answers §7's undiagnosed 151px/150px observation, and s5's instrument was the
wrong lever.** `flex-grow: 0` changed nothing here either — it is verified 0 in computed
style and the heights held at 219/218/219 — because the height comes from `height: 100%`,
not from grow. The unclaimed page's sparse thirds were the same defect with no links in it.

✅ **What a corrected render looks like** is captured: with A and B neutralised the nav is a
real bar — `Home  About  Studio`, Home in `--primary` semibold — which is AC1's sentence.
That took three inline overrides and no graph change, so the distance to AC1 is small.

### 8.3 🔴 SB-017 §11.1's predicted `prop-` drop is now DRIVEN: the admin cannot create a page

SB-017 §11 priced the browser half by derivation and said *"nothing has ever clicked the
admin panel, so what those 23 cost is still unknown."* It has now been clicked. Its
prediction for `/Pages/Admin` — *"`prop-title`, `prop-slug` on the create node"* — is exact.

**Typing a title and a slug and pressing `New page` POSTs this:**
`{"published":false,"showInNav":true,"navOrder":0,"ACL":{"role:admin":{…}}}` — HTTP **201**,
and **no `title`, no `slug`**. Every row the admin creates has `title: null, slug: null`.

The discriminators, so this is not read as a typing artefact:
- ✅ **Control**: `/Pages/Setup` uses the *same* `net.noodl.controls.textinput` and the *same*
  `onTextChanged → <input port>` wire shape, and all three of its values arrived — the user
  exists and `claimSite` matched the token. The instrument fires.
- ✅ The three `prop-*` that **do** arrive (`published`, `showInNav`, `navOrder`) are exactly
  the three set as **parameters** on the node. `prop-title` and `prop-slug` exist **only as
  connection targets**, and the node's saved `dynamicports` list contains no `prop-*` at all.
- ✅ Not a schema race: a create issued *after* `title`/`slug` columns existed, and again
  after a full viewer reload, dropped them identically.

🔴 **Consequence, and it compounds.** A slug-less page is unreachable (`/Pages/Site` resolves
by slug) and a title-less one renders a **blank nav link** — six of them were sitting in the
nav during the first pass of these measurements. So the ruled SBR-008 fix is not only about
deploy: **the admin→site loop is broken in the local preview too**, which is where every
first impression of this template happens.

### 8.4 ✅ AC4's overflow half re-confirmed on a claimed page

Mobile 360×800, `/home`, three links, real content — the arm §7 could not run.

| probe | `document.documentElement.scrollLeft` after `= 9999` |
|---|---|
| the page as built | **0** |
| **control:** a planted 2000px element | **1640** |
| after removing it | **0** |

Known-firing signal beside the absence, so the `0` means "nothing overflows".

### 8.5 Smaller things this drive found

- ⚠️ **`/Pages/Admin` at 360px: the `New page` button's centre is off-screen.** Its box is
  `left 310 → right 410` in a 360px viewport; `elementFromPoint` hits it at x=355 and
  misses at x=360, and `documentElement.scrollWidth` stays 360, so it is clipped rather
  than scrollable. A `cdp click`, which aims at the centre, lands on nothing. SBR-006's, not
  this task's, but it is a primary action a thumb cannot reliably reach.
- 🔴 **The footer's `Home` link is `--primary` and semibold on every page**, while the nav's
  current link is not (8.1). On the rendered page the *footer* reads as the current-page
  indicator. Whatever fixes 8.1 should be looked at beside the footer, or the two disagree.

### 8.6 What is still owed on this task

1. **8.1's one-parameter fix in `sb006Components.ts`**, with §8.1's table as its test.
2. **8.2's two size defaults**, named explicitly on the public-site Groups and the nav link —
   this is what AC1 turns on, and it is where the "no short paths" ruling bites: the shape
   has to be authored, because the platform's defaults are actively against it.
3. AC3 remains SBR-012's.

> ✅ **1 and 2 are done and driven — see §9.** 3 is still SBR-012's.

## 9. Built and driven (s7) — AC1 and AC2 both PASS, and one finding is bigger than both

§8 left two named fixes. Both are authored in `sb006Components.ts`, regenerated into the
shipped `site-builder.content.json`, and **driven on the claimed site** — the same
`SBR-004 Mounted Drive`, three published pages, nothing hand-poked.

🔴 **What was driven is the shipped artefact, not a retyped copy.** The 11 parameter values
were read out of the regenerated `site-builder.content.json` and applied into the drive
project by label, so a value that differed from what ships could not have been measured.

### 9.1 ✅ AC2 PASSES on a real page load, and after in-app navigation

§8.1's second row, now produced by the running app with nothing poked:

| arm | Home | About | Studio |
|---|---|---|---|
| **`/home`, fresh load** | **`rgb(30,77,140)` / 600** | `rgb(86,83,76)` / 400 | `rgb(86,83,76)` / 400 |
| **`/about`, after clicking the nav** | `rgb(86,83,76)` / 400 | **`rgb(30,77,140)` / 600** | `rgb(86,83,76)` / 400 |

`--primary` + `--font-semibold` on the current link, `--muted-foreground` + `--font-normal`
on its siblings. Both channels, both routes. §8.1's *"there is no path through the running
app on which the current-page state appears"* is no longer true.

**The fix is two parameters and neither could be omitted**: `runOnChange-in-slug: true` and
`runOnChange-in-current: true`. Both, because the three producers arrive in an order the node
does not control — with only `in-current` ticked, a `current` that lands before `slug` hits
the `if (Inputs.slug === undefined) return;` guard and nothing runs the body again.

### 9.2 🔴 The finding: the migration silences the whole template, not one node

**`sb006Components.ts` never authored those `false`s.** They are written on every project
load by the NDA-017 back-compat migration (`applypatches.js:71` →
`runOnValueChangeMigration.ts`): for any node in the fifteen families whose **control signal
is connected**, it writes `runOnChange-<input>: false` for the value inputs that signal used
to silence. That is exactly right for a graph authored before NDA-017 §2 — and the migration
**cannot tell such a graph from one created this morning**, because the project format has
nowhere to record that it already ran (an open question §2 recorded and did not close).

Measured over the drive project, which is a freshly created site-builder project:

> **37 nodes carry a migrated `runOnChange-*: false`. Not one node in the project carries a
> `true`.** Four of those `false`s are the template's own deliberate `NO_LOAD_TIME_FETCH`
> pairs; the other 33 are the migration's.

✅ **Why the fix works anyway**: an already-present key is **never touched, whatever its
value** (the migration's idempotence clause). So writing `true` survives the load — and
*absent* does not. That asymmetry is the whole fix, and it is why the spec asserts the
literal `true` rather than "not `false`".

⚠️ **Most of the other 33 are harmless, and one is not.** They are harmless where the `run`
wire is a real trigger that fires *after* the values — `ContactForm/gather` runs on the send
button's click, and the button is clicked after the fields are typed. The exception is
`/Pages/Site`'s **`The slug to show`**, whose `run` is `Page.didMount` and whose
`in-homeSlug` is now passive: if the `SiteSettings` fetch answers *after* mount, the guard
`if (Inputs.homeSlug === undefined) return;` fires once and nothing ever re-runs it.

**Driven, at the root URL `/`**: `Noodl.Variables` holds **0 keys**, `siteCurrentSlug` is
`undefined`, the `h1` is empty and the page body is `Home About Studio / My site / My site /
Home` — nav and footer, no page. The front door renders no page. `/home` and `/about` are
fine, so this is the empty-slug path specifically, which is the one that needs `homeSlug`.

🔴 Nothing this session changed is upstream of that node — `sizeMode` is pure layout and the
`NavLink` state node only *reads* the variable this one writes — so it is not a regression
from §9.1, but it was not measured before either. **It is the next thing to fix on this
template and it is worth more than the two above**: it is the URL every first visitor types.

### 9.3 ✅ AC1 PASSES — the bar is a bar and the bands are their own height

`/home` at 1024×768, claimed, three published pages:

| | §8.2 as built | §8.2 control | **s7 as authored** |
|---|---|---|---|
| nav | 219px, links at y=37/99/161 | 68px, one row | **68px, all three at y=24** |
| header | 218 | 98 | **98** |
| footer | 219 | 74 | **74** |

The rendered page is AC1's sentence: `Home  About  Studio` on one rule-bottomed row, Home in
`--primary` semibold, serif display `h1`, 704px measure, warm ground.

The lever is `sizeMode`, on seven `Group`s (`contentHeight`) and the nav link `Text`
(`contentSize`) — collected as `STACKED_IN_A_COLUMN` so the reason is written once.
🔴 **Confirming §8.2: `flex-grow` is not the lever and must not be re-tried.**

⚠️ **`maxWidth` was authored as AC4's guard, driven, and REMOVED — the parameter never
reaches the DOM on a `Text`.** With `maxWidth: { value: 100, unit: '%' }` set on the nav
link, `getComputedStyle(link).maxWidth` reads **`none`** on the claimed site, while on the
same page load `Page ground`'s `minHeight` (`100vh`) and `Page shell`'s `maxWidth`
(`var(--site-measure)`) — same port family — both render on their `Group`s. Shipping it
would have been a parameter nothing reads. **This is a product defect worth its own look**:
`maxWidth` is a declared, unconditional port on `Text` (confirmed in the catalog) that the
runtime does not apply.

### 9.4 ✅ AC4 still holds, measured rather than assumed

The reason the removal above is safe. 360×800, `/home`, claimed:

| probe | `documentElement.scrollLeft` after `= 9999` |
|---|---|
| as built, three real links | **0** |
| **control:** a planted 2000px element | **1640** |
| after removing it | **0** |
| **a 51-character page title in the nav** | **0** (box overhangs by 63px, but nothing scrolls) |

So a very long title is **clipped**, not scrolled — the same shape as §8.5's admin button,
and SBR-006's rather than this task's. AC4 as written holds either way, which is what makes
`maxWidth`'s removal a correction rather than a regression.

### 9.5 🔴 The gate had a hole shaped exactly like both defects

**All 49 specs in `sb006PublicSite.test.ts` were green while AC1 and AC2 both failed on a
real page.** Three checks now close it, each with a mutant that reddens:

1. **AC2** runs the *real* `planRunOnValueChangeMigration` over the *real* written artefact
   and asserts no write names `/Site/NavLink` — beside `plan.writes.length > 0` and
   `plan.signalDrivenNodes > 0` as the known-firing signal, because "no write names the
   link" passes for free on a plan that writes nothing. It imports the migration rather than
   restating its rule: a re-implementation would agree with a migration that had changed
   underneath it, which is the failure being fixed.
2. **AC1** walks the whole *placed* tree across component boundaries — a component's visual
   root is laid out by whatever placed the instance, which is how `Site/Nav`'s row reaches
   the nav link's `Text` two components away — and reds on any `Group`/`Text`/`Image` still
   on the defaulted percentage along its parent's direction. Legitimate growers are named in
   `FILL_THE_PARENT_EXEMPTIONS` with a reason. Its census asserts the **ordered list of every
   node reached**, so a hop that silently stops reds rather than reporting a clean page.
3. Both mutants call **the same function the green arm calls**, not a restatement of it.

## 10. Built (s8) — the root URL's cause is fixed, and the census found how many more there were

§9.2 named `/Pages/Site`'s `The slug to show` and left it. This section fixes it, and then
stops trusting the sentence §9.2 used to wave the other 32 nodes through.

⚠️ **The drive is owed and could not run.** Richard was hand-driving the only editor stack on
this machine (pid 6774, TPL-001) for the whole session; a second editor cannot coexist and
launching would have taken the app out from under him. Everything below is source, artefact and
spec. **AC-grade verification of the root URL is the first thing s9 owes** — the exact probe is
in §10.4.

### 10.1 The fix

Two parameters on `resolveSlug` in `sb006Components.ts`, regenerated into
`site-builder.content.json`:

```
'runOnChange-in-slug': true,
'runOnChange-in-homeSlug': true,
```

Same asymmetry as §9.1's: the migration never touches an already-present key, so `true`
survives the load and *absent* does not.

**The ordering consequence §9's handoff asked to check first, checked.** `out-slug` is
`pageQuery`'s only trigger — a `qp-` set calls `scheduleFetch` (`dbcollectionnode2.ts:1069`) —
so "runs again" really does mean "the page queries again". It costs nothing here, and the reason
is the guard rather than luck: a run before `homeSlug` publishes **nothing**, so the first run
that reaches the body is the first fetch, not a second one. `homeSlug` is published once per
load by a singleton read.

### 10.2 🔴 `in-slug` is not merely defensive, and the reason is a branch in the router

§9.1 justified the `NavLink` pair with "the producers arrive in an order the node does not
control". For `resolveSlug` there is a sharper reason, and it is in `router.tsx`:

- **`router.tsx:586`** calls `_updatePageInputs` **before** `addChild(group)` puts the page in
  the tree. So a `PageInputs` value is present when `didMount` fires. That is what makes
  `in-slug` safe at mount — and it is the measured version of the wire comment that asserted it.
- **`router.tsx:518-534`** is the *same-page* branch: navigating to a page whose snapshot is
  unchanged with **different parameters** updates the page inputs, reports `done`, and
  **returns without re-mounting**. No `didMount`.

`/Pages/Site` is `{slug}` — every public page is that one component. So on the same-page branch
the *only* thing that can re-resolve the slug is `in-slug` changing, and with it silenced
nothing would.

⚠️ **This is not yet a claim that in-app nav was broken.** §9.1 drove `/home` → `/about`
pre-fix and the current-page state followed, which means that click did not take the same-page
branch (or something else re-ran the node). **Unresolved, and worth one probe in s9**: click
between two site pages and read whether `didMount` fired. Either answer is worth knowing — if
it did not, `in-slug: true` fixed a second live defect nobody had named.

### 10.3 🔴 The census: 27 nodes silenced, and only one of them was a bug

§9.2 cleared the other nodes with a sentence — *"they are harmless where the `run` wire is a
real trigger that fires after the values"*. That is a claim about 32 nodes, made from the
armchair. Run mechanically over the shipped artefact, the real migration silences:

| | |
|---|---|
| family nodes in the artefact | 49 |
| …with the control signal wired | 32 |
| **nodes written** | **27** (48 parameters) |
| already answered, so preserved | 12 |

And the sentence turns out to be **right, for a reason it did not state**. Every control signal
in the census except one is a *consequence* — a query's `fetched`, a button's `onClick`, a
request's `receive`, a secret's `completed`, a `For Each`'s row signal — and a consequence
arrives after the values that caused it. **The template has exactly one control signal that
fires on a clock its values do not share: `Page.didMount`.** Two nodes are triggered by it:

| node | silenced input | verdict |
|---|---|---|
| `/Pages/Site` `The slug to show` | `in-homeSlug` ← the `SiteSettings` read | 🔴 **the defect** — an async producer against a mount |
| `/Pages/PageEditor` `Hold the page id` | `in-pageId` ← `PageInputs` | ✅ safe, and *measured* safe: `router.tsx:586` |

So the finding is not "one node was unlucky". It is that the property which separates a harmless
silencing from a page that never renders is **whether the silenced input's producer is ordered
before the control signal**, and the template has exactly one producer with that guarantee.

### 10.4 The gate that now holds it, and what s9 must still drive

`sb007Template.test.ts` — artefact-wide, because the defect was never SBR-004's:

1. **Known-firing signal first**: the migration writes on this artefact in bulk. Every absence
   below would pass for free on a plan that writes nothing.
2. **The grader**: for every node the migration silences that is triggered by a mount signal,
   each silenced input's producer must be one the runtime orders before mount (`PageInputs`) or
   there must be no producer at all. It asserts the **reason column**, not just the emptiness —
   a pass that graded nothing satisfies `offenders == []` exactly as well as one that cleared
   every row for a stated reason, and those are not the same claim.
3. **The mutant calls the grader**, not a restatement of it: drop the two checkboxes and the
   artefact reddens with the defect as it actually shipped.

🔴 **The mutant discriminates more finely than the fix does, and that is worth keeping.** It
reds on `in-homeSlug` **alone** and *clears* `in-slug` for a stated reason. The migration
silences both; only one is a race. A grader that named both would be naming the port list.

**Owed in s9 — the AC-grade drive, on `SBR-004 Mounted Drive` (claimed, three published pages),
after applying the regenerated artefact's parameters by label:**

| probe | at | expect |
|---|---|---|
| `Noodl.Variables` key count | `http://localhost:8574/` | > 0 (was **0**) |
| `Noodl.Variables.siteCurrentSlug` | `/` | `'home'` (was `undefined`) |
| the `h1` | `/` | the home page's title (was empty) |
| the body text | `/` | a page between the nav and the footer |
| regression | `/home`, `/about` | unchanged from §9.1 |
| §10.2's open probe | click nav `/home` → `/about` | did `didMount` fire? |

## 11. Driven (s8b) — the fix holds, and §9.2's characterisation of the defect was wrong

Seat freed mid-session. Driven on `SBR-004 Mounted Drive`, claimed, three published pages,
backend `backend_mtd6grazfqnxl` on 8594 (`SiteSettings.homeSlug = 'home'`, `home`/`about`/`studio`
all `published=1`, read off the backend's own sqlite before driving).

🔴 **The project was a genuine before/after control on one artefact.** Its saved
`The slug to show` still carried `runOnChange-in-slug: false` / `-in-homeSlug: false` — written
by the migration on an earlier load, untouched since 21:00 — so arm 1 is the defect as it
shipped, not a reconstruction. Only then were the two shipped values applied **by label** out of
the regenerated `site-builder.content.json`.

### 11.1 🔴 The first reading was a PASS, and it proved nothing

Pre-fix, at `/`: `varKeys: 1`, `siteCurrentSlug: 'home'`, `h1: "Home"`. The page rendered.
**Twelve consecutive reloads: twelve passes.** §9.2's own words are why this is not a
refutation — *"a race it wins only by luck on a local backend"* — and a race won by luck reads
exactly like a race that has been fixed. Both arms would have agreed, which is a **broken
instrument, not a result**.

So the race was forced to lose. `Fetch.requestPaused` on `*8594*` in the viewer target delays
**only** the backend requests by 1500ms; the page bundle is untouched, so `Page.didMount` still
fires on its own clock. That is precisely the ordering the defect needs, and nothing about the
graph is altered to produce it.

### 11.2 ✅ The control pair, 1500ms delay held constant, only the two parameters varied

| path | **pre-fix** (`false`/`false`) | **post-fix** (`true`/`true`) |
|---|---|---|
| `/` | `varKeys 0`, `h1 ""`, body `Home About Studio My site My site Home` | `varKeys 1`, slug **`home`**, `h1 "Home"` |
| `/home` | `varKeys 0`, `h1 ""`, same bodyless body | `varKeys 1`, slug **`home`**, `h1 "Home"` |
| `/about` | `varKeys 0`, `h1 ""`, same bodyless body | `varKeys 1`, slug **`about`**, `h1 "About"` |

`/about` resolving to `about` rather than `home` is what says the fix re-runs the resolver
rather than merely forcing the home slug.

⚠️ **Corroborating detail, unplanned**: the delayed-request count rose **3 → 5** across the
arms. Pre-fix the page query never fires at all, because `out-slug` never publishes. The two
extra requests *are* the page and its sections being fetched — the mechanism, visible in the
network rather than inferred from the DOM.

**No-delay regression, post-fix**: `/`, `/home`, `/about` all render, slugs `home`/`home`/`about`.
**AC2 re-measured**: `rgb(30,77,140)`/600 on the current link, `rgb(86,83,76)`/400 on its
siblings, on both routes — unchanged from §9.1. **AC1 re-measured**: all three links at y=24.

### 11.3 🔴 The correction: this was never the empty-slug path

§9.2 wrote *"`/home` and `/about` are fine, so this is the **empty-slug path specifically**,
which is the one that needs `homeSlug`."* **That is wrong, and the table above is the
refutation**: with the fetch slowed, all three paths render no page.

The guard is `if (Inputs.homeSlug === undefined) return;` and it gates **every** slug, not the
empty one. `/home` does not need `homeSlug` to *compute* its answer, but it still has to get
past a line that returns before the computation. So the true statement is:

> **Every page on the site fails whenever the `SiteSettings` fetch answers after mount.** The
> root URL was not a special case — it was the case that happened to lose the race on a warm
> local backend, which is the least representative environment the site will ever run in.

That makes the defect materially worse than recorded, and it is worth carrying into SBR-014:
the first visitor to a deployed site, on a cold backend over a real network, is the arm this
template had never been driven in.

### 11.4 ✅ §10.2's open probe, answered — and the first instrument was wrong

Question: does an in-app nav click take `router.tsx:518-534`'s same-page branch (no `didMount`)?

First attempt stamped the `h1` with an expando, clicked `About`, and found the stamp gone —
but a React re-render can replace an element for reasons that have nothing to do with mounting,
so that reading does not discriminate. The stamp was widened to the nav and the footer as a
control, and **all three died**, which looked like a full document load.

**The decisive probe is a `window`-level marker**, because it separates the two candidates a DOM
stamp cannot: `window.__docMarker` **survived** the click while every element stamp died, and
`performance.navigation.type` stayed `navigate`. So: **same document, whole page subtree rebuilt
— the page component remounts and `didMount` does fire.**

⚠️ And a correction to §10.2's framing while it is here: the nav and footer are **not** outside
the page component — `SITE_WIRES` puts `footerName`/`goHome`/`footerHome` in `/Pages/Site`, and
`Site/Nav` is an instance placed inside it. Everything visible is inside the page, so all stamps
dying was consistent with a page remount all along; it was the *control* that was misdescribed,
not the measurement.

**Consequence**: `runOnChange-in-slug: true` did **not** fix a second live defect on this path,
and §10.2's suggestion that it might is closed. It remains correct to ship — `in-slug`'s producer
is `PageInputs`, the spec grades it as ordered-before-mount, and it costs nothing — but it is
defensive, and the sentence claiming otherwise should not be relayed.

### 11.5 AC status

**AC1 ✅, AC2 ✅, AC4 ✅** (§9, re-measured here). **The root URL renders**, driven, with a
control pair rather than a single pass. AC3 remains SBR-012's. 🔴 §11.3's widening — every page,
not just `/` — is the thing to carry forward.

---

## 12. 🟢 AC3 MET — s35, by SBR-012. **SBR-004 is CLOSED, all four ACs.**

AC3's sentence is *"every style value is a token, or a named exemption, and SBR-012's gate is
green."* It read on **SBR-012's** gate by construction, and that gate now exists:
**`packages/noodl-mcp/tests/sbr012RawColourGate.test.ts` — 25 specs**, over the two populations
§5's *Still owed* named — the generated artefact **and** all four component sets.

| what SBR-004 shipped as the seed | what SBR-012 added |
|---|---|
| a scan over the **five SB-006 component sets** | the **generated artefact** (289 KB) and the other component sets, including `sb007Template.ts`'s `App` shell |
| three planted-value mutants | **six** — hex on a colour port, hex in a **script body**, hex in the **artefact only**, `var(--tpyo)`, a token **deleted** from the universe, and an unnamed dimension |
| the exemption list, keyed `label \| port` | keyed **`component \| label \| port`** — the template has several nodes labelled `Heading` and exactly one sets a raw width |
| — | 🆕 the **"every consumed token resolves"** arm: 33 distinct names, 284 uses, **0 unresolved** |

**HEAD reads zero on every arm.** 🔴 That is only believable because the instrument's **reach** is
asserted as a floor in the same run — 24 components, ≥500 parameter rows, ≥30 script bodies
including `applyTheme` by name — and because every arm is paired with a plant that must red.

⚠️ **The widening immediately found one thing the seed could not see**:
[D35](DEFECTS-THE-SITE-BUILDER-FOUND.md#d35), `/Pages/Setup`'s `Form` spacing itself with a bare
`24` where `--space-6` **is** `24px`. It is fixed. The seed's population — SB-006's five
components — did not contain it, which is the whole argument for the second population.

🔴 **§11.3's widening (every page, not just `/`) is a DRIVE, and it remains SBR-014's**, not AC3's.
Closing this task does not close that.
