#!/usr/bin/env node
/**
 * POL-016 — does a button read as a button?
 *
 * POL-005 filed "the Sign-in surface's `Save policy` reads as plain text" and
 * framed it as one call site with the wrong variant. It is not. `is-variant-muted`
 * paints `--theme-color-bg-2` and `is-variant-muted-on-low-bg` paints `bg-3` —
 * both drawn from the same elevation ladder the *surfaces beneath them* use — so
 * a muted button's fill measures 1.00–1.16:1 against every panel it can land on,
 * in both themes. On a bg-2 panel `muted` is the same token, exactly 1.00:1.
 *
 * What made "Add provider" look fine while "Save policy" looked broken is not the
 * variant. It is that the first sits inside a `.Section` and the second does not,
 * and at 1.06:1 versus 1.00:1 neither is a control — only their *labels* ever had
 * contrast. So the defect is the variant, and it is 143 call sites wide.
 *
 * This census is the evidence for that claim and the verification of the fix. For
 * every rendered `PrimaryButton` it records:
 *
 *   - the variant, off the `is-variant-*` class;
 *   - the button's own computed `background-color`;
 *   - the **effective painted background behind it** — walked up the ancestor
 *     chain to the first element whose background is not transparent, because
 *     that is the colour a user's eye actually compares the button against, and
 *     it is not knowable from the call site's source;
 *   - the ring, parsed out of the computed `box-shadow`;
 *   - and the two contrast ratios that follow: fill-vs-surface and ring-vs-surface.
 *
 * The verdict per button is `max(fill, ring) >= 3`, the WCAG 1.4.11 floor for
 * anything that has to be identified as a user-interface component. A button that
 * clears it by fill (a CTA) needs no ring; a muted one has only the ring.
 *
 * ## Usage
 *
 *   node packages/noodl-editor/scripts/pol39-live/pol016-button-contrast.js
 *     --theme=dark|light|both   default both
 *     --out=<path>              write the full census as JSON
 *     --shots=<dir>             screenshot each surface
 *     --json                    print every button, not just the failures
 *
 * ## Traps
 *
 * - **The surfaces only exist while a backend is RUNNING.** POL-005's trap, and
 *   criterion 4 turns it into a requirement: this driver creates and starts a real
 *   local backend over the same `backend:create`/`backend:start` IPC the panel
 *   uses, and deletes it on the way out. It does not fixture the panel.
 * - **`SidePanel` re-creates a transient surface on every activation**, so a
 *   measurement taken before the remount settles is a measurement of the previous
 *   panel. Every census waits for the surface's own root before reading.
 * - **HMR will not restyle an already-mounted panel** (OBS-003). Restart the stack
 *   between a before run and an after run; a hot-reloaded ring is not evidence.
 * - **Pin the viewport.** POL-013's census disagreed with itself by 47 rows
 *   because the side panel keeps whatever width the previous run left it. Same
 *   1600x1000 as the UIX-009 corpus harness.
 * - **Every run litters the launcher** — the throwaway project copy is written to
 *   `recently_opened_project.json`, which outlives the temp directory. This script
 *   deletes its own copy; prune the store entry by the `/T/pol016-` prefix.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const { appTarget, connect, evaluate, elementCentre, dispatchClick } = require('../../../../scripts/devtools/cdp');

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const FIXTURE_PROJECT = path.join(REPO_ROOT, 'packages/noodl-editor/tests/testfs/git-repo-utf8');

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const has = (name) => args.includes(`--${name}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PROBE = `(() => {
  if (!window.__pol016wr) {
    window.webpackChunknoodl_editor.push([['pol016'], {}, (r) => (window.__pol016wr = r)]);
  }
  return typeof window.__pol016wr === 'function';
})()`;

const REQ = (id) => `window.__pol016wr(${JSON.stringify(id)})`;

const M = {
  project: './src/editor/src/models/projectmodel.ts',
  platform: '../noodl-platform/src/index.ts',
  app: './src/editor/src/models/app.ts',
  theme: './src/editor/src/models/ThemeManager.ts',
  surfaces: './src/editor/src/views/panels/BackendServicesPanel/LocalBackendCard/backendSurfaces.tsx',
  sidebar: './src/editor/src/models/sidebar.ts'
};

/**
 * The census.
 *
 * `effectiveBg` is the whole point. `getComputedStyle(button).backgroundColor`
 * is knowable from the stylesheet; what it has to be *compared against* is not,
 * because `rgba(0,0,0,0)` is what almost every wrapper reports and the painted
 * colour can be six ancestors up. Walking to the first non-transparent ancestor
 * is the only way to ask "what does this button sit on" of the real tree.
 */
