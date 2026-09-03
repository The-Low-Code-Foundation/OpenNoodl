/**
 * DEF-042 drive — two PUTs declaring the same cloud component name, against the BUILT service.
 *
 * The crash is a process-level consequence of an unhandled rejection, so it cannot be measured
 * inside jest: jest installs its own `unhandledRejection` handler and the arm ends up measuring
 * the harness (s43 hit exactly that). This drives `dist/cli.js` as a real child process over
 * real HTTP and reports, for each step, the status code and whether the service is still alive.
 *
 * 🔴 **Build first, and build BOTH arms.** `packages/nodegx-backend/dist/` is gitignored, so the
 * artefact on disk may be days old and carry other people's runtime changes: run
 * `npm run build` in `packages/nodegx-backend` before each arm, or the comparison varies more
 * than the thing under test.
 *
 * Usage:
 *   (cd packages/nodegx-backend && npm run build) && node scripts/devtools/drive-def042-duplicate-component.js
 *
 * Exit 0 = fixed (PUT 2 refused, service alive). Exit 1 = the defect is present.
 */
'use strict';

const { spawn } = require('child_process');
const http = require('http');
const os = require('os');
const path = require('path');
const fs = require('fs');

const REPO = path.resolve(__dirname, '../..');
const CLI = path.join(REPO, 'packages/nodegx-backend/dist/cli.js');
const PORT = 18577;
const TOKEN = 'def042-drive-token';
const DUPLICATE = '/#__cloud__/site/SetSectionAccess';

/** The smallest bundle that declares one cloud component. Two of these collide by name. */
function bundle(componentName) {
  return {
    components: [{ name: componentName, nodes: [], connections: [], ports: [], roots: [] }],
    settings: {},
    metadata: {}
  };
}

function request(method, urlPath, body) {
  return new Promise((resolve) => {
    const payload = body === undefined ? null : Buffer.from(JSON.stringify(body));
    const req = http.request(
      {
        host: '127.0.0.1',
        port: PORT,
        path: urlPath,
        method,
        headers: Object.assign(
          { Authorization: `Bearer ${TOKEN}` },
          payload ? { 'Content-Type': 'application/json', 'Content-Length': payload.length } : {}
        )
      },
      (res) => {
        let text = '';
        res.on('data', (c) => (text += c));
        res.on('end', () => resolve({ status: res.statusCode, body: text.slice(0, 400) }));
      }
    );
    // A dead service answers with a transport error, which is the reading that matters.
    req.on('error', (e) => resolve({ status: 0, body: `TRANSPORT: ${e.code || e.message}` }));
    req.setTimeout(8000, () => {
      req.destroy();
      resolve({ status: 0, body: 'TRANSPORT: timeout' });
    });
    if (payload) req.write(payload);
    req.end();
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'def042-'));
  const child = spawn(
    process.execPath,
    [CLI, 'serve', '--data-dir', dataDir, '--port', String(PORT), '--token', TOKEN, '--ephemeral'],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );

  // ⚠️ BOTH streams. `WorkflowRunner.safeLog` uses `console.log`, so the guard's own
  // "Failed to load workflow" line lands on STDOUT — searching only stderr for it reads as
  // "the guard never ran", which is the exact false negative this drive exists to avoid.
  let output = '';
  let exited = null;
  child.stdout.on('data', (c) => (output += c));
  child.stderr.on('data', (c) => (output += c));
  child.on('exit', (code, signal) => (exited = { code, signal }));

  // Wait for the service to answer at all.
  let up = false;
  for (let i = 0; i < 40 && !exited; i++) {
    const probe = await request('GET', '/admin/status');
    if (probe.status !== 0) {
      up = true;
      break;
    }
    await sleep(250);
  }
  if (!up) {
    console.log('SERVICE NEVER CAME UP. exited=', JSON.stringify(exited), '\nlog:\n', output.slice(0, 2000));
    process.exit(2);
  }

  const rows = [];
  rows.push(['PUT  /admin/workflows/projectA', await request('PUT', '/admin/workflows/projectA', bundle(DUPLICATE))]);
  rows.push(['PUT  /admin/workflows/projectB', await request('PUT', '/admin/workflows/projectB', bundle(DUPLICATE))]);
  // The crash is asynchronous; give the process a moment to die before asking if it is alive.
  await sleep(1200);
  rows.push(['GET  /admin/status (after)', await request('GET', '/admin/status')]);

  console.log('\n=== DEF-042 drive ===');
  for (const [label, r] of rows) {
    console.log(`${label.padEnd(34)} → ${String(r.status).padStart(3)}  ${r.body.replace(/\s+/g, ' ')}`);
  }
  console.log(`\nservice alive at end : ${exited === null ? 'YES' : 'NO'}`);
  console.log(`child exit           : ${exited === null ? '(still running)' : JSON.stringify(exited)}`);
  const duplicateLine = output.split('\n').find((l) => l.includes('Duplicate component name'));
  const guardLine = output.split('\n').find((l) => l.includes('Failed to load workflow'));
  console.log(`log 'Duplicate'      : ${duplicateLine ? duplicateLine.trim().slice(0, 120) : '(none)'}`);
  console.log(`GUARD line in log    : ${guardLine ? guardLine.trim().slice(0, 140) : '(none)'}`);

  // The verdict this drive exists to give.
  const survived = exited === null && rows[2][1].status === 200;
  const refused = rows[1][1].status >= 400 && rows[1][1].status < 600;
  console.log(`\nVERDICT: ${survived && refused ? 'FIXED — PUT 2 refused, service alive' : 'DEFECT PRESENT'}`);

  if (exited === null) child.kill('SIGKILL');
  fs.rmSync(dataDir, { recursive: true, force: true });
  process.exit(survived && refused ? 0 : 1);
}

main();
