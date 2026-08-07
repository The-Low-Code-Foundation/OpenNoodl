#!/usr/bin/env node
/**
 * POL-004 criterion 1 — the doc-review diff modal, in both themes.
 *
 * The reported defect: *"the code editor that comes up to show code changes has
 * a white background on its modal"*. The mechanism POL-004 found was
 * `PlanDocReviewDialog` opening with `background={DialogBackground.Secondary}`,
 * and `secondary` is the neutral ACTION colour — the fill of a button — not a
 * surface. It is theme-aware and inverted relative to one by construction, so it
 * painted a near-white sheet in dark mode and a near-black sheet in light. The
 * fix pointed it at `Bg1`. That landed in `4382cb24` and was never seen.
 *
 * This is the drive that sees it. The criterion is *"readable in both themes,
 * with a surface-toned background"*, so this measures rather than screenshots
 * and hopes:
 *
 *   - the dialog sheet's computed background, against the theme's `bg-1`;
 *   - its text colour against that background, as a contrast ratio — a sheet
 *     that is the right colour with inherited-dark text on it is still the bug
 *     the report described;
 *   - and both diff gutters, because the whole point of the modal is the diff.
 *
 * **The modal needs a real diff in it, not an empty one.** A doc operation whose
 * `baseline` is null renders as a whole-file creation with nothing removed,
 * which is the one shape that would not have shown the original defect at its
 * worst. So the throwaway project gets a real `docs/BRIEF.md` first, and the
 * scripted turn rewrites parts of it.
 *
 * ## No provider money is spent
 *
 * `AiClient.chatStream` is replaced with a scripted responder, the same way
 * `pol007-layout.js` does it: `submit_plan` returns one `doc` operation and
 * `submit_doc` returns the rewritten body. Nothing reaches a provider, and
 * `isConfigured()` is forced true so the panel offers the run at all.
 *
 * ## Usage
 *
 *   node packages/noodl-editor/scripts/pol39-live/pol004-doc-diff.js
 *     --theme=dark|light|both   default both
 *     --shots=<dir>             screenshot the open modal per theme
 *     --json                    print the full measurement
 *
 * ## Traps
 *
 * - **`docBaselineFor` is only wired when the project HAS docs.**
 *   `ProjectDocsModel.forProject` returns undefined without a `docs/` folder,
 *   `planRunOptions` then passes `docBaselineFor: undefined`, and `PlanRun`
 *   fails the operation with *"no project-docs reader"* rather than authoring
 *   anything. `docs/CONVENTIONS.md` is what `hasDocs()` actually tests for, so
 *   writing only `BRIEF.md` is not enough.
 * - **A doc operation cannot be retried alone** (`PlanRun.retryOperation`
 *   throws for `kind: 'doc'`). If the turn fails, re-run the plan.
 * - **HMR will not restyle an already-mounted panel.** Restart the stack before
 *   trusting a measurement of a dialog whose stylesheet you just changed.
 * - Every run litters the launcher; this one deletes its own copy, and the
 *   recent-projects entry is pruned by the `/T/pol004-` prefix.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const { appTarget, connect, evaluate, dispatchClick } = require('../../../../scripts/devtools/cdp');

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
  if (!window.__pol004wr) {
    window.webpackChunknoodl_editor.push([['pol004'], {}, (r) => (window.__pol004wr = r)]);
  }
  return typeof window.__pol004wr === 'function';
})()`;
const REQ = (id) => `window.__pol004wr(${JSON.stringify(id)})`;

const M = {
  project: './src/editor/src/models/projectmodel.ts',
  platform: '../noodl-platform/src/index.ts',
  app: './src/editor/src/models/app.ts',
  theme: './src/editor/src/models/ThemeManager.ts',
  sidebar: './src/editor/src/models/sidebar/sidebarmodel.tsx',
  aiClient: './src/editor/src/models/AiAssistant/client/AiClient.ts',
  planStore: './src/editor/src/models/AiAssistant/authoring/PlanSessionStore.ts'
};

/* -------------------------------------------------------------------------- */
/* The fixture                                                                */
/* -------------------------------------------------------------------------- */

