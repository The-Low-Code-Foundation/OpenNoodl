/**
 * WFA-001 — the cloud-function export helper.
 *
 * The load-bearing assertion is the **partition**: `build/deployer.ts` ships
 * every component `isCloudFunctionComponent` rejects, and
 * `exportCloudFunctionsToJSON` ships every component it accepts. If those two
 * ever stop being complements, the failure is silent in both directions — a
 * cloud function shipped to the browser bundle, or a page never deployed. The
 * frontend filter's polarity is also easy to get backwards: it is a *keep*
 * predicate under the name `ignoreComponentFilter`.
 */

import { ComponentModel } from '../../src/editor/src/models/componentmodel';
import { NodeGraphModel } from '../../src/editor/src/models/nodegraphmodel';
import { ProjectModel } from '../../src/editor/src/models/projectmodel';
import {
  CLOUD_COMPONENT_PREFIX,
  cloudBundleName,
  exportCloudFunctionsToJSON,
  getCloudFunctionComponents,
  getCloudFunctionNames,
  hashCloudExport,
  isCloudFunctionComponent
} from '../../src/editor/src/utils/exporter/cloudFunctions';

function makeComponent(name: string): ComponentModel {
  return new ComponentModel({ name, graph: new NodeGraphModel(), id: name });
}

function makeProject(names: string[]): ProjectModel {
  const project = new ProjectModel();
  names.forEach((name) => project.addComponent(makeComponent(name)));
  return project;
}

const NAMES = [
  '/App',
  '/#__page__/Home',
  '/#Components/Button',
  `${CLOUD_COMPONENT_PREFIX}saveOrder`,
  `${CLOUD_COMPONENT_PREFIX}charge`,
  // A component whose name merely *contains* the marker must not be caught: the
  // prefix is anchored, and a browser component in a folder called
  // "#__cloud__" further down the tree is still a browser component.
  '/Utils/#__cloud__/notAFunction'
];

describe('WFA-001 cloud function export — partition with the frontend deploy', () => {
  it('assigns every component to exactly one of the two exports', () => {
    const project = makeProject(NAMES);
    const all = project.getComponents();

    const cloud = all.filter(isCloudFunctionComponent);
    // The exact predicate `build/deployer.ts` passes as ignoreComponentFilter.
    const browser = all.filter((component) => !isCloudFunctionComponent(component));

    // None in both.
    const cloudNames = new Set(cloud.map((c) => c.name));
    expect(browser.some((c) => cloudNames.has(c.name))).toBe(false);

    // None in neither.
    expect(cloud.length + browser.length).toBe(all.length);
  });

  it('keeps the cloud functions and only the cloud functions', () => {
    const project = makeProject(NAMES);
    expect(getCloudFunctionComponents(project).map((c) => c.name).sort()).toEqual([
      `${CLOUD_COMPONENT_PREFIX}charge`,
      `${CLOUD_COMPONENT_PREFIX}saveOrder`
    ]);
  });

  it('does not treat a nested folder called #__cloud__ as a cloud function', () => {
    expect(isCloudFunctionComponent(makeComponent('/Utils/#__cloud__/notAFunction'))).toBe(false);
    expect(isCloudFunctionComponent(makeComponent(`${CLOUD_COMPONENT_PREFIX}yes`))).toBe(true);
  });

  it('excludes the folder placeholders that make an empty cloud folder visible', () => {
    const project = makeProject([`${CLOUD_COMPONENT_PREFIX}orders/.placeholder`, `${CLOUD_COMPONENT_PREFIX}saveOrder`]);
    expect(getCloudFunctionNames(project)).toEqual(['saveOrder']);
  });

  it('names functions the way the backend addresses them', () => {
    const project = makeProject([`${CLOUD_COMPONENT_PREFIX}orders/save`, `${CLOUD_COMPONENT_PREFIX}charge`]);
    // POST /functions/<name> — the prefix is stripped, nesting is not.
    // ⚠️ That sentence was a promise the backend did not keep until DEF-045: `functions/:name`
    // matched one segment, so the RAW address of a nested function answered 404 (in-product
    // callers percent-encode and always worked). The route is `functions/*name` now, so both
    // addresses reach the same graph — see
    // `nodegx-backend/tests/def045-nested-function-address.test.ts`.
    expect(getCloudFunctionNames(project)).toEqual(['charge', 'orders/save']);
  });
});

describe('WFA-001 cloud export does not require a visual root', () => {
  /**
   * Found by running it. Both frontend exporters start from
   * `projectModel.getRootNode()` and return undefined without one, so a project
   * that has never had a Home component exported no bundle at all — the backend
   * came up with `functions: []` and nothing said why. A cloud function has no
   * visual root and does not need one.
   */
  it('exports functions from a project with no Home component', () => {
    const project = makeProject(['/App', `${CLOUD_COMPONENT_PREFIX}saveOrder`]);
    expect(project.getRootNode()).toBeFalsy();

    const bundle = exportCloudFunctionsToJSON(project);
    expect(bundle).toBeTruthy();
    expect((bundle.components as { name: string }[]).map((c) => c.name)).toEqual([
      `${CLOUD_COMPONENT_PREFIX}saveOrder`
    ]);
  });

  it('returns null only when there are genuinely no cloud functions', () => {
    expect(exportCloudFunctionsToJSON(makeProject(['/App']))).toBeNull();
  });
});

describe('WFA-001 cloud export change detection', () => {
  it('is stable for identical content and different for changed content', () => {
    const a = { components: [{ name: 'x', nodes: [] }] };
    const b = { components: [{ name: 'x', nodes: [] }] };
    const c = { components: [{ name: 'y', nodes: [] }] };

    expect(hashCloudExport(a)).toBe(hashCloudExport(b));
    expect(hashCloudExport(a)).not.toBe(hashCloudExport(c));
  });

  it('gives a project with no cloud functions a distinct, stable marker', () => {
    expect(hashCloudExport(null)).toBe('empty');
  });
});

describe('WFA-001 bundle naming', () => {
  it('separates two projects that share a name on one backend', () => {
    const a = new ProjectModel();
    a.name = 'Shop';
    a._retainedProjectDirectory = '/Users/x/projects/shop-a';

    const b = new ProjectModel();
    b.name = 'Shop';
    b._retainedProjectDirectory = '/Users/x/projects/shop-b';

    expect(cloudBundleName(a)).not.toBe(cloudBundleName(b));
  });

  it('is stable across opens of the same project directory', () => {
    const open1 = new ProjectModel();
    open1.name = 'Shop';
    open1._retainedProjectDirectory = '/Users/x/projects/shop';

    const open2 = new ProjectModel();
    open2.name = 'Shop';
    open2._retainedProjectDirectory = '/Users/x/projects/shop';

    expect(cloudBundleName(open1)).toBe(cloudBundleName(open2));
  });

  it('produces a file-name-safe string from an awkward project name', () => {
    const project = new ProjectModel();
    project.name = 'My App / v2 (beta)';
    project._retainedProjectDirectory = '/Users/x/projects/my-app';

    expect(cloudBundleName(project)).toMatch(/^[a-zA-Z0-9_-]+$/);
  });
});
