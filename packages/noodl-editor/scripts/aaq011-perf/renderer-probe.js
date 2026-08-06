#!/usr/bin/env node
/**
 * AAQ-011 F6 — the same measurement, inside the running editor.
 *
 * `dist/aaq011-harness.cjs` proves the *model* layer is flat: 200 nodes streamed
 * as 64 partial payloads through `AuthoringSession` → `PlanRun` →
 * `PlanSessionStore`'s snapshot costs ~1ms in total, in Node. That leaves two
 * things a plain-Node run cannot see, and this probe measures both in the
 * renderer the 6m51s was measured in:
 *
 *   timers   `await new Promise(r => setTimeout(r, 10))` — what the *fixture
 *            provider* does between partial payloads. Chromium throttles
 *            `setTimeout` in an occluded window (1s clamped when hidden, aligned
 *            to a whole minute once hidden for 5 minutes), and the editor's main
 *            window uses Electron's default `backgroundThrottling: true`
 *            (`src/main/main.js:311` sets no override). `turnDeadline.ts:26-29`
 *            already records this biting once, in AIB-002's live QA.
 *
 *   session  the real `AuthoringSession` over the real 56-node
 *            `aaq40-live/fixtures.js` payload, streamed as C partials with **no
 *            sleeps at all**, timed around each `onToolCallPartial`. This is the
 *            editor main-thread cost per published partial payload, which is
 *            what the row claims is 6m51s for a 55-node component.
 *
 * Usage (editor must be running: `npm run dev:debug -- --quiet`):
 *
 *   node packages/noodl-editor/scripts/aaq011-perf/renderer-probe.js
 *   node packages/noodl-editor/scripts/aaq011-perf/renderer-probe.js --timers-only
 *
 * Run it once with the editor window in front and once with it fully covered by
 * another window — the two numbers are the finding.
 */
const path = require('path');

const { appTarget, connect, evaluate } = require('../../../../scripts/devtools/cdp');
const { COMPONENTS } = require('../aaq40-live/fixtures');

const PROBE = `(() => {
  if (!window.__aaq011wr) {
    window.webpackChunknoodl_editor.push([['aaq011'], {}, (r) => (window.__aaq011wr = r)]);
  }
  return typeof window.__aaq011wr === 'function';
})()`;

const REQ = (id) => `window.__aaq011wr(${JSON.stringify(id)})`;
const SESSION_MODULE = './src/editor/src/models/AiAssistant/authoring/AuthoringSession.ts';

/**
 * What the fixture provider's own pacing costs, right now, both ways.
 *
 * `setTimeout` is what `wizard-replay.js` used: eight of them per submission,
 * plus six for the prose. A `MessagePort` task is the same thing — a macrotask
 * that yields to the event loop so React can render between fragments — and it
 * is **not** a timer, so Chromium's occluded-window clamp does not reach it.
 * `requestAnimationFrame` is not an option: a hidden window stops servicing it
 * altogether, which is worse than slow.
 */
const timerScript = `(async () => {
  const timeouts = [];
  for (let i = 0; i < 8; i++) {
    const t0 = performance.now();
    await new Promise((r) => setTimeout(r, 10));
    timeouts.push(Math.round(performance.now() - t0));
  }
  const ports = [];
  for (let i = 0; i < 8; i++) {
    const t0 = performance.now();
    await new Promise((r) => {
      const channel = new MessageChannel();
      channel.port1.onmessage = () => r();
      channel.port2.postMessage(0);
    });
    ports.push(Math.round((performance.now() - t0) * 100) / 100);
  }
  return {
    visibility: document.visibilityState,
    hidden: document.hidden,
    hasFocus: document.hasFocus(),
    requestedMs: 10,
    setTimeoutMs: timeouts,
    setTimeoutTotalMs: Math.round(timeouts.reduce((a, b) => a + b, 0)),
    messagePortMs: ports,
    messagePortTotalMs: Math.round(ports.reduce((a, b) => a + b, 0) * 100) / 100
  };
})()`;

/**
 * One real authoring session in the renderer, streamed synchronously.
 *
 * Nothing sleeps: the point is to separate what the editor *does* with a partial
 * payload from what the fixture's pacing costs. A listener is attached because
 * `publish()` short-circuits nothing when there are none — the state object is
 * built either way — but a subscriber is what the product has.
 */
