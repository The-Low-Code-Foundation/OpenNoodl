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
      bodyFontFamily: getComputedStyle(document.body).fontFamily.slice(0, 80)
    },
    placeholders: {
      count: dead.length,
      byText,
      samples: dead.slice(0, 8).map((el) => ({ text: el.textContent.trim(), tag: el.tagName, cls: cls(el) }))
    },
    images: {
      total: images.length,
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
  ConsoleError: 'console-error'
};

const SEVERITY_ORDER = { error: 0, warning: 1, info: 2 };

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
  DESKTOP_WIDTH,
  RenderFinding,
  SEVERITY_ORDER,
  CLIPPED_CONTENT_SLACK,
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
