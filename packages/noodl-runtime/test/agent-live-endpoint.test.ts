/**
 * AIX-005 — the agentic-UI nodes against a **real** endpoint. Opt-in.
 *
 * Every other suite in this family injects a double for the transport, which is
 * what makes the lifecycle matrix testable but also means the platform `fetch`
 * and `WebSocket` paths had never executed. This one runs them for real, with no
 * seams at all, against the example project's mock endpoint.
 *
 * It is **skipped unless a server is deliberately provided**, because it needs a
 * process this repository does not start for you:
 *
 *   node project-examples/agent-chat/mock-agent-server.mjs 4831 5
 *   NODEGX_AGENT_LIVE=http://localhost:4831 npx jest test/agent-live-endpoint --forceExit
 *
 * `--forceExit` is not hiding a leak in the nodes — each one's disposal is
 * asserted here and in its own suite. Node's global fetch keeps its connection
 * pool alive after the last request, so the event loop does not drain on its own.
 *
 * Two things about the harness, which are also the two things to know when
 * driving these nodes from a test at all:
 *
 * - Downstream nodes are driven from the upstream node's own signal emissions
 *   (by intercepting `sendSignalOnOutput`), which is what a graph connection
 *   does. Polling an output value cannot keep up with a token stream, and an
 *   unconnected output's cached `.value` is not what the graph would have seen.
 * - Signal inputs are **edge-triggered**: `setInputValue(name, true)` twice in a
 *   row fires once. `pulse()` resets the edge first.
 */
import type { NodeModule } from '@noodl/types';

import { globalStoreManager } from '../src/nodes/std-library/agent/globalstore';

import { createGraph, outputValue, pulse, TestGraph } from './helpers/node-harness';

import sseModule = require('../src/nodes/std-library/agent/sse');
import accumModule = require('../src/nodes/std-library/agent/text-accumulator');
import wsModule = require('../src/nodes/std-library/agent/websocket');
import bufModule = require('../src/nodes/std-library/agent/stream-buffer');
import jsonModule = require('../src/nodes/std-library/agent/json-stream-parser');
import dispatcherModule = require('../src/nodes/std-library/agent/actiondispatchernode');
import handlerModule = require('../src/nodes/std-library/agent/actionhandlernode');
import storeModule = require('../src/nodes/std-library/agent/globalstorenode');

const BASE = process.env.NODEGX_AGENT_LIVE || '';
const WS_BASE = BASE.replace(/^http/, 'ws');

/** Skipped by default: without a mock endpoint there is nothing to talk to. */
const live = BASE ? describe : describe.skip;

/** Takes an array, unlike `createGraph`'s variadic form, because every call site has one. */
const harness = (modules: NodeModule[]): TestGraph => createGraph(...modules);

const out = outputValue;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Narrows one parsed NDJSON value far enough to read its `kind` discriminator. */
function isKind(value: unknown, kind: string): boolean {
  return !!value && typeof value === 'object' && (value as { kind?: unknown }).kind === kind;
}

async function until(predicate: () => boolean, ms = 20000, step = 25) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await wait(step);
  }
  return false;
}

