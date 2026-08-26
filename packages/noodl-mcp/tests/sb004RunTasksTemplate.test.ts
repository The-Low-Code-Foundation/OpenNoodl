/**
 * SB-004 probe — does any authored-write gate cover a component named through a
 * `component`-typed PARAMETER, rather than as a node type?
 *
 * Why this port and not another: `Run Tasks` (`RunTasks`, port `taskTemplate`)
 * is the only iteration primitive the cloud runtime has, so it is the port the
 * whole §1 composition idiom flows through — a cloud function that does a thing
 * per record does it by naming a cloud helper component here. SB-001 brought the
 * authored write gates to parity with the editor for node *types*
 * (`checkRuntimeContext`, `wrong-runtime-node`). `taskTemplate` is not a node
 * type; it is a parameter value.
 *
 * Four arms, because an absence only means something beside a firing signal:
 *
 *  A. CONTROL, must FIRE — a browser node type in a cloud graph. Proves the
 *     runtime gate is live on this exact call path, so a clean result in C/D is
 *     "not checked" rather than "gate never ran".
 *  B. TWIN, must FIRE — the browser `For Each` naming a component that does not
 *     exist (`repeater-template-unresolved`). Proves a template-resolution check
 *     EXISTS in this codebase, so a clean C is "RunTasks is uncovered" rather
 *     than "nobody checks templates anywhere".
 *  C. PROBE — cloud `Run Tasks` naming a component that does not exist.
 *  D. PROBE — cloud `Run Tasks` naming a real BROWSER component (`/Card`),
 *     which the cloud runtime cannot register. The editor's own picker refuses
 *     exactly this (`componentpicker.ts:119-127` filters by runtime and excludes
 *     cloud functions); the question is whether the authored door does.
 *
 * The arms are printed, not just asserted, so the recorded evidence is the
 * diagnostics themselves rather than a boolean.
 */
import * as fs from 'fs';

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
  validation: { summary: { errors: number; warnings: number }; diagnostics?: Diag[] };
}

interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: { newErrors?: Diag[]; diagnostics?: Diag[] };
  };
}

type Either = CreateResponse & ErrorResponse;

/** Every diagnostic code mentioned anywhere in a result, success or failure. */
function codesOf(res: { isError: boolean; data: Either }): string[] {
  const buckets = [
    res.data?.validation?.diagnostics,
    res.data?.error?.details?.newErrors,
    res.data?.error?.details?.diagnostics
  ];
  const codes = buckets.flatMap((b) => (Array.isArray(b) ? b.map((d) => d.code) : []));
  return [...new Set(codes)];
}

function report(arm: string, res: { isError: boolean; data: Either }): void {
  // eslint-disable-next-line no-console
  console.log(
    `\n[${arm}] isError=${res.isError} codes=${JSON.stringify(codesOf(res))}\n` +
      `        ${JSON.stringify(res.data).slice(0, 700)}`
  );
}

describe('SB-004 probe: a component named through a parameter', () => {
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

  it('A. CONTROL — a browser node type in a cloud graph is refused (gate is live here)', async () => {
    const res = await call<Either>(session, 'create_component', {
      path: '#__cloud__/probe/ControlBrowserNode',
      nodes: [
        { id: 'req', type: 'noodl.cloud.request', parameters: { allowNoAuth: true } },
        { id: 'txt', type: 'Text', parameters: { text: 'I cannot exist here' } },
        { id: 'res', type: 'noodl.cloud.response' }
      ]
    });
    report('A control: browser NODE TYPE in cloud graph', res);
    expect(res.isError).toBe(true);
    expect(codesOf(res)).toContain('wrong-runtime-node');
  });

  it('B. TWIN — a browser For Each naming a missing template is refused', async () => {
    const res = await call<Either>(session, 'create_component', {
      path: 'Components/ProbeRepeater',
      nodes: [
        { id: 'g', type: 'Group' },
        {
          id: 'rep',
          type: 'For Each',
          parameters: { templateType: 'explicit', template: '/Components/NoSuchComponent' }
        }
      ]
    });
    report('B twin: For Each -> missing template', res);
    expect(codesOf(res)).toContain('repeater-template-unresolved');
  });

  it('C. PROBE — a cloud Run Tasks naming a missing template', async () => {
    const res = await call<Either>(session, 'create_component', {
      path: '#__cloud__/probe/RunTasksMissing',
      nodes: [
        { id: 'req', type: 'noodl.cloud.request', parameters: { allowNoAuth: true } },
        { id: 'rt', type: 'RunTasks', parameters: { taskTemplate: '/#__cloud__/NoSuchHelper' } },
        { id: 'res', type: 'noodl.cloud.response' }
      ]
    });
    report('C probe: Run Tasks -> missing template', res);
    // Recorded, not asserted — this test exists to find out.
    expect(typeof res.isError).toBe('boolean');
  });

  it('D. PROBE — a cloud Run Tasks naming a real BROWSER component', async () => {
    const res = await call<Either>(session, 'create_component', {
      path: '#__cloud__/probe/RunTasksCrossRuntime',
      nodes: [
        { id: 'req', type: 'noodl.cloud.request', parameters: { allowNoAuth: true } },
        { id: 'rt', type: 'RunTasks', parameters: { taskTemplate: '/Card' } },
        { id: 'res', type: 'noodl.cloud.response' }
      ]
    });
    report('D probe: Run Tasks -> browser component across the runtime boundary', res);
    expect(typeof res.isError).toBe('boolean');
  });
});
