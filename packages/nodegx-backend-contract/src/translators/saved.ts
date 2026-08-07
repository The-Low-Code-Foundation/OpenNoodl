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
  /**
   * What sort of rule this row is. Absent means `'field'`, which is every row
   * the builder could produce before BCN-003b.
   *
   * `'relation'` is the Parse `relatedTo` rule, folded in when `QueryEditor`
   * was retired. It is a separate kind rather than an operator because it does
   * not read a field at all — it names a *collection* and a relation property
   * on that collection, and asks which records this one is related to.
   */
  kind?: 'field' | 'relation';
  field: string;
  /** A neutral operator after migration; a Directus one before it. */
  operator: string;
  value?: unknown;
  valueSource?: 'static' | 'connected';
  valuePortName?: string;
  /** `kind: 'relation'` only — the collection holding the relation. */
  relationClass?: string;
  /** `kind: 'relation'` only — the relation property on that collection. */
  relationProperty?: string;
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

/** How a saved group is read. */
export interface SavedToNeutralOptions {
  /**
   * Drop a connected condition whose port supplied no value, instead of falling
   * back to the last literal typed into it.
   *
   * ⚠️ **The two builders disagreed about this and both were right for their
   * own nodes**, so BCN-003b made it a parameter rather than picking one.
   *
   * `QueryEditor` dropped the rule: a Query Records node with an unconnected
   * "search term" input is meant to return everything, and every Parse-family
   * graph in every project relies on it. `ByobFilterBuilder` keeps the literal,
   * because its connected values are opt-in on a row that already had one typed.
   *
   * Picking either one globally would silently change what an existing app
   * queries for — which is the failure class this phase exists to close.
   */
  dropUnresolvedConnected?: boolean;
}

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
  resolve?: FilterValueResolver,
  options: SavedToNeutralOptions = {}
): Filter | null {
  if (!group || !Array.isArray(group.conditions)) return null;

  const children = group.conditions
    .map((item) => savedItemToNeutral(item, resolve, options))
    .filter((child): child is Filter => child !== null);

  if (children.length === 0) return null;
  if (children.length === 1) return children[0];
  return { [group.type]: children } as Filter;
}

