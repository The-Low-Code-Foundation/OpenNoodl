# VIB-011 — The Stock Library

**Register row: V30.** Opened 2026-08-31 by Richard's instruction, session 3.

> *"we should download some stock images and keep them in the deployed editor as a kind of stock
> image library of basic shit, dunno how many but enough to do hero images, backgrounds, stock
> images of people doing shit, food, animals, whatever, to at least show stock stuff with the
> templates and even for when the MCP is making custom apps for people it can piocher in the image
> library. Wouldn't take up too much space and would solve a lot of problems."*

**Status: 🟡 the pipeline is proven and the source is found; the library is not built.**

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
| Unsplash | yes, generously | **no** — the licence restricts compiling photos into a similar or competing service |
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
