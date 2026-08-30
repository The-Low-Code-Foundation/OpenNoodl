/**
 * The boundary between the runtime's filter call sites and the pure translators.
 *
 * BCN-003 moved the translation itself into `@noodl/backend-contract`, where the
 * editor can reach the same code — one translator per backend, never two copies,
 * which is the architecture RUN-003's live 403 paid for. What is left here is
 * everything a *pure* function may not do:
 *
 * - reading the collection schema out of `CloudStore._collections`, a
 *   module-global mutable cache;
 * - resolving a `relatedTo` filter's class from the model store;
 * - turning a refusal into `options.error(…)` rather than an exception, so a
 *   malformed filter degrades to a message on the node instead of taking the
 *   node down.
 *
 * `convertFilterOp` and `convertVisualFilter` keep their names and signatures on
 * purpose: six call sites across three packages read them, and moving the
 * implementation and the callers in one change would leave nothing to compare.
 *
 * @module api/queryutils
 */

import type { Filter, FilterSchema } from '@noodl/backend-contract/translators';
import {
  FilterTranslationError,
  isSavedGroup,
  isVisualQueryFormat,
  savedFilterToNeutral,
  toParseWhere,
  visualQueryToNeutral,
  type SavedFilterGroup,
  type SavedFilterItem
} from '@noodl/backend-contract/translators';
import type { ModelLike, ModelModule, ModelScopeLike } from '@noodl/types';

import CloudStore = require('./cloudstore');
import ModelImport = require('../model');

const Model = ModelImport as unknown as ModelModule;

/**
 * The one deliberate escape hatch in this file, and the reason it cannot be removed.
 *
 * A Parse query is an *open, arbitrarily nested* JSON document — `{ prop: { $gt: 3 } }`,
 * `{ $and: [ … ] }`, `{ $relatedTo: { object: { __type: 'Pointer', … } } }` — and
 * `matchesQuery` walks it dynamically, reading `query[k]['$eq']` for a `k` and an operator
 * neither of which is known statically. Typing the document as `unknown` does not describe
 * it any better; it only moves the same assertion to fifteen read sites and hides it.
 * Declared once, named, and documented here instead.
 */
type OpenJson = any;

/**
 * A Parse-style query document — `{ prop: { $gt: 3 } }`, `{ $and: [...] }`, and so on.
 * Deliberately open: this module's whole job is producing and interpreting it, and the
 * backend accepts more operators than any one function here writes.
 */
export type ParseQuery = Record<string, OpenJson>;

/** A leaf or group in the editor's visual filter tree. */
export interface VisualFilterQuery {
  /** `'and'` or `'or'` — present only on a group, alongside {@link rules}. */
  combinator?: string;
  rules?: VisualFilterQuery[];
  /** Set on a leaf whose value comes from a port rather than a literal. */
  input?: string;
  value?: unknown;
  property?: string;
  operator?: string;
  /** For `'related to'`: the class the relation points at. */
  relatedTo?: string;
  relationProperty?: string;
}

export interface VisualFilterOptions {
  queryParameters: Record<string, unknown>;
  collectionName?: string;
  /**
   * The prefix this node puts on a filter-value input port — `'qp-'` on Query
   * Records, `'fp-'` on Filter Records.
   *
   * Needed only for a filter saved by the converged builder, which stores the
   * port name whole where `QueryEditor` stored the bare parameter name.
   * `queryParameters` is still keyed by the bare name, because that is what the
   * node's own setter strips it down to.
   */
  valuePortPrefix?: string;
}

/** One row of the editor's visual sorting list. */
export interface VisualSorting {
  property: string;
  order?: 'ascending' | 'descending';
}

/**
 * The schema of one collection, as the translators want it.
 *
 * This function is the reason `FilterSchema` is a parameter rather than
 * something the translator reads for itself. `CloudStore._collections` is a
 * module-global mutable cache filled in by whichever node fetched a schema
 * first, so a translator reading it directly produced a different query
 * depending on what else the app had done — and could not be unit-tested
 * against two collections in one run, or used by the editor at all.
 */
