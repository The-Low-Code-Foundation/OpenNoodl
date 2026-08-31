/**
 * The render report's **pure half** — the measurement expression, the findings
 * and the thresholds. No Node, no browser, no filesystem.
 *
 * ## Why this is a package (F22, decided 2026-08-10)
 *
 * LAS-005 shipped `render_report` and descoped its **editor** client with the
 * blocker named: the pure half lived in `scripts/devtools/render-report.js` as
 * plain CJS *precisely* so the CLI runs in a fresh checkout with no build step —
 * and the editor bundle could not import it without dragging `child_process`,
 * `http`, `net` and `ws` into the renderer. `scripts/` is also not shipped in a
 * packaged editor. Three ways out were filed; Richard chose this one.
 *
 * The two rejected, and why:
 *
 * - **A dependency-free file under `scripts/` that both import.** Webpack would
 *   bundle it (the editor's loaders exclude only `node_modules`), but the
 *   editor's `tsconfig.json` sets no `allowJs` and its `include` is limited to
 *   `src/editor`, `src/shared`, `src/main` — so `typecheck:editor`, one of the
 *   phase's four gates, could not see 600 lines of measurement code without a
 *   hand-written declaration anyway. An unwatched typecheck is the `test:main`
 *   shape this repo has already been bitten by.
 * - **Move it into the editor and give the CLI a build step.** That destroys the
 *   property that made the harness useful in the phase-55 audit — *clone and
 *   measure* — and points `noodl-mcp` at the editor package, which is backwards.
 *
 * ## Why plain CJS with a hand-written `.d.ts`, not TypeScript
 *
 * ⚠️ The other no-build packages here (`@noodl/types`, `@noodl/platform`,
 * `@noodl/git`, …) point `main` straight at a `.ts` file, which works because
 * every consumer of those runs through `tsc`, `ts-jest` or webpack. **This
 * package has a consumer that does not**: `scripts/devtools/measure-from-disk.js`
 * is run by bare `node`, and bare `node` cannot `require` a `.ts` file. So the
 * source of truth is `.js` and the types ride alongside in `index.d.ts`.
 *
 * ## What must never appear in this file
 *
 * A `require`. Not `fs`, not `path`, not a workspace sibling. The moment one
 * lands the editor bundle grows a Node dependency and the reason this package
 * exists is gone. There is a spec asserting exactly that.
 *
 * @module @nodegx/render-measure
 */

'use strict';

/** The two viewports phases 54–55 measured at. Phone is device emulation — Chrome will not open a real window under ~500px. */
const DEFAULT_VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 900, mobile: false },
  { name: 'phone', width: 390, height: 844, mobile: true }
];

/**
 * Every viewport that has a *name*, which is a longer list than the default.
 *
 * ⚠️ **`tablet` is here and deliberately not in `DEFAULT_VIEWPORTS`.** Richard
 * asked (2026-08-10) for mobile/tablet/desktop to be selectable when building a
 * mobile app, and the name has to be spelled the same way everywhere — the CLI,
 * the MCP tool and the editor's capture control all resolve names from here. But
 * adding it to the *default* set would silently make `render_report` measure a
 * third viewport on every call it has ever been asked to make, changing its cost
 * and its recorded output. **A vocabulary and a default are different things.**
 *
 * 1024×1366 is the portrait iPad Pro, and `mobile: false` because a tablet at
 * that width gets the desktop layout — which is exactly what a user checking
 * "does my app work on a tablet" needs to see.
 */
const NAMED_VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 900, mobile: false },
  { name: 'tablet', width: 1024, height: 1366, mobile: false },
  { name: 'phone', width: 390, height: 844, mobile: true }
];

/** A viewport at least this wide is expected to lay content out in more than one column. */
const DESKTOP_WIDTH = 1024;

/**
 * When a stack of look-alike siblings is worth mentioning, and when it is a
 * footer.
 *
 * Calibrated against the three measured builds (2026-08-08), because the first
 * predicate — "≥3 identical siblings sharing one left edge" — fired on every
 * footer link list and every three-line paragraph block: 5 hits on
 * `ecommerce-example` and 4 on the replay this phase calls *correct*, against 2
 * true ones. What separates a grid that failed from a list that is a list is
 * that the items are big enough to have sat side by side:
 *
 * | build | group | verdict |
 * |---|---|---|
 * | haiku | 4 × `.column-item` 1248×450 | the defect |
 * | haiku | 3 × `.column-item` 1248×261 | the defect |
 * | haiku | 3 × 1168×**56** text rows | a paragraph — height |
 * | sonnet | 6 × 240×**17** in a 240px parent | footer links — height |
 * | ecommerce | 5 × 252×**15** in a 252px parent | footer links — height |
 * | sonnet | 3 × 1152×300 category banners | stacked **on purpose** — info only |
 *
 * So a `Columns` node that produced one column is a warning (the author asked
 * for a grid in the one node that makes grids, and did not get one), while
 * look-alike siblings are info at most: full-bleed banners stacked down the page
 * are a real design, and a warning that fires on one is a warning an agent
 * learns to ignore.
 */
const GRID_ITEM_MIN_HEIGHT = 120;
const GRID_ITEM_MIN_WIDTH = 300;
/** An item narrower than this share of its parent was never trying to be a column. */
const GRID_ITEM_PARENT_SHARE = 0.6;
/** A parent narrower than this share of the viewport is itself already a column. */
const GRID_PARENT_VIEWPORT_SHARE = 0.5;

// ── The browser-side measurement ────────────────────────────────────────────

/**
 * One expression, evaluated in the page. Returns raw numbers only — every
 * judgement about what they mean lives in {@link summarise}, on this side, where
 * it can be unit-tested without a browser.
 */
