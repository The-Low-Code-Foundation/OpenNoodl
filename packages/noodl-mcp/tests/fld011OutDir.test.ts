/**
 * FLD-011 AC1 + AC5 — `render_report` can hand back file paths instead of half a megabyte of base64.
 *
 * [#40](https://github.com/The-Low-Code-Foundation/NodeGX/issues/40): *"I ran it six times in one
 * session"* — and every one of those runs put its screenshots into the context window. The CLI has
 * been able to write them to disk since HLS-007 (`measure-from-disk.js --out-dir`); what was
 * missing was any way for an agent to ask for that, so the tool inlined them unconditionally.
 *
 * What is pinned here is the wiring between the tool and that CLI, which is where a mistake would
 * be silent in both directions:
 *
 *  - **AC1** — `out_dir` makes the response carry paths and **no base64**, asserted beside a
 *    control run that proves this response shape *can* carry an image. An absence measured with no
 *    known-firing signal next to it is indistinguishable from a tool that never returns pictures.
 *  - **AC5** — with `out_dir` unset the argv is asserted **element by element**, so the default
 *    path cannot drift into writing files, or into dropping the flag that makes the images arrive.
 *
 * The stub CLI stands in for the real one through `NODEGX_RENDER_CLI` — the same seam a packaged
 * install uses — and it is a real child process, because the seam under test *is* the command line.
 * An import mock would prove the tool calls a function; it would not prove the flags survive.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { connect, copyFixture, TestSession } from './helpers';

interface RawContentResult {
  isError?: boolean;
  content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
}

/** A one-pixel PNG, so a written file is a file a decoder would accept. */
const PIXEL_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const VIEWPORT = {
  requested: { width: 1280, height: 900 },
  layoutWidth: 1280,
  clientWidth: 1280,
  scrollWidth: 1280,
  pageHeight: 2000,
  text: { elements: 40, fontWeights: { '400': 20 }, distinctFontSizes: 4, bodyFontFamily: 'Inter' },
  placeholders: { count: 0, byText: {} },
  images: { total: 2, broken: 0, brokenSources: [] },
  emptyDecoratedBoxes: { count: 0 },
  repeatedGroups: []
};

/** Three routed pages across two viewports — six images, which is the case `out_dir` exists for. */
const PAGES = ['Pages/Home', 'Pages/Quiz', 'Pages/Thank You'];
const VIEWPORT_NAMES = ['desktop', 'phone'];

const STUB_REPORT = {
  project: '(stub)',
  projectName: 'Demo App',
  durationMs: 12,
  tokens: '181 shipped defaults',
  viewports: Object.fromEntries(VIEWPORT_NAMES.map((n) => [n, VIEWPORT])),
  pages: PAGES.map((component, i) => ({
    component,
    urlPath: i === 0 ? '/' : component.split('/')[1].toLowerCase(),
    isStart: i === 0,
    measured: true,
    viewports: Object.fromEntries(VIEWPORT_NAMES.map((n) => [n, VIEWPORT]))
  })),
  findings: [],
  summary: 'Rendered clean. desktop 1280×2000px, 40 texts, 2 images.'
};

/**
 * A stand-in for `measure-from-disk.js` that answers in the same dialect **and honours the same two
 * flags** — it records its own argv, and under `--out-dir` it writes one file per page per viewport
 * and stamps the path onto the page row, exactly where the real CLI stamps it.
 */
function writeStubCli(argvLog: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fld011-'));
  const file = path.join(dir, 'stub-cli.js');
  fs.writeFileSync(
    file,
    `
const fs = require('fs');
const path = require('path');
const argv = process.argv.slice(2);
fs.writeFileSync(${JSON.stringify(argvLog)}, JSON.stringify(argv));

const report = ${JSON.stringify(STUB_REPORT)};
const i = argv.indexOf('--out-dir');
const outDir = i === -1 ? undefined : argv[i + 1];

if (outDir) {
  // What HLS-007 does: write the files, stamp the path on the row, return NO base64.
  fs.mkdirSync(outDir, { recursive: true });
  for (const page of report.pages) {
    for (const name of Object.keys(page.viewports)) {
      const stem = page.component.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const f = path.join(outDir, stem + '-' + name + '.png');
      fs.writeFileSync(f, Buffer.from(${JSON.stringify(PIXEL_PNG)}, 'base64'));
      page.viewports[name] = Object.assign({}, page.viewports[name], { screenshot: f });
    }
  }
} else if (argv.includes('--inline-screenshots')) {
  report.screenshots = Object.keys(report.viewports).map((name) => ({
    name,
    mimeType: 'image/png',
    base64: ${JSON.stringify(PIXEL_PNG)}
  }));
}
console.log(JSON.stringify(report));
`,
    'utf8'
  );
  return file;
}

function tmpFile(name: string): string {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'fld011-')), name);
}

