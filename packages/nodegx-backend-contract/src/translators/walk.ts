/**
 * Reading one node of the neutral filter, once, for all five dialects.
 *
 * @module backend-contract/translators/walk
 */

import { FILTER_OPERATORS, type Filter, type FilterOperator, type RelatedToFilter } from '../filter';
import { FilterTranslationError, type FilterNode } from './types';

/** Operator keys that may sit at the top level of a node rather than under a field. */
const TOP_LEVEL_OPERATORS = ['idEqualTo', 'idContainedIn', 'relatedTo'] as const;

const OPERATOR_SET = new Set<string>(FILTER_OPERATORS);

/**
 * Keys that appear inside a leaf's operator object without being the operator.
 *
 * `options` is Parse's regex-flags sibling of `$regex`, carried through the
 * neutral model under the same name. It has to be excluded explicitly or a
 * `matchesRegex` condition reads as two operators and is rejected.
 */
const NON_OPERATOR_KEYS = new Set<string>(['options']);

/**
 * Parse one node of a neutral filter.
 *
 * ## The one-key rule
 *
 * A node carries exactly one key. `convertFilterOp` has enforced that since
 * before this contract existed — it is not a new constraint, and the neutral
 * `Filter` type says so in prose because TypeScript cannot say it in types.
 *
 * ## The second-operator rule, which is new
 *
 * A *leaf* carries exactly one operator too, and that one is a tightening.
 * `convertFilterOp` walked an if/else chain and took the first branch that
 * matched, so `{price: {greaterThan: 1, lessThan: 5}}` quietly became
 * `price > 1` — the upper bound gone, and the query returning more rows than
 * the filter asked for. That is the exact failure class this task exists to
 * close, so it raises now rather than choosing for the caller. A range is
 * `between`, or an explicit `and` of two conditions.
 */
export function parseFilterNode(filter: Filter | null | undefined): FilterNode {
  if (filter === null || filter === undefined) return { kind: 'empty' };
  if (typeof filter !== 'object' || Array.isArray(filter)) {
    throw new FilterTranslationError(`A filter must be an object, found ${describe(filter)}`);
  }

  const record = filter as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length === 0) return { kind: 'empty' };
  if (keys.length !== 1) {
    throw new FilterTranslationError(
      `A filter must have exactly one key, found ${keys.length}: ${keys.join(', ')}. ` +
        'Combine conditions with { and: [ … ] } or { or: [ … ] }.'
    );
  }

  const key = keys[0];
  const value = record[key];

  if ((key === 'and' || key === 'or') && Array.isArray(value)) {
    return { kind: 'group', combinator: key, children: value as Filter[] };
  }

  if (key === 'idEqualTo' || key === 'idContainedIn') {
    return { kind: 'id', operator: key, value };
  }

  if (key === 'relatedTo') {
    const related = value as RelatedToFilter | undefined;
    if (!related || typeof related !== 'object') {
      throw new FilterTranslationError('A relatedTo filter must be an object with id and key', {
        operator: 'relatedTo'
      });
    }
    if (related.id === undefined) {
      throw new FilterTranslationError('Must provide id in relatedTo filter', { operator: 'relatedTo' });
    }
    if (related.key === undefined) {
      throw new FilterTranslationError('Must provide key in relatedTo filter', { operator: 'relatedTo' });
    }
    return { kind: 'relatedTo', value: related };
  }

  // Anything else is a leaf, keyed by field name.
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new FilterTranslationError(
      `The condition on "${key}" must be an object like { equalTo: … }, found ${describe(value)}`,
      { field: key }
    );
  }

  const opAndValue = value as Record<string, unknown>;
  const operatorKeys = Object.keys(opAndValue).filter((k) => !NON_OPERATOR_KEYS.has(k));

  // `{ field: { text: { search: … } } }` is the spelling the Filter Records
  // node's `filter` input has always used, and it is saved in user projects.
  // The neutral vocabulary names it `textSearch`; both are accepted here so the
  // rename does not break a saved filter.
  if (operatorKeys.length === 1 && operatorKeys[0] === 'text') {
    const text = opAndValue.text as { search?: unknown } | undefined;
    if (!text || typeof text !== 'object' || text.search === undefined) {
      throw new FilterTranslationError(`The text filter on "${key}" needs a search value`, {
        field: key,
        operator: 'textSearch'
      });
    }
    return { kind: 'condition', field: key, operator: 'textSearch', value: text.search };
  }

  if (operatorKeys.length === 0) {
    throw new FilterTranslationError(
      `The condition on "${key}" has no operator. Expected one of: ${FILTER_OPERATORS.join(', ')}.`,
      { field: key }
    );
  }
  if (operatorKeys.length > 1) {
    throw new FilterTranslationError(
      `The condition on "${key}" has ${operatorKeys.length} operators (${operatorKeys.join(', ')}), ` +
        'and only one can be applied. Use "between", or combine two conditions with { and: [ … ] }.',
      { field: key }
    );
  }

  const operator = operatorKeys[0];
  if (!OPERATOR_SET.has(operator)) {
    throw new FilterTranslationError(
      `"${operator}" is not a filter operator. Expected one of: ${FILTER_OPERATORS.join(', ')}.`,
      { field: key }
    );
  }

  const node: FilterNode = {
    kind: 'condition',
    field: key,
    operator: operator as FilterOperator,
    value: opAndValue[operator]
  };
  if (operator === 'matchesRegex' && typeof opAndValue.options === 'string') {
    node.regexOptions = opAndValue.options;
  }
  return node;
}

/** True when this node contributes nothing and can be dropped from a group. */
export function isEmptyNode(node: FilterNode): boolean {
  return node.kind === 'empty';
}

export const TOP_LEVEL_OPERATOR_KEYS: readonly string[] = TOP_LEVEL_OPERATORS;

function describe(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'an array';
  return typeof value;
}