function measureExpression(placeholders, probes = []) {
  return `(() => {
  const PLACEHOLDERS = ${JSON.stringify(placeholders)};
  const PROBES = ${JSON.stringify(probes)};
  const round = (n) => Math.round(n);
  const cls = (el) => String(el.className || '').trim().slice(0, 60);
  const all = [...document.querySelectorAll('body *')];
  const visible = all.filter((el) => el.offsetParent !== null || getComputedStyle(el).position === 'fixed');

  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;
  const overflowing = visible
    .map((el) => ({ el, w: el.getBoundingClientRect().width }))
    .filter((x) => x.w > vw + 1)
    .map((x) => ({ tag: x.el.tagName, cls: cls(x.el), width: round(x.w) }));

  // AWP-004 — what is on screen, as opposed to what is in the DOM. The page is
  // never scrolled when this runs, so a rect is already a document position.
  // Kimi K3's storefront was 83 texts in the DOM and about three on screen, and
  // the report called it clean because every check it had was about content
  // present and wrong rather than content present and unreachable.
  const onScreen = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw;
  };

  // Below the fold is fine — that is what scrolling is for. Below the *scrollable
  // extent* is not: no scroll reaches it, so it is on the page and can never be
  // seen. Measured directly rather than inferred from a visible-count ratio,
  // because a correct 82-text page also shows only ~19 at a time and a ratio
  // cannot tell the two apart.
  const pageBottom = document.documentElement.scrollHeight;
  const unreachable = (el) => el.getBoundingClientRect().top >= pageBottom - 1;

  const textEls = visible.filter((el) => el.children.length === 0 && el.textContent.trim().length > 0);
  const fontWeights = {};
  const fontSizes = {};
  for (const el of textEls) {
    const cs = getComputedStyle(el);
    fontWeights[cs.fontWeight] = (fontWeights[cs.fontWeight] || 0) + 1;
    fontSizes[cs.fontSize] = (fontSizes[cs.fontSize] || 0) + 1;
  }

  const dead = textEls.filter((el) => PLACEHOLDERS.includes(el.textContent.trim()));
  const byText = {};
  for (const el of dead) {
    const t = el.textContent.trim();
    byText[t] = (byText[t] || 0) + 1;
  }

  const emptyBoxes = visible.filter((el) => {
    const r = el.getBoundingClientRect();
    if (el.children.length !== 0 || el.textContent.trim() !== '') return false;
    if (r.width <= 8 || r.height <= 8) return false;
    const cs = getComputedStyle(el);
    return cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || cs.borderStyle !== 'none';
  });

  const images = visible.filter((el) => el.tagName === 'IMG');
  const brokenImages = images.filter((el) => el.complete && el.naturalWidth === 0);

  // VIB-007 M3 — iconography, which no earlier finding needed and which
  // 'no-imagery' cannot be honest without: README section 2's tell is "no
  // imagery AND no iconography", and a page of five Lucide glyphs and no
  // photographs satisfies only half of it.
  //
  // Four shapes, because IconGlyph has four branches and only two of them carry
  // a class this could key on. Measured against the VIB-006 page rather than
  // read off the component: the font branch renders
  // span.lucide.icon-sprout with NO ndl-icon-glyph class on it, so a selector
  // written from that constant would have counted zero on a page with ten.
  //
  //   sprite / inline -> .ndl-icon-glyph
  //   the Icon node   -> .ndl-visual-icon wrapper
  //   an inline svg   -> the svg element itself
  //   a font glyph    -> a ::before whose content is a Private Use Area
  //                      codepoint, which is what an icon font IS. Restricting
  //                      to U+E000..U+F8FF is what keeps a bullet, a quote mark
  //                      or a CSS counter from counting as iconography.
  //
  // A Set of ELEMENTS, so the wrapper and the glyph it holds are not two icons.
  // Over-counting is harmless here and under-counting is not: the predicate is
  // "is there any iconography at all", so a wrapper counted twice still says
  // yes, and a glyph missed entirely says no when the answer is yes.
  const PUA_FIRST = 0xe000;
  const PUA_LAST = 0xf8ff;
  const isGlyphContent = (raw) => {
    if (!raw || raw === 'none' || raw === 'normal') return false;
    const text = raw.replace(/^["']|["']$/g, '');
    if (!text.length) return false;
    for (const ch of text) {
      const pt = ch.codePointAt(0);
      if (pt < PUA_FIRST || pt > PUA_LAST) return false;
    }
    return true;
  };
  const iconEls = new Set();
  for (const el of visible) {
    const list = el.classList;
    if (list && (list.contains('ndl-icon-glyph') || list.contains('ndl-visual-icon'))) {
      iconEls.add(el);
      continue;
    }
    if (String(el.tagName).toLowerCase() === 'svg') {
      iconEls.add(el);
      continue;
    }
    if (isGlyphContent(getComputedStyle(el, '::before').content)) iconEls.add(el);
  }

  // VIB-007 M3 — the page's full-bleed surfaces and what each is painted with.
  //
  // README section 2's first WordPress tell is "one background colour end to
  // end", and the reading it needs is the number of DISTINCT grounds across the
  // bands, not across every element: a page whose sections alternate has a
  // designed rhythm, and a page whose cards and inputs happen to carry three
  // greys does not. The width filter is the one the rhythm block already uses,
  // so "band" means the same thing in both readings.
  //
  // background-image is read BEFORE background-color and wins, because a
  // gradient or a photograph sits on top of the colour and is the ground a
  // person sees. Measured, not assumed: every one of the VIB-006 page's
  // gradient bands reports backgroundColor rgba(0, 0, 0, 0) and its whole
  // identity is in background-image, so a colour-only count read 6 grounds on a
  // page that has 8.
  const groundCounts = {};
  for (const el of visible) {
    const r = el.getBoundingClientRect();
    if (r.width < vw * 0.6 || r.height < 8) continue;
    const cs = getComputedStyle(el);
    const painted =
      cs.backgroundImage && cs.backgroundImage !== 'none'
        ? cs.backgroundImage
        : cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent'
          ? cs.backgroundColor
          : null;
    if (!painted) continue;
    const key = String(painted).slice(0, 120);
    groundCounts[key] = (groundCounts[key] || 0) + 1;
  }

  // DSG-006 §4 — "one accent". A designed page carries one chromatic colour as
  // a background and neutrals for everything else; five accents is decorated
  // rather than designed. Neutral is decided by *chroma* (max minus min
  // channel) rather than by matching a palette, so it holds for any token set
  // and for a project that never adopted one. Area-weighted, because a 4px
  // chromatic rule and a full-bleed hero are not the same claim.
  const parseRgb = (s) => {
    const m = s.match(/rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    const p = m[1].split(',').map((x) => parseFloat(x));
    if (p.length >= 4 && p[3] === 0) return null;
    return [p[0], p[1], p[2]];
  };
  const accentArea = {};
  const neutralArea = {};
  for (const el of visible) {
    const r = el.getBoundingClientRect();
    const area = r.width * r.height;
    if (area < 1000) continue;
    const bg = getComputedStyle(el).backgroundColor;
    const c = parseRgb(bg);
    if (!c) continue;
    const chroma = Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2]);
    const bucket = chroma > 12 ? accentArea : neutralArea;
    bucket[bg] = (bucket[bg] || 0) + area;
  }
  // DSG-006/F41 — raw area cannot say whether a chromatic colour is an *accent*
  // or the page's ground, and it is not comparable between viewports: 600k px²
  // is half of a desktop page and four phone screens. "share" is the fraction
  // of the viewport the colour covers, which is the number §4 is actually
  // about. The case that named this: haiku and sonnet paint the SAME hue at the
  // SAME accent count, at 0.524 and 0.013 of the page respectively.
  // ⚠️ No backticks in here — this whole block is a template literal, and one
  // in a comment ends the string. It surfaces as a syntax error hundreds of
  // lines away, which is how it cost a debug cycle the first time.
  const viewportArea = window.innerWidth * window.innerHeight;
  const accents = Object.keys(accentArea)
    .map((color) => ({
      color,
      area: round(accentArea[color]),
      share: viewportArea ? Math.round((1000 * accentArea[color]) / viewportArea) / 1000 : null
    }))
    .sort((a, b) => b.area - a.area);

  // DSG-006 §1/§8 — vertical rhythm. Measured between the full-width bands of
  // the page's main stack, not between every pair of siblings: a designed page
  // repeats two or three spacings, and counting every gap in the DOM would
  // drown that signal in card padding. The widest-stack parent is chosen by
  // how many bands it holds, which is what "the page's sections" means when
  // nothing in the graph labels them as such.
  // ⚠️ Measured as gaps *and* band padding, because in this renderer the two
  // are interchangeable and the first version of this saw nothing: a stack of
  // bands that abut at gap 0 and carry their spacing as internal padding is the
  // normal shape here, so gaps alone reported "1 distinct gap: 0" for a page
  // with perfectly good rhythm. What the doctrine is about is the number of
  // distinct vertical spacings on the page, however they are expressed.
  const bandParents = new Map();
  for (const el of visible) {
    const r = el.getBoundingClientRect();
    if (r.width < vw * 0.6 || r.height < 8) continue;
    const p = el.parentElement;
    if (!p) continue;
    if (!bandParents.has(p)) bandParents.set(p, []);
    bandParents.get(p).push({ el, r });
  }
  let bands = [];
  for (const set of bandParents.values()) if (set.length > bands.length) bands = set;
  bands = bands.slice().sort((a, b) => a.r.top - b.r.top);

  const spacingCounts = {};
  const addSpacing = (v) => {
    const n = round(v);
    // Zero is "these abut", not a spacing; a huge value is a page break.
    if (n <= 0 || n > 400) return;
    spacingCounts[n] = (spacingCounts[n] || 0) + 1;
  };
  for (let i = 1; i < bands.length; i++) addSpacing(bands[i].r.top - bands[i - 1].r.bottom);
  for (const b of bands) {
    const cs = getComputedStyle(b.el);
    addSpacing(parseFloat(cs.paddingTop));
    addSpacing(parseFloat(cs.paddingBottom));
  }
  const spacingValues = Object.keys(spacingCounts)
    .map(Number)
    .sort((a, b) => a - b);

  // Repeated sibling sets — a card grid, seen from the DOM. Two kinds:
  //   'columns' — a Columns node's own item wrappers (.column-item), so the
  //               author asked for a grid explicitly and we know it.
  //   'siblings' — identical-looking children of one parent, which is what a
  //               hand-laid or repeated card row looks like.
  // Grouping by parent, and by an identity signature within the parent, is what
  // separates a grid from an ordinary stack of page sections.
  const byParent = new Map();
  for (const el of visible) {
    const p = el.parentElement;
    if (!p) continue;
    if (!byParent.has(p)) byParent.set(p, []);
    byParent.get(p).push(el);
  }
  const groups = [];
  const record = (parent, kids, kind) => {
    if (kids.length < 3) return;
    const rects = kids.map((k) => k.getBoundingClientRect());
    if (rects[0].width < 100) return;
    groups.push({
      kind,
      count: kids.length,
      columns: new Set(rects.map((r) => round(r.left))).size,
      rows: new Set(rects.map((r) => round(r.top))).size,
      itemWidth: round(rects[0].width),
      itemHeight: round(rects[0].height),
      parentWidth: round(parent.getBoundingClientRect().width),
      tag: kids[0].tagName,
      cls: cls(kids[0])
    });
  };
  for (const [parent, kids] of byParent) {
    const items = kids.filter((k) => k.classList && k.classList.contains('column-item'));
    if (items.length >= 3) {
      record(parent, items, 'columns');
      continue;
    }
    const bySignature = new Map();
    for (const k of kids) {
      const sig = k.tagName + '|' + cls(k) + '|' + k.querySelectorAll('*').length;
      if (!bySignature.has(sig)) bySignature.set(sig, []);
      bySignature.get(sig).push(k);
    }
    for (const set of bySignature.values()) record(parent, set, 'siblings');
  }

  // LAS-012 §3. Content the graph declares for a list, looked for on the page.
  //
  // Built from the visible leaf text elements, NOT \`document.body.textContent\`
  // — measured, not assumed: render-from-disk injects the whole project as
  // \`window.projectData\` in a <script> inside <body>, so body text contains
  // every items array verbatim and the first version of this check found all
  // six of haiku's missing strings on a page showing none of them.
  //
  // \`textContent\` is unaffected by text-transform, so an uppercased heading
  // still matches its source string.
  const pageText = textEls.map((el) => el.textContent).join('\\n');
  const lists = PROBES.map((p) => {
    const found = p.strings.filter((s) => pageText.indexOf(s) !== -1);
    return { ...p, found: found.length, missing: p.strings.filter((s) => found.indexOf(s) === -1).slice(0, 3) };
  });

  // How far down the page anything was actually laid out. A page pinned to the
  // viewport height with content laid out past it is clipped; a page that is
  // simply short has nothing past it. That difference is the whole of
  // \`clipped-page\`, and neither number alone can tell them apart.
  const contentBottom = visible.reduce((lowest, el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > lowest ? r.bottom : lowest;
  }, 0);

  return {
    lists,
    layoutWidth: window.innerWidth,
    clientWidth: vw,
    clientHeight: vh,
    scrollWidth: document.documentElement.scrollWidth,
    pageHeight: document.documentElement.scrollHeight,
    contentBottom: round(contentBottom),
    overflowing: overflowing.slice(0, 10),
    overflowingCount: overflowing.length,
    text: {
      elements: textEls.length,
      onScreen: textEls.filter(onScreen).length,
      unreachable: textEls.filter(unreachable).length,
      fontWeights,
      fontSizes,
      distinctFontSizes: Object.keys(fontSizes).length,
      // VIB-007 M3 — the display-type reading. Derived here rather than in
      // summarise so a client that only keeps the summary still has it.
      largestFontSize: Object.keys(fontSizes).reduce((max, px) => Math.max(max, parseFloat(px) || 0), 0),
      bodyFontFamily: getComputedStyle(document.body).fontFamily.slice(0, 80)
    },
    placeholders: {
      count: dead.length,
      byText,
      samples: dead.slice(0, 8).map((el) => ({ text: el.textContent.trim(), tag: el.tagName, cls: cls(el) }))
    },
    images: {
      total: images.length,
      // VIB-007 M3. Deliberately inside the images block rather than beside it: every
      // consumer that asks "does this page have any pictures" has to ask both
      // halves, and two sibling fields is how one of them gets forgotten.
      icons: iconEls.size,
      onScreen: images.filter(onScreen).length,
      unreachable: images.filter(unreachable).length,
      broken: brokenImages.length,
      brokenSources: brokenImages.slice(0, 8).map((el) => String(el.currentSrc || el.src).slice(0, 160))
    },
    emptyDecoratedBoxes: {
      count: emptyBoxes.length,
      samples: emptyBoxes.slice(0, 6).map((el) => {
        const r = el.getBoundingClientRect();
        return { tag: el.tagName, cls: cls(el), width: round(r.width), height: round(r.height) };
      })
    },
    colors: {
      distinctAccents: accents.length,
      accents: accents.slice(0, 6),
      distinctNeutrals: Object.keys(neutralArea).length,
      // The denominator behind every "share", emitted so a score can be
      // recomputed from the report without knowing which viewport produced it.
      viewportArea: round(viewportArea)
    },
    grounds: {
      distinct: Object.keys(groundCounts).length,
      values: Object.keys(groundCounts)
        .map((ground) => ({ ground, count: groundCounts[ground] }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8)
    },
    rhythm: {
      bands: bands.length,
      distinctSpacings: spacingValues.length,
      spacings: spacingValues.slice(0, 12).map((px) => ({ px, count: spacingCounts[px] }))
    },
    repeatedGroups: groups.sort((a, b) => b.itemWidth * b.count - a.itemWidth * a.count).slice(0, 12)
  };
})()`;
}

