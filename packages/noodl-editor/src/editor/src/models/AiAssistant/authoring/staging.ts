/**
 * AIX-002 — The Authoring Loop: staging
 *
 * The bridge from a staged candidate to the live project — crossed only on
 * accept. Everything before this point is plain data: the session authors in
 * memory, the outcome carries `ComponentFiles`, and nothing has touched the
 * project. So "reject leaves no trace" is not implemented here — it is the
 * absence of a call to this module. Accept converts the staged v2 files
 * through the same `reconstructLegacyComponent` path the project loader uses
 * and adds the component with an undo group, so an accepted AI change is
 * undoable exactly like any hand-made edit.
 *
 * @module AiAssistant/authoring/staging
 */

import { legacyNameToPath } from '../../../io/ProjectExporter';
import { reconstructLegacyComponent, toLegacyName } from '../../../io/ProjectImporter';
import { ComponentModel } from '../../componentmodel';
import type { ProjectModel } from '../../projectmodel';
import type { ComponentFiles } from './types';

/** Thrown when accept cannot proceed; the project is untouched. */
export class StagingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StagingError';
  }
}

export interface AcceptOptions {
  /** Undo stack label; defaults to naming the component. */
  label?: string;
}

/**
 * Accept a staged candidate into the live project, undoably.
 *
 * Returns the added `ComponentModel`. Throws `StagingError` — without touching
 * the project — when the component's name is already taken, which can happen
 * when the project changed between authoring and accept (the session checks
 * the same thing at creation).
 */
export function acceptAuthoredComponent(
  project: ProjectModel,
  files: ComponentFiles,
  options: AcceptOptions = {}
): ComponentModel {
  const registryPath = legacyNameToPath(files.component.path ?? files.component.name);
  const legacyName = toLegacyName(files.component, registryPath);

  if (project.getComponentWithName(legacyName)) {
    throw new StagingError(
      `Component "${legacyName}" already exists in the project — it was created after authoring started.`
    );
  }

  const legacy = reconstructLegacyComponent(registryPath, files.component, files.nodes, files.connections);
  const component = ComponentModel.fromJSON(legacy);

  project.addComponent(component, {
    undo: true,
    label: options.label ?? `add AI component ${legacyName}`
  });

  return component;
}
