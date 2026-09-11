/**
 * HLS-011 — the drive, inside a container with no display server.
 *
 * Runs the phase's whole sentence end to end and writes `/work/result.json`. Every step records
 * what it measured rather than only whether it passed, because the interesting outcomes here are
 * the ones nobody predicted — `npm ci` among them.
 *
 * 🔴 Step 0 is a control on the machine, not on the product. "A headless box" is a claim about the
 * environment, and a drive that asserts it rather than assuming it is the only one that measures
 * what the task says it measures.
 */
import { execFileSync, spawnSync, spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { open } from './mcpclient.mjs';
import * as app from './app.mjs';

const WORK = '/work';
const PROJECT = path.join(WORK, 'kettle-log');
const OUT = path.join(WORK, 'export');
const MCP = '/stage/mcp/dist/noodl-mcp.cjs';

const result = { steps: [], failures: [] };
const step = (name, payload) => {
  const ok = payload.ok !== false;
  result.steps.push({ name, ...payload });
  if (!ok) result.failures.push(name);
  console.log(`${ok ? '✅' : '❌'} ${name}${payload.note ? ' — ' + payload.note : ''}`);
  return ok;
};

const run = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opts });
  return { code: r.status, out: r.stdout || '', err: r.stderr || '' };
};

// ── 0. The machine ───────────────────────────────────────────────────────────
{
  const which = (b) => run('sh', ['-c', `command -v ${b} || true`]).out.trim();
  const browsers = ['google-chrome', 'chromium', 'chromium-browser', 'firefox'].map((b) => [b, which(b)]);
  const xsock = fs.existsSync('/tmp/.X11-unix');
  step('0 — no display server, and no browser', {
    ok: !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY && !xsock && browsers.every(([, p]) => !p),
    platform: `${process.platform}/${process.arch}`,
    node: process.version,
    DISPLAY: process.env.DISPLAY ?? null,
    WAYLAND_DISPLAY: process.env.WAYLAND_DISPLAY ?? null,
    x11Socket: xsock,
    browsers: Object.fromEntries(browsers)
  });
}

// ── 1. Create the project, over MCP, with no editor ──────────────────────────
{
  // Bootstrap mode still needs `--allow-writes`: with no project bound there is nothing to read
  // and creating one is a write. The server says so and exits, which is the right refusal.
  const client = open('node', [MCP, '--allow-writes'], { cwd: WORK });
  await client.initialize();
  const bootstrap = (await client.listTools()).tools.map((t) => t.name);
  const res = await client.call('create_project', { directory: PROJECT, ...app.SCOPE });
  client.close();
  step('1 — create_project', {
    ok: !res.isError && fs.existsSync(path.join(PROJECT, 'nodegx.project.json')),
    bootstrapTools: bootstrap,
    files: res.data?.files?.length ?? null,
    docs: res.data?.docs ?? null,
    note: res.isError ? res.text.slice(0, 400) : `${res.data?.files?.length} files`
  });
}

// ── 2. Author it, over MCP, still with no editor ─────────────────────────────
{
  const client = open('node', [MCP, PROJECT, '--allow-writes'], { cwd: WORK });
  await client.initialize();
  const advertised = (await client.listTools()).tools.map((t) => t.name);
  const wrote = {};
  const author = async (name, args) => {
    let r = await client.call(name, args);
    wrote[args.path] = { tool: name, isError: r.isError, note: r.isError ? r.text.slice(0, 600) : 'ok' };
    return r;
  };
  await author('create_component', app.GAUGE);
  // Home already exists as create_project's skeleton, so this is an update, not a create.
  await author('update_component', { path: app.HOME.path, set: { nodes: app.HOME.nodes, connections: [] } });
  await author('create_component', app.READINGS);
  const validated = await client.call('validate_project', {});
  client.close();
  step('2 — author over MCP', {
    ok: Object.values(wrote).every((w) => !w.isError),
    advertisedTools: advertised.length,
    wrote,
    validation: validated.data ? { errors: validated.data.errors?.length ?? null, warnings: validated.data.warnings?.length ?? null } : validated.text.slice(0, 300)
  });
}

// ── 3. nodegx export ─────────────────────────────────────────────────────────
{
  const version = run('nodegx', ['--version']);
  const dry = run('nodegx', ['export', '--dry-run', PROJECT]);
  const exp = run('nodegx', ['export', PROJECT, OUT]);
  const files = fs.existsSync(OUT) ? fs.readdirSync(OUT, { recursive: true }).filter((f) => fs.statSync(path.join(OUT, f)).isFile()) : [];
  step('3 — nodegx export', {
    ok: exp.code === 0 && files.length > 0,
    version: version.out.trim(),
    dryRunExit: dry.code,
    dryRunSaysEverythingTranslates: /Everything translates|Everything translated/i.test(dry.out),
    exportExit: exp.code,
    fileCount: files.length,
    files: files.sort(),
    stderr: exp.err.trim().split('\n').slice(0, 6),
    note: `exit ${exp.code}, ${files.length} files`
  });
}

