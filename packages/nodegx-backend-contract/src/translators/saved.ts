/**
 * The two saved filter formats, and the one-shot migration of the older one.
 *
 * A translator takes the neutral `Filter`. Neither visual builder *stores* one:
 *
 * | Builder | Saved shape | Operator names |
 * |---|---|---|
 * | `ByobFilterBuilder` | `{id, type, conditions:[{field, operator, value}]}` | `_eq`, `_gt` — **Directus's**, verbatim in project data |
 * | `QueryEditor` | `{combinator, rules:[{property, operator, value}]}` | `'equal to'`, `'greater than'` — English |
 *
 * Both are converted here, so that a translator never has to know a builder
 * exists and a builder never has to know a backend does. That separation is
 * what lets BCN-003b retire one of the two builders without touching a single
 * translator.
 *
 * ## Why the BYOB format is migrated rather than translated on the fly
 *
 * Because storing one vendor's operator names in a user's project *is* the
 * coupling this phase exists to remove. A saved filter reading `_eq` is a
 * Directus filter no matter which backend the node points at, and the
 * conversion would have to be undone every time the filter is edited, shown, or
 * gated against a capability table keyed by neutral names. Migrating once is
 * mechanical, total, and testable; translating forever is a permanent
 * adaptor with a vendor's name on it.
 *
 * @module backend-contract/translators/saved
 */

import { DIRECTUS_OPERATOR_MIGRATION, type Filter, type FilterOperator } from '../filter';
import type { FilterValueResolver } from './types';

// ── The visual builder's saved format ────────────────────────────────────────

export interface SavedFilterCondition {
  id?: string;
  field: string;
  /** A neutral operator after migration; a Directus one before it. */
  operator: string;
  value?: unknown;
  valueSource?: 'static' | 'connected';
  valuePortName?: string;
}

export interface SavedFilterGroup {
  id?: string;
  type: 'and' | 'or';
  conditions: SavedFilterItem[];
}

export type SavedFilterItem = SavedFilterGroup | SavedFilterCondition;

export function isSavedGroup(item: SavedFilterItem): item is SavedFilterGroup {
  return (item as SavedFilterGroup).type === 'and' || (item as SavedFilterGroup).type === 'or';
}

// ── Migration ────────────────────────────────────────────────────────────────

/**
 * True when any condition still spells its operator the Directus way.
 *
 * Checked rather than assumed so the migration is idempotent: it runs on every
 * project load, and a filter already in the neutral vocabulary must come out
 * unchanged and, more importantly, **un-rewritten** — a migration that dirties
 * every project it looks at is a migration that shows up as an unexplained diff
 * in someone's version control.
 */
export function needsOperatorMigration(item: SavedFilterItem | null | undefined): boolean {
  if (!item) return false;
  if (isSavedGroup(item)) return (item.conditions ?? []).some(needsOperatorMigration);
  return typeof item.operator === 'string' && item.operator.startsWith('_');
}

/**
 * Rewrite a saved BYOB filter's operators into the neutral vocabulary.
 *
 * Two of the twenty-four rows are not renames, and they are the reason this is
 * a function rather than a lookup at the call site: `_null` and `_nnull` are
 * *nullary* where the neutral `exists` is boolean-valued, so the value has to be
 * written as well as the key. `_empty`/`_nempty` are renames, but their stored
 * value is the literal `true` both converters used to emit, which the neutral
 * `isEmpty` does not want either.
 */
export function migrateSavedFilter<T extends SavedFilterItem>(item: T): T {
  if (isSavedGroup(item)) {
    return {
      ...item,
      conditions: (item.conditions ?? []).map((child) => migrateSavedFilter(child))
    } as T;
  }

  const condition = item as SavedFilterCondition;
  const mapping = DIRECTUS_OPERATOR_MIGRATION[condition.operator];
  if (!mapping) return item;

  const migrated: SavedFilterCondition = { ...condition, operator: mapping.operator };
  if (mapping.value === 'true') migrated.value = true;
  else if (mapping.value === 'false') migrated.value = false;
  else if (mapping.operator === 'isEmpty' || mapping.operator === 'isNotEmpty') {
    // These were stored carrying the literal `true` the Directus wire wants.
    // The neutral operators take no value at all.
    delete migrated.value;
  }
  return migrated as T;
}

// ── Builder format → neutral filter ──────────────────────────────────────────

