#!/usr/bin/env node
/**
 * A PERSISTENT headless-Chrome driver for a URL a person could type.
 *
 * Why not the editor's own preview webview: `Emulation.setDeviceMetricsOverride`
 * on it reports success and then `Page.captureScreenshot` returns the OLD
 * surface TILED across the larger frame (SBR-014 s46). Every number reads
 * correct and the picture is an artefact. So this drives a plain Chrome on its
 * own CDP port with its own profile, which resizes for real.
 *
 * Session state lives in a JSON file so a sequence of shell calls shares ONE
 * browser — a signed-in session survives between verbs.
 *
 * Traps designed in (each one cost a run):
 *  - `<title>` matches every text query and has ZERO area. It won a
 *    "smallest element" tie-break and then reported itself unreachable.
 *    Every text query is filtered to rendered elements inside `body`.
 *  - A SUBSTRING matcher clicked `Published` when asked for `Publish` — the
 *    status label, not the action button — and reported a successful,
 *    reachable click on the wrong element. `click` matches text EXACTLY;
 *    `clickish` is the opt-in substring form and says what it matched.
 *  - Every click is checked with `elementFromPoint` first: a rendered surface
 *    is not a reachable one.
 *  - Inputs are addressed by DOM ORDER, never by id: the site-builder viewer
 *    mints a fresh `input-<uuid>` on every re-render, so an id read before a
 *    section exists is stale by the time it does.
 *
 * Usage:
 *   drive-page.js start   <url> [--width N] [--height N] [--profile NAME]
 *   drive-page.js goto    <url>
 *   drive-page.js look    [selector]        # visible text
 *   drive-page.js dom     <selector>        # tag/text/rect/reachable per match
 *   drive-page.js click   <exact text> [--nth N]
 *   drive-page.js clickish <substring>      # reports what it matched
 *   drive-page.js clickat <x> <y>
 *   drive-page.js fill    <nth> <value>     # nth VISIBLE input/textarea, 0-based
 *   drive-page.js eval    <expression>
 *   drive-page.js shot    <file>            # full-page
 *   drive-page.js requests                  # captured requests since last call
 *   drive-page.js errors                    # console errors + page exceptions
 *   drive-page.js stop
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const WebSocket = require('ws');

const STATE = process.env.DRIVE_STATE || path.join(os.tmpdir(), 'nodegx-drive-state.json');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function httpJson(port, p) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path: p, timeout: 2000 }, (res) => {
      let b = '';
      res.on('data', (d) => (b += d));
      res.on('end', () => {
        try {
          resolve(JSON.parse(b));
        } catch (e) {
          reject(new Error('bad json: ' + b.slice(0, 120)));
        }
      });
    });
    req.on('timeout', () => (req.destroy(), reject(new Error('timeout'))));
    req.on('error', reject);
  });
}

/** A CDP client that keeps the captured event log this run needs. */
async function attach(wsUrl) {
  const ws = new WebSocket(wsUrl, { perMessageDeflate: false, maxPayload: 512 * 1024 * 1024 });
  await new Promise((res, rej) => (ws.once('open', res), ws.once('error', rej)));
  let id = 0;
  const pending = new Map();
  const events = { errors: [], requests: [] };
  ws.on('message', (raw) => {
    const msg = JSON.parse(raw);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
      return;
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails || {};
      events.errors.push(String((d.exception && d.exception.description) || d.text || '').slice(0, 300));
    } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      events.errors.push(
        msg.params.args.map((a) => String(a.value !== undefined ? a.value : a.description || '')).join(' ').slice(0, 300)
      );
    } else if (msg.method === 'Network.requestWillBeSent') {
      events.requests.push({
        method: msg.params.request.method,
        url: msg.params.request.url,
        body: (msg.params.request.postData || '').slice(0, 400)
      });
    }
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const myId = ++id;
      pending.set(myId, { resolve, reject });
      ws.send(JSON.stringify({ id: myId, method, params }));
      setTimeout(() => pending.has(myId) && (pending.delete(myId), reject(new Error(method + ' timed out'))), 30000);
    });
  return { ws, send, events };
}

