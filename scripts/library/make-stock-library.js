#!/usr/bin/env node
/**
 * VIB-011 — build the shipped stock-image library from reviewed candidates.
 *
 * `fetch-stock-imagery.js` gathers candidates and verifies their licences. **This script is the
 * second half, and the gap between them is a person looking at the pictures.** {@link CURATION} is
 * the record of that look: every entry names a candidate that was rendered onto a contact sheet and
 * kept, and nothing reaches the repository that is not in it.
 *
 *   STOCK_IN=.stock-candidates node scripts/library/make-stock-library.js
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🔴 **THE ROLE IS THE CROP, AND IT IS NOT A DETAIL**
 *
 * VIB-011 AC5 says a stock photograph badly cropped in a hero is worse than an abstract ground.
 * A 3:2 landscape dropped into a 1:1 avatar slot centres on a torso; a portrait squeezed into a
 * 16:9 band shows a chin. So the library ships each file **already cut for the shape it is for** —
 * {@link ROLES} — rather than shipping originals and hoping the author sets `objectFit`. The author
 * picks a *subject*; the geometry is already right.
 *
 * ⚠️ This is also why `ground` images are the ones chosen dark. A ground carries display type over
 * it, and the VIB-004 page proves the failure mode in the other direction: `ui-split-hero` pointed
 * at `ground-ridge.svg`, a ground used as a subject, and rendered a black rectangle.
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Emits, into `packages/noodl-editor/src/assets/starter-project/noodl_modules/starter-imagery/`:
 *   - one `.webp` per curated entry, already cropped to its role
 *   - `LICENCES.json` — one row per file: title, author, licence, Commons URL
 *   - `manifest.json` — what the editor's module loader reads
 *
 * 🔴 `LICENCES.json` ships **beside the pictures**, not in a doc. The library's defensibility is the
 * record travelling with the files into every app a user deploys, not this repository's memory of
 * where they came from.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const REPO = path.join(__dirname, '..', '..');
const IN = process.env.STOCK_IN || path.join(process.cwd(), '.stock-candidates');
const OUT = path.join(
  REPO,
  'packages/noodl-editor/src/assets/starter-project/noodl_modules/starter-imagery'
);

/**
 * The shapes the library ships in, and the reason each one exists.
 *
 * ⚠️ `quality` is tuned against the **total**, which Richard bounded — *"wouldn't take up too much
 * space"*. WebP rather than JPEG for roughly half the bytes at the same look; `.webp` is already in
 * the editor's own `IMAGE_EXTENSIONS` (`ImageType.ts`), `utils.ts` and `fileReferences.ts`, so this
 * is not a format the product has to learn.
 */
const ROLES = {
  /** Full-bleed band ground and hero media. 16:9 so it survives a wide viewport un-letterboxed. */
  ground: { width: 1600, height: 900, quality: 68, position: 'centre' },
  /**
   * A surface, not a subject — brick, soil, snow. Deliberately smaller and softer than a `ground`.
   *
   * 🔴 These were the budget. At `ground` settings the six textures cost **1.1 MB of a 4.6 MB
   * library** — brick alone was 424 KB — because high-frequency detail is exactly what a lossy
   * codec cannot cheat on. They are also the category that needs resolution least: nobody reads a
   * wall. Halving them is the difference between a library that ships and one that gets argued
   * about.
   */
  surface: { width: 1200, height: 675, quality: 58, position: 'centre' },
  /** Feature card, media column, gallery cell. 4:3 is the shape a card actually wants. */
  tile: { width: 900, height: 675, quality: 72, position: 'centre' },
  /**
   * Testimonial and comment avatars — square, because every avatar surface crops to a circle.
   *
   * 🔴 `position: 'north'`, and the first version used sharp's `attention`. `attention` picks the
   * highest-entropy region, which in a portrait is **clothing texture or a busy background**, not a
   * face: it cropped a standing figure to head-and-torso, so the face landed at maybe 12px inside a
   * 40px circle. An entropy metric measures *a* property of the image and not the one an avatar is
   * about. Faces sit in the upper third of a portrait frame, so the dumb rule beats the clever one.
   */
  avatar: { width: 256, height: 256, quality: 80, position: 'north' }
};

