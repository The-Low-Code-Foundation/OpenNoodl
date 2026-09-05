/**
 * EXP-011 §66.5 #1, measured in the runtime — **a Variable nothing has written never reaches the setter it is wired to.**
 *
 * The register asked whether `Enabled` wired from an unwritten `Variable` boots OFF (the setter runs with `undefined`,
 * `!!undefined`) or ON (the setter never runs, the `!== false` reading of an untouched node stands). The rule is the
 * scheduler's, not the node's:
 *
 * - `node.ts` `sendValue`: `if (value === undefined) return;` — an undefined never crosses a wire.
 * - `node.ts` `flagOutputDirty`: `this.sendValue(name, output.value)` — the Variable's `setVariableName` flags `value`
 *   dirty at its first update (`variablenode2.ts` `setVariableName`), and the getter answers `variablesModel.get(name)`,
 *   `undefined` for a name nothing wrote, so the flag sends nothing.
 * - `node.ts` `connectInput`: `if (outputValue !== undefined) this._setValueFromConnection(...)` — at connect time an
 *   undefined output delivers nothing either (and the Variable's name is still queued then, so its getter answers
 *   `undefined` regardless).
 *
 * So the setter runs only when the Variable holds a defined value — pre-written before boot, or written later — and a
 * Variable written back to `undefined` leaves the last delivered value in place. Every row below is graded against a
 * spy on the setter AND an observable effect, and the two generalisation rows say the same of the SSE and WebSocket
 * siblings' booleans (their runtime defaults `true` stand).
 */

import type { NodeDefinitionOptions, NodeInstance, NodeModule } from '@noodl/types';

import { createCorpusGraph, type CorpusGraph } from './graph-harness';

import Model = require('../../src/model');
import VariableModule = require('../../src/nodes/std-library/data/variablenode2');
import SubscribeModule = require('../../src/nodes/std-library/data/subscribetochanges');
import SseModule = require('../../src/nodes/std-library/agent/sse');
import WebSocketModule = require('../../src/nodes/std-library/agent/websocket');

const VARIABLES_RECORD = '--ndl--global-variables';
const REALTIME_FAILED = 'subscribe-to-changes/realtime-failed';

/** A node whose one input records every delivery — the plain observable of "did the setter run". */
interface RecorderInstance extends NodeInstance {
  _internal: { calls: unknown[] };
}
const RecorderModule: NodeDefinitionOptions = {
  name: 'corpus.S665Recorder',
  category: 'Data',
  initialize(this: RecorderInstance) {
    this._internal.calls = [];
  },
  inputs: {
    value: {
      type: '*',
      set(this: RecorderInstance, value: unknown) {
        this._internal.calls.push(value);
      }
    }
  }
};

/** A spy on a definition's setter, installed before the graph registers the definition and removed after. */
function spyOn<T extends object, K extends keyof T>(target: T, key: K): { calls: unknown[]; restore(): void } {
  const calls: unknown[] = [];
  const original = target[key] as unknown as (...args: unknown[]) => unknown;
  (target as Record<string, unknown>)[key as string] = function (this: unknown, ...args: unknown[]) {
    calls.push(args[0]);
    return original.apply(this, args);
  };
  return {
    calls,
    restore() {
      (target as Record<string, unknown>)[key as string] = original;
    }
  };
}

const variables = () => Model.get(VARIABLES_RECORD);

type SubscribeInstance = NodeInstance & { _internal: { enabled?: boolean; realtimeError?: unknown }; isEnabled(): boolean };
type SseInstance = NodeInstance & { _internal: { autoReconnect: boolean; autoConnect: boolean } };
type WsInstance = NodeInstance & { _internal: { autoConnect: boolean } };

async function graphWith(
  modules: Array<NodeModule | NodeDefinitionOptions>,
  nodes: Array<Record<string, unknown>>,
  connections: Array<Record<string, string>>
): Promise<CorpusGraph> {
  const graph = await createCorpusGraph({
    modules,
    rootComponent: '/root',
    data: { components: [{ name: '/root', nodes, connections }] } as never
  });
  await graph.settle(3);
  return graph;
}

