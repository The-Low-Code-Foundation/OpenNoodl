import { ComponentModel } from '@noodl-models/componentmodel';
import { CloudServiceMetadataDataFormat, ProjectModel } from '@noodl-models/projectmodel';
import { getComponentIndex, removeBundlesFromIndex } from './bundler';
import { getRouterIndex } from './router';
import { exportComponent, exportSettings, exportVariant } from './util';

import { createHash } from './hash/xxhash64';
import { DeployEnvironment } from '@noodl-utils/compilation/build-context';

export type ExportToJSONOptions = {
  useBundles?: boolean;
  useBundleHashes?: boolean;

  environment?: DeployEnvironment | undefined;

  ignoreComponentFilter?: (component: ComponentModel) => boolean;
};

/**
 * Take the export's copy of the project metadata, with editor-only credentials removed.
 *
 * ## Why this exists
 *
 * `json.metadata` is a deep copy of the *whole* project metadata block, and only
 * `cloudservices` is overridden below. Everything else rides along verbatim — including
 * `backendServices`, which holds one entry per configured backend, each with an `auth`
 * object. `BackendServices/types.ts` says of one of its fields:
 *
 * > Admin token for schema introspection (editor-only).
 * > **This token is NOT published to the deployed app.**
 *
 * That was a promise nothing kept. The export JSON becomes `window.projectData` in the
 * deployed app, so the admin token of every backend the user ever configured was readable
 * from the browser console of the shipped site — measured, in a real browser, against a
 * real deploy bundle (BCN orchestrator pass, phase 34).
 *
 * ## What is stripped, and what deliberately is not
 *
 * Only `adminToken`. It has **zero** readers in `packages/noodl-runtime` — it exists for
 * schema introspection, which only the editor does — so removing it costs a deployed app
 * nothing.
 *
 * `publicToken` stays: the same file documents it as *"WILL be published"*, and it is what
 * `resolveBackend.ts::handleFor` hands the adapters as `handle.publicToken`. So do
 * `username`/`password`, because a backend configured for basic auth needs them at
 * runtime. Those are the user's declared choice and BCN-009's security disclosure is what
 * tells them so; a silent strip would break their app instead of informing them.
 */
function exportMetadata(project: ProjectModel | undefined): TSFixme {
  const metadata = project?.metadata ? JSON.parse(JSON.stringify(project.metadata)) : {};

  const backends = metadata?.backendServices?.backends;
  if (Array.isArray(backends)) {
    for (const backend of backends) {
      if (backend?.auth && 'adminToken' in backend.auth) delete backend.auth.adminToken;
    }
  }

  return metadata;
}

export function exportComponentsToJSON(
  projectModel: ProjectModel,
  components: ComponentModel[],
  args: ExportToJSONOptions
) {
  if (!projectModel) throw new Error('projectModel is null');

  const json: TSFixme = {};

  // Find visual root and the component that contains it
  const root = projectModel.getRootNode();
  if (!root) return;

  const rootComponent = root.owner.owner;
  const project = rootComponent.owner;
  json.settings = exportSettings(project);

  json.components = components.map((component) => exportComponent(component));
  json.componentIndex = {};

  // A copy, so it can be modified without affecting the original — and with the
  // editor-only credentials removed. See `exportMetadata`.
  json.metadata = exportMetadata(project);

  // Override the cloud services metadata
  if (args?.environment === null) {
    json.metadata['cloudservices'] = <CloudServiceMetadataDataFormat>{
      instanceId: undefined,
      endpoint: undefined,
      appId: undefined
    };
  } else if (args?.environment) {
    json.metadata['cloudservices'] = <CloudServiceMetadataDataFormat>{
      instanceId: args.environment.id,
      endpoint: args.environment.url,
      appId: args.environment.appId,
      type: args.environment.type,
      deployVersion: json.metadata['cloudfunctions']?.version
    };
  }

  return json;
}

