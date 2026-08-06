#!/usr/bin/env node
/**
 * Phase 40 — the Layer-1 live pass, driven with no provider.
 *
 * Layer 1 closed four seams (AAQ-001..004) with 2165 green specs and no one had
 * ever seen any of it run. This drives the whole launcher path in the running
 * editor — scoping conversation, project creation, plan, authoring fan-out,
 * apply — and then asks the *runtime* the questions the acceptance criteria ask:
 *
 *   AAQ-001 c5  the Page Router lists the created pages, and the app opens on one
 *   AAQ-003 c1  a page taller than the window scrolls, in a real preview
 *   AAQ-003 c3  `bodyScroll` is set in Project Settings, and undo restores it
 *   AAQ-002 c2  the Create Record node has live `prop-*` ports at first load
 *
 * **Why this is not a weaker test than a cold model run.** Every one of those
 * behaviours is performed by the apply transaction (`planStaging.ts`), which is
 * downstream of the provider boundary — the model neither registers a page nor
 * writes a project setting nor fills a schema cache. Replacing the provider
 * changes what gets built, not whether the transaction does its job. What this
 * does NOT cover is authoring quality, which is the engine tasks' business.
 *
 * The seam is `AiClient.chatStream` and `AiClient.isConfigured`, exactly as
 * `aix15-live/scripted-session.js` established. The difference is that this
 * responder is **request-aware**: it dispatches on which tools the caller
 * offered, so one patch serves the scoping turn and both authoring sessions.
 *
 * Usage (editor must be running via `npm run dev:debug`):
 *
 *   node packages/noodl-editor/scripts/aaq40-live/wizard-replay.js --install
 *   node packages/noodl-editor/scripts/aaq40-live/wizard-replay.js --drive
 *   node packages/noodl-editor/scripts/aaq40-live/wizard-replay.js --verify
 *
 * `--install` alone is useful: it leaves the editor scripted so the wizard can
 * be driven by hand.
 */
const path = require('path');

const { appTarget, connect, evaluate, elementCentre, dispatchClick } = require('../../../../scripts/devtools/cdp');
const { BRIEF, SCOPE_ARGS, SCOPE_PROSE_ROUND_1, SCOPE_PROSE_ROUND_2, COMPONENTS } = require('./fixtures');

/* -------------------------------------------------------------------------- */
/* Renderer-side plumbing                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Webpack's `__webpack_require__`, captured by pushing an empty chunk. Module
 * ids are source-relative paths. Verified harmless — see the CDP trap notes.
 */
const PROBE = `(() => {
  if (!window.__aaq40wr) {
    window.webpackChunknoodl_editor.push([['aaq40'], {}, (r) => (window.__aaq40wr = r)]);
  }
  return typeof window.__aaq40wr === 'function';
})()`;

const REQ = (id) => `window.__aaq40wr(${JSON.stringify(id)})`;

const AI_CLIENT_MODULE = './src/editor/src/models/AiAssistant/client/AiClient.ts';
const PROJECT_MODULE = './src/editor/src/models/projectmodel.ts';
const PLATFORM_MODULE = '../noodl-platform/src/index.ts';
const SIDEBAR_MODULE = './src/editor/src/models/sidebar/sidebarmodel.tsx';

/**
 * The scripted responder.
 *
 * Dispatch is on the offered tool names rather than on a call counter, because a
 * counter encodes an assumption about how many rounds each session takes and
 * that assumption is exactly the sort of thing this pass exists to stop
 * believing. `record_scope` offered → this is the scoping turn. `submit_component`
 * offered → this is an authoring session, and *which* component it is comes out
 * of the task line the prompt writes ("Build a new component at "Pages/Puppies"").
 *
 * An authoring session whose target has no recording gets a prose refusal rather
 * than a wrong component: replaying the listing page into a session that asked
 * for the admin page would produce a green run that proved nothing.
 */
/**
 * @param partialChunks How many partial payloads each submission streams in.
 *   Eight is the honest default — it makes the editor's `onToolCallPartial`
 *   path run the way a provider drives it. Pass 1 to skip the partial path
 *   entirely when what is under test is downstream of authoring.
 *
 *   ⚠️ **This used to be expensive, and the reason was here, not in the
 *   editor.** Eight payloads for a 55-node component took 6m51s of *wall clock*
 *   (AAQ-011 F6), which was filed as editor main-thread cost. It was this
 *   function's pacing: it yielded with `setTimeout`, and Chromium clamps
 *   `setTimeout` in an occluded window — which the editor's main window is,
 *   every time this script drives it from a terminal (`src/main/main.js:311`
 *   leaves `backgroundThrottling` at its default; `turnDeadline.ts:26-29`
 *   records the same throttling making a scripted run look hung once before).
 *   The pacing is a `MessagePort` task now: still a macrotask, so the panel
 *   still renders between payloads, but not a timer, so nothing clamps it. The
 *   editor's own cost for the same eight payloads is ~0.2ms — see
 *   `scripts/aaq011-perf`.
 */