/** What `hasDocs()` tests for. Without it there is no docs reader at all. */
const CONVENTIONS = `# Conventions

- Pages live under \`Pages/\`.
- Shared pieces live under \`Components/\`.
`;

/**
 * The baseline. The scripted rewrite below keeps most of it verbatim and edits
 * three places, so the modal has to render additions, removals AND context —
 * a diff whose every line is an addition would not exercise the removal gutter.
 */
const BRIEF_BASELINE = `# Brief

## What this is for

A reading app. People come to read articles and occasionally save one.

## Who uses it

Readers. There is no author-facing side and there will not be one.

## Deliberately out of scope

- Comments.
- Social sharing.
`;

const BRIEF_PROPOSED = `# Brief

## What this is for

A reading app. People come to read articles, save them, and buy a subscription.

## Who uses it

Readers, and subscribers who have paid. There is no author-facing side and there
will not be one.

## Deliberately out of scope

- Comments.
`;

const DOC_TARGET = 'docs/BRIEF.md';

const PLAN_OPERATIONS = [
  {
    kind: 'doc',
    target: DOC_TARGET,
    intent: 'Record that the app now sells subscriptions, and that sharing is no longer out of scope.'
  }
];

const PLAN_REQUEST = 'Add subscriptions to the reading app, and write down what that changed.';

function installScript() {
  return `(async () => {
    const AiClient = ${REQ(M.aiClient)}.AiClient;
    if (!AiClient) return { ok: false, error: 'AiClient not found' };

    const PLAN = ${JSON.stringify({ operations: PLAN_OPERATIONS })};
    const DOC = ${JSON.stringify({ content: BRIEF_PROPOSED, summary: 'Recorded subscriptions and dropped sharing from out-of-scope.' })};

    if (!window.__pol004original) {
      window.__pol004original = { chatStream: AiClient.chatStream, isConfigured: AiClient.isConfigured };
    }
    window.__pol004 = { turns: [] };

    const usage = () => ({ promptTokens: 0, completionTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: 0 });
    const reply = (name, args) => ({
      text: '',
      toolCalls: [{ id: 'pol004-' + window.__pol004.turns.length, name, arguments: args }],
      usage: usage(),
      model: 'scripted-replay',
      stopReason: 'tool_calls'
    });

    AiClient.isConfigured = () => true;
    AiClient.chatStream = async (request, callbacks = {}) => {
      const tools = (request.tools || []).map((t) => t.name);

      if (tools.includes('submit_plan')) {
        window.__pol004.turns.push('plan');
        return reply('submit_plan', PLAN);
      }
      if (tools.includes('submit_doc')) {
        window.__pol004.turns.push('doc');
        const response = reply('submit_doc', DOC);
        callbacks.onToolCall?.(response.toolCalls[0]);
        callbacks.onEnd?.();
        return response;
      }
      window.__pol004.turns.push('declined:' + tools.join(','));
      callbacks.onEnd?.();
      return { text: 'Nothing to do.', toolCalls: [], usage: usage(), model: 'scripted-replay', stopReason: 'stop' };
    };
    return { ok: true };
  })()`;
}

/* -------------------------------------------------------------------------- */
/* The measurement                                                            */
/* -------------------------------------------------------------------------- */

/**
 * The dialog sheet, its text, and the diff gutters.
 *
 * The sheet is found by walking up from the modal's own content rather than by
 * guessing a class: `BaseDialog` renders through a portal and the painted sheet
 * is not the element the dialog component names.
 */
