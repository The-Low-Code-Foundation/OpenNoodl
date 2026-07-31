/**
 * `toParseWhere` — the neutral filter as a Parse `where` document.
 *
 * Serves **both** Parse-family backends: upstream Parse Server and our own
 * built-in one, which speaks the same wire. They differ in what they are
 * *allowed* to be asked (the descriptors differ on `isEmpty`, `textSearch` and
 * the three geo operators), and that difference is enforced by the capability
 * gate in `translate.ts`, not by having two translators.
 *
 * This is `queryutils.ts::convertFilterOp` relocated, with four changes, each
 * of which fixes something that was silently returning the wrong rows:
 *
 * 1. **The eleven lowered operators are implemented.** `convertFilterOp` had no
 *    branch for `contains`, `startsWith`, `between` or any of their siblings —
 *    it fell off the end of the if/else chain, left `res[key]` unset and
 *    returned `{}`. A "name contains Ada" filter therefore matched *every*
 *    record. The `parse` descriptor has always claimed these were "lowered to
 *    $regex"; now they are.
 * 2. **Values are escaped before they become regular expressions.** `contains`
 *    on `a.b` no longer matches `axb`, and on `C++` no longer produces a
 *    pattern the backend rejects.
 * 3. **The schema is a parameter.** `pointsTo` read `CloudStore._collections`,
 *    a module-global mutable cache, so the query it produced depended on which
 *    collection some other node had fetched first.
 * 4. **`$maxDistanceInMiles` is read at the name its caller writes.** The old
 *    code read that one key with a leading `$` and the two beside it without,
 *    so at most one of the three could ever have worked.
 *
 * @module backend-contract/translators/parse
 */

import type { Filter } from '../filter';
import { betweenBounds, lowerToRegex } from './lowering';
import { translateWith } from './translate';
import type { DialectContext, FilterDialect, FilterNode, FilterSchema, TranslateOptions } from './types';

/** A Parse `where` document — `{ name: { $eq: 'Ada' } }`, `{ $and: [ … ] }`. */
export type ParseWhere = Record<string, unknown>;

type ConditionNode = Extract<FilterNode, { kind: 'condition' }>;

/**
 * Parse's date literal.
 *
 * A `Date` reaching the wire as an ISO string compares as text, so a range
 * filter on a date column silently sorts lexically. `convertFilterOp` wrapped
 * `Date` instances; `convertVisualFilter` instead consulted the schema and
 * wrapped anything on a `Date` column. Both are kept — the instance check
 * because it needs no schema, the schema check because a date typed into the
 * filter builder arrives as a string.
 */
function parseValue(raw: unknown, field: string, schema: FilterSchema | undefined): unknown {
  if (raw instanceof Date && typeof raw.toISOString === 'function') {
    return { __type: 'Date', iso: raw.toISOString() };
  }
  const declared = schema?.properties?.[field]?.type;
  if (declared === 'Date' && raw !== null && raw !== undefined) {
    const asDate = raw instanceof Date ? raw : new Date(String(raw));
    if (!Number.isNaN(asDate.getTime())) return { __type: 'Date', iso: asDate.toISOString() };
  }
  return raw;
}

function geoPoint(value: { latitude?: unknown; longitude?: unknown }): Record<string, unknown> {
  return { __type: 'GeoPoint', latitude: value.latitude, longitude: value.longitude };
}

function createParseDialect(): FilterDialect<ParseWhere> {
  return {
    name: 'parse',
    identityField: 'objectId',

    empty: () => ({}),
    isEmpty: (value) => Object.keys(value).length === 0,

    group(combinator, children) {
      return { [`$${combinator}`]: children };
    },

    id(node) {
      return node.operator === 'idEqualTo'
        ? { objectId: { $eq: node.value } }
        : { objectId: { $in: node.value } };
    },

    relatedTo(node, ctx) {
      const { id, key, className } = node.value;
      if (!className) {
        // The old code fell back to `Model.get(modelId)?._class`, reaching into
        // the runtime's model store from what is meant to be a pure function.
        // The caller resolves it now — `queryutils.ts` still does exactly that
        // lookup before calling, so nothing the user does has changed.
        return ctx.fail('Must preload the Pointer or include className', { operator: 'relatedTo' });
      }
      return { $relatedTo: { object: { __type: 'Pointer', objectId: id, className }, key } };
    },

    condition(node, ctx) {
      return { [node.field]: conditionValue(node, ctx) };
    }
  };
}

