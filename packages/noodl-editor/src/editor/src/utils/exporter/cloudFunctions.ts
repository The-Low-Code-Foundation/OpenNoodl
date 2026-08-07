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
import { ProjectModel } from '@noodl-models/projectmodel';

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
export function exportCloudFunctionsToJSON(project: ProjectModel): Record<string, unknown> | null {
  const components = getCloudFunctionComponents(project);
  if (components.length === 0) return null;

  return {
    components: components.map((component) => exportComponent(component)),
    // No `componentIndex`: `useBundles: false` is the only sensible mode here
    // and `GraphModel.importEditorData` treats a missing index as empty.
    settings: exportSettings(project),
    metadata: project.metadata ? JSON.parse(JSON.stringify(project.metadata)) : {}
  };
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
