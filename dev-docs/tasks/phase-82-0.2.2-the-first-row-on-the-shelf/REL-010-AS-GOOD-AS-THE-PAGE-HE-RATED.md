# REL-010 — As good as the page he actually rated

**Opened 2026-09-02.** Richard, looking at the artifact of all thirteen members-area pages and then
at `verdicts/vib-006/2026-08-31/landing-door/landing-desktop-full.png`:

> *"This is the one where I said 'this is fucking pro' and all that shit, all the other ones that
> you're showing me in the artifact were the ones I said looked like oldschool Wordpress templates,
> passable but nowhere near this."*

> 🔴 **SCOPE — this GATES 0.2.2. It does not ride it.** Unlike [REL-008](TASKS.md) and
> [REL-009](REL-009-THE-WRITE-THE-EDITOR-CANNOT-SEE.md), this is not a new gate bolted on: it is the
> **actual content of row 6**, which the [README](README.md) §4 close condition already names
> (*"the look, ruled by Richard before publication"*). **REL-002c cannot close until this does**, and
> [REL-001](TASKS.md) (publish to the shelf) stays on hold behind it. Scope ruled by Richard
> 2026-09-02: **all thirteen pages**, not the public four.

---

## §1 The root cause: the benchmark was circular

Every session on row 6 was told, by this phase's own board, to grade each page **beside the
members-area's own `/` at the same width**. That instruction is in
[`NEXT-SESSION-PROMPT.md`](NEXT-SESSION-PROMPT.md) and has been obeyed for fourteen sessions.

🔴 **The members-area's `/` is itself a page Richard puts in the "passable" bucket.** So twelve pages
were certified *"as good as the homepage"* against a homepage he does not rate. The comparison could
not fail, and it did not. The **chrome exemption** — *"as good as the homepage means shows the same
amount of decision, not looks like a landing page"* — is a **session's sentence, not a ruling of
his**, and it licensed the remainder.

⚠️ **Phase 81's board already held both words in one breath, and nobody carried them here.**
[`phase-81/TASKS.md`](../phase-81-the-look-is-the-product/TASKS.md) records VIB-006 as
*"It looks fucking pro, good job"* — **the phase's only WORTHY close** — and VIB-011 as
*"VIB 011 is passable, a fine minimalist landing page"*. The vocabulary was on file since 2026-08-31.

**The benchmark for this row is `docs/node-catalog/examples/ui-landing-page.json` (VIB-006), not the
members-area's own landing page.**

## §2 What is actually true, measured 2026-09-02

Not asserted. [`vib001-members.poverty.look.ts`](../../../packages/nodegx-backend/tests/vib001-members.poverty.look.ts)
runs VIB-007 M3's poverty family over all thirteen pages at desktop 1280, with the VIB-006 page
measured **first, in the same run, as a known-silent control** and asserted silent.

| arm | headline | `<img>` | icons | grounds | tells |
|---|---|---|---|---|---|
| **CONTROL — VIB-006** | **94px** | **7** | **20** | **6** | **none** |
| members, door ×4 | 30px | 0 | 0 | 2–3 | `no-display-type` `no-imagery` |
| `/` living | 48px | 0 | 0 | 4 | `no-imagery` |
| members, signed-in ×8 | 30px | 0 | 2 | 2 | `no-display-type` |

**0 of 13 pages read clean. 13 of 13 carry at least one tell.** Gate: `EXIT=0`, 3/3, 14 rows,
control assertion green, `noodl.viewer.js` md5 unchanged across the run.

### §2.1 🔴 The two findings are NOT equally trustworthy, and the weaker one hides a worse fact

**`no-display-type` is solid.** Twelve of thirteen pages top out at **30px** against the rubric's
`DISPLAY_TYPE_MIN_PX = 48` and VIB-006's **94px**. The type ramp reads as two sizes. This is README
§2's tell, verbatim, and it is the single biggest measured gap.

⚠️ **`no-imagery` is literally true and misleadingly worded.** `render-measure` counts
`visible.filter((el) => el.tagName === 'IMG')` — **it cannot see a CSS `background-image`**, and the
five hero pages plainly do show a photograph. Do not quote "no imagery" about those pages.

🔴 **The fact underneath survives the caveat and is worse than the finding.** The template contains
**zero `Image` nodes across all thirty components**. Its only photography is a `backgroundImage`
parameter on a hero Group (`Pages/Landing/nodes.json:74`, `people-coffee-shop.webp`) — a scrim behind
a heading. **Photography is never content here.** VIB-006 carries **seven content photographs**: the
how-it-works shot, three box cards, three testimonial avatars.

