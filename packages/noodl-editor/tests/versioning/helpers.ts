/**
 * SUB-007 test helpers: snapshot builders, the change-atomizer used by the
 * no-silent-loss property, and a seeded mutation generator.
 */

import {
  ComponentDiff,
  GraphConflict,
  GraphSnapshot,
  MergeResult,
  connectionKey,
  diffGraphs,
  fromLegacyComponent,
  mergeGraphs
} from '../../src/editor/src/versioning';

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

export type RawNode = Record<string, unknown>;

export function node(id: string, type: string, props: Record<string, unknown> = {}, children: RawNode[] = []): RawNode {
  const out: RawNode = { id, type, ...props };
  if (children.length > 0) out.children = children;
  return out;
}

export function conn(fromId: string, fromProperty: string, toId: string, toProperty: string): Record<string, unknown> {
  return { fromId, fromProperty, toId, toProperty };
}

export function comp(
  roots: RawNode[],
  connections: Record<string, unknown>[] = [],
  opts: { name?: string; comments?: Record<string, unknown>[]; metadata?: Record<string, unknown> } = {}
): GraphSnapshot {
  const component: Record<string, unknown> = {
    name: opts.name ?? 'Comp',
    graph: { roots, connections, ...(opts.comments ? { comments: opts.comments } : {}) }
  };
  if (opts.metadata) component.metadata = opts.metadata;
  return fromLegacyComponent(component);
}

// ---------------------------------------------------------------------------
// Atomization: expand a diff into comparable atomic facts
// ---------------------------------------------------------------------------

export interface Atom {
  kind: string;
  key: string;
  value: string;
  nodeId?: string;
  commentKey?: string;
  path?: string;
}

const encode = (value: unknown) => JSON.stringify(value === undefined ? '__absent__' : value);

export function atomsOf(diff: ComponentDiff): Atom[] {
  const atoms: Atom[] = [];
  for (const change of diff.changes) {
    if (change.category === 'cosmetic') continue;
    switch (change.kind) {
      case 'node-added':
        atoms.push({ kind: 'node-added', key: `node-add:${change.node.id}`, value: '', nodeId: change.node.id });
        break;
      case 'node-removed':
        atoms.push({ kind: 'node-removed', key: `node-del:${change.node.id}`, value: '', nodeId: change.node.id });
        break;
      case 'node-renamed':
        atoms.push({ kind: 'label', key: `label:${change.node.id}`, value: encode(change.toLabel), nodeId: change.node.id });
        break;
      case 'node-type-changed':
        atoms.push({ kind: 'type', key: `type:${change.node.id}`, value: change.toType, nodeId: change.node.id });
        break;
      case 'node-variant-changed':
        atoms.push({
          kind: 'variant',
          key: `variant:${change.node.id}`,
          value: encode(change.toVariant),
          nodeId: change.node.id
        });
        break;
      case 'node-parameters-changed':
        for (const delta of change.params) {
          atoms.push({
            kind: 'param',
            key: `param:${change.node.id}:${delta.name}`,
            value: encode(delta.target),
            nodeId: change.node.id
          });
        }
        break;
      case 'node-state-changed':
        for (const delta of change.params) {
          atoms.push({
            kind: 'state',
            key: `state:${change.node.id}:${change.bundle}:${change.state ?? '-'}:${delta.name}`,
            value: encode(delta.target),
            nodeId: change.node.id
          });
        }
        break;
      case 'node-ports-changed':
        atoms.push({ kind: 'ports', key: `ports:${change.node.id}`, value: '', nodeId: change.node.id });
        break;
      case 'node-reparented':
        atoms.push({
          kind: 'parent',
          key: `parent:${change.node.id}`,
          value: encode(change.toParent?.id ?? null),
          nodeId: change.node.id
        });
        break;
      case 'node-reordered':
        atoms.push({
          kind: 'reorder',
          key: `reorder:${change.parent?.id ?? 'root'}`,
          value: '',
          nodeId: change.node.id
        });
        break;
      case 'node-recreated':
        // Only produced with structural matching on; the checker runs with it off.
        atoms.push({ kind: 'node-removed', key: `node-del:${change.node.id}`, value: '', nodeId: change.node.id });
        atoms.push({ kind: 'node-added', key: `node-add:${change.recreatedAs.id}`, value: '', nodeId: change.recreatedAs.id });
        break;
      case 'connection-added':
        atoms.push({ kind: 'conn-add', key: `conn-add:${connectionKey(change.connection)}`, value: '' });
        break;
      case 'connection-removed':
        atoms.push({ kind: 'conn-del', key: `conn-del:${connectionKey(change.connection)}`, value: '' });
        break;
      case 'connection-rewired':
        atoms.push({ kind: 'conn-del', key: `conn-del:${connectionKey(change.before)}`, value: '' });
        atoms.push({ kind: 'conn-add', key: `conn-add:${connectionKey(change.after)}`, value: '' });
        break;
      case 'connection-relabelled':
        atoms.push({
          kind: 'conn-label',
          key: `conn-label:${connectionKey(change.connection)}`,
          value: encode(change.toLabel)
        });
        break;
      case 'comment-added':
        atoms.push({ kind: 'comment', key: `comment-add:${change.commentKey}`, value: change.text, commentKey: change.commentKey });
        break;
      case 'comment-removed':
        atoms.push({ kind: 'comment', key: `comment-del:${change.commentKey}`, value: '', commentKey: change.commentKey });
        break;
      case 'comment-changed':
        atoms.push({ kind: 'comment', key: `comment-edit:${change.commentKey}`, value: change.toText, commentKey: change.commentKey });
        break;
      case 'component-renamed':
        atoms.push({ kind: 'rename', key: 'rename', value: change.toName });
        break;
      case 'component-metadata-changed':
        atoms.push({ kind: 'meta', key: `meta:${change.path}`, value: encode(change.target), path: change.path });
        break;
    }
  }
  return atoms;
}