const CENSUS = `(() => {
  const parse = (c) => {
    const m = String(c).match(/rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    const p = m[1].split(',').map((x) => parseFloat(x));
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const opaque = (c) => c && c.a >= 0.999;

  // sRGB relative luminance, WCAG 2.x.
  const lum = (c) => {
    const f = (v) => {
      const s = v / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const ratio = (a, b) => {
    if (!a || !b) return null;
    const x = lum(a), y = lum(b);
    const hi = Math.max(x, y), lo = Math.min(x, y);
    return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
  };

  // Composite a translucent layer over what is behind it, so a bg-hover style
  // rgba() overlay is compared as the colour that is actually on screen.
  const over = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1
  });

  const effectiveBg = (el) => {
    const layers = [];
    for (let n = el; n; n = n.parentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (!c || c.a === 0) continue;
      layers.push(c);
      if (opaque(c)) break;
    }
    if (!layers.length) return null;
    let out = layers[layers.length - 1];
    for (let i = layers.length - 2; i >= 0; i--) out = over(layers[i], out);
    return out;
  };

  const hex = (c) => c ? '#' + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('') : null;

  const domPath = (el) => {
    const parts = [];
    for (let n = el; n && n.nodeType === 1 && parts.length < 6; n = n.parentElement) {
      const parent = n.parentElement;
      const idx = parent ? Array.prototype.indexOf.call(parent.children, n) : 0;
      const cls = (n.className && typeof n.className === 'string' ? n.className : '')
        .split(/\\s+/).map((c) => c.split('--')[0]).filter(Boolean).slice(0, 2).join('.');
      parts.unshift(n.tagName.toLowerCase() + (cls ? '.' + cls : '') + ':' + idx);
    }
    return parts.join(' > ');
  };

  const roots = Array.from(document.querySelectorAll('[class*="PrimaryButton-module__Root"]'));
  return roots.map((el) => {
    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();

    // A transparent background is NOT black. rgba(0,0,0,0) is what every
    // unfilled button reports, and taking it at face value scored the ghost
    // variant — which is deliberately transparent over a real border — as
    // 1.24:1 black-on-panel in dark and 19.90:1 in light. Both were the
    // instrument's fault, not the variant's. No fill means no fill ratio.
    const rawFill = parse(cs.backgroundColor);
    const fill = rawFill && rawFill.a > 0 ? rawFill : null;

    // The surface is what is behind the button, so start the walk at its PARENT —
    // starting at the button would just find the button.
    const surface = el.parentElement ? effectiveBg(el.parentElement) : null;

    // A boundary is a real border OR an inset ring. The ghost variant draws
    // border: 1px solid var(--theme-color-primary) and would read as
    // boundaryless if only box-shadow were checked. A CTA's *drop* shadow is not
    // inset, is not a boundary, and is deliberately not counted as one.
    const borderPx = parseFloat(cs.borderTopWidth) || 0;
    const borderColour = borderPx > 0 ? parse(cs.borderTopColor) : null;
    const shadow = cs.boxShadow && cs.boxShadow !== 'none' ? cs.boxShadow : null;
    const insetColour = shadow && shadow.includes('inset') ? parse(shadow) : null;
    const ringColour =
      (borderColour && borderColour.a > 0 ? borderColour : null) ||
      (insetColour && insetColour.a > 0 ? insetColour : null);

    const fillRatio = ratio(fill, surface);
    const ringRatio = ringColour ? ratio(ringColour, surface) : null;
    const best = Math.max(fillRatio || 0, ringRatio || 0);

    // WCAG 1.4.11 exempts INACTIVE components explicitly, and :disabled here
    // deliberately flattens the button to bg-3 at 0.5 opacity. Counting those as
    // failures would mean the floor could only be met by making disabled
    // controls look enabled. Recorded, and reported separately.
    const disabled = el.disabled === true;

    return {
      path: domPath(el),
      label: (el.innerText || '').trim().slice(0, 40),
      // The module class is …__is-variant-muted--<hash>, so the match has to
      // stop at the -- or every variant reads as its own hash.
      variant: ((el.className.match(/is-variant-[a-z-]+?(?=--)/) || [null])[0]),
      testId: el.getAttribute('data-test'),
      disabled,
      w: Math.round(rect.width * 10) / 10,
      h: Math.round(rect.height * 10) / 10,
      fill: hex(fill),
      surface: hex(surface),
      ring: hex(ringColour),
      borderWidth: cs.borderTopWidth,
      fillRatio,
      ringRatio,
      // WCAG 1.4.11: 3:1 for the visual information needed to identify a control.
      readsAsControl: disabled || best >= 3,
      best: Math.round(best * 100) / 100,
      visible: el.offsetParent !== null && rect.width > 0 && rect.height > 0
    };
  });
})()`;

