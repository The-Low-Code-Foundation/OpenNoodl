#!/usr/bin/env node
/**
 * Does Next advance exactly one step, and does Finish fire only at the end?
 *
 * The failure this is written against is specific: `Advance` reads the Counter
 * it increments, so with *Run on value change* left ticked it re-runs on its
 * own effect and **one click walks the stepper to the last step and fires
 * Completed**. The rail fills in, the buttons work, and it looks like a
 * stepper. So this counts steps **per click** rather than checking where it
 * ended up — the end state is identical either way.
 *
 * Run: node scripts/library/drives/stepper.js
 */
const path = require('path');
const { buildDriveProject, makeReporter, REPO_ROOT } = require('./harness');
const { withRenderedPage } = require(path.join(REPO_ROOT, 'scripts/devtools/render-report'));

const READ = `JSON.stringify({
  progress: (Array.from(document.querySelectorAll('*'))
    .map((e) => (e.childNodes.length === 1 && e.firstChild.nodeType === 3 ? e.textContent.trim() : ''))
    .find((t) => /^Step \\d+ of/.test(t)) || ''),
  completed: (Array.from(document.querySelectorAll('*'))
    .map((e) => (e.childNodes.length === 1 && e.firstChild.nodeType === 3 ? e.textContent.trim() : ''))
    .find((t) => /^completed=/.test(t)) || ''),
  ticks: document.querySelectorAll('[class*="icon-check"]').length,
  nextLabel: String((Array.from(document.querySelectorAll('button')).slice(-1)[0] || {}).textContent || '').trim()
})`;

(async () => {
  const dir = buildDriveProject('stepper', {
    nodes: [
      { id: 'doneText', type: 'Text', parameters: { text: 'completed=0' }, onPage: true },
      { id: 'doneCounter', type: 'Counter', parameters: { startValue: 0 } },
      { id: 'fmt', type: 'String Format', parameters: { format: 'completed={n}' } }
    ],
    connections: [
      { sourceId: 'subject', sourcePort: 'Completed', targetId: 'doneCounter', targetPort: 'increase' },
      { sourceId: 'doneCounter', sourcePort: 'currentCount', targetId: 'fmt', targetPort: 'n' },
      { sourceId: 'fmt', sourcePort: 'formatted', targetId: 'doneText', targetPort: 'text' }
    ]
  });

  const r = makeReporter();
  await withRenderedPage({ projectDir: dir }, async (s) => {
    await s.setViewport({ width: 1280, height: 900 });
    const read = async () => JSON.parse(await s.evaluate(READ));
    const click = (label) =>
      s.evaluate(`(() => {
        const b = Array.from(document.querySelectorAll('button')).find((x) => x.textContent.trim() === ${JSON.stringify(label)});
        if (!b) return 'no ' + ${JSON.stringify(label)};
        b.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        return 'ok';
      })()`);
    const settle = () => new Promise((res) => setTimeout(res, 200));

    const seq = [await read()];
    for (let i = 0; i < 3; i++) {
      // eslint-disable-next-line no-await-in-loop
      await click('Next'); await settle();
      // eslint-disable-next-line no-await-in-loop
      seq.push(await read());
    }
    await click('Finish'); await settle();
    const done = await read();
    await click('Back'); await settle();
    const back = await read();

    const step = (row) => Number((row.progress.match(/^Step (\d+)/) || [0, 0])[1]);
    console.log(`  progress   ${seq.map(step).join(' -> ')} (one per Next)`);
    console.log(`  at the end ${JSON.stringify(done)}`);
    console.log(`  after Back ${JSON.stringify(back.progress)}\n`);

    r.check('Starts at step 1', step(seq[0]) === 1, seq[0].progress);
    r.check('Next advances exactly ONE step', step(seq[1]) === 2 && step(seq[2]) === 3 && step(seq[3]) === 4, seq.map(step).join(' -> '));
    r.check('Steps behind collapse to a tick', seq[3].ticks === 3, `${seq[3].ticks} ticks on step 4`);
    r.check('Last step offers Finish', seq[3].nextLabel === 'Finish', seq[3].nextLabel);
    r.check('Completed fires once, at the end', done.completed === 'completed=1', done.completed);
    r.check('Back goes back one', step(back) === 3, back.progress);
    r.finish(s);
  });
})().catch((e) => {
  console.error(e.stack || e);
  process.exit(2);
});