/**
 * 🔴 **The curation, i.e. the part no metric produced.**
 *
 * Seven contact sheets of twenty were rendered and looked at. What was refused is as informative as
 * what was kept, so it is written down rather than implied:
 *
 * - **Every 2015-era Apple desk** — the white iMac, the flat-lay keyboard, the blank MacBook screen.
 *   Fourteen of the first twenty `workspace` candidates were these, and they are a *WordPress-starter
 *   tell in photographic form*: the exact stock a 2016 theme demo shipped with. The workshop, the
 *   bakery, the potter's wheel and the welder say a real thing happens here; the empty desk says a
 *   theme was installed.
 * - **Near-duplicates from one shoot.** Two candidates were the same pink flat-lay from the same
 *   session, and a library that ships both looks like a library that ships one.
 * - **Query misses.** A Michigan licence plate under `dinner plate`, a wedding under `sewing`, the
 *   Taj Mahal under `marble`. The search matched a word; the picture is about something else.
 * - **Pale, low-contrast landscapes** for `ground`. A ground carries white display type. A washed-out
 *   sky is a ground that cannot.
 *
 * ⚠️ `texture` stays the thin category — `Category:Images from Pixabay` answered 2 of 5 queries and
 * returned mostly produce macros. Six real surfaces were kept and that is honest coverage, not the
 * twenty the fetcher could have padded it to.
 */
