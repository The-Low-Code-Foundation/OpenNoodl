# VIB-011 — The Stock Library

**Register row: V30.** Opened 2026-08-31 by Richard's instruction, session 3.

> *"we should download some stock images and keep them in the deployed editor as a kind of stock
> image library of basic shit, dunno how many but enough to do hero images, backgrounds, stock
> images of people doing shit, food, animals, whatever, to at least show stock stuff with the
> templates and even for when the MCP is making custom apps for people it can piocher in the image
> library. Wouldn't take up too much space and would solve a lot of problems."*

**Status: 🟡 PASSABLE — BUILT, SHIPPED, TAUGHT AND JUDGED 2026-08-31 (session 5). Read §7–§13.**

⚠️ §1–§6 below are the ORIGINAL scoping and are kept as written. **§1's source table is materially
wrong and §7 corrects it** — it excluded Unsplash on the current Unsplash Licence, which is not the
licence on the files that matter. Re-derive a row from its predicate before building on it.

This **supersedes VIB-003 §3(d)'s decision** to ship generated abstract art. That decision was taken
on a licence argument — *"a shipped photograph carries a provenance and a licence this repository
cannot check on a reader's behalf"* — and the argument was right about the risk and wrong about the
conclusion: the risk is checkable, per file, and this task is how.

---

## §1 🔴 Free to use is not free to bundle, and that is the whole constraint

The library is **redistributed twice**: once inside a desktop application shipped to strangers, and
again inside every app those strangers deploy publicly. That is a stronger requirement than "free
for commercial use", and it is where the obvious sources fail:

| source | permits use | permits redistributing the photos **as a collection** |
|---|---|---|
| Unsplash | yes, generously | **no** — ⚠️ **TRUE OF THE POST-2017 LICENCE ONLY; SEE §7.** The pre-June-2017 CC0 grant is irrevocable and carries no such restriction, and it is what `Category:Images from Unsplash` on Commons holds |
| Pexels / Pixabay (direct) | yes | **no** — same restriction on redistributing the images themselves |
| **CC0 / public domain** | yes | **yes** — no attribution, no share-alike, no field-of-use limit, nothing to pass on |

So the licence class is settled: **CC0 or public domain, and nothing else**. What remains is finding
CC0 photography that is actually stock-quality, and being able to *prove* the licence per file
rather than believe a page footer.

## §2 🔴 The source, and it took two attempts — the first result is the useful one

**Attempt 1 — CC0 across Wikimedia Commons at large — returned a museum catalogue.** Measured, not
guessed: 22 candidates kept from 134, and looking at them, *"people working"* had produced three
archive photographs of **iron tools** and a Regency print, *"animals"* two eighteenth-century **oil
paintings**, *"food"* a single coffee cup. Four of twenty-two were usable. The licence filter worked
perfectly and the subject matter was wrong, which is a different failure and would have been easy to
mistake for "CC0 has no good pictures".

**Attempt 2 — `Category:Images from Pixabay` on Commons — is the intersection.** Pixabay stock
photography, donated to Commons, carrying **CC0 on each file**. 20 candidates, **1 rejection**
(under-sized), against attempt 1's 112. Looked at: a coffee cup spilling beans across slate, a
macro of roasted beans, a husky mid-swim, a wall of lit balloons, a snowy range under cloud. That is
commercial-grade stock, and the licence is readable through the API per image.

⚠️ **One category is weak and the next session should not discover it the hard way.** `people`
returned moody black-and-white character portraits — beautiful photographs, and **not** "people
doing shit" for a business template. Better queries are the first thing to try; if they do not
work, this category may need a different collection.

⚠️ **Category membership is not the licence guarantee.** `fetch-stock-imagery.js` still reads each
file's own `LicenseShortName` and rejects anything outside `ACCEPTED_LICENCES`. Two checks, because
a category is a claim somebody made and the licence field is the record. Rejections are **reported
with their reason**, never dropped silently — a fetch that quietly discards what it cannot verify
produces a library that looks fully checked and is not.

## §3 What exists

