/**
 * LIB-006: the in-memory transforms an import applies to the source project.
 *
 * Split out of `importAssessment.ts` deliberately: every import here is
 * type-only, so this file loads without Electron and `tests-unit/` can exercise
 * the two transforms directly. The shell that loads the catalog, the React
 * pattern set and the filesystem stays next door.
 *
 * @module noodl-editor/utils/import-engine/legacy/transforms
 */

import type { ProjectModel } from '@noodl-models/projectmodel';

import { HTTP_TYPE } from './constructs';
import type { ImportReport, LegacyFinding, LegacyImportMarker } from './types';
import { LEGACY_IMPORT_METADATA_KEY } from './types';

/** The subset of a live node the transforms touch. */
export interface LiveNode {
  id: string;
  typename: string;
  metadata?: Record<string, unknown>;
  retypeTo(typename: string): void;
}

/** The subset of a live component the transforms walk. */
export interface LiveComponent {
  name: string;
  forEachNodeRecursive(callback: (node: LiveNode) => boolean | void): boolean;
}

/** The subset of a live project the transforms read. */
export interface LiveProject {
  components: LiveComponent[];
}

export interface TransformResult {
  /** Nodes that gained a `legacyImport` marker. */
  marked: number;
  /** Nodes retyped by a mechanical conversion. */
  converted: number;
  /** Finding ids whose node could not be located in the live model. */
  unlocated: string[];
}

/** Index the source project's live nodes by id, once. */
function indexNodes(source: LiveProject): Map<string, LiveNode> {
  const index = new Map<string, LiveNode>();
  for (const component of source.components) {
    // NB braces, and no return value.
    //
    // `forEachRecursive` treats a TRUTHY callback return as "stop walking", and
    // an implicit-return arrow whose body is `index.set(...)` returns the Map.
    // That reads as truthy, the walk stops at the first node, and the resulting
    // bug looks exactly like data loss. It has cost this project three separate
    // investigations. The braces are the fix and they are not optional.
    component.forEachNodeRecursive((node) => {
      index.set(node.id, node);
    });
  }
  return index;
}

function markPlaceholder(node: LiveNode, finding: LegacyFinding, importedAt: string): void {
  const marker: LegacyImportMarker = {
    findingId: finding.id,
    originalType: finding.original,
    reason: finding.reason,
    importedAt
  };
  if (!node.metadata) {
    node.metadata = {};
  }
  node.metadata[LEGACY_IMPORT_METADATA_KEY] = marker;
}

/**
 * Apply the report's transforms to the live source project, in memory.
 *
 * Mutating the source is safe and is already the engine's pattern — `apply.ts`
 * loads the source purely to detach components from it and then throws it away.
 * The source's files on disk are never written.
 *
 * Two transforms, and only two, because the committed inventory sanctions only
 * two:
 *
 * - **`placeholder` → mark.** The node keeps its type, parameters and wiring;
 *   it gains `metadata.legacyImport`. That marker is what promotes SUB-006's
 *   unknown-type *warning* to LIB-006's placeholder **error**.
 * - **`rest-to-http` → retype.** The one mechanical conversion the inventory
 *   takes, and only for REST nodes with no request/response script. Parameters
 *   are deliberately left alone: `resource` is not `url`, so the HTTP node
 *   arrives with its URL unset rather than with a value silently landing on the
 *   wrong port. An empty port announces itself; a wrong one does not, and the
 *   report entry names the rename either way.
 *
 * Must run BEFORE `applyModelChanges`, which re-keys every node id it grafts.
 */
export function applyLegacyTransforms(report: ImportReport, sourceProject: ProjectModel): TransformResult {
  const source = sourceProject as unknown as LiveProject;
  const index = indexNodes(source);
  const result: TransformResult = { marked: 0, converted: 0, unlocated: [] };

  for (const finding of report.findings) {
    const nodeId = finding.location?.nodeId;
    if (!nodeId) {
      continue;
    }
    const node = index.get(nodeId);
    if (!node) {
      // Not fatal: the finding stays in the report, which is the promise. Only
      // the in-project marker is missing, and saying so beats pretending.
      if (finding.outcome === 'placeholder' || finding.reason === 'rest-to-http') {
        result.unlocated.push(finding.id);
      }
      continue;
    }

    if (finding.outcome === 'placeholder') {
      markPlaceholder(node, finding, report.generatedAt);
      result.marked += 1;
      continue;
    }

    if (finding.reason === 'rest-to-http') {
      node.retypeTo(HTTP_TYPE);
      result.converted += 1;
    }
  }

  return result;
}
