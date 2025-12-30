/**
 * BYOB Filter Builder Types
 *
 * Data models for the visual filter builder that generates
 * Directus-compatible filter JSON.
 */

export type FilterCombinator = 'and' | 'or';

/**
 * A group of conditions combined with AND or OR
 */
export interface FilterGroup {
  id: string;
  type: FilterCombinator;
  conditions: FilterItem[];
}

/**
 * A single filter condition
 */
/**
 * Filter value can be primitive types, arrays (for _in/_nin), or tuples (for _between)
 */
export type FilterValue = string | number | boolean | null | string[] | number[] | [number, number] | [string, string];

/**
 * Value source determines whether the condition value is static (typed in)
 * or connected (comes from a node input port)
 */
export type FilterValueSource = 'static' | 'connected';

export interface FilterCondition {
  id: string;
  field: string; // e.g., "status" or "author.name"
  operator: FilterOperator;
  value: FilterValue;
  /** Whether the value is static (typed in) or connected (from input port) */
  valueSource?: FilterValueSource;
  /** Port name when valueSource is 'connected' - auto-generated from condition id */
  valuePortName?: string;
}

/**
 * Either a group or a condition
 */
export type FilterItem = FilterGroup | FilterCondition;

/**
 * Type guard to check if item is a group
 */
export function isFilterGroup(item: FilterItem): item is FilterGroup {
  return 'type' in item && (item.type === 'and' || item.type === 'or');
}

/**
 * Directus filter operators
 */
export type FilterOperator =
  // Equality
  | '_eq'
  | '_neq'
  // Comparison
  | '_gt'
  | '_gte'
  | '_lt'
  | '_lte'
  // String
  | '_contains'
  | '_ncontains'
  | '_icontains' // case insensitive
  | '_starts_with'
  | '_nstarts_with'
  | '_istarts_with'
  | '_ends_with'
  | '_nends_with'
  | '_iends_with'
  // Array
  | '_in'
  | '_nin'
  // Null
  | '_null'
  | '_nnull'
  // Between
  | '_between'
  | '_nbetween'
  // Empty (for strings/arrays)
  | '_empty'
  | '_nempty'
  // Regex
  | '_regex';

/**
 * Field types from schema
 */
export type FieldType =
  | 'string'
  | 'text'
  | 'integer'
  | 'float'
  | 'decimal'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'time'
  | 'timestamp'
  | 'uuid'
  | 'json'
  | 'csv'
  | 'hash'
  | 'alias'
  | 'unknown';

/**
 * Operator definition with display info
 */
export interface OperatorDefinition {
  value: FilterOperator;
  label: string;
  description?: string;
  valueCount: 0 | 1 | 2; // 0 = no value (null check), 1 = single value, 2 = between
}

/**
 * Schema field definition (from BackendServices)
 */
export interface SchemaField {
  name: string;
  displayName?: string;
  type: FieldType;
  relatedCollection?: string;
  nullable?: boolean;
  enumValues?: string[];
}

/**
 * Schema collection definition
 */
export interface SchemaCollection {
  name: string;
  displayName?: string;
  fields: SchemaField[];
}

/**
 * Props for the main filter builder
 */
export interface ByobFilterBuilderProps {
  value: FilterGroup | null;
  schema: SchemaCollection | null;
  onChange: (filter: FilterGroup) => void;
}

/**
 * Create an empty filter group
 */
export function createEmptyFilterGroup(): FilterGroup {
  return {
    id: generateId(),
    type: 'and',
    conditions: []
  };
}

/**
 * Create an empty filter condition
 */
export function createEmptyCondition(): FilterCondition {
  return {
    id: generateId(),
    field: '',
    operator: '_eq',
    value: ''
  };
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

/**
 * Count total conditions and groups in a filter
 */
export function countFilterItems(group: FilterGroup | null): { conditions: number; groups: number } {
  if (!group) {
    return { conditions: 0, groups: 0 };
  }

  let conditions = 0;
  let groups = 0;

  function countRecursive(item: FilterItem) {
    if (isFilterGroup(item)) {
      groups++;
      item.conditions.forEach(countRecursive);
    } else {
      // Only count conditions that have a field selected
      if (item.field) {
        conditions++;
      }
    }
  }

  // Count the root group
  group.conditions.forEach(countRecursive);

  return { conditions, groups };
}

/**
 * Generate a human-readable summary of the filter
 */
export function getFilterSummary(group: FilterGroup | null): string {
  if (!group) {
    return 'No filter';
  }

  const { conditions, groups } = countFilterItems(group);

  if (conditions === 0 && groups === 0) {
    return 'No filter';
  }

  const parts: string[] = [];
  if (conditions > 0) {
    parts.push(`${conditions} condition${conditions !== 1 ? 's' : ''}`);
  }
  if (groups > 0) {
    parts.push(`${groups} group${groups !== 1 ? 's' : ''}`);
  }

  return parts.join(', ');
}