const CURATION = [
  // ── Grounds: dark or deep enough to carry display type ────────────────────
  { from: 'hero-15.jpg', to: 'ground-city-dusk', role: 'ground', subject: 'hero', says: 'a city skyline at dusk, purple and lit' },
  { from: 'hero-19.jpg', to: 'ground-forest-fog', role: 'ground', subject: 'hero', says: 'fog lying over a pine forest' },
  { from: 'hero-12.jpg', to: 'ground-canyon', role: 'ground', subject: 'hero', says: 'a slot canyon, deep orange' },
  { from: 'hero-09.jpg', to: 'ground-dune', role: 'ground', subject: 'hero', says: 'a dune ridge cutting the frame diagonally' },
  { from: 'hero-01.jpg', to: 'ground-coast', role: 'ground', subject: 'hero', says: 'a coastline from above, turquoise water' },
  { from: 'hero-20.jpg', to: 'ground-shore', role: 'ground', subject: 'hero', says: 'shallow sea meeting pale sand, from above' },
  { from: 'hero-05.jpg', to: 'ground-red-rock', role: 'ground', subject: 'hero', says: 'red rock under a dusk sky' },
  { from: 'hero-08.jpg', to: 'ground-skyline', role: 'ground', subject: 'hero', says: 'a dense city skyline in daylight' },

  // ── Work: somebody making something ───────────────────────────────────────
  { from: 'workspace-07.jpg', to: 'work-welder', role: 'tile', subject: 'work', says: 'a welder, sparks flying' },
  { from: 'workspace-09.jpg', to: 'work-potter', role: 'tile', subject: 'work', says: "hands throwing a pot on a wheel" },
  { from: 'workspace-03.jpg', to: 'work-baker', role: 'tile', subject: 'work', says: 'a baker loading a rack' },
  { from: 'workspace-11.jpg', to: 'work-chef', role: 'tile', subject: 'work', says: 'a chef prepping in a kitchen' },
  { from: 'workspace-13.jpg', to: 'work-carpenter', role: 'tile', subject: 'work', says: 'a carpenter marking a board' },
  { from: 'workspace-02.jpg', to: 'work-leather-bench', role: 'tile', subject: 'work', says: 'a leather workbench with tools laid out' },
  { from: 'workspace-04.jpg', to: 'work-machine-shop', role: 'tile', subject: 'work', says: 'a row of machine-shop lathes' },
  { from: 'workspace-15.jpg', to: 'work-hands-clay', role: 'tile', subject: 'work', says: "hands on wet clay, black and white" },

  // ── People ────────────────────────────────────────────────────────────────
  { from: 'people-01.jpg', to: 'people-cafe', role: 'tile', subject: 'people', says: 'a woman working at a laptop in a café' },
  { from: 'people-09.jpg', to: 'people-coffee-shop', role: 'tile', subject: 'people', says: 'a busy coffee shop interior' },
  { from: 'people-12.jpg', to: 'people-meeting', role: 'tile', subject: 'people', says: 'two people over a notebook and a tablet' },
  { from: 'people-14.jpg', to: 'people-market', role: 'tile', subject: 'people', says: 'a market seller weighing limes' },
  { from: 'people-16.jpg', to: 'people-desk', role: 'tile', subject: 'people', says: 'someone working at a laptop by a window' },

  // ── Food ──────────────────────────────────────────────────────────────────
  { from: 'food-04.jpg', to: 'food-market', role: 'tile', subject: 'food', says: 'a market spread of fruit and vegetables' },
  { from: 'food-02.jpg', to: 'food-bread', role: 'tile', subject: 'food', says: 'sourdough loaves' },
  { from: 'food-01.jpg', to: 'food-board', role: 'tile', subject: 'food', says: 'a red onion and peppercorns on a board' },
  { from: 'food-09.jpg', to: 'food-plate', role: 'tile', subject: 'food', says: 'a plated steak' },
  { from: 'food-10.jpg', to: 'food-grocer', role: 'tile', subject: 'food', says: 'a greengrocer stall with a customer' },
  { from: 'food-19.jpg', to: 'food-carrots', role: 'tile', subject: 'food', says: 'carrots in a crate on dark wood' },
  { from: 'food-20.jpg', to: 'food-bakery', role: 'tile', subject: 'food', says: 'a bakery counter' },

  // ── Animals ───────────────────────────────────────────────────────────────
  { from: 'animals-02.jpg', to: 'animal-cat', role: 'tile', subject: 'animals', says: 'a grey cat in a window' },
  { from: 'animals-08.jpg', to: 'animal-horse', role: 'tile', subject: 'animals', says: 'a horse, close' },
  { from: 'animals-15.jpg', to: 'animal-sheep', role: 'tile', subject: 'animals', says: 'a flock of sheep in a field' },
  { from: 'animals-16.jpg', to: 'animal-dog', role: 'tile', subject: 'animals', says: 'a dog looking at the camera' },

  // ── Surfaces ──────────────────────────────────────────────────────────────
  { from: 'texture-14.jpg', to: 'texture-brick', role: 'surface', subject: 'texture', says: 'a brick wall' },
  { from: 'texture-16.jpg', to: 'texture-soil', role: 'surface', subject: 'texture', says: 'dark turned soil' },
  { from: 'texture-11.jpg', to: 'texture-snow', role: 'surface', subject: 'texture', says: 'fresh snow' },
  { from: 'texture-19.jpg', to: 'texture-pebbles', role: 'surface', subject: 'texture', says: 'white pebbles' },
  { from: 'texture-12.jpg', to: 'texture-coffee', role: 'surface', subject: 'texture', says: 'roasted coffee beans' },
  { from: 'texture-13.jpg', to: 'texture-earth', role: 'surface', subject: 'texture', says: 'cracked dry earth' },

  // ── Avatars ───────────────────────────────────────────────────────────────
  // 🔴 Six, and chosen across age, gender and ethnicity on purpose. The VIB-004 page shipped three
  // testimonials wearing the SAME generated portrait glyph, and "the people in this product all
  // look identical" is a thing a reader notices before they read a word of the copy.
  // 🔴 `tighten` because a crop POSITION cannot fix a subject that is small in its own frame. This
  // source is a standing figure on a plain ground; north-anchored, the face still landed at ~12px
  // in a 40px circle. Looking at the six rendered as circles is what caught it — the file was
  // correct, the right size, the right aspect ratio, and useless.
  { from: 'portrait-01.jpg', to: 'avatar-1', role: 'avatar', subject: 'avatar', tighten: 0.5, says: 'a young man laughing' },
  { from: 'portrait-15.jpg', to: 'avatar-2', role: 'avatar', subject: 'avatar', says: 'a young woman, close portrait' },
  { from: 'portrait-16.jpg', to: 'avatar-3', role: 'avatar', subject: 'avatar', says: 'a woman smiling in a hooded coat' },
  { from: 'portrait-03.jpg', to: 'avatar-4', role: 'avatar', subject: 'avatar', says: 'a man smiling, arms folded' },
  { from: 'portrait-06.jpg', to: 'avatar-5', role: 'avatar', subject: 'avatar', says: 'a woman smiling outdoors' },
  { from: 'portrait-12.jpg', to: 'avatar-6', role: 'avatar', subject: 'avatar', says: 'a woman in a patterned headscarf' }
];