/**
 * Convert the visual builder's saved group into a neutral filter.
 *
 * `resolve` supplies the value for a condition bound to an input port. The
 * runtime passes one; the editor does not, and a connected condition with no
 * resolver keeps whatever literal was last typed — which is what the property
 * editor shows today.
 */
export function savedFilterToNeutral(
  group: SavedFilterGroup | null | undefined,
  resolve?: FilterValueResolver
): Filter | null {
  if (!group || !Array.isArray(group.conditions)) return null;

  const children = group.conditions
    .map((item) => savedItemToNeutral(item, resolve))
    .filter((child): child is Filter => child !== null);

  if (children.length === 0) return null;
  if (children.length === 1) return children[0];
  return { [group.type]: children } as Filter;
}

function savedItemToNeutral(item: SavedFilterItem, resolve?: FilterValueResolver): Filter | null {
  if (isSavedGroup(item)) return savedFilterToNeutral(item, resolve);

  const condition = item;
  // A condition with no field is a half-finished row in the builder UI, not an
  // instruction. Both old converters dropped it and so does this.
  if (!condition.field || !condition.operator) return null;

  const value =
    condition.valueSource === 'connected' && condition.valuePortName && resolve
      ? resolve(condition.valuePortName)
      : condition.value;

  const operator = condition.operator as FilterOperator;
  if (operator === 'isEmpty' || operator === 'isNotEmpty') {
    return { [condition.field]: { [operator]: true } } as Filter;
  }
  return { [condition.field]: { [operator]: value } } as Filter;
}

// ── The Parse-side QueryEditor format → neutral filter ───────────────────────

/** One leaf or group of the Parse-side visual filter. */
export interface VisualQueryNode {
  combinator?: string;
  rules?: VisualQueryNode[];
  property?: string;
  operator?: string;
  value?: unknown;
  /** Name of the query parameter supplying the value, when it is not a literal. */
  input?: string;
  /** For `'related to'`: the class the relation points at. */
  relatedTo?: string;
  relationProperty?: string;
}

/** The English operator names `QueryEditor` writes, in neutral terms. */
const VISUAL_OPERATORS: Readonly<Record<string, FilterOperator>> = Object.freeze({
  'equal to': 'equalTo',
  'not equal to': 'notEqualTo',
  'greater than': 'greaterThan',
  'greater than or equal to': 'greaterThanOrEqualTo',
  'less than': 'lessThan',
  'less than or equal to': 'lessThanOrEqualTo',
  'points to': 'pointsTo',
  // `convertVisualFilter` emitted `{$regex: value, $options: 'i'}` for this one,
  // so its neutral name is the case-insensitive member — not `contains`.
  contain: 'containsIgnoreCase'
});

/**
 * Convert the Parse-side visual filter into a neutral filter.
 *
 * One behaviour is carried over verbatim and is worth naming, because it is a
 * silent drop and this task is otherwise about not having those: **a rule whose
 * value is `undefined` is removed**. That is how an optional filter port works
 * — a Query Records node with an unconnected "search term" input is meant to
 * return everything, and every graph in every project relies on it. The
 * distinction from the drops this task closes is that the *user's intent* is
 * expressed by the missing value, rather than being expressed and then lost.
 */
export function visualQueryToNeutral(
  query: VisualQueryNode | null | undefined,
  parameters: Record<string, unknown> = {}
): Filter | null {
  if (!query) return null;

  if (query.combinator !== undefined && Array.isArray(query.rules)) {
    const children = query.rules
      .map((rule) => visualQueryToNeutral(rule, parameters))
      .filter((child): child is Filter => child !== null);
    if (children.length === 0) return null;
    if (children.length === 1) return children[0];
    return { [query.combinator === 'or' ? 'or' : 'and']: children } as Filter;
  }

  const value = query.input !== undefined ? parameters[query.input] : query.value;

  if (query.operator === 'related to') {
    if (value === undefined) return null;
    return {
      relatedTo: { id: String(value), key: query.relationProperty ?? '', className: query.relatedTo }
    };
  }

  if (!query.property) return null;

  // Presence is answered without a value, so these two are checked before the
  // undefined-value drop below.
  if (query.operator === 'exist') return { [query.property]: { exists: true } } as Filter;
  if (query.operator === 'not exist') return { [query.property]: { exists: false } } as Filter;

  if (value === undefined) return null;

  const operator = VISUAL_OPERATORS[query.operator ?? ''];
  if (!operator) return null;

  return { [query.property]: { [operator]: value } } as Filter;
}
