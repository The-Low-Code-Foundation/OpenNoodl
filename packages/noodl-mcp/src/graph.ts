/**
 * Graph-shape helpers for authoring: hierarchy reconciliation and the batched
 * component-update operations.
 *
 * These checks are *shape* sanity (ids unique, parent/children consistent, no
 * cycles) — semantic correctness (types, ports, connection endpoints) is the
 * validator's job and runs afterwards on every write.
 */

import type { ComponentV2File, ConnectionV2, ConnectionsV2File, NodePort, NodeV2, NodesV2File } from './editor-deps';
import { metadataWithComment } from './editor-deps';

export interface ComponentFiles {
  component: ComponentV2File;
  nodes: NodesV2File;
  connections: ConnectionsV2File;
}

// ─── Hierarchy reconciliation ─────────────────────────────────────────────────

/**
 * LAS-012 — the one door in this file that a model walks into believing a
 * Repeater is a container.
 *
 * Qwen's session-6 replay tried twice to nest the item component under the
 * repeater and got `Node "products-repeater" lists unknown child
 * "product-card"` — a shape error, thrown as `invalid-argument`, which is a
 * path that carries **no LAS-007 recipe** and says nothing about what a
 * repeater's template actually is. It gave up on the list. Haiku made the same
 * mistake with a child that *did* exist, so it sailed through here and shipped
 * three sections that never drew (`checkRepeaterTemplate` is that half).
 *
 * The attachment machinery is diagnostic-keyed and these errors are plain
 * strings on a different path, so rather than plumb it here the knowledge goes
 * in the message. One sentence, at the only moment it matters.
 */
function repeaterChildHint(parent: NodeV2): string {
  if (parent.type !== 'For Each') return '';
  return (
    ' A For Each is not a container: it instantiates the component named on its "template" parameter once' +
    ' per item and inserts each copy as its own next sibling, so item markup is never nested under it.' +
    ' Create the item component separately and set template to its path, e.g. "/Components/ProductCard".'
  );
}

/**
 * Normalises the parent/children double-bookkeeping of nodes.json.
 *
 * Agents may author with `parent` only, `children` only, or both. Policy:
 *  - `children` arrays, when present, are authoritative for ORDER (render order
 *    matters in visual trees).
 *  - Every child listed must either not declare a parent or declare the same
 *    parent; the missing side is filled in.
 *  - Nodes whose `parent` is set but never listed in that parent's `children`
 *    are appended (declaration order).
 * Returns reconciled copies; original objects are not mutated.
 */
export function reconcileHierarchy(inputNodes: NodeV2[]): { nodes: NodeV2[]; errors: string[] } {
  const errors: string[] = [];
  const nodes = inputNodes.map((n) => ({ ...n })) as NodeV2[];
  const byId = new Map<string, NodeV2>();

  for (const n of nodes) {
    if (!n.id || typeof n.id !== 'string') {
      errors.push(`A node is missing an "id" (type: ${String(n.type)}).`);
      continue;
    }
    if (byId.has(n.id)) errors.push(`Duplicate node id "${n.id}".`);
    byId.set(n.id, n);
  }
  if (errors.length > 0) return { nodes, errors };

  // children[] → parent
  for (const n of nodes) {
    if (!n.children) continue;
    for (const childId of n.children) {
      const child = byId.get(childId);
      if (!child) {
        errors.push(`Node "${n.id}" lists unknown child "${childId}".${repeaterChildHint(n)}`);
        continue;
      }
      if (child.parent !== undefined && child.parent !== n.id) {
        errors.push(`Node "${childId}" is listed as a child of "${n.id}" but declares parent "${child.parent}".`);
        continue;
      }
      child.parent = n.id;
    }
  }

  // parent → children[] (append when not already listed)
  for (const n of nodes) {
    if (n.parent === undefined) continue;
    const parent = byId.get(n.parent);
    if (!parent) {
      errors.push(`Node "${n.id}" declares unknown parent "${n.parent}".`);
      continue;
    }
    if (!parent.children) parent.children = [];
    if (!parent.children.includes(n.id)) parent.children.push(n.id);
  }

  // Drop empty children arrays for a clean serialisation.
  for (const n of nodes) {
    if (n.children && n.children.length === 0) delete n.children;
  }

  // Cycle check.
  for (const n of nodes) {
    const seen = new Set<string>();
    let cur: NodeV2 | undefined = n;
    while (cur?.parent !== undefined) {
      if (seen.has(cur.id)) {
        errors.push(`Parent cycle involving node "${cur.id}".`);
        break;
      }
      seen.add(cur.id);
      cur = byId.get(cur.parent);
    }
  }

  return { nodes, errors };
}

