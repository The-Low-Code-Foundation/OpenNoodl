/**
 * End-to-end specs for the preview harness, driven through the built CLI over
 * HTTP — the same surface a browser sees.
 *
 * What they cannot cover: that the served page *paints*. That needs a real
 * browser and was verified by hand (see README, "Verified behaviour"). What
 * they do cover is everything up to the paint: that the export a real deploy
 * would produce is what gets served, that a file change turns into a reload
 * within the debounce window, and that an invalid edit is caught before it can
 * reach the renderer.
 */

import * as fs from 'fs';
import * as path from 'path';

import {
  assertPrerequisites,
  get,
  getJson,
  openEvents,
  scratchCopy,
  startPreview,
  waitForState,
  writeJson,
  type RunningPreview
} from './helpers';
import type {
  ConnectionsV2File,
  NodesV2File,
  ProjectV2File
} from '../../noodl-editor/src/editor/src/schemas';

beforeAll(() => assertPrerequisites());

const MARKER = 'window.projectData = ';

/**
 * The slice of an exported component these assertions touch.
 *
 * `nodes` stays `TSFixme` (PLAT-004): the export node format is produced by the
 * editor's untyped `Exporter.exportToJSON`, so there is no published type to
 * point at. It becomes knowable when the exporter is typed.
 */
interface ExportedComponent {
  name: string;
  nodes: TSFixme[];
}

/**
 * Pulls `window.projectData` back out of the served index.js.
 *
 * Returns `TSFixme` for the same reason — this is the exporter's own output
 * shape, and asserting a type here would be inventing one.
 */
function parseProjectData(indexJs: string): TSFixme {
  return JSON.parse(indexJs.slice(indexJs.indexOf(MARKER) + MARKER.length).replace(/;\s*$/, ''));
}

/** The single bundle this fixture produces, which is where the page lives. */
async function fetchOnlyBundle(port: number): Promise<string> {
  const data = parseProjectData((await get(port, '/index.js')).body);
  const [bundleId] = Object.keys(data.componentIndex);
  return (await get(port, `/noodl_bundles/${bundleId}.json`)).body;
}

describe('static render (no editor process)', () => {
  let dir: string;
  let preview: RunningPreview;

  beforeAll(async () => {
    dir = scratchCopy('hello-world');
    preview = await startPreview(dir, ['--no-watch']);
  });
  afterAll(async () => {
    await preview?.stop();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('serves the deployed runtime page with the project title', async () => {
    const res = await get(preview.port, '/');
    expect(res.status).toBe(200);
    expect(res.body).toContain('<title>Hello Preview</title>');
    // The deployed entry point — not the editor's WebSocket render path.
    expect(res.body).toContain('renderDeployed(root, __noodl_modules, window.projectData)');
    expect(res.body).toContain('/__preview/events');
  });

  it('serves the export JSON the runtime consumes', async () => {
    const res = await get(preview.port, '/index.js');
    expect(res.status).toBe(200);
    const json = parseProjectData(res.body);

    expect(json.rootComponent).toBe('/App');
    expect(json.rootNode).toBe('app_router');
    // Router discovery is what makes the page reachable at all.
    expect(json.routerIndex.routers[0].name).toBe('Main');
    expect(json.routerIndex.pages).toEqual([{ path: 'home', title: 'Home', component: '/#__page__/Home' }]);
    // The root component is inlined; the page arrives in a bundle, exactly as
    // deployToFolder splits it.
    expect(json.components.map((c: ExportedComponent) => c.name)).toEqual(['/App']);
    expect(Object.keys(json.componentIndex)).toHaveLength(1);
  });

  it('serves the component bundles the runtime lazily fetches', async () => {
    const index = JSON.parse((await get(preview.port, '/__preview/state')).body);
    expect(index.state.kind).toBe('ok');

    const components = JSON.parse(await fetchOnlyBundle(preview.port));
    expect(components.map((c: ExportedComponent) => c.name)).toContain('/#__page__/Home');
    // The Text node with its parameters, nested under the Page — i.e. a
    // renderable graph, not just a name list.
    const home = components.find((c: ExportedComponent) => c.name === '/#__page__/Home');
    expect(home.nodes[0].children[0].parameters.text).toBe('Hello World!');
  });

  it('serves the deployed runtime bundle, and revalidates it with an ETag', async () => {
    const first = await get(preview.port, '/noodl.deploy.js');
    expect(first.status).toBe(200);
    expect(Number(first.headers['content-length'])).toBeGreaterThan(1_000_000);

    const second = await get(preview.port, '/noodl.deploy.js', { 'if-none-match': String(first.headers.etag) });
    expect(second.status).toBe(304);
  });

  it('serves project assets from the project directory', async () => {
    fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'assets/note.txt'), 'from the project');

    const res = await get(preview.port, '/assets/note.txt');
    expect(res.status).toBe(200);
    expect(res.body).toBe('from the project');
  });

  it('refuses to serve anything outside the project directory', async () => {
    const res = await get(preview.port, '/../../../../etc/hosts');
    expect(res.status).toBe(404);
  });
});

