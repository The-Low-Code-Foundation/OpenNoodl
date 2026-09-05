#!/usr/bin/env node
/**
 * Does the Search Bar's debounce actually debounce?
 *
 * The failure this is written against emits `Changed` once per keystroke while
 * looking, in the graph and on screen, exactly like a working debounce — so the
 * assertion is **signals per keystroke**, not the value at the end. The value at
 * the end was right the whole time.
 *
 * Run: node scripts/library/drives/search-bar.js
 */
const path = require('path');
const { buildDriveProject, makeReporter, REPO_ROOT } = require('./harness');
const { withRenderedPage } = require(path.join(REPO_ROOT, 'scripts/devtools/render-report'));

const READ = `JSON.stringify({
  texts: Array.from(document.querySelectorAll('*'))
    .map((e) => (e.childNodes.length === 1 && e.firstChild.nodeType === 3 ? e.textContent.trim() : ''))
    .filter((t) => /^(query=|changed=|\\d+ result)/.test(t)),
  buttons: document.querySelectorAll('button').length,
  inputValue: (document.querySelector('input') || {}).value
})`;

(async () => {
  const dir = buildDriveProject('search-bar', {
    subjectParameters: { Debounce: 250, 'Result Count': 7 },
    nodes: [
      { id: 'queryText', type: 'Text', parameters: { text: 'query=' }, onPage: true },
      { id: 'countText', type: 'Text', parameters: { text: 'changed=0' }, onPage: true },
      { id: 'counter', type: 'Counter', parameters: { startValue: 0 } },
      { id: 'fmtQ', type: 'String Format', parameters: { format: 'query={q}' } },
      { id: 'fmtC', type: 'String Format', parameters: { format: 'changed={n}' } }
    ],
    connections: [
      { sourceId: 'subject', sourcePort: 'Query', targetId: 'fmtQ', targetPort: 'q' },
      { sourceId: 'fmtQ', sourcePort: 'formatted', targetId: 'queryText', targetPort: 'text' },
      { sourceId: 'subject', sourcePort: 'Changed', targetId: 'counter', targetPort: 'increase' },
      { sourceId: 'counter', sourcePort: 'currentCount', targetId: 'fmtC', targetPort: 'n' },
      { sourceId: 'fmtC', sourcePort: 'formatted', targetId: 'countText', targetPort: 'text' }
    ]
  });

  const r = makeReporter();
  await withRenderedPage({ projectDir: dir }, async (s) => {
    await s.setViewport({ width: 1280, height: 900 });
    const read = async () => JSON.parse(await s.evaluate(READ));
    const before = await read();

    await s.evaluate(`(() => {
      const i = document.querySelector('input');
      i.focus();
      const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      window.__type = (c) => { set.call(i, i.value + c); i.dispatchEvent(new Event('input', { bubbles: true })); };
      return 1;
    })()`);
    // Six keystrokes, 40ms apart — comfortably inside the 250ms window.
    for (const ch of 'ledger') {
      // eslint-disable-next-line no-await-in-loop
      await s.evaluate(`window.__type(${JSON.stringify(ch)})`);
      // eslint-disable-next-line no-await-in-loop
      await new Promise((res) => setTimeout(res, 40));
    }
    const mid = await read();
    await new Promise((res) => setTimeout(res, 900));
    const after = await read();

    const val = (rows, prefix) => (rows.texts.find((t) => t.startsWith(prefix)) || prefix).slice(prefix.length);
    console.log(`  at rest  ${JSON.stringify(before.texts)}`);
    console.log(`  typing   ${JSON.stringify(mid.texts)}`);
    console.log(`  settled  ${JSON.stringify(after.texts)}\n`);

    r.check('Query publishes the typed text', val(after, 'query=') === 'ledger', val(after, 'query='));
    r.check('Held through every keystroke', val(mid, 'query=') === '', `mid-typing query="${val(mid, 'query=')}"`);
    r.check('Changed fires ONCE for 6 keys', val(after, 'changed=') === '1', `fired ${val(after, 'changed=')}x`);
    r.check('Says nothing before anyone typed', val(before, 'changed=') === '0', `boot fired ${val(before, 'changed=')}x`);
    r.check('Clear button appears with text', after.buttons > before.buttons, `${before.buttons} -> ${after.buttons}`);
    r.check('Result count appears', after.texts.some((t) => /result/.test(t)));
    r.finish(s);
  });
})().catch((e) => {
  console.error(e.stack || e);
  process.exit(2);
});
