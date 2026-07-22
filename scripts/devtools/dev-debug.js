#!/usr/bin/env node
/**
 * Launches the full dev stack (viewer, cloud runtime, editor) with everything
 * needed to debug it headlessly:
 *
 *   - a CDP endpoint on the renderer, for scripts/devtools/cdp.js
 *   - renderer console mirrored into the main process output
 *   - renderer exceptions captured from boot, without attaching by hand
 *   - ELECTRON_RUN_AS_NODE stripped, which otherwise boots Electron as plain Node
 *   - all service output tee'd to .logs/dev.log so it can be grepped after the fact
 *
 * Usage:
 *   npm run dev:debug                    # foreground, logs to terminal + .logs/dev.log
 *   npm run dev:debug -- --quiet         # log to file only
 *   npm run dev:debug -- --inspect-main  # also debug the main process (port 9229)
 *
 * Env:
 *   NOODL_REMOTE_DEBUG_PORT   renderer CDP port, defaults to 9222
 *   NOODL_MAIN_INSPECT_PORT   main-process inspector port; --inspect-main sets 9229
 */
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const LOG_DIR = path.join(ROOT, '.logs');
const LOG_FILE = path.join(LOG_DIR, 'dev.log');
const PORT = process.env.NOODL_REMOTE_DEBUG_PORT || '9222';
const quiet = process.argv.includes('--quiet');
const inspectMain = process.argv.includes('--inspect-main');
const MAIN_INSPECT_PORT = process.env.NOODL_MAIN_INSPECT_PORT || (inspectMain ? '9229' : '');

fs.mkdirSync(LOG_DIR, { recursive: true });
const log = fs.createWriteStream(LOG_FILE, { flags: 'w' });

const env = { ...process.env, NOODL_REMOTE_DEBUG_PORT: PORT, NOODL_DEV_LOGS: '1' };
if (MAIN_INSPECT_PORT) env.NOODL_MAIN_INSPECT_PORT = MAIN_INSPECT_PORT;
// See scripts/start.ts — VS Code sets this, and it stops Electron booting as an app.
delete env.ELECTRON_RUN_AS_NODE;

const banner =
  `> dev stack starting\n` +
  `> CDP port:  ${PORT}\n` +
  (MAIN_INSPECT_PORT ? `> main insp: ${MAIN_INSPECT_PORT} (node inspect 127.0.0.1:${MAIN_INSPECT_PORT})\n` : '') +
  `> log file:  ${path.relative(ROOT, LOG_FILE)}\n` +
  `> inspect:   node scripts/devtools/cdp.js health\n` +
  `---\n`;
log.write(banner);
if (!quiet) process.stdout.write(banner);

const child = spawn('npx', ['ts-node', '-P', './scripts/tsconfig.json', './scripts/start.ts'], {
  cwd: ROOT,
  env,
  stdio: ['inherit', 'pipe', 'pipe']
});

for (const stream of ['stdout', 'stderr']) {
  child[stream].on('data', (chunk) => {
    log.write(chunk);
    if (!quiet) process[stream].write(chunk);
  });
}

// ---------------------------------------------------------------------------
// Renderer exception capture.
//
// Errors thrown during boot are gone before anyone can attach by hand — which is
// how a renderer that died on startup looked identical to one that booted fine
// for months. Poll the DevTools endpoint from the moment the stack starts and
// attach to every page as it appears, so uncaught exceptions land in dev.log
// with no manual step. Attaching to each new target also survives reloads.
// ---------------------------------------------------------------------------
let WebSocket;
try {
  WebSocket = require(path.join(ROOT, 'node_modules', 'ws'));
} catch {
  try {
    WebSocket = require('ws');
  } catch {
    WebSocket = null;
  }
}

const attached = new Set();

function note(line) {
  log.write(line + '\n');
  if (!quiet) process.stdout.write(line + '\n');
}

function attach(target) {
  const ws = new WebSocket(target.webSocketDebuggerUrl, { maxPayload: 64 * 1024 * 1024 });
  const label = target.url.includes('viewer-frame') ? 'viewer' : 'renderer';

  ws.on('open', () => {
    ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
    ws.send(JSON.stringify({ id: 2, method: 'Log.enable' }));
    note(`[cdp] attached to ${label} (${target.url.split('/').pop()})`);
  });

  ws.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      const ex = d.exception || {};
      note(`[${label}:exception] ${d.text} ${ex.description || ex.value || ''}`.trimEnd());
    } else if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
      const e = msg.params.entry;
      note(`[${label}:error] ${e.text}${e.url ? ` (${e.url.split('/').pop()})` : ''}`);
    }
  });

  // A closed socket just means the page went away; the poller will re-attach.
  ws.on('close', () => attached.delete(target.id));
  ws.on('error', () => attached.delete(target.id));
}

function pollTargets() {
  const req = http.get({ host: '127.0.0.1', port: PORT, path: '/json/list', timeout: 2000 }, (res) => {
    let body = '';
    res.on('data', (d) => (body += d));
    res.on('end', () => {
      let targets;
      try {
        targets = JSON.parse(body);
      } catch {
        return;
      }
      for (const t of targets) {
        if (t.type !== 'page' || t.url.startsWith('devtools://') || attached.has(t.id)) continue;
        attached.add(t.id);
        try {
          attach(t);
        } catch {
          attached.delete(t.id);
        }
      }
    });
  });
  req.on('timeout', () => req.destroy());
  req.on('error', () => {});
}

if (WebSocket) {
  const poller = setInterval(pollTargets, 1000);
  poller.unref();
} else {
  note('[cdp] `ws` not installed — renderer exceptions will not be captured (run npm install)');
}

function shutdown(signal) {
  try {
    process.kill(-child.pid, signal);
  } catch {
    child.kill(signal);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

child.on('exit', (code) => {
  log.end();
  process.exit(code === null ? 1 : code);
});
