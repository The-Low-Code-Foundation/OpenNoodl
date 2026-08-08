/**
 * LAS-005 — `render_report`, and the render summary an apply carries back.
 *
 * The measurement itself is real Chrome and about eight seconds, so it is not
 * what these specs exercise; `scripts/devtools/measure-from-disk.js` is driven
 * against the two replay projects by hand, and its numbers are recorded in the
 * task file. What is pinned here is everything between the tool and that script,
 * which is where a wiring mistake would be silent:
 *
 *  - the tool exists on a **read-only** server (looking changes nothing, and a
 *    read-only server is where "is this page actually right?" gets asked);
 *  - screenshots come back as MCP **image** content, not as a base64 string
 *    buried in the JSON — the whole point is that a multimodal model can look;
 *  - a missing harness is an **actionable error**, not a crash;
 *  - `apply_plan` appends the numeric summary after writing anything visual,
 *    and omits it for a logic-only plan.
 *
 * The stub CLI stands in for the real one through `NODEGX_RENDER_CLI`, which is
 * the same seam a packaged install would use.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { call, connect, copyFixture, TestSession } from './helpers';

interface CreatePlanResponse {
  planId: string;
  operations: Array<{ id: string; kind: string; target: string }>;
}

interface ApplyPlanResponse {
  applied: Array<{ operation: string; target: string }>;
  render?: { summary?: string; findings?: Array<{ code: string }>; skipped?: string };
}

interface RawContentResult {
  isError?: boolean;
  content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
}

/** A one-pixel PNG, so the image block carries something a decoder would accept. */
const PIXEL_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const STUB_REPORT = {
  project: '(stub)',
  projectName: 'Demo App',
  durationMs: 12,
  tokens: '181 shipped defaults',
  viewports: {
    desktop: {
      requested: { width: 1280, height: 900 },
      layoutWidth: 1280,
      clientWidth: 1280,
      scrollWidth: 1280,
      pageHeight: 4269,
      text: { elements: 63, fontWeights: { '400': 33 }, distinctFontSizes: 9, bodyFontFamily: 'Inter' },
      placeholders: { count: 29, byText: { Text: 29 } },
      images: { total: 5, broken: 5, brokenSources: [] },
      emptyDecoratedBoxes: { count: 0 },
      repeatedGroups: []
    }
  },
  findings: [
    { code: 'dead-placeholder-text', severity: 'error', viewport: 'desktop', message: '29 elements render "Text".' }
  ],
  summary: '1 error, 0 warnings (dead-placeholder-text). desktop 1280×4269px, 63 texts, 5 images.'
};

/**
 * A stand-in for `measure-from-disk.js` that answers in the same dialect.
 *
 * Written as a file rather than mocked, because the seam under test *is* the
 * child process: an import mock would prove the tool calls a function, not that
 * it can parse what a separate Node process prints.
 */
function writeStubCli(body: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'noodl-mcp-render-'));
  const file = path.join(dir, 'stub-cli.js');
  fs.writeFileSync(file, body);
  return file;
}

const OK_CLI = `
const inline = process.argv.includes('--inline-screenshots');
const report = ${JSON.stringify(STUB_REPORT)};
if (inline) report.screenshots = [{ name: 'desktop', mimeType: 'image/png', base64: ${JSON.stringify(PIXEL_PNG)} }];
console.log(JSON.stringify(report));
`;

const FAILING_CLI = `
console.log(JSON.stringify({ error: { actionable: true, message: 'no viewer',
  problems: ['The viewer bundle is missing. Build it first: npx webpack --config webpack.viewer.prod.js'] } }));
process.exit(1);
`;

