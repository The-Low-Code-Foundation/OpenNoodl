/**
 * WFA-001 — the cloud-function half of the export.
 *
 * The frontend deployer ships everything that is **not** a cloud function
 * (`build/deployer.ts`); this ships exactly the cloud functions, in the bundle
 * shape `nodegx-backend`'s `WorkflowRunner` loads. The two are complements of
 * one predicate — `isCloudFunctionComponent` — so no component can fall into
 * both or neither. `cloudFunctions.test.ts` asserts that partition.
 *
 * @module noodl-editor/utils/exporter/cloudFunctions
 */

import { ComponentModel } from '@noodl-models/componentmodel';
import { scriptPortsForNode } from '@noodl-models/nodelibrary/cloudDynamicPorts';
import { ProjectModel } from '@noodl-models/projectmodel';

import { readCloudModuleSources } from '../../../../shared/utils/projectmodules';

import { exportComponent, exportSettings } from './util';

/** Path prefix that makes a component a cloud function. */
export const CLOUD_COMPONENT_PREFIX = '/#__cloud__/';

/**
 * The one predicate. `build/deployer.ts` passes its negation as
 * `ignoreComponentFilter` (a *keep* predicate under an *ignore* name — read
 * `exportToJSON` before assuming the polarity).
 */
export function isCloudFunctionComponent(component: ComponentModel): boolean {
  return component.name.startsWith(CLOUD_COMPONENT_PREFIX);
}

/** The cloud function components of a project, placeholders excluded. */
export function getCloudFunctionComponents(project: ProjectModel): ComponentModel[] {
  return project
    .getComponents()
    .filter(isCloudFunctionComponent)
    .filter((c) => !c.name.endsWith('/.placeholder'));
}

/** Function names as the backend addresses them: `POST /functions/<name>`. */
export function getCloudFunctionNames(project: ProjectModel): string[] {
  return getCloudFunctionComponents(project)
    .map((c) => c.name.substring(CLOUD_COMPONENT_PREFIX.length))
    .sort();
}

/**
 * DEF-015 — the node type that makes a cloud component an HTTP endpoint.
 *
 * 🔴 **Spelled here because the editor had no copy of this rule at all, and that
 * absence was the defect.** `nodegx-backend` has decided since SB-003 that a
 * `/#__cloud__/` component *without* a Request node is a helper and serves no
 * route (`workflow/functionDeclarations.ts`, whose own header warns that "two
 * readers of one predicate is how a gate starts disagreeing with the thing it
 * gates"). The editor's `getCloudFunctionNames` applied only the *prefix* half,
 * so the Backend Services card compared a prefix-derived "expected" set against
 * the backend's Request-node-derived "serving" set and reported every helper in
 * every project as missing, forever. `def015-cloud-component-roles.test.ts`
 * asserts the two agree over the real shipped template rather than trusting it.
 */
export const CLOUD_REQUEST_NODE_TYPE = 'noodl.cloud.request';

/**
 * What a `/#__cloud__/` component is *for*, which is what decides whether the
 * backend not serving it is news.
 *
 * - `endpoint` — its graph holds a Request node. The backend serves it by name,
 *   so its absence from `GET /admin/workflows` is a real, reportable failure.
 * - `worker` — no Request node, but some endpoint reaches it: as a placed
 *   component instance, or by name through a parameter (a `RunTasks`
 *   `taskTemplate`, a Function node's `function`). It runs in-process, has no
 *   route, and must never be reported missing.
 * - `unreachable` — neither. Nothing can start it, over HTTP or otherwise. This
 *   is the bucket that keeps the classification **total**: a reference
 *   mechanism this does not know about surfaces a worker here, visibly, instead
 *   of being absorbed into one of the other two.
 */
export type CloudComponentRole = 'endpoint' | 'worker' | 'unreachable';

export interface CloudComponentClassification {
  /** The name an HTTP caller uses — the component name minus the prefix. */
  name: string;
  /** The full component name, `/#__cloud__/<name>`. */
  componentName: string;
  role: CloudComponentRole;
}