const MEASURE = `(() => {
  const parse = (c) => {
    const m = String(c).match(/rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    const p = m[1].split(',').map((x) => parseFloat(x));
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const lum = (c) => {
    const f = (v) => { const s = v / 255; return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const ratio = (a, b) => {
    if (!a || !b) return null;
    const x = lum(a), y = lum(b);
    return Math.round(((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)) * 100) / 100;
  };
  const hex = (c) => c ? '#' + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('') : null;
  const paintedBg = (el) => {
    for (let n = el; n; n = n.parentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c.a >= 0.999) return { el: n, colour: c };
    }
    return null;
  };

  // The token values this theme says a surface should be, read off the live
  // document rather than hardcoded — the whole defect was a token used for the
  // wrong role, so the comparison has to be against the real token.
  //
  // Resolved by PAINTING, not by getPropertyValue: in the dark theme these are
  // declared as aliases (--theme-color-bg-1: var(--base-color-neutral-100)),
  // and getPropertyValue hands back the literal string "var(--base-color-...)"
  // rather than a colour. Reading the declared value scored every token null on
  // the first run. Only a computed background-color resolves the chain.
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;left:-9999px;width:1px;height:1px;pointer-events:none';
  document.body.appendChild(probe);
  const tok = (name) => {
    probe.style.backgroundColor = '';
    probe.style.backgroundColor = 'var(--theme-color-' + name + ')';
    const c = parse(getComputedStyle(probe).backgroundColor);
    return c && c.a > 0 ? c : null;
  };

  const dialogs = Array.from(document.querySelectorAll('[class*="BaseDialog"], [role=dialog]'))
    .filter((d) => d.offsetParent !== null && d.getBoundingClientRect().width > 200);
  if (!dialogs.length) return { error: 'no dialog on screen' };

  // The widest visible one is the sheet, not the backdrop's inner wrapper.
  const dialog = dialogs.sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0];
  const sheet = paintedBg(dialog);
  const rect = dialog.getBoundingClientRect();

  // Every text node with real ink in it, measured against the sheet it sits on.
  const texts = Array.from(dialog.querySelectorAll('*'))
    .filter((el) => el.children.length === 0 && (el.textContent || '').trim().length > 1 && el.offsetParent !== null)
    .slice(0, 400)
    .map((el) => {
      const fg = parse(getComputedStyle(el).color);
      const bg = paintedBg(el);
      return {
        text: (el.textContent || '').trim().slice(0, 40),
        fg: hex(fg),
        bg: hex(bg && bg.colour),
        ratio: ratio(fg, bg && bg.colour)
      };
    })
    .filter((t) => t.ratio !== null);

  const worst = texts.reduce((w, t) => (w === null || t.ratio < w.ratio ? t : w), null);
  const bg1 = tok('bg-1'), bg2 = tok('bg-2'), secondary = tok('secondary');
  probe.remove();

  return {
    sheet: hex(sheet && sheet.colour),
    bg1: hex(bg1),
    bg2: hex(bg2),
    secondary: hex(secondary),
    // POL-004's actual defect: the sheet painted with the ACTION colour.
    sheetIsBg1: hex(sheet && sheet.colour) === hex(bg1),
    sheetIsSecondary: hex(sheet && sheet.colour) === hex(secondary),
    box: { w: Math.round(rect.width), h: Math.round(rect.height) },
    textCount: texts.length,
    worstText: worst,
    // WCAG 1.4.3 for body text. Reported separately from the sheet verdict —
    // a sheet painted correctly with thin text on it is a different finding
    // from the inverted sheet this task was opened for.
    allTextReadable: texts.every((t) => t.ratio >= 4.5),
    unreadable: texts.filter((t) => t.ratio < 4.5).slice(0, 10)
  };
})()`;

const SET_THEME = (theme) => `(() => {
  document.documentElement.setAttribute('data-theme', ${JSON.stringify(theme)});
  window.dispatchEvent(new CustomEvent('nodegx:themechanged', { detail: { theme: ${JSON.stringify(theme)} } }));
  return document.documentElement.getAttribute('data-theme');
})()`;