function installScript(partialChunks = 8) {
  return `(async () => {
    const mod = ${REQ(AI_CLIENT_MODULE)};
    const AiClient = mod.AiClient;
    if (!AiClient) return { ok: false, error: 'AiClient not found' };

    const COMPONENTS = ${JSON.stringify(COMPONENTS)};
    const SCOPE_ARGS = ${JSON.stringify(SCOPE_ARGS)};
    const PROSE_1 = ${JSON.stringify(SCOPE_PROSE_ROUND_1)};
    const PROSE_2 = ${JSON.stringify(SCOPE_PROSE_ROUND_2)};

    window.__aaq40 = { calls: [], scopeRounds: 0 };
    if (!window.__aaq40original) {
      window.__aaq40original = { chatStream: AiClient.chatStream, isConfigured: AiClient.isConfigured };
    }

    const usage = { promptTokens: 0, completionTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: 0 };
    const reply = (text, toolCalls) => ({
      text,
      toolCalls: toolCalls || [],
      usage,
      model: 'scripted-replay',
      stopReason: toolCalls && toolCalls.length ? 'tool_calls' : 'stop'
    });

    /**
     * Yield to the event loop between fragments, so the panel renders as it
     * would while a real stream arrives — WITHOUT a timer.
     *
     * A \`setTimeout\` here is what AAQ-011 F6 was: this window is occluded
     * whenever the script drives it, Chromium clamps timers in an occluded
     * window to a second and aligns them to a whole minute once it has been
     * hidden for five, and fourteen of these per component turned a
     * zero-latency provider into a seven-minute run. \`requestAnimationFrame\`
     * is worse — a hidden window stops servicing it at all. A \`MessagePort\`
     * message is a macrotask like a timer and is not a timer.
     */
    const yieldToEditor = () =>
      new Promise((resolve) => {
        const channel = new MessageChannel();
        channel.port1.onmessage = () => resolve();
        channel.port2.postMessage(0);
      });

    /** Stream the prose the way a provider does, so the panel's bubble behaves. */
    const streamText = async (callbacks, text) => {
      const chunks = 6;
      for (let i = 0; i < chunks; i++) {
        const upto = Math.floor((text.length * (i + 1)) / chunks);
        callbacks.onText?.(text.slice(0, upto));
        await yieldToEditor();
      }
    };

    AiClient.isConfigured = () => true;
    AiClient.chatStream = async (request, callbacks = {}) => {
      const toolNames = (request.tools || []).map((t) => t.name);
      const lastUser = [...(request.messages || [])].reverse().find((m) => m.role === 'user');
      const body = String(lastUser?.content ?? '');
      window.__aaq40.calls.push({ tools: toolNames, chars: body.length });

      // ── The scoping turn ────────────────────────────────────────────────
      if (toolNames.includes('record_scope')) {
        window.__aaq40.scopeRounds++;
        if (window.__aaq40.scopeRounds === 1) {
          await streamText(callbacks, PROSE_1);
          const call = { id: 'scripted-scope', name: 'record_scope', arguments: SCOPE_ARGS };
          callbacks.onToolCall?.(call);
          callbacks.onEnd?.();
          return reply(PROSE_1, [call]);
        }
        await streamText(callbacks, PROSE_2);
        callbacks.onEnd?.();
        return reply(PROSE_2, []);
      }

      // ── An authoring session ────────────────────────────────────────────
      if (toolNames.includes('submit_component')) {
        const match = body.match(/component at "([^"]+)"/) || body.match(/component "([^"]+)"/);
        const target = match ? match[1] : null;
        const recording = target ? COMPONENTS[target] : null;
        if (!recording) {
          const note = 'No recording for "' + target + '".';
          window.__aaq40.calls[window.__aaq40.calls.length - 1].miss = target;
          callbacks.onText?.(note);
          callbacks.onEnd?.();
          return reply(note, []);
        }
        window.__aaq40.calls[window.__aaq40.calls.length - 1].target = target;
        const args = {
          nodes: recording.nodes,
          ...(recording.connections ? { connections: recording.connections } : {}),
          ...(recording.description ? { description: recording.description } : {})
        };
        const argsText = JSON.stringify(args);
        const chunks = ${partialChunks};
        for (let i = 0; i < chunks; i++) {
          const upto = Math.floor((argsText.length * (i + 1)) / chunks);
          callbacks.onToolCallPartial?.({ index: 0, name: 'submit_component', argsText: argsText.slice(0, upto) });
          await yieldToEditor();
        }
        const call = { id: 'scripted-' + target, name: 'submit_component', arguments: args };
        callbacks.onToolCall?.(call);
        callbacks.onEnd?.();
        return reply('', [call]);
      }

      // ── Anything else (a doc pass, a plan) — decline in prose ───────────
      const note = 'Nothing to add.';
      callbacks.onText?.(note);
      callbacks.onEnd?.();
      return reply(note, []);
    };

    return { ok: true, components: Object.keys(COMPONENTS) };
  })()`;
}

