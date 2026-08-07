#!/usr/bin/env node
/**
 * POL-013 — the `IconSize` census.
 *
 * `Icon.module.scss` declares no `is-size-*` rule, so `size={IconSize.Large}`
 * has been a no-op at every call site in the codebase. Adding the four rules is
 * four lines; the *task* is that those four lines change every icon in the
 * editor at once, and there is no incremental landing. Criterion 2 — "a
 * both-theme sweep shows no unintended size change" — is therefore the work,
 * and it is only answerable if the before is a **measurement**.
 *
 * This is that measurement. It walks the editor's surfaces and records, for
 * every rendered `Icon`, the box it actually occupies and enough identity to
 * find it again after the rules land:
 *
 *   - the measured `getBoundingClientRect` of the `Icon` root span;
 *   - the glyph, identified by its `viewBox` and its intrinsic `width`/`height`
 *     — this is what determines the box today, and what criterion 4 says must
 *     stop determining it;
 *   - the `is-size-*` class present (today: none, because `css[size]` resolves
 *     to `undefined` when the module declares no such class, and `classNames`
 *     drops it — so the DOM does not even carry the declaration);
 *   - whether some **host** rule is already sizing the glyph, which matters
 *     because a host override outranks the component and those call sites will
 *     not move when the rules land. Detected by comparing the computed
 *     width/height against the intrinsic attributes.
 *
 * The key each icon is filed under is `panel + DOM path + viewBox`, so two runs
 * of the same surfaces line up row by row and the diff is per-icon rather than
 * per-screenshot.
 *
 * ## Usage
 *
 *   # 1. before — against HEAD, with the editor up and a project open
 *   node packages/noodl-editor/scripts/pol39-live/pol013-icon-census.js \
 *     --out=<dir>/before.json --theme=dark
 *
 *   # 2. after — same command against the build with the rules in
 *   node .../pol013-icon-census.js --out=<dir>/after.json --theme=dark
 *
 *   # 3. the diff, which is the criterion
 *   node .../pol013-icon-census.js --diff=<dir>/before.json,<dir>/after.json
 *
 *     --theme=dark|light   sets the theme declaratively before walking
 *     --json               print the full census rather than the summary
 *
 * ## Traps
 *
 * - **A panel that is hidden is not unmounted** (OBS-003). `offsetParent` is
 *   null for those and their boxes read 0×0, which would diff as "shrank to
 *   nothing". Zero-box icons are recorded with `visible: false` and excluded
 *   from the change count rather than dropped, so a panel that stops rendering
 *   entirely is still visible in the census.
 * - **HMR will not restyle a mounted panel.** Restart the stack between the
 *   before and after runs; do not trust a hot-reloaded measurement.
 * - The rail walk clicks every discovered panel button, which changes what is
 *   mounted. Both runs walk in the same discovered order, so both see the same
 *   set — but a run that errors halfway leaves a partial census, and the diff
 *   says so rather than treating the missing rows as unchanged.
 * - **Every run litters the launcher.** Opening the throwaway copy adds it to
 *   the recent-projects list, which is stored outside the repo
 *   (`~/Library/Application Support/NodeGX/recently_opened_project.json`) and
 *   survives the temp directory being deleted. Eight runs of this census plus
 *   the fifth session's drivers had left **31** dead "Shine Phase 2" cards in
 *   Richard's launcher. This script deletes its own copy on the way out; the
 *   store entry it cannot reach from here, so prune by the `/T/pol0NN-` path
 *   prefix when you are done driving.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const { appTarget, connect, evaluate, elementCentre, dispatchClick } = require('../../../../scripts/devtools/cdp');

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const FIXTURE_PROJECT = path.join(REPO_ROOT, 'packages/noodl-editor/tests/testfs/git-repo-utf8');

const PROBE = `(() => {
  if (!window.__pol013wr) {
    window.webpackChunknoodl_editor.push([['pol013'], {}, (r) => (window.__pol013wr = r)]);
  }
  return typeof window.__pol013wr === 'function';
})()`;

const REQ = (id) => `window.__pol013wr(${JSON.stringify(id)})`;

const M = {
  project: './src/editor/src/models/projectmodel.ts',
  platform: '../noodl-platform/src/index.ts',
  app: './src/editor/src/models/app.ts',
  theme: './src/editor/src/models/ThemeManager.ts'
};

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const has = (name) => args.includes(`--${name}`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Collect every Icon in the current DOM.
 *
 * An Icon root is the span the component renders — matched on the CSS-module
 * class (`[name]__[local]--[hash]`, so `Icon-module__Root`) rather than on
 * "span with an svg child", which would also sweep up the dozen hand-rolled
 * inline SVGs that are not this component's business.
 */
