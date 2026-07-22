#!/usr/bin/env node
/**
 * Chrome DevTools Protocol client for the running OpenNoodl editor.
 *
 * Gives headless visibility into the Electron renderer — evaluate JS, stream
 * console output and uncaught exceptions, capture screenshots, query the DOM —
 * without needing to look at the window. Screenshots go through the browser
 * compositor, so they work regardless of OS screen-recording permissions.
 *
 * Requires the app to be running with a debug port:
 *   npm run dev:debug
 *
 * Usage:
 *   node scripts/devtools/cdp.js targets
 *   node scripts/devtools/cdp.js eval "document.title"
 *   node scripts/devtools/cdp.js console [ms]
 *   node scripts/devtools/cdp.js screenshot [file.png]
 *   node scripts/devtools/cdp.js dom "<selector>" [text|html]
 *   node scripts/devtools/cdp.js wait "<selector>" [timeoutMs]
 *   node scripts/devtools/cdp.js health
 *   node scripts/devtools/cdp.js reload
 *
 * Env:
 *   NOODL_REMOTE_DEBUG_PORT   debug port to attach to (default 9222)
 */
const http = require('http');
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

function httpJson(urlPath) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port: PORT, path: urlPath }, (res) => {
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
    req.on('error', () =>
      reject(
        new Error(
          `Cannot reach the DevTools endpoint on port ${PORT}.\n` +
            `Is the editor running with a debug port? Start it with:  npm run dev:debug`
        )
      )
    );
  });
}

/**
 * The app page — not DevTools, and not the viewer frame. The editor renderer is
 * the file:// target; DevTools itself also shows up as a page.
 */
async function appTarget() {
  const targets = await httpJson('/json/list');
  const pages = targets.filter((t) => t.type === 'page' && !t.url.startsWith('devtools://'));
  const editor = pages.find((t) => t.url.includes('/src/editor/index.html'));
  const target = editor || pages[0];
  if (!target) throw new Error('No app page target found. Is the editor window open?');
  return target;
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

function describeArg(a) {
  if (a.value !== undefined) return typeof a.value === 'string' ? a.value : JSON.stringify(a.value);
  return a.description || a.preview?.description || a.type;
}

const commands = {
  async targets() {
    const targets = await httpJson('/json/list');
    for (const t of targets) {
      console.log(`${t.type.padEnd(8)} ${JSON.stringify(t.title).padEnd(30)} ${t.url.slice(0, 90)}`);
    }
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

  /** One-shot "is the app actually alive and rendered?" check. */
  async health() {
    const target = await appTarget();
    const client = await connect(target);
    const state = await evaluate(
      client,
      `(() => {
         const root = document.getElementById('root');
         return {
           url: location.href,
           title: document.title,
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

const [cmd, ...rest] = process.argv.slice(2);
if (!cmd || !commands[cmd]) {
  console.error(`usage: cdp.js <${Object.keys(commands).join('|')}> [args]`);
  process.exit(1);
}
commands[cmd](...rest).catch((err) => {
  console.error(err.message);
  process.exit(1);
});
