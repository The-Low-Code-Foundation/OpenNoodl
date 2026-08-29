#!/usr/bin/env node
/**
 * Serve a DEPLOY FOLDER — the output of `deployToFolder` — and drive it.
 *
 * `render-from-disk.js` reconstructs the export contract from the project files
 * by hand, which is the right instrument for a layout question and the wrong
 * one for a deploy question: nothing it serves ever went through
 * `Exporter.exportToJSON`. This serves the artefact a person actually deploys,
 * unmodified — produced by `deploy-from-disk.entry.ts`, or by the editor's
 * "Deploy to folder", it makes no difference here.
 *
 * ⚠️ **Nothing is rewritten on the way out.** The deployed `index-<hash>.js`
 * carries its own `metadata.cloudservices.endpoint`, and the browser calls that
 * origin directly. That works because `nodegx-backend` answers
 * `Access-Control-Allow-Origin: *` by default (`ops/headers.ts`). If a backend
 * is ever configured with an explicit origin list, this stops working and the
 * fix is the backend's config — NOT a rewrite here, which would mean serving
 * something other than the artefact under test.
 *
 * The Chrome-and-CDP block below is a second copy of the one in
 * `render-report.js:withRenderedPage`, which says in its own header that a
 * duplicate is a copy that drifts. It is duplicated anyway because that one is
 * welded to `render-from-disk.js` through `checkPrerequisites` — it demands a v2
 * project directory, a viewer bundle and two node catalogs, none of which a
 * deploy folder has or needs. The CDP half is *not* duplicated: it comes from
 * `cdp.js`, which is where the protocol details live.
 *
 * Usage:
 *   node scripts/devtools/drive-deployed.js <deploy-dir> [--port N] [--hold]
 */
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const net = require('net');
const { spawn } = require('child_process');

// ⚠️ `cdp.js` exports an `httpJson` too, but it is bound to that module's own
// fixed PORT constant (the editor's 9222) and takes `(path, opts)`. Calling it
// with a port reads as "Chrome never opened a debugging port".
const { connect, evaluate } = require('./cdp.js');

/** DevTools JSON on an arbitrary port. */
function httpJson(port, urlPath) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path: urlPath, timeout: 2000 }, (res) => {
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
    req.on('timeout', () => (req.destroy(), reject(new Error('timeout'))));
    req.on('error', reject);
  });
}

const BOOT_MS = 3500;
const PAGE_NAV_MS = 1200;
const REFLOW_MS = 300;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8'
};

const CHROME_CANDIDATES = {
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium'
  ],
  linux: ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'],
  win32: ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe']
};

