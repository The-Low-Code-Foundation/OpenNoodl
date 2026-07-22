#!/usr/bin/env node
/**
 * Chrome DevTools Protocol client for the running OpenNoodl editor.
 *
 * Gives headless visibility into the Electron renderers — evaluate JS, stream
 * console output and uncaught exceptions, capture screenshots, query the DOM,
 * drive real clicks and typing — without needing to look at the window.
 * Screenshots go through the browser compositor, so they work regardless of OS
 * screen-recording permissions.
 *
 * Requires the app to be running with a debug port:
 *   npm run dev:debug
 *
 * Usage:
 *   node scripts/devtools/cdp.js targets
 *   node scripts/devtools/cdp.js services
 *   node scripts/devtools/cdp.js health
 *   node scripts/devtools/cdp.js eval "document.title"
 *   node scripts/devtools/cdp.js console [ms]
 *   node scripts/devtools/cdp.js screenshot [file.png]
 *   node scripts/devtools/cdp.js dom "<selector>" [text|html]
 *   node scripts/devtools/cdp.js wait "<selector>" [timeoutMs]
 *   node scripts/devtools/cdp.js click "<selector>"
 *   node scripts/devtools/cdp.js type "<selector>" "text"
 *   node scripts/devtools/cdp.js reload
 *
 * Options (any position):
 *   --target=editor|viewer|<substring>   which renderer to attach to (default: editor)
 *
 * Env:
 *   NOODL_REMOTE_DEBUG_PORT   renderer debug port to attach to (default 9222)
 *   NOODL_MAIN_INSPECT_PORT   main-process inspector port, reported by `services`
 */
const http = require('http');
const net = require('net');
const fs = require('fs');
const path = require('path');

const PORT = process.env.NOODL_REMOTE_DEBUG_PORT || 9222;

// `ws` comes from the editor package, which is the only place that depends on it.
let WebSocket;
try {
  WebSocket = require(path.join(__dirname, '..', '..', 'node_modules', 'ws'));
} catch {
  WebSocket = require('ws');
}

// --target= is global rather than per-command, so it can be dropped in anywhere.
const argv = process.argv.slice(2);
const targetArg = argv.find((a) => a.startsWith('--target='));
const TARGET = targetArg ? targetArg.slice('--target='.length) : 'editor';
const positional = argv.filter((a) => a !== targetArg);

// One shot at the DevTools HTTP endpoint, with a hard timeout so a request that
// never gets a response cannot hang the whole command. Electron 43's Chromium
// made the /json discovery endpoint flaky to answer a *cold* request — it often
// accepts the TCP connection and then sits silent for a few seconds before it
// finally serves the target list. Without a timeout, cdp.js hung forever on that
// first slow hit; dev-debug.js never noticed because it already polls with a
// timeout and retries. See httpJson() for the retry loop that papers over it.
function httpJsonOnce(urlPath, timeoutMs) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port: PORT, path: urlPath, timeout: timeoutMs }, (res) => {
      let body = '';
      res.on('data', (d) => (body += d));
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error(`Bad JSON from ${urlPath}: ${body.slice(0, 200)}`));
        }
      });
    });
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`timeout after ${timeoutMs}ms`));
    });
    req.on('error', (err) => reject(err));
  });
}

// Retry the discovery request until it answers or we give up. The endpoint is
// reachable the whole time (the browser process owns the port from boot); it is
// just slow to serve the *first* cold request under Electron 43, so a short
// timeout plus a few retries turns a hang into a ~1s delay.
async function httpJson(urlPath, { attempts = 8, timeoutMs = 2000 } = {}) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await httpJsonOnce(urlPath, timeoutMs);
    } catch (e) {
      lastErr = e;
      // A connection refused means nothing is listening — fail fast rather than
      // spending the whole retry budget waiting for an editor that isn't up.
      if (e && e.code === 'ECONNREFUSED') break;
    }
  }
  throw new Error(
    `Cannot reach the DevTools endpoint on port ${PORT} (${lastErr ? lastErr.message : 'unknown'}).\n` +
      `Is the editor running with a debug port? Start it with:  npm run dev:debug`
  );
}

