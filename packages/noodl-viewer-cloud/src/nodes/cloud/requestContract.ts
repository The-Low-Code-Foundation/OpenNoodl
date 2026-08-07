/**
 * CWF-014 — a cloud function's request contract.
 *
 * A cloud function is an **HTTP endpoint**: its caller is not the graph next
 * door, it is a supplier's webhook, a mobile app, another team. Until this
 * module the whole of its public interface was the Request node's `params` —
 * a comma-separated list of names, each minting one `'*'`-typed output straight
 * onto the parsed body. A function expecting `{ total: number }` and given
 * `{ total: "banana" }` ran happily and wrote `"banana"` into a record.
 *
 * ## The declaration
 *
 * `params` is unchanged and still says **which** parameters exist. Each name
 * `N` may carry three optional sibling parameters saying what it **is**:
 *
 * | Parameter | Meaning | Absent means |
 * |---|---|---|
 * | `ptype-<N>` | one of {@link REQUEST_PARAM_TYPES} | `*` — anything, unchecked |
 * | `preq-<N>`  | the caller must supply it | optional |
 * | `pdef-<N>`  | value used when the caller omits it | no default |
 *
 * That shape is not invented here: it is `simplejavascript`'s `intype-<label>` /
 * `outtype-<label>`, which is how this codebase has always attached a type to a
 * name in a name list. It buys three things a new proplist parameter would not:
 *
 *   1. **A function with no declaration is byte-identical on disk.** No new key
 *      is written until an author sets one, so every existing function and every
 *      shipped prefab (`library/prefabs/stripe` alone has seven Request nodes)
 *      round-trips unchanged, and the WFA-009 suite passes untouched.
 *   2. **No new editor.** Each row is an ordinary enum/boolean/string port, so
 *      the property panel already renders it and the connection bar already
 *      hides it (`allowEditOnly`).
 *   3. **No new dynamic-port dialect.** Three more `namedports/list` rules over
 *      the same parameter — the rule the editor and the runtime already agree on
 *      port-for-port (WFA-009).
 *
 * ## What the types mean on the wire
 *
 * ⚠️ The typecast table (`nodelibraryexport.ts`) governs **wires between two
 * declared ports**. It is not a converter and it has no inbound row for `date`
 * at all, so "reuse the typecast table" only half-answers an HTTP body. What is
 * reused is its *judgement of what is lossless enough*: every coercion below is
 * a row of that table, in that direction — `string → number`, `string →
 * boolean`, `number → string`, `boolean → number`, `object → string`. The one
 * addition is `date`, which JSON cannot carry natively and which therefore has
 * to arrive as an ISO string or an epoch number or not at all.
 *
 * ⚠️ And one deliberate divergence: `Node.setInputValue` turns a string into an
 * object or array by `eval`. A request body is attacker-controlled, so here it
 * is `JSON.parse` and nothing else.
 *
 * @module nodes/cloud/requestContract
 */

/** The declared type vocabulary. Port-type names, verbatim — no parallel language. */
export const REQUEST_PARAM_TYPES = ['*', 'string', 'number', 'boolean', 'object', 'array', 'date'] as const;

export type RequestParamType = (typeof REQUEST_PARAM_TYPES)[number];

/** The parameter-name prefixes that carry the contract. */
export const TYPE_PREFIX = 'ptype-';
export const REQUIRED_PREFIX = 'preq-';
export const DEFAULT_PREFIX = 'pdef-';

/** Is this parameter name part of the contract rather than a value? */
export function isContractParameter(name: string): boolean {
  return name.startsWith(TYPE_PREFIX) || name.startsWith(REQUIRED_PREFIX) || name.startsWith(DEFAULT_PREFIX);
}

/** One declared request parameter. */
export interface RequestParamSpec {
  name: string;
  type: RequestParamType;
  required: boolean;
  /** The raw declared default, before coercion. `undefined` when none was declared. */
  default?: unknown;
}

/** One reason a body was refused, in the shape the 400 body carries. */
export interface RequestParamError {
  name: string;
  code: 'missing' | 'type';
  expected: RequestParamType;
  /** The JSON type actually received. Never the value — see the note on `describe`. */
  received?: string;
}

