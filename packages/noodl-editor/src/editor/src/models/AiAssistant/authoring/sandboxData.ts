/**
 * AIX-008 — Sandbox preview: what data does this graph expect?
 *
 * The dataset is assembled here, in the editor, because this is where the graph
 * is. The runtime only serves what it is given (plus a generic fallback for a
 * class nobody predicted).
 *
 * Two sources, in this order of authority:
 *
 * 1. **The authoring model's `sample_data`** — it knows it built a book list,
 *    so it can say "The Left Hand of Darkness" where inference can only say
 *    "Northern Atlas 1". Always wins.
 * 2. **The graph itself** — every `prop-<field>` connection endpoint names a
 *    field something reads, and every `collectionName`/`collection` parameter
 *    names a class. Fields are attributed to a class when the node carrying
 *    them declares one, and pooled across all classes when it does not: a
 *    repeated item's fields are read inside a child component that has no idea
 *    which collection it came from, and a preview that renders a filled card is
 *    worth more than a preview that is provably right about attribution.
 *
 * @module AiAssistant/authoring/sandboxData
 */

import { completeRecord, sandboxUser, synthesizeRecords } from '@noodl/runtime/src/sandbox/synth';
import type { SandboxClass, SandboxDataset, SandboxRecord } from '@noodl/runtime/src/sandbox/types';

import type { ComponentModel } from '../../componentmodel';
import type { NodeGraphNode } from '../../nodegraphmodel';
import type { AgentSampleData } from './types';

/** How many records a class gets when nothing better is supplied. */
const RECORDS_PER_CLASS = 5;

/** Parameters that name a backend collection, across the Parse and BYOB node families. */
const CLASS_PARAMETERS = ['collectionName', 'collection', 'className', 'table'];

/** Ports that look like fields but are not: reserved names the graph reads off any record. */
const NOT_A_FIELD = new Set(['objectId', 'id', 'createdAt', 'updatedAt', 'ACL']);

const USER_NODE_PREFIX = 'net.noodl.user.';

export interface Discovery {
  /** Fields attributed to a specific class. */
  byClass: Map<string, Set<string>>;
  /** Fields read off a record whose class could not be determined. */
  pooled: Set<string>;
  /** Fields read off the signed-in user. */
  user: Set<string>;
}

function classOfNode(node: NodeGraphNode): string | undefined {
  const parameters = (node.parameters ?? {}) as Record<string, unknown>;
  for (const key of CLASS_PARAMETERS) {
    const value = parameters[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

function isUserNode(node: NodeGraphNode): boolean {
  // `node.type` resolves through the NodeLibrary; `typename` is the raw string
  // and is the only one available for a node whose type is not registered.
  return String(node.typename ?? '').startsWith(USER_NODE_PREFIX);
}

function fieldFromPort(port: string | undefined): string | undefined {
  if (!port || !port.startsWith('prop-')) return undefined;
  const field = port.slice('prop-'.length);
  return field && !NOT_A_FIELD.has(field) ? field : undefined;
}

function add(map: Map<string, Set<string>>, key: string, values: Iterable<string>) {
  const set = map.get(key) ?? new Set<string>();
  for (const value of values) set.add(value);
  map.set(key, set);
}

/** `{{title}}` in a text parameter reads a field just as surely as a connection does. */
function templateFields(node: NodeGraphNode, into: Set<string>) {
  for (const value of Object.values((node.parameters ?? {}) as Record<string, unknown>)) {
    if (typeof value !== 'string' || !value.includes('{{')) continue;
    for (const match of value.matchAll(/\{\{\s*([A-Za-z_$][\w$]*)\s*\}\}/g)) {
      if (!NOT_A_FIELD.has(match[1])) into.add(match[1]);
    }
  }
}

/**
 * Walk components for the classes they query and the fields they read.
 * `components` should be the candidate plus everything it instantiates.
 */
export function discoverDataShape(components: ComponentModel[]): Discovery {
  const discovery: Discovery = { byClass: new Map(), pooled: new Set(), user: new Set() };

  for (const component of components) {
    const nodes = new Map<string, NodeGraphNode>();
    // NB: returning truthy from this callback ABORTS the walk (forEachNode
    // propagates the return value as "stop"). Return nothing.
    component.graph.forEachNode((node: NodeGraphNode) => {
      nodes.set(node.id, node);
      const className = classOfNode(node);
      if (className) add(discovery.byClass, className, []);
      templateFields(node, discovery.pooled);
    });

    const fieldsByNode = new Map<string, Set<string>>();
    const note = (nodeId: string, port: string | undefined) => {
      const field = fieldFromPort(port);
      if (!field) return;
      const set = fieldsByNode.get(nodeId) ?? new Set<string>();
      set.add(field);
      fieldsByNode.set(nodeId, set);
    };

    for (const connection of component.graph.connections ?? []) {
      note(connection.fromId, connection.fromProperty);
      note(connection.toId, connection.toProperty);
    }

    for (const [nodeId, fields] of fieldsByNode) {
      const node = nodes.get(nodeId);
      if (!node) continue;
      if (isUserNode(node)) {
        for (const field of fields) discovery.user.add(field);
        continue;
      }
      const className = classOfNode(node);
      if (className) add(discovery.byClass, className, fields);
      else for (const field of fields) discovery.pooled.add(field);
    }
  }

  return discovery;
}

function recordsFor(fields: string[], supplied: Array<Record<string, unknown>> | undefined): SandboxRecord[] {
  if (!supplied || supplied.length === 0) return synthesizeRecords(fields, RECORDS_PER_CLASS);
  // Agent values win; inference only fills the gaps it left.
  return supplied.map((partial, index) => completeRecord(partial, fields, index));
}

export interface BuildSandboxDatasetOptions {
  /** The candidate plus every component it instantiates. */
  components: ComponentModel[];
  /** `sample_data` from the authoring model, when it supplied any. */
  sampleData?: AgentSampleData;
}

/**
 * The dataset shipped in the preview export's metadata.
 *
 * Never empty: a graph that queries nothing still gets a signed-in user, and a
 * class the graph names but nothing describes still gets five records.
 */
export function buildSandboxDataset({ components, sampleData }: BuildSandboxDatasetOptions): SandboxDataset {
  const discovery = discoverDataShape(components);

  const classNames = new Set<string>([...discovery.byClass.keys(), ...Object.keys(sampleData ?? {})]);
  const classes: Record<string, SandboxClass> = {};

  for (const className of classNames) {
    const attributed = discovery.byClass.get(className) ?? new Set<string>();
    const supplied = sampleData?.[className];
    const suppliedFields = new Set((supplied ?? []).flatMap((record) => Object.keys(record)));
    const fields = [...new Set([...attributed, ...discovery.pooled, ...suppliedFields])].filter(
      (field) => !NOT_A_FIELD.has(field)
    );

    classes[className] = { fields, records: recordsFor(fields, supplied) };
  }

  const user = sandboxUser();
  for (const field of [...discovery.user, ...discovery.pooled]) {
    if (!(field in user)) user[field] = synthesizeRecords([field], 1)[0][field];
  }
  // A user-supplied record for the _User class stands in for the session user.
  const suppliedUser = sampleData?._User?.[0] ?? sampleData?.User?.[0];
  if (suppliedUser) Object.assign(user, suppliedUser);

  const counts = Object.entries(classes).map(([name, klass]) => `${klass.records.length} ${name}`);
  const summary = counts.length > 0 ? `Sample data — ${counts.join(', ')}` : 'Sample data — signed in as a sample user';

  return { classes, user, summary };
}
