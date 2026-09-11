/**
 * VIB-003 follow-up — **the gutter, measured on the rendered page.**
 *
 * Richard, 2026-08-31, on the VIB-003 verdict page: *"there's a habit so far with the MCP to create
 * pages with no padding on the left and right side of certain sections… in the hero section the
 * text is tight to the left and right of the window, not the whole thing but just that one section
 * weirdly."*
 *
 * 🔴 **"Weirdly" is the finding, not an aside.** A page with no gutter anywhere reads as a missing
 * rule. A page where three bands are inset and one is not reads as a *mistake*, because the eye has
 * the other three to compare it against. So the thing to measure is not "does this band have
 * padding" but **whether the bands on one page agree about the same edge** — which is why this
 * prints the set of distinct gutters and flags disagreement, rather than checking a threshold.
 *
 * ⚠️ **A harness, not a gate.** It asserts nothing; its output is numbers to read beside the PNGs,
 * and the `.look.ts` suffix keeps it outside `jest.config.js`'s `testMatch`. Run:
 *
 *     npx jest --config packages/nodegx-backend/jest.config.js \
 *       --testMatch '**\/tests/**\/*.look.ts' --runTestsByPath \
 *       packages/nodegx-backend/tests/vib003-gutters.look.ts
 *
 * ## 🔴 Why this measures the DOM and not the artefact
 *
 * A static sweep was written first. It asked *"does this band or anything under it set
 * `paddingLeft` or `maxWidth`?"* and reported **no defect on the band Richard was pointing at** —
 * because `ui-split-hero`'s lead paragraph carries `maxWidth: 520px`, which insets one paragraph
 * and nothing else. The predicate was satisfied by a property with nothing to do with the page's
 * edge. Only the rendered page carries the number a person is reading.
 */
import { placeStarterAssets } from './helpers/judge';
import { withRenderedPage } from './helpers/site-drive';

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

jest.setTimeout(1800000);

const REPO = path.join(__dirname, '..', '..', '..');
const PHASE = path.join(REPO, 'dev-docs', 'tasks', 'phase-81-the-look-is-the-product');

const GUTTERS = `(function () {
  var root = document.querySelector('.ndl-page') || document.body;

  function fullWidth(el) {
    var out = [];
    for (var i = 0; i < el.children.length; i++) {
      var r = el.children[i].getBoundingClientRect();
      if (r.width >= window.innerWidth * 0.9 && r.height > 8) out.push(el.children[i]);
    }
    return out;
  }

  // Descend through single-child wrappers to the level that actually has SIBLING sections. A page
  // is usually root > column > [band, band, band]; stopping at the first full-width element finds
  // the column and reports ONE band, which measures the wrapper rather than the things the eye
  // compares with each other.
  var bands = fullWidth(root);
  var guard = 0;
  while (bands.length === 1 && guard++ < 12) {
    var next = fullWidth(bands[0]);
    if (next.length === 0) break;
    bands = next;
  }

  // Does this element draw anything? A box that paints nothing cannot be a gutter, however far
  // out it sits — see the header note on iteration 3.
  function paints(el, cs) {
    if (el.tagName === 'IMG') return true;
    if (cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent') return true;
    if (cs.backgroundImage && cs.backgroundImage !== 'none') return true;
    if (parseFloat(cs.borderLeftWidth) > 0 || parseFloat(cs.borderTopWidth) > 0) return true;
    for (var i = 0; i < el.childNodes.length; i++) {
      var c = el.childNodes[i];
      if (c.nodeType === 3 && c.nodeValue && c.nodeValue.trim()) return true;
    }
    // A font glyph is an EMPTY span painted through ::before — see V25.
    if (el.children.length === 0 && getComputedStyle(el, '::before').content !== 'none') return true;
    return false;
  }

  function contentEdge(band) {
    var left = Infinity, right = -Infinity, sample = '';
    var all = band.querySelectorAll('*');
    for (var i = 0; i < all.length; i++) {
      var r = all[i].getBoundingClientRect();
      if (r.width < 4 || r.height < 4) continue;
      if (!paints(all[i], getComputedStyle(all[i]))) continue;
      if (r.left < left) { left = r.left; sample = '<' + all[i].tagName.toLowerCase() + '>'; }
      if (r.right > right) right = r.right;
    }
    return { left: left, right: right, sample: sample };
  }

  var out = [];
  for (var i = 0; i < bands.length; i++) {
    var e = contentEdge(bands[i]);
    if (e.left === Infinity) continue;
    var label = (bands[i].innerText || '').trim().split('\\n')[0].slice(0, 30);
    out.push({
      index: i,
      leftGutter: Math.round(e.left),
      rightGutter: Math.round(window.innerWidth - e.right),
      sample: label || e.sample
    });
  }
  return JSON.stringify({ viewport: window.innerWidth, bands: out });
})()`;