// ---------------------------------------------------------------------------
// Conflict coverage: does a conflict account for a side change the merge
// did not apply?
// ---------------------------------------------------------------------------

export function conflictCovers(conflict: GraphConflict, atom: Atom): boolean {
  const nodeId = conflict.node?.id;
  switch (conflict.kind) {
    case 'parameter':
    case 'source-code':
      return atom.key === `param:${nodeId}:${conflict.name}`;
    case 'state-parameter':
      return atom.key === `state:${nodeId}:stateParameters:${conflict.state}:${conflict.name}`;
    case 'state-transition':
      return atom.key === `state:${nodeId}:stateTransitions:${conflict.state}:${conflict.name}`;
    case 'default-state-transition':
      return atom.key === `state:${nodeId}:defaultStateTransitions:-:${conflict.state}`;
    case 'label':
      return atom.key === `label:${nodeId}`;
    case 'variant':
      return atom.key === `variant:${nodeId}`;
    case 'typename':
      return atom.key === `type:${nodeId}`;
    case 'ports':
      return atom.key === `ports:${nodeId}`;
    case 'reparent':
      return atom.nodeId === nodeId && (atom.kind === 'parent' || atom.kind === 'reorder');
    case 'orphaned':
      return atom.nodeId === nodeId || atom.kind === 'reorder';
    case 'delete-vs-edit':
    case 'add-add':
      return atom.nodeId !== undefined && atom.nodeId === nodeId;
    case 'child-order':
      return atom.kind === 'reorder' && atom.key === `reorder:${conflict.node?.id ?? 'root'}`;
    case 'connection-rewire':
    case 'connection-to-deleted':
      return (
        conflict.connection !== undefined &&
        (atom.key === `conn-add:${connectionKey(conflict.connection)}` ||
          atom.key === `conn-del:${connectionKey(conflict.connection)}`)
      );
    case 'connection-label':
    case 'connection-label-deleted':
      return (
        conflict.connection !== undefined && atom.key === `conn-label:${connectionKey(conflict.connection)}`
      );
    case 'comment':
      return atom.commentKey !== undefined && atom.commentKey === conflict.name;
    case 'component-rename':
      return atom.kind === 'rename';
    case 'component-metadata':
      return (
        atom.kind === 'meta' &&
        (atom.path === conflict.name ||
          atom.path.startsWith(`${conflict.name}.`) ||
          conflict.name.startsWith(`${atom.path}.`))
      );
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// The no-silent-loss property
// ---------------------------------------------------------------------------

export interface NoLossReport {
  result: MergeResult;
  lost: { side: 'ours' | 'theirs'; atom: Atom }[];
}

/**
 * Every semantic base→side change must either appear in diff(base, merged) or
 * be covered by a conflict. Returns the merge result plus any lost atoms.
 */
export function checkNoLoss(base: GraphSnapshot, ours: GraphSnapshot, theirs: GraphSnapshot): NoLossReport {
  const result = mergeGraphs(base, ours, theirs);
  const mergedAtoms = atomsOf(diffGraphs(base, result.merged, { structuralMatching: false }));
  const mergedKeys = new Map<string, Set<string>>();
  for (const atom of mergedAtoms) {
    if (!mergedKeys.has(atom.key)) mergedKeys.set(atom.key, new Set());
    mergedKeys.get(atom.key).add(atom.value);
  }
  const applied = (atom: Atom, side: GraphSnapshot) => {
    const values = mergedKeys.get(atom.key);
    // Valueless atoms match on key alone; valued atoms must match exactly.
    if (values && (atom.value === '' || values.has(atom.value))) return true;
    if (atom.kind === 'reorder') {
      // The LCS marks an ambiguous "mover" (swapping a and b can flag either),
      // and members the other side deleted/reparented make an order intent
      // partially vacuous. The real question: is this side's relative order
      // among the siblings that still live under this parent honored?
      const parentKey = atom.key.slice('reorder:'.length);
      const parent = parentKey === 'root' ? undefined : parentKey;
      const sequence = (snapshot: GraphSnapshot) =>
        [...snapshot.nodes.values()]
          .filter((n) => n.parent === parent)
          .sort((a, b) => a.childIndex - b.childIndex || (a.id < b.id ? -1 : 1))
          .map((n) => n.id);
      const sideSeq = sequence(side);
      const mergedSeq = sequence(result.merged);
      const mergedSet = new Set(mergedSeq);
      const sideSet = new Set(sideSeq);
      const sideShared = sideSeq.filter((id) => mergedSet.has(id));
      const mergedShared = mergedSeq.filter((id) => sideSet.has(id));
      if (sideShared.join('|') === mergedShared.join('|')) return true;
    }
    return false;
  };
  const covered = (atom: Atom) => result.conflicts.some((conflict) => conflictCovers(conflict, atom));

  const lost: NoLossReport['lost'] = [];
  for (const [side, snapshot] of [
    ['ours', ours],
    ['theirs', theirs]
  ] as const) {
    for (const atom of atomsOf(diffGraphs(base, snapshot, { structuralMatching: false }))) {
      if (!applied(atom, snapshot) && !covered(atom)) lost.push({ side, atom });
    }
  }
  return { result, lost };
}

/** Structural sanity of a merged snapshot: parents resolvable, no cycles, endpoints exist. */
export function checkInvariants(snapshot: GraphSnapshot): string[] {
  const problems: string[] = [];
  for (const node of snapshot.nodes.values()) {
    if (node.parent !== undefined && !snapshot.nodes.has(node.parent)) {
      problems.push(`node ${node.id} has missing parent ${node.parent}`);
    }
    const seen = new Set<string>();
    let cursor: string | undefined = node.id;
    while (cursor !== undefined) {
      if (seen.has(cursor)) {
        problems.push(`parent cycle at ${cursor}`);
        break;
      }
      seen.add(cursor);
      cursor = snapshot.nodes.get(cursor)?.parent;
    }
  }
  for (const connection of snapshot.connections) {
    if (!snapshot.nodes.has(connection.fromId) || !snapshot.nodes.has(connection.toId)) {
      problems.push(`dangling connection ${connectionKey(connection)}`);
    }
  }
  return problems;
}

// ---------------------------------------------------------------------------
// Seeded generator (deterministic; no Math.random so failures reproduce)
// ---------------------------------------------------------------------------

export class Rng {
  private state: number;
  constructor(seed: number) {
    this.state = seed >>> 0 || 1;
  }
  next(): number {
    // LCG (numerical recipes)
    this.state = (this.state * 1664525 + 1013904223) >>> 0;
    return this.state / 0x100000000;
  }
  int(max: number): number {
    return Math.floor(this.next() * max);
  }
  pick<T>(items: T[]): T {
    return items[this.int(items.length)];
  }
}

export interface MutableComponent {
  roots: RawNode[];
  connections: Record<string, unknown>[];
  comments: Record<string, unknown>[];
  name: string;
  metadata: Record<string, unknown>;
}

export function baseComponent(): MutableComponent {
  return {
    name: 'Comp',
    roots: [
      node('g1', 'Group', { x: 0, y: 0 }, [
        node('t1', 'Text', { x: 10, y: 10, parameters: { text: 'hello', fontSize: 12 } }),
        node('b1', 'net.noodl.controls.button', { x: 10, y: 60, parameters: { label: 'Go' } }),
        node('i1', 'net.noodl.controls.textinput', { x: 10, y: 110 })
      ]),
      node('g2', 'Group', { x: 400, y: 0 }, [
        node('t2', 'Text', { x: 410, y: 10, parameters: { text: 'world' } }),
        node('r1', 'Group', { x: 410, y: 60 })
      ]),
      node('f1', 'JavaScriptFunction', {
        x: 0,
        y: 400,
        parameters: { functionScript: 'return 1;\n' },
        metadata: { merge: { soureCodePorts: ['functionScript'] } }
      })
    ],
    connections: [
      conn('b1', 'click', 'f1', 'run'),
      conn('i1', 'text', 't1', 'text'),
      conn('f1', 'result', 't2', 'text')
    ],
    comments: [
      { id: 'c1', text: 'header area', x: 0, y: -50, width: 100, height: 40 },
      { id: 'c2', text: 'logic', x: 0, y: 350, width: 100, height: 40 }
    ],
    metadata: { canvasSize: { width: 375, height: 667 }, foo: 'bar' }
  };
}

function allNodes(component: MutableComponent): RawNode[] {
  const out: RawNode[] = [];
  const walk = (nodes: RawNode[]) => {
    for (const raw of nodes) {
      out.push(raw);
      if (Array.isArray(raw.children)) walk(raw.children as RawNode[]);
    }
  };
  walk(component.roots);
  return out;
}

function removeFromTree(component: MutableComponent, id: string): boolean {
  const prune = (nodes: RawNode[]): boolean => {
    const index = nodes.findIndex((raw) => raw.id === id);
    if (index !== -1) {
      if (Array.isArray(nodes[index].children) && (nodes[index].children as RawNode[]).length > 0) return false;
      nodes.splice(index, 1);
      return true;
    }
    for (const raw of nodes) {
      if (Array.isArray(raw.children) && prune(raw.children as RawNode[])) return true;
    }
    return false;
  };
  return prune(component.roots);
}

function subtreeIds(raw: RawNode): Set<string> {
  const ids = new Set<string>();
  const walk = (current: RawNode) => {
    ids.add(String(current.id));
    if (Array.isArray(current.children)) (current.children as RawNode[]).forEach(walk);
  };
  walk(raw);
  return ids;
}

function detach(component: MutableComponent, id: string): RawNode | undefined {
  let found: RawNode | undefined;
  const prune = (nodes: RawNode[]): boolean => {
    const index = nodes.findIndex((raw) => raw.id === id);
    if (index !== -1) {
      found = nodes.splice(index, 1)[0];
      return true;
    }
    return nodes.some((raw) => Array.isArray(raw.children) && prune(raw.children as RawNode[]));
  };
  prune(component.roots);
  return found;
}

/** Apply `count` seeded mutations in place. Side is 'o' or 't' for fresh-id uniqueness. */
export function mutate(component: MutableComponent, rng: Rng, count: number, side: string): void {
  for (let i = 0; i < count; i++) {
    const nodes = allNodes(component);
    const op = rng.int(14);
    switch (op) {
      case 0: {
        // add node under a random parent (or root)
        const id = `n-${side}-${i}`;
        const fresh = node(id, rng.pick(['Text', 'Group', 'Image']), {
          x: rng.int(500),
          y: rng.int(500),
          parameters: { text: `added-${side}-${i}` }
        });
        const parent = rng.int(nodes.length + 1) === 0 ? undefined : rng.pick(nodes);
        if (parent) {
          if (!Array.isArray(parent.children)) parent.children = [];
          (parent.children as RawNode[]).splice(rng.int((parent.children as RawNode[]).length + 1), 0, fresh);
        } else {
          component.roots.splice(rng.int(component.roots.length + 1), 0, fresh);
        }
        break;
      }
      case 1: {
        // delete a leaf node plus its connections (mimics the editor)
        const leaves = nodes.filter((raw) => !Array.isArray(raw.children) || (raw.children as RawNode[]).length === 0);
        if (leaves.length === 0) break;
        const target = rng.pick(leaves);
        if (removeFromTree(component, String(target.id))) {
          component.connections = component.connections.filter(
            (c) => c.fromId !== target.id && c.toId !== target.id
          );
        }
        break;
      }
      case 2: {
        // change or add a parameter
        const target = rng.pick(nodes);
        const params = (target.parameters as Record<string, unknown>) ?? {};
        target.parameters = params;
        const key = rng.next() < 0.5 && Object.keys(params).length > 0 ? rng.pick(Object.keys(params)) : `p${rng.int(4)}`;
        params[key] = `v-${side}-${i}`;
        break;
      }
      case 3: {
        // delete a parameter
        const withParams = nodes.filter((raw) => raw.parameters && Object.keys(raw.parameters).length > 0);
        if (withParams.length === 0) break;
        const target = rng.pick(withParams);
        const params = target.parameters as Record<string, unknown>;
        delete params[rng.pick(Object.keys(params))];
        break;
      }
      case 4: {
        rng.pick(nodes).label = `label-${side}-${i}`;
        break;
      }
      case 5: {
        rng.pick(nodes).variant = `variant-${side}-${rng.int(3)}`;
        break;
      }
      case 6: {
        // move on canvas (cosmetic)
        const target = rng.pick(nodes);
        target.x = rng.int(1000);
        target.y = rng.int(1000);
        break;
      }
      case 7: {
        // reparent a node to root or under a node outside its subtree
        const target = rng.pick(nodes);
        const forbidden = subtreeIds(target);
        const candidates = nodes.filter((raw) => !forbidden.has(String(raw.id)));
        const detached = detach(component, String(target.id));
        if (!detached) break;
        if (candidates.length === 0 || rng.next() < 0.3) {
          component.roots.splice(rng.int(component.roots.length + 1), 0, detached);
        } else {
          const parent = rng.pick(candidates);
          if (!Array.isArray(parent.children)) parent.children = [];
          (parent.children as RawNode[]).splice(rng.int((parent.children as RawNode[]).length + 1), 0, detached);
        }
        break;
      }
      case 8: {
        // add a connection between existing nodes
        if (nodes.length < 2) break;
        const from = rng.pick(nodes);
        const to = rng.pick(nodes);
        if (from.id === to.id) break;
        const candidate = conn(String(from.id), `out${rng.int(3)}`, String(to.id), `in${rng.int(3)}`);
        const key = `${candidate.fromId}:${candidate.fromProperty}->${candidate.toId}:${candidate.toProperty}`;
        if (
          !component.connections.some(
            (c) => `${c.fromId}:${c.fromProperty}->${c.toId}:${c.toProperty}` === key
          )
        ) {
          component.connections.push(candidate);
        }
        break;
      }
      case 9: {
        if (component.connections.length === 0) break;
        component.connections.splice(rng.int(component.connections.length), 1);
        break;
      }
      case 13: {
        // write (or clear) an author label on a wire — CAN-002
        if (component.connections.length === 0) break;
        const target = component.connections[rng.int(component.connections.length)];
        if (rng.next() < 0.25) delete target.label;
        else target.label = `why-${side}-${i}`;
        break;
      }
      case 10: {
        // comment ops
        const action = rng.int(3);
        if (action === 0) {
          component.comments.push({ id: `c-${side}-${i}`, text: `note ${side} ${i}`, x: rng.int(500), y: rng.int(500) });
        } else if (component.comments.length > 0) {
          const index = rng.int(component.comments.length);
          if (action === 1) component.comments.splice(index, 1);
          else component.comments[index].text = `edited ${side} ${i}`;
        }
        break;
      }
      case 11: {
        component.metadata[rng.pick(['foo', 'zed', 'canvasSize'])] = `m-${side}-${i}`;
        break;
      }
      case 12: {
        // edit source code on the function node
        const fn = nodes.find((raw) => raw.id === 'f1');
        if (!fn) break;
        const params = (fn.parameters as Record<string, unknown>) ?? {};
        fn.parameters = params;
        params.functionScript = `return ${rng.int(100)}; // ${side}\n`;
        break;
      }
    }
  }
}

export function toSnapshot(component: MutableComponent): GraphSnapshot {
  return comp(component.roots, component.connections, {
    name: component.name,
    comments: component.comments,
    metadata: component.metadata
  });
}

export function cloneComponent(component: MutableComponent): MutableComponent {
  return JSON.parse(JSON.stringify(component));
}
