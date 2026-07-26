/**
 * LIB-005: the flat item model behind the import flow's browse list.
 *
 * Six inventory categories (components, resources, modules, variants, color
 * styles, text styles) become one `FlowItem` list so search, folder grouping and
 * selection are written once instead of six times. Everything downstream — the
 * tree, the search filter, the selection set — keys off `FlowItem.key`.
 *
 * @module noodl-editor/views/ImportFlow/model/items
 */

import type { ProjectData, RawNode, SourceInventory } from '@noodl-utils/import-engine';

export type ItemCategory = 'component' | 'resource' | 'module' | 'variant' | 'colorStyle' | 'textStyle';

export const CATEGORY_ORDER: ItemCategory[] = [
  'component',
  'resource',
  'module',
  'variant',
  'colorStyle',
  'textStyle'
];

export const CATEGORY_LABEL: Record<ItemCategory, string> = {
  component: 'Components',
  resource: 'Files',
  module: 'Modules',
  variant: 'Variants',
  colorStyle: 'Color styles',
  textStyle: 'Text styles'
};

/** Singular, for sentences like "1 component". */
export const CATEGORY_NOUN: Record<ItemCategory, string> = {
  component: 'component',
  resource: 'file',
  module: 'module',
  variant: 'variant',
  colorStyle: 'color style',
  textStyle: 'text style'
};

export interface FlowItem {
  /** Category-qualified, unique across the whole flow. */
  key: string;
  category: ItemCategory;
  /** The name the engine knows the item by (`/Folder/Button`, `icons/arrow.svg`, …). */
  name: string;
  /** Variants only — the node type the variant applies to. */
  typename?: string;
  /** Last path segment: what a row shows. */
  label: string;
  /** Folder path with a leading slash, `''` at the root. */
  folder: string;
  /**
   * Components only: how many nodes the component's graph holds.
   *
   * This is the flow's honest substitute for a rendered thumbnail (see
   * LIB-005-NOTES.md — `noodl-preview` cannot produce images). It costs one walk
   * of data already in memory and answers the question a thumbnail is really
   * asked here: how big is this thing I am about to take?
   */
  nodeCount?: number;
}

/** Split a name into its folder path and last segment; both leading-slash normalized. */
export function splitPath(name: string): { folder: string; label: string } {
  const path = name.startsWith('/') ? name : `/${name}`;
  const parts = path.split('/');
  return { label: parts[parts.length - 1], folder: parts.slice(0, parts.length - 1).join('/') };
}

export function itemKey(category: ItemCategory, name: string, typename?: string): string {
  return category === 'variant' ? `variant:${typename ?? ''}/${name}` : `${category}:${name}`;
}

/** Count every node in a component graph, children included. */
export function countNodes(roots: RawNode[] | undefined): number {
  if (!roots) return 0;
  let total = 0;
  const walk = (nodes: RawNode[]) => {
    for (const node of nodes) {
      total += 1;
      if (node.children) walk(node.children);
    }
  };
  walk(roots);
  return total;
}

function make(category: ItemCategory, name: string, typename?: string, nodeCount?: number): FlowItem {
  const { folder, label } = splitPath(name);
  return { key: itemKey(category, name, typename), category, name, typename, label, folder, nodeCount };
}

/**
 * Flatten an inventory into `FlowItem`s. `sourceProject` is optional and only
 * supplies component node counts.
 */
export function buildItems(inventory: SourceInventory, sourceProject?: ProjectData): FlowItem[] {
  const nodeCounts = new Map<string, number>();
  for (const component of sourceProject?.components ?? []) {
    nodeCounts.set(component.name, countNodes(component.graph?.roots));
  }

  return [
    ...inventory.components.map((c) => make('component', c.name, undefined, nodeCounts.get(c.name))),
    ...inventory.resources.map((r) => make('resource', r.name)),
    ...inventory.modules.map((m) => make('module', m.name)),
    ...inventory.variants.map((v) => make('variant', v.name, v.typename)),
    ...inventory.styles.colors.map((c) => make('colorStyle', c.name)),
    ...inventory.styles.text.map((t) => make('textStyle', t.name))
  ];
}

// ─── Folder tree ─────────────────────────────────────────────────────────────

export type TreeNode =
  | { type: 'item'; key: string; item: FlowItem; depth: number }
  | { type: 'folder'; key: string; path: string; label: string; depth: number; children: TreeNode[] };

/**
 * Group items into their folder tree, folders before items at each level and
 * both alphabetical — the shape the component panel uses, so an imported project
 * reads the way the user's own project does.
 */
export function buildTree(items: FlowItem[]): TreeNode[] {
  const roots: TreeNode[] = [];
  const folders = new Map<string, TreeNode & { type: 'folder' }>();

  function childrenOf(path: string): TreeNode[] {
    if (path === '') return roots;
    const existing = folders.get(path);
    if (existing) return existing.children;

    const parts = path.split('/');
    const node: TreeNode & { type: 'folder' } = {
      type: 'folder',
      key: `folder:${path}`,
      path,
      label: parts[parts.length - 1],
      depth: parts.length - 1,
      children: []
    };
    folders.set(path, node);
    childrenOf(parts.slice(0, parts.length - 1).join('/')).push(node);
    return node.children;
  }

  [...items]
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach((item) => {
      const depth = (item.folder === '' ? '' : item.folder).split('/').length - 1;
      childrenOf(item.folder).push({ type: 'item', key: item.key, item, depth: depth + 1 });
    });

  const sortLevel = (nodes: TreeNode[]): TreeNode[] => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      const an = a.type === 'folder' ? a.label : a.item.label;
      const bn = b.type === 'folder' ? b.label : b.item.label;
      return an.localeCompare(bn);
    });
    for (const node of nodes) if (node.type === 'folder') sortLevel(node.children);
    return nodes;
  };

  return sortLevel(roots);
}

/** Every item key beneath a tree node, the node itself included. */
export function itemKeysUnder(node: TreeNode): string[] {
  if (node.type === 'item') return [node.key];
  return node.children.flatMap(itemKeysUnder);
}

/**
 * Case-insensitive substring match against the full name, so `button` finds
 * `/Forms/Button` and `forms/` finds everything in that folder.
 */
export function matchesQuery(item: FlowItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q === '') return true;
  return item.name.toLowerCase().includes(q) || (item.typename ?? '').toLowerCase().includes(q);
}