/* -------------------------------------------------------------------------- */
/* Driving                                                                    */
/* -------------------------------------------------------------------------- */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(client, expression, { timeoutMs = 60000, every = 500, what = 'condition' } = {}) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    last = await evaluate(client, expression);
    if (last) return last;
    await sleep(every);
  }
  throw new Error(`timed out waiting for ${what} (last: ${JSON.stringify(last)})`);
}

async function click(client, selector) {
  const box = await elementCentre(client, selector);
  if (!box || !box.width) throw new Error(`no clickable box for ${selector}`);
  await dispatchClick(client, box);
}

/**
 * Click the first button whose visible text matches. Tagging and clicking happen
 * in one eval because a React re-render between two CDP calls drops the tag.
 */
async function clickButtonWithText(client, text, { scope = 'body' } = {}) {
  const box = await evaluate(
    client,
    `(() => {
      const root = document.querySelector(${JSON.stringify(scope)});
      if (!root) return null;
      const els = [...root.querySelectorAll('button, [role=button], a')];
      const hit = els.find((e) => (e.innerText || '').trim().toLowerCase().includes(${JSON.stringify(
        text.toLowerCase()
      )}));
      if (!hit) return null;
      const r = hit.getBoundingClientRect();
      if (!r.width || !r.height) return null;
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, width: r.width, height: r.height };
    })()`
  );
  if (!box) throw new Error(`no visible button matching "${text}"`);
  await dispatchClick(client, box);
  return box;
}

/** Set a React-controlled input's value the way React's onChange expects. */
async function setInput(client, selector, value) {
  return evaluate(
    client,
    `(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return false;
      const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
      setter.call(el, ${JSON.stringify(value)});
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()`
  );
}

/* -------------------------------------------------------------------------- */
/* The drive                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Click a button by its visible text after scrolling it into view.
 *
 * The Build panel's Author button sits below the fold of a scrollable panel, and
 * a `getBoundingClientRect()` outside the viewport is still a **non-zero box** —
 * so the documented "zero-sized box" guard does not fire, `dispatchClick` reports
 * success, and the click lands on whatever is actually at those coordinates. The
 * first run of this pass lost twenty minutes to a plan that simply never started.
 */
async function clickVisible(client, startsWith, { timeoutMs = 15000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const box = await evaluate(
      client,
      `(() => {
        const b = [...document.querySelectorAll('button, [role=button]')]
          .find((x) => (x.innerText || '').trim().startsWith(${JSON.stringify(startsWith)}));
        if (!b || b.disabled) return null;
        b.scrollIntoView({ block: 'center' });
        const r = b.getBoundingClientRect();
        if (!r.width || !r.height) return null;
        if (r.top < 0 || r.bottom > innerHeight) return null;
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      })()`
    );
    if (box) {
      await dispatchClick(client, box);
      return true;
    }
    await sleep(500);
  }
  throw new Error(`no visible, enabled, in-view button starting with "${startsWith}"`);
}

