/**
 * SUB-007: render typed graph changes as human-readable sentences.
 *
 * Naming rule: a node is shown by its label when the user gave it one,
 * otherwise by its catalog display name (SUB-004), otherwise by its raw type.
 * The catalog is injected as a name provider so this module stays usable in
 * headless contexts (git merge driver, tests) without the catalog JSON.
 */

import { ComponentDiff, ConnectionRef, GraphChange, GraphConflict, NodeRef } from './types';

export type DisplayNameProvider = (typeName: string) => string | undefined;

/** Provider backed by the SUB-004 node catalog. */
export function catalogDisplayNames(): DisplayNameProvider {
  // Lazy so importing the formatter never forces the catalog JSON into a bundle.
  let lookup: DisplayNameProvider | undefined;
  return (typeName: string) => {
    if (!lookup) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { loadDefaultCatalog } = require('../validation/catalog');
        const index = loadDefaultCatalog();
        lookup = (name: string) => index.getNode(name)?.displayName;
      } catch (error) {
        lookup = () => undefined;
      }
    }
    return lookup(typeName);
  };
}

export function nodeName(ref: NodeRef | undefined, displayName: DisplayNameProvider): string {
  if (!ref) return 'unknown node';
  const typeLabel = displayName(ref.type) ?? ref.type;
  return ref.label && ref.label !== typeLabel ? `${typeLabel} '${ref.label}'` : typeLabel;
}

function endpoint(ref: ConnectionRef, side: 'from' | 'to', displayName: DisplayNameProvider): string {
  const node = side === 'from' ? ref.fromNode : ref.toNode;
  const port = side === 'from' ? ref.fromProperty : ref.toProperty;
  const nodePart = node ? nodeName(node, displayName) : side === 'from' ? ref.fromId : ref.toId;
  return `${nodePart}.${port}`;
}

function shortValue(value: unknown): string {
  if (value === undefined) return '(unset)';
  if (typeof value === 'string') return value.length > 40 ? `'${value.slice(0, 37)}…'` : `'${value}'`;
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return String(value);
  const json = JSON.stringify(value);
  return json.length > 40 ? `${json.slice(0, 37)}…` : json;
}

export interface FormatOptions {
  displayName?: DisplayNameProvider;
  /** Include cosmetic changes (canvas moves). Default false. */
  includeCosmetic?: boolean;
}

export function formatChange(change: GraphChange, options: FormatOptions = {}): string {
  const displayName = options.displayName ?? (() => undefined);
  const name = (ref: NodeRef | undefined) => nodeName(ref, displayName);

  switch (change.kind) {
    case 'node-added':
      return `Added ${name(change.node)}`;
    case 'node-removed':
      return `Removed ${name(change.node)}`;
    case 'node-recreated': {
      const detail =
        change.params.length > 0
          ? ` with ${change.params.length} parameter change${change.params.length === 1 ? '' : 's'}`
          : '';
      return `Recreated ${name(change.node)}${detail} (matched structurally)`;
    }
    case 'node-renamed':
      return `Renamed ${name({ ...change.node, label: change.fromLabel })} to '${change.toLabel ?? ''}'`;
    case 'node-type-changed':
      return `Changed type of ${name(change.node)} from ${displayName(change.fromType) ?? change.fromType} to ${
        displayName(change.toType) ?? change.toType
      }`;
    case 'node-parameters-changed': {
      const parts = change.params
        .slice(0, 3)
        .map((delta) => `${delta.name}: ${shortValue(delta.base)} → ${shortValue(delta.target)}`);
      const more = change.params.length > 3 ? `, +${change.params.length - 3} more` : '';
      return `Changed ${name(change.node)} (${parts.join(', ')}${more})`;
    }
    case 'node-state-changed': {
      const where = change.state ? ` in state '${change.state}'` : '';
      return `Changed ${change.bundle === 'stateTransitions' ? 'transitions' : 'state values'} of ${name(
        change.node
      )}${where}`;
    }
    case 'node-variant-changed':
      return `Changed variant of ${name(change.node)} from ${shortValue(change.fromVariant)} to ${shortValue(
        change.toVariant
      )}`;
    case 'node-reparented': {
      const from = change.fromParent ? name(change.fromParent) : 'top level';
      const to = change.toParent ? name(change.toParent) : 'top level';
      return `Moved ${name(change.node)} from ${from} into ${to}`;
    }
    case 'node-reordered':
      return `Reordered ${name(change.node)}${change.parent ? ` inside ${name(change.parent)}` : ''}`;
    case 'node-moved':
      return `Moved ${name(change.node)} on the canvas`;
    case 'node-ports-changed':
      return `Changed ports of ${name(change.node)}`;
    case 'connection-added':
      return `Connected ${endpoint(change.connection, 'from', displayName)} → ${endpoint(
        change.connection,
        'to',
        displayName
      )}`;
    case 'connection-removed':
      return `Disconnected ${endpoint(change.connection, 'from', displayName)} → ${endpoint(
        change.connection,
        'to',
        displayName
      )}`;
    case 'connection-rewired':
      return change.at === 'target'
        ? `Rewired ${endpoint(change.after, 'to', displayName)} to come from ${endpoint(
            change.after,
            'from',
            displayName
          )} (was ${endpoint(change.before, 'from', displayName)})`
        : `Rewired ${endpoint(change.after, 'from', displayName)} to feed ${endpoint(
            change.after,
            'to',
            displayName
          )} (was ${endpoint(change.before, 'to', displayName)})`;
    case 'comment-added':
      return `Added comment ${shortValue(change.text)}`;
    case 'comment-removed':
      return `Removed comment ${shortValue(change.text)}`;
    case 'comment-changed':
      return `Edited comment ${shortValue(change.fromText)} → ${shortValue(change.toText)}`;
    case 'comment-moved':
      return 'Moved a comment';
    case 'component-renamed':
      return `Renamed component '${change.fromName}' to '${change.toName}'`;
    case 'component-metadata-changed':
      return `Changed ${change.path}: ${shortValue(change.base)} → ${shortValue(change.target)}`;
  }
}

