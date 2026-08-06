/**
 * CWF-004's `transform` step kind: reshaping a payload is workflow work.
 *
 * WHY THIS IS NOT A DOCTRINE BREACH
 * ---------------------------------
 * `BACKEND-AUTHORING-MODEL.md` draws one line: a workflow **references, routes
 * and reshapes**; a cloud function **computes**. Reshaping JSON is on the
 * reference side of it — this module reads paths and rebuilds an object, and it
 * never evaluates a string. Every operation is a NAME in the closed table below
 * with a fixed arity, exactly the trick the 19-operator condition language
 * already uses, so the editor can never offer an operation this backend cannot
 * perform and an authored definition can never smuggle code past validation.
 *
 * The case it exists for is Richard's, and it is a real one: a supplier's
 * webhook arrives nested and awkward, and without a reshaping step **every
 * function carries its caller's mess** — the function stops being a reusable
 * unit of work and becomes one welded to one caller's payload format.
 *
 * THREE DECISIONS THIS SLICE MADE, AND WHY
 * ----------------------------------------
 * 1. **No arithmetic.** CWF-004 proposed `$add`/`$subtract`/`$multiply`/
 *    `$divide` and this slice deliberately leaves them out. `VALUE_LANGUAGE`
 *    already SERVES the sentence "No arithmetic, string interpolation or
 *    function calls. Compute in a cloud function." to every client, and the
 *    doc says the same in three places. Shipping `$add` would falsify a served
 *    string before anyone had argued for it. Adding an op later is additive and
 *    served — removing one is not — so the first cut is the one that keeps every
 *    existing statement true. Reopen it deliberately, not by accident.
 * 2. **Ops are NOT in the shared resolver.** `values.ts` takes an op table as an
 *    argument and conditions never pass one. That is the whole answer to
 *    CWF-004's third design question: a condition still cannot compute, and it
 *    cannot start computing by someone widening a function it happens to share.
 * 3. **No wildcards (`lines.*.amount`) in v1.** They are a change to `getPath`,
 *    which conditions share, and CWF-004 is explicit that forking the resolver
 *    is the one thing not to do. Deferred whole rather than half-done.
 *
 * LOUDNESS, DECIDED ONCE FOR EVERY OP
 * -----------------------------------
 * An operation that cannot be performed **throws**, which is a step failure the
 * `onError` edge can route — matching conditions, where an unevaluable condition
 * has always been a loud failure rather than a silent `false`. So `$number` on
 * nonsense, `$upper` on an object and `$join` on a non-array all fail the step.
 *
 * The one deliberate exception is ABSENCE, which is not a failure anywhere else
 * in this language either: `getPath` yields `undefined` for a missing segment,
 * so `$get` past the end does too. `$default` is how an author says a field is
 * optional, and it is the op you reach for in front of every string op applied
 * to third-party data.
 *
 * @module nodegx-backend/workflow/steps/transform
 */

import type { StepExecContext, StepExecutor } from '../StepExecutor';
import { getPath, isPlainObject, MAX_VALUE_DEPTH, resolveValueDeep, ValueOpError } from './values';
import type { ValueOpTable } from './values';

/** Thrown when an operation cannot be performed. Becomes a loud step failure. */
export class TransformError extends ValueOpError {
  constructor(message: string) {
    super(message);
    this.name = 'TransformError';
  }
}

// ---------------------------------------------------------------------------
// Operand coercion — shared by the ops, so they fail the same way
// ---------------------------------------------------------------------------

function describe(v: unknown): string {
  if (v === undefined) return 'nothing (the path resolved to undefined)';
  if (v === null) return 'null';
  if (typeof v === 'string') return JSON.stringify(v);
  if (Array.isArray(v)) return 'an array';
  if (typeof v === 'object') return 'an object';
  return String(v);
}

/**
 * A value a string op will accept.
 *
 * Numbers and booleans are taken because a supplier's `postcode` arriving as a
 * number is normal and `$trim` of it is obviously meant. Objects, arrays, `null`
 * and `undefined` are refused, because "stringify this structure" is the Parse /
 * Stringify JSON step of the wider family — a thing to build deliberately, not
 * to fall out of `$string` producing `"[object Object]"`.
 */
function stringish(v: unknown, op: string, where: string): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  if (typeof v === 'boolean') return String(v);
  throw new TransformError(
    `"${op}" needs text for its ${where}, got ${describe(v)}. ` +
      'Use "$default" to supply a value when the path may be missing.'
  );
}

function requireArray(v: unknown, op: string, where: string): unknown[] {
  if (Array.isArray(v)) return v;
  throw new TransformError(`"${op}" needs an array for its ${where}, got ${describe(v)}.`);
}

