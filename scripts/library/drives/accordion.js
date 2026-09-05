#!/usr/bin/env node
/**
 * Does clicking a header open that section, and only that section?
 *
 * Two things here are deliberate. The click lands in the **middle of the row**,
 * not on the words, because the whole header is meant to be the hit area — and
 * a stepper-shaped accordion where only the text works looks identical at rest.
 * And the sequence is checked click by click: the first version of this prefab
 * needed *two* clicks per header, and after two clicks it looked perfect.
 *
 * Run: node scripts/library/drives/accordion.js
 */
const path = require('path');
const { buildDriveProject, makeReporter, REPO_ROOT } = require('./harness');
const { withRenderedPage } = require(path.join(REPO_ROOT, 'scripts/devtools/render-report'));

const READ = `JSON.stringify({
  bodies: Array.from(document.querySelectorAll('*'))
    .filter((e) => e.childNodes.length === 1 && e.firstChild.nodeType === 3 &&
      /^(A prefab is|Yes, when|Each section owns)/.test(e.textContent.trim()))
    .map((e) => e.textContent.trim().slice(0, 18)),
  chevrons: Array.from(document.querySelectorAll('[class*="icon-chevron"]'))
    .map((e) => (e.className.match(/icon-chevron-\\w+/) || [''])[0])
})`;

(async () => {
  const dir = buildDriveProject('accordion', {});
  const r = makeReporter();

  await withRenderedPage({ projectDir: dir }, async (s) => {
    await s.setViewport({ width: 1280, height: 900 });
    const read = async () => JSON.parse(await s.evaluate(READ));
    // A header is a pointer-cursor element carrying exactly one chevron.
    const click = (i) =>
      s.evaluate(`(() => {
        const heads = Array.from(document.querySelectorAll('*')).filter((e) =>
          getComputedStyle(e).cursor === 'pointer' && e.textContent.trim().length > 5 &&
          e.querySelectorAll('[class*="icon-chevron"]').length === 1);
        const el = heads[${i}];
        if (!el) return 'no header ' + ${i};
        const box = el.getBoundingClientRect();
        const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
        hit.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        return 'ok';
      })()`);
    const settle = () => new Promise((res) => setTimeout(res, 250));

    const closed = await read();
    await click(0); await settle();
    const one = await read();
    await click(1); await settle();
    const two = await read();
    await click(0); await settle();
    const back = await read();

    console.log(`  at rest      ${JSON.stringify(closed)}`);
    console.log(`  after row 0  ${JSON.stringify(one)}`);
    console.log(`  after row 1  ${JSON.stringify(two)}`);
    console.log(`  re-click 0   ${JSON.stringify(back)}\n`);

    r.check('Starts closed', closed.bodies.length === 0, `${closed.bodies.length} bodies`);
    r.check('ONE click on the row opens it', one.bodies.length === 1, `${one.bodies.length} bodies`);
    r.check('Chevron swaps on the open one', one.chevrons.filter((c) => c === 'icon-chevron-down').length === 1, one.chevrons.join(','));
    r.check('Opening one leaves the other open', two.bodies.length === 2, `${two.bodies.length} open`);
    r.check('Clicking again closes it', back.bodies.length === 1 && back.chevrons[0] === 'icon-chevron-right');
    r.finish(s);
  });
})().catch((e) => {
  console.error(e.stack || e);
  process.exit(2);
});