/**
 * Renderer targets, by name. The editor and the preview are separate
 * BrowserWindows, so each is its own CDP page target. DevTools itself also shows
 * up as a page; never match that.
 */
const KNOWN_TARGETS = {
  editor: '/src/editor/index.html',
  viewer: '/src/frames/viewer-frame/index.html'
};

async function appTarget(name = TARGET) {
  const targets = await httpJson('/json/list');
  const pages = targets.filter((t) => t.type === 'page' && !t.url.startsWith('devtools://'));
  const needle = KNOWN_TARGETS[name] || name;
  const match = pages.find((t) => t.url.includes(needle) || t.title.includes(needle));

  // Falling back to the first page keeps `health` useful before the editor has
  // navigated, but only for the default target — an explicit --target=viewer
  // that silently attached to the editor would be worse than an error.
  if (!match && (name === 'editor' || !KNOWN_TARGETS[name])) {
    if (pages[0]) return pages[0];
  }
  if (!match) {
    const open = pages.map((p) => p.url).join('\n    ') || '(none)';
    throw new Error(
      `No '${name}' page target found. Open pages:\n    ${open}\n` +
        (name === 'viewer' ? 'The viewer window only exists while a project preview is running.' : '')
    );
  }
  return match;
}

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
        on(fn) {
          listeners.push(fn);
        },
        close() {
          ws.close();
        }
      })
    );
    ws.on('error', reject);
    ws.on('message', (data) => {
      const msg = JSON.parse(data);
      if (msg.id && pending.has(msg.id)) {
        const { res, rej } = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? rej(new Error(msg.error.message)) : res(msg.result);
      } else if (msg.method) {
        listeners.forEach((fn) => fn(msg));
      }
    });
  });
}

async function evaluate(client, expression) {
  const r = await client.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
    userGesture: true
  });
  if (r.exceptionDetails) {
    const ex = r.exceptionDetails.exception || {};
    throw new Error(ex.description || ex.value || r.exceptionDetails.text);
  }
  return r.result.value;
}

/**
 * Centre of an element in viewport coordinates, scrolled into view first.
 * Returns null if it is missing, and zero-sized boxes are reported as such —
 * dispatching a click at (0,0) would otherwise "succeed" while hitting nothing.
 */
async function elementCentre(client, selector) {
  const box = await evaluate(
    client,
    `(() => {
       const el = document.querySelector(${JSON.stringify(selector)});
       if (!el) return null;
       el.scrollIntoView({ block: 'center', inline: 'center' });
       const r = el.getBoundingClientRect();
       return { x: r.left + r.width / 2, y: r.top + r.height / 2, width: r.width, height: r.height };
     })()`
  );
  if (!box) throw new Error(`no element matching ${selector}`);
  if (!box.width || !box.height) throw new Error(`${selector} has a zero-sized box — is it hidden?`);
  return box;
}

/**
 * A real trusted click through the input pipeline, not a synthetic DOM event.
 * React's synthetic events, :active styling and focus all behave as they do for
 * a user; el.click() bypasses most of that.
 */
async function dispatchClick(client, { x, y }) {
  const base = { x, y, clickCount: 1 };
  await client.send('Input.dispatchMouseEvent', { ...base, type: 'mouseMoved', button: 'none', buttons: 0 });
  await client.send('Input.dispatchMouseEvent', { ...base, type: 'mousePressed', button: 'left', buttons: 1 });
  await client.send('Input.dispatchMouseEvent', { ...base, type: 'mouseReleased', button: 'left', buttons: 0 });
}

function describeArg(a) {
  if (a.value !== undefined) return typeof a.value === 'string' ? a.value : JSON.stringify(a.value);
  return a.description || a.preview?.description || a.type;
}

function probeHost(port, host, timeoutMs) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const done = (up) => {
      socket.destroy();
      resolve(up);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
    socket.connect(port, host);
  });
}

/**
 * Is anything listening on this TCP port? Both stacks are probed: the renderer
 * dev server binds `localhost`, which on macOS resolves to ::1 first, so an
 * IPv4-only check reports a perfectly healthy dev server as down.
 */
