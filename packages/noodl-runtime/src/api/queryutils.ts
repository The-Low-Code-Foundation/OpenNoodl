import type { ModelLike, ModelModule, ModelScopeLike } from '@noodl/types';

import CloudStore = require('./cloudstore');
import ModelImport = require('../model');

const Model = ModelImport as unknown as ModelModule;

/**
 * A Parse-style query document — `{ prop: { $gt: 3 } }`, `{ $and: [...] }`, and so on.
 * Deliberately open: this module's whole job is producing and interpreting it, and the
 * backend accepts more operators than any one function here writes.
 */
export type ParseQuery = Record<string, any>;

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
}

/** One row of the editor's visual sorting list. */
export interface VisualSorting {
  property: string;
  order?: 'ascending' | 'descending';
}

export function convertVisualFilter(
  query: VisualFilterQuery,
  options: VisualFilterOptions
): ParseQuery | undefined {
  const inputs = options.queryParameters;

  if (query.combinator !== undefined && query.rules !== undefined) {
    if (query.rules.length === 0) return;
    else if (query.rules.length === 1) return convertVisualFilter(query.rules[0], options);
    else {
      const _res: ParseQuery = {};
      const _op = '$' + query.combinator;
      _res[_op] = [];
      query.rules.forEach((r) => {
        const cond = convertVisualFilter(r, options);
        if (cond !== undefined) _res[_op].push(cond);
      });

      return _res;
    }
  } else if (query.operator === 'related to') {
    const value = query.input !== undefined ? inputs[query.input] : undefined;
    if (value === undefined) return;

    return {
      $relatedTo: {
        object: {
          __type: 'Pointer',
          objectId: value,
          className: query.relatedTo
        },
        key: query.relationProperty
      }
    };
  } else {
    const _res: ParseQuery = {};
    let cond;
    let value: any = query.input !== undefined ? inputs[query.input] : query.value;

    if (query.operator === 'exist') {
      _res[query.property] = { $exists: true };
      return _res;
    } else if (query.operator === 'not exist') {
      _res[query.property] = { $exists: false };
      return _res;
    }

    if (value === undefined) return;

    // Declared inside the `if` and read after it — `var` hoisting, which §23.1 flagged as
    // the pattern a mechanical `var`→`const` rewrite silently breaks. Hoisted by hand.
    let schema;
    if (CloudStore._collections[options.collectionName])
      schema = CloudStore._collections[options.collectionName].schema;

    const propertyType =
      schema && schema.properties && schema.properties[query.property]
        ? schema.properties[query.property].type
        : undefined;

    if (propertyType === 'Date') {
      if (!(value instanceof Date)) value = new Date(value.toString());
      value = { __type: 'Date', iso: value.toISOString() };
    }

    if (query.operator === 'greater than') cond = { $gt: value };
    else if (query.operator === 'greater than or equal to') cond = { $gte: value };
    else if (query.operator === 'less than') cond = { $lt: value };
    else if (query.operator === 'less than or equal to') cond = { $lte: value };
    else if (query.operator === 'equal to') cond = { $eq: value };
    else if (query.operator === 'not equal to') cond = { $ne: value };
    else if (query.operator === 'points to') {
      const targetClass =
        schema && schema.properties && schema.properties[query.property]
          ? schema.properties[query.property].targetClass
          : undefined;

      cond = {
        $eq: { __type: 'Pointer', objectId: value, className: targetClass }
      };
    } else if (query.operator === 'contain') {
      cond = { $regex: value, $options: 'i' };
    }

    _res[query.property] = cond;

    return _res;
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
  let match: any = true;

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
        if (query[k]['$eq'] !== undefined && query[k]['$eq'].__type === 'Pointer')
          match &= Number(value === query[k]['$eq'].objectId);
        else if (query[k]['$eq'] !== undefined) match &= Number(value == query[k]['$eq']);
        else if (query[k]['$ne'] !== undefined) match &= Number(value != query[k]['$ne']);
        else if (query[k]['$lt'] !== undefined) match &= Number(value < query[k]['$lt']);
        // DEFECT (PLAT-003 NOTES §29.3), left verbatim: `$lte` compares against `$lt`,
        // which is `undefined` on an `$lte`-only condition — and every comparison with
        // `undefined` is false. So a `$lte` filter has never matched a local record, while
        // the same filter sent to the backend matches correctly. The two disagree.
        else if (query[k]['$lte'] !== undefined) match &= Number(value <= query[k]['$lt']);
        else if (query[k]['$gt'] !== undefined) match &= Number(value > query[k]['$gt']);
        else if (query[k]['$gte'] !== undefined) match &= Number(value >= query[k]['$gte']);
        else if (query[k]['$exists'] !== undefined) match &= Number(value !== undefined);
        else if (query[k]['$in'] !== undefined) match &= Number(query[k]['$in'].indexOf(value) !== -1);
        // DEFECT (PLAT-003 NOTES §29.3), left verbatim: `$nin` reads `$in`. On a condition
        // that carries only `$nin` that is `undefined`, so this throws a `TypeError`
        // rather than mismatching quietly.
        else if (query[k]['$nin'] !== undefined) match &= Number(query[k]['$in'].indexOf(value) === -1);
        else if (query[k]['$regex'] !== undefined)
          match &= Number(new RegExp(query[k]['$regex'], query[k]['$options']).test(value as string));
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

function _value(v: unknown): unknown {
  if (v instanceof Date && typeof v.toISOString === 'function') {
    return {
      __type: 'Date',
      iso: v.toISOString()
    };
  }
  return v;
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
 * `options.error` is called rather than thrown, and the function then returns whatever
 * `error` returned (usually `undefined`), so a malformed filter degrades to "no filter"
 * with a message rather than taking the node down.
 */
export function convertFilterOp(filter: Record<string, any>, options: FilterOpOptions): ParseQuery {
  const keys = Object.keys(filter);
  if (keys.length === 0) return {};
  if (keys.length !== 1) {
    return options.error('Filter must only have one key found ' + keys.join(',')) as unknown as ParseQuery;
  }

  const res: ParseQuery = {};
  const key = keys[0];
  if (filter['and'] !== undefined && Array.isArray(filter['and'])) {
    res['$and'] = filter['and'].map((f) => convertFilterOp(f, options));
  } else if (filter['or'] !== undefined && Array.isArray(filter['or'])) {
    res['$or'] = filter['or'].map((f) => convertFilterOp(f, options));
  } else if (filter['idEqualTo'] !== undefined) {
    res['objectId'] = { $eq: filter['idEqualTo'] };
  } else if (filter['idContainedIn'] !== undefined) {
    res['objectId'] = { $in: filter['idContainedIn'] };
  } else if (filter['relatedTo'] !== undefined) {
    const modelId = filter['relatedTo']['id'];
    if (modelId === undefined) {
      return options.error('Must provide id in relatedTo filter') as unknown as ParseQuery;
    }

    const relationKey = filter['relatedTo']['key'];
    if (relationKey === undefined) {
      return options.error('Must provide key in relatedTo filter') as unknown as ParseQuery;
    }

    const className = filter['relatedTo']['className'] || (options.modelScope || Model).get(modelId)?._class;
    if (typeof className === 'undefined') {
      // Either the pointer is loaded as an object or we allow passing in the className.
      return options.error('Must preload the Pointer or include className') as unknown as ParseQuery;
    }

    res['$relatedTo'] = {
      object: {
        __type: 'Pointer',
        objectId: modelId,
        className
      },
      key: relationKey
    };
  } else if (typeof filter[key] === 'object') {
    const opAndValue = filter[key];
    if (opAndValue['equalTo'] !== undefined) res[key] = { $eq: _value(opAndValue['equalTo']) };
    else if (opAndValue['notEqualTo'] !== undefined) res[key] = { $ne: _value(opAndValue['notEqualTo']) };
    else if (opAndValue['lessThan'] !== undefined) res[key] = { $lt: _value(opAndValue['lessThan']) };
    else if (opAndValue['greaterThan'] !== undefined) res[key] = { $gt: _value(opAndValue['greaterThan']) };
    else if (opAndValue['lessThanOrEqualTo'] !== undefined) res[key] = { $lte: _value(opAndValue['lessThanOrEqualTo']) };
    else if (opAndValue['greaterThanOrEqualTo'] !== undefined)
      res[key] = { $gte: _value(opAndValue['greaterThanOrEqualTo']) };
    else if (opAndValue['exists'] !== undefined) res[key] = { $exists: opAndValue['exists'] };
    else if (opAndValue['containedIn'] !== undefined) res[key] = { $in: opAndValue['containedIn'] };
    else if (opAndValue['notContainedIn'] !== undefined) res[key] = { $nin: opAndValue['notContainedIn'] };
    else if (opAndValue['pointsTo'] !== undefined) {
      let schema = null;
      if (CloudStore._collections[options.collectionName]) {
        schema = CloudStore._collections[options.collectionName].schema;
      }

      const targetClass =
        schema && schema.properties && schema.properties[key] ? schema.properties[key].targetClass : undefined;
      const type = schema && schema.properties && schema.properties[key] ? schema.properties[key].type : undefined;

      if (type === 'Relation') {
        res[key] = {
          __type: 'Pointer',
          objectId: opAndValue['pointsTo'],
          className: targetClass
        };
      } else {
        if (Array.isArray(opAndValue['pointsTo'])) {
          res[key] = {
            $in: opAndValue['pointsTo'].map((v) => {
              return { __type: 'Pointer', objectId: v, className: targetClass };
            })
          };
        } else {
          res[key] = {
            $eq: {
              __type: 'Pointer',
              objectId: opAndValue['pointsTo'],
              className: targetClass
            }
          };
        }
      }
    } else if (opAndValue['matchesRegex'] !== undefined) {
      res[key] = {
        $regex: opAndValue['matchesRegex'],
        $options: opAndValue['options']
      };
    } else if (opAndValue['text'] !== undefined && opAndValue['text']['search'] !== undefined) {
      const _v = opAndValue['text']['search'];
      if (typeof _v === 'string') res[key] = { $text: { $search: { $term: _v, $caseSensitive: false } } };
      else
        res[key] = {
          $text: {
            $search: {
              $term: _v.term,
              $language: _v.language,
              $caseSensitive: _v.caseSensitive,
              $diacriticSensitive: _v.diacriticSensitive
            }
          }
        };
      // Geo points
    } else if (opAndValue['nearSphere'] !== undefined) {
      const _v = opAndValue['nearSphere'];
      res[key] = {
        $nearSphere: {
          __type: 'GeoPoint',
          latitude: _v.latitude,
          longitude: _v.longitude
        },
        // Note the inconsistency, left verbatim: the first reads `$maxDistanceInMiles`
        // with the `$`, the other two read the bare name. Only one of the three can be
        // receiving what its caller writes.
        $maxDistanceInMiles: _v.$maxDistanceInMiles,
        $maxDistanceInKilometers: _v.maxDistanceInKilometers,
        $maxDistanceInRadians: _v.maxDistanceInRadians
      };
    } else if (opAndValue['withinBox'] !== undefined) {
      const _v = opAndValue['withinBox'];
      res[key] = {
        $within: {
          $box: _v.map((gp) => ({
            __type: 'GeoPoint',
            latitude: gp.latitude,
            longitude: gp.longitude
          }))
        }
      };
    } else if (opAndValue['withinPolygon'] !== undefined) {
      const _v = opAndValue['withinPolygon'];
      res[key] = {
        $geoWithin: {
          $polygon: _v.map((gp) => ({
            __type: 'GeoPoint',
            latitude: gp.latitude,
            longitude: gp.longitude
          }))
        }
      };
    }
  } else {
    options.error('Unrecognized filter keys ' + keys.join(','));
  }

  return res;
}
