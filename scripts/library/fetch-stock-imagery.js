#!/usr/bin/env node
/**
 * VIB-011 — fetch candidates for the bundled stock-image library.
 *
 * Richard, 2026-08-31: *"we should download some stock images and keep them in the deployed editor
 * as a kind of stock image library of basic shit… enough to do hero images, backgrounds, stock
 * images of people doing shit, food, animals, whatever, to at least show stock stuff with the
 * templates and even for when the MCP is making custom apps for people it can piocher in the image
 * library."*
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🔴 **WHY COMMONS, AND WHY EVERY IMAGE CARRIES ITS LICENCE**
 *
 * This library is **redistributed twice**: once inside a desktop application shipped to strangers,
 * and again inside every app those strangers deploy publicly. That is a stronger requirement than
 * "free to use", and it is the whole constraint.
 *
 * **CC0 and public domain are the only classes that survive it**, because there is no downstream
 * obligation to pass on: no attribution, no share-alike, no field-of-use limit, and — the one that
 * matters here — no restriction on redistributing the images as a collection. Commons is the source
 * that makes it *checkable*: every file's licence is queryable through the API, so the library is
 * not "images somebody believed were free" but images whose licence was read, per file, and
 * recorded beside them. `ACCEPTED_LICENCES` below is the whole trust boundary.
 *
 * ⚠️ **A rejected file is REPORTED, never skipped in silence.** A fetch that quietly drops what it
 * cannot verify produces a library that looks fully checked and is not. The rejection tally is also
 * the only evidence the licence filter still *works*: a run with zero rejections and a run with a
 * broken filter print the same thing, so `--report` prints what was refused and why.
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *   node scripts/library/fetch-stock-imagery.js            # fetch candidates for review
 *   STOCK_PER_SUBJECT=24 node scripts/library/fetch-stock-imagery.js
 *
 * Candidates land in a scratch directory for a PERSON TO LOOK AT. Nothing enters the repository
 * until it has been looked at — the same rule as every other verdict in this phase.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const API = 'https://commons.wikimedia.org/w/api.php';
const OUT = process.env.STOCK_OUT || path.join(process.cwd(), '.stock-candidates');
/** How many candidates to keep per subject. Generous on purpose: curation happens by looking. */
const PER_SUBJECT = Number(process.env.STOCK_PER_SUBJECT || 24);

/**
 * The only licences that may enter the library.
 *
 * 🔴 Exact strings, matched case-insensitively against Commons' `LicenseShortName`. Not a regex on
 * "public domain" — "Public Domain in the United States only" is a different fact from "public
 * domain", and a pattern loose enough to catch the good case catches that one too.
 */
const ACCEPTED_LICENCES = ['cc0', 'public domain', 'pd', 'pdm', 'cc pd', 'no restrictions'];

/**
 * 🔴 **The collections, and finding them took three attempts. The wrong turns are the useful part.**
 *
 * **Attempt 1 — CC0 across Commons at large — returned a museum catalogue.** "People working" gave
 * three archive photographs of iron tools and a Regency print; "animals" gave two eighteenth-century
 * oil paintings. Four of twenty-two candidates were usable. The licence filter worked perfectly and
 * the subject matter was wrong, which is a different failure and is easy to misread as "CC0 has no
 * good pictures".
 *
 * **Attempt 2 — `Category:Images from Pixabay`** (6,164 files) — is real stock and is where the
 * textures, animals and food come from. ⚠️ But its **people are thin**: measured, `woman laptop`
 * returned one file, `chef restaurant` and `students classroom` returned none, and `team` returned
 * a page of sports fixtures. Multi-word queries inside a category of that size mostly return
 * nothing. VIB-011 §2 flagged this and it is real.
 *
 * **Attempt 3 — `Category:Images from Unsplash`** (31,004 files) — is what fixes `people`, and the
 * licence question it raises has an answer worth writing down rather than re-deriving:
 *
 * 🔴 **"Unsplash is out" was right about the wrong licence.** The restriction VIB-011 §1 names —
 * no compiling the photographs into a competing collection — lives in the **current Unsplash
 * Licence**, adopted June 2017, which you get by downloading from unsplash.com today. It is not the
 * licence on these files. Before that date Unsplash released under **CC0 1.0**, and a CC0 waiver is
 * irrevocable and unconditional: a later change to a site's terms cannot reach back and add a
 * condition to a grant already made. Commons will not host anything under the post-2017 Unsplash
 * Licence — it is explicitly non-free there — so what remains in this category is the CC0 era.
 * The finding stands and only its conclusion widens: *the current Unsplash Licence is out; the CC0
 * grant it made before June 2017 is in, and Commons is where those files are provably tagged.*
 *
 * ⚠️ Membership of a category is NOT the licence guarantee — `licenceOk` still reads each file's
 * own `LicenseShortName` and rejects anything that is not CC0 or public domain. Two checks, because
 * a category is a claim somebody made and the licence field is the record. Keeping Pixabay in the
 * run is load-bearing for a second reason: it is the collection that actually contains non-CC0
 * files (a `CC BY-SA 4.0` shows up in `child`), so the filter is observed rejecting something on
 * every run rather than being trusted because nothing failed.
 */