### §2.2 What VIB-006 has that this does not

Its 14 components are the vocabulary the members-area was built without — it uses **none** of them:

`/Sections/Hero` · `TrustStrip` · `HowItWorks` · `Boxes` · `Numbers` · `Testimonials` ·
`ClosingCta` · `SiteFooter` · `/Components/FeatureItem` · `BoxCard` · `StatTile` · `QuoteCard` ·
`FooterColumn`

Per [VIB-013](../phase-81-the-look-is-the-product/VIB-013-THE-ALTITUDE.md), that page is good
*partly because 129 nodes were not hand-written* — the compositions were declared once and composed,
and every defect its renders caught was in the ~10% written outside that vocabulary. **The lift is a
composition job, not a hand-styling job.**

## §3 Acceptance criteria

Every numeric AC is read from `vib001-members.poverty.look.ts`, re-run. **Before/after on one
instrument, or it does not count.**

**AC1 — the control still reads silent.** VIB-006 measured in the same run, zero poverty findings.
🔴 A run where the control also reads clean is a broken instrument and **none of this file's numbers
may be quoted from it**.

**AC2 — the display tier exists.** Every one of the thirteen pages reads `largestFontSize` **≥ 48px**
at desktop (today: twelve read 30). The four public pages read **≥ 72px**.

**AC3 — photography becomes content.** The template contains **at least one real `Image` node**
(today: zero). Each of the four public pages carries **≥ 2** content images; the signed-in pages
carry imagery wherever a row or card can honestly hold one. ⚠️ Graded on `Image` nodes in
`nodes.json` **and** on the rendered `images.total`, because §2.1 shows either alone can lie.

**AC4 — ground variety.** The four public pages read **≥ 4 distinct grounds** (VIB-006: 6). Signed-in
pages **≥ 3**.

**AC5 — the tells are gone.** **0 of 13** pages carry any poverty finding, down from 13 of 13.

**AC6 — Richard rules it**, against the VIB-006 page rather than against the members-area's own `/`.
🔴 **AC1–AC5 are necessary and not sufficient**: they are what an instrument can see, and the close
condition is a person. PASSABLE does not close this row.

### §3.1 🔴 One thing to rule before building: how far the app chrome goes

Richard ruled **all thirteen**, so nothing here narrows to the public four. But a `/account`
settings page with a 90px headline and a testimonial band would be **over-designed**, and
`render-measure`'s own authors say so — the poverty findings are `warning` not `error` precisely
because *"app-chrome pages are exempt from marketing tells and the instrument cannot tell them
apart"* (V42).

**Proposal, needing his word:** all thirteen clear AC2/AC4/AC5; the **public four**
(`/`, `/join`, `/sign-in`, `/setup`) additionally take the full VIB-006 section vocabulary — hero,
trust strip, a numbers or feature band, testimonials where honest, a closing CTA and a real footer.
The signed-in nine get the display tier, real content imagery in their rows and cards, and a second
and third ground — **density and decision, not billboards.**

⚠️ **This is a proposal, not a narrowing.** If he wants the signed-in pages to carry marketing bands
too, that is his call and AC2/AC3 rise accordingly. Do not infer it either way.

## §4 Register rows this opened

| row | what | owner |
|---|---|---|
| **R1** | `no-imagery` counts only `tagName === 'IMG'` and is blind to CSS `background-image`, so it fires on pages that visibly carry a photograph. The finding's **wording** and its **measurement** disagree. | 🔴 **phase 81, VIB-007** — it is that task's finding, not this phase's |
| **R2** | The **chrome exemption** in this phase's board is a session's sentence presented as the bar. Whatever Richard rules at §3.1, the sentence must be rewritten to say who decided it. | **REL-010**, this file |
| **R3** | Nothing in a vib-001 render manifest pins the **runtime**. `noodl.viewer.js` was rebuilt twice under the 09-01 verdicts. See [`RUNTIME-PIN-2026-09-02.txt`](RUNTIME-PIN-2026-09-02.txt). | **REL-002c** |
| **R4** | The living arm's `artefactMd5` embeds an OS-assigned ephemeral port, so it changes every run and pins nothing. | **REL-002c** |

## §5 Order of work

1. **§3.1 ruled** — one sentence from Richard, and it changes what gets built on nine pages.
2. **The public four**, hero first, on the VIB-006 vocabulary. Re-run the harness; AC2/AC3/AC4 move
   on those rows or the approach is wrong and stops there.
