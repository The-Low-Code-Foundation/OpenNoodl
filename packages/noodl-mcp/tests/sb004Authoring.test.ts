/**
 * SB-004 — the publish flow, authored through the real MCP surface.
 *
 * This is the phase's dogfood. SB-001 made cloud components authorable and
 * SB-002 taught the idiom, but s1 closed leaving one debt in those words: *the
 * plan door has never driven a cloud target end to end*. Both doors are
 * exercised here — `create_component` and `create_plan`/`stage`/`apply` — on a
 * real server (`helpers.ts` → `createServer` from `src`), so a rejection here is
 * a rejection an agent would get.
 *
 * The shape, per SB-004 §5:
 *   site/SetSectionAccess  — the Run Tasks worker: ACL rules for ONE section
 *   publishPage            — Request → Query sections → build items → Run Tasks
 *                            → Update the Page → Response
 *
 * ⚠️ Assertions go to the registry key and the component file's `path`, never
 * through `store.resolve` — SB-001's trap.
 */
import * as fs from 'fs';
import * as path from 'path';

import type { TestSession } from './helpers';
import { call, connect, copyFixture } from './helpers';

interface Diag {
  code: string;
  severity: string;
  message: string;
}

interface CreateResponse {
  created: string;
  legacyName: string;
  type: string;
  validation: { summary: { errors: number; warnings: number; infos: number }; diagnostics?: Diag[] };
}

interface ErrorResponse {
  error: { code: string; message: string; details?: { readable?: string[]; newErrors?: Diag[] } };
}

type Either = CreateResponse & ErrorResponse;

interface PlanOp {
  id: string;
  target: string;
}
interface CreatePlanResponse {
  planId: string;
  operations: PlanOp[];
}
interface StageResponse {
  validation?: { diagnostics?: Diag[]; summary?: Record<string, number> };
  error?: ErrorResponse['error'];
}

interface RegistryFile {
  components: Record<string, { type?: string; path?: string }>;
}

const readJson = <T>(dir: string, rel: string): T =>
  JSON.parse(fs.readFileSync(path.join(dir, rel), 'utf-8')) as T;

/**
 * The two ACL rules that ARE the publication state (SB-004 §3).
 *
 * `-target` is `allowEditOnly` so it is a parameter; `-read`/`-write` are plain
 * boolean ports, which is exactly what lets ONE graph both publish and
 * unpublish — `acl-world-read` is wired, not set.
 */
const ACCESS_RULES = {
  accessControl: [
    { id: 'admin', label: 'Admin' },
    { id: 'world', label: 'World' }
  ],
  'acl-admin-target': 'role',
  'acl-admin-role': 'admin',
  'acl-admin-read': true,
  'acl-admin-write': true,
  'acl-world-target': 'everyone',
  'acl-world-write': false
};

/**
 * The worker. Its interface is Component Inputs — Run Tasks pushes each item KEY
 * onto a declared input of the same name (`runtasks.ts:419-432`), which is why
 * `objectId` and `isPublic` arrive. A worker is NOT an endpoint: no Request
 * node, so after SB-003 it 404s as a function name.
 */
const WORKER_NODES = [
  {
    id: 'inputs',
    type: 'Component Inputs',
    label: 'The section, and whether it goes public',
    ports: [
      { name: 'objectId', type: 'string', plug: 'output' },
      { name: 'isPublic', type: 'boolean', plug: 'output' },
      { name: 'Do', type: 'signal', plug: 'output' }
    ]
  },
  {
    id: 'write',
    type: 'SetDbModelProperties',
    label: 'Write the section access rules',
    parameters: {
      collectionName: 'Section',
      idSource: 'explicit',
      storeProperties: 'specified',
      ...ACCESS_RULES
    }
  },
  {
    id: 'outputs',
    type: 'Component Outputs',
    label: 'Task result',
    // Run Tasks matches these two by STRING. Name them anything else and the
    // run hangs for ever with no warning (`runtasks.ts` NDA-004 note).
    ports: [
      { name: 'Success', type: 'signal', plug: 'input' },
      { name: 'Failure', type: 'signal', plug: 'input' }
    ]
  }
];