function schemaFor(collectionName: string | undefined): FilterSchema | undefined {
  if (!collectionName) return undefined;
  // Both this getter and `CloudStore.instance` below read
  // `NoodlRuntime.instance`, and one of them constructs a `CloudStore` as a
  // side effect. Neither is guaranteed in every context a filter is translated
  // from — the cloud runtime's `records.js` is one — and translating a filter
  // must never be the thing that builds a singleton or throws for want of
  // ambient state. Without a schema the translators still handle every operator
  // but `pointsTo`, which says so rather than guessing.
  let collection;
  try {
    collection = CloudStore._collections[collectionName];
  } catch (e) {
    return undefined;
  }
  if (!collection) return undefined;
  if (collection.schema) return { collection: collectionName, properties: collection.schema.properties };
  // `dbCollections` metadata comes in two shapes: a Parse-era entry carries
  // `schema.properties`; the built-in backend's cache (SchemaHandler reading
  // `backend:getSchema`) carries a `columns` array. A `pointsTo` filter against
  // the second shape used to read as "no schema" and be refused.
  if (Array.isArray(collection.columns)) {
    const properties: Record<string, { type?: string; required?: boolean; targetClass?: string }> = {};
    for (const column of collection.columns) {
      if (column && column.name) {
        properties[column.name] = { type: column.type, required: column.required, targetClass: column.targetClass };
      }
    }
    return { collection: collectionName, properties };
  }
  return undefined;
}

/**
 * Which backend the Parse wire is currently pointed at.
 *
 * `CloudStore._handle()` answers `nodegx` unconditionally today — BCN-002 left
 * it as a floor with a comment saying so, and BCN-009 is what makes it real.
 * Reading it here rather than hard-coding the same constant means the day it
 * starts telling the truth, the capability gate starts telling the truth too.
 */
/**
 * Which of the two Parse-family capability tables applies.
 *
 * ⚠️ **Exported for the port declaration, and it currently reads a floor.**
 * `CloudStore._handle()` answers `nodegx` unconditionally (BCN-009's step 4,
 * unstarted), so a project pointed at an upstream Parse Server is gated against
 * our own backend's table. That is the *more permissive* of the two, so it can
 * only fail to gate an operator — never gate one off that the backend could
 * have answered. The reverse would be the harmful direction.
 */
export function backendType(): 'nodegx' | 'parse' {
  try {
    const handle = CloudStore.instance && CloudStore.instance._handle && CloudStore.instance._handle();
    return handle && handle.type === 'parse' ? 'parse' : 'nodegx';
  } catch (e) {
    // See `schemaFor`. `nodegx` is the right floor rather than an arbitrary
    // one: it is the more permissive of the two tables, so falling back to it
    // cannot gate an operator off that the backend can actually answer.
    return 'nodegx';
  }
}

/**
 * Fill in a `relatedTo` filter's class from the model store, at any depth.
 *
 * The translator cannot do this: `Model.get(id)?._class` is a reach into
 * runtime state, and a pure function that did it would be untestable and
 * order-dependent. Doing it here keeps the lookup exactly where it was while
 * leaving the translator pure.
 */
function resolveRelatedClasses(filter: Filter, modelScope: ModelScopeLike | undefined): Filter {
  if (!filter || typeof filter !== 'object') return filter;
  const record = filter as Record<string, OpenJson>;

  if (Array.isArray(record.and)) {
    return { and: record.and.map((child: Filter) => resolveRelatedClasses(child, modelScope)) } as Filter;
  }
  if (Array.isArray(record.or)) {
    return { or: record.or.map((child: Filter) => resolveRelatedClasses(child, modelScope)) } as Filter;
  }
  if (record.relatedTo && typeof record.relatedTo === 'object' && !record.relatedTo.className) {
    const id = record.relatedTo.id;
    const className = id === undefined ? undefined : (modelScope || Model).get(id)?._class;
    if (className !== undefined) {
      return { relatedTo: { ...record.relatedTo, className } } as Filter;
    }
  }
  return filter;
}

