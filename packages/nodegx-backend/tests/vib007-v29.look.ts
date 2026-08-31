/**
 * VIB-007 / register **V29** — the row says *"a `maxWidth` on a `Text` inside a centred shell; the
 * measure belongs to the shell."* This measures that shape on every rendered page that carries it,
 * BEFORE the predicate is written.
 *
 * 🔴 **Why the whole population and not the accused band.** The static shape appears **13** times
 * across **7** examples. One of them is the band Richard ruled wrong (`ui-image-scrim-band`, 374
 * left / 766 right at 1900). **Three of them are on `ui-landing-page`**, the page he ruled *"it
 * looks fucking pro"*. §9.3 is what happens when a row's sentence is turned into a check without
 * this step: V23's tabled predicate would have condemned five glyphs on that same page. A predicate
 * that cannot tell those two apart is not a narrowing of V29, it is a rewrite of VIB-006's verdict.
 *
 * ## What is measured, and why it is not "does this Text have a maxWidth"
 *
 * A measure — a line-length cap on body copy — is *correct typography*, not a defect. What Richard
 * ruled against is **asymmetry**: *"white space to the left and right equally… not just on one side,
 * that's weird."* So for each capped `Text` this reads, off the rendered DOM:
 *
 *  - the text's painted box, and its inset from each edge of the **band** it sits in;
 *  - the band's own painted content extent — the leftmost and rightmost painted descendant, using
 *    the `paints()` definition `vib003-gutters.look.ts` needed four iterations to get right;
 *  - **whether any sibling content reaches further out than the capped text does.** That is the
 *    candidate discriminator: if something else in the band realises the shell's measure, the narrow
 *    paragraph is typography; if the capped text IS the band's whole content, the shell's declared
 *    measure is never drawn and the page's white space lands on one side.
 *
 * ⚠️ **A harness, not a gate.** It asserts only cardinality — that every capped Text actually drew —
 * and prints numbers to be read. The `.look.ts` suffix keeps it outside `jest.config.js`'s
 * `testMatch`. Build the projects first:
 *
 *     node dev-docs/tasks/phase-81-the-look-is-the-product/demo/build-vib007-v29.js
 *     npx jest --config packages/nodegx-backend/jest.config.js \
 *       --testMatch '**\/tests/**\/*.look.ts' --runTestsByPath \
 *       packages/nodegx-backend/tests/vib007-v29.look.ts
 */
import { placeStarterAssets } from './helpers/judge';
import { withRenderedPage } from './helpers/site-drive';

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

jest.setTimeout(1800000);

const REPO = path.join(__dirname, '..', '..', '..');
const DEMOS = path.join(REPO, 'dev-docs', 'tasks', 'phase-81-the-look-is-the-product', 'demo', 'vib-007-v29');

/**
 * 🔴 Subjects are found by their COMPUTED `max-width`, not by a DOM id derived from the builder's
 * node ids. The runtime owns the DOM; a selector written from the artefact would be a guess about
 * the renderer rather than a reading of it (the lesson `vib007-v28.look.ts` records).
 */
