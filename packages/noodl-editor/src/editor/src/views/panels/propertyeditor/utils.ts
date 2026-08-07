import { NodeGraphContextTmp } from '@noodl-contexts/NodeGraphContext/NodeGraphContext';

import { ParameterValueResolver } from '@noodl-utils/ParameterValueResolver';

export function getEditType(p) {
  return p.type?.editAsType ? p.type.editAsType : p.type;
}

/* ----------------------------------------------------------------------------
 * Node category (PAR-002 header type-chip)
 *
 * Same resolution the canvas painter uses (NodeGraphEditorNodePainter):
 * `metadata.colorOverride || type.color || 'default'` over the existing
 * taxonomy keys — component / visual / data / javascript / default. The
 * `javascript` key maps onto the *function* category token (UIX-005: there is
 * no `logic` key in the taxonomy; the amber logic token stays unused).
 * ------------------------------------------------------------------------- */

export interface NodeTypeChipInfo {
  /** Taxonomy key: component | visual | data | javascript | default */
  category: string;
  /** CSS custom property carrying the category hue */
  colorToken: string;
  /** Chip text, e.g. "Text · Visual" (CSS uppercases it) */
  label: string;
}

const CATEGORY_TOKENS: Record<string, string> = {
  visual: '--theme-color-node-category-visual',
  data: '--theme-color-node-category-data',
  javascript: '--theme-color-node-category-function',
  component: '--theme-color-node-category-component'
};

const CATEGORY_LABELS: Record<string, string> = {
  visual: 'Visual',
  data: 'Data',
  javascript: 'Function',
  component: 'Component'
};

/**
 * Resolve the header chip's category color + `TYPE · CATEGORY` label for a
 * node. `model` is a NodeGraphNode (the header renders outside the proxy).
 */
export function getNodeTypeChipInfo(model: TSFixme): NodeTypeChipInfo | undefined {
  if (!model || !model.type) return undefined;

  const category: string = model.metadata?.colorOverride || (model.type as TSFixme).color || 'default';
  const typeLabel: string = model.metadata?.typeLabelOverride || model.type.displayName || model.type.name || '';
  if (!typeLabel) return undefined;

  /**
   * The suffix names the taxonomy key, which is a COLOUR — and for most nodes
   * the colour and the category are the same word, so it reads as a category.
   * A node whose colour was chosen for its hue rather than its meaning can opt
   * out: WFA-005's trigger entry nodes are `data` because a trigger is where the
   * run's data comes from, and "Webhook · POST /both-ways · DATA" is a chip that
   * says something false in order to say something the type label already said.
   */
  const categoryLabel = model.metadata?.hideCategoryChip ? undefined : CATEGORY_LABELS[category];

  return {
    category,
    // Unknown/default categories read muted, same as the canvas default chip.
    colorToken: CATEGORY_TOKENS[category] || '--theme-color-fg-muted',
    label: categoryLabel ? `${typeLabel} · ${categoryLabel}` : typeLabel
  };
}

/* ----------------------------------------------------------------------------
 * Connection source (PAR-002 binding chip)
 * ------------------------------------------------------------------------- */

/** ModelProxy or NodeGraphNode → the underlying NodeGraphNode. */
function underlyingNode(parentModel: TSFixme) {
  return parentModel?.model ?? parentModel;
}

/** One end of a wire attached to a port: what it is, and how to go there. */
export interface PortConnectionRef {
  /** The node at the other end, e.g. "CallCF · Result". */
  label: string;
  /**
   * Select that node on the canvas. Always present here — it is the *handler*
   * that no-ops if the graph moved under it, which keeps the chip honest
   * without rendering a dead click target for a wire that exists.
   */
  navigate: () => void;
}

/**
 * Every wire attached to `portName`, as the node at the other end of it.
 *
 * `direction` is the direction of the port being asked about: an **input** is
 * asked what drives it, an **output** what it drives. An output legitimately
 * has many targets, which is why this returns a list — FH-020: *"Where does
 * `Done` go?" is the question the tab is for; `Foo · Do +3` does not answer it.*
 *
 * A wire whose far node cannot be resolved is dropped rather than rendered
 * nameless. That is a broken graph, not a port worth describing.
 */
export function getPortConnections(
  parentModel: TSFixme,
  portName: string,
  direction: 'input' | 'output'
): PortConnectionRef[] {
  const node = underlyingNode(parentModel);
  const owner = node?.owner;
  if (!node || !owner || !Array.isArray(owner.connections)) return [];

  const isInput = direction === 'input';
  const matches = owner.connections.filter((c) =>
    isInput ? c.toId === node.id && c.toProperty === portName : c.fromId === node.id && c.fromProperty === portName
  );

  const refs: PortConnectionRef[] = [];
  for (const con of matches) {
    const peerId = isInput ? con.fromId : con.toId;
    const peerPortName = isInput ? con.fromProperty : con.toProperty;

    const peer = owner.findNodeWithId && owner.findNodeWithId(peerId);
    if (!peer) continue;

    const peerLabel = ParameterValueResolver.toString(peer.label) || peer.type?.displayName || '';
    if (!peerLabel) continue;

    const port = peer.getPort && peer.getPort(peerPortName, isInput ? 'output' : 'input');
    const portLabel = (port && (port.displayName || port.name)) || peerPortName;

    refs.push({
      label: `${peerLabel} · ${portLabel}`,
      navigate: () => {
        const editor = NodeGraphContextTmp.nodeGraph;
        const editorNode = editor?.findNodeWithId?.(peerId);
        if (editorNode) {
          editor.selectNode(editorNode);
        }
      }
    });
  }

  return refs;
}

/**
 * Human label for the connection driving `portName` on `parentModel`'s node,
 * e.g. "CallCF · Result". Undefined when the port is not connected or the
 * source can't be resolved (callers fall back to the generic chip).
 *
 * One row of a property panel has room for one source, so this stays the
 * first-plus-count summary the five row classes already render. FH-020's tab
 * renders `getPortConnections` in full instead.
 */
export function getConnectionSourceLabel(parentModel: TSFixme, portName: string): string | undefined {
  const connections = getPortConnections(parentModel, portName, 'input');
  if (connections.length === 0) return undefined;

  const extra = connections.length > 1 ? ` +${connections.length - 1}` : '';
  return `${connections[0].label}${extra}`;
}

/**
 * Select (and thereby reveal) the node driving `portName` on the canvas.
 * Returns a click handler, or undefined when navigation isn't possible —
 * the chip then renders non-interactive (spec: navigate only if it exists).
 */
export function getConnectionSourceNavigate(parentModel: TSFixme, portName: string): (() => void) | undefined {
  return getPortConnections(parentModel, portName, 'input')[0]?.navigate;
}