function stripPortPrefix(portName: string, prefix: string | undefined): string {
  return prefix && portName.startsWith(prefix) ? portName.slice(prefix.length) : portName;
}

/**
 * The names of the filter parameters a saved filter needs input ports for.
 *
 * Both Parse-family nodes build their dynamic `qp-`/`fp-` ports from this, and
 * both saved shapes are read for the same reason `convertVisualFilter` reads
 * both: a project that has not been opened since BCN-003b still holds the old
 * one, and a node whose ports vanished would drop every wire attached to them.
 *
 * Returns the **bare** parameter name in both cases — the caller adds its own
 * prefix, because the two nodes do not share one.
 */
export function collectFilterParameters(
  query: VisualFilterQuery | undefined,
  valuePortPrefix: string
): string[] {
  const names: string[] = [];

  function walkVisual(node: VisualFilterQuery | undefined): void {
    if (node === undefined) return;
    if (node.rules !== undefined) node.rules.forEach(walkVisual);
    else if (node.input !== undefined && !names.includes(node.input)) names.push(node.input);
  }

  function walkSaved(item: SavedFilterItem | undefined): void {
    if (!item) return;
    if (isSavedGroup(item)) {
      (item.conditions ?? []).forEach(walkSaved);
      return;
    }
    if (item.valueSource !== 'connected' || !item.valuePortName) return;
    const name = stripPortPrefix(item.valuePortName, valuePortPrefix);
    if (!names.includes(name)) names.push(name);
  }

  if (query === undefined) return names;
  if (isVisualQueryFormat(query)) walkVisual(query);
  else walkSaved(query as unknown as SavedFilterItem);
  return names;
}

/**
 * Convert the editor's visual filter tree into a Parse `where` document.
 *
 * Two steps now, where it used to be one: the tree becomes a neutral filter
 * (`visualQueryToNeutral`, which knows the English operator names the
 * `QueryEditor` writes), and the neutral filter becomes Parse. Splitting them
 * is what lets BCN-003b retire one of the two visual builders without touching
 * a translator, and it means this tree gets the escaped regexes and the
 * schema-driven date handling the JSON filter path gets.
 *
 * `options.error` is optional and new. Without it the old silent failure is
 * preserved for callers that have their own try/catch — `filterdbmodelsnode`
 * has had one since NDA-004.
 *
 * ## Two saved shapes, and why both are read here
 *
 * BCN-003b retired `QueryEditor` in favour of the one builder, so a Query
 * Records node's `visualFilter` now holds `{type, conditions}` rather than
 * `{combinator, rules}`. **The editor rewrites the old shape when a project is
 * opened, and a deployed app never opens the editor** — so the runtime reads
 * both, exactly as BCN-003 made it migrate BYOB's operator names in both
 * places. A published app whose filters stopped working the day its author
 * upgraded is not "migrate rather than break".
 */
/**
 * The editor's visual filter tree as a **neutral** filter — the step before a dialect.
 *
 * BCN-004 step 5 needs this half on its own. `RestDataAdapter` takes a neutral filter and
 * runs BCN-003's translator for Directus, PostgREST or PocketBase itself; handing it the
 * Parse `where` {@link convertVisualFilter} produces would be translating an
 * already-translated filter, which is how RUN-003's second Directus converter came to
 * emit a flat `"author.name"` key that a live server answers with a 403.
 *
 * Both saved shapes are read here rather than in each caller, for the reason
 * {@link convertVisualFilter} records: a deployed app never opens the editor, so the
 * runtime is the only thing that will ever migrate the old one.
 */
export function convertVisualFilterToNeutral(
  query: VisualFilterQuery,
  options: VisualFilterOptions
): Filter | undefined {
  const neutral = isVisualQueryFormat(query)
    ? visualQueryToNeutral(query, options.queryParameters)
    : savedFilterToNeutral(
        query as unknown as SavedFilterGroup,
        (portName) => options.queryParameters[stripPortPrefix(portName, options.valuePortPrefix)],
        // The Parse family's optional-filter-port behaviour: a rule whose port
        // supplies nothing does not narrow the query. Every graph relies on it.
        { dropUnresolvedConnected: true }
      );

  return neutral === null ? undefined : neutral;
}

