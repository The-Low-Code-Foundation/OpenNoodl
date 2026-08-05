/**
 * AAQ-002 slice 4 — the collections this project's backend actually has.
 *
 * The editor-side reader, kept apart from the pure merge/render in
 * `AiAssistant/authoring/backendSchema.ts` for the reason `review/collectSources.ts`
 * gives about itself: the reading of singletons stays on the Electron side, the
 * judgement stays specable.
 *
 * ## Two caches, because there are two kinds of backend
 *
 * - **Backend Services entries** (Supabase/Directus/PocketBase/Parse/custom)
 *   carry their synced schema on `BackendConfig.schema`, normalised by
 *   `schemaParsers.ts`.
 * - **The built-in backend** is bound through `cloudservices` and has no
 *   `BackendConfig` at all. Its schema lives in the `dbCollections` project
 *   metadata, written by `SchemaHandler` — which had been a stub since WF-007
 *   and was restored by this task's slice 3. It is the same cache the Record
 *   family's `prop-*` ports are generated from, so if the ports on the canvas
 *   know the field names, this does too.
 *
 * The raw `dbCollections` value is the backend's own `tables` array, which is
 * exactly what `parseParseSchema` already normalises — so it goes through that
 * rather than growing a second reader of the same shape.
 *
 * @module BackendServices/projectCollections
 */

import type { SchemaCollectionInfo } from '../AiAssistant/authoring/backendSchema';
import { collectionsFromCachedSchema } from '../AiAssistant/review/backendSummary';
import type { ProjectModel } from '../projectmodel';
import { BackendServices } from './index';
import { parseParseSchema } from './schemaParsers';
import type { BackendConfig } from './types';

/**
 * The built-in backend's collections, from the cache `SchemaHandler` fills.
 *
 * Returns an empty list for every "we could not look" case rather than throwing:
 * a project whose backend is stopped is a project whose agent gets no schema
 * block, which is the same outcome as having no backend and is honest about it.
 */
function builtInCollections(project: ProjectModel): SchemaCollectionInfo[] {
  try {
    const tables = project.getMetaData('dbCollections');
    if (!Array.isArray(tables) || tables.length === 0) return [];
    const schema = parseParseSchema({ tables });
    return collectionsFromCachedSchema({ schema } as BackendConfig);
  } catch {
    return [];
  }
}

/** Every configured Backend Services entry's synced schema. */
function serviceCollections(): SchemaCollectionInfo[] {
  try {
    const backends = BackendServices.instance?.backends ?? [];
    return backends.flatMap((backend) => collectionsFromCachedSchema(backend));
  } catch {
    /* Backend Services not initialised in this session */
    return [];
  }
}

/**
 * Everything the editor knows about this project's collections today.
 *
 * ⚠️ "Today" is the operative word, and it is why this is not the whole of slice
 * 4's input: for a wizard-built project at authoring time the answer is *nothing*
 * — the provision is an operation in the same plan and applies at Apply, after
 * every authoring turn has run. The plan's own columns are the other half, and
 * they are merged in by `mergeSchemaCollections` at the call site.
 */
export function projectSchemaCollections(project: ProjectModel | undefined): SchemaCollectionInfo[] {
  if (!project) return [];
  return [...builtInCollections(project), ...serviceCollections()];
}