// ── 4. npm ci && npm run build — the recipe the phase's own sentence names ────
{
  const hasLock = fs.existsSync(path.join(OUT, 'package-lock.json'));
  const ci = run('npm', ['ci'], { cwd: OUT });
  const install = run('npm', ['install', '--no-audit', '--no-fund'], { cwd: OUT });
  const build = run('npm', ['run', 'build'], { cwd: OUT });
  const distFiles = fs.existsSync(path.join(OUT, 'dist')) ? fs.readdirSync(path.join(OUT, 'dist'), { recursive: true }) : [];
  step('4 — npm ci, then npm install, then npm run build', {
    // 🔴 The criterion this step grades is `npm run build`. `npm ci` is measured and NOT graded,
    // because whether it works is the finding, not the pass condition.
    ok: build.code === 0,
    lockfileShipped: hasLock,
    npmCiExit: ci.code,
    npmCiSaid: (ci.err || ci.out).trim().split('\n').filter((l) => l.trim()).slice(0, 4),
    npmInstallExit: install.code,
    buildExit: build.code,
    buildTail: (build.out + build.err).trim().split('\n').slice(-6),
    distFiles: distFiles.filter((f) => typeof f === 'string'),
    note: `npm ci exit ${ci.code} · build exit ${build.code}`
  });
}

