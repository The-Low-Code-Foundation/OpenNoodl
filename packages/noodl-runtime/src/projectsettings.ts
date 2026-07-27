'use strict';

import type { InputPortDefinition } from '@noodl/types';

/**
 * These stay module-local rather than exported: `export =` carries exactly one thing, and
 * every consumer of this module is plain JavaScript (NOTES §27.1).
 */

/** One entry in a project's module list, as the editor sends it. */
interface ProjectModule {
  /** Ports this module contributes to the project-settings panel. */
  settings?: InputPortDefinition[];
  [extra: string]: unknown;
}

/**
 * The port set the editor renders as the project's settings panel.
 *
 * `dynamicports` is always empty — no module has ever contributed one — but the editor's
 * port reader expects the field, so it is emitted rather than omitted.
 */
interface ProjectSettingsPorts {
  dynamicports: unknown[];
  ports: InputPortDefinition[];
}

function addModuleSettings(result: ProjectSettingsPorts, modules: ProjectModule[]): void {
  // Add module settings
  for (let i = 0; i < modules.length; i++) {
    const m = modules[i];
    if (m.settings) {
      m.settings.forEach(function (p) {
        result.ports.push(p);
      });
    }
  }
}

/**
 * `projectSettings` is declared and never read: the panel's *values* come from elsewhere,
 * and this only builds the port list. Kept in the signature because `noodl-runtime.js`
 * passes it positionally.
 */
function generateProjectSettings(projectSettings: unknown, modules: ProjectModule[]): ProjectSettingsPorts {
  const result: ProjectSettingsPorts = {
    dynamicports: [],
    ports: []
  };

  addModuleSettings(result, modules);

  return result;
}

export = {
  generateProjectSettings: generateProjectSettings
};