/**
 * Every node in a component's **own** graph — its roots and their children, and
 * deliberately not the graphs of components it places.
 *
 * That boundary is not a detail: it is the one the backend draws. `findRequestNode`
 * walks the exported component's `nodes`/`children` tree, and an instance's inner
 * nodes are not inlined into it, so a helper holding a Request node must not make
 * its *caller* an endpoint. `getNodesWithTypeRecursive` would cross that line.
 *
 * 🔴 `forEachNode` stops on a truthy return, so the callback returns nothing.
 */
function ownNodes(component: ComponentModel): TSFixme[] {
  const nodes: TSFixme[] = [];
  component.forEachNode((node) => {
    nodes.push(node);
  });
  return nodes;
}

/**
 * Does this component declare an HTTP endpoint?
 *
 * Reads `node.typename` — the raw string the artefact carries — rather than
 * `node.type.name`, which resolves through the `NodeLibrary` singleton. The card
 * asks this question at times when the cloud library may not be the one loaded,
 * and a predicate that answers differently depending on a singleton is the kind
 * that passes its spec and fails in the app.
 */
export function declaresCloudEndpoint(component: ComponentModel): boolean {
  return ownNodes(component).some((node) => node.typename === CLOUD_REQUEST_NODE_TYPE);
}

/**
 * The cloud components each cloud component names — by placing one as an
 * instance, or by naming one in a parameter value.
 *
 * ⚠️ **No list of node types and no list of parameter names.** DEF-015 §5: an
 * exclusion list cannot fail, and neither can an inclusion list that is allowed
 * to be the whole rule. A value counts as a reference when it *is* a cloud
 * component's name — prefixed or bare, since `CloudFunctionAdapter` stores the
 * bare form in its `function` parameter — so a new way of naming a helper is
 * picked up without this function learning about it. A mechanism that stores a
 * reference some other way makes its target `unreachable`, which is visible.
 *
 * Self-references are not counted: "nothing else names this" is the question.
 */
function referencesByComponent(components: ComponentModel[]): Map<string, Set<string>> {
  const byFullName = new Map<string, string>();
  for (const component of components) {
    byFullName.set(component.name, component.name);
    byFullName.set(component.name.substring(CLOUD_COMPONENT_PREFIX.length), component.name);
  }

  const edges = new Map<string, Set<string>>();
  for (const component of components) {
    const targets = new Set<string>();
    const note = (value: unknown) => {
      if (typeof value !== 'string' || value.length === 0) return;
      const target = byFullName.get(value);
      if (target && target !== component.name) targets.add(target);
    };

    for (const node of ownNodes(component)) {
      note(node.typename);
      Object.values(node.parameters || {}).forEach(note);
    }
    edges.set(component.name, targets);
  }
  return edges;
}

/**
 * Every cloud component in the project, with the role that decides what the
 * Backend Services card should say about it.
 *
 * Reachability is transitive: a worker a worker calls is still a worker. The
 * walk starts only from endpoints, so two helpers that name each other and
 * nothing else are `unreachable` — which is true of them, and is exactly what a
 * count of "nothing names it" would get wrong.
 */
export function classifyCloudComponents(project: ProjectModel): CloudComponentClassification[] {
  const components = getCloudFunctionComponents(project);
  const endpoints = components.filter(declaresCloudEndpoint);
  const edges = referencesByComponent(components);

  const reachable = new Set<string>();
  const queue = endpoints.map((c) => c.name);
  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const target of edges.get(current) || []) {
      if (reachable.has(target)) continue;
      reachable.add(target);
      queue.push(target);
    }
  }

  const isEndpoint = new Set(endpoints.map((c) => c.name));
  return components
    .map((component) => ({
      name: component.name.substring(CLOUD_COMPONENT_PREFIX.length),
      componentName: component.name,
      role: (isEndpoint.has(component.name)
        ? 'endpoint'
        : reachable.has(component.name)
          ? 'worker'
          : 'unreachable') as CloudComponentRole
    }))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

/**
 * The names the backend will serve as routes — the set the card may compare
 * against `GET /admin/workflows` and warn about.
 *
 * Not `getCloudFunctionNames`: that one answers "what ships in the bundle",
 * which is every cloud component including the helpers, and is still the right
 * answer for the export and its failure message.
 */
