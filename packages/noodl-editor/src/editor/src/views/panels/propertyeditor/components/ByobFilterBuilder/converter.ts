/**
 * BYOB Filter Converter
 *
 * ⚠️ **This file used to contain a second implementation of `toDirectusFilter`.**
 * The other lived in the runtime's Query Data node, and BCN-003's whole premise
 * is that one backend must never have two translators — RUN-003 shipped exactly
 * that pair and the runtime copy emitted a flat `"author.name"` key that live
 * Directus answers with a 403, invisible to every unit test because only a real
 * fetch exercised it.
 *
 * Worth recording, because the handover into this task said otherwise: read side
 * by side, the two copies were *not* materially divergent. Both unwrapped a
 * single surviving child; the runtime's own test was named for it. The one real
 * difference was that the runtime skipped a condition with no `operator` while
 * this file emitted `{field: {undefined: value}}`. So there was no live
 * two-payloads-for-one-filter bug — the argument for one copy is the RUN-003
 * precedent, not a defect sitting here today.
 *
 * What is left is the *builder-shaped* half: converting between this component's
 * saved model and Directus JSON for the "edit as JSON" affordance. The
 * translation itself is `@noodl/backend-contract/translators`, shared with the
 * runtime.
 */

import {
  DIRECTUS_OPERATOR_MIGRATION,
  savedFilterToNeutral,
  toDirectusFilter as translateToDirectus,
  type SavedFilterGroup
} from '@noodl/backend-contract/translators';

import { FilterCondition, FilterGroup, FilterItem, FilterOperator, FilterValue, isFilterGroup } from './types';

/**
 * Directus filter object structure
 */
export type DirectusFilter = Record<string, unknown>;

/**
 * Convert the builder's saved model to Directus filter JSON.
 *
 * Two steps rather than one: the saved group becomes a neutral filter, and the
 * neutral filter becomes Directus. Splitting them is what lets this component
 * be re-pointed at another backend without a second converter, and it is why
 * the builder now stores neutral operator names rather than Directus's.
 */
export function toDirectusFilter(filter: FilterGroup | null): DirectusFilter | null {
  if (!filter) return null;
  const neutral = savedFilterToNeutral(filter as unknown as SavedFilterGroup);
  if (!neutral) return null;
  const directus = translateToDirectus(neutral, { backend: 'directus' });
  return Object.keys(directus).length === 0 ? null : directus;
}

/** Directus operator → the builder's (neutral) operator, for reading JSON back. */
const FROM_DIRECTUS = DIRECTUS_OPERATOR_MIGRATION;

/**
 * Parse Directus filter JSON back into the builder's model.
 *
 * Used for the JSON editing affordance and for opening a filter saved before
 * BCN-003, when the *stored* form was Directus JSON rather than the builder's
 * own. Operators come back in the neutral vocabulary, which is what makes
 * reading an old filter and saving it a migration rather than a round-trip.
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
 * Output: { field: "status", operator: "equalTo", value: "published" }
 *
 * Input: { "author": { "name": { "_contains": "John" } } }
 * Output: { field: "author.name", operator: "contains", value: "John" }
 */
function parseCondition(obj: DirectusFilter, path: string[] = []): FilterCondition | null {
  const keys = Object.keys(obj);
  if (keys.length !== 1) return null;

  const key = keys[0];
  const value = obj[key];

  // Check if this key is an operator
  if (key.startsWith('_') && !['_and', '_or'].includes(key)) {
    const mapping = FROM_DIRECTUS[key];
    if (!mapping) return null;
    return {
      id: generateId(),
      field: path.join('.'),
      operator: mapping.operator as FilterOperator,
      // `_null`/`_nnull` are nullary where the neutral `exists` is
      // boolean-valued, so the value has to be written, not just the key. A
      // rename alone would have inverted the meaning of every one of these.
      value: (mapping.value === 'true'
        ? true
        : mapping.value === 'false'
          ? false
          : value) as FilterValue
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

export { isFilterGroup };