async function probePort(port, timeoutMs = 700) {
  const results = await Promise.all([probeHost(port, '127.0.0.1', timeoutMs), probeHost(port, '::1', timeoutMs)]);
  return results.some(Boolean);
}

const commands = {
  async targets() {
    const targets = await httpJson('/json/list');
    for (const t of targets) {
      console.log(`${t.type.padEnd(8)} ${JSON.stringify(t.title).padEnd(30)} ${t.url.slice(0, 90)}`);
    }
  },

  /**
   * "Is the backend even running?" in one command. The viewer and cloud runtime
   * are webpack watch builds rather than servers, so they are reported by the
   * freshness of what they emit into src/external.
   */
  async services() {
    const ports = [
      { name: 'renderer dev server', port: 8080, note: 'webpack-dev-server, dev only' },
      { name: 'editor web server', port: Number(process.env.NOODLPORT) || 8574, note: 'serves project previews' },
      { name: 'cloud functions', port: Number(process.env.NOODL_CLOUD_FUNCTIONS_PORT) || 8577, note: '' },
      { name: 'renderer CDP', port: Number(PORT), note: 'this tool' }
    ];
    if (process.env.NOODL_MAIN_INSPECT_PORT) {
      ports.push({ name: 'main process inspector', port: Number(process.env.NOODL_MAIN_INSPECT_PORT), note: '' });
    }

    const results = await Promise.all(ports.map((s) => probePort(s.port)));
    let allUp = true;
    for (let i = 0; i < ports.length; i++) {
      const { name, port, note } = ports[i];
      const up = results[i];
      if (!up) allUp = false;
      console.log(`${up ? 'up  ' : 'DOWN'}  ${String(port).padEnd(6)} ${name.padEnd(24)} ${note}`);
    }

    const external = path.join(__dirname, '..', '..', 'packages', 'noodl-editor', 'src', 'external');
    for (const build of ['viewer', 'cloudruntime', 'deploy', 'ssr']) {
      const dir = path.join(external, build);
      if (!fs.existsSync(dir)) {
        console.log(`MISS  build  ${build.padEnd(24)} src/external/${build} not built`);
        allUp = false;
        continue;
      }
      const newest = fs
        .readdirSync(dir)
        .map((f) => fs.statSync(path.join(dir, f)).mtimeMs)
        .reduce((a, b) => Math.max(a, b), 0);
      const ageMin = Math.round((Date.now() - newest) / 60000);
      console.log(`built build  ${build.padEnd(24)} src/external/${build}, ${ageMin} min old`);
    }

    if (!allUp) process.exit(1);
  },

  async eval(expression) {
    if (!expression) throw new Error('usage: cdp.js eval "<expression>"');
    const client = await connect(await appTarget());
    const value = await evaluate(client, expression);
    console.log(typeof value === 'string' ? value : JSON.stringify(value, null, 2));
    client.close();
  },

  /** Stream console output + uncaught exceptions. Default 20s, 0 = until killed. */
  async console(msArg) {
    const ms = msArg === undefined ? 20000 : Number(msArg);
    const client = await connect(await appTarget());

    client.on((msg) => {
      if (msg.method === 'Runtime.exceptionThrown') {
        const d = msg.params.exceptionDetails;
        const ex = d.exception || {};
        console.log(`EXCEPTION ${d.text}: ${ex.description || ex.value || ''}`);
      } else if (msg.method === 'Runtime.consoleAPICalled') {
        const text = msg.params.args.map(describeArg).join(' ');
        console.log(`${msg.params.type.padEnd(7)} ${text}`);
      } else if (msg.method === 'Log.entryAdded') {
        const e = msg.params.entry;
        console.log(`${e.level.padEnd(7)} ${e.text}${e.url ? ` (${e.url.split('/').pop()})` : ''}`);
      }
    });

    await client.send('Runtime.enable');
    await client.send('Log.enable');
    if (ms > 0) setTimeout(() => process.exit(0), ms);
  },

  /** Screenshot via the compositor — no OS screen-recording permission needed. */
  async screenshot(file) {
    const out = path.resolve(file || 'noodl-screenshot.png');
    const client = await connect(await appTarget());
    const { data } = await client.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    fs.writeFileSync(out, Buffer.from(data, 'base64'));
    const { width, height } = await evaluate(client, '({width: innerWidth, height: innerHeight})');
    console.log(`${out} (${width}x${height} css px, ${fs.statSync(out).size} bytes)`);
    client.close();
  },

  async dom(selector, mode = 'text') {
    if (!selector) throw new Error('usage: cdp.js dom "<selector>" [text|html]');
    const client = await connect(await appTarget());
    const prop = mode === 'html' ? 'outerHTML' : 'innerText';
    const value = await evaluate(
      client,
      `(() => { const el = document.querySelector(${JSON.stringify(selector)});
        return el ? el.${prop} : null; })()`
    );
    console.log(value === null ? `(no element matching ${selector})` : value);
    client.close();
  },

  async wait(selector, timeoutMs = 30000) {
    if (!selector) throw new Error('usage: cdp.js wait "<selector>" [timeoutMs]');
    const client = await connect(await appTarget());
    const deadline = Date.now() + Number(timeoutMs);
    while (Date.now() < deadline) {
      const found = await evaluate(client, `!!document.querySelector(${JSON.stringify(selector)})`);
      if (found) {
        console.log(`found ${selector} after ${Date.now() - (deadline - Number(timeoutMs))}ms`);
        client.close();
        return;
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    client.close();
    console.error(`timed out waiting for ${selector}`);
    process.exit(1);
  },

  async click(selector) {
    if (!selector) throw new Error('usage: cdp.js click "<selector>"');
    const client = await connect(await appTarget());
    const box = await elementCentre(client, selector);
    await dispatchClick(client, box);
    console.log(`clicked ${selector} at ${Math.round(box.x)},${Math.round(box.y)}`);
    client.close();
  },

  /**
   * Focus the element with a real click, then insert text through the input
   * pipeline so React's onChange fires. `Input.insertText` produces genuine
   * beforeinput/input events; setting `.value` from JS does not.
   */
  async type(selector, text) {
    if (!selector || text === undefined) throw new Error('usage: cdp.js type "<selector>" "text"');
    const client = await connect(await appTarget());
    const box = await elementCentre(client, selector);
    await dispatchClick(client, box);
    await client.send('Input.insertText', { text });
    console.log(`typed ${JSON.stringify(text)} into ${selector}`);
    client.close();
  },

  /**
   * One-shot "is the app actually alive and rendered?" check — the distinction
   * a window screenshot cannot make. The editor mounts into #root; the viewer
   * frame has no #root and renders straight into <body>, so fall back to that.
   */
  async health() {
    const target = await appTarget();
    const client = await connect(target);
    const state = await evaluate(
      client,
      `(() => {
         const root = document.getElementById('root') || document.body;
         return {
           url: location.href,
           title: document.title,
           mountPoint: root.id ? '#' + root.id : root.tagName.toLowerCase(),
           rootChildren: root ? root.children.length : -1,
           visibleText: document.body.innerText.trim().length,
           reactMounted: !!(root && root.children.length)
         };
       })()`
    );
    console.log(JSON.stringify(state, null, 2));
    client.close();
    if (!state.reactMounted) {
      console.error('\nRenderer is NOT mounted — run `cdp.js console` and reload to see the failure.');
      process.exit(1);
    }
  },

  async reload() {
    const client = await connect(await appTarget());
    await client.send('Page.enable');
    await client.send('Page.reload', { ignoreCache: true });
    console.log('reloaded');
    setTimeout(() => process.exit(0), 500);
  }
};

const [cmd, ...rest] = positional;
if (!cmd || !commands[cmd]) {
  console.error(`usage: cdp.js <${Object.keys(commands).join('|')}> [args] [--target=editor|viewer]`);
  process.exit(1);
}
commands[cmd](...rest).catch((err) => {
  console.error(err.message);
  process.exit(1);
});