3. **The signed-in nine.**
4. **Re-run the full harness** (AC5) **and** `vib001-members.look.ts` for pictures, then AC6.

⚠️ **`tpl001Template.test.ts` and the three drive suites gate every step** — this row changes the
template that those 72 + 79 tests describe, and several of them assert structure this work will move.
Expect to rewrite assertions **and the arguments above them**, never to increment a count silently.

---

# §6 What session 15 built, and what it measured

**2026-09-02.** §3.1 was ruled first, as §5 requires. Richard, given the three options:
✅ **"§3.1 as proposed — density, not billboards."** All thirteen clear AC2/AC4/AC5; the public four
take the VIB-006 section vocabulary; the signed-in nine get the display tier, imagery where a row or
card can honestly hold one, and a second and third ground.

## §6.1 The result, on one instrument

| | before | after |
|---|---|---|
| pages reading clean | **0 of 13** | 🟢 **13 of 13** |
| pages carrying a tell | 13 | **0** |
| control (VIB-006) | 94px · 7 img · 20 ico · 6 gnd · silent | **identical, silent** |

```
arm|page|largestPx|images|icons|grounds|tells
CONTROL vib-006|landing         |94| 7|20|6|—
members door|/sign-in           |72| 3| 2|4|—      (was 30| 0| 0|2| no-display-type no-imagery)
members door|/join              |72| 3| 2|5|—      (was 30| 0| 0|3| no-display-type no-imagery)
members door|/setup             |72| 3| 2|4|—      (was 30| 0| 0|2| no-display-type no-imagery)
members door|/unsubscribe       |48| 0| 2|2|—      (was 30| 0| 0|2| no-display-type no-imagery)
members signed-in|/ (living)    |94| 3| 2|4|—      (was 48| 0| 0|4| no-imagery)
members signed-in|/members      |48| 0| 4|3|—      (was 30| 0| 2|2| no-display-type)
members signed-in|/meetings     |48| 0| 4|3|—      (…and the same for the other seven)
members signed-in|/directory    |48| 0| 4|3|—
members signed-in|/requests     |48| 0| 4|3|—
members signed-in|/post         |48| 0| 4|3|—
members signed-in|/account      |48| 0| 4|3|—
members signed-in|/announcements/{id}|48| 0| 4|3|—
members signed-in|/meetings/{id}|48| 0| 4|3|—
```

Gate: `EXIT=0`, 3/3, 14 rows, control assertion green.

## §6.2 🔴 The baseline was re-taken, because R3 happened LIVE mid-session

The baseline was measured at 22:25 on `noodl.viewer.js` md5 `8c0ad51b…`. **A peer's webpack rebuilt
the bundle to `e35ea918…` at 22:42, between the baseline and the after-run** — R3 in this file's own
register (*"nothing in a vib-001 render manifest pins the runtime"*), except happening rather than
recorded. §3's requirement is *"before/after on one instrument, or it does not count"*, and at that
moment it did not.

✅ **So the baseline was re-taken on the current runtime and reproduces the original EXACTLY** —
every one of the fourteen rows identical, `30`s and `no-display-type`s and all. The before/after
above is therefore on one instrument, and the peer's independent account agrees with the
measurement: the rebuild added a `wireDeclaredPortPrefix` flag to the Record node family and touched
no layout, token or text path.

⚠️ **This needed `TPL001_TEMPLATE_DIR`**, added to `helpers/members-drive.ts`. Re-taking a baseline
needs the artefact **as it was** and the runtime **as it is**, and those live in different places —
the artefact in git, the runtime on disk. The override points a run at a `git archive` of the
committed template. Unset, it is exactly the constant it always was, and no other drive suite passes
it.

## §6.3 The root cause of AC2 was ONE PARAMETER, and it was an override of the fix

🔴 **`displayHeadline` already carried `--display-lg`.** VIB-002 / register V13 replaced its fixed
`--text-6xl` with a `clamp()` *because* — in that token's own words —
*"the members-area hero is 48px, exactly the ceiling, and reads as a paragraph that got bigger
rather than as a hero."* **The product was fixed, and this template overrode the fix back down to
the ceiling it was written to lift:**

```ts
const H_HERO = { ...composition('displayHeadline'), fontSize: 'var(--text-5xl)' };  // ← the whole of it
```

Fourteen sessions then graded the result against a page carrying the same override. The three tiers
are now the three fluid tokens and nothing else — `--display-lg` on `/` (94px), `--display-md` on
the three doors (72px), `--display-sm` on the nine app-chrome pages (48px).