function requireObject(v: unknown, op: string, where: string): Record<string, unknown> {
  if (isPlainObject(v)) return v;
  throw new TransformError(`"${op}" needs an object for its ${where}, got ${describe(v)}.`);
}

// ---------------------------------------------------------------------------
// The closed operation table
// ---------------------------------------------------------------------------

/**
 * How an operand list is written, which is fixed per op and therefore never
 * ambiguous:
 *
 *   arity 1        `{ "$lower": <value> }`        — the operand VERBATIM, never
 *                                                   unwrapped, so `{"$length":
 *                                                   [1,2,3]}` is the length of
 *                                                   that array and not a botched
 *                                                   argument list.
 *   arity n        `{ "$join": [<value>, ","] }`  — exactly n operands.
 *   'variadic'     `{ "$concat": [a, b, c] }`     — one or more.
 */
export const TRANSFORM_OPS: ValueOpTable = {
  $concat: {
    arity: 'variadic',
    apply: (args) => args.map((a, i) => stringish(a, '$concat', `part ${i + 1}`)).join('')
  },
  $join: {
    arity: 2,
    apply: ([list, separator]) =>
      requireArray(list, '$join', 'first operand')
        .map((item, i) => stringish(item, '$join', `item ${i}`))
        .join(stringish(separator, '$join', 'separator'))
  },
  $split: {
    arity: 2,
    apply: ([text, separator]) =>
      stringish(text, '$split', 'first operand').split(stringish(separator, '$split', 'separator'))
  },
  $lower: { arity: 1, apply: ([v]) => stringish(v, '$lower', 'operand').toLowerCase() },
  $upper: { arity: 1, apply: ([v]) => stringish(v, '$upper', 'operand').toUpperCase() },
  $trim: { arity: 1, apply: ([v]) => stringish(v, '$trim', 'operand').trim() },
  $string: { arity: 1, apply: ([v]) => stringish(v, '$string', 'operand') },
  $number: {
    arity: 1,
    apply: ([v]) => {
      if (typeof v === 'number' && Number.isFinite(v)) return v;
      if (typeof v === 'string') {
        const n = Number(v.trim());
        if (v.trim() !== '' && Number.isFinite(n)) return n;
      }
      throw new TransformError(
        `"$number" cannot read ${describe(v)} as a number. ` +
          'A value that is sometimes absent needs "$default" in front of it.'
      );
    }
  },
  /**
   * Null-coalesce. The one op that treats absence as ordinary rather than as a
   * failure, which is exactly what makes every other op able to be loud.
   */
  $default: { arity: 2, apply: ([v, fallback]) => (v === undefined || v === null ? fallback : v) },
  $length: {
    arity: 1,
    apply: ([v]) => {
      if (typeof v === 'string' || Array.isArray(v)) return v.length;
      if (isPlainObject(v)) return Object.keys(v).length;
      throw new TransformError(`"$length" needs text, an array or an object, got ${describe(v)}.`);
    }
  },
  /**
   * A path into a value that was itself computed — `$get` is to a value what
   * `$path` is to the run scope, and it uses the same walker, so a negative
   * index counts from the end here too. A missing segment is `undefined`, not a
   * failure, for the reason at the top of this file.
   */
  $get: {
    arity: 2,
    apply: ([v, path]) => {
      if (typeof path !== 'string') {
        throw new TransformError(`"$get" needs a dotted path as its second operand, got ${describe(path)}.`);
      }
      return getPath(v, path);
    }
  },
  /**
   * Keep only these keys. Absent keys are OMITTED rather than set to
   * `undefined`, because the result is JSON handed to a function and a key that
   * is present-but-undefined is not a thing JSON can express.
   */
  $pick: {
    arity: 2,
    apply: ([v, keys]) => {
      const source = requireObject(v, '$pick', 'first operand');
      const names = requireArray(keys, '$pick', 'key list');
      const out: Record<string, unknown> = {};
      for (const name of names) {
        if (typeof name !== 'string') {
          throw new TransformError(`"$pick" needs a list of key names, got ${describe(name)} in it.`);
        }
        if (Object.prototype.hasOwnProperty.call(source, name)) out[name] = source[name];
      }
      return out;
    }
  }
};

/** Every operation name, in table order. */
export const TRANSFORM_OP_NAMES = Object.keys(TRANSFORM_OPS);

/**
 * The served `control` name for the `output` param (CWF-005's mechanism).
 *
 * Named rather than inferred from `param.name === 'output'`, because "output" is
 * a word the rest of the family (Validate, Filter, Sort) will want too, and a
 * control keyed on a common param name is a collision waiting to be debugged.
 */
export const CONTROL_TRANSFORM_OUTPUT = 'transform-output';

