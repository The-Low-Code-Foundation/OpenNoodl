/**
 * The declarative condition language shared by WF-002's routing step kinds
 * (`branch`, `switch`) and by `for-each`'s optional item filter.
 *
 * WHY DECLARATIVE, NOT AN EXPRESSION STRING. CF11-001 sketched the IF node with
 * a free-form "boolean expression" and a visual expression builder. On the
 * server that would mean either shipping an evaluator (`new Function`, `eval`)
 * or a parser. PLAT-003 and LEARN-001 both spent effort *removing* `eval` from
 * this codebase; a workflow definition is a persisted, deployable, MCP-authored
 * JSON file, so an eval'd string in it is a remote-code-execution surface with
 * an admin credential in front of it. The condition language below is a closed
 * set of operators over resolved values: total, serialisable, diffable
 * (SUB-007), statically validatable at write time, and trivially describable to
 * an authoring agent.
 *
 * VALUE SPECS. Anywhere a condition takes a value you may write:
 *   - a literal            `42`, `"paid"`, `true`, `null`, `["a","b"]`
 *   - a path into the step input   `{ "$path": "previous.order.total" }`
 *   - an explicit literal escape   `{ "$literal": { "$path": "not-a-path" } }`
 *
 * That language now lives in `values.ts`, because WFA-003 gave step `params` the
 * same one and a second implementation would disagree at the edges. `getPath`
 * and `resolveValue` are re-exported here so this module's surface is unchanged.
 *
 * The scope a `$path` resolves against is the step's run scope — the resolved
 * input plus `upstream` (WF-001-SEMANTICS §1 "Data passed between steps", as
 * extended by WFA-003). `previous.error` is populated when the upstream step
 * FAILED and routed here via `onError`, which is what makes CF11-002's catch
 * branches able to see what went wrong.
 *
 * LOUDNESS. A condition that cannot be evaluated (incomparable operands, a bad
 * regex) THROWS rather than quietly evaluating false. A silently-false
 * condition is a branch that takes the wrong edge forever — exactly the class
 * of failure RUN-004's doctrine exists to prevent. The throw surfaces as a step
 * failure, so it is subject to the normal `onError` routing / halt rules.
 *
 * @module nodegx-backend/workflow/steps/conditions
 */

import { getPath, isPlainObject, resolveValue } from './values';

// The value language is shared with step params (WFA-003) but is part of the
// condition contract, so it stays importable from here.
export { getPath, resolveValue };

/** Every comparison operator. Closed set — no user-supplied code, ever. */
export const CONDITION_OPS = [
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'contains',
  'notContains',
  'startsWith',
  'endsWith',
  'matches',
  'in',
  'notIn',
  'exists',
  'notExists',
  'truthy',
  'falsy',
  'empty',
  'notEmpty'
] as const;

export type ConditionOp = (typeof CONDITION_OPS)[number];

/** Operators that take no `right` operand. */
const UNARY_OPS = new Set<ConditionOp>(['exists', 'notExists', 'truthy', 'falsy', 'empty', 'notEmpty']);

/**
 * The condition language, described for a client that has to RENDER it
 * (WFA-004).
 *
 * The closed operator set is a security decision — an `eval`'d string inside a
 * persisted, deployable, agent-authored artifact is an RCE surface behind an
 * admin credential — and it is exactly what makes a condition editable as three
 * controls instead of a code editor. Served rather than bundled for the same
 * reason the step kinds are: an editor working from its own copy of this list
 * could offer an operator the backend cannot evaluate.
 */
export interface ConditionLanguageSpec {
  ops: { name: ConditionOp; label: string; unary: boolean; takesFlags?: boolean }[];
  /** Prose for the editor's own help text. */
  summary: string;
}

const OP_LABELS: Record<ConditionOp, string> = {
  eq: 'is',
  neq: 'is not',
  gt: 'is greater than',
  gte: 'is at least',
  lt: 'is less than',
  lte: 'is at most',
  contains: 'contains',
  notContains: 'does not contain',
  startsWith: 'starts with',
  endsWith: 'ends with',
  matches: 'matches regex',
  in: 'is one of',
  notIn: 'is not one of',
  exists: 'exists',
  notExists: 'does not exist',
  truthy: 'is truthy',
  falsy: 'is falsy',
  empty: 'is empty',
  notEmpty: 'is not empty'
};

export const CONDITION_LANGUAGE: ConditionLanguageSpec = {
  summary:
    'A condition compares one value with another using a fixed operator set. There is no expression language and ' +
    'no arithmetic — compute a value in a cloud function and compare the result.',
  ops: CONDITION_OPS.map((name) => ({
    name,
    label: OP_LABELS[name],
    unary: UNARY_OPS.has(name),
    takesFlags: name === 'matches' ? true : undefined
  }))
};

