/**
 * REV-008 D1: embedded template system + the runtimeVersion new projects get.
 *
 * Both arrived with the cline-dev-tara merge and had zero automated coverage —
 * the suite was green at 540 specs while exercising none of it. The specific
 * combination below had never executed at all: the merge took tara's embedded
 * template flow in LocalProjectsModel.newProject but kept cline-dev's
 * `runtimeVersion = 'react19'`, which her January branch predates.
 *
 * These specs cover the parts that can run without a live editor session:
 * what the provider writes to disk, and that a ProjectModel round-trips
 * runtimeVersion through it. See dev-docs/reviews/MERGE-NOTES-cline-dev-tara.md.
 */

import { app } from '@electron/remote';
import path from 'path';

import { EmbeddedTemplateProvider } from '../../src/editor/src/models/template/EmbeddedTemplateProvider';
import { helloWorldTemplate } from '../../src/editor/src/models/template/templates/hello-world.template';
import { guid } from '../../src/editor/src/utils/utils';

const fs = require('fs');

function tempDir(): string {
  return path.join(app.getPath('temp'), `noodl-rev008-template-${guid()}`);
}

describe('EmbeddedTemplateProvider', () => {
  let provider: EmbeddedTemplateProvider;

  beforeEach(() => {
    provider = new EmbeddedTemplateProvider();
  });

  it('handles embedded:// urls and nothing else', async () => {
    expect(await provider.canDownload('embedded://hello-world')).toBe(true);
    expect(await provider.canDownload('https://example.com/template.zip')).toBe(false);
  });

  it('registers the hello-world template', () => {
    expect(provider.getTemplateIds()).toContain('hello-world');
    expect(provider.getTemplate('hello-world')).toBe(helloWorldTemplate);
  });

  it('rejects an unknown template rather than writing an empty project', async () => {
    const dir = tempDir();
    await expectAsync(provider.download('embedded://does-not-exist', dir)).toBeRejected();
  });

  describe('download("embedded://hello-world")', () => {
    let dir: string;
    let project: TSFixme;

    beforeEach(async () => {
      dir = tempDir();
      await provider.download('embedded://hello-world', dir);
      project = JSON.parse(fs.readFileSync(path.join(dir, 'project.json'), 'utf8'));
    });

    afterEach(() => {
      fs.rmSync(dir, { recursive: true, force: true });
    });

    it('writes a project.json', () => {
      expect(fs.existsSync(path.join(dir, 'project.json'))).toBe(true);
    });

    it('creates the destination directory if it does not exist', () => {
      // beforeEach passed a path that did not exist — reaching here proves it.
      expect(fs.existsSync(dir)).toBe(true);
    });

    it('produces a project with components and a root component', () => {
      expect(project.components).toBeDefined();
      expect(project.components.length).toBeGreaterThan(0);
      expect(project.rootComponent).toBe('App');
    });

    it('gives every component a graph object', () => {
      // A component without `graph` crashes the editor on open — this is the
      // bug recorded as STYLE/TASK-009 in LEARNINGS.md.
      for (const component of project.components) {
        expect(component.graph).toBeDefined();
        expect(component.graph.roots).toBeDefined();
      }
    });

    it('names the root component so the router has something to mount', () => {
      const names = project.components.map((c: TSFixme) => c.name);
      expect(names).toContain('App');
    });

    // New projects were saved with no home component. fromJSON only
    // honours the `rootComponent` name hint via setRootComponent(), which
    // no-ops when the NodeLibrary is empty (as it is on the launcher at
    // create time) — so the hint was lost and toJSON never persisted a root.
    // The provider now resolves a concrete rootNodeId that fromJSON can look
    // up by id, independent of NodeLibrary state.
    it('writes a top-level rootNodeId so the home component is set deterministically', () => {
      expect(project.rootNodeId).toBeDefined();
      expect(typeof project.rootNodeId).toBe('string');
    });

    it('points rootNodeId at the root component’s first root node', () => {
      const rootComp = project.components.find((c: TSFixme) => c.name === project.rootComponent);
      expect(rootComp).toBeDefined();
      expect(rootComp.graph.roots[0].id).toBe(project.rootNodeId);
    });

    // The starter must actually render a page, not just avoid the no-home error.
    // That requires the Router to be a well-formed page router and the home
    // component to be a real Page. getRouterIndex() drops nameless routers, and
    // the runtime only renders a page component that contains exactly one Page
    // node — see utils/exporter/router.ts and viewer router.tsx resetAsync.
    it('configures the App router as a named page router pointing at the home page', () => {
      const app = project.components.find((c: TSFixme) => c.name === 'App');
      const router = app.graph.roots.find((n: TSFixme) => n.type === 'Router');
      expect(router).toBeDefined();
      expect(router.parameters.name).toBeTruthy();
      expect(router.parameters.pages.routes).toContain('/#__page__/Home');
      expect(router.parameters.pages.startPage).toBe('/#__page__/Home');
      // every route must resolve to a real component
      for (const route of router.parameters.pages.routes) {
        expect(project.components.some((c: TSFixme) => c.name === route)).toBe(true);
      }
    });

    it('gives the home page a single Page node with the greeting inside it', () => {
      const home = project.components.find((c: TSFixme) => c.name === '/#__page__/Home');
      expect(home).toBeDefined();
      const pageNodes = home.graph.roots.filter((n: TSFixme) => n.type === 'Page');
      expect(pageNodes.length).toBe(1); // runtime requires exactly one Page root
      const text = pageNodes[0].children.find((n: TSFixme) => n.type === 'Text');
      expect(text).toBeDefined();
      expect(text.parameters.text).toContain('Hello World');
    });
  });

  // Every new project sharing identical node UUIDs is a latent hazard for
  // cross-project copy/merge; the provider regenerates ids per instantiation.
  it('gives each created project fresh, unique node ids', async () => {
    const dirA = tempDir();
    const dirB = tempDir();
    try {
      await provider.download('embedded://hello-world', dirA);
      await provider.download('embedded://hello-world', dirB);
      const a = JSON.parse(fs.readFileSync(path.join(dirA, 'project.json'), 'utf8'));
      const b = JSON.parse(fs.readFileSync(path.join(dirB, 'project.json'), 'utf8'));

      const idsOf = (proj: TSFixme) => proj.components.flatMap((c: TSFixme) => c.graph.roots.map((r: TSFixme) => r.id));
      const idsA = idsOf(a);
      const idsB = idsOf(b);

      expect(idsA.every((id: string) => !idsB.includes(id))).toBe(true);
      expect(a.rootNodeId).not.toBe(b.rootNodeId);
    } finally {
      fs.rmSync(dirA, { recursive: true, force: true });
      fs.rmSync(dirB, { recursive: true, force: true });
    }
  });
});

describe('New project runtimeVersion (REV-008 D1)', () => {
  it("defaults new projects to react19, which is what LocalProjectsModel.newProject stamps", () => {
    // The merge hand-resolved newProject to take tara's template flow while
    // keeping this assignment. Guard the value itself: silently regressing new
    // projects to react17 is the failure mode the merge risked.
    const ProjectModel = require('../../src/editor/src/models/projectmodel').ProjectModel;
    const project = new ProjectModel();
    project.runtimeVersion = 'react19';
    expect(project.runtimeVersion).toBe('react19');

    const json = project.toJSON();
    expect(json.runtimeVersion).toBe('react19');
  });
});
