/**
 * Duplicate node detection utilities for finding potential naming conflicts
 */

import { ComponentModel } from '@noodl-models/componentmodel';
import type { NodeGraphNode } from '@noodl-models/nodegraphmodel';
import { ProjectModel } from '@noodl-models/projectmodel';

import { getConnectedNodes } from './traversal';
import type { ConflictAnalysis, DuplicateGroup } from './types';

/**
 * Find potential duplicate nodes within a component.
 * Duplicates = same type + same/similar name.
 *
 * @param component - Component to analyze
 * @returns Array of duplicate groups found
 *
 * @example
 * ```typescript
 * const duplicates = findDuplicatesInComponent(component);
 * duplicates.forEach(group => {
 *   console.log(`Found ${group.instances.length} nodes named "${group.name}"`);
 * });
 * ```
 */
export function findDuplicatesInComponent(component: ComponentModel): DuplicateGroup[] {
  const groups = new Map<string, NodeGraphNode[]>();

  // Group nodes by type and name
  component.graph.nodeMap.forEach((node) => {
    const name = node.label || node.typename;
    const key = `${node.typename}:${name.toLowerCase().trim()}`;

    const existing = groups.get(key) || [];
    existing.push(node);
    groups.set(key, existing);
  });

  // Filter to only groups with more than one node
  const duplicates: DuplicateGroup[] = [];

  groups.forEach((nodes, key) => {
    if (nodes.length > 1) {
      const [typename, name] = key.split(':');

      // Calculate connection count for each instance
      const instances = nodes.map((node) => {
        const connections = getConnectedNodes(component, node.id);
        const connectionCount = connections.inputs.length + connections.outputs.length;

        return {
          node,
          component,
          connectionCount
        };
      });

      // Determine severity
      let severity: DuplicateGroup['severity'] = 'info';
      let reason = 'Multiple nodes with the same name';

      // Higher severity for data nodes (potential conflicts)
      if (['Variable', 'Object', 'Array'].includes(typename)) {
        severity = 'warning';
        reason = 'Multiple data nodes with the same name may cause confusion';
      }

      // Critical for Send/Receive Event with same name
      if (['Send Event', 'Receive Event'].includes(typename)) {
        severity = 'error';
        reason = 'Multiple event nodes with the same channel name will all trigger';
      }

      duplicates.push({
        name,
        type: typename,
        instances,
        severity,
        reason
      });
    }
  });

  return duplicates;
}

/**
 * Find potential duplicate nodes across the entire project.
 *
 * @param project - Project to analyze
 * @returns Array of duplicate groups found across all components
 *
 * @example
 * ```typescript
 * const duplicates = findDuplicatesInProject(project);
 * duplicates.forEach(group => {
 *   const components = new Set(group.instances.map(i => i.component.name));
 *   console.log(`"${group.name}" found in ${components.size} components`);
 * });
 * ```
 */
export function findDuplicatesInProject(project: ProjectModel): DuplicateGroup[] {
  const allDuplicates: DuplicateGroup[] = [];

  project.forEachComponent((component: ComponentModel) => {
    const componentDuplicates = findDuplicatesInComponent(component);
    allDuplicates.push(...componentDuplicates);
  });

  return allDuplicates;
}

/**
 * Analyze if duplicates might cause conflicts.
 * E.g., two Variables with same name writing to same output.
 *
 * @param duplicates - Array of duplicate groups to analyze
 * @returns Array of conflict analyses
 *
 * @example
 * ```typescript
 * const duplicates = findDuplicatesInComponent(component);
 * const conflicts = analyzeDuplicateConflicts(duplicates);
 * conflicts.forEach(conflict => {
 *   console.log(`${conflict.conflictType}: ${conflict.description}`);
 * });
 * ```
 */
