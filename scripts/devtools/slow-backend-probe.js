/**
 * Force SBR-004 §9.2's race to LOSE, so the two arms differ by the FIX rather than by luck.
 *
 * Delays every backend (8594) request from the viewer by <ms> and leaves the page bundle
 * alone, so `Page.didMount` still fires on its own clock. That is exactly the ordering the
 * defect needs: mount first, `homeSlug` second.
 *
 * usage: node slow-settings.js <delayMs> [label]
 */
const http = require('http');
const path = require('path');
const WebSocket = require(path.join('/Users/richardosborne/vscode_projects/OpenNoodl', 'node_modules', 'ws'));

const DELAY = Number(process.argv[2] || 1200);
const LABEL = process.argv[3] || '';
const PATH = process.argv[4] || '/';
const PORT = 9222;

const httpJson = (p) =>
  new Promise((resolve, reject) => {
    http
      .get({ host: '127.0.0.1', port: PORT, path: p, timeout: 4000 }, (res) => {
        let b = '';
        res.on('data', (d) => (b += d));
        res.on('end', () => { try { resolve(JSON.parse(b)); } catch (e) { reject(e); } });
      })
      .on('error', reject);
  });

function connect(target) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(target.webSocketDebuggerUrl, { maxPayload: 512 * 1024 * 1024 });
    let nextId = 0;
    const pending = new Map();
    const listeners = [];
    ws.on('open', () =>
      resolve({
        send(method, params) {
          const id = ++nextId;
          ws.send(JSON.stringify({ id, method, params }));
          return new Promise((res, rej) => pending.set(id, { res, rej }));
        },
        on: (fn) => listeners.push(fn),
        close: () => ws.close()
      })
    );
    ws.on('error', reject);
    ws.on('message', (data) => {
      const msg = JSON.parse(data);
      if (msg.id && pending.has(msg.id)) {
        const { res, rej } = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? rej(new Error(msg.error.message)) : res(msg.result);
      } else if (msg.method) listeners.forEach((fn) => fn(msg));
    });
  });
}

const PROBE = `(() => { const h1=document.querySelector('h1'); const v=(typeof Noodl!=='undefined'&&Noodl.Variables)?Noodl.Variables:null; return JSON.stringify({url:location.pathname, varKeys: v?Object.keys(v).length:'NO', slug: v?v.siteCurrentSlug:null, h1: h1?h1.innerText:'(no h1)', body:(document.body.innerText||'').replace(/\\s+/g,' ').trim().slice(0,120)}); })()`;

(async () => {
  const list = await httpJson('/json/list');
  const t = list.find((x) => (x.type === 'page' || x.type === 'webview') && x.url.includes('localhost:8594') === false && x.url.includes('localhost:8574'));
  if (!t) throw new Error('no viewer target');
  const c = await connect(t);

  let delayed = 0;
  c.on((msg) => {
    if (msg.method === 'Fetch.requestPaused') {
      delayed++;
      setTimeout(() => c.send('Fetch.continueRequest', { requestId: msg.params.requestId }).catch(() => {}), DELAY);
    }
  });
  await c.send('Fetch.enable', { patterns: [{ urlPattern: '*8594*' }] });
  await c.send('Page.enable');
  await c.send('Page.navigate', { url: 'http://localhost:8574' + PATH });

  await new Promise((r) => setTimeout(r, DELAY + 6000));
  const r = await c.send('Runtime.evaluate', { expression: PROBE, returnByValue: true });
  console.log(`[${LABEL}] path=${PATH} delayMs=${DELAY} delayedRequests=${delayed}`);
  console.log(`[${LABEL}] ${r.result.value}`);

  await c.send('Fetch.disable');
  c.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