/**
 * The operator half of a leaf, as Parse constraints.
 *
 * Returns the object that sits under the field name. Two operators cannot be
 * expressed that way and are handled by the caller before it gets here.
 */
function conditionValue(node: ConditionNode, ctx: DialectContext): Record<string, unknown> {
  const { field, operator, value } = node;
  const schema = ctx.schema;
  const v = (raw: unknown): unknown => parseValue(raw, field, schema);

  switch (operator) {
    case 'equalTo':
      return { $eq: v(value) };
    case 'notEqualTo':
      return { $ne: v(value) };
    case 'lessThan':
      return { $lt: v(value) };
    case 'greaterThan':
      return { $gt: v(value) };
    case 'lessThanOrEqualTo':
      return { $lte: v(value) };
    case 'greaterThanOrEqualTo':
      return { $gte: v(value) };
    case 'containedIn':
      return { $in: Array.isArray(value) ? value.map(v) : [v(value)] };
    case 'notContainedIn':
      return { $nin: Array.isArray(value) ? value.map(v) : [v(value)] };
    case 'exists':
      return { $exists: value !== false };

    case 'matchesRegex':
      return node.regexOptions === undefined
        ? { $regex: value }
        : { $regex: value, $options: node.regexOptions };

    // The nine string operators, all lowered onto $regex. `LOWERED_OPERATORS`
    // is why these are here rather than gated: greying "starts with" out on a
    // backend whose regex can plainly answer it would read as the product
    // being broken.
    case 'contains':
    case 'notContains':
    case 'containsIgnoreCase':
    case 'startsWith':
    case 'notStartsWith':
    case 'startsWithIgnoreCase':
    case 'endsWith':
    case 'notEndsWith':
    case 'endsWithIgnoreCase': {
      const lowered = lowerToRegex(operator, value);
      if (!lowered) return ctx.fail(`Cannot express "${operator}"`, { operator, field });
      return lowered.options === undefined
        ? { $regex: lowered.pattern }
        : { $regex: lowered.pattern, $options: lowered.options };
    }

    // Parse allows several constraints on one field, so a closed range is one
    // condition rather than an $and of two.
    case 'between': {
      const bounds = betweenBounds(value);
      if (!bounds) return ctx.fail('A "between" filter needs a two-element array [from, to]', { operator, field });
      return { $gte: v(bounds[0]), $lte: v(bounds[1]) };
    }

    // `notBetween` is the one lowering that changes the shape of the tree
    // rather than the value under a field — it needs an `or` across two
    // constraints on the same field. `expandNotBetween` rewrites it before the
    // walk, so the only way to arrive here is a malformed value.
    case 'notBetween':
      return ctx.fail('A "not between" filter needs a two-element array [from, to]', { operator, field });

    // Distinct from `exists`, which answers the null question. Parse has no
    // operator for "empty or missing", so this is an empty-string comparison —
    // which is why the `parse` descriptor gates it off and the `nodegx` one
    // does not.
    case 'isEmpty':
      return { $eq: '' };
    case 'isNotEmpty':
      return { $ne: '' };

    case 'textSearch': {
      if (typeof value === 'string') {
        return { $text: { $search: { $term: value, $caseSensitive: false } } };
      }
      const term = value as {
        term?: unknown;
        language?: unknown;
        caseSensitive?: unknown;
        diacriticSensitive?: unknown;
      };
      return {
        $text: {
          $search: {
            $term: term.term,
            $language: term.language,
            $caseSensitive: term.caseSensitive,
            $diacriticSensitive: term.diacriticSensitive
          }
        }
      };
    }

    case 'pointsTo': {
      const property = schema?.properties?.[field];
      if (!property?.targetClass) {
        // Previously this emitted `className: undefined`, which Parse reads as
        // a pointer to nothing and answers with an empty result set — a filter
        // that returns no rows and no error.
        return ctx.fail(
          `Filtering "${field}" by the record it points to needs the collection schema, ` +
            'so that the related collection is known.',
          { operator, field }
        );
      }
      const targetClass = property.targetClass;
      if (property.type === 'Relation') {
        return { __type: 'Pointer', objectId: value, className: targetClass };
      }
      if (Array.isArray(value)) {
        return { $in: value.map((v2) => ({ __type: 'Pointer', objectId: v2, className: targetClass })) };
      }
      return { $eq: { __type: 'Pointer', objectId: value, className: targetClass } };
    }

    case 'nearSphere': {
      const point = value as {
        latitude?: unknown;
        longitude?: unknown;
        maxDistanceInMiles?: unknown;
        maxDistanceInKilometers?: unknown;
        maxDistanceInRadians?: unknown;
      };
      const constraint: Record<string, unknown> = { $nearSphere: geoPoint(point) };
      // All three at the bare name. The old code read the first with a `$` and
      // the other two without, so a maximum distance in miles was written by
      // every caller and read by none.
      if (point.maxDistanceInMiles !== undefined) constraint.$maxDistanceInMiles = point.maxDistanceInMiles;
      if (point.maxDistanceInKilometers !== undefined)
        constraint.$maxDistanceInKilometers = point.maxDistanceInKilometers;
      if (point.maxDistanceInRadians !== undefined) constraint.$maxDistanceInRadians = point.maxDistanceInRadians;
      return constraint;
    }

    case 'withinBox': {
      if (!Array.isArray(value) || value.length !== 2) {
        return ctx.fail('A "within box" filter needs two corner points [southwest, northeast]', { operator, field });
      }
      return { $within: { $box: value.map(geoPoint) } };
    }

    case 'withinPolygon': {
      if (!Array.isArray(value) || value.length < 3) {
        return ctx.fail('A "within polygon" filter needs at least three points', { operator, field });
      }
      return { $geoWithin: { $polygon: value.map(geoPoint) } };
    }

    default:
      return ctx.fail(`The Parse dialect cannot express "${operator}"`, { operator, field });
  }
}