/**
 * A request refused before the graph ran (CWF-014 slice 2).
 *
 * Modelled on `CloudFunctionTimeoutError`, including the reason it is recognised
 * by `name` rather than `instanceof`: the backend consumes this package through
 * a bundler alias, so an `instanceof` that depends on one module instance is a
 * check that silently starts answering "no".
 */
export class CloudFunctionBadRequestError extends Error {
  readonly kind: 'bad-request' = 'bad-request';
  readonly statusCode: number = 400;

  constructor(readonly fields: RequestParamError[]) {
    super('Invalid request body: ' + fields.map(describeError).join('; '));
    this.name = 'CloudFunctionBadRequestError';
  }
}

/** Is this the refusal above? By `name`, for the reason stated on the class. */
export function isCloudFunctionBadRequest(e: unknown): e is CloudFunctionBadRequestError {
  return !!e && typeof e === 'object' && (e as Error).name === 'CloudFunctionBadRequestError';
}

/** One field's reason, in words a caller can act on. */
export function describeError(error: RequestParamError): string {
  if (error.code === 'missing') return `"${error.name}" is required`;
  return `"${error.name}" expects ${error.expected}, received ${error.received}`;
}

/**
 * The names held by a `stringlist` parameter.
 *
 * Deliberately identical to `namesFromListParameter` in the editor's
 * `dynamicPortRules` and to the `filter` in this node's own `setup()` — the
 * three must agree port for port (WFA-009) and this module cannot import
 * either of them. Empty entries dropped, repeats collapsed, no trimming (a name
 * may legitimately contain a space: `Customer Id` ships in a prefab today).
 */
export function paramNames(value: unknown): string[] {
  if (value === undefined || value === null || value === '') return [];
  const raw = Array.isArray(value) ? value.map((v) => String(v)) : typeof value === 'string' ? value.split(',') : [];
  return raw.filter((p, i, all) => !!p && all.indexOf(p) === i);
}

/** Is this a declared type name, or something an older/newer editor wrote? */
function asType(value: unknown): RequestParamType {
  return (REQUEST_PARAM_TYPES as readonly string[]).indexOf(value as string) !== -1
    ? (value as RequestParamType)
    : '*';
}

/**
 * The contract a Request node's parameters declare.
 *
 * Pure, and exported for the readers that are not this node: CWF-001's param
 * mapping UI, the editor's Cloud Function node, and whatever generates an
 * OpenAPI description later all need *the same* answer, and deriving it twice is
 * how two answers happen.
 *
 * ⚠️ An unknown `ptype-` value degrades to `*` rather than erroring. The
 * alternative is a function that stops serving because someone opened it in a
 * newer editor.
 */
export function requestParamSpecs(parameters: Record<string, unknown> | undefined): RequestParamSpec[] {
  const params = parameters || {};
  return paramNames(params['params']).map((name) => {
    const spec: RequestParamSpec = {
      name,
      type: asType(params[TYPE_PREFIX + name]),
      required: params[REQUIRED_PREFIX + name] === true || params[REQUIRED_PREFIX + name] === 'true'
    };
    const declaredDefault = params[DEFAULT_PREFIX + name];
    if (declaredDefault !== undefined && declaredDefault !== '') spec.default = declaredDefault;
    return spec;
  });
}

/** Does this contract ask anything at all? A function with no declaration skips every check. */
export function contractIsEmpty(specs: RequestParamSpec[]): boolean {
  return specs.every((s) => s.type === '*' && !s.required && s.default === undefined);
}

/** The JSON type name of a received value, for the error body. */
function describe(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date);
}

/** `{ ok, value }` or `{ ok: false }` — a coercion either produced a value or did not. */
type Coerced = { ok: true; value: unknown } | { ok: false };

const FAILED: Coerced = { ok: false };

/**
 * Coerce one received value to a declared type, or refuse.
 *
 * Every accepted conversion is a declared typecast in that direction, except
 * `date` — see the module note.
 */
