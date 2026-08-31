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
 *   node scripts/devtools/cdp.js dropfile "<selector|x,y>" <file>[,<file>...]
 *   node scripts/devtools/cdp.js reload
 *   node scripts/devtools/cdp.js network <offline|online>
 *   node scripts/devtools/cdp.js blockurl "<url-pattern>"
 *   node scripts/devtools/cdp.js unblockurl
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
 *
 * The in-editor preview is a different animal again: it is a `<webview>` inside
 * the editor window serving from the dev web server, so it is a `webview` target
 * rather than a `page`. `viewer` therefore matches either — the detached preview
 * window or the embedded pane, whichever is up.
 */
const KNOWN_TARGETS = {
  editor: '/src/editor/index.html',
  viewer: ['/src/frames/viewer-frame/index.html', 'localhost:8574', 'Noodl Viewer']
};

async function appTarget(name = TARGET) {
  const targets = await httpJson('/json/list');
  const pages = targets.filter(
    (t) => (t.type === 'page' || t.type === 'webview') && !t.url.startsWith('devtools://')
  );
  const needles = [].concat(KNOWN_TARGETS[name] || name);
  const match = pages.find((t) => needles.some((n) => t.url.includes(n) || t.title.includes(n)));

  // Falling back to the first page keeps `health` useful before the editor has
  // navigated, but only for the default target — an explicit --target=viewer
  // that silently attached to the editor would be worse than an error.
  if (!match && (name === 'editor' || !KNOWN_TARGETS[name])) {
    // Fall back to a real window, never to an embedded webview — attaching to the
    // preview pane while asking for the editor is the confusion this avoids.
    const firstWindow = pages.find((t) => t.type === 'page');
    if (firstWindow) return firstWindow;
  }
  if (!match) {
    const open = pages.map((p) => p.url).join('\n    ') || '(none)';
    throw new Error(
      `No '${name}' page target found. Open pages:\n    ${open}\n` +
        // Do NOT restore "only exists while a project preview is running" — it
        // contradicts this module's own doc above and sends a caller who has a
        // project open away from a target that is very often there. `viewer`
        // matches the detached preview window *or* the editor's embedded
        // preview `webview`, and the embedded one has been seen attached with
        // no preview started. What is reliably true is the precondition below.
        (name === 'viewer' ? 'No viewer target: `viewer` matches the detached preview window or the\n' +
          "    editor's embedded preview webview, and neither exists before a project is open." : '')
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

/**
 * A real press-move-release drag through the input pipeline.
 *
 * ⚠️ **The intermediate moves are not padding.** HTML5 drag sources, Blockly's own
 * gesture handler and every pointer-drag implementation in this editor start a drag
 * only after the pointer has travelled a few pixels while held. A press followed
 * straight by a release at the destination is a *click at the origin*, which is a
 * different gesture and frequently a passing-looking no-op — so this walks the
 * pointer across in steps and lets each one be processed.
 *
 * `Input.dispatchMouseEvent` is also how a real drag arrives, so `dragstart`,
 * `dragover` and `drop` fire for HTML5 sources and Blockly sees genuine
 * `pointermove`s. Synthesising the events from `eval` does neither.
 */
async function dispatchDrag(client, from, to, steps = 12) {
  await client.send('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: from.x,
    y: from.y,
    button: 'none',
    buttons: 0
  });
  await client.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: from.x,
    y: from.y,
    button: 'left',
    buttons: 1,
    clickCount: 1,
    pointerType: 'mouse'
  });

  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    await client.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: from.x + (to.x - from.x) * t,
      y: from.y + (to.y - from.y) * t,
      button: 'left',
      buttons: 1,
      pointerType: 'mouse'
    });
    // Let the renderer process each move; a burst of moves in one task can be
    // coalesced into a single jump and miss the drag threshold entirely.
    await new Promise((r) => setTimeout(r, 16));
  }

  await client.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: to.x,
    y: to.y,
    button: 'left',
    buttons: 0,
    clickCount: 1,
    pointerType: 'mouse'
  });
}

/**
 * Resolve a drag endpoint: either a selector, or literal `x,y` viewport coordinates.
 * Coordinates matter because half the interesting drop targets — empty canvas, a
 * point past the last row, somewhere outside the window — have no element to name.
 */
async function dragPoint(client, spec) {
  const m = /^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/.exec(String(spec).trim());
  if (m) return { x: Number(m[1]), y: Number(m[2]) };
  return elementCentre(client, spec);
}