// ---------------------------------------------------------------------------
// The served description of the vocabulary
// ---------------------------------------------------------------------------

export interface TransformOpSpec {
  /** The key an author writes, `$`-prefixed. */
  name: string;
  /** What a picker shows. */
  label: string;
  /** How many operands; `'variadic'` takes a non-empty array of them. */
  arity: number | 'variadic';
  /** One label per operand, so an editor can name its rows. */
  args: string[];
  description: string;
}

export interface TransformLanguageSpec {
  summary: string;
  ops: TransformOpSpec[];
  /** Rules an author (or an agent) needs before writing one. */
  notes: string[];
}

const OP_DOCS: Record<string, { label: string; args: string[]; description: string }> = {
  $concat: { label: 'join text', args: ['parts'], description: 'Run two or more values together into one string.' },
  $join: { label: 'join a list', args: ['list', 'separator'], description: 'Turn an array into one string.' },
  $split: { label: 'split text', args: ['text', 'separator'], description: 'Turn one string into an array.' },
  $lower: { label: 'lowercase', args: ['text'], description: 'Lowercase a value.' },
  $upper: { label: 'uppercase', args: ['text'], description: 'Uppercase a value.' },
  $trim: { label: 'trim spaces', args: ['text'], description: 'Remove leading and trailing whitespace.' },
  $string: { label: 'as text', args: ['value'], description: 'Read a number or boolean as text.' },
  $number: { label: 'as a number', args: ['value'], description: 'Read text as a number. Nonsense fails the step.' },
  $default: {
    label: 'or else',
    args: ['value', 'fallback'],
    description: 'Use the fallback when the value is missing or null. The way to say a field is optional.'
  },
  $length: { label: 'how many', args: ['value'], description: 'Length of text or an array; key count of an object.' },
  $get: {
    label: 'read a path',
    args: ['value', 'path'],
    description: 'Read a dotted path out of a value. A missing segment is nothing, not a failure.'
  },
  $pick: { label: 'keep only', args: ['object', 'keys'], description: 'Keep only the named keys of an object.' }
};

/**
 * The machine-readable description of the operation vocabulary, served inside
 * `GET /admin/workflow-step-kinds`.
 *
 * Served rather than bundled for the reason every other language here is: an
 * editor working from its own copy could offer an operation this backend cannot
 * perform, and an agent working from memory will simply INVENT one. Removing an
 * op from this table removes it from the editor's picker with no editor change,
 * which is the property CWF-004 asks for by name.
 */
export const TRANSFORM_LANGUAGE: TransformLanguageSpec = {
  summary:
    'A transform step builds a new object out of the run\'s data. Each field is a value — a literal, a `$path` ' +
    'reference, or one of the operations below applied to values. The set is CLOSED and every operation has a ' +
    'fixed arity: there is no expression syntax, no string interpolation and no user-supplied code.',
  ops: TRANSFORM_OP_NAMES.map((name) => ({
    name,
    label: OP_DOCS[name].label,
    arity: TRANSFORM_OPS[name].arity,
    args: OP_DOCS[name].args,
    description: OP_DOCS[name].description
  })),
  notes: [
    'An operation with one operand takes it verbatim: `{"$length": [1,2,3]}` is the length of that array.',
    'An operation with two or more takes an array of exactly that many: `{"$join": [{"$path":"body.tags"}, ", "]}`.',
    'Operations nest — an operand may itself be an operation, a `$path`, or a literal.',
    'A field CANNOT read another field of the same transform. Every field resolves against the run, in one pass, ' +
      'so there is no order to depend on. Chain two transform steps if you need one.',
    'An unknown `$operation` is refused when the workflow is saved; it is never passed through as data.',
    'An object that really does have a `$`-prefixed key is written `{"$literal": {"$type": …}}`.',
    'An operation that cannot be performed FAILS the step, so an `onError` edge can route it. The exception is ' +
      'absence: a missing path is `undefined`, and `$default` is how a field is declared optional.',
    'There is no arithmetic here. Compute in a cloud function — that is what the function is for.'
  ]
};

// ---------------------------------------------------------------------------
// Write-time validation
// ---------------------------------------------------------------------------

/**
 * Validate a transform's `output` without running it.
 *
 * CWF-004 asks for one property by name: **an unknown `$op` is a loud validation
 * failure at write time, never a silent passthrough.** That is what the
 * `$`-prefix rule below buys — an object whose sole key starts with `$` is
 * either `$path`, `$literal` or an operation this backend implements, and
 * anything else is a typo caught at `POST /admin/workflow-defs` rather than a
 * literal `{"$lowr": …}` object arriving at a cloud function six weeks later.
 */