describe('watching', () => {
  let dir: string;
  let preview: RunningPreview;
  let homeNodes: string;

  beforeAll(async () => {
    dir = scratchCopy('hello-world');
    homeNodes = path.join(dir, 'components/__page__/Home/nodes.json');
    preview = await startPreview(dir);
  });
  afterAll(async () => {
    await preview?.stop();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('reflects an external edit in the served export, and tells the browser to reload', async () => {
    const events = openEvents(preview.port);
    await new Promise((r) => setTimeout(r, 100)); // let the hello frame land
    expect(events.frames).toEqual([{ type: 'ok' }]);

    writeJson<NodesV2File>(homeNodes, (json) => {
      json.nodes[1].parameters.text = 'Edited from outside';
    });

    await waitForState(preview.port, (s) => s.state.kind === 'ok');
    await new Promise((r) => setTimeout(r, 400));

    expect(events.frames).toContainEqual({ type: 'reload' });

    expect(await fetchOnlyBundle(preview.port)).toContain('Edited from outside');

    events.close();
  });

  it('gates an invalid edit: diagnostics out, last good build kept', async () => {
    const events = openEvents(preview.port);
    await new Promise((r) => setTimeout(r, 100));

    writeJson<ConnectionsV2File>(path.join(dir, 'components/__page__/Home/connections.json'), (json) => {
      json.connections = [{ fromId: 'ghost', fromProperty: 'value', toId: 'greeting', toProperty: 'text' }];
    });

    const state = await waitForState(preview.port, (s) => s.state.kind === 'invalid');
    if (state.state.kind !== 'invalid') throw new Error(`Expected an invalid state, got ${state.state.kind}`);
    expect(state.state.report.summary.errors).toBe(1);
    // Select the error by code, never by position. `diagnostics` is the
    // validator's full list and carries warnings too — this fixture's own
    // `textAlign` parameter is one (Text's ports are `textAlignX`/`textAlignY`),
    // and it sorts ahead of the error. Asserting the whole error set also says
    // the thing this spec is actually about: one error, and it is the gate.
    const errors = state.state.report.diagnostics.filter((d) => d.severity === 'error');
    expect(errors.map((d) => d.code)).toEqual(['dangling-connection']);
    // The previous good build is still installed — that is what keeps the
    // browser showing something instead of blanking.
    expect(state.hasBuild).toBe(true);
    expect(await fetchOnlyBundle(preview.port)).toContain('Edited from outside');

    await new Promise((r) => setTimeout(r, 200));
    const diagnostics = events.frames.filter((f) => f.type === 'diagnostics');
    expect(diagnostics.length).toBeGreaterThan(0);
    expect(diagnostics.at(-1).diagnostics.find((d) => d.code === 'dangling-connection')?.message).toContain(
      'references a missing node'
    );
    // No reload was ordered — the invalid state must not swap the render.
    expect(events.frames.filter((f) => f.type === 'reload')).toHaveLength(0);

    events.close();
  });

  it('a browser connecting mid-failure is told about it immediately', async () => {
    const events = openEvents(preview.port);
    await new Promise((r) => setTimeout(r, 200));
    expect(events.frames[0].type).toBe('diagnostics');
    events.close();
  });

  it('recovers on the next valid edit', async () => {
    const events = openEvents(preview.port);
    await new Promise((r) => setTimeout(r, 100));

    writeJson<ConnectionsV2File>(path.join(dir, 'components/__page__/Home/connections.json'), (json) => {
      json.connections = [];
    });

    await waitForState(preview.port, (s) => s.state.kind === 'ok');
    await new Promise((r) => setTimeout(r, 300));
    expect(events.frames).toContainEqual({ type: 'reload' });

    events.close();
  });

  it('keeps serving after an unparseable file, then recovers', async () => {
    fs.writeFileSync(path.join(dir, 'components/__page__/Home/nodes.json'), '{ this is not json');
    const broken = await waitForState(preview.port, (s) => s.state.kind === 'error');
    expect(broken.hasBuild).toBe(true);

    writeJson<ProjectV2File>(path.join(dir, 'nodegx.project.json'), (json) => json); // no-op rewrite
    fs.writeFileSync(
      path.join(dir, 'components/__page__/Home/nodes.json'),
      JSON.stringify(
        {
          componentId: 'c_home',
          version: 1,
          nodes: [
            { id: 'page', type: 'Page', parameters: { title: 'Home', urlPath: 'home' }, children: ['greeting'] },
            { id: 'greeting', type: 'Text', parent: 'page', parameters: { text: 'Back again' } }
          ],
          visualRoots: ['page']
        },
        null,
        2
      )
    );

    await waitForState(preview.port, (s) => s.state.kind === 'ok');
    expect(await fetchOnlyBundle(preview.port)).toContain('Back again');
  });

  it('ignores churn in .git', async () => {
    const before = await getJson(preview.port, '/__preview/state');
    fs.mkdirSync(path.join(dir, '.git'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.git/index'), String(Date.now()));

    await new Promise((r) => setTimeout(r, 700));
    const after = await getJson(preview.port, '/__preview/state');
    expect(after).toEqual(before);
  });
});

describe('legacy project.json', () => {
  let dir: string;
  let preview: RunningPreview;

  beforeAll(async () => {
    dir = scratchCopy('legacy');
    preview = await startPreview(dir, ['--no-watch']);
  });
  afterAll(async () => {
    await preview?.stop();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('renders through the legacy branch', async () => {
    expect((await get(preview.port, '/')).body).toContain('<title>Hello Preview (legacy)</title>');
    expect(parseProjectData((await get(preview.port, '/index.js')).body).rootComponent).toBe('/App');
    expect(await fetchOnlyBundle(preview.port)).toContain('Hello from a legacy project');
  });
});

describe('bad input', () => {
  it('names the problem when the target is not a project', async () => {
    const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'noodl-preview-empty-'));
    await expect(startPreview(dir, ['--no-watch'])).rejects.toThrow(/not a Noodl project/);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
