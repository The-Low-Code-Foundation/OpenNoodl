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
import type { ProjectModel } from '../../projectmodel';
import { getCloudServices } from '../../projectmodel.editor';
import { buildStyleVocabulary } from '../../StyleTokensModel/StyleVocabulary';
import type { ProjectDocsContent } from '../../ProjectDocs/docsText';
import { extractDatabaseSchemaJSON } from '../DatabaseSchemaExtractor';
import type { BackendSummary, DeclaredRoute, ProjectReviewSources, SchemaCollection, SchemaField } from './types';

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

/** One Parse-style collection schema flattened to names and types. */
function toCollection(raw: { name?: string; schema?: { properties?: Record<string, unknown> } }): SchemaCollection {
  const properties = raw.schema?.properties ?? {};
  const fields: SchemaField[] = Object.keys(properties).map((name) => {
    const property = properties[name] as { type?: string; targetClass?: string } | undefined;
    return {
      name,
      type: property?.type ?? 'unknown',
      ...(property?.targetClass ? { targetClass: property.targetClass } : {})
    };
  });
  return { name: raw.name ?? '(unnamed)', fields };
}

/**
 * Configured backends and the real collections behind them.
 *
 * Three independent systems can each be configured, and a project may have any
 * combination: Parse-wire cloud services (the built-in NodeGX backend or an
 * external Parse), BYOB services (Supabase/Directus/PocketBase/custom), and the
 * schema handler's live collection list.
 */
export async function collectBackendSummary(project: ProjectModel): Promise<BackendSummary> {
  const summary: BackendSummary = { services: [], collections: [], schemaAvailable: false };

  try {
    const cloud = getCloudServices(project);
    if (cloud?.endpoint || cloud?.appId) {
      summary.cloud = {
        type: cloud.type ?? 'unknown',
        endpoint: cloud.endpoint,
        appId: cloud.appId
      };
    }
  } catch {
    /* an unreadable cloud config is not a reason to abandon the review */
  }

  try {
    for (const backend of BackendServices.instance?.backends ?? []) {
      summary.services.push({ id: backend.id, name: backend.name, type: backend.type, url: backend.url });
    }
  } catch {
    /* BYOB not initialised in this session */
  }

  try {
    const raw = await extractDatabaseSchemaJSON();
    summary.collections = (raw ?? []).map(toCollection);
    summary.schemaAvailable = true;
  } catch (error) {
    summary.schemaAvailable = false;
    summary.schemaNote =
      error instanceof Error ? error.message : 'the schema handler could not reach the backend';
  }

  // The extractor swallows its own fetch failures and returns an empty list, so
  // "no collections AND no backend configured" is the only shape in which an
  // empty result is trustworthy. Anything else is reported as unavailable.
  if (summary.schemaAvailable && summary.collections.length === 0 && (summary.cloud || summary.services.length > 0)) {
    summary.schemaAvailable = false;
    summary.schemaNote = 'a backend is configured but its schema returned nothing — it may be unreachable';
  }

  return summary;
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
