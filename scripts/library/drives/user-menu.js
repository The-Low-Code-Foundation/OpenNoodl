#!/usr/bin/env node
/**
 * Does the user menu open on ONE click — every time, including after it was
 * closed by clicking somewhere else?
 *
 * This entry has **three ways to close and one to open** (the scrim, an item,
 * and Sign out all close it; only the trigger opens it), which is exactly the
 * shape a parity counter gets wrong: after an outside-click close the count
 * still reads "open", so the next press of the trigger is swallowed and the
 * menu appears dead until you click it twice. That bug looks perfect in the
 * graph and perfect at rest, so step 4 below — open, close via the scrim, then
 * open again on the FIRST press — is the reason this file exists.
 *
 * The scrim deliberately covers the trigger while the menu is open, so the
 * click helper reports what it actually hit rather than assuming: a click that
 * lands on the scrim when we meant the trigger is a real finding, not noise.
 *
 * Run: node scripts/library/drives/user-menu.js
 */
const path = require('path');
const { buildDriveProject, makeReporter, REPO_ROOT } = require('./harness');
const { withRenderedPage } = require(path.join(REPO_ROOT, 'scripts/devtools/render-report'));

const ITEMS = ['Your profile', 'Account settings', 'Billing', 'Notifications'];

const READ = `JSON.stringify({
  items: Array.from(document.querySelectorAll('*'))
    .filter((e) => e.childNodes.length === 1 && e.firstChild.nodeType === 3 &&
      ${JSON.stringify(ITEMS)}.includes(e.textContent.trim()))
    .map((e) => e.textContent.trim()),
  signOut: Array.from(document.querySelectorAll('*'))
    .some((e) => e.childNodes.length === 1 && e.firstChild.nodeType === 3 &&
      /^sign out$/i.test(e.textContent.trim())),
  chevrons: Array.from(document.querySelectorAll('[class*="icon-chevron"]'))
    .map((e) => (e.className.match(/icon-chevron-\\w+/) || [''])[0]),
  probes: Array.from(document.querySelectorAll('*'))
    .map((e) => (e.childNodes.length === 1 && e.firstChild.nodeType === 3 ? e.textContent.trim() : ''))
    .filter((t) => /^(items=|signout=|label=)/.test(t)),
  glyphNames: Array.from(document.querySelectorAll('*'))
    .filter((e) => e.childNodes.length === 1 && e.firstChild.nodeType === 3 &&
      /^(chevron-down|chevron-up|log-out|credit-card|bell|user|settings)$/.test(e.textContent.trim()))
    .map((e) => e.textContent.trim())
})`;