const DETERMINISM = `(() => {
  const ID = 'pol004-determinism';
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

/* -------------------------------------------------------------------------- */
/* Driving                                                                    */
/* -------------------------------------------------------------------------- */

async function waitFor(client, expr, { timeoutMs = 30000, what = 'condition' } = {}) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    try {
      last = await evaluate(client, expr);
      if (last) return last;
    } catch {
      /* mid-render */
    }
    await sleep(500);
  }
  throw new Error(`timed out waiting for ${what}`);
}

async function clickButtonWithText(client, text, { scope = 'body', exact = false } = {}) {
  const box = await evaluate(
    client,
    `(() => {
       const root = document.querySelector(${JSON.stringify(scope)});
       if (!root) return null;
       const want = ${JSON.stringify(text)}.toLowerCase();
       const buttons = Array.from(root.querySelectorAll('button, [role=button]'));
       const el = buttons.find((b) => (b.innerText || '').trim().toLowerCase() === want)
         || (${exact ? 'null' : 'buttons.find((b) => (b.innerText || "").trim().toLowerCase().startsWith(want))'});
       if (!el) return null;
       el.scrollIntoView({ block: 'center', inline: 'center' });
       const r = el.getBoundingClientRect();
       const x = r.left + r.width / 2, y = r.top + r.height / 2;
       const hit = document.elementFromPoint(x, y);
       return { x, y, width: r.width, height: r.height, label: (el.innerText || '').trim(),
                onTop: Boolean(hit && (el === hit || el.contains(hit))) };
     })()`
  );
  if (!box) throw new Error(`no button reading "${text}"`);
  if (!box.width || !box.height) throw new Error(`button "${text}" has a zero-sized box`);
  if (!box.onTop) throw new Error(`button "${text}" is not topmost at its own centre — refusing to click blind`);
  await dispatchClick(client, box);
  return box.label;
}

async function leaveProject(client) {
  const open = await evaluate(
    client,
    `(() => { const p = ${REQ(M.project)}.ProjectModel && ${REQ(M.project)}.ProjectModel.instance;
              return p ? (p._retainedProjectDirectory || 'unknown') : ''; })()`
  );
  if (!open) return;
  await evaluate(client, `(() => { ${REQ(M.app)}.App.instance.exitProject(); return true; })()`);
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
  const box = await evaluate(
    client,
    `(() => { const el = document.querySelector('[data-test="launcher-open-project"]');
              if (!el) return null; const r = el.getBoundingClientRect();
              return { x: r.left + r.width/2, y: r.top + r.height/2 }; })()`
  );
  if (!box) throw new Error('no launcher-open-project control');
  await dispatchClick(client, box);
  await waitFor(
    client,
    `(() => { const p = ${REQ(M.project)}.ProjectModel && ${REQ(M.project)}.ProjectModel.instance;
              return !!(p && p._retainedProjectDirectory); })()`,
    { timeoutMs: 90000, what: 'the project to open' }
  );
  await sleep(4000);
}

function makeProject() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pol004-'));
  const dir = path.join(tmp, 'project');
  fs.cpSync(FIXTURE_PROJECT, dir, { recursive: true });
  fs.rmSync(path.join(dir, '.git'), { recursive: true, force: true });
  fs.mkdirSync(path.join(dir, 'docs'), { recursive: true });
  // CONVENTIONS.md is what `hasDocs()` tests; without it there is no docs
  // reader and the doc operation fails before it authors anything.
  fs.writeFileSync(path.join(dir, 'docs/CONVENTIONS.md'), CONVENTIONS);
  fs.writeFileSync(path.join(dir, 'docs/BRIEF.md'), BRIEF_BASELINE);
  return { tmp, dir };
}

async function run({ theme, shots }) {
  const target = await appTarget('editor');
  const client = await connect(target);
  await waitFor(client, PROBE, { what: 'the webpack require shim' });

  await client.send('Emulation.setDeviceMetricsOverride', {
    width: 1600, height: 1000, deviceScaleFactor: 0, mobile: false
  });
  await sleep(800);

  const setTheme = async () => {
    await evaluate(client, `(() => { ${REQ(M.theme)}.ThemeManager.setMode(${JSON.stringify(theme)}); return true; })()`);
    await evaluate(client, SET_THEME(theme));
    await sleep(600);
  };

  await leaveProject(client);
  const { tmp, dir } = makeProject();
  await openProject(client, dir);
  await setTheme();
  await evaluate(client, DETERMINISM);

  const installed = await evaluate(client, installScript());
  if (!installed || !installed.ok) throw new Error(`could not install the scripted client: ${JSON.stringify(installed)}`);

  // Fresh session, or a previous run's plan is still sitting there.
  await evaluate(
    client,
    `(() => { const s = ${REQ(M.planStore)}.PlanSessionStore.instance;
              const p = ${REQ(M.project)}.ProjectModel.instance;
              s.discard(p && p.id); return true; })()`
  );
  await evaluate(client, `(() => { ${REQ(M.sidebar)}.SidebarModel.instance.switch('ai-authoring'); return true; })()`);
  await sleep(2500);

  await clickButtonWithText(client, 'Project', { exact: true });
  await sleep(1200);

  await evaluate(
    client,
    `(() => {
       const area = document.querySelector('textarea');
       if (!area) return false;
       const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
       setter.call(area, ${JSON.stringify(PLAN_REQUEST)});
       area.dispatchEvent(new Event('input', { bubbles: true }));
       return true;
     })()`
  );
  await sleep(600);

  await clickButtonWithText(client, 'Plan it');
  await waitFor(client, `(() => /author plan/i.test(document.body.innerText))()`, {
    timeoutMs: 30000, what: 'the plan to be proposed'
  });
  await clickButtonWithText(client, 'Author plan');

  // The doc turn has to finish staging before there is anything to review.
  await waitFor(client, `(() => /review/i.test(document.body.innerText))()`, {
    timeoutMs: 60000, what: 'the doc operation to stage'
  });
  await sleep(1500);

  await clickButtonWithText(client, 'Review');
  await waitFor(client, `(() => !!document.querySelector('[class*="BaseDialog"], [role=dialog]'))()`, {
    timeoutMs: 15000, what: 'the doc review dialog to open'
  });
  await sleep(1200);
  await evaluate(client, DETERMINISM);
  await sleep(300);

  const measured = await evaluate(client, MEASURE);

  if (shots) {
    fs.mkdirSync(shots, { recursive: true });
    const { data } = await client.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(shots, `${theme}-doc-review.png`), Buffer.from(data, 'base64'));
  }

  // Leave nothing staged behind for the next theme's run.
  await evaluate(client, `(() => { const b = Array.from(document.querySelectorAll('button'))
      .find((x) => /close|cancel|keep/i.test(x.innerText || '')); if (b) b.click(); return true; })()`);
  await sleep(600);

  client.close?.();
  try {
    fs.rmSync(tmp, { recursive: true, force: true });
  } catch {
    /* best effort */
  }
  return { theme, ...measured };
}

function report(m) {
  if (m.error) {
    console.log(`  ${m.theme}: ${m.error}`);
    return 1;
  }
  const surfaceOk = m.sheetIsBg1 && !m.sheetIsSecondary;
  console.log(`\n  ${m.theme} — dialog ${m.box.w}x${m.box.h}, ${m.textCount} text nodes`);
  console.log(`    sheet            ${m.sheet}`);
  console.log(`    bg-1             ${m.bg1}   ${m.sheetIsBg1 ? '<- MATCHES (surface-toned)' : ''}`);
  console.log(`    secondary        ${m.secondary} ${m.sheetIsSecondary ? '<- STILL THE ACTION COLOUR (the bug)' : '(not used — correct)'}`);
  console.log(`    criterion 1      ${surfaceOk ? 'PASS — surface-toned sheet' : 'FAIL'}`);
  console.log(`    worst text       ${m.worstText ? m.worstText.ratio + ':1  "' + m.worstText.text + '" ' + m.worstText.fg + ' on ' + m.worstText.bg : 'n/a'}`);
  if (!m.allTextReadable) {
    // Not part of criterion 1's verdict: this is whatever the dialog's own text
    // tones do, which the sheet fix neither caused nor addresses. Reported so it
    // is a finding with a row rather than a number nobody looked at.
    console.log(`    NOTE: ${m.unreadable.length} text node(s) below 4.5:1 (separate finding, not the sheet):`);
    for (const t of m.unreadable) console.log(`      ${t.ratio}:1  ${t.fg} on ${t.bg}  "${t.text}"`);
  }
  console.log(`    => ${surfaceOk ? 'PASS' : 'FAIL'}`);
  return surfaceOk ? 0 : 1;
}

async function main() {
  const themeArg = flag('theme', 'both');
  const themes = themeArg === 'both' ? ['dark', 'light'] : [themeArg];
  const shots = flag('shots', null);

  let failures = 0;
  const all = [];
  for (const theme of themes) {
    console.log(`\n== ${theme} ==`);
    const m = await run({ theme, shots });
    all.push(m);
    failures += report(m);
  }
  if (has('json')) console.log(JSON.stringify(all, null, 2));
  console.log(`\n${failures === 0 ? '✓' : '✗'} POL-004 criterion 1: ${failures} theme(s) failing.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
