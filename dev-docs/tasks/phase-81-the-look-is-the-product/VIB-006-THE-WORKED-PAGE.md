# VIB-006 — The Worked Page

**Register row V8** — *"No worked full-page example in the corpus"* — seam **CORPUS**.

> This is the thing a model imitates; it is worth more than any rule. — TASKS.md, VIB-006

## §1 The predicate, re-derived from disk before building

🔴 Phase rule, four for four before this session: **re-derive a register row from its predicate**
(V6, V12, V22, V30 were each materially wrong about their own premise). V8's predicate is
*"a complete designed landing page in the example corpus"*. Made countable and run over all
**66** examples in `docs/node-catalog/examples/`:

| reading | corpus, 2026-08-31 |
|---|---|
| **Most top-level visual bands on any `Page` node** | **2** — and that one (`nav-url-product-page`) is a routing example, not a landing page |
| Examples with ≥4 bands | **0** |
| Examples with ≥3 bands **and** an image **and** an icon | **0** |
| Examples using `--display-*` type | 4 (`ui-gradient-hero`, `ui-image-scrim-band`, `ui-split-hero`, `ui-cta-band`) |
| Examples putting a scrim over a photograph | **1** (`ui-image-scrim-band`) — a lone band, on no page |

**V8 stands, and it is worse than the row's wording.** The corpus is not short of a *good* page; it
has never contained a page at all. Every marketing recipe is a single band that ships as
`/Components/<Something>` with no `Page` around it, so the largest assembled thing an authoring model
can read back through `get_example` is one section. VIB-004's six-band demo exists only inside this
phase's `demo/` directory: it is a **verdict artefact, not corpus**, and `get_example` cannot reach it.

⚠️ The other half of the predicate — *does the kit already have the parts* — is answered **yes**, so
this task is CORPUS work and must not widen the vocabulary. Measured at the door: 36 compositions
including `imageGround`, `glassPanel`, `heroGround`, `displayHeadline`, `ctaBand`, `statTile`,
`testimonialCard`, `featureItem`, `footerBand`; 44 CC0 photographs with subjects and roles;
1,998 Lucide glyphs. **Asking the door first is now five for five.**

## §2 Acceptance criteria

1. **AC1 — one complete landing page ships as a corpus example.** A single file in
   `docs/node-catalog/examples/`, fetchable through `get_example`, containing a `Page` node with
   every band of a real landing page on it, factored into item components the way doctrine §0
   requires.
2. **AC2 — it passes the same gate as every other example.** `npm run catalog:examples` **exit 0**,
   strict, warnings-as-errors, with the new file in the run.
3. **AC3 — real imagery, doing communicative work.** Photographs chosen by SUBJECT from
   `LICENCES.json`, each true about what the page is about; no `ground-*` used as a subject
   (doctrine §5); more than one face; icons carrying `codeAsClass`.
4. **AC4 — rendered and LOOKED AT** through the VIB-001 Judge in the **door** state at the four
   honest widths (988×313, 390, 1280, 1900), per README §3. Never raise a viewport to make content fit.
5. **AC5 — the verdict is written in this file with the rubric tells named**, and it is WORTHY or the
   seam that blocked it is filed as a register row with an owner (README §3.6).
6. **AC6 — Richard's question 1 is answered here**: is a *subject* photograph right for the generic
   `ui-split-hero` hero, given that recipe lands at the top of every page copied from it.

## §3 Explicitly NOT in this task

- Widening the vocabulary. Every parameter comes from a shipped composition or a shipped recipe.
- Repairing `ui-image-scrim-band`'s one-sided measure (V29) — that half is **VIB-008's**.
- The 58 no-gap containers (V27 remainder) and the `Component Inputs` ports hole (V22) — **VIB-007's**.

## §4 What shipped

`docs/node-catalog/examples/ui-landing-page.json` — **14 components, 129 nodes**, gated by
`catalog:examples` like every other example and fetchable through `get_example('ui-landing-page')`.

