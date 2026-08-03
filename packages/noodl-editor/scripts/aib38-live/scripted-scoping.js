#!/usr/bin/env node
/**
 * Phase 38 — the scripted, no-provider **scoping conversation**.
 *
 * The launcher's wizard is the first AI surface anyone meets, and two of this
 * phase's findings live in it: AIB-006 (assistant replies rendered as raw
 * markdown) and AIB-009 F7 (a static `Thinking…` for the whole turn, the one AI
 * interaction in the product with no feedback at all). Neither can be checked
 * from a suite — core-ui has jest but no jsdom, and what is being claimed is
 * about a *mount*.
 *
 * Same seam as `scripted-plan.js` and only that seam: `AiClient` is a plain
 * object literal, so `chatStream` is replaced at runtime. Everything else —
 * `ScopingSession`, the wizard, `ScopingStep`, `Markdown` — is the app's own
 * code.
 *
 * ## No timers, deliberately
 *
 * `scripted-plan.js` learned this the hard way: Chromium throttles `setTimeout`
 * in an occluded window to roughly one wake a minute, which made a seven-second
 * turn measure three and a half minutes and read exactly like a hang. A turn
 * here has to stay in flight long enough to be *looked at* mid-stream, so
 * instead of sleeping it **blocks on a promise this script resolves over CDP**.
 * The turn is held open for exactly as long as the driver needs and not one tick
 * longer, and no assertion depends on a duration.
 *
 * Usage (editor must be running via `npm run dev:debug`, at the launcher):
 *
 *   node packages/noodl-editor/scripts/aib38-live/scripted-scoping.js [--json]
 *   node packages/noodl-editor/scripts/aib38-live/scripted-scoping.js --create
 *
 * `--create` carries on through Review and actually creates the project, which
 * is exit criteria 1 and 2 end to end (wizard → editor → the plan announced).
 * Without it the run stops after the conversation and creates nothing.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const { appTarget, connect, evaluate, dispatchClick } = require('../../../../scripts/devtools/cdp');

const PROBE = `(() => {
  if (!window.__aib38wr) {
    window.webpackChunknoodl_editor.push([['aib38-scoping'], {}, (r) => (window.__aib38wr = r)]);
  }
  return typeof window.__aib38wr === 'function';
})()`;
const REQ = (id) => `window.__aib38wr(${JSON.stringify(id)})`;
const AI_CLIENT_MODULE = './src/editor/src/models/AiAssistant/client/AiClient.ts';
const PLATFORM_MODULE = '../noodl-platform/src/index.ts';

/**
 * The reply, in markdown. Every construct AIB-006 criterion 1 names — heading,
 * bold, list, code — because "renders markdown" is not one claim, it is four.
 */
const REPLY = [
  '## Pages',
  '',
  "Three pages, and **nothing else** until you say so:",
  '',
  '- Sign up',
  '- The list of chats',
  '- One conversation',
  '',
  'Routes live under `/Pages`.'
].join('\n');

/** Split so the held sample lands mid-document, with markup already open. */
const CHUNKS = [REPLY.slice(0, 46), REPLY.slice(46, 96), REPLY.slice(96)];

/** The user's own words carry markdown syntax, which must NOT be interpreted. */
const USER_MESSAGE =
  'A chat app with signup, a chat list and chat pages. Call the first one **Signup** exactly like that.';

const SCOPE = {
  summary: 'A chat app: sign up, see your chats, open one.',
  audience: 'People who want a small private group chat.',
  pages: [
    { name: 'Signup', purpose: 'Create an account or sign in.' },
    { name: 'Chats', purpose: 'The list of conversations.' },
    { name: 'Chat', purpose: 'One conversation.' }
  ],
  objects: [{ name: 'Message', purpose: 'One message in a chat', fields: ['text', 'author', 'sentAt'] }],
  conventions: ['Pages live under /Pages.'],
  agreed: true
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(client, expression, { timeoutMs = 30000, every = 200, what = 'condition' } = {}) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    last = await evaluate(client, expression);
    if (last) return last;
    await sleep(every);
  }
  throw new Error(`timed out waiting for ${what} (last value: ${JSON.stringify(last)})`);
}