// ── Findings: what the numbers mean ─────────────────────────────────────────

/**
 * Render-finding codes.
 *
 * Deliberately **not** `DiagnosticCode` values. Those name what is wrong with a
 * graph; these name what is wrong with a picture, and several have no graph
 * counterpart at all (an image that 404s, a page that will not reflow). Where
 * the two do describe one defect from opposite sides, the finding carries
 * `relatedDiagnostic` so LAS-007's example table can key on the same string
 * rather than on a second vocabulary.
 */
const RenderFinding = {
  BlankRender: 'blank-render',
  /**
   * LAS-012 §3 — a list whose rows the graph spells out, and the page does not
   * contain a single one of them. The one shape this report was structurally
   * unable to see: every other finding is about content present and wrong, and
   * a repeater that instantiates nothing emits no elements to judge.
   */
  EmptyList: 'empty-list',
  DeadPlaceholderText: 'dead-placeholder-text',
  BrokenImage: 'broken-image',
  /**
   * AWP-004 §2 — content on the page that no scroll can reach.
   *
   * The direct check for F45, and the one that generalises the other two: Kimi
   * K3's storefront put 83 texts and 10 images in the DOM and stranded 70 and 9
   * of them below a page that does not scroll, and the report called it
   * *"Rendered clean: 83 texts, 10 images"*.
   */
  ContentNotVisible: 'content-not-visible',
  /** The mechanism behind it: a page pinned to the viewport with content past the fold. */
  ClippedPage: 'clipped-page',
  /** Elements wider than the viewport inside a page that does not itself scroll sideways. */
  ElementsOverflowing: 'elements-overflowing',
  SingleColumnGrid: 'single-column-grid',
  MinimumLayoutWidth: 'minimum-layout-width',
  HorizontalOverflow: 'horizontal-overflow',
  FlatTypeScale: 'flat-type-scale',
  EmptyDecoratedBox: 'empty-decorated-box',
  ConsoleError: 'console-error',
  /**
   * VIB-007 M3 — the three poverty findings.
   *
   * 🔴 **Every other finding in this list detects EXCESS or BREAKAGE**, which is
   * register V10: a page can pass all thirteen of them, render perfectly clean,
   * and be worth nothing to look at. That is what the entire VIB-001 baseline
   * is — nine pages ruled SHITTY, and the report called every one of them
   * clean.
   *
   * These three are not invented. Each is one of the WordPress-starter tells
   * README section 2 lists verbatim, restricted to the ones a render can see:
   *
   *   "one background colour end to end"          -> SingleGround
   *   "no imagery and no iconography anywhere"    -> NoImagery
   *   "headline under ~48px on desktop"           -> NoDisplayType
   *
   * ⚠️ **They are warnings, not errors, and that is a decision rather than an
   * oversight.** `error` is the severity `noodl-mcp`'s render verdict blocks
   * "done" on (VIB-007 M1), and README section 2 exempts app-chrome pages (forms,
   * lists, settings) from the marketing tells — a settings page needs no 72px
   * headline and refusing to certify one would be the instrument being wrong,
   * loudly, on every honest project. The instrument cannot currently tell a
   * landing page from a settings page; until something can, poverty is reported
   * and does not refuse.
   */
  SingleGround: 'single-ground',
  NoImagery: 'no-imagery',
  NoDisplayType: 'no-display-type'
};