/**
 * 🔴 Every eval is wrapped in an IIFE and returned by value. A bare expression
 * spanning statements throws, and an object returned by handle reads as `{}`.
 */
async function ev(client, expression) {
  const r = await client.send('Runtime.evaluate', {
    expression: `(() => { ${expression} })()`,
    returnByValue: true,
    awaitPromise: true
  });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + JSON.stringify(r.exceptionDetails.exception || {}));
  return r.result.value;
}

/**
 * The shared element census, run inside the page.
 *
 * `body` scoped and area-filtered, because `<title>` is a text node match with
 * zero area that otherwise wins any "smallest match" tie-break, and then
 * reports itself unreachable — a finding about the query, not the page.
 */
const CENSUS = `
  const vis = (e) => {
    const r = e.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return null;
    const s = getComputedStyle(e);
    if (s.visibility === 'hidden' || s.display === 'none' || s.opacity === '0') return null;
    return r;
  };
  const all = [...document.body.querySelectorAll('*')];
`;

async function findByText(client, text, exact, nth) {
  return ev(
    client,
    `${CENSUS}
    const want = ${JSON.stringify(text)};
    const hits = [];
    for (const e of all) {
      const r = vis(e); if (!r) continue;
      const own = [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
      const t = (e.innerText || '').trim();
      const match = ${exact} ? (own === want || t === want) : t.includes(want);
      if (!match) continue;
      // Prefer the DEEPEST match: an ancestor's innerText contains its child's.
      if (e.querySelector('*') && [...e.querySelectorAll('*')].some(c => { const cr = vis(c); if (!cr) return false;
        const ct = (c.innerText||'').trim(); const co = [...c.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim();
        return ${exact} ? (co === want || ct === want) : ct.includes(want); })) continue;
      const x = r.left + r.width/2, y = r.top + r.height/2;
      const at = document.elementFromPoint(x, y);
      const act = !!(e.closest('button,a,[role=button],[tabindex]') || e.tagName === 'BUTTON' || e.tagName === 'A' || e.onclick);
      hits.push({ tag: e.tagName, actionable: act, text: t.slice(0,80), x: Math.round(x), y: Math.round(y),
                  w: Math.round(r.width), h: Math.round(r.height),
                  reachable: !!at && (at === e || e.contains(at) || at.contains(e)),
                  blockedBy: at && !(at === e || e.contains(at) || at.contains(e)) ? at.tagName + '.' + (at.className||'').toString().slice(0,40) : null });
    }
    return hits;`
  ).then((hits) => ({ hits, chosen: hits[nth || 0] || null }));
}

async function loadState() {
  if (!fs.existsSync(STATE)) throw new Error('no session — run `drive-page.js start <url>` first');
  return JSON.parse(fs.readFileSync(STATE, 'utf8'));
}

async function connectExisting() {
  const st = await loadState();
  const targets = await httpJson(st.cdpPort, '/json/list');
  const page = targets.find((t) => t.type === 'page');
  if (!page) throw new Error('the browser has no page target');
  const client = await attach(page.webSocketDebuggerUrl);
  await client.send('Runtime.enable', {});
  await client.send('Network.enable', {});
  await client.send('Page.enable', {});
  return { st, client };
}