export function formatComponentDiff(diff: ComponentDiff, options: FormatOptions = {}): string[] {
  const changes = options.includeCosmetic ? diff.changes : diff.changes.filter((c) => c.category !== 'cosmetic');
  return changes.map((change) => formatChange(change, options));
}

export function formatConflict(conflict: GraphConflict, options: FormatOptions = {}): string {
  const displayName = options.displayName ?? (() => undefined);
  const name = conflict.node ? nodeName(conflict.node, displayName) : undefined;
  switch (conflict.kind) {
    case 'parameter':
      return `Both sides changed '${conflict.name}' on ${name}`;
    case 'source-code':
      return `Both sides edited the code in '${conflict.name}' on ${name}`;
    case 'state-parameter':
    case 'state-transition':
      return `Both sides changed '${conflict.name}' (state '${conflict.state}') on ${name}`;
    case 'default-state-transition':
      return `Both sides changed the default transition for state '${conflict.state}' on ${name}`;
    case 'label':
      return `Both sides renamed ${name}`;
    case 'variant':
      return `Both sides changed the variant of ${name}`;
    case 'typename':
      return `Both sides changed the type of ${name}`;
    case 'ports':
      return `Both sides changed port '${conflict.name}' on ${name}`;
    case 'delete-vs-edit':
      return conflict.node
        ? `${conflict.deletedBy === 'ours' ? 'You' : 'They'} deleted ${name}, which the other side edited`
        : `${conflict.deletedBy === 'ours' ? 'You' : 'They'} deleted component '${conflict.name}', which the other side edited`;
    case 'add-add':
      return `Both sides added different nodes with the same id (${name})`;
    case 'reparent':
      return `Both sides moved ${name} to different parents`;
    case 'orphaned':
      return `${name} lost its parent (deleted by ${conflict.deletedBy === 'ours' ? 'you' : 'them'}); reattached nearby`;
    case 'child-order':
      return conflict.node
        ? `Both sides reordered the children of ${name}`
        : 'Both sides reordered the top-level nodes';
    case 'connection-rewire':
      return `Both sides rewired the same input differently${
        conflict.connection?.toNode ? ` on ${nodeName(conflict.connection.toNode, displayName)}` : ''
      }`;
    case 'connection-to-deleted':
      return `A connection references ${
        conflict.connection ? 'a node' : 'something'
      } deleted by ${conflict.deletedBy === 'ours' ? 'you' : 'them'}`;
    case 'comment':
      return 'Both sides edited the same comment';
    case 'component-rename':
      return `Both sides renamed the component ('${conflict.ours}' vs '${conflict.theirs}')`;
    case 'component-metadata':
      return `Both sides changed ${conflict.name}`;
    case 'project-setting':
      return `Both sides changed the project setting '${conflict.name}'`;
  }
}