function findChrome() {
  const probed = [];
  const check = (p) => (probed.push(p), fs.existsSync(p) ? p : null);
  if (process.env.CHROME_PATH) {
    const found = check(process.env.CHROME_PATH);
    if (found) return { chrome: found, probed };
  }
  for (const c of CHROME_CANDIDATES[process.platform] || []) {
    const found = check(c);
    if (found) return { chrome: found, probed };
  }
  return { chrome: null, probed };
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

/**
 * Static server over the deploy folder.
 *
 * Unknown paths fall through to `index.html` rather than 404ing: the deployed
 * router uses real URL paths (`navigationPathType: "path"`), so `/admin/pages`
 * is a client-side route with no file behind it. A 404 there would look exactly
 * like a broken deploy.
 */
function serveFolder(dir, port, backendPort) {
  const server = http.createServer((req, res) => {
    // Same-origin backend, for the arm that has to avoid CORS entirely. The
    // deploy must have been built with `--endpoint http://host:port/__backend`
    // for anything to come down here.
    if (backendPort && (req.url || '').startsWith('/__backend')) {
      const proxied = http.request(
        { host: '127.0.0.1', port: backendPort, path: req.url.replace('/__backend', '') || '/', method: req.method, headers: { ...req.headers, host: `127.0.0.1:${backendPort}` } },
        (up) => {
          res.writeHead(up.statusCode || 502, up.headers);
          up.pipe(res);
        }
      );
      proxied.on('error', (e) => {
        res.writeHead(502).end(String(e));
      });
      req.pipe(proxied);
      return;
    }
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    let file = path.join(dir, urlPath);
    if (!path.resolve(file).startsWith(path.resolve(dir))) {
      res.writeHead(403).end('forbidden');
      return;
    }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dir, 'index.html');
    if (!fs.existsSync(file)) {
      res.writeHead(404).end('not found');
      return;
    }
    res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

/**
 * Boot the deploy folder in a headless Chrome, hand the page to `fn`, tear down.
 *
 * @param {{dir: string, port?: number}} options
 * @param {(page: object) => Promise<any>} fn
 */
async function withDeployedSite(options, fn) {
  const dir = path.resolve(options.dir);
  if (!fs.existsSync(path.join(dir, 'index.html'))) {
    throw new Error(`${dir} is not a deploy folder (no index.html).`);
  }
  const { chrome, probed } = findChrome();
  if (!chrome) throw new Error(`No Chrome found. Probed: ${probed.join(', ')}`);

  const servePort = options.port || (await freePort());
  const cdpPort = await freePort();
  const server = await serveFolder(dir, servePort, options.backendPort);

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-deployed-'));
  const proc = spawn(
    chrome,
    [
      '--headless=new',
      `--remote-debugging-port=${cdpPort}`,
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--hide-scrollbars',
      '--disable-gpu',
      'about:blank'
    ],
    { stdio: 'ignore' }
  );

  let client;
  const cleanup = () => {
    try {
      if (client) client.close();
    } catch {
      /* already gone */
    }
    proc.kill();
    server.close();
    fs.rm(profile, { recursive: true, force: true }, () => {});
  };

  try {
    // 🔴 Wait for the PAGE target, not merely for a reply. `/json/list` answers
    // as soon as the browser is up, with only `browser_ui` and extension
    // entries in it — taking the first reply gets an undefined target and a
    // stack trace from `ws` about an undefined URL.
    let target;
    for (let i = 0; i < 40 && !target; i++) {
      await wait(250);
      try {
        target = (await httpJson(cdpPort, '/json/list')).find((t) => t.type === 'page');
      } catch {
        /* not up yet */
      }
    }
    if (!target) throw new Error('Chrome never opened a page target on its debugging port.');

    const consoleErrors = [];
    const networkErrors = [];
    // ⚠️ `cdp.js`'s `connect` takes the TARGET OBJECT and registers listeners
    // through `client.on(fn)`. `render-report.js` has a same-named helper
    // taking `(wsUrl, handler)`. Two APIs, one name.
    client = await connect(target);
    client.on((msg) => {
      if (msg.method === 'Runtime.exceptionThrown') {
        const d = msg.params.exceptionDetails || {};
        consoleErrors.push(String((d.exception && d.exception.description) || d.text || '').slice(0, 300));
      } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
        consoleErrors.push(
          msg.params.args.map((a) => String(a.value !== undefined ? a.value : a.description || '')).join(' ').slice(0, 300)
        );
      } else if (msg.method === 'Network.loadingFailed') {
        networkErrors.push(`${msg.params.type} ${msg.params.errorText}`);
      }
    });

    await client.send('Page.enable', {});
    await client.send('Runtime.enable', {});
    await client.send('Network.enable', {});
    await client.send('Page.navigate', { url: `http://127.0.0.1:${servePort}/` });
    await wait(BOOT_MS);

    return await fn({
      client,
      servePort,
      consoleErrors,
      networkErrors,
      evaluate: (expression) => evaluate(client, expression),
      async navigate(urlPath) {
        await client.send('Page.navigate', { url: `http://127.0.0.1:${servePort}${urlPath}` });
        await wait(PAGE_NAV_MS);
      },
      async setViewport(vp) {
        await client.send('Emulation.setDeviceMetricsOverride', {
          width: vp.width,
          height: vp.height,
          deviceScaleFactor: 1,
          mobile: Boolean(vp.mobile)
        });
        await wait(REFLOW_MS);
      },
      async screenshot(file) {
        const { data } = await client.send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(file, Buffer.from(data, 'base64'));
        return file;
      }
    });
  } finally {
    cleanup();
  }
}

module.exports = { withDeployedSite, serveFolder, freePort };

if (require.main === module) {
  const dir = process.argv[2];
  const portFlag = process.argv.indexOf('--port');
  const port = portFlag === -1 ? 0 : Number(process.argv[portFlag + 1]);
  if (!dir) {
    console.error('usage: drive-deployed.js <deploy-dir> [--port N] [--hold]');
    process.exit(2);
  }
  if (process.argv.includes('--hold')) {
    // Serve only — for a human, or for a separate CDP session.
    (async () => {
      const p = port || (await freePort());
      await serveFolder(path.resolve(dir), p);
      console.log(`serving ${path.resolve(dir)} at http://127.0.0.1:${p}/`);
    })();
  } else {
    withDeployedSite({ dir, port }, async (page) => {
      const title = await page.evaluate('document.title');
      const h1 = await page.evaluate(
        `(() => { const e = document.querySelector('h1'); return e ? e.innerText : null; })()`
      );
      console.log(JSON.stringify({ title, h1, consoleErrors: page.consoleErrors.slice(0, 5) }, null, 2));
    }).catch((e) => {
      console.error(e.stack || String(e));
      process.exit(1);
    });
  }
}