| part | what it is |
|---|---|
| `/Pages/Home` | **9 nodes**: a `Page` and eight section instances |
| `/Sections/…` | Hero · TrustStrip · HowItWorks · Boxes · Numbers · Testimonials · ClosingCta · SiteFooter |
| `/Components/…` | FeatureItem · BoxCard · StatTile · QuoteCard · FooterColumn — each with a `Component Inputs` whose ports are declared and plugged `output` |
| grounds | photograph+scrim · `--surface` · page background · `--surface` · `--gradient-deep` · `--gradient-surface` · `--gradient-brand` · `--muted` — **7 distinct treatments across 8 bands** |
| pictures | **8 distinct photographs**: `texture-soil` as the hero ground, `people-market` beside the copy, three different vegetables on three cards, **three different faces** |

Built by `demo/write-vib006-example.js` (the corpus file) and `demo/build-vib006-landing.js` (the
project the Judge serves). 🔴 **The second script lifts nothing.** VIB-003's and VIB-004's builders had
to assemble a page out of band-shaped recipes and each lost something doing it; this one transcribes,
because the example already *is* a page. That is the cheapest available proof of the claim.

## §5 🔴 The gate found the better shape, and it was right

The first build put all eight bands directly on the `Page`. `catalog:examples` answered with three
`duplicate-node-id` **errors** (node ids are unique project-wide, not per component — five item
components each had a `root` and an `inputs`) and one `oversized-page` **INFO**:

> This page's own graph is 90 nodes. Above about 40 a page has usually inlined sections that wanted to
> be components of their own — a page reads best as a handful of section instances.

⚠️ **The INFO did not fail the run.** Errors and warnings fail it; an info is advice. Taking the advice
is what turned a 90-node page into a 9-node one, and it is doctrine §0 in a sentence. **A gate that is
already green can still be telling you the answer.**

## §6 🔴 Four defects the pictures found that no gate could

Each was invisible to `catalog:examples`, to the look file's own assertions, and to
`contentBottom`/`unreachablePx`/`textChars` — because in every case the words were all still in the
DOM and nothing was below an unscrollable fold.

1. **The nav lost two of its links at 390 and wrapped both of them at 1280.** A `flexGrow: 1` spacer
   between the wordmark and the links squeezed the link `Text` nodes, so "The garden" and "Saturday
   stall" each broke onto two lines at desktop; at phone width the links and the button were pushed
   off the row and the nav read *"Ashcombe Market Garden — Boxes"*. Fixed with
   `justifyContent: space-between` (no spacer node at all) plus `flexWrap`, and `sizeMode: contentSize`
   on the link `Text`s — a `Text` in a row is 100% wide by default and shrinks.
2. **The headline ran to three lines and jammed the badge under the nav.** The copy group's measure
   was 760px; at 900px the headline is two lines and the hero breathes.
3. **One stat label wrapped and made its tile taller than the other three.** Copy fix.
4. **A quote card was a line longer than its neighbours**, so the row's bottoms disagreed. Copy fix.

## §7 🔴 The finding worth keeping: an inert parameter in the corpus teaches a lie

The story band's copy sat at the top of its 420px photograph with ~110px of dead white beneath it.
**Three configurations were rendered and all three are the same picture:**

| attempt | `contentBottom` @1280 | result |
|---|---|---|
| `sizeMode: contentHeight` + `justifyContent: center` | 3762 | top-aligned |
| `sizeMode: explicit`, `height: 100%` + `justifyContent: center` | 3766 | top-aligned |
| `sizeMode: explicit`, `height: 420px` + `justifyContent: center` | 3766 | top-aligned |

`justifyContent: center` on a `contentHeight` box does nothing — it hugs its children, so there is no
free space to centre them in. `height: 100%` resolves against a `Columns` that is itself content-sized,
so 100% of auto is auto. And the explicit height changes nothing because **`Columns` in its default
`rows` mode already makes *"every item in a row as tall as the tallest one in it"*** — the height was
never the missing thing, and a child cannot centre itself against a taller sibling.

🔴 **So the parameter was deleted rather than left in.** An inert parameter in a corpus example is
worse than no parameter: a model copies `justifyContent: center` from the page it is told to imitate,
believes it centres a column, and has no way to see that it does nothing. The composition was fixed by
bringing the photograph closer to the copy's own height instead. Filed as **V38**.

⚠️ Method note, and it is the one this phase keeps re-learning: `contentBottom` was **3766 on two of
the three attempts and the picture was identical on all three**. Only looking settled it.

## §8 🔴 A corpus defect found in passing — V39

