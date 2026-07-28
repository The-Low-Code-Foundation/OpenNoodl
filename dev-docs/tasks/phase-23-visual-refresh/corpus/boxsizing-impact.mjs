/**
 * F20 — the box-sizing impact probe, rebuilt.
 *
 * PNL-001 measured the global `* { box-sizing: border-box }` reset this way and
 * rejected it on the result; the original probe was transient, so this is a
 * restatement of the same method, kept this time because Richard's call
 * (2026-07-28) is to *adopt* the reset, which means the measurement becomes a
 * before/after gate rather than a one-off verdict.
 *
 * Method: walk every element under the editor chrome, record
 * `getBoundingClientRect()`, inject the reset via a <style>, re-record, diff.
 * Anything whose OUTER box moves is a selector whose declared dimension assumes
 * content-box; those are the ones to fix before the reset can be adopted.
 *
 * Every injected style is removed in a `finally` — a leaked `!important` from a
 * crashed run once wedged the editor for a previous agent.
 *
 * Prerequisite — a dev editor on a CDP endpoint WITH A PROJECT OPEN, launched from
 * the primary checkout (`lerna exec` resolves there, not to a worktree).
 *
 * Usage: node dev-docs/tasks/phase-23-visual-refresh/corpus/boxsizing-impact.mjs
 *        [--json out.json]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CDP_URL = process.env.CDP_URL || 'http://localhost:9222';
const JSON_OUT = process.argv.includes('--json')
  ? process.argv[process.argv.indexOf('--json') + 1]
  : path.resolve(__dirname, 'boxsizing-impact.json');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function connect() {
  const list = await (await fetch(`${CDP_URL}/json/list`)).json();
  // Match the editor's own document. Two other windows are also `file:` pages and
  // sort ahead of it — `about-window/about.html` most notably — and attaching to
  // one looks completely normal until `webpackChunknoodl_editor` is undefined.
  const page = list.find((t) => t.type === 'page' && /noodl-editor\/src\/editor\/index\.html/.test(t.url));
  if (!page) throw new Error('no editor CDP page target — is `npm run dev:debug` running with a project open?');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', rej, { once: true });
  });
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id);
      pending.delete(m.id);
      m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
    }
  });
  return {
    send(method, params = {}, timeout = 20000) {
      const i = ++id;
      return new Promise((resolve, reject) => {
        pending.set(i, { resolve, reject });
        ws.send(JSON.stringify({ id: i, method, params }));
        setTimeout(() => {
          if (pending.has(i)) { pending.delete(i); reject(new Error(`CDP timeout: ${method}`)); }
        }, timeout);
      });
    },
    close() { try { ws.close(); } catch {} }
  };
}

async function evalJS(cdp, expression, timeout = 20000) {
  const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, timeout);
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
  return r.result.value;
}

async function clickAt(cdp, x, y, settle = 1200) {
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  for (const type of ['mousePressed', 'mouseReleased']) {
    await cdp.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
  }
  await sleep(settle);
}
const STYLE_ID = '__f20_boxsizing_probe';
const FREEZE_ID = '__f20_freeze';

/**
 * Freeze animation before measuring anything.
 *
 * Without this the report is dominated by `ActivityIndicator`'s loader dots and
 * Clippy's `bounce1/2/3`, which are mid-keyframe when sampled: a dot measured at
 * 0.02px "before" and 6.4px "after" looks like a 6px box-sizing regression and is
 * really two different animation frames. The first run of this probe reported
 * exactly that, and it is pure noise.
 */
const freeze = (cdp) => evalJS(cdp, `(() => {
  let s = document.getElementById(${JSON.stringify(FREEZE_ID)});
  if (!s) { s = document.createElement('style'); s.id = ${JSON.stringify(FREEZE_ID)}; document.head.appendChild(s); }
  s.textContent = '*,*::before,*::after{animation:none!important;transition:none!important}';
  return true;
})()`);

const unfreeze = (cdp) => evalJS(cdp, `(() => {
  const s = document.getElementById(${JSON.stringify(FREEZE_ID)});
  if (s) s.remove();
  return true;
})()`);

const cdp = await connect();

/** Snapshot every visible element's outer box, keyed by a stable-ish path. */
const SNAPSHOT = `(() => {
  const out = [];
  const walk = (el, path) => {
    const r = el.getBoundingClientRect();
    if (r.width > 0 || r.height > 0) {
      const cs = getComputedStyle(el);
      out.push({
        path,
        tag: el.tagName,
        cls: String(el.className || '').slice(0, 70),
        w: Math.round(r.width * 100) / 100,
        h: Math.round(r.height * 100) / 100,
        box: cs.boxSizing
      });
    }
    let i = 0;
    for (const c of el.children) walk(c, path + '/' + c.tagName + '[' + i++ + ']');
  };
  walk(document.body, 'BODY');
  return out;
})()`;

