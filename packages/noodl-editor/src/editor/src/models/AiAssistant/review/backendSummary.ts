/**
 * AIX-010 — what the review is told about the project's backend.
 *
 * Pure by design, and separated from `collectSources.ts` for the reason that
 * module's own header gives: the reading of singletons stays on the Electron
 * side, the *judgement* stays specable. Everything here takes plain data.
 *
 * ## Where the collections come from, and where they used to come from
 *
 * They used to come from `DatabaseSchemaExtractor`, i.e. `SchemaHandler`.
 * **`SchemaHandler` was a stub from WF-007 until phase 40's Layer 1**: `_fetch()`
 * set `dbCollections = []` and `haveCloudServices = false` unconditionally,
 * because the master-key admin surface it introspected through was deleted along
 * with the rest of the Parse management framework. So the summary returned an
 * empty collection list for every project ever run through it — backend or no
 * backend — and then, because empty-plus-configured is not a trustworthy shape,
 * concluded *"a backend is configured but its schema returned nothing — it may
 * be unreachable"*.
 *
 * That sentence went into the prompt for a document a human is asked to trust,
 * and it was a wrong diagnosis of a perfectly reachable backend every single
 * time. Confirmed against a live `nodegx-backend` with real collections
 * (AIX-010 residual, 2026-08-02): the backend answered its schema route in
 * milliseconds while the review was calling it unreachable.
 *
 * `BackendConfig.schema` is the live path and has been since BCN-004: the
 * Backend Services panel fetches the backend's own schema endpoint, parses it
 * through `schemaParsers.ts` and caches the result in project metadata. It is
 * the same cache the record nodes build their ports from — so if the ports on
 * the canvas know the field names, this does too.
 *
 * ## The built-in backend — AAQ-011 **F8**, and the paragraph this replaces
 *
 * This header used to say that a project bound only to its `cloudservices`
 * endpoint "has no cached schema anywhere in the editor". **That was true when
 * AIX-010 wrote it and stopped being true in phase 40's Layer 1.**
 * `SchemaHandler._fetch()` was restored: it resolves the project's endpoint to
 * one of the backends this editor runs (`backend:list` → `backend:status` →
 * `backend:getSchema`) and caches the answer in the `dbCollections` project
 * metadata — the same cache the Record family's `prop-*` ports come from. So for
 * exactly the backend phase 40 is about, the collections *are* knowable, and the
 * review was telling the model they were not.
 *
 * They arrive here as the third argument rather than being read here, for the
 * reason this module is separate from `collectSources.ts` at all: the reading of
 * singletons stays on the Electron side, the judgement stays specable.
 * `BackendServices/projectCollections.ts::builtInSchemaCollections` is the reader.
 *
 * ## What still cannot be read, and is now said plainly
 *
 * A cloud endpoint whose built-in cache is **empty** is still *unavailable, with
 * the reason*, never "no collections". Empty is not evidence of absence here:
 * `SchemaHandler._store()` writes `dbCollections = undefined` whenever the fetch
 * failed, so a stopped backend, a backend mid-restart and a foreign Parse server
 * we have no key for all land on the same empty value. The difference between
 * "there is nothing" and "we could not look" is the whole point of
 * `schemaAvailable`, and it is why F8 **narrowed** outcome 3 rather than deleting
 * it.
 *
 * ## Credentials
 *
 * `BackendConfig.auth` carries `adminToken`, `publicToken`, `username` and
 * `password`. None of them is read here and none may ever be: this summary is
 * rendered verbatim into a prompt and into a document written to the project
 * directory. Only the id, display name, type and base URL are taken. Keep it
 * that way — `tests/ai/project-review-backend.test.ts` fails if that changes.
 *
 * @module AiAssistant/review/backendSummary
 */

import type { BackendConfig } from '../../BackendServices/types';
import type { BackendSummary, SchemaCollection, SchemaField } from './types';

/**
 * One backend's cached schema, flattened to the names and types the prompt shows.
 *
 * `schemaParsers.ts` has already normalised every backend's own spelling — Parse
 * `fields`, NodeGX `columns`, Directus `meta`, PocketBase, PostgREST's OpenAPI —
 * so this only has to drop what a reader must not be told is part of the data
 * model. Presentation-only fields (`hidden`) go: Directus dividers and notices
 * are not data, and the record nodes do not build ports for them either.
 */