const CENSUS = `(() => {
  const domPath = (el) => {
    const parts = [];
    for (let n = el; n && n.nodeType === 1 && parts.length < 8; n = n.parentElement) {
      const parent = n.parentElement;
      const idx = parent ? Array.prototype.indexOf.call(parent.children, n) : 0;
      // The class prefix before the module hash is stable across rebuilds; the
      // hash is not, so it is deliberately cut off.
      const cls = (n.className && typeof n.className === 'string' ? n.className : '')
        .split(/\\s+/)
        .map((c) => c.split('--')[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('.');
      parts.unshift(n.tagName.toLowerCase() + (cls ? '.' + cls : '') + ':' + idx);
    }
    return parts.join(' > ');
  };

  const roots = Array.from(document.querySelectorAll('[class*="Icon-module__Root"]'));
  return roots.map((el) => {
    const svg = el.querySelector('svg');
    const rect = el.getBoundingClientRect();
    const sizeClass = (el.className.match(/is-size-[a-z]+/) || [null])[0];
    const iw = svg ? parseFloat(svg.getAttribute('width')) : NaN;
    const ih = svg ? parseFloat(svg.getAttribute('height')) : NaN;
    return {
      path: domPath(el),
      viewBox: svg ? svg.getAttribute('viewBox') : null,
      intrinsicW: svg ? svg.getAttribute('width') : null,
      intrinsicH: svg ? svg.getAttribute('height') : null,
      w: Math.round(rect.width * 100) / 100,
      h: Math.round(rect.height * 100) / 100,
      // Is the box the SVG file's intrinsic size, or has a HOST rule already
      // taken it over? This cannot be read off getComputedStyle — that returns
      // the *used* width, a px number, for an unsized block span as much as for
      // a sized one. Comparing the measured box against the file's own
      // attributes is the only question that distinguishes them, and it is
      // exactly criterion 4's question.
      intrinsicDriven: Number.isFinite(iw) && Math.abs(rect.width - iw) < 0.5 && Math.abs(rect.height - ih) < 0.5,
      sizeClass,
      visible: el.offsetParent !== null && rect.width > 0 && rect.height > 0
    };
  });
})()`;

const SET_THEME = (theme) => `(() => {
  document.documentElement.setAttribute('data-theme', ${JSON.stringify(theme)});
  window.dispatchEvent(new CustomEvent('nodegx:themechanged', { detail: { theme: ${JSON.stringify(theme)} } }));
  return document.documentElement.getAttribute('data-theme');
})()`;

const IN_EDITOR = `!!(document.querySelector('canvas') && document.querySelector('[data-test]'))`;

/**
 * Kill every animation and transition before measuring.
 *
 * The first run of this census reported boxes of `0.27x0.27`, `3.91x3.91`,
 * `11.89x11.89` — a spread of fractional sizes that no icon has. They were
 * icons caught **mid-transition**, inside a popup scaling in. A measurement
 * instrument that measures animation frames produces a different answer every
 * run and would have made the before/after diff meaningless. Same determinism
 * stylesheet the UIX-009 corpus harness injects, and for the same reason.
 */
const DETERMINISM = `(() => {
  const ID = 'pol013-determinism';
  document.getElementById(ID)?.remove();
  const style = document.createElement('style');
  style.id = ID;
  style.textContent = \`*, *::before, *::after {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    transition-duration: 0s !important;
    transition-delay: 0s !important;
    caret-color: transparent !important;
  }\`;
  document.head.appendChild(style);
  return true;
})()`;

const RAIL_BUTTONS = `Array.from(document.querySelectorAll('[data-test]'))
  .filter(el => el.offsetParent !== null && /nav|sidebar|panel|rail|toolbar/i.test(el.className + ' ' + (el.closest('[class]')?.className||'')))
  .map(el => el.getAttribute('data-test'))
  .filter((v,i,a)=>v && a.indexOf(v)===i)`;

/** One surface's worth of icons, keyed so two runs line up. */
function keyed(surface, rows) {
  const out = {};
  const seen = new Map();
  for (const r of rows) {
    // Path + viewBox is unique for all but repeated list rows; a counter
    // disambiguates those in stable DOM order.
    const base = `${surface}|${r.path}|${r.viewBox || '?'}`;
    const n = (seen.get(base) || 0) + 1;
    seen.set(base, n);
    out[n === 1 ? base : `${base}#${n}`] = r;
  }
  return out;
}

