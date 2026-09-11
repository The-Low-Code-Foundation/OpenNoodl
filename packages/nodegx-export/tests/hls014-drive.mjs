/**
 * HLS-014 — the second deploy, performed.
 *
 * Run it:  node packages/nodegx-export/tests/hls014-drive.mjs
 *
 * Needs Chrome and a built engine (`npm run build --workspace @noodl/preview`), which is why it is
 * a `.mjs` drive and not a spec: `tests/**\/*.test.ts` skips this extension deliberately, and
 * calling a Chrome-dependent script a CI gate is the mistake this phase filed as C46 and C47.
 * `tests/hls014-redeploy.test.ts` is the millisecond half of the same questions.
 *
 * ## The four arms
 *
 * 1. **AC1 — deploy, change one page, deploy again.** The change is on the live site and nothing
 *    else moved, read out of a real browser both times.
 *
 *    🔴 **The control comes first and it reads zero.** Before arm 1b can claim "the marker is
 *    there", arm 1a establishes that the same instrument, on the same page, reports the marker
 *    ABSENT — otherwise "I found the text I was looking for" is a fact about the search and not
 *    about the deploy. "Nothing else moved" is then not a count: it is the exact string equality
 *    `after === before.replace(original, marker)`, which fails if any other character changed.
 *
 * 2. **AC2 — an abandoned arm.** A deploy is killed part-way, for real, with a signal. A defect
 *    that self-heals is invisible to every arm that completes, so this arm deliberately never
 *    completes: what is graded is the folder it leaves and what the NEXT deploy says about it.
 *
 * 3. **AC3 — what is live, read from the server.** `nodegx live` against the served site, and two
 *    arms where it must refuse: a server serving the *previous* build, and a server serving a page
 *    that names an export it does not hold. The matching arm beside them is the control.
 *
 * 4. **AC4 — a second identical deploy.** Reported as identical, not as a fresh success.
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
const TEMPLATE = path.join(REPO, 'templates/landing-pages');
const MANIFEST = '.nodegx-deploy.json';

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
 * Serve a folder and hand the port to `body`, then tear the server down.
 *
 * Both the browser reading and `nodegx live` need a running server, and they need to be looking at
 * the same one: two servers on two ports serving two copies is a pair of arms that differ by more
 * than the thing under test.
 */
async function withServedFolder(dir, body) {
  const port = await freePort();
  const server = spawn(process.execPath, [NODEGX, 'serve', dir, '--port', String(port)], {
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let serverLog = '';
  server.stdout.on('data', (chunk) => (serverLog += chunk));
  server.stderr.on('data', (chunk) => (serverLog += chunk));
  try {
    // Wait for it to answer rather than sleeping a guessed amount.
    for (let attempt = 0; attempt < 60; attempt++) {
      await wait(150);
      if (/http:\/\/127\.0\.0\.1:/.test(serverLog)) break;
    }
    return await body(port, () => serverLog);
  } finally {
    server.kill('SIGKILL');
  }
}

/**
 * Open a URL in a real headless Chrome and read what it drew.
 *
 * ⚠️ A fresh user-data directory per reading. Two readings sharing a profile share a disk cache,
 * and the second can be looking at the first one's JavaScript — the confusion a fresh-browser
 * control had to rule out in HLS-007 (register row C74). Here it would be fatal: the whole drive
 * is two builds of the same app at the same URL.
 */
async function readInChrome(url, label) {
  const { chrome } = findChrome();
  if (!chrome) throw new Error('No Chrome found. Install Google Chrome or set CHROME_PATH.');
  const cdpPort = await freePort();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), `hls014-${label}-`));
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
    let target = null;
    for (let attempt = 0; attempt < 60 && !target; attempt++) {
      await wait(250);
      try {
        target = (await httpJson(cdpPort, '/json/list')).find((page) => page.type === 'page');
      } catch {
        /* not up yet */
      }
    }
    if (!target) throw new Error(`Chrome never opened a debugging port for ${label}.`);

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
    await client.send('Page.navigate', { url });
    // The deployed runtime boots, fetches its bundles and paints. The same 3.5s the render harness
    // gives a viewer, for the same reason.
    await wait(3500);
    const text = await evaluate(client, 'document.body.innerText');
    const elements = await evaluate(client, 'document.querySelectorAll("div, p, span, a, img").length');
    client.close();
    return { text: String(text ?? ''), elements: Number(elements ?? 0), consoleErrors };
  } finally {
    browser.kill('SIGKILL');
    fs.rmSync(profile, { recursive: true, force: true });
  }
}