export function validateTransformOutput(output: unknown, at: string): string[] {
  if (output === undefined) return [`${at}: transform needs an "output" object — it is what the step produces`];
  if (!isPlainObject(output)) {
    return [`${at}.params.output must be an object of { "<field>": <value> } — it is what the step produces`];
  }

  const errors: string[] = [];
  for (const [field, value] of Object.entries(output)) {
    if (!field.trim()) {
      errors.push(`${at}.params.output: a field needs a name — it is what the next step reads the value as`);
      continue;
    }
    errors.push(...validateTransformValue(value, `${at}.params.output.${field}`, 1));
  }
  return errors;
}

function validateTransformValue(value: unknown, where: string, depth: number): string[] {
  if (depth >= MAX_VALUE_DEPTH) {
    return [`${where} nests deeper than ${MAX_VALUE_DEPTH} levels, past where values are resolved`];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, i) => validateTransformValue(item, `${where}[${i}]`, depth + 1));
  }
  if (!isPlainObject(value)) return [];

  const keys = Object.keys(value);
  const dollar = keys.filter((k) => k.startsWith('$'));
  if (dollar.length === 0) {
    // A plain nested object in the output shape. Its values are values.
    return keys.flatMap((k) => validateTransformValue(value[k], `${where}.${k}`, depth + 1));
  }
  if (keys.length > 1) {
    return [
      `${where}: "${dollar[0]}" must be the only key of its object — write ` +
        '`{"$literal": {…}}` for data that really has a `$` key'
    ];
  }

  const key = dollar[0];
  if (key === '$literal') return []; // verbatim by definition, never looked inside
  if (key === '$path') {
    return typeof value.$path === 'string' ? [] : [`${where}: "$path" must be a dotted path string`];
  }

  const op = TRANSFORM_OPS[key];
  if (!op) {
    return [
      `${where}: unknown operation "${key}" — this backend performs ${TRANSFORM_OP_NAMES.join(', ')}. ` +
        'The vocabulary is served by GET /admin/workflow-step-kinds (transformLanguage).'
    ];
  }

  const operand = value[key];
  if (op.arity === 1) return validateTransformValue(operand, `${where}.${key}`, depth + 1);

  if (!Array.isArray(operand)) {
    return [
      `${where}: "${key}" takes ${op.arity === 'variadic' ? 'a non-empty array of operands' : `an array of ${op.arity} operands`}`
    ];
  }
  if (op.arity === 'variadic') {
    if (operand.length === 0) return [`${where}: "${key}" needs at least one operand`];
  } else if (operand.length !== op.arity) {
    return [`${where}: "${key}" takes exactly ${op.arity} operands, got ${operand.length}`];
  }
  return operand.flatMap((item, i) => validateTransformValue(item, `${where}.${key}[${i}]`, depth + 1));
}

// ---------------------------------------------------------------------------
// The executor
// ---------------------------------------------------------------------------

/**
 * Run a `transform` step: resolve `output` against the run scope and BE that
 * object.
 *
 * `output` is a `raw` param, which is load-bearing in the opposite direction to
 * CWF-001's: `raw` is what tells the engine NOT to value-resolve a param, and
 * here that is exactly right — resolving it generically would walk the op tree
 * with the plain resolver, leaving `{"$lower": "ADA@x"}` half-resolved in the
 * execution record and never applying the operation. So the engine passes it
 * through untouched, this executor evaluates it with the op table, and
 * `ctx.scope` (not `ctx.input`) is what it resolves against, so
 * `{"$path":"upstream.quote.total"}` means here what it means everywhere else.
 *
 * ⚠️ There is no fallback default for a missing `output`, and that is
 * deliberate (CWF-005's lesson: the executor's fallback is what ever actually
 * applies, so a declared default and a coded one drift apart in silence).
 * `output` is REQUIRED at write time; the throw below is defence for a
 * definition that reached here without passing validation, and it says so.
 */
export class TransformStepExecutor implements StepExecutor {
  async execute(ctx: StepExecContext): Promise<Record<string, unknown>> {
    const params = (ctx.step.params || {}) as Record<string, unknown>;
    const output = params.output;
    if (!isPlainObject(output)) {
      throw new TransformError(
        `Step "${ctx.step.id}" is a transform with no "output" object — it has nothing to produce. ` +
          'Write-time validation should have refused this definition.'
      );
    }

    const resolved = resolveValueDeep(output, ctx.scope, 0, TRANSFORM_OPS);
    // `output` is an object and `resolveValueDeep` maps an object to an object,
    // so this holds — asserted rather than re-checked, because a step's output
    // IS the engine's `Record<string, unknown>` contract.
    return resolved as Record<string, unknown>;
  }
}
