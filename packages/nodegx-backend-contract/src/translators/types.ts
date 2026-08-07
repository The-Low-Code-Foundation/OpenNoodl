/**
 * What a filter translator is, and what it is allowed to know.
 *
 * A translator is a **pure function of `(neutralFilter, context) → dialect`**.
 * That word "pure" is doing real work here, and it is the reason two things
 * that used to be ambient are now parameters:
 *
 * - **The collection schema.** `queryutils.ts` read it out of
 *   `CloudStore._collections`, a module-global mutable cache, to discover a
 *   pointer's `targetClass` and to spot `Date` fields. A function that reads
 *   process-wide mutable state cannot be unit-tested against two collections in
 *   the same run, cannot be used by the editor at all (the editor has its own
 *   schema store), and silently produces a different query depending on what
 *   some other node fetched first. It is passed in now.
 * - **The capability table.** Whether an operator may be used is not the
 *   translator's opinion — it is the descriptor's, and the editor greys the
 *   port out using the same cell and shows the same sentence. See
 *   `translate.ts` for why that matters more than it sounds.
 *
 * @module backend-contract/translators/types
 */

import type { BackendType } from '../backends';
import type { BackendDescriptor } from '../capabilities';
import type { Filter, FilterOperator, RelatedToFilter } from '../filter';

/**
 * What a translator needs to know about one field.
 *
 * Deliberately a subset of everything the various schema stores hold. A
 * translator needs the type (to serialise dates, and to tell a `Relation` from
 * a `Pointer`) and the target collection (to build a pointer value). Anything
 * more and every caller has to produce a full schema to translate a filter on
 * one string field.
 */
export interface FilterFieldSchema {
  /** Backend-side type name — `'Date'`, `'Pointer'`, `'Relation'`, `'String'`, … */
  type?: string;
  /** For `Pointer`/`Relation`: the collection pointed at. */
  targetClass?: string;
  /**
   * Whether this relation holds one record or a set of them.
   *
   * ⚠️ **Added by BCN-005 because a live PocketBase returned the wrong row set
   * without it.** PocketBase spells a filter across a relation two ways and the
   * difference is not cosmetic: `tags.label = 'x'` means *every* related record
   * matches, and `tags.label ?= 'x'` means *at least one* does. Measured on
   * 0.30.0, on a record with two tags one of which was `algebra`:
   *
   * ```
   * filter tags.label='algebra'   -> []                            <- 0 rows
   * filter tags.label?='algebra'  -> [{"title":"Notes on the …"}]   <- the row
   * ```
   *
   * So the plain form is a **silent empty result** — no error, no warning, and
   * the one failure shape this phase keeps finding. `type` alone cannot decide
   * it, because PocketBase calls both cardinalities `relation`.
   *
   * Absent means "not a relation, or cardinality unknown", and the translators
   * treat unknown as `'one'` — which is what they did before this field existed,
   * so a schema that does not carry it behaves exactly as it used to.
   */
  cardinality?: 'one' | 'many';
  /**
   * The path this relation is addressed by **on the wire**, when it is not the
   * field name.
   *
   * ⚠️ **Directus only, and it is the same two-hop fact that broke the read.**
   * A many-to-many is reachable through its junction and nothing else, so a
   * filter across one has to name the junction column:
   *
   * ```
   * filter={"tags":{"label":{"_eq":"algebra"}}}          -> 403
   *   You don't have permission to access field "label"
   *   in collection "bcn005_articles_tags"
   * filter={"tags":{"tag_id":{"label":{"_eq":"algebra"}}}} -> the row
   * ```
   *
   * Both measured live. The 403 is the *same status a real permission failure
   * gives*, which is what makes this worth a field rather than a comment — the
   * RUN-003 defect was a 403 of exactly this shape and it took a live request to
   * find. Set from the relation descriptor's `readPath`; the other dialects
   * ignore it, because a one-hop path is right for both of them (measured).
   */
  path?: string;
}

/**
 * The schema of the collection being queried, as far as filtering cares.
 *
 * Optional throughout: a filter on a plain field translates correctly with no
 * schema at all, and demanding one would mean no caller could translate until
 * it had fetched a schema it does not otherwise need. The operators that
 * genuinely cannot work without it (`pointsTo`) say so when it is missing,
 * rather than quietly emitting a pointer with `className: undefined` — which is
 * what the code this replaces did.
 */
export interface FilterSchema {
  /** Name of the collection being queried. Used only in error messages. */
  collection?: string;
  properties?: Record<string, FilterFieldSchema>;
}

/**
 * How a value that is not a literal gets resolved.
 *
 * The visual builders can bind a condition's value to an input port instead of
 * a typed literal. Resolution happens before translation — this type exists so
 * the two builder→neutral converters can share one signature.
 */
export type FilterValueResolver = (portName: string) => unknown;