/**
 * Find a phrase the live page actually draws, and change it in the project.
 *
 * 🔴 The phrase is chosen from what the BROWSER read, not from what the project holds. A string
 * that is in the project and not on the first page would make arm 1b's "the change is there" a
 * true statement about a page nobody in this drive ever loads — and the arm would fail for the
 * right-looking wrong reason.
 */
function changeOnePage(projectDir, pageText, marker) {
  const phrases = pageText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length >= 12 && line.length <= 60 && !line.includes('"'));

  const componentFiles = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (fs.statSync(full).isDirectory()) walk(full);
      else if (entry.endsWith('.json')) componentFiles.push(full);
    }
  };
  walk(path.join(projectDir, 'components'));

  for (const phrase of phrases) {
    for (const file of componentFiles) {
      const before = fs.readFileSync(file, 'utf8');
      // 🔴 A `text` PARAMETER, not any occurrence of the string. The first version of this
      // matched `"phrase"` anywhere in the file and hit `"label": "Local business"` — a Page
      // node's name in the editor, which is not exported. The project changed, the export was
      // byte-identical, and the drive read "the change is not on the page" and blamed the deploy,
      // which had done exactly the right thing. The phrase came from what the browser DREW, so
      // the file that carries it as a drawn parameter is the one that has to be edited.
      const needle = new RegExp(`"text"\\s*:\\s*"${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`);
      const found = needle.exec(before);
      if (!found) continue;
      fs.writeFileSync(file, before.replace(needle, found[0].replace(`"${phrase}"`, `"${marker}"`)));
      return { phrase, file: path.relative(projectDir, file) };
    }
  }
  throw new Error('No phrase the page drew could be found in the project files. The drive cannot proceed.');
}

