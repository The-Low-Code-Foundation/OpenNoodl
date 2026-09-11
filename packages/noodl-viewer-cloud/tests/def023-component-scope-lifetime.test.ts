/**
 * DEF-023 (phase 80, from phase 78's D35) — `Component` scope in a cloud function must not
 * outlive the request that filled it.
 *
 * The defect, measured 2026-08-29 (s14) by four thirty-second timeouts: TPL-002's `plan`
 * guarded itself with `if (Component.tpl002 && Component.tpl002.planned) return;` and every
 * request after the first returned early on the previous request's flag — no outcome, no
 * Response, a hang. The row recorded the browser's mechanism (`_componentScopes` keyed by
 * reused instance ids); at HEAD the cloud runtime never reaches it —
 * `noodl-js-api.js` overrides `getComponentScopeForNode` to return ONE module-level object,
 * so the scope was shared across all scripts, all components, all requests, and all
 * CONCURRENT requests, process-wide. Wider than the row said, same reading.
 *
 * The fix keys the scope on the component-owner INSTANCE in a WeakMap — not on its id,
 * which repeats across requests. Scripts in one component instance still share their scope
 * (the browser contract, and the only reason `Component` is useful); a new request's fresh
 * instances get fresh scopes; entries die with the request's graph, which is the leak the
 * old override existed to stop.
 *
 * Arms are graded through `CloudRunner.run` — the consequence, not the mechanism — on the
 * same harness shape as cn-013's.
 */

/* eslint-env jest */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { CloudRunner } from '../src';

jest.setTimeout(30000);

/**
 * `request → JavaScriptFunction → response`. The script is D35's guard pattern verbatim,
 * answering instead of hanging so the reading is a word rather than a timeout.
 */
function guardedFunction(name: string) {
  return {
    name: `/#__cloud__/${name}`,
    nodes: [
      {
        id: `${name}-req`,
        type: 'noodl.cloud.request',
        x: 0,
        y: 0,
        parameters: { allowNoAuth: true },
        ports: [],
        children: []
      },
      {
        id: `${name}-js`,
        type: 'JavaScriptFunction',
        x: 0,
        y: 100,
        parameters: {
          functionScript:
            `if (Component.def023 && Component.def023.planned === true) { Outputs.verdict = 'stale'; }\n` +
            `else { Component.def023 = { planned: true }; Outputs.verdict = 'fresh'; }`
        },
        ports: [],
        children: []
      },
      {
        id: `${name}-res`,
        type: 'noodl.cloud.response',
        x: 0,
        y: 200,
        parameters: { params: 'verdict' },
        ports: [],
        children: []
      }
    ],
    connections: [
      { sourceId: `${name}-req`, sourcePort: 'receive', targetId: `${name}-js`, targetPort: 'run' },
      { sourceId: `${name}-js`, sourcePort: 'out-verdict', targetId: `${name}-res`, targetPort: 'pm-verdict' },
      { sourceId: `${name}-js`, sourcePort: 'success', targetId: `${name}-res`, targetPort: 'send' }
    ],
    roots: []
  };
}

/**
 * Two scripts in ONE component: the first writes `Component.mark`, the second answers with
 * what it finds there. This is the contract the scope exists for, and the arm that separates
 * "per component instance per request" from "a fresh bag on every call".
 */
