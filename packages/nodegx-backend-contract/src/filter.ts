/**
 * The neutral filter model.
 *
 * This is the one part of the contract that is genuinely *named* here rather
 * than transcribed. The vocabulary is not new — it is the long-form set that
 * `queryutils.ts::convertFilterOp` has always accepted — but until now it had
 * no name, no enumeration, and no statement of which backends can express it.
 *
 * **Why this vocabulary and not the other one.** Two filter models exist in the
 * repo and the phase spec believed they had converged. They had not:
 *
 * | | Saved shape | Operator names |
 * |---|---|---|
 * | Parse-wire | `{and:[…]}` / `{<field>:{equalTo:v}}` | `equalTo`, `greaterThan` — long-form, **neutral** |
 * | BYOB | `{id, type, conditions:[{field, operator, value}]}` | `_eq`, `_gt` — **Directus's wire names, stored verbatim in project data** |
 *
 * BYOB's own types file says so in its header: *"generates Directus-compatible
 * filter JSON"*. A model that spells its operators the way one vendor's API
 * spells them is that vendor's model, however good the UI on top of it is — and
 * BYOB's filter-builder UI is the better of the two. So: keep the builder,
 * re-target what it emits. BCN-003 owns that change and the one-shot migration
 * of saved filters that comes with it (see `DIRECTUS_OPERATOR_MIGRATION`).
 *
 * @module backend-contract/filter
 */

/**
 * Every operator in the neutral vocabulary.
 *
 * The set is a **union** of what the two existing models could express, not
 * either one of them. Neither covered the other: Parse has geo and `relatedTo`
 * that Directus cannot express; Directus has nine string operators and
 * `between`/`isEmpty` that Parse has no equivalent for.
 *
 * Two of those gaps are closed by *lowering* rather than gating — see
 * `LOWERED_OPERATORS`.
 */
export type FilterOperator =
  // Equality and comparison — every backend has these.
  | 'equalTo'
  | 'notEqualTo'
  | 'lessThan'
  | 'greaterThan'
  | 'lessThanOrEqualTo'
  | 'greaterThanOrEqualTo'
  // Set membership.
  | 'containedIn'
  | 'notContainedIn'
  // Presence. Note this is a *boolean-valued* operator (`{exists: true}`),
  // where Directus splits it into two nullary ones (`_null` / `_nnull`).
  | 'exists'
  // String matching. `matchesRegex` takes an optional sibling `options` key,
  // exactly as Parse's `$regex`/`$options` pair does.
  | 'matchesRegex'
  | 'contains'
  | 'notContains'
  | 'containsIgnoreCase'
  | 'startsWith'
  | 'notStartsWith'
  | 'startsWithIgnoreCase'
  | 'endsWith'
  | 'notEndsWith'
  | 'endsWithIgnoreCase'
  // Ranges.
  | 'between'
  | 'notBetween'
  // Empty string / empty array, which is not the same question as null.
  | 'isEmpty'
  | 'isNotEmpty'
  // Full-text. Distinct from the `search` option on a query — see the note on
  // `data.search` in `capabilities.ts`.
  | 'textSearch'
  // Relations. BCN-005 owns these.
  | 'pointsTo'
  | 'relatedTo'
  // Identity. The primary-key field is named differently on every backend, so
  // these exist rather than making callers know it.
  | 'idEqualTo'
  | 'idContainedIn'
  // Geo. Parse-family only, and gated rather than lowered — there is no
  // useful approximation of "within this polygon" in a REST query string.
  | 'nearSphere'
  | 'withinBox'
  | 'withinPolygon';

export const FILTER_OPERATORS: readonly FilterOperator[] = Object.freeze([
  'equalTo',
  'notEqualTo',
  'lessThan',
  'greaterThan',
  'lessThanOrEqualTo',
  'greaterThanOrEqualTo',
  'containedIn',
  'notContainedIn',
  'exists',
  'matchesRegex',
  'contains',
  'notContains',
  'containsIgnoreCase',
  'startsWith',
  'notStartsWith',
  'startsWithIgnoreCase',
  'endsWith',
  'notEndsWith',
  'endsWithIgnoreCase',
  'between',
  'notBetween',
  'isEmpty',
  'isNotEmpty',
  'textSearch',
  'pointsTo',
  'relatedTo',
  'idEqualTo',
  'idContainedIn',
  'nearSphere',
  'withinBox',
  'withinPolygon'
]);