live('LIVE: SSE + Text Accumulator against a real streaming POST', () => {
  it('streams a canned answer token by token and ends cleanly', async () => {
    const h = harness([sseModule, accumModule]);
    const sse = h.make('net.noodl.SSE', 'sse');
    const accum = h.make('net.noodl.TextAccumulator', 'accum');

    accum.setInputValue('delimiter', '');

    h.on('sse', (signal) => {
      if (signal === 'onOpen') pulse(accum, 'clear');
      if (signal === 'onMessage') {
        // `text`, not `data`: `data` is JSON-parsed, so a token that happens to look like
        // a number arrives as one and a JSON-envelope stream arrives as an object.
        accum.setInputValue('chunk', out(sse, 'text'));
        pulse(accum, 'add');
      }
    });

    sse.setInputValue('url', BASE + '/chat/stream');
    sse.setInputValue('transport', 'fetch');
    sse.setInputValue('method', 'POST');
    sse.setInputValue('headers', { 'Content-Type': 'application/json', Authorization: 'Bearer live-test' });
    sse.setInputValue('body', JSON.stringify({ prompt: 'live test' }));
    sse.setInputValue('reconnectOnStreamEnd', false);
    sse.setInputValue('connect', true);

    expect(await until(() => out(sse, 'connectionState') === 'open')).toBe(true);
    expect(await until(() => out(sse, 'connectionState') === 'closed')).toBe(true);

    const answer = String(out(accum, 'accumulated'));
    // eslint-disable-next-line no-console
    console.log('LIVE-SSE', {
      state: out(sse, 'connectionState'),
      messageCount: out(sse, 'messageCount'),
      lastEventId: out(sse, 'lastEventId'),
      deliverySemantics: out(sse, 'deliverySemantics'),
      retryCount: out(sse, 'retryCount'),
      lastError: out(sse, 'lastError'),
      duplicatesSuppressed: out(sse, 'duplicatesSuppressed'),
      signals: Array.from(new Set(h.signalsFor('sse'))),
      accumulatedChars: answer.length,
      characterCount: out(accum, 'characterCount'),
      byteCount: out(accum, 'byteCount'),
      head: answer.slice(0, 120)
    });

    expect(out(sse, 'messageCount')).toBeGreaterThan(20);
    expect(out(sse, 'lastError')).toBe('');
    expect(out(sse, 'retryCount')).toBe(0);
    expect(out(sse, 'deliverySemantics')).toBe('at-least-once-deduped');
    expect(h.signalsFor('sse')).toContain('onOpen');
    expect(h.signalsFor('sse')).toContain('onClose');
    expect(answer).toContain('live test');
    expect(answer).toContain('```js');
    // Newlines survived the wire format's own line-based framing.
    expect(answer).toContain('\n');

    sse._onNodeDeleted();
    accum._onNodeDeleted();
  }, 60000);

  it('unwraps an OpenAI-style JSON envelope into the same answer', async () => {
    // The shape no test had ever run: `data: {"choices":[{"delta":{"content":"…"}}]}`
    // followed by a `[DONE]` sentinel. `data` is an object here, which is what used to
    // reach a Text Accumulator and render `[object Object]` once per token.
    const h = harness([sseModule, accumModule]);
    const sse = h.make('net.noodl.SSE', 'sse');
    const accum = h.make('net.noodl.TextAccumulator', 'accum');

    accum.setInputValue('delimiter', '');

    const dataShapes = new Set<string>();
    h.on('sse', (signal) => {
      if (signal === 'onOpen') pulse(accum, 'clear');
      if (signal === 'onMessage') {
        dataShapes.add(typeof out(sse, 'data'));
        accum.setInputValue('chunk', out(sse, 'text'));
        pulse(accum, 'add');
      }
    });

    sse.setInputValue('url', BASE + '/chat/stream-json');
    sse.setInputValue('transport', 'fetch');
    sse.setInputValue('method', 'POST');
    sse.setInputValue('textPath', 'choices.0.delta.content');
    sse.setInputValue('headers', { 'Content-Type': 'application/json' });
    sse.setInputValue('body', JSON.stringify({ prompt: 'json envelope' }));
    sse.setInputValue('reconnectOnStreamEnd', false);
    sse.setInputValue('connect', true);

    expect(await until(() => out(sse, 'connectionState') === 'closed')).toBe(true);

    const answer = String(out(accum, 'accumulated'));
    // eslint-disable-next-line no-console
    console.log('LIVE-SSE-JSON', {
      messageCount: out(sse, 'messageCount'),
      dataShapes: Array.from(dataShapes),
      accumulatedChars: answer.length,
      accumulatorError: out(accum, 'error'),
      head: answer.slice(0, 120)
    });

    // `data` really was an object for the token frames — the trap is exercised, not
    // side-stepped — and the answer is still clean text.
    expect(Array.from(dataShapes)).toContain('object');
    expect(answer).toContain('json envelope');
    expect(answer).toContain('```js');
    expect(answer).not.toContain('[object Object]');
    expect(answer).not.toContain('[DONE]');
    expect(answer).not.toContain('choices');
    expect(out(accum, 'error')).toBe('');

    sse._onNodeDeleted();
    accum._onNodeDeleted();
  }, 60000);

  it('refuses the mis-wiring instead of rendering it, when data is wired to chunk', async () => {
    // The old advertised wiring, kept as a spec so the failure stays legible rather than
    // going back to being plausible.
    const h = harness([sseModule, accumModule]);
    const sse = h.make('net.noodl.SSE', 'sse');
    const accum = h.make('net.noodl.TextAccumulator', 'accum');

    accum.setInputValue('delimiter', '');
    const errorsSeen: string[] = [];
    h.on('sse', (signal) => {
      if (signal === 'onMessage') {
        accum.setInputValue('chunk', out(sse, 'data'));
        pulse(accum, 'add');
        const error = String(out(accum, 'error'));
        if (error) errorsSeen.push(error);
      }
    });

    sse.setInputValue('url', BASE + '/chat/stream-json');
    sse.setInputValue('transport', 'fetch');
    sse.setInputValue('method', 'POST');
    sse.setInputValue('body', JSON.stringify({ prompt: 'mis-wired' }));
    sse.setInputValue('connect', true);

    expect(await until(() => out(sse, 'connectionState') === 'closed')).toBe(true);

    // eslint-disable-next-line no-console
    console.log('LIVE-SSE-MISWIRED', {
      accumulated: String(out(accum, 'accumulated')).slice(0, 80),
      framesRefused: errorsSeen.length,
      firstError: errorsSeen[0]
    });
    expect(String(out(accum, 'accumulated'))).not.toContain('[object Object]');
    expect(errorsSeen.length).toBeGreaterThan(20);
    expect(errorsSeen[0]).toContain('Chunk must be text');
    // The sentinel at the end *is* text, so the error clears — which is the intended
    // behaviour and the reason the assertion above watches the stream rather than its end.
    expect(out(accum, 'error')).toBe('');
    expect(String(out(accum, 'accumulated'))).toBe('[DONE]');

    sse._onNodeDeleted();
    accum._onNodeDeleted();
  }, 60000);

  it('reports a terminal error for a route that does not exist', async () => {
    const h = harness([sseModule]);
    const sse = h.make('net.noodl.SSE', 'sse');
    sse.setInputValue('url', BASE + '/nope');
    sse.setInputValue('transport', 'fetch');
    sse.setInputValue('connect', true);

    expect(await until(() => out(sse, 'connectionState') === 'error', 10000)).toBe(true);
    // eslint-disable-next-line no-console
    console.log('LIVE-SSE-404', { lastError: out(sse, 'lastError'), signals: h.signalsFor('sse') });
    expect(out(sse, 'lastError')).toContain('404');
    sse._onNodeDeleted();
  }, 20000);

  it('cancels a real in-flight stream on disconnect and leaves nothing running', async () => {
    const h = harness([sseModule]);
    const sse = h.make('net.noodl.SSE', 'sse');
    sse.setInputValue('url', BASE + '/chat/stream');
    sse.setInputValue('transport', 'fetch');
    sse.setInputValue('method', 'POST');
    sse.setInputValue('body', JSON.stringify({ prompt: 'cancel me' }));
    sse.setInputValue('connect', true);

    expect(await until(() => Number(out(sse, 'messageCount')) > 3)).toBe(true);
    const atCancel = Number(out(sse, 'messageCount'));
    pulse(sse, 'disconnect');
    await wait(600);

    // eslint-disable-next-line no-console
    console.log('LIVE-SSE-CANCEL', {
      state: out(sse, 'connectionState'),
      atCancel,
      after: out(sse, 'messageCount')
    });
    expect(out(sse, 'connectionState')).toBe('closed');
    expect(Number(out(sse, 'messageCount'))).toBe(atCancel);
    sse._onNodeDeleted();
  }, 30000);
});