/** Resolve and click in ONE eval — a re-render between two calls drops the tag. */
async function clickWithText(client, text, { selector = 'button, [role=button]', exact = false } = {}) {
  const box = await evaluate(
    client,
    `(() => {
       const want = ${JSON.stringify(text)}.toLowerCase();
       const all = Array.from(document.querySelectorAll(${JSON.stringify(selector)}));
       const el = all.find((b) => (b.innerText || '').trim().toLowerCase() === want)
         || (${exact ? 'null' : 'all.find((b) => (b.innerText || "").trim().toLowerCase().includes(want))'});
       if (!el) return null;
       el.scrollIntoView({ block: 'center' });
       const r = el.getBoundingClientRect();
       return { x: r.left + r.width / 2, y: r.top + r.height / 2, width: r.width, height: r.height,
                label: (el.innerText || '').trim().slice(0, 60) };
     })()`
  );
  if (!box) throw new Error(`no control reading "${text}"`);
  if (!box.width || !box.height) throw new Error(`"${text}" has a zero-sized box — is it hidden?`);
  await dispatchClick(client, box);
  return box.label;
}

function installScript() {
  return `(() => {
    const AiClient = ${REQ(AI_CLIENT_MODULE)}.AiClient;
    if (!AiClient) return { ok: false, error: 'AiClient not found' };
    if (!window.__aib38scopeOriginal) {
      window.__aib38scopeOriginal = { chatStream: AiClient.chatStream, isConfigured: AiClient.isConfigured };
    }
    const state = { round: 0, held: false, release: null, rounds: [] };
    window.__aib38scope = state;

    const CHUNKS = ${JSON.stringify(CHUNKS)};
    const SCOPE = ${JSON.stringify(SCOPE)};
    const usage = { promptTokens: 0, completionTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: 0 };

    // No timers anywhere: the turn stays in flight until the driver lets it go.
    const hold = () => new Promise((resolve) => { state.release = resolve; state.held = true; });

    AiClient.isConfigured = () => true;
    AiClient.chatStream = async (request, callbacks = {}) => {
      const tools = (request.tools || []).map((t) => t.name);
      if (!tools.includes('record_scope')) {
        return { text: 'Not this session.', toolCalls: [], usage, model: 'scripted-replay', stopReason: 'stop' };
      }
      const round = ++state.round;
      state.rounds.push(round);

      if (round === 1) {
        // Record the scope first, in its own round, exactly as the prompt asks
        // the model to. No prose: this is the round the wizard has nothing to
        // show, and the thinking row is the honest thing to show in it.
        return {
          text: '',
          toolCalls: [{ id: 'scope-1', name: 'record_scope', arguments: SCOPE }],
          usage,
          model: 'scripted-replay',
          stopReason: 'tool_calls'
        };
      }

      let acc = '';
      for (let i = 0; i < CHUNKS.length; i++) {
        acc += CHUNKS[i];
        callbacks.onText?.(acc, CHUNKS[i]);
        // Held after every chunk but the last, so the driver can sample a reply
        // that is genuinely half-arrived rather than one that merely rendered.
        if (i < CHUNKS.length - 1) await hold();
      }
      callbacks.onEnd?.();
      return { text: acc, toolCalls: [], usage, model: 'scripted-replay', stopReason: 'stop' };
    };
    return { ok: true };
  })()`;
}

/** What the wizard's feed looks like right now, structurally — not as a string. */
const FEED_PROBE = `(() => {
  const feed = document.querySelector('[role=log]');
  if (!feed) return { present: false };
  const bubbles = Array.from(feed.children).map((el) => ({
    className: el.className,
    text: (el.innerText || '').trim(),
    tags: Array.from(el.querySelectorAll('*')).map((n) => n.tagName.toLowerCase())
  }));
  return {
    present: true,
    thinking: bubbles.some((b) => b.text === 'Thinking…'),
    bubbles
  };
})()`;

function check(steps, name, ok, detail) {
  steps.push({ name, ok: Boolean(ok), detail });
  return Boolean(ok);
}

async function releaseHold(client) {
  await waitFor(client, `(() => Boolean(window.__aib38scope && window.__aib38scope.held))()`, {
    what: 'the scripted turn to reach a hold'
  });
  return evaluate(
    client,
    `(() => { const s = window.__aib38scope; s.held = false; const r = s.release; s.release = null; r && r(); return true; })()`
  );
}