export function analyzeDuplicateConflicts(duplicates: DuplicateGroup[]): ConflictAnalysis[] {
  const conflicts: ConflictAnalysis[] = [];

  for (const group of duplicates) {
    // Check for Variable conflicts (same name, potentially connected to same outputs)
    if (group.type === 'Variable') {
      const connectedOutputs = new Map<string, number>();

      for (const instance of group.instances) {
        const connections = getConnectedNodes(instance.component, instance.node.id);

        // Count connections to each output node
        connections.outputs.forEach((outputNode) => {
          const key = `${outputNode.id}:${outputNode.typename}`;
          connectedOutputs.set(key, (connectedOutputs.get(key) || 0) + 1);
        });
      }

      // If multiple variables connect to the same output, it's a conflict
      connectedOutputs.forEach((count, key) => {
        if (count > 1) {
          conflicts.push({
            group,
            conflictType: 'data-race',
            description: `Multiple variables named "${group.name}" connect to the same output node. Last write wins.`,
            affectedNodes: group.instances.map((i) => i.node.id)
          });
        }
      });
    }

    // Check for Event name collisions
    if (group.type === 'Send Event' || group.type === 'Receive Event') {
      // Events with same channel name will all trigger
      conflicts.push({
        group,
        conflictType: 'name-collision',
        description: `Multiple ${group.type} nodes use channel "${group.name}". All receivers will trigger when any sender fires.`,
        affectedNodes: group.instances.map((i) => i.node.id)
      });
    }

    // Check for Object/Array naming conflicts
    if (group.type === 'Object' || group.type === 'Array') {
      conflicts.push({
        group,
        conflictType: 'state-conflict',
        description: `Multiple ${group.type} nodes named "${group.name}" may cause confusion about which instance holds the current state.`,
        affectedNodes: group.instances.map((i) => i.node.id)
      });
    }
  }

  return conflicts;
}

/**
 * Find nodes with similar (but not identical) names that might be duplicates.
 *
 * @param component - Component to analyze
 * @param similarityThreshold - Similarity threshold (0-1, default 0.8)
 * @returns Array of potential duplicate groups
 *
 * @example
 * ```typescript
 * // Find nodes like "userData" and "userdata" (case variations)
 * const similar = findSimilarlyNamedNodes(component, 0.9);
 * ```
 */
export function findSimilarlyNamedNodes(
  component: ComponentModel,
  similarityThreshold: number = 0.8
): DuplicateGroup[] {
  const nodes: NodeGraphNode[] = [];
  component.graph.nodeMap.forEach((node) => nodes.push(node));

  const groups: DuplicateGroup[] = [];
  const processed = new Set<string>();

  for (let i = 0; i < nodes.length; i++) {
    if (processed.has(nodes[i].id)) continue;

    const similar: NodeGraphNode[] = [nodes[i]];
    const name1 = (nodes[i].label || nodes[i].typename).toLowerCase().trim();

    for (let j = i + 1; j < nodes.length; j++) {
      if (processed.has(nodes[j].id)) continue;
      if (nodes[i].typename !== nodes[j].typename) continue;

      const name2 = (nodes[j].label || nodes[j].typename).toLowerCase().trim();

      // Calculate similarity (simple Levenshtein-based)
      const similarity = calculateStringSimilarity(name1, name2);

      if (similarity >= similarityThreshold && similarity < 1.0) {
        similar.push(nodes[j]);
        processed.add(nodes[j].id);
      }
    }

    if (similar.length > 1) {
      processed.add(nodes[i].id);

      const instances = similar.map((node) => {
        const connections = getConnectedNodes(component, node.id);
        return {
          node,
          component,
          connectionCount: connections.inputs.length + connections.outputs.length
        };
      });

      groups.push({
        name: nodes[i].label || nodes[i].typename,
        type: nodes[i].typename,
        instances,
        severity: 'info',
        reason: 'Nodes have similar names that might be typos or duplicates'
      });
    }
  }

  return groups;
}

/**
 * Calculate string similarity using Levenshtein distance.
 * Returns a value between 0 (completely different) and 1 (identical).
 *
 * @param str1 - First string
 * @param str2 - Second string
 * @returns Similarity score (0-1)
 */
function calculateStringSimilarity(str1: string, str2: string): number {
  const maxLength = Math.max(str1.length, str2.length);
  if (maxLength === 0) return 1.0;

  const distance = levenshteinDistance(str1, str2);
  return 1.0 - distance / maxLength;
}

/**
 * Calculate Levenshtein distance between two strings.
 * @param str1 - First string
 * @param str2 - Second string
 * @returns Edit distance
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}