async function waitFor(client, expr, { timeoutMs = 30000, what = 'condition' } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await evaluate(client, expr)) return true;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await sleep(400);
  }
}

/**
 * The launcher's "Open project" control is **icon-only** — POL-002/POL-003 left
 * it with a `data-test` and no text node — so the older pol39 drivers'
 * `clickButtonWithText('Open project')` no longer finds it and fails with "no
 * button reading …". Click the test id, and keep the text match as the fallback
 * for whichever surface still has a label.
 */
async function clickControl(client, { testId, label }) {
  const box = await evaluate(
    client,
    `(() => {
       const byTest = ${JSON.stringify(testId || '')} && document.querySelector('[data-test="' + ${JSON.stringify(testId || '')} + '"]');
       const el = (byTest && byTest.offsetParent !== null ? byTest : null) ||
         Array.from(document.querySelectorAll('button, [role="button"]'))
           .find((b) => b.offsetParent !== null && b.innerText.trim() === ${JSON.stringify(label || '')});
       if (!el) return null;
       const r = el.getBoundingClientRect();
       return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
     })()`
  );
  if (!box) throw new Error(`no control matching ${testId || label}`);
  await dispatchClick(client, box);
}

/**
 * Open a throwaway copy of the fixture — the editor autosaves what it opens.
 *
 * It always LEAVES first. A dev launch opens whatever project was last open, so
 * a census that accepted "a project is open" measured a different project on
 * every run — the first run of this instrument silently censused Richard's
 * "Shine Phase 2" with a preview overlay on screen, which is not a corpus you
 * can diff against anything.
 */
async function leaveProject(client) {
  const open = await evaluate(
    client,
    `(() => {
       const p = ${REQ(M.project)}.ProjectModel && ${REQ(M.project)}.ProjectModel.instance;
       return p ? (p._retainedProjectDirectory || 'unknown') : '';
     })()`
  );
  if (!open) return;
  await evaluate(client, `(() => { ${REQ(M.app)}.App.instance.exitProject(); return true; })()`);
  // Wait for the launcher to be RENDERED, not merely for the editor to be gone.
  // `!document.querySelector('[data-panel-id]')` — the older drivers' condition —
  // is true during the gap between the two, and a census taken in that gap
  // reported a launcher with zero icons.
  await waitFor(client, `(() => !!document.querySelector('[data-test="launcher-open-project"]'))()`, {
    what: 'the launcher to render'
  });
  await sleep(1500);
}

async function openProject(client, dir) {
  await evaluate(
    client,
    `(() => { ${REQ(M.platform)}.filesystem.openDialog = async () => ${JSON.stringify(dir)}; return true; })()`
  );
  await clickControl(client, { testId: 'launcher-open-project', label: 'Open project' });
  await waitFor(
    client,
    `(() => {
       const p = ${REQ(M.project)}.ProjectModel && ${REQ(M.project)}.ProjectModel.instance;
       return !!(p && p._retainedProjectDirectory);
     })()`,
    { timeoutMs: 90000, what: 'the project to open' }
  );
  await sleep(4000);
}

/** Fixed viewport, so "does this row overflow" has one answer per run. */
const WIDTH = 1600;
const HEIGHT = 1000;