const SET_THEME = (theme) => `(() => {
  document.documentElement.setAttribute('data-theme', ${JSON.stringify(theme)});
  window.dispatchEvent(new CustomEvent('nodegx:themechanged', { detail: { theme: ${JSON.stringify(theme)} } }));
  return document.documentElement.getAttribute('data-theme');
})()`;

const DETERMINISM = `(() => {
  const ID = 'pol016-determinism';
  document.getElementById(ID)?.remove();
  const style = document.createElement('style');
  style.id = ID;
  style.textContent = \`*, *::before, *::after {
    animation-duration: 0s !important; animation-delay: 0s !important;
    transition-duration: 0s !important; transition-delay: 0s !important;
    caret-color: transparent !important;
  }\`;
  document.head.appendChild(style);
  return true;
})()`;

const IN_EDITOR = `!!(document.querySelector('canvas') && document.querySelector('[data-test]'))`;

/** The rail's own buttons, the same way POL-013's census discovered them. */
const RAIL_BUTTONS = `Array.from(document.querySelectorAll('[data-test]'))
  .filter(el => el.offsetParent !== null && /nav|sidebar|panel|rail|toolbar/i.test(el.className + ' ' + (el.closest('[class]')?.className||'')))
  .map(el => el.getAttribute('data-test'))
  .filter((v,i,a)=>v && a.indexOf(v)===i)`;

async function waitFor(client, expr, { timeoutMs = 30000, what = 'condition' } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if (await evaluate(client, expr)) return true;
    } catch {
      /* the renderer may be mid-navigation */
    }
    await sleep(500);
  }
  throw new Error(`timed out waiting for ${what}`);
}

async function clickControl(client, { testId }) {
  const centre = await elementCentre(client, `[data-test="${testId}"]`);
  if (!centre) throw new Error(`no control [data-test="${testId}"]`);
  await dispatchClick(client, centre);
}

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
  // Wait for the launcher to RENDER. `!document.querySelector('[data-panel-id]')`
  // is true during the gap before it does, and a census in that gap reads zero.
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
  // The launcher's Open project is icon-only now, so it is reached by testId
  // rather than by its text — `clickButtonWithText('Open project')` fails here.
  await clickControl(client, { testId: 'launcher-open-project' });
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

/** A real backend, over the same IPC the Backend Services panel uses. */
async function startBackend(client, name) {
  const created = await evaluate(
    client,
    `(async () => {
       const { ipcRenderer } = require('electron');
       const b = await ipcRenderer.invoke('backend:create', ${JSON.stringify(name)});
       await ipcRenderer.invoke('backend:start', b.id);
       const s = await ipcRenderer.invoke('backend:status', b.id);
       return { id: b.id, name: b.name, running: !!(s && s.running), port: s && s.port };
     })()`
  );
  if (!created || !created.running) {
    throw new Error(`backend did not start: ${JSON.stringify(created)}`);
  }
  return created;
}

