/**
 * The Record family's ports, built from the selected backend's schema — BCN-004 step 5.
 *
 * The six Record nodes (`DbModel2`, `DbCollection2`, `NewDbModelProperties`,
 * `SetDbModelProperties`, `DeleteDbModelProperties`, `FilterDBModels`) each hand-rolled a
 * Class dropdown and a property-port loop against the legacy `dbCollections` metadata,
 * which has had nothing writing it since WF-007 gutted `schemahandler.ts`. This module
 * puts all six on `schema-ports.ts` — the generator BCN-004 step 4 moved out of the BYOB
 * nodes — so they build their ports from whichever backend the picker names, Parse and
 * NodeGX included.
 *
 * ## Two rules this module exists to hold, and the reasons are not symmetrical
 *
 * **1. A Parse-wire backend's ports do not change.** The Record family's port *types* are
 * shipped API: a `Date` column has always produced a `date` port and a `Pointer` a `*`
 * port, and re-typing either would drop wires in projects that already work. So the
 * historic `_typeMap` still decides the type whenever the field carries a Parse type name
 * ({@link SchemaField.nativeType}), and {@link getEnhancedFieldType} — with its enum
 * dropdowns, its numeric fix and its placeholders — decides it for every other backend.
 * The two never meet: a Parse class has no enum columns and a Directus table has no
 * `Pointer`.
 *
 * **2. The picker must be able to name a backend that is not in `backendServices`.** See
 * `api/backends/resolveBackend.ts` on the two "actives". A Record node's default backend
 * is the project's `cloudservices` endpoint, which lives in a different metadata key and
 * has no id of its own.
 *
 * Nothing here calls `sendDynamicPorts`. Each node composes what it needs and ends with
 * one `sendSchemaPorts`, which is where the doubled-port guard lives.
 *
 * @module noodl-runtime
 */

import type { GraphModelLike, RuntimeDiscoveredPort } from '@noodl/types';

import {
  backendEntries,
  defaultBackendId,
  endpointBackendEntry,
  type BackendMetaDataSources,
  type CloudServicesMetaData
} from '../../../api/backends/resolveBackend';

import {
  backendPickerPorts,
  collectionPorts,
  getEnhancedFieldType,
  getFilterFields,
  resolveSchemaPortContext,
  shouldShowField,
  type SchemaPortContext
} from './schema-ports';

import type { BackendServicesMetaData, SchemaCollection, SchemaField } from './schema-types';

/**
 * The Parse-family port types, unchanged since the Record nodes were written.
 *
 * Keyed on Parse's own type names because that is what `nativeType` carries. Anything not
 * in the table has always produced `'*'` — including `Pointer`, `Object`, `Array`, `File`
 * and `GeoPoint` — and still does.
 */
const PARSE_PORT_TYPES: Readonly<Record<string, string>> = Object.freeze({
  String: 'string',
  Boolean: 'boolean',
  Number: 'number',
  Date: 'date'
});

/**
 * The two classes every Parse-wire project has whether or not it has been introspected.
 *
 * They were hard-coded into all four Record-family port builders. Kept — but only for a
 * Parse-wire backend, and only when introspection has not already reported them: offering
 * `_User` on a Directus backend would be a class that does not exist, and offering it
 * twice is what a naive concat produces once `systemCollections` is being read as well.
 */
const PARSE_SYSTEM_CLASSES: readonly { label: string; value: string }[] = Object.freeze([
  { label: 'User', value: '_User' },
  { label: 'Role', value: '_Role' }
]);

/** The Record family's schema context: `collectionName`, and both metadata keys. */
export function recordSchemaContext(
  graphModel: GraphModelLike,
  parameters: Record<string, unknown>
): SchemaPortContext {
  const sources = metaDataSources(graphModel);

  return resolveSchemaPortContext({
    graphModel,
    parameters,
    collectionParam: 'collectionName',
    extraBackends: endpointEntries(sources),
    activeBackendId: defaultBackendId(sources)
  });
}

/** The two metadata keys resolution reads, off a graph model rather than the runtime. */
export function metaDataSources(graphModel: GraphModelLike): BackendMetaDataSources {
  return {
    backendServices: graphModel.getMetaData('backendServices') as BackendServicesMetaData | undefined,
    cloudservices: graphModel.getMetaData('cloudservices') as CloudServicesMetaData | undefined
  };
}

function endpointEntries(sources: BackendMetaDataSources) {
  const endpoint = endpointBackendEntry(sources.cloudservices);
  return endpoint ? [endpoint] : [];
}

