/**
 * `toPocketBaseFilter` — the neutral filter as a PocketBase filter expression.
 *
 * PocketBase's filter is a **string expression** (`status = "x" && rating > 3`),
 * which makes the obvious implementation string concatenation and the obvious
 * implementation an injection vector. A user typing `" || 1=1 || "` into a
 * search box would otherwise rewrite the query's logic — and on a collection
 * with per-user rules, read someone else's rows.
 *
 * So the translator never concatenates a value. It emits placeholders and a
 * separate parameter map, exactly as PocketBase's own SDK helper `pb.filter()`
 * does, and `bindPocketBaseFilter` performs the substitution with each value
 * encoded for its type. Keeping the two apart is what makes the guarantee
 * testable rather than asserted: a test can check that no user text reaches the
 * expression at all.
 *
 * @module backend-contract/translators/pocketbase
 */

import type { Filter } from '../filter';
import { applyLikeAnchor, betweenBounds, lowerToLike } from './lowering';
import { translateWith } from './translate';
import type { DialectContext, FilterDialect, FilterNode, TranslateOptions } from './types';

export interface PocketBaseFilter {
  /** The expression, with `{:p0}`-style placeholders in place of every value. */
  expression: string;
  /** Placeholder name → value. Never interpolated by this module. */
  params: Record<string, unknown>;
}

type ConditionNode = Extract<FilterNode, { kind: 'condition' }>;

function createPocketBaseDialect(): FilterDialect<PocketBaseFilter> {
  // Per-translation, not per-module: two queries translated in the same tick
  // would otherwise share a counter and overwrite each other's parameters.
  let next = 0;
  const params: Record<string, unknown> = {};

  const bind = (value: unknown): string => {
    const name = `p${next++}`;
    params[name] = value;
    return `{:${name}}`;
  };

  const expr = (expression: string): PocketBaseFilter => ({ expression, params });

  return {
    name: 'pocketbase',
    identityField: 'id',

    empty: () => expr(''),
    isEmpty: (value) => value.expression === '',

    group(combinator, children) {
      const joiner = combinator === 'and' ? ' && ' : ' || ';
      return expr(`(${children.map((child) => child.expression).join(joiner)})`);
    },

    id(node) {
      if (node.operator === 'idEqualTo') return expr(`id = ${bind(node.value)}`);
      const values = Array.isArray(node.value) ? node.value : [node.value];
      // PocketBase has no `in` operator, so set membership is a disjunction.
      return expr(`(${values.map((value) => `id = ${bind(value)}`).join(' || ')})`);
    },

    relatedTo(node, ctx) {
      return ctx.fail('PocketBase cannot filter by Parse-style relations', { operator: 'relatedTo' });
    },

    condition(node, ctx) {
      return expr(conditionExpression(node, ctx, bind));
    }
  };
}

/**
 * PocketBase's "any of" operator prefix, or `''`.
 *
 * ⚠️ **The one-character difference that returns no rows instead of the right
 * ones.** A dotted path across a relation that can hold several records is
 * quantified: without the `?`, PocketBase requires *every* related record to
 * satisfy the condition. On a record with two tags, a filter for one of them
 * therefore matches nothing — measured on a live 0.30.0:
 *
 * ```
 * tags.label='algebra'   -> []
 * tags.label?='algebra'  -> the row
 * ```
 *
 * Two rules, both deliberate:
 *
 * - Only the **first** segment is consulted. One hop is the traversal limit
 *   (BCN-005's Out of Scope), so a path has at most one relation in it.
 * - `cardinality: 'many'` is required, not inferred from `type`. PocketBase
 *   calls a single- and a multi-valued relation the same thing (`relation`), so
 *   guessing from the type name would put a `?` on a to-one path. That is
 *   harmless there — `?=` on a single value means the same as `=`, measured —
 *   but "harmless" is not a reason to emit something that says the wrong thing.
 */
export function pocketBaseQuantifier(field: string, ctx: DialectContext): string {
  const dot = field.indexOf('.');
  if (dot < 0) return '';
  const relation = field.slice(0, dot);
  return ctx.schema?.properties?.[relation]?.cardinality === 'many' ? '?' : '';
}

const COMPARISONS: Readonly<Record<string, string>> = Object.freeze({
  equalTo: '=',
  notEqualTo: '!=',
  lessThan: '<',
  greaterThan: '>',
  lessThanOrEqualTo: '<=',
  greaterThanOrEqualTo: '>='
});