export interface Comparison {
  /** Literal, `{$path}` or `{$literal}`. */
  left: unknown;
  op: ConditionOp;
  /** Literal, `{$path}` or `{$literal}`. Omitted for the unary operators. */
  right?: unknown;
  /** Regex flags, `matches` only. */
  flags?: string;
}

export type Condition = Comparison | { all: Condition[] } | { any: Condition[] } | { not: Condition };

/** Thrown when a condition cannot be evaluated. Becomes a loud step failure. */
export class ConditionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConditionError';
  }
}

// ---------------------------------------------------------------------------
// Comparison primitives
// ---------------------------------------------------------------------------

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null || typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((x, i) => deepEqual(x, b[i]));
  }
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const ak = Object.keys(ao);
  const bk = Object.keys(bo);
  if (ak.length !== bk.length) return false;
  return ak.every((k) => Object.prototype.hasOwnProperty.call(bo, k) && deepEqual(ao[k], bo[k]));
}

/**
 * Ordered comparison. Numbers compare numerically; two strings compare
 * numerically when BOTH parse as finite numbers (so `"10" > "9"` is true, which
 * is what an author reading JSON means) and lexicographically otherwise; dates
 * and ISO date strings compare as instants. Anything else is INCOMPARABLE and
 * throws rather than guessing.
 *
 * ⚠️ CWF-004 slice 2 exported this, because the `sort` step needs an order and
 * a SECOND ordering would disagree with `gt`/`lt` at exactly the edges this one
 * was written for — `"10"` against `"9"`, an ISO date against an epoch number.
 * One order for the whole workflow layer, or authors learn two.
 */
export function compareOrdered(a: unknown, b: unknown): number {
  const na = toComparableNumber(a);
  const nb = toComparableNumber(b);
  if (na !== null && nb !== null) return na === nb ? 0 : na < nb ? -1 : 1;
  if (typeof a === 'string' && typeof b === 'string') return a === b ? 0 : a < b ? -1 : 1;
  throw new ConditionError(
    `Cannot order-compare ${describe(a)} and ${describe(b)} — ` +
      'both operands must be numbers, numeric strings, dates, or both strings.'
  );
}

