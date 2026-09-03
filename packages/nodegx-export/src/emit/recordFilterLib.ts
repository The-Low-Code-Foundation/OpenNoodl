/**
 * `src/lib/filterRecords.ts` — the `Filter Records` node's matcher, emitted into the app (EXP-011 §56).
 *
 * A transcription of what `filterdbmodelsnode.ts`'s `scheduleFilter` does to a loaded list: the saved filter
 * tree is read into a neutral tree (`savedFilterToNeutral` / `visualQueryToNeutral`, with the Parse family's
 * `dropUnresolvedConnected` rule), lowered the way `toParseWhere` lowers it (the nine string operators onto an
 * escaped regex, `between` onto a closed range, `exists` onto a null test, `isEmpty` onto an empty-string
 * comparison), and matched against each record the way `queryutils.ts`'s `matchesQuery`/`matchesOperator`
 * match — loose `==` on equality, strict `indexOf` on membership, `String(value)` under the regex — then
 * sorted by `compareObjects`, skipped and limited, in that order.
 *
 * The exporter has already done the static half: it read the saved shape, refused the operators the runtime
 * can only answer through the backend's schema (`pointsTo`, `relatedTo`, the text-search, id and geo operators)
 * and every condition on a Date, File, Pointer or Relation column, and dropped a connected condition whose port
 * has no wire. What is left for the client is the runtime half: a connected condition whose wired value is
 * `undefined` at this render does not narrow — the same `dropUnresolvedConnected` rule, at the moment it applies.
 *
 * What differs, recorded rather than hidden: a `between` whose *wired* value is not a `[from, to]` pair is a
 * filter failure in the runtime (`filter-records/filter-failed`, the previous result kept). A derived list has no
 * previous result to keep, so that condition matches nothing and says so once on the console.
 *
 * @module emit/recordFilterLib
 */

export const RECORD_FILTER_LIB_PATH = 'src/lib/filterRecords.ts';