/**
 * 🔴 **The metric above was wrong FOUR times before it was right, the same way each time — it
 * measured *a* property rather than the one the eye reads.** The corrections are worth more than
 * the number, because three of the four would have been filed as product defects:
 *
 * 1. **Text nodes only** put the feature strip at 96 against the card band's 64. The strip's
 *    leftmost text sits past a 20px glyph — a fact about a row's internal layout, not the page's
 *    edge. ⚠️ A class selector could not rescue it: the FONT branch of `IconGlyph` renders
 *    `<span class="lucide icon-truck">` and, unlike the sprite and inline branches, emits no
 *    `ndl-icon-glyph`, so **no selector finds "an icon" across all three arms of the union**.
 *    Recorded as **V25**.
 * 2. **Leaf elements** put the empty state at 89. Its panel edge is at 64 like everything else;
 *    the extra 25 is the panel's own padding, which is what a bordered card is supposed to have.
 * 3. **Outermost box** put the hero and the strip at 16 against the others' 40 — and that one very
 *    nearly became a filed defect against `Columns`. Probed rather than reasoned about:
 *    `columns-container` sets `margin-left: -48px` while every `column-item` sets
 *    `padding-left: 48px`, so the CONTENT lands back exactly on its parent's edge and only a
 *    **transparent wrapper** hangs outside. The bands had agreed the whole time.
 * 4. **Painted content only** is the definition that survives all three.
 *
 * ⚠️ Bound: a band whose child is deliberately full-bleed reads 0 and is not a defect. This
 * reports the number; the judgment stays with the person looking.
 */
interface Band {
  index: number;
  leftGutter: number;
  rightGutter: number;
  sample: string;
}

async function gutters(projectDir: string, label: string): Promise<void> {
  // A copy, for the reason `judge()` serves one: `placeStarterAssets` writes files, and these
  // project directories are checked in.
  const served = fs.mkdtempSync(path.join(os.tmpdir(), `gutters-${label}-`));
  fs.cpSync(projectDir, served, { recursive: true });
  placeStarterAssets(served);

  await withRenderedPage({ projectDir: served }, async (raw) => {
    const page = raw as {
      setViewport(v: unknown): Promise<void>;
      navigate(u: string): Promise<void>;
      evaluate(s: string): Promise<unknown>;
    };
    for (const width of [1280, 1900]) {
      await page.setViewport({ width, height: 900, mobile: false });
      await page.navigate('/');
      await new Promise((r) => setTimeout(r, 1600));
      const read = JSON.parse(String(await page.evaluate(GUTTERS))) as { viewport: number; bands: Band[] };
      const distinct = [...new Set(read.bands.map((b) => b.leftGutter))].sort((a, b) => a - b);
      // eslint-disable-next-line no-console
      console.log(
        `\nGUTTERS ${label} @${read.viewport}  distinct left: ${JSON.stringify(distinct)}` +
          (distinct.length > 1 ? '   <-- BANDS DISAGREE' : '   agree')
      );
      for (const b of read.bands) {
        // eslint-disable-next-line no-console
        console.log(
          `   band ${b.index}: left ${String(b.leftGutter).padStart(4)}  right ${String(b.rightGutter).padStart(4)}   "${b.sample}"`
        );
      }
    }
  });
}

describe('the gutter, measured where a person sees it', () => {
  it('VIB-003 demo — four bands from four shipped recipes', async () => {
    await gutters(path.join(PHASE, 'demo', 'vib-003-pictures'), 'vib003');
  });

  it('VIB-002 demo — three bands from two shipped recipes', async () => {
    await gutters(path.join(PHASE, 'demo', 'vib-002-ground'), 'vib002');
  });

  it('the members-area template, as shipped', async () => {
    await gutters(path.join(REPO, 'templates', 'members-area'), 'members');
  });
});