function sessionScript(payload, chunks) {
  return `(async () => {
    const mod = ${REQ(SESSION_MODULE)};
    const AuthoringSession = mod.AuthoringSession;
    if (!AuthoringSession) return { ok: false, error: 'AuthoringSession not found' };

    const args = ${JSON.stringify(payload)};
    const argsText = JSON.stringify(args);
    const chunks = ${chunks};
    const partialMs = [];

    const chat = async (request, callbacks = {}) => {
      for (let i = 0; i < chunks; i++) {
        const upto = Math.floor((argsText.length * (i + 1)) / chunks);
        const t0 = performance.now();
        callbacks.onToolCallPartial?.({ index: 0, name: 'submit_component', argsText: argsText.slice(0, upto) });
        partialMs.push(performance.now() - t0);
      }
      const call = { id: 'probe', name: 'submit_component', arguments: args };
      callbacks.onToolCall?.(call);
      callbacks.onEnd?.();
      return {
        text: '',
        toolCalls: [call],
        usage: { promptTokens: 0, completionTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: 0 },
        model: 'probe',
        stopReason: 'tool_calls'
      };
    };

    let publishes = 0;
    const session = AuthoringSession.create(
      { components: [] },
      { description: 'Probe.', componentPath: 'Pages/AaqProbe' },
      { chat, maxSubmits: 1, maxTurns: 2, stallMs: 0 }
    );
    session.onChange(() => { publishes++; });

    const t0 = performance.now();
    const outcome = await session.run();
    const totalMs = performance.now() - t0;
    session.dispose();

    const sum = partialMs.reduce((a, b) => a + b, 0);
    return {
      ok: true,
      nodes: args.nodes.length,
      chunks,
      status: outcome.status,
      totalMs: Math.round(totalMs * 10) / 10,
      partialTotalMs: Math.round(sum * 10) / 10,
      partialEachMs: partialMs.map((m) => Math.round(m * 10) / 10),
      publishes
    };
  })()`;
}

/** A synthetic payload of N nodes, in the fixture's own shape. */
function syntheticPayload(nodeCount) {
  const nodes = [
    { id: 'page', type: 'Page', label: 'Probe', parameters: { title: 'Probe', urlPath: 'probe' } },
    {
      id: 'root',
      type: 'Group',
      label: 'Body',
      parent: 'page',
      parameters: { sizeMode: 'contentHeight', width: { value: 100, unit: '%' }, backgroundColor: '#F6F8FA' }
    }
  ];
  let section = 'root';
  for (let i = 2; i < nodeCount; i++) {
    if (i % 6 === 2) {
      section = `section-${i}`;
      nodes.push({
        id: section,
        type: 'Group',
        parent: 'root',
        parameters: { sizeMode: 'contentHeight', width: { value: 100, unit: '%' }, backgroundColor: '#FFFFFF' }
      });
      continue;
    }
    nodes.push({
      id: `node-${i}`,
      type: 'Text',
      parent: section,
      parameters: { text: `Row ${i} — a line of copy long enough to be worth streaming`, color: '#1B1D21' }
    });
  }
  return { nodes, connections: [], description: 'A synthetic page.' };
}

async function main() {
  const argv = process.argv.slice(2);
  const client = await connect(await appTarget('editor'));
  if (!(await evaluate(client, PROBE))) throw new Error('could not capture webpack require in the editor renderer');

  const timers = await evaluate(client, timerScript);
  console.log('timers:', JSON.stringify(timers));

  if (!argv.includes('--timers-only')) {
    const cases = [
      ['Pages/Admin (fixture)', COMPONENTS['Pages/Admin']],
      ['Pages/Puppies (fixture)', COMPONENTS['Pages/Puppies']],
      ['synthetic 200', syntheticPayload(200)]
    ];
    for (const [name, recording] of cases) {
      const payload = {
        nodes: recording.nodes,
        ...(recording.connections ? { connections: recording.connections } : {}),
        ...(recording.description ? { description: recording.description } : {})
      };
      for (const chunks of [1, 8, 64]) {
        const result = await evaluate(client, sessionScript(payload, chunks));
        console.log(`${name} × ${chunks}:`, JSON.stringify(result));
      }
    }
  }

  await client.close?.();
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