const subscribeInputs = SubscribeModule.node as unknown as { prototypeExtensions: { setEnabled: unknown } };
const sseInputs = (SseModule.node as unknown as { inputs: Record<string, { set: unknown }> }).inputs;
const wsInputs = (WebSocketModule.node as unknown as { inputs: Record<string, { set: unknown }> }).inputs;

const readout: string[] = [];
afterAll(() => {
  // One line per row, for runtime.log.
  // eslint-disable-next-line no-console
  console.log(['EXP-011 §66.5 #1 runtime readout', ...readout].join('\n'));
});

describe('R the rule — a Variable nothing wrote delivers nothing; a written one delivers once', () => {
  test('R1 an unwritten Variable2 wired into a setter: the setter never runs at boot; the same graph with the Variable pre-written: the setter runs once with the value', async () => {
    const nodes = [
      { id: 'v', type: 'Variable2', parameters: { name: 's665-r1' } },
      { id: 'rec', type: 'corpus.S665Recorder' }
    ];
    const wires = [{ sourceId: 'v', sourcePort: 'value', targetId: 'rec', targetPort: 'value' }];

    const unwritten = await graphWith([VariableModule, RecorderModule], nodes, wires);
    const unwrittenCalls = unwritten.node<RecorderInstance>('rec')._internal.calls;
    expect(unwrittenCalls).toEqual([]);
    expect(unwritten.node('v').getOutput('value').value).toBeUndefined();

    variables().set('s665-r1', 'seeded');
    const written = await graphWith([VariableModule, RecorderModule], nodes, wires);
    expect(written.node<RecorderInstance>('rec')._internal.calls).toEqual(['seeded']);
    readout.push(`R1 unwritten: setter calls=${JSON.stringify(unwrittenCalls)} · pre-written 'seeded': calls=${JSON.stringify(written.node<RecorderInstance>('rec')._internal.calls)}`);
  });

  test('R1b a Variable written after boot delivers; written back to undefined it delivers nothing, and the last value stands', async () => {
    const graph = await graphWith(
      [VariableModule, RecorderModule],
      [
        { id: 'v', type: 'Variable2', parameters: { name: 's665-r1b' } },
        { id: 'rec', type: 'corpus.S665Recorder' }
      ],
      [{ sourceId: 'v', sourcePort: 'value', targetId: 'rec', targetPort: 'value' }]
    );
    const calls = graph.node<RecorderInstance>('rec')._internal.calls;
    expect(calls).toEqual([]);
    variables().set('s665-r1b', false);
    await graph.settle(2);
    expect(calls).toEqual([false]);
    variables().set('s665-r1b', undefined);
    await graph.settle(2);
    expect(calls).toEqual([false]);
    readout.push(`R1b after boot false ⇒ calls=${JSON.stringify(calls)}; then undefined ⇒ calls unchanged=${JSON.stringify(calls)}`);
  });
});