export function convertVisualFilter(
  query: VisualFilterQuery,
  options: VisualFilterOptions
): ParseQuery | undefined {
  const neutral = convertVisualFilterToNeutral(query, options);
  if (neutral === undefined) return undefined;

  const where = toParseWhere(resolveRelatedClasses(neutral, undefined), {
    backend: backendType(),
    schema: schemaFor(options.collectionName)
  });
  return Object.keys(where).length === 0 ? undefined : (where as ParseQuery);
}

/**
 * One operator of a leaf condition, evaluated against a loaded record's value.
 *
 * ⚠️ **Three things changed here, and `between` is why.**
 *
 * This used to be an if/else chain inside `matchesQuery`, which meant a
 * condition carrying two operators had only its *first* one evaluated. That was
 * survivable while `convertFilterOp` never produced such a condition. It does
 * now: `between` lowers to `{$gte, $lte}` on one field, because Parse allows
 * several constraints on a field and one condition beats an `$and` of two. With
 * the chain, the lower bound would simply not have been checked locally — a
 * record outside the range appearing in a Query Records node's results while
 * the backend correctly excluded it.
 *
 * The two defects PLAT-003 recorded and left verbatim are fixed with it, since
 * both sit on the path `between` now takes:
 *
 * - `$lte` compared against `$lt`, which is `undefined` on an `$lte`-only
 *   condition — and every comparison with `undefined` is false, so a `$lte`
 *   filter had never matched a local record.
 * - `$nin` read `$in`, so a `$nin`-only condition threw a `TypeError`.
 *
 * And `{$exists: false}` was read as `{$exists: true}` — the old branch tested
 * `value !== undefined` whatever the operand was, so "has no email" matched
 * exactly the records that *had* one.
 */
function matchesOperator(value: unknown, op: string, condition: OpenJson): boolean {
  const operand = condition[op];
  switch (op) {
    case '$eq':
      // Loose equality is deliberate: a filter value arriving from an input
      // port is often a string where the record holds a number.
      return operand && operand.__type === 'Pointer' ? value === operand.objectId : value == operand;
    case '$ne':
      return value != operand;
    case '$lt':
      return (value as number) < operand;
    case '$lte':
      return (value as number) <= operand;
    case '$gt':
      return (value as number) > operand;
    case '$gte':
      return (value as number) >= operand;
    case '$exists':
      return operand === false ? value === undefined || value === null : value !== undefined && value !== null;
    case '$in':
      return Array.isArray(operand) && operand.indexOf(value) !== -1;
    case '$nin':
      return Array.isArray(operand) && operand.indexOf(value) === -1;
    case '$regex':
      if (value === undefined || value === null) return false;
      return new RegExp(operand, condition['$options']).test(String(value));
    default:
      // An operator with no branch here would otherwise contribute nothing and
      // let a record through that the backend excluded — the same widening
      // BCN-003 closes everywhere else. There is no channel to report on from
      // inside a local match, so it is left permissive and named instead of
      // being silently absent.
      return true;
  }
}

/**
 * Evaluates a query against an already-loaded record, without going to the backend.
 *
 * This is how a Query Records node decides whether a locally created or edited record
 * belongs in its result set, so it must agree with what the backend would have said — and
 * where it cannot, it says no: `$relatedTo` sets `match = false` outright, because a
 * relation cannot be resolved from one record.
 *
 * Note the return type. `match &= …` coerces to a *number*, so this returns `0`/`1` rather
 * than a boolean on every path but the early one. Every caller uses it truthily.
 */
