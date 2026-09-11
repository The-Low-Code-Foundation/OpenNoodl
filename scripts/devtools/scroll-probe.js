#!/usr/bin/env node
/**
 * Read a rendered page at a scroll position that is **not zero**.
 *
 * Usage:
 *   node scripts/devtools/scroll-probe.js <project-dir> [options]
 *
 *   --selector <css>    also probe these elements, beyond the auto-discovered
 *                       sticky/fixed ones (repeatable, or comma-separated)
 *   --viewports <list>  "desktop,phone" or "1280x900,390x844"
 *   --scroll <n>        scroll this many px (default: 40% of the scrollable
 *                       extent, which is past the fold on any real page)
 *   --json              the full report as JSON on stdout, nothing else
 *
 * ## Why this exists
 *
 * Phase 54, finding F52. `render:report` reads the page at scrollTop 0, and at
 * scrollTop 0 **a stuck band and a band that is about to scroll away are
 * pixel-identical**. Nine counter-builds of `ui-sticky-nav` were rendered while
 * writing that recipe; four of them were dead or illegible — a clipping ancestor
 * that eats the stickiness, a sticky inside a parent box that has already gone,
 * an `alignY` that parks the band halfway down the screen, and a band with no
 * `zIndex` that the sections below paint straight through — and `render:report`
 * called every one of them *"Rendered clean"*. It was not wrong; it was reading
 * the one scroll position where the defect is invisible.
 *
 * ## The two things it looks for that a rect cannot see
 *
 * 1. **Does it actually stick?** Measured as drift: how far the element's
 *    viewport-relative top moved against how far the container scrolled. A band
 *    that moves the full delta did not stick, whatever its computed `position`
 *    says — a `position: sticky` under an `overflow: hidden` ancestor computes as
 *    sticky and behaves as static.
 * 2. **Is it on top?** Finding F53 — variant F's band is at top 0, full width,
 *    opaque, and computed `position: sticky`, and it is unreadable, because the
 *    sibling sections are `position: relative` and later in DOM order so they
 *    paint over it. **Every rect-based measurement passes.** Only
 *    `elementFromPoint` catches it, and only at a scroll position where something
 *    has arrived underneath.
 *
 * ⚠️ A page with nothing to scroll proves nothing here, so that is reported as a
 * finding rather than passed over in silence — it is the same class of lie F52
 * is, one level up.
 *
 * @module scripts/devtools/scroll-probe
 */
const { withRenderedPage, parseViewports } = require('./render-report');

const argv = process.argv.slice(2);
const VALUE_FLAGS = new Set(['--selector', '--viewports', '--scroll']);
const asJson = argv.includes('--json');

const flag = (name, fallback) => {
  const i = argv.indexOf(name);
  return i === -1 ? fallback : argv[i + 1];
};
/** Every `--selector`, so the flag can be repeated as well as comma-separated. */
const allFlags = (name) =>
  argv.flatMap((a, i) => (a === name && argv[i + 1] ? argv[i + 1].split(',') : [])).map((s) => s.trim()).filter(Boolean);

const projectDir = argv.find((a, i) => !a.startsWith('--') && !VALUE_FLAGS.has(argv[i - 1]));

/**
 * How far an element's top may drift from where it started before the drift is
 * travel rather than measurement noise.
 *
 * Sub-pixel layout rounding is the only thing this needs to absorb: the recorded
 * builds put a pinned band at exactly 0, and a band that scrolls away at exactly
 * −(the scroll delta). There is no middle ground in the corpus.
 */
const DRIFT_SLACK = 2;

/**
 * How far from a viewport edge a pinned element may settle before it is worth
 * mentioning, as a fraction of the viewport height.
 *
 * ⚠️ Unlike {@link DRIFT_SLACK} this is **not** derived from a measurement — the
 * corpus contains exactly one element pinned away from an edge (`ui-sticky-nav`
 * variant D, at 422px of 900), and one point cannot set a threshold. It is a
 * warning and never an error for that reason: a band pinned mid-screen works,
 * it is merely almost never what anybody asked for.
 */
const EDGE_SLACK_FRACTION = 0.25;