export function collectionsFromCachedSchema(backend: BackendConfig): SchemaCollection[] {
  return (backend.schema?.collections ?? []).map((collection) => ({
    name: collection.name,
    fields: (collection.fields ?? [])
      .filter((field) => !field.hidden)
      .map((field): SchemaField => ({
        name: field.name,
        type: field.type || field.nativeType || 'unknown',
        ...(field.relationTarget ? { targetClass: field.relationTarget } : {})
      }))
  }));
}

/**
 * Configured backends and the real collections behind them.
 *
 * Two systems can each be configured, and a project may have either or both:
 * Parse-wire cloud services (the built-in NodeGX backend or an external Parse),
 * and Backend Services entries (Supabase/Directus/PocketBase/Parse/custom).
 * `builtIn` is the first system's cached schema, read by
 * `builtInSchemaCollections`; the second system's rides on each `BackendConfig`.
 *
 * Four outcomes, and each one says something different:
 *
 * 1. at least one collection could be read — from the built-in backend's cache,
 *    from a synced Backend Services schema, or from both — plus a note naming any
 *    backend that was *not* synced, because a partial list presented whole is
 *    still a wrong answer;
 * 2. backends configured, none synced — unavailable, and it says how to fix it;
 * 3. a cloud endpoint whose schema could not be read — unavailable, and it says
 *    the collections are unknown rather than absent;
 * 4. nothing configured at all — the one shape in which an empty list is a fact.
 *
 * ⚠️ **AAQ-011 F8 did not add a fifth outcome, and that was the decision rather
 * than the default.** A cloud endpoint whose collections *are* readable wants
 * precisely what outcome 1 already does — list them, and name anything that could
 * not be read alongside — so a fifth branch would have been outcome 1 with a
 * second copy of the partial-read note, which is the one-fact-in-two-places shape
 * this phase keeps paying for. What changed is the *predicate*: outcome 1 no
 * longer means "a synced Backend Services schema", it means "something was read".
 * Outcome 3 narrowed to the empty-cache case and kept its wording, because that
 * case is still real and still exactly what it says — see the header.
 */
export function buildBackendSummary(
  cloud: BackendSummary['cloud'],
  backends: readonly BackendConfig[],
  builtIn: readonly SchemaCollection[] = []
): BackendSummary {
  const summary: BackendSummary = { services: [], collections: [], schemaAvailable: false };
  if (cloud) summary.cloud = cloud;

  // First, because `renderBackend` names the cloud endpoint before the services and
  // a reader should meet the collections in the order it met the backends.
  summary.collections.push(...builtIn);

  const unsynced: string[] = [];

  for (const backend of backends) {
    summary.services.push({ id: backend.id, name: backend.name, type: backend.type, url: backend.url });

    const collections = collectionsFromCachedSchema(backend);
    if (collections.length > 0) {
      summary.collections.push(...collections);
    } else {
      unsynced.push(backend.name || backend.id);
    }
  }

  if (summary.collections.length > 0) {
    summary.schemaAvailable = true;
    if (unsynced.length > 0) {
      summary.schemaNote =
        unsynced.length === 1
          ? `${unsynced[0]} has no synced schema, so its collections are not listed`
          : `${unsynced.join(', ')} have no synced schema, so their collections are not listed`;
    }
    return summary;
  }

  if (unsynced.length > 0) {
    summary.schemaNote =
      unsynced.length === 1
        ? `${unsynced[0]} is configured but its schema has never been synced in the editor (Backend Services → Sync)`
        : `${unsynced.join(', ')} are configured but their schemas have never been synced in the editor ` +
          '(Backend Services → Sync)';
    return summary;
  }

  if (cloud) {
    summary.schemaNote =
      'the project is bound to a cloud services endpoint, and the editor has no schema introspection for one — ' +
      'the collections are unknown, not absent';
    return summary;
  }

  // Nothing is configured, so an empty list is a fact rather than a failure to
  // look. This is the one shape in which "no collections" may be asserted.
  summary.schemaAvailable = true;
  return summary;
}
