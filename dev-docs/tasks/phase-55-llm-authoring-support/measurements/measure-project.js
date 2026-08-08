#!/usr/bin/env node
/**
 * Phase 55 audit — render a v2 project from disk and MEASURE it, headless.
 *
 * Usage: node measure-project.js <project-dir> [--out prefix]
 *
 * Starts render-from-disk.js on a free port, drives headless Chrome over CDP,
 * measures the DOM at 1280x900 and 390x844 (device emulation — Chrome will not
 * open a real window under ~500px), captures screenshots, prints one JSON
 * report to stdout. Exit 0 always; the report is the verdict.
 */
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const path = require('path');

const REPO = '/Users/richardosborne/vscode_projects/OpenNoodl';
const WebSocket = require(path.join(REPO, 'node_modules', 'ws'));

const PROJECT = process.argv[2];
const outIdx = process.argv.indexOf('--out');
const OUT = outIdx === -1 ? '/tmp/measure' : process.argv[outIdx + 1];
const SERVE_PORT = 8621;
const CDP_PORT = 9231;

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

function httpJson(port, urlPath) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path: urlPath, timeout: 3000 }, (res) => {
      let body = '';
      res.on('data', (d) => (body += d));
      res.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { reject(e); } });
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error', reject);
  });
}

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl, { maxPayload: 512 * 1024 * 1024 });
    let nextId = 0;
    const pending = new Map();
    ws.on('open', () => resolve({
      send(method, params) {
        const id = ++nextId;
        ws.send(JSON.stringify({ id, method, params }));
        return new Promise((res, rej) => pending.set(id, { res, rej }));
      },
      close() { ws.close(); }
    }));
    ws.on('error', reject);
    ws.on('message', (data) => {
      const msg = JSON.parse(data);
      if (msg.id && pending.has(msg.id)) {
        const { res, rej } = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? rej(new Error(msg.error.message)) : res(msg.result);
      }
    });
  });
}

async function evaluate(client, expression) {
  const r = await client.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error((r.exceptionDetails.exception || {}).description || r.exceptionDetails.text);
  return r.result.value;
}

const MEASURE_JS = `(() => {
  const vw = window.innerWidth;
  const all = [...document.querySelectorAll('body *')];
  const visible = all.filter((el) => el.offsetParent !== null || getComputedStyle(el).position === 'fixed');
  const over = visible
    .map((el) => ({ el, w: el.getBoundingClientRect().width }))
    .filter((x) => x.w > vw + 1)
    .map((x) => ({ tag: x.el.tagName, cls: String(x.el.className).slice(0, 60), w: Math.round(x.w) }));
  const textEls = visible.filter((el) => el.children.length === 0 && el.textContent.trim().length > 0);
  const weights = {};
  const sizes = {};
  for (const el of textEls) {
    const cs = getComputedStyle(el);
    weights[cs.fontWeight] = (weights[cs.fontWeight] || 0) + 1;
    sizes[cs.fontSize] = (sizes[cs.fontSize] || 0) + 1;
  }
  const emptyBoxes = visible.filter((el) => {
    const r = el.getBoundingClientRect();
    return el.children.length === 0 && el.textContent.trim() === '' && r.width > 8 && r.height > 8 &&
      (getComputedStyle(el).backgroundColor !== 'rgba(0, 0, 0, 0)' || getComputedStyle(el).borderStyle !== 'none');
  }).length;
  return {
    viewport: { w: vw, h: window.innerHeight },
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    overflowingElements: over.slice(0, 10),
    overflowingCount: over.length,
    bodyFontFamily: getComputedStyle(document.body).fontFamily.slice(0, 80),
    fontWeights: weights,
    distinctFontSizes: Object.keys(sizes).length,
    textElementCount: textEls.length,
    emptyDecoratedBoxes: emptyBoxes,
    imageCount: visible.filter((el) => el.tagName === 'IMG').length,
    brokenImages: visible.filter((el) => el.tagName === 'IMG' && el.complete && el.naturalWidth === 0).length,
    pageHeight: document.documentElement.scrollHeight
  };
})()`;

async function main() {
  if (!PROJECT) { console.error('usage: measure-project.js <project-dir>'); process.exit(2); }

  const server = spawn('node', [path.join(REPO, 'scripts/devtools/render-from-disk.js'), PROJECT, '--port', String(SERVE_PORT)], { stdio: ['ignore', 'pipe', 'pipe'] });
  let serverLog = '';
  server.stdout.on('data', (d) => (serverLog += d));
  server.stderr.on('data', (d) => (serverLog += d));

  const profile = fs.mkdtempSync('/tmp/measure-chrome-');
  const chrome = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', 'about:blank'
  ], { stdio: 'ignore' });

  const t0 = Date.now();
  let targets;
  for (let i = 0; i < 40; i++) {
    await wait(250);
    try { targets = await httpJson(CDP_PORT, '/json/list'); break; } catch (e) { /* not up yet */ }
  }
  if (!targets) throw new Error('chrome CDP never came up');
  const page = targets.find((t) => t.type === 'page');
  const client = await connect(page.webSocketDebuggerUrl);
  await client.send('Page.enable', {});
  await client.send('Page.navigate', { url: `http://127.0.0.1:${SERVE_PORT}/` });
  await wait(3500); // let the runtime boot and render

  const report = { project: PROJECT, serverLog: serverLog.slice(0, 500), viewports: {}, startupMs: Date.now() - t0 };
  for (const [name, w, h] of [['desktop', 1280, 900], ['phone', 390, 844]]) {
    await client.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: name === 'phone' });
    await wait(1200);
    report.viewports[name] = await evaluate(client, MEASURE_JS);
    const shot = await client.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`${OUT}-${name}.png`, Buffer.from(shot.data, 'base64'));
    report.viewports[name].screenshot = `${OUT}-${name}.png`;
  }
  report.totalMs = Date.now() - t0;

  client.close();
  chrome.kill();
  server.kill();
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => { console.error('MEASURE FAILED:', e.message); process.exit(1); });
