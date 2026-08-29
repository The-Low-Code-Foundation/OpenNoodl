/**
 * DEF-015 — the backend card called three working components undeployed.
 *
 * After a successful `Deploy functions` on a freshly created site-builder
 * project, three of its seven cloud components carried a warning triangle and
 * the words "in the project, not on this backend". They are helpers: no Request
 * node, so no route, so nothing for the backend to serve and nothing to be
 * absent from. The card was diffing a **prefix**-derived expected set against
 * the backend's **Request-node**-derived serving set, so the difference between
 * the two predicates was reported as a fault, permanently, on a healthy system.
 *
 * 🔴 **The load-bearing assertion is the parity**, not the count. `nodegx-backend`
 * decides what it serves with `declaredFunctionsIn` over the exported bundle
 * (`workflow/functionDeclarations.ts`), and the editor now decides what to expect
 * with `classifyCloudComponents` over the ComponentModels. Those are two readers
 * of one rule — the failure mode that module's own header warns about — so this
 * spec runs the backend's rule over the real export of the real shipped template
 * and requires the two to name the same set. A spec that only counted "4 and 3"
 * would pass on a classifier that had quietly stopped agreeing with the backend.
 *
 * ⚠️ The task file said the three warned components "are the `taskTemplate` of a
 * `RunTasks` node". Measured against the artefact, that is true of two of them:
 * `site/ContactRecipient` is a component **instance** placed at the root of
 * `submitContactForm`. A classifier written from that sentence would still have
 * warned about one of the three, which is why reachability here counts placed
 * instances and named parameters alike.
 */

import { ComponentModel } from '../../src/editor/src/models/componentmodel';
import { NodeGraphModel } from '../../src/editor/src/models/nodegraphmodel';
import { ProjectModel } from '../../src/editor/src/models/projectmodel';

import siteBuilderContent from '../../src/editor/src/models/template/templates/site-builder.content.json';
import {
  CLOUD_COMPONENT_PREFIX,
  CLOUD_REQUEST_NODE_TYPE,
  classifyCloudComponents,
  declaresCloudEndpoint,
  exportCloudFunctionsToJSON,
  getCloudEndpointNames,
  getCloudFunctionNames
} from '../../src/editor/src/utils/exporter/cloudFunctions';

/**
 * `nodegx-backend`'s rule, spelled out rather than imported.
 *
 * `functionDeclarations.ts` reaches `fs`/`path` at module scope and this suite
 * runs in a renderer bundle, so the import is not available here. Spelling it
 * means this copy could drift from the original — so it is spelled to *look*
 * like the original and is used only as the independent side of a parity
 * assertion: if the editor's answer and this answer ever differ, one of them is
 * wrong and the test says which components they disagree about by name.
 */
const REQUEST_NODE_TYPE = 'noodl.cloud.request';

function findRequestNode(nodes: TSFixme[]): TSFixme | null {
  for (const node of nodes || []) {
    if (node.type === REQUEST_NODE_TYPE) return node;
    if (Array.isArray(node.children)) {
      const found = findRequestNode(node.children);
      if (found) return found;
    }
  }
  return null;
}

/** What the backend would serve, given the bundle the editor pushes. */
function backendWouldServe(bundle: TSFixme): string[] {
  return ((bundle?.components as TSFixme[]) || [])
    .filter((c) => typeof c?.name === 'string' && c.name.startsWith(CLOUD_COMPONENT_PREFIX))
    .filter((c) => findRequestNode(c.nodes || []) !== null)
    .map((c) => c.name.slice(CLOUD_COMPONENT_PREFIX.length))
    .sort();
}

function node(type: string, id: string, parameters: Record<string, unknown> = {}) {
  return { id, type, parameters };
}

function component(name: string, roots: TSFixme[]): ComponentModel {
  return new ComponentModel({ name, graph: NodeGraphModel.fromJSON({ roots }), id: name });
}

function projectOf(components: ComponentModel[]): ProjectModel {
  const project = new ProjectModel();
  components.forEach((c) => project.addComponent(c));
  return project;
}

const rolesOf = (project: ProjectModel) =>
  classifyCloudComponents(project).reduce<Record<string, string>>((acc, c) => {
    acc[c.name] = c.role;
    return acc;
  }, {});

