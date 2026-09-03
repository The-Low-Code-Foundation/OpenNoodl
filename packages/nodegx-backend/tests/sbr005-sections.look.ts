/**
 * SBR-005 — **a gallery looks like a gallery, a hero looks like a poster, and
 * the call-to-action button goes somewhere when clicked.**
 *
 * A harness, not a gate, on the same terms as `vib001-site.look.ts`: it is
 * outside `testMatch` so it cannot redden CI, and it is run deliberately —
 *
 *     npx jest --config packages/nodegx-backend/jest.config.js \
 *       --testMatch '**\/tests/**\/*.look.ts' --runTestsByPath \
 *       packages/nodegx-backend/tests/sbr005-sections.look.ts
 *
 * ## Why this file exists at all, and why it is a browser
 *
 * `sb006PublicSite.test.ts` can say the graph mounts one of five wrappers. It
 * cannot say the five *look like five different things*, and phase 81 is a phase
 * about exactly that gap: its register **V16** — *the four section kinds are ONE
 * layout; dispatch changes only fontWeight, fontSize, fontFamily and image
 * visibility; `cta` emits no button* — was written by a session photographing
 * this template, and every structural gate over that template was green.
 *
 * 🔴 **Three of this phase's own lessons say a structural pass is not evidence
 * here.** VIB-003 lost a whole band under a heading that still had its words
 * (`textChars` 606, `unreachablePx` 0, every assertion green). VIB-007's V22 ruled
 * that a repeater draws the right number of rows and loses every value in them —
 * *the page keeps its SHAPE and loses its CONTENT*, which is why the count of
 * tiles below is never the evidence that the tiles have pictures. And VIB-004
 * measured `contentBottom` identical across a change that visibly fixed a hero.
 * So: pictures, and a DOM probe that reads what was PAINTED.
 *
 * ## The four things it drives, and the control beside each
 *
 * | AC | the claim | the control |
 * |----|-----------|-------------|
 * | 1  | five kinds render as five different objects | a one-kind page shows only that kind |
 * | 2  | the CTA navigates, anonymous | the destination's own sentence is on screen |
 * | 3  | a sent message says so; a failed one says so | the OTHER sentence is absent each time |
 * | 4  | a hidden kind is absent from the DOM | the same probe finds it on the page that has it |
 * | 5  | a gallery's pictures are ACL'd like the single image | the DRAFT arm, both fields |
 *
 * ⚠️ **Everything below is anonymous unless it says otherwise.** The owner exists
 * only to write the records, over HTTP, exactly as `vib001-site.look.ts` does —
 * a visitor is who the ACs are about.
 */
import * as fs from 'fs';
import * as path from 'path';

import { buildSiteDesignTokens } from '../../noodl-editor/src/editor/src/models/template/templates/siteTheme';
import { SB004_COMPONENTS } from '../../noodl-mcp/tests/sb004Components';
import { CONTACT_REFUSAL_TEXT, CONTACT_SUCCESS_TEXT } from '../../noodl-mcp/tests/sb006Components';
import { BackendService } from '../src/service';

import { bundleAuthoredComponents } from './helpers/authored-bundle';
import { httpClient } from './helpers/http';
import { judge, today } from './helpers/judge';
import { clickButton, fill } from './helpers/members-drive';
import {
  authorSiteTemplate,
  bindProjectToBackend,
  DRAFT_ACL,
  makeSiteDataDir,
  readHere,
  readVisit,
  RenderedPage,
  SITE_SECURITY,
  withRenderedPage
} from './helpers/site-drive';

jest.setTimeout(1800000);

const SETUP_TOKEN = 'sbr005-token-4d17ae';
const OWNER = { email: 'owner@example.invalid', password: 'pw-owner' };
const CONTACT_TO = 'owner@example.invalid';
const DATE = today();

interface Row {
  objectId: string;
  [field: string]: unknown;
}

/**
 * A distinct picture per slot, so a probe can tell WHICH image rendered.
 *
 * 🔴 A single shared swatch would make "the gallery drew three tiles" and "the
 * gallery drew the hero's picture three times" the same reading — V22's shape,
 * where the page keeps its shape and loses its content. Each of these encodes
 * its own name in the SVG, so the `src` attribute is the evidence.
 */