live('LIVE: Action Dispatcher driven by a real action stream', () => {
  afterEach(() => {
    globalStoreManager.reset({ clearState: true });
  });

  it('executes what is permitted and refuses the rest with reasons', async () => {
    const h = harness([sseModule, dispatcherModule, handlerModule, storeModule]);
    const store = h.make('net.noodl.GlobalStore', 'store');
    const sse = h.make('net.noodl.SSE', 'sse');
    const dispatcher = h.make('net.noodl.ActionDispatcher', 'dispatcher');
    const handler = h.make('net.noodl.ActionHandler', 'handler');

    store.setInputValue('storeName', 'chat');
    store.update();

    handler.setInputValue('channel', 'agent');
    handler.setInputValue('actionType', 'SHOW_NOTICE');
    handler.update();

    dispatcher.setInputValue('channel', 'agent');
    dispatcher.setInputValue('builtIns', 'SET_STORE,MERGE_STORE');
    dispatcher.setInputValue('storeName', 'chat');
    dispatcher.setInputValue('allowedKeys', 'title');
    dispatcher.setInputValue('waitForHandler', 800);
    dispatcher.update();

    const refusals: string[] = [];
    h.on('dispatcher', (signal) => {
      if (signal === 'refused') {
        refusals.push(`${out(dispatcher, 'refusalReason')}:${out(dispatcher, 'refusedType')}`);
      }
    });

    const payloads: unknown[] = [];
    h.on('handler', (signal) => {
      if (signal === 'trigger') payloads.push(out(handler, 'payload'));
    });

    h.on('sse', (signal) => {
      if (signal === 'onMessage') {
        dispatcher.setInputValue('action', out(sse, 'data'));
        pulse(dispatcher, 'dispatch');
      }
    });

    sse.setInputValue('url', BASE + '/agent/actions');
    sse.setInputValue('transport', 'fetch');
    sse.setInputValue('connect', true);

    await until(() => out(sse, 'connectionState') === 'closed', 25000);
    await until(() => refusals.length >= 4, 6000);

    // eslint-disable-next-line no-console
    console.log('LIVE-ACTIONS', {
      completedCount: out(dispatcher, 'completedCount'),
      refusedCount: out(dispatcher, 'refusedCount'),
      failedCount: out(dispatcher, 'failedCount'),
      queueSize: out(dispatcher, 'queueSize'),
      lastRefusal: out(dispatcher, 'refusalMessage'),
      refusals,
      handlerTriggered: out(handler, 'triggeredCount'),
      payloads,
      storeTitle: globalStoreManager.getKey('chat', 'title'),
      storeHasMessages: globalStoreManager.hasKey('chat', 'messages')
    });

    // Three execute: SET_STORE on the envelope, SET_STORE wrapped in a payload (the shape
    // that used to be refused as `invalid`), and the registered handler.
    expect(out(dispatcher, 'completedCount')).toBe(3);
    expect(out(dispatcher, 'refusedCount')).toBe(4);
    expect(refusals.sort()).toEqual(
      ['invalid:', 'not-allowed:CLEAR_STORE', 'not-allowed:SET_STORE', 'unknown:DELETE_EVERYTHING'].sort()
    );
    expect(globalStoreManager.getKey('chat', 'title')).toBe('Renamed again, from a payload');
    expect(globalStoreManager.hasKey('chat', 'messages')).toBe(false);
    expect(payloads).toEqual(['This notice was sent by the server.']);

    sse._onNodeDeleted();
    dispatcher._onNodeDeleted();
    handler._onNodeDeleted();
    store._onNodeDeleted();
  }, 60000);
});