describe('LAS-005 — render_report', () => {
  let session: TestSession;
  let dir: string;
  const originalCli = process.env.NODEGX_RENDER_CLI;

  afterEach(async () => {
    if (session) await session.close();
    if (originalCli === undefined) delete process.env.NODEGX_RENDER_CLI;
    else process.env.NODEGX_RENDER_CLI = originalCli;
  });

  it('is registered on a read-only server — looking changes nothing', async () => {
    dir = copyFixture();
    session = await connect(dir, false);
    const tools = await session.client.listTools();
    expect(tools.tools.map((t) => t.name)).toContain('render_report');
  });

  it('returns the report as text and the screenshot as an image block', async () => {
    process.env.NODEGX_RENDER_CLI = writeStubCli(OK_CLI);
    dir = copyFixture();
    session = await connect(dir, false);

    const res = (await session.client.callTool({ name: 'render_report', arguments: {} })) as RawContentResult;

    expect(res.isError).toBeFalsy();
    const report = JSON.parse(res.content[0].text as string);
    expect(report.summary).toContain('dead-placeholder-text');
    expect(report.findings[0].code).toBe('dead-placeholder-text');

    // The image is an image. A base64 string inside the JSON would satisfy a
    // schema and be invisible to the model, which is the failure this exists to
    // prevent.
    const images = res.content.filter((c) => c.type === 'image');
    expect(images).toHaveLength(1);
    expect(images[0].mimeType).toBe('image/png');
    expect(images[0].data).toBe(PIXEL_PNG);
    // …and it is labelled, or the model cannot tell which viewport it is.
    expect(res.content.some((c) => c.type === 'text' && /Screenshot — desktop/.test(c.text ?? ''))).toBe(true);
  });

  it('reports a missing harness as an actionable error, not a crash', async () => {
    process.env.NODEGX_RENDER_CLI = writeStubCli(FAILING_CLI);
    dir = copyFixture();
    session = await connect(dir, false);

    const res = await call<{ error?: { code: string; message: string } }>(session, 'render_report');
    expect(res.isError).toBe(true);
    expect(res.data.error?.code).toBe('io-error');
    expect(res.data.error?.message).toContain('viewer bundle is missing');
    expect(res.data.error?.message).toContain('webpack');
  });

  it('refuses a NODEGX_RENDER_CLI that points at nothing, instead of quietly rendering something else', async () => {
    process.env.NODEGX_RENDER_CLI = '/nonexistent/measure-from-disk.js';
    dir = copyFixture();
    session = await connect(dir, false);

    const res = await call<{ error?: { code: string; message: string } }>(session, 'render_report');
    expect(res.isError).toBe(true);
    expect(res.data.error?.message).toContain('NODEGX_RENDER_CLI');
    expect(res.data.error?.message).toContain('does not exist');
  });
});

describe('LAS-005 §4 — apply_plan closes the loop', () => {
  let session: TestSession;
  const originalCli = process.env.NODEGX_RENDER_CLI;
  const originalDisabled = process.env.NODEGX_RENDER_DISABLED;

  beforeEach(() => {
    // The suite disables the automatic render (tests/setupEnv.js); these specs
    // are the ones that turn it back on, against the stub.
    delete process.env.NODEGX_RENDER_DISABLED;
    process.env.NODEGX_RENDER_CLI = writeStubCli(OK_CLI);
  });

  afterEach(async () => {
    if (session) await session.close();
    if (originalCli === undefined) delete process.env.NODEGX_RENDER_CLI;
    else process.env.NODEGX_RENDER_CLI = originalCli;
    if (originalDisabled === undefined) delete process.env.NODEGX_RENDER_DISABLED;
    else process.env.NODEGX_RENDER_DISABLED = originalDisabled;
  });

  async function applyPlan(nodes: unknown[], render?: 'summary' | 'off') {
    const plan = await call<CreatePlanResponse>(session, 'create_plan', {
      request: 'Add a catalogue page',
      operations: [{ kind: 'create', target: 'Pages/Catalogue', intent: 'The listing page' }]
    });
    await call(session, 'stage_plan_operation', {
      plan_id: plan.data.planId,
      operation_id: plan.data.operations[0].id,
      nodes
    });
    return call<ApplyPlanResponse>(session, 'apply_plan', {
      plan_id: plan.data.planId,
      ...(render ? { render } : {})
    });
  }

  const PAGE_NODES = [
    { id: 'ct_page', type: 'Page', parameters: { title: 'Catalogue', urlPath: 'catalogue' } },
    { id: 'ct_text', type: 'Text', parent: 'ct_page', parameters: { text: 'Catalogue' } }
  ];

  it('appends the numeric summary after writing something visual', async () => {
    session = await connect(copyFixture());
    const res = await applyPlan(PAGE_NODES);

    expect(res.isError).toBeFalsy();
    expect(res.data.render?.summary).toContain('dead-placeholder-text');
    expect(res.data.render?.findings?.[0].code).toBe('dead-placeholder-text');
  });

  it('does not render when the caller says off', async () => {
    session = await connect(copyFixture());
    const res = await applyPlan(PAGE_NODES, 'off');

    expect(res.isError).toBeFalsy();
    expect(res.data.render).toBeUndefined();
  });

  it('says the render was skipped rather than failing the apply', async () => {
    process.env.NODEGX_RENDER_CLI = '/nonexistent/measure-from-disk.js';
    session = await connect(copyFixture());
    const res = await applyPlan(PAGE_NODES);

    // The plan is already on disk by the time the render runs; a broken
    // screenshot tool must not read like a failed write.
    expect(res.isError).toBeFalsy();
    expect(res.data.applied).toHaveLength(1);
    expect(res.data.render?.skipped).toContain('NODEGX_RENDER_CLI');
  });
});
