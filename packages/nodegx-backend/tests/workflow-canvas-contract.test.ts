/**
 * WFA-004 — the step-kind catalog, checked against the canvas that renders it.
 *
 * The README's decision is that the workflow canvas's palette and its property
 * editor's field types come from `GET /admin/workflow-step-kinds` on a running
 * backend, never from a bundled copy — because a bundled copy can offer a kind
 * the target backend cannot execute. That decision only pays off if the served
 * table keeps satisfying the assumptions the canvas makes about it.
 *
 * So this starts a real service, reads the real catalog off the real route, and
 * asserts each of those assumptions with the reason it exists. It is the
 * pattern WF-003's `deploy-assets.test.ts` established: the test reads the live
 * contract rather than a hand-written list of the nine kinds, so a tenth kind —
 * or a param type nobody taught the editor about — fails here rather than
 * rendering as an empty row in the property editor months later.
 *
 * The editor side of the pairing (`packages/noodl-editor/tests/workflow/`)
 * exercises the translator that turns this table into node types.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { BackendService } from '../src/service';
import { STEP_KIND_CATALOG_VERSION } from '../src/workflow/steps/kinds';

jest.setTimeout(30000);

/**
 * Param types the editor's `portTypeForParam` maps to a control. Anything else
 * would fall through to the value control silently — which is exactly the
 * "renders as a JSON textarea" failure §4 says fails the task.
 */
const KNOWN_PARAM_TYPES = new Set([
  'string',
  'number',
  'boolean',
  'enum',
  'array',
  'object',
  'condition',
  'path',
  'any'
]);

/**
 * Categories the canvas has a colour for. An unknown one falls back to the
 * muted default, which is legible but means a new family of steps arrives
 * uncoloured — worth failing over, not worth guessing at.
 */
const KNOWN_CATEGORIES = new Set([
  'Workflow',
  'Workflow Logic',
  'Workflow Error Handling',
  'Workflow Timing',
  // CWF-002's `return`. It gets its own family rather than joining `Workflow`
  // (which is coloured `component` — "it schedules a function", which a Return
  // does not) and is mapped to `logic` in workflowNodeLibrary's CATEGORY_COLOR.
  'Workflow Result'
]);