export function recordFilterLibSource(): string {
  return `/**
 * The Filter Records node's matcher — the runtime's local record matching (queryutils.ts), transcribed.
 *
 * filterRecords(rows, where, sort, range) applies, in the runtime's own order: the filter tree, then the sort,
 * then skip, then limit. A condition marked \`connected\` whose value is undefined does not narrow the result —
 * that is the node's rule for a filter parameter nothing has written yet.
 */

export type Where = { and: Where[] } | { or: Where[] } | Condition;

export interface Condition {
  field: string;
  op:
    | 'equalTo'
    | 'notEqualTo'
    | 'lessThan'
    | 'greaterThan'
    | 'lessThanOrEqualTo'
    | 'greaterThanOrEqualTo'
    | 'containedIn'
    | 'notContainedIn'
    | 'exists'
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
    | 'between'
    | 'notBetween'
    | 'isEmpty'
    | 'isNotEmpty';
  value?: unknown;
  /** The value came from a filter parameter port; undefined means "not narrowed", not "equal to undefined". */
  connected?: boolean;
}

export interface Range {
  skip?: number;
  limit?: number;
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&');
}

/** savedFilterToNeutral's pruning: drop unresolved connected conditions, collapse empty and single-child groups. */
function prune(where: Where | null): Where | null {
  if (where === null) return null;
  if ('and' in where || 'or' in where) {
    const kind = 'and' in where ? 'and' : 'or';
    const children = ('and' in where ? where.and : where.or).map(prune).filter((c): c is Where => c !== null);
    if (children.length === 0) return null;
    if (children.length === 1) return children[0];
    return kind === 'and' ? { and: children } : { or: children };
  }
  if (where.connected && where.value === undefined && where.op !== 'exists') return null;
  return where;
}

/** toParseWhere's lowering of the nine string operators onto a regex (lowering.ts, verbatim). */
function regexFor(op: Condition['op'], raw: unknown): RegExp | null {
  const value = escapeRegExp(String(raw));
  switch (op) {
    case 'contains':
      return new RegExp(value);
    case 'containsIgnoreCase':
      return new RegExp(value, 'i');
    case 'notContains':
      return new RegExp('^(?![\\\\s\\\\S]*' + value + ')');
    case 'startsWith':
      return new RegExp('^' + value);
    case 'startsWithIgnoreCase':
      return new RegExp('^' + value, 'i');
    case 'notStartsWith':
      return new RegExp('^(?!' + value + ')');
    case 'endsWith':
      return new RegExp(value + '$');
    case 'endsWithIgnoreCase':
      return new RegExp(value + '$', 'i');
    case 'notEndsWith':
      return new RegExp('^(?![\\\\s\\\\S]*' + value + '$)');
    default:
      return null;
  }
}

const warned = new Set<string>();

/** matchesOperator over one loaded record's field — loose equality on purpose (a port often supplies a string). */
function matchesCondition(row: Record<string, unknown>, c: Condition): boolean {
  // The runtime answers an objectId key from the record's id; the emitted row carries it as \`id\`.
  const value = c.field === 'objectId' ? row.id : row[c.field];
  const operand = c.value as any;
  switch (c.op) {
    case 'equalTo':
      return value == operand;
    case 'notEqualTo':
      return value != operand;
    case 'lessThan':
      return (value as number) < operand;
    case 'greaterThan':
      return (value as number) > operand;
    case 'lessThanOrEqualTo':
      return (value as number) <= operand;
    case 'greaterThanOrEqualTo':
      return (value as number) >= operand;
    case 'containedIn':
      return (Array.isArray(operand) ? operand : [operand]).indexOf(value) !== -1;
    case 'notContainedIn':
      return (Array.isArray(operand) ? operand : [operand]).indexOf(value) === -1;
    // toParseWhere lowers exists onto \`$ne: null\` / \`$eq: null\`, and the local matcher compares loosely.
    case 'exists':
      return operand === false ? value == null : value != null;
    case 'matchesRegex':
      if (value === undefined || value === null) return false;
      return new RegExp(String(operand)).test(String(value));
    case 'between': {
      if (!Array.isArray(operand) || operand.length !== 2) {
        if (!warned.has(c.field)) {
          warned.add(c.field);
          console.warn('[filterRecords] "' + c.field + '": a between condition needs a [from, to] pair — matching nothing');
        }
        return false;
      }
      return (value as number) >= operand[0] && (value as number) <= operand[1];
    }
    case 'notBetween': {
      if (!Array.isArray(operand) || operand.length !== 2) {
        if (!warned.has(c.field)) {
          warned.add(c.field);
          console.warn('[filterRecords] "' + c.field + '": a not between condition needs a [from, to] pair — matching nothing');
        }
        return false;
      }
      return (value as number) < operand[0] || (value as number) > operand[1];
    }
    case 'isEmpty':
      return value == '';
    case 'isNotEmpty':
      return value != '';
    default: {
      const regex = regexFor(c.op, operand);
      if (regex === null) return true; // an operator with no branch is left permissive and named, as the runtime leaves it
      if (value === undefined || value === null) return false;
      return regex.test(String(value));
    }
  }
}

/** matchesQuery: an \`and\` is every child, an \`or\` is any child (and an empty \`or\` is false, as \`match = false\` starts it). */
function matches(row: Record<string, unknown>, where: Where): boolean {
  if ('and' in where) return where.and.every((c) => matches(row, c));
  if ('or' in where) return where.or.some((c) => matches(row, c));
  return matchesCondition(row, where);
}

/** compareObjects: a leading \`-\` sorts descending; bare \`>\`/\`<\`, so absent values order however JavaScript orders them. */
function compare(sort: string[], a: Record<string, unknown>, b: Record<string, unknown>): number {
  for (const s of sort) {
    if (s[0] === '-') {
      const prop = s.substring(1);
      if ((a[prop] as any) > (b[prop] as any)) return -1;
      else if ((a[prop] as any) < (b[prop] as any)) return 1;
    } else {
      if ((a[s] as any) > (b[s] as any)) return 1;
      else if ((a[s] as any) < (b[s] as any)) return -1;
    }
  }
  return 0;
}

export function filterRecords<T>(rows: readonly T[], where: Where | null, sort: string[] = [], range: Range = {}): T[] {
  const pruned = prune(where);
  let filtered: T[] = pruned === null ? [...rows] : rows.filter((row) => matches(row as Record<string, unknown>, pruned));
  if (sort.length > 0) filtered = filtered.slice().sort((a, b) => compare(sort, a as Record<string, unknown>, b as Record<string, unknown>));
  if (range.skip) filtered = filtered.slice(range.skip, filtered.length);
  if (range.limit) filtered = filtered.slice(0, range.limit);
  return filtered;
}
`;
}
