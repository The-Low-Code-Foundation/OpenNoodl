/**
 * HLS-015 AC1 — the deployed folder renders in a real browser, and a blank one does not.
 *
 * Run it:  node packages/nodegx-export/tests/hls015-drive.mjs
 *
 * ## 🔴 Why this is a `.mjs` drive and not a spec
 *
 * It needs Chrome. `tests/**\/*.test.ts` and `tsconfig.json`'s `tests/**\/*.ts` both skip this
 * extension deliberately — calling a Chrome-dependent script a CI gate is the mistake this phase
 * already made twice and filed as register rows C46 and C47. `hls007-drive.ts` and
 * `tests/hls011/` are here on the same terms.
 *
 * ## The three readings, and why the second one is the whole drive
 *
 * 1. **`nodegx deploy` writes a folder, and that folder renders the app in Chrome.** Not
 *    "resolves", not "wrote eight files" — *renders*. HLS-010's spike deliberately stopped short
 *    of this and said so; it is the criterion the task turns on.
 *
 * 2. 🔴 **The same folder, with every `roots` array emptied, renders NOTHING.** This is register
 *    row **C67** performed rather than reasoned about. C67 says an export made with an unpopulated
 *    node library keeps every component, every node and **93 of 93 connections** and empties
 *    `roots`, and that `ComponentInstanceNode.render()` then returns `null`. Every word of that
 *    was established by reading code and counting fields. Nobody had ever put the resulting folder
 *    in a browser. Arm 2 does, by editing the **artefact** — no rebuild, no mutated source — so the
 *    two arms differ by exactly the field the refusal is built on.
 *
 *    Without it, arm 1 is a page that renders and proves nothing about the guard: a reading that
 *    fits is not a reading that excludes. With it, arm 1's text is the thing arm 2 is missing.
 *
 * 3. **The engine's own reading agrees with the browser on both arms.** `readDeployedRoots` is what
 *    the refusal is computed from, so if it disagreed with what Chrome draws, the refusal would be
 *    correct about a number and wrong about an app.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..', '..');

const { findChrome, freePort, connect, evaluate, httpJson } = require(
  path.join(REPO, 'scripts/devtools/render-report.js')
);

const NODEGX = path.join(REPO, 'packages/nodegx-export/dist/cli.mjs');
const PROJECT = path.join(REPO, 'templates/landing-pages');

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const log = (line) => process.stdout.write(`${line}\n`);

let failures = 0;
function check(name, ok, detail) {
  log(`${ok ? '  ✓' : '  ✕'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

/** Run the `nodegx` binary and hand back its streams and status. */
function nodegx(args, cwd) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [NODEGX, ...args], { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

/**
 * Serve a folder, open it in Chrome, read the page, tear both down.
 *
 * ⚠️ A fresh user-data directory per arm. Two arms sharing a profile share a disk cache, and the
 * second one can be looking at the first one's JavaScript — which is exactly the confusion a
 * fresh-browser control had to rule out in HLS-007 (register row C74).
 */
async function renderFolder(dir, label) {
  const { chrome } = findChrome();
  if (!chrome) throw new Error('No Chrome found. Install Google Chrome or set CHROME_PATH.');

  const servePort = await freePort();
  const cdpPort = await freePort();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), `hls015-${label}-`));

  const server = spawn(process.execPath, [NODEGX, 'serve', dir, '--port', String(servePort)], {
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let serverLog = '';
  server.stdout.on('data', (chunk) => (serverLog += chunk));
  server.stderr.on('data', (chunk) => (serverLog += chunk));

  const browser = spawn(chrome, [
    '--headless=new',
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    'about:blank'
  ]);

  try {
    // Wait for both to answer rather than sleeping a guessed amount at each.
    let target = null;
    for (let attempt = 0; attempt < 60 && !target; attempt++) {
      await wait(250);
      try {
        const list = await httpJson(cdpPort, '/json/list');
        target = list.find((page) => page.type === 'page');
      } catch {
        /* not up yet */
      }
    }
    if (!target) throw new Error(`Chrome never opened a debugging port for ${label}.\n${serverLog}`);

    const consoleErrors = [];
    const client = await connect(target.webSocketDebuggerUrl, (message) => {
      if (message.method === 'Runtime.exceptionThrown') {
        consoleErrors.push(
          message.params.exceptionDetails?.exception?.description ?? message.params.exceptionDetails?.text
        );
      }
    });
    await client.send('Runtime.enable', {});
    await client.send('Page.enable', {});
    await client.send('Page.navigate', { url: `http://127.0.0.1:${servePort}/` });
    // The deployed runtime boots, fetches its bundles and paints. The same 3.5s the render harness
    // gives a viewer, for the same reason.
    await wait(3500);

    const text = await evaluate(client, 'document.body.innerText');
    const elements = await evaluate(client, 'document.querySelectorAll("div, p, span, a, img").length');
    const html = await evaluate(client, 'document.body.innerHTML.length');
    client.close();
    return { text: String(text ?? ''), elements: Number(elements ?? 0), html: Number(html ?? 0), consoleErrors, serverLog };
  } finally {
    browser.kill('SIGKILL');
    server.kill('SIGKILL');
    fs.rmSync(profile, { recursive: true, force: true });
  }
}

/**
 * Empty every `roots` array in a written deploy, in place.
 *
 * 🔴 This is C67's shape applied to the ARTEFACT. The alternative — mutating
 * `noodl-preview/src/deploy.ts` and rebuilding — makes the two arms differ by a source edit and a
 * 6 MB rebuild, and a control whose arms differ by more than the thing under test is not a control.
 * Here they differ by one field.
 *
 * @returns how many arrays it emptied. Zero means the mutation did not fire, which must fail the
 *          drive rather than quietly making arm 2 a duplicate of arm 1.
 */
function emptyEveryRoot(dir) {
  let emptied = 0;
  const strip = (file) => {
    const before = fs.readFileSync(file, 'utf8');
    // `"roots":[ … ]` with no nested brackets — roots hold node ids, which are strings.
    const after = before.replace(/"roots":\s*\[[^\]]*\]/g, (match) => {
      if (match.replace(/\s/g, '') === '"roots":[]') return match;
      emptied++;
      return '"roots":[]';
    });
    if (after !== before) fs.writeFileSync(file, after);
  };

  for (const entry of fs.readdirSync(dir)) {
    if (/^index-.*\.js$/.test(entry)) strip(path.join(dir, entry));
  }
  const bundles = path.join(dir, 'noodl_bundles');
  if (fs.existsSync(bundles)) {
    for (const entry of fs.readdirSync(bundles)) strip(path.join(bundles, entry));
  }
  return emptied;
}