function sharingFunction(name: string) {
  return {
    name: `/#__cloud__/${name}`,
    nodes: [
      {
        id: `${name}-req`,
        type: 'noodl.cloud.request',
        x: 0,
        y: 0,
        parameters: { allowNoAuth: true },
        ports: [],
        children: []
      },
      {
        id: `${name}-writer`,
        type: 'JavaScriptFunction',
        x: 0,
        y: 100,
        parameters: { functionScript: `Component.mark = 'written-by-the-first-script';` },
        ports: [],
        children: []
      },
      {
        id: `${name}-reader`,
        type: 'JavaScriptFunction',
        x: 200,
        y: 100,
        parameters: { functionScript: `Outputs.seen = Component.mark || 'nothing';` },
        ports: [],
        children: []
      },
      {
        id: `${name}-res`,
        type: 'noodl.cloud.response',
        x: 0,
        y: 200,
        parameters: { params: 'seen' },
        ports: [],
        children: []
      }
    ],
    connections: [
      { sourceId: `${name}-req`, sourcePort: 'receive', targetId: `${name}-writer`, targetPort: 'run' },
      { sourceId: `${name}-writer`, sourcePort: 'success', targetId: `${name}-reader`, targetPort: 'run' },
      { sourceId: `${name}-reader`, sourcePort: 'out-seen', targetId: `${name}-res`, targetPort: 'pm-seen' },
      { sourceId: `${name}-reader`, sourcePort: 'success', targetId: `${name}-res`, targetPort: 'send' }
    ],
    roots: []
  };
}

/** A function that only READS the guard flag — the cross-function probe. */
function readerFunction(name: string) {
  return {
    name: `/#__cloud__/${name}`,
    nodes: [
      {
        id: `${name}-req`,
        type: 'noodl.cloud.request',
        x: 0,
        y: 0,
        parameters: { allowNoAuth: true },
        ports: [],
        children: []
      },
      {
        id: `${name}-js`,
        type: 'JavaScriptFunction',
        x: 0,
        y: 100,
        parameters: {
          functionScript: `Outputs.verdict = Component.def023 ? 'leaked-across-functions' : 'clean';`
        },
        ports: [],
        children: []
      },
      {
        id: `${name}-res`,
        type: 'noodl.cloud.response',
        x: 0,
        y: 200,
        parameters: { params: 'verdict' },
        ports: [],
        children: []
      }
    ],
    connections: [
      { sourceId: `${name}-req`, sourcePort: 'receive', targetId: `${name}-js`, targetPort: 'run' },
      { sourceId: `${name}-js`, sourcePort: 'out-verdict', targetId: `${name}-res`, targetPort: 'pm-verdict' },
      { sourceId: `${name}-js`, sourcePort: 'success', targetId: `${name}-res`, targetPort: 'send' }
    ],
    roots: []
  };
}

function bundle(components: unknown[]) {
  return { components, settings: {}, metadata: {} };
}

async function call(runner: CloudRunner, name: string): Promise<any> {
  const res: any = await runner.run(name, { body: {}, headers: {} } as any, { timeoutMs: 4000 });
  expect(res.statusCode).toBe(200);
  return JSON.parse(res.body).result;
}

describe('DEF-023: Component scope lives exactly as long as its request', () => {
  test('the second request does not find the first one\'s state — D35\'s guard, answering', async () => {
    const runner = new CloudRunner({});
    await runner.load(bundle([guardedFunction('guarded')]));

    const first = await call(runner, 'guarded');
    const second = await call(runner, 'guarded');

    // The first answer is the control that the guard's write arm ran at all: a scope that was
    // never written would also read 'fresh' twice.
    expect(first.verdict).toBe('fresh');
    // At HEAD before the fix this read 'stale' — the previous request's flag. In TPL-002 the
    // same reading was a 30s 504, because its early return fired no outcome at all.
    expect(second.verdict).toBe('fresh');
  });

  test('two scripts in one request still share the scope — the contract the fix must keep', async () => {
    const runner = new CloudRunner({});
    await runner.load(bundle([sharingFunction('sharing')]));

    const result = await call(runner, 'sharing');
    expect(result.seen).toBe('written-by-the-first-script');
  });

  test('two different functions in one process do not share a scope', async () => {
    const runner = new CloudRunner({});
    await runner.load(bundle([guardedFunction('writerFn'), readerFunction('probeFn')]));

    const written = await call(runner, 'writerFn');
    expect(written.verdict).toBe('fresh');

    // At HEAD before the fix the probe read the other function's flag out of the one shared
    // module-level bag.
    const probed = await call(runner, 'probeFn');
    expect(probed.verdict).toBe('clean');
  });
});