`ui-image-scrim-band`'s **description** said *"⚠️ `backgroundImage` is EMPTY here, as in every shipped
example"* while its `backgroundImage` parameter has carried `ground-city-dusk.webp` since V33 repaired
it. V33 changed the parameter and left the prose. **The description is what `get_example` returns**, so
the corpus was telling an authoring model the opposite of what the artefact does. Swept across all 67
examples for the same shape (a description claiming "empty" about an image parameter that is filled):
**exactly one hit.** Corrected here.

## §9 The verdict — **WORTHY**

Rendered through the Judge in the **door** state at all four viewports, `failed: []`,
`unreachablePx: 0` and `canScroll: true` everywhere, `errors: []`.
`verdicts/vib-006/2026-08-31/landing-door/`. **Looked at** at 988×313, 390, 1280 and 1900, full page
and first fold.

⚠️ **§3.2 note, stated rather than skipped**: the protocol asks for both the door and the living state.
This page binds no backend and reads no data — the door state *is* its only state, so there is no
living state to render and none is claimed.

**Every WordPress-starter tell is answered, and this is the first page in the phase where that is true
of the first one.** Not one background colour but seven grounds across eight bands; not a bare heading
on white but display type at ~96px over a photograph of turned soil under a scrim, with the nav sitting
on the picture; six sizes in the type ramp, not two; pill buttons, glass tiles with a real backdrop
blur, shadow-lifted quote cards and photographs clipped by their card's own radius, none of which is a
browser default; copy with numbers, materials and constraints in it.

🔴 **The sentence VIB-011 closed on was: *the library ships and the page barely uses it*.** That is what
moved. Eight photographs do communicative work here — the hero ground is *about* growing, the story
photograph is *about* the market, three vegetables distinguish three boxes, and three different faces
carry three testimonials — and the depth tell is answered by translucency over a gradient rather than
by a border.

**What is honestly imperfect, and none of it is a rubric tell:**
- At 988×313 the first fold is a nav, a badge and the top of a headline. **No hero fits 313px**, the
  page scrolls and `unreachablePx` is 0. The fold is recorded, not engineered around.
- Within the hero shell at 1900 the right third is photograph rather than content. That is the
  one-sided shape V29 named — but the thing occupying it is the picture, not white space, which is
  what Richard's ruling was actually about.
- The story band's copy top-aligns against its photograph. **V38**: there is no on-system way to do
  otherwise.

🔴 **Provisional until Richard looks** (README §3.5). A session's WORTHY is a claim, not a grade, and
the last three rulings in this phase all landed one notch below where the session had it.

## §10 AC6 — Richard's question 1, answered

*Is `work-potter.webp` right for the generic `ui-split-hero` hero?* **No, and the reason is not that it
is a subject.** Building this page forced the distinction the recipe corpus does not yet make:

- A **band ground** wants a `ground-*` or `texture-*` file — 1600×900 or 1200×675, dark, cut to carry
  type. This page used `texture-soil.webp`, which is both a real photograph *and* true about a market
  garden. Doctrine §5 already forbids using a `ground-*` as a **subject** and it is right to.
- A **media column or a card** wants a `tile` subject (900×675) that is true about the business.

`ui-split-hero` puts a tile subject in its media column, which is the correct *kind*. The problem is
that **a recipe cannot know the subject**, so whatever it ships makes a claim about a business it has
never met — and this is the most-copied recipe in the corpus. ⚠️ Its `alt` text already says *"Describe
the photo"*, so the recipe tells an author to replace the words and not the picture.
**Recommendation, not done here** (it is VIB-003/VIB-011's recipe and repairing it re-opens their
verdicts): the instruction belongs in the recipe's `description`, where `get_example` returns it —
*"replace this photograph with one that is true about your subject; pick by SUBJECT from
`get_style_vocabulary`'s `imagery` block"*. Filed against **VIB-007**, which owns the instruction
surfaces. Questions **2** (are the six faces the right six) and **3** (3.32 MB per project) remain
Richard's and are untouched by this task.

## §11 Gates (2026-08-31) — 🔴 every row is an EXIT STATUS

A crashed `tsc` writes zero `error TS` lines, so a grep over its log reads `0` and cannot be told from
a clean pass.

