/**
 * The `User` and `Set User Properties` nodes' ports, built from the selected
 * backend's schema — BCN-006 step 6, and the auth half of BCN-009 step 4.
 *
 * Both nodes hand-rolled the same loop against `systemCollections` metadata,
 * looked up `_User` by name, and read Parse's own type words out of
 * `schema.properties`. That works on exactly two of the five backends and is
 * invisible on the other three: point a project at Directus and the `User` node
 * has three outputs and no properties, with nothing anywhere saying why.
 *
 * This puts both on `schema-ports.ts` — the generator BCN-004 moved out of the
 * BYOB nodes and BCN-009 gave the Record family — so the account's own columns
 * become ports on whichever backend the picker names.
 *
 * ## Three rules, and only the first is obvious
 *
 * **1. The user's collection is not a parameter.** Every other schema-driven node
 * has a Class or Collection dropdown; these two must not. There is exactly one
 * table of accounts per backend and it is decided by the backend's type, not by
 * the builder — offering a dropdown would offer a wrong answer. See
 * {@link userCollectionName}.
 *
 * **2. A Parse-wire backend's ports do not change — including the ones a tidier
 * rule would drop.** `shouldShowField` hides a field marked `hidden`, and
 * `parseFieldToSchemaField` marks `ACL` hidden. Applying it uniformly would
 * silently remove the `prop-ACL` output that the `User` node has always emitted,
 * and a removed output port drops whatever was wired to it. So the filter runs
 * for REST backends, where `hidden` means a Directus interface a builder
 * deliberately hid, and not for the Parse wire, where it would be a behaviour
 * change dressed as consistency. Same asymmetry, same reasoning, as
 * `record-ports.ts`' rule 1.
 *
 * **3. A port is never offered for a field the write path then throws away.**
 * {@link RestAuthAdapter.setUserProperties} strips seventeen server-owned fields
 * from the body it sends. Before those two lists were the same list, a
 * `Set User Properties` node on PocketBase offered a `verified` input that looked
 * like every other input, accepted a value, and discarded it — the exact "nothing
 * is silently missing" failure this phase exists to end, in the family where the
 * spec calls it out by name.
 *
 * @module noodl-runtime
 */

import type { GraphModelLike, RuntimeDiscoveredPort } from '@noodl/types';

import { REST_USER_READONLY_FIELDS } from '../../../api/backends/RestAuthAdapter';
import {
  defaultBackendId,
  endpointBackendEntry,
  type BackendMetaDataSources,
  type CloudServicesMetaData
} from '../../../api/backends/resolveBackend';

import { isParseWireContext, metaDataSources, recordPortType } from '../data/record-ports';
import {
  backendPickerPorts,
  resolveSchemaPortContext,
  shouldShowField,
  type SchemaPortContext
} from '../data/schema-ports';
import type { SchemaCollection, SchemaField } from '../data/schema-types';

/**
 * Where each backend keeps its accounts.
 *
 * Every entry measured on the rig rather than read from documentation:
 *
 * | Backend | Table | How it was settled |
 * |---|---|---|
 * | Parse / NodeGX | `_User` | what both nodes have always looked up |
 * | Directus | `directus_users` | `GET /users/me` answers a row of it; the editor's Directus parser keeps `directus_*` collections rather than filtering them out |
 * | PocketBase | `users` | `_pb_users_auth_`, the collection every PocketBase ships with, present in the rig |
 * | Supabase | — | `auth.users` is **not reachable through PostgREST**, and Supabase auth is refused wholesale (BCN-006 §11.1). No ports rather than ports onto a table nothing can write |
 *
 * ⚠️ **PocketBase's is a default, not a discovery.** Any collection of
 * `type: "auth"` can hold accounts and a project may have several — but the
 * editor's `parsePocketbaseSchema` does not record a collection's type, so the
 * cache cannot say which ones are auth collections. `users` is the same default
 * {@link DEFAULT_POCKETBASE_USER_COLLECTION} gives the adapter, so the ports and
 * the wire agree; a project that renamed it gets no property ports, which is
 * visible rather than wrong.
 */
export const USER_COLLECTION_BY_BACKEND_TYPE: Readonly<Record<string, string>> = Object.freeze({
  parse: '_User',
  nodegx: '_User',
  directus: 'directus_users',
  pocketbase: 'users'
});

/**
 * The table of accounts for a backend type.
 *
 * `undefined` for a type with no answer — Supabase, and any type this table has
 * never heard of. The callers turn that into "no property ports", which is the
 * honest output: a `custom` backend's accounts are wherever its declaration says,
 * and guessing would produce ports onto a table that may not exist.
 */
export function userCollectionName(backendType: string | undefined): string | undefined {
  // An unrecorded type is the Parse wire, which is the floor `resolveBackend`
  // and `UserService._adapter` already established for every other decision.
  if (backendType === undefined) return '_User';
  return USER_COLLECTION_BY_BACKEND_TYPE[backendType];
}

function endpointEntries(sources: BackendMetaDataSources) {
  const endpoint = endpointBackendEntry(sources.cloudservices as CloudServicesMetaData | undefined);
  return endpoint ? [endpoint] : [];
}

/**
 * The user family's schema context: the selected backend, and its accounts table.
 *
 * `resolveSchemaPortContext` is asked for a collection parameter that does not
 * exist (`collectionParam: '__none'`), so it resolves the backend and the
 * schema and leaves `selectedCollection` empty; the collection is then decided
 * by rule 1 above. Passing a real parameter name would be worse than useless — it
 * would let a stray saved parameter point the `User` node at some other table.
 */