export function matchesQuery(model: ModelLike, query?: ParseQuery): boolean | number {
  // Every `&=`/`|=` right-hand side below is wrapped in `Number(...)`. That is exactly the
  // coercion the compound bitwise assignment already performs on a boolean at runtime —
  // TypeScript simply will not accept a boolean operand — so the conversion is inert.
  let match: OpenJson = true;

  if (query === undefined) return true;

  if (query['$and'] !== undefined) {
    query['$and'].forEach((q) => {
      match &= Number(matchesQuery(model, q));
    });
  } else if (query['$or'] !== undefined) {
    match = false;
    query['$or'].forEach((q) => {
      match |= Number(matchesQuery(model, q));
    });
  } else {
    const keys = Object.keys(query);
    keys.forEach((k) => {
      if (k === 'objectId') {
        if (query[k]['$eq'] !== undefined) match &= Number(model.getId() === query[k]['$eq']);
        else if (query[k]['$in'] !== undefined) match &= Number(query[k]['$in'].indexOf(model.getId()) !== -1);
      } else if (k === '$relatedTo') {
        match = false; // cannot resolve relation queries locally
      } else {
        const value = model.get(k);
        const condition = query[k];
        // `$options` is a modifier on `$regex`, not a condition of its own.
        Object.keys(condition)
          .filter((op) => op !== '$options')
          .forEach((op) => {
            match &= Number(matchesOperator(value, op, condition));
          });
      }
    });
  }
  return match;
}

/** An `Array.prototype.sort` comparator built from a Parse-style sort list. */
export function compareObjects(sort: string[], a: ModelLike, b: ModelLike): number {
  for (let i = 0; i < sort.length; i++) {
    const _s = sort[i];
    if (_s[0] === '-') {
      // Descending
      const prop = _s.substring(1);
      if (a.get(prop) > b.get(prop)) return -1;
      else if (a.get(prop) < b.get(prop)) return 1;
    } else {
      // Ascending
      if (a.get(_s) > b.get(_s)) return 1;
      else if (a.get(_s) < b.get(_s)) return -1;
    }
  }
  return 0;
}

export function convertVisualSorting(sorting: VisualSorting[]): string[] {
  return sorting.map((s) => {
    return (s.order === 'descending' ? '-' : '') + s.property;
  });
}

export interface FilterOpOptions {
  collectionName?: string;
  modelScope?: ModelScopeLike;
  error: (error: string) => void;
}

/**
 * Converts the *user-facing* filter language — the one a Filter Records node's `filter`
 * input is written in — into the Parse query the backend understands.
 *
 * `options.error` is called rather than thrown, and the function then returns
 * `{}`, so a malformed filter degrades to "no filter" with a message rather
 * than taking the node down. That is the pre-existing contract and it is kept.
 *
 * ⚠️ **What this used to do, and no longer does.** The if/else chain it replaces
 * had no branch for eleven of the operators the vocabulary defines —
 * `contains`, `startsWith`, `endsWith`, `between` and their negative and
 * case-insensitive siblings. It fell off the end of the chain, left `res[key]`
 * unset, and returned `{}`. So a "name contains Ada" filter did not narrow
 * anything: the query succeeded and returned **every record in the
 * collection**, with no error anywhere. Those eleven are lowered onto `$regex`
 * and comparisons now, which is what the `parse` descriptor had claimed all
 * along.
 *
 * A second widening is closed at the same time: a leaf carrying two operators
 * (`{price: {greaterThan: 1, lessThan: 5}}`) took whichever the chain reached
 * first and dropped the other. It is refused now.
 */
export function convertFilterOp(filter: ParseQuery, options: FilterOpOptions): ParseQuery {
  try {
    const resolved = resolveRelatedClasses(filter as Filter, options.modelScope);
    return toParseWhere(resolved, {
      backend: backendType(),
      schema: schemaFor(options.collectionName)
    }) as ParseQuery;
  } catch (e) {
    if (e instanceof FilterTranslationError) {
      // The message carries the capability table's own sentence when the
      // refusal came from a gated operator — the same words the editor shows
      // under the greyed-out port.
      options.error(e.message);
      return {};
    }
    throw e;
  }
}
