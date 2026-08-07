/**
 * AIX-010 — the editor-side half: gather everything the pure assembler needs.
 *
 * This is the only module in `review/` that touches `ProjectModel`, the backend
 * models or the schema handler, and it is deliberately the *thinnest* one. The
 * split matters twice over: the assembler stays specable against the real
 * project corpus with no editor, and `noodl-mcp` (which esbuild-bundles editor
 * sources and has no Electron) can build the same `ProjectReviewSources` from
 * `ProjectStore` without importing anything from here.
 *
 * Everything is best-effort and nothing throws. A backend that is unreachable, a
 * schema that will not fetch, a project with no style tokens — each of those is
 * a fact the review records and the prompt is told about, never an error that
 * stops the review. The one thing this must not do is present "we could not
 * look" as "there is nothing there": `schemaAvailable` carries that distinction
 * all the way into the prompt.
 *
 * @module AiAssistant/review/collectSources
 */

import { BackendServices } from '../../BackendServices';
import { builtInSchemaCollections } from '../../BackendServices/projectCollections';
import type { BackendConfig } from '../../BackendServices/types';
import type { ProjectModel } from '../../projectmodel';
import { getCloudServices } from '../../projectmodel.editor';
import { buildStyleVocabulary } from '../../StyleTokensModel/StyleVocabulary';
import type { ProjectDocsContent } from '../../ProjectDocs/docsText';
import { buildBackendSummary } from './backendSummary';
import type { BackendSummary, DeclaredRoute, ProjectReviewSources, SchemaCollection } from './types';

/**
 * `metadata.routes`, when it is array-shaped.
 *
 * `nodegx.routes.json` is a serialisation of exactly this, and
 * `buildRoutesV2File` returns null when it is not an array — so this is the
 * whole of "the declared routes file", read at the source. In practice no
 * hand-built project has it, which is why `buildPageMap` reads the graph too.
 */
export function readDeclaredRoutes(project: ProjectModel): DeclaredRoute[] | undefined {
  try {
    const routes = project.getMetaData('routes');
    if (!Array.isArray(routes)) return undefined;
    const parsed = routes
      .filter((r): r is Record<string, unknown> => Boolean(r) && typeof r === 'object')
      .map((r) => ({
        path: String(r['path'] ?? ''),
        component: String(r['component'] ?? ''),
        title: typeof r['title'] === 'string' ? r['title'] : undefined
      }))
      .filter((r) => r.component);
    return parsed.length > 0 ? parsed : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Configured backends and the real collections behind them.
 *
 * The reading of the two singletons is all that lives here; the judgement — and
 * the long-standing defect it fixes — is in `backendSummary.ts`.
 *
 * AAQ-011 **F8** added the third read. The built-in backend is bound through
 * `cloudservices` and has no `BackendConfig`, so neither singleton above knows
 * anything about it — and the review consequently told the model its collections
 * were "unknown, not absent" for exactly the backend phase 40 provisions. Layer 1
 * restored `SchemaHandler`, which caches that schema in project metadata, and
 * `builtInSchemaCollections` is the reader over it. It was wiring, not discovery.
 *
 * ⚠️ The **built-in half only**. `projectSchemaCollections` also returns every
 * Backend Services entry's schema, and `buildBackendSummary` walks those itself —
 * passing the whole thing would list every BYOB collection twice.
 *
 * This is the one reader in the product, so `DatabaseSchemaExtractor` — the
 * Read/Write Database templates' schema block — is fixed by the same change with
 * no wiring of its own; it renders whatever this returns.
 */
export async function collectBackendSummary(project: ProjectModel): Promise<BackendSummary> {
  let cloud: BackendSummary['cloud'];
  try {
    const configured = getCloudServices(project);
    if (configured?.endpoint || configured?.appId) {
      cloud = {
        type: configured.type ?? 'unknown',
        endpoint: configured.endpoint,
        appId: configured.appId
      };
    }
  } catch {
    /* an unreadable cloud config is not a reason to abandon the review */
  }

  let backends: BackendConfig[] = [];
  try {
    backends = [...(BackendServices.instance?.backends ?? [])];
  } catch {
    /* Backend Services not initialised in this session */
  }

  let builtIn: SchemaCollection[] = [];
  try {
    builtIn = builtInSchemaCollections(project);
  } catch {
    /* an unreadable metadata cache is "we could not look", which is outcome 3 */
  }

  return buildBackendSummary(cloud, backends, builtIn);
}

/** Everything the assembler needs beyond the graph. Never throws. */
export async function collectProjectReviewSources(
  project: ProjectModel,
  docs: ProjectDocsContent = {}
): Promise<ProjectReviewSources> {
  let rootComponent: string | undefined;
  try {
    rootComponent = project.getRootComponent()?.fullName;
  } catch {
    /* an unsaved or partially loaded project may have no root node */
  }

  let styleVocabulary;
  try {
    styleVocabulary = buildStyleVocabulary(project);
  } catch {
    styleVocabulary = undefined;
  }

  return {
    projectName: project.name,
    description: safeMeta(project, 'description'),
    declaredRoutes: readDeclaredRoutes(project),
    backend: await collectBackendSummary(project),
    styleVocabulary,
    docs,
    rootComponent
  };
}

function safeMeta(project: ProjectModel, key: string): string | undefined {
  try {
    const value = project.getMetaData(key);
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  } catch {
    return undefined;
  }
}
