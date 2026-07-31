/**
 * BYOB Filter Builder Types
 *
 * Data models for the visual filter builder.
 *
 * ⚠️ **BCN-003 re-targeted this at the neutral vocabulary.** It used to store
 * Directus's own operator names (`_eq`, `_gt`) verbatim in project data, and
 * its header used to say it "generates Directus-compatible filter JSON" — which
 * is what made every saved BYOB filter a Directus filter no matter which
 * backend the node pointed at. A model that spells its operators the way one
 * vendor's API spells them is that vendor's model, however good the UI on top
 * of it is; and BYOB's UI is the better of the two this repo has.
 *
 * So: keep the builder, change what it emits. `FilterOperator` is now the
 * contract's neutral operator, saved filters are migrated on load by
 * `migrateSavedFilter`, and the translation to a backend's dialect happens once,
 * in `@noodl/backend-contract/translators`, shared with the runtime.
 */

import type { FilterOperator as ContractFilterOperator } from '@noodl/backend-contract/translators';

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
 * The operators this builder can emit.
 *
 * A subset of the contract's `FilterOperator` — the geo, relation and identity
 * operators have no UI here yet, and listing only what the builder can actually
 * produce keeps `ALL_OPERATORS` provably total.
 */
export type FilterOperator = Extract<
  ContractFilterOperator,
  | 'equalTo'
  | 'notEqualTo'
  | 'greaterThan'
  | 'greaterThanOrEqualTo'
  | 'lessThan'
  | 'lessThanOrEqualTo'
  | 'contains'
  | 'notContains'
  | 'containsIgnoreCase'
  | 'startsWith'
  | 'notStartsWith'
  | 'startsWithIgnoreCase'
  | 'endsWith'
  | 'notEndsWith'
  | 'endsWithIgnoreCase'
  | 'containedIn'
  | 'notContainedIn'
  // One operator where the neutral model and Directus genuinely differ:
  // Directus splits presence into the nullary `_null`/`_nnull`, the contract
  // has one boolean-valued `exists`. The builder offers the two as separate
  // rows in the dropdown and stores the boolean.
  | 'exists'
  | 'between'
  | 'notBetween'
  | 'isEmpty'
  | 'isNotEmpty'
  | 'matchesRegex'
>;

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
 * One row of the operator dropdown.
 *
 * `key` and `value` are separate because of exactly one operator. Directus
 * splits presence into two nullary operators (`_null`, `_nnull`); the neutral
 * model has one, `exists`, carrying a boolean. The dropdown still wants two
 * rows — "is not set" and "is set" are how a person thinks about it — so the
 * row is identified by `key` and both rows carry `value: 'exists'` with
 * different `presetValue`s.
 */
export interface OperatorDefinition {
  /** Identity of this dropdown row. Equal to `value` except for the two `exists` rows. */
  key: string;
  value: FilterOperator;
  /** Forced when this row is chosen — the `exists` boolean. */
  presetValue?: boolean;
  label: string;
  description?: string;
  valueCount: 0 | 1 | 2; // 0 = no value (presence check), 1 = single value, 2 = between
}

/** Which dropdown row a saved condition corresponds to. */
export function operatorKeyOf(condition: Pick<FilterCondition, 'operator' | 'value'>): string {
  if (condition.operator === 'exists') return condition.value === false ? 'notExists' : 'exists';
  return condition.operator;
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
    operator: 'equalTo',
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
 * Generate the input-port name for a connected condition value.
 * The runtime registers any input starting with `filter_` as a dynamic
 * filter-value port (see byob-query-data.js), so the name must keep that
 * prefix. Field names can contain dots (relation paths) — slugify them.
 */
export function generateFilterPortName(condition: Pick<FilterCondition, 'id' | 'field'>): string {
  const fieldSlug = (condition.field || 'value').replace(/[^a-zA-Z0-9]/g, '_');
  return `filter_${fieldSlug}_${condition.id}`;
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