/**
 * The Backend dropdown, hidden when the project has one backend.
 *
 * The phase decision, and the hide is counted over *both* metadata keys — see the module
 * docblock. `hideWhenSingleBackend` counting only `backendServices.backends` would hide
 * the picker in exactly the project where it matters most.
 */
export function recordBackendPickerPorts(ctx: SchemaPortContext): RuntimeDiscoveredPort[] {
  return backendPickerPorts(ctx, { hideWhenSingleBackend: true, group: 'General' });
}

/** The Class dropdown, from the introspected schema of whichever backend is selected. */
export function recordClassPorts(ctx: SchemaPortContext): RuntimeDiscoveredPort[] {
  const known = new Set(ctx.collections.map((collection) => collection.name));
  const extraEnums = isParseWireContext(ctx)
    ? PARSE_SYSTEM_CLASSES.filter((entry) => !known.has(entry.value))
    : [];

  return collectionPorts(ctx, {
    name: 'collectionName',
    displayName: 'Class',
    group: 'General',
    // No `(Select collection)` entry: the Record family has never had one, and adding it
    // would write an empty string into a saved parameter that used to be absent.
    placeholderLabel: null,
    // Directus' items-vs-system split is a Directus concept reached through a port these
    // nodes do not have.
    filterByApiPathMode: false,
    extraEnums: extraEnums.slice()
  });
}

/** Is the selected backend one of the two that speak the Parse wire? */
export function isParseWireContext(ctx: SchemaPortContext): boolean {
  return ctx.backendType === undefined || ctx.backendType === 'parse' || ctx.backendType === 'nodegx';
}

export interface RecordFieldPortOptions {
  /** `'input'` for the write nodes, `'output'` for the Record node. */
  plug: 'input' | 'output';
  /** Drop `Relation` columns — they are reached through Add/Remove Relation, not a port. */
  skipRelationColumns?: boolean;
  /** Also emit a `changed-<field>` signal output per property (the Record node). */
  includeChangedSignals?: boolean;
  /** Columns the server owns. Empty by default: the Record family has never hidden them. */
  readOnlyFields?: readonly string[];
}

/**
 * One `prop-<field>` port per column of the selected class.
 *
 * The loop is the Record family's own rather than {@link fieldPorts}' because of rule 1 in
 * the module docblock — the port *type* has to come from the Parse table on a Parse
 * backend and from `getEnhancedFieldType` elsewhere, and a shared loop taking that as a
 * parameter would be a shared loop with a Record-family-only knob in it. What is shared is
 * what RUN-003 paid for: `shouldShowField` and `getEnhancedFieldType`, both of which
 * accept the cached `SchemaField` **and** the raw Directus shape.
 */
export function recordFieldPorts(
  ctx: SchemaPortContext,
  options: RecordFieldPortOptions
): RuntimeDiscoveredPort[] {
  const ports: RuntimeDiscoveredPort[] = [];
  const readOnlyFields = options.readOnlyFields || [];

  for (const field of ctx.selectedCollection?.fields || []) {
    if (readOnlyFields.includes(field.name)) continue;
    if (!shouldShowField(field)) continue;
    if (options.skipRelationColumns && field.type === 'relation') continue;

    ports.push({
      name: `prop-${field.name}`,
      displayName: field.displayName || field.name,
      type: recordPortType(field),
      plug: options.plug,
      group: 'Properties'
    });

    if (options.includeChangedSignals) {
      ports.push({
        name: `changed-${field.name}`,
        displayName: `${field.displayName || field.name} Changed`,
        type: 'signal',
        plug: 'output',
        group: 'Events'
      });
    }
  }

  return ports;
}

/**
 * A column's port type — the Parse table when the column is Parse-typed, the shared
 * enhanced mapping otherwise. See rule 1 in the module docblock for why this is not one
 * rule.
 */
export function recordPortType(field: SchemaField): RuntimeDiscoveredPort['type'] {
  if (field.nativeType && Object.prototype.hasOwnProperty.call(PARSE_PORT_TYPES, field.nativeType)) {
    return { name: PARSE_PORT_TYPES[field.nativeType] };
  }
  if (field.nativeType) {
    // A Parse type with no entry in the table: `Pointer`, `Object`, `Array`, `File`,
    // `GeoPoint`, `Relation`. All of them have always been `'*'`.
    return { name: '*' };
  }
  return getEnhancedFieldType(field).type;
}