async function main() {
  const args = {};
  for (const arg of process.argv.slice(2)) {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(arg);
    if (m) args[m[1]] = m[2] === undefined ? true : m[2];
  }

  const client = await connect(await appTarget('editor'));
  const steps = [];
  const report = { steps };

  try {
    if (!(await evaluate(client, PROBE))) throw new Error('could not capture webpack require — is the editor up?');
    const installed = await evaluate(client, installScript());
    if (!installed.ok) throw new Error(installed.error);

    // ── Into the wizard, in AI mode ─────────────────────────────────────────
    await clickWithText(client, 'New project');
    await waitFor(client, `(() => /Create New Project/.test(document.body.innerText || ''))()`, {
      what: 'the wizard to open'
    });
    const aiCard = await evaluate(
      client,
      `(() => {
         const el = Array.from(document.querySelectorAll('button'))
           .find((b) => /Start with AI/.test(b.innerText || ''));
         return el ? { disabled: el.disabled, text: (el.innerText || '').trim() } : null;
       })()`
    );
    if (!aiCard) throw new Error('no "Start with AI" card in the wizard');
    if (aiCard.disabled) throw new Error(`the AI card is disabled: ${aiCard.text}`);
    await clickWithText(client, 'Start with AI');
    await sleep(400);

    // Basics: a name and a location, both required before Next is live.
    const projectDir = path.join(os.tmpdir(), `aib38-scoped-${process.pid}`);
    fs.rmSync(projectDir, { recursive: true, force: true });
    fs.mkdirSync(projectDir, { recursive: true });
    report.projectDir = projectDir;
    await evaluate(
      client,
      `(() => { ${REQ(PLATFORM_MODULE)}.filesystem.openDialog = async () => ${JSON.stringify(projectDir)}; return true; })()`
    );
    await evaluate(
      client,
      `(() => {
         const input = document.querySelector('input[placeholder="My New Project"]');
         if (!input) return false;
         const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
         setter.call(input, 'AIB38 Chat');
         input.dispatchEvent(new Event('input', { bubbles: true }));
         return true;
       })()`
    );
    await sleep(200);
    await clickWithText(client, 'Choose', { exact: false });
    await sleep(400);
    await clickWithText(client, 'Next', { exact: true });
    await sleep(300);
    await clickWithText(client, 'Next', { exact: true }); // preset step: the default stands
    await waitFor(client, `(() => /What are we building\\?/.test(document.body.innerText || ''))()`, {
      what: 'the scoping step'
    });

    // ── The conversation ────────────────────────────────────────────────────
    await evaluate(
      client,
      `(() => {
         const area = document.querySelector('[role=log]') && document.querySelector('textarea');
         if (!area) return false;
         const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
         setter.call(area, ${JSON.stringify(USER_MESSAGE)});
         area.dispatchEvent(new Event('input', { bubbles: true }));
         return true;
       })()`
    );
    await sleep(200);
    await clickWithText(client, 'Send', { exact: true });

    // Round 1 records the scope and says nothing — the one moment `Thinking…`
    // is the truth. It is not held, so this is a race against a fast round; the
    // claim being checked is the row's presence at all, so a miss is reported
    // rather than failed.
    report.roundOne = await evaluate(client, FEED_PROBE);

    // Round 2 streams. Sample it while it is half-arrived.
    await waitFor(client, `(() => Boolean(window.__aib38scope && window.__aib38scope.held))()`, {
      what: 'the streamed reply to reach its first hold'
    });
    await sleep(250); // let React paint what it has
    const midStream = await evaluate(client, FEED_PROBE);
    report.midStream = midStream;
    const streamed = midStream.bubbles.filter((b) => /assistant/i.test(b.className));

    check(
      steps,
      'AIB-009 F7: the reply is on screen while the turn is still in flight',
      streamed.length === 1 && streamed[0].text.length > 0 && streamed[0].text.length < REPLY.length,
      `${streamed.length} assistant bubble(s), ${streamed[0] ? streamed[0].text.length : 0} of ${REPLY.length} chars`
    );
    check(
      steps,
      'AIB-009 F7: `Thinking…` is replaced by the reply, not shown beside it',
      midStream.thinking === false,
      `thinking row present: ${midStream.thinking}`
    );
    check(
      steps,
      'AIB-006 §1: the partial reply is rendered markdown — heading, bold, list',
      Boolean(
        streamed[0] &&
          streamed[0].tags.includes('h2') &&
          streamed[0].tags.includes('strong') &&
          streamed[0].tags.includes('li')
      ),
      streamed[0] ? [...new Set(streamed[0].tags)].join(',') : 'no assistant bubble'
    );
    check(
      steps,
      'AIB-006 §1: the markdown syntax itself is gone from the rendered text',
      Boolean(streamed[0] && !streamed[0].text.includes('##') && !streamed[0].text.includes('**')),
      streamed[0] ? JSON.stringify(streamed[0].text.slice(0, 60)) : '—'
    );

    await releaseHold(client);
    await releaseHold(client);
    await waitFor(client, `(() => !/Thinking…/.test(document.body.innerText || ''))()`, {
      what: 'the turn to finish'
    });
    await sleep(400);

    const settled = await evaluate(client, FEED_PROBE);
    report.settled = settled;
    const finalAssistant = settled.bubbles.filter((b) => /assistant/i.test(b.className));
    const userBubbles = settled.bubbles.filter((b) => /user/i.test(b.className));

    check(
      steps,
      'AIB-009 F7: the streamed copy is replaced by the transcript, not added to it',
      finalAssistant.length === 1 && finalAssistant[0].text.includes('One conversation'),
      `${finalAssistant.length} assistant bubble(s) after the turn`
    );
    check(
      steps,
      'AIB-006 §2: the user\'s own asterisks are shown, not interpreted',
      userBubbles.length === 1 &&
        userBubbles[0].text.includes('**Signup**') &&
        !userBubbles[0].tags.includes('strong'),
      userBubbles[0] ? JSON.stringify(userBubbles[0].text.slice(-40)) : 'no user bubble'
    );

    const outline = await evaluate(
      client,
      `(() => {
         const list = document.querySelector('ul');
         return list ? Array.from(list.querySelectorAll('li')).map((li) => (li.innerText || '').trim()) : [];
       })()`
    );
    report.outline = outline;

    if (!args.create) {
      report.stoppedBefore = 'project creation (pass --create to go on)';
    } else {
      // ── Exit criteria 1 → 2: create it, and see the plan announced ────────
      await clickWithText(client, 'Continue', { exact: true });
      await waitFor(client, `(() => /the plan waits in Build/.test(document.body.innerText || ''))()`, {
        what: 'the review step to offer the plan-bearing create'
      });
      check(steps, 'AIB-005 §3: the last screen names where the plan will be', true, 'Create project — the plan waits in Build');
      await clickWithText(client, 'the plan waits in Build');
      await waitFor(
        client,
        `(() => /A plan is waiting|plan is waiting|Build/.test(document.body.innerText || '') &&
               !/Create New Project/.test(document.body.innerText || ''))()`,
        { timeoutMs: 120000, what: 'the editor to open the new project' }
      );
      await sleep(2000);
      report.afterCreate = await evaluate(
        client,
        `(() => ({
           body: (document.body.innerText || '').slice(0, 400),
           docs: (() => { try { return require('fs').readdirSync(${JSON.stringify(projectDir)}); } catch (e) { return String(e); } })()
         }))()`
      );
    }
  } catch (error) {
    report.error = error instanceof Error ? error.message : String(error);
  } finally {
    await evaluate(
      client,
      `(() => {
         const AiClient = ${REQ(AI_CLIENT_MODULE)}.AiClient;
         if (window.__aib38scopeOriginal) {
           AiClient.chatStream = window.__aib38scopeOriginal.chatStream;
           AiClient.isConfigured = window.__aib38scopeOriginal.isConfigured;
         }
         return true;
       })()`
    ).catch(() => undefined);
    client.close?.();
  }

  const failed = steps.filter((s) => !s.ok);
  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    for (const step of steps) console.log(`${step.ok ? '  ok  ' : ' FAIL '} ${step.name}\n         ${step.detail}`);
    if (report.outline) console.log(`outline: ${report.outline.join(' | ')}`);
    if (report.error) console.log(`\nerror: ${report.error}`);
  }
  process.exit(report.error || failed.length > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