/**
 * A file drag from the desktop, which `dispatchDrag` above cannot produce.
 *
 * ⚠️ **These are two different gestures and only one of them carries files.**
 * `Input.dispatchMouseEvent` starts an *in-page* HTML5 drag — a `draggable`
 * element the pointer pressed on. A file drag has no mousedown inside the page
 * at all: it originates in the OS, and the renderer is handed a `DataTransfer`
 * already populated with `files`. Nothing built out of mouse events can put a
 * real `File` into `dataTransfer.files`, so a drop handler that reads files is
 * unreachable through `drag`.
 *
 * `Input.dispatchDragEvent` is the one that does. `data.files` is a list of
 * absolute paths the *browser process* opens and turns into real `File`
 * objects, so the page sees exactly what a desktop drop delivers — name, MIME
 * type and size all filled in by Chromium rather than by us.
 *
 * 🔴 **Why this is not a synthetic DOM event.** Dispatching `new DragEvent(...)`
 * from `eval` skips the browser's own drop machinery, which means the
 * `preventDefault()`-on-`dragover` contract is never exercised: a synthetic
 * `drop` arrives whether or not the page opted in. Half of what a drop-zone
 * implementation has to get right is *becoming* droppable, and only a real
 * drag event can tell a page that did it from one that did not.
 */