describe('DEF-015: the shipped site-builder template', () => {
  let project: ProjectModel;

  beforeEach(() => {
    project = ProjectModel.fromJSON(JSON.parse(JSON.stringify(siteBuilderContent)));
  });

  it('classifies its seven cloud components as four endpoints and three workers', () => {
    expect(rolesOf(project)).toEqual({
      claimSite: 'endpoint',
      duplicatePage: 'endpoint',
      publishPage: 'endpoint',
      submitContactForm: 'endpoint',
      'site/ContactRecipient': 'worker',
      'site/CopySectionToPage': 'worker',
      'site/SetSectionAccess': 'worker'
    });
  });

  it('reaches a worker that is placed as an instance, not only ones named by a taskTemplate', () => {
    // The task file's own §2 got this wrong for one of the three. `SetSectionAccess`
    // and `CopySectionToPage` are `RunTasks` templates; `ContactRecipient` is a
    // component instance at the root of `submitContactForm`. A reachability rule
    // that knew only about `taskTemplate` would still warn about it.
    const contactRecipient = project.getComponentWithName(`${CLOUD_COMPONENT_PREFIX}site/ContactRecipient`);
    const submitContactForm = project.getComponentWithName(`${CLOUD_COMPONENT_PREFIX}submitContactForm`);

    const placedTypes: string[] = [];
    submitContactForm.forEachNode((n: TSFixme) => {
      placedTypes.push(n.typename);
    });

    expect(placedTypes).toContain(contactRecipient.name);
    expect(placedTypes).not.toContain('RunTasks');
    expect(rolesOf(project)['site/ContactRecipient']).toBe('worker');
  });

  it('expects exactly what the backend would serve — the defect, stated as a diff', () => {
    const bundle = exportCloudFunctionsToJSON(project);
    const serving = backendWouldServe(bundle);
    const expected = getCloudEndpointNames(project);

    // AC1's assertion, computed rather than driven: nothing the editor expects
    // is absent from what the backend serves, so the card has nothing to warn
    // about on a healthy, fully deployed project.
    expect(expected.filter((name) => !serving.includes(name))).toEqual([]);
    expect(serving.filter((name) => !expected.includes(name))).toEqual([]);
    expect(expected).toEqual(serving);
  });

  it('still ships every cloud component in the bundle, helpers included', () => {
    // The fix narrows what is *expected on the backend*, and must not narrow
    // what is *deployed* — a worker that stopped shipping would break the
    // endpoints that run it, and `publishPage` returning 200 is what proves
    // `SetSectionAccess` is present.
    const bundle = exportCloudFunctionsToJSON(project);
    expect((bundle.components as TSFixme[]).length).toBe(getCloudFunctionNames(project).length);
    expect(getCloudFunctionNames(project).length).toBe(7);
    expect(getCloudEndpointNames(project).length).toBe(4);
  });
});

describe('DEF-015: the classification is total', () => {
  it('reports a component it has no rule for rather than absorbing it', () => {
    // AC3. Three populations plus the one the rule does not recognise: a cloud
    // component with no Request node that nothing names. It is neither an
    // endpoint nor a worker, and folding it into either would hide it — silently
    // "fine" if a worker, falsely "missing" if an endpoint.
    const project = projectOf([
      component(`${CLOUD_COMPONENT_PREFIX}publishPage`, [
        node(CLOUD_REQUEST_NODE_TYPE, 'req'),
        node('RunTasks', 'tasks', { taskTemplate: `${CLOUD_COMPONENT_PREFIX}setAccess` })
      ]),
      component(`${CLOUD_COMPONENT_PREFIX}setAccess`, [node('DbModel2', 'model')]),
      component(`${CLOUD_COMPONENT_PREFIX}orphan`, [node('DbModel2', 'model')])
    ]);

    expect(rolesOf(project)).toEqual({
      publishPage: 'endpoint',
      setAccess: 'worker',
      orphan: 'unreachable'
    });
  });

  it('does not call a helper reachable only from another orphan a worker', () => {
    // Reachability starts at endpoints, so a pair that names only each other is
    // dead in both directions. A "does anything name it?" count would call both
    // of these workers and say nothing was wrong.
    const project = projectOf([
      component(`${CLOUD_COMPONENT_PREFIX}live`, [node(CLOUD_REQUEST_NODE_TYPE, 'req')]),
      component(`${CLOUD_COMPONENT_PREFIX}a`, [node('RunTasks', 't', { taskTemplate: `${CLOUD_COMPONENT_PREFIX}b` })]),
      component(`${CLOUD_COMPONENT_PREFIX}b`, [node('RunTasks', 't', { taskTemplate: `${CLOUD_COMPONENT_PREFIX}a` })])
    ]);

    expect(rolesOf(project)).toEqual({ live: 'endpoint', a: 'unreachable', b: 'unreachable' });
  });

  it('follows a worker chain transitively', () => {
    const project = projectOf([
      component(`${CLOUD_COMPONENT_PREFIX}entry`, [
        node(CLOUD_REQUEST_NODE_TYPE, 'req'),
        node('RunTasks', 't', { taskTemplate: `${CLOUD_COMPONENT_PREFIX}first` })
      ]),
      component(`${CLOUD_COMPONENT_PREFIX}first`, [
        node('RunTasks', 't', { taskTemplate: `${CLOUD_COMPONENT_PREFIX}second` })
      ]),
      component(`${CLOUD_COMPONENT_PREFIX}second`, [node('DbModel2', 'm')])
    ]);

    expect(rolesOf(project)).toEqual({ entry: 'endpoint', first: 'worker', second: 'worker' });
  });

  it('counts a reference stored as a bare name, the way CloudFunctionAdapter writes one', () => {
    // `CloudFunctionAdapter` stores `function` without the prefix and rebuilds it
    // as `'/#__cloud__/' + parameters.function`. A rule that matched only the
    // prefixed form would call this helper unreachable.
    const project = projectOf([
      component(`${CLOUD_COMPONENT_PREFIX}entry`, [
        node(CLOUD_REQUEST_NODE_TYPE, 'req'),
        node('CloudFunction2', 'call', { function: 'helper' })
      ]),
      component(`${CLOUD_COMPONENT_PREFIX}helper`, [node('DbModel2', 'm')])
    ]);

    expect(rolesOf(project)).toEqual({ entry: 'endpoint', helper: 'worker' });
  });
});