async function main() {
  const [verb, ...rest] = process.argv.slice(2);
  const flag = (n, d) => {
    const i = process.argv.indexOf(n);
    return i === -1 ? d : process.argv[i + 1];
  };

  if (verb === 'start') {
    const url = rest[0];
    const width = Number(flag('--width', 1440));
    const height = Number(flag('--height', 900));
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-drive-' + (flag('--profile', 'p')) + '-'));
    const cdpPort = 9400 + Math.floor(Math.random() * 400);
    const proc = spawn(
      CHROME,
      [
        '--headless=new',
        `--remote-debugging-port=${cdpPort}`,
        `--user-data-dir=${profile}`,
        `--window-size=${width},${height}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--hide-scrollbars',
        '--disable-gpu',
        url || 'about:blank'
      ],
      { stdio: 'ignore', detached: true }
    );
    proc.unref();
    let target = null;
    for (let i = 0; i < 60 && !target; i++) {
      await wait(250);
      try {
        target = (await httpJson(cdpPort, '/json/list')).find((t) => t.type === 'page');
      } catch {
        /* not up */
      }
    }
    if (!target) throw new Error('Chrome never opened a page target');
    fs.writeFileSync(STATE, JSON.stringify({ cdpPort, profile, pid: proc.pid, width, height, url }, null, 2));
    await wait(3000);
    console.log(JSON.stringify({ started: true, cdpPort, profile, pid: proc.pid, url }));
    return;
  }

  if (verb === 'stop') {
    const st = await loadState();
    try {
      process.kill(st.pid, 'SIGKILL');
    } catch {
      /* already gone */
    }
    fs.rmSync(st.profile, { recursive: true, force: true });
    fs.unlinkSync(STATE);
    console.log(JSON.stringify({ stopped: true }));
    return;
  }

  const { st, client } = await connectExisting();
  const done = (o) => (console.log(JSON.stringify(o, null, 2)), client.ws.close(), process.exit(0));

  switch (verb) {
    case 'goto': {
      await client.send('Page.navigate', { url: rest[0] });
      await wait(Number(flag('--settle', 2500)));
      return done({ url: await ev(client, 'return location.href'), title: await ev(client, 'return document.title') });
    }
    case 'look': {
      const sel = rest[0] || 'body';
      const text = await ev(client, `const e = document.querySelector(${JSON.stringify(sel)}); return e ? e.innerText : null;`);
      return done({ url: await ev(client, 'return location.href'), text });
    }
    case 'dom': {
      const out = await ev(
        client,
        `${CENSUS}
        const sel = ${JSON.stringify(rest[0])};
        return [...document.body.querySelectorAll(sel)].map(e => {
          const r = vis(e);
          if (!r) return { tag: e.tagName, hidden: true };
          const x = r.left + r.width/2, y = r.top + r.height/2;
          const at = document.elementFromPoint(x, y);
          return { tag: e.tagName, type: e.type||null, value: e.value!==undefined?String(e.value).slice(0,80):null,
                   text: (e.innerText||'').trim().slice(0,80), x: Math.round(x), y: Math.round(y),
                   w: Math.round(r.width), h: Math.round(r.height),
                   reachable: !!at && (at===e||e.contains(at)||at.contains(e)) };
        });`
      );
      return done(out);
    }
    case 'click':
    case 'clickish': {
      const exact = verb === 'click';
      const nth = Number(flag('--nth', 0));
      let { hits } = await findByText(client, rest[0], exact, nth);
      // 🔴 `Sign in` matched the HEADING and the BUTTON, and the heading came
      // first. The click reported reachable, successful, and did nothing —
      // the same family as `Published` winning a query for `Publish`.
      // `--button` restricts the census to elements that can be pressed.
      if (process.argv.includes('--button')) {
        const actionable = hits.filter((h) => h.actionable);
        if (actionable.length) hits = actionable;
      }
      const chosen = hits[nth] || null;
      if (!chosen) return done({ clicked: false, why: 'no visible match', matched: hits.length });
      if (!chosen.reachable) return done({ clicked: false, why: 'not reachable', chosen, matched: hits.length });
      // Modal renders twice and a first click can land on the measuring ghost.
      for (const type of ['mousePressed', 'mouseReleased']) {
        await client.send('Input.dispatchMouseEvent', { type, x: chosen.x, y: chosen.y, button: 'left', clickCount: 1 });
      }
      await wait(Number(flag('--settle', 1500)));
      return done({ clicked: true, chosen, matched: hits.length, allMatches: hits.map((h) => h.text),
                    requests: client.events.requests, errors: client.events.errors });
    }
    case 'clickat': {
      const x = Number(rest[0]);
      const y = Number(rest[1]);
      const at = await ev(client, `const e = document.elementFromPoint(${x},${y}); return e ? e.tagName + '|' + (e.innerText||'').trim().slice(0,60) : null;`);
      for (const type of ['mousePressed', 'mouseReleased']) {
        await client.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
      }
      await wait(Number(flag('--settle', 1500)));
      return done({ clicked: true, at, requests: client.events.requests, errors: client.events.errors });
    }
    case 'fill': {
      // 🔴 Addressed by DOM ORDER. The viewer mints a fresh `input-<uuid>` on
      // every re-render, so an id is stale the moment the list changes.
      const nth = Number(rest[0]);
      const value = rest.slice(1).join(' ');
      const pos = await ev(
        client,
        `${CENSUS}
        const fields = [...document.body.querySelectorAll('input,textarea')].filter(vis);
        const e = fields[${nth}];
        if (!e) return { ok:false, count: fields.length };
        const r = e.getBoundingClientRect();
        return { ok:true, count: fields.length, x: Math.round(r.left+r.width/2), y: Math.round(r.top+r.height/2), was: e.value };`
      );
      if (!pos.ok) return done({ filled: false, why: 'no such visible field', count: pos.count });
      await client.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: pos.x, y: pos.y, button: 'left', clickCount: 3 });
      await client.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: pos.x, y: pos.y, button: 'left', clickCount: 3 });
      await wait(150);
      await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'a', code: 'KeyA', modifiers: 4, windowsVirtualKeyCode: 65 });
      await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'a', code: 'KeyA', modifiers: 4, windowsVirtualKeyCode: 65 });
      await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Delete', code: 'Delete', windowsVirtualKeyCode: 46 });
      await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Delete', code: 'Delete', windowsVirtualKeyCode: 46 });
      await wait(100);
      await client.send('Input.insertText', { text: value });
      await wait(400);
      const now = await ev(
        client,
        `${CENSUS}
        const fields = [...document.body.querySelectorAll('input,textarea')].filter(vis);
        return fields[${nth}] ? fields[${nth}].value : null;`
      );
      return done({ filled: true, was: pos.was, echo: now, count: pos.count });
    }
    case 'resize': {
      // A workaround a PERSON DOES NOT HAVE. Only ever to get past D40 so the
      // thing behind it can be measured — never to report the surface as usable.
      await client.send('Emulation.setDeviceMetricsOverride', {
        width: Number(rest[0]), height: Number(rest[1]), deviceScaleFactor: 1, mobile: false
      });
      await wait(600);
      return done({ resized: [Number(rest[0]), Number(rest[1])], innerHeight: await ev(client, 'return innerHeight') });
    }
    case 'eval':
      return done({ value: await ev(client, rest.join(' ')) });
    case 'shot': {
      const file = rest[0];
      // 🔴 `document.body.scrollHeight` reads 0 on a viewer page: `#root` is
      // `position: fixed` so the body has no content box at all. Taking the
      // page height from it silently crops every full-page shot to one
      // viewport. Measure the tallest scrollHeight in the tree instead.
      const m = await ev(
        client,
        `let h = innerHeight;
         for (const e of [document.body, ...document.body.querySelectorAll('*')]) {
           if (e.scrollHeight > h) h = e.scrollHeight;
         }
         return { w: Math.max(document.body.scrollWidth, innerWidth), h };`
      );
      const full = process.argv.includes('--full');
      if (full) {
        await client.send('Emulation.setDeviceMetricsOverride', { width: st.width, height: Math.min(m.h, 8000), deviceScaleFactor: 1, mobile: false });
        await wait(600);
      }
      const { data } = await client.send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(file, Buffer.from(data, 'base64'));
      if (full) {
        await client.send('Emulation.clearDeviceMetricsOverride', {});
        await wait(300);
      }
      return done({ shot: file, bytes: fs.statSync(file).size, pageHeight: m.h });
    }
    case 'requests': {
      await wait(200);
      return done({ note: 'requests seen by THIS attachment only', requests: client.events.requests });
    }
    case 'errors':
      await wait(200);
      return done({ errors: client.events.errors });
    default:
      throw new Error('unknown verb: ' + verb);
  }
}

main().catch((e) => {
  console.error(e.stack || String(e));
  process.exit(1);
});