const ScrollFinding = {
  /** Declared sticky or fixed, and it moved the whole way with the scroll. */
  StickyScrollsAway: 'sticky-scrolls-away',
  /** Geometry perfect, and something else paints over it — F53. */
  StickyOccluded: 'sticky-occluded',
  /** Pinned, but not against the edge it was probably meant to pin to. */
  StickyPinsAwayFromEdge: 'sticky-pins-away-from-edge',
  /** Nothing on the page scrolls, so nothing here was actually tested. */
  NoScrollRange: 'no-scroll-range',
  /** No sticky or fixed element, and no `--selector` given. */
  NothingToProbe: 'nothing-to-probe'
};

/**
 * The whole of the in-page measurement. Stringified and evaluated in the target,
 * so it must not close over anything in this module.
 *
 * @param {string[]} selectors  Extra CSS selectors to probe beyond sticky/fixed.
 * @param {number|null} scrollTo  Absolute px to scroll, or null for 40% of the extent.
 * @param {number} driftSlack
 */
/* istanbul ignore next — runs in Chrome, never in node */
async function probeInPage(selectors, scrollTo, driftSlack) {
  const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  const describe = (el) => {
    if (!el) return null;
    const id = el.id ? `#${el.id}` : '';
    const cls = typeof el.className === 'string' && el.className ? `.${el.className.trim().split(/\s+/).join('.')}` : '';
    const text = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    return `${el.tagName.toLowerCase()}${id}${cls}${text ? ` "${text}"` : ''}`;
  };

  const rectOf = (el) => {
    const r = el.getBoundingClientRect();
    return { top: Math.round(r.top), left: Math.round(r.left), width: Math.round(r.width), height: Math.round(r.height) };
  };

  const scrolls = (el) => {
    const oy = getComputedStyle(el).overflowY;
    return (oy === 'auto' || oy === 'scroll' || oy === 'overlay') && el.scrollHeight > el.clientHeight + 1;
  };

  /** The box whose scrolling this element's stickiness is relative to. */
  const scrollContainerOf = (el) => {
    for (let p = el.parentElement; p; p = p.parentElement) if (scrolls(p)) return p;
    const se = document.scrollingElement || document.documentElement;
    return se.scrollHeight > se.clientHeight + 1 ? se : null;
  };

  /** The first ancestor that clips — the mechanism behind a sticky that is not. */
  const clippingAncestorOf = (el) => {
    for (let p = el.parentElement; p; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (['hidden', 'clip'].includes(cs.overflowY) || ['hidden', 'clip'].includes(cs.overflowX)) {
        return { element: describe(p), overflowX: cs.overflowX, overflowY: cs.overflowY };
      }
    }
    return null;
  };

  /**
   * Whether anything paints over the element, sampled across its width.
   *
   * Three points rather than one: a band with a gap between its brand and its
   * links can have a centre that lands in the gap, where the band itself is
   * still the hit — and a partial overlap covers some columns and not others.
   */
  const occlusionOf = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return { covered: false, offscreen: true, by: null };
    const y = Math.min(Math.max(r.top + r.height / 2, 1), window.innerHeight - 1);
    if (r.bottom < 0 || r.top > window.innerHeight) return { covered: false, offscreen: true, by: null };

    const blockers = [];
    for (const fraction of [0.25, 0.5, 0.75]) {
      const x = Math.min(Math.max(r.left + r.width * fraction, 1), window.innerWidth - 1);
      const hit = document.elementFromPoint(x, y);
      if (hit && hit !== el && !el.contains(hit)) blockers.push({ at: `${Math.round(fraction * 100)}%`, by: describe(hit) });
    }
    return { covered: blockers.length > 0, offscreen: false, sampled: 3, blockers };
  };

  // ── Targets ───────────────────────────────────────────────────────────────
  const auto = Array.from(document.querySelectorAll('*')).filter((el) => {
    const p = getComputedStyle(el).position;
    return p === 'sticky' || p === 'fixed';
  });
  const chosen = selectors.flatMap((s) => {
    try {
      return Array.from(document.querySelectorAll(s));
    } catch {
      return [];
    }
  });
  const targets = [...new Set([...auto, ...chosen])];

  const badSelectors = selectors.filter((s) => {
    try {
      return document.querySelectorAll(s).length === 0;
    } catch {
      return true;
    }
  });

  const results = [];
  for (const el of targets) {
    const cs = getComputedStyle(el);
    const container = scrollContainerOf(el);
    const entry = {
      element: describe(el),
      position: cs.position,
      inset: { top: cs.top, bottom: cs.bottom, left: cs.left, right: cs.right },
      zIndex: cs.zIndex,
      clippingAncestor: clippingAncestorOf(el),
      autoDiscovered: auto.includes(el)
    };

    if (!container) {
      results.push({ ...entry, scrollable: false, reason: 'no ancestor of this element scrolls' });
      continue;
    }

    const maxScroll = container.scrollHeight - container.clientHeight;
    const before = rectOf(el);
    const from = container.scrollTop;
    const to = Math.min(scrollTo === null ? Math.round(maxScroll * 0.4) : scrollTo, maxScroll);

    container.scrollTop = to;
    await frame();
    const delta = container.scrollTop - from;
    const after = rectOf(el);
    const occlusion = occlusionOf(el);
    const drift = Math.abs(after.top - before.top);

    container.scrollTop = from;
    await frame();

    results.push({
      ...entry,
      scrollable: true,
      container: describe(container) + (container === document.scrollingElement ? ' (document)' : ''),
      maxScroll,
      scrolledBy: delta,
      rect: { atRest: before, whenScrolled: after },
      drift,
      // A band that moved the whole delta never stuck, whatever `position` says.
      pinned: delta > 0 && drift < delta - driftSlack,
      travelBeforePinning: delta > 0 && drift < delta - driftSlack ? drift : null,
      pinnedAt: after.top,
      occlusion
    });
  }

  return {
    viewportHeight: window.innerHeight,
    pageScrollRange: (() => {
      const se = document.scrollingElement || document.documentElement;
      return se.scrollHeight - se.clientHeight;
    })(),
    stickyOrFixedFound: auto.length,
    selectorsMatchingNothing: badSelectors,
    targets: results
  };
}