- `scripts/library/fetch-stock-imagery.js` — queries the collection per subject, verifies each
  licence, downloads at 1200px, and writes `candidates.json` carrying **file, subject, query, title,
  licence, usage terms, author and Commons URL** for every image kept.
- Candidates land in a scratch directory **for a person to look at**. Nothing enters the repository
  until it has been looked at, which is this phase's rule applied to its own assets.

## §4 What is left to build

1. **Curate.** Fetch a wider candidate set, look at all of it, keep the images that would not
   embarrass a template. Fix the `people` category or say why it cannot be fixed.
2. **Size and compress.** Decide the shipped resolution — a hero ground and a card tile want
   different ones — and get the whole library into a budget worth stating. Richard's *"wouldn't take
   up too much space"* is the constraint; measure it rather than assume it.
3. **Ship it** through `STARTER_ASSETS` as `noodl_modules/starter-imagery/`, alongside (or replacing)
   the generated SVGs. ⚠️ The `noodl_modules/` prefix is load-bearing: it is what
   `RESTORED_ON_INSTALL` filters on, so anything placed elsewhere travels inside every shared
   template while the installer writes its own copies beside them.
4. **A provenance file that ships with it** — `LICENCES.json` or similar, one row per image with the
   Commons URL and the licence. The library's defensibility is the record, not the memory of it.
5. 🔴 **Make it reachable through the door**, which is the half of Richard's instruction that is not
   about templates: *"when the MCP is making custom apps for people it can piocher in the image
   library."* A model cannot use what it cannot enumerate — the same defect VIB-003 fixed for icons,
   and the fix has the same shape: a block in `get_style_vocabulary` listing what is available by
   subject, with a copyable `src`. ⚠️ **Measure the wire budget before widening it** — that surface
   is already at 3,161/3,500 and 11,720/12,500 (V24), and the tool-surface budget had 26 tokens of
   headroom (V20).
6. **Teach it** in `prompts/design.ts` §5, replacing the paragraph that currently points at the
   generated SVGs.

## §5 Acceptance criteria

1. A curated library of CC0/public-domain photographs ships in `STARTER_ASSETS`, with a provenance
   record naming the licence and source of every file.
2. Its total size is measured and stated.
3. `get_style_vocabulary` lists it, by subject, with a copyable `src` — and the wire budgets are
   re-measured, not assumed.
4. The doctrine teaches it and stops pointing at the placeholders.
5. **A page using it is rendered and LOOKED AT** (README §3), and judged. A stock photograph badly
   cropped in a hero is worse than an abstract ground, and only the picture says which happened.

## §6 Explicitly NOT in this task

- Buying a commercial stock pack. That is a purchasing decision with a different licence basis and
  it is Richard's, not a session's. It stays on the table if CC0 curation cannot reach the bar —
  particularly for `people`.
- Fetching images at author time from a remote service. It would solve quality instantly and it
  breaks the offline-first property the starter assets exist to protect.

---

# Session 5 — 2026-08-31: the library is built, shipped, taught and judged

**Status: 🟡 PASSABLE.** All six ACs are met and the page was rendered and looked at. It is not
WORTHY, and §12 says exactly why in one sentence.

## §7 🔴 The row's own table was right about the wrong licence

§1 excluded Unsplash outright. Re-derived before building on it:

| what §1 said | what is actually true |
|---|---|
| *Unsplash — permits redistributing the photos as a collection: **no*** | True of the **current Unsplash Licence**, adopted June 2017. Not true of these files. |

Before that date Unsplash released under **CC0 1.0**, and a CC0 waiver is irrevocable and
unconditional — a later change to a site's terms cannot reach back and attach a condition to a grant
already made. Commons will not host anything under the post-2017 licence (it is explicitly non-free
there), so `Category:Images from Unsplash` — **31,004 files** — is the CC0 era, and every sample
read back `CC0`. The finding stands and only its conclusion widens: *the current Unsplash Licence is
out; the CC0 grant made before June 2017 is in, and Commons is where those files are provably
tagged.*

🔴 **Fourth time in this phase that a register row was materially wrong about its own premise**
(after V6, V12, V22). The pattern is now unmistakable: **re-derive a row from its predicate before
building on it**, and in this case the predicate was *"which licence, on which files"*.