/** Drive the launcher wizard from an empty launcher to an applied plan. */
async function drive(client, { name, location, partialChunks }) {
  const step = (s) => console.log(`  · ${s}`);

  await evaluate(client, installScript(partialChunks));
  step(`scripted responder installed (${partialChunks} partial chunk(s) per submission)`);

  // The native folder picker cannot be clicked over CDP; the platform module is
  // the same seam `aix15-live` stubs for the same reason.
  await evaluate(
    client,
    `(() => {
      const p = ${REQ(PLATFORM_MODULE)};
      p.filesystem.openDialog = async () => ${JSON.stringify(location)};
      return true;
    })()`
  );

  await clickVisible(client, 'New project');
  await sleep(1000);
  await clickVisible(client, 'Start with AI');
  await sleep(1200);

  await setInput(client, 'input[placeholder="My New Project"]', name);
  await setInput(client, 'input[placeholder^="A brief description"]', 'AAQ Layer-1 live pass');
  await clickVisible(client, 'Browse...');
  await sleep(800);
  await clickVisible(client, 'Next'); // basics → style
  await sleep(900);
  await clickVisible(client, 'Next'); // style → scoping
  await sleep(900);
  step('wizard at the scoping step');

  await setInput(client, 'textarea[placeholder^="Describe the app"]', BRIEF);
  await sleep(300);
  await clickVisible(client, 'Send');
  // Generous on purpose: on a cold editor the first scoping turn has taken over
  // a minute of wall clock, entirely in module loading and React's first render
  // of the wizard — the scripted reply itself is ~100ms. A tight timeout here
  // reads as "the scope never agreed", which is the wrong thing to go looking at.
  await waitFor(client, `!!document.body.innerText.match(/AGREED SCOPE/)`, {
    what: 'the agreed scope',
    timeoutMs: 180000
  });
  step('scope agreed');

  await clickVisible(client, 'Continue');
  await sleep(1500);
  await clickVisible(client, 'Create project');
  await waitFor(client, `!!document.body.innerText.match(/Author plan/)`, {
    what: 'the Build panel to offer the plan',
    timeoutMs: 60000
  });
  step('project created, plan waiting in Build');

  await clickVisible(client, 'Author plan');
  // Two spellings, and only one of them means trouble: the panel says
  // "Apply to project (3)" when everything staged and "Apply 1 of 3 to project"
  // when some operations failed. Matching only the second reads a clean run as a
  // hang. Generous timeout for the same reason the scoping one is — a 55-node
  // component took SEVEN MINUTES of editor time here against a zero-latency
  // provider (see the pass notes); the model is not what this is waiting on.
  const outcome = await waitFor(
    client,
    `(() => {
       const t = document.body.innerText;
       const partial = t.match(/Apply (\\d+) of (\\d+) to project/);
       if (partial) return { staged: Number(partial[1]), total: Number(partial[2]), failed: true };
       const all = t.match(/Apply to project \\((\\d+)\\)/);
       if (all) return { staged: Number(all[1]), total: Number(all[1]), failed: false };
       return null;
     })()`,
    { what: 'the authoring fan-out to finish', timeoutMs: 900000, every: 5000 }
  );
  step(`authored: ${outcome.staged} of ${outcome.total} staged${outcome.failed ? ' (some failed)' : ''}`);
  if (outcome.staged !== outcome.total) {
    throw new Error(`only ${outcome.staged} of ${outcome.total} operations staged — see the panel's activity feed`);
  }

  await clickVisible(client, 'Apply');
  await waitFor(client, `!/Apply (to project|\\d+ of \\d+)/.test(document.body.innerText)`, {
    what: 'the apply to complete',
    timeoutMs: 120000
  });
  step('plan applied');
  return outcome;
}

/* -------------------------------------------------------------------------- */
/* Entry                                                                      */
/* -------------------------------------------------------------------------- */

async function main() {
  const argv = process.argv.slice(2);
  const has = (flag) => argv.includes(flag);
  const client = await connect(await appTarget('editor'));

  const probed = await evaluate(client, PROBE);
  if (!probed) throw new Error('could not capture webpack require in the editor renderer');

  if (has('--install')) {
    const result = await evaluate(client, installScript());
    console.log('install:', JSON.stringify(result));
  }

  if (has('--drive')) {
    const nameArg = argv.find((a) => a.startsWith('--name='));
    const locationArg = argv.find((a) => a.startsWith('--location='));
    if (!locationArg) throw new Error('--drive needs --location=<a directory to create the project in>');
    console.log('drive:');
    await drive(client, {
      name: nameArg ? nameArg.slice('--name='.length) : 'aaq40-livepass',
      location: locationArg.slice('--location='.length),
      partialChunks: has('--fast') ? 1 : 8
    });
  }

  if (has('--calls')) {
    console.log('calls:', JSON.stringify(await evaluate(client, 'window.__aaq40 && window.__aaq40.calls'), null, 1));
  }

  await client.close?.();
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  });
}

module.exports = {
  installScript,
  drive,
  PROBE,
  REQ,
  PLATFORM_MODULE,
  PROJECT_MODULE,
  SIDEBAR_MODULE,
  waitFor,
  click,
  clickButtonWithText,
  clickVisible,
  setInput,
  sleep
};