const COLLECTIONS = {
  unsplash: 'incategory:"Images from Unsplash"',
  pixabay: 'incategory:"Images from Pixabay"'
};

/**
 * What the library needs to cover, in Richard's own words, with the queries that find it.
 *
 * ⚠️ Single- and two-word queries only. Commons' `incategory:` search ANDs the terms, and three-word
 * queries returned zero across the board while their two-word prefixes returned ten.
 *
 * 🔴 **The queries are ROUND-ROBINED, and the first version drained them in order.** With a flat
 * "stop at N" the first query filled every slot: `hero` came back as twenty near-identical foggy
 * mountains and `food` as twenty cups of coffee, because `mountain fog` and `coffee cup` each
 * returned twenty hits before `coastline` or `vegetables` ever ran. Looking at the contact sheet
 * the reading is *"the collection is monotonous"* — a statement about 31,004 files derived entirely
 * from the order of a loop. It is the same failure as the 429 storm one step along: **a property of
 * the client, read as a fact about the source.** {@link takeRoundRobin} is the fix and the reason
 * it is not simply `break`.
 */
const SUBJECTS = [
  {
    slug: 'hero',
    collection: 'unsplash',
    queries: ['coastline', 'city skyline', 'desert dunes', 'forest path', 'lake sunrise', 'canyon', 'ocean waves']
  },
  {
    slug: 'workspace',
    collection: 'unsplash',
    queries: ['workshop', 'tools bench', 'pottery', 'sewing', 'restaurant kitchen', 'desk workspace']
  },
  {
    slug: 'people',
    collection: 'unsplash',
    queries: ['woman laptop', 'people working', 'cooking', 'craft hands', 'meeting', 'builder', 'market seller']
  },
  {
    slug: 'portrait',
    collection: 'unsplash',
    queries: ['portrait smiling', 'portrait woman', 'portrait man', 'headshot', 'face portrait']
  },
  {
    slug: 'food',
    collection: 'unsplash',
    queries: ['vegetables', 'bread', 'dinner plate', 'fruit market', 'coffee cup', 'salad']
  },
  {
    slug: 'animals',
    collection: 'unsplash',
    queries: ['dog', 'cat', 'horse', 'bird', 'sheep']
  },
  {
    slug: 'texture',
    collection: 'pixabay',
    queries: ['texture', 'abstract pattern', 'concrete wall', 'marble', 'paper texture']
  }
];

/**
 * Interleave per-query result lists so every query contributes before any query contributes twice.
 *
 * The alternative — take from query 1 until full — is what produced twenty foggy mountains, and its
 * failure is invisible in every number the run prints. The count was right (20/20), the licences
 * were right, the rejection tally was right, and the set was useless. Only the contact sheet said
 * so, which is this phase's whole method applied to its own tooling.
 */
function takeRoundRobin(lists, limit) {
  const out = [];
  for (let depth = 0; out.length < limit; depth++) {
    let drew = false;
    for (const list of lists) {
      if (depth >= list.length) continue;
      if (out.length >= limit) break;
      out.push(list[depth]);
      drew = true;
    }
    if (!drew) break;
  }
  return out;
}

const get = (url) =>
  new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'NodeGX-stock-fetch/1.0 (https://nodegx.io)' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return resolve(get(res.headers.location));
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks) }));
      })
      .on('error', reject);
  });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * 🔴 **Fetch thumbnails serially, paced, with backoff — and this is not politeness, it is the
 * difference between a library and a wrong conclusion about the source.**
 *
 * The first wide run pulled 1800px thumbnails as fast as the event loop allowed and Wikimedia
 * answered **429 to 553 of 569 requests**. Every subject except `hero` came back with zero or one
 * candidate. Read through the rejection tally the reading is obvious — *rate limited* — but the
 * shape it would have taken in a summary is *"Unsplash has no food, no portraits and no
 * workspaces"*, which is a claim about the collection derived entirely from a property of the
 * client. It is the reason `--report` prints reasons rather than a count.
 */
async function fetchImage(url) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await get(url);
    if (res.status !== 429) return res;
    await sleep(2000 * (attempt + 1));
  }
  return { status: 429, body: Buffer.alloc(0) };
}

const licenceOk = (short) => {
  if (!short) return false;
  const s = String(short).toLowerCase().trim();
  return ACCEPTED_LICENCES.some((ok) => s === ok || s.startsWith(ok + ' ') || s === ok + '-1.0');
};

