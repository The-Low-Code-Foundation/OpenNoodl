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
  /**
   * What sort of rule this row is. Absent means `'field'`, which is every row
   * this builder could produce before BCN-003b.
   *
   * `'relation'` arrived with `QueryEditor`'s retirement. It asks "which records
   * is *this* one related to", so it reads no field at all — it names a
   * collection and a relation property on that collection. Parse's `Relation`
   * has no junction table to query, which is why it cannot be an ordinary
   * condition on a field.
   */
  kind?: 'field' | 'relation';
  field: string; // e.g., "status" or "author.name"
  operator: FilterOperator;
  value: FilterValue;
  /** Whether the value is static (typed in) or connected (from input port) */
  valueSource?: FilterValueSource;
  /** Port name when valueSource is 'connected' - auto-generated from condition id */
  valuePortName?: string;
  /** `kind: 'relation'` only — the collection holding the relation. */
  relationClass?: string;
  /** `kind: 'relation'` only — the relation property on that collection. */
  relationProperty?: string;
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
  // BCN-003b: the two `QueryEditor` had that this builder did not. `pointsTo`
  // is an ordinary operator on a Pointer column; `relatedTo` is carried on a
  // relation *rule* rather than chosen from the operator dropdown, and is in
  // this union so a saved rule's `operator` field types.
  | 'pointsTo'
  | 'relatedTo'
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
  // A Parse `Pointer` column. Its only real question is which record it points
  // at, so it gets its own operator list rather than being flattened to a
  // string — which is what would happen if it were mapped to `unknown`.
  | 'pointer'
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
  /**
   * The chosen backend's `degraded` sentence, when it has one.
   *
   * Attached by {@link getOperatorsForType} from the capability table rather
   * than written here, so it is the *same string* the runtime throws and the
   * same one BCN-010 will put under a greyed-out port. Two hand-written
   * explanations of one fact drift; this phase has already paid for that.
   */
  caveat?: string;
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
 * One collection that holds a relation pointing *at* the one being filtered.
 *
 * The direction is the confusing part and worth stating: a "related to" rule on
 * a Person query asks *"which People are in this Team's `members` relation"*, so
 * `className` is `Team` — the collection that owns the relation — not `Person`.
 */
export interface SchemaRelation {
  className: string;
  properties: string[];
}

/**
 * Schema collection definition
 */
export interface SchemaCollection {
  name: string;
  displayName?: string;
  fields: SchemaField[];
  /** Present only where the backend has relations the filter can traverse. */
  relations?: SchemaRelation[];
}

/**
 * The chosen backend's answer for one operator, as the descriptor states it.
 *
 * A subset of the contract's `CapabilityCell`, taken structurally rather than
 * by import so this module does not pull the whole capability model into the
 * property editor's bundle.
 */
export interface OperatorCapability {
  state: 'supported' | 'degraded' | 'conditional' | 'unsupported';
  reason?: string;
}

/** Operator → what the chosen backend can do with it. */
export type OperatorCapabilities = Partial<Record<FilterOperator, OperatorCapability>>;

/**
 * Props for the main filter builder
 */
export interface ByobFilterBuilderProps {
  value: FilterGroup | null;
  schema: SchemaCollection | null;
  onChange: (filter: FilterGroup) => void;
  /**
   * What the chosen backend can express. Omitted means "offer everything",
   * which is what the builder did before BCN-003b.
   */
  capabilities?: OperatorCapabilities;
  /**
   * Prefix for a connected value's input port. See
   * `generateFilterPortName` — the node the filter sits on decides it, and
   * getting it wrong renames a port that may already have a wire on it.
   */
  valuePortPrefix?: string;
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
 * Create an empty relation rule.
 *
 * Its value is the id of the record whose relation is being asked about, and it
 * defaults to `connected` because that is what the rule is nearly always for —
 * `QueryEditor` did the same, seeding the port name `MyRelationRecordId`.
 */
export function createEmptyRelationCondition(valuePortPrefix = DEFAULT_VALUE_PORT_PREFIX): FilterCondition {
  const id = generateId();
  return {
    id,
    kind: 'relation',
    field: '',
    operator: 'relatedTo',
    value: '',
    valueSource: 'connected',
    valuePortName: generateFilterPortName({ id, field: 'related' }, valuePortPrefix)
  };
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

/**
 * The prefix a BYOB Query Data node keys its dynamic filter inputs on.
 *
 * ⚠️ **Load-bearing.** `byob-query-data.ts` registers any input starting with
 * `filter_` as a filter-value port, and RUN-003's slice-5 test exists to say so.
 */
export const DEFAULT_VALUE_PORT_PREFIX = 'filter_';

/**
 * Generate the input-port name for a connected condition value.
 *
 * The prefix is a parameter because the three nodes that own a filter do not
 * agree on one: BYOB Query Data keys on `filter_`, Query Records on `qp-`, and
 * Filter Records on `fp-`. Field names can contain dots (relation paths) —
 * slugify them.
 */
export function generateFilterPortName(
  condition: Pick<FilterCondition, 'id' | 'field'>,
  prefix = DEFAULT_VALUE_PORT_PREFIX
): string {
  const fieldSlug = (condition.field || 'value').replace(/[^a-zA-Z0-9]/g, '_');
  return `${prefix}${fieldSlug}_${condition.id}`;
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
      // Only count conditions that have been filled in. A relation rule names
      // no field, so it is counted on having a relation chosen instead —
      // otherwise the summary reads "No filter" on a filter that has one.
      if (item.kind === 'relation' ? !!item.relationProperty : !!item.field) {
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