🔴 **And a font-size census of the benchmark stopped the obvious over-correction.** VIB-006 reads:
one `--display-lg`, one `--display-md`, **four `--text-3xl`**, eighteen `--text-sm`. **Its section
headings are 30px — the size the members-area's already were.** The gap was the *top* of the ramp,
not the ramp: both pages set sections at 30, VIB-006 then runs to 94 and this one ran to 30. Two
landing-page band headings were wearing `H_PAGE` and would have been promoted by accident; they are
pinned to `H_BAND` at 30px, with the census recorded above them.

## §6.4 The composition work, which is what §2.2 said it would be

Two new components — 30 → 32 — and both exist because something had to be placed on more than one
page, which is VIB-013's finding about the rated page restated:

| component | what it is | placed on |
|---|---|---|
| **`Members/InsideBand`** | the *"what members can see"* band; three tiles, each now a **photograph** over its title | `/` `/join` `/sign-in` `/setup` |
| **`Members/Prompt`** | the closing band — a question, a line, an outline button on `--accent` | `/join` `/sign-in` `/setup` |

Plus `Members/InsideTile` gained a real `Image` (the template's first, and it had **zero** across
thirty components), `Members/Footer` gained a **wordmark**, and the nine app-chrome pages gained a
**page-identity band** on `--accent` carrying the badge, eyebrow and heading out of the content
column.

⚠️ **`Members/Prompt` is not new surface — it is two loose nodes given a ground.** `/sign-in` ended
in a `Text` reading *"Not a member yet?"* and a button sitting on the page ground; `/join` ended in
`ALREADY_A_MEMBER_HINT` and an outline `Sign in`. Those four nodes ARE the band. The VIB-001 finding
on `/join`'s button — *"two primary actions of equal weight on one page"* — is preserved: the band's
button is `outlineButton`, and `Send my request` is still the only filled control there.

## §6.5 🔴 Two things were REFUSED for being edits to the instrument rather than to the page

1. **`PAGE_GROUND` was not given `backgroundColor: 'var(--background)'`.** It was the cheap third
   ground for all nine app-chrome pages: the count would have gone 2 → 3 and **not one pixel would
   have changed**, because that is the colour the ground already appears to be. That is this board's
   hazard 2 run backwards, and it is the definition of building for the gate. The third ground is
   the `--accent` identity band instead, which a person can see.
2. **No stock faces were put on `/directory` rows.** §3.1 as ruled says *"real content imagery in
   their rows and cards"*, and AC3 qualifies it with **"honestly"**. A `Member` row has no photograph
   field, and a stock avatar beside a real person's real name and real email is not decoration — it
   is a claim about what somebody looks like. The gated pages carry **four icons and no photographs**,
   and that is a decision, not an omission. **If Richard wants faces there, the honest way is a
   product change (an avatar field members upload), not a picture the template invents.**

## §6.6 Acceptance criteria

| AC | state | reading |
|---|---|---|
| **AC1** control reads silent | 🟢 **MET** | 94 / 7 / 20 / 6, silent, in all four runs including both baselines |
| **AC2** display tier | 🟢 **MET** | 13 of 13 ≥ 48px; the four public read 94 / 72 / 72 / 72 ≥ 72 |
| **AC3** photography is content | 🟡 **MET on the public four, DECLINED on the nine** | ≥1 `Image` node ✅ (was 0); public four carry **3** each ✅; the nine carry 0 photographs and 4 icons — see §6.5.2 |
| **AC4** ground variety | 🟡 **MET as written** | public four read 4 / 5 / 4 / 4 ✅; signed-in nine read **3** ✅. ⚠️ `/unsubscribe` reads **2** and **AC4 names neither group it is in** — see R6 |
| **AC5** the tells are gone | 🟢 **MET** | **0 of 13**, down from 13 of 13 |
| **AC6** Richard rules it | ⏳ **OPEN — a session cannot close this** | AC1–AC5 are what an instrument can see. The close condition is a person, and PASSABLE does not close it |

## §6.7 New register rows

| row | what | owner |
|---|---|---|
| **R5** | A peer's webpack rebuilt `noodl.viewer.js` **mid-session**, between a baseline and its after-run. The general lesson is stronger than R3's: pinning the runtime in a manifest is not enough, because the pin has to be read **at both ends of a comparison**. `run-poverty.sh` now records the md5 before AND after every run. | **REL-010**, done |
| **R6** | **AC4 names "the four public pages" and "signed-in pages" and `/unsubscribe` is in neither.** It reads 2 grounds and is the only page still at the instrument's floor. This is a hole in the AC, not a defect found by it — and it may be the right answer, since D39 already rules that page's austerity acceptable. | **REL-010** — needs one word from Richard with AC6 |
| **R7** | `shortGround()` in the harness collapses every `linear-gradient(...)` to the string `gradient`, so two bands with the same scrim over **different photographs** print identically in the diagnostic column. The `distinct` COUNT is unaffected (it keys on the full computed value), but the column cannot be read as "these two bands are the same". | **REL-002c** — diagnostic only |