describe('S Subscribe To Changes — Enabled wired from a Variable nothing wrote boots ON', () => {
  const nodes = (extra: Record<string, unknown> = {}, name = 's665-enabled') => [
    { id: 'enabledVar', type: 'Variable2', parameters: { name } },
    { id: 'feed', type: 'SubscribeToChanges', parameters: { collectionName: 'Contact', ...extra } }
  ];
  const wire = [{ sourceId: 'enabledVar', sourcePort: 'value', targetId: 'feed', targetPort: 'enabled' }];

  test('S1 unwritten: setEnabled never runs, _internal.enabled stays undefined, isEnabled() is true — and the node DID try to subscribe at boot: with no backend in this process the reconfigure reports realtime-failed (the Failure pulse, Realtime Error, the raise)', async () => {
    const spy = spyOn(subscribeInputs.prototypeExtensions, 'setEnabled');
    try {
      const graph = await graphWith([VariableModule, SubscribeModule], nodes(), wire);
      const feed = graph.node<SubscribeInstance>('feed');
      expect(spy.calls).toEqual([]);
      expect(feed._internal.enabled).toBeUndefined();
      expect(feed.isEnabled()).toBe(true);
      const raised = graph.errors.filter((e) => (e as { code?: string }).code === REALTIME_FAILED);
      expect(raised).toHaveLength(1);
      expect(graph.signalsFor('feed')).toEqual(['realtimeFailure']);
      expect(feed.getOutput('realtimeError').value).toMatchObject({ code: 'CAPABILITY_UNAVAILABLE', kind: 'fatal' });
      readout.push(
        `S1 unwritten ⇒ setEnabled calls=${spy.calls.length}, _internal.enabled=${String(feed._internal.enabled)}, isEnabled=${feed.isEnabled()}, raises=${raised.length} (${(raised[0] as { message?: string }).message}), signals=${JSON.stringify(graph.signalsFor('feed'))}`
      );
    } finally {
      spy.restore();
    }
  });

  test('S2 control — the Variable pre-written false: setEnabled runs once with false, no reconfigure past the gate (no raise, no pulse)', async () => {
    const spy = spyOn(subscribeInputs.prototypeExtensions, 'setEnabled');
    try {
      variables().set('s665-enabled-false', false);
      const graph = await graphWith([VariableModule, SubscribeModule], nodes({}, 's665-enabled-false'), wire);
      const feed = graph.node<SubscribeInstance>('feed');
      expect(spy.calls).toEqual([false]);
      expect(feed._internal.enabled).toBe(false);
      expect(feed.isEnabled()).toBe(false);
      expect(graph.errors.filter((e) => (e as { code?: string }).code === REALTIME_FAILED)).toHaveLength(0);
      expect(graph.signalsFor('feed')).toEqual([]);
      readout.push(`S2 pre-written false ⇒ setEnabled calls=${JSON.stringify(spy.calls)}, raises=0, signals=[]`);
    } finally {
      spy.restore();
    }
  });

  test('S3 control — the Variable pre-written true: setEnabled runs once with true and the boot reconfigure runs (the raise) — the same observable as S1', async () => {
    const spy = spyOn(subscribeInputs.prototypeExtensions, 'setEnabled');
    try {
      variables().set('s665-enabled-true', true);
      const graph = await graphWith([VariableModule, SubscribeModule], nodes({}, 's665-enabled-true'), wire);
      expect(spy.calls).toEqual([true]);
      expect(graph.node<SubscribeInstance>('feed')._internal.enabled).toBe(true);
      expect(graph.errors.filter((e) => (e as { code?: string }).code === REALTIME_FAILED)).toHaveLength(1);
      readout.push(`S3 pre-written true ⇒ setEnabled calls=${JSON.stringify(spy.calls)}, raises=1`);
    } finally {
      spy.restore();
    }
  });

  test('S4 control — Enabled authored (no wire): false ⇒ the setter runs with false and nothing subscribes; true ⇒ it runs with true and the boot reconfigure raises', async () => {
    const spy = spyOn(subscribeInputs.prototypeExtensions, 'setEnabled');
    try {
      const off = await graphWith([VariableModule, SubscribeModule], nodes({ enabled: false }), []);
      expect(spy.calls).toEqual([false]);
      expect(off.errors.filter((e) => (e as { code?: string }).code === REALTIME_FAILED)).toHaveLength(0);
      spy.calls.length = 0;
      const on = await graphWith([VariableModule, SubscribeModule], nodes({ enabled: true }), []);
      expect(spy.calls).toEqual([true]);
      expect(on.errors.filter((e) => (e as { code?: string }).code === REALTIME_FAILED)).toHaveLength(1);
      readout.push('S4 authored false ⇒ calls=[false], raises=0 · authored true ⇒ calls=[true], raises=1');
    } finally {
      spy.restore();
    }
  });

  test('S5 written after boot: false reaches the setter (teardown, Subscribed false); undefined afterwards does NOT — enabled stays false, nothing re-subscribes', async () => {
    const spy = spyOn(subscribeInputs.prototypeExtensions, 'setEnabled');
    try {
      const graph = await graphWith([VariableModule, SubscribeModule], nodes({}, 's665-enabled-later'), wire);
      const feed = graph.node<SubscribeInstance>('feed');
      expect(spy.calls).toEqual([]);
      const raisesAtBoot = graph.errors.filter((e) => (e as { code?: string }).code === REALTIME_FAILED).length;
      expect(raisesAtBoot).toBe(1);
      variables().set('s665-enabled-later', false);
      await graph.settle(2);
      expect(spy.calls).toEqual([false]);
      expect(feed.isEnabled()).toBe(false);
      variables().set('s665-enabled-later', undefined);
      await graph.settle(2);
      expect(spy.calls).toEqual([false]);
      expect(feed._internal.enabled).toBe(false);
      expect(graph.errors.filter((e) => (e as { code?: string }).code === REALTIME_FAILED)).toHaveLength(1);
      readout.push(`S5 boot raises=1; then false ⇒ calls=${JSON.stringify(spy.calls)}; then undefined ⇒ calls unchanged, enabled=${String(feed._internal.enabled)}, raises still 1`);
    } finally {
      spy.restore();
    }
  });
});