| gate | reading |
|---|---|
| `npm run catalog:examples` | **exit 0** — **67/67** clean, strict, warnings-as-errors |
| `npx jest --config packages/noodl-mcp/jest.config.js` | **exit 0** — 79 suites / **1045** tests |
| `npm run typecheck:editor` | **exit 0** |
| `npm run typecheck:mcp` | **exit 0** |
| `vib006-landing.look.ts` | **exit 0** — 6/6, four viewports, `starterAssets.failed: []` |
| `npm run test:ci` | ⚠️ **not run.** Nothing this task touched is in it: a corpus JSON, two demo scripts, a `.look.ts` (outside `testMatch`) and task docs. Floor is 4, all AIX-006 by name |
| `npm run typecheck:backend-tests` | 🔴 **attempted and it OOMs — exit 134.** ⚠️ **This task DID write a `.look.ts`**, so unlike VIB-011 it cannot claim the gate is irrelevant. A narrowed project including only `vib006-landing.look.ts` and `tests/helpers/**` was built to dodge the known 8 GB ceiling and **OOMed at 4 GB after 277 s anyway** — the cost is not the suite's size, it is that `judge.ts` transitively pulls in `site-drive.ts` and the editor model tree, so **two files is already too many**. That is a sharper reading than the standing note and it is worth carrying: narrowing the include does not help. CI (`pr.yml:39`) covers it. 🔴 The log contained **zero `error TS` lines** and would have read as a clean pass to any grep |

## §12 🔴 An extractor that read 6 when the answer was 8

The look file's *"points every picture at a file that actually ships"* check first enumerated the port
names — `src`, `backgroundImage`, `image` — and reported **6** distinct pictures on a page carrying
**8**. It missed both avatars that arrive through `QuoteCard`'s `avatar` instance parameter, and would
have missed every future one.

✅ **Caught only because the cardinality assertion was written before the number was known.** Had it
been `toBeGreaterThan(0)`, or written after reading the extractor's own output, the page would have
shipped with an image check blind to a third of its images. An enumerated port list is a claim about
which ports exist; the honest predicate is *any parameter whose value is a path into the installed
modules*, which is what the runtime resolves. It is now `toBe(8)`.

## §13 🔴 Richard's ruling, 2026-08-31 — verbatim. **WORTHY. The phase's first close on the look.**

He was shown the four viewports and answered:

> *"It looks fucking pro, good job. VIB 006 screens are amazing. VIB 011 is passable, a fine
> minimalist landing page"*

**Recorded WORTHY**, and the reason it is read as a grade rather than as encouragement is **the
contrast inside his own sentence**: he used the word *"passable"* for one page and *"fucking pro"* /
*"amazing"* for the other, **in the same breath**. Three previous rulings in this phase were recorded
PASSABLE precisely because they did not do that —

| task | his words | recorded |
|---|---|---|
| VIB-002 | *"very passable, nearly worthy"* | PASSABLE |
| VIB-003 | *"deffo passable and looking like a modern base template, good job"* | PASSABLE |
| VIB-011 | *"It's looking better and better, good job"* | PASSABLE (a direction, not a verdict) |
| **VIB-006** | *"fucking pro… amazing"*, **beside** *"VIB-011 is passable"* | **WORTHY** |

🔴 **README §2's caution cuts both ways.** *"Approval is not a grade"* exists because the first
baseline scored two pages PASSABLE for being merely legible — but **under-reading a ruling is the same
class of error as over-reading one**. A session that recorded this as PASSABLE would be applying the
caution as a reflex rather than as a measurement, and the measurement here is the deliberate
distinction he drew between two artefacts he was shown together.

**VIB-006 is 🟢 CLOSED** — README §3 satisfied end to end: rendered through the Judge in the honest
state at four widths, looked at, verdict written with the tells named, and **Richard has seen it**.

⚠️ **What this does and does not prove.** It closes the CORPUS seam (V8): the thing a model imitates
now exists and is judged good. It does **not** prove the pipeline produces it — that is **VIB-010**,
the cold proof, and it remains the phase's exit exam. A page assembled by a session that had read the
whole phase is not evidence about a session that has read nothing.

## §14 VIB-011, re-ruled in the same sentence — the cautious reading was right

> *"VIB 011 is passable, a fine minimalist landing page"*

VIB-011's session recorded *"It's looking better and better, good job"* as **PASSABLE** rather than
WORTHY, over the objection that it sounded like approval. ✅ **That reading is now confirmed by
Richard explicitly using the word.** The caution was correct, and this is the evidence for it —
worth keeping, because the same judgement will have to be made again.

