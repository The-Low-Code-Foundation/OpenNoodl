/**
 * LIB-006: the machine form of the legacy construct inventory.
 *
 * This file holds ONLY the parts of
 * `dev-docs/tasks/phase-21-library-and-import/LIB-006-LEGACY-CONSTRUCT-INVENTORY.md`
 * that cannot be derived from the catalog at runtime. Everything derivable is
 * derived:
 *
 * - "is this type registered?" and "is it deprecated?" → the node catalog
 * - "what replaces it?" → the enriched catalog's `enrichment.relatedNodes`
 *
 * Keeping the derivable half out of here is the point. A hand-maintained table
 * of 30 deprecated→replacement pairs would go stale the first time the catalog
 * was regenerated, and nothing would notice.
 *
 * **Adding an entry here is adding to LIB-006's scope**, and per the task's own
 * risk table that needs a reason which is not "it would import better". Update
 * the committed inventory table in the same commit.
 *
 * @module noodl-editor/utils/import-engine/legacy/constructs
 */

import type { PortChange } from './types';

// ─── Removed node types ──────────────────────────────────────────────────────

export interface RemovedType {
  /** The type name as it appears in a legacy project's `node.type`. */
  typeName: string;
  /** Its display name, so the report can name it the way the user saw it. */
  displayName: string;
  /** The commit that removed it — provenance for the claim. */
  removedIn: string;
  /** Catalog type names to consider. Empty when the replacement is not a node. */
  equivalents: string[];
  /** Ports whose names differ, so an assistant re-points wires deliberately. */
  portChanges: PortChange[];
  /** Why this is not auto-converted. */
  note: string;
}

const BYOB_PORT_CHANGES: PortChange[] = [
  { from: 'records', to: 'items' },
  { from: 'fetch', to: 'storageFetch' },
  { from: 'create', to: 'store' },
  { from: 'update', to: 'store' },
  { from: 'delete', to: 'store' }
];

/**
 * Every node type that resolves nowhere in NodeGX.
 *
 * All five are pre-BCN-004 **NodeGX**, not Noodl 2.x. Git history over the node
 * directories shows no legacy Noodl type was ever deleted during the revival —
 * every `--diff-filter=D` hit is a PLAT-003 `.js`→`.ts` rename of the same node.
 * That is why this list is short, and it is the single most important thing to
 * know about legacy import: the node graph is not where the difficulty is.
 */
export const REMOVED_TYPES: readonly RemovedType[] = [
  {
    typeName: 'noodl.byob.CreateRecord',
    displayName: 'Create Record',
    removedIn: '8eed8141',
    equivalents: ['NewDbModelProperties'],
    portChanges: [...BYOB_PORT_CHANGES, { from: 'success', to: 'created' }],
    note: 'The BYOB family was retired when the backend contract converged (BCN-004/010). The replacement takes different port names, so an automatic rewrite would re-point wires onto ports that mean something else.'
  },
  {
    typeName: 'noodl.byob.UpdateRecord',
    displayName: 'Update Record',
    removedIn: '8eed8141',
    equivalents: ['SetDbModelProperties'],
    portChanges: [...BYOB_PORT_CHANGES, { from: 'success', to: 'stored' }],
    note: 'The BYOB family was retired when the backend contract converged (BCN-004/010). The replacement takes different port names, so an automatic rewrite would re-point wires onto ports that mean something else.'
  },
  {
    typeName: 'noodl.byob.DeleteRecord',
    displayName: 'Delete Record',
    removedIn: '8eed8141',
    equivalents: ['DeleteDbModelProperties'],
    portChanges: [...BYOB_PORT_CHANGES, { from: 'success', to: 'deleted' }],
    note: 'The BYOB family was retired when the backend contract converged (BCN-004/010). The replacement takes different port names, so an automatic rewrite would re-point wires onto ports that mean something else.'
  },
  {
    typeName: 'noodl.byob.QueryData',
    displayName: 'Query Data',
    removedIn: '8eed8141',
    equivalents: ['DbCollection2'],
    portChanges: BYOB_PORT_CHANGES,
    note: 'The BYOB family was retired when the backend contract converged (BCN-004/010). The replacement takes different port names, so an automatic rewrite would re-point wires onto ports that mean something else.'
  },
  {
    typeName: 'noodl.byob.SubscribeToChanges',
    displayName: 'Subscribe To Changes',
    removedIn: '9d050626',
    equivalents: [],
    portChanges: [],
    note: 'Realtime subscription stopped being a node in BCN-008; it is now a property of the Query Records node. There is no node to convert to — this one is rebuilt, not repaired.'
  }
];