export function exportToJSON(projectModel: ProjectModel, args?: ExportToJSONOptions) {
  if (!projectModel) throw new Error('projectModel is null');

  const json: TSFixme = {};

  let allComponents = projectModel.getComponents();

  if (args?.ignoreComponentFilter) {
    allComponents = allComponents.filter(args.ignoreComponentFilter);
  }

  // Find visual root and the component that contains it
  const root = projectModel.getRootNode();
  if (!root) return;

  const rootComponent = root.owner.owner;
  if (!rootComponent || !allComponents.find((c) => c.name === rootComponent.name)) {
    //the root component is not part of the project (probably got deleted)
    return;
  }

  const project = rootComponent.owner;
  json.settings = exportSettings(project);

  if (args?.useBundles === false) {
    json.components = allComponents.map((component) => exportComponent(component));
    json.componentIndex = {};
  } else {
    const componentIndex = getComponentIndex(rootComponent, allComponents);

    // to reduce initial load time, remove the root bundle
    // and export it, with dependencies, directly into the JSON
    // note: the first bundle always contain the root component

    //name of root bundle and all bundle dependencies
    const rootBundleNames = ['b0', ...componentIndex.b0.dependencies];

    //get all those bundles and extract the components from each
    const rootComponents = rootBundleNames.map((name) => componentIndex[name].components).flat();

    //remove bundles from the index since they're now "burnt" into the export and will
    //always be present
    removeBundlesFromIndex(componentIndex, rootBundleNames);

    json.components = rootComponents.map((name) => exportComponent(allComponents.find((c) => c.name === name)));
    json.componentIndex = args?.useBundleHashes
      ? createIndexWithHashedNames(componentIndex, allComponents)
      : componentIndex;
  }

  json.routerIndex = getRouterIndex(allComponents);

  json.rootComponent = rootComponent.name;
  json.rootNode = root.id;

  // A copy, so it can be modified without affecting the original — and with the
  // editor-only credentials removed. See `exportMetadata`.
  json.metadata = exportMetadata(project);

  // Override the cloud services metadata
  if (args?.environment === null) {
    json.metadata['cloudservices'] = <CloudServiceMetadataDataFormat>{
      instanceId: undefined,
      endpoint: undefined,
      appId: undefined
    };
  } else if (args?.environment) {
    json.metadata['cloudservices'] = <CloudServiceMetadataDataFormat>{
      instanceId: args.environment.id,
      endpoint: args.environment.url,
      appId: args.environment.appId,
      type: args.environment.type,
      deployVersion: json.metadata['cloudfunctions']?.version
    };
  }

  json.variants = projectModel.variants.map((v) => exportVariant(v));

  return json;
}

export function exportComponentBundle(project: ProjectModel, id: TSFixme, componentIndex: TSFixme) {
  const allComponents = project.getComponents();
  return componentIndex[id].components.map((name) => exportComponent(allComponents.find((c) => c.name === name)));
}

//calculate new names for the bundles based on the contents of them so we get new file names everytime the contents change to avoid browser caching issues
function createIndexWithHashedNames(componentIndex, allComponents: ComponentModel[]) {
  const oldToNewNames = new Map<string, string>();

  const allComponentsExported = allComponents.map((component) => exportComponent(component));

  for (const name of Object.keys(componentIndex)) {
    const bundle = componentIndex[name];

    const components = bundle.components
      .map((componentName) => allComponentsExported.find((c) => c.name === componentName))
      .filter((c) => !!c);

    const hash = createHash();
    hash.update(JSON.stringify(components), 'utf8');
    const hex = hash.digest('hex');
    const newName = name + '-' + hex;

    oldToNewNames.set(name, newName);
  }

  const newComponentIndex = {};
  for (const name of Object.keys(componentIndex)) {
    const bundle = JSON.parse(JSON.stringify(componentIndex[name]));
    bundle.dependencies = bundle.dependencies.map((d) => oldToNewNames.get(d));
    newComponentIndex[oldToNewNames.get(name)] = bundle;
  }

  return newComponentIndex;
}
