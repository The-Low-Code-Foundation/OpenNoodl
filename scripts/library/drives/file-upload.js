#!/usr/bin/env node
/**
 * Does the upload zone actually move between its states, and come back?
 *
 * Scope is deliberate. `Done` is NOT reachable without a real backend, and a
 * drive that asserted it would either need a network or quietly assert nothing —
 * so this covers the part that is honestly drivable headlessly: **Idle →
 * Picking → back to Idle**. The cancel arm is the one worth owning, because
 * "click the zone, change your mind" is the path that strands a user in a state
 * with no way out, and it looks identical at rest to one that works.
 *
 * The other reason to check Picking specifically: the Browse pill is a Group
 * with `pointer-events: none` rather than a Button, because a Button inside the
 * clickable zone calls `open` twice — the second supersedes the first, the
 * picker reports that as `unchanged`, and `unchanged` sends it straight back to
 * Idle. A regression there shows up here as "clicking the zone does nothing".
 *
 * Run: node scripts/library/drives/file-upload.js
 */
const path = require('path');
const { buildDriveProject, makeReporter, REPO_ROOT } = require('./harness');
const { withRenderedPage } = require(path.join(REPO_ROOT, 'scripts/devtools/render-report'));

// A <style> and a <script> each have exactly one text child, so "one text node"
// alone scoops up the stylesheet and the serialised project. Visible copy only.
const READ = `JSON.stringify({
  texts: Array.from(document.querySelectorAll('*'))
    .filter((e) => !/^(SCRIPT|STYLE|TITLE|HEAD|NOSCRIPT)$/.test(e.tagName) &&
      e.childNodes.length === 1 && e.firstChild.nodeType === 3)
    .map((e) => e.textContent.trim())
    .filter((t) => t && t.length < 120),
  glyphNames: Array.from(document.querySelectorAll('*'))
    .filter((e) => e.childNodes.length === 1 && e.firstChild.nodeType === 3 &&
      /^(cloud-upload|upload|file|check|circle-check|triangle-alert|x)$/.test(e.textContent.trim()))
    .map((e) => e.textContent.trim())
})`;

const has = (state, re) => state.texts.some((t) => re.test(t));

(async () => {
  const dir = buildDriveProject('file-upload', {});
  const r = makeReporter();

  await withRenderedPage({ projectDir: dir }, async (s) => {
    await s.setViewport({ width: 1280, height: 900 });
    const read = async () => JSON.parse(await s.evaluate(READ));
    const settle = () => new Promise((res) => setTimeout(res, 300));

    // Click the drop zone through elementFromPoint — the Browse pill sits inside
    // it with pointer-events: none, so the zone must be what receives this.
    const clickZone = () =>
      s.evaluate(`(() => {
        const el = Array.from(document.querySelectorAll('*')).find((e) =>
          /Drop a file here/i.test(e.textContent) && getComputedStyle(e).cursor === 'pointer');
        if (!el) return 'no-zone';
        const b = el.getBoundingClientRect();
        const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
        if (!hit) return 'no-hit';
        hit.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        return 'ok';
      })()`);

    const clickLabel = (label) =>
      s.evaluate(`(() => {
        const want = ${JSON.stringify(String(label).toLowerCase())};
        const el = Array.from(document.querySelectorAll('*')).find((e) =>
          e.childNodes.length === 1 && e.firstChild.nodeType === 3 &&
          e.textContent.trim().toLowerCase() === want);
        if (!el) return 'no-text';
        const b = el.getBoundingClientRect();
        const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
        if (!hit) return 'no-hit';
        hit.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        return 'ok';
      })()`);

    const idle = await read();
    const zoneBy = await clickZone();
    await settle();
    const picking = await read();
    const cancelBy = await clickLabel('Cancel');
    await settle();
    const back = await read();

    console.log(`  idle           ${JSON.stringify(idle.texts)}`);
    console.log(`  picking (${zoneBy})  ${JSON.stringify(picking.texts)}`);
    console.log(`  cancel (${cancelBy})   ${JSON.stringify(back.texts)}\n`);

    r.check('Shows what it is on placement — the idle drop zone',
      has(idle, /Drop a file here/i), idle.texts.slice(0, 3).join(' | '));
    r.check('States that have not happened are ABSENT at rest',
      !has(idle, /Uploading|Upload complete|Upload failed/i),
      idle.texts.filter((t) => /Upload/i.test(t)).join(',') || 'none');
    r.check('Clicking the zone moves it to Picking',
      has(picking, /Waiting for you to choose|Cancel/i),
      picking.texts.slice(0, 3).join(' | '));
    r.check('...and the idle copy is gone while picking',
      !has(picking, /Drop a file here/i), 'idle text still present');
    r.check('Cancel returns it to Idle — no dead end',
      has(back, /Drop a file here/i), back.texts.slice(0, 3).join(' | '));
    r.check('No icon renders as its own name',
      idle.glyphNames.length === 0, idle.glyphNames.join(',') || 'none');

    r.finish(s);
  });
})().catch((e) => {
  console.error(e.stack || e);
  process.exit(2);
});
