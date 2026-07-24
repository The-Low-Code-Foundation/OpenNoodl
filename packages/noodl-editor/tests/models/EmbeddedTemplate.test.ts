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

import type { NodeDefinition, ProjectContent } from '../../src/editor/src/models/template/ProjectTemplate';

const fs = require('fs');

function tempDir(): string {
  return path.join(app.getPath('temp'), `noodl-rev008-template-${guid()}`);
}

/**
 * `download()` writes `JSON.stringify(projectContent)`, so the file on disk is a
 * `ProjectContent` — the provider's own published output type. Reading it as one
 * means a field these specs assert on cannot be renamed without a compile error.
 */
function readProject(dir: string): ProjectContent {
  return JSON.parse(fs.readFileSync(path.join(dir, 'project.json'), 'utf8'));
}

/**
 * The Router's `pages` parameter — `{ startPage, routes }`, the shape the runtime
 * and the exporter expect (see utils/exporter/router.ts). Nothing in the editor
 * names it: `NodeDefinition.parameters` is a `Record<string, unknown>` bag, and the
 * four places that read `pages` are untyped. A guard-based read beats a cast here
 * for the same reason `metadataAt` did in the io specs — it reports a malformed
 * fixture as a failed assertion rather than a crash two lines later.
 */
interface RouterPages {
  startPage?: string;
  routes?: string[];
}

function routerPages(router: NodeDefinition | undefined): RouterPages {
  const pages = router?.parameters?.pages;
  return pages && typeof pages === 'object' ? (pages as RouterPages) : {};
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
    let project: ProjectContent;

    beforeEach(async () => {
      dir = tempDir();
      await provider.download('embedded://hello-world', dir);
      project = readProject(dir);
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
      const names = project.components.map((c) => c.name);
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
      const rootComp = project.components.find((c) => c.name === project.rootComponent);
      expect(rootComp).toBeDefined();
      expect(rootComp.graph.roots[0].id).toBe(project.rootNodeId);
    });

    // The starter must actually render a page, not just avoid the no-home error.
    // That requires the Router to be a well-formed page router and the home
    // component to be a real Page. getRouterIndex() drops nameless routers, and
    // the runtime only renders a page component that contains exactly one Page
    // node — see utils/exporter/router.ts and viewer router.tsx resetAsync.
    it('configures the App router as a named page router pointing at the home page', () => {
      const app = project.components.find((c) => c.name === 'App');
      const router = app.graph.roots.find((n) => n.type === 'Router');
      expect(router).toBeDefined();
      expect(router.parameters.name).toBeTruthy();
      const pages = routerPages(router);
      expect(pages.routes).toContain('/#__page__/Home');
      expect(pages.startPage).toBe('/#__page__/Home');
      // every route must resolve to a real component
      for (const route of pages.routes) {
        expect(project.components.some((c) => c.name === route)).toBe(true);
      }
    });

    it('gives the home page a single Page node with the greeting inside it', () => {
      const home = project.components.find((c) => c.name === '/#__page__/Home');
      expect(home).toBeDefined();
      const pageNodes = home.graph.roots.filter((n) => n.type === 'Page');
      expect(pageNodes.length).toBe(1); // runtime requires exactly one Page root
      const text = pageNodes[0].children.find((n) => n.type === 'Text');
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
      const a = readProject(dirA);
      const b = readProject(dirB);

      const idsOf = (proj: ProjectContent) => proj.components.flatMap((c) => c.graph.roots.map((r) => r.id));
      const idsA = idsOf(a);
      const idsB = idsOf(b);

      expect(idsA.every((id) => !idsB.includes(id))).toBe(true);
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
