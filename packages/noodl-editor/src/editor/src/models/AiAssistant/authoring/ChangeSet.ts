/**
 * AIX-003 — Graph-Native Review: the change-set adapter
 *
 * Expresses an AI proposal (the staged v2 files an `AuthoringSession` produces)
 * as a SUB-007 change set, so review renders through the same diff engine and
 * types as version control — no second diff implementation.
 *
 * Both sides of the diff go through the v2 form: the proposal already is v2
 * files, and an existing component is converted with `buildComponentV2Files`
 * (the exporter's own serializer). Diffing legacy-shaped against v2-shaped
 * snapshots would report each side's `extras` bookkeeping as contradictory
 * metadata changes; same-format snapshots make the diff about the graph.
 *
 * Each change is wrapped with a stable id and its acceptance requirements —
 * the "a connection cannot be accepted if the node it targets is rejected"
 * rules — as plain data, so the review UI can enforce granular accept/reject
 * without re-deriving graph structure.
 *
 * @module AiAssistant/authoring/ChangeSet
 */

import { diffGraphs, fromV2Files, type V2ComponentFiles } from '@noodl-versioning';

import { buildComponentV2Files, legacyNameToPath } from '../../../io/ProjectExporter';
import { toLegacyName } from '../../../io/ProjectImporter';
import type { ProjectModel } from '../../projectmodel';
import { emptySnapshot, wrapChanges, type AuthoringChangeSet } from './changeClosure';
import type { ComponentFiles } from './types';

/** Narrow the staged component files to the diff adapter's input shape. */
function asSnapshotFiles(files: { component: unknown; nodes: unknown; connections: unknown }): V2ComponentFiles {
  return files as V2ComponentFiles;
}

/**
 * Express a staged AI proposal as a change set against the live project.
 *
 * The base is the project's current component of the same legacy name (empty
 * when the proposal creates a new one — today's AIX-002 flow), converted
 * through the exporter's own v2 serializer so both diff sides share a format.
 */
export function buildChangeSet(project: ProjectModel, files: ComponentFiles): AuthoringChangeSet {
  const registryPath = legacyNameToPath(files.component.path ?? files.component.name);
  const componentName = toLegacyName(files.component, registryPath);
  const existing = project.getComponentWithName(componentName);

  const target = fromV2Files(asSnapshotFiles(files));
  target.name = componentName;

  // The timestamp only feeds `modified`, which the diff already treats as
  // derived bookkeeping; a constant keeps this module pure.
  const base = existing
    ? fromV2Files(asSnapshotFiles(buildComponentV2Files(existing.toJSON(), '1970-01-01T00:00:00.000Z')))
    : emptySnapshot(componentName);
  base.name = componentName;

  const diff = diffGraphs(base, target);
  return {
    componentName,
    isNewComponent: !existing,
    base,
    target,
    changes: wrapChanges(diff.changes, base, target)
  };
}

/**
 * The bookkeeping and closure machinery moved to `changeClosure.ts` in WFA-007
 * (it is pure, and a non-component subject needs it without the project model).
 * Re-exported here so every existing import keeps resolving.
 */
export {
  emptySnapshot,
  requiredWith,
  excludedWith,
  wrapChanges,
  type AuthoringChangeSet,
  type ReviewChange
} from './changeClosure';