⚠️ *"A fine minimalist landing page"* is a description, not a promotion: VIB-011 stays **🟡 PASSABLE**.
Its own recorded WORTHY gap — *the library ships and the page barely uses it* — is answered **by
VIB-006's page**, not by the VIB-004 page VIB-011 was judged on, which is unchanged.

## §15 🔴 V40 — the door could not see the worked page, and had not seen anything since VIB-002

Found by asking a question that should have been asked four sessions ago: **does `get_example`
actually return this?**

`get_example` and `get_node_type` do **not** read `docs/node-catalog/examples/`. They answer from
`packages/noodl-types/src/node-catalog-enriched.json`, which is **generated** from the corpus by
`npm run catalog:merge`. That file had not been regenerated since **VIB-002** (`611fed28`).

| layer | examples |
|---|---|
| `docs/node-catalog/examples/` (source, gated by `catalog:examples`) | **67** |
| `node-catalog-enriched.json` (what the door answers from) | **64** |

**Invisible to the door**: `ui-cta-band` and `ui-testimonial-row` — VIB-004's two new recipes, shipped
**two sessions ago** — and `ui-landing-page`. Also missing: the `File Drop` ports on
`Group`/`Image`/`Text`/`Circle`/`Video` from P80's DEF-029 (`f725d184`).

🔴 **The gate for this exists and had been red for four commits.** `npm run catalog:merge:check` says
*"Stale enriched catalog … run npm run catalog:merge and commit the result"*. **No phase-81 session
ever ran it** — every one of us ran `catalog:examples`, which validates the corpus **files** and is
structurally unable to see whether the door can reach them. ⚠️ **A hole shaped exactly like the
defect**: this phase's entire premise is *the corpus is what a model imitates*, and for four sessions
it was adding recipes to a corpus the model could not read.

✅ **Fixed and verified through the door, not by inspection**: `listExamples()` → **67**,
`getExample('ui-landing-page')` → 14 components, 9-node page.

⚠️ **The regeneration reds `nodeDocBudget`, and the breach is not this task's.** `Group` came out at
**13,689** against a 13,500 ceiling. Attributed by stripping the `File Drop`-grouped ports back out:
they are **2,651 of the 2,880 bytes** `Group` grew — **92%** — and `Group` carries **no `examples`
field at all**, so the three new examples contribute **nothing** to it. The breach is DEF-029's,
latent since `f725d184` because its derived catalog was never regenerated. Ratchet moved to **14,300**
with the numbers and the attribution written into the spec (~600 headroom, the existing convention).

🔴 **The general shape, and it is the one to carry: a budget on a GENERATED file is only a budget on
the last time it was generated.** The ports were in the product and unpriced by their own ceiling for
four commits.

## §16 🔴 V41 — and none of it is in a running server yet

The layer below V40, measured on the bundle the live MCP server actually executes
(`/Applications/NodeGX.app/Contents/Resources/noodl-mcp/noodl-mcp.cjs`, built **Aug 21**), which
**inlines** the catalog rather than reading it from disk:

| marker (task that added it) | repo `dist/` (Aug 20) | installed app (Aug 21) | source |
|---|---|---|---|
| `ui-split-hero` (pre-phase) | 10 | 10 | ✅ |
| `ui-gradient-hero` (VIB-002) | **0** | **0** | ✅ |
| `ui-cta-band` (VIB-004) | **0** | **0** | ✅ |
| `ui-landing-page` (VIB-006) | **0** | **0** | ✅ |
| `starter-imagery` (VIB-003/011) | **0** | **0** | ✅ 15 |
| `gradient-scrim` (VIB-002) | **0** | **0** | ✅ 4 |

**Not one thing this phase has built exists in either bundle.** An agent talking to the resident
`nodegx-*` server today gets the pre-phase kit: no grounds, no marketing compositions, no photographs,
no worked page.

⚠️ **Scope this correctly — it is NOT a repo defect.** `packages/noodl-mcp/dist/` is gitignored and
rebuilt by `npm run build:sidecars`; the installed app is a release artefact that predates the phase.
This is the expected consequence of not having cut a build. **It is recorded because it is the
difference between "the kit exists" and "the kit is in the product"**, and every verdict this phase
has written is about the former. Owner: **NONE** — it discharges on the next release build, and the
thing to do is *verify after that build*, not before.