export function getCloudEndpointNames(project: ProjectModel): string[] {
  return classifyCloudComponents(project)
    .filter((c) => c.role === 'endpoint')
    .map((c) => c.name);
}

/**
 * Build the bundle to push to a backend, or `null` when the project has no
 * cloud functions.
 *
 * **Neither `exportToJSON` nor `exportComponentsToJSON`**, and both for the same
 * underlying reason: they are frontend exporters that resolve the project
 * through its *visual root*.
 *
 * - `exportToJSON` bails when the root component does not survive the filter
 *   (`json.ts:80`). The root is a browser component, so the obvious
 *   `exportToJSON(project, { ignoreComponentFilter: isCloudFunctionComponent })`
 *   returns `undefined`.
 * - `exportComponentsToJSON` takes the component list explicitly, but still
 *   starts `const root = projectModel.getRootNode(); if (!root) return;` — so a
 *   project with **no Home component** exports nothing. Found by running it: a
 *   project that had never had a Home silently produced no bundle, and the
 *   backend came up with `functions: []` while the editor believed it had
 *   nothing to send. A cloud function has no visual root and does not need one;
 *   requiring a Home component before a backend function can deploy is not a
 *   rule this product has.
 *
 * So the bundle is assembled from the same two primitives those functions use.
 * The result is `{components, settings, metadata}` — the shape proven live on
 * 2026-07-27 and the shape `CloudRunner.load` consumes (it applies its own
 * cloud-only `componentFilter` on the way in, `noodl-viewer-cloud/src/index.ts:31`).
 */
/**
 * D14 — the backstop that makes a cloud bundle a function of the project.
 *
 * `exportPorts` (`util.ts:16`) exports a Function node's ports from the *editor
 * session*: `node.getPorts()` returns what `CloudScriptPortsAdapter` derived,
 * and the adapter runs on project load and on edits. A deploy taken before that
 * sweep has landed — or in an editor whose node library had not resolved
 * `JavaScriptFunction`, which makes `node.type.exportDynamicPorts` falsy and
 * drops every dynamic port — ships `ports: []`.
 *
 * 🔴 That bundle is dead, and dead silently. A deployed node's `outputPorts`
 * come only from `nodeData.ports` (`nodemodel.ts:255`) — there is no editor to
 * send them — and `_isSignalType` (`simplejavascript.ts:635`) reads exactly that
 * map. No port, no callable, so `Outputs.ready()` in a script that has always
 * been correct throws `Outputs.ready is not a function` at the first node of the
 * function. Measured on 2026-08-29: `SBR-017 Sign In Drive` deployed at 15:48
 * with `ports: []` on all 11 Function nodes and every connection intact, and
 * `publishPage` and `duplicatePage` answered HTTP 400 in under 60 ms.
 *
 * ⚠️ **This does not replace the adapter, and is not the export-time derivation
 * Richard's SB-017 ruling rejected.** That ruling was about where the canvas
 * gets its ports — deriving them only at export left a freshly installed project
 * showing 84 red warnings, so the adapter still owns the editor. This is the
 * second half of the same answer: the adapter decides what the author sees, and
 * this decides that what ships can run. It only ever *adds* a port the script
 * itself declares, so in a session where the adapter has run it changes nothing.
 */
function withScriptPorts(node: TSFixme): TSFixme {
  if (node.type === 'JavaScriptFunction') {
    const ports = node.ports ?? [];
    const have = new Set(ports.map((p: TSFixme) => p.plug + '\u0000' + p.name));

    for (const port of scriptPortsForNode(node)) {
      const key = port.plug + '\u0000' + port.name;
      if (have.has(key)) continue;
      have.add(key);
      ports.push({ ...port, index: ports.length });
    }

    node.ports = ports;
  }

  (node.children ?? []).forEach(withScriptPorts);
  return node;
}

export function exportCloudFunctionsToJSON(project: ProjectModel): Record<string, unknown> | null {
  const components = getCloudFunctionComponents(project);
  if (components.length === 0) return null;

  return {
    components: components.map((component) => {
      const exported = exportComponent(component);
      exported.nodes.forEach(withScriptPorts);
      return exported;
    }),
    // No `componentIndex`: `useBundles: false` is the only sensible mode here
    // and `GraphModel.importEditorData` treats a missing index as empty.
    settings: exportSettings(project),
    metadata: project.metadata ? JSON.parse(JSON.stringify(project.metadata)) : {}
  };
}