async function main() {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'hls015-drive-'));
  const project = path.join(work, 'project');
  const good = path.join(work, 'good');
  const blank = path.join(work, 'blank');

  // 🔴 A copy, never the original. `deployToFolder` does not set `_isReadOnly` (register row C69)
  // and this drive is not the place to find out that it started mattering.
  fs.cpSync(PROJECT, project, { recursive: true });

  log('HLS-015 AC1 — does the folder render?');
  log(`  project: ${PROJECT}`);
  log('');

  log('1. nodegx deploy, run from a directory that is neither the repo nor the project');
  const deployed = await nodegx(['deploy', project, good], work);
  check('exit 0', deployed.code === 0, `exit ${deployed.code}`);
  if (deployed.code !== 0) {
    log(deployed.stderr);
    process.exit(1);
  }
  log(`     ${deployed.stdout.trim().split('\n')[0]}`);

  log('');
  log('2. the good arm in Chrome');
  const goodRender = await renderFolder(good, 'good');
  const goodText = goodRender.text.replace(/\s+/g, ' ').trim();
  check('the page has text', goodText.length > 0, `${goodText.length} characters`);
  check('the page has elements', goodRender.elements > 5, `${goodRender.elements} elements`);
  check('no uncaught exception', goodRender.consoleErrors.length === 0, goodRender.consoleErrors[0] ?? 'none');
  log(`     text: ${JSON.stringify(goodText.slice(0, 160))}`);

  log('');
  log('3. the same folder with every `roots` emptied — register row C67, in a browser');
  fs.cpSync(good, blank, { recursive: true });
  const emptied = emptyEveryRoot(blank);
  // 🔴 Arming the instrument. An arm-2 that changed nothing renders identically to arm 1 and reads
  // as "the guard is unnecessary" — the most persuasive possible zero.
  check('the mutation fired', emptied > 0, `${emptied} roots arrays emptied`);
  if (emptied === 0) process.exit(1);

  const blankRender = await renderFolder(blank, 'blank');
  const blankText = blankRender.text.replace(/\s+/g, ' ').trim();
  check('the page has NO text', blankText.length === 0, JSON.stringify(blankText.slice(0, 80)));
  check(
    'and arm 1 is not trivially the same page',
    goodText.length > 0 && goodText !== blankText,
    `${goodText.length} vs ${blankText.length} characters`
  );

  log('');
  log('4. the engine reads the two folders the way the browser draws them');
  // 🔴 Read through the SPIKE's instrument, not through the engine's own. `readDeployedRoots` is
  // the function the refusal is computed from, so asking it whether the refusal was right is
  // asking a claim to check itself. `hls010-spike/measure-deploy.js` is an independent
  // implementation of the same count, written before this command existed.
  const measure = path.join(REPO, 'dev-docs/tasks/phase-83-behind-a-click/hls010-spike/measure-deploy.js');
  const read = (dir) =>
    new Promise((resolve) => {
      const child = spawn(process.execPath, [measure, dir], { stdio: ['ignore', 'pipe', 'pipe'] });
      let out = '';
      child.stdout.on('data', (chunk) => (out += chunk));
      child.on('close', () => resolve(out));
    });
  const goodRoots = await read(good);
  const blankRoots = await read(blank);
  const withRoots = (text) => Number(/roots\s*:\s*(\d+) component/.exec(text)?.[1] ?? -1);
  check('good arm: components with a root', withRoots(goodRoots) > 0, `${withRoots(goodRoots)}`);
  check('blank arm: components with a root', withRoots(blankRoots) === 0, `${withRoots(blankRoots)}`);

  log('');
  log(failures === 0 ? `ALL GREEN — ${work}` : `${failures} FAILED — ${work}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  log(`DRIVE THREW: ${error && error.stack ? error.stack : error}`);
  process.exit(1);
});
