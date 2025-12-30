/**
 * BYOB Filter Converter
 *
 * Converts between our internal filter model and Directus filter JSON format.
 */

import { FilterCondition, FilterGroup, FilterItem, FilterValue, isFilterGroup } from './types';

/**
 * Directus filter object structure
 */
export type DirectusFilter = Record<string, unknown>;

/**
 * Convert internal filter model to Directus filter JSON
 *
 * Input (our model):
 * {
 *   type: 'and',
 *   conditions: [
 *     { field: 'status', operator: '_eq', value: 'published' },
 *     { field: 'author.name', operator: '_contains', value: 'John' }
 *   ]
 * }
 *
 * Output (Directus format):
 * {
 *   "_and": [
 *     { "status": { "_eq": "published" } },
 *     { "author": { "name": { "_contains": "John" } } }
 *   ]
 * }
 */
export function toDirectusFilter(filter: FilterGroup | null): DirectusFilter | null {
  if (!filter) return null;

  // Skip empty groups
  if (filter.conditions.length === 0) return null;

  // If only one condition and it's not a group, return it directly (no wrapping _and/_or)
  if (filter.conditions.length === 1 && !isFilterGroup(filter.conditions[0])) {
    return convertCondition(filter.conditions[0] as FilterCondition);
  }

  const key = `_${filter.type}` as const; // _and or _or

  const conditions = filter.conditions.map((item) => convertItem(item)).filter((c): c is DirectusFilter => c !== null);

  if (conditions.length === 0) return null;
  if (conditions.length === 1) return conditions[0];

  return { [key]: conditions };
}

/**
 * Convert a single filter item (condition or group)
 */
function convertItem(item: FilterItem): DirectusFilter | null {
  if (isFilterGroup(item)) {
    return toDirectusFilter(item);
  } else {
    return convertCondition(item);
  }
}

/**
 * Convert a single condition to Directus format
 *
 * Handles nested fields like "author.name" by building nested objects
 */
function convertCondition(condition: FilterCondition): DirectusFilter | null {
  const { field, operator, value } = condition;

  // Skip conditions without a field
  if (!field) return null;

  // Build the operator/value pair
  // For null checks, value is not used
  const operatorValue =
    operator === '_null' || operator === '_nnull' || operator === '_empty' || operator === '_nempty' ? true : value;

  // Handle nested fields like "author.name"
  const parts = field.split('.');

  // Build from inside out: { "_eq": "value" }
  let result: DirectusFilter = { [operator]: operatorValue };

  // Wrap in nested objects for each field part
  for (let i = parts.length - 1; i >= 0; i--) {
    result = { [parts[i]]: result };
  }

  return result;
}

/**
 * Parse Directus filter JSON back to our internal model
 *
 * This allows loading existing filters for editing
 */
export function fromDirectusFilter(filter: DirectusFilter | null): FilterGroup | null {
  if (!filter || typeof filter !== 'object') return null;

  const keys = Object.keys(filter);
  if (keys.length === 0) return null;

  // Check if this is a group (_and or _or)
  if (keys.length === 1 && (keys[0] === '_and' || keys[0] === '_or')) {
    const type = keys[0] === '_and' ? 'and' : 'or';
    const conditions = filter[keys[0]] as DirectusFilter[];

    if (!Array.isArray(conditions)) return null;

    return {
      id: generateId(),
      type,
      conditions: conditions.map((c) => parseFilterItem(c)).filter((c): c is FilterItem => c !== null)
    };
  }

  // Single condition - wrap in an AND group
  const condition = parseCondition(filter);
  if (!condition) return null;

  return {
    id: generateId(),
    type: 'and',
    conditions: [condition]
  };
}

/**
 * Parse a single filter item from Directus format
 */
function parseFilterItem(item: DirectusFilter): FilterItem | null {
  if (!item || typeof item !== 'object') return null;

  const keys = Object.keys(item);
  if (keys.length === 0) return null;

  // Check if this is a nested group
  if (keys.length === 1 && (keys[0] === '_and' || keys[0] === '_or')) {
    const type = keys[0] === '_and' ? 'and' : 'or';
    const conditions = item[keys[0]] as DirectusFilter[];

    if (!Array.isArray(conditions)) return null;

    return {
      id: generateId(),
      type,
      conditions: conditions.map((c) => parseFilterItem(c)).filter((c): c is FilterItem => c !== null)
    };
  }

  // Otherwise it's a condition
  return parseCondition(item);
}

/**
 * Parse a condition from Directus format
 *
 * Input: { "status": { "_eq": "published" } }
 * Output: { field: "status", operator: "_eq", value: "published" }
 *
 * Input: { "author": { "name": { "_contains": "John" } } }
 * Output: { field: "author.name", operator: "_contains", value: "John" }
 */
function parseCondition(obj: DirectusFilter, path: string[] = []): FilterCondition | null {
  const keys = Object.keys(obj);
  if (keys.length !== 1) return null;

  const key = keys[0];
  const value = obj[key];

  // Check if this key is an operator
  if (key.startsWith('_') && !['_and', '_or'].includes(key)) {
    // This is the operator level
    return {
      id: generateId(),
      field: path.join('.'),
      operator: key as FilterCondition['operator'],
      value: value as FilterValue
    };
  }

  // Otherwise, this is a field name - recurse deeper
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return parseCondition(value as DirectusFilter, [...path, key]);
  }

  return null;
}

/**
 * Generate unique ID
 */
function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

/**
 * Stringify filter to JSON for display
 */
export function filterToJsonString(filter: FilterGroup | null, pretty = true): string {
  const directusFilter = toDirectusFilter(filter);
  if (!directusFilter) return '';
  return JSON.stringify(directusFilter, null, pretty ? 2 : 0);
}

/**
 * Parse JSON string to filter model
 */
export function jsonStringToFilter(json: string): FilterGroup | null {
  try {
    const parsed = JSON.parse(json);
    return fromDirectusFilter(parsed);
  } catch {
    return null;
  }
}