async function deleteBackend(client, id) {
  try {
    await evaluate(
      client,
      `(async () => {
         const { ipcRenderer } = require('electron');
         try { await ipcRenderer.invoke('backend:stop', ${JSON.stringify(id)}); } catch (e) {}
         await ipcRenderer.invoke('backend:delete', ${JSON.stringify(id)});
         return true;
       })()`
    );
  } catch (err) {
    console.warn(`  ! could not clean up backend ${id}: ${err.message}`);
  }
}

const WIDTH = 1600;
const HEIGHT = 1000;

/** Every backend surface, so the sweep covers the family POL-005 laid out. */
const SURFACE_KINDS = ['schema', 'data', 'permissions', 'triggers', 'email', 'auth', 'search'];

async function run({ theme, shots }) {
  const target = await appTarget('editor');
  const client = await connect(target);
  await waitFor(client, PROBE, { what: 'the webpack require shim' });

  await client.send('Emulation.setDeviceMetricsOverride', {
    width: WIDTH,
    height: HEIGHT,
    deviceScaleFactor: 0,
    mobile: false
  });
  await sleep(1200);

  const setTheme = async () => {
    await evaluate(client, `(() => { ${REQ(M.theme)}.ThemeManager.setMode(${JSON.stringify(theme)}); return true; })()`);
    await evaluate(client, SET_THEME(theme));
    await sleep(600);
  };

  const all = {};
  const surfaces = [];

  const take = async (surface) => {
    await evaluate(client, DETERMINISM);
    await sleep(400);
    const rows = await evaluate(client, CENSUS);
    const visible = rows.filter((r) => r.visible);
    for (const r of visible) {
      let key = `${theme}|${surface}|${r.path}|${r.label}`;
      let n = 1;
      while (all[key]) key = `${theme}|${surface}|${r.path}|${r.label}#${++n}`;
      all[key] = { ...r, surfaceName: surface, theme };
    }
    const bad = visible.filter((r) => !r.readsAsControl).length;
    surfaces.push({ surface, buttons: visible.length, failing: bad });
    process.stdout.write(
      `  ${surface.padEnd(30)} ${String(visible.length).padStart(3)} buttons   ${String(bad).padStart(3)} below 3:1\n`
    );
    if (shots && visible.length) {
      const file = path.join(shots, `${theme}-${surface.replace(/[^a-z0-9_-]/gi, '_')}.png`);
      try {
        const { data } = await client.send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(file, Buffer.from(data, 'base64'));
      } catch {
        /* a screenshot is evidence, not a gate */
      }
    }
  };

  await setTheme();
  await leaveProject(client);
  await setTheme();
  await take('launcher');

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pol016-'));
  const projectDir = path.join(tmp, 'project');
  fs.cpSync(FIXTURE_PROJECT, projectDir, { recursive: true });
  fs.rmSync(path.join(projectDir, '.git'), { recursive: true, force: true });
  await openProject(client, projectDir);
  await setTheme();

  if (!(await evaluate(client, IN_EDITOR))) throw new Error('project did not open');
  await take('editor');

  // Every rail panel, so the sweep is not just the seven backend surfaces. The
  // variant has 143 call sites and the ring lands on all of them at once; a
  // census that only measured the surface POL-005 happened to be looking at
  // would report a fix it had not checked.
  const railButtons = await evaluate(client, RAIL_BUTTONS);
  for (const testId of railButtons) {
    try {
      const centre = await elementCentre(client, `[data-test="${testId}"]`);
      if (!centre) continue;
      await dispatchClick(client, centre);
    } catch {
      continue;
    }
    await sleep(800);
    await take(`rail-${testId.replace(/[^a-z0-9_-]/gi, '_').toLowerCase()}`);
  }

  // The backend surfaces — criterion 4's "against a real backend, not a fixture".
  let backend = null;
  try {
    backend = await startBackend(client, 'POL-016 probe');
    process.stdout.write(`  backend '${backend.name}' running on :${backend.port}\n`);

    for (const kind of SURFACE_KINDS) {
      const ok = await evaluate(
        client,
        `(() => ${REQ(M.surfaces)}.openBackendSurface(${JSON.stringify(kind)}, {
           backendId: ${JSON.stringify(backend.id)},
           backendName: ${JSON.stringify(backend.name)},
           isRunning: true,
           onClose: () => {}
         }))()`
      );
      if (!ok) {
        process.stdout.write(`  ! surface '${kind}' would not open\n`);
        continue;
      }
      // A transient surface is re-created on activation; wait for its panel root
      // rather than for a timer, or the census reads the previous panel.
      try {
        await waitFor(client, `(() => !!document.querySelector('[data-panel-id="backend-${kind}"]'))()`, {
          timeoutMs: 15000,
          what: `the ${kind} surface to mount`
        });
      } catch {
        process.stdout.write(`  ! surface '${kind}' never mounted\n`);
        continue;
      }
      await sleep(2000);
      await take(`backend-${kind}`);
    }
  } finally {
    if (backend) await deleteBackend(client, backend.id);
  }

  client.close?.();
  return { theme, projectDir, tmp, backend: backend && backend.id, surfaces, buttons: all };
}