## §6.8 R2, discharged

R2 asked that the **chrome exemption** — *"as good as the homepage means shows the same amount of
decision, not looks like a landing page"* — be rewritten to say who decided it, because it was a
session's sentence presented as Richard's bar. It is now **§3.1, ruled by Richard on 2026-09-02**,
and `NEXT-SESSION-PROMPT.md` says so with the date and the wording he chose. ✅ **Closed.**

## §6.9 🔴 The first `<img>` in the template found a defect in the DRIVE HARNESS, six sessions old

`tpl001-members-drive.test.ts` §1 asserts the stranger's landing page *"logged nothing"*. It went red
with three lines:

```
[noodl] Image (/Members/InsideTile): The image could not be loaded:
  /noodl_modules/starter-imagery/people-cafe.webp [image/load-failed]
```

🔴 **`copyTemplateProject` was serving a project nobody receives.** A template directory is not a
project: `STARTER_ASSETS` — Inter, 1,998 Lucide glyphs, 44 CC0 photographs — is placed into every
project by the installer, and **the template submission's excluded-files list is derived from that
same constant**, so the artefact deliberately ships none of those bytes and only references them.
The helper copied the directory and nothing else, so every such reference 404s.

🔴 **And it was invisible for six sessions because of WHICH KIND of reference the template had.** Its
only asset reference was a `backgroundImage` on the hero Group. **A CSS background that fails to load
logs nothing.** An `<img>` that fails logs loudly — so the template's *first real `Image` node* is
what made a pre-existing harness defect audible.

⚠️ **This is §2.1's asymmetry from the other side, and the pair is the lesson.** The poverty
instrument **cannot see** a CSS background (`tagName === 'IMG'` only). This drive **cannot hear**
one. A photograph carried as a background is invisible to both — and until this row, *all* of this
template's photography was carried that way. Two independent harnesses, one blind spot, same shape.

✅ **Fixed in the fixture, not in the assertion.** `copyTemplateProject` now calls
`placeStarterAssets` and throws on any failure — the reading the poverty harness already had in
writing: *"a copy with the assets a real project has — measuring without them prices the empty
arm."* Four drive suites share the helper and all four now render what a person is given.

⚠️ **Worth stating because it changes what those four suites have been measuring**, not only what
they measure now: every members-area drive reading taken before 2026-09-02 was taken on a project
with **no typeface, no glyphs and no photographs installed**.

## §6.10 The readings, with their exit statuses

Gated on an **exit file the command wrote itself**, per this row's hazard 9. Every run records the
`noodl.viewer.js` md5 **before and after itself** — hazard 13, which this session earned.

| gate | reading |
|---|---|
| `vib001-members.poverty.look.ts` — **final** | **`EXIT=0`**, 3/3, 14 rows, control assertion green. **13 of 13 pages clean.** Viewer `8facb5b2…` at both ends |
| `tpl001Template.test.ts` | **`EXIT=0`** — **72/72** |
| `tpl001-members-drive` + `tpl001-empty-states` + `tpl001-refused-query` + `rel002b-fail-closed` | **`EXIT=0`** — **4 suites, 116/116**, on real enforcing backends |
| `npm run template:members` | **`EXIT=0`**, idempotent — 32 components, 13 pages, start page `/Pages/Landing`, 114 door diagnostics, none blocking |

### 🔴 A three-bundle stability control nobody planned

The peer's webpack moved `noodl.viewer.js` **twice** during this session
(`8c0ad51b…` → `e35ea918…` → `8facb5b2…`). The committed template was measured on the first two and
the built template on the last two, and **every arm reproduced its own numbers exactly across
bundles** — all fourteen rows, both times.

That is worth more than the inconvenience cost. It is a **known-varying input with a known-constant
output**, which is the one thing that makes *"the runtime did not affect this reading"* a measurement
rather than an assurance. The peer independently reported the change touched no layout, token or
text path; the numbers agree with them, and neither claim rests on the other.

⚠️ **This does NOT retire R3 or hazard 13.** It says these three bundles did not move these numbers.
A bundle that changed layout would, and nothing here would have caught it except the same discipline.