const MEASURE = `(function () {
  function paints(el, cs) {
    if (el.tagName === 'IMG') return true;
    if (cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent') return true;
    if (cs.backgroundImage && cs.backgroundImage !== 'none') return true;
    if (parseFloat(cs.borderLeftWidth) > 0 || parseFloat(cs.borderTopWidth) > 0) return true;
    for (var i = 0; i < el.childNodes.length; i++) {
      var c = el.childNodes[i];
      if (c.nodeType === 3 && c.nodeValue && c.nodeValue.trim()) return true;
    }
    if (el.children.length === 0 && getComputedStyle(el, '::before').content !== 'none') return true;
    return false;
  }

  // The band a node belongs to: the nearest ancestor that spans (near enough) the whole viewport.
  // That is the unit the eye compares across a page, and the unit Richard's ruling is about.
  function bandOf(el) {
    var n = el.parentElement;
    var last = el;
    while (n && n !== document.body) {
      if (n.getBoundingClientRect().width >= window.innerWidth * 0.9) return n;
      last = n;
      n = n.parentElement;
    }
    return last;
  }

  function extent(root, exclude) {
    var left = Infinity, right = -Infinity;
    var all = root.querySelectorAll('*');
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (exclude && (el === exclude || exclude.contains(el))) continue;
      var r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) continue;
      if (!paints(el, getComputedStyle(el))) continue;
      if (r.left < left) left = r.left;
      if (r.right > right) right = r.right;
    }
    return { left: left, right: right };
  }

  var out = [];
  var all = document.querySelectorAll('*');
  for (var i = 0; i < all.length; i++) {
    var el = all[i];
    var cs = getComputedStyle(el);
    if (!cs.maxWidth || cs.maxWidth === 'none') continue;
    // Text-bearing only: this row is about a measure on copy, not a cap on a shell.
    var direct = '';
    for (var j = 0; j < el.childNodes.length; j++) {
      var c = el.childNodes[j];
      if (c.nodeType === 3 && c.nodeValue) direct += c.nodeValue;
    }
    if (!direct.trim()) continue;

    var r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    var band = bandOf(el);
    var br = band.getBoundingClientRect();
    var sib = extent(band, el);
    out.push({
      text: direct.trim().slice(0, 34),
      maxWidth: cs.maxWidth,
      width: Math.round(r.width),
      // Inset from the BAND's edges — the asymmetry Richard's ruling is about.
      insetLeftInBand: Math.round(r.left - br.left),
      insetRightInBand: Math.round(br.right - r.right),
      // Inset from the VIEWPORT, which is the number a person actually reads.
      viewportLeft: Math.round(r.left),
      viewportRight: Math.round(window.innerWidth - r.right),
      bandWidth: Math.round(br.width),
      // Does anything ELSE in this band reach further out than the capped text?
      siblingReachRight: sib.right === -Infinity ? null : Math.round(sib.right - r.right),
      siblingReachLeft: sib.left === Infinity ? null : Math.round(r.left - sib.left)
    });
  }
  return JSON.stringify({ viewport: window.innerWidth, capped: out });
})()`;

interface Capped {
  text: string;
  maxWidth: string;
  width: number;
  insetLeftInBand: number;
  insetRightInBand: number;
  viewportLeft: number;
  viewportRight: number;
  bandWidth: number;
  siblingReachRight: number | null;
  siblingReachLeft: number | null;
}

async function measure(exampleId: string): Promise<void> {
  const served = fs.mkdtempSync(path.join(os.tmpdir(), `v29-${exampleId}-`));
  fs.cpSync(path.join(DEMOS, exampleId), served, { recursive: true });
  placeStarterAssets(served);

  await withRenderedPage({ projectDir: served }, async (page) => {
    for (const width of [1280, 1900]) {
      await page.setViewport({ width, height: 900, mobile: false });
      await page.navigate('/');
      await new Promise((r) => setTimeout(r, 1600));
      const read = JSON.parse(String(await page.evaluate(MEASURE))) as { viewport: number; capped: Capped[] };
      // eslint-disable-next-line no-console
      console.log(`\nV29 ${exampleId} @${read.viewport}  ${read.capped.length} capped text node(s)`);
      for (const c of read.capped) {
        const asym = Math.abs(c.viewportLeft - c.viewportRight);
        // eslint-disable-next-line no-console
        console.log(
          `   "${c.text}"\n` +
            `      max-width ${c.maxWidth}  drawn ${c.width}px   band ${c.bandWidth}px\n` +
            `      viewport  L ${String(c.viewportLeft).padStart(4)}  R ${String(c.viewportRight).padStart(4)}   asymmetry ${asym}\n` +
            `      in band   L ${String(c.insetLeftInBand).padStart(4)}  R ${String(c.insetRightInBand).padStart(4)}\n` +
            `      siblings reach further  left ${c.siblingReachLeft}  right ${c.siblingReachRight}`
        );
      }
      if (read.capped.length === 0) {
        // eslint-disable-next-line no-console
        console.log('   (none drew — check the page rendered at all)');
      }
    }
    // eslint-disable-next-line no-console
    console.log(`V29 ${exampleId} consoleErrors ${JSON.stringify(page.consoleErrors)}`);
  });
}

describe('VIB-007 — V29 measured on the rendered page, across the whole population', () => {
  for (const id of fs.readdirSync(DEMOS).filter((d) => fs.statSync(path.join(DEMOS, d)).isDirectory())) {
    it(`${id} — every capped Text, with the band it sits in`, async () => {
      await measure(id);
    });
  }
});