export function coerce(type: RequestParamType, value: unknown): Coerced {
  switch (type) {
    case '*':
      return { ok: true, value };

    case 'string':
      if (typeof value === 'string') return { ok: true, value };
      // number -> string, boolean -> string, object/array -> string (JSON) are
      // all declared casts.
      if (typeof value === 'number' && isFinite(value)) return { ok: true, value: String(value) };
      if (typeof value === 'boolean') return { ok: true, value: String(value) };
      if (isPlainObject(value) || Array.isArray(value)) {
        try {
          return { ok: true, value: JSON.stringify(value) };
        } catch (e) {
          return FAILED; // circular — cannot come from JSON.parse, but a caller of this module could.
        }
      }
      return FAILED;

    case 'number': {
      if (typeof value === 'number') return isFinite(value) ? { ok: true, value } : FAILED;
      // string -> number is the declared cast this task's criterion names: "42" is 42.
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed === '') return FAILED;
        const n = Number(trimmed);
        return isFinite(n) ? { ok: true, value: n } : FAILED;
      }
      if (typeof value === 'boolean') return { ok: true, value: value ? 1 : 0 };
      return FAILED;
    }

    case 'boolean':
      if (typeof value === 'boolean') return { ok: true, value };
      if (typeof value === 'string') {
        const lowered = value.trim().toLowerCase();
        if (lowered === 'true') return { ok: true, value: true };
        if (lowered === 'false') return { ok: true, value: false };
        return FAILED;
      }
      if (typeof value === 'number' && isFinite(value)) return { ok: true, value: value !== 0 };
      return FAILED;

    case 'object':
    case 'array': {
      const wanted = type === 'array' ? Array.isArray(value) : isPlainObject(value);
      if (wanted) return { ok: true, value };
      if (typeof value === 'string') {
        // JSON.parse, never eval: this string came off the wire.
        let parsed: unknown;
        try {
          parsed = JSON.parse(value);
        } catch (e) {
          return FAILED;
        }
        const parsedWanted = type === 'array' ? Array.isArray(parsed) : isPlainObject(parsed);
        return parsedWanted ? { ok: true, value: parsed } : FAILED;
      }
      return FAILED;
    }

    case 'date': {
      if (value instanceof Date) return isFinite(value.getTime()) ? { ok: true, value } : FAILED;
      if (typeof value === 'number' && isFinite(value)) return { ok: true, value: new Date(value) };
      if (typeof value === 'string') {
        const ms = Date.parse(value);
        return isFinite(ms) ? { ok: true, value: new Date(ms) } : FAILED;
      }
      return FAILED;
    }

    default:
      return { ok: true, value };
  }
}

/**
 * Apply a contract to a parsed request body.
 *
 * Returns the body the graph should see and every reason it should not run.
 *
 * Three rules worth stating because a reader will assume one of them differently:
 *
 * - **Undeclared keys pass through untouched.** A contract types what it names
 *   and says nothing about the rest, so a function that declares one parameter
 *   is not suddenly refusing every other key its caller sends.
 * - **`null` is absent.** A caller writing `{"total": null}` means "no value",
 *   and treating it as a type error would refuse the ordinary way a client
 *   serialises an empty field.
 * - **A default beats `required`.** If both are declared, the default is used
 *   and the request is not refused: `required` means "the caller must supply
 *   it", and declaring a fallback is saying they need not.
 */
export function applyRequestContract(
  specs: RequestParamSpec[],
  body: Record<string, unknown>
): { values: Record<string, unknown>; errors: RequestParamError[] } {
  const values: Record<string, unknown> = { ...body };
  const errors: RequestParamError[] = [];

  for (const spec of specs) {
    const supplied = body[spec.name];

    if (supplied === undefined || supplied === null) {
      if (spec.default !== undefined) {
        // The default goes through the same door as a supplied value, so
        // `pdef-total: "0"` on a `number` parameter arrives as `0` and a default
        // the declared type cannot accept is caught here rather than at runtime.
        const coerced = coerce(spec.type, spec.default);
        if (coerced.ok) values[spec.name] = coerced.value;
        else delete values[spec.name];
      } else if (spec.required) {
        errors.push({ name: spec.name, code: 'missing', expected: spec.type });
      } else {
        // Absent and optional: leave it absent rather than minting `undefined`,
        // so `getRequestParameter` answers exactly as it did before this task.
        delete values[spec.name];
      }
      continue;
    }

    const coerced = coerce(spec.type, supplied);
    if (coerced.ok) values[spec.name] = coerced.value;
    else
      errors.push({ name: spec.name, code: 'type', expected: spec.type, received: describe(supplied) });
  }

  return { values, errors };
}