async function main() {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'hls014-drive-'));
  const project = path.join(work, 'project');
  const site = path.join(work, 'site');
  fs.cpSync(TEMPLATE, project, { recursive: true });
  log(`work: ${work}\n`);

  // ── AC1 ────────────────────────────────────────────────────────────────────────────────────
  log('1. the first deploy, in a browser');
  const first = await nodegx(['deploy', project, site], work);
  check('deploy exits 0', first.code === 0, `exit ${first.code}`);
  const firstBuild = JSON.parse(fs.readFileSync(path.join(site, MANIFEST), 'utf8'));
  check('it left a complete record', firstBuild.state === 'complete', `${firstBuild.state}, ${firstBuild.buildId}`);

  const before = await withServedFolder(site, (port) => readInChrome(`http://127.0.0.1:${port}/`, 'before'));
  check('the page draws', before.text.length > 200, `${before.text.length} characters, ${before.elements} elements`);
  check('no uncaught exception', before.consoleErrors.length === 0, before.consoleErrors[0] ?? 'none');

  const MARKER = 'HLS014 CHANGED THIS LINE';
  // 🔴 THE CONTROL, and it comes before the change. The instrument must read the marker ABSENT
  // from a page that does not have it, or "the marker is there" afterwards is a fact about the
  // search rather than about the deploy.
  check('control: the marker is NOT on the page before the change', !before.text.includes(MARKER), '0 occurrences');

  log('\n2. one page changed, deployed into the same folder');
  const changed = changeOnePage(project, before.text, MARKER);
  log(`   changed "${changed.phrase}" → "${MARKER}" in ${changed.file}`);

  const second = await nodegx(['deploy', project, site], work);
  const secondSaid = second.stdout + second.stderr;
  check('the redeploy exits 0 with no --force', second.code === 0, `exit ${second.code}`);
  check('it called itself an update', /updated in/.test(secondSaid), secondSaid.match(/.*updated in.*/)?.[0]?.slice(0, 80));
  check(
    '🔴 it removed the previous deploy’s stale files',
    /file\(s\) from the previous deploy removed/.test(secondSaid),
    secondSaid.match(/\s+(\d+) file\(s\) from the previous deploy removed/)?.[1] + ' removed'
  );
  const exports = fs.readdirSync(site).filter((entry) => /^index-.*\.js$/.test(entry));
  check('🔴 exactly one export is left in the folder', exports.length === 1, exports.join(', '));
  const secondBuild = JSON.parse(fs.readFileSync(path.join(site, MANIFEST), 'utf8'));
  check('and the record names a different build', secondBuild.buildId !== firstBuild.buildId, secondBuild.buildId);

  const after = await withServedFolder(site, (port) => readInChrome(`http://127.0.0.1:${port}/`, 'after'));
  check(
    'AC1: the change is on the live page',
    after.text.includes(MARKER),
    after.text.includes(MARKER) ? `"${MARKER}" is on the page` : `"${MARKER}" is NOT on the page`
  );
  // 🔴 Not a count, and not a substring search: the whole page, line by line. The only line
  // allowed to differ is the one the edit was made on. A length that moved by exactly the length
  // of the replacement would pass a subtraction and says nothing about where the change landed.
  const beforeLines = before.text.split('\n');
  const afterLines = after.text.split('\n');
  const moved = [];
  for (let i = 0; i < Math.max(beforeLines.length, afterLines.length); i++) {
    if (beforeLines[i] !== afterLines[i]) moved.push(`${i}: ${JSON.stringify(beforeLines[i])} → ${JSON.stringify(afterLines[i])}`);
  }
  check(
    '🔴 AC1: and NOTHING else moved',
    moved.length === 1 && moved[0].includes(MARKER),
    moved.length === 1
      ? `exactly one line changed, and it is the edited one — ${moved[0].slice(0, 80)}`
      : `${moved.length} lines differ: ${moved.slice(0, 3).join(' | ').slice(0, 200)}`
  );
  check('no uncaught exception', after.consoleErrors.length === 0, after.consoleErrors[0] ?? 'none');

  // ── AC4 ────────────────────────────────────────────────────────────────────────────────────
  log('\n3. AC4 — the same project deployed again, changing nothing');
  const third = await nodegx(['deploy', project, site], work);
  const thirdSaid = third.stdout + third.stderr;
  check('exits 0', third.code === 0, `exit ${third.code}`);
  check(
    '🔴 reported as identical, not as a fresh success',
    /is unchanged/.test(thirdSaid) && !/deployed to/.test(thirdSaid),
    thirdSaid.match(/.*is unchanged.*/)?.[0]?.slice(0, 90)
  );

  // ── AC3 ────────────────────────────────────────────────────────────────────────────────────
  log('\n4. AC3 — what is live, read from the server');
  await withServedFolder(site, async (port) => {
    const url = `http://127.0.0.1:${port}/`;
    const matching = await nodegx(['live', url, '--against', site], work);
    check('the live site IS the build in the folder', matching.code === 0, matching.stdout.trim().split('\n')[0]);
    const bare = await nodegx(['live', url], work);
    check('and with no folder to compare, it still says what is live', bare.code === 0, bare.stdout.trim());
  });

  // 🔴 The refusing arms. Without them the row above is a check that has never said no.
  const stale = path.join(work, 'stale-site');
  fs.cpSync(site, stale, { recursive: true });
  // Roll the served folder back to the FIRST build by deploying the unmodified project into a
  // fresh folder — a server serving yesterday's app while the local folder holds today's.
  const rolledBack = path.join(work, 'rolled-back');
  const revert = fs.readFileSync(path.join(project, changed.file), 'utf8');
  fs.writeFileSync(path.join(project, changed.file), revert.replace(MARKER, changed.phrase));
  await nodegx(['deploy', project, rolledBack], work);
  await withServedFolder(rolledBack, async (port) => {
    const drifted = await nodegx(['live', `http://127.0.0.1:${port}/`, '--against', site], work);
    check(
      '🔴 a server serving the previous build is refused',
      drifted.code === 10,
      `exit ${drifted.code}: ${(drifted.stderr + drifted.stdout).trim().split('\n').pop()?.slice(0, 100)}`
    );
  });

  // A page that names an export the server does not hold — what a cached index.html produces.
  for (const entry of fs.readdirSync(stale)) {
    if (/^index-.*\.js$/.test(entry)) fs.rmSync(path.join(stale, entry));
  }
  await withServedFolder(stale, async (port) => {
    const missing = await nodegx(['live', `http://127.0.0.1:${port}/`], work);
    check(
      '🔴 a page naming an export the server does not hold is refused',
      missing.code === 10 && /blank screen/.test(missing.stderr),
      `exit ${missing.code}`
    );
  });

  // ── AC2 ────────────────────────────────────────────────────────────────────────────────────
  log('\n5. AC2 — a deploy killed part-way, and the deploy after it');
  const abandoned = path.join(work, 'abandoned');
  const killed = await new Promise((resolve) => {
    // 🔴 `detached` so the CLI is its own process GROUP leader. The engine is a child process, and
    // `process.kill(-pid)` without this would address THIS drive's group — killing the drive
    // instead of the deploy, which is a spectacular way to make an interruption test pass.
    const child = spawn(process.execPath, [NODEGX, 'deploy', project, abandoned], {
      cwd: work,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let seen = 0;
    // 🔴 An ABANDONED ARM. Every other arm in this drive completes, and a defect in the
    // half-written state is invisible to all of them. The kill happens once the folder holds
    // something, so that what is left is genuinely part of a site rather than an empty directory.
    const poll = setInterval(() => {
      seen = fs.existsSync(abandoned) ? fs.readdirSync(abandoned).length : 0;
      if (seen >= 3) {
        clearInterval(poll);
        // The engine is a child of the CLI, so the group goes, not just the parent — otherwise the
        // write carries on after the "interruption" and the arm grades a completed deploy.
        try {
          process.kill(-child.pid, 'SIGKILL');
        } catch {
          child.kill('SIGKILL');
        }
      }
    }, 100);
    setTimeout(() => {
      clearInterval(poll);
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch {
        child.kill('SIGKILL');
      }
    }, 60000).unref();
    child.on('close', (code, signal) => {
      clearInterval(poll);
      resolve({ code, signal, seen });
    });
  });
  check('the deploy was killed part-way', killed.signal === 'SIGKILL' || killed.code !== 0, `${killed.seen} entries written when it died`);

  const wreck = fs.existsSync(path.join(abandoned, MANIFEST))
    ? JSON.parse(fs.readFileSync(path.join(abandoned, MANIFEST), 'utf8'))
    : null;
  check('🔴 AC2: the folder says which state it is in', wreck?.state === 'in-progress', `state: ${wreck?.state ?? 'no record at all'}`);

  const recovery = await nodegx(['deploy', project, abandoned], work);
  const recoverySaid = recovery.stdout + recovery.stderr;
  check('🔴 AC2: the next deploy recovers it without --force', recovery.code === 0, `exit ${recovery.code}`);
  check(
    'and says the previous one did not finish',
    /did not finish/.test(recoverySaid),
    recoverySaid.match(/.*did not finish.*/)?.[0]?.slice(0, 90)
  );
  const recovered = JSON.parse(fs.readFileSync(path.join(abandoned, MANIFEST), 'utf8'));
  check('the record is complete again', recovered.state === 'complete', recovered.buildId);

  const healed = await withServedFolder(abandoned, (port) => readInChrome(`http://127.0.0.1:${port}/`, 'recovered'));
  check(
    '🔴 AC2: and the recovered folder renders the app',
    healed.text.length > 200 && !healed.text.includes(MARKER),
    `${healed.text.length} characters, ${healed.elements} elements`
  );

  log(`\n${failures === 0 ? 'ALL GREEN' : `${failures} FAILED`}`);
  log(`work kept at ${work}`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((error) => {
  log(`\nDRIVE ERROR: ${error && error.stack ? error.stack : error}`);
  process.exitCode = 1;
});