function report(census) {
  const rows = Object.values(census.buttons);
  const byVariant = {};
  for (const r of rows) {
    const v = r.variant || '(none)';
    byVariant[v] = byVariant[v] || { n: 0, failing: 0, worst: Infinity, best: 0 };
    const b = byVariant[v];
    b.n++;
    if (!r.readsAsControl) b.failing++;
    b.worst = Math.min(b.worst, r.best);
    b.best = Math.max(b.best, r.best);
  }

  const disabled = rows.filter((r) => r.disabled);
  console.log(
    `\n  ${census.theme} — ${rows.length} visible buttons` +
      (disabled.length ? ` (${disabled.length} disabled, exempt under 1.4.11)` : '')
  );
  console.log('  ' + 'variant'.padEnd(26) + 'n'.padStart(5) + '<3:1'.padStart(7) + 'worst'.padStart(8) + 'best'.padStart(8));
  for (const [v, b] of Object.entries(byVariant).sort((a, z) => z[1].n - a[1].n)) {
    console.log(
      '  ' + v.padEnd(26) + String(b.n).padStart(5) + String(b.failing).padStart(7) +
        b.worst.toFixed(2).padStart(8) + b.best.toFixed(2).padStart(8)
    );
  }

  const failing = rows.filter((r) => !r.readsAsControl);
  if (failing.length) {
    console.log(`\n  ${failing.length} button(s) below 3:1 — these do not read as controls:`);
    for (const r of failing.slice(0, 40)) {
      console.log(
        `    ${(r.surfaceName || '').padEnd(18)} ${(r.label || '(no label)').padEnd(24)} ` +
          `${(r.variant || '-').padEnd(24)} fill ${r.fill} on ${r.surface} = ${r.fillRatio}:1` +
          (r.ringRatio ? `, ring ${r.ring} = ${r.ringRatio}:1` : ', no ring')
      );
    }
    if (failing.length > 40) console.log(`    … and ${failing.length - 40} more`);
  } else {
    console.log('\n  ✓ every visible button reads as a control (>=3:1 by fill or ring).');
  }
  return failing.length;
}

async function main() {
  const themeArg = flag('theme', 'both');
  const themes = themeArg === 'both' ? ['dark', 'light'] : [themeArg];
  const shots = flag('shots', null);
  if (shots) fs.mkdirSync(shots, { recursive: true });

  const censuses = [];
  let failing = 0;
  for (const theme of themes) {
    console.log(`\n== ${theme} ==`);
    const census = await run({ theme, shots });
    failing += report(census);
    censuses.push(census);
    // The project copy outlives the run otherwise; the launcher's recent-projects
    // entry it cannot reach from here.
    try {
      fs.rmSync(census.tmp, { recursive: true, force: true });
    } catch {
      /* best effort */
    }
  }

  const out = flag('out', null);
  if (out) {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(censuses, null, 2));
    console.log(`\n  census -> ${out}`);
  }
  if (has('json')) console.log(JSON.stringify(censuses, null, 2));

  console.log(`\n${failing === 0 ? '✓' : '✗'} POL-016: ${failing} button(s) below the 3:1 control floor.`);
  process.exit(failing === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