/**
 * Operators a translator must **lower**, never gate, on backends that have no
 * native equivalent.
 *
 * The distinction matters more than it looks. `contains` has no Parse operator,
 * but `contains: "foo"` is `$regex: "foo"` and `between: [a, b]` is two
 * comparisons under an `and`. If those were declared `unsupported` on the
 * Parse-wire backends, a user on *our own built-in backend* would open the
 * filter builder and find half the string operators greyed out — which reads as
 * the product being broken, not as a backend limitation, and it would be right
 * to read it that way.
 *
 * So the rule for BCN-003: if an operator can be expressed in terms of
 * operators the backend does have, express it. Only declare `unsupported` when
 * there is genuinely no answer.
 */
export const LOWERED_OPERATORS: readonly FilterOperator[] = Object.freeze([
  'contains',
  'notContains',
  'containsIgnoreCase',
  'startsWith',
  'notStartsWith',
  'startsWithIgnoreCase',
  'endsWith',
  'notEndsWith',
  'endsWithIgnoreCase',
  'between',
  'notBetween'
]);

/** The value side of a leaf condition: exactly one operator, and its argument. */
export type OperatorAndValue = {
  [K in FilterOperator]?: unknown;
} & {
  /** Regex flags, carried alongside `matchesRegex` as Parse's `$options` is. */
  options?: string;
};

/**
 * A filter node.
 *
 * Exactly one key per node — `convertFilterOp` errors on more, and has since
 * before this contract existed, so the constraint is load-bearing rather than
 * aspirational. It cannot be expressed in TypeScript without making the type
 * unusable, so it is stated here and enforced by the translators.
 */
export type Filter =
  | { and: Filter[] }
  | { or: Filter[] }
  | { idEqualTo: string }
  | { idContainedIn: string[] }
  | { relatedTo: RelatedToFilter }
  | { [field: string]: OperatorAndValue | Filter[] | string | string[] | RelatedToFilter };

/**
 * `relatedTo` is the one filter shape that names a Parse concept in the
 * contract. It is kept because Parse's `Relation` has no junction table to
 * query and so cannot be expressed as an ordinary field condition — the
 * alternative was leaving Parse's relations unfilterable. BCN-005 decides
 * whether the other backends implement it over their junction tables or declare
 * it `unsupported`.
 */
export interface RelatedToFilter {
  /** Id of the record holding the relation. */
  id: string;
  /** The relation field on that record. */
  key: string;
  /**
   * Collection the relation points at. Optional on Parse only, where it can be
   * recovered from a preloaded pointer; every other backend needs it stated.
   */
  className?: string;
}

/**
 * Directus operator → neutral operator, for BCN-003's one-shot migration of
 * saved BYOB filters.
 *
 * All 24 operators the BYOB filter builder can emit
 * (`ByobFilterBuilder/operators.ts`). Two are not one-to-one and are the only
 * interesting rows in the table:
 *
 * - `_null` / `_nnull` are nullary; `exists` is boolean-valued. The migration
 *   must write `{exists: false}` and `{exists: true}` respectively, not just
 *   rename the key.
 * - `_between` / `_nbetween` carry two values in an array. The neutral operator
 *   keeps that shape, so those two *are* plain renames — but only because
 *   `between` was defined to match rather than being lowered at rest.
 *
 * Everything else is a rename. That is what makes the migration worth doing
 * rather than accepting the break: it is mechanical, it is total, and the
 * NodeGX QA fixture's saved filters go through it.
 */
export const DIRECTUS_OPERATOR_MIGRATION: Readonly<
  Record<string, { operator: FilterOperator; value?: 'literal' | 'true' | 'false' }>
> = Object.freeze({
  _eq: { operator: 'equalTo' },
  _neq: { operator: 'notEqualTo' },
  _gt: { operator: 'greaterThan' },
  _gte: { operator: 'greaterThanOrEqualTo' },
  _lt: { operator: 'lessThan' },
  _lte: { operator: 'lessThanOrEqualTo' },
  _contains: { operator: 'contains' },
  _ncontains: { operator: 'notContains' },
  _icontains: { operator: 'containsIgnoreCase' },
  _starts_with: { operator: 'startsWith' },
  _nstarts_with: { operator: 'notStartsWith' },
  _istarts_with: { operator: 'startsWithIgnoreCase' },
  _ends_with: { operator: 'endsWith' },
  _nends_with: { operator: 'notEndsWith' },
  _iends_with: { operator: 'endsWithIgnoreCase' },
  _in: { operator: 'containedIn' },
  _nin: { operator: 'notContainedIn' },
  _null: { operator: 'exists', value: 'false' },
  _nnull: { operator: 'exists', value: 'true' },
  _between: { operator: 'between' },
  _nbetween: { operator: 'notBetween' },
  _empty: { operator: 'isEmpty' },
  _nempty: { operator: 'isNotEmpty' },
  _regex: { operator: 'matchesRegex' }
});