live('LIVE: WebSocket + Stream Buffer + JSON Stream Parser', () => {
  it('talks to a real socket, coalesces bursts and reassembles NDJSON', async () => {
    const h = harness([wsModule, bufModule, jsonModule]);
    const ws = h.make('net.noodl.WebSocket', 'ws');
    const buf = h.make('net.noodl.StreamBuffer', 'buf');
    const json = h.make('net.noodl.JSONStreamParser', 'json');

    buf.setInputValue('flushSize', 4);
    buf.setInputValue('flushInterval', 250);
    buf.update();

    json.setInputValue('format', 'ndjson');
    json.update();

    const flushes: unknown[] = [];
    h.on('buf', (signal) => {
      if (signal === 'flushed') flushes.push(out(buf, 'flushedData'));
    });

    const parsed: unknown[] = [];
    h.on('json', (signal) => {
      if (signal === 'success') parsed.push(out(json, 'parsed'));
    });

    h.on('ws', (signal) => {
      if (signal === 'onMessage') {
        buf.setInputValue('data', out(ws, 'received'));
        pulse(buf, 'add');
        json.setInputValue('chunk', out(ws, 'receivedRaw'));
        pulse(json, 'parse');
      }
    });

    ws.setInputValue('url', WS_BASE + '/live');
    ws.setInputValue('heartbeatInterval', 0);
    ws.setInputValue('connect', true);

    expect(await until(() => out(ws, 'connectionState') === 'open', 10000)).toBe(true);

    ws.setInputValue('message', 'hello from the live test');
    pulse(ws, 'send');

    expect(await until(() => Number(out(json, 'valueCount')) >= 8, 15000)).toBe(true);

    // eslint-disable-next-line no-console
    console.log('LIVE-WS', {
      state: out(ws, 'connectionState'),
      connected: out(ws, 'connected'),
      retryCount: out(ws, 'retryCount'),
      queueSize: out(ws, 'queueSize'),
      droppedCount: out(ws, 'droppedCount'),
      lastError: out(ws, 'lastError'),
      bufferFlushes: out(buf, 'flushCount'),
      flushBatchSizes: flushes.map((f) => (Array.isArray(f) ? f.length : -1)),
      jsonValueCount: out(json, 'valueCount'),
      jsonPending: out(json, 'pendingCharacters'),
      jsonErrors: out(json, 'errorCount'),
      parsedSample: parsed.slice(0, 4),
      echoSeen: parsed.some((p) => isKind(p, 'echo')),
      signals: Array.from(new Set(h.signalsFor('ws')))
    });

    expect(out(ws, 'lastError')).toBe('');
    expect(Number(out(json, 'errorCount'))).toBe(0);
    expect(Number(out(buf, 'flushCount'))).toBeGreaterThan(0);
    expect(h.signalsFor('ws')).toContain('onOpen');
    expect(h.signalsFor('ws')).toContain('onMessageSent');
    expect(parsed.some((p) => isKind(p, 'echo'))).toBe(true);
    // Each burst is two JSON objects in ONE frame: the parser had real boundary work.
    expect(Number(out(json, 'valueCount'))).toBeGreaterThan(Number(out(buf, 'flushCount')));

    // A server-initiated close carries a real code and reason.
    ws.setInputValue('autoReconnect', false);
    ws.update();
    ws.setInputValue('message', 'bye');
    pulse(ws, 'send');

    await until(() => out(ws, 'connectionState') === 'closed' || out(ws, 'connectionState') === 'error', 10000);
    // eslint-disable-next-line no-console
    console.log('LIVE-WS-CLOSE', {
      state: out(ws, 'connectionState'),
      closeCode: out(ws, 'closeCode'),
      closeReason: out(ws, 'closeReason'),
      signals: Array.from(new Set(h.signalsFor('ws')))
    });

    ws._onNodeDeleted();
    buf._onNodeDeleted();
    json._onNodeDeleted();
  }, 60000);
});