// ─── Update operations ────────────────────────────────────────────────────────

export type UpdateOperation =
  | { op: 'add_node'; node: NodeV2; index?: number }
  | {
      op: 'update_node';
      id: string;
      /**
       * LEG-001: `comment` is the authored name of `metadata.comment`. It never
       * lands as a top-level key — see the fold in `applyOperations`.
       */
      set?: Partial<Pick<NodeV2, 'label' | 'x' | 'y' | 'variant'>> & {
        parent?: string | null;
        comment?: string;
      };
      parameters?: Record<string, unknown>;
      unset_parameters?: string[];
      ports?: NodePort[];
    }
  | { op: 'remove_node'; id: string }
  | { op: 'add_connection'; connection: ConnectionV2 }
  | { op: 'remove_connection'; connection: ConnectionV2 }
  | { op: 'set_visual_roots'; visualRoots: string[] }
  | {
      op: 'set_ports';
      inputs?: Array<{ name: string } & Record<string, unknown>>;
      outputs?: Array<{ name: string } & Record<string, unknown>>;
    }
  | { op: 'set_component_info'; description?: string; displayName?: string; category?: string; tags?: string[] };

function sameConnection(a: ConnectionV2, b: ConnectionV2): boolean {
  return (
    a.fromId === b.fromId && a.fromProperty === b.fromProperty && a.toId === b.toId && a.toProperty === b.toProperty
  );
}

function connLabel(c: ConnectionV2): string {
  return `${c.fromId}.${c.fromProperty} → ${c.toId}.${c.toProperty}`;
}

/**
 * Applies a batch of operations to a deep copy of the component files.
 * Fails atomically at this layer too: any operation error aborts the batch and
 * the caller writes nothing.
 */