## §8 `people` is fixed — AC from §4.1 discharged

§2 warned the category was weak, and it was: measured inside `Images from Pixabay`, `woman laptop`
returned **one** file, `chef restaurant` and `students classroom` returned **none**, and `team`
returned a page of sports fixtures. On `Images from Unsplash` the same brief returns a woman working
at a laptop in a café, a busy coffee shop, a market seller weighing limes, two people over a
notebook, a welder, a potter, a baker, a chef and a carpenter. **The category did not need a
different collection strategy; it needed a collection with 31,004 files in it instead of 6,164.**

## §9 🔴 Two client bugs that each read as a fact about the source

Both were caught by the rejection report and the contact sheets, not by any assertion.

1. **The 429 storm.** The first wide run pulled 1800px thumbnails as fast as the loop allowed and
   Wikimedia answered **429 to 553 of 569 requests**. Every subject except `hero` returned zero or
   one candidate. The summary that would have been written from the counts alone is *"Unsplash has
   no food, no portraits and no workspaces"* — **a claim about 31,004 files derived entirely from a
   property of the client.** Fixed with serial paced fetches and backoff.
2. **The drained query list.** `hero` came back as **twenty near-identical foggy mountains** and
   `food` as **twenty cups of coffee**, because a flat "stop at N" let the first query fill every
   slot before `coastline` or `vegetables` ever ran. 🔴 **Every number the run printed was correct**
   — 20/20 kept, licences verified, rejections tallied — **and the set was useless.** Only the
   contact sheet said so. Fixed with `takeRoundRobin`; the re-run drew from 7/7, 6/6, 7/7, 5/5, 6/6,
   5/5 and 2/5 queries, and that last `2/5` is now a real property of the Pixabay texture category
   rather than an artefact.

⚠️ **And a tripwire on the wrong population, in my own script.** The "zero rejections is not
reassurance" warning counted **all** rejections, so six `too small` refusals would have reported a
dead licence filter as healthy. It now counts licence rejections specifically, and the run prints
`licence filter observed refusing 1 file(s) — it is live`.

## §10 What shipped

**44 photographs, 3.32 MB**, in `noodl_modules/starter-imagery/` alongside the six SVGs, all
**CC0** (verified per file, tallied: `{ CC0: 44 }`), registered in `STARTER_ASSETS` (62 assets
total, all resolving on disk, no duplicate destinations).

| subject | n | role | shape |
|---|---|---|---|
| hero | 8 | ground | 1600×900, chosen dark/deep enough to carry display type |
| texture | 6 | surface | 1200×675, q58 |
| work | 8 | tile | 900×675 — somebody making something |
| people | 5 | tile | 900×675 |
| food | 7 | tile | 900×675 |
| animals | 4 | tile | 900×675 |
| avatar | 6 | avatar | 256² framed on the face |

- `LICENCES.json` ships **beside the pictures**, one row per image carrying `subject`, `role`,
  `says`, title, author, licence and Commons URL. 🔴 One file on purpose: the door reads `subject`
  and `role` from it, and a separate catalogue would be a second copy to keep in step with the
  licence record. A curated entry with no provenance row is **refused, not shipped unattributed**.
- `scripts/library/make-stock-library.js` — the curation, written down, including **what was
  refused**: every 2015-era Apple desk (fourteen of the first twenty `workspace` candidates, and a
  WordPress-starter tell in photographic form), near-duplicates from one shoot, query misses (a
  Michigan licence plate under `dinner plate`), and pale low-contrast landscapes for `ground`.
- **The size came down by decision, not by luck**: 4.63 MB → 3.32 MB. The six textures were
  **1.1 MB of the original 4.63** because high-frequency detail is what a lossy codec cannot cheat
  on, and they are the category that needs resolution least. `surface` exists for that reason.

## §11 🔴 Three findings, two of them about instruments