function savedItemToNeutral(
  item: SavedFilterItem,
  resolve: FilterValueResolver | undefined,
  options: SavedToNeutralOptions
): Filter | null {
  if (isSavedGroup(item)) return savedFilterToNeutral(item, resolve, options);

  const condition = item;

  const isConnected = condition.valueSource === 'connected' && !!condition.valuePortName;
  const resolved = isConnected && resolve ? resolve(condition.valuePortName as string) : undefined;
  const value = isConnected
    ? resolved !== undefined || options.dropUnresolvedConnected
      ? resolved
      : condition.value
    : condition.value;

  if (condition.kind === 'relation') {
    // A relation rule names no field, so the field guard below would drop it.
    // Its value is the id of the record whose relation is being asked about,
    // and without one there is no question to ask.
    if (value === undefined || value === null || value === '') return null;
    return {
      relatedTo: {
        id: String(value),
        key: condition.relationProperty ?? '',
        className: condition.relationClass
      }
    };
  }

  // A condition with no field is a half-finished row in the builder UI, not an
  // instruction. Both old converters dropped it and so does this.
  if (!condition.field || !condition.operator) return null;

  const operator = condition.operator as FilterOperator;
  if (operator === 'isEmpty' || operator === 'isNotEmpty') {
    return { [condition.field]: { [operator]: true } } as Filter;
  }

  // Presence takes a boolean of its own and is answered without a value, so it
  // is checked before the unresolved-value drop.
  if (operator !== 'exists' && isConnected && value === undefined && options.dropUnresolvedConnected) {
    return null;
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

// ── The Parse-side QueryEditor format → the builder's saved format ────────────

/** How a `QueryEditor` filter is rewritten into the one the builder saves. */
export interface VisualQueryToSavedOptions {
  /**
   * Prefix for the input port carrying a connected value.
   *
   * ⚠️ **This is the field that decides whether a user's wires survive.**
   * `QueryEditor` stored a parameter *name* (`input: 'MyRecordId'`) and the
   * node turned it into a port (`qp-MyRecordId` on Query Records,
   * `fp-MyRecordId` on Filter Records). The builder stores the port name whole.
   * Writing the wrong prefix here, or regenerating the name from the field the
   * way a new row does, renames a port that has a wire attached to it — and a
   * connection to a port that no longer exists is dropped without a word.
   *
   * So it is required rather than defaulted: there is no prefix that is right
   * for both nodes, and guessing is the failure.
   */
  valuePortPrefix: string;
}

/**
 * Rewrite a `QueryEditor` filter into the format `ByobFilterBuilder` saves.
 *
 * ## Why this is not `neutral → saved`
 *
 * BCN-003b's spec asks for `neutralToSavedFilter`, the mirror of
 * `savedFilterToNeutral`. That function cannot be written without losing
 * something: `visualQueryToNeutral` *resolves* `input: 'term'` into whatever
 * value the port supplied, so by the time a filter is neutral the fact that its
 * value came from a port — and the port's name — is gone. Round-tripping a
 * saved filter through the neutral model would turn every connected rule into
 * whichever literal happened to be on the wire when the project was opened, or
 * into nothing.
 *
 * The two saved formats convert to each other directly, which is what this is,
 * and the neutral model stays what it is for: describing a *query*, not a
 * builder's state.
 *
 * ## Ids
 *
 * Derived from the rule's position in the tree rather than generated, so that
 * opening the same project twice produces the same ids. A migration that
 * invented an id per load would show up as an unexplained diff in someone's
 * version control every time they opened a component — the same reason
 * `needsOperatorMigration` exists.
 */
export function visualQueryToSaved(
  query: VisualQueryNode | null | undefined,
  options: VisualQueryToSavedOptions
): SavedFilterGroup | null {
  if (!query) return null;

  const root = visualNodeToSaved(query, options, 'q');
  if (root === null) return null;
  if (isSavedGroup(root)) return root;
  // A `QueryEditor` filter can be a bare rule with no group around it. The
  // builder's root is always a group, so it gets one.
  return { id: 'q', type: 'and', conditions: [root] };
}

function visualNodeToSaved(
  node: VisualQueryNode,
  options: VisualQueryToSavedOptions,
  path: string
): SavedFilterItem | null {
  if (node.combinator !== undefined && Array.isArray(node.rules)) {
    return {
      id: path,
      type: node.combinator === 'or' ? 'or' : 'and',
      conditions: node.rules
        .map((rule, index) => visualNodeToSaved(rule, options, `${path}-${index}`))
        .filter((child): child is SavedFilterItem => child !== null)
    };
  }

  const connected: Pick<SavedFilterCondition, 'valueSource' | 'valuePortName' | 'value'> =
    node.input !== undefined
      ? { valueSource: 'connected', valuePortName: options.valuePortPrefix + node.input, value: node.value }
      : { valueSource: 'static', value: node.value };

  if (node.operator === 'related to') {
    return {
      id: path,
      kind: 'relation',
      field: '',
      operator: 'relatedTo',
      relationClass: node.relatedTo,
      relationProperty: node.relationProperty,
      ...connected
    };
  }

  if (!node.property) return null;

  // Presence is two dropdown rows carrying one boolean-valued operator, and it
  // never has a value — a connected one would be meaningless.
  if (node.operator === 'exist' || node.operator === 'not exist') {
    return {
      id: path,
      kind: 'field',
      field: node.property,
      operator: 'exists',
      value: node.operator === 'exist'
    };
  }

  const operator = VISUAL_OPERATORS[node.operator ?? ''];
  // A rule whose operator was never chosen is a half-finished row. `QueryEditor`
  // rendered it and `visualQueryToNeutral` dropped it; carrying it across as an
  // `equalTo` would invent a condition the user did not write.
  if (!operator) return null;

  return { id: path, kind: 'field', field: node.property, operator, ...connected };
}

/** Does this look like a `QueryEditor` filter rather than a builder one? */
export function isVisualQueryFormat(value: unknown): value is VisualQueryNode {
  if (!value || typeof value !== 'object') return false;
  const node = value as VisualQueryNode;
  if (Array.isArray((value as SavedFilterGroup).conditions)) return false;
  return node.combinator !== undefined || node.property !== undefined || node.operator !== undefined;
}