function conditionExpression(node: ConditionNode, ctx: DialectContext, bind: (value: unknown) => string): string {
  const { field, operator, value } = node;

  // `?` where the path crosses a relation that can hold several records. See
  // {@link pocketBaseQuantifier} for the measurement that makes this necessary.
  const q = pocketBaseQuantifier(field, ctx);

  const comparison = COMPARISONS[operator];
  if (comparison) return `${field} ${q}${comparison} ${bind(value)}`;

  switch (operator) {
    case 'containedIn':
    case 'notContainedIn': {
      const values = Array.isArray(value) ? value : [value];
      if (values.length === 0) {
        // An empty set matches nothing; its negation matches everything.
        // Emitting an empty disjunction would be a syntax error, and emitting
        // nothing at all would drop the condition — the failure this task is
        // about.
        return operator === 'containedIn' ? '1 = 2' : '1 = 1';
      }
      const symbol = operator === 'containedIn' ? '=' : '!=';
      const joiner = operator === 'containedIn' ? ' || ' : ' && ';
      return `(${values.map((item) => `${field} ${q}${symbol} ${bind(item)}`).join(joiner)})`;
    }

    case 'exists':
      return value === false ? `${field} ${q}= null` : `${field} ${q}!= null`;

    // `~` is PocketBase's LIKE. It wraps the value in `%` on both sides unless
    // the value already contains one, which is how the anchored members are
    // expressed: bind `foo%` and PocketBase leaves it alone.
    //
    // The three case-insensitive members are not distinguished, because
    // PocketBase's `~` is SQLite `LIKE`, which is already case-insensitive for
    // ASCII and has no case-sensitive counterpart. That makes `contains` the
    // degraded one rather than `containsIgnoreCase` — recorded in the
    // descriptor rather than pretended away here.
    case 'contains':
    case 'containsIgnoreCase':
    case 'notContains':
    case 'startsWith':
    case 'startsWithIgnoreCase':
    case 'notStartsWith':
    case 'endsWith':
    case 'endsWithIgnoreCase':
    case 'notEndsWith': {
      const lowered = lowerToLike(operator, value);
      if (!lowered) return ctx.fail(`Cannot express "${operator}"`, { operator, field });
      const pattern = applyLikeAnchor(lowered.anchor, escapeLikeValue(lowered.value), '%');
      return `${field} ${q}${lowered.negated ? '!~' : '~'} ${bind(pattern)}`;
    }

    case 'between':
    case 'notBetween': {
      const bounds = betweenBounds(value);
      if (!bounds) {
        return ctx.fail(`A "${operator}" filter needs a two-element array [from, to]`, { operator, field });
      }
      return operator === 'between'
        ? `(${field} ${q}>= ${bind(bounds[0])} && ${field} ${q}<= ${bind(bounds[1])})`
        : `(${field} ${q}< ${bind(bounds[0])} || ${field} ${q}> ${bind(bounds[1])})`;
    }

    case 'isEmpty':
      return `${field} ${q}= ${bind('')}`;
    case 'isNotEmpty':
      return `${field} ${q}!= ${bind('')}`;

    // PocketBase has no ranked search; the descriptor says so and marks the
    // cell `degraded`. Lowered to contains.
    case 'textSearch':
      return `${field} ${q}~ ${bind(
        `%${escapeLikeValue(typeof value === 'string' ? value : (value as { term?: unknown })?.term)}%`
      )}`;

    case 'pointsTo': {
      const values = Array.isArray(value) ? value : [value];
      return values.length === 1
        ? `${field} ${q}= ${bind(values[0])}`
        : `(${values.map((item) => `${field} ${q}= ${bind(item)}`).join(' || ')})`;
    }

    default:
      return ctx.fail(`The PocketBase dialect cannot express "${operator}"`, { operator, field });
  }
}

/**
 * ⚠️ **Does not escape, and that is the measured answer rather than the tidy one.**
 *
 * PocketBase's `~` is SQL `LIKE`, so a `%` or `_` in the user's text acts as a
 * wildcard. The obvious fix is a backslash escape — and the live equivalence
 * pass showed PocketBase does not honour one: `contains "100%"` escaped to
 * `100\%` returns **nothing**, because the backslash is matched literally.
 * SQLite's `LIKE` only honours an escape when the query says `ESCAPE '\'`, and
 * nothing in PocketBase's filter grammar can say it.
 *
 * So both available behaviours are wrong, and the choice is which way:
 *
 * - Escaping returns *nothing* for any search containing `%` or `_`. `_` is
 *   common in real text (`user_id`), so this breaks ordinary searches
 *   completely and looks like "no results".
 * - Not escaping returns a *superset* that still contains the right rows.
 *
 * Superset wins here, against this task's usual rule, because the rule exists
 * to stop a *condition being dropped* — and this is not that. The condition is
 * applied; a wildcard the user did not intend makes it slightly broader. The
 * `pocketbase` descriptor marks the whole contains family `degraded` and says
 * so in the user's own words, which is the honest half of the trade.
 */
function escapeLikeValue(value: unknown): string {
  return String(value ?? '');
}

export function toPocketBaseFilter(filter: Filter | null | undefined, options: TranslateOptions): PocketBaseFilter {
  return translateWith(createPocketBaseDialect(), filter, options);
}

/**
 * Substitute bound parameters into an expression, the way PocketBase's own SDK
 * helper does.
 *
 * Only used at the point the request is built — the translator's output keeps
 * them apart so a test can prove no user text reaches the expression. Strings
 * go through `JSON.stringify`, which is precisely the quoting PocketBase
 * expects and escapes an embedded quote or backslash on the way.
 */
export function bindPocketBaseFilter(filter: PocketBaseFilter): string {
  let bound = filter.expression;
  for (const [name, value] of Object.entries(filter.params)) {
    bound = bound.split(`{:${name}}`).join(encodePocketBaseValue(value));
  }
  return bound;
}

export function encodePocketBaseValue(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  if (value instanceof Date) return JSON.stringify(value.toISOString().replace('T', ' ').replace('Z', 'Z'));
  return JSON.stringify(String(value));
}