const inject = () => evalJS(cdp, `(() => {
  let s = document.getElementById(${JSON.stringify(STYLE_ID)});
  if (!s) { s = document.createElement('style'); s.id = ${JSON.stringify(STYLE_ID)}; document.head.appendChild(s); }
  s.textContent = '*,*::before,*::after{box-sizing:border-box}';
  return true;
})()`);

const release = () => evalJS(cdp, `(() => {
  const s = document.getElementById(${JSON.stringify(STYLE_ID)});
  if (s) s.remove();
  return true;
})()`);

/**
 * The rail's PANEL buttons.
 *
 * Not simply "every button at x < 70": the topmost one is `SideNavigation`'s
 * BrandExit, and clicking it leaves the project for the launcher — after which
 * every remaining "panel" measurement is really a launcher measurement. The first
 * run of this probe did exactly that and produced a full report about
 * `LauncherProjectCard`. Skip anything above the first panel button, and re-check
 * that a project is still open after each click.
 */
async function railButtons() {
  return evalJS(cdp, `(() => Array.from(document.querySelectorAll('button'))
    .map((b) => ({ b, r: b.getBoundingClientRect() }))
    .filter(({ r }) => r.width > 0 && r.height > 0 && r.x < 70 && r.y > 100 && r.y < 700)
    .sort((a, b) => a.r.y - b.r.y)
    .map(({ r }) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2, y0: r.y })))()`);
}

// See open-project.mjs: __nodeGraphEditor survives exitProject, so it cannot be
// the guard. A visible launcher card means we are on the launcher.
const stillInProject = () => evalJS(cdp, `(() => !document.querySelector('[data-test=launcher-project-card]'))()`);

const report = {};
try {
  await release(); // in case a previous run died mid-flight
  await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] }).catch(() => {});
  await freeze(cdp);
  const rails = await railButtons();
  console.log(`${rails.length} rail buttons\n`);

  if (!(await stillInProject())) throw new Error('no project open — run open-project.mjs first');

  for (let i = 0; i < rails.length; i++) {
    await clickAt(cdp, rails[i].x, rails[i].y, 1200);
    if (!(await stillInProject())) {
      console.log(`  (rail button ${i} at y=${rails[i].y0} left the project — skipping, not a panel button)`);
      break;
    }
    const label = await evalJS(cdp, `(() => {
      const h = document.querySelector('[class*="BasePanel"] [class*="Title"], [class*="PanelHeader"]');
      return (h && h.innerText.trim().split('\\n')[0]) || 'panel-' + ${i};
    })()`);

    await release();
    await sleep(250);
    const before = await evalJS(cdp, SNAPSHOT, 30000);
    await inject();
    await sleep(350);
    const after = await evalJS(cdp, SNAPSHOT, 30000);
    await release();
    await sleep(200);

    const byPath = new Map(after.map((e) => [e.path, e]));
    const changed = [];
    for (const b of before) {
      const a = byPath.get(b.path);
      if (!a) continue;
      const dw = Math.round((a.w - b.w) * 100) / 100;
      const dh = Math.round((a.h - b.h) * 100) / 100;
      if (dw !== 0 || dh !== 0) changed.push({ cls: b.cls, tag: b.tag, dw, dh, was: { w: b.w, h: b.h }, box: b.box });
    }
    // Group by class so the report names selectors, not element instances.
    const groups = {};
    for (const c of changed) {
      const key = `${c.tag}.${c.cls.split(' ')[0]} Δw${c.dw} Δh${c.dh}`;
      groups[key] = (groups[key] || 0) + 1;
    }
    const significant = changed.filter((c) => Math.abs(c.dw) > 1.5 || Math.abs(c.dh) > 1.5);

    report[label] = {
      total: before.length,
      changed: changed.length,
      significant: significant.length,
      significantGroups: Object.entries(
        significant.reduce((acc, c) => {
          const k = `${c.tag}.${c.cls.split(' ')[0]}`;
          acc[k] = acc[k] || { count: 0, dw: c.dw, dh: c.dh, was: c.was };
          acc[k].count++;
          return acc;
        }, {})
      ).sort((a, b) => b[1].count - a[1].count)
    };
    console.log(`${label}: ${changed.length}/${before.length} boxes change, ${significant.length} by more than 1.5px`);
    for (const [sel, info] of report[label].significantGroups) {
      console.log(`    ${sel}  ×${info.count}  Δw${info.dw} Δh${info.dh}  (was ${info.was.w}×${info.was.h})`);
    }
  }
} finally {
  await release().catch(() => {});
  await unfreeze(cdp).catch(() => {});
  await cdp.send('Emulation.setEmulatedMedia', { features: [] }).catch(() => {});
  fs.writeFileSync(JSON_OUT, JSON.stringify(report, null, 2));
  console.log(`\nwrote ${JSON_OUT}`);
  cdp.close();
}