/** Findings, in the vocabulary of `RenderFinding` — one page, one viewport. */
function findingsFor(viewportName, measured) {
  const findings = [];
  const push = (severity, code, message) => findings.push({ severity, viewport: viewportName, code, message });

  if (measured.targets.length === 0) {
    push(
      'warning',
      ScrollFinding.NothingToProbe,
      'No sticky or fixed element on the page, and no --selector given. This page has nothing a ' +
        'scrolled read can decide; `render:report` already covers it.'
    );
    return findings;
  }

  if (measured.pageScrollRange <= 0 && measured.targets.every((t) => !t.scrollable)) {
    push(
      'warning',
      ScrollFinding.NoScrollRange,
      'Nothing on this page scrolls, so the probe proved nothing. A sticky band on a page shorter ' +
        'than the viewport is indistinguishable from a static one — give it content past the fold ' +
        'before believing this read.'
    );
  }

  for (const t of measured.targets) {
    if (!t.scrollable) {
      push(
        'warning',
        ScrollFinding.NoScrollRange,
        `${t.element} is ${t.position}, and ${t.reason} — nothing here was tested.`
      );
      continue;
    }
    if (t.scrolledBy <= 0) {
      push('warning', ScrollFinding.NoScrollRange, `${t.element}: its container did not move (scroll range ${t.maxScroll}px).`);
      continue;
    }

    // Only an element that *claims* to stay put can fail to. A `--selector`ed
    // `position: relative` box scrolling away with the page is the correct
    // behaviour, and reporting it as a defect would train the reader to ignore
    // the code that matters.
    const claimsToStick = ['sticky', 'fixed'].includes(t.position);

    if (!claimsToStick) {
      // Nothing to judge — the row in the table already says what it did.
    } else if (!t.pinned) {
      const because = t.clippingAncestor
        ? ` Its ancestor ${t.clippingAncestor.element} clips (overflow-y: ${t.clippingAncestor.overflowY}), ` +
          'and a sticky element cannot escape a clipping ancestor.'
        : ' Nothing clips it, so the sticky range is its own parent box — a sticky sticks inside its ' +
          "parent, and once that parent has scrolled past, so has it.";
      push(
        'error',
        ScrollFinding.StickyScrollsAway,
        `${t.element} computes \`position: ${t.position}\` and does not stick: the container scrolled ` +
          `${t.scrolledBy}px and its top moved ${t.drift}px with it.${because}`
      );
    } else {
      // Against *either* edge is a deliberate shape — a top nav or a bottom bar.
      // Only something floating between the two is worth a second look.
      const slack = measured.viewportHeight * EDGE_SLACK_FRACTION;
      const fromTop = t.pinnedAt;
      const fromBottom = measured.viewportHeight - (t.pinnedAt + t.rect.whenScrolled.height);
      if (fromTop > slack && fromBottom > slack) {
        push(
          'warning',
          ScrollFinding.StickyPinsAwayFromEdge,
          `${t.element} pins ${fromTop}px from the top and ${fromBottom}px from the bottom of the ` +
            `viewport (computed top: ${t.inset.top}) — against neither edge. If an edge was intended, ` +
            'the cause is `alignY`: it is what writes the inset, and there is no top/left port to ' +
            'override it with.'
        );
      }
    }

    if (t.occlusion.covered) {
      const by = t.occlusion.blockers.map((b) => `${b.at}: ${b.by}`).join('; ');
      push(
        'error',
        ScrollFinding.StickyOccluded,
        `${t.element} is in the right place and something paints over it (z-index: ${t.zIndex}). ` +
          `elementFromPoint returns a node outside it at ${t.occlusion.blockers.length} of 3 sampled ` +
          `points — ${by}.` +
          (claimsToStick ? ' On a sticky band `zIndex` is structural, not styling.' : '')
      );
    }
  }
  return findings;
}

