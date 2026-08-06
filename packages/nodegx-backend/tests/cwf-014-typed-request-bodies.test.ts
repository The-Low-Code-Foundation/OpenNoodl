/**
 * CWF-014 — a cloud function's request contract, driven end to end.
 *
 * This is the run that makes the claim checkable rather than asserted: a real
 * `BackendService` on a real socket, a real export loaded from disk, and real
 * POSTs. What it proves that the pure rule cannot:
 *
 *   - the refusal reaches the caller as **400** rather than the 500 every throw
 *     out of `sendRequest` produced before, with the field named in the body;
 *   - **the graph did not run** — asserted by the absence of the Response node's
 *     answer, which is the only observable that distinguishes "refused" from
 *     "ran and complained";
 *   - a **coerced** value reaches the graph: `"42"` comes back out of the
 *     Response node as the number `42`, having crossed a `pm-` port;
 *   - the fixtures carry `ports: []`, exactly what today's exporter writes, so
 *     the contract survives the same round trip WFA-009 pinned — nothing about
 *     `ptype-`/`preq-`/`pdef-` is in the export except the parameters themselves.
 *
 * ⚠️ The load-order trap this task's spec names — *a saved project applies a
 * parameter before the port exists* — is what `parameterOrder` below is for.
 * `NodeScope.setNodeParameters` walks `Object.keys(parameters)`, so a function
 * whose JSON happens to list `ptype-total` before `params` is a different code
 * path from one that lists it after. Both are here, and before
 * `registerInputIfNeeded` was added to the Request node the first one served an
 * untyped body while every other test in this file passed.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { BackendService } from '../src/service';

import { httpClient } from './helpers/http';

jest.setTimeout(40000);

interface ResultBody {
  result: Record<string, unknown>;
}

interface RefusalBody {
  error: string;
  code: string;
  fields: { name: string; code: string; expected: string; received?: string }[];
}

/**
 * A cloud function shaped the way the editor's exporter writes one: read the
 * declared names out of the request, hand them straight back out of the
 * response. If the graph runs at all, the body says so.
 */
function echoFunction(
  name: string,
  params: string,
  contract: Record<string, unknown>,
  opts: { contractFirst?: boolean } = {}
) {
  const names = params.split(',').filter(Boolean);
  // The order the keys appear in the JSON is the order `setNodeParameters`
  // applies them. This is the whole of the load-order drive.
  const parameters = opts.contractFirst
    ? { ...contract, params, allowNoAuth: true }
    : { allowNoAuth: true, params, ...contract };

  return {
    name: `/#__cloud__/${name}`,
    nodes: [
      { id: 'req', type: 'noodl.cloud.request', x: 0, y: 0, parameters, ports: [], children: [] },
      { id: 'res', type: 'noodl.cloud.response', x: 0, y: 200, parameters: { params }, ports: [], children: [] }
    ],
    connections: [
      { sourceId: 'req', sourcePort: 'receive', targetId: 'res', targetPort: 'send' },
      ...names.map((p) => ({ sourceId: 'req', sourcePort: `pm-${p}`, targetId: 'res', targetPort: `pm-${p}` }))
    ],
    roots: []
  };
}

const BUNDLE = {
  components: [
    // The migration case: a function written before this task ever existed.
    echoFunction('untyped', 'id,total', {}),
    // One required number, and one optional string beside it.
    echoFunction('typed', 'total,note', { 'ptype-total': 'number', 'preq-total': true }),
    // A default, declared as the string an author types into the property panel.
    echoFunction('defaulted', 'total', { 'ptype-total': 'number', 'pdef-total': '7' }),
    // The load-order drive: identical to `typed`, with the contract rows first.
    echoFunction('typedContractFirst', 'total', { 'ptype-total': 'number', 'preq-total': true }, {
      contractFirst: true
    }),
    // Every type in the vocabulary, all required, so one call exercises the table.
    echoFunction('everyType', 'aString,aNumber,aBool,anObject,anArray', {
      'ptype-aString': 'string',
      'ptype-aNumber': 'number',
      'ptype-aBool': 'boolean',
      'ptype-anObject': 'object',
      'ptype-anArray': 'array',
      'preq-aString': true,
      'preq-aNumber': true,
      'preq-aBool': true,
      'preq-anObject': true,
      'preq-anArray': true
    }),
    // A name with a space in it, because the shipped prefabs are full of them.
    echoFunction('spaced', 'Customer Id', { 'ptype-Customer Id': 'string', 'preq-Customer Id': true })
  ],
  settings: {},
  metadata: {}
};

