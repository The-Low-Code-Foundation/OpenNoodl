/**
 * `toPostgrest` — the neutral filter as PostgREST query-string parameters.
 *
 * The awkward one, and the spec says why: *"PostgREST puts filters in the query
 * string, so a design that assumes a JSON body — which the other four share —
 * will need the request shaping to diverge. Do not force a body-shaped
 * abstraction onto it."* Hence `FilterDialect<T>`: this dialect's `T` is not a
 * document.
 *
 * ## Two forms of the same condition
 *
 * PostgREST spells a condition two ways depending on where it sits, and a
 * translator that only knew one of them would be wrong half the time:
 *
 * | Position | Spelling |
 * |---|---|
 * | Top level (implicitly ANDed) | `?name=eq.Ada&age=gt.30` — one parameter each |
 * | Inside a logical group | `?or=(name.eq.Ada,age.gt.30)` — dot-separated, comma-joined |
 *
 * So every node carries both: `params` for the top level and `expression` for
 * the compact form. An `and` group at the top level does not need a wrapper at
 * all — it just contributes all its children's parameters.
 *
 * ## Where `expression` is deliberately absent
 *
 * A filter on an embedded resource (`author.name`) is a top-level parameter
 * plus an `!inner` embed on the select. There is no spelling for it inside
 * `or=(…)`, because the dot is already the operator separator. Rather than
 * emitting something that parses and means the wrong thing, such a condition
 * has **no** `expression`, and `group()` refuses when an `or` needs one. That
 * turns an un-expressible query into a sentence the user can act on, instead of
 * a query that runs and returns the wrong rows.
 *
 * @module backend-contract/translators/postgrest
 */

import type { Filter } from '../filter';
import { applyLikeAnchor, betweenBounds, lowerToLike } from './lowering';
import { translateWith } from './translate';
import type { DialectContext, FilterDialect, FilterNode, TranslateOptions } from './types';

export interface PostgrestFilter {
  /** Query-string parameters, already value-encoded. Joined with `&`. */
  params: Array<[string, string]>;
  /**
   * The same condition in the compact form used inside `and=(…)` / `or=(…)`.
   * Absent when this node cannot appear inside a logical group.
   */
  expression?: string;
  /**
   * Relation prefixes that must be embedded with `!inner` on the `select`, or
   * the filter narrows the embedded rows rather than the outer ones.
   * De-duplicated; BCN-004's adapter builds the `select` from these.
   */
  embeds: string[];
}

type ConditionNode = Extract<FilterNode, { kind: 'condition' }>;

/**
 * A value's text, before any PostgREST quoting.
 */
function valueText(raw: unknown): string {
  if (raw === null || raw === undefined) return 'null';
  if (typeof raw === 'boolean' || typeof raw === 'number') return String(raw);
  return raw instanceof Date ? raw.toISOString() : String(raw);
}

/**
 * Encode a value for the **top level** — `?name=eq.<here>`.
 *
 * Verbatim, and that is not an oversight. ⚠️ PostgREST 12.2 does **not** strip
 * surrounding double quotes for `eq` at the top level: `?city=eq."London"`
 * matches nothing, because the quotes become part of the value being compared.
 * An earlier draft of this file quoted any value carrying a reserved character
 * and the live equivalence pass found it immediately — a filter for a name
 * containing a quote and an `&&` returned zero rows from PostgREST and the
 * right row from the other four.
 *
 * Nothing needs quoting here anyway: the only structural character at the top
 * level is `&`, and percent-encoding the parameter handles it. **The caller must
 * percent-encode** — `new URLSearchParams(filter.params)` is exactly right.
 */
export function encodePostgrestValue(raw: unknown): string {
  return valueText(raw);
}

/**
 * Encode a value for use **inside `and=(…)` / `or=(…)`**, where the rules are
 * the opposite way round.
 *
 * There, `,` and `)` really are structural — a bare comma in a value is a
 * PGRST100 parse error — and quoting *is* honoured, with a backslash escaping a
 * quote or a backslash. Both halves measured against PostgREST 12.2; see
 * `BCN-003-EQUIVALENCE-OUTPUT.txt`.
 */