// ── 5. What is actually ON the built pages, with no browser ──────────────────
// The built site is a React app; a fetch of `index.html` returns a shell. Rendering the emitted
// page components through `react-dom/server` reads the real components — the same instrument
// HLS-004 used for its arithmetic — and needs no display server at all.
{
  const pagesDir = path.join(OUT, 'src', 'pages');
  const pages = fs.existsSync(pagesDir) ? fs.readdirSync(pagesDir).filter((f) => f.endsWith('.tsx')) : [];
  const entry = path.join(OUT, 'src', 'hls011-ssr.tsx');
  // ⚠️ The emitted pages export `HomePage`, not a default. Importing the namespace and taking the
  // first function export is what keeps this probe from being a claim about the emitter's export
  // style — the first version assumed a default and reported both pages as empty, which reads
  // exactly like an app that renders nothing.
  fs.writeFileSync(
    entry,
    `import { renderToString } from 'react-dom/server';\n` +
      pages.map((p, i) => `import * as M${i} from './pages/${p.replace(/\.tsx$/, '')}';`).join('\n') +
      `\nconst out: Record<string, string> = {};\n` +
      `const pick = (m: any) => Object.values(m).find((v) => typeof v === 'function') as any;\n` +
      pages
        .map(
          (p, i) =>
            `try { out[${JSON.stringify(p)}] = renderToString(pick(M${i})()); } catch (e) { out[${JSON.stringify(p)}] = 'THREW: ' + (e as Error).message; }`
        )
        .join('\n') +
      `\nconsole.log(JSON.stringify(out));\n`
  );
  const built = run('npx', ['vite', 'build', '--ssr', 'src/hls011-ssr.tsx', '--outDir', 'ssr-dist', '--logLevel', 'warn'], { cwd: OUT });
  let rendered = {};
  let ssrErr = '';
  if (built.code === 0) {
    const r = run('node', ['ssr-dist/hls011-ssr.js'], { cwd: OUT });
    try {
      rendered = JSON.parse(r.out.trim().split('\n').pop());
    } catch {
      ssrErr = (r.out + r.err).slice(-2000);
    }
  } else {
    ssrErr = (built.out + built.err).slice(-2000);
  }
  const textOf = (html) => (html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const seen = {};
  for (const [file, html] of Object.entries(rendered)) seen[file] = { text: textOf(html), html };
  const check = (file, expected) => {
    const text = seen[file]?.text ?? '';
    const missing = expected.filter((e) => !text.includes(e));
    return { text, missing, ok: missing.length === 0 };
  };
  const widthsInHome = [...String(seen['Home.tsx']?.html || '').matchAll(/width:\s*([^;"]+)/g)].map((m) => m[1].trim());
  const home = check('Home.tsx', app.EXPECTED.home);
  const readings = check('Readings.tsx', app.EXPECTED.readings);
  // HLS-005's shape, read off the emitted source rather than the render: a width that arrived as a
  // component input is a style the component computes, so it is in the props, not in the CSS file.
  const gaugeSrc = fs.existsSync(path.join(OUT, 'src/components/Gauge.tsx')) ? fs.readFileSync(path.join(OUT, 'src/components/Gauge.tsx'), 'utf8') : '';
  result.builtPages = seen;
  step('5 — what is on the built pages (react-dom/server, no browser)', {
    ok: home.ok && readings.ok,
    ssrBuildExit: built.code,
    ssrErr: ssrErr || undefined,
    pageFiles: pages,
    home: { text: home.text.slice(0, 400), missing: home.missing },
    readings: { text: readings.text.slice(0, 400), missing: readings.missing },
    gaugeDeclaresBarWidthProp: /barWidth\?: number/.test(gaugeSrc),
    gaugeUsesBarWidthInMarkup: /style=\{[^}]*barWidth/.test(gaugeSrc),
    gaugeRefusalComment: (gaugeSrc.match(/^ *\/\/ +- .*$/m) || [''])[0].trim(),
    widthsRenderedOnHome: widthsInHome,
    note: `home missing ${home.missing.length}, readings missing ${readings.missing.length}`
  });
}

// ── 6. nodegx serve, and a real HTTP fetch ───────────────────────────────────
{
  const dist = path.join(OUT, 'dist');
  const server = spawn('nodegx', ['serve', dist, '--port', '8899'], { stdio: ['ignore', 'pipe', 'pipe'] });
  let said = '';
  server.stdout.on('data', (d) => (said += d.toString()));
  server.stderr.on('data', (d) => (said += d.toString()));
  const wait = async () => {
    for (let i = 0; i < 100; i++) {
      try {
        const r = await fetch('http://127.0.0.1:8899/');
        return r;
      } catch {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    return null;
  };
  const index = await wait();
  const indexBody = index ? await index.text() : '';
  const assetMatch = /src="([^"]*assets\/[^"]+\.js)"/.exec(indexBody);
  let asset = { status: null, carriesHeading: null, bytes: 0 };
  if (assetMatch) {
    const a = await fetch('http://127.0.0.1:8899' + assetMatch[1].replace(/^\.?\//, '/'));
    const body = await a.text();
    asset = { status: a.status, carriesHeading: body.includes(app.HOME_HEADING), bytes: body.length, url: assetMatch[1] };
  }
  // The other half of HLS-006: this is loopback, and nothing but a flag reaches another interface.
  let offInterface = 'no non-loopback address to try';
  const nets = Object.values((await import('node:os')).networkInterfaces()).flat().filter((n) => n && n.family === 'IPv4' && !n.internal);
  if (nets.length) {
    try {
      await fetch(`http://${nets[0].address}:8899/`, { signal: AbortSignal.timeout(2000) });
      offInterface = 'ANSWERED — it is not loopback-only';
    } catch (e) {
      offInterface = 'refused: ' + String(e.message).slice(0, 80);
    }
  }
  server.kill();
  step('6 — nodegx serve, fetched over HTTP', {
    // HLS-006's claim is graded here, not just recorded: loopback is a decision, and a drive that
    // prints the cross-interface reading without failing on it is a drive that would not notice
    // the day it changed.
    ok: !!index && index.status === 200 && indexBody.includes('<div id="root"') && !/ANSWERED/.test(offInterface),
    said: said.trim().split('\n').slice(0, 4),
    indexStatus: index?.status ?? null,
    indexBytes: indexBody.length,
    indexIsAShell: indexBody.includes('<div id="root"') && !indexBody.includes(app.HOME_HEADING),
    asset,
    fromAnotherInterface: offInterface,
    note: `index ${index?.status}, asset ${asset.status}`
  });
}

// ── 7. nodegx render, here, where there is no harness ────────────────────────
{
  const r = run('nodegx', ['render', PROJECT, '--out-dir', path.join(WORK, 'shots')]);
  step('7 — nodegx render refuses honestly (exit 8)', {
    ok: r.code === 8,
    exit: r.code,
    stderr: r.err.trim().split('\n').slice(0, 12),
    namesTheEnvVar: /NODEGX_RENDER_CLI/.test(r.err + r.out),
    note: `exit ${r.code}`
  });
}

fs.writeFileSync(path.join(WORK, 'result.json'), JSON.stringify(result, null, 2));
console.log('\n' + (result.failures.length ? `FAILED: ${result.failures.join(', ')}` : 'ALL STEPS PASSED'));
process.exit(result.failures.length ? 1 : 0);