describe('CWF-014: a typed request body is rejected for the right reason, and accepted when correct', () => {
  let dataDir: string;
  let service: BackendService;
  let base: string;

  const http = httpClient(() => base);
  const call = (name: string, body: unknown) => http.request<ResultBody>('POST', `/functions/${name}`, { body });
  const refuse = (name: string, body: unknown) =>
    http.request<RefusalBody>('POST', `/functions/${name}`, { body });

  beforeAll(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-cwf014-'));
    fs.mkdirSync(path.join(dataDir, 'workflows'), { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'workflows', 'fns.workflow.json'), JSON.stringify(BUNDLE));
    service = new BackendService({ dataDir, port: 0, backendId: 'cwf014_backend', backendName: 'CWF-014 Test' });
    base = (await service.start()).listen.url;
  });

  afterAll(async () => {
    await service.stop();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  // ── The migration ───────────────────────────────────────────────────────────

  describe('a function with a plain `params` string behaves exactly as before', () => {
    it('takes anything, including the value that would be a 400 next door', async () => {
      const res = await call('untyped', { id: 'ord-1', total: 'banana' });
      expect(res.status).toBe(200);
      expect(res.json.result).toEqual({ id: 'ord-1', total: 'banana' });
    });

    it('and is still `{result: {}}` when the caller supplies nothing — no field is suddenly required', async () => {
      const res = await call('untyped', {});
      expect(res.status).toBe(200);
      expect(res.json.result).toEqual({});
    });
  });

  // ── The refusal ─────────────────────────────────────────────────────────────

  describe('a missing required parameter', () => {
    it('is a 400 naming the field, not a 500 and not a graph error', async () => {
      const res = await refuse('typed', { note: 'hi' });
      expect(res.status).toBe(400);
      expect(res.json.code).toBe('function/bad-request');
      expect(res.json.error).toContain('"total" is required');
      expect(res.json.fields).toEqual([{ name: 'total', code: 'missing', expected: 'number' }]);
    });

    it('and the graph did not run — there is no `result` in the body at all', async () => {
      const res = await refuse('typed', { note: 'hi' });
      expect(res.json).not.toHaveProperty('result');
    });
  });

  describe('a wrong type', () => {
    it('is a 400 naming the field, what was expected and what arrived', async () => {
      const res = await refuse('typed', { total: 'banana' });
      expect(res.status).toBe(400);
      expect(res.json.fields).toEqual([
        { name: 'total', code: 'type', expected: 'number', received: 'string' }
      ]);
    });

    it('never echoes the value that was refused — the message reaches the ops log', async () => {
      const res = await refuse('typed', { total: 'hunter2' });
      expect(res.json.error).not.toContain('hunter2');
    });

    it('reports every bad field at once', async () => {
      const res = await refuse('everyType', { aString: 'ok', aNumber: 'banana', aBool: 'maybe' });
      expect(res.status).toBe(400);
      expect(res.json.fields.map((f) => f.name)).toEqual([
        'aNumber',
        'aBool',
        'anObject',
        'anArray'
      ]);
    });
  });

  // ── The acceptance ──────────────────────────────────────────────────────────

  describe('a correct body', () => {
    it('runs, and `"42"` arrives as the number 42 by the declared typecast', async () => {
      const res = await call('typed', { total: '42', note: 'hi' });
      expect(res.status).toBe(200);
      expect(res.json.result).toEqual({ total: 42, note: 'hi' });
    });

    it('is untouched when it was already the declared type', async () => {
      const res = await call('typed', { total: 42, note: 'hi' });
      expect(res.json.result).toEqual({ total: 42, note: 'hi' });
    });

    it('carries every type in the vocabulary across the `pm-` ports', async () => {
      const res = await call('everyType', {
        aString: 'hello',
        aNumber: '7',
        aBool: 'true',
        anObject: { nested: 1 },
        anArray: [1, 2]
      });
      expect(res.status).toBe(200);
      expect(res.json.result).toEqual({
        aString: 'hello',
        aNumber: 7,
        aBool: true,
        anObject: { nested: 1 },
        anArray: [1, 2]
      });
    });

    it('applies a declared default when the caller omits the value, coerced by the declared type', async () => {
      const res = await call('defaulted', {});
      expect(res.status).toBe(200);
      expect(res.json.result).toEqual({ total: 7 });
    });

    it('lets a supplied value beat the default', async () => {
      const res = await call('defaulted', { total: 3 });
      expect(res.json.result).toEqual({ total: 3 });
    });

    it('handles a parameter name with a space in it', async () => {
      expect((await refuse('spaced', {})).status).toBe(400);
      const res = await call('spaced', { 'Customer Id': 'cus_1' });
      expect(res.json.result).toEqual({ 'Customer Id': 'cus_1' });
    });
  });

  // ── The load-order trap ─────────────────────────────────────────────────────

  describe('a saved project that applies a contract parameter before `params` exists', () => {
    it('still refuses the missing value', async () => {
      const res = await refuse('typedContractFirst', {});
      expect(res.status).toBe(400);
      expect(res.json.fields).toEqual([{ name: 'total', code: 'missing', expected: 'number' }]);
    });

    it('still coerces the supplied one', async () => {
      const res = await call('typedContractFirst', { total: '42' });
      expect(res.json.result).toEqual({ total: 42 });
    });
  });
});
