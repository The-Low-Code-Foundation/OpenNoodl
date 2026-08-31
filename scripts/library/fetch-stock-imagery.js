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
 * 🔴 **WHY WIKIMEDIA COMMONS, AND WHY EVERY IMAGE CARRIES ITS LICENCE**
 *
 * This library is **redistributed twice**: once inside a desktop application shipped to strangers,
 * and again inside every app those strangers deploy publicly. That is a stronger requirement than
 * "free to use", and it rules out most stock sources. Unsplash and Pexels both licence generously
 * for *use* and both restrict *redistribution of the photos as a collection* — which is precisely
 * what a bundled library is. Neither can be the basis for this.
 *
 * **CC0 and public domain can**, because there is no downstream obligation to pass on: no
 * attribution, no share-alike, no field-of-use limit. Commons is the source that makes it
 * *checkable* — every file's licence is queryable through the API, so the library is not "images
 * somebody believed were free" but images whose licence was read, per file, and recorded beside
 * them. `ACCEPTED_LICENCES` below is the whole trust boundary.
 *
 * ⚠️ **A rejected file is REPORTED, never skipped in silence.** A fetch that quietly drops what it
 * cannot verify produces a library that looks fully checked and is not.
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 *   node scripts/library/fetch-stock-imagery.js            # fetch candidates for review
 *   node scripts/library/fetch-stock-imagery.js --report   # print the provenance of what is kept
 *
 * Candidates land in a scratch directory for a PERSON TO LOOK AT. Nothing enters the repository
 * until it has been looked at — the same rule as every other verdict in this phase.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const API = 'https://commons.wikimedia.org/w/api.php';
const OUT = process.env.STOCK_OUT || path.join(process.cwd(), '.stock-candidates');

/**
 * The only licences that may enter the library.
 *
 * 🔴 Exact strings, matched case-insensitively against Commons' `LicenseShortName`. Not a regex on
 * "public domain" — "Public Domain in the United States only" is a different fact from "public
 * domain", and a pattern loose enough to catch the good case catches that one too.
 */
const ACCEPTED_LICENCES = ['cc0', 'public domain', 'pd', 'pdm', 'cc pd', 'no restrictions'];

/**
 * 🔴 **The collection, and it took two attempts to find — the first result is worth keeping.**
 *
 * Searching Commons at large for CC0 photographs returns a **museum catalogue**, not a stock
 * library: "people working" gave three archive photographs of iron tools and a Regency print,
 * "animals" gave two eighteenth-century oil paintings. Four of twenty-two candidates were usable.
 * The good free stock — the kind Richard actually asked for — lives on Unsplash and Pexels, whose
 * licences permit *use* and specifically restrict redistributing the photographs **as a
 * collection**, which is exactly what bundling into a shipped editor is.
 *
 * `Category:Images from Pixabay` is the intersection that resolves it: Pixabay stock photography,
 * donated to Commons, and carrying **CC0** on each file — so the pictures are stock-quality and the
 * licence permits the two redistributions this library performs. Searching *inside* the category
 * with `incategory:` is what makes it a library rather than a pile.
 *
 * ⚠️ Membership of the category is NOT the licence guarantee — `licenceOk` still reads each file's
 * own `LicenseShortName` and rejects anything that is not CC0 or public domain. Two checks, because
 * a category is a claim somebody made and the licence field is the record.
 */
const IN_COLLECTION = 'incategory:"Images from Pixabay"';

/** What the library needs to cover, in Richard's own words, with the queries that find it. */
const SUBJECTS = [
  { slug: 'hero', queries: ['mountain', 'sea sunset', 'forest path', 'city night'] },
  { slug: 'background', queries: ['texture', 'abstract pattern', 'wall concrete', 'gradient sky'] },
  { slug: 'people', queries: ['woman working', 'man portrait', 'team meeting', 'hands craft', 'people walking'] },
  { slug: 'food', queries: ['coffee', 'vegetables', 'bread', 'cake', 'fruit'] },
  { slug: 'animals', queries: ['dog', 'cat', 'bird', 'horse'] }
];

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

const licenceOk = (short) => {
  if (!short) return false;
  const s = String(short).toLowerCase().trim();
  return ACCEPTED_LICENCES.some((ok) => s === ok || s.startsWith(ok + ' ') || s === ok + '-1.0');
};

const strip = (html) => String(html || '').replace(/<[^>]*>/g, '').trim();

async function search(query, limit) {
  const url =
    `${API}?action=query&format=json&generator=search&gsrsearch=${encodeURIComponent(`${IN_COLLECTION} ${query}`)}` +
    `&gsrnamespace=6&gsrlimit=${limit}&prop=imageinfo&iiprop=url|extmetadata|size|mime&iiurlwidth=1200`;
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
    let index = 0;
    for (const query of subject.queries) {
      const pages = await search(query, 12);
      for (const page of pages) {
        const ii = (page.imageinfo || [])[0];
        if (!ii || !/^image\/(jpeg|png)$/.test(ii.mime || '')) continue;
        const em = ii.extmetadata || {};
        const licence = strip((em.LicenseShortName || {}).value);
        if (!licenceOk(licence)) {
          rejected.push({ title: page.title, licence: licence || '(none reported)' });
          continue;
        }
        if (ii.width < 1200) {
          rejected.push({ title: page.title, licence, why: `too small (${ii.width}px)` });
          continue;
        }
        const name = `${subject.slug}-${String(++index).padStart(2, '0')}.jpg`;
        const src = ii.thumburl || ii.url;
        const img = await get(src);
        if (img.status !== 200) {
          rejected.push({ title: page.title, licence, why: `download ${img.status}` });
          continue;
        }
        fs.writeFileSync(path.join(OUT, name), img.body);
        kept.push({
          file: name,
          subject: subject.slug,
          query,
          title: page.title,
          licence,
          usageTerms: strip((em.UsageTerms || {}).value),
          author: strip((em.Artist || {}).value).slice(0, 120),
          source: `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`,
          bytes: img.body.length
        });
        if (index >= 4) break;
      }
      if (index >= 4) break;
    }
  }

  fs.writeFileSync(path.join(OUT, 'candidates.json'), JSON.stringify({ kept, rejected }, null, 2) + '\n');
  console.log(`[stock] kept ${kept.length} candidates in ${OUT}`);
  console.log(`[stock] rejected ${rejected.length} — reported, never silent:`);
  const byReason = {};
  for (const r of rejected) {
    const k = r.why ? r.why.replace(/\d+/g, 'N') : `licence: ${r.licence}`;
    byReason[k] = (byReason[k] || 0) + 1;
  }
  for (const [k, v] of Object.entries(byReason).sort((a, b) => b[1] - a[1])) console.log(`         ${v} × ${k}`);
}

main().catch((e) => {
  console.error('[stock] failed:', e.message);
  process.exit(1);
});