async function main() {
  const candidates = JSON.parse(fs.readFileSync(path.join(IN, 'candidates.json'), 'utf8'));
  const byFile = new Map(candidates.kept.map((k) => [k.file, k]));

  fs.mkdirSync(OUT, { recursive: true });

  const licences = [];
  const entries = [];
  let total = 0;
  const missing = [];

  for (const item of CURATION) {
    const provenance = byFile.get(item.from);
    // 🔴 A curated entry whose provenance is missing is REFUSED, not shipped unattributed. The whole
    // argument for this library is that every file's licence was read; one file without a row would
    // make LICENCES.json a claim rather than a record.
    if (!provenance) {
      missing.push(item.from);
      continue;
    }
    const role = ROLES[item.role];
    const out = `${item.to}.webp`;
    const src = path.join(IN, item.from);

    // An optional pre-crop: take a square of `tighten` × the short edge, anchored top-centre, before
    // the role resize. For the one candidate whose subject is small in frame.
    let pipeline = sharp(src);
    if (item.tighten) {
      const meta = await sharp(src).metadata();
      const side = Math.round(Math.min(meta.width, meta.height) * item.tighten);
      pipeline = pipeline.extract({
        left: Math.round((meta.width - side) / 2),
        top: Math.round(meta.height * 0.04),
        width: side,
        height: side
      });
    }

    const buf = await pipeline
      .resize(role.width, role.height, { fit: 'cover', position: role.position })
      .webp({ quality: role.quality })
      .toBuffer();
    fs.writeFileSync(path.join(OUT, out), buf);
    total += buf.length;

    entries.push({ file: out, subject: item.subject, role: item.role, says: item.says });
    licences.push({
      file: out,
      subject: item.subject,
      role: item.role,
      says: item.says,
      title: provenance.title.replace(/^File:/, ''),
      author: provenance.author || '(not stated)',
      licence: provenance.licence,
      source: provenance.source
    });
  }

  if (missing.length) {
    console.error(`[stock] 🔴 ${missing.length} curated file(s) had no provenance row and were REFUSED:`);
    for (const m of missing) console.error(`         ${m}`);
    process.exit(1);
  }

  fs.writeFileSync(
    path.join(OUT, 'LICENCES.json'),
    JSON.stringify(
      {
        _note:
          'The record for every photograph in this module: what it is, what shape it was cut for, ' +
          'and where it came from. 🔴 It is ONE file on purpose — the door (get_style_vocabulary) ' +
          'reads its `subject` and `role` to tell an authoring model what is available, and a ' +
          'separate catalogue would be a second copy to keep in step with the licences. Each file ' +
          'was fetched from Wikimedia ' +
          'Commons and its licence read per file, not assumed from the collection it sat in. All ' +
          'are CC0 or public domain: no attribution is required, no share-alike applies, and there ' +
          'is no restriction on redistributing them as a collection — which is what shipping them ' +
          'inside an application and inside every app you deploy actually does. Built by ' +
          'scripts/library/make-stock-library.js from scripts/library/fetch-stock-imagery.js.',
        images: licences
      },
      null,
      2
    ) + '\n'
  );

  const bySubject = {};
  for (const e of entries) (bySubject[e.subject] ||= []).push(e.file);

  console.log(`[stock] wrote ${entries.length} images to ${path.relative(REPO, OUT)}`);
  console.log(`[stock] total ${(total / 1024).toFixed(0)} KB (${(total / 1024 / 1024).toFixed(2)} MB)`);
  for (const [subject, files] of Object.entries(bySubject)) {
    console.log(`         ${subject}: ${files.length}`);
  }
  fs.writeFileSync(path.join(IN, 'library-entries.json'), JSON.stringify(entries, null, 2) + '\n');
}

main().catch((e) => {
  console.error('[stock] failed:', e.message);
  process.exit(1);
});