async function dispatchFileDrop(client, { x, y }, files, { steps = 3, probe = null, drop = true, leaveTo = null } = {}) {
  const data = {
    // `files` is what populates `dataTransfer.files`. `items` is what populates
    // `dataTransfer.types`/`items` — a drop zone that checks for 'Files' before
    // acting (the right thing to do, so a dragged text selection does not light
    // it up) reads that list, so a payload without it looks like a non-file drag.
    items: files.map((file) => ({
      mimeType: 'application/octet-stream',
      data: file,
      title: path.basename(file)
    })),
    files,
    dragOperationsMask: 1 // copy
  };

  await client.send('Input.dispatchDragEvent', { type: 'dragEnter', x, y, data });
  for (let i = 0; i < steps; i++) {
    await client.send('Input.dispatchDragEvent', { type: 'dragOver', x, y, data });
    // Same reason the mouse drag paces itself: let the renderer run its handler
    // before the next event, or the state the drop depends on is not there yet.
    await new Promise((r) => setTimeout(r, 32));
  }

  // Read the page *while the drag is still hovering*. This has to happen on the
  // same connection and inside the same sequence — a second `cdp eval` would
  // arrive after the drag had ended, and "is the pointer over me" is precisely
  // the state that does not survive that.
  let hover;
  if (probe) hover = await evaluate(client, probe);

  // Walk the drag OUT of the element before ending it. `dragCancel` is not a
  // substitute: it ends the drag session without the pointer ever crossing the
  // element's edge, so the page gets no `dragleave` at all. Only a move to a
  // point outside makes the browser fire one, which is the event any hover
  // state has to be released by.
  if (leaveTo) {
    for (let i = 0; i < 3; i++) {
      await client.send('Input.dispatchDragEvent', { type: 'dragOver', x: leaveTo.x, y: leaveTo.y, data });
      await new Promise((r) => setTimeout(r, 32));
    }
  }

  if (drop) {
    await client.send('Input.dispatchDragEvent', { type: 'drop', x, y, data });
  } else {
    // The leave/cancel arm: proves the hover state is released, not just set.
    await client.send('Input.dispatchDragEvent', { type: 'dragCancel', x, y, data });
  }
  // The drop handler is async in any implementation that reads the file.
  await new Promise((r) => setTimeout(r, 250));
  return hover;
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
   * "Is the backend even running?" in one command. The viewer is a webpack
   * watch build rather than a server, so it's reported by the freshness of
   * what it emits into src/external. The nodegx-backend service (local
   * database + cloud functions) is a separate child process on a dynamic
   * port — not statically probeable here (WF-007).
   */
  async services() {
    const ports = [
      { name: 'renderer dev server', port: 8080, note: 'webpack-dev-server, dev only' },
      { name: 'editor web server', port: Number(process.env.NOODLPORT) || 8574, note: 'serves project previews' },
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
    // WF-007: 'cloudruntime' (the sandboxed cloud-function-server bundle) is
    // retired — cloud functions now run inside nodegx-backend.
    for (const build of ['viewer', 'deploy', 'ssr']) {
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
   * Drag from one point to another. Either endpoint may be a CSS selector or
   * literal viewport `x,y` coordinates:
   *
   *   cdp drag ".RailRow" "700,400"        # rail row onto the canvas
   *   cdp drag ".RailRow" ".BlocklyToolbox"  # onto a cancel target
   *
   * Needed because the canvas and the Blockly workspace are not DOM — there is
   * often no element to name on the drop side. See `dispatchDrag` for why the
   * intermediate moves are load-bearing rather than cosmetic.
   */
  async drag(from, to, steps) {
    if (!from || !to) throw new Error('usage: cdp.js drag "<selector|x,y>" "<selector|x,y>" [steps]');
    const client = await connect(await appTarget());
    const a = await dragPoint(client, from);
    const b = await dragPoint(client, to);
    await dispatchDrag(client, a, b, steps ? Number(steps) : 12);
    console.log(`dragged ${Math.round(a.x)},${Math.round(a.y)} -> ${Math.round(b.x)},${Math.round(b.y)}`);
    client.close();
  },

  /**
   * Drop real files from the desktop onto a point in the page.
   *
   *   cdp dropfile ".DropZone" /abs/photo.png
   *   cdp dropfile "640,400" /abs/a.png,/abs/b.pdf --target=viewer
   *   cdp dropfile ".DropZone" /abs/photo.png --probe="Noodl.x" --no-drop
   *
   * `--probe=<expr>` is evaluated while the drag is still hovering and printed
   * as `hover:` — the only way to observe drag-over state, which is gone by the
   * time a separate `cdp eval` could run. `--no-drop` ends with `dragCancel`
   * instead of `drop`, which is how you show hover state is *released* rather
   * than merely set.
   *
   * See `dispatchFileDrop` for why `drag` cannot do this: a mouse drag carries
   * no files, and a synthetic DOM event skips the opt-in this is testing.
   */
  async dropfile(target, fileList) {
    if (!target || !fileList) {
      throw new Error('usage: cdp.js dropfile "<selector|x,y>" <file>[,<file>...] [--probe=<expr>] [--no-drop]');
    }
    const probeArg = argv.find((a) => a.startsWith('--probe='));
    const probe = probeArg ? probeArg.slice('--probe='.length) : null;
    const drop = !argv.includes('--no-drop');
    const leaveArg = argv.find((a) => a.startsWith('--leave-to='));

    const files = String(fileList)
      .split(',')
      .map((f) => path.resolve(f.trim()))
      .filter(Boolean);
    // A path the browser process cannot open yields an empty `files` list in the
    // page, which reads exactly like a drop zone that ignored the drag. Fail here
    // instead, so that reading can never be produced by a typo.
    for (const f of files) {
      if (!fs.existsSync(f)) throw new Error(`no such file: ${f}`);
    }

    const client = await connect(await appTarget());
    const point = await dragPoint(client, target);
    const leaveTo = leaveArg ? await dragPoint(client, leaveArg.slice('--leave-to='.length)) : null;
    const hover = await dispatchFileDrop(client, point, files, { probe, drop, leaveTo });
    if (probe) console.log('hover: ' + JSON.stringify(hover));
    console.log(
      `${drop ? 'dropped' : 'cancelled'} ${files.length} file(s) at ` +
        `${Math.round(point.x)},${Math.round(point.y)}: ${files.map((f) => path.basename(f)).join(', ')}`
    );
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
  },

  /**
   * Toggle simulated offline conditions on a renderer via the Network domain —
   * for exercising loud-failure / offline-state UI without touching the host's
   * real network. `cdp.js network offline` / `cdp.js network online`.
   *
   * Caution: full offline emulation affects the *entire* network stack of the
   * renderer, not just fetch()/XHR to remote hosts — it has been observed to
   * hang unrelated app startup/navigation work (e.g. entering a project) that
   * does not expect a network call to fail. Prefer `blockurl`/`unblockurl` to
   * fail a specific host instead of the whole renderer's network.
   */
  async network(mode) {
    if (mode !== 'offline' && mode !== 'online') throw new Error('usage: cdp.js network <offline|online>');
    const client = await connect(await appTarget());
    await client.send('Network.enable');
    await client.send('Network.emulateNetworkConditions', {
      offline: mode === 'offline',
      latency: 0,
      downloadThroughput: mode === 'offline' ? 0 : -1,
      uploadThroughput: mode === 'offline' ? 0 : -1
    });
    console.log(`network: ${mode}`);
    client.close();
  },

  /**
   * Fail requests matching a URL pattern (Chrome DevTools wildcard syntax,
   * e.g. "*the-low-code-foundation.github.io*") instead of taking the whole
   * renderer offline. Safer than `network offline` for exercising one
   * subsystem's fetch-failure path without disturbing unrelated app logic.
   */
  async blockurl(pattern) {
    if (!pattern) throw new Error('usage: cdp.js blockurl "<url-pattern>"');
    const client = await connect(await appTarget());
    await client.send('Network.enable');
    await client.send('Network.setBlockedURLs', { urls: [pattern] });
    console.log(`blocked: ${pattern}`);
    client.close();
  },

  async unblockurl() {
    const client = await connect(await appTarget());
    await client.send('Network.enable');
    await client.send('Network.setBlockedURLs', { urls: [] });
    console.log('unblocked all');
    client.close();
  }
};

/**
 * Everything above is also a library. Scripts that drive the editor for longer
 * than one command — a scripted authoring session, say — need the *same* target
 * resolution this file uses, because getting it wrong attaches to the preview
 * window and reads the wrong renderer while looking entirely normal. Re-deriving
 * `appTarget` in a sibling script is how that regression comes back.
 */
module.exports = { appTarget, connect, evaluate, elementCentre, dispatchClick, httpJson, KNOWN_TARGETS };

if (require.main === module) {
  const [cmd, ...rest] = positional;
  if (!cmd || !commands[cmd]) {
    console.error(`usage: cdp.js <${Object.keys(commands).join('|')}> [args] [--target=editor|viewer]`);
    process.exit(1);
  }
  commands[cmd](...rest).catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