const SEVERITY_ORDER = { error: 0, warning: 1, info: 2 };

/**
 * VIB-007 M3 — **the poverty family, as one list, exported.**
 *
 * A client has to be able to ask "did this page measure as a default template?"
 * without knowing which three codes that means today. Two consumers already
 * need it — the render verdict, which must not let a `done: true` say *clean*
 * about a page with nothing on it, and any report that wants to group these
 * apart from the twelve defect detectors.
 *
 * 🔴 Written once because the alternative is the BCN-003 shape this repo has
 * paid for: a second copy of a code list is right the day it is written and
 * silently wrong the first time a fourth poverty finding ships.
 */
const POVERTY_FINDINGS = [RenderFinding.SingleGround, RenderFinding.NoImagery, RenderFinding.NoDisplayType];

/** Is this finding about the page being poor rather than broken? */
function isPovertyFinding(finding) {
  return Boolean(finding) && POVERTY_FINDINGS.indexOf(finding.code) !== -1;
}

/**
 * VIB-007 M3 — the display-type threshold, **quoted from README section 2**:
 * *"Type ramp reading as two sizes; headline under ~48px on desktop"*.
 *
 * 🔴 It is the rubric's number, not one fitted to the two artefacts AC3 names,
 * and the seven measurement fixtures in `noodl-mcp/tests/fixtures/render` are
 * the check on that. Every real build recorded there tops out at **exactly 48
 * or 60px** — haiku, sonnet, kimi and the ecommerce reference, four independent
 * authors — while the two shipped templates the VIB-001 baseline ruled SHITTY
 * top out at **30px**. The threshold falls in a gap the corpus put there.
 *
 * ⚠️ **Desktop only, because that is the only width the rubric gives a number
 * for.** A phone threshold would be invented, and an invented number in a
 * finding that fires on real projects is how a gate teaches a lie. What this
 * cannot see is therefore stated rather than guessed: a page whose desktop
 * headline is fine and whose phone headline collapses is not this finding's.
 */