### V33 — the recipe named for an image had no image
`ui-image-scrim-band` shipped `"backgroundImage": ""` with **no connection feeding it**: a scrim
gradient over a bare colour, in VIB-002's flagship recipe. ⚠️ Measured against the opposite case in
the same sweep: `ui-card-grid-repeater`'s `"src": ""` **is** connection-fed (`card_inputs.image` →
`photo.src`) and is correct authoring — which is V7's corrected reading exactly. **Two empty strings,
opposite verdicts, and only the connection list separates them.** Repaired here with
`ground-city-dusk.webp`; its **one-sided measure is still VIB-008's** (V29).

### V34 — the wire-budget gate measured a project state no user is in
`get_style_vocabulary`'s budget spec ran on `copyFixture()`: bare JSON, no Inter, no Lucide, **no
starter imagery**. So it measured the imagery block's *"none installed"* sentence at **+45 prompt /
+31 full** while the real cost — on every project the editor creates, because `STARTER_ASSETS`
installs the library — is **+225 / +515**. The gate was reading about an eighth of the number and
billing the product for it. 🔴 **The icon block has the same two arms and the spec's own comment says
so in passing** (*"a project that actually has an icon set, which the fixture here does not"*), so
this instrument has been pricing the cheap arm since VIB-003 and nobody costed the real one. **V19's
shape, one instrument along.** The spec now installs the starter imagery before measuring.

⚠️ **The general shape, which outlives the number: a budget measured on a fixture is a budget on the
fixture.** Anything whose cost depends on what is installed has to be measured with it installed.

### V35 — the resident tool surface is full
Adding *"and the stock photographs bundled with this project by subject"* to one tool description
pushed the resident surface to **8,286 against its 8,280 budget**. Trimmed to *"and the bundled
stock photographs"*, it sits at **8,279 — one token under.** That surface is billed on every turn of
every session, so the trim was right; but **the next task to touch any tool description will fail
this gate**, and the honest reading is that the surface is out of room, not that it fits.

## §12 The verdict — PASSABLE

Rendered through the Judge in the **door** state at all four viewports, 62 starter assets written
(44 `.webp`), `failed: []`, `unreachablePx: 0` everywhere, `errors: []` everywhere.
`verdicts/vib-011/2026-08-31/marketing-with-photographs/`. **Looked at** at 1280 and 1900.

**What moved, and it is the thing VIB-004 named as its blocker.** The hero is a potter's hands on a
wheel — a real photograph that *says small-batch ceramics*, which is what the page's own copy is
about — and the three testimonials wear **three different faces**. The imagery tell does not fire and
the "everything is one dark abstract" critique is answered. At 1900 the band holds with equal
margins and the `--display-*` clamps carry the headline.

🔴 **Why it is not WORTHY, in one sentence: the headline is still a bare heading on white, and one
band of six carries a photograph.** The rubric's first vibe-worthy tell asks for display type *"on a
designed ground (gradient, image, or a composed colour field)"*, and this page has grounds in
`--surface` grey and one blue gradient. **Shipping the library and using it are different
achievements, and only the first one happened here.** `ui-image-scrim-band` can now do exactly this
and **no page in the corpus places it** — which is register **V8**, and it is **VIB-006's** job, not
a polish pass on this one.

## §13 Gates (2026-08-31, on `3e2cffae` + this work) — gated on EXIT STATUS

| gate | reading |
|---|---|
| `npm run catalog:examples` | **exit 0** — 66/66 clean, strict, warnings-as-errors |
| `npx jest --config packages/noodl-mcp/jest.config.js` | **exit 0** — 79 suites / **1045** tests |
| `npm run typecheck:editor` | **exit 0** |
| `npm run typecheck:mcp` | **exit 0** |
| `vib004-marketing.look.ts` | **exit 0** — 4/4, four viewports, `starterAssets.failed: []` |
| `npm run typecheck:backend-tests` | ⚠️ **not run — cannot complete on this machine** (OOMs at 8 GB, control-proven pre-existing, CI covers it). Nothing this task wrote is a `.look.ts` change. |

✅ **Mutation-checked, not assumed.** Breaking `readImagery` to return empty reds
`reports the installed stock imagery` — and leaves the **budget** spec green, which is precisely why
that control had to exist: an absent block is a cheaper block.