const swatch = (name: string, from: string, to: string): string =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="600">' +
      `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
      `<stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/>` +
      '</linearGradient></defs><rect width="1200" height="600" fill="url(#g)"/>' +
      `<title>${name}</title></svg>`
  );

const HERO_PICTURE = swatch('hero', '#2b3a2f', '#8a7f5c');
const GALLERY_PICTURES = [
  swatch('gallery-one', '#3d2f2f', '#b08968'),
  swatch('gallery-two', '#243447', '#6d8ea0'),
  swatch('gallery-three', '#2f3a2b', '#9aa878')
];
const DRAFT_PICTURE = swatch('draft-only', '#5a1f1f', '#c98b8b');

/** The sentence only the destination page carries — AC2's consequence. */
const ABOUT_SENTENCE = 'We took the shop on in 1986 and have not changed the way it works since.';
/** The label on the CTA button, and therefore what AC2 clicks. */
const CTA_LABEL = 'Read about the workshop';

/**
 * What one visit says about the five kinds, read in ONE evaluate.
 *
 * 🔴 **Every predicate here is about a PAINTED fact, and each says what it
 * cannot see.** Phase 81 spent a session learning that no selector finds "an
 * icon" and that a colour-only ground count reads 6 on a page with 8, because a
 * gradient band reports `backgroundColor: rgba(0,0,0,0)`. So a hero is not
 * counted by its label or its component name — it is counted by *an element
 * whose computed `background-image` carries both a gradient and a `url(`*, which
 * is the one thing only the scrim-over-a-photograph node produces.
 *
 * ⚠️ `grid` is `rows`, not a count. "More than one image" is satisfied by three
 * images stacked in a column, which is a list and not a gallery — SBR-005 §2 asks
 * for a grid, so the probe reports how many DISTINCT top offsets the tiles sit on
 * and how many share the widest row. Two tiles on one row is a grid; three tiles
 * on three rows is not.
 */
const READ_SECTIONS = `(function () {
  function all(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }
  function shown(el) {
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  // A hero: a box painting a gradient OVER a url. Nothing else on this site
  // composes two background layers, and neither half alone is a hero.
  var scrims = all('*').filter(function (el) {
    if (!shown(el)) return false;
    var bg = getComputedStyle(el).backgroundImage || '';
    return bg.indexOf('gradient') >= 0 && bg.indexOf('url(') >= 0;
  });
  // A CTA band: a gradient ground with no picture, holding a real <button>.
  var ctaBands = all('*').filter(function (el) {
    if (!shown(el)) return false;
    var bg = getComputedStyle(el).backgroundImage || '';
    if (bg.indexOf('gradient') < 0 || bg.indexOf('url(') >= 0) return false;
    return el.querySelectorAll('button').length > 0;
  });

  var imgs = all('img').filter(shown).map(function (i) {
    var r = i.getBoundingClientRect();
    return { src: i.getAttribute('src') || '', top: Math.round(r.top), left: Math.round(r.left), w: Math.round(r.width) };
  });

  // The tiles are the images that are NOT a hero ground (a hero's picture is a
  // background, so it is never an <img> at all) — i.e. every <img> the gallery
  // drew. Grouped by their top edge, which is what makes "a grid" measurable.
  var rows = {};
  imgs.forEach(function (i) { rows[i.top] = (rows[i.top] || 0) + 1; });
  var rowKeys = Object.keys(rows);
  var widestRow = rowKeys.reduce(function (m, k) { return Math.max(m, rows[k]); }, 0);

  // Labelled fields: the contact form's controls, by the <label> the product
  // renders — not by input count, which a search box would also satisfy.
  var labels = all('label').filter(shown).map(function (l) {
    return (l.innerText || '').trim();
  }).filter(function (t) { return t.length > 0; });

  return JSON.stringify({
    path: window.location.pathname,
    sections: all('section').length,
    heroScrims: scrims.length,
    heroGrounds: scrims.map(function (el) {
      var bg = getComputedStyle(el).backgroundImage || '';
      // The order the runtime composes them in — gradient first — is itself the
      // claim 'addBackgroundInputs' makes, so record it rather than trusting it.
      return bg.indexOf('gradient') < bg.indexOf('url(') ? 'gradient-over-url' : 'url-over-gradient';
    }),
    // Does a heading sit ON the picture rather than under it? The scrim's own
    // box must CONTAIN the h2's box.
    headingOverGround: scrims.some(function (el) {
      var h = el.querySelector('h2');
      if (!h) return false;
      var a = el.getBoundingClientRect(), b = h.getBoundingClientRect();
      return b.top >= a.top && b.bottom <= a.bottom && b.left >= a.left;
    }),
    images: imgs.map(function (i) { return i.src; }),
    imageRows: rowKeys.length,
    widestRow: widestRow,
    ctaBands: ctaBands.length,
    buttons: all('button').filter(shown).map(function (b) { return (b.innerText || '').trim(); }),
    labels: labels,
    /**
     * 🔴 For every visible button: is anything else on top of its centre, and
     * WHAT. A rendered, painted, scrolled-to button that nothing can click is
     * the difference between "the CTA navigates" and "the CTA is a picture of a
     * button" — and the two are identical in every static assertion.
     */
    buttonReach: all('button').filter(shown).map(function (b) {
      var r = b.getBoundingClientRect();
      var x = Math.round(r.left + r.width / 2), y = Math.round(r.top + r.height / 2);
      var hit = document.elementFromPoint(x, y);
      var chain = [];
      for (var el = hit; el && chain.length < 6; el = el.parentElement) {
        chain.push(el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').filter(Boolean).slice(0, 2).join('.') : ''));
      }
      return {
        text: (b.innerText || '').trim(),
        box: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
        viewport: [window.innerWidth, window.innerHeight],
        hits: hit ? (hit === b || b.contains(hit) ? 'itself' : 'blocked') : 'outside-viewport',
        chain: chain
      };
    }),
    headings: all('h1, h2').filter(shown).map(function (h) { return (h.innerText || '').trim(); }),
    text: document.body ? document.body.innerText : '',
    // 🔴 The whole document, not what a reader sees: AC4 is about ABSENCE, and an
    // absence read off innerText passes on a band that IS in the DOM and hidden.
    html: document.documentElement.outerHTML
  });
})()`;

interface Sections {
  path: string;
  sections: number;
  heroScrims: number;
  heroGrounds: string[];
  headingOverGround: boolean;
  images: string[];
  imageRows: number;
  widestRow: number;
  ctaBands: number;
  buttons: string[];
  labels: string[];
  buttonReach: Array<{ text: string; box: number[]; viewport: number[]; hits: string; chain: string[] }>;
  headings: string[];
  text: string;
  html: string;
}


/**
 * 🔴 **REL-011b AC2 — is the page still THERE, at each step.**
 *
 * The recorded failure is `no button labelled "Send". Buttons on the page: []`,
 * and `clickButton` prints that list from an **unfiltered**
 * `document.querySelectorAll('button')` — so the document holds no `<button>`
 * element at all. That rules out visibility, reach and the fold, and leaves two
 * candidates the arm as written cannot separate:
 *
 * 1. **the product** unmounts its sections when its backend goes away, or
 * 2. **the harness** was already looking at an empty page before it stopped it.
 *
 * 🔴 **(2) is live, and the arm's own control cannot see it.** The
 * `beforeThePress` assertion below reads *"answered before the press — sent:
 * false, refused: false"*, which is exactly what a **blank page** reports. It was
 * written to catch a form that submits on typing; it passes unchanged on a
 * document with nothing in it. So every reading this file has ever taken of the
 * failure arm is consistent with the page having emptied at some earlier step.
 *
 * This probe is deliberately about **existence and count**, not about looks: the
 * one number that separates the two candidates is how many elements the document
 * holds, sampled either side of `service.stop()` and again after it has had time
 * to settle. It reports `elements` and `bodyChars` rather than a verdict.
 */
const PAGE_STATE = `(function () {
  var body = document.body;
  return JSON.stringify({
    href: window.location.pathname,
    ready: document.readyState,
    elements: document.querySelectorAll('*').length,
    buttons: document.querySelectorAll('button').length,
    fields: document.querySelectorAll('input, textarea').length,
    sections: document.querySelectorAll('section').length,
    imgs: document.querySelectorAll('img').length,
    bodyChars: body ? (body.innerText || '').length : -1,
    bodyKids: body ? body.children.length : -1,
    headings: Array.prototype.map.call(document.querySelectorAll('h1, h2'), function (h) {
      return (h.innerText || '').trim();
    }).slice(0, 6)
  });
})()`;

interface PageState {
  href: string;
  ready: string;
  elements: number;
  buttons: number;
  fields: number;
  sections: number;
  imgs: number;
  bodyChars: number;
  bodyKids: number;
  headings: string[];
}

/**
 * Read `PAGE_STATE`, print it against the step it belongs to, and hand it back.
 *
 * ⚠️ Printed as well as returned because the sequence is the evidence: a single
 * reading after the stop cannot say whether the page emptied then or was already
 * empty, and that is the whole question.
 */
async function pageState(page: RenderedPage, when: string): Promise<PageState> {
  const s = JSON.parse(String(await page.evaluate(PAGE_STATE))) as PageState;
  // eslint-disable-next-line no-console
  console.log(`STATE ${when} ` + JSON.stringify(s));
  return s;
}

/**
 * 🔴 **Which box actually scrolls, and does scrolling it move anything.**
 *
 * `clickButton` reported the CTA *behind something* and the blocker probe
 * answered `outside-viewport` with an EMPTY chain — `elementFromPoint` returns
 * null for any coordinate outside the viewport, so "below the fold" and "behind
 * a modal" are the same reading, which is the trap `members-drive.ts` documents
 * in its own source. The helper answers it by scrolling into view first; here
 * that did not move the button. So the question is not about the button.
 */
const READ_SCROLL = `(function () {
  var d = document.documentElement, b = document.body;
  var scrollers = Array.prototype.slice.call(document.querySelectorAll('*')).filter(function (el) {
    var oy = getComputedStyle(el).overflowY;
    return el.scrollHeight > el.clientHeight + 4 && (oy === 'auto' || oy === 'scroll' || oy === 'overlay');
  }).slice(0, 6).map(function (el) {
    var cls = typeof el.className === 'string' ? el.className.split(' ').filter(Boolean).slice(0, 2).join('.') : '';
    return el.tagName.toLowerCase() + (cls ? '.' + cls : '') + ' ' + el.scrollHeight + '/' + el.clientHeight +
      ' top=' + Math.round(el.scrollTop);
  });
  return JSON.stringify({
    viewport: [window.innerWidth, window.innerHeight],
    scrollY: Math.round(window.scrollY),
    docScroll: Math.round(d.scrollTop), bodyScroll: Math.round(b.scrollTop),
    docHeight: d.scrollHeight + '/' + d.clientHeight,
    bodyHeight: b.scrollHeight + '/' + b.clientHeight,
    htmlOverflowY: getComputedStyle(d).overflowY, bodyOverflowY: getComputedStyle(b).overflowY,
    scrollers: scrollers
  });
})()`;


/**
 * 🔴 **D40's workaround, stated where it is used rather than hidden in a helper
 * name.** Nothing on a published site-builder page scrolls: measured here at a
 * realistic desktop viewport and printed, so the reading is in this file's own
 * log and not only in a register row. `document.documentElement.scrollHeight`
 * equals the viewport height, `document.body` is **zero** tall, and no element
 * anywhere on the page has a scrollable overflow — so a `scrollTo(0, 1200)`
 * moves nothing and every control below the first screen is painted, correct,
 * and permanently unclickable.
 *
 * ⚠️ **That defect is NOT SBR-005's and this file must not be read as testing
 * it.** The pre-existing `Send` button on `Site/ContactForm` is unreachable the
 * same way, on a component this task did not open. AC2 and AC3 are about *where
 * a button goes* and *what the form says*, so they are driven in a viewport tall
 * enough to hold the whole page — which is a real browser window on a tall
 * monitor, not a fiction, but it is **not** a test that the page scrolls.
 *
 * The reading it prints is the evidence for D40 and is taken BEFORE the resize.
 */
async function reachTheWholePage(page: RenderedPage, arm: string): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(`SCROLL ${arm} at 1280x900 ` + String(await page.evaluate(READ_SCROLL)));
  // ⚠️ Two evaluates, never one — a write is not visible in the same eval.
  await page.evaluate('window.scrollTo(0, 1200); document.documentElement.scrollTop = 1200; true');
  await new Promise((r) => setTimeout(r, 300));
  // eslint-disable-next-line no-console
  console.log(`SCROLL ${arm} after scrollTo ` + String(await page.evaluate(READ_SCROLL)));

  await page.setViewport({ width: 1280, height: 2400 });
  await new Promise((r) => setTimeout(r, 900));
}

/** Navigate, let the four-round-trip chain settle, and read once. */
async function readSections(page: RenderedPage, url: string): Promise<Sections> {
  await readVisit(page, url);
  let last = '';
  let raw = String(await page.evaluate(READ_SECTIONS));
  for (let i = 0; i < 12; i++) {
    const parsed = JSON.parse(raw) as Sections;
    if (parsed.text === last && parsed.text.length > 0) break;
    last = parsed.text;
    await new Promise((r) => setTimeout(r, 400));
    raw = String(await page.evaluate(READ_SECTIONS));
  }
  return JSON.parse(raw) as Sections;
}

/** Mirrors `EmbeddedTemplateProvider.instantiate` — see `vib001-site.look.ts`. */
function applyTemplateDesignTokens(projectDir: string): void {
  const file = path.join(projectDir, 'nodegx.project.json');
  const project = JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, unknown>;
  const metadata = (project.metadata as Record<string, unknown>) ?? {};
  metadata.designTokens = buildSiteDesignTokens();
  project.metadata = metadata;
  fs.writeFileSync(file, JSON.stringify(project, null, 2));
}

/** A claimed, themed, seeded site, and the owner's session for writing to it. */
async function seedSite(label: string) {
  const projectDir = await authorSiteTemplate(label);
  applyTemplateDesignTokens(projectDir);
  const dataDir = makeSiteDataDir(
    bundleAuthoredComponents(
      projectDir,
      SB004_COMPONENTS.map((c) => c.key)
    ),
    { SITE_SETUP_TOKEN: SETUP_TOKEN, CONTACT_RECIPIENT_EMAIL: CONTACT_TO },
    SITE_SECURITY,
    label
  );
  const service = new BackendService({ dataDir, port: 0, backendId: label, backendName: label });
  const started = await service.start();
  const client = httpClient(() => started.listen.url);
  // Row-level ACL on: with it off every draft leaks and AC5 would be a picture
  // of a different product.
  expect(started.security.enforced).toBe(true);
  bindProjectToBackend(projectDir, label, started.listen.port);

  const user = await client.post<{ objectId: string; sessionToken: string }>('/users', {
    username: OWNER.email,
    password: OWNER.password
  });
  const owner = { 'x-parse-session-token': user.json.sessionToken };
  const claimed = await client.post<{ result?: { claimed?: boolean } }>(
    '/functions/claimSite',
    { setupToken: SETUP_TOKEN },
    owner
  );
  expect(claimed.json.result?.claimed).toBe(true);

  const settings = await client.get<{ results: Row[] }>('/classes/SiteSettings', owner);
  await client.put(
    `/classes/SiteSettings/${settings.json.results[0].objectId}`,
    { siteName: 'Kestrel Joinery', homeSlug: 'home' },
    owner
  );

  const makePage = async (
    title: string,
    slug: string,
    navOrder: number,
    published: boolean,
    sections: Array<{ kind: string; data: Record<string, unknown> }>
  ): Promise<string> => {
    const page = await client.post<Row>(
      '/classes/Page',
      { ACL: DRAFT_ACL, title, slug, published: false, showInNav: true, navOrder, seoDescription: `${title}.` },
      owner
    );
    for (let i = 0; i < sections.length; i++) {
      await client.post(
        '/classes/Section',
        { ACL: DRAFT_ACL, kind: sections[i].kind, order: i, data: sections[i].data, pageId: page.json.objectId },
        owner
      );
    }
    // 🔴 Published through the product's OWN endpoint, never by typing an ACL.
    // SBR-004's lesson and SB-015's: a seed that bypasses the product's door is a
    // second product, and the ACL it writes is the one this test wanted rather
    // than the one `publishPage` actually writes.
    if (published) {
      const res = await client.post('/functions/publishPage', { pageId: page.json.objectId, publish: true }, owner);
      expect(res.status).toBe(200);
    }
    return page.json.objectId;
  };

  const HERO = {
    kind: 'hero',
    data: {
      heading: 'Kestrel Joinery',
      body: 'Stairs, windows and doors, out of oak, ash and elm.',
      image: { url: HERO_PICTURE }
    }
  };
  const GALLERY = {
    kind: 'gallery',
    data: {
      heading: 'Work from the last year',
      images: GALLERY_PICTURES.map((url) => ({ url }))
    }
  };
  const CTA = {
    kind: 'cta',
    data: {
      heading: 'Come and see the workshop',
      body: 'Thursdays, or by arrangement.',
      linkLabel: CTA_LABEL,
      // A page slug, not a URL — the in-site half of the target field.
      linkTarget: 'about'
    }
  };
  const RICH = {
    kind: 'richText',
    data: {
      heading: 'How we work',
      body:
        'Three of us work behind the station, in a shop that has been a joinery since 1911. ' +
        'We cut our own joints, we finish by hand, and we will tell you honestly when a repair ' +
        'is the better answer than a replacement.'
    }
  };
  const CONTACT = {
    kind: 'contact',
    data: { heading: 'Get in touch', body: 'Tell us what you have in mind and we will write back.' }
  };

  await makePage('Welcome', 'home', 1, true, [HERO, GALLERY, CTA, RICH, CONTACT]);
  await makePage('About the workshop', 'about', 2, true, [
    { kind: 'richText', data: { heading: 'About the workshop', body: ABOUT_SENTENCE } }
  ]);
  // One page per kind: the per-kind photographs AC1 asks for, and — read the
  // other way round — five one-kind controls for AC4's absence claim.
  await makePage('Hero only', 'hero-only', 3, true, [HERO]);
  await makePage('Gallery only', 'gallery-only', 4, true, [GALLERY]);
  await makePage('Call to action only', 'cta-only', 5, true, [CTA]);
  await makePage('Passage only', 'text-only', 6, true, [RICH]);
  await makePage('Contact only', 'contact-only', 7, true, [CONTACT]);
  // 🔴 AC5's draft arm. It carries BOTH picture fields, because the claim is that
  // the new one is treated like the old one — which is unmeasurable without the
  // old one in the same record.
  await makePage('Not for the public yet', 'unpublished', 8, false, [
    { kind: 'gallery', data: { heading: 'Draft gallery', images: [{ url: DRAFT_PICTURE }] } },
    { kind: 'hero', data: { heading: 'Draft hero', body: 'Not published.', image: { url: DRAFT_PICTURE } } }
  ]);

  return { projectDir, service, started, client, owner };
}

describe('SBR-005 — five kinds, five things on the page', () => {
  it('AC1 + AC4 + AC5: the five kinds render as five objects, and only where they belong', async () => {
    const { projectDir, service, started } = await seedSite('sbr005-kinds');
    try {
      const seen = await withRenderedPage(
        { projectDir, backendPort: started.listen.port },
        async (page: RenderedPage) => {
          const home = await readSections(page, '/');
          const heroOnly = await readSections(page, '/hero-only');
          const galleryOnly = await readSections(page, '/gallery-only');
          const textOnly = await readSections(page, '/text-only');
          const draft = await readSections(page, '/unpublished');
          return { home, heroOnly, galleryOnly, textOnly, draft };
        }
      );

      // ── AC1. Five sections, and five DIFFERENT objects in them ────────────
      //
      // 🔴 The cardinality first. A page that drew ONE band would satisfy every
      // "has a hero" predicate below, and V22's ruling is that a repeater keeps
      // its shape when it has lost everything else — so the row count is asserted
      // before anything is read out of the rows.
      // ⚠️ **SIX, not five, and the sixth is correct.** Five `Site/SectionView`
      // roots (`as: 'section'`) plus `Site/ContactForm`'s own root, which has
      // been `as: 'section'` since SB-006 and is now inside the contact kind. It
      // read **7** before D37 was fixed — the seventh was the duplicate form —
      // so this number is the one that found that defect and it is written down
      // with its arithmetic rather than as a bare constant.
      expect(`sections on the home page: ${seen.home.sections}`).toBe('sections on the home page: 6');

      // hero — a picture with a scrim over it, and the heading laid ON it.
      expect(`hero scrims: ${seen.home.heroScrims}`).toBe('hero scrims: 1');
      expect(seen.home.heroGrounds).toEqual(['gradient-over-url']);
      expect(`heading over the ground: ${seen.home.headingOverGround}`).toBe('heading over the ground: true');
      expect(seen.home.html).toContain(encodeURIComponent('<title>hero</title>'));

      // gallery — MORE THAN ONE image, and in a grid rather than a stack.
      expect(seen.home.images.length).toBe(GALLERY_PICTURES.length);
      // 🔴 Each tile carries its OWN picture. Three tiles all showing the hero's
      // photograph is the defect that a count of tiles cannot see.
      expect([...seen.home.images].sort()).toEqual([...GALLERY_PICTURES].sort());
      // Three 48% tiles in a wrapping row: two on the first line, one on the
      // second. Two rows, and a widest row of two, is what "a grid" means here —
      // three rows of one would be a list.
      expect(`gallery rows: ${seen.home.imageRows}, widest: ${seen.home.widestRow}`).toBe(
        'gallery rows: 2, widest: 2'
      );

      // cta — a band that is not a picture, and a real button in it.
      expect(`cta bands: ${seen.home.ctaBands}`).toBe('cta bands: 1');
      expect(seen.home.buttons).toContain(CTA_LABEL);

      // richText — its heading and its body, on the page ground.
      expect(seen.home.headings).toContain('How we work');
      expect(seen.home.text).toContain('a shop that has been a joinery since 1911');

      // contact — labelled fields in a card.
      expect(seen.home.labels).toEqual(expect.arrayContaining(['Your name', 'Your email', 'Your message']));
      expect(seen.home.buttons).toContain('Send');

      // ── AC4. A kind that is not there is ABSENT, not hidden ───────────────
      //
      // 🔴 The absence is asserted BESIDE the known-firing signal: the same probe
      // finds a hero on `/hero-only` and finds none on `/text-only`. An absence
      // measured without the positive control is indistinguishable from a probe
      // that never worked.
      expect(`hero on /hero-only: ${seen.heroOnly.heroScrims}`).toBe('hero on /hero-only: 1');
      expect(`hero on /text-only: ${seen.textOnly.heroScrims}`).toBe('hero on /text-only: 0');
      expect(`gallery images on /gallery-only: ${seen.galleryOnly.images.length}`).toBe(
        'gallery images on /gallery-only: 3'
      );
      expect(`gallery images on /text-only: ${seen.textOnly.images.length}`).toBe('gallery images on /text-only: 0');
      expect(`cta bands on /text-only: ${seen.textOnly.ctaBands}`).toBe('cta bands on /text-only: 0');
      // 🔴 And absent from the DOCUMENT, not merely invisible. `mounted: false`
      // takes the node out of the tree; `visible: false` would leave the picture's
      // url sitting in the html with `visibility: hidden` on it, which the two
      // predicates above cannot tell apart.
      expect(seen.textOnly.html).not.toContain(encodeURIComponent('<title>hero</title>'));
      expect(seen.textOnly.html).not.toContain(CTA_LABEL);
      // The one-kind page still drew ONE section, so "absent" is not "the page
      // failed to render".
      expect(`sections on /text-only: ${seen.textOnly.sections}`).toBe('sections on /text-only: 1');

      // ── AC5. The gallery's pictures are ACL'd exactly like the single one ──
      //
      // 🔴 The draft page carries a `data.images` gallery AND a `data.image` hero,
      // both pointing at the same never-published picture. An anonymous visitor
      // must get neither — and the two fields must fail the SAME way, because the
      // claim is "matches the existing image path", not "is secure".
      expect(seen.draft.html).not.toContain(encodeURIComponent('<title>draft-only</title>'));
      expect(`draft images rendered: ${seen.draft.images.length}`).toBe('draft images rendered: 0');
      expect(`draft heroes rendered: ${seen.draft.heroScrims}`).toBe('draft heroes rendered: 0');
      expect(seen.draft.text).not.toContain('Draft gallery');
      expect(seen.draft.text).not.toContain('Draft hero');
      // 🔴 The control that makes the four lines above mean something: the SAME
      // probe on the SAME site reads the published gallery's pictures. Without it,
      // a site that rendered nothing anywhere would pass the whole block.
      expect(`published images rendered: ${seen.galleryOnly.images.length}`).toBe('published images rendered: 3');

      // ── The pictures ──────────────────────────────────────────────────────
      const run = await judge({
        task: 'sbr-005',
        subject: 'site-builder',
        state: 'living',
        projectDir,
        backendPort: started.listen.port,
        date: DATE,
        pages: [
          { label: 'all-five', url: '/', as: 'a visitor reading a page built of all five kinds' },
          { label: 'kind-hero', url: '/hero-only', as: 'the hero kind, alone' },
          { label: 'kind-gallery', url: '/gallery-only', as: 'the gallery kind, alone' },
          { label: 'kind-cta', url: '/cta-only', as: 'the call-to-action kind, alone' },
          { label: 'kind-richtext', url: '/text-only', as: 'the rich-text kind, alone' },
          { label: 'kind-contact', url: '/contact-only', as: 'the contact kind, alone' }
        ]
      });
      expect(run.shots.length).toBe(24);
      // eslint-disable-next-line no-console
      console.log('SBR-005 MANIFEST ' + run.outDir + ' md5=' + run.artefactMd5 + ' head=' + run.headSha);
    } finally {
      await service.stop();
    }
  });

  it('AC2: an anonymous visitor clicks the call to action and lands on the page it names', async () => {
    const { projectDir, service, started } = await seedSite('sbr005-cta');
    try {
      const landed = await withRenderedPage(
        { projectDir, backendPort: started.listen.port },
        async (page: RenderedPage) => {
          // A stated viewport. The harness default is 756x469, which is nobody's
          // browser, and a reading about reachability has to name the window it
          // was taken in.
          await page.setViewport({ width: 1280, height: 900 });
          const before = await readSections(page, '/');
          expect(before.buttons).toContain(CTA_LABEL);
          // 🔴 The destination's own sentence must NOT already be on screen, or
          // the assertion after the click grades nothing.
          expect(before.text).not.toContain(ABOUT_SENTENCE);
          // eslint-disable-next-line no-console
          console.log('BUTTON REACH ' + JSON.stringify(before.buttonReach));

          await reachTheWholePage(page, 'AC2');
          await clickButton(page, CTA_LABEL);
          // Read WHERE IT IS. `readVisit('/about')` would grade a fresh load of
          // the destination rather than the click that produced it.
          await readHere(page, { until: ABOUT_SENTENCE });
          return JSON.parse(String(await page.evaluate(READ_SECTIONS))) as Sections;
        }
      );

      // The consequence, not the mechanism: the destination's content is on
      // screen. The path is asserted too, because a router that rendered the
      // right words at the wrong URL is a link a visitor cannot share.
      expect(landed.text).toContain(ABOUT_SENTENCE);
      expect(`landed on: ${landed.path}`).toBe('landed on: /about');
      // And the CTA that sent us is gone — /about has no cta section.
      expect(`cta bands after the click: ${landed.ctaBands}`).toBe('cta bands after the click: 0');
    } finally {
      await service.stop();
    }
  });

  it('AC3: a sent message says so, a failed one says so, and never both', async () => {
    const { projectDir, service, started } = await seedSite('sbr005-contact');
    let stopped = false;
    try {
      const said = await withRenderedPage(
        { projectDir, backendPort: started.listen.port },
        async (page: RenderedPage) => {
          await page.setViewport({ width: 1280, height: 900 });
          // ── The success arm ────────────────────────────────────────────────
          const before = await readSections(page, '/');
          // Neither answer is on the page before anything is sent. This is the
          // reset control, and it is what makes both arms below falsifiable.
          expect(before.text).not.toContain(CONTACT_SUCCESS_TEXT);
          expect(before.text).not.toContain(CONTACT_REFUSAL_TEXT);

          await fill(page, 'Your name', 'A visitor');
          await fill(page, 'Your email', 'visitor@example.invalid');
          await fill(page, 'Your message', 'Could you quote for a pair of sash windows?');
          await reachTheWholePage(page, 'AC3 success');
          await clickButton(page, 'Send');
          const sent = await readHere(page, { until: CONTACT_SUCCESS_TEXT });

          // ── The failure arm, on a fresh mount ──────────────────────────────
          //
          // 🔴 A fresh load, not a second press: `sent` is mounted now and would
          // still be mounted after a failure, so the negative control below —
          // "the success sentence is NOT shown on failure" — would pass on a
          // product that shows both.
          const reset = await readSections(page, '/');
          expect(reset.text).not.toContain(CONTACT_SUCCESS_TEXT);
          await pageState(page, 'AC3 failure — fresh load');

          await fill(page, 'Your name', 'A visitor');
          await fill(page, 'Your email', 'visitor@example.invalid');
          await fill(page, 'Your message', 'And a second question.');

          /**
           * 🔴 **D41's probe, and the reason AC3's first run could not be read.**
           *
           * The three fields are full and NOTHING HAS BEEN PRESSED. If the form
           * has already answered, it submitted itself — `gather` runs on value
           * change (it is in `sb007Template.test.ts`'s `runsOnValue` population,
           * unguarded) and fires `Outputs.go()` the moment the last field stops
           * being empty. Every later keystroke fires it again.
           *
           * This is asserted rather than logged because it is the difference
           * between "a failed submit shows the failure line" and "a form that
           * sends on typing showed both answers at once", and the first run of
           * this arm could not tell them apart.
           */
          const beforeThePress = await readHere(page);
          expect(`answered before the press — sent: ${beforeThePress.text.includes(CONTACT_SUCCESS_TEXT)}, ` +
            `refused: ${beforeThePress.text.includes(CONTACT_REFUSAL_TEXT)}`).toBe(
            'answered before the press — sent: false, refused: false'
          );

          /**
           * 🔴 **REL-011b AC2's presence control, and the hole it plugs.**
           *
           * The assertion directly above is satisfied by a **blank document** —
           * an empty page shows neither sentence — so on its own it cannot tell
           * *"the form has not answered yet"* from *"there is no form"*. Every
           * reading this arm has taken of the zero-buttons failure is consistent
           * with the page having emptied before the backend was ever stopped, and
           * nothing here could have said so.
           *
           * So: the form is on the page, with its `Send` button, **while the
           * backend is still up**. This is the arm's before-picture, and without
           * it the `after` below attributes to `service.stop()` whatever state
           * the page happened to already be in.
           */
          const armed = await pageState(page, 'AC3 failure — filled, backend UP');
          expect(
            `before the stop — any button: ${armed.buttons > 0}, any field: ${armed.fields > 0}`
          ).toBe('before the stop — any button: true, any field: true');

          await reachTheWholePage(page, 'AC3 failure');
          const reached = await pageState(page, 'AC3 failure — after the resize, backend UP');
          expect(`after the resize — any button: ${reached.buttons > 0}`).toBe(
            'after the resize — any button: true'
          );

          // The submit fails because the endpoint is gone. `CloudFunction2.failure`
          // is the port the template's `refusedGate` reads, and a stopped backend
          // is the honest way to make it fire without reaching into the graph.
          await service.stop();
          stopped = true;
          /**
           * 🔴 Three readings, not one. If the page empties, WHEN it empties is
           * the diagnosis: at the moment the socket drops (something is watching
           * the connection), or seconds later (a re-query came back empty and the
           * repeaters redrew nothing). A single post-stop reading cannot tell
           * those apart, and they have different fixes.
           */
          const stoppedAt = Date.now();
          for (const waitMs of [0, 2000, 8000]) {
            if (waitMs) await new Promise((r) => setTimeout(r, waitMs - (Date.now() - stoppedAt)));
            await pageState(page, `AC3 failure — backend DOWN +${waitMs}ms`);
          }
          // eslint-disable-next-line no-console
          console.log('CONSOLE after the stop ' + JSON.stringify(page.consoleErrors.slice(-12)));

          await clickButton(page, 'Send');
          const failed = await readHere(page, { until: CONTACT_REFUSAL_TEXT, timeoutMs: 30000 });

          return { sent: sent.text, failed: failed.text };
        }
      );

      expect(said.sent).toContain(CONTACT_SUCCESS_TEXT);
      // 🔴 The negative control on the success arm: a form that showed both
      // answers would satisfy "shows the success sentence" and be useless.
      expect(said.sent).not.toContain(CONTACT_REFUSAL_TEXT);

      expect(said.failed).toContain(CONTACT_REFUSAL_TEXT);
      expect(said.failed).not.toContain(CONTACT_SUCCESS_TEXT);
    } finally {
      if (!stopped) await service.stop();
    }
  });
});