const DISPLAY_TYPE_MIN_PX = 48;

/**
 * How many distinct full-bleed grounds a page needs before it stops reading as
 * *"one background colour end to end"* (README section 2's first tell).
 *
 * One is the tell exactly. Two is a page with a header or a footer that differs
 * from its body, which is the least a designed page does, so the predicate is
 * `<= 1` rather than a taste threshold: measured, the VIB-001 baseline's two
 * one-ground pages read 1 and the VIB-006 page reads far more.
 */
const MIN_DISTINCT_GROUNDS = 2;

/**
 * A page with fewer visible texts than this is not a page whose *poverty* is
 * the finding — `blank-render` and the placeholder checks own that territory,
 * and a poverty finding on top of them is a second sentence about one defect.
 *
 * ⚠️ Deliberately low. The existing `flat-type-scale` uses 10 and consequently
 * fires on **none** of the nine SHITTY baseline pages (they carry 3 to 10
 * texts) — the concrete case behind VIB-007 section 3's *"the machinery already
 * exists and is set too quiet"*.
 */
const POVERTY_MIN_TEXTS = 3;

/**
 * AWP-004 — how far past its own scrollable extent a page may lay content out
 * before that content is stranded rather than rounded.
 *
 * Measured 2026-08-09: the two builds this phase calls correct put `contentBottom`
 * **exactly** on `pageHeight` (sonnet 3777/3777 and 6482/6482, ecommerce
 * 2373/2373 and 3080/3080), and Kimi's clipped build put it 4,392px past. There is
 * no middle ground in the corpus, so the slack only has to absorb sub-pixel
 * rounding.
 */
const CLIPPED_CONTENT_SLACK = 8;

function plural(n, one, many) {
  return n === 1 ? `1 ${one}` : `${n} ${many}`;
}

/**
 * AWP-003's wider rule, applied to the overflow findings: **name what was
 * measured, not what might be wrong.**
 *
 * Grepping the finding set for messages that enumerate possible causes rather
 * than reporting a determined one — which AWP-003 asks for explicitly, on the
 * grounds that `blank-render` was unlikely to be the only one — turned up
 * `minimum-layout-width` ending on *"Something inside carries a fixed width or a
 * non-collapsing row"*. Both halves of that guess were already answered by
 * `overflowing`, which the finding was attaching as evidence and not reading.
 *
 * Returns the widest offending element as a phrase, or `null` when nothing was
 * captured — in which case the finding says less rather than guessing.
 */
function widestOffender(v) {
  const widest = (v.overflowing || []).slice().sort((a, b) => b.width - a.width)[0];
  if (!widest) return null;
  const named = widest.cls ? `${widest.tag.toLowerCase()}.${widest.cls.split(/\s+/)[0]}` : widest.tag.toLowerCase();
  return `${named} at ${widest.width}px`;
}

/**
 * Turn the raw per-viewport measurements into findings and a one-line summary.
 *
 * Pure: measurements in, report out. Every threshold is a named constant and
 * every finding says what was measured, because a finding an agent cannot act on
 * is a finding it will ignore — the audit's central result was that rejections
 * carrying a concrete fix were self-corrected 100% of the time and prose was
 * dropped.
 */