/**
 * The bundle, plus the project's kits (CN-013 / D18).
 *
 * Separate from {@link exportCloudFunctionsToJSON} and async because it reads files: the sync
 * function stays the pure graph half that `cloudFunctions.test.ts` partitions against
 * `build/deployer.ts`, and this is the one the deployer actually pushes.
 *
 * 🔴 **Only cloud-enabled kits ship their source.** `readCloudModuleSources` applies
 * `moduleRunsInCloud` — `runtimes` including `"cloud"` — and returns everything else with
 * `source: null`. Two reasons, and the second is the one that is easy to lose:
 *
 * 1. A kit is third-party code, and D18 explicitly does **not** re-open D6 — "every kit in the
 *    project is evaluated in the backend unless it objects" is not a default this phase gets to
 *    set on an author's behalf. Reaching the cloud is opt-in.
 * 2. The names of the kits that did **not** opt in still travel, without their source. That is
 *    what lets the runtime answer *"that kit exists and is not cloud-enabled"* rather than
 *    nothing at all, which is the difference between a 504 an author can act on and the hang
 *    CN-012 measured.
 *
 * ⚠️ It is included in {@link hashCloudExport}'s input by construction — the hash is taken of
 * whatever this returns — so **editing a kit re-pushes the bundle**. Without that, a kit fix would
 * sit on disk while the backend went on running the previous copy, which is CN-014's "a stale
 * module that still works is the worst outcome" wearing a deployment hat.
 */
export async function exportCloudFunctionsWithKits(project: ProjectModel): Promise<Record<string, unknown> | null> {
  const bundle = exportCloudFunctionsToJSON(project);
  if (!bundle) return null;

  try {
    const modules = await readCloudModuleSources(project._retainedProjectDirectory);
    if (modules.length) bundle.modules = modules;
  } catch (e) {
    // A kit scan that fails must not stop the functions deploying — they may not use a kit at
    // all. Loud, never silent: this file's own standing promise, and the runtime will report the
    // missing types anyway.
    // eslint-disable-next-line no-console
    console.error('[cloudFunctions] could not read the project kits for the cloud bundle', e);
  }

  return bundle;
}

/**
 * A stable fingerprint of the pushed bundle.
 *
 * The push happens on every project save, and a save fires ~1s after *any*
 * model change — so without this, editing a browser component would redeploy
 * every function in the project. Content-based rather than time-based so an
 * edit-and-undo is correctly a no-op.
 */
export function hashCloudExport(exportJson: Record<string, unknown> | null): string {
  if (!exportJson) return 'empty';
  const serialised = JSON.stringify(exportJson);
  // FNV-1a. Not cryptographic — this only has to distinguish two graphs the
  // same user produced seconds apart.
  let hash = 0x811c9dc5;
  for (let i = 0; i < serialised.length; i++) {
    hash ^= serialised.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16) + '-' + serialised.length;
}

/**
 * The workflow-bundle file name for a project: `<name>.workflow.json` in the
 * backend's `workflows/` directory.
 *
 * One bundle per project, because `WorkflowRunner` keys by file name and
 * replaces wholesale — so a re-push without a component is what removes it, and
 * no `deleteWorkflow` call is needed.
 *
 * Keyed on the project **directory**, not `ProjectModel.id`: that field is not
 * in `toJSON()`, so it is regenerated on every open. One backend can serve more
 * than one project, so a constant name would let two projects clobber each
 * other's functions.
 */
export function cloudBundleName(project: ProjectModel): string {
  const directory = project._retainedProjectDirectory || '';
  const safeName = (project.name || 'project').replace(/[^a-zA-Z0-9_-]/g, '-').replace(/^-+|-+$/g, '') || 'project';

  if (!directory) return safeName;

  // FNV-1a again; 8 hex chars is plenty to separate the handful of project
  // folders one backend ever sees, and it keeps the file name readable.
  let hash = 0x811c9dc5;
  for (let i = 0; i < directory.length; i++) {
    hash ^= directory.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${safeName}-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}
