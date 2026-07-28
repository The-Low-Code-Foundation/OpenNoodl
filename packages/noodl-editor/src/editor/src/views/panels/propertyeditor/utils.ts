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

/**
 * Human label for the connection driving `portName` on `parentModel`'s node,
 * e.g. "CallCF · Result". Undefined when the port is not connected or the
 * source can't be resolved (callers fall back to the generic chip).
 */
export function getConnectionSourceLabel(parentModel: TSFixme, portName: string): string | undefined {
  const node = underlyingNode(parentModel);
  const owner = node?.owner;
  if (!node || !owner || !Array.isArray(owner.connections)) return undefined;

  const connections = owner.connections.filter((c) => c.toId === node.id && c.toProperty === portName);
  if (connections.length === 0) return undefined;

  const con = connections[0];
  const source = owner.findNodeWithId && owner.findNodeWithId(con.fromId);
  if (!source) return undefined;

  const sourceLabel = ParameterValueResolver.toString(source.label) || source.type?.displayName || '';
  if (!sourceLabel) return undefined;

  const port = source.getPort && source.getPort(con.fromProperty, 'output');
  const portLabel = (port && (port.displayName || port.name)) || con.fromProperty;

  const extra = connections.length > 1 ? ` +${connections.length - 1}` : '';
  return `${sourceLabel} · ${portLabel}${extra}`;
}

/**
 * Select (and thereby reveal) the node driving `portName` on the canvas.
 * Returns a click handler, or undefined when navigation isn't possible —
 * the chip then renders non-interactive (spec: navigate only if it exists).
 */
export function getConnectionSourceNavigate(parentModel: TSFixme, portName: string): (() => void) | undefined {
  const node = underlyingNode(parentModel);
  const owner = node?.owner;
  if (!node || !owner || !Array.isArray(owner.connections)) return undefined;

  const con = owner.connections.find((c) => c.toId === node.id && c.toProperty === portName);
  if (!con) return undefined;

  return () => {
    const editor = NodeGraphContextTmp.nodeGraph;
    const editorNode = editor?.findNodeWithId?.(con.fromId);
    if (editorNode) {
      editor.selectNode(editorNode);
    }
  };
}