async function census({ theme }) {
  const target = await appTarget('editor');
  const client = await connect(target);
  await waitFor(client, PROBE, { what: 'the webpack require shim' });

  // Pin the viewport before measuring anything.
  //
  // Without it two baseline runs of this census disagreed: one reported 47
  // icons squeezed below 10px and the other reported none. Not theme, and not
  // animation — the side panel keeps whatever width the previous run left it
  // at, so the topbar overflowed in one run and fitted in the next, and a
  // flex-shrunk icon is a *correct* measurement of a different layout. Same
  // 1600x1000 the UIX-009 corpus harness pins, for the same reason.
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: WIDTH,
    height: HEIGHT,
    deviceScaleFactor: 0,
    mobile: false
  });
  await sleep(1200);

  const all = {};
  const surfaces = [];

  const take = async (surface) => {
    // Re-injected per surface: a panel remount can drop the injected <style>.
    await evaluate(client, DETERMINISM);
    await sleep(400);
    const rows = await evaluate(client, CENSUS);
    Object.assign(all, keyed(surface, rows));
    surfaces.push({ surface, icons: rows.length });
    process.stdout.write(`  ${surface.padEnd(34)} ${String(rows.length).padStart(3)} icons\n`);
  };

  // Theme is set through ThemeManager (the real path) and stamped declaratively
  // as well, because the corpus harness found the settings round-trip async.
  const setTheme = async () => {
    await evaluate(client, `(() => { ${REQ(M.theme)}.ThemeManager.setMode(${JSON.stringify(theme)}); return true; })()`);
    await evaluate(client, SET_THEME(theme));
    await sleep(600);
  };
  await setTheme();

  // The launcher is a surface too, and it is the one a user meets first. Taken
  // after the exit, so it is the same launcher on every run.
  await leaveProject(client);
  await setTheme();
  await take('launcher');

  const projectDir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pol013-')), 'project');
  fs.cpSync(FIXTURE_PROJECT, projectDir, { recursive: true });
  fs.rmSync(path.join(projectDir, '.git'), { recursive: true, force: true });
  await openProject(client, projectDir);
  await setTheme();

  if (!(await evaluate(client, IN_EDITOR))) {
    throw new Error('project did not open — the rail walk needs it');
  }

  await take('editor');

  const buttons = await evaluate(client, RAIL_BUTTONS);
  for (const testId of buttons) {
    const sel = `[data-test="${testId}"]`;
    try {
      const centre = await elementCentre(client, sel);
      if (!centre) continue;
      await dispatchClick(client, centre);
    } catch {
      continue;
    }
    await take(`panel-${testId.replace(/[^a-z0-9_-]/gi, '_').toLowerCase()}`);
  }

  client.close?.();
  return { theme, projectDir, surfaces, icons: all };
}

/**
 * Strip the icon element's OWN class list out of its key.
 *
 * The first attempt at this diff reported 1354 appeared / 1355 vanished / 0
 * unchanged — the key had moved under it. `domPath` records the first two
 * classes of each element, and adding the `is-size-*` rules put a *new class on
 * the icon span*, so the last path segment went from
 * `span.Icon-module__Root.IconButton-module__Icon:0` to
 * `span.Icon-module__Root.Icon-module__is-size-default:0`. A key that contains
 * the thing the change changes can only ever report total churn.
 *
 * The ancestors identify where an icon is; the icon's own classes identify
 * nothing the census needs. So the last segment collapses to its tag and index
 * on both sides, which also keeps captures taken before this fix usable.
 */
function normaliseKey(key) {
  const [surface, dpath, ...rest] = key.split('|');
  if (!dpath) return key;
  const parts = dpath.split(' > ');
  const last = parts[parts.length - 1];
  const idx = last.slice(last.lastIndexOf(':'));
  parts[parts.length - 1] = `span${idx}`;
  return [surface, parts.join(' > '), ...rest].join('|');
}

function normaliseIcons(icons) {
  const out = {};
  for (const [k, v] of Object.entries(icons)) {
    let key = normaliseKey(k);
    // Collapsing the last segment can collide two siblings that differed only
    // by class; disambiguate in stable order rather than dropping one.
    let n = 1;
    while (out[key]) key = `${normaliseKey(k)}#${++n}`;
    out[key] = v;
  }
  return out;
}