describe('FLD-011 — render_report out_dir', () => {
  let session: TestSession;
  let argvLog: string;
  const originalCli = process.env.NODEGX_RENDER_CLI;

  beforeEach(() => {
    argvLog = tmpFile('argv.json');
    process.env.NODEGX_RENDER_CLI = writeStubCli(argvLog);
  });

  afterEach(async () => {
    if (session) await session.close();
    if (originalCli === undefined) delete process.env.NODEGX_RENDER_CLI;
    else process.env.NODEGX_RENDER_CLI = originalCli;
  });

  const argvSent = (): string[] => JSON.parse(fs.readFileSync(argvLog, 'utf8'));

  async function render(args: Record<string, unknown>): Promise<{ res: RawContentResult; projectDir: string }> {
    const projectDir = copyFixture();
    session = await connect(projectDir, false);
    const res = (await session.client.callTool({ name: 'render_report', arguments: args })) as RawContentResult;
    return { res, projectDir };
  }

  /** Every text block joined — the haystack an absence has to be asserted against. */
  const allText = (res: RawContentResult): string =>
    res.content
      .filter((c) => c.type === 'text')
      .map((c) => c.text ?? '')
      .join('\n');

  it('🔴 AC5 — with out_dir unset the command line is unchanged, element by element', async () => {
    const { res, projectDir } = await render({});

    expect(res.isError).toBeFalsy();
    // Byte-identical to what HEAD sent. Written out in full rather than as a `toContain`, because
    // the failure this guards against is an EXTRA flag — `--out-dir` leaking into the default —
    // and a containment check cannot see one.
    expect(argvSent()).toEqual([projectDir, '--json', '--screenshot', 'full', '--inline-screenshots', '--scale', '0.4']);
  });

  it('🔴 AC1 control — the default response really does carry an image, so the absence below means something', async () => {
    const { res } = await render({});

    const images = res.content.filter((c) => c.type === 'image');
    expect(images).toHaveLength(VIEWPORT_NAMES.length);
    expect(images[0].data).toBe(PIXEL_PNG);
    // The known-firing signal: base64 IS reachable through this response shape.
    expect(images.some((c) => (c.data ?? '').length > 0)).toBe(true);
  });

  it('🔴 AC1 — out_dir sends --out-dir and drops --inline-screenshots', async () => {
    const outDir = tmpFile('shots');
    await render({ out_dir: outDir });

    const argv = argvSent();
    expect(argv).toContain('--out-dir');
    expect(argv[argv.indexOf('--out-dir') + 1]).toBe(outDir);
    // 🔴 The half that matters. Sending both would write the files AND pay the context cost the
    // flag exists to avoid, and every assertion below would still pass.
    expect(argv).not.toContain('--inline-screenshots');
  });

  it('🔴 AC1 — the response carries paths and no base64 at all', async () => {
    const outDir = tmpFile('shots');
    const { res } = await render({ out_dir: outDir });

    expect(res.isError).toBeFalsy();
    expect(res.content.filter((c) => c.type === 'image')).toHaveLength(0);
    // Not just "no image blocks": a base64 string smuggled into the JSON would satisfy that and
    // cost the caller exactly as much. The pixel is 68 characters; if it is anywhere in the text,
    // this response is still carrying an image.
    expect(allText(res)).not.toContain(PIXEL_PNG);
    expect(allText(res)).not.toMatch(/[A-Za-z0-9+/]{200,}={0,2}/);
  });

  it('🔴 AC1 — every page and viewport is named with the file an agent can read', async () => {
    const outDir = tmpFile('shots');
    const { res } = await render({ out_dir: outDir });

    const text = allText(res);
    for (const component of PAGES) {
      for (const viewport of VIEWPORT_NAMES) {
        expect(text).toContain(`${component} — ${viewport}:`);
      }
    }
    // Six images, and six files that exist. A manifest naming a file nothing wrote is the failure
    // mode a path-based response has that an inline image does not.
    expect(text).toContain(`6 screenshots written to ${outDir}`);
    const written = fs.readdirSync(outDir).filter((f) => f.endsWith('.png'));
    expect(written).toHaveLength(PAGES.length * VIEWPORT_NAMES.length);
    // The MANIFEST's own lines, not every line mentioning a .png — the JSON report block above
    // carries the same paths inside quotes, and parsing those would grade the wrong producer.
    const manifest = text.split('\n').filter((l) => /^ {2}\S.* — \w+: \//.test(l));
    expect(manifest).toHaveLength(PAGES.length * VIEWPORT_NAMES.length);
    for (const line of manifest) {
      expect(fs.existsSync(line.slice(line.lastIndexOf(': ') + 2).trim())).toBe(true);
    }
  });

  it('🔴 AC1 — the manifest still says LOOK, because a path is not a picture you looked at', async () => {
    const { res } = await render({ out_dir: tmpFile('shots') });

    // The tool's own doctrine (`renderTools.ts` — "LOOK AT THE SCREENSHOTS") is the reason out_dir
    // is off by default. Moving the images to disk must not quietly move the instruction with them.
    expect(allText(res)).toMatch(/READ the ones you need/);
  });

  it('🔴 AC1 — a relative out_dir is resolved, so the path handed back is the path on disk', async () => {
    // Named under the OS temp dir rather than a bare 'shots-relative': the CLI really writes the
    // files, so a relative name resolves against jest's cwd and this spec would drop a directory
    // into the package on every run. A spec that litters the repo is a spec that gets committed.
    const relative = path.relative(process.cwd(), path.join(os.tmpdir(), `fld011-rel-${process.pid}`));
    try {
      await render({ out_dir: relative });

      const argv = argvSent();
      const sent = argv[argv.indexOf('--out-dir') + 1];
      expect(path.isAbsolute(sent)).toBe(true);
      expect(sent).toBe(path.resolve(relative));
    } finally {
      fs.rmSync(path.resolve(relative), { recursive: true, force: true });
    }
  });

  it('screenshot: none takes neither flag — there is nothing to write or to inline', async () => {
    await render({ out_dir: tmpFile('shots'), screenshot: 'none' });

    const argv = argvSent();
    expect(argv).not.toContain('--out-dir');
    expect(argv).not.toContain('--inline-screenshots');
    expect(argv).toEqual(expect.arrayContaining(['--screenshot', 'none']));
  });
});
