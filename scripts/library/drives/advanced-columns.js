#!/usr/bin/env node
/**
 * Does it actually fold — and does the States node's number reach the gap?
 *
 * Two things here are deliberate. The widths are walked **down and then back
 * up**, because a band that latches looks identical to one that works until
 * you widen the window again. And the gap is measured as the distance between
 * two rendered tiles rather than read off a style: a bare number over a wire
 * into `Horizontal Gap` is the port FLD-004 is about, and `16` arriving as
 * `16%` — or as `0` — is invisible in the graph and obvious on the page.
 *
 * Run: node scripts/library/drives/advanced-columns.js
 */
const path = require('path');
const { buildDriveProject, makeReporter, REPO_ROOT } = require('./harness');
const { withRenderedPage } = require(path.join(REPO_ROOT, 'scripts/devtools/render-report'));

/** Every tile, in document order, with the geometry the layout gave it. */
const READ = `JSON.stringify((() => {
  const tiles = Array.from(document.querySelectorAll('*'))
    .filter((e) => /^Item \\d$/.test(e.textContent.trim()) && e.children.length === 0)
    .map((e) => e.parentElement.getBoundingClientRect())
    .map((r) => ({ left: Math.round(r.left), width: Math.round(r.width), top: Math.round(r.top) }));
  const band = (document.querySelector('[data-band]') || {}).textContent;
  const rows = new Set(tiles.map((t) => t.top));
  return {
    count: tiles.length,
    perRow: tiles.filter((t) => t.top === tiles[0].top).length,
    rows: rows.size,
    widths: tiles.map((t) => t.width),
    gap: tiles.length > 1 && tiles[1].top === tiles[0].top
      ? tiles[1].left - (tiles[0].left + tiles[0].width)
      : null,
    band
  };
})())`;

/** Six tiles, dropped into the prefab the way a user drops their own content in. */
const tiles = [];
for (let i = 0; i < 6; i++) {
  tiles.push({
    id: `tile-${i}`,
    type: 'Group',
    parent: 'subject',
    parameters: {
      sizeMode: 'contentHeight',
      width: { value: 100, unit: '%' },
      backgroundColor: 'var(--surface)',
      paddingTop: 'var(--space-6)',
      paddingBottom: 'var(--space-6)'
    }
  });
  tiles.push({
    id: `label-${i}`,
    type: 'Text',
    parent: `tile-${i}`,
    parameters: { text: `Item ${i + 1}`, color: 'var(--foreground)' }
  });
}

/** The same six tiles and band readout, with whatever the instance sets. */
const driveSpec = (subjectParameters) => ({
  subjectParameters,
  nodes: [
      ...tiles,
    // The band the prefab reports, printed on the page so the drive reads the
    // component's own answer rather than re-deriving it from the geometry.
    { id: 'band', type: 'Text', onPage: true, parameters: { text: '—', cssClassName: 'band' } }
  ],
  connections: [{ sourceId: 'subject', sourcePort: 'Breakpoint', targetId: 'band', targetPort: 'text' }]
});

(async () => {
  const r = makeReporter();

  await withRenderedPage({ projectDir: buildDriveProject('advanced-columns', driveSpec({})) }, async (s) => {
    const settle = () => new Promise((res) => setTimeout(res, 400));
    const at = async (width) => {
      await s.setViewport({ width, height: 900 });
      await settle();
      const out = JSON.parse(await s.evaluate(READ));
      out.band = await s.evaluate(`(document.querySelector('.band') || {}).textContent`);
      console.log(`  ${String(width).padStart(5)}px  ${JSON.stringify(out)}`);
      return out;
    };

    const wide = await at(1280);
    const large = await at(1000);
    const medium = await at(800);
    const small = await at(500);
    const backUp = await at(1280);

    const even = (o) => o.widths.length > 0 && new Set(o.widths).size === 1;

    r.check('Six tiles reach the prefab through Component Children', wide.count === 6, `${wide.count} tiles`);
    r.check('1280px — four across', wide.perRow === 4, `${wide.perRow} per row, ${wide.rows} rows`);
    r.check('1000px — three across', large.perRow === 3, `${large.perRow} per row`);
    r.check('800px — two across', medium.perRow === 2, `${medium.perRow} per row`);
    r.check('500px — one across', small.perRow === 1, `${small.perRow} per row, ${small.rows} rows`);
    r.check('Widening goes back — no latched band', backUp.perRow === 4, `${backUp.perRow} per row`);

    r.check('Columns are equal at every band', [wide, large, medium, backUp].every(even),
      [wide, large, medium].map((o) => o.widths.join('/')).join('  '));

    // The numeric half: the States node publishes a bare number into a units
    // port. 24 / 20 / 16 are what the four bands carry.
    r.check('1280px — the States node drove the gap to 24px', wide.gap === 24, `gap ${wide.gap}`);
    r.check('1000px — and to 20px', large.gap === 20, `gap ${large.gap}`);
    r.check('800px — and to 16px', medium.gap === 16, `gap ${medium.gap}`);

    r.check('The prefab reports its own band', backUp.band === 'Default' && medium.band === 'Medium',
      `${wide.band} / ${large.band} / ${medium.band} / ${small.band}`);

    // A second instance, one threshold moved on the instance itself — no editing inside the
    // component. The control is the run above: 1050px is Large with the shipped defaults.
    // ⚠️ It is a second project on purpose. A component input carries no default, so the
    // interesting arm is the pair — an input nobody sets must leave the Expression's own
    // parameter standing (that is the run above, which has these three ports wired and unset),
    // and an input somebody sets must win (this one).
    await withRenderedPage(
      { projectDir: buildDriveProject('advanced-columns', driveSpec({ 'Medium Below': 1100 })) },
      async (s2) => {
        await s2.setViewport({ width: 1050, height: 900 });
        await new Promise((res) => setTimeout(res, 400));
        const band = await s2.evaluate(`(document.querySelector('.band') || {}).textContent`);
        console.log(`  1050px with Medium Below = 1100 on the instance: band=${band}\n`);
        r.check('A threshold set on the INSTANCE wins over the shipped default',
          band === 'Medium' && large.band === 'Large', `${band} here, ${large.band} at 1050 by default`);
      }
    );

    r.finish(s);
  });
})().catch((e) => {
  console.error(e.stack || e);
  process.exit(2);
});