function printHuman(report) {
  console.log(`${report.project}  —  scrolled read`);
  for (const [name, v] of Object.entries(report.viewports)) {
    if (v.error) {
      console.log(`  ${name.padEnd(8)} FAILED: ${v.error}`);
      continue;
    }
    console.log(
      `  ${name.padEnd(8)} ${v.requested.width}×${v.requested.height}, page scroll range ${v.pageScrollRange}px, ` +
        `${v.stickyOrFixedFound} sticky/fixed, ${v.targets.length} probed`
    );
    for (const t of v.targets) {
      if (!t.scrollable) {
        console.log(`      ${t.element} [${t.position}] — not scrollable: ${t.reason}`);
        continue;
      }
      const verdict = t.pinned
        ? `PINNED at ${t.pinnedAt}px${t.travelBeforePinning ? ` (after ${t.travelBeforePinning}px of travel)` : ''}`
        : `SCROLLS AWAY (drift ${t.drift} of ${t.scrolledBy})`;
      const cover = t.occlusion.covered ? `, OCCLUDED at ${t.occlusion.blockers.length}/3 points` : '';
      console.log(
        `      ${t.element} [${t.position}, z ${t.zIndex}] scrolled ${t.scrolledBy}px → ${verdict}${cover}`
      );
    }
  }
  for (const f of report.findings) console.log(`  [${f.severity}] ${f.viewport}: ${f.code} — ${f.message}`);
}

async function main() {
  if (!projectDir) {
    console.error('usage: scroll-probe.js <project-dir> [--selector css] [--viewports desktop,phone] [--scroll n] [--json]');
    process.exit(2);
  }

  const selectors = allFlags('--selector');
  const scrollTo = flag('--scroll') === undefined ? null : Number(flag('--scroll'));
  const viewports = parseViewports(flag('--viewports'));

  const report = await withRenderedPage({ projectDir }, async (page) => {
    const viewportReports = {};
    const findings = [];
    for (const vp of viewports) {
      await page.setViewport(vp);
      const expression = `(${probeInPage.toString()})(${JSON.stringify(selectors)}, ${JSON.stringify(scrollTo)}, ${DRIFT_SLACK})`;
      try {
        const measured = await page.evaluate(expression);
        viewportReports[vp.name] = { requested: { width: vp.width, height: vp.height }, ...measured };
        findings.push(...findingsFor(vp.name, measured));
      } catch (e) {
        viewportReports[vp.name] = { requested: { width: vp.width, height: vp.height }, error: e.message };
      }
    }
    return { project: projectDir, viewports: viewportReports, findings };
  });

  if (asJson) console.log(JSON.stringify(report, null, 2));
  else printHuman(report);

  // Exit 0 whatever the findings, for the same reason `measure-from-disk.js`
  // does: the report is the verdict, and a non-zero exit would make every
  // driving harness read "this page has a defect" as "the tool broke".
}

main().catch((e) => {
  if (asJson) {
    console.log(JSON.stringify({ error: { actionable: Boolean(e.actionable), message: e.message, problems: e.problems ?? [e.message] } }, null, 2));
  } else if (e.actionable) {
    console.error('Cannot probe:');
    for (const problem of e.problems) console.error(`  - ${problem}`);
  } else {
    console.error('SCROLL PROBE FAILED:', e.message);
  }
  process.exit(1);
});