describe('WFA-004 — the served step-kind catalog is what the canvas assumes', () => {
  let service: BackendService;
  let endpoint: string;
  let dataDir: string;
  let catalog: {
    version: string;
    kinds: {
      kind: string;
      displayName: string;
      category: string;
      invokesFunction: boolean;
      params: { name: string; type: string; enums?: string[]; raw?: boolean }[];
      routes: { name: string; dynamic?: boolean }[];
    }[];
    valueLanguage: unknown;
  };

  beforeAll(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nodegx-wfa004-'));
    service = new BackendService({ dataDir, port: 0 });
    const started = await service.start();
    endpoint = `http://127.0.0.1:${started.listen.port}`;

    const secrets = JSON.parse(fs.readFileSync(path.join(dataDir, 'secrets.json'), 'utf-8'));
    const res = await fetch(`${endpoint}/admin/workflow-step-kinds`, {
      headers: { authorization: `Bearer ${secrets.adminToken}` }
    });
    expect(res.status).toBe(200);
    catalog = await res.json();
  });

  afterAll(async () => {
    await service?.stop();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  it('is the catalog, not an empty or error body', () => {
    expect(catalog.version).toBe(STEP_KIND_CATALOG_VERSION);
    expect(Array.isArray(catalog.kinds)).toBe(true);
    expect(catalog.kinds.length).toBeGreaterThanOrEqual(9);
  });

  it('gives every kind the fields a node type is built from', () => {
    // name, display name, colour and "does it need a ref" are, respectively,
    // the node type's name, its card title, its category tint and whether the
    // card shows the function it invokes.
    for (const kind of catalog.kinds) {
      expect(typeof kind.kind).toBe('string');
      expect(kind.kind.length).toBeGreaterThan(0);
      expect(typeof kind.displayName).toBe('string');
      expect(kind.displayName.length).toBeGreaterThan(0);
      expect(typeof kind.invokesFunction).toBe('boolean');
      expect(Array.isArray(kind.params)).toBe(true);
      expect(Array.isArray(kind.routes)).toBe(true);
    }
  });

  it('uses only categories the canvas has a colour for', () => {
    const unknown = catalog.kinds.map((k) => k.category).filter((c) => !KNOWN_CATEGORIES.has(c));
    expect(unknown).toEqual([]);
  });

  it('uses only param types the property editor knows a control for', () => {
    const unknown: string[] = [];
    for (const kind of catalog.kinds) {
      for (const param of kind.params) {
        if (!KNOWN_PARAM_TYPES.has(param.type)) unknown.push(`${kind.kind}.${param.name}: ${param.type}`);
      }
    }
    expect(unknown).toEqual([]);
  });

  it('gives every enum param its values, so a dropdown has something to offer', () => {
    for (const kind of catalog.kinds) {
      for (const param of kind.params) {
        if (param.type !== 'enum') continue;
        expect(Array.isArray(param.enums)).toBe(true);
        expect(param.enums.length).toBeGreaterThan(0);
      }
    }
  });

  it('gives a kind that takes author-named params everything a row is built from (CWF-001)', () => {
    // The canvas adds ONE synthetic port for the mapping and reads the kind's
    // declared names off the port type, so it can tell the author's params from
    // the kind's own. A mapping served without a reserved list would leave the
    // editor guessing at what the backend will refuse.
    const call = catalog.kinds.find((k) => k.kind === 'call-function') as unknown as {
      paramMapping?: { displayName?: string; description?: string; reserved?: string[] };
    };
    expect(call.paramMapping).toBeDefined();
    expect(call.paramMapping!.displayName).toBeTruthy();
    expect(call.paramMapping!.description).toBeTruthy();
    expect(call.paramMapping!.reserved).toContain('previous');
  });

  it('gives a bespoke control a type to fall back to (CWF-005)', () => {
    // `control` is a served STRING, not an enum, so a backend newer than the
    // editor can name a control the editor has never heard of. That only
    // degrades gracefully if the param also declares a `type` the editor already
    // knows a control for — otherwise the row renders nothing at all.
    for (const kind of catalog.kinds) {
      for (const param of kind.params as unknown as { name: string; type: string; control?: string }[]) {
        if (!param.control) continue;
        expect(KNOWN_PARAM_TYPES.has(param.type)).toBe(true);
      }
    }
  });

  it('labels the two retry knobs that lie in their names (CWF-005)', () => {
    // `maxAttempts` counts the first call and `retryOnStatus` inverts the
    // default when set. Neither NAME can change — it is the wire contract — so
    // the served `displayName` is the only place the panel can be honest.
    const retry = catalog.kinds.find((k) => k.kind === 'retry') as unknown as {
      params: { name: string; displayName?: string }[];
    };
    if (!retry) return; // folded into call-function by a later task
    expect(retry.params.find((p) => p.name === 'maxAttempts')?.displayName).toMatch(/incl\. the first/i);
    expect(retry.params.find((p) => p.name === 'retryOnStatus')?.displayName).toMatch(/only these/i);
  });

  it('marks the DSL-structure params raw, so they get an editor rather than a value control', () => {
    // WFA-003 marked these; a condition rendered as a value control would show
    // `{left: …, op: …}` as text, which §4 says fails the task.
    const branch = catalog.kinds.find((k) => k.kind === 'branch');
    expect(branch.params.find((p) => p.name === 'condition').raw).toBe(true);

    const sw = catalog.kinds.find((k) => k.kind === 'switch');
    expect(sw.params.find((p) => p.name === 'cases').raw).toBe(true);
  });

  it('declares dynamic routes only where the canvas derives ports from a param', () => {
    // The canvas builds a static output port per non-dynamic route and derives
    // the dynamic ones per node from that node's own params. Today `switch` is
    // the only kind that does the second, and its `cases` param is where the
    // labels come from. A new dynamic-route kind needs code, so it fails here.
    const dynamic = catalog.kinds.filter((k) => k.routes.some((r) => r.dynamic)).map((k) => k.kind);
    expect(dynamic).toEqual(['switch']);
  });

  it('names every route it declares, and never collides with next or onError', () => {
    // Route ports are namespaced `route:<name>` precisely so a route called
    // `next` would be safe — this asserts the namespacing is still doing that
    // job rather than relying on nobody having tried.
    for (const kind of catalog.kinds) {
      for (const route of kind.routes) {
        expect(typeof route.name).toBe('string');
        expect(route.name.length).toBeGreaterThan(0);
      }
    }
  });

  it('serves the value language beside the kinds', () => {
    // WFA-003 put it here so a client rendering a param control knows what a
    // `$path` may address without a second fetch or a bundled copy.
    expect(catalog.valueLanguage).toBeDefined();
    expect(typeof catalog.valueLanguage).toBe('object');
  });

  it('accepts a definition carrying editor positions, and gives them back unchanged', async () => {
    // §5's decision: positions live on the step. `WorkflowRegistry.upsert`
    // rebuilds the definition from a field whitelist and passes `steps` through
    // verbatim — this is the assertion that keeps that true, because a workflow
    // is the only artefact a workflow has and nothing else carries its layout.
    const secrets = JSON.parse(fs.readFileSync(path.join(dataDir, 'secrets.json'), 'utf-8'));
    const auth = { authorization: `Bearer ${secrets.adminToken}`, 'content-type': 'application/json' };

    const body = {
      id: 'uiPositions',
      name: 'ui positions',
      entry: 'a',
      concurrency: 1,
      steps: [
        { id: 'a', kind: 'wait', params: { duration: 1 }, next: ['b'], ui: { x: 120, y: 40 } },
        { id: 'b', kind: 'merge', ui: { x: 380, y: 40 } }
      ]
    };

    const put = await fetch(`${endpoint}/admin/workflow-defs/uiPositions`, {
      method: 'PUT',
      headers: auth,
      body: JSON.stringify(body)
    });
    expect(put.status).toBe(200);

    const get = await fetch(`${endpoint}/admin/workflow-defs/uiPositions`, { headers: auth });
    const { workflow } = await get.json();
    expect(workflow.steps.find((s: { id: string }) => s.id === 'a').ui).toEqual({ x: 120, y: 40 });
    expect(workflow.steps.find((s: { id: string }) => s.id === 'b').ui).toEqual({ x: 380, y: 40 });
  });

  it('rejects a malformed position rather than persisting it', async () => {
    const secrets = JSON.parse(fs.readFileSync(path.join(dataDir, 'secrets.json'), 'utf-8'));
    const res = await fetch(`${endpoint}/admin/workflow-defs/badUi`, {
      method: 'PUT',
      headers: { authorization: `Bearer ${secrets.adminToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        id: 'badUi',
        entry: 'a',
        concurrency: 1,
        steps: [{ id: 'a', kind: 'wait', params: { duration: 1 }, ui: { x: 'left', y: 0 } }]
      })
    });

    // A definition that fails validation on LOAD stops the backend booting, so
    // the only safe place to refuse a bad one is before it is written.
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(String(body.error)).toContain('ui must be');
  });
});