export function applyOperations(
  files: ComponentFiles,
  operations: UpdateOperation[]
): { files: ComponentFiles; errors: string[]; applied: string[] } {
  const out: ComponentFiles = JSON.parse(JSON.stringify(files));
  const errors: string[] = [];
  const applied: string[] = [];
  const nodes = out.nodes.nodes;
  const byId = () => new Map(nodes.map((n) => [n.id, n]));

  for (const [i, op] of operations.entries()) {
    const fail = (msg: string) => errors.push(`operation ${i} (${op.op}): ${msg}`);

    switch (op.op) {
      case 'add_node': {
        const node = { ...op.node };
        if (!node.id) fail('node.id is required (any project-unique string).');
        else if (byId().has(node.id)) fail(`node id "${node.id}" already exists.`);
        else if (node.parent !== undefined && !byId().has(node.parent)) {
          fail(`parent "${node.parent}" does not exist.`);
        } else {
          nodes.push(node);
          if (node.parent !== undefined) {
            const parent = byId().get(node.parent)!;
            if (!parent.children) parent.children = [];
            const idx = op.index !== undefined ? Math.max(0, Math.min(op.index, parent.children.length)) : parent.children.length;
            parent.children.splice(idx, 0, node.id);
          }
          applied.push(`add_node ${node.id} (${node.type})`);
        }
        break;
      }

      case 'update_node': {
        const node = byId().get(op.id);
        if (!node) {
          fail(`node "${op.id}" does not exist.`);
          break;
        }
        if (op.set) {
          const { parent: newParent, comment, ...rest } = op.set;
          Object.assign(node, rest);
          // LEG-001 — the authored field is flat and the stored one is not, so
          // it is destructured out above rather than assigned: a top-level
          // `comment` on a stored node is read by nothing (CAN-004's stripe,
          // tooltip and context menu all read `metadata.comment`). Every other
          // key of the bag is left exactly as it was, `merge.soureCodePorts`
          // included.
          if (comment !== undefined) {
            const metadata = metadataWithComment(node.metadata, comment);
            if (metadata) node.metadata = metadata;
            else delete node.metadata;
          }
          if (newParent !== undefined) {
            // Reparent: detach from old parent, attach to new (null → detach only).
            if (node.parent !== undefined) {
              const old = byId().get(node.parent);
              if (old?.children) old.children = old.children.filter((c) => c !== node.id);
            }
            if (newParent === null) {
              delete node.parent;
            } else if (!byId().has(newParent)) {
              fail(`new parent "${newParent}" does not exist.`);
              break;
            } else {
              node.parent = newParent;
              const parent = byId().get(newParent)!;
              if (!parent.children) parent.children = [];
              if (!parent.children.includes(node.id)) parent.children.push(node.id);
            }
          }
        }
        if (op.parameters) {
          node.parameters = { ...(node.parameters ?? {}), ...op.parameters };
        }
        if (op.unset_parameters) {
          for (const key of op.unset_parameters) delete node.parameters?.[key];
        }
        if (op.ports) node.ports = op.ports;
        applied.push(`update_node ${op.id}`);
        break;
      }

      case 'remove_node': {
        const map = byId();
        if (!map.has(op.id)) {
          fail(`node "${op.id}" does not exist.`);
          break;
        }
        // Collect the whole subtree.
        const doomed = new Set<string>([op.id]);
        let grew = true;
        while (grew) {
          grew = false;
          for (const n of nodes) {
            if (n.parent !== undefined && doomed.has(n.parent) && !doomed.has(n.id)) {
              doomed.add(n.id);
              grew = true;
            }
          }
        }
        const kept = nodes.filter((n) => !doomed.has(n.id));
        nodes.splice(0, nodes.length, ...kept); // in place, so `nodes` stays the live array
        for (const n of out.nodes.nodes) {
          if (n.children) {
            n.children = n.children.filter((c) => !doomed.has(c));
            if (n.children.length === 0) delete n.children;
          }
        }
        const before = out.connections.connections.length;
        out.connections.connections = out.connections.connections.filter(
          (c) => !doomed.has(c.fromId) && !doomed.has(c.toId)
        );
        if (out.nodes.visualRoots) {
          out.nodes.visualRoots = out.nodes.visualRoots.filter((id) => !doomed.has(id));
          if (out.nodes.visualRoots.length === 0) delete out.nodes.visualRoots;
        }
        applied.push(
          `remove_node ${op.id} (${doomed.size} node(s), ${before - out.connections.connections.length} connection(s))`
        );
        break;
      }

      case 'add_connection': {
        const map = byId();
        const c = op.connection;
        if (!map.has(c.fromId)) fail(`fromId "${c.fromId}" does not exist.`);
        else if (!map.has(c.toId)) fail(`toId "${c.toId}" does not exist.`);
        else if (out.connections.connections.some((x) => sameConnection(x, c))) {
          fail(`connection already exists: ${connLabel(c)}.`);
        } else {
          out.connections.connections.push({
            fromId: c.fromId,
            fromProperty: c.fromProperty,
            toId: c.toId,
            toProperty: c.toProperty
          });
          applied.push(`add_connection ${connLabel(c)}`);
        }
        break;
      }

      case 'remove_connection': {
        const before = out.connections.connections.length;
        out.connections.connections = out.connections.connections.filter((x) => !sameConnection(x, op.connection));
        if (out.connections.connections.length === before) {
          fail(`no such connection: ${connLabel(op.connection)}.`);
        } else {
          applied.push(`remove_connection ${connLabel(op.connection)}`);
        }
        break;
      }

      case 'set_visual_roots': {
        const map = byId();
        const missing = op.visualRoots.filter((id) => !map.has(id));
        if (missing.length > 0) {
          fail(`unknown node id(s): ${missing.join(', ')}.`);
        } else {
          if (op.visualRoots.length > 0) out.nodes.visualRoots = op.visualRoots;
          else delete out.nodes.visualRoots;
          applied.push('set_visual_roots');
        }
        break;
      }

      case 'set_ports': {
        const ports: NonNullable<ComponentV2File['ports']> = {};
        if (op.inputs) ports.inputs = op.inputs as NonNullable<ComponentV2File['ports']>['inputs'];
        if (op.outputs) ports.outputs = op.outputs as NonNullable<ComponentV2File['ports']>['outputs'];
        if (Object.keys(ports).length > 0) out.component.ports = ports;
        else delete out.component.ports;
        applied.push('set_ports');
        break;
      }

      case 'set_component_info': {
        if (op.description !== undefined) out.component.description = op.description;
        if (op.displayName !== undefined) out.component.displayName = op.displayName;
        if (op.category !== undefined) out.component.category = op.category;
        if (op.tags !== undefined) out.component.tags = op.tags;
        applied.push('set_component_info');
        break;
      }
    }

    if (errors.length > 0) break; // abort batch on first error
  }

  if (errors.length === 0) {
    // Keep the double-bookkeeping consistent after the batch.
    const reconciled = reconcileHierarchy(out.nodes.nodes);
    if (reconciled.errors.length > 0) {
      errors.push(...reconciled.errors);
    } else {
      out.nodes.nodes = reconciled.nodes;
    }
  }

  return { files: out, errors, applied };
}