export function userSchemaContext(
  graphModel: GraphModelLike,
  parameters: Record<string, unknown>
): SchemaPortContext {
  const sources = metaDataSources(graphModel);

  const base = resolveSchemaPortContext({
    graphModel,
    parameters,
    collectionParam: '__none',
    extraBackends: endpointEntries(sources),
    activeBackendId: defaultBackendId(sources)
  });

  const collectionName = userCollectionName(base.backendType);

  return Object.assign({}, base, {
    collectionName,
    selectedCollection: collectionName
      ? base.collections.find((collection: SchemaCollection) => collection.name === collectionName)
      : undefined
  });
}

/**
 * The `Backend` dropdown, hidden when the project has one backend.
 *
 * The same rule and the same group as the Record family's, and counted over both
 * metadata keys for the same reason — a project with the built-in backend *and*
 * one Directus counts two, so the picker appears exactly where a choice exists.
 */
export function userBackendPickerPorts(ctx: SchemaPortContext): RuntimeDiscoveredPort[] {
  return backendPickerPorts(ctx, { hideWhenSingleBackend: true, group: 'General' });
}

/**
 * The fields the `User` node will not offer as `prop-` outputs.
 *
 * The Parse list is the node's own, unchanged, so no existing project loses a
 * port. The REST list adds the two credential-shaped columns a REST user record
 * carries (`tokenKey` is PocketBase's password-reset invalidator; `tfa_secret` is
 * Directus's, and {@link RestAuthAdapter.normalizeUser} already refuses to let
 * either into browser storage) and the primary key, which is the `Id` output.
 */
export const USER_OUTPUT_IGNORE_PARSE: readonly string[] = Object.freeze([
  'authData',
  'password',
  'username',
  'email'
]);

export const USER_OUTPUT_IGNORE_REST: readonly string[] = Object.freeze([
  'password',
  'tokenKey',
  'tfa_secret',
  'username',
  'email',
  'id',
  'objectId'
]);

/**
 * The fields `Set User Properties` will not offer as `prop-` inputs.
 *
 * ⚠️ The Parse pair differ by runtime and the difference is real rather than
 * historical: server-side, `password` and `emailVerified` **are** writable on the
 * `_User` row, and in the browser they are not. Preserved verbatim.
 */
export const USER_INPUT_IGNORE_PARSE_BROWSER: readonly string[] = Object.freeze([
  'authData',
  'createdAt',
  'updatedAt',
  'email',
  'username',
  'emailVerified',
  'password'
]);

export const USER_INPUT_IGNORE_PARSE_CLOUD: readonly string[] = Object.freeze([
  'authData',
  'createdAt',
  'updatedAt',
  'email',
  'username'
]);

/**
 * The REST write list, derived from the one the adapter strips.
 *
 * `username` and `email` on top, because the node has dedicated ports for both
 * and a second `prop-email` beside `Email` is two ports racing to write one
 * column. Everything else comes from {@link REST_USER_READONLY_FIELDS}, so the
 * two halves cannot drift — see rule 3 in the module docblock.
 */
export const USER_INPUT_IGNORE_REST: readonly string[] = Object.freeze(
  REST_USER_READONLY_FIELDS.concat(['username', 'email', 'tfa_secret'])
);

export interface UserPropertyPortOptions {
  plug: 'input' | 'output';
  /** Names this node will not offer, whatever the schema says. */
  ignore: readonly string[];
  /** Also emit a `changed-<field>` signal output per property (the `User` node). */
  includeChangedSignals?: boolean;
}

/**
 * One `prop-<field>` port per column of the accounts table.
 *
 * `recordPortType` decides the type, which is what keeps a Parse `Date` column a
 * `date` port and a Directus `integer` column a `number` one — the Parse table
 * wins wherever the field carries a Parse type name, and the shared enhanced
 * mapping decides everywhere else.
 *
 * Relations are skipped on both plugs: a Parse `Relation` is a record *set* and
 * has never been readable or settable through these two nodes, and a Directus
 * O2M is the same shape by another name.
 */
export function userPropertyPorts(
  ctx: SchemaPortContext,
  options: UserPropertyPortOptions
): RuntimeDiscoveredPort[] {
  const ports: RuntimeDiscoveredPort[] = [];
  if (!ctx.selectedCollection) return ports;

  const parseWire = isParseWireContext(ctx);

  for (const field of ctx.selectedCollection.fields || []) {
    if (!field || !field.name) continue;
    if (options.ignore.indexOf(field.name) !== -1) continue;
    if (isRelationField(field)) continue;
    // Rule 2: the hidden-field filter runs for REST backends only.
    if (!parseWire && !shouldShowField(field)) continue;

    ports.push({
      name: 'prop-' + field.name,
      displayName: field.displayName || field.name,
      type: recordPortType(field),
      plug: options.plug,
      group: 'Properties'
    });

    if (options.includeChangedSignals) {
      ports.push({
        name: 'changed-' + field.name,
        displayName: (field.displayName || field.name) + ' Changed',
        type: 'signal',
        plug: 'output',
        group: 'Events'
      });
    }
  }

  return ports;
}

/** A record set rather than a value — never a port on either of these nodes. */
function isRelationField(field: SchemaField): boolean {
  return field.nativeType === 'Relation' || field.type === 'relation' || field.relationType === 'many-to-many';
}