describe('G the siblings — the same rule on the SSE and WebSocket booleans (their runtime defaults stand)', () => {
  test('G1 Server-Sent Events: an unwritten Variable into Auto Reconnect leaves the setter unrun and the default true in place; pre-written false runs it once', async () => {
    const spy = spyOn(sseInputs.autoReconnect, 'set');
    try {
      const nodes = (name: string) => [
        { id: 'v', type: 'Variable2', parameters: { name } },
        { id: 'sse', type: 'net.noodl.SSE' }
      ];
      const wire = [{ sourceId: 'v', sourcePort: 'value', targetId: 'sse', targetPort: 'autoReconnect' }];
      const unwritten = await graphWith([VariableModule, SseModule], nodes('s665-sse'), wire);
      expect(spy.calls).toEqual([]);
      expect(unwritten.node<SseInstance>('sse')._internal.autoReconnect).toBe(true);
      variables().set('s665-sse-false', false);
      const written = await graphWith([VariableModule, SseModule], nodes('s665-sse-false'), wire);
      expect(spy.calls).toEqual([false]);
      expect(written.node<SseInstance>('sse')._internal.autoReconnect).toBe(false);
      readout.push(`G1 SSE autoReconnect: unwritten ⇒ setter calls=0, internal=true · pre-written false ⇒ calls=[false], internal=false`);
    } finally {
      spy.restore();
    }
  });

  test('G2 WebSocket: an unwritten Variable into Auto Connect leaves the setter unrun and the default true in place; pre-written false runs it once', async () => {
    const spy = spyOn(wsInputs.autoConnect, 'set');
    try {
      const nodes = (name: string) => [
        { id: 'v', type: 'Variable2', parameters: { name } },
        { id: 'ws', type: 'net.noodl.WebSocket' }
      ];
      const wire = [{ sourceId: 'v', sourcePort: 'value', targetId: 'ws', targetPort: 'autoConnect' }];
      const unwritten = await graphWith([VariableModule, WebSocketModule], nodes('s665-ws'), wire);
      expect(spy.calls).toEqual([]);
      expect(unwritten.node<WsInstance>('ws')._internal.autoConnect).toBe(true);
      variables().set('s665-ws-false', false);
      const written = await graphWith([VariableModule, WebSocketModule], nodes('s665-ws-false'), wire);
      expect(spy.calls).toEqual([false]);
      expect(written.node<WsInstance>('ws')._internal.autoConnect).toBe(false);
      readout.push(`G2 WebSocket autoConnect: unwritten ⇒ setter calls=0, internal=true · pre-written false ⇒ calls=[false], internal=false`);
    } finally {
      spy.restore();
    }
  });
});