const REMOVED_BY_NAME = new Map(REMOVED_TYPES.map((t) => [t.typeName, t]));

export function removedType(typeName: string): RemovedType | undefined {
  return REMOVED_BY_NAME.get(typeName);
}

// ─── REST2 → net.noodl.HTTP ──────────────────────────────────────────────────

/** The legacy REST node's type name. */
export const REST_TYPE = 'REST2';
/** Its replacement. */
export const HTTP_TYPE = 'net.noodl.HTTP';

/**
 * The parameters that carry executable user code on a REST node. NDA-011 stopped
 * short of deleting REST precisely because HTTP Request has no equivalent for
 * these, and `restnode.ts:88-98` hands the conversion path to LIB-006.
 */
export const REST_SCRIPT_PARAMETERS = ['requestScript', 'responseScript'] as const;

/**
 * The declarative part of REST that HTTP Request is a true superset of.
 * `resource` is the URL; the four signals keep their names.
 */
export const REST_TO_HTTP_PORTS: readonly PortChange[] = [
  { from: 'resource', to: 'url' },
  { from: 'fetch', to: 'fetch' },
  { from: 'success', to: 'success' },
  { from: 'failure', to: 'failure' },
  { from: 'cancel', to: 'cancel' },
  { from: 'canceled', to: 'canceled' }
];

/**
 * REST parameters with no HTTP Request equivalent. Carried into the report
 * rather than silently discarded — `method` is a real behaviour difference.
 */
export const REST_UNCARRIED_PARAMETERS = ['method'] as const;

// ─── Project fields that are not carried ─────────────────────────────────────

export interface DroppedProjectField {
  field: string;
  /** Why it is lost — with the code that loses it. */
  evidence: string;
  /** Whether losing it matters. */
  message: string;
  recommendation: string;
}

/**
 * Fields a legacy `project.json` can carry that `ProjectModel` neither reads nor
 * writes. Both are lost on the first save **today**, silently — found by reading
 * `projectmodel.ts`'s constructor against its `toJSON()`. LIB-006 does not
 * restore them; it makes the loss visible, which is the whole point of the task.
 */
export const DROPPED_PROJECT_FIELDS: readonly DroppedProjectField[] = [
  {
    field: 'deviceSettings',
    evidence: 'projectmodel.ts:155 (read commented out) and :1356 (write commented out)',
    message: 'The project carried device settings. NodeGX does not read or write them, so they are lost on the first save.',
    recommendation: 'Nothing in NodeGX consumes this field. If the settings mattered, re-express them as project settings or a viewport configuration; there is no automatic path.'
  },
  {
    field: 'thumbnailURI',
    evidence: 'projectmodel.ts:151 (read commented out) and :1350 (write commented out)',
    message: 'The project carried an embedded thumbnail. NodeGX regenerates thumbnails from the running project, so the stored one is not carried.',
    recommendation: 'No action needed — the launcher regenerates the thumbnail when the project first renders.'
  }
];

// ─── Backend configuration ───────────────────────────────────────────────────

/** Project metadata keys that still resolve, and where. */
export const CARRIED_BACKEND_METADATA = ['cloudservices', 'dbCollections'] as const;