/**
 * A wire, in the shape the runtime's `ComponentModel.connections` holds it.
 *
 * 🔴 Not the editor's shape. `NodeGraphModel.connections` spells the same four fields
 * `fromId`/`fromProperty`/`toId`/`toProperty`, and P77 SBR-008 §6.6 is what reading one
 * with the other's field names costs: a census filtered on the wrong names reported **0**
 * `prop-` wires on a graph that had nineteen, and a zero from a wrong field name is
 * indistinguishable from a zero that means "they were dropped".
 */
export interface RecordConnectionLike {
  sourceId?: string;
  sourcePort?: string;
  targetId?: string;
  targetPort?: string;
}

/** The slice of a node {@link recordWiredFieldPorts} reads. */
export interface RecordWiredPortNode {
  id: string;
  parameters?: Record<string, unknown>;
  component?: { getConnectionsTo?(id: string): unknown[]; getConnectionsFrom?(id: string): unknown[] };
}

/**
 * The field names this node's own graph requires a `prop-<field>` port for.
 *
 * 🔴 **This is the second copy of a rule the editor also holds** — `cloudDynamicPorts.ts`
 * `recordFieldNames`, which derives the same set for cloud components because WF-007 left
 * the editor with no runtime to ask. The two are graded against each other by
 * `noodl-editor/tests-unit/sb-017/cloud-ports-agree-with-the-runtime.test.ts`; keep them
 * in step or that harness goes red, which is the point of it.
 *
 * **Both ends of a wire count, regardless of plug.** The Record node publishes `prop-*`
 * as outputs and the two write nodes take them as inputs, but the rule does not branch on
 * that: `plug` is the caller's, and a wire touching this node at a `prop-` port is the
 * declaration either way. That is `NodeScope.createConnection`'s own behaviour —
 * `registerInputIfNeeded`/`registerOutputIfNeeded` mint `prop-<anything>` on the wire's
 * own port before connecting it (`nodescope.ts:149-150`).
 */
export function recordWiredFieldNames(
  nodeId: string,
  parameters: Record<string, unknown> | undefined,
  connections: readonly RecordConnectionLike[]
): string[] {
  const names: string[] = [];
  const add = (portName: unknown) => {
    if (typeof portName !== 'string' || !portName.startsWith('prop-')) return;
    const field = portName.substring('prop-'.length);
    if (field.length > 0 && !names.includes(field)) names.push(field);
  };

  for (const parameter of Object.keys(parameters || {})) add(parameter);
  for (const connection of connections) {
    if (!connection) continue;
    if (connection.targetId === nodeId) add(connection.targetPort);
    if (connection.sourceId === nodeId) add(connection.sourcePort);
  }

  return names;
}

/**
 * `prop-<field>` ports for the columns the introspected schema does not have.
 *
 * ## Why a second producer of this family exists at all
 *
 * {@link recordFieldPorts} mints one port per **column of the selected class**, and P77
 * SBR-008 is the circularity that leaves: on a fresh site a column exists once something
 * has written it, and the graph that writes it is the graph whose ports are missing. A
 * wire to a port that does not exist is an `error`-level warning, `exportComponent` drops
 * every connection `getConnectionHealth` calls unhealthy, and **all three** export callers
 * go through it — the deploy, the full project export and the viewer's own component
 * bundles. So the wire is dropped from the build, the panel writes a page with no title,
 * and the save reports success (SBR-008 §6.4, driven).
 *
 * The answer is the one `cloudDynamicPorts.ts` already took on the cloud side: **the wire
 * is the declaration.** This is that same answer, in the runtime, for the browser half.
 *
 * ## The cost, stated rather than rounded off
 *
 * A mistyped `prop-titel` now writes a `titel` column instead of warning. That is the
 * running node's behaviour reported accurately rather than a check weakened — the wire
 * *does* register the port at run time — but it is a real loss of a real warning, and the
 * same one the cloud half accepted.
 *
 * @param existingPorts ports already built from the schema. A field with a column keeps
 *   **its** port and its narrowed type: this returns only what those do not cover, so the
 *   two producers meet at one port per name rather than two. (`dedupeSchemaPorts` would
 *   also drop the double at the send, keeping whichever came first — this makes which one
 *   survives a property of the rule instead of a property of push order.)
 */
