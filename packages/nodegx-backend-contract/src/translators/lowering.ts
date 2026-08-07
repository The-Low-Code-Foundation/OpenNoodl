/**
 * Expressing the operators a backend does not have in terms of the ones it does.
 *
 * `LOWERED_OPERATORS` in `filter.ts` states the rule and the reason: a user on
 * our own built-in backend must not open the filter builder and find half the
 * string operators greyed out, because that reads as the product being broken
 * rather than as a backend limitation. These are the lowerings that make the
 * rule true.
 *
 * Two families, because the backends split two ways. Parse-family backends have
 * a real regular expression and everything lowers onto it. PostgREST and
 * PocketBase have SQL `LIKE`, which has different metacharacters and cannot
 * express negation inside the pattern — so those dialects lower differently and
 * negate at the operator level instead.
 *
 * @module backend-contract/translators/lowering
 */

/**
 * Escape a user's literal text for use inside a regular expression.
 *
 * Not a nicety. The code this replaces built `{$regex: value}` straight from
 * the user's typing, so a "contains" filter for `a.b` also matched `axb`, and a
 * filter for `C++` was a syntax error the backend rejected at runtime. Both are
 * silent-wrong-answer bugs of exactly the kind the task is about.
 */
export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Escape a user's literal text for use inside a SQL `LIKE` pattern.
 *
 * `%` and `_` are the wildcards; the backslash is the conventional escape and
 * is what PostgREST's `like`/`ilike` honour.
 */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

/** A lowered string condition, as a regular expression and its flags. */
export interface RegexLowering {
  pattern: string;
  /** Regex flags — `'i'` for the case-insensitive members, otherwise absent. */
  options?: string;
}

/**
 * The nine string operators, as regular expressions.
 *
 * The three negative members use a negative lookahead rather than a negation
 * operator. Parse has no `$not` — its REST constraint list is `$lt` `$lte`
 * `$gt` `$gte` `$ne` `$in` `$nin` `$exists` `$select` `$dontSelect` `$all`
 * `$regex` `$text` and the geo ones — so `notContains` has to be expressed
 * inside the pattern or not at all. Lookahead is understood by both engines
 * this has to satisfy: MongoDB's PCRE, and the JavaScript `RegExp` that the
 * built-in backend now registers as a SQLite function.
 *
 * `[\s\S]` rather than `.` so that a value containing a newline is still
 * matched, since neither engine sets the dot-all flag by default.
 */
export function lowerToRegex(operator: string, raw: unknown): RegexLowering | undefined {
  const value = escapeRegExp(String(raw));
  switch (operator) {
    case 'contains':
      return { pattern: value };
    case 'containsIgnoreCase':
      return { pattern: value, options: 'i' };
    case 'notContains':
      return { pattern: `^(?![\\s\\S]*${value})` };

    case 'startsWith':
      return { pattern: `^${value}` };
    case 'startsWithIgnoreCase':
      return { pattern: `^${value}`, options: 'i' };
    case 'notStartsWith':
      return { pattern: `^(?!${value})` };

    case 'endsWith':
      return { pattern: `${value}$` };
    case 'endsWithIgnoreCase':
      return { pattern: `${value}$`, options: 'i' };
    case 'notEndsWith':
      return { pattern: `^(?![\\s\\S]*${value}$)` };

    default:
      return undefined;
  }
}

/**
 * A lowered string condition, decomposed.
 *
 * Deliberately **not** an assembled pattern. The two `LIKE` dialects disagree
 * about the wildcard character — PocketBase's `~` is SQL `LIKE` and uses `%`,
 * while PostgREST spells the same thing `*` and rewrites it — so a shared
 * function that returned `"%value%"` would be right for one of them and quietly
 * wrong for the other. It also has to be each dialect's job to escape the
 * value, because what counts as a metacharacter differs for the same reason.
 */
export interface LikeLowering {
  /** The user's text, **unescaped**. The dialect escapes it its own way. */
  value: string;
  /** Where the wildcards go. */
  anchor: 'contains' | 'startsWith' | 'endsWith';
  /** True when the dialect must negate the comparison itself. */
  negated: boolean;
  /** True when the comparison should ignore case. */
  insensitive: boolean;
}

/**
 * The same nine operators, as `LIKE` shapes.
 *
 * `LIKE` cannot express negation inside the pattern, so `negated` is returned
 * for the dialect to apply — PostgREST prefixes `not.`, PocketBase swaps `~`
 * for `!~`.
 */
export function lowerToLike(operator: string, raw: unknown): LikeLowering | undefined {
  const value = String(raw ?? '');
  const like = (
    anchor: LikeLowering['anchor'],
    negated: boolean,
    insensitive: boolean
  ): LikeLowering => ({ value, anchor, negated, insensitive });

  switch (operator) {
    case 'contains':
      return like('contains', false, false);
    case 'containsIgnoreCase':
      return like('contains', false, true);
    case 'notContains':
      return like('contains', true, false);

    case 'startsWith':
      return like('startsWith', false, false);
    case 'startsWithIgnoreCase':
      return like('startsWith', false, true);
    case 'notStartsWith':
      return like('startsWith', true, false);

    case 'endsWith':
      return like('endsWith', false, false);
    case 'endsWithIgnoreCase':
      return like('endsWith', false, true);
    case 'notEndsWith':
      return like('endsWith', true, false);

    default:
      return undefined;
  }
}

/** Place the wildcards for an anchor, given the dialect's wildcard character. */
export function applyLikeAnchor(anchor: LikeLowering['anchor'], escaped: string, wildcard: string): string {
  switch (anchor) {
    case 'contains':
      return `${wildcard}${escaped}${wildcard}`;
    case 'startsWith':
      return `${escaped}${wildcard}`;
    case 'endsWith':
      return `${wildcard}${escaped}`;
  }
}

/**
 * Split a `between` / `notBetween` value into its two bounds.
 *
 * Both existing filter models carry the pair as a two-element array, so this is
 * shared rather than repeated in four dialects — and it is the one place that
 * checks the array actually has two elements, which neither did.
 */
export function betweenBounds(raw: unknown): [unknown, unknown] | undefined {
  if (!Array.isArray(raw) || raw.length !== 2) return undefined;
  return [raw[0], raw[1]];
}