const WORKER_WIRES = [
  { fromId: 'inputs', fromProperty: 'objectId', toId: 'write', toProperty: 'modelId' },
  { fromId: 'inputs', fromProperty: 'isPublic', toId: 'write', toProperty: 'acl-world-read' },
  { fromId: 'inputs', fromProperty: 'Do', toId: 'write', toProperty: 'store' },
  { fromId: 'write', fromProperty: 'done', toId: 'outputs', toProperty: 'Success' },
  { fromId: 'write', fromProperty: 'failure', toId: 'outputs', toProperty: 'Failure' }
];

const ENDPOINT_NODES = [
  {
    id: 'req',
    type: 'noodl.cloud.request',
    label: 'publishPage(pageId, publish)',
    parameters: {
      // A cloud FUNCTION's interface is this stringlist, NOT Component Inputs
      // (SB-002's correction). A stringlist is one comma-separated STRING — an
      // array is rejected, because the editor calls .split(',') on it.
      // Declared types make a bad call a 400 before the graph runs (CWF-014).
      params: 'pageId,publish',
      'ptype-pageId': 'string',
      'preq-pageId': true,
      'ptype-publish': 'boolean',
      'preq-publish': true,
      allowNoAuth: false
    }
  },
  {
    id: 'sections',
    type: 'DbCollection2',
    label: "This page's sections",
    parameters: { collectionName: 'Section' }
  },
  {
    id: 'withFlag',
    type: 'JavaScriptFunction',
    label: 'Carry isPublic onto every item',
    parameters: {
      // Run Tasks pushes item KEYS onto the worker's inputs and only those, so
      // `publish` has to ride INSIDE each item. `Array Map` cannot do it: its
      // only inputs are items/mapScript/refresh, so its script closes over
      // nothing. Once a step needs code at all, all of it goes in ONE code node.
      functionScript:
        'const flag = Inputs.isPublic;\n' +
        'Outputs.tasks = (Inputs.sections || []).map((s) => ({ objectId: s.id, isPublic: flag }));\n' +
        'Outputs.built();'
    }
  },
  {
    id: 'tasks',
    type: 'RunTasks',
    label: 'Set access on every section',
    parameters: {
      taskTemplate: '/#__cloud__/site/SetSectionAccess',
      stopOnFailure: true
    }
  },
  {
    id: 'page',
    type: 'SetDbModelProperties',
    label: 'Write the page: mirror + access rules',
    parameters: {
      collectionName: 'Page',
      idSource: 'explicit',
      storeProperties: 'specified',
      ...ACCESS_RULES
    }
  },
  {
    id: 'res',
    type: 'noodl.cloud.response',
    label: 'Answer',
    parameters: { params: 'pageId,published' }
  }
];

const ENDPOINT_WIRES = [
  { fromId: 'req', fromProperty: 'pm-pageId', toId: 'sections', toProperty: 'storageFetch' },
  { fromId: 'sections', fromProperty: 'items', toId: 'withFlag', toProperty: 'in-sections' },
  { fromId: 'req', fromProperty: 'pm-publish', toId: 'withFlag', toProperty: 'in-isPublic' },
  { fromId: 'sections', fromProperty: 'fetched', toId: 'withFlag', toProperty: 'run' },
  { fromId: 'withFlag', fromProperty: 'out-tasks', toId: 'tasks', toProperty: 'items' },
  { fromId: 'withFlag', fromProperty: 'out-built', toId: 'tasks', toProperty: 'run' },
  { fromId: 'tasks', fromProperty: 'completed', toId: 'page', toProperty: 'store' },
  { fromId: 'req', fromProperty: 'pm-pageId', toId: 'page', toProperty: 'modelId' },
  { fromId: 'req', fromProperty: 'pm-publish', toId: 'page', toProperty: 'prop-published' },
  { fromId: 'req', fromProperty: 'pm-publish', toId: 'page', toProperty: 'acl-world-read' },
  { fromId: 'page', fromProperty: 'done', toId: 'res', toProperty: 'send' }
];

/** Print whatever the door said, so a rejection is evidence rather than a red. */
function say(label: string, res: { isError: boolean; data: Either & StageResponse }): void {
  const readable = res.data?.error?.details?.readable;
  // eslint-disable-next-line no-console
  console.log(
    `\n[${label}] isError=${res.isError}` +
      (res.data?.validation?.summary ? ` summary=${JSON.stringify(res.data.validation.summary)}` : '') +
      (res.data?.error ? `\n  ${res.data.error.code}: ${res.data.error.message}` : '') +
      (readable ? `\n  ${readable.join('\n  ')}` : '') +
      (res.data?.validation?.diagnostics?.length
        ? `\n  ${res.data.validation.diagnostics.map((d) => `${d.severity} [${d.code}] ${d.message}`).join('\n  ')}`
        : '')
  );
}