export interface TranslateOptions {
  /**
   * The backend being translated for. A `BackendType` looks the shipped
   * descriptor up; a `BackendDescriptor` is passed whole for `custom`, whose
   * table the *user* filled in.
   */
  backend: BackendType | BackendDescriptor;
  schema?: FilterSchema;
  /**
   * Which `conditional` cells a live probe has settled affirmatively.
   *
   * `conditional` means "treated as unsupported until proven", so without this
   * a Supabase full-text filter raises. Passing the operator here is how a
   * caller that has run the probe says it may proceed.
   */
  probed?: readonly FilterOperator[];
  /**
   * Dialect for a `custom` backend, declared by the user alongside its
   * capability table. Ignored for every other backend type.
   */
  customDialect?: CustomDialectName;
}

/**
 * The dialects a `custom` backend may declare itself to speak.
 *
 * Richard's 2026-07-31 decision made `custom` a *declared* backend rather than
 * a data-only one, which means BCN-003 has to accept a dialect it was not
 * shipped knowing. It does not follow that we can accept an *arbitrary* one:
 * inventing a filter syntax per user needs a plugin API, and the same decision
 * explicitly bought its cheapness by not having one.
 *
 * So the middle position. A custom backend declares which of the four syntaxes
 * we already implement its API speaks, or `params` — the flat
 * `?field=value` convention the custom preset form already asks the user to
 * configure, and the only one that can be assumed of an API nobody has seen.
 */
export type CustomDialectName = 'params' | 'parse' | 'directus' | 'postgrest' | 'pocketbase';

/**
 * Raised when a filter cannot be expressed, instead of dropping the condition.
 *
 * **This is the single most important behaviour in the task.** A dropped
 * condition does not fail — it widens the query, so a filter meant to show one
 * user their own records returns everybody's, with a green tick everywhere in
 * the app. BCN-001 found our own SQL translator doing exactly that with geo
 * operators, and `convertFilterOp` doing it with every string operator it had
 * no branch for.
 *
 * `reason` is the descriptor's own sentence where there is one, so the message
 * a developer sees in the console is the message the editor shows on the port.
 */
export class FilterTranslationError extends Error {
  readonly operator?: FilterOperator;
  readonly field?: string;
  /** The user-facing sentence from the capability table, when the cell had one. */
  readonly reason?: string;

  constructor(message: string, details: { operator?: FilterOperator; field?: string; reason?: string } = {}) {
    super(message);
    this.name = 'FilterTranslationError';
    this.operator = details.operator;
    this.field = details.field;
    this.reason = details.reason;
  }
}

/**
 * One node of the neutral filter, after parsing.
 *
 * The neutral `Filter` type is an open record — it has to be, because a leaf is
 * keyed by field name — so every translator would otherwise start with the same
 * twenty lines of "which kind of node is this" and get the edge cases subtly
 * differently. Five copies of that is how the two `toDirectusFilter`s came to
 * disagree about a condition with no operator. Parsed once, in `walk.ts`.
 */
export type FilterNode =
  | { kind: 'empty' }
  | { kind: 'group'; combinator: 'and' | 'or'; children: Filter[] }
  | { kind: 'id'; operator: 'idEqualTo' | 'idContainedIn'; value: unknown }
  | { kind: 'relatedTo'; value: RelatedToFilter }
  | { kind: 'condition'; field: string; operator: FilterOperator; value: unknown; regexOptions?: string };

/**
 * What each dialect implements.
 *
 * `T` is the dialect's own output shape, and the five differ enough that
 * forcing a common one would be a lie: three produce a JSON document, PostgREST
 * produces query-string parameters plus a list of embeds, and PocketBase
 * produces an expression string plus its bound parameters. The spec's trap
 * about not forcing a body-shaped abstraction onto PostgREST is this type
 * parameter.
 *
 * Traversal, the one-key rule, capability gating and the unwrapping of
 * single-child groups all live in `translate.ts` and happen before a dialect is
 * called. What is left here is genuinely per-backend: how one condition is
 * spelled, and how a group of them is joined.
 *
 * A dialect is **created per translation**, not shared, because PocketBase's
 * has to number its bound parameters and a module-level counter would leak
 * between two unrelated queries.
 */
export interface FilterDialect<T> {
  readonly name: string;
  /** What this backend calls the record-identity field on the wire. */
  readonly identityField: string;
  /** Nothing to filter by. */
  empty(): T;
  /** True when a translated child contributes nothing and should be dropped. */
  isEmpty(value: T): boolean;
  /** Join two or more already-translated children. Never called with fewer than two. */
  group(combinator: 'and' | 'or', children: T[], ctx: DialectContext): T;
  condition(node: Extract<FilterNode, { kind: 'condition' }>, ctx: DialectContext): T;
  id(node: Extract<FilterNode, { kind: 'id' }>, ctx: DialectContext): T;
  relatedTo(node: Extract<FilterNode, { kind: 'relatedTo' }>, ctx: DialectContext): T;
}

/** Handed to a dialect so it can read the schema and refuse an operator uniformly. */
export interface DialectContext {
  schema?: FilterSchema;
  /** Refuse an operator this dialect cannot express, with a sentence for the user. */
  fail(message: string, details?: { operator?: FilterOperator; field?: string }): never;
}