export function recordWiredFieldPorts(
  node: RecordWiredPortNode | undefined,
  existingPorts: readonly RuntimeDiscoveredPort[],
  options: RecordFieldPortOptions
): RuntimeDiscoveredPort[] {
  const component = node?.component;
  if (!node || !component) return [];

  const connections: RecordConnectionLike[] = [
    ...((component.getConnectionsTo?.(node.id) || []) as RecordConnectionLike[]),
    ...((component.getConnectionsFrom?.(node.id) || []) as RecordConnectionLike[])
  ];

  const readOnlyFields = options.readOnlyFields || [];
  const have = new Set(existingPorts.map((port) => port.name));
  const ports: RuntimeDiscoveredPort[] = [];

  for (const field of recordWiredFieldNames(node.id, node.parameters, connections)) {
    if (readOnlyFields.includes(field)) continue;
    if (have.has(`prop-${field}`)) continue;

    ports.push({
      name: `prop-${field}`,
      displayName: field,
      // `'*'` rather than a guessed column type: the type is read off the introspected
      // column and there is no column. It is what `recordPortType` already answers for
      // every Parse type with no entry in its table, so this is the family's own
      // "not narrowed" answer rather than a new one.
      type: { name: '*' },
      plug: options.plug,
      group: 'Properties'
    });
  }

  return ports;
}

/** The `relationProperty` dropdown — the class's `Relation` columns. */
export function recordRelationPorts(ctx: SchemaPortContext): RuntimeDiscoveredPort[] {
  if (!ctx.selectedCollection) return [];

  const enums = (ctx.selectedCollection.fields || [])
    .filter((field) => field.type === 'relation' || field.relationType === 'many-to-many')
    .map((field) => ({ label: field.displayName || field.name, value: field.name }));

  return [
    {
      name: 'relationProperty',
      displayName: 'Relation',
      group: 'General',
      type: { name: 'enum', enums, allowEditOnly: true },
      plug: 'input'
    }
  ];
}

/**
 * The schema the visual filter builder reads, in whichever of its two shapes fits.
 *
 * `parseSchema.ts` in the editor takes either: `{properties, relations}` for the Parse
 * family and `{collection, fields}` for BYOB. A Parse-wire backend keeps the first,
 * byte-for-byte including the reverse relation scan, because that is what the builder has
 * always been handed for these nodes. A REST backend gets the second — the one the BYOB
 * builder was written against.
 *
 * `null` when there is no schema to build a filter from, which is the caller's signal not
 * to declare the port at all (an empty filter builder is worse than no filter builder).
 */
export function recordFilterSchema(ctx: SchemaPortContext): Record<string, unknown> | null {
  if (!ctx.selectedCollection) return null;

  if (isParseWireContext(ctx)) {
    const properties: Record<string, { type?: string; targetClass?: string }> = {};
    for (const field of ctx.selectedCollection.fields || []) {
      properties[field.name] = {
        type: field.nativeType || parseTypeNameFor(field),
        ...(field.relationTarget ? { targetClass: field.relationTarget } : {})
      };
    }

    const relations: Record<string, { property: string }[]> = {};
    for (const collection of ctx.collections) {
      for (const field of collection.fields || []) {
        if (field.nativeType !== 'Relation' && field.type !== 'relation') continue;
        if (field.relationTarget !== ctx.selectedCollection.name) continue;
        if (relations[collection.name] === undefined) relations[collection.name] = [];
        relations[collection.name].push({ property: field.name });
      }
    }

    return Object.keys(relations).length > 0 ? { properties, relations } : { properties };
  }

  return {
    collection: ctx.selectedCollection.name,
    fields: getFilterFields(ctx)
  };
}

/**
 * A neutral field type spelled the way the Parse-family filter builder expects.
 *
 * Only reached for a Parse-wire backend whose cached schema came from somewhere that did
 * not record a `nativeType` — the legacy `dbCollections` metadata always does, so this is
 * the defensive half rather than the live one.
 */
function parseTypeNameFor(field: SchemaField): string | undefined {
  switch (field.type) {
    case 'string':
      return 'String';
    case 'number':
      return 'Number';
    case 'boolean':
      return 'Boolean';
    case 'dateTime':
    case 'date':
      return 'Date';
    case 'relation':
      return 'Relation';
    default:
      return undefined;
  }
}

/**
 * Which capability table the filter builder greys operators out with.
 *
 * `queryutils.backendType()` can only answer `nodegx` or `parse` — it reads
 * `CloudStore._handle()`, which is the singleton. Once a node can be pointed at Directus
 * the builder has to be told which one, or it offers PostgREST the Parse operator list.
 */
export function recordFilterBackendType(ctx: SchemaPortContext, fallback: string): string {
  return ctx.backendType || fallback;
}

/** Every backend the project can reach, for a caller that wants the list without a context. */
export function recordBackendList(graphModel: GraphModelLike) {
  return backendEntries(metaDataSources(graphModel));
}

/** Re-exported so the nodes have one import for the family's port vocabulary. */
export type { SchemaCollection, SchemaField };