function compare(a: unknown, b: unknown, op: ConditionOp): number {
  try {
    return compareOrdered(a, b);
  } catch {
    // Re-raised naming the operator, which is what a condition's author is
    // looking at. The wording is unchanged from before the export existed.
    throw new ConditionError(
      `Cannot order-compare ${describe(a)} and ${describe(b)} with "${op}" — ` +
        'both operands must be numbers, numeric strings, dates, or both strings.'
    );
  }
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;

function toComparableNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.getTime();
  if (typeof v === 'string') {
    const trimmed = v.trim();
    if (trimmed === '') return null;
    if (ISO_DATE_RE.test(trimmed)) {
      const t = Date.parse(trimmed);
      return Number.isNaN(t) ? null : t;
    }
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function describe(v: unknown): string {
  if (v === undefined) return 'undefined';
  if (v === null) return 'null';
  if (typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'object') return Array.isArray(v) ? 'an array' : 'an object';
  return String(v);
}

function isEmpty(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === 'string' || Array.isArray(v)) return v.length === 0;
  if (isPlainObject(v)) return Object.keys(v).length === 0;
  return false;
}

function requireString(v: unknown, op: ConditionOp, side: string): string {
  if (typeof v === 'string') return v;
  throw new ConditionError(`"${op}" needs a string ${side}, got ${describe(v)}`);
}

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------

/** Evaluate a condition against a scope. Throws (loudly) if it cannot. */
export function evaluateCondition(cond: Condition, scope: Record<string, unknown>): boolean {
  if (!isPlainObject(cond)) throw new ConditionError(`A condition must be an object, got ${describe(cond)}`);

  if (Array.isArray((cond as { all?: unknown }).all)) {
    return ((cond as { all: Condition[] }).all as Condition[]).every((c) => evaluateCondition(c, scope));
  }
  if (Array.isArray((cond as { any?: unknown }).any)) {
    return ((cond as { any: Condition[] }).any as Condition[]).some((c) => evaluateCondition(c, scope));
  }
  if ('not' in cond) {
    return !evaluateCondition((cond as { not: Condition }).not, scope);
  }

  // The combinator forms are handled above, so what remains is a comparison.
  const cmp = cond as unknown as Comparison;
  const op = cmp.op;
  if (!CONDITION_OPS.includes(op)) {
    throw new ConditionError(`Unknown condition operator "${String(op)}" (allowed: ${CONDITION_OPS.join(', ')})`);
  }

  const left = resolveValue(cmp.left, scope);
  if (UNARY_OPS.has(op)) {
    switch (op) {
      case 'exists':
        return left !== undefined && left !== null;
      case 'notExists':
        return left === undefined || left === null;
      case 'truthy':
        return Boolean(left);
      case 'falsy':
        return !left;
      case 'empty':
        return isEmpty(left);
      case 'notEmpty':
        return !isEmpty(left);
    }
  }

  const right = resolveValue(cmp.right, scope);
  switch (op) {
    case 'eq':
      return deepEqual(left, right);
    case 'neq':
      return !deepEqual(left, right);
    case 'gt':
      return compare(left, right, op) > 0;
    case 'gte':
      return compare(left, right, op) >= 0;
    case 'lt':
      return compare(left, right, op) < 0;
    case 'lte':
      return compare(left, right, op) <= 0;
    case 'contains':
    case 'notContains': {
      const hit = containsValue(left, right, op);
      return op === 'contains' ? hit : !hit;
    }
    case 'startsWith':
      return requireString(left, op, 'left operand').startsWith(requireString(right, op, 'right operand'));
    case 'endsWith':
      return requireString(left, op, 'left operand').endsWith(requireString(right, op, 'right operand'));
    case 'matches': {
      const subject = requireString(left, op, 'left operand');
      const pattern = requireString(right, op, 'pattern');
      let re: RegExp;
      try {
        re = new RegExp(pattern, cmp.flags || '');
      } catch (e) {
        throw new ConditionError(`Invalid regex ${JSON.stringify(pattern)}: ${e instanceof Error ? e.message : e}`);
      }
      return re.test(subject);
    }
    case 'in':
    case 'notIn': {
      if (!Array.isArray(right)) {
        throw new ConditionError(`"${op}" needs an array on the right, got ${describe(right)}`);
      }
      const hit = right.some((candidate) => deepEqual(left, candidate));
      return op === 'in' ? hit : !hit;
    }
    default:
      throw new ConditionError(`Unhandled operator "${op}"`);
  }
}

function containsValue(left: unknown, right: unknown, op: ConditionOp): boolean {
  if (typeof left === 'string') return left.includes(requireString(right, op, 'right operand'));
  if (Array.isArray(left)) return left.some((candidate) => deepEqual(candidate, right));
  if (isPlainObject(left)) return Object.prototype.hasOwnProperty.call(left, requireString(right, op, 'key'));
  throw new ConditionError(`"${op}" needs a string, array or object on the left, got ${describe(left)}`);
}

// ---------------------------------------------------------------------------
// Static validation (write time — so a bad condition never reaches a run)
// ---------------------------------------------------------------------------

/**
 * Validate a condition's SHAPE without evaluating it. Returns error strings;
 * empty means valid. Called by `validateStepShape`, so a workflow with an
 * unusable condition is rejected at `POST /admin/workflow-defs` and refuses to
 * load from disk — never discovered halfway through a production run.
 */
export function validateCondition(cond: unknown, where: string, depth = 0): string[] {
  if (depth > 20) return [`${where}: condition nests deeper than 20 levels`];
  if (!isPlainObject(cond)) return [`${where}: condition must be an object`];

  const combinators = (['all', 'any'] as const).filter((k) => k in cond);
  if (combinators.length > 0) {
    const errors: string[] = [];
    for (const key of combinators) {
      const branchList = cond[key];
      if (!Array.isArray(branchList) || branchList.length === 0) {
        errors.push(`${where}: "${key}" must be a non-empty array of conditions`);
        continue;
      }
      branchList.forEach((c, i) => errors.push(...validateCondition(c, `${where}.${key}[${i}]`, depth + 1)));
    }
    return errors;
  }
  if ('not' in cond) return validateCondition(cond.not, `${where}.not`, depth + 1);

  const cmp = cond as unknown as Comparison;
  if (typeof cmp.op !== 'string' || !CONDITION_OPS.includes(cmp.op as ConditionOp)) {
    return [`${where}: op must be one of ${CONDITION_OPS.join(', ')} (got ${JSON.stringify(cmp.op)})`];
  }
  const errors: string[] = [];
  if (!('left' in cmp)) errors.push(`${where}: a comparison needs a "left" value`);
  if (!UNARY_OPS.has(cmp.op as ConditionOp) && !('right' in cmp)) {
    errors.push(`${where}: operator "${cmp.op}" needs a "right" value`);
  }
  if (cmp.op === 'matches' && typeof cmp.right === 'string') {
    try {
      new RegExp(cmp.right, cmp.flags || '');
    } catch (e) {
      errors.push(`${where}: invalid regex — ${e instanceof Error ? e.message : e}`);
    }
  }
  return errors;
}