export function encodePostgrestGroupedValue(raw: unknown): string {
  const text = valueText(raw);
  if (raw === null || raw === undefined || typeof raw === 'boolean' || typeof raw === 'number') return text;
  if (/[,.:()"\\\s]/.test(text) || text === '') {
    return `"${text.replace(/(["\\])/g, '\\$1')}"`;
  }
  return text;
}

/**
 * Neutralise the wildcards inside a value bound to `like` / `ilike`.
 *
 * PostgREST's wildcard is `*`, which it rewrites to `%` before the value
 * reaches SQL — so **both** characters are metacharacters here, and so is `_`.
 * Postgres's `LIKE` treats a backslash as the default escape, which is what
 * makes `\%` a literal per cent sign.
 *
 * The `*` is the one worth flagging: it is escaped on the way in, and whether
 * PostgREST's rewrite honours the backslash is a question only a live request
 * can answer. The equivalence pass asks it.
 */
export function escapePostgrestLike(value: string): string {
  return value.replace(/[\\%_*]/g, '\\$&');
}

/**
 * `in.("a","b")` — the list form.
 *
 * Its own grammar, in which quoting *is* honoured in both positions (measured
 * at the top level, where `eq` quoting is not). Members are quoted whenever
 * they carry a reserved character, exactly as inside a logical group.
 */
function encodeList(raw: unknown): string {
  const items = Array.isArray(raw) ? raw : [raw];
  return `(${items.map((item) => encodePostgrestGroupedValue(item)).join(',')})`;
}

/** The `!inner` embed prefix a dotted path implies, or undefined for a plain field. */
function embedFor(field: string): string | undefined {
  const parts = field.split('.');
  return parts.length > 1 ? parts.slice(0, -1).join('.') : undefined;
}

function leaf(field: string, bare: string, grouped: string): PostgrestFilter {
  const embed = embedFor(field);
  return {
    params: [[field, bare]],
    // A dotted path has no compact spelling — see the module comment.
    expression: embed ? undefined : `${field}.${grouped}`,
    embeds: embed ? [embed] : []
  };
}

function createPostgrestDialect(): FilterDialect<PostgrestFilter> {
  return {
    name: 'postgrest',
    identityField: 'id',

    empty: () => ({ params: [], embeds: [] }),
    isEmpty: (value) => value.params.length === 0,

    group(combinator, children, ctx) {
      const embeds = dedupe(children.flatMap((child) => child.embeds));

      if (combinator === 'and') {
        // Top level: AND is implicit, so the children's parameters simply
        // accumulate. No `and=(…)` wrapper is needed or wanted — it would
        // change nothing and lose the embedded-resource filters.
        const expressions = children.map((child) => child.expression);
        return {
          params: children.flatMap((child) => child.params),
          expression: expressions.every(isPresent) ? `and(${expressions.join(',')})` : undefined,
          embeds
        };
      }

      const expressions = children.map((child) => child.expression);
      if (!expressions.every(isPresent)) {
        return ctx.fail(
          'PostgREST cannot combine a filter on a related record with "or". ' +
            'Move the condition on the related field out of the "any of" group, or filter on this collection only.'
        );
      }
      const joined = `(${expressions.join(',')})`;
      return { params: [['or', joined]], expression: `or${joined}`, embeds };
    },

    id(node) {
      if (node.operator === 'idContainedIn') {
        const list = `in.${encodeList(node.value)}`;
        return leaf('id', list, list);
      }
      return leaf(
        'id',
        `eq.${encodePostgrestValue(node.value)}`,
        `eq.${encodePostgrestGroupedValue(node.value)}`
      );
    },

    relatedTo(node, ctx) {
      return ctx.fail('PostgREST cannot filter by Parse-style relations', { operator: 'relatedTo' });
    },

    condition(node, ctx) {
      // Built twice, with the two encodings the two positions need. Cheaper
      // than threading a pair through every branch, and it keeps each branch
      // reading as one spelling of one operator.
      return leaf(
        node.field,
        conditionOperator(node, ctx, encodePostgrestValue),
        conditionOperator(node, ctx, encodePostgrestGroupedValue)
      );
    }
  };
}

const COMPARISONS: Readonly<Record<string, string>> = Object.freeze({
  lessThan: 'lt',
  greaterThan: 'gt',
  lessThanOrEqualTo: 'lte',
  greaterThanOrEqualTo: 'gte'
});

function conditionOperator(
  node: ConditionNode,
  ctx: DialectContext,
  encode: (raw: unknown) => string
): string {
  const { field, operator, value } = node;

  switch (operator) {
    case 'equalTo':
      // `eq.null` matches nothing in SQL; `is.null` is the null test.
      return value === null ? 'is.null' : `eq.${encode(value)}`;
    case 'notEqualTo':
      return value === null ? 'not.is.null' : `neq.${encode(value)}`;

    case 'lessThan':
    case 'greaterThan':
    case 'lessThanOrEqualTo':
    case 'greaterThanOrEqualTo':
      return `${COMPARISONS[operator]}.${encode(value)}`;

    case 'containedIn':
      return `in.${encodeList(value)}`;
    case 'notContainedIn':
      return `not.in.${encodeList(value)}`;

    case 'exists':
      return value === false ? 'is.null' : 'not.is.null';

    case 'matchesRegex':
      // `~` and `~*`. POSIX regular expressions rather than PCRE, which is a
      // real difference for lookahead — recorded in the descriptor rather than
      // papered over here.
      return `${node.regexOptions?.includes('i') ? 'imatch' : 'match'}.${encode(value)}`;

    case 'contains':
    case 'notContains':
    case 'containsIgnoreCase':
    case 'startsWith':
    case 'notStartsWith':
    case 'startsWithIgnoreCase':
    case 'endsWith':
    case 'notEndsWith':
    case 'endsWithIgnoreCase': {
      const lowered = lowerToLike(operator, value);
      if (!lowered) return ctx.fail(`Cannot express "${operator}"`, { operator, field });
      const like = lowered.insensitive ? 'ilike' : 'like';
      const pattern = applyLikeAnchor(lowered.anchor, escapePostgrestLike(lowered.value), '*');
      return `${lowered.negated ? 'not.' : ''}${like}.${encode(pattern)}`;
    }

    // PostgREST has no BETWEEN, so a range is two conditions. Both spellings
    // are produced by the group machinery instead of here, which is why these
    // two are expanded before the walk — see `expandRanges`.
    case 'between':
    case 'notBetween':
      return ctx.fail(`A "${operator}" filter needs a two-element array [from, to]`, { operator, field });

    case 'textSearch':
      return `fts.${encode(typeof value === 'string' ? value : (value as { term?: unknown })?.term)}`;

    case 'pointsTo':
      return Array.isArray(value) ? `in.${encodeList(value)}` : `eq.${encode(value)}`;

    // PostGIS may well be installed — the descriptor marks these `conditional`
    // on it — but PostgREST exposes no distance or containment operator in the
    // filter grammar either way. Reaching here means a probe said yes to the
    // wrong question. BCN-003 corrected those three cells for exactly this
    // reason; the guard stays so a future probe cannot re-open the hole.
    case 'nearSphere':
    case 'withinBox':
    case 'withinPolygon':
      return ctx.fail(
        'PostgREST has no location filter, even with PostGIS installed — a distance query has to be a database function.',
        { operator, field }
      );

    default:
      return ctx.fail(`The PostgREST dialect cannot express "${operator}"`, { operator, field });
  }
}

/**
 * Rewrite the two range operators into explicit groups before the walk.
 *
 * Same technique as the Parse dialect's `notBetween`, and for the same reason:
 * a lowering that changes the *shape* of the tree belongs on the neutral model,
 * where the rewritten conditions go back through the capability gate.
 */
function expandRanges(filter: Filter | null | undefined): Filter | null | undefined {
  if (!filter || typeof filter !== 'object') return filter;
  const record = filter as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length !== 1) return filter;

  const key = keys[0];
  const value = record[key];

  if ((key === 'and' || key === 'or') && Array.isArray(value)) {
    return { [key]: (value as Filter[]).map((child) => expandRanges(child) as Filter) } as Filter;
  }

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const operators = value as Record<string, unknown>;
    const between = betweenBounds(operators.between);
    if (between) {
      return { and: [{ [key]: { greaterThanOrEqualTo: between[0] } }, { [key]: { lessThanOrEqualTo: between[1] } }] } as Filter;
    }
    const notBetween = betweenBounds(operators.notBetween);
    if (notBetween) {
      return { or: [{ [key]: { lessThan: notBetween[0] } }, { [key]: { greaterThan: notBetween[1] } }] } as Filter;
    }
  }
  return filter;
}

export function toPostgrest(filter: Filter | null | undefined, options: TranslateOptions): PostgrestFilter {
  const result = translateWith(createPostgrestDialect(), expandRanges(filter), options);
  return { ...result, embeds: dedupe(result.embeds) };
}

/** Render the parameters as a query string fragment, for tests and for logging. */
export function postgrestQueryString(filter: PostgrestFilter): string {
  return filter.params.map(([key, value]) => `${key}=${value}`).join('&');
}

function dedupe(values: string[]): string[] {
  return values.filter((value, index) => values.indexOf(value) === index);
}

function isPresent(value: string | undefined): value is string {
  return value !== undefined;
}
