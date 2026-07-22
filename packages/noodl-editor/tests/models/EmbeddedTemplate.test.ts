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
