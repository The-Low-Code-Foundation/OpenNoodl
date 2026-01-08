/**
 * Tree Converter Utility
 *
 * Converts between JSON values and tree node representations
 * for the Easy Mode visual editor.
 *
 * @module json-editor/utils
 */

import { JSONTreeNode, JSONValueType } from './types';

/**
 * Converts a JSON value to a tree node structure for Easy Mode display
 *
 * @param value - The JSON value to convert
 * @param path - Current path in the tree (for editing)
 * @param key - Object key (if this is an object property)
 * @param index - Array index (if this is an array element)
 * @returns Tree node representation
 */
export function valueToTreeNode(
  value: unknown,
  path: (string | number)[] = [],
  key?: string,
  index?: number
): JSONTreeNode {
  const type = getValueType(value);
  const id = path.length === 0 ? 'root' : path.join('.');

  const baseNode: JSONTreeNode = {
    id,
    type,
    path,
    key,
    index,
    isExpanded: true // Default to expanded
  };

  if (type === 'array') {
    const arr = value as unknown[];
    return {
      ...baseNode,
      children: arr.map((item, idx) => valueToTreeNode(item, [...path, idx], undefined, idx))
    };
  }

  if (type === 'object') {
    const obj = value as Record<string, unknown>;
    return {
      ...baseNode,
      children: Object.entries(obj).map(([k, v]) => valueToTreeNode(v, [...path, k], k))
    };
  }

  // Primitive values
  return {
    ...baseNode,
    value: value as string | number | boolean | null
  };
}

/**
 * Converts a tree node back to a JSON value
 *
 * @param node - The tree node to convert
 * @returns JSON value
 */
export function treeNodeToValue(node: JSONTreeNode): unknown {
  if (node.type === 'array') {
    return (node.children || []).map(treeNodeToValue);
  }

  if (node.type === 'object') {
    const result: Record<string, unknown> = {};
    (node.children || []).forEach((child) => {
      if (child.key) {
        result[child.key] = treeNodeToValue(child);
      }
    });
    return result;
  }

  // Primitive values
  return node.value;
}

/**
 * Determines the JSON value type
 *
 * @param value - The value to check
 * @returns The JSON value type
 */
export function getValueType(value: unknown): JSONValueType {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  return 'string';
}

/**
 * Gets a value from an object/array using a path
 *
 * @param root - The root object/array
 * @param path - Path to the value
 * @returns The value at the path, or undefined
 */
export function getValueAtPath(root: unknown, path: (string | number)[]): unknown {
  let current = root;
  for (const segment of path) {
    if (current === null || current === undefined) return undefined;
    if (typeof current === 'object') {
      current = (current as Record<string | number, unknown>)[segment];
    } else {
      return undefined;
    }
  }
  return current;
}

/**
 * Sets a value in an object/array using a path (immutably)
 *
 * @param root - The root object/array
 * @param path - Path to set the value
 * @param value - Value to set
 * @returns New root with the value updated
 */
export function setValueAtPath(root: unknown, path: (string | number)[], value: unknown): unknown {
  if (path.length === 0) return value;

  const [first, ...rest] = path;

  if (Array.isArray(root)) {
    const newArray = [...root];
    if (typeof first === 'number') {
      newArray[first] = rest.length === 0 ? value : setValueAtPath(newArray[first], rest, value);
    }
    return newArray;
  }

  if (typeof root === 'object' && root !== null) {
    return {
      ...root,
      [first]:
        rest.length === 0 ? value : setValueAtPath((root as Record<string | number, unknown>)[first], rest, value)
    };
  }

  return root;
}

/**
 * Deletes a value in an object/array using a path (immutably)
 *
 * @param root - The root object/array
 * @param path - Path to delete
 * @returns New root with the value deleted
 */
export function deleteValueAtPath(root: unknown, path: (string | number)[]): unknown {
  if (path.length === 0) return root;

  const [first, ...rest] = path;

  if (Array.isArray(root)) {
    if (rest.length === 0 && typeof first === 'number') {
      return root.filter((_, idx) => idx !== first);
    }
    const newArray = [...root];
    if (typeof first === 'number') {
      newArray[first] = deleteValueAtPath(newArray[first], rest);
    }
    return newArray;
  }

  if (typeof root === 'object' && root !== null) {
    if (rest.length === 0) {
      const { [first]: _, ...newObj } = root as Record<string | number, unknown>;
      return newObj;
    }
    return {
      ...root,
      [first]: deleteValueAtPath((root as Record<string | number, unknown>)[first], rest)
    };
  }

  return root;
}
