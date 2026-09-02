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