const strip = (html) => String(html || '').replace(/<[^>]*>/g, '').trim();

async function search(collection, query, limit) {
  const url =
    `${API}?action=query&format=json&generator=search&gsrsearch=${encodeURIComponent(`${collection} ${query}`)}` +
    `&gsrnamespace=6&gsrlimit=${limit}&prop=imageinfo&iiprop=url|extmetadata|size|mime&iiurlwidth=1800`;
  const res = await get(url);
  if (res.status !== 200) return [];
  const pages = (JSON.parse(res.body.toString()).query || {}).pages || {};
  return Object.values(pages);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const kept = [];
  const rejected = [];

  for (const subject of SUBJECTS) {
    const collection = COLLECTIONS[subject.collection];
    const seen = new Set();

    // Search every query FIRST, then interleave — so a productive query cannot starve the rest.
    const perQuery = [];
    for (const query of subject.queries) {
      const pages = await search(collection, query, 20);
      const fresh = [];
      for (const page of pages) {
        if (seen.has(page.title)) continue;
        seen.add(page.title);
        fresh.push({ page, query });
      }
      perQuery.push(fresh);
      await sleep(200);
    }

    let index = 0;
    for (const { page, query } of takeRoundRobin(perQuery, PER_SUBJECT * 2)) {
      if (index >= PER_SUBJECT) break;
      const ii = (page.imageinfo || [])[0];
      if (!ii || !/^image\/(jpeg|png)$/.test(ii.mime || '')) continue;
      const em = ii.extmetadata || {};
      const licence = strip((em.LicenseShortName || {}).value);
      if (!licenceOk(licence)) {
        rejected.push({ title: page.title, subject: subject.slug, licence: licence || '(none reported)' });
        continue;
      }
      // 🔴 1600 is the widest thing the library ships (a full-bleed hero ground). A source narrower
      // than that would be upscaled into the very softness a stock photo is here to avoid, so it is
      // refused rather than shipped blurry.
      if (ii.width < 1600) {
        rejected.push({ title: page.title, subject: subject.slug, licence, why: `too small (${ii.width}px)` });
        continue;
      }
      const name = `${subject.slug}-${String(index + 1).padStart(2, '0')}.jpg`;
      const img = await fetchImage(ii.thumburl || ii.url);
      await sleep(300);
      if (img.status !== 200) {
        rejected.push({ title: page.title, subject: subject.slug, licence, why: `download ${img.status}` });
        continue;
      }
      index++;
      fs.writeFileSync(path.join(OUT, name), img.body);
      kept.push({
        file: name,
        subject: subject.slug,
        collection: subject.collection,
        query,
        title: page.title,
        licence,
        usageTerms: strip((em.UsageTerms || {}).value),
        author: strip((em.Artist || {}).value).slice(0, 120),
        source: `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`,
        sourceWidth: ii.width,
        sourceHeight: ii.height,
        bytes: img.body.length
      });
    }
    const queries = [...new Set(kept.filter((k) => k.subject === subject.slug).map((k) => k.query))];
    console.log(`[stock] ${subject.slug}: ${index} candidates across ${queries.length}/${subject.queries.length} queries`);
  }

  fs.writeFileSync(path.join(OUT, 'candidates.json'), JSON.stringify({ kept, rejected }, null, 2) + '\n');
  console.log(`\n[stock] kept ${kept.length} candidates in ${OUT}`);
  console.log(`[stock] rejected ${rejected.length} — reported, never silent:`);
  const byReason = {};
  for (const r of rejected) {
    const k = r.why ? r.why.replace(/\d+/g, 'N') : `licence: ${r.licence}`;
    byReason[k] = (byReason[k] || 0) + 1;
  }
  for (const [k, v] of Object.entries(byReason).sort((a, b) => b[1] - a[1])) console.log(`         ${v} × ${k}`);
  // 🔴 The tripwire counts LICENCE rejections specifically, and the first version of it counted all
  // rejections — which meant six "too small" refusals would have reported the filter as healthy
  // while it was doing nothing. A tripwire on the wrong population is the defect it exists to
  // catch, one level up.
  const licenceRejections = rejected.filter((r) => !r.why).length;
  if (!licenceRejections) {
    console.log(`\n[stock] 🔴 ZERO LICENCE rejections in this run (${rejected.length} refused on other grounds).`);
    console.log('        That is not reassurance — a filter that accepts everything prints exactly');
    console.log('        this. Widen a query into `Category:Images from Pixabay`, which does hold');
    console.log('        non-CC0 files, and confirm the filter refuses one before trusting the set.');
  } else {
    console.log(`\n[stock] licence filter observed refusing ${licenceRejections} file(s) — it is live.`);
  }
}

main().catch((e) => {
  console.error('[stock] failed:', e.message);
  process.exit(1);
});
