/**
 * The database schema, as the Read/Write Database templates hand it to a model.
 *
 * ## What was wrong
 *
 * This module read `SchemaHandler.dbCollections`. **That was a stub from WF-007
 * until phase 40's Layer 1** — `_fetch()` set `dbCollections = []`
 * unconditionally, because the master-key admin surface it introspected through
 * went with the rest of the Parse management framework. So
 * `extractDatabaseSchema()` returned a single newline for every project ever run
 * through it, and both templates substituted that under the words *"Here is the
 * schema of the database:"*.
 *
 * Two templates whose entire job is writing CRUD and query functions were
 * being told, in effect, that the database has no collections — and told it in
 * a form indistinguishable from a database that genuinely has none. The model
 * then invents class and field names, and the author gets plausible code
 * against a schema that does not exist. That is the same defect
 * `review/backendSummary.ts` fixes one layer up, and this is the other caller.
 *
 * ## One reader, three consumers
 *
 * The reader is `collectBackendSummary` — the same call the project review
 * makes, over the same caches the record nodes build their ports from
 * (`BackendConfig.schema` for a Backend Services entry, the `dbCollections`
 * metadata for the built-in backend). There is no second schema read left in the
 * product and there must not be a third: {@link renderDatabaseSchema} is a
 * *renderer* over its result, nothing more.
 *
 * ⚠️ That is why AAQ-011 **F8** cost this file nothing. F8 filed it as "a third
 * consumer of the same idea" needing the same wiring; it needed none, because it
 * does not read a schema — it renders whatever the one reader returns, and the
 * wiring went in there. A consumer that had grown its own read would have needed
 * fixing twice, which is the argument for keeping it this way.
 *
 * `extractDatabaseSchemaJSON` and `databaseSchemaCompact` used to live here.
 * Both were the raw Parse `{name, schema: {properties}}` spelling, both read
 * the same dead handler, and both had zero callers — they are deleted rather
 * than repointed, because re-deriving fields out of `schema.properties` is
 * exactly the second spelling this consolidation exists to remove.
 * `BackendServices` has already normalised every backend's own shape by the
 * time we see it.
 *
 * @module AiAssistant/DatabaseSchemaExtractor
 */

import { ProjectModel } from '@noodl-models/projectmodel';

import { collectBackendSummary } from './review/collectSources';
import type { BackendSummary } from './review/types';

/**
 * A `BackendSummary` as prompt text.
 *
 * **The three states must not read alike.** "There are no collections" and
 * "we could not read the collections" license completely different behaviour
 * from a model asked to write database code: the first means the author has
 * nothing to write against yet, the second means the names exist and are
 * simply unknown here. Rendering both as an empty list is what made the old
 * behaviour dangerous rather than merely unhelpful — so each state says which
 * one it is, and the two that cannot supply names also say what to do instead.
 *
 * Pure, so the wording is specable without an editor.
 */
export function renderDatabaseSchema(summary: BackendSummary | undefined): string {
  if (!summary || !summary.schemaAvailable) {
    const why = summary && summary.schemaNote ? ` (${summary.schemaNote})` : '';
    return [
      `The database schema could not be read${why}.`,
      '',
      'This does NOT mean the database is empty — it may well have collections; they are simply not',
      'visible from here. Do not invent collection or field names. Take the collection name and any',
      'field names as function inputs, or say plainly that you need the collection name.'
    ].join('\n');
  }

  if (summary.collections.length === 0) {
    return [
      'This project has no cloud database configured, so there are no collections.',
      '',
      'Do not write code against a named collection. Say that a backend has to be configured first,',
      'or take the collection name as a function input.'
    ].join('\n');
  }

  const lines: string[] = [
    'These are the collections in the project database, with their real fields.',
    'Use these names exactly as written. Do not invent collections or fields.',
    ''
  ];

  for (const collection of summary.collections) {
    lines.push(collection.name);
    for (const field of collection.fields) {
      lines.push(`- ${field.name}: ${field.type}${field.targetClass ? ` -> ${field.targetClass}` : ''}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * The schema block the Read/Write Database templates substitute into their
 * prompts. Never throws — a project that cannot be read renders the
 * unavailable state rather than failing the generation.
 */
export async function extractDatabaseSchema(): Promise<string> {
  try {
    const project = ProjectModel.instance;
    if (!project) return renderDatabaseSchema(undefined);
    return renderDatabaseSchema(await collectBackendSummary(project));
  } catch {
    return renderDatabaseSchema(undefined);
  }
}