/**
 * Translate a neutral filter into a Parse `where` document.
 *
 * `notBetween` is rewritten into an explicit `or` of two conditions before the
 * walk, because it is the one operator whose lowering changes the *shape* of
 * the tree rather than the value under a field.
 */
export function toParseWhere(filter: Filter | null | undefined, options: TranslateOptions): ParseWhere {
  return translateWith(createParseDialect(), expandNotBetween(filter), options);
}

/**
 * Rewrite `{ f: { notBetween: [a, b] } }` as `{ or: [{f:{lessThan:a}}, {f:{greaterThan:b}}] }`.
 *
 * Done as a source-to-source rewrite on the neutral model rather than inside
 * the dialect, so the rewritten conditions go through the same capability gate
 * and the same date handling as any other comparison.
 */
function expandNotBetween(filter: Filter | null | undefined): Filter | null | undefined {
  if (!filter || typeof filter !== 'object') return filter;
  const record = filter as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length !== 1) return filter;

  const key = keys[0];
  const value = record[key];

  if ((key === 'and' || key === 'or') && Array.isArray(value)) {
    return { [key]: (value as Filter[]).map((child) => expandNotBetween(child) as Filter) } as Filter;
  }

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const bounds = betweenBounds((value as Record<string, unknown>).notBetween);
    if (bounds) {
      return { or: [{ [key]: { lessThan: bounds[0] } }, { [key]: { greaterThan: bounds[1] } }] } as Filter;
    }
  }
  return filter;
}
