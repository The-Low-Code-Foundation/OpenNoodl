# Phase 81 — The Look Is The Product

**Opened 2026-08-31, by Richard's ruling after driving the members' area template (TPL-001).**

## The ruling, verbatim

> Every fix in the new phase MUST be tested against an actual screenshot of an actual page and
> PROPERLY evaluated as "is this shitty and boring like a WordPress starter template, or something
> worthy of modern vibe coding pages?" and if not we have to figure out why. This is the CORE of
> NodeGX and if we fuck this up, I'm fucked.

That sentence is this phase's acceptance criterion, gate, and method. Nothing in this phase closes
on a spec count, a parameter census, a token count, or a drive suite. **A task closes when a
screenshot of a real rendered page has been LOOKED AT and judged WORTHY** (protocol in §3). Every
other kind of green is plumbing.

## §1 Why this phase exists — the diagnosis it is built on

Two templates (P76 site builder, P78 members' area) shipped through fully green gates and were
unusable-looking when Richard opened them. The full diagnosis was done 2026-08-30/31 (session
records; mechanisms verified against source). Summary, so no session re-derives it:

**(a) The instruments graded a different world.** Every drive/look provisioned + seeded a backend
and signed in before the first paint, at 1280/390 only. The user's door — open in editor, press
preview, no backend, wide window — was graded by *nothing* (P78's own D9 says so). The harness even
raised its viewport to 1600px tall to get content above the fold instead of treating the fold as
the finding.

**(b) The runtime's defaults ambush layout.** A `Group` with no `sizeMode` is explicit 100%×100%
(`group.ts:492` → `addDimensions` defaults) and in a column becomes `flexGrow:100` — "consume the
viewport, ignore content height" (`layout.ts:93-101`). Nothing scrolls unless `scrollEnabled` is
set (zero hits in the whole members-area artefact); `clip:true` silently amputates overflow. Hence
the ~690px dead gaps and the unreachable Setup form. The MCP door has no diagnostic for any of it.

**(c) The kit's expressive ceiling is "flat-colour bootstrap."** 13 token categories, none
decorative — no gradient, image background, opacity, blur, layering. One `backgroundColor` port on
`Group`. 26 compositions, **zero** marketing ones (no hero/ctaBand/featureItem/statTile/
testimonial/footer). Display type effectively capped at 48px by the doctrine's own advice. The kit
source itself quotes Richard's "standard bootstrap feel" and says *"the cause is in the kit."*

**(d) Imagery is possible and starved.** Image node, Icon node, 1,998 seeded Lucide glyphs — and
zero of any of them in the template. All 62 catalog examples ship `"src": ""`. `templates/` is 91
files, all JSON — no template has ever shipped an asset.

**(e) The instruction diet is asymmetric.** The design doctrine (`prompts/design.ts`) demands
richness — and is a once-read response field. The per-turn surfaces (tool descriptions, server
instructions) are 100% "don't deviate." Every "do less" rule has a gate
(`raw-color-literal`, `repeated-sibling-subtree`, byte-identity); **no gate anywhere fires on
poverty**. All 13 render-measure findings are defect detectors. "Beautiful"/"polish"/"aesthetic":
zero occurrences in noodl-mcp source.

**(f) The corpus has no page.** The richest shipped example is an 11-node hero *fragment* with an
empty image. A model imitating the corpus has nothing to imitate above the section.

Consequence: an authoring model (Claude) that produces genuinely good landing pages in raw HTML
produces stacked-Groups-in-a-column here — not because it can't, but because the medium caps it,
the corpus doesn't show it, the brief doesn't ask for it, and the gates punish only excess. **The
competitive frame is real: "I'll just have Claude Code build it full-stack" is the rational user
response until the MCP door stops subtracting Claude's strongest capability.**

## §2 What WORTHY means — the rubric

The question, always in the phase's own words: *"Is this shitty and boring like a WordPress
starter template, or something worthy of modern vibe coding pages?"*

**WordPress-starter tells** (any one of these on a marketing/landing surface is disqualifying):
- One narrow centred column of stacked text, one background colour end to end
- No imagery and no iconography anywhere on the page
- Type ramp reading as two sizes; headline under ~48px on desktop
- Bordered grey boxes as the only structure; buttons that look like browser defaults
- Content islands floating in dead viewport space; placeholder-grade copy

**Vibe-worthy tells** (a WORTHY page shows most of these, deliberately):
- A real hero: display type with tight leading on a designed ground (gradient, image, or a
  composed colour field), not a bare heading on white
- Depth: layering, shadow, translucency, or overlap used somewhere with intent
- At least three visually distinct section treatments on one page (ground changes, not just gaps)
- Icons/images doing actual communicative work (feature rows, tiles, avatars)
- A palette that reads chosen, not default; rhythm — alternating grounds, intentional whitespace
- Copy in a specific voice (the doctrine's own §10 standard)
- Holds up at 390, 1280, **and ~1900** wide, and in the editor's default preview

**Verdict scale: SHITTY / PASSABLE / WORTHY.** Only WORTHY closes a task. PASSABLE is recorded
progress, never a close.

🔴 **Legible and operable is the floor, not a grade** (Richard's ruling on the VIB-001 baseline,
2026-08-31: *"passable in terms of you can at least see the elements clearly and interact, but they
still look like original Wordpress default templates"*). Every WordPress default template is legible
and operable — that is what a default template is for. A verdict awarded for it is measuring the
precondition for judging, not the thing being judged. **This clause exists because the first
baseline scored two pages PASSABLE on exactly that mistake; both are now SHITTY.**

**App-chrome pages** (forms, lists, settings) are exempt from the *marketing* tells — a settings
page needs no hero, no gradient ground, no 72px display type, and demanding one would be wrong.
They are **not** exempt from the default-template test, which is the same for every surface:

> **Does anything on this page show a decision?** A considered density; a real hierarchy of action
> weight; iconography doing work; a treatment for state. Or is it the framework's defaults with this
> app's content poured into them?

Full-width bordered inputs stacked in a card, or ruled rows with outline-secondary pills, are what a
form library and a list component emit before anyone has designed anything. They are SHITTY however
clearly a person can read them.

## §3 The judgment protocol — how every task closes

1. **Render the actual page** through the VIB-001 harness. Never a mockup, never the generator's
   source, never a description of what it should look like.
2. **Both states**: the user's door (no backend bound, nothing seeded, not signed in — the state
   every new user meets first) AND the living state (provisioned, seeded, signed in). A page may
   not be WORTHY in one state and unjudged in the other.
3. **Three widths minimum**: the editor preview default (988×313 — yes, really, that is what a
   user sees first), 1280, and ≥1900. Never raise a viewport to make content fit — the fold is a
   finding, not an obstacle.
4. **LOOK at the PNG.** The session reads the screenshot as an image and writes the verdict in the
   task file: verdict + which rubric tells fired, in sentences. A verdict written without the
   image in context is void.
5. **Richard's look supersedes.** A session's WORTHY is provisional until he has seen it; his
   SHITTY reopens the task regardless of any other green.
6. **If not WORTHY: the why is mandatory work, not commentary.** Name the seam that blocked it —
   VOCABULARY (kit can't express it) / CORPUS (nothing to imitate) / INSTRUCTION (nothing asked
   for it) / GATE (something refused or punished it) / RUNTIME (a default or engine behaviour
   broke it) — and file it as a register row with an owner in this phase. "It just needs more
   polish" is not a seam.

## §4 Phase rules

- 🔴 **No proxy may close a task.** Parameter counts, token counts, composition-coverage lists,
  drive-spec counts — all fine as plumbing, none of them evidence about the look. This is the rule
  P78 wrote in prose and then shipped past; here it is the close condition.
- 🔴 **The screenshot state must be the honest one.** No pre-seeding a page and calling it the
  first run; no viewport engineering; no cropping the dead space out.
- 🔴 **Scope by dependency only. No time estimates, no "quick win" framing** (Richard's standing
  instruction).
- 🔴 **Findings go in the register with an owner or `NONE`** — never absorbed into prose.
- ⚠️ Overlaps to respect: P80 owns door-correctness defects (keep owning them); P78 T6 owns
  D22/D23/D24 template copy fixes; P77 owns site-builder machinery. This phase owns **the look and
  everything that structurally caps it**. Where a fix lands in product source that P80 would also
  touch, cross-link the rows rather than duplicating.

## §5 The board

| task | name | what closes it |
|---|---|---|
| VIB-001 | The Judge | The screenshot+verdict harness exists, runs on both shipped templates at the honest states/widths, and its first verdicts are recorded (they will be SHITTY — that is the baseline, not a failure of the task) |
| VIB-002 | The Ceiling | Gradients / image grounds / depth expressible through the sanctioned vocabulary, and a page using them judged WORTHY-capable (the capability renders, on system) |
| VIB-003 | The Pictures | A template can ship image assets; icons and images appear in rendered output; the empty-`src` example corpus is fixed |
| VIB-004 | The Marketing Kit | Hero / ctaBand / featureItem / statTile / footer (and peers) exist as compositions and render as designed sections |
| VIB-005 | The Ambush Defaults | The sizeMode/scroll/clip traps get door diagnostics + doctrine + a page-ground composition that scrolls; the members-area gap/no-scroll class becomes impossible to author silently |
| VIB-006 | The Worked Page | At least one complete, designed landing page in the example corpus — the thing a model can imitate. 🟢 **CLOSED 2026-08-31, WORTHY, ruled by Richard** (*"it looks fucking pro… VIB 006 screens are amazing"*) — the phase's first close on the look |
| VIB-007 | The Brief | Ambition moves into the per-turn instruction surfaces; render-measure gains poverty findings so gate pressure is two-directional |
| VIB-008 | The Members' Area, Redeemed | TPL-001's first-run degradation fixed (no-backend state designed, gating fails closed, layout/scroll fixed) and its landing judged WORTHY |
| VIB-009 | The Site Builder, Redeemed | Same bar for the site-builder public site |
| VIB-010 | The Cold Proof | A fresh app authored through the MCP door by an agent with no special coaching comes out WORTHY — the end-to-end proof that the pipeline, not heroics, produces the look |

Dependency order: VIB-001 first (it is the instrument everything else is judged by). VIB-002/003/
004/005 are the capability tier and can proceed in parallel after it. VIB-006/007 consume the new
capability. VIB-008/009 prove it on the shipped templates. VIB-010 is the phase's exit exam.

## §6 The register

| id | finding | seam | owner | status |
|---|---|---|---|---|
| V1 | Un-`sizeMode`d Group in a column = flexGrow:100, eats viewport; door silent | RUNTIME/GATE | VIB-005 | 🔴 open |
| V2 | Nothing scrolls unless opted in; `clip:true` amputates silently; no scrolling page-ground pattern exists | RUNTIME/VOCABULARY | VIB-005 | 🔴 open |
| V3 | Members chrome ungated; `Visitor` redirect rides `done` only — fail-open on backend absence | template | VIB-008 | 🔴 open |
| V4 | Landing page has no state for "query never answered" — first-run renders eyebrow + buttons | template | VIB-008 | 🔴 open |
| V5 | No gradient/image-ground/opacity/layering anywhere in the sanctioned vocabulary | VOCABULARY | VIB-002 | 🟢 **closed 2026-08-31 — AND CORRECTED.** Measured at the door before building: `opacity`, `mixBlendMode`, `zIndex`, `position` (incl. absolute/sticky) and the `boxShadow*` family were **already ports on Group**; layering and depth were expressible and simply never taught. Only `backgroundImage` answered `notFound`. VIB-002 added the missing ground (5 ports), 10 tokens, 3 compositions, 2 recipes and the doctrine that teaches all of it |
| V6 | Zero marketing compositions of 26 | VOCABULARY | VIB-004 | 🟢 **closed 2026-08-31 — AND THE ROW WAS MATERIALLY WRONG.** Measured at the door before building: **five of the seven** arrangements it asked for already shipped as gated recipes (`ui-split-hero`/`ui-gradient-hero`, `ui-icon-feature-strip`, `ui-stat-tile-row`, `ui-footer-columns`, plus VIB-002's grounds). The kit could always express a marketing page; **none of it was a NAMED SET**, so an agent reading `get_style_vocabulary` saw `card`/`shell`/`sectionHead`/`field` and had no evidence a stat tile was a thing this system has an opinion about. VIB-004 added seven compositions and the two recipes that genuinely had nothing to source from (`ui-cta-band`, `ui-testimonial-row`). 🔴 Fourth time in this phase that *can the kit do X* answered *yes, and nothing taught it* — after V5, V13 and V20 |
| V7 | Templates cannot/do not ship assets; all example images are `src:""` | CORPUS | VIB-003 | 🟢 **closed 2026-08-31 — AND THE ROW WAS MATERIALLY WRONG.** Re-derived over all 64 examples: **4 of 5** `Image` nodes take `src` over a connection (correct authoring), **2 of 3** `Icon` nodes already carried complete Lucide values *including* `codeAsClass`. The corpus defect was **two nodes**, not sixty-two. What was actually missing: anything on disk for a `src` to point AT (now `noodl_modules/starter-imagery/`, 6 generated SVGs in `STARTER_ASSETS`), a door that can describe an icon value (§V20), and an instrument that could photograph one (§V19) |
| V8 | No worked full-page example in the corpus | CORPUS | VIB-006 | 🟢 **closed 2026-08-31 — and the row was RIGHT, harder than it said.** Re-derived over all 66 examples before building: **the most top-level visual bands on any `Page` node was 2**, and that one (`nav-url-product-page`) is a routing example; **zero** examples had four bands, and **zero** had three bands with a picture and a glyph. The corpus was not short of a *good* page — it had never contained a page at all, because every marketing recipe ships as a bare `/Components/<Something>` with no `Page` around it. `docs/node-catalog/examples/ui-landing-page.json` now ships: 14 components, 129 nodes, **8 bands on a 9-node page**, 7 distinct grounds, 8 distinct photographs, three different faces, 67/67 strict. 🔴 **The shape came from a gate that was already green**: `oversized-page` is an INFO and does not fail a run, and its sentence — *"above about 40 a page has usually inlined sections that wanted to be components of their own"* — is what turned a 90-node page into eight section components |
| V9 | Per-turn instruction surfaces carry zero ambition; design doctrine is once-read | INSTRUCTION | VIB-007 | 🔴 open |
| V10 | All render/authoring gates fire on excess only; nothing fires on poverty | GATE | VIB-007 | 🔴 open |
| V11 | No instrument renders the user's door state (no backend, preview viewport, wide) | GATE | VIB-001 | 🔴 open |
| V12 | `repeated-sibling-subtree` fires on structure alone at 3 — three *different* feature cards trip it; richness costs a component file | GATE | VIB-004 | 🟢 **closed 2026-08-31 — the row's premise does not hold.** The rule skips any subtree below `MIN_SUBTREE_NODES` (3), and **a component instance is one node with no children**, so three placements of `/Components/FeatureCard` are invisible to it. The factored form the warning's own message recommends (*"make one component and instantiate it N times"*) cannot trip it. Richness costs a component file and **draws no warning for it**. Six specs existed and **none covered the instance case**; three do now (`tests-unit/phase-54/repeatedSiblingSubtree.test.ts`, 9/9, one a control that reddens if the rule stops working at all). ⚠️ True residue: the warning fires on hand-duplicated subtrees, which is what it says it does |
| V13 | Doctrine talks display type down to 48px; no responsive type story | VOCABULARY/INSTRUCTION | VIB-002 | 🟢 **closed 2026-08-31.** `--display-sm/md/lg` are `clamp()` tokens — 44px at 390 and 96px at 1900 from one parameter, with **no runtime change**, because a token's value is emitted verbatim into `:root`. What was missing was never a responsive `fontSize` port; it was a token that scales. The doctrine paragraph that created the ceiling is replaced |
| V14 | `text-input.ts:97` defaults `placeholder` to `"Type here..."`; the members-area artefact sets `placeholder` explicitly **once** in the whole template, and the site builder's SignIn sets it never — so every field of every shipped form reads "Type here...". A runtime default that manufactures placeholder-grade copy, and no gate fires on it | RUNTIME/GATE | VIB-005 | 🔴 open |
| V16 | The site builder's four section kinds are **one layout** — `SECTION_VIEW` dispatches on `kind` to change only font weight/size/family and image visibility; no kind changes ground or arrangement and `cta` emits no button. A page using every kind the product has is still one column of stacked text | VOCABULARY | VIB-009 (cross-link V6) | 🔴 open |
| V17 | 🔴 **V1 defeated a brand-new, gate-clean recipe written by a session that had just read V1.** `ui-image-scrim-band`'s shell carried no `sizeMode`, became `flexGrow:100` in a column and filled its 520px band, so the band's `justifyContent: flex-end` had nothing to justify and the copy sat at the TOP with the scrim's dark end under nothing. Every gate passed; `unreachablePx` was 0. Confirmed by a control pair (adding `sizeMode` moved the copy, nothing else changed). Before/after PNGs kept in `verdicts/vib-002/2026-08-31/` | RUNTIME/GATE | VIB-005 (evidence for V1, not a second row) | 🔴 open |
| V18 | `scripts/devtools/render-from-disk.js` rebuilds `:root` by regex (`name:\s*'…',\s*value:\s*'…'`) when no editor is listening, and `\s*` does not cross a `//`. **A comment written between a token's `name:` and its `value:` makes that token silently absent from every page the Judge photographs, while being perfectly present in the product** — a harness that lies in the direction of "your new capability does nothing". Caught before it produced a verdict; a warning comment now sits in `DefaultTokens.ts` | GATE (instrument) | NONE — recorded; the tripwire is the comment | ⚪ recorded |
| V19 | 🔴 **The Judge photographed a project state nobody has ever had.** `copyTemplateProject` copies `templates/members-area/` verbatim — 91 JSON files, no `noodl_modules/` — while `createFromTemplate.ts:119` calls `installStarterAssets` on **every** creation path. So every baseline PNG was rendered without Inter, and **no icon could have appeared in any photograph whatever the artefact carried**: there was no module to inject. Two examples had carried correct Lucide values since August and neither was photographable. The nine SHITTY verdicts do not move — a typeface is not what made them SHITTY — but a later verdict about typography would have been void | GATE (instrument) | VIB-003 | 🟢 **closed 2026-08-31.** `judge()` copies the project to a temp directory, installs from the **imported** `STARTER_ASSETS` list and records `written`/`skipped`/`failed` in the manifest. ⚠️ Serving a copy is load-bearing, not tidiness: the first version wrote 17 files into a checked-in demo project and the *second* run then failed its own honesty assertion |
| V20 | 🔴 **The door mis-taught the one value that produces an icon.** `parameterValues`' `icon` hint offered `{"class":"material-icons","code":"search"}` — a set **no project created here has** — and accepted a bare string, the value FB-019 measured as an undrawable empty span and fixed the runtime to refuse. And `{class, code}` is two thirds of a value: `IconGlyph` branches on `codeAsClass === true`, so for Lucide (what every project gets) the hint's own shape renders the glyph's NAME as visible text. `packages/noodl-mcp/src` contained two incidental occurrences of "icon" and `get_style_vocabulary` named no set, no glyph and no shape | GATE / INSTRUCTION | VIB-003 | 🟢 **closed 2026-08-31.** `get_style_vocabulary` gains an `icons` block built by the picker's own `iconValueForGlyph`; the gate rejects the string, accepts the sprite arm it used to refuse, and names `codeAsClass`. 6 spec rows, 3 mutations each redding only their own row. ⚠️ **Sub-finding, owner `NONE`**: 102 of 102 `iconIconSource` parameters in the prefab library are `material-icons`, a **library module a person adds** — whether the prefab install path carries it was not measured, and is P65's question |
| V21 | 🔴 **An `Icon` with no `iconColor` is `#FFFFFF`.** `addIconInputs` defaults it, so a correct, complete, drawable icon value renders **white on a white page** and produces nothing visible. Found by looking: `vis-columns-media-cards`' favourite glyph was invisible in the first VIB-003 photograph. **This is V14's shape exactly** — a runtime default that manufactures a defect, with no gate anywhere on it — one node along | RUNTIME/GATE | **VIB-005** (with V14) | 🔴 open |
| V22 | 🔴 **`catalog:examples` passes a component interface that cannot work.** `vis-columns-media-cards` shipped a `Component Inputs` node with **no `ports` array at all** and three connections out of it: every instance parameter was discarded and the card rendered `●Text`. The gate ran 64/64 strict, warnings-as-errors. A `Component Inputs` node that nothing plugs is the first thing the MCP server's own instructions warn about, and no gate checks it. ⚠️ The recipe is repaired; **the hole is not** | GATE | **VIB-007** (cross-link V10) | 🔴 open — 🔴 **AND THE POPULATION IS 14, NOT 1 (VIB-004, 2026-08-31).** The row named an example and was read as the finding. Re-derived from the predicate — *a `Component Inputs` with no `ports` that has connections out of it* — across all 66 examples: **14 hits**, every one a repeater/`For Each` item component (`/Log Row`, `/Task Detail`, `/Note Row` ×2, `/Order Row`, `/Remote Row`, `/Task Row`, `/Todo Row`, `/Product Row`, `/Task Card`, `/Import Task`, `/Project Membership`, `/Task Line`, `/Media Frame`), and `catalog:examples` runs 66/66 strict over all of them. ⚠️ **Not ruled**: whether a `For Each` feeds item properties into ports that were never declared is a runtime question, and the answer decides whether these are 14 broken examples or 14 that work by another route. **VIB-007's first job on V22, and it must be a render, not a reading** |
| V23 | `ui-empty-state` names the glyph `icon-inbox`, which is **not among the 212 in the Lucide manifest** — it renders (the stylesheet carries all 1998) but the editor's picker cannot produce it, so the value is unreachable through the UI that is supposed to author it. A curated list and a shipped stylesheet disagreeing about what exists | CORPUS | NONE — recorded | ⚪ recorded |
| V24 | 🔴 **VIB-002 shipped a red gate in another package and nobody saw it.** `get_style_vocabulary`'s wire-budget spec (`noodl-mcp/tests/styleTools.test.ts`) was over BOTH ceilings on `main` — prompt **3,161** against 3,000, full **11,720** against 11,000 — measured with VIB-003's own additions removed. The cause is legitimate growth: ten decorative tokens and three compositions. The failure is that VIB-002's gate table (§8) ran the catalog gates, both typechecks, the viewer suite and its look file and **never ran the noodl-mcp suite**. ⚠️ The general shape, which is the part worth keeping: **a change to `DEFAULT_TOKENS` or `STYLE_COMPOSITIONS` is a change to an MCP response billed on every turn, and the two live in different packages with different suites** | GATE | NONE — ceilings raised with the reason written into the spec; **any task touching tokens or compositions owes `npx jest --config packages/noodl-mcp/jest.config.js`** | 🟢 fixed, ⚪ the lesson stands |
| V25 | 🔴 **The corpus contradicted the vocabulary, and the corpus is what a model copies.** Richard, looking at the VIB-003 page: *"a habit with the MCP to create pages with no padding on the left and right side of certain sections… the text is tight to the left and right of the window, not the whole thing but just that one section weirdly."* Measured on the rendered DOM: `ui-split-hero`'s band put its `Columns` **straight in the band**, skipping the `shell` composition, so its content sat at **x=0** while the three bands below it sat at 64. **The `shell` composition's own description already said so** — *"the one centred container inside a band. Content that touches the viewport edge is the loudest sign nobody designed the page"* — and the shipped hero recipe, the most-copied one and the one that lands at the top of every page, ignored it. ⚠️ The seam is **CORPUS, not INSTRUCTION**: the rule existed and the example outvoted it | CORPUS | VIB-003 | 🟢 **closed 2026-08-31.** `ui-split-hero` wears the shell; all four bands now measure 64 at 1280 and 374 at 1900, left and right. Doctrine §6 and the `band` composition's description now say a band and a shell are one thing. ⚠️ Sub-finding, recorded: the **font** branch of `IconGlyph` emits no `ndl-icon-glyph` class while the sprite and inline branches do, so **no selector finds "an icon" across all three arms of the union** |
| V26 | **Nothing anywhere measures a rendered gutter**, which is why V25 shipped. A static sweep cannot substitute: the first one written for V25 reported *no defect* because `ui-split-hero`'s lead paragraph carries `maxWidth: 520px`, which insets one paragraph and satisfies a naive predicate. The check that works is well-defined and now written down — for each full-width band, the distance from the viewport to its first **painted** descendant; a page whose bands disagree is the finding (`vib003-gutters.look.ts`) | GATE | **VIB-007** (cross-link V10 — this is a poverty finding, not a defect detector) | 🔴 open |
| V27 | 🔴 **Spacing and padding are the MCP's weak point, and the corpus has a signature.** Richard, 2026-08-31, on the VIB-003 page: *"still some spacing problems in the cards, for example between the circle and the start of the card text… spacing and padding seems to be a weak point with the MCP."* Swept over the 64 examples: **30 raw pixel numbers** where a `--space` token belongs, **20 asymmetric paddings** — of which **13 are the identical `paddingLeft` + `paddingTop` only, as bare numbers**, i.e. padding on two sides and nothing on the other two — and **58 row/column Groups with 2+ children and no gap of any kind** (the dot pressed against the card title is one of them). The `LeftTop`-only signature is not sloppiness, it is one shape copied through the corpus | CORPUS | VIB-003 | 🟢 **partly closed 2026-08-31**: all 14 `LeftTop` bare-number nodes rewritten to four symmetric sides on `--space` tokens; the media card gains `columnGap` and `justifyContent`. ⚠️ **The 58 no-gap containers are NOT fixed** — many are logic/agent examples where a gap is a judgement call, and fixing them blind would be the proxy this phase exists to refuse. Owner for the remainder: **VIB-004** → **still not fixed at s4**, deliberately: each needs a render. ⚠️ s4 lesson, from getting it wrong: a first check asking *"does the parent set a gap"* accused `ui-testimonial-row`'s own shell, whose separation comes from the CHILD — `sectionHead` has carried `paddingBottom: var(--space-10)` since DSG-005. Both are correct; **the metric measured *a* property rather than the one the eye reads**, which is whether there is space between two adjacent boxes |
| V28 | **There is a `raw-color-literal` gate and no raw-SPACING equivalent.** The doctrine says *"never emit a raw hex or px when a token fits"* and only half of that sentence is enforced, which is why 30 raw pixel values sit in the shipped corpus. ⚠️ And the rule has an exception nobody states: `paddingLeft` accepts `var(--space-4)` because it is a CSS pass-through, while a **units-typed** port like `Columns.marginX` needs `{value, unit}` and **silently drops a `var()` string** — measured this session, and the example gate accepted the broken form | GATE / INSTRUCTION | **VIB-007** (cross-link V10) | 🔴 open |
| V29 | 🔴 **RULED: an empty half is a defect, not defensible negative space.** VIB-002 §9 left this open and the VIB-003 sheet re-asked it. Richard, 2026-08-31: *"the wider you go the more the features stretch out in terms of column spacing up to a max and then there's white space to the left and right **equally**… not just on one side, that's weird… the structural page divs have a max width and are centred."* So V15's *"a max-width that is right at 1280 is not a decision about 1900"* is answered: the answer is **a centred measure with equal margins**, not a one-sided column. ⚠️ Measured: the VIB-003 page already satisfies it (64/64 at 1280, 374/374 at 1900) — **the VIB-002 image-scrim band does not** (374 left, 766 right at 1900) | VOCABULARY | **VIB-004** (build sections that fill or centre within the measure) + **VIB-008** (V15) | 🟡 **half closed 2026-08-31.** The mechanism is named and built into `ctaBand`: **the defect is a `maxWidth` on the TEXT.** A measure belongs to the shell, which a band centres; `ctaBand`'s shell carries `maxWidth: 720` + `alignItems: center` and its type carries `textAlignX: center` and **no maxWidth at all** — measured 374/374 at 1900 on the VIB-004 page. 🔴 **`ui-image-scrim-band` itself is NOT repaired** — it is VIB-002's recipe and repairing it re-opens VIB-002's verdict. That half stays open against **VIB-008** |
| V30 | **A bundled stock-image library is wanted, and free-to-use is not free-to-bundle.** Richard, 2026-08-31: *"we should download some stock images and keep them in the deployed editor… hero images, backgrounds, people doing shit, food, animals… even for when the MCP is making custom apps for people it can piocher in the image library."* 🔴 The library is redistributed **twice** — inside the shipped editor, and inside every app a user deploys — so Unsplash and Pexels are both out: each licences *use* generously and restricts redistributing the photographs **as a collection**, which is exactly what bundling is. **CC0/public domain is the only class that survives** | CORPUS | **VIB-011** | 🟢 **CLOSED 2026-08-31 — AND THE ROW'S OWN LICENCE TABLE WAS WRONG.** It excluded Unsplash outright; that restriction lives in the **current** Unsplash Licence (June 2017), not in the **CC0 1.0** grant Unsplash made before it, which is irrevocable and unconditional. Commons will not host the post-2017 licence, so `Category:Images from Unsplash` (**31,004 files**) is the CC0 era — and it is what fixes `people`, which `Category:Images from Pixabay` (6,164) could not: `woman laptop` returned **one** file there, `chef restaurant` and `students classroom` **none**. **44 photographs, 3.32 MB, all CC0 (verified per file), now ship in `STARTER_ASSETS`** with `LICENCES.json` beside them, a `get_style_vocabulary` `imagery` block, and doctrine §5 rewritten. Fourth register row this phase to be materially wrong about its own premise |
| V31 | 🔴 **The seven `--shadow-*` tokens are unreachable through the sanctioned door.** `--shadow-sm` … `--shadow-2xl` and `--shadow-inner` each ship a complete CSS `box-shadow` string, and `Group` exposes `boxShadowOffsetX/Y`, `boxShadowBlurRadius`, `boxShadowSpreadRadius`, `boxShadowColor`, `boxShadowInset` and `boxShadowEnabled` as **separate** ports. Measured across all 176 catalog node types: **no port anywhere takes a whole box-shadow string.** So the only on-system way to get depth is to compose it from parts and colour it with a non-shadow token — `testimonialCard` uses `var(--border)`. This is **V5's exact shape a third time**: a capability present in the token set and unreachable from the ports | VOCABULARY/GATE | **VIB-007** | 🔴 open |
| V32 | ⚠️ **`catalog:examples` does not run `raw-color-literal`.** A `"boxShadowColor": "rgb(15 23 42 / 0.08)"` written into a new recipe passed **66/66 strict, warnings-as-errors**; it was caught by reading the gate's own header, not by the gate. The header says so deliberately (the F14 blast-radius argument, and three of the four families are still excluded) — but *"the gate is green"* and *"the corpus has no raw colours"* are different claims and only the first is true. Cross-link **V28**, which is the same sentence about spacing | GATE | **VIB-007** (with V28) | ⚪ recorded |
| V33 | 🔴 **The recipe named for an image had no image.** `ui-image-scrim-band` — VIB-002's flagship — shipped `"backgroundImage": ""` with **no connection feeding it**: a scrim gradient over a bare colour, through a gate that ran it 66/66 strict. ⚠️ The instructive half is the control found in the same sweep: `ui-card-grid-repeater`'s `"src": ""` **is** connection-fed (`card_inputs.image` → `photo.src`) and is *correct* authoring — V7's corrected reading exactly. **Two empty strings, opposite verdicts, and only the connection list separates them**, which is why a static "no empty image params" sweep would be wrong about one of them | CORPUS | VIB-011 | 🟢 **fixed 2026-08-31** — repointed at `ground-city-dusk.webp`. ⚠️ Its **one-sided measure is still VIB-008's** (V29) |
| V34 | 🔴 **The wire-budget gate measured a project state no user is in.** `get_style_vocabulary`'s budget spec ran on `copyFixture()` — bare JSON, no Inter, no Lucide, no starter imagery — so it priced the imagery block's *"none installed"* sentence at **+45 prompt / +31 full** when the real cost, on **every project the editor creates**, is **+225 / +515**: about an eighth of the number, billed as the cost. 🔴 The icon block has the same two arms and the spec's own comment says so in passing (*"a project that actually has an icon set, which the fixture here does not"*), so this instrument has priced the cheap arm since VIB-003 and nobody costed the real one. **V19's shape, one instrument along.** ⚠️ General form: **a budget measured on a fixture is a budget on the fixture** | GATE (instrument) | VIB-011 | 🟢 **closed 2026-08-31** — the spec installs the starter imagery before measuring; ceilings set against the real reading (prompt **4,032**/4,400, full **13,869**/14,400) |
| V35 | ⚠️ **The resident MCP tool surface is full.** Adding one clause to `get_style_vocabulary`'s description took it to **8,286 against 8,280**; trimmed, it sits at **8,279 — one token under.** That surface is billed on every turn of every session, so trimming beat raising — but the honest reading is that **the next task to touch any tool description will red this gate**, not that it fits. Cross-link V20, which recorded 26 tokens of headroom; there is now 1 | GATE | **VIB-007** | ⚪ recorded |
| V36 | 🔴 **The whole stock library ships in every DEPLOYED app, not just in the project — Richard asked, and the answer is the one he was checking for.** Measured by running the real deploy filter (`buildIgnoreMatcher`, `isV2Project: true`, no `.noodlignore`) over the paths, with three known-excluded controls beside them so the matcher was observed working: `docs/`, `node_modules/` and `components/` all EXCLUDED, while **every `noodl_modules/starter-imagery/*.webp` SHIPS**. `noodl_modules/` appears in no default ignore rule and nowhere in `utils/compilation/`. So a deployed landing page that references two photographs still carries **44 (3.32 MB)**. ⚠️ **Scope it correctly**: browsers only fetch what a page references, so this is **deploy/hosting payload, not per-visitor page weight** — the cost is in the artefact, not the load. ✅ It also **confirms the licence argument was necessary rather than over-cautious**: the library genuinely is redistributed twice, so CC0 was the required class, not a nicety. 🔴 **The fix is prune-on-deploy, and it has a real hazard**: image paths are often *data*, not parameters — `ui-testimonial-row` carries its `avatar-*.webp` paths inside a `Static Data` JSON string — so a pruner that only reads node parameters would silently delete pictures a deployed app asks for. Any pruner must scan raw project text, and must report what it dropped | RUNTIME / CORPUS | **VIB-012** | 🟢 **CLOSED 2026-08-31 — Richard chose prune-on-deploy.** On the real VIB-004 project the deploy goes **3.35 MB → 92 KB (97.3%)**, keeping every referenced picture plus `manifest.json` and `LICENCES.json`. 🔴 The pruner reads **raw project text**, not node parameters, because `ui-testimonial-row` keeps its avatar paths inside a `Static Data` JSON string; and it **refuses entirely** rather than half-prune when an occurrence will not resolve |
| V37 | 🔴 **A module's own README prose switched off a tool that reads the project as text — and the first explanation of it was wrong.** VIB-012's pruner skips the imagery directory when scanning for references. The reason written down was *"`LICENCES.json` names all 44 files, so everything reads as referenced"*. **Measured: false.** `LICENCES.json` lists bare basenames and contains `starter-imagery/` **nowhere**, so reading it changes nothing. The file that actually breaks it is `manifest.json`, whose documentation line — *"Reference any file as `noodl_modules/starter-imagery/<name>`"* — contains a placeholder that is not a filename, tripping refuse-on-ambiguity and **disabling pruning permanently, for every project, with a plausible-looking reason.** ⚠️ The general shape: **documentation inside a scanned directory is indistinguishable from a reference**, and the failure is a silent no-op rather than a crash. ✅ Caught by mutation, not by reading: the control spec had been passing against a mutant because the fixture's `manifest.json` did not carry the real sentence | GATE (instrument) | VIB-012 | 🟢 **closed 2026-08-31** — fixture carries the real prose; removing the skip takes `test:ci` from 4 failures to 10 |
| V38 | 🔴 **There is no on-system way to vertically centre one `Columns` child against a taller one — and the parameter that looks like it does is INERT.** Measured on the VIB-006 story band, three configurations, one rendering: `contentHeight` + `justifyContent: center` (contentBottom 3762), `explicit` + `height: 100%` + center (3766), and `explicit` + `height: 420px` + center (3766) all render the copy top-aligned against its 360px photograph. `justifyContent` has nothing to justify on a box that hugs its children; `height: 100%` resolves against a content-sized `Columns` and 100% of auto is auto; and the explicit height changes nothing because `Columns` in its default `rows` mode *already* makes "every item in a row as tall as the tallest one in it" — its own tooltip says so. ⚠️ **The part that matters is what was done about it: the parameter was DELETED, not left in.** An inert parameter in a corpus example is worse than no parameter — a model copies `justifyContent: center` from the page it is told to imitate, believes it centres a column, and has no way to see it does nothing. Cross-link V1/V17: the same family, one node along | VOCABULARY/RUNTIME | **VIB-005** | 🔴 open |
| V39 | ⚠️ **A recipe's own description contradicted its own artefact, and the description is what a model reads.** `ui-image-scrim-band`'s prose said *"`backgroundImage` is EMPTY here, as in every shipped example"* while the parameter has carried `ground-city-dusk.webp` since V33 repaired it — V33 changed the parameter and left the sentence. `get_example` returns the description, so the corpus was actively teaching the opposite of what it shows. Swept all 67 examples for the shape (a description claiming "empty" about an image parameter that is filled): **exactly one hit**, corrected. ⚠️ The general form, and it is V37's shape one artefact along: **prose inside a gated artefact is not gated** | CORPUS | VIB-006 | 🟢 **closed 2026-08-31** |
| V40 | 🔴 **The door could not see the corpus this phase spends its sessions writing.** `get_example`/`get_node_type` answer from **generated** `packages/noodl-types/src/node-catalog-enriched.json`, not from `docs/node-catalog/examples/`. It had not been regenerated since **VIB-002**: **67 examples on disk, 64 in the door**, with `ui-cta-band` and `ui-testimonial-row` (VIB-004, **two sessions old**) and `ui-landing-page` all unreachable, plus P80 DEF-029's `File Drop` ports on five nodes. 🔴 **`catalog:merge:check` is the gate and had been RED for four commits — no phase-81 session ever ran it**, because every session ran `catalog:examples`, which validates the corpus FILES and structurally cannot see whether the door reaches them. ⚠️ A hole shaped exactly like the defect, on a phase whose premise is *the corpus is what a model imitates*. ⚠️ The regeneration reds `nodeDocBudget` (`Group` 13,689 of 13,500) and **the breach is DEF-029's, not the examples'** — the `File Drop` ports are **2,651 of the 2,880 bytes** `Group` grew (92%) and `Group` carries no `examples` field at all. 🔴 **General shape: a budget on a GENERATED file is only a budget on the last time it was generated** | GATE / CORPUS | VIB-006 | 🟢 **closed 2026-08-31** — regenerated, verified through the door (`listExamples()` → 67, `getExample('ui-landing-page')` → 14 components), ratchet moved to 14,300 with the attribution written into the spec. ⚠️ **Any task adding an example or a port owes `npm run catalog:merge:check`** |
| V41 | ⚠️ **Nothing this phase has built is in a running server.** Measured on the bundle the live MCP executes (`/Applications/NodeGX.app/.../noodl-mcp.cjs`, built Aug 21), which **inlines** the catalog: `ui-gradient-hero`, `ui-cta-band`, `ui-landing-page`, `starter-imagery` and `gradient-scrim` are **0 occurrences** in both it and the repo `dist/` (Aug 20), while pre-phase `ui-split-hero` is 10. An agent talking to the resident server today gets the pre-phase kit. ⚠️ **Not a repo defect** — `dist/` is gitignored and rebuilt by `build:sidecars`, and the installed app is a release artefact that predates the phase. Recorded because it is **the difference between "the kit exists" and "the kit is in the product"**, and every verdict this phase has written is about the former | RELEASE | **NONE** — discharges on the next release build; the action is to **verify after it**, not before | ⚪ recorded |
| V15 | The content measure is capped independently of the viewport: at 1900 the members chrome's nav wraps to two rows and the page uses ~37% of the width, with the rest dead white. A max-width that is right at 1280 is not a decision about 1900 | VOCABULARY | VIB-008 (cross-link VIB-002) | 🔴 open |

### What the baseline measured, from disk, beside the pictures

Independently re-derived 2026-08-31 while VIB-001 ran — these are the numbers behind V1/V2/V7,
and they are stronger than the README §1 prose they check:

| reading | members-area artefact |
|---|---|
| `scrollEnabled` occurrences | **0** |
| `Group` nodes with no explicit `sizeMode` | **65 of 86 (76%)** — all running the 100%×100% ⇒ `flexGrow:100` default |
| `clip: true` occurrences | 35 |
| `Image` / `Icon` nodes | **0** |

