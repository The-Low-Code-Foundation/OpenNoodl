import { bugtracker } from '@noodl-utils/bugtracker';

import { IconSetDescriptor, toIconSets } from '../../../shared/utils/iconsets';
import { ModuleManifest, scanModuleManifests } from '../../../shared/utils/projectmodules';

// The scanner itself lives in shared/utils/projectmodules — one implementation
// shared with the preview/deploy HTML injector (this file used to be a second,
// parallel noodl_modules scanner; the `// TODO: Can we merge this ?` is resolved).
// These functions are the editor-ProjectModel-facing shaping layer on top of it.

export interface ProjectModule extends ModuleManifest {
  // The directory name is always filled in by readProjectModules, so name is
  // required here even though it is optional on the raw manifest.
  name: string;
}

export interface ProjectModuleManifest {
  name: string;
  manifest: ModuleManifest;
}

export async function listProjectModules(project: TSFixme /* ProjectModel */): Promise<ProjectModuleManifest[]> {
  const scanned = await scanModuleManifests(project._retainedProjectDirectory);

  // A hard-failed manifest (null) has already been warned about by the core scan;
  // surface the rest. Never a silent skip.
  return scanned
    .filter((s) => s.manifest !== null)
    .map((s) => ({ name: s.name, manifest: s.manifest as ModuleManifest }));
}

/**
 * The project's icon sets — NDA-007 §2.
 *
 * A third shaping layer on the one scanner, beside `listProjectModules` and `toInjectModules`,
 * rather than a second read of `noodl_modules`. The picker used to derive its sets from
 * `listModules` inline and font-shaped; `toIconSets` is where that lives now.
 */
export async function listProjectIconSets(project: TSFixme /* ProjectModel */): Promise<IconSetDescriptor[]> {
  return toIconSets(await scanModuleManifests(project._retainedProjectDirectory));
}

export async function readProjectModules(project: TSFixme /* ProjectModel */): Promise<ProjectModule[]> {
  bugtracker.debug('ProjectModel.readModules');

  project.modules = [];
  project.previews = [];
  project.componentAnnotations = {};

  const scanned = await scanModuleManifests(project._retainedProjectDirectory);

  for (const s of scanned) {
    const manifest = s.manifest;
    if (!manifest) continue; // hard failure — already warned by the core scan

    // The directory name is the module's identity, overriding any manifest.name.
    manifest.name = s.name;
    project.modules.push(manifest);

    if (manifest.componentAnnotations) {
      for (const comp in manifest.componentAnnotations) {
        const ca = manifest.componentAnnotations[comp];

        if (!project.componentAnnotations[comp]) project.componentAnnotations[comp] = {};
        for (const key in ca) project.componentAnnotations[comp][key] = ca[key];
      }
    }

    if (manifest.previews) {
      project.previews = (manifest.previews as unknown[]).concat(project.previews);
    }
  }

  console.log(`Loaded ${project.modules.length} modules`);

  return project.modules;
}