function summarise(viewports, diagnosis, overridden = {}) {
  const findings = [];
  const add = (f) => findings.push(f);

  for (const [name, v] of Object.entries(viewports)) {
    if (!v || v.error) continue;
    const isDesktop = v.requested.width >= DESKTOP_WIDTH;

    if (v.text.elements === 0 && v.images.total === 0) {
      // AWP-003 — what was determined, never a list of what might be wrong. The
      // walk has the project; without one there is nothing to say beyond the
      // measurement, and saying less is the point of the task.
      add({
        code: RenderFinding.BlankRender,
        severity: 'error',
        viewport: name,
        message:
          'The page rendered nothing at all — no text and no images. ' +
          (diagnosis
            ? diagnosis.message
            : 'No project was available to diagnose it against, so the cause was not determined.'),
        ...(diagnosis && diagnosis.cause ? { cause: diagnosis.cause } : {}),
        ...(diagnosis && diagnosis.evidence ? { evidence: diagnosis.evidence } : {})
      });
      continue;
    }

    for (const list of v.lists || []) {
      if (list.found > 0) continue;
      add({
        code: RenderFinding.EmptyList,
        severity: 'error',
        viewport: name,
        relatedDiagnostic: 'repeater-without-template',
        message:
          `The Repeater "${list.label}" in ${list.component} has ${plural(list.rows, 'row', 'rows')} of ` +
          `${list.source}, and none of that content is on the page — so it built nothing. A For Each ` +
          'instantiates the component named on its "template" port once per item and inserts each copy as its ' +
          'own next sibling; with no template, or with the item markup nested underneath it instead, it ' +
          `renders nothing at all. Looked for: ${list.missing.map((s) => `"${s}"`).join(', ')}.`,
        evidence: { component: list.component, nodeId: list.nodeId, rows: list.rows, missing: list.missing }
      });
    }

    if (v.placeholders.count > 0) {
      // Two classes, two causes, two sentences. A node-type default on screen
      // means nobody set the port; a component's own hardcoded fallback on screen
      // means an input that *was* wired never arrived. Telling an agent the wrong
      // one aims it at the wrong subsystem, which is AWP-003's lesson applied to
      // the finding next door.
      const entries = Object.entries(v.placeholders.byText);
      const listing = (pairs) => pairs.map(([text, n]) => `${n}× "${text}"`).join(', ');
      const total = (pairs) => pairs.reduce((sum, [, n]) => sum + n, 0);
      const fromInput = entries.filter(([text]) => overridden[text]);
      const fromCatalog = entries.filter(([text]) => !overridden[text]);

      // AWP-004 §3 — the fallback a wired port shows when its input never came.
      if (fromInput.length) {
        const where = fromInput.map(([text]) => `"${text}" is ${describeSites(overridden[text])}`).join('; ');
        add({
          code: RenderFinding.DeadPlaceholderText,
          severity: 'error',
          viewport: name,
          relatedDiagnostic: 'interfaceless-instance',
          message:
            `${plural(total(fromInput), 'element shows', 'elements show')} the fallback hardcoded on a port ` +
            `that a Component Inputs node also feeds: ${listing(fromInput)}. That value is only ever visible ` +
            `when the input does not arrive, so it did not arrive — ${where}.`,
          evidence: v.placeholders.samples.filter((s) => overridden[s.text])
        });
      }

      if (fromCatalog.length) {
        add({
          code: RenderFinding.DeadPlaceholderText,
          severity: 'error',
          viewport: name,
          relatedDiagnostic: 'interfaceless-instance',
          message:
            `${plural(total(fromCatalog), 'element renders', 'elements render')} a node-type default instead ` +
            `of content: ${listing(fromCatalog)}. Nothing set those ports. The usual cause is a component ` +
            'instantiated with parameters its Component Inputs node does not declare, so every value is ' +
            'discarded — the graph-side name for it is interfaceless-instance.',
          evidence: v.placeholders.samples.filter((s) => !overridden[s.text])
        });
      }
    }

    if (v.images.broken > 0) {
      add({
        code: RenderFinding.BrokenImage,
        severity: 'error',
        viewport: name,
        message:
          `${plural(v.images.broken, 'image', 'images')} of ${v.images.total} failed to load — the element is ` +
          'in the DOM with naturalWidth 0. A URL that returns 200 can still be the wrong picture; this is only ' +
          'the half a number can see, so look at the screenshot for the rest.',
        evidence: v.images.brokenSources
      });
    }

    // ── AWP-004 §2 — is what is in the DOM also on screen? ──────────────────
    //
    // Only where it was measured. A recording made before these fields existed
    // cannot answer the question, and LAS-012 established abstention as the
    // honest third state rather than assuming the flattering answer.
    const measuredVisibility = typeof v.contentBottom === 'number' && typeof v.text.unreachable === 'number';

    if (measuredVisibility) {
      const strandedText = v.text.unreachable;
      const strandedImages = v.images.unreachable || 0;

      // The direct check. Deliberately NOT "counted text vastly exceeds visible
      // text" as AWP-004 §2 first proposed: measured on the corpus, a correct
      // 82-text page shows 19 of them at 1280×900 and 11 at 390×844 against
      // Kimi's 13 and 9, so a ratio cannot separate a clipped page from a long
      // one. Content below the page's own scrollable extent can — 70 on Kimi,
      // 0 on both builds this phase calls correct.
      if (strandedText > 0 || strandedImages > 0) {
        const parts = [];
        if (strandedText > 0) parts.push(`${strandedText} of ${v.text.elements} text elements`);
        if (strandedImages > 0) parts.push(`${strandedImages} of ${v.images.total} images`);
        add({
          code: RenderFinding.ContentNotVisible,
          severity: 'error',
          viewport: name,
          message:
            `${parts.join(' and ')} are laid out below ${v.pageHeight}px, which is as far as this page ` +
            `scrolls — no scroll reaches them, so they are on the page and cannot be seen. Content ` +
            `extends to ${v.contentBottom}px. ${v.text.onScreen} of ${v.text.elements} texts are on screen.`,
          evidence: {
            pageHeight: v.pageHeight,
            contentBottom: v.contentBottom,
            textElements: v.text.elements,
            textOnScreen: v.text.onScreen,
            textUnreachable: strandedText,
            imagesUnreachable: strandedImages
          }
        });
      }

      // The mechanism, when the page height is pinned to the viewport it was
      // asked for. The MCP server's own instructions already warn that the
      // default clips every page with no scrollbar and tell planners to pass
      // `scroll`; this is what makes that warning checkable.
      const pinned = Math.abs(v.pageHeight - v.requested.height) <= 1;
      if (pinned && v.contentBottom > v.pageHeight + CLIPPED_CONTENT_SLACK) {
        add({
          code: RenderFinding.ClippedPage,
          severity: 'warning',
          viewport: name,
          message:
            `The page is exactly ${v.pageHeight}px tall — the viewport height — and its content runs to ` +
            `${v.contentBottom}px, so it is clipped at the fold rather than scrolling. A root that clips to ` +
            'the viewport with no scrollbar is the default; a page of this length has to opt into scrolling.',
          evidence: { pageHeight: v.pageHeight, contentBottom: v.contentBottom, viewport: v.requested.height }
        });
      }
    }

    if (isDesktop) {
      for (const g of v.repeatedGroups) {
        if (g.count < 3 || g.columns !== 1) continue;
        if (g.itemWidth < g.parentWidth * GRID_ITEM_PARENT_SHARE) continue;
        if (g.kind !== 'columns') {
          if (g.itemHeight < GRID_ITEM_MIN_HEIGHT || g.itemWidth < GRID_ITEM_MIN_WIDTH) continue;
          if (g.parentWidth < v.requested.width * GRID_PARENT_VIEWPORT_SHARE) continue;
        }
        add({
          code: RenderFinding.SingleColumnGrid,
          severity: g.kind === 'columns' ? 'warning' : 'info',
          viewport: name,
          message:
            `${g.count} repeated items are stacked in one column at ${v.requested.width}px, each ` +
            `${g.itemWidth}×${g.itemHeight}px inside a ${g.parentWidth}px parent` +
            (g.kind === 'columns'
              ? '. They are a Columns node\u2019s items, so the layoutString asked for one column — "1 1 1" is ' +
                'three equal columns, and the count of numbers is the count of columns.'
              : '. If they are meant to be a grid, a Columns node is the only node that lays items out in one ' +
                'and collapses it on small screens; if they are meant to be full-width bands, this is right.'),
          evidence: g
        });
      }
    }

    if (v.layoutWidth > v.requested.width + 1) {
      add({
        code: RenderFinding.MinimumLayoutWidth,
        severity: 'warning',
        viewport: name,
        message:
          `The page cannot lay out below ${v.layoutWidth}px: asked for ${v.requested.width}px, the browser ` +
          `widened the layout viewport to ${v.layoutWidth}px and scaled the whole page down.` +
          (widestOffender(v)
            ? ` The widest element inside it is ${widestOffender(v)}.`
            : ' Nothing wider than the viewport was captured, so the element holding the floor was not identified.'),
        evidence: v.overflowing
      });
    } else if (v.scrollWidth > v.clientWidth + 1) {
      add({
        code: RenderFinding.HorizontalOverflow,
        severity: 'warning',
        viewport: name,
        message:
          `The page scrolls sideways at ${v.requested.width}px — content is ${v.scrollWidth}px wide in a ` +
          `${v.clientWidth}px viewport, with ${plural(v.overflowingCount, 'element', 'elements')} wider than it.`,
        evidence: v.overflowing
      });
    } else if (v.overflowingCount > 0) {
      // AWP-004 §2. `overflowingCount` has been computed since LAS-005 and had no
      // rule attached to it — register note A7, and the reason that note says to
      // check what is already measured before measuring anything new. The two
      // page-level checks above both passed on Kimi's phone render (the document
      // itself does not scroll sideways) while 43 elements overflowed inside it.
      add({
        code: RenderFinding.ElementsOverflowing,
        severity: 'warning',
        viewport: name,
        message:
          `${plural(v.overflowingCount, 'element is', 'elements are')} wider than the ${v.clientWidth}px ` +
          'viewport, while the page itself does not scroll sideways — so each is clipped by an ancestor ' +
          `rather than reachable${widestOffender(v) ? `; the widest is ${widestOffender(v)}` : ''}.`,
        evidence: v.overflowing
      });
    }

    if (v.text.elements >= 10) {
      const weights = Object.keys(v.text.fontWeights);
      if (weights.length <= 1 || v.text.distinctFontSizes <= 2) {
        add({
          code: RenderFinding.FlatTypeScale,
          severity: 'warning',
          viewport: name,
          message:
            `${v.text.elements} text elements render at ${plural(weights.length, 'font weight', 'font weights')} ` +
            `(${weights.join(', ')}) and ${plural(v.text.distinctFontSizes, 'font size', 'font sizes')}. ` +
            'Nothing is emphasised over anything else, which is what an unstyled page measures like.'
        });
      }
    }

    if (v.emptyDecoratedBoxes.count > 0) {
      add({
        code: RenderFinding.EmptyDecoratedBox,
        severity: 'warning',
        viewport: name,
        message:
          `${plural(v.emptyDecoratedBoxes.count, 'box has', 'boxes have')} a background or border and no ` +
          'content — a card whose contents never arrived, or a decorated Group used as a spacer.',
        evidence: v.emptyDecoratedBoxes.samples
      });
    }

    // ── VIB-007 M3 — poverty: the page is whole, and it is a default template ──
    //
    // 🔴 Everything above this line detects excess or breakage. These three ask
    // the opposite question, and a page can answer badly while passing every
    // one of them — which is what all nine VIB-001 baseline pages did.
    //
    // 🔴 **A field this measurement does not carry is UNKNOWN, never zero.**
    // The seven recorded fixtures predate `grounds` and `images.icons`, and a
    // predicate reading `undefined` as "none" would report *"no imagery"* about
    // four builds that ship sixteen photographs. An absence is only assertable
    // beside a signal known to fire, and here the signal is the field existing.
    const poorEnoughToJudge = v.text.elements >= POVERTY_MIN_TEXTS;

    if (poorEnoughToJudge && v.images && typeof v.images.icons === 'number' && v.images.total === 0 && v.images.icons === 0) {
      add({
        code: RenderFinding.NoImagery,
        severity: 'warning',
        viewport: name,
        message:
          `${v.text.elements} text elements and not one picture or glyph — no images, no icons. ` +
          'README §2\'s second WordPress-starter tell is "no imagery and no iconography anywhere on ' +
          'the page", and this page measures as exactly that. The Image and Icon nodes are in the kit ' +
          'and the starter modules ship photographs and 1,998 Lucide glyphs.'
      });
    }

    if (poorEnoughToJudge && isDesktop && typeof v.text.largestFontSize === 'number' && v.text.largestFontSize > 0 && v.text.largestFontSize < DISPLAY_TYPE_MIN_PX) {
      add({
        code: RenderFinding.NoDisplayType,
        severity: 'warning',
        viewport: name,
        message:
          `The largest text on this page renders at ${Math.round(v.text.largestFontSize)}px across ` +
          `${plural(v.text.distinctFontSizes, 'distinct size', 'distinct sizes')}. README §2 calls a headline ` +
          `under ~${DISPLAY_TYPE_MIN_PX}px on desktop a WordPress-starter tell; nothing on this page is ` +
          'operating as display type.',
        evidence: v.text.fontSizes
      });
    }

    if (poorEnoughToJudge && v.grounds && typeof v.grounds.distinct === 'number' && v.grounds.distinct < MIN_DISTINCT_GROUNDS) {
      add({
        code: RenderFinding.SingleGround,
        severity: 'warning',
        viewport: name,
        message:
          `Every full-width band on this page is painted the same — ${plural(v.grounds.distinct, 'distinct ground', 'distinct grounds')} ` +
          'across the whole page. README §2\'s first WordPress-starter tell is "one background colour end to ' +
          'end". A ground can be a colour, a gradient or an image, and alternating them is what makes a page ' +
          'read as sections rather than as one column.',
        evidence: v.grounds.values
      });
    }

    if (v.consoleErrors && v.consoleErrors.length) {
      add({
        code: RenderFinding.ConsoleError,
        severity: 'warning',
        viewport: name,
        message: `The runtime logged ${plural(v.consoleErrors.length, 'error', 'errors')} while rendering.`,
        evidence: v.consoleErrors.slice(0, 5)
      });
    }
  }

  // One page can hold three paragraph blocks with identical geometry; three
  // identical sentences is a report an agent skims rather than reads.
  const seen = new Set();
  const unique = findings.filter((f) => {
    const key = `${f.code}|${f.viewport}|${f.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  unique.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  return { findings: unique, summary: summaryLine(viewports, unique) };
}

/**
 * One sentence an agent can act on without reading the JSON.
 *
 * ## AWP-004 \u00a74 \u2014 say what is on screen, not only what is in the DOM
 *
 * This line was *"Rendered clean: desktop 1280\u00d7900px, 83 texts, 10 images"* for a
 * page showing a dialog and nothing else. Every number in it was true and the
 * sentence was false, because "83 texts" is a fact about the DOM and the reader
 * takes it as a fact about the picture. `83 texts, 13 on screen` needs no finding
 * attached to tell a model something is wrong, which is why AWP-004 called this
 * the cheapest change here and probably the highest value.
 *
 * ## AWP-004 \u00a71 \u2014 "clean" is a claim, and it has to be earned
 *
 * *"Rendered clean"* used to mean "no check I own fired", which is how three
 * different broken pages across three sessions were certified. It now means the
 * report **affirmed** that something is on screen. Where visibility was not
 * measured at all \u2014 a recording made before those fields existed \u2014 it says so
 * instead of upgrading silence into a pass.
 */
function summaryLine(viewports, findings) {
  const count = (severity) => findings.filter((f) => f.severity === severity).length;
  const errors = count('error');
  const warnings = count('warning');
  const infos = count('info');
  const live = Object.entries(viewports).filter(([, v]) => v && !v.error);
  const shape = live
    .map(([name, v]) => {
      const counts =
        typeof v.text.onScreen === 'number'
          ? `${v.text.elements} texts, ${v.text.onScreen} on screen, ${v.images.total} images`
          : `${v.text.elements} texts, ${v.images.total} images`;
      return `${name} ${v.requested.width}\u00d7${v.pageHeight}px, ${counts}`;
    })
    .join('; ');
  if (!errors && !warnings) {
    const measured = live.filter(([, v]) => typeof v.text.onScreen === 'number');
    const observations = infos ? ` (${plural(infos, 'observation', 'observations')})` : '';
    if (measured.length !== live.length) {
      return `No findings${observations}, and visibility was not measured \u2014 not a claim the page is on screen: ${shape}.`;
    }
    if (measured.some(([, v]) => v.text.onScreen === 0 && v.images.onScreen === 0)) {
      return `No findings${observations}, but nothing is on screen at the top of the page: ${shape}.`;
    }
    return `Rendered clean${observations}: ${shape}.`;
  }
  const worst = [...new Set(findings.filter((f) => f.severity !== 'info').map((f) => f.code))].slice(0, 4).join(', ');
  return (
    `${plural(errors, 'error', 'errors')}, ${plural(warnings, 'warning', 'warnings')}` +
    `${infos ? `, ${plural(infos, 'observation', 'observations')}` : ''} (${worst}). ${shape}.`
  );
}

/** The sites of one overridden default, as a phrase a finding can end on. */
function describeSites(entry) {
  const sites = entry.sites || [];
  const named = sites.slice(0, 2).map((s) => `${s.port} in ${s.component}`);
  const rest = sites.length - named.length;
  return named.join(' and ') + (rest > 0 ? ` and ${plural(rest, 'other place', 'other places')}` : '');
}

/**
 * Port names whose value is what the user reads on the page.
 *
 * Moved here with {@link placeholderStringsFromCatalog} so the editor derives
 * the same set the CLI does. It sat in `render-report.js` beside a function
 * that reads the catalog off disk; the *rule* is pure, only the reading was not.
 */
const TEXT_BEARING_PORTS = /^(text|label|placeholder|title|caption|heading)$/i;

/**
 * The strings a visual node shows when nobody told it what to say, derived from
 * a catalog **object**.
 *
 * ⚠️ Split from `render-report.js`'s `placeholderStrings(catalogPath)`, which is
 * now just `JSON.parse(fs.readFileSync(...))` around this. The reason is F22 in
 * miniature: the editor already bundles `node-catalog.json` and has no `fs`, so
 * a derivation locked behind a file read would have forced it to hardcode the
 * list — and the harness's own header records what paraphrasing a generated
 * contract cost last time (two phases certifying a page the editor could not
 * render).
 */
function placeholderStringsFromCatalog(catalog) {
  const found = new Set();
  for (const node of (catalog && catalog.nodes) || []) {
    if (!node.isVisual) continue;
    for (const port of node.inputs || []) {
      if (!TEXT_BEARING_PORTS.test(port.name)) continue;
      if (typeof port.default === 'string' && port.default.trim()) found.add(port.default.trim());
    }
  }
  return [...found];
}


module.exports = {
  // Vocabulary — every client must agree on these.
  DEFAULT_VIEWPORTS,
  NAMED_VIEWPORTS,
  DESKTOP_WIDTH,
  RenderFinding,
  SEVERITY_ORDER,
  CLIPPED_CONTENT_SLACK,
  // VIB-007 M3 — exported because a spec that restates 48 is a second copy of
  // README §2's number, and the one that drifts is always the copy.
  DISPLAY_TYPE_MIN_PX,
  MIN_DISTINCT_GROUNDS,
  POVERTY_MIN_TEXTS,
  POVERTY_FINDINGS,
  isPovertyFinding,
  // The two halves of the loop: what to evaluate in the page, and what the
  // numbers that come back mean.
  measureExpression,
  summarise,
  summaryLine,
  // Helpers the callers share.
  plural,
  widestOffender,
  describeSites,
  TEXT_BEARING_PORTS,
  placeholderStringsFromCatalog
};