/** The criterion: which icons changed box, and were they meant to. */
function diff(beforePath, afterPath) {
  const before = JSON.parse(fs.readFileSync(beforePath, 'utf8'));
  const after = JSON.parse(fs.readFileSync(afterPath, 'utf8'));
  before.icons = normaliseIcons(before.icons);
  after.icons = normaliseIcons(after.icons);

  const keys = new Set([...Object.keys(before.icons), ...Object.keys(after.icons)]);
  const moved = [];
  const appeared = [];
  const vanished = [];
  let same = 0;
  let invisible = 0;

  for (const k of keys) {
    const b = before.icons[k];
    const a = after.icons[k];
    if (!b) {
      appeared.push({ key: k, ...a });
      continue;
    }
    if (!a) {
      vanished.push({ key: k, ...b });
      continue;
    }
    if (!b.visible || !a.visible) {
      invisible++;
      continue;
    }
    // Sub-pixel noise floor. Two runs of the SAME build disagreed by 0.03-0.07px
    // on twelve icons — all of them flex-squeezed glyphs in a row that
    // overflows, where the shrink factor lands on a slightly different
    // fractional width depending on the row's content. That is churn, not a
    // size change, and without a floor it drowns the diff that matters.
    if (Math.abs(b.w - a.w) > 0.5 || Math.abs(b.h - a.h) > 0.5) {
      moved.push({ key: k, from: `${b.w}x${b.h}`, to: `${a.w}x${a.h}`, viewBox: b.viewBox, sizeClass: a.sizeClass });
    } else {
      same++;
    }
  }

  console.log(`POL-013 census diff\n  before: ${beforePath}\n  after:  ${afterPath}\n`);
  console.log(`  unchanged   ${same}`);
  console.log(`  moved       ${moved.length}`);
  console.log(`  appeared    ${appeared.length}`);
  console.log(`  vanished    ${vanished.length}`);
  console.log(`  not visible ${invisible}  (hidden-not-unmounted panels; excluded from the count)`);

  if (moved.length) {
    console.log('\n  --- every icon whose box changed ---');
    // Grouped by the transition, because 40 icons going 25→16 is one decision,
    // not 40 findings.
    const byMove = new Map();
    for (const m of moved) {
      const k = `${m.from} -> ${m.to}`;
      byMove.set(k, [...(byMove.get(k) || []), m]);
    }
    for (const [transition, rows] of [...byMove.entries()].sort((a, b) => b[1].length - a[1].length)) {
      console.log(`\n  ${transition}   (${rows.length})`);
      for (const r of rows.slice(0, 12)) console.log(`     vb=${String(r.viewBox).padEnd(12)} ${r.key.split('|')[0]}  ${r.key.split('|')[1].slice(-70)}`);
      if (rows.length > 12) console.log(`     … and ${rows.length - 12} more`);
    }
  }
  if (vanished.length) {
    console.log('\n  --- vanished (a partial run, or a surface that stopped rendering) ---');
    for (const v of vanished.slice(0, 20)) console.log(`     ${v.key.slice(0, 110)}`);
  }
  return moved.length;
}

(async () => {
  const diffArg = flag('diff');
  if (diffArg) {
    const [b, a] = diffArg.split(',');
    process.exit(diff(b, a) === 0 ? 0 : 0); // reporting instrument, not a gate
  }

  const theme = flag('theme', 'dark');
  const out = flag('out');

  console.log(`POL-013 icon census — theme=${theme}`);
  const report = await census({ theme });

  const rows = Object.values(report.icons);
  const visible = rows.filter((r) => r.visible);
  const byBox = new Map();
  for (const r of visible) {
    const k = `${r.w}x${r.h}`;
    byBox.set(k, (byBox.get(k) || 0) + 1);
  }
  console.log(`\n  ${rows.length} icons across ${report.surfaces.length} surfaces (${visible.length} visible)`);
  console.log('  boxes actually rendered:');
  for (const [box, n] of [...byBox.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${box.padEnd(14)} ${n}`);
  }
  // Criterion 4 — "no glyph's rendered box depends on its SVG file's intrinsic
  // attributes" — is answered by whether every box is one of the four declared
  // sizes, NOT by counting boxes that happen to equal the file's attributes: a
  // 16px glyph in a 16px box matches both readings, so that count proves
  // nothing either way once the rules exist.
  const SCALE = new Set([12, 14, 16, 20]);
  const offScale = visible.filter((r) => !SCALE.has(Math.round(r.w)) || !SCALE.has(Math.round(r.h)));
  console.log(`  off the declared 12/14/16/20 scale:  ${offScale.length}  ← criterion 4`);
  console.log(`  carrying an is-size-* class:         ${visible.filter((r) => r.sizeClass).length} of ${visible.length}`);
  for (const r of offScale.slice(0, 10)) {
    console.log(`    ${r.w}x${r.h}  vb=${r.viewBox}  ${r.path.split(' > ').slice(-2).join(' > ')}`);
  }

  if (has('json')) console.log(JSON.stringify(report, null, 2));
  if (out) {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(report, null, 2));
    console.log(`\n  written: ${out}`);
  }
  // Delete the throwaway copy. The launcher's recent-projects entry outlives it
  // and has to be pruned separately — see the traps above.
  try {
    fs.rmSync(path.dirname(report.projectDir), { recursive: true, force: true });
  } catch {
    /* the editor may still hold it open; the temp dir is disposable either way */
  }
  process.exit(0);
})().catch((err) => {
  console.error('census failed:', err.message);
  process.exit(1);
});
