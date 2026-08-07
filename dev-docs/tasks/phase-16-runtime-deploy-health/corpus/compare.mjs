#!/usr/bin/env node
/**
 * RUN-001 slice 5 — 18-vs-19 corpus comparison harness.
 *
 * For each project dir given: render it through noodl-preview (the real deploy
 * path) once per runtime ('react18' = field absent, 'react19' = field set),
 * drive headless Chrome over raw CDP (no deps — Node 22 native WebSocket),
 * and capture console output, uncaught exceptions, the probe object the
 * project's Function nodes may write to window.__probe, a screenshot, and the
 * rendered DOM. Then diff the two runs per project.
 *
 * usage: node compare.mjs --out <dir> <projectDir> [<projectDir> ...]
 *   --settle <ms>   extra wait after load / probe completion (default 1500)
 *   --timeout <ms>  max wait for window.__probeDone (default 8000)
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// This file lives at dev-docs/tasks/phase-16-runtime-deploy-health/corpus/.
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const PREVIEW_BIN = path.join(REPO, 'packages/noodl-preview/bin/noodl-preview.js');
const CHROME =
  process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// ── args ─────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
let outDir = null,
  settleMs = 1500,
  probeTimeoutMs = 8000;
const projects = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--out') outDir = argv[++i];
  else if (argv[i] === '--settle') settleMs = Number(argv[++i]);
  else if (argv[i] === '--timeout') probeTimeoutMs = Number(argv[++i]);
  else projects.push(path.resolve(argv[i]));
}
if (!outDir || projects.length === 0) {
  console.error('usage: node compare.mjs --out <dir> <projectDir> ...');
  process.exit(2);
}
fs.mkdirSync(outDir, { recursive: true });

// ── tiny CDP client over the browser websocket (flatten protocol) ────────────
class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = [];
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
      } else if (msg.method) {
        for (const l of this.listeners) l(msg);
      }
    });
  }
  send(method, params = {}, sessionId) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }
  on(fn) {
    this.listeners.push(fn);
  }
}

function launchChrome() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'run001-chrome-'));
  const proc = spawn(CHROME, [
    '--headless=new',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--window-size=800,600',
    '--hide-scrollbars',
    '--disable-gpu',
    'about:blank'
  ]);
  return new Promise((resolve, reject) => {
    let err = '';
    const onData = (d) => {
      err += d.toString();
      const m = err.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) {
        proc.stderr.off('data', onData);
        resolve({ proc, wsUrl: m[1], profile });
      }
    };
    proc.stderr.on('data', onData);
    proc.on('exit', (code) => reject(new Error(`chrome exited early (${code}): ${err}`)));
    setTimeout(() => reject(new Error('chrome: no DevTools line after 15s')), 15000);
  });
}

function startPreview(dir) {
  const proc = spawn('node', [PREVIEW_BIN, dir, '--no-watch', '--port', '0'], { cwd: REPO });
  return new Promise((resolve, reject) => {
    let out = '';
    const onData = (d) => {
      out += d.toString();
      const m = out.match(/→ (http:\/\/[\d.]+:\d+)/);
      if (m) {
        proc.stdout.off('data', onData);
        resolve({ proc, url: m[1], log: () => out });
      }
    };
    proc.stdout.on('data', onData);
    let errBuf = '';
    proc.stderr.on('data', (d) => (errBuf += d.toString()));
    proc.on('exit', (code) => reject(new Error(`noodl-preview exited (${code}):\n${out}\n${errBuf}`)));
    setTimeout(() => reject(new Error(`noodl-preview: no URL after 60s\n${out}`)), 60000);
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Serialize a console arg preview without fetching remote objects.
function fmtArg(a) {
  if ('value' in a) return String(a.value);
  if (a.unserializableValue) return a.unserializableValue;
  if (a.preview) {
    if (a.preview.type === 'object' && a.preview.subtype === 'array')
      return '[' + a.preview.properties.map((p) => p.value).join(',') + ']';
    return (
      '{' +
      (a.preview.properties || []).map((p) => `${p.name}:${p.value}`).join(',') +
      '}'
    );
  }
  return a.description || a.type;
}

async function renderOnce(cdp, url, label, actions) {
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  const console_ = [];
  const exceptions = [];
  cdp.on((msg) => {
    if (msg.sessionId !== sessionId) return;
    if (msg.method === 'Runtime.consoleAPICalled') {
      console_.push({
        type: msg.params.type,
        text: msg.params.args.map(fmtArg).join(' ')
      });
    } else if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      exceptions.push(d.exception?.description || d.text);
    }
  });
  await cdp.send('Runtime.enable', {}, sessionId);
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Page.navigate', { url }, sessionId);
  await sleep(1200); // let the runtime boot before interacting

  // Optional per-project interaction script (probe-actions.json in the project
  // dir): [{click: "<selector>"}, {eval: "<js>"}, {wait: <ms>}, ...]
  for (const step of actions || []) {
    if (step.wait) await sleep(step.wait);
    if (step.click)
      await cdp.send(
        'Runtime.evaluate',
        { expression: `document.querySelector(${JSON.stringify(step.click)})?.click()` },
        sessionId
      );
    if (step.eval) await cdp.send('Runtime.evaluate', { expression: step.eval }, sessionId);
  }

  // Wait for probe completion (window.__probeDone) or timeout, then settle.
  const t0 = Date.now();
  let probeDone = false;
  while (Date.now() - t0 < probeTimeoutMs) {
    const r = await cdp
      .send('Runtime.evaluate', { expression: '!!window.__probeDone', returnByValue: true }, sessionId)
      .catch(() => null);
    if (r?.result?.value) {
      probeDone = true;
      break;
    }
    await sleep(250);
  }
  await sleep(settleMs);

  const evalJson = async (expression) => {
    const r = await cdp.send(
      'Runtime.evaluate',
      { expression, returnByValue: true, awaitPromise: true },
      sessionId
    );
    if (r.exceptionDetails) throw new Error(`eval failed: ${r.exceptionDetails.text}`);
    return r.result.value;
  };

  const summary = await evalJson(`({
    reactVersion: (window.React && window.React.version) || null,
    reactDomVersion: (window.ReactDOM && window.ReactDOM.version) || null,
    findDOMNodePresent: !!(window.ReactDOM && window.ReactDOM.findDOMNode),
    probe: window.__probe || null,
    probeDone: !!window.__probeDone,
    title: document.title,
    bodyText: document.body ? document.body.innerText : null,
    styles: [...document.querySelectorAll('div,button,span')].map((d) => {
      const s = getComputedStyle(d);
      return [s.transform, s.opacity, s.visibility, s.zIndex].join('|');
    })
  })`);
  const dom = await evalJson('document.body ? document.body.innerHTML : ""');
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png' }, sessionId);
  await cdp.send('Target.closeTarget', { targetId });
  return { label, probeDone, console: console_, exceptions, summary, dom, screenshotB64: shot.data };
}

// ── per-project driver ───────────────────────────────────────────────────────
function prepareVariant(srcDir, runtime, workRoot) {
  // Copy the project so we can set/clear runtimeVersion without touching the source.
  const dst = path.join(workRoot, `${path.basename(srcDir)}-${runtime}`);
  fs.cpSync(srcDir, dst, { recursive: true });
  const legacy = path.join(dst, 'project.json');
  const v2 = path.join(dst, 'nodegx.project.json');
  const manifest = fs.existsSync(v2) ? v2 : legacy;
  const json = JSON.parse(fs.readFileSync(manifest, 'utf8'));
  if (runtime === 'react19') json.runtimeVersion = 'react19';
  else delete json.runtimeVersion;
  fs.writeFileSync(manifest, JSON.stringify(json, null, 2));
  return dst;
}

async function runProject(cdp, srcDir, workRoot, projOut) {
  const results = {};
  const actionsFile = path.join(srcDir, 'probe-actions.json');
  const actions = fs.existsSync(actionsFile) ? JSON.parse(fs.readFileSync(actionsFile, 'utf8')) : null;
  for (const runtime of ['react18', 'react19']) {
    const dir = prepareVariant(srcDir, runtime, workRoot);
    const preview = await startPreview(dir);
    try {
      const res = await renderOnce(cdp, preview.url, runtime, actions);
      const rdir = path.join(projOut, runtime);
      fs.mkdirSync(rdir, { recursive: true });
      fs.writeFileSync(path.join(rdir, 'screenshot.png'), Buffer.from(res.screenshotB64, 'base64'));
      fs.writeFileSync(path.join(rdir, 'dom.html'), res.dom);
      fs.writeFileSync(
        path.join(rdir, 'result.json'),
        JSON.stringify(
          { probeDone: res.probeDone, summary: res.summary, console: res.console, exceptions: res.exceptions },
          null,
          2
        )
      );
      results[runtime] = res;
    } finally {
      preview.proc.kill();
    }
  }
  return results;
}

function diffProject(name, a, b) {
  const issues = [];
  const eq = (x, y) => JSON.stringify(x) === JSON.stringify(y);
  if (!eq(a.summary.probe, b.summary.probe)) issues.push('probe-mismatch');
  if (!eq(a.summary.bodyText, b.summary.bodyText)) issues.push('body-text-mismatch');
  if (!eq(a.summary.styles, b.summary.styles)) issues.push('computed-style-mismatch');
  if (a.exceptions.length !== b.exceptions.length) issues.push('exception-count-mismatch');
  const errs = (r) => r.console.filter((c) => c.type === 'error').map((c) => c.text);
  if (!eq(errs(a), errs(b))) issues.push('console-error-mismatch');
  // The script-src rewrite IS the runtime switch — normalize it out of the diff.
  const normDom = (s) => s.replaceAll('/react19/react', '/react');
  if (normDom(a.dom) !== normDom(b.dom)) issues.push('dom-differs');
  const shotSame =
    Buffer.from(a.screenshotB64, 'base64').equals(Buffer.from(b.screenshotB64, 'base64'));
  if (!shotSame) issues.push('screenshot-differs');
  return {
    project: name,
    react18: { version: a.summary.reactVersion, probeDone: a.probeDone, exceptions: a.exceptions.length },
    react19: { version: b.summary.reactVersion, probeDone: b.probeDone, exceptions: b.exceptions.length },
    issues
  };
}

// ── main ─────────────────────────────────────────────────────────────────────
const workRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'run001-work-'));
const chrome = await launchChrome();
const cdp = await new Promise((resolve, reject) => {
  const ws = new WebSocket(chrome.wsUrl);
  ws.addEventListener('open', () => resolve(new Cdp(ws)));
  ws.addEventListener('error', (e) => reject(new Error(`ws: ${e.message}`)));
});

const report = [];
try {
  for (const proj of projects) {
    const name = path.basename(proj);
    console.log(`── ${name}`);
    const projOut = path.join(outDir, name);
    try {
      const res = await runProject(cdp, proj, workRoot, projOut);
      const d = diffProject(name, res.react18, res.react19);
      report.push(d);
      console.log(
        `   18=${d.react18.version} 19=${d.react19.version}  issues: ${d.issues.join(', ') || 'none'}`
      );
    } catch (err) {
      report.push({ project: name, error: String(err.message || err) });
      console.log(`   ERROR: ${err.message}`);
    }
  }
} finally {
  chrome.proc.kill();
}
fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
console.log(`\nreport: ${path.join(outDir, 'report.json')}`);
