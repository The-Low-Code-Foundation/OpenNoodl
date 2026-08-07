/**
 * Node categorization utilities for semantic grouping and analysis
 */

import type { ComponentModel } from '@noodl-models/componentmodel';
import type { NodeGraphNode } from '@noodl-models/nodegraphmodel';

import type { CategorizedNodes, NodeCategory } from './types';

/**
 * Node type to category mapping
 * This mapping groups node types into semantic categories for analysis
 */
const NODE_TYPE_CATEGORIES: Record<string, NodeCategory> = {
  // Visual nodes
  Group: 'visual',
  Text: 'visual',
  Image: 'visual',
  Video: 'visual',
  Icon: 'visual',
  Circle: 'visual',
  Rectangle: 'visual',
  'Page Stack': 'visual',
  Columns: 'visual',
  'Scroll View': 'visual',

  // Data nodes
  Variable: 'data',
  Object: 'data',
  Array: 'data',
  Number: 'data',
  String: 'data',
  Boolean: 'data',
  'Static Array': 'data',
  'Array Filter': 'data',
  'Array Map': 'data',

  // Logic nodes
  Condition: 'logic',
  Expression: 'logic',
  Switch: 'logic',
  States: 'logic',
  'Boolean To String': 'logic',
  'String Mapper': 'logic',
  'Number Remapper': 'logic',

  // Event nodes
  'Send Event': 'events',
  'Receive Event': 'events',
  'Component Inputs': 'events',
  'Component Outputs': 'events',
  'Receive Global Event': 'events',
  'Send Global Event': 'events',

  // API/Network nodes
  REST: 'api',
  'REST v2': 'api',
  'Cloud Function': 'api',
  'Cloud Function 2.0': 'api',
  Function: 'api',
  'Javascript Function': 'api',

  // Navigation nodes
  'Page Router': 'navigation',
  Navigate: 'navigation',
  'Navigate To Path': 'navigation',
  'Navigate Back': 'navigation',
  'External Link': 'navigation',

  // Animation nodes
  'Value Changed': 'animation',
  'Did Mount': 'animation',
  'Will Unmount': 'animation'
};

/**
 * Categorize all nodes in a component by semantic type.
 *
 * @param component - Component to analyze
 * @returns Categorized node information with totals
 *
 * @example
 * ```typescript
 * const categorized = categorizeNodes(component);
 * categorized.totals.forEach(({ category, count }) => {
 *   console.log(`${category}: ${count} nodes`);
 * });
 * ```
 */
export function categorizeNodes(component: ComponentModel): CategorizedNodes {
  const byCategory = new Map<NodeCategory, NodeGraphNode[]>();
  const byType = new Map<string, NodeGraphNode[]>();

  // Initialize category maps
  const categories: NodeCategory[] = ['visual', 'data', 'logic', 'events', 'api', 'navigation', 'animation', 'utility'];
  categories.forEach((cat) => byCategory.set(cat, []));

  // Categorize each node
  component.graph.nodeMap.forEach((node) => {
    const category = getNodeCategory(node.typename);

    // Add to category map
    const categoryNodes = byCategory.get(category) || [];
    categoryNodes.push(node);
    byCategory.set(category, categoryNodes);

    // Add to type map
    const typeNodes = byType.get(node.typename) || [];
    typeNodes.push(node);
    byType.set(node.typename, typeNodes);
  });

  // Calculate totals
  const totals = categories.map((category) => ({
    category,
    count: byCategory.get(category)?.length || 0
  }));

  return { byCategory, byType, totals };
}

/**
 * Get the category for a specific node type.
 *
 * @param nodeType - Node type name
 * @returns Category for the node type
 *
 * @example
 * ```typescript
 * const category = getNodeCategory('Variable');
 * console.log(category); // 'data'
 * ```
 */
export function getNodeCategory(nodeType: string): NodeCategory {
  return NODE_TYPE_CATEGORIES[nodeType] || 'utility';
}

/**
 * Check if a node is a visual node (has visual hierarchy).
 *
 * @param node - Node to check
 * @returns True if the node is a visual node
 *
 * @example
 * ```typescript
 * if (isVisualNode(node)) {
 *   console.log('This node can have children in the visual hierarchy');
 * }
 * ```
 */
export function isVisualNode(node: NodeGraphNode): boolean {
  const category = getNodeCategory(node.typename);
  return category === 'visual';
}

/**
 * Check if a node is a data source (Variable, Object, Array, etc.).
 *
 * @param node - Node to check
 * @returns True if the node is a data source
 *
 * @example
 * ```typescript
 * if (isDataSourceNode(node)) {
 *   console.log('This node stores or provides data');
 * }
 * ```
 */
export function isDataSourceNode(node: NodeGraphNode): boolean {
  const category = getNodeCategory(node.typename);
  return category === 'data';
}

/**
 * Check if a node is a logic node (Condition, Expression, etc.).
 *
 * @param node - Node to check
 * @returns True if the node performs logical operations
 *
 * @example
 * ```typescript
 * if (isLogicNode(node)) {
 *   console.log('This node performs logical operations');
 * }
 * ```
 */
export function isLogicNode(node: NodeGraphNode): boolean {
  const category = getNodeCategory(node.typename);
  return category === 'logic';
}

/**
 * Check if a node is an event node (Send Event, Receive Event, etc.).
 *
 * @param node - Node to check
 * @returns True if the node handles events
 *
 * @example
 * ```typescript
 * if (isEventNode(node)) {
 *   console.log('This node handles event communication');
 * }
 * ```
 */
export function isEventNode(node: NodeGraphNode): boolean {
  const category = getNodeCategory(node.typename);
  return category === 'events';
}

/**
 * Get a summary of node categories in a component.
 *
 * @param component - Component to analyze
 * @returns Array of category counts sorted by count (descending)
 *
 * @example
 * ```typescript
 * const summary = getNodeCategorySummary(component);
 * console.log('Most common category:', summary[0].category);
 * ```
 */
export function getNodeCategorySummary(component: ComponentModel): { category: NodeCategory; count: number }[] {
  const categorized = categorizeNodes(component);
  return categorized.totals.filter((t) => t.count > 0).sort((a, b) => b.count - a.count);
}

/**
 * Get a summary of node types in a component.
 *
 * @param component - Component to analyze
 * @returns Array of type counts sorted by count (descending)
 *
 * @example
 * ```typescript
 * const summary = getNodeTypeSummary(component);
 * console.log('Most common node type:', summary[0].type);
 * ```
 */
export function getNodeTypeSummary(
  component: ComponentModel
): { type: string; category: NodeCategory; count: number }[] {
  const categorized = categorizeNodes(component);
  const summary: { type: string; category: NodeCategory; count: number }[] = [];

  categorized.byType.forEach((nodes, type) => {
    summary.push({
      type,
      category: getNodeCategory(type),
      count: nodes.length
    });
  });

  return summary.sort((a, b) => b.count - a.count);
}