(async () => {
  const dir = buildDriveProject('user-menu', {
    nodes: [
      { id: 'itemsText', type: 'Text', parameters: { text: 'items=0' }, onPage: true },
      { id: 'signOutText', type: 'Text', parameters: { text: 'signout=0' }, onPage: true },
      { id: 'labelText', type: 'Text', parameters: { text: 'label=' }, onPage: true },
      { id: 'itemCounter', type: 'Counter', parameters: { startValue: 0 } },
      { id: 'signOutCounter', type: 'Counter', parameters: { startValue: 0 } },
      { id: 'fmtItems', type: 'String Format', parameters: { format: 'items={n}' } },
      { id: 'fmtSignOut', type: 'String Format', parameters: { format: 'signout={n}' } },
      { id: 'fmtLabel', type: 'String Format', parameters: { format: 'label={v}' } }
    ],
    connections: [
      { sourceId: 'subject', sourcePort: 'Item Clicked', targetId: 'itemCounter', targetPort: 'increase' },
      { sourceId: 'itemCounter', sourcePort: 'currentCount', targetId: 'fmtItems', targetPort: 'n' },
      { sourceId: 'fmtItems', sourcePort: 'formatted', targetId: 'itemsText', targetPort: 'text' },
      { sourceId: 'subject', sourcePort: 'Sign Out', targetId: 'signOutCounter', targetPort: 'increase' },
      { sourceId: 'signOutCounter', sourcePort: 'currentCount', targetId: 'fmtSignOut', targetPort: 'n' },
      { sourceId: 'fmtSignOut', sourcePort: 'formatted', targetId: 'signOutText', targetPort: 'text' },
      { sourceId: 'subject', sourcePort: 'Clicked Label', targetId: 'fmtLabel', targetPort: 'v' },
      { sourceId: 'fmtLabel', sourcePort: 'formatted', targetId: 'labelText', targetPort: 'text' }
    ]
  });

  const r = makeReporter();

  await withRenderedPage({ projectDir: dir }, async (s) => {
    await s.setViewport({ width: 1280, height: 900 });
    const read = async () => JSON.parse(await s.evaluate(READ));
    const settle = () => new Promise((res) => setTimeout(res, 250));

    // The trigger is the pointer-cursor element carrying the avatar image. We
    // click through elementFromPoint and report what was actually hit — while
    // the menu is open the scrim covers this same point by design.
    const clickTrigger = () =>
      s.evaluate(`(() => {
        const el = Array.from(document.querySelectorAll('*')).find((e) =>
          getComputedStyle(e).cursor === 'pointer' && e.querySelector('img'));
        if (!el) return 'no-trigger';
        const b = el.getBoundingClientRect();
        const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
        if (!hit) return 'no-hit';
        hit.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        return el.contains(hit) ? 'trigger' : 'intercepted';
      })()`);

    const clickAway = () =>
      s.evaluate(`(() => {
        const hit = document.elementFromPoint(1000, 700);
        if (!hit) return 'nothing-there';
        hit.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        return 'hit:' + hit.tagName;
      })()`);

    const clickText = (label) =>
      s.evaluate(`(() => {
        const el = Array.from(document.querySelectorAll('*')).find((e) =>
          e.childNodes.length === 1 && e.firstChild.nodeType === 3 &&
          e.textContent.trim().toLowerCase() === ${JSON.stringify(String(label).toLowerCase())});
        if (!el) return 'no-text';
        const b = el.getBoundingClientRect();
        const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
        if (!hit) return 'no-hit';
        hit.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        return 'ok';
      })()`);

    const atRest = await read();
    const openedBy = await clickTrigger();
    await settle();
    const opened = await read();

    const awayBy = await clickAway();
    await settle();
    const closed = await read();

    const reopenedBy = await clickTrigger();
    await settle();
    const reopened = await read();

    const itemBy = await clickText('Billing');
    await settle();
    const afterItem = await read();

    await clickTrigger();
    await settle();
    const signOutBy = await clickText('Sign out');
    await settle();
    const afterSignOut = await read();

    console.log(`  at rest        ${JSON.stringify(atRest)}`);
    console.log(`  open (${openedBy})   ${JSON.stringify(opened)}`);
    console.log(`  away (${awayBy})  ${JSON.stringify(closed)}`);
    console.log(`  reopen (${reopenedBy}) ${JSON.stringify(reopened)}`);
    console.log(`  item (${itemBy})     ${JSON.stringify(afterItem)}`);
    console.log(`  signout (${signOutBy})  ${JSON.stringify(afterSignOut)}\n`);

    const probe = (state, prefix) =>
      (state.probes.find((p) => p.startsWith(prefix)) || '').slice(prefix.length);

    r.check('Closed at load — menu is ABSENT, not merely hidden',
      atRest.items.length === 0 && !atRest.signOut,
      `${atRest.items.length} items, signOut=${atRest.signOut}`);
    r.check('The trigger itself takes the first click', openedBy === 'trigger', openedBy);
    r.check('ONE click opens it, with every item and Sign out',
      opened.items.length === ITEMS.length && opened.signOut,
      `${opened.items.length}/${ITEMS.length} items, signOut=${opened.signOut}`);
    r.check('Chevron flips to up while open',
      opened.chevrons.includes('icon-chevron-up'), opened.chevrons.join(',') || 'none');
    r.check('Clicking outside closes it',
      closed.items.length === 0 && !closed.signOut,
      `${closed.items.length} items`);
    // 🔴 The step a parity counter fails: after an outside close the next press
    // of the trigger must open, not be swallowed re-syncing an internal count.
    r.check('Opens again on the FIRST click after an outside close',
      reopened.items.length === ITEMS.length && reopened.signOut,
      `${reopened.items.length} items via ${reopenedBy}`);
    r.check('Clicking an item fires Item Clicked exactly ONCE',
      probe(afterItem, 'items=') === '1', `items=${probe(afterItem, 'items=')}`);
    r.check('...and reports that row’s label',
      probe(afterItem, 'label=') === 'Billing', `label=${probe(afterItem, 'label=')}`);
    r.check('...and closes the menu', afterItem.items.length === 0, `${afterItem.items.length} items`);
    r.check('Sign out fires exactly ONCE',
      probe(afterSignOut, 'signout=') === '1', `signout=${probe(afterSignOut, 'signout=')}`);
    r.check('Sign out does not also count as an item click',
      probe(afterSignOut, 'items=') === '1', `items=${probe(afterSignOut, 'items=')}`);
    // The codeAsClass regression is invisible to every count and shows only as
    // the glyph's own name appearing as words on the page.
    r.check('No icon renders as its own name',
      opened.glyphNames.length === 0, opened.glyphNames.join(',') || 'none');

    r.finish(s);
  });
})().catch((e) => {
  console.error(e.stack || e);
  process.exit(2);
});