describe('DEF-015: the rule is the node, not the folder', () => {
  it('calls a site/-prefixed component with a Request node an endpoint', () => {
    // AC4's mutant target. The three helpers in today's template all sit in a
    // `site/` folder, so classifying on the path passes the drive and is not the
    // property. Here the folder and the content disagree in both directions.
    const project = projectOf([
      component(`${CLOUD_COMPONENT_PREFIX}site/publish`, [node(CLOUD_REQUEST_NODE_TYPE, 'req')]),
      component(`${CLOUD_COMPONENT_PREFIX}topLevelHelper`, [node('DbModel2', 'm')]),
      component(`${CLOUD_COMPONENT_PREFIX}site/entry`, [
        node(CLOUD_REQUEST_NODE_TYPE, 'req'),
        node('RunTasks', 't', { taskTemplate: `${CLOUD_COMPONENT_PREFIX}topLevelHelper` })
      ])
    ]);

    expect(rolesOf(project)).toEqual({
      'site/publish': 'endpoint',
      'site/entry': 'endpoint',
      topLevelHelper: 'worker'
    });
    expect(getCloudEndpointNames(project)).toEqual(['site/entry', 'site/publish']);
  });

  it('does not make a caller an endpoint by looking inside the component it places', () => {
    // The boundary the backend draws: `findRequestNode` walks the exported
    // component's own node tree, and an instance's inner nodes are not inlined
    // into it. `getNodesWithTypeRecursive` would cross that line and call every
    // caller of a Request-node-holding helper an endpoint too.
    const helper = component(`${CLOUD_COMPONENT_PREFIX}inner`, [node(CLOUD_REQUEST_NODE_TYPE, 'req')]);
    const caller = component(`${CLOUD_COMPONENT_PREFIX}outer`, [node(helper.name, 'placed')]);

    expect(declaresCloudEndpoint(caller)).toBe(false);
    expect(declaresCloudEndpoint(helper)).toBe(true);
  });

  it('answers without the node library having resolved a single type', () => {
    // The card reads this at times when the cloud library may not be loaded, so
    // the predicate reads `node.typename` rather than `node.type.name`. Every
    // synthetic project in this file is built without loading a library; this
    // states the property that makes that legitimate rather than lucky.
    const c = component(`${CLOUD_COMPONENT_PREFIX}fn`, [node(CLOUD_REQUEST_NODE_TYPE, 'req')]);
    const nodes: TSFixme[] = [];
    c.forEachNode((n: TSFixme) => {
      nodes.push(n);
    });
    expect(nodes[0].typename).toBe(CLOUD_REQUEST_NODE_TYPE);
    expect(declaresCloudEndpoint(c)).toBe(true);
  });
});