/** Both components landed under the editor-canonical cloud key, typed cloud. */
function expectLandedAsCloud(dir: string, key: string): void {
  const registry = readJson<RegistryFile>(dir, 'components/_registry.json');
  expect(registry.components[key]?.type).toBe('cloud');
  expect(registry.components[`#${key}`]).toBeUndefined();
  const component = readJson<{ path: string; type: string }>(dir, `components/${key}/component.json`);
  expect(component.path).toBe(`/#${key}`);
  expect(component.type).toBe('cloud');
}

describe('SB-004: the publish flow through create_component', () => {
  let session: TestSession;
  let dir: string;

  beforeAll(async () => {
    dir = copyFixture();
    session = await connect(dir);
  });
  afterAll(async () => {
    await session.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("authors the Run Tasks worker: one section's access rules", async () => {
    const res = await call<Either>(session, 'create_component', {
      path: '#__cloud__/site/SetSectionAccess',
      nodes: WORKER_NODES,
      connections: WORKER_WIRES
    });
    say('worker: site/SetSectionAccess', res);
    expect(res.isError).toBe(false);
    expect(res.data.legacyName).toBe('/#__cloud__/site/SetSectionAccess');
    expectLandedAsCloud(dir, '__cloud__/site/SetSectionAccess');
  });

  it('authors the endpoint: publishPage', async () => {
    const res = await call<Either>(session, 'create_component', {
      path: '#__cloud__/publishPage',
      nodes: ENDPOINT_NODES,
      connections: ENDPOINT_WIRES
    });
    say('endpoint: publishPage', res);
    expect(res.isError).toBe(false);
    expectLandedAsCloud(dir, '__cloud__/publishPage');
  });
});

/**
 * s1's named debt: the plan door had never driven a cloud target end to end.
 * Two cloud operations in ONE plan — the worker and the endpoint that composes
 * it — staged and applied.
 */
describe('SB-004: the same flow through the plan door', () => {
  let session: TestSession;
  let dir: string;

  beforeAll(async () => {
    dir = copyFixture();
    session = await connect(dir);
  });
  afterAll(async () => {
    await session.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('plans, stages and applies two cloud components', async () => {
    const plan = await call<CreatePlanResponse & ErrorResponse>(session, 'create_plan', {
      request: 'Publishing: flip a page and its sections between draft and public',
      operations: [
        {
          kind: 'create',
          target: '#__cloud__/site/SetSectionAccess',
          intent: 'Run Tasks worker: write one section\'s access rules.'
        },
        {
          kind: 'create',
          target: '#__cloud__/publishPage',
          intent: 'The endpoint: publish or unpublish a page and all its sections.'
        }
      ]
    });
    say('create_plan (two cloud targets)', plan as never);
    expect(plan.isError).toBe(false);

    const [workerOp, endpointOp] = plan.data.operations;

    const stagedWorker = await call<StageResponse & Either>(session, 'stage_plan_operation', {
      plan_id: plan.data.planId,
      operation_id: workerOp.id,
      nodes: WORKER_NODES,
      connections: WORKER_WIRES
    });
    say('stage worker', stagedWorker);
    expect(stagedWorker.isError).toBe(false);

    const stagedEndpoint = await call<StageResponse & Either>(session, 'stage_plan_operation', {
      plan_id: plan.data.planId,
      operation_id: endpointOp.id,
      nodes: ENDPOINT_NODES,
      connections: ENDPOINT_WIRES
    });
    say('stage endpoint', stagedEndpoint);
    expect(stagedEndpoint.isError).toBe(false);

    const applied = await call<Either>(session, 'apply_plan', { plan_id: plan.data.planId });
    say('apply_plan', applied);
    expect(applied.isError).toBe(false);

    // The whole point: through THIS door too, both land as cloud components
    // under the editor's spelling — not in the browser bundle.
    expectLandedAsCloud(dir, '__cloud__/site/SetSectionAccess');
    expectLandedAsCloud(dir, '__cloud__/publishPage');
  });
});
