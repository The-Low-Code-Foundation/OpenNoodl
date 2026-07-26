#!/usr/bin/env node
/**
 * RUN-004 — packaged-runtime persistence gate.
 *
 * The local backend's origin story is silent data loss: a native SQLite module
 * that never loaded, quietly replaced by an in-memory mock. WF-004 removed the
 * native dependency (the engine is `node:sqlite`, resolved in
 * packages/noodl-runtime/src/api/adapters/local-sql/engine.js) and moved the
 * backend into a child process. That leaves exactly one way this can regress
 * without any unit test noticing: the *binary that runs the service in the
 * packaged app* is not the developer's system Node — it is Electron's bundled
 * Node, launched via `process.execPath` with `ELECTRON_RUN_AS_NODE=1`
 * (see ServiceSupervisor.js). If a future Electron ships without `node:sqlite`,
 * every unit test still passes and users lose their data again.
 *
 * So this gate runs the real service bundle under the real Electron binary, the
 * same way the packaged editor does, and proves a record survives a full
 * process restart:
 *
 *   1. spawn dist/cli.js via the Electron binary (ELECTRON_RUN_AS_NODE=1)
 *   2. assert the READY handshake reports persistence === 'persistent'
 *   3. create a record over the Parse wire
 *   4. SIGTERM the service, restart it against the same data dir
 *   5. read the record back
 *
 * Usage: node scripts/check-packaged-persistence.js
 * Requires: packages/nodegx-backend/dist/cli.js (npm run build in that package).
 */

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const ENTRY = path.join(REPO_ROOT, 'packages', 'nodegx-backend', 'dist', 'cli.js');
const READY_PREFIX = 'NODEGX_BACKEND_READY ';
const READY_TIMEOUT_MS = 30000;

function fail(message) {
  console.error(`\n✗ packaged-persistence check FAILED — ${message}`);
  process.exit(1);
}

function resolveElectronBinary() {
  // `require('electron')` exports the path to the binary in the Node context.
  const binary = require('electron');
  if (typeof binary !== 'string' || !fs.existsSync(binary)) {
    fail('could not resolve the Electron binary (is `npm ci` complete?)');
  }
  return binary;
}

/** Spawn the service the way ServiceSupervisor does and wait for READY. */
function startService(electron, dataDir) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      electron,
      [
        ENTRY,
        'serve',
        '--data-dir',
        dataDir,
        '--port',
        '0',
        '--backend-id',
        'run004-check',
        '--backend-name',
        'RUN-004 packaged persistence check'
      ],
      { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, stdio: ['ignore', 'pipe', 'pipe'] }
    );

    let stdout = '';
    const stderr = [];
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`the service never printed READY.\nstdout:\n${stdout}\nstderr:\n${stderr.join('')}`));
    }, READY_TIMEOUT_MS);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
      const line = stdout.split('\n').find((l) => l.startsWith(READY_PREFIX));
      if (!line) return;
      clearTimeout(timer);
      resolve({ child, ready: JSON.parse(line.slice(READY_PREFIX.length)) });
    });
    child.stderr.on('data', (chunk) => stderr.push(chunk.toString()));
    child.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`the service exited (code ${code}) before READY.\nstdout:\n${stdout}\nstderr:\n${stderr.join('')}`));
    });
  });
}

function stopService(child) {
  return new Promise((resolve) => {
    const kill = setTimeout(() => child.kill('SIGKILL'), 5000);
    child.once('exit', () => {
      clearTimeout(kill);
      resolve();
    });
    child.kill('SIGTERM');
  });
}

async function main() {
  if (!fs.existsSync(ENTRY)) {
    fail(`${path.relative(REPO_ROOT, ENTRY)} not found — run \`npm run build\` in packages/nodegx-backend first`);
  }

  const electron = resolveElectronBinary();
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-run004-'));

  console.log('electron binary :', electron);
  console.log('service bundle  :', path.relative(REPO_ROOT, ENTRY));
  console.log('data dir        :', dataDir);

  // --- run 1: write -------------------------------------------------------
  const first = await startService(electron, dataDir);
  console.log('run 1 READY     :', JSON.stringify(first.ready));

  if (first.ready.persistence !== 'persistent') {
    await stopService(first.child);
    fail(
      `the service came up in "${first.ready.persistence}" mode, not "persistent" ` +
        `(engine: ${first.ready.engine}). The packaged app would silently run without a database.`
    );
  }

  const baseUrl = first.ready.url || `http://127.0.0.1:${first.ready.port}`;
  const createResponse = await fetch(`${baseUrl}/classes/PackagedPersistenceCheck`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ note: 'survives a restart', n: 42 })
  });
  const created = await createResponse.json();
  console.log('create          :', createResponse.status, JSON.stringify(created));
  if (createResponse.status !== 201 || !created.objectId) {
    await stopService(first.child);
    fail(`create did not return a record (HTTP ${createResponse.status})`);
  }

  await stopService(first.child);
  console.log('run 1 stopped   : data dir now holds', fs.readdirSync(dataDir).join(', '));

  // --- run 2: read back ---------------------------------------------------
  const second = await startService(electron, dataDir);
  console.log('run 2 READY     :', JSON.stringify(second.ready));

  const readUrl = second.ready.url || `http://127.0.0.1:${second.ready.port}`;
  const fetchResponse = await fetch(`${readUrl}/classes/PackagedPersistenceCheck/${created.objectId}`);
  const fetched = fetchResponse.status === 200 ? await fetchResponse.json() : null;
  console.log('fetch           :', fetchResponse.status, JSON.stringify(fetched));

  await stopService(second.child);
  fs.rmSync(dataDir, { recursive: true, force: true });

  if (!fetched || fetched.note !== 'survives a restart' || fetched.n !== 42) {
    fail('the record did not survive the restart — persistence is broken under the packaged runtime');
  }

  console.log(`\n✓ packaged-persistence check passed (engine: ${second.ready.engine})`);
}

main().catch((error) => fail(error.message));
